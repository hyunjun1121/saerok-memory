import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import i18n from "@/i18n";
import {
  HARU_DEMO_PERSONA,
  HARU_WEEK_QUESTION_META,
  haru7DayExercises,
} from "@/data/haru7DayExercises";
import { HaruScenarioQuestion } from "@/features/lessons/exerciseTypes/HaruScenarioQuestion";
import type { ExerciseState } from "@/features/lessons/exerciseTypes/types";
import type { HaruChoiceKeyBindings } from "@/features/lessons/haruInputBindings";
import { getLocalizedText } from "@/utils/localizedText";

const mocks = vi.hoisted(() => ({
  start: vi.fn(),
  stop: vi.fn(),
  stopAndGetBlob: vi.fn(async () => new Blob(["private-audio"])),
  getDurationMs: vi.fn(() => 13_300),
  transcribe: vi.fn(async () => ({
    text: "유성시장에서 가지를 샀어요.",
    noSpeech: false,
    language: "ko",
    durationSec: 13.3,
    confidence: null,
    engine: "qwen3-asr",
    model: "Qwen/Qwen3-ASR-1.7B",
    modelRevision: "a1b2c3d4",
    alignerModel: "Qwen/Qwen3-ForcedAligner-0.6B",
    alignerRevision: "aligner-revision",
    preprocessingVersion: "haru-dc-hp80-rms-v1",
    segments: [{ id: 0, start: 0, end: 13.3, text: "유성시장에서 가지를 샀어요." }],
  })),
  speak: vi.fn(),
}));

vi.mock("@/features/speech/useVoiceRecorder", () => ({
  useVoiceRecorder: () => ({
    isSupported: true,
    isRecording: false,
    isFinalizing: false,
    levels: [],
    durationMs: 13_300,
    audioAssetUrl: "blob:private-audio",
    sampleRateHz: 16_000,
    channelCount: 1,
    error: null,
    start: mocks.start,
    stop: mocks.stop,
    stopAndGetBlob: mocks.stopAndGetBlob,
    getDurationMs: mocks.getDurationMs,
  }),
}));

vi.mock("@/features/speech/stt", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/features/speech/stt")>();
  return { ...actual, transcribeStory: mocks.transcribe };
});

vi.mock("@/hooks/interactionFeedback", async (importOriginal) => {
  const actual = await importOriginal<
    typeof import("@/hooks/interactionFeedback")
  >();
  return { ...actual, speakCalmly: mocks.speak };
});

function getScenario(id: string) {
  const exercise = haru7DayExercises.find((candidate) => candidate.id === id);
  const question = HARU_WEEK_QUESTION_META.find(
    (candidate) => candidate.exerciseId === id,
  );
  if (!exercise || !question) throw new Error(`Missing test scenario ${id}`);
  return { exercise, question };
}

function renderScenario(id: string, choiceKeyBindings?: HaruChoiceKeyBindings) {
  const { exercise, question } = getScenario(id);
  const setGlobalState = vi.fn<(state: ExerciseState) => void>();
  const onResponse = vi.fn();
  const onAdminResponse = vi.fn();

  render(
    <HaruScenarioQuestion
      exercise={exercise}
      question={question}
      globalState="awaiting_answer"
      setGlobalState={setGlobalState}
      onResponse={onResponse}
      onAdminResponse={onAdminResponse}
      choiceKeyBindings={choiceKeyBindings}
    />,
  );

  return { exercise, question, setGlobalState, onResponse, onAdminResponse };
}

function setVoiceConsent(value: boolean) {
  Object.defineProperty(HARU_DEMO_PERSONA.consents, "voiceRecording", {
    configurable: true,
    writable: true,
    value,
  });
}

