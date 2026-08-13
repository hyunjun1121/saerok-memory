import path from "node:path";
import { fileURLToPath } from "node:url";

import { importAllRightNarration } from "./day1RuntimeImport.mjs";

const toolRoot = path.dirname(fileURLToPath(import.meta.url));
const demoRoot = path.resolve(toolRoot, "../..");

try {
  const result = await importAllRightNarration({ demoRoot, toolRoot });
  process.stdout.write(
    `Applied ${result.audit.entryCount} Day 1 B narrations; manifest entries ${result.manifest.entries.length}.\n`,
  );
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
}
