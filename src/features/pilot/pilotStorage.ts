import { PILOT_PROTOCOL_VERSION, PILOT_QUESTIONS, buildPilotQuestions } from '@/features/pilot/pilotProtocol';
import type { SupportedLanguage } from '@/utils/localizedText';
import { flushPilotOutbox, materializeSession, pilotLocalRequest, snapshotForDisk } from '@/features/pilot/pilotLocalClient';
import type { PilotEvent } from '@/features/pilot/pilotTracking';
import type { PilotQuestion } from '@/features/pilot/pilotProtocol';

const DATABASE = 'haruJapanPilot';
const STORE = 'sessions';
export const PILOT_ACTIVE_SESSION_KEY = 'haruJapanPilotActiveSession';

export type PilotResponseStatus = 'in_progress' | 'answered' | 'skipped' | 'not_applicable' | 'no_response' | 'recording_failed';
export type PilotPart = 'main' | 'followUp';

export interface PilotTake {
  blob: Blob;
  mimeType: string;
  durationMs: number;
  startedAt: string;
  endedAt: string;
  recordingId?: string;
  sampleRateHz?: number | null;
  channelCount?: number | null;
}

export interface PilotRecordingHistory {
  recordingId: string;
  questionId: string;
  part: PilotPart;
  recordingStatus: 'partial' | 'finalized';
  mimeType: string;
  startedAt: string;
  endedAt: string | null;
  durationMs: number | null;
  byteLength: number;
  chunkCount: number;
  localFile: string | null;
  audioUrl: string;
}

export interface PilotResponse {
  questionId: string;
  status: PilotResponseStatus;
  completedAt: string;
  responseTimeMs: number;
  selectedOptionId?: string;
  isCorrect?: boolean | null;
  takes?: Partial<Record<PilotPart, PilotTake>>;
  followUpStatus?: 'not_needed' | 'requested' | 'answered' | 'skipped';
  followUpReason?: 'short_answer';
  followUpDecidedAt?: string;
  followUpSkipReason?: Exclude<PilotResponseStatus, 'in_progress' | 'answered'>;
}

export interface PilotSession {
  schemaVersion: 1;
  protocolVersion: string;
  collectionVersion?: string;
  sessionId: string;
  participantCode: string;
  language: SupportedLanguage;
  createdAt: string;
  updatedAt: string;
  status: 'in_progress' | 'completed' | 'stopped' | 'interrupted';
  attemptNumber?: number;
  storageBackend?: 'local-filesystem';
  localDataDirectory?: string;
  environment?: Record<string, string | number | boolean | null>;
  lastSeenAt?: string;
  exitReason?: string | null;
  recordingHistory?: PilotRecordingHistory[];
  events?: PilotEvent[];
  protocolSnapshot?: readonly PilotQuestion[];
  lastPoint?: { questionId: string; part: PilotPart | null; at: string; type: string } | null;
  lastContactState?: 'recent' | 'stale_unconfirmed';
  consent: {
    revision?: string;
    recordingAndLocalStorage: true;
    futurePersonalization: boolean;
    futurePersonalizationScope?: 'transcription-explicit-memories-personalization';
    confirmedAt: string;
  };
  responses: PilotResponse[];
}

export function isPilotParticipantCode(value: string): boolean {
  return /^[A-Za-z0-9][A-Za-z0-9_-]{0,31}$/.test(value);
}

export function newPilotParticipantCode(): string {
  return '1';
}

export function isPilotParticipantNumber(value: string): boolean {
  return /^\d{1,5}$/.test(value) && Number(value) >= 1 && Number(value) <= 99999;
}

