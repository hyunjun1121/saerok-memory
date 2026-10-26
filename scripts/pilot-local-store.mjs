import { DatabaseSync } from 'node:sqlite';
import { createHash } from 'node:crypto';
import { mkdirSync, existsSync, readFileSync, writeFileSync, renameSync, unlinkSync, openSync, writeSync, fsyncSync, closeSync } from 'node:fs';
import path from 'node:path';

const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
// Q10–Q12 remain readable for version 1 attempts and queued legacy deliveries.
const QUESTION = /^JP_PILOT_Q(0[1-9]|1[0-2])$/;
const PARTS = ['main', 'followUp'];
const json = (value) => JSON.stringify(value);
const fail = (message, status = 400) => { throw Object.assign(new Error(message), { status }); };
const validId = (value) => { if (!UUID.test(value ?? '')) fail('invalid-id'); return value; };
const audioExtension = (mimeType) => mimeType?.includes('mp4') ? 'm4a' : mimeType?.includes('ogg') ? 'ogg' : 'webm';

function durableWrite(filename, bytes) {
  mkdirSync(path.dirname(filename), { recursive: true });
  const temporary = `${filename}.tmp`;
  const fd = openSync(temporary, 'w');
  try {
    let offset = 0;
    while (offset < bytes.length) offset += writeSync(fd, bytes, offset, bytes.length - offset);
    fsyncSync(fd);
  } finally { closeSync(fd); }
  renameSync(temporary, filename);
}

