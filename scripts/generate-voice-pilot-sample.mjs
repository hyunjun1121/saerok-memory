import { mkdir, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outputRoot = resolve(repoRoot, "docs", "voice-pilot-sample-20x7");
let vite;

try {
  vite = await createServer({
    configFile: false,
    root: repoRoot,
    appType: "custom",
    logLevel: "error",
    resolve: { alias: { "@": resolve(repoRoot, "src") } },
    optimizeDeps: { noDiscovery: true, include: [], entries: [] },
    server: { middlewareMode: true, hmr: false },
  });
  const generator = await vite.ssrLoadModule(
    "/src/features/analytics/syntheticVoicePilot.ts",
  );
  const bundle = generator.generateSyntheticVoicePilot(
    generator.SYNTHETIC_VOICE_PILOT_SEED,
  );
  const files = generator.serializeSyntheticVoicePilotFiles(bundle);
  await vite.close();
  vite = undefined;

  for (const [relativePath, contents] of Object.entries(files)) {
    const target = resolve(outputRoot, relativePath);
    const relativeTarget = relative(outputRoot, target);
    if (relativeTarget.startsWith("..") || isAbsolute(relativeTarget)) {
      throw new Error(`Generated path escaped output root: ${relativePath}`);
    }
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, contents, "utf8");
  }

  process.stdout.write(
    `Voice pilot sample generated: ${bundle.operationalExport.participants.length} participants, ` +
      `${bundle.operationalExport.routineSessions.length} participant-days, ` +
      `${bundle.sttReviewRows.length} voice steps, ${Object.keys(files).length} files.\n`,
  );
  process.stdout.write(`${outputRoot}\n`);
} catch (error) {
  console.error(error instanceof Error ? error.stack : error);
  process.exitCode = 1;
} finally {
  await vite?.close();
}
