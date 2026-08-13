import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { validateComparison } from './validate-comparison.mjs';

const root = dirname(fileURLToPath(import.meta.url));

test('validates generated comparison artifacts', () => {
  const result = validateComparison(root);
  assert.equal(result.audioFiles, 29);
});

test('ships the Fish agreement and required visible attribution', () => {
  const normalizeNewlines = (value) => value.replaceAll('\r\n', '\n');
  const distributedLicense = readFileSync(join(root, 'fish', 'LICENSE'), 'utf8');
  const sourceLicense = readFileSync(join(root, 'fish', 'source', 'LICENSE'), 'utf8');
  const player = readFileSync(join(root, 'index.html'), 'utf8');

  assert.equal(normalizeNewlines(distributedLicense), normalizeNewlines(sourceLicense));
  assert.match(player, />Built with Fish Audio</u);
  assert.match(player, /href="fish\/LICENSE"/u);
  assert.match(player, /href="fish\/NOTICE\.txt"/u);
});
