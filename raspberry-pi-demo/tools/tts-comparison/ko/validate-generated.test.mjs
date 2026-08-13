import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  KOREAN_COMPARISON_PROMPT,
  validateComparison,
  validatePlayerAttribution,
} from './validate-comparison.mjs';

test('validates all generated Korean comparison artifacts', () => {
  const result = validateComparison(new URL('.', import.meta.url));
  assert.equal(result.audioFiles, 19);
  assert.deepEqual(result.manifest.prompt, KOREAN_COMPARISON_PROMPT);
  assert.deepEqual(result.manifest.methods.map((method) => method.id), ['qwen', 'fish-speech']);
});

test('ships exact Fish notices and visible attribution', () => {
  assert.equal(validatePlayerAttribution(new URL('.', import.meta.url)), true);
});
