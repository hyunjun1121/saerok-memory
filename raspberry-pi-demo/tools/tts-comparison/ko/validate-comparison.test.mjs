import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  KOREAN_COMPARISON_PROMPT,
  validateManifestShape,
} from './validate-comparison.mjs';
import { validShape } from './test-fixtures.mjs';

test('accepts exactly Qwen 9 and Fish 10 for Korean comparison', () => {
  const manifest = validateManifestShape(validShape());
  assert.deepEqual(manifest.methods.map((method) => method.id), ['qwen', 'fish-speech']);
  assert.equal(manifest.methods.flatMap((method) => method.samples).length, 19);
});

test('requires exact Haru Korean D1_Q1 prompt', () => {
  for (const prompt of [
    { ...KOREAN_COMPARISON_PROMPT, text: '다른 문장' },
    { ...KOREAN_COMPARISON_PROMPT, locale: 'ja' },
    { ...KOREAN_COMPARISON_PROMPT, id: 'exercise.other.prompt' },
  ]) {
    const manifest = validShape();
    manifest.prompt = prompt;
    assert.throws(() => validateManifestShape(manifest), /Korean copy exactly/u);
  }
});

test('accepts prompt fields regardless of insertion order', () => {
  const manifest = validShape();
  manifest.prompt = {
    text: KOREAN_COMPARISON_PROMPT.text,
    locale: KOREAN_COMPARISON_PROMPT.locale,
    id: KOREAN_COMPARISON_PROMPT.id,
  };
  assert.equal(validateManifestShape(manifest).methods.length, 2);
});

test('rejects Kokoro and every method set other than Qwen plus Fish', () => {
  const extra = validShape();
  extra.methods.push({ ...extra.methods[0], id: 'kokoro', reportPath: 'kokoro/REPORT.md' });
  assert.throws(() => validateManifestShape(extra), /exactly two TTS methods/u);

  const replacement = validShape();
  replacement.methods[1] = {
    ...replacement.methods[1],
    id: 'kokoro',
    reportPath: 'kokoro/REPORT.md',
  };
  assert.throws(() => validateManifestShape(replacement), /must include only qwen and fish-speech/u);
});

test('rejects incomplete inventories and wrong Qwen preset names', () => {
  const missingQwen = validShape();
  missingQwen.methods[0].samples.pop();
  assert.throws(() => validateManifestShape(missingQwen), /expected 9 samples/u);

  const missingFish = validShape();
  missingFish.methods[1].samples.pop();
  assert.throws(() => validateManifestShape(missingFish), /expected 10 samples/u);

  const wrongVoice = validShape();
  wrongVoice.methods[0].samples[0].voice = 'Unknown';
  assert.throws(() => validateManifestShape(wrongVoice), /official preset voices/u);
});

test('rejects unsafe paths, duplicate ids, duplicate voices, and duplicate paths', () => {
  for (const unsafePath of [
    '../outside.ogg',
    'D:outside.ogg',
    'https://example.com/a.ogg',
    'data:audio/ogg;base64,AA',
    'qwen\\audio\\a.ogg',
  ]) {
    const manifest = validShape();
    manifest.methods[0].samples[0].path = unsafePath;
    assert.throws(() => validateManifestShape(manifest), /safe and relative/u);
  }

  const duplicateId = validShape();
  duplicateId.methods[1].samples[0].id = duplicateId.methods[0].samples[0].id;
  assert.throws(() => validateManifestShape(duplicateId), /duplicate sample id/u);

  const duplicateVoice = validShape();
  duplicateVoice.methods[1].samples[1].voice = duplicateVoice.methods[1].samples[0].voice;
  assert.throws(() => validateManifestShape(duplicateVoice), /duplicate voice/u);

  const duplicatePath = validShape();
  duplicatePath.methods[1].samples[1].path = duplicatePath.methods[1].samples[0].path;
  assert.throws(() => validateManifestShape(duplicatePath), /duplicate path/u);
});

test('rejects wrong production encoding and implausible duration', () => {
  const encoding = validShape();
  encoding.audioEncoding.opusDecodeClockHz = 24000;
  assert.throws(() => validateManifestShape(encoding), /production settings/u);

  const duration = validShape();
  duration.methods[1].samples[0].durationMs = 11000;
  assert.throws(() => validateManifestShape(duration), /within 1.2-10 seconds/u);
});

test('requires exact model license labels and report paths', () => {
  const qwenLicense = validShape();
  qwenLicense.methods[0].model.license = 'unknown';
  assert.throws(() => validateManifestShape(qwenLicense), /license mismatch/u);

  const fishLicense = validShape();
  fishLicense.methods[1].model.license = 'Apache-2.0';
  assert.throws(() => validateManifestShape(fishLicense), /license mismatch/u);

  const report = validShape();
  report.methods[1].reportPath = 'qwen/REPORT.md';
  assert.throws(() => validateManifestShape(report), /method directory/u);
});
