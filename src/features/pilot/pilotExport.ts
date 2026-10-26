import { PILOT_PROTOCOL_VERSION } from '@/features/pilot/pilotProtocol';
import { getPilotSessionQuestions, type PilotSession, type PilotTake } from '@/features/pilot/pilotStorage';
import type { PilotQuestion } from '@/features/pilot/pilotProtocol';
import { getLocalizedText } from '@/utils/localizedText';
import { flushPilotOutbox, pilotLocalRequest, readPilotRecording } from '@/features/pilot/pilotLocalClient';
import { pilotCsv, pilotQuestionMetrics } from '@/features/pilot/pilotMetrics';

interface ZipEntry { name: string; bytes: Uint8Array<ArrayBuffer> }

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

// ZIP "store" method: no dependency, and original audio bytes stay unchanged.
export function buildPilotZip(entries: ZipEntry[]): Blob {
  const parts: BlobPart[] = [];
  const directory: BlobPart[] = [];
  let offset = 0;
  let directorySize = 0;
  for (const entry of entries) {
    const name = new TextEncoder().encode(entry.name);
    const local = new Uint8Array(30 + name.length);
    const header = new DataView(local.buffer);
    header.setUint32(0, 0x04034b50, true);
    header.setUint16(4, 20, true);
    header.setUint16(6, 0x800, true);
    header.setUint16(12, 33, true); // 1980-01-01, valid DOS date.
    header.setUint32(14, crc32(entry.bytes), true);
    header.setUint32(18, entry.bytes.length, true);
    header.setUint32(22, entry.bytes.length, true);
    header.setUint16(26, name.length, true);
    local.set(name, 30);
    const central = new Uint8Array(46 + name.length);
    const index = new DataView(central.buffer);
    index.setUint32(0, 0x02014b50, true);
    index.setUint16(4, 20, true);
    index.setUint16(6, 20, true);
    index.setUint16(8, 0x800, true);
    index.setUint16(14, 33, true);
    index.setUint32(16, header.getUint32(14, true), true);
    index.setUint32(20, entry.bytes.length, true);
    index.setUint32(24, entry.bytes.length, true);
    index.setUint16(28, name.length, true);
    index.setUint32(42, offset, true);
    central.set(name, 46);
    parts.push(local, entry.bytes);
    directory.push(central);
    offset += local.length + entry.bytes.length;
    directorySize += central.length;
  }
  const end = new Uint8Array(22);
  const footer = new DataView(end.buffer);
  footer.setUint32(0, 0x06054b50, true);
  footer.setUint16(8, entries.length, true);
  footer.setUint16(10, entries.length, true);
  footer.setUint32(12, directorySize, true);
  footer.setUint32(16, offset, true);
  return new Blob([...parts, ...directory, end], { type: 'application/zip' });
}

function extension(mimeType: string): string {
  if (mimeType.includes('mp4')) return 'm4a';
  if (mimeType.includes('ogg')) return 'ogg';
  if (mimeType.includes('wav')) return 'wav';
  return 'webm';
}

function administeredQuestions(questions: readonly PilotQuestion[]) {
  return questions.map(question => ({ ...question,
    administeredPrompts: Object.fromEntries(['ja', 'ko', 'en'].map(language => [language, {
      main: getLocalizedText(question.prompt, language),
      ...(question.kind === 'voice' ? { followUp: getLocalizedText(question.followUp, language) } : {}),
    }])),
  }));
}

