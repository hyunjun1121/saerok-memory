import { createHash } from "node:crypto";
import { access, copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readSelectionDocument } from "./selectionStore.mjs";

const jaRoot = path.dirname(fileURLToPath(import.meta.url));
const piRoot = path.resolve(jaRoot, "../../../../");
// jaRoot is four levels below the repository root:
// raspberry-pi-demo/tools/fish-day1-browser/ja -> repository root.
const repoRoot = piRoot;
const inventoryPath = path.join(jaRoot, "day1-inventory.json");
const selectionsPath = path.join(jaRoot, "day1-selections.json");
const runtimeRoot = path.join(repoRoot, "public", "assets", "audio", "narration", "ja", "day1");

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

async function mustRead(filePath, label) {
  try {
    return await readFile(filePath);
  } catch (error) {
    throw new Error(`${label}을 읽을 수 없습니다: ${error instanceof Error ? error.message : String(error)}`);
  }
}

const inventory = JSON.parse((await mustRead(inventoryPath, "Japanese inventory")).toString("utf8"));
const selections = readSelectionDocument(selectionsPath, inventory);
if (!selections.complete) {
  throw new Error(`31문을 모두 선택한 뒤 가져오세요. 현재 ${selections.selectedCount}/${selections.entryCount}문입니다.`);
}

await mkdir(runtimeRoot, { recursive: true });
const selectionsById = new Map(selections.selections.map((selection) => [selection.id, selection]));
const imported = [];

for (const entry of inventory.entries) {
  const selection = selectionsById.get(entry.id);
  if (!selection) throw new Error(`선택 누락: ${entry.id}`);
  const selectedCandidate = entry.candidates.find((candidate) => candidate.voiceId === selection.voiceId);
  const sourcePath = path.resolve(jaRoot, ...selection.audioPath.split("/"));
  const sourceBytes = await mustRead(sourcePath, `${entry.id} 선택 음원`);
  if (sourceBytes.length === 0) throw new Error(`${entry.id} 선택 음원이 비어 있습니다.`);
  const filename = `${String(entry.index).padStart(2, "0")}_${entry.slug}.mp3`;
  const targetPath = path.join(runtimeRoot, filename);
  try {
    const existing = await readFile(targetPath);
    if (sha256(existing) !== sha256(sourceBytes)) {
      throw new Error(`${filename}이 이미 있고 내용이 다릅니다. 기존 파일을 먼저 확인하세요.`);
    }
  } catch (error) {
    if (error?.code === "ENOENT") await copyFile(sourcePath, targetPath);
    else throw error;
  }
  imported.push({
    index: entry.index,
    id: entry.id,
    text: entry.text,
    voiceId: selection.voiceId,
    ...(selectedCandidate?.tagStyle === undefined ? {} : { tagStyle: selectedCandidate.tagStyle }),
    ...(selectedCandidate?.taggedText === undefined ? {} : { taggedText: selectedCandidate.taggedText }),
    sourcePath: selection.audioPath,
    sourceSha256: sha256(sourceBytes),
    runtimePath: `/assets/audio/narration/ja/day1/${filename}`,
  });
}

const manifest = {
  schemaVersion: 1,
  locale: "ja",
  market: "jp",
  day: 1,
  provider: "Fish Audio",
  selectionCount: imported.length,
  importedAt: new Date().toISOString(),
  entries: imported,
};
await writeFile(path.join(runtimeRoot, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
console.log(`Imported ${imported.length} Japanese Day 1 narrations to ${runtimeRoot}`);
