import { afterEach, describe, expect, it, vi } from 'vitest';
import { PILOT_QUESTIONS } from '@/features/pilot/pilotProtocol';
import { createPilotSession, isPilotSessionComplete, putPilotResponse, saveBrowserPilotSession, isPilotParticipantNumber, type PilotTake } from '@/features/pilot/pilotStorage';

const consent = { recordingAndLocalStorage: true, futurePersonalization: false };
const take = (): PilotTake => ({ blob: new Blob(['actual-audio'], { type: 'audio/webm' }), mimeType: 'audio/webm', durationMs: 1000, startedAt: new Date().toISOString(), endedAt: new Date().toISOString() });

describe('pilot consent and session boundaries', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('accepts numbered participants and keeps the same person across new attempt UUIDs', () => {
    expect(isPilotParticipantNumber('6')).toBe(true);
    expect(isPilotParticipantNumber('25')).toBe(true);
    expect(isPilotParticipantNumber('0')).toBe(false);
    expect(isPilotParticipantNumber('name')).toBe(false);
    const first = createPilotSession('001', 'ja', consent);
    const second = createPilotSession('1', 'ja', consent);
    expect(first.participantCode).toBe(second.participantCode);
    expect(first.sessionId).not.toBe(second.sessionId);
    expect(second.responses).toEqual([]);
  });

  it('requires explicit recording/storage consent and a code without personal names', () => {
    expect(() => createPilotSession('JP001', 'ja', { ...consent, recordingAndLocalStorage: false })).toThrow('consent');
    expect(() => createPilotSession('佐藤春子', 'ja', consent)).toThrow('participant-code');
    const first = createPilotSession('JP001', 'ja', consent);
    const second = createPilotSession('JP001', 'ja', consent);
    expect(first.sessionId).not.toBe(second.sessionId);
    expect(first.consent.futurePersonalization).toBe(false);
    expect(second.responses).toEqual([]);
  });

  it('requires both nonempty voice takes and never treats a draft as finished', () => {
    let session = createPilotSession('JP002', 'ja', consent);
    for (const question of PILOT_QUESTIONS) {
      session = putPilotResponse(session, { questionId: question.id, status: 'skipped', responseTimeMs: 1, completedAt: new Date().toISOString() });
    }
    expect(isPilotSessionComplete(session)).toBe(true);
    const id = PILOT_QUESTIONS[1].id;
    session = putPilotResponse(session, { questionId: id, status: 'answered', takes: { main: take() }, responseTimeMs: 1, completedAt: new Date().toISOString() });
    expect(isPilotSessionComplete(session)).toBe(false);
    session = putPilotResponse(session, { ...session.responses.at(-1)!, takes: { main: take(), followUp: take() }, status: 'in_progress' });
    expect(isPilotSessionComplete(session)).toBe(false);
    session = putPilotResponse(session, { ...session.responses.at(-1)!, status: 'answered' });
    expect(isPilotSessionComplete(session)).toBe(true);
  });

  it('removes previous partial audio when a participant skips the entire question', () => {
    let session = createPilotSession('JP003', 'ja', consent);
    const questionId = PILOT_QUESTIONS[1].id;
    session = putPilotResponse(session, { questionId, status: 'in_progress', takes: { main: take() }, responseTimeMs: 10, completedAt: new Date().toISOString() });
    session = putPilotResponse(session, { questionId, status: 'not_applicable', responseTimeMs: 11, completedAt: new Date().toISOString() });
    expect(session.responses).toHaveLength(1);
    expect(session.responses[0].takes).toBeUndefined();
    expect(session.responses[0].status).toBe('not_applicable');
  });

  it('fails visibly when persistent storage is unavailable', async () => {
    vi.stubGlobal('indexedDB', undefined);
    await expect(saveBrowserPilotSession(createPilotSession('JP004', 'ja', consent))).rejects.toThrow('indexeddb-unavailable');
  });

  it('does not resolve a save until the IndexedDB transaction actually commits', async () => {
    const transaction: Partial<IDBTransaction> = { objectStore: vi.fn(() => ({ put: vi.fn() }) as unknown as IDBObjectStore) };
    const database: Partial<IDBDatabase> = { transaction: vi.fn(() => transaction as IDBTransaction), close: vi.fn() };
    const request: Partial<IDBOpenDBRequest> = { result: database as IDBDatabase };
    vi.stubGlobal('indexedDB', { open: () => request });
    let finished = false;
    const saving = saveBrowserPilotSession(createPilotSession('JP005', 'ja', consent)).then(() => { finished = true; });
    request.onsuccess?.call(request as IDBOpenDBRequest, new Event('success'));
    await vi.waitFor(() => expect(database.transaction).toHaveBeenCalled());
    expect(finished).toBe(false);
    transaction.oncomplete?.call(transaction as IDBTransaction, new Event('complete'));
    await saving;
    expect(finished).toBe(true);
    expect(database.close).toHaveBeenCalled();
  });
});
