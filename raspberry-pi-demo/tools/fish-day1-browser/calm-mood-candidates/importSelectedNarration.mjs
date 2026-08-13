import path from "node:path";
import { fileURLToPath } from "node:url";

import { importSelectedCalmMoodNarration } from "./calmMoodRuntimeImport.mjs";

const calmRoot = path.dirname(fileURLToPath(import.meta.url));
const demoRoot = path.resolve(calmRoot, "../../..");

try {
  const result = await importSelectedCalmMoodNarration({ demoRoot, calmRoot });
  process.stdout.write(
    `Applied ${result.audit.entryCount} selected calm mood narrations; manifest entries ${result.manifest.entries.length}.\n`,
  );
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
}
