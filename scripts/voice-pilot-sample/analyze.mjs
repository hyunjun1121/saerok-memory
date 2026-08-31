#!/usr/bin/env node
import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { analyzeSyntheticPilot } from "./analysis-core.mjs";
import { createAnalysisArtifactIndex } from "./artifact-index.mjs";
import {
  renderDashboardHtml,
  renderFindingsMarkdown,
  renderMethodologyMarkdown,
  renderStaticCharts,
} from "./dashboard-render.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const defaultInputPath = path.join(
  repoRoot,
  "docs",
  "voice-pilot-sample-20x7",
  "operational_export.json",
);

async function exists(filename) {
  try {
    await access(filename);
    return true;
  } catch {
    return false;
  }
}

async function readJson(filename) {
  let source;
  try {
    source = await readFile(filename, "utf8");
  } catch (error) {
    throw new Error(`Cannot read analysis input: ${filename}. ${error.message}`);
  }
  try {
    return JSON.parse(source);
  } catch (error) {
    throw new Error(`Invalid JSON analysis input: ${filename}. ${error.message}`);
  }
}

function restrictedReviewStrings(source) {
  const rows = Array.isArray(source?.sttReviewRows)
    ? source.sttReviewRows
    : Array.isArray(source?.rows)
      ? source.rows
      : [];
  return rows
    .flatMap((row) => [row?.referenceTranscript, row?.hypothesisTranscript])
    .filter((value) => typeof value === "string" && value.trim().length >= 8)
    .map((value) => value.trim());
}

function assertNoRestrictedText(filename, content, restrictedStrings) {
  for (const restricted of restrictedStrings) {
    if (content.includes(restricted)) {
      throw new Error(`Restricted STT review text leaked into ${filename}.`);
    }
  }
}

export async function runAnalysisPipeline({
  inputPath = defaultInputPath,
  reviewPath,
  outputDirectory = path.join(path.dirname(inputPath), "analysis"),
} = {}) {
  const operational = await readJson(path.resolve(inputPath));
  if (Array.isArray(operational.sttReviewRows) || Array.isArray(operational.rows)) {
    throw new Error(
      "operational_export.json must not contain restricted STT rows; use restricted/stt_review_rows.json.",
    );
  }
  const hasVoiceAttempts = (
    Array.isArray(operational.questionAttempts) ? operational.questionAttempts : []
  ).some((attempt) =>
    String(attempt?.questionType ?? attempt?.type ?? "").includes("voice"),
  );
  let restrictedReview = { dataKind: "sample", rows: [] };
  if (reviewPath) {
    restrictedReview = await readJson(path.resolve(reviewPath));
  } else {
    const siblingReview = path.join(
      path.dirname(path.resolve(inputPath)),
      "restricted",
      "stt_review_rows.json",
    );
    if (await exists(siblingReview)) {
      restrictedReview = await readJson(siblingReview);
    } else if (hasVoiceAttempts) {
      throw new Error(`Voice analysis requires separated review file: ${siblingReview}`);
    }
  }
  const restrictedRows = Array.isArray(restrictedReview?.rows)
    ? restrictedReview.rows
    : Array.isArray(restrictedReview?.sttReviewRows)
      ? restrictedReview.sttReviewRows
      : [];
  if (hasVoiceAttempts && restrictedReview?.dataKind !== "sample") {
    throw new Error('Voice analysis requires dataKind="sample" on separated STT review.');
  }
  if (hasVoiceAttempts && restrictedRows.length === 0) {
    throw new Error("Voice analysis requires non-empty separated STT review rows.");
  }

  const analysis = analyzeSyntheticPilot(operational, restrictedReview);
  const resolvedOutputDirectory = path.resolve(outputDirectory);
  const chartsDirectory = path.join(resolvedOutputDirectory, "charts");
  await mkdir(chartsDirectory, { recursive: true });

  const restrictedStrings = [
    ...restrictedReviewStrings(restrictedReview),
  ];
  const outputs = {
    "metrics.json": `${JSON.stringify(analysis, null, 2)}\n`,
    "dashboard.html": renderDashboardHtml(analysis),
    "findings.md": renderFindingsMarkdown(analysis),
    "methodology.md": renderMethodologyMarkdown(analysis),
  };
  for (const [filename, content] of Object.entries(outputs)) {
    assertNoRestrictedText(filename, content, restrictedStrings);
    await writeFile(path.join(resolvedOutputDirectory, filename), content, "utf8");
  }

  const charts = renderStaticCharts(analysis);
  for (const [filename, content] of Object.entries(charts)) {
    assertNoRestrictedText(filename, content, restrictedStrings);
    await writeFile(path.join(chartsDirectory, filename), content, "utf8");
  }

  const artifactIndex = createAnalysisArtifactIndex({
    generatedAt: analysis.generatedAt,
    analysisPaths: [
      ...Object.keys(outputs),
      ...Object.keys(charts).map((filename) => path.posix.join("charts", filename)),
    ],
  });
  const artifactIndexContent = `${JSON.stringify(artifactIndex, null, 2)}\n`;
  assertNoRestrictedText("artifact-index.json", artifactIndexContent, restrictedStrings);
  const artifactIndexPath = path.join(resolvedOutputDirectory, "artifact-index.json");
  await writeFile(artifactIndexPath, artifactIndexContent, "utf8");

  return {
    analysis,
    inputPath: path.resolve(inputPath),
    outputDirectory: resolvedOutputDirectory,
    files: [
      artifactIndexPath,
      ...Object.keys(outputs).map((filename) => path.join(resolvedOutputDirectory, filename)),
      ...Object.keys(charts).map((filename) => path.join(chartsDirectory, filename)),
    ],
  };
}

function usage() {
  return `Usage: node scripts/voice-pilot-sample/analyze.mjs [options]

Options:
  --input <path>   operational_export.json
  --review <path>  optional restricted_stt_review.json
  --output <path>  output directory (default: <input>/analysis)
  --help           show this message
`;
}

function parseArguments(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--help" || argument === "-h") return { help: true };
    if (["--input", "--review", "--output"].includes(argument)) {
      const value = argv[index + 1];
      if (!value || value.startsWith("--")) throw new Error(`Missing value for ${argument}.`);
      index += 1;
      if (argument === "--input") options.inputPath = value;
      if (argument === "--review") options.reviewPath = value;
      if (argument === "--output") options.outputDirectory = value;
      continue;
    }
    throw new Error(`Unknown argument: ${argument}.`);
  }
  return options;
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : "";
if (invokedPath === fileURLToPath(import.meta.url)) {
  try {
    const options = parseArguments(process.argv.slice(2));
    if (options.help) {
      process.stdout.write(usage());
    } else {
      const result = await runAnalysisPipeline(options);
      process.stdout.write(
        `Haru sample-data analysis written: ${result.outputDirectory}\n` +
          `Participants: ${result.analysis.overview.participantCount}; files: ${result.files.length}\n`,
      );
    }
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}
