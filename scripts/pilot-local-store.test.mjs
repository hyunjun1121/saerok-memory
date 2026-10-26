import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createServer, request as httpRequest } from 'node:http';
import { createPilotLocalStore, createPilotMiddleware } from './pilot-local-store.mjs';

const session = (participant = '1') => ({ schemaVersion: 1, protocolVersion: 'jp-first-meeting-1.0', sessionId: randomUUID(),
  participantCode: participant, language: 'ja', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  status: 'in_progress', consent: { recordingAndLocalStorage: true, futurePersonalization: true, confirmedAt: new Date().toISOString() }, responses: [] });

function fixture(t) {
  const directory = mkdtempSync(path.join(tmpdir(), 'haru-pilot-test-'));
  const store = createPilotLocalStore(directory);
  t.after(() => { store.close();
    // This test owns an exact, resolved temp directory, never a user-data path.
    assert.ok(path.resolve(directory).startsWith(path.join(path.resolve(tmpdir()), 'haru-pilot-test-')));
    rmSync(directory, { recursive: true, force: true });
  });
  return store;
}

test('same participant always receives a new numbered attempt without overwriting earlier responses', (t) => {
  const store = fixture(t);
  const first = session('1'); first.responses.push({ questionId: 'JP_PILOT_Q01', selectedOptionId: 'B', status: 'answered' });
  assert.equal(store.saveSession(first).attemptNumber, 1);
  const second = session('001');
  assert.equal(store.saveSession(second).attemptNumber, 2);
  assert.equal(store.saveSession(second).attemptNumber, 2); // Lost-response retry is idempotent.
  assert.equal(store.getSession(first.sessionId).responses[0].selectedOptionId, 'B');
  assert.equal(store.getSession(first.sessionId).status, 'interrupted');
  assert.equal(store.getSession(second.sessionId).participantCode, '1');
  assert.equal(store.saveSession(session('2')).attemptNumber, 1);
  assert.equal(store.listSessions().length, 3);
  assert.throws(() => store.saveSession({ ...second, participantCode: '2' }), /immutable/);
});

test('partial chunks and all retakes survive reopening SQLite', (t) => {
  const directory = mkdtempSync(path.join(tmpdir(), 'haru-pilot-test-'));
  let store = createPilotLocalStore(directory);
  t.after(() => { store.close(); assert.ok(path.resolve(directory).startsWith(path.resolve(tmpdir()) + path.sep)); rmSync(directory, { recursive: true, force: true }); });
  const attempt = session(); store.saveSession(attempt);
  const first = randomUUID();
  const metadata = { sessionId: attempt.sessionId, questionId: 'JP_PILOT_Q02', part: 'main', startedAt: new Date().toISOString() };
  store.beginRecording({ ...metadata, recordingId: first });
  store.addChunk(first, 0, Buffer.from('initial-webm-'));
  store.addChunk(first, 1, Buffer.from('partial-audio'));
  const retry = randomUUID(); store.beginRecording({ ...metadata, recordingId: retry });
  store.close(); store = createPilotLocalStore(directory);
  assert.equal(store.readAudio(first).toString(), 'initial-webm-partial-audio');
  const recordings = store.getSession(attempt.sessionId, true).recordingHistory;
  assert.equal(recordings.length, 2);
  assert.equal(recordings.find(take => take.recordingId === first).recordingStatus, 'partial');
  assert.equal(recordings.find(take => take.recordingId === first).byteLength, 26);
});

test('chunks are idempotent, gaps are detected, and finalized audio stays unchanged', (t) => {
  const store = fixture(t); const attempt = session(); store.saveSession(attempt);
  const recordingId = randomUUID();
  store.beginRecording({ recordingId, sessionId: attempt.sessionId, questionId: 'JP_PILOT_Q02', part: 'followUp', startedAt: new Date().toISOString() });
  store.addChunk(recordingId, 0, Buffer.from('a'));
  assert.equal(store.addChunk(recordingId, 0, Buffer.from('a')).duplicate, true);
  assert.throws(() => store.addChunk(recordingId, 0, Buffer.from('changed')), /immutable/);
  store.addChunk(recordingId, 2, Buffer.from('c'));
  assert.equal(store.readAudio(recordingId).toString(), 'a');
  assert.throws(() => store.finishRecording(recordingId, { chunkCount: 3 }), /incomplete/);
  store.addChunk(recordingId, 1, Buffer.from('b'));
  store.finishRecording(recordingId, { chunkCount: 3, mimeType: 'audio/webm', durationMs: 3000, endedAt: new Date().toISOString() });
  assert.equal(store.readAudio(recordingId).toString(), 'abc');
  assert.equal(store.addChunk(recordingId, 0, Buffer.from('a')).duplicate, true);
  assert.throws(() => store.addChunk(recordingId, 3, Buffer.from('d')), /finalized/);
});