export async function exportPilotSessions(sessions: PilotSession[]): Promise<Blob> {
  const entries: ZipEntry[] = [];
  const manifestSessions = [];
  const eventRows: Record<string, unknown>[] = [];
  const questionRows: Record<string, unknown>[] = [];
  const attemptRows: Record<string, unknown>[] = [];
  const storedFiles = new Set<string>();
  for (const original of sessions) {
    let session = original;
    if (session.storageBackend === 'local-filesystem') {
      await flushPilotOutbox();
      session = await pilotLocalRequest<PilotSession>(`/sessions/${session.sessionId}`);
    }
    if (!session.consent.recordingAndLocalStorage) continue;
    const base = session.storageBackend === 'local-filesystem'
      ? `participants/${session.participantCode}/attempt-${session.attemptNumber}-${session.sessionId}` : `audio/${session.sessionId}`;
    const recordingHistory = [];
    for (const history of session.recordingHistory ?? []) {
      const file = `${base}/audio/${history.questionId}-${history.part}-${history.recordingId}.${extension(history.mimeType)}`;
      if (history.byteLength > 0) {
        const blob = await readPilotRecording(history.recordingId);
        if (blob.size) { entries.push({ name: file, bytes: new Uint8Array(await blob.arrayBuffer()) }); storedFiles.add(file); }
      }
      recordingHistory.push({ ...history, file: storedFiles.has(file) ? file : null });
    }
    const responses = [];
    for (const response of session.responses) {
      const audio: Record<string, Omit<PilotTake, 'blob'> & { file: string }> = {};
      for (const part of ['main', 'followUp'] as const) {
        const take = response.takes?.[part];
        if (!take) continue;
        const history = recordingHistory.find((item) => item.recordingId === take.recordingId);
        const file = history?.file ?? `${base}/${response.questionId}-${part}.${extension(take.mimeType)}`;
        if (!storedFiles.has(file)) {
          const blob = take.recordingId ? await readPilotRecording(take.recordingId) : take.blob;
          if (!blob?.size) continue;
          entries.push({ name: file, bytes: new Uint8Array(await blob.arrayBuffer()) }); storedFiles.add(file);
        }
        const { blob, ...metadata } = take;
        void blob;
        audio[part] = { ...metadata, file };
      }
      const { takes, ...metadata } = response;
      void takes;
      responses.push({ ...metadata, audio, transcription: { status: 'not_requested', text: null } });
    }
    manifestSessions.push({ ...session, responses, recordingHistory,
      administeredQuestions: administeredQuestions(getPilotSessionQuestions(session)),
      protocolSnapshotStatus: session.protocolSnapshot ? 'available' : 'not-stored',
      profileFacts: [], reviewStatus: 'pending',
      personalizationEligible: session.consent.futurePersonalization,
      memoryTranscriptionEligible: session.consent.futurePersonalization
        && session.consent.futurePersonalizationScope === 'transcription-explicit-memories-personalization' });
    for (const event of session.events ?? []) eventRows.push({ participant: session.participantCode, attempt: session.attemptNumber, protocolVersion: session.protocolVersion, ...event });
    questionRows.push(...pilotQuestionMetrics(session));
    attemptRows.push({ participant: session.participantCode, attempt: session.attemptNumber, sessionId: session.sessionId,
      protocolVersion: session.protocolVersion, questionCount: getPilotSessionQuestions(session).length,
      status: session.status, startedAt: session.createdAt, lastSeenAt: session.lastSeenAt, exitReason: session.exitReason,
      lastQuestion: session.lastPoint?.questionId, lastPart: session.lastPoint?.part,
      lastContactState: session.lastContactState, responses: session.responses.length,
      recordings: recordingHistory.length, partialRecordings: recordingHistory.filter((item) => item.recordingStatus === 'partial').length });
  }
  const versions = [...new Set(manifestSessions.map(session => session.protocolVersion))];
  const firstQuestions = manifestSessions[0]?.administeredQuestions ?? [];
  const sharedQuestions = manifestSessions.every(session => session.protocolVersion === versions[0]
    && JSON.stringify(session.administeredQuestions) === JSON.stringify(firstQuestions));
  const manifest = {
    schemaVersion: 2, protocolVersion: versions.length === 1 ? versions[0] : versions.length ? 'mixed' : PILOT_PROTOCOL_VERSION,
    currentProtocolVersion: PILOT_PROTOCOL_VERSION, protocolVersions: versions, exportedAt: new Date().toISOString(),
    notice: 'Self-reported audio evidence. No inferred profile, automatic transcription, or clinical interpretation. Respect each session consent before reuse.',
    questionCatalogScope: sharedQuestions ? 'shared-administered-snapshot' : 'per-session',
    questions: sharedQuestions ? firstQuestions : [],
    sessions: manifestSessions,
  };
  entries.unshift({ name: 'sessions.json', bytes: new TextEncoder().encode(JSON.stringify(manifest, null, 2)) });
  if (eventRows.length || sessions.some((session) => session.storageBackend === 'local-filesystem')) {
    for (const [name, rows] of [['attempts.csv', attemptRows], ['questions.csv', questionRows], ['events.csv', eventRows]] as const) {
      entries.push({ name, bytes: new TextEncoder().encode(pilotCsv(rows)) });
    }
  }
  return buildPilotZip(entries);
}

export function downloadPilotExport(blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `haru-japan-pilot-${new Date().toISOString().replace(/[:.]/g, '-')}.zip`;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
