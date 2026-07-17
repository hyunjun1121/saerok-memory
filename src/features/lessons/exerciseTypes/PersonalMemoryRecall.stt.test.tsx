import { act, render, screen, fireEvent, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "@/i18n";
import { HARU_DEMO_PERSONA } from "@/data/haru7DayExercises";
import type { ExerciseState } from "@/features/lessons/exerciseTypes/types";
import { updateHaruConsent } from "@/features/profile/haruConsentStorage";

// Fake recorder that hands back a real audio Blob so the STT upload path runs
// end-to-end. (jsdom has no MediaRecorder, so the real hook yields no blob.)
const recorderMocks = vi.hoisted(() => ({
  isRecording: false,
  start: vi.fn(),
  stop: vi.fn(),
  getDurationMs: vi.fn(() => 1500),
  stopAndGetBlob: vi.fn(async () => new Blob([new Uint8Array([1, 2, 3])])),
}));
const queueMocks = vi.hoisted(() => ({
  enqueue: vi.fn(async () => "job-memory" as string | null),
}));

vi.mock("@/features/speech/useVoiceRecorder", () => ({
  useVoiceRecorder: () => ({
    isSupported: true,
    isRecording: recorderMocks.isRecording,
    isFinalizing: false,
    levels: [],
    durationMs: 1500,
    audioAssetUrl: "blob:fake",
    sampleRateHz: 16_000,
    channelCount: 1,
    error: null,
    start: recorderMocks.start,
    stop: recorderMocks.stop,
    getDurationMs: recorderMocks.getDurationMs,
    stopAndGetBlob: recorderMocks.stopAndGetBlob,
  }),
}));
vi.mock("@/features/speech/sttJobQueue", () => ({
  enqueueSttJob: queueMocks.enqueue,
}));

import { PersonalMemoryRecall } from "@/features/lessons/exerciseTypes/PersonalMemoryRecall";

function setConsent(key: "voiceRecording" | "sttProcessing", value: boolean): void {
  Object.defineProperty(HARU_DEMO_PERSONA.consents, key, {
    configurable: true,
    writable: true,
    value,
  });
}

describe("PersonalMemoryRecall STT wiring", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    queueMocks.enqueue.mockResolvedValue("job-memory");
    localStorage.clear();
    setConsent("voiceRecording", true);
    setConsent("sttProcessing", true);
    recorderMocks.isRecording = false;
  });

  afterEach(() => vi.unstubAllGlobals());

  it("queues the recording locally and advances without a foreground STT request", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        text: "오늘 딸이랑 공원에서 산책했어요.",
        noSpeech: false,
        language: "ko",
        durationSec: 3.0,
        confidence: null,
        engine: "qwen3-asr",
        model: "Qwen/Qwen3-ASR-1.7B",
        modelRevision: "revision",
        alignerModel: "Qwen/Qwen3-ForcedAligner-0.6B",
        alignerRevision: "aligner-revision",
        preprocessingVersion: "haru-dc-hp80-rms-v1",
        segments: [{ id: 0, start: 0, end: 3, text: "오늘 딸이랑 공원에서 산책했어요." }],
      }),
    }));
    vi.stubGlobal("fetch", fetchMock);

    const setGlobalState = vi.fn();
    render(
      <PersonalMemoryRecall
        prompt="오늘 있었던 일을 말해주세요"
        options={[]}
        linkedConceptId="daily_memory_stt"
        memoryField="story"
        onComplete={vi.fn()}
        setGlobalState={setGlobalState}
        globalState={"awaiting_answer" as ExerciseState}
      />,
    );

    fireEvent.click(screen.getByText("마치기"));

    await waitFor(() =>
      expect(setGlobalState).toHaveBeenCalledWith("correct_feedback"),
    );

    expect(fetchMock).not.toHaveBeenCalled();
    expect(queueMocks.enqueue).toHaveBeenCalledWith(
      expect.any(Blob),
      { kind: "memory-story", memoryCardId: expect.any(String) },
    );

    const saved = JSON.parse(localStorage.getItem("memoryCards") || "[]");
    expect(saved).toHaveLength(1);
    expect(saved[0].originalTranscript).toBe("");
    expect(saved[0].textSummary).toBe("");
    expect(saved[0].storyCues).toBeUndefined();
    expect(saved[0].recognitionError).toBe("stt-pending");
    expect(saved[0]).toEqual(
      expect.objectContaining({
        sttNoSpeech: false,
        sttStatus: "pending",
        sttSegments: [],
      }),
    );

    vi.unstubAllGlobals();
  });

  it("stops active capture and stores no audio when longitudinal consent is withdrawn", async () => {
    recorderMocks.isRecording = true;
    const setGlobalState = vi.fn();
    render(
      <PersonalMemoryRecall
        prompt="오늘 있었던 일을 말해주세요"
        options={[]}
        linkedConceptId="live-withdrawal"
        memoryField="story"
        onComplete={vi.fn()}
        setGlobalState={setGlobalState}
        globalState="awaiting_answer"
      />,
    );

    act(() => {
      updateHaruConsent({ longitudinalUsageStorage: false });
    });

    await waitFor(() => expect(recorderMocks.stop).toHaveBeenCalledTimes(1));
    expect(
      screen.getByText("음성 기록과 글 변환에 동의한 뒤 이용할 수 있어요."),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByText("마치기"));
    await waitFor(() => expect(setGlobalState).toHaveBeenCalledWith("correct_feedback"));

    expect(recorderMocks.stopAndGetBlob).not.toHaveBeenCalled();
    expect(queueMocks.enqueue).not.toHaveBeenCalled();
    const saved = JSON.parse(localStorage.getItem("memoryCards") || "[]");
    expect(saved).toEqual([]);
  });

  it("still saves the card (empty transcript, error) when STT is unreachable", async () => {
    queueMocks.enqueue.mockResolvedValue(null);

    const setGlobalState = vi.fn();
    render(
      <PersonalMemoryRecall
        prompt="오늘 있었던 일을 말해주세요"
        options={[]}
        linkedConceptId="daily_memory_stt2"
        memoryField="story"
        onComplete={vi.fn()}
        setGlobalState={setGlobalState}
        globalState={"awaiting_answer" as ExerciseState}
      />,
    );

    fireEvent.click(screen.getByText("마치기"));

    await waitFor(() =>
      expect(setGlobalState).toHaveBeenCalledWith("correct_feedback"),
    );

    const saved = JSON.parse(localStorage.getItem("memoryCards") || "[]");
    expect(saved).toHaveLength(1);
    expect(saved[0].originalTranscript).toBe("");
    expect(saved[0].recognitionError).toBe("stt-queue-failed");

    vi.unstubAllGlobals();
  });

  it("stores no invented transcript or cues before background Qwen completes", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => ({
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
        }),
      })),
    );
    const setGlobalState = vi.fn();
    render(
      <PersonalMemoryRecall
        prompt="오늘 있었던 일을 말해주세요"
        options={[]}
        linkedConceptId="daily_memory_no_speech"
        memoryField="story"
        onComplete={vi.fn()}
        setGlobalState={setGlobalState}
        globalState="awaiting_answer"
      />,
    );

    fireEvent.click(screen.getByText("마치기"));
    await waitFor(() => expect(setGlobalState).toHaveBeenCalledWith("correct_feedback"));

    const saved = JSON.parse(localStorage.getItem("memoryCards") || "[]");
    expect(saved[0]).toEqual(
      expect.objectContaining({
        originalTranscript: "",
        textSummary: "",
        recognitionError: "stt-pending",
        sttStatus: "pending",
        sttNoSpeech: false,
        sttSegments: [],
      }),
    );
    expect(saved[0].storyCues).toBeUndefined();
    expect(JSON.stringify(saved[0])).not.toContain("그러니까");
    expect(queueMocks.enqueue).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["voiceRecording", "voice-consent-required"],
    ["sttProcessing", "stt-consent-required"],
  ] as const)("blocks mic and upload when %s consent is absent", async (key, expectedError) => {
    setConsent(key, false);
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const setGlobalState = vi.fn();
    render(
      <PersonalMemoryRecall
        prompt="오늘 있었던 일을 말해주세요"
        options={[]}
        linkedConceptId={`consent_${key}`}
        memoryField="story"
        onComplete={vi.fn()}
        setGlobalState={setGlobalState}
        globalState="awaiting_answer"
      />,
    );

    expect(recorderMocks.start).not.toHaveBeenCalled();
    expect(screen.getByText("음성 기록과 글 변환에 동의한 뒤 이용할 수 있어요.")).toBeInTheDocument();
    fireEvent.click(screen.getByText("마치기"));
    await waitFor(() => expect(setGlobalState).toHaveBeenCalledWith("correct_feedback"));

    expect(recorderMocks.stopAndGetBlob).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
    const saved = JSON.parse(localStorage.getItem("memoryCards") || "[]");
    expect(saved[0]).toEqual(
      expect.objectContaining({
        originalTranscript: "",
        recognitionError: expectedError,
        sttStatus: "failed",
      }),
    );
  });
});
