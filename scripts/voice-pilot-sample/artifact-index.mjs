export const ARTIFACT_INDEX_SCHEMA_VERSION =
  "haru-voice-pilot-sample-analysis-artifacts-v1";

function normalizedPath(value) {
  return String(value).replaceAll("\\", "/");
}

function mediaType(filename) {
  if (filename.endsWith(".json")) return "application/json";
  if (filename.endsWith(".html")) return "text/html";
  if (filename.endsWith(".md")) return "text/markdown";
  if (filename.endsWith(".svg")) return "image/svg+xml";
  if (filename.endsWith(".png")) return "image/png";
  return "application/octet-stream";
}

function totals(artifacts) {
  const count = (stage) => artifacts.filter((artifact) => artifact.stage === stage).length;
  return {
    analysis: count("analysis"),
    capture: count("capture"),
    inventory: count("inventory"),
    all: artifacts.length,
  };
}

function artifact(path, stage) {
  const normalized = normalizedPath(path);
  return { path: normalized, mediaType: mediaType(normalized), stage };
}

export function createAnalysisArtifactIndex({ generatedAt = null, analysisPaths }) {
  const artifacts = [
    artifact("artifact-index.json", "inventory"),
    ...analysisPaths.map((filename) => artifact(filename, "analysis")),
  ];
  return {
    schemaVersion: ARTIFACT_INDEX_SCHEMA_VERSION,
    generatedAt,
    dataKind: "sample",
    inventoryScope: "analysis_outputs_only",
    sourceDataInventory: "../manifest.json#files",
    dataset: {
      dataKind: "sample",
      label: "샘플 데이터",
      containsRestrictedTranscript: false,
      containsAudioFiles: false,
    },
    artifacts,
    totals: totals(artifacts),
  };
}

export function addCaptureArtifacts(
  index,
  { capturePaths, dashboardPath, viewportWidth, viewportHeight, capturedAt },
) {
  if (index?.schemaVersion !== ARTIFACT_INDEX_SCHEMA_VERSION) {
    throw new Error(`artifact-index.json must use ${ARTIFACT_INDEX_SCHEMA_VERSION}.`);
  }
  if (index.inventoryScope !== "analysis_outputs_only" || index.dataKind !== "sample") {
    throw new Error("artifact-index.json must describe sample analysis outputs only.");
  }
  const artifacts = [
    ...index.artifacts.filter((item) => item?.stage !== "capture"),
    ...capturePaths.map((filename) => artifact(filename, "capture")),
  ];
  return {
    ...index,
    artifacts,
    totals: totals(artifacts),
    capture: {
      dashboardPath: normalizedPath(dashboardPath),
      viewportWidth,
      viewportHeight,
      capturedAt,
    },
  };
}
