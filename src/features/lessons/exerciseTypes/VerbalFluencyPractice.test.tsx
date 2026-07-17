import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import "@/i18n";
import { HARU_DEMO_PERSONA } from "@/data/haru7DayExercises";
import {
  clearCognitiveRoutineResults,
  getCognitiveRoutineResults,
} from "@/features/cognitive/cognitiveRoutineStorage";
import { VerbalFluencyPractice } from "@/features/lessons/exerciseTypes/VerbalFluencyPractice";
import { updateHaruConsent } from "@/features/profile/haruConsentStorage";

const mocks = vi.hoisted(() => ({
  enqueue: vi.fn(async () => "job-fluency" as string | null),
  transcribe: vi.fn(),
  recorder: {
    isSupported: false,
    isRecording: false,
    isFinalizing: false,
    levels: [] as number[],
    durationMs: 0,
    audioAssetUrl: null as string | null,
    error: null as string | null,
    start: vi.fn(),
    stop: vi.fn(),
    getDurationMs: vi.fn(() => 0),
    stopAndGetBlob: vi.fn<() => Promise<Blob | null>>(() => Promise.resolve(null)),
  },
}));

vi.mock("@/features/speech/useVoiceRecorder", () => ({
  useVoiceRecorder: () => mocks.recorder,
}));

vi.mock("@/features/speech/stt", () => ({
  transcribeStory: mocks.transcribe,
  formatSttEngine: (result: { modelRevision: string }) =>
    `qwen3-asr:Qwen/Qwen3-ASR-1.7B@${result.modelRevision}`,
}));
vi.mock("@/features/speech/sttJobQueue", () => ({
  enqueueSttJob: mocks.enqueue,
}));

function setConsent(key: "voiceRecording" | "sttProcessing", value: boolean): void {
  Object.defineProperty(HARU_DEMO_PERSONA.consents, key, {
    configurable: true,
    writable: true,
    value,
  });
}

