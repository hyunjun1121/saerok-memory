export const DEFAULT_IDLE_AFTER_MS = 30_000;

export interface ActiveClockState {
  startedAtMs: number;
  updatedAtMs: number;
  lastInteractionAtMs: number;
  accumulatedActiveMs: number;
  idleAfterMs: number;
  visible: boolean;
  focused: boolean;
  stoppedAtMs?: number;
}

export type ActiveClockEvent =
  | { type: "interaction"; atMs: number }
  | { type: "visibility"; visible: boolean; atMs: number }
  | { type: "focus"; focused: boolean; atMs: number }
  | { type: "stop"; atMs: number };

export interface ActiveClockSnapshot {
  wallDurationMs: number;
  activeDurationMs: number;
  inactiveDurationMs: number;
  isActive: boolean;
}

function finiteTimestamp(value: number, fallback: number): number {
  return Number.isFinite(value) ? value : fallback;
}

function advanceClock(state: ActiveClockState, requestedAtMs: number): ActiveClockState {
  if (state.stoppedAtMs !== undefined) return state;

  const atMs = Math.max(state.updatedAtMs, finiteTimestamp(requestedAtMs, state.updatedAtMs));
  let activeIncrementMs = 0;
  if (state.visible && state.focused) {
    const activeUntilMs = Math.min(atMs, state.lastInteractionAtMs + state.idleAfterMs);
    activeIncrementMs = Math.max(0, activeUntilMs - state.updatedAtMs);
  }

  return {
    ...state,
    updatedAtMs: atMs,
    accumulatedActiveMs: state.accumulatedActiveMs + activeIncrementMs,
  };
}

export function createActiveClock(
  startedAtMs: number,
  options: { idleAfterMs?: number; visible?: boolean; focused?: boolean } = {},
): ActiveClockState {
  const start = finiteTimestamp(startedAtMs, 0);
  const idleAfterMs =
    options.idleAfterMs !== undefined && Number.isFinite(options.idleAfterMs)
      ? Math.max(0, options.idleAfterMs)
      : DEFAULT_IDLE_AFTER_MS;
  return {
    startedAtMs: start,
    updatedAtMs: start,
    lastInteractionAtMs: start,
    accumulatedActiveMs: 0,
    idleAfterMs,
    visible: options.visible ?? true,
    focused: options.focused ?? true,
  };
}

export function reduceActiveClock(
  state: ActiveClockState,
  event: ActiveClockEvent,
): ActiveClockState {
  if (state.stoppedAtMs !== undefined) return state;
  const advanced = advanceClock(state, event.atMs);

  switch (event.type) {
    case "interaction":
      return { ...advanced, lastInteractionAtMs: advanced.updatedAtMs };
    case "visibility":
      return { ...advanced, visible: event.visible };
    case "focus":
      return { ...advanced, focused: event.focused };
    case "stop":
      return { ...advanced, stoppedAtMs: advanced.updatedAtMs };
  }
}

export function readActiveClock(state: ActiveClockState, atMs: number): ActiveClockSnapshot {
  const advanced = advanceClock(state, atMs);
  const endedAtMs = advanced.stoppedAtMs ?? advanced.updatedAtMs;
  const wallDurationMs = Math.max(0, endedAtMs - advanced.startedAtMs);
  const activeDurationMs = Math.min(wallDurationMs, Math.max(0, advanced.accumulatedActiveMs));
  const currentAtMs = Math.max(advanced.updatedAtMs, finiteTimestamp(atMs, advanced.updatedAtMs));
  const isActive =
    advanced.stoppedAtMs === undefined &&
    advanced.visible &&
    advanced.focused &&
    currentAtMs < advanced.lastInteractionAtMs + advanced.idleAfterMs;

  return {
    wallDurationMs,
    activeDurationMs,
    inactiveDurationMs: wallDurationMs - activeDurationMs,
    isActive,
  };
}