describe("HaruScenarioQuestion", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    setVoiceConsent(true);
    await i18n.changeLanguage("ko");
  });

  it("renders single-choice answers as four square tiles in authored 2x2 order", () => {
    const { exercise } = renderScenario("D1_Q1");
    const grid = screen.getByTestId("haru-choice-grid");
    const buttons = within(grid).getAllByRole("button");

    expect(grid).toHaveClass("grid", "grid-cols-2");
    expect(buttons).toHaveLength(4);
    expect(buttons.map((button) => button.textContent)).toEqual(
      exercise.payload.options?.map((option) => getLocalizedText(option.label, "ko")),
    );
    buttons.forEach((button) => expect(button).toHaveClass("aspect-square"));
    expect(buttons.map((button) => button.getAttribute("data-choice-tone"))).toEqual([
      "red",
      "yellow",
      "green",
      "blue",
    ]);
    expect(buttons[0]).toHaveClass("border-red-500", "bg-red-50", "text-red-950");
    expect(buttons[1]).toHaveClass(
      "border-yellow-700",
      "bg-yellow-50",
      "text-yellow-950",
    );
    expect(buttons[2]).toHaveClass(
      "border-green-600",
      "bg-green-50",
      "text-green-950",
    );
    expect(buttons[3]).toHaveClass("border-blue-600", "bg-blue-50", "text-blue-950");
  });

  it("renders sequence controls as four square tiles in authored 2x2 order", () => {
    const { exercise } = renderScenario("D4_Q6");
    const grid = screen.getByTestId("haru-choice-grid");
    const buttons = within(grid).getAllByRole("button");

    expect(grid).toHaveClass("grid", "grid-cols-2");
    expect(buttons).toHaveLength(4);
    expect(buttons.map((button) => button.textContent)).toEqual(
      exercise.payload.items?.map((item) => getLocalizedText(item.label, "ko")),
    );
    buttons.forEach((button) => expect(button).toHaveClass("aspect-square"));
    expect(buttons.map((button) => button.getAttribute("data-choice-tone"))).toEqual([
      "red",
      "yellow",
      "green",
      "blue",
    ]);
  });

  it("keeps a single choice selected until Check confirms it", () => {
    const { question, onResponse, setGlobalState } = renderScenario("D1_Q1");
    const selectedOption = getScenario("D1_Q1").exercise.payload.options?.find(
      (option) => option.id === question.recordedResponse.selectedOptionId,
    );

    const selectedButton = screen.getByRole("button", {
      name: getLocalizedText(selectedOption?.label, "ko"),
    });
    const submit = screen.getByRole("button", { name: i18n.t("exercise.check") });

    expect(submit).toBeDisabled();
    expect(screen.getByTestId("haru-choice-confirm")).toHaveClass("relative");
    expect(screen.getByTestId("haru-choice-confirm")).not.toHaveClass("fixed");
    fireEvent.click(selectedButton);

    expect(selectedButton).toHaveAttribute("aria-pressed", "true");
    expect(selectedButton).toHaveClass(
      "border-yellow-800",
      "bg-yellow-200",
      "ring-yellow-300",
      "scale-[1.02]",
    );
    expect(submit).not.toBeDisabled();
    expect(onResponse).not.toHaveBeenCalled();
    expect(setGlobalState).toHaveBeenLastCalledWith("answer_selected");

    fireEvent.click(submit);

    expect(onResponse).toHaveBeenCalledTimes(1);
    expect(onResponse).toHaveBeenCalledWith(
      expect.objectContaining({
        questionId: "D1_Q1",
        responseType: "single_choice",
        selectedOptionId: question.recordedResponse.selectedOptionId,
        isCorrect: null,
        feedback: getLocalizedText(question.recordedResponse.feedback, "ko"),
      }),
    );
    expect(setGlobalState).toHaveBeenLastCalledWith("correct_feedback");
  });

  it("lets the learner change a single choice before confirming", () => {
    const { exercise, onResponse } = renderScenario("D1_Q2");
    const buttons = within(screen.getByTestId("haru-choice-grid")).getAllByRole("button");

    fireEvent.click(buttons[0]);
    fireEvent.click(buttons[2]);

    expect(buttons[0]).toHaveAttribute("aria-pressed", "false");
    expect(buttons[2]).toHaveAttribute("aria-pressed", "true");
    expect(onResponse).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: i18n.t("exercise.check") }));
    expect(onResponse).toHaveBeenCalledWith(
      expect.objectContaining({
        selectedOptionId: exercise.payload.options?.[2].id,
      }),
    );
  });

  it("maps four configurable keys to authored choice order without submitting", () => {
    const bindings: HaruChoiceKeyBindings = [
      { key: "q", code: "KeyQ" },
      { key: "w", code: "KeyW" },
      { key: "e", code: "KeyE" },
      { key: "r", code: "KeyR" },
    ];
    const { exercise, onResponse, onAdminResponse } = renderScenario("D1_Q1", bindings);
    const buttons = within(screen.getByTestId("haru-choice-grid")).getAllByRole("button");

    bindings.forEach((binding, selectedIndex) => {
      fireEvent.keyDown(window, { key: binding.key, code: binding.code });
      buttons.forEach((button, buttonIndex) => {
        expect(button).toHaveAttribute(
          "aria-pressed",
          buttonIndex === selectedIndex ? "true" : "false",
        );
      });
      expect(document.activeElement).toBe(buttons[selectedIndex]);
    });

    expect(buttons.map((button) => button.getAttribute("aria-keyshortcuts"))).toEqual([
      "q",
      "w",
      "e",
      "r",
    ]);
    expect(onResponse).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: i18n.t("exercise.check") }));
    expect(onResponse).toHaveBeenCalledWith(
      expect.objectContaining({
        selectedOptionId: exercise.payload.options?.[3].id,
      }),
    );
    expect(onAdminResponse).toHaveBeenCalledWith(
      expect.objectContaining({
        inputMode: "physical_button",
        buttonPressedAt: expect.any(String),
        respondedAt: expect.any(String),
      }),
    );
  });

  it("ignores repeated, modified, composing, unbound, and editable key events", () => {
    const bindings: HaruChoiceKeyBindings = [
      { key: "q", code: "KeyQ" },
      { key: "w", code: "KeyW" },
      { key: "e", code: "KeyE" },
      { key: "r", code: "KeyR" },
    ];
    const { onResponse } = renderScenario("D1_Q1", bindings);
    const buttons = within(screen.getByTestId("haru-choice-grid")).getAllByRole("button");
    const input = document.createElement("input");
    document.body.append(input);

    fireEvent.keyDown(window, { key: "q", code: "KeyQ", repeat: true });
    fireEvent.keyDown(window, { key: "q", code: "KeyQ", ctrlKey: true });
    fireEvent.keyDown(window, { key: "q", code: "KeyQ", isComposing: true });
    fireEvent.keyDown(window, { key: "x", code: "KeyX" });
    fireEvent.keyDown(input, { key: "q", code: "KeyQ" });

    buttons.forEach((button) => expect(button).toHaveAttribute("aria-pressed", "false"));
    expect(onResponse).not.toHaveBeenCalled();
    input.remove();
  });

  it("keeps the recorded D4_Q6 incorrect feedback and accepts one submission only", () => {
    const { exercise, question, onResponse, setGlobalState } = renderScenario("D4_Q6");

    question.recordedResponse.submittedSequence?.forEach((itemId) => {
      const item = exercise.payload.items?.find((candidate) => candidate.id === itemId);
      fireEvent.click(
        screen.getByRole("button", {
          name: getLocalizedText(item?.label, "ko"),
        }),
      );
    });

    const submit = screen.getByRole("button", { name: i18n.t("exercise.check") });
    fireEvent.click(submit);
    fireEvent.click(submit);

    expect(onResponse).toHaveBeenCalledTimes(1);
    expect(onResponse).toHaveBeenCalledWith(
      expect.objectContaining({
        questionId: "D4_Q6",
        responseType: "button_sequence",
        submittedSequence: [...(question.recordedResponse.submittedSequence ?? [])],
        isCorrect: false,
        feedback: getLocalizedText(question.recordedResponse.feedback, "ko"),
      }),
    );
    expect(setGlobalState).toHaveBeenCalledWith("answer_selected");
    expect(setGlobalState).toHaveBeenLastCalledWith("incorrect_feedback");
  });

  it("does not start or transcribe voice without recording consent", async () => {
    setVoiceConsent(false);
    const { onResponse } = renderScenario("D1_Q5");

    expect(mocks.start).not.toHaveBeenCalled();
    fireEvent.click(
      screen.getByRole("button", { name: i18n.t("exercise.memory.story.finish") }),
    );

    await waitFor(() => expect(onResponse).toHaveBeenCalledTimes(1));
    expect(mocks.stopAndGetBlob).not.toHaveBeenCalled();
    expect(mocks.transcribe).not.toHaveBeenCalled();
    expect(onResponse).toHaveBeenCalledWith(
      expect.objectContaining({
        responseType: "voice",
        isCorrect: null,
        sttStatus: "failed",
        recognitionError: "voice-consent-required",
      }),
    );
    expect(JSON.stringify(onResponse.mock.calls[0][0])).not.toMatch(
      /transcript|audioAssetUrl|blob:private-audio/,
    );
  });

  it("auto-starts consented voice and emits structured facts without transcript or audio URL", async () => {
    const { onResponse, onAdminResponse } = renderScenario("D1_Q5");

    await waitFor(() => expect(mocks.start).toHaveBeenCalledTimes(1));
    fireEvent.click(
      screen.getByRole("button", { name: i18n.t("exercise.memory.story.finish") }),
    );

    await waitFor(() => expect(onResponse).toHaveBeenCalledTimes(1));
    expect(mocks.stopAndGetBlob).toHaveBeenCalledTimes(1);
    expect(mocks.transcribe).toHaveBeenCalledTimes(1);
    expect(onResponse).toHaveBeenCalledWith(
      expect.objectContaining({
        questionId: "D1_Q5",
        responseType: "voice",
        voiceDurationSeconds: 13.3,
        sttStatus: "completed",
        sttLanguage: "ko",
        derivedAnnotations: [
          { entityType: "장소", value: "유성시장" },
          { entityType: "구매물품", value: "가지" },
        ],
        feedback: getLocalizedText(getScenario("D1_Q5").exercise.explanation, "ko"),
      }),
    );

    const serializedResponse = JSON.stringify(onResponse.mock.calls[0][0]);
    expect(serializedResponse).not.toMatch(/transcript|audioAssetUrl|blob:private-audio/);
    expect(serializedResponse).not.toContain("유성시장에서 가지를 샀어요.");
    expect(onAdminResponse).toHaveBeenCalledWith(
      expect.objectContaining({
        rawUserUtteranceTranscript: "유성시장에서 가지를 샀어요.",
        audioBlob: expect.any(Blob),
        recordingStartedAt: expect.any(String),
        recordingEndedAt: expect.any(String),
        sttProcessedAt: expect.any(String),
        sttEngine: "qwen3-asr:Qwen/Qwen3-ASR-1.7B@a1b2c3d4",
        sttModel: "Qwen/Qwen3-ASR-1.7B",
        sttModelRevision: "a1b2c3d4",
        sttAlignerModel: "Qwen/Qwen3-ForcedAligner-0.6B",
        sttAlignerRevision: "aligner-revision",
        sttPreprocessingVersion: "haru-dc-hp80-rms-v1",
        sttSegments: [{ id: 0, start: 0, end: 13.3, text: "유성시장에서 가지를 샀어요." }],
        audioSampleRateHz: 16_000,
        audioChannelCount: 1,
      }),
    );
  });

  it("treats Qwen no-speech as a failed empty response without durable facts", async () => {
    mocks.transcribe.mockResolvedValueOnce({
      text: "그러니까.",
      noSpeech: true,
      language: "ko-KR",
      durationSec: 30,
      confidence: null,
      engine: "qwen3-asr",
      model: "Qwen/Qwen3-ASR-1.7B",
      modelRevision: "revision",
      alignerModel: "Qwen/Qwen3-ForcedAligner-0.6B",
      alignerRevision: "aligner-revision",
      preprocessingVersion: "haru-dc-hp80-rms-v1",
      segments: [{ id: 0, start: 0, end: 0.2, text: "그러니까" }],
    });
    const { onResponse, onAdminResponse } = renderScenario("D1_Q5");

    fireEvent.click(
      screen.getByRole("button", { name: i18n.t("exercise.memory.story.finish") }),
    );

    await waitFor(() => expect(onResponse).toHaveBeenCalledTimes(1));
    expect(onResponse).toHaveBeenCalledWith(
      expect.objectContaining({
        responseType: "voice",
        sttStatus: "failed",
        sttNoSpeech: true,
        recognitionError: "no-speech",
      }),
    );
    expect(onResponse.mock.calls[0][0]).not.toHaveProperty("derivedAnnotations");
    expect(onAdminResponse).toHaveBeenCalledWith(
      expect.objectContaining({
        sttNoSpeech: true,
        sttSegments: [],
        sttModelRevision: "revision",
      }),
    );
    const adminPayload = onAdminResponse.mock.calls[0][0];
    expect(adminPayload).not.toHaveProperty("rawUserUtteranceTranscript");
    expect(JSON.stringify(adminPayload)).not.toContain("그러니까");
  });

  it("keeps personalization provenance out of the learner question", () => {
    const { question } = renderScenario("D2_Q3");
    const sourceNote = getLocalizedText(question.personalizationSourceNote, "ko");

    expect(sourceNote).not.toBe("");
    expect(screen.queryByText(sourceNote)).not.toBeInTheDocument();
  });

  it("renders D5_Q5's authored correct shape as a separate visual reference", () => {
    const { exercise } = renderScenario("D5_Q5");
    const correctOption = exercise.payload.options?.find(
      (option) => option.id === exercise.correctAnswer,
    );
    const correctLabel = getLocalizedText(correctOption?.label, "ko");
    const reference = screen.getByTestId("haru-shape-reference");

    expect(reference).toHaveAttribute("aria-label", correctLabel);
    expect(reference).toHaveTextContent(correctLabel);
    exercise.payload.options?.forEach((option) => {
      expect(
        screen.getByRole("button", {
          name: getLocalizedText(option.label, "ko"),
        }),
      ).toBeInTheDocument();
    });
  });
});
