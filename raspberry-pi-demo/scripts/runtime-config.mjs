#!/usr/bin/env node

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { isMainModule, validateRuntimeConfig } from "./runtime-utils.mjs";

export const demoRoot = fileURLToPath(new URL("..", import.meta.url));
export const runtimeConfigPath = path.join(demoRoot, "config", "runtime.json");

export async function loadRuntimeConfig(configPath = runtimeConfigPath) {
  let parsed;
  try {
    parsed = JSON.parse(await readFile(configPath, "utf8"));
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(`Cannot read runtime config ${configPath}: ${detail}`);
  }
  return validateRuntimeConfig(parsed);
}

export function getConfigValue(config, dottedPath) {
  if (!/^[A-Za-z][A-Za-z0-9]*(?:\.[A-Za-z][A-Za-z0-9]*)*$/.test(dottedPath)) {
    throw new Error(`Invalid runtime config field: ${dottedPath}`);
  }
  let value = config;
  for (const segment of dottedPath.split(".")) {
    if (value === null || typeof value !== "object" || !(segment in value)) {
      throw new Error(`Unknown runtime config field: ${dottedPath}`);
    }
    value = value[segment];
  }
  return value;
}

export async function syncRuntimeConfig(outputDirectory, options = {}) {
  const config = await loadRuntimeConfig();
  const narrationEnabled = options.narrationEnabled ?? config.audio.narrationEnabled;
  if (typeof narrationEnabled !== "boolean") {
    throw new Error("Runtime config narrationEnabled override must be boolean.");
  }
  const resolvedOutput = path.resolve(outputDirectory);
  const distRoot = path.resolve(demoRoot, "dist");
  if (!resolvedOutput.startsWith(`${distRoot}${path.sep}`)) {
    throw new Error(`Runtime config output must stay inside ${distRoot}.`);
  }
  const targetDirectory = path.join(resolvedOutput, "config");
  await mkdir(targetDirectory, { recursive: true });
  const target = path.join(targetDirectory, "runtime.json");
  await writeFile(
    target,
    `${JSON.stringify({ ...config, audio: { ...config.audio, narrationEnabled } }, null, 2)}\n`,
    "utf8",
  );
  return target;
}

async function main() {
  const [command = "validate", argument, narrationEnabledArgument] = process.argv.slice(2);
  const config = await loadRuntimeConfig();
  if (command === "validate") {
    process.stdout.write(`${runtimeConfigPath}\n`);
    return;
  }
  if (command === "get") {
    if (!argument) throw new Error("Usage: runtime-config.mjs get <field.path>");
    const value = getConfigValue(config, argument);
    process.stdout.write(`${typeof value === "object" ? JSON.stringify(value) : String(value)}\n`);
    return;
  }
  if (command === "sync") {
    if (!argument) throw new Error("Usage: runtime-config.mjs sync <dist-directory>");
    let narrationEnabled;
    if (narrationEnabledArgument !== undefined) {
      if (narrationEnabledArgument !== "true" && narrationEnabledArgument !== "false") {
        throw new Error("Runtime config narrationEnabled override must be true or false.");
      }
      narrationEnabled = narrationEnabledArgument === "true";
    }
    process.stdout.write(`${await syncRuntimeConfig(argument, { narrationEnabled })}\n`);
    return;
  }
  throw new Error(`Unknown runtime-config command: ${command}`);
}

if (isMainModule(import.meta.url)) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
