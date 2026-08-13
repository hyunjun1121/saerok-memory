import assert from 'node:assert/strict';
import {
  mkdirSync,
  mkdtempSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { request } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, test } from 'node:test';

import { createComparisonServer, DEFAULT_PORT } from './serve.mjs';

const root = mkdtempSync(join(tmpdir(), 'haru-ko-tts-player-'));
const outsideRoot = mkdtempSync(join(tmpdir(), 'haru-ko-tts-outside-'));

for (const directory of [
  'qwen/audio',
  'qwen/verification',
  'fish/audio',
  'fish/source',
  'fish/models',
  'fish/.work/rejected',
  'kokoro/audio',
]) {
  mkdirSync(join(root, directory), { recursive: true });
}
writeFileSync(join(root, 'index.html'), '<h1>ok</h1>');
writeFileSync(join(root, 'manifest.json'), '{}');
writeFileSync(join(root, 'qwen', 'REPORT.md'), 'qwen report');
writeFileSync(join(root, 'fish', 'REPORT.md'), 'fish report');
writeFileSync(join(root, 'fish', 'LICENSE'), 'license');
writeFileSync(join(root, 'fish', 'NOTICE.txt'), 'notice');
writeFileSync(join(root, 'qwen', 'audio', 'sample.ogg'), Buffer.from('0123456789'));
writeFileSync(join(root, 'fish', 'audio', 'sample.wav'), Buffer.from('abcdefghij'));
writeFileSync(join(root, 'qwen', 'method.json'), '{"private":true}');
writeFileSync(join(root, 'qwen', 'verification', 'sample.json'), '{"private":true}');
writeFileSync(join(root, 'fish', 'source', 'LICENSE'), 'private source');
writeFileSync(join(root, 'fish', 'models', 'config.json'), '{"private":true}');
writeFileSync(join(root, 'fish', '.work', 'rejected', 'candidate.ogg'), 'rejected');
writeFileSync(join(root, 'kokoro', 'audio', 'sample.ogg'), 'forbidden');
writeFileSync(join(root, 'root-sample.ogg'), 'forbidden');
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

function call(path, { headers = {}, method = 'GET' } = {}) {
  return new Promise((resolve, reject) => {
    const client = request({ hostname: '127.0.0.1', port, path, headers, method }, (response) => {
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

test('uses Korean player default port 4191', () => {
  assert.equal(DEFAULT_PORT, 4191);
});

test('serves only player, manifest, reports, Fish notices, and Qwen/Fish audio', async () => {
  for (const path of [
    '/',
    '/manifest.json',
    '/qwen/REPORT.md',
    '/fish/REPORT.md',
    '/fish/LICENSE',
    '/fish/NOTICE.txt',
    '/qwen/audio/sample.ogg',
    '/fish/audio/sample.wav',
  ]) {
    assert.equal((await call(path)).status, 200, path);
  }
});

test('supports HEAD and byte ranges required by audio seeking', async () => {
  const head = await call('/qwen/audio/sample.ogg', { method: 'HEAD' });
  assert.equal(head.status, 200);
  assert.equal(head.body.length, 0);

  const range = await call('/qwen/audio/sample.ogg', { headers: { Range: 'bytes=2-5' } });
  assert.equal(range.status, 206);
  assert.equal(range.headers['content-range'], 'bytes 2-5/10');
  assert.equal(range.body.toString(), '2345');

  const suffix = await call('/qwen/audio/sample.ogg', { headers: { Range: 'bytes=-3' } });
  assert.equal(suffix.status, 206);
  assert.equal(suffix.body.toString(), '789');

  const invalid = await call('/qwen/audio/sample.ogg', { headers: { Range: 'bytes=20-30' } });
  assert.equal(invalid.status, 416);
});

test('rejects non-read methods', async () => {
  const response = await call('/', { method: 'POST' });
  assert.equal(response.status, 405);
  assert.equal(response.headers.allow, 'GET, HEAD');
});

test('returns 400 without crashing on malformed percent encoding', async () => {
  const response = await call('/%');
  assert.equal(response.status, 400);
  assert.equal(server.listening, true);
});

test('blocks encoded traversal and links outside comparison root', async (context) => {
  assert.equal((await call('/%2e%2e/%2e%2e/outside.txt')).status, 404);
  if (!linkedOutside) {
    context.skip('symlink/junction creation unavailable');
    return;
  }
  const linked = await call('/escape/secret.txt');
  assert.equal(linked.status, 404);
  assert.notEqual(linked.body.toString(), 'secret');
});

test('rejects Kokoro and all private generation artifacts', async () => {
  for (const path of [
    '/kokoro/audio/sample.ogg',
    '/qwen/method.json',
    '/qwen/verification/sample.json',
    '/fish/source/LICENSE',
    '/fish/models/config.json',
    '/fish/.work/rejected/candidate.ogg',
    '/root-sample.ogg',
    '/serve.mjs',
  ]) {
    assert.equal((await call(path)).status, 404, path);
  }
});