export function createPilotLocalStore(directory) {
  const root = path.resolve(directory);
  mkdirSync(root, { recursive: true });
  const db = new DatabaseSync(path.join(root, 'pilot.sqlite'), { timeout: 5000 });
  db.exec(`PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA foreign_keys=ON;
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY, participant TEXT NOT NULL, attempt INTEGER NOT NULL,
      created_at TEXT NOT NULL, updated_at TEXT NOT NULL, status TEXT NOT NULL,
      snapshot TEXT NOT NULL, last_seen TEXT NOT NULL, exit_reason TEXT,
      UNIQUE(participant, attempt));
    CREATE TABLE IF NOT EXISTS events (
      id TEXT PRIMARY KEY, session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
      type TEXT NOT NULL, question_id TEXT, part TEXT, client_at TEXT NOT NULL,
      elapsed_ms REAL NOT NULL, received_at TEXT NOT NULL, detail TEXT NOT NULL);
    CREATE INDEX IF NOT EXISTS events_session ON events(session_id, received_at);
    CREATE INDEX IF NOT EXISTS sessions_participant ON sessions(participant, attempt);
    CREATE TABLE IF NOT EXISTS participant_counters (participant TEXT PRIMARY KEY, last_attempt INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS recordings (
      id TEXT PRIMARY KEY, session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
      question_id TEXT NOT NULL, part TEXT NOT NULL, status TEXT NOT NULL,
      mime_type TEXT NOT NULL, started_at TEXT NOT NULL, ended_at TEXT,
      duration_ms REAL NOT NULL DEFAULT 0, expected_chunks INTEGER, file TEXT,
      sample_rate REAL, channels INTEGER);
    CREATE TABLE IF NOT EXISTS chunks (
      recording_id TEXT NOT NULL REFERENCES recordings(id) ON DELETE CASCADE,
      sequence INTEGER NOT NULL, bytes INTEGER NOT NULL, sha256 TEXT NOT NULL,
      PRIMARY KEY(recording_id, sequence));`);

  const getRow = (id) => db.prepare('SELECT * FROM sessions WHERE id=?').get(validId(id));
  const recording = (id) => {
    const row = db.prepare('SELECT * FROM recordings WHERE id=?').get(validId(id));
    if (!row) fail('recording-not-found', 404);
    return row;
  };
  const folder = (row) => path.join(root, 'participants', row.participant, `attempt-${String(row.attempt).padStart(3, '0')}-${row.id}`);
  const chunkFile = (row, sequence) => path.join(folder(getRow(row.session_id)), 'chunks', row.id, `${String(sequence).padStart(6, '0')}.bin`);
  // Derive from validated recording metadata and the current data root. Older
  // databases stored an absolute filename from a different computer; never use
  // that path to read/delete files outside this copied store.
  const audioFile = (row) => path.join(folder(getRow(row.session_id)), 'audio', `${row.question_id}-${row.part}-${row.id}.${audioExtension(row.mime_type)}`);
  const manifest = (row) => ({ ...JSON.parse(row.snapshot), attemptNumber: row.attempt,
    status: row.status, updatedAt: row.updated_at, localDataDirectory: folder(row),
    lastSeenAt: row.last_seen, exitReason: row.exit_reason,
    storageBackend: 'local-filesystem',
    lastPoint: (() => {
      const last = db.prepare('SELECT question_id,part,client_at,type FROM events WHERE session_id=? AND question_id IS NOT NULL ORDER BY elapsed_ms DESC,received_at DESC LIMIT 1').get(row.id);
      const saved = JSON.parse(row.snapshot).lastPoint;
      if (saved && QUESTION.test(saved.questionId) && (!last || Date.parse(saved.at) > Date.parse(last.client_at))) return saved;
      return last ? { questionId: last.question_id, part: last.part, at: last.client_at, type: last.type } : null;
    })(),
    lastContactState: Date.now() - Date.parse(row.last_seen) > 20000 ? 'stale_unconfirmed' : 'recent',
  });
  const writeSnapshot = (row) => durableWrite(path.join(folder(row), 'session.json'), Buffer.from(json(manifest(row))));

  function saveSession(session) {
    validId(session.sessionId);
    if (!/^[A-Za-z0-9][A-Za-z0-9_-]{0,31}$/.test(session.participantCode ?? '')) fail('invalid-participant');
    if (session.consent?.recordingAndLocalStorage !== true || !Array.isArray(session.responses)) fail('consent-required');
    if (!['in_progress', 'completed', 'stopped', 'interrupted'].includes(session.status)) fail('invalid-status');
    const now = new Date().toISOString();
    const participant = /^\d+$/.test(session.participantCode) ? String(Number(session.participantCode)) : session.participantCode;
    if (/^\d+$/.test(participant) && (Number(participant) < 1 || Number(participant) > 99999)) fail('invalid-participant');
    db.exec('BEGIN IMMEDIATE');
    try {
      const existing = getRow(session.sessionId);
      if (existing && existing.participant !== participant) fail('participant-is-immutable', 409);
      if (existing) {
        const prior = JSON.parse(existing.snapshot);
        if (prior.protocolVersion !== session.protocolVersion
          || json(prior.protocolSnapshot) !== json(session.protocolSnapshot)) fail('protocol-is-immutable', 409);
      }
      const priorMaximum = Number(db.prepare('SELECT COALESCE(MAX(attempt),0) AS maximum FROM sessions WHERE participant=?').get(participant).maximum);
      const highWater = Number(db.prepare('SELECT last_attempt FROM participant_counters WHERE participant=?').get(participant)?.last_attempt ?? 0);
      const attempt = existing?.attempt ?? Math.max(priorMaximum, highWater) + 1;
      const snapshot = { ...session, participantCode: participant, attemptNumber: attempt };
      if (!existing) {
        db.prepare('INSERT INTO participant_counters VALUES(?,?) ON CONFLICT(participant) DO UPDATE SET last_attempt=excluded.last_attempt').run(participant, attempt);
        // Preserve all earlier attempts and their raw data. Only their summary
        // status changes when the same participant explicitly starts again.
        db.prepare("UPDATE sessions SET status='interrupted', exit_reason='new_attempt_started' WHERE participant=? AND status='in_progress'").run(participant);
        db.prepare('INSERT INTO sessions(id,participant,attempt,created_at,updated_at,status,snapshot,last_seen) VALUES(?,?,?,?,?,?,?,?)')
          .run(session.sessionId, participant, attempt, session.createdAt, now, session.status, json(snapshot), now);
      } else {
        db.prepare("UPDATE sessions SET updated_at=?,status=?,snapshot=?,exit_reason=CASE WHEN ?='completed' THEN 'completed' WHEN ?='stopped' THEN 'operator_stop' ELSE exit_reason END WHERE id=?")
          .run(now, session.status, json(snapshot), session.status, session.status, session.sessionId);
      }
      db.exec('COMMIT');
    } catch (error) { db.exec('ROLLBACK'); throw error; }
    const row = getRow(session.sessionId);
    writeSnapshot(row);
    return manifest(row);
  }

  function addEvent(event) {
    validId(event.eventId);
    const row = getRow(event.sessionId);
    if (!row) fail('session-not-found', 404);
    if (!/^[a-z_]{1,48}$/.test(event.type ?? '') || !Number.isFinite(event.elapsedMs) || typeof event.at !== 'string') fail('invalid-event');
    if (event.questionId && !QUESTION.test(event.questionId)) fail('invalid-question');
    if (event.part && !PARTS.includes(event.part)) fail('invalid-part');
    const now = new Date().toISOString();
    db.prepare('INSERT OR IGNORE INTO events VALUES(?,?,?,?,?,?,?,?,?)').run(event.eventId, event.sessionId, event.type,
      event.questionId ?? null, event.part ?? null, event.at, event.elapsedMs, now, json(event.detail ?? {}));
    if (event.type === 'recording_start' && UUID.test(event.detail?.recordingId ?? '') && typeof event.detail.actualStartedAt === 'string') {
      db.prepare('UPDATE recordings SET started_at=? WHERE id=? AND session_id=? AND status=\'partial\'')
        .run(event.detail.actualStartedAt, event.detail.recordingId, event.sessionId);
    }
    // A delayed retry must not move the last-observed timestamp backwards.
    db.prepare('UPDATE sessions SET last_seen=MAX(last_seen,?), exit_reason=CASE WHEN ? IN (\'page_exit\',\'session_end\') THEN ? ELSE exit_reason END WHERE id=?')
      .run(event.at, event.type, event.detail?.reason ?? event.type, event.sessionId);
    if (event.type === 'page_exit' || event.type === 'session_end') {
      db.prepare("UPDATE sessions SET status='interrupted' WHERE id=? AND status='in_progress'").run(event.sessionId);
      writeSnapshot(getRow(event.sessionId));
    }
    return { saved: true };
  }

  function beginRecording(input) {
    validId(input.recordingId);
    const row = getRow(input.sessionId);
    if (!row || JSON.parse(row.snapshot).consent.recordingAndLocalStorage !== true) fail('session-not-found', 404);
    if (!QUESTION.test(input.questionId) || !PARTS.includes(input.part) || typeof input.startedAt !== 'string') fail('invalid-recording');
    const prior = db.prepare('SELECT * FROM recordings WHERE id=?').get(input.recordingId);
    if (prior && (prior.session_id !== input.sessionId || prior.question_id !== input.questionId || prior.part !== input.part)) fail('recording-is-immutable', 409);
    db.prepare('INSERT OR IGNORE INTO recordings(id,session_id,question_id,part,status,mime_type,started_at) VALUES(?,?,?,?,?,?,?)')
      .run(input.recordingId, input.sessionId, input.questionId, input.part, 'partial', input.mimeType ?? 'audio/webm', input.startedAt);
    return { recordingId: input.recordingId };
  }

  function addChunk(id, sequence, bytes) {
    const row = recording(id);
    if (!Number.isSafeInteger(sequence) || sequence < 0 || sequence > 10000 || bytes.length < 1) fail('invalid-chunk');
    const sha256 = createHash('sha256').update(bytes).digest('hex');
    const prior = db.prepare('SELECT * FROM chunks WHERE recording_id=? AND sequence=?').get(id, sequence);
    if (prior) {
      if (prior.sha256 !== sha256) fail('chunk-is-immutable', 409);
      return { saved: true, duplicate: true };
    }
    if (row.status === 'finalized') fail('recording-is-finalized', 409);
    durableWrite(chunkFile(row, sequence), bytes);
    db.prepare('INSERT INTO chunks VALUES(?,?,?,?)').run(id, sequence, bytes.length, sha256);
    return { saved: true, bytes: bytes.length };
  }

  function readAudio(id) {
    const row = recording(id);
    if (row.file) {
      const filename = audioFile(row);
      if (!existsSync(filename)) fail('recording-file-not-found', 404);
      return readFileSync(filename);
    }
    const chunks = db.prepare('SELECT * FROM chunks WHERE recording_id=? ORDER BY sequence').all(id);
    const prefix = [];
    for (let index = 0; index < chunks.length; index++) {
      if (chunks[index].sequence !== index) break;
      prefix.push(readFileSync(chunkFile(row, index)));
    }
    return Buffer.concat(prefix);
  }

  function finishRecording(id, input) {
    const row = recording(id);
    if (row.status === 'finalized') return { saved: true };
    const chunks = db.prepare('SELECT sequence FROM chunks WHERE recording_id=? ORDER BY sequence').all(id);
    if (!Number.isSafeInteger(input.chunkCount) || input.chunkCount < 1 || chunks.length !== input.chunkCount
      || chunks.some((chunk, index) => chunk.sequence !== index)) fail('recording-chunks-incomplete', 409);
    const mimeType = input.mimeType ?? row.mime_type;
    const filename = audioFile({ ...row, mime_type: mimeType });
    durableWrite(filename, readAudio(id));
    db.prepare("UPDATE recordings SET status='finalized',file=?,mime_type=?,ended_at=?,duration_ms=?,expected_chunks=?,sample_rate=?,channels=?,started_at=? WHERE id=?")
      .run(path.relative(root, filename), mimeType, input.endedAt, input.durationMs ?? 0, input.chunkCount,
        input.sampleRateHz ?? null, input.channelCount ?? null, input.startedAt ?? row.started_at, id);
    for (const chunk of chunks) { try { unlinkSync(chunkFile(row, chunk.sequence)); } catch { /* Final file is durable; leftovers can be retained. */ } }
    return { saved: true, file: filename };
  }

  function getSession(id, diagnostics = false) {
    const row = getRow(id);
    if (!row) fail('session-not-found', 404);
    const result = manifest(row);
    result.recordingHistory = db.prepare('SELECT r.*, COALESCE(SUM(c.bytes),0) AS bytes,COUNT(c.sequence) AS chunk_count FROM recordings r LEFT JOIN chunks c ON r.id=c.recording_id WHERE r.session_id=? GROUP BY r.id ORDER BY r.started_at,r.id').all(id).map((take) => ({
      recordingId: take.id, questionId: take.question_id, part: take.part, recordingStatus: take.status,
      mimeType: take.mime_type, startedAt: take.started_at, endedAt: take.ended_at ?? null,
      durationMs: take.status === 'finalized' ? take.duration_ms : null, sampleRateHz: take.sample_rate, channelCount: take.channels,
      byteLength: take.bytes, chunkCount: take.chunk_count,
      localFile: take.file ? audioFile(take) : null, audioUrl: `/api/pilot-local/recordings/${take.id}/audio`,
    }));
    if (diagnostics) result.events = db.prepare('SELECT * FROM events WHERE session_id=? ORDER BY elapsed_ms,received_at,id').all(id).map((event) => ({
      eventId: event.id, sessionId: id, type: event.type, questionId: event.question_id,
      part: event.part, at: event.client_at, elapsedMs: event.elapsed_ms,
      receivedAt: event.received_at, detail: JSON.parse(event.detail),
    }));
    return result;
  }

  function deleteSession(id) {
    const row = getRow(id);
    if (!row) return { deleted: true };
    // Remove only files belonging to the explicitly selected attempt, using
    // individual checked paths. Keep the participant's other attempts intact.
    for (const take of db.prepare('SELECT * FROM recordings WHERE session_id=?').all(id)) {
      const files = [take.file ? audioFile(take) : null, ...db.prepare('SELECT sequence FROM chunks WHERE recording_id=?').all(take.id).map((chunk) => chunkFile(take, chunk.sequence))];
      for (const file of files.filter(Boolean)) {
        if (!path.resolve(file).startsWith(`${folder(row)}${path.sep}`)) fail('unsafe-delete', 500);
        if (existsSync(file)) unlinkSync(file);
      }
    }
    const snapshot = path.join(folder(row), 'session.json');
    if (existsSync(snapshot)) unlinkSync(snapshot);
    db.prepare('DELETE FROM sessions WHERE id=?').run(id);
    return { deleted: true };
  }

  return { root, db, saveSession, addEvent, beginRecording, addChunk, finishRecording, readAudio,
    getSession, deleteSession,
    listSessions: () => db.prepare('SELECT id FROM sessions ORDER BY created_at DESC').all().map((row) => getSession(row.id)),
    close: () => db.close(),
  };
}

