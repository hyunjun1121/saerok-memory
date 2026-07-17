import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "@/i18n";
import { HARU_DEMO_PERSONA } from "@/data/haru7DayExercises";
import type { ExerciseState } from "@/features/lessons/exerciseTypes/types";

// Fake recorder that hands back a real audio Blob so the STT upload path runs
// end-to-end. (jsdom has no MediaRecorder, so the real hook yields no blob.)
const recorderMocks = vi.hoisted(() => ({
  start: vi.fn(),
  stop: vi.fn(),
  getDurationMs: vi.fn(() => 1500),
  stopAndGetBlob: vi.fn(async () => new Blob([new Uint8Array([1, 2, 3])])),
}));

vi.mock("@/features/speech/useVoiceRecorder", () => ({
  useVoiceRecorder: () => ({
    isSupported: true,
    isRecording: false,
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
    localStorage.clear();
    setConsent("voiceRecording", true);
    setConsent("sttProcessing", true);
  });

  afterEach(() => vi.unstubAllGlobals());

  it("posts the recording to /api/stt and stores transcript + cues", async () => {
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

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(String(url)).toContain("/api/stt");
    expect(init?.method).toBe("POST");
    expect(init?.body).toBeInstanceOf(FormData);

    const saved = JSON.parse(localStorage.getItem("memoryCards") || "[]");
    expect(saved).toHaveLength(1);
    expect(saved[0].originalTranscript).toBe("오늘 딸이랑 공원에서 산책했어요.");
    expect(saved[0].textSummary).toBe("오늘 딸이랑 공원에서 산책했어요.");
    expect(saved[0].storyCues).toBeDefined();
    expect(saved[0].storyCues.places).toContain("공원");
    expect(saved[0].storyCues.people).toContain("딸");
    expect(saved[0].recognitionError).toBeNull();
    expect(saved[0]).toEqual(
      expect.objectContaining({
        sttNoSpeech: false,
        sttModel: "Qwen/Qwen3-ASR-1.7B",
        sttModelRevision: "revision",
        sttAlignerRevision: "aligner-revision",
        sttPreprocessingVersion: "haru-dc-hp80-rms-v1",
        sttSegments: [
          { id: 0, start: 0, end: 3, text: "오늘 딸이랑 공원에서 산책했어요." },
        ],
      }),
    );

    vi.unstubAllGlobals();
  });

  it("still saves the card (empty transcript, error) when STT is unreachable", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("down"); }));

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
    expect(saved[0].recognitionError).toBe("transcribe-failed");

    vi.unstubAllGlobals();
  });

  it("stores no transcript or cues when Qwen reports no speech", async () => {
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
        recognitionError: "no-speech",
        sttStatus: "failed",
        sttNoSpeech: true,
        sttSegments: [],
      }),
    );
    expect(saved[0].storyCues).toBeUndefined();
    expect(JSON.stringify(saved[0])).not.toContain("그러니까");
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
