import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";
import { buildNarrationSource } from "./sourceManifest.mjs";

const toolDir = path.dirname(new URL(import.meta.url).pathname.replace(/^\/(.:)/, "$1"));
const projectRoot = path.resolve(toolDir, "../..");
const exerciseModulePath = path.join(projectRoot, "src/data/haru7DayExercises.ts");
const outputPath = path.join(toolDir, "narration-source.json");

async function loadExerciseModule() {
  let source = await fs.readFile(exerciseModulePath, "utf8");
  source = source.replace(/^export \{ HARU_DEMO_PERSONA \}[^\n]*\n/m, "");
  const javascript = ts.transpileModule(source, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ES2022,
    },
    fileName: exerciseModulePath,
  }).outputText;
  const dataUrl = `data:text/javascript;base64,${Buffer.from(javascript).toString("base64")}`;
  return import(dataUrl);
}

const exerciseModule = await loadExerciseModule();
const manifest = buildNarrationSource(
  exerciseModule.haru7DayExercises,
  exerciseModule.HARU_WEEK_PLAN,
);
await fs.writeFile(outputPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

console.log(`Wrote ${manifest.entries.length} narration source entries to ${pathToFileURL(outputPath)}`);
