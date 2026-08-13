import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const toolDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(toolDirectory, "../..");
const sourcePath = path.join(toolDirectory, "narration-source.json");
const outputDirectory = path.join(projectRoot, "public/assets/audio/narration");
const manifestPath = path.join(outputDirectory, "manifest.json");

const source = JSON.parse(await fs.readFile(sourcePath, "utf8"));
const manifest = JSON.parse(await fs.readFile(manifestPath, "utf8"));
const expected = new Map(source.entries.map((entry) => [`${entry.locale}:${entry.id}`, entry.text]));
const seen = new Set();

if (manifest.schemaVersion !== 1) throw new Error("Unsupported narration manifest schema");
if (manifest.entries.length !== expected.size) {
  throw new Error(`Manifest has ${manifest.entries.length} entries; expected ${expected.size}`);
}

for (const entry of manifest.entries) {
  const key = `${entry.locale}:${entry.id}`;
  if (seen.has(key)) throw new Error(`Duplicate manifest entry: ${key}`);
  seen.add(key);
  if (expected.get(key) !== entry.text) throw new Error(`Source mismatch: ${key}`);
  expected.delete(key);
  if (!entry.path.startsWith("assets/audio/narration/") || entry.path.includes("..")) {
    throw new Error(`Unsafe narration path: ${entry.path}`);
  }
  if (entry.audioPath !== entry.path) throw new Error(`audioPath mismatch: ${key}`);
  const relative = entry.path.slice("assets/audio/narration/".length);
  const audioPath = path.join(outputDirectory, relative);
  const bytes = await fs.readFile(audioPath);
  const hash = crypto.createHash("sha256").update(bytes).digest("hex");
  if (hash !== entry.sha256) throw new Error(`SHA-256 mismatch: ${key}`);
  if (!Number.isFinite(entry.durationMs) || entry.durationMs <= 0) {
    throw new Error(`Invalid duration: ${key}`);
  }
}
if (expected.size > 0) throw new Error(`Missing ${expected.size} narration source entries`);

console.log(`Validated ${manifest.entries.length} local narration entries.`);
