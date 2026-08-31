export const DEFAULT_SESSION_STALE_AFTER_MS = 30 * 60_000;

export interface EmptySessionLifecycle {
  status: "none";
}

export interface LiveSessionLifecycle {
  status: "in_progress" | "paused";
  sessionId: string;
  startedAtMs: number;
  lastActivityAtMs: number;
  lastQuestionInstanceId?: string;
  completedQuestionCount: number;
  exitObservedAtMs?: number;
  previousSessionId?: string;
  returnedAfterDropoff: boolean;
}

export interface CompletedSessionLifecycle {
  status: "completed";
  sessionId: string;
  startedAtMs: number;
  lastActivityAtMs: number;
  endedAtMs: number;
  lastQuestionInstanceId?: string;
  completedQuestionCount: number;
}

export interface AbandonedSessionLifecycle {
  status: "abandoned";
  sessionId: string;
  startedAtMs: number;
  lastActivityAtMs: number;
  endedAtMs: number;
  lastQuestionInstanceId?: string;
  completedQuestionCount: number;
  reason: "stale" | "user";
}

export type SessionLifecycleState =
  | EmptySessionLifecycle
  | LiveSessionLifecycle
  | CompletedSessionLifecycle
  | AbandonedSessionLifecycle;

export type SessionLifecycleEvent =
  | { type: "start"; sessionId: string; atMs: number }
  | { type: "activity"; atMs: number }
  | { type: "question_presented"; questionInstanceId: string; atMs: number }
  | { type: "question_completed"; questionInstanceId: string; atMs: number }
  | { type: "pause"; atMs: number }
  | { type: "resume"; newSessionId: string; atMs: number }
  | {
      type: "exit_observed";
      reason: "pagehide" | "reload" | "close" | "route_change" | "unknown";
      atMs: number;
    }
  | { type: "complete"; atMs: number }
  | { type: "abandon"; atMs: number }
  | { type: "tick"; atMs: number };

export type SessionLifecycleEffect =
  | {
      type: "session_started";
      sessionId: string;
      atMs: number;
      previousSessionId?: string;
      returnedAfterDropoff: boolean;
    }
  | { type: "session_resumed"; sessionId: string; atMs: number }
  | {
      type: "session_exit_observed";
      sessionId: string;
      atMs: number;
      reason: "pagehide" | "reload" | "close" | "route_change" | "unknown";
    }
  | { type: "session_completed"; sessionId: string; atMs: number }
  | { type: "session_abandoned"; sessionId: string; atMs: number; reason: "stale" | "user" };

export interface SessionLifecycleTransition {
  state: SessionLifecycleState;
  effects: SessionLifecycleEffect[];
}

function normalizeAt(atMs: number, minimum = 0): number {
  return Number.isFinite(atMs) ? Math.max(minimum, atMs) : minimum;
}

function isLive(state: SessionLifecycleState): state is LiveSessionLifecycle {
  return state.status === "in_progress" || state.status === "paused";
}

function createLiveSession(
  sessionId: string,
  atMs: number,
  options: { previousSessionId?: string; returnedAfterDropoff?: boolean } = {},
): LiveSessionLifecycle {
  return {
    status: "in_progress",
    sessionId,
    startedAtMs: atMs,
    lastActivityAtMs: atMs,
    completedQuestionCount: 0,
    previousSessionId: options.previousSessionId,
    returnedAfterDropoff: options.returnedAfterDropoff ?? false,
  };
}

function abandonLiveSession(
  state: LiveSessionLifecycle,
  atMs: number,
  reason: "stale" | "user",
): AbandonedSessionLifecycle {
  return {
    status: "abandoned",
    sessionId: state.sessionId,
    startedAtMs: state.startedAtMs,
    lastActivityAtMs: state.lastActivityAtMs,
    endedAtMs: atMs,
    lastQuestionInstanceId: state.lastQuestionInstanceId,
    completedQuestionCount: state.completedQuestionCount,
    reason,
  };
}

export function createEmptySessionLifecycle(): EmptySessionLifecycle {
  return { status: "none" };
}

