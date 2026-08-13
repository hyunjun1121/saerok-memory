import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { request } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, test } from 'node:test';

import { createComparisonServer } from './serve.mjs';

const root = mkdtempSync(join(tmpdir(), 'haru-tts-player-'));
const outsideRoot = mkdtempSync(join(tmpdir(), 'haru-tts-outside-'));
writeFileSync(join(root, 'index.html'), '<h1>ok</h1>');
writeFileSync(join(root, 'sample.ogg'), Buffer.from('0123456789'));
mkdirSync(join(root, 'fish', 'source'), { recursive: true });
mkdirSync(join(root, 'fish', 'models'), { recursive: true });
mkdirSync(join(root, 'fish', '.work', 'rejected'), { recursive: true });
writeFileSync(join(root, 'fish', 'source', 'LICENSE'), 'private source');
writeFileSync(join(root, 'fish', 'models', 'config.json'), '{"private":true}');
writeFileSync(join(root, 'fish', '.work', 'rejected', 'candidate.ogg'), 'rejected');
writeFileSync(join(outsideRoot, 'secret.txt'), 'secret');
let linkedOutside = true;
try {
  symlinkSync(outsideRoot, join(root, 'escape'), 'junction');
} catch {
  linkedOutside = false;
}

const server = createComparisonServer(root);
let port;

before(async () => {
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      port = server.address().port;
      resolve();
    });
  });
});

after(async () => {
  await new Promise((resolve) => server.close(resolve));
  rmSync(root, { recursive: true, force: true });
  rmSync(outsideRoot, { recursive: true, force: true });
});

function get(path, headers = {}) {
  return new Promise((resolve, reject) => {
    const client = request({ hostname: '127.0.0.1', port, path, headers }, (response) => {
      const chunks = [];
      response.on('data', (chunk) => chunks.push(chunk));
      response.on('end', () => resolve({
        status: response.statusCode,
        headers: response.headers,
        body: Buffer.concat(chunks),
      }));
    });
    client.on('error', reject);
    client.end();
  });
}

test('returns 400 without crashing on malformed percent encoding', async () => {
  const response = await get('/%');
  assert.equal(response.status, 400);
  assert.equal(server.listening, true);
});

test('blocks encoded traversal outside comparison root', async () => {
  const response = await get('/%2e%2e/%2e%2e/outside.txt');
  assert.equal(response.status, 404);
});

test('blocks junction or symlink targets outside comparison root', async (context) => {
  if (!linkedOutside) {
    context.skip('symlink/junction creation unavailable');
    return;
  }
  const response = await get('/escape/secret.txt');
  assert.equal(response.status, 404);
  assert.notEqual(response.body.toString(), 'secret');
});

test('serves byte ranges required by audio seeking', async () => {
  const response = await get('/sample.ogg', { Range: 'bytes=2-5' });
  assert.equal(response.status, 206);
  assert.equal(response.headers['content-range'], 'bytes 2-5/10');
  assert.equal(response.body.toString(), '2345');
});

test('does not expose model, source, or work artifacts', async () => {
  for (const path of [
    '/fish/source/LICENSE',
    '/fish/models/config.json',
    '/fish/.work/rejected/candidate.ogg',
  ]) {
    const response = await get(path);
    assert.equal(response.status, 404, path);
  }
});
