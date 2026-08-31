#!/usr/bin/env node
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { chromium } from "@playwright/test";

import { addCaptureArtifacts } from "./artifact-index.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const defaultDashboardPath = path.join(
  repoRoot,
  "docs",
  "voice-pilot-sample-20x7",
  "analysis",
  "dashboard.html",
);

function safeFilename(value) {
  const filename = String(value ?? "section")
    .normalize("NFKC")
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return filename || "section";
}

export async function captureDashboard({
  dashboardPath = defaultDashboardPath,
  outputDirectory = path.join(path.dirname(dashboardPath), "charts", "png"),
  viewportWidth = 1440,
  viewportHeight = 1000,
} = {}) {
  const resolvedDashboard = path.resolve(dashboardPath);
  const resolvedOutput = path.resolve(outputDirectory);
  await mkdir(resolvedOutput, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({
      viewport: { width: viewportWidth, height: viewportHeight },
      deviceScaleFactor: 1,
      colorScheme: "light",
    });
    await page.goto(pathToFileURL(resolvedDashboard).href, { waitUntil: "load" });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.screenshot({
      path: path.join(resolvedOutput, "dashboard-full.png"),
      fullPage: true,
      animations: "disabled",
    });

    const sections = page.locator("[data-capture]");
    const count = await sections.count();
    const cardFiles = [];
    for (let index = 0; index < count; index += 1) {
      const section = sections.nth(index);
      const name = safeFilename(await section.getAttribute("data-capture"));
      const filename = `${String(index + 1).padStart(2, "0")}-${name}.png`;
      await section.screenshot({
        path: path.join(resolvedOutput, filename),
        animations: "disabled",
      });
      cardFiles.push(filename);
    }

    const analysisDirectory = path.dirname(resolvedDashboard);
    const artifactIndexPath = path.join(analysisDirectory, "artifact-index.json");
    let artifactIndex;
    try {
      artifactIndex = JSON.parse(await readFile(artifactIndexPath, "utf8"));
    } catch (error) {
      throw new Error(
        `Cannot update analysis artifact inventory. Run analyze.mjs first. ${error.message}`,
      );
    }
    const relativeCapturePath = (filename) =>
      path.relative(analysisDirectory, path.join(resolvedOutput, filename));
    const updatedIndex = addCaptureArtifacts(artifactIndex, {
      capturePaths: [relativeCapturePath("dashboard-full.png"), ...cardFiles.map(relativeCapturePath)],
      dashboardPath: path.relative(analysisDirectory, resolvedDashboard),
      viewportWidth,
      viewportHeight,
      capturedAt: new Date().toISOString(),
    });
    await writeFile(artifactIndexPath, `${JSON.stringify(updatedIndex, null, 2)}\n`, "utf8");

    return {
      dashboardPath: resolvedDashboard,
      outputDirectory: resolvedOutput,
      fullPage: "dashboard-full.png",
      cards: cardFiles,
    };
  } finally {
    await browser.close();
  }
}

function usage() {
  return `Usage: node scripts/voice-pilot-sample/capture-dashboard.mjs [options]

Options:
  --dashboard <path>  generated dashboard.html
  --output <path>     PNG output directory
  --width <pixels>    viewport width (default 1440)
  --height <pixels>   viewport height (default 1000)
  --help              show this message
`;
}

function positiveInteger(value, option) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed <= 0) throw new Error(`${option} must be positive.`);
  return parsed;
}

function parseArguments(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--help" || argument === "-h") return { help: true };
    if (["--dashboard", "--output", "--width", "--height"].includes(argument)) {
      const value = argv[index + 1];
      if (!value || value.startsWith("--")) throw new Error(`Missing value for ${argument}.`);
      index += 1;
      if (argument === "--dashboard") options.dashboardPath = value;
      if (argument === "--output") options.outputDirectory = value;
      if (argument === "--width") options.viewportWidth = positiveInteger(value, argument);
      if (argument === "--height") options.viewportHeight = positiveInteger(value, argument);
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
      const result = await captureDashboard(options);
      process.stdout.write(
        `Haru sample-data dashboard PNGs written: ${result.outputDirectory}\n` +
          `Full page: ${result.fullPage}; cards: ${result.cards.length}\n`,
      );
    }
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}
