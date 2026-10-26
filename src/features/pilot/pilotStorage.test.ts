import { afterEach, describe, expect, it, vi } from 'vitest';
import { PILOT_QUESTIONS } from '@/features/pilot/pilotProtocol';
import { createPilotSession, isPilotSessionComplete, listBrowserPilotSessions, putPilotResponse, saveBrowserPilotSession, isPilotParticipantNumber, type PilotTake } from '@/features/pilot/pilotStorage';

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

  it('requires a main take and an explicit optional-follow-up decision before completion', () => {
    let session = createPilotSession('JP002', 'ja', consent);
    for (const question of PILOT_QUESTIONS) {
      session = putPilotResponse(session, { questionId: question.id, status: 'skipped', responseTimeMs: 1, completedAt: new Date().toISOString() });
    }
    expect(isPilotSessionComplete(session)).toBe(true);
    const id = PILOT_QUESTIONS[4].id;
    session = putPilotResponse(session, { questionId: id, status: 'answered', takes: { main: take() }, responseTimeMs: 1, completedAt: new Date().toISOString() });
    expect(isPilotSessionComplete(session)).toBe(false);
    session = putPilotResponse(session, { ...session.responses.at(-1)!, followUpStatus: 'not_needed' });
    expect(isPilotSessionComplete(session)).toBe(true);
    session = putPilotResponse(session, { ...session.responses.at(-1)!, followUpStatus: 'requested' });
    expect(isPilotSessionComplete(session)).toBe(false);
    session = putPilotResponse(session, { ...session.responses.at(-1)!, takes: { main: take(), followUp: take() }, status: 'in_progress' });
    expect(isPilotSessionComplete(session)).toBe(false);
    session = putPilotResponse(session, { ...session.responses.at(-1)!, status: 'answered', followUpStatus: 'answered' });
    expect(isPilotSessionComplete(session)).toBe(true);
  });

  it('can preserve main evidence when the optional follow-up is declined', () => {
    let session = createPilotSession('JP003', 'ja', consent);
    const questionId = PILOT_QUESTIONS[4].id;
    session = putPilotResponse(session, { questionId, status: 'in_progress', takes: { main: take() }, responseTimeMs: 10, completedAt: new Date().toISOString() });
    session = putPilotResponse(session, { ...session.responses[0], status: 'answered', followUpStatus: 'skipped', followUpSkipReason: 'skipped', responseTimeMs: 11 });
    expect(session.responses).toHaveLength(1);
    expect(session.responses[0].takes?.main?.blob.size).toBeGreaterThan(0);
    expect(session.responses[0].status).toBe('answered');
    expect(session.responses[0].followUpSkipReason).toBe('skipped');
  });

  it('keeps the administered weekday snapshot immutable and honors legacy question completion rules', () => {
    const current = createPilotSession('1', 'ja', consent);
    const serialized = JSON.stringify(current.protocolSnapshot);
    const second = createPilotSession('1', 'ja', consent);
    expect(second.protocolSnapshot).not.toBe(current.protocolSnapshot);
    expect(JSON.stringify(current.protocolSnapshot)).toBe(serialized);
    const voice = PILOT_QUESTIONS[4];
    if (voice.kind !== 'voice') throw new Error('Expected voice');
    const legacy = { ...current, protocolVersion: 'jp-first-meeting-1.0',
      protocolSnapshot: [{ ...voice, id: 'JP_PILOT_Q12', followUpPolicy: undefined }], responses: [] };
    let answered = putPilotResponse(legacy, { questionId: 'JP_PILOT_Q12', status: 'answered', takes: { main: take() }, responseTimeMs: 1, completedAt: current.createdAt });
    expect(isPilotSessionComplete(answered)).toBe(false);
    answered = putPilotResponse(answered, { ...answered.responses[0], takes: { main: take(), followUp: take() } });
    expect(isPilotSessionComplete(answered)).toBe(true);
  });

  it('continues listing version 1 browser records including Q12 alongside new attempts', async () => {
    const current = createPilotSession('1', 'ja', consent);
    const legacy = { ...current, sessionId: 'old-attempt', protocolVersion: 'jp-first-meeting-1.0',
      protocolSnapshot: undefined, responses: [{ questionId: 'JP_PILOT_Q12', status: 'in_progress', responseTimeMs: 1234,
        completedAt: current.createdAt, takes: { main: take() } }] };
    const getAll: Partial<IDBRequest> = { result: [legacy, { ...current, protocolSnapshot: {} }, current] };
    const transaction = { objectStore: () => ({ getAll: () => getAll }) };
    const database = { transaction: vi.fn(() => transaction), close: vi.fn() };
    const request: Partial<IDBOpenDBRequest> = { result: database as unknown as IDBDatabase };
    vi.stubGlobal('indexedDB', { open: () => request });
    const listing = listBrowserPilotSessions();
    request.onsuccess?.call(request as IDBOpenDBRequest, new Event('success'));
    await vi.waitFor(() => expect(database.transaction).toHaveBeenCalled());
    getAll.onsuccess?.call(getAll as IDBRequest, new Event('success'));
    const sessions = await listing;
    expect(sessions).toHaveLength(2);
    expect(sessions.find(session => session.protocolVersion === 'jp-first-meeting-1.0')?.responses[0].questionId).toBe('JP_PILOT_Q12');
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