async function body(request, limit) {
  const chunks = [];
  let length = 0;
  for await (const chunk of request) {
    length += chunk.length;
    if (length > limit) fail('request-too-large', 413);
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

export function createPilotMiddleware(store) {
  return async (request, response, next) => {
    const url = new URL(request.url, 'http://127.0.0.1');
    if (!url.pathname.startsWith('/api/pilot-local/')) { next(); return; }
    const reply = (status, payload) => { response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }); response.end(json(payload)); };
    try {
      const host = request.headers.host ?? '';
      if (!/^(127\.0\.0\.1|localhost)(:\d+)?$/.test(host)) fail('localhost-only', 403);
      const origin = request.headers.origin;
      if ((origin && origin !== `http://${host}`) || request.headers['sec-fetch-site'] === 'cross-site') fail('same-origin-only', 403);
      if (request.method !== 'GET' && !origin) fail('origin-required', 403);
      const suffix = url.pathname.slice('/api/pilot-local/'.length);
      const input = async () => JSON.parse((await body(request, 1024 * 1024)).toString('utf8'));
      let value;
      if (request.method === 'GET' && suffix === 'health') value = { ready: true, dataDirectory: store.root, schemaVersion: 2 };
      else if (request.method === 'GET' && suffix === 'sessions') value = store.listSessions();
      else if (request.method === 'POST' && suffix === 'sessions') value = store.saveSession(await input());
      else if (request.method === 'POST' && suffix === 'events') value = store.addEvent(await input());
      else if (request.method === 'POST' && suffix === 'recordings') value = store.beginRecording(await input());
      else {
        const session = /^sessions\/([^/]+)$/.exec(suffix);
        const chunk = /^recordings\/([^/]+)\/chunks\/(\d+)$/.exec(suffix);
        const finish = /^recordings\/([^/]+)\/finish$/.exec(suffix);
        const audio = /^recordings\/([^/]+)\/audio$/.exec(suffix);
        if (session && request.method === 'GET') value = store.getSession(session[1], true);
        else if (session && request.method === 'DELETE') value = store.deleteSession(session[1]);
        else if (chunk && request.method === 'PUT') value = store.addChunk(chunk[1], Number(chunk[2]), await body(request, 2 * 1024 * 1024));
        else if (finish && request.method === 'POST') value = store.finishRecording(finish[1], await input());
        else if (audio && request.method === 'GET') {
          const bytes = store.readAudio(audio[1]);
          response.writeHead(200, { 'Content-Type': 'application/octet-stream', 'Cache-Control': 'no-store', 'Content-Length': bytes.length });
          response.end(bytes); return;
        } else fail('not-found', 404);
      }
      reply(200, value);
    } catch (error) { reply(error.status ?? 500, { error: error.status ? error.message : 'local-store-failed' }); }
  };
}
