import { getButtonColumn, type ButtonSlot } from "@/features/input/keyConfig";

export type FourButtonMode = "choice" | "sequence" | "voice" | "feedback";

export type FourButtonIntent =
  | { readonly type: "choiceSelected"; readonly slot: ButtonSlot }
  | { readonly type: "choiceConfirmed"; readonly slot: ButtonSlot }
  | { readonly type: "sequenceSelected"; readonly slot: ButtonSlot; readonly step: number }
  | {
      readonly type: "sequenceStepConfirmed";
      readonly slot: ButtonSlot;
      readonly step: number;
    }
  | { readonly type: "sequenceReset" }
  | { readonly type: "sequenceSubmitted"; readonly slots: readonly ButtonSlot[] }
  | { readonly type: "voiceReplay" }
  | { readonly type: "voiceStarted" }
  | { readonly type: "voiceCancelled" }
  | { readonly type: "voiceStopped" }
  | { readonly type: "voiceRetried" }
  | { readonly type: "voiceSubmitted" }
  | { readonly type: "feedbackRetryOrReplay" }
  | { readonly type: "feedbackNext" };

interface MachineStateBase {
  readonly intentId: number;
  readonly lastIntent: FourButtonIntent | null;
}

export interface ChoiceButtonState extends MachineStateBase {
  readonly kind: "choice";
  readonly phase: "choosing" | "complete";
  readonly selectedSlot: ButtonSlot | null;
}

export interface SequenceButtonState extends MachineStateBase {
  readonly kind: "sequence";
  readonly phase: "collecting" | "review" | "complete";
  readonly confirmedSlots: readonly ButtonSlot[];
  readonly pendingSlot: ButtonSlot | null;
}

export interface VoiceButtonState extends MachineStateBase {
  readonly kind: "voice";
  readonly stage: "ready" | "recording" | "review" | "complete";
}

export interface FeedbackButtonState extends MachineStateBase {
  readonly kind: "feedback";
  readonly phase: "waiting" | "complete";
}

export type FourButtonState =
  | ChoiceButtonState
  | SequenceButtonState
  | VoiceButtonState
  | FeedbackButtonState;

export type FourButtonAction =
  | { readonly type: "press"; readonly slot: ButtonSlot }
  | { readonly type: "reset"; readonly mode: FourButtonMode };

export function createFourButtonState(mode: "choice"): ChoiceButtonState;
export function createFourButtonState(mode: "sequence"): SequenceButtonState;
export function createFourButtonState(mode: "voice"): VoiceButtonState;
export function createFourButtonState(mode: "feedback"): FeedbackButtonState;
export function createFourButtonState(mode: FourButtonMode): FourButtonState;
export function createFourButtonState(mode: FourButtonMode): FourButtonState {
  switch (mode) {
    case "choice":
      return {
        kind: "choice",
        phase: "choosing",
        selectedSlot: null,
        intentId: 0,
        lastIntent: null,
      };
    case "sequence":
      return {
        kind: "sequence",
        phase: "collecting",
        confirmedSlots: [],
        pendingSlot: null,
        intentId: 0,
        lastIntent: null,
      };
    case "voice":
      return {
        kind: "voice",
        stage: "ready",
        intentId: 0,
        lastIntent: null,
      };
    case "feedback":
      return {
        kind: "feedback",
        phase: "waiting",
        intentId: 0,
        lastIntent: null,
      };
  }
}

function withIntent<TState extends FourButtonState>(
  state: TState,
  intent: FourButtonIntent,
  changes?: Partial<TState>,
): TState {
  return {
    ...state,
    ...(changes ?? {}),
    intentId: state.intentId + 1,
    lastIntent: intent,
  } as TState;
}

function reduceChoice(state: ChoiceButtonState, slot: ButtonSlot): ChoiceButtonState {
  if (state.phase === "complete") return state;

  if (state.selectedSlot === slot) {
    return withIntent(state, { type: "choiceConfirmed", slot }, { phase: "complete" });
  }

  return withIntent(
    state,
    { type: "choiceSelected", slot },
    { selectedSlot: slot },
  );
}

function reduceSequence(
  state: SequenceButtonState,
  slot: ButtonSlot,
): SequenceButtonState {
  if (state.phase === "complete") return state;

  if (state.phase === "review") {
    if (getButtonColumn(slot) === "left") {
      return withIntent(
        state,
        { type: "sequenceReset" },
        { phase: "collecting", confirmedSlots: [], pendingSlot: null },
      );
    }

    return withIntent(
      state,
      { type: "sequenceSubmitted", slots: [...state.confirmedSlots] },
      { phase: "complete" },
    );
  }

  if (state.confirmedSlots.includes(slot)) return state;

  const step = state.confirmedSlots.length + 1;
  if (state.pendingSlot !== slot) {
    return withIntent(
      state,
      { type: "sequenceSelected", slot, step },
      { pendingSlot: slot },
    );
  }

  const confirmedSlots = [...state.confirmedSlots, slot];
  return withIntent(
    state,
    { type: "sequenceStepConfirmed", slot, step },
    {
      confirmedSlots,
      pendingSlot: null,
      phase: confirmedSlots.length === 3 ? "review" : "collecting",
    },
  );
}

function reduceVoice(state: VoiceButtonState, slot: ButtonSlot): VoiceButtonState {
  if (state.stage === "complete") return state;
  const column = getButtonColumn(slot);

  switch (state.stage) {
    case "ready":
      return column === "left"
        ? withIntent(state, { type: "voiceReplay" })
        : withIntent(state, { type: "voiceStarted" }, { stage: "recording" });
    case "recording":
      return column === "left"
        ? withIntent(state, { type: "voiceCancelled" }, { stage: "ready" })
        : withIntent(state, { type: "voiceStopped" }, { stage: "review" });
    case "review":
      return column === "left"
        ? withIntent(state, { type: "voiceRetried" }, { stage: "recording" })
        : withIntent(state, { type: "voiceSubmitted" }, { stage: "complete" });
  }
}

function reduceFeedback(
  state: FeedbackButtonState,
  slot: ButtonSlot,
): FeedbackButtonState {
  if (state.phase === "complete") return state;

  return getButtonColumn(slot) === "left"
    ? withIntent(state, { type: "feedbackRetryOrReplay" })
    : withIntent(state, { type: "feedbackNext" }, { phase: "complete" });
}

type PressAction = Extract<FourButtonAction, { type: "press" }>;

export function fourButtonReducer(
  state: ChoiceButtonState,
  action: PressAction,
): ChoiceButtonState;
export function fourButtonReducer(
  state: SequenceButtonState,
  action: PressAction,
): SequenceButtonState;
export function fourButtonReducer(
  state: VoiceButtonState,
  action: PressAction,
): VoiceButtonState;
export function fourButtonReducer(
  state: FeedbackButtonState,
  action: PressAction,
): FeedbackButtonState;
export function fourButtonReducer(
  state: FourButtonState,
  action: FourButtonAction,
): FourButtonState;
export function fourButtonReducer(
  state: FourButtonState,
  action: FourButtonAction,
): FourButtonState {
  if (action.type === "reset") return createFourButtonState(action.mode);

  switch (state.kind) {
    case "choice":
      return reduceChoice(state, action.slot);
    case "sequence":
      return reduceSequence(state, action.slot);
    case "voice":
      return reduceVoice(state, action.slot);
    case "feedback":
      return reduceFeedback(state, action.slot);
  }
}