test('exit checkpoints and repeated event delivery preserve the last question and time', (t) => {
  const store = fixture(t); const attempt = session(); store.saveSession(attempt);
  const event = { eventId: randomUUID(), sessionId: attempt.sessionId, type: 'page_exit', questionId: 'JP_PILOT_Q06', part: 'followUp', at: new Date().toISOString(), elapsedMs: 123456,
    detail: { viewId: randomUUID(), dwellMs: 34567, activeMs: 30000, reason: 'page_closed_or_navigated' } };
  store.addEvent(event); store.addEvent(event);
  const saved = store.getSession(attempt.sessionId, true);
  assert.equal(saved.events.length, 1);
  assert.equal(saved.lastPoint.questionId, 'JP_PILOT_Q06');
  assert.equal(saved.exitReason, 'page_closed_or_navigated');
  assert.equal(saved.events[0].detail.dwellMs, 34567);
  assert.equal(saved.status, 'interrupted');
});

test('a copied store reads current and legacy audio from its new root and deletes only the copied attempt', (t) => {
  const owned = mkdtempSync(path.join(tmpdir(), 'haru-pilot-test-'));
  const originalDirectory = path.join(owned, 'original-PC');
  const copiedDirectory = path.join(owned, 'different-PC', 'saved-data');
  let original = createPilotLocalStore(originalDirectory);
  let copied;
  t.after(() => {
    original?.close(); copied?.close();
    assert.ok(path.resolve(owned).startsWith(path.join(path.resolve(tmpdir()), 'haru-pilot-test-')));
    rmSync(owned, { recursive: true, force: true });
  });
  const first = session(); original.saveSession(first);
  const metadata = { sessionId: first.sessionId, questionId: 'JP_PILOT_Q02', part: 'main', startedAt: new Date().toISOString() };
  const current = randomUUID(); const legacy = randomUUID(); const partial = randomUUID();
  for (const recordingId of [current, legacy, partial]) {
    const mimeType = recordingId === current ? 'audio/ogg' : recordingId === legacy ? 'audio/mp4' : 'audio/webm';
    original.beginRecording({ ...metadata, recordingId, mimeType });
    original.addChunk(recordingId, 0, Buffer.from(recordingId));
    if (recordingId !== partial) original.finishRecording(recordingId, {
      chunkCount: 1, durationMs: 1000, endedAt: new Date().toISOString(),
    });
  }
  assert.equal(path.isAbsolute(original.db.prepare('SELECT file FROM recordings WHERE id=?').get(current).file), false);
  const originalFiles = original.getSession(first.sessionId).recordingHistory.filter(take => take.localFile).map(take => take.localFile);
  // Model a database created before portable paths, even across Windows/POSIX.
  original.db.prepare('UPDATE recordings SET file=? WHERE id=?').run('C:\\unavailable-old-PC\\original.webm', legacy);
  original.saveSession(session());
  original.close(); original = null;
  cpSync(originalDirectory, copiedDirectory, { recursive: true });
  copied = createPilotLocalStore(copiedDirectory);
  for (const recordingId of [current, legacy, partial]) assert.equal(copied.readAudio(recordingId).toString(), recordingId);
  for (const take of copied.getSession(first.sessionId).recordingHistory.filter(take => take.localFile)) {
    assert.ok(take.localFile.startsWith(`${copiedDirectory}${path.sep}`));
    assert.equal(readFileSync(take.localFile).toString(), take.recordingId);
  }
  assert.equal(copied.saveSession(session()).attemptNumber, 3);
  copied.deleteSession(first.sessionId);
  assert.equal(copied.listSessions().length, 2);
  assert.ok(originalFiles.every(file => existsSync(file)));
});

test('deleting one selected attempt retains the same participant’s other attempts', (t) => {
  const store = fixture(t); const first = session(); const second = session(); store.saveSession(first); store.saveSession(second);
  store.deleteSession(first.sessionId);
  assert.throws(() => store.getSession(first.sessionId), /not-found/);
  assert.equal(store.getSession(second.sessionId).attemptNumber, 2);
  store.deleteSession(second.sessionId);
  assert.equal(store.saveSession(session()).attemptNumber, 3);
});

test('HTTP collection rejects foreign origins and non-local hostnames', async (t) => {
  const store = fixture(t);
  const middleware = createPilotMiddleware(store);
  const server = createServer((request, response) => middleware(request, response, () => { response.writeHead(404); response.end(); }));
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const origin = `http://127.0.0.1:${server.address().port}`;
  assert.equal((await fetch(`${origin}/api/pilot-local/health`)).status, 200);
  assert.equal((await fetch(`${origin}/api/pilot-local/sessions`, { method: 'POST', headers: { Origin: 'https://unrelated.example', 'Content-Type': 'application/json' }, body: JSON.stringify(session()) })).status, 403);
  assert.equal((await fetch(`${origin}/api/pilot-local/sessions`, { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' }, body: JSON.stringify(session()) })).status, 200);
  const denied = await new Promise((resolve, reject) => {
    const request = httpRequest(`${origin}/api/pilot-local/health`, { headers: { Host: 'unrelated.example' } }, (response) => { response.resume(); resolve(response.statusCode); });
    request.on('error', reject); request.end();
  });
  assert.equal(denied, 403);
});
