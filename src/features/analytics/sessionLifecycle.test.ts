import {
  createEmptySessionLifecycle,
  transitionSessionLifecycle,
} from "@/features/analytics/sessionLifecycle";

describe("session lifecycle state machine", () => {
  it("treats page exit as an observation, not immediate abandonment", () => {
    let result = transitionSessionLifecycle(createEmptySessionLifecycle(), {
      type: "start",
      sessionId: "routine_1",
      atMs: 0,
    });
    result = transitionSessionLifecycle(result.state, {
      type: "exit_observed",
      reason: "pagehide",
      atMs: 5_000,
    });

    expect(result.state).toMatchObject({
      status: "in_progress",
      sessionId: "routine_1",
      exitObservedAtMs: 5_000,
    });
    expect(result.effects).toEqual([
      { type: "session_exit_observed", sessionId: "routine_1", atMs: 5_000, reason: "pagehide" },
    ]);
  });

  it("resumes the same session inside the stale window", () => {
    const started = transitionSessionLifecycle(createEmptySessionLifecycle(), {
      type: "start",
      sessionId: "routine_1",
      atMs: 0,
    }).state;
    const exited = transitionSessionLifecycle(started, {
      type: "exit_observed",
      reason: "reload",
      atMs: 1_000,
    }).state;
    const resumed = transitionSessionLifecycle(exited, {
      type: "resume",
      newSessionId: "routine_2",
      atMs: 20 * 60_000,
    });

    expect(resumed.state).toMatchObject({ status: "in_progress", sessionId: "routine_1" });
    expect(resumed.effects).toEqual([
      { type: "session_resumed", sessionId: "routine_1", atMs: 20 * 60_000 },
    ]);
  });

  it("abandons stale work and starts a linked session after 30 minutes", () => {
    const started = transitionSessionLifecycle(createEmptySessionLifecycle(), {
      type: "start",
      sessionId: "routine_1",
      atMs: 0,
    }).state;
    const resumed = transitionSessionLifecycle(started, {
      type: "resume",
      newSessionId: "routine_2",
      atMs: 30 * 60_000,
    });

    expect(resumed.state).toMatchObject({
      status: "in_progress",
      sessionId: "routine_2",
      previousSessionId: "routine_1",
      returnedAfterDropoff: true,
    });
    expect(resumed.effects).toEqual([
      {
        type: "session_abandoned",
        sessionId: "routine_1",
        atMs: 30 * 60_000,
        reason: "stale",
      },
      {
        type: "session_started",
        sessionId: "routine_2",
        atMs: 30 * 60_000,
        previousSessionId: "routine_1",
        returnedAfterDropoff: true,
      },
    ]);
  });

  it("marks stale sessions on a pure tick and tracks last question", () => {
    let state = transitionSessionLifecycle(createEmptySessionLifecycle(), {
      type: "start",
      sessionId: "routine_1",
      atMs: 0,
    }).state;
    state = transitionSessionLifecycle(state, {
      type: "question_presented",
      questionInstanceId: "question_4",
      atMs: 10_000,
    }).state;
    state = transitionSessionLifecycle(state, {
      type: "question_completed",
      questionInstanceId: "question_4",
      atMs: 20_000,
    }).state;
    const stale = transitionSessionLifecycle(state, {
      type: "tick",
      atMs: 30 * 60_000 + 20_000,
    });

    expect(stale.state).toMatchObject({
      status: "abandoned",
      sessionId: "routine_1",
      lastQuestionInstanceId: "question_4",
      completedQuestionCount: 1,
      reason: "stale",
    });
  });
});