export function createPilotSession(
  participantCode: string, language: SupportedLanguage,
  consent: { recordingAndLocalStorage: boolean; futurePersonalization: boolean },
): PilotSession {
  if (!isPilotParticipantCode(participantCode)) throw new Error('invalid-participant-code');
  if (!consent.recordingAndLocalStorage) throw new Error('pilot-recording-consent-required');
  const created = new Date();
  const now = created.toISOString();
  return {
    schemaVersion: 1, protocolVersion: PILOT_PROTOCOL_VERSION,
    collectionVersion: 'local-numbered-attempts-v2',
    sessionId: crypto.randomUUID(), participantCode: /^\d+$/.test(participantCode) ? String(Number(participantCode)) : participantCode, language,
    createdAt: now, updatedAt: now, status: 'in_progress',
    protocolSnapshot: buildPilotQuestions(created),
    consent: { revision: 'jp-pilot-consent-2.0', recordingAndLocalStorage: true,
      futurePersonalization: consent.futurePersonalization,
      futurePersonalizationScope: 'transcription-explicit-memories-personalization', confirmedAt: now },
    responses: [],
  };
}

export function getPilotSessionQuestions(session: PilotSession): readonly PilotQuestion[] {
  // An older attempt's IDs have different meanings. Always use its own snapshot.
  return session.protocolSnapshot ?? (session.protocolVersion === PILOT_PROTOCOL_VERSION ? PILOT_QUESTIONS : []);
}

export function putPilotResponse(session: PilotSession, response: PilotResponse): PilotSession {
  if (!getPilotSessionQuestions(session).some((question) => question.id === response.questionId)) throw new Error('unknown-pilot-question');
  return {
    ...session, updatedAt: new Date().toISOString(),
    responses: [...session.responses.filter((item) => item.questionId !== response.questionId), response],
  };
}

export function isPilotSessionComplete(session: PilotSession): boolean {
  const questions = getPilotSessionQuestions(session);
  return questions.length > 0 && questions.every((question) => {
    const response = session.responses.find((item) => item.questionId === question.id);
    if (!response || response.status === 'in_progress') return false;
    if (response.status !== 'answered') return true;
    if (question.kind === 'choice') return question.options.some((option) => option.id === response.selectedOptionId);
    if (!(response.takes?.main?.blob.size)) return false;
    if (question.followUpPolicy !== 'short-answer-only') return (response.takes?.followUp?.blob.size ?? 0) > 0;
    if (response.followUpStatus === 'answered') return (response.takes?.followUp?.blob.size ?? 0) > 0;
    return response.followUpStatus === 'not_needed'
      || (response.followUpStatus === 'skipped' && Boolean(response.followUpSkipReason));
  });
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') { reject(new Error('indexeddb-unavailable')); return; }
    const request = indexedDB.open(DATABASE, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE, { keyPath: 'sessionId' });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('pilot-database-open-failed'));
    request.onblocked = () => reject(new Error('pilot-database-blocked'));
  });
}

export async function saveBrowserPilotSession(session: PilotSession): Promise<void> {
  if (!session.consent.recordingAndLocalStorage) throw new Error('pilot-storage-consent-required');
  if (session.status === 'completed' && !isPilotSessionComplete(session)) throw new Error('pilot-session-incomplete');
  const database = await openDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      // Responses and their actual Blob payloads commit atomically.
      const transaction = database.transaction(STORE, 'readwrite');
      transaction.objectStore(STORE).put(session);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error ?? new Error('pilot-save-failed'));
      transaction.onabort = () => reject(transaction.error ?? new Error('pilot-save-aborted'));
    });
  } finally { database.close(); }
}

