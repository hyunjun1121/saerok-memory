import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PilotTracker } from '@/features/pilot/pilotTracking';
import { pilotCsv, pilotQuestionMetrics } from '@/features/pilot/pilotMetrics';
import { createPilotSession } from '@/features/pilot/pilotStorage';
import type { PilotEvent } from '@/features/pilot/pilotTracking';

const mocks = vi.hoisted(() => ({ events: [] as PilotEvent[] }));
vi.mock('@/features/pilot/pilotLocalClient', () => ({ queuePilotOperation: async (_path: string, _method: string, body: string) => { mocks.events.push(JSON.parse(body)); } }));

describe('local research timing and event metadata', () => {
  let now = 0;
  let focused = true;
  beforeEach(() => {
    vi.useFakeTimers(); now = 0; focused = true; mocks.events = [];
    vi.spyOn(performance, 'now').mockImplementation(() => now);
    vi.spyOn(document, 'hasFocus').mockImplementation(() => focused);
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');
  });
  afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

  it('keeps wall dwell, foreground time, selection changes, and dropout points separate', () => {
    const session = createPilotSession('1', 'ja', { recordingAndLocalStorage: true, futurePersonalization: true });
    const tracker = new PilotTracker(session.sessionId);
    tracker.setView('question', 'JP_PILOT_Q01', 'main');
    tracker.emit('choice_selected', { optionId: 'A', changed: false });
    now = 1000; tracker.emit('choice_selected', { optionId: 'B', changed: true });
    now = 2000; focused = false; window.dispatchEvent(new Event('blur'));
    now = 5000; vi.advanceTimersByTime(5000);
    now = 6000; focused = true; window.dispatchEvent(new Event('focus'));
    now = 7000; tracker.setView('question', 'JP_PILOT_Q02', 'main');
    tracker.stop('operator_stop');
    const metrics = pilotQuestionMetrics({ ...session, events: mocks.events });
    const first = metrics.find((row) => row.questionId === 'JP_PILOT_Q01')!;
    expect(first.dwellMsObserved).toBe(7000);
    expect(first.activeMsObserved).toBe(3000);
    expect(first.selections).toBe(2);
    expect(first.changes).toBe(1);
    expect(first.exitObserved).toBe(true);
    expect(new Set(mocks.events.map((event) => event.eventId)).size).toBe(mocks.events.length);
    expect(mocks.events.at(-1)?.detail.reason).toBe('operator_stop');
    expect(mocks.events.at(-1)?.questionId).toBe('JP_PILOT_Q02');
  });

  it('does not fabricate a final exit time when only heartbeat checkpoints were received', () => {
    const session = createPilotSession('2', 'ja', { recordingAndLocalStorage: true, futurePersonalization: false });
    const tracker = new PilotTracker(session.sessionId);
    tracker.setView('question', 'JP_PILOT_Q06', 'followUp');
    now = 5000; vi.advanceTimersByTime(5000);
    const recorded = [...mocks.events];
    tracker.stop('test_cleanup');
    const metric = pilotQuestionMetrics({ ...session, events: recorded })[0];
    expect(metric.exitObserved).toBe(false);
    expect(metric.dwellMsObserved).toBe(5000);
    expect(metric.part).toBe('followUp');
  });

  it('escapes CSV cells and keeps event details structured for later analysis', () => {
    const csv = pilotCsv([{ participant: '1', detail: { optionId: 'A', changed: true }, note: '=danger' }]);
    expect(csv).toContain('"{""optionId"":""A"",""changed"":true}"');
    expect(csv).toContain("'=danger");
  });
});
