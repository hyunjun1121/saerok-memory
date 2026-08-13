#!/usr/bin/env node

import { access, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

import { getMarketBuildSpec } from "./runtime-utils.mjs";
import { loadRuntimeConfig, syncRuntimeConfig } from "./runtime-config.mjs";

const demoRoot = fileURLToPath(new URL("..", import.meta.url));

function runNode(scriptPath, argumentsList, environment) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [scriptPath, ...argumentsList], {
      cwd: demoRoot,
      env: environment,
      stdio: "inherit",
      windowsHide: true,
    });
    child.once("error", reject);
    child.once("exit", (code, signal) => {
      if (code === 0) {
        resolve();
      } else {
        reject(
          new Error(
            signal
              ? `${path.basename(scriptPath)} stopped by ${signal}.`
              : `${path.basename(scriptPath)} exited with code ${code}.`,
          ),
        );
      }
    });
  });
}

async function main() {
  const spec = getMarketBuildSpec(process.argv[2]);
  await loadRuntimeConfig();

  const viteCli = path.join(demoRoot, "node_modules", "vite", "bin", "vite.js");
  try {
    await access(viteCli);
  } catch {
    throw new Error(`Vite is not installed. Run "npm ci" in ${demoRoot}.`);
  }

  const environment = { ...process.env };
  for (const name of Object.keys(environment)) {
    if (/^VITE_(?:API|RAG|STT|TELEMETRY|SUPABASE)_/i.test(name)) {
      delete environment[name];
    }
  }
  environment.VITE_HARU_MARKET = spec.market;
  environment.VITE_HARU_OFFLINE = "1";
  environment.VITE_ALLOW_LANGUAGE_SWITCH = "0";
  environment.HARU_OUT_DIR = spec.outDirectory;

  process.stdout.write(
    `Building Haru ${spec.market} market into ${spec.outDirectory} (offline mode).\n`,
  );
  await runNode(viteCli, ["build"], environment);

  const absoluteOutput = path.join(demoRoot, spec.outDirectory);
  await syncRuntimeConfig(absoluteOutput);
  await mkdir(path.join(absoluteOutput, "config"), { recursive: true });
  await writeFile(
    path.join(absoluteOutput, "config", "build-info.json"),
    `${JSON.stringify(
      {
        schemaVersion: 1,
        market: spec.market,
        locale: spec.localeDirectory,
        offline: true,
      },
      null,
      2,
    )}\n`,
    "utf8",
  );

  await runNode(
    path.join(demoRoot, "scripts", "check-offline-build.mjs"),
    [spec.outDirectory],
    environment,
  );
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
