import {
  createFourButtonState,
  fourButtonReducer,
} from "@/features/input/fourButtonMachine";

describe("fourButtonReducer", () => {
  it("selects on first choice press, changes selection, then confirms the same slot once", () => {
    let state = createFourButtonState("choice");

    state = fourButtonReducer(state, { type: "press", slot: "topLeft" });
    expect(state).toMatchObject({
      kind: "choice",
      selectedSlot: "topLeft",
      phase: "choosing",
      intentId: 1,
      lastIntent: { type: "choiceSelected", slot: "topLeft" },
    });

    state = fourButtonReducer(state, { type: "press", slot: "bottomRight" });
    expect(state).toMatchObject({
      selectedSlot: "bottomRight",
      phase: "choosing",
      intentId: 2,
      lastIntent: { type: "choiceSelected", slot: "bottomRight" },
    });

    state = fourButtonReducer(state, { type: "press", slot: "bottomRight" });
    expect(state).toMatchObject({
      phase: "complete",
      intentId: 3,
      lastIntent: { type: "choiceConfirmed", slot: "bottomRight" },
    });

    expect(
      fourButtonReducer(state, { type: "press", slot: "bottomRight" }),
    ).toBe(state);
  });

  it("collects three unique sequence choices with select-then-confirm and reviews before submit", () => {
    let state = createFourButtonState("sequence");

    for (const slot of ["topLeft", "topRight", "bottomLeft"] as const) {
      state = fourButtonReducer(state, { type: "press", slot });
      state = fourButtonReducer(state, { type: "press", slot });
    }

    expect(state).toMatchObject({
      kind: "sequence",
      phase: "review",
      confirmedSlots: ["topLeft", "topRight", "bottomLeft"],
      pendingSlot: null,
      lastIntent: {
        type: "sequenceStepConfirmed",
        slot: "bottomLeft",
        step: 3,
      },
    });

    const submitted = fourButtonReducer(state, {
      type: "press",
      slot: "bottomRight",
    });
    expect(submitted).toMatchObject({
      phase: "complete",
      lastIntent: {
        type: "sequenceSubmitted",
        slots: ["topLeft", "topRight", "bottomLeft"],
      },
    });
    expect(
      fourButtonReducer(submitted, { type: "press", slot: "topRight" }),
    ).toBe(submitted);
  });

  it("does not permit a confirmed sequence item to be selected twice", () => {
    let state = createFourButtonState("sequence");
    state = fourButtonReducer(state, { type: "press", slot: "topLeft" });
    state = fourButtonReducer(state, { type: "press", slot: "topLeft" });

    const unchanged = fourButtonReducer(state, { type: "press", slot: "topLeft" });
    expect(unchanged).toBe(state);
  });

  it("resets sequence review from either left button", () => {
    let state = createFourButtonState("sequence");
    for (const slot of ["topLeft", "topRight", "bottomLeft"] as const) {
      state = fourButtonReducer(state, { type: "press", slot });
      state = fourButtonReducer(state, { type: "press", slot });
    }

    state = fourButtonReducer(state, { type: "press", slot: "bottomLeft" });
    expect(state).toMatchObject({
      phase: "collecting",
      confirmedSlots: [],
      pendingSlot: null,
      lastIntent: { type: "sequenceReset" },
    });
  });

  it("maps left/right columns through voice ready, recording, and review", () => {
    let state = createFourButtonState("voice");

    state = fourButtonReducer(state, { type: "press", slot: "topLeft" });
    expect(state).toMatchObject({
      stage: "ready",
      lastIntent: { type: "voiceReplay" },
    });

    state = fourButtonReducer(state, { type: "press", slot: "bottomRight" });
    expect(state).toMatchObject({
      stage: "recording",
      lastIntent: { type: "voiceStarted" },
    });

    state = fourButtonReducer(state, { type: "press", slot: "bottomLeft" });
    expect(state).toMatchObject({
      stage: "ready",
      lastIntent: { type: "voiceCancelled" },
    });

    state = fourButtonReducer(state, { type: "press", slot: "topRight" });
    state = fourButtonReducer(state, { type: "press", slot: "topRight" });
    expect(state).toMatchObject({
      stage: "review",
      lastIntent: { type: "voiceStopped" },
    });

    state = fourButtonReducer(state, { type: "press", slot: "topLeft" });
    expect(state).toMatchObject({
      stage: "recording",
      lastIntent: { type: "voiceRetried" },
    });

    state = fourButtonReducer(state, { type: "press", slot: "bottomRight" });
    state = fourButtonReducer(state, { type: "press", slot: "bottomRight" });
    expect(state).toMatchObject({
      stage: "complete",
      lastIntent: { type: "voiceSubmitted" },
    });
  });

  it("maps feedback left to retry/replay and right to next exactly once", () => {
    let state = createFourButtonState("feedback");

    state = fourButtonReducer(state, { type: "press", slot: "topLeft" });
    expect(state).toMatchObject({
      phase: "waiting",
      lastIntent: { type: "feedbackRetryOrReplay" },
    });

    state = fourButtonReducer(state, { type: "press", slot: "bottomRight" });
    expect(state).toMatchObject({
      phase: "complete",
      lastIntent: { type: "feedbackNext" },
    });
    expect(
      fourButtonReducer(state, { type: "press", slot: "topRight" }),
    ).toBe(state);
  });
});
