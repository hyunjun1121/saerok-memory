import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  KOREAN_COMPARISON_PROMPT,
  validateComparison,
  validateManifestShape,
} from './validate-comparison.mjs';

const root = dirname(fileURLToPath(import.meta.url));

export function createManifest(methods) {
  return validateManifestShape({
    schemaVersion: 1,
    prompt: KOREAN_COMPARISON_PROMPT,
    audioNormalization: {
      targetIntegratedLufs: -16,
      truePeakCeilingDbtp: -1,
      toleranceLufs: 2,
    },
    audioEncoding: {
      container: 'ogg',
      codec: 'opus',
      bitrateKbps: 48,
      vbr: true,
      compressionLevel: 10,
      channels: 1,
      sourceSampleRateHz: 24000,
      opusDecodeClockHz: 48000,
    },
    methods,
  });
}

export function buildManifest(rootDirectory = root) {
  const methods = ['qwen', 'fish'].map((directory) => {
    const path = join(rootDirectory, directory, 'method.json');
    return JSON.parse(readFileSync(path, 'utf8'));
  });
  const manifest = createManifest(methods);
  const path = join(rootDirectory, 'manifest.json');
  writeFileSync(path, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  validateComparison(rootDirectory);
  return path;
}

const isCli = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isCli) console.log(`Wrote ${buildManifest()}`);
