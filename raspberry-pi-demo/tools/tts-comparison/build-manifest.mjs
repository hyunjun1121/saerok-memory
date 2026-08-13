import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  COMPARISON_PROMPT,
  validateComparison,
  validateManifestShape,
} from './validate-comparison.mjs';

const root = dirname(fileURLToPath(import.meta.url));
const methods = ['qwen', 'fish', 'kokoro'].map((directory) => {
  const path = join(root, directory, 'method.json');
  return JSON.parse(readFileSync(path, 'utf8'));
});

const manifest = validateManifestShape({
  schemaVersion: 1,
  prompt: COMPARISON_PROMPT,
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

const path = join(root, 'manifest.json');
writeFileSync(path, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
validateComparison(root);
console.log(`Wrote ${path}`);