describe("VerbalFluencyPractice", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    clearCognitiveRoutineResults();
    mocks.transcribe.mockReset();
    mocks.enqueue.mockResolvedValue("job-fluency");
    mocks.recorder.isSupported = false;
    mocks.recorder.getDurationMs.mockReturnValue(0);
    mocks.recorder.stopAndGetBlob.mockResolvedValue(null);
    setConsent("voiceRecording", true);
    setConsent("sttProcessing", true);
    Object.defineProperty(HARU_DEMO_PERSONA.consents, "longitudinalUsageStorage", {
      configurable: true,
      writable: true,
      value: true,
    });
    mocks.recorder.isRecording = false;
  });

  it("records a voice-only routine on finish (no text input)", async () => {
    const setGlobalState = vi.fn();
    const onComplete = vi.fn();

    render(
      <VerbalFluencyPractice
        prompt="동물 이름을 말해보세요"
        category="동물"
        durationSeconds={30}
        onComplete={onComplete}
        setGlobalState={setGlobalState}
        globalState="awaiting_answer"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "저장하고 다음으로" }));

    await waitFor(() => expect(getCognitiveRoutineResults()).toHaveLength(1));
    const results = getCognitiveRoutineResults();
    expect(results).toHaveLength(1);
    expect(results[0].type).toBe("verbal_fluency_practice");
    expect(results[0].completed).toBe(true);
    expect(results[0].metadata).toEqual(
      expect.objectContaining({
        category: "동물",
        durationSeconds: 30,
        inputMode: "skipped",
      }),
    );
    expect(setGlobalState).toHaveBeenCalledWith("correct_feedback");
    expect(onComplete).toHaveBeenCalled();
  });

  it("queues Qwen work after persisting a pending routine record", async () => {
    mocks.recorder.isSupported = true;
    mocks.recorder.getDurationMs.mockReturnValue(4500);
    mocks.recorder.stopAndGetBlob.mockResolvedValue(
      new Blob(["voice"], { type: "audio/webm" }),
    );
    mocks.transcribe.mockResolvedValue({
      text: "사과 배 사과 감",
      noSpeech: false,
      language: "ko-KR",
      durationSec: 4.5,
      confidence: null,
      engine: "qwen3-asr",
      model: "Qwen/Qwen3-ASR-1.7B",
      modelRevision: "revision",
      alignerModel: "Qwen/Qwen3-ForcedAligner-0.6B",
      alignerRevision: "aligner-revision",
      preprocessingVersion: "haru-dc-hp80-rms-v1",
      segments: [],
    });

    render(
      <VerbalFluencyPractice
        prompt="과일 이름을 말해보세요"
        category="과일"
        durationSeconds={30}
        onComplete={vi.fn()}
        setGlobalState={vi.fn()}
        globalState="awaiting_answer"
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "저장하고 다음으로" }));

    await waitFor(() => expect(getCognitiveRoutineResults()).toHaveLength(1));
    expect(mocks.transcribe).not.toHaveBeenCalled();
    const routine = getCognitiveRoutineResults()[0];
    expect(mocks.enqueue).toHaveBeenCalledWith(
      expect.any(Blob),
      { kind: "verbal-fluency", routineResultId: routine.id },
    );
    expect(routine.metadata).toEqual(
      expect.objectContaining({
        transcript: "",
        entries: [],
        uniqueCount: 0,
        repetitionCount: 0,
        sttStatus: "pending",
        recognitionError: "stt-pending",
      }),
    );
  });

  it("marks the pending record failed when durable queueing fails", async () => {
    mocks.recorder.isSupported = true;
    mocks.recorder.stopAndGetBlob.mockResolvedValue(
      new Blob(["silence"], { type: "audio/webm" }),
    );
    mocks.transcribe.mockResolvedValue({
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
    mocks.enqueue.mockResolvedValue(null);
    render(
      <VerbalFluencyPractice
        prompt="과일 이름을 말해보세요"
        category="과일"
        durationSeconds={30}
        onComplete={vi.fn()}
        setGlobalState={vi.fn()}
        globalState="awaiting_answer"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "저장하고 다음으로" }));
    await waitFor(() => expect(getCognitiveRoutineResults()).toHaveLength(1));

    const metadata = getCognitiveRoutineResults()[0].metadata;
    expect(metadata).toEqual(
      expect.objectContaining({
        transcript: "",
        entries: [],
        uniqueCount: 0,
        sttStatus: "failed",
        sttNoSpeech: false,
        recognitionError: "stt-queue-failed",
        sttSegments: [],
      }),
    );
    expect(JSON.stringify(metadata)).not.toContain("그러니까");
  });

  it.each(["voiceRecording", "sttProcessing"] as const)(
    "blocks mic and Qwen when %s consent is absent",
    async (key) => {
      setConsent(key, false);
      mocks.recorder.isSupported = true;
      render(
        <VerbalFluencyPractice
          prompt="과일 이름을 말해보세요"
          category="과일"
          durationSeconds={30}
          onComplete={vi.fn()}
          setGlobalState={vi.fn()}
          globalState="awaiting_answer"
        />,
      );

      expect(
        screen.getByText("음성 기록과 글 변환에 동의한 뒤 이용할 수 있어요."),
      ).toBeInTheDocument();
      fireEvent.click(screen.getByRole("button", { name: "저장하고 다음으로" }));
      await waitFor(() => expect(getCognitiveRoutineResults()).toHaveLength(1));

      expect(mocks.recorder.start).not.toHaveBeenCalled();
      expect(mocks.recorder.stopAndGetBlob).not.toHaveBeenCalled();
      expect(mocks.transcribe).not.toHaveBeenCalled();
      expect(getCognitiveRoutineResults()[0].metadata?.transcript).toBe("");
    },
  );

  it("shows the topic and speech panel without a text box", () => {
    render(
      <VerbalFluencyPractice
        prompt="동물 이름을 말해보세요"
        category="동물"
        durationSeconds={30}
        onComplete={vi.fn()}
        setGlobalState={vi.fn()}
        globalState="awaiting_answer"
      />,
    );

    // The prompt (topic) renders; the category chip was removed for a cleaner
    // voice-only screen.
    expect(screen.getByText("동물 이름을 말해보세요")).toBeInTheDocument();
    // Voice-only: no typed word input.
    expect(screen.queryByLabelText("떠오른 단어")).not.toBeInTheDocument();
  });

  it("stops active capture and persists no audio after live consent withdrawal", async () => {
    mocks.recorder.isSupported = true;
    mocks.recorder.isRecording = true;
    render(
      <VerbalFluencyPractice
        prompt="과일 이름을 말해보세요"
        category="과일"
        durationSeconds={30}
        onComplete={vi.fn()}
        setGlobalState={vi.fn()}
        globalState="awaiting_answer"
      />,
    );

    act(() => {
      updateHaruConsent({ sttProcessing: false });
    });

    await waitFor(() => expect(mocks.recorder.stop).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByRole("button", { name: "저장하고 다음으로" }));
    await waitFor(() => expect(getCognitiveRoutineResults()).toHaveLength(1));

    expect(mocks.recorder.stopAndGetBlob).not.toHaveBeenCalled();
    expect(mocks.enqueue).not.toHaveBeenCalled();
    expect(getCognitiveRoutineResults()[0].metadata).toEqual(
      expect.objectContaining({
        inputMode: "skipped",
        audioAssetUrl: null,
        speechDurationMs: 0,
        sttStatus: "failed",
      }),
    );
  });

  it("permanently discards a capture revoked during finalization after quick re-consent", async () => {
    let resolveBlob!: (blob: Blob | null) => void;
    mocks.recorder.isSupported = true;
    mocks.recorder.isRecording = true;
    mocks.recorder.audioAssetUrl = "blob:revoked-fluency";
    mocks.recorder.getDurationMs.mockReturnValue(4_500);
    mocks.recorder.stopAndGetBlob.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveBlob = resolve;
      }),
    );

    render(
      <VerbalFluencyPractice
        prompt="과일 이름을 말해보세요"
        category="과일"
        durationSeconds={30}
        onComplete={vi.fn()}
        setGlobalState={vi.fn()}
        globalState="awaiting_answer"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "저장하고 다음으로" }));
    await waitFor(() => expect(mocks.recorder.stopAndGetBlob).toHaveBeenCalledTimes(1));

    act(() => {
      updateHaruConsent({ sttProcessing: false });
    });
    await waitFor(() => expect(mocks.recorder.stop).toHaveBeenCalledTimes(1));

    mocks.recorder.isRecording = false;
    act(() => {
      updateHaruConsent({ sttProcessing: true });
    });
    fireEvent.click(screen.getByRole("button", { name: "말하기 시작" }));
    expect(mocks.recorder.start).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveBlob(new Blob(["revoked-fluency"], { type: "audio/webm" }));
    });

    await waitFor(() => expect(getCognitiveRoutineResults()).toHaveLength(1));
    expect(getCognitiveRoutineResults()[0].metadata).toEqual(
      expect.objectContaining({
        inputMode: "skipped",
        audioAssetUrl: null,
        speechDurationMs: 0,
        sttStatus: "failed",
      }),
    );
    expect(mocks.enqueue).not.toHaveBeenCalled();
  });
});