export async function listBrowserPilotSessions(): Promise<PilotSession[]> {
  const database = await openDatabase();
  try {
    return await new Promise((resolve, reject) => {
      const transaction = database.transaction(STORE, 'readonly');
      const request = transaction.objectStore(STORE).getAll();
      request.onsuccess = () => resolve((request.result as unknown[])
        .filter(isStoredPilotSession)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
      request.onerror = () => reject(request.error ?? new Error('pilot-load-failed'));
      transaction.onabort = () => reject(transaction.error ?? new Error('pilot-load-aborted'));
    });
  } finally { database.close(); }
}

function isStoredPilotSession(value: unknown): value is PilotSession {
  if (!value || typeof value !== 'object') return false;
  const session = value as Partial<PilotSession>;
  if (session.protocolSnapshot !== undefined && (!Array.isArray(session.protocolSnapshot)
    || !session.protocolSnapshot.every(question => question && typeof question === 'object' && typeof question.id === 'string'))) return false;
  return session.schemaVersion === 1 && ['jp-first-meeting-1.0', PILOT_PROTOCOL_VERSION].includes(session.protocolVersion ?? '')
    && typeof session.sessionId === 'string' && typeof session.participantCode === 'string'
    && isPilotParticipantCode(session.participantCode)
    && ['ja', 'ko', 'en'].includes(session.language ?? '')
    && ['in_progress', 'completed', 'stopped', 'interrupted'].includes(session.status ?? '')
    && typeof session.createdAt === 'string' && typeof session.updatedAt === 'string'
    && session.consent?.recordingAndLocalStorage === true
    && typeof session.consent.futurePersonalization === 'boolean'
    && Array.isArray(session.responses) && session.responses.every((response) =>
      response && typeof response === 'object'
      && (session.protocolSnapshot?.some((question) => question.id === response.questionId)
        ?? /^JP_PILOT_Q(0[1-9]|1[0-2])$/.test(response.questionId))
      && ['in_progress', 'answered', 'skipped', 'not_applicable', 'no_response', 'recording_failed'].includes(response.status)
      && typeof response.responseTimeMs === 'number' && Number.isFinite(response.responseTimeMs)
      && typeof response.completedAt === 'string'
      && (!response.takes || (['main', 'followUp'] as const).every((part) =>
        !response.takes?.[part] || response.takes[part].blob instanceof Blob)));
}

export async function deleteBrowserPilotSession(id: string): Promise<void> {
  const database = await openDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(STORE, 'readwrite');
      transaction.objectStore(STORE).delete(id);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error ?? new Error('pilot-delete-failed'));
      transaction.onabort = () => reject(transaction.error ?? new Error('pilot-delete-aborted'));
    });
  } finally { database.close(); }
}

export async function savePilotSession(session: PilotSession): Promise<PilotSession> {
  if (!session.consent.recordingAndLocalStorage) throw new Error('pilot-storage-consent-required');
  if (session.status === 'completed' && !isPilotSessionComplete(session)) throw new Error('pilot-session-incomplete');
  await flushPilotOutbox();
  const saved = await pilotLocalRequest<PilotSession>('/sessions', 'POST', snapshotForDisk(session));
  const result: PilotSession = { ...session, attemptNumber: saved.attemptNumber,
    localDataDirectory: saved.localDataDirectory, storageBackend: 'local-filesystem' };
  // New audio lives on disk once delivered. Keep the older browser store
  // readable for legacy exports without duplicating every new recording.
  return result;
}

export async function listPilotSessions(): Promise<PilotSession[]> {
  await flushPilotOutbox();
  const [disk, browser] = await Promise.all([
    pilotLocalRequest<PilotSession[]>('/sessions'), listBrowserPilotSessions().catch(() => []),
  ]);
  const ids = new Set(disk.map((session) => session.sessionId));
  return [...disk.map(materializeSession), ...browser.filter((session) => !ids.has(session.sessionId))]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function deletePilotSession(id: string): Promise<void> {
  await flushPilotOutbox();
  await pilotLocalRequest(`/sessions/${encodeURIComponent(id)}`, 'DELETE');
  await deleteBrowserPilotSession(id).catch(() => undefined);
}

export function setActivePilotSession(id: string | null): void {
  try {
    if (id) localStorage.setItem(PILOT_ACTIVE_SESSION_KEY, id);
    else localStorage.removeItem(PILOT_ACTIVE_SESSION_KEY);
  } catch { /* IndexedDB is the source of truth; the pointer is optional. */ }
}

export function findActivePilotSession(sessions: PilotSession[]): PilotSession | undefined {
  let id: string | null = null;
  try { id = localStorage.getItem(PILOT_ACTIVE_SESSION_KEY); } catch { /* Use the persisted unfinished session. */ }
  return sessions.find((session) => session.status === 'in_progress' && session.sessionId === id)
    ?? sessions.find((session) => session.status === 'in_progress');
}