export function isSessionStale(
  state: SessionLifecycleState,
  atMs: number,
  staleAfterMs = DEFAULT_SESSION_STALE_AFTER_MS,
): boolean {
  if (!isLive(state)) return false;
  const now = normalizeAt(atMs, state.lastActivityAtMs);
  return now - state.lastActivityAtMs >= Math.max(1, staleAfterMs);
}

export function transitionSessionLifecycle(
  state: SessionLifecycleState,
  event: SessionLifecycleEvent,
  options: { staleAfterMs?: number } = {},
): SessionLifecycleTransition {
  const staleAfterMs = Math.max(1, options.staleAfterMs ?? DEFAULT_SESSION_STALE_AFTER_MS);

  if (event.type === "start") {
    if (isLive(state)) return { state, effects: [] };
    const atMs = normalizeAt(event.atMs);
    const next = createLiveSession(event.sessionId, atMs);
    return {
      state: next,
      effects: [
        {
          type: "session_started",
          sessionId: next.sessionId,
          atMs,
          returnedAfterDropoff: false,
        },
      ],
    };
  }

  if (event.type === "resume") {
    const minimum = state.status === "none" ? 0 : state.lastActivityAtMs;
    const atMs = normalizeAt(event.atMs, minimum);
    if (isLive(state) && !isSessionStale(state, atMs, staleAfterMs)) {
      return {
        state: {
          ...state,
          status: "in_progress",
          lastActivityAtMs: atMs,
          exitObservedAtMs: undefined,
        },
        effects: [{ type: "session_resumed", sessionId: state.sessionId, atMs }],
      };
    }

    const previousSessionId = state.status === "none" ? undefined : state.sessionId;
    const returnedAfterDropoff = isLive(state) || state.status === "abandoned";
    const next = createLiveSession(event.newSessionId, atMs, {
      previousSessionId,
      returnedAfterDropoff,
    });
    const effects: SessionLifecycleEffect[] = [];
    if (isLive(state)) {
      effects.push({
        type: "session_abandoned",
        sessionId: state.sessionId,
        atMs,
        reason: "stale",
      });
    }
    effects.push({
      type: "session_started",
      sessionId: next.sessionId,
      atMs,
      previousSessionId,
      returnedAfterDropoff,
    });
    return { state: next, effects };
  }

  if (!isLive(state)) return { state, effects: [] };

  const atMs = normalizeAt(event.atMs, state.lastActivityAtMs);
  switch (event.type) {
    case "activity":
      return {
        state: { ...state, status: "in_progress", lastActivityAtMs: atMs },
        effects: [],
      };
    case "question_presented":
      return {
        state: {
          ...state,
          status: "in_progress",
          lastActivityAtMs: atMs,
          lastQuestionInstanceId: event.questionInstanceId,
        },
        effects: [],
      };
    case "question_completed":
      return {
        state: {
          ...state,
          status: "in_progress",
          lastActivityAtMs: atMs,
          lastQuestionInstanceId: event.questionInstanceId,
          completedQuestionCount: state.completedQuestionCount + 1,
        },
        effects: [],
      };
    case "pause":
      return {
        state: { ...state, status: "paused", lastActivityAtMs: atMs },
        effects: [],
      };
    case "exit_observed":
      return {
        state: { ...state, exitObservedAtMs: atMs },
        effects: [
          {
            type: "session_exit_observed",
            sessionId: state.sessionId,
            atMs,
            reason: event.reason,
          },
        ],
      };
    case "complete":
      return {
        state: {
          status: "completed",
          sessionId: state.sessionId,
          startedAtMs: state.startedAtMs,
          lastActivityAtMs: atMs,
          endedAtMs: atMs,
          lastQuestionInstanceId: state.lastQuestionInstanceId,
          completedQuestionCount: state.completedQuestionCount,
        },
        effects: [{ type: "session_completed", sessionId: state.sessionId, atMs }],
      };
    case "abandon":
      return {
        state: abandonLiveSession(state, atMs, "user"),
        effects: [
          { type: "session_abandoned", sessionId: state.sessionId, atMs, reason: "user" },
        ],
      };
    case "tick":
      if (!isSessionStale(state, atMs, staleAfterMs)) return { state, effects: [] };
      return {
        state: abandonLiveSession(state, atMs, "stale"),
        effects: [
          { type: "session_abandoned", sessionId: state.sessionId, atMs, reason: "stale" },
        ],
      };
  }
}
