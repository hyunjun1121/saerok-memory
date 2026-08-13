import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  COMPARISON_PROMPT,
  validateManifestShape,
} from './validate-comparison.mjs';

function samples(count, prefix) {
  return Array.from({ length: count }, (_, index) => ({
    id: `${prefix}-${index + 1}`,
    voice: `${prefix}-voice-${index + 1}`,
    label: `${prefix} ${index + 1}`,
    path: `${prefix}/audio/${index + 1}.ogg`,
    sha256: 'a'.repeat(64),
    durationMs: 2000,
    codec: 'opus',
    container: 'ogg',
    channels: 1,
    sourceSampleRateHz: 24000,
    sampleRateHz: 48000,
  }));
}

function validShape() {
  return {
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
    methods: [
      {
        id: 'qwen',
        name: 'Qwen3-TTS',
        model: { id: 'qwen', revision: 'rev', license: 'Apache-2.0', sourceUrl: 'https://example.com/qwen' },
        voiceInventory: { kind: 'finite', total: 9, selectionRationale: 'All nine official preset speakers are included.' },
        reportPath: 'qwen/REPORT.md',
        samples: samples(9, 'qwen'),
      },
      {
        id: 'fish-speech',
        name: 'Fish Speech',
        model: { id: 'fish', revision: 'rev', license: 'Research', sourceUrl: 'https://example.com/fish' },
        voiceInventory: { kind: 'open-ended', selectionRationale: 'Ten reproducible random timbres represent an unbounded inventory.' },
        reportPath: 'fish/REPORT.md',
        samples: samples(10, 'fish'),
      },
      {
        id: 'kokoro',
        name: 'Kokoro-82M',
        model: { id: 'kokoro', revision: 'rev', license: 'Apache-2.0', sourceUrl: 'https://example.com/kokoro' },
        voiceInventory: { kind: 'finite', total: 54, selectionRationale: 'Ten candidates selected from fifty-four official voices.' },
        reportPath: 'kokoro/REPORT.md',
        samples: samples(10, 'kokoro'),
      },
    ],
  };
}

test('accepts required model inventory and sample policy', () => {
  assert.equal(validateManifestShape(validShape()).methods.length, 3);
});

test('rejects wrong Haru prompt', () => {
  const manifest = validShape();
  manifest.prompt = { ...COMPARISON_PROMPT, text: 'different' };
  assert.throws(() => validateManifestShape(manifest), /must match Haru D1_Q1/u);
});

test('rejects incomplete finite voice inventory', () => {
  const manifest = validShape();
  manifest.methods[0].samples.pop();
  assert.throws(() => validateManifestShape(manifest), /expected 9 samples/u);
});

test('rejects implausibly long single-question audio', () => {
  const manifest = validShape();
  manifest.methods[2].samples[0].durationMs = 15000;
  assert.throws(() => validateManifestShape(manifest), /within 1.2-10 seconds/u);
});

test('accepts prompt fields regardless of object insertion order', () => {
  const manifest = validShape();
  manifest.prompt = {
    text: COMPARISON_PROMPT.text,
    locale: COMPARISON_PROMPT.locale,
    id: COMPARISON_PROMPT.id,
  };
  assert.equal(validateManifestShape(manifest).methods.length, 3);
});

test('rejects drive-relative, URI, and backslash sample paths', () => {
  for (const unsafePath of ['D:outside.ogg', 'https://example.com/a.ogg', 'data:audio/ogg;base64,AA', 'qwen\\audio\\a.ogg']) {
    const manifest = validShape();
    manifest.methods[0].samples[0].path = unsafePath;
    assert.throws(() => validateManifestShape(manifest), /safe and relative/u);
  }
});

test('rejects duplicate sample ids', () => {
  const manifest = validShape();
  manifest.methods[0].samples[1].id = manifest.methods[0].samples[0].id;
  assert.throws(() => validateManifestShape(manifest), /duplicate sample id/u);
});
