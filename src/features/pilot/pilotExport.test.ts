// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { exportPilotSessions } from '@/features/pilot/pilotExport';
import { createPilotSession, putPilotResponse } from '@/features/pilot/pilotStorage';
const mocks = vi.hoisted(() => ({ details: null as unknown, audio: new Map<string, Blob>() }));
vi.mock('@/features/pilot/pilotLocalClient', () => ({
  flushPilotOutbox: async () => {}, pilotLocalRequest: async () => mocks.details,
  readPilotRecording: async (id: string) => mocks.audio.get(id),
}));

function files(bytes: Uint8Array): Map<string, Uint8Array> {
  const result = new Map<string, Uint8Array>();
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let offset = 0;
  while (view.getUint32(offset, true) === 0x04034b50) {
    const size = view.getUint32(offset + 18, true);
    const nameLength = view.getUint16(offset + 26, true);
    const extraLength = view.getUint16(offset + 28, true);
    const start = offset + 30 + nameLength + extraLength;
    const name = new TextDecoder().decode(bytes.slice(offset + 30, offset + 30 + nameLength));
    result.set(name, bytes.slice(start, start + size));
    offset = start + size;
  }
  expect(view.getUint32(offset, true)).toBe(0x02014b50);
  expect(view.getUint32(bytes.length - 22, true)).toBe(0x06054b50);
  return result;
}

describe('pilot evidence ZIP export', () => {
  it('exports every partial recording and retake, plus analyzable metadata CSVs', async () => {
    const session = createPilotSession('1', 'ja', { recordingAndLocalStorage: true, futurePersonalization: true });
    session.storageBackend = 'local-filesystem'; session.attemptNumber = 2;
    session.recordingHistory = ['earlier-partial', 'second-retake'].map((id) => ({
      recordingId: id, questionId: 'JP_PILOT_Q02', part: 'main', recordingStatus: id === 'earlier-partial' ? 'partial' : 'finalized',
      mimeType: 'audio/webm', startedAt: session.createdAt, endedAt: null, durationMs: 1000,
      byteLength: 3, chunkCount: 1, localFile: null, audioUrl: 'local-audio',
    }));
    session.events = [{ eventId: 'event', sessionId: session.sessionId, type: 'view_checkpoint', at: session.createdAt,
      elapsedMs: 5000, questionId: 'JP_PILOT_Q02', part: 'main', detail: { viewId: 'view', dwellMs: 5000, activeMs: 4500 } }];
    mocks.details = session;
    mocks.audio.set('earlier-partial', new Blob(['one'])); mocks.audio.set('second-retake', new Blob(['two']));
    const entries = files(new Uint8Array(await (await exportPilotSessions([session])).arrayBuffer()));
    expect([...entries.keys()].filter((name) => name.endsWith('.webm'))).toHaveLength(2);
    expect([...entries.keys()].some((name) => name.startsWith('participants/1/attempt-2-'))).toBe(true);
    expect(entries.has('attempts.csv')).toBe(true);
    expect(entries.has('questions.csv')).toBe(true);
    expect(entries.has('events.csv')).toBe(true);
    expect(new TextDecoder().decode(entries.get('questions.csv'))).toContain('5000');
    const manifest = JSON.parse(new TextDecoder().decode(entries.get('sessions.json')));
    expect(manifest.sessions[0].recordingHistory[0].recordingStatus).toBe('partial');
    expect(manifest.sessions[0].responses).toEqual([]);
  });

  it('includes playable original bytes, the two question parts, and explicit reuse consent', async () => {
    let session = createPilotSession('JP-TEST', 'ja', { recordingAndLocalStorage: true, futurePersonalization: false });
    const audio = new Uint8Array([0x1a, 0x45, 0xdf, 0xa3, 10, 20, 30]);
    const take = { blob: new Blob([audio], { type: 'audio/webm' }), mimeType: 'audio/webm', durationMs: 1000, startedAt: session.createdAt, endedAt: session.createdAt };
    session = putPilotResponse(session, { questionId: 'JP_PILOT_Q05', status: 'answered', takes: { main: take, followUp: take }, followUpStatus: 'answered', followUpReason: 'short_answer', completedAt: session.createdAt, responseTimeMs: 3000 });
    const entries = files(new Uint8Array(await (await exportPilotSessions([session])).arrayBuffer()));
    expect(entries.size).toBe(3);
    const manifest = JSON.parse(new TextDecoder().decode(entries.get('sessions.json')));
    expect(manifest.sessions[0].personalizationEligible).toBe(false);
    expect(manifest.sessions[0].profileFacts).toEqual([]);
    expect(manifest.sessions[0].responses[0].transcription.status).toBe('not_requested');
    for (const part of ['main', 'followUp']) {
      const path = manifest.sessions[0].responses[0].audio[part].file;
      expect(entries.get(path)).toEqual(audio);
      expect(path).not.toContain('JP-TEST');
    }
    expect(manifest.schemaVersion).toBe(2);
    expect(manifest.sessions[0].administeredQuestions[4].administeredPrompts.ja.followUp).toBe('近所では、どんなことをして遊びましたか？');
    expect(manifest.sessions[0].responses[0].followUpStatus).toBe('answered');
  });

  it('exports older attempts and different weekday layouts with their own administered snapshots', async () => {
    const current = createPilotSession('1', 'ja', { recordingAndLocalStorage: true, futurePersonalization: false });
    const older = { ...current, sessionId: 'older', protocolVersion: 'jp-first-meeting-1.0',
      consent: { recordingAndLocalStorage: true as const, futurePersonalization: true, confirmedAt: current.createdAt },
      protocolSnapshot: [{ ...current.protocolSnapshot![0], id: 'JP_PILOT_Q12', prompt: { ja: '旧版の質問', ko: '이전 질문', en: 'Earlier question' } }] };
    const entries = files(new Uint8Array(await (await exportPilotSessions([older, current])).arrayBuffer()));
    const manifest = JSON.parse(new TextDecoder().decode(entries.get('sessions.json')));
    expect(manifest.protocolVersion).toBe('mixed');
    expect(manifest.questionCatalogScope).toBe('per-session');
    expect(manifest.questions).toEqual([]);
    expect(manifest.sessions[0].administeredQuestions[0].administeredPrompts.ja.main).toBe('旧版の質問');
    expect(manifest.sessions[0].personalizationEligible).toBe(true);
    expect(manifest.sessions[0].memoryTranscriptionEligible).toBe(false);
    expect(manifest.sessions[1].protocolSnapshot[0]).toEqual(current.protocolSnapshot![0]);
    expect(manifest.sessions[1].administeredQuestions).toHaveLength(9);
  });
});
