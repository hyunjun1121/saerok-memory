import type { PilotSession } from '@/features/pilot/pilotStorage';

export function pilotQuestionMetrics(session: PilotSession) {
  const views = new Map<string, {
    participant: string; attempt: number | null; sessionId: string; questionId: string; part: string;
    enteredAt: string | null; lastObservedAt: string; dwellMsObserved: number; activeMsObserved: number;
    exitObserved: boolean; selections: number; changes: number; replays: number; recordingStarts: number; recordingRetries: number;
  }>();
  for (const event of session.events ?? []) {
    const viewId = event.detail.viewId;
    if (!event.questionId || typeof viewId !== 'string') continue;
    let view = views.get(viewId);
    if (!view) {
      view = { participant: session.participantCode, attempt: session.attemptNumber ?? null, sessionId: session.sessionId,
        questionId: event.questionId, part: event.part ?? 'main', enteredAt: null, lastObservedAt: event.at,
        dwellMsObserved: 0, activeMsObserved: 0, exitObserved: false, selections: 0, changes: 0, replays: 0, recordingStarts: 0, recordingRetries: 0 };
      views.set(viewId, view);
    }
    if (event.type === 'view_enter') view.enteredAt = event.at;
    view.lastObservedAt = event.at;
    if (typeof event.detail.dwellMs === 'number') view.dwellMsObserved = Math.max(view.dwellMsObserved, event.detail.dwellMs);
    if (typeof event.detail.activeMs === 'number') view.activeMsObserved = Math.max(view.activeMsObserved, event.detail.activeMs);
    if (event.type === 'view_exit' || event.type === 'page_exit') view.exitObserved = true;
    if (event.type === 'choice_selected') { view.selections++; if (event.detail.changed === true) view.changes++; }
    if (event.type === 'narration_replay') view.replays++;
    if (event.type === 'recording_start') view.recordingStarts++;
    if (event.type === 'recording_retry') view.recordingRetries++;
  }
  return [...views.values()];
}

export function pilotCsv(rows: Record<string, unknown>[]): string {
  if (!rows.length) return '\uFEFF';
  const columns = [...new Set(rows.flatMap((row) => Object.keys(row)))];
  const escape = (value: unknown) => {
    let cell = value === undefined || value === null ? '' : typeof value === 'object' ? JSON.stringify(value) : String(value);
    if (/^[=+@-]/.test(cell)) cell = `'${cell}`;
    return `"${cell.replaceAll('"', '""')}"`;
  };
  return '\uFEFF' + [columns.map(escape).join(','), ...rows.map((row) => columns.map((column) => escape(row[column])).join(','))].join('\r\n');
}
