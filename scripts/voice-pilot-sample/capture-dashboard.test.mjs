import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { captureDashboard } from "./capture-dashboard.mjs";

test("adds exact PNG capture files to the separate analysis artifact index", async () => {
  const temporaryRoot = await mkdtemp(path.join(tmpdir(), "haru-dashboard-capture-"));
  const analysisDirectory = path.join(temporaryRoot, "analysis");
  const dashboardPath = path.join(analysisDirectory, "dashboard.html");
  const outputDirectory = path.join(analysisDirectory, "charts", "png");
  await mkdir(analysisDirectory, { recursive: true });
  await writeFile(
    dashboardPath,
    "<!doctype html><html><body><main data-capture='overview'>요약</main><section data-capture='actions'>개선</section></body></html>",
    "utf8",
  );
  await writeFile(
    path.join(analysisDirectory, "artifact-index.json"),
    JSON.stringify({
      schemaVersion: "haru-voice-pilot-sample-analysis-artifacts-v1",
      generatedAt: "2026-08-06T00:00:00.000Z",
      dataKind: "sample",
      inventoryScope: "analysis_outputs_only",
      dataset: {
        dataKind: "sample",
        label: "샘플 데이터",
        containsRestrictedTranscript: false,
        containsAudioFiles: false,
      },
      artifacts: [
        { path: "artifact-index.json", mediaType: "application/json", stage: "inventory" },
        { path: "dashboard.html", mediaType: "text/html", stage: "analysis" },
      ],
      totals: { analysis: 1, capture: 0, inventory: 1, all: 2 },
    }),
    "utf8",
  );

  const result = await captureDashboard({
    dashboardPath,
    outputDirectory,
    viewportWidth: 640,
    viewportHeight: 480,
  });
  assert.deepEqual(result.cards, ["01-overview.png", "02-actions.png"]);

  const artifactIndex = JSON.parse(
    await readFile(path.join(analysisDirectory, "artifact-index.json"), "utf8"),
  );
  const capturePaths = artifactIndex.artifacts
    .filter((artifact) => artifact.stage === "capture")
    .map((artifact) => artifact.path);
  assert.deepEqual(capturePaths, [
    "charts/png/dashboard-full.png",
    "charts/png/01-overview.png",
    "charts/png/02-actions.png",
  ]);
  assert.equal(artifactIndex.totals.analysis, 1);
  assert.equal(artifactIndex.totals.capture, 3);
  assert.equal(artifactIndex.totals.inventory, 1);
  assert.equal(artifactIndex.totals.all, 5);
  assert.equal(artifactIndex.capture.viewportWidth, 640);
  assert.equal(artifactIndex.capture.viewportHeight, 480);
});
