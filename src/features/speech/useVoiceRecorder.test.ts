import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useVoiceRecorder } from "@/features/speech/useVoiceRecorder";

const feedbackMocks = vi.hoisted(() => ({
  playInteractionCue: vi.fn(
    async (cue: string): Promise<void> => {
      void cue;
    },
  ),
  speakCalmly: vi.fn(),
  vibrateLightly: vi.fn(),
}));

const analyticsMocks = vi.hoisted(() => ({
  captureHaruTelemetry: vi.fn(async () => true),
}));

vi.mock("@/hooks/interactionFeedback", () => feedbackMocks);
vi.mock("@/features/analytics/client", () => analyticsMocks);

async function flushMicrotasks(count = 8): Promise<void> {
  for (let index = 0; index < count; index += 1) {
    await Promise.resolve();
  }
}

class FakeAudioContext {
  state = "running";
  sampleRate = 48_000;

  createMediaStreamSource() {
    return { connect: vi.fn() };
  }

  createAnalyser() {
    return {
      fftSize: 64,
      frequencyBinCount: 32,
      getByteFrequencyData: vi.fn(),
    };
  }

  close() {
    return Promise.resolve();
  }
}

class FakeMediaRecorder {
  static instances: FakeMediaRecorder[] = [];

  state: RecordingState = "inactive";
  mimeType = "audio/webm";
  ondataavailable: ((event: BlobEvent) => void) | null = null;
  onstop: (() => void) | null = null;

  constructor(_stream: MediaStream) {
    void _stream;
    FakeMediaRecorder.instances.push(this);
  }

  start() {
    this.state = "recording";
  }

  stop() {
    this.state = "inactive";
    window.setTimeout(() => {
      this.ondataavailable?.({ data: new Blob(["voice"]) } as BlobEvent);
      this.onstop?.();
    }, 20);
  }
}

describe("useVoiceRecorder", () => {
  const originalMediaDevices = Object.getOwnPropertyDescriptor(navigator, "mediaDevices");
  const originalCreateObjectURL = Object.getOwnPropertyDescriptor(URL, "createObjectURL");
  const originalRevokeObjectURL = Object.getOwnPropertyDescriptor(URL, "revokeObjectURL");
  let trackStop: ReturnType<typeof vi.fn>;
  let getUserMedia: ReturnType<typeof vi.fn>;
  let stream: MediaStream;

  beforeEach(() => {
    vi.useFakeTimers();
    localStorage.clear();
    feedbackMocks.playInteractionCue.mockReset();
    feedbackMocks.playInteractionCue.mockResolvedValue(undefined);
    feedbackMocks.speakCalmly.mockClear();
    feedbackMocks.vibrateLightly.mockClear();
    analyticsMocks.captureHaruTelemetry.mockClear();
    FakeMediaRecorder.instances = [];
    trackStop = vi.fn();
    const track = {
      stop: trackStop,
      getSettings: () => ({ sampleRate: 16_000, channelCount: 1 }),
    };
    stream = {
      getTracks: () => [track],
      getAudioTracks: () => [track],
    } as unknown as MediaStream;

    getUserMedia = vi.fn().mockResolvedValue(stream);
    Object.defineProperty(navigator, "mediaDevices", {
      value: { getUserMedia },
      configurable: true,
    });
    Object.defineProperty(URL, "createObjectURL", {
      value: vi.fn(() => "blob:voice"),
      configurable: true,
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      value: vi.fn(),
      configurable: true,
    });
    vi.stubGlobal("AudioContext", FakeAudioContext);
    vi.stubGlobal("MediaRecorder", FakeMediaRecorder);
    vi.stubGlobal("requestAnimationFrame", vi.fn(() => 1));
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    if (originalMediaDevices) {
      Object.defineProperty(navigator, "mediaDevices", originalMediaDevices);
    } else {
      Reflect.deleteProperty(navigator, "mediaDevices");
    }
    if (originalCreateObjectURL) {
      Object.defineProperty(URL, "createObjectURL", originalCreateObjectURL);
    } else {
      Reflect.deleteProperty(URL, "createObjectURL");
    }
    if (originalRevokeObjectURL) {
      Object.defineProperty(URL, "revokeObjectURL", originalRevokeObjectURL);
    } else {
      Reflect.deleteProperty(URL, "revokeObjectURL");
    }
  });

  it("awaits the final blob when the timer stops just before Finish", async () => {
    const { result } = renderHook(() => useVoiceRecorder(5_000));

    await act(async () => {
      result.current.start();
      await flushMicrotasks();
    });
    expect(result.current.isRecording).toBe(true);
    expect(getUserMedia).toHaveBeenCalledWith({
      audio: {
        echoCancellation: true,
        autoGainControl: false,
        noiseSuppression: false,
      },
    });

    act(() => {
      vi.advanceTimersByTime(5_000);
    });
    expect(result.current.isRecording).toBe(false);
    expect(result.current.isFinalizing).toBe(true);

    let blobPromise!: Promise<Blob | null>;
    act(() => {
      blobPromise = result.current.stopAndGetBlob();
    });
    let resolved = false;
    void blobPromise.then(() => {
      resolved = true;
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(19);
    });
    expect(resolved).toBe(false);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });
    const blob = await blobPromise;

    expect(blob).not.toBeNull();
    expect(blob?.size).toBeGreaterThan(0);
    expect(result.current.isFinalizing).toBe(false);
    expect(result.current.audioAssetUrl).toBe("blob:voice");
    expect(result.current.sampleRateHz).toBe(16_000);
    expect(result.current.channelCount).toBe(1);
    expect(result.current.getDurationMs()).toBe(5_000);
    expect(
      feedbackMocks.playInteractionCue.mock.calls.filter(
        ([cue]) => cue === "recordStop",
      ),
    ).toHaveLength(1);
  });

  it("waits for record-start feedback and collapses repeated start requests", async () => {
    let releaseStartCue: (() => void) | undefined;
    feedbackMocks.playInteractionCue.mockImplementation(
      (cue) =>
        cue === "recordStart"
          ? new Promise<void>((resolve) => {
              releaseStartCue = resolve;
            })
          : Promise.resolve(),
    );
    const { result } = renderHook(() => useVoiceRecorder(5_000));

    await act(async () => {
      result.current.start();
      result.current.start();
      await flushMicrotasks();
    });

    expect(feedbackMocks.playInteractionCue).toHaveBeenCalledTimes(1);
    expect(feedbackMocks.playInteractionCue).toHaveBeenCalledWith("recordStart");
    expect(getUserMedia).not.toHaveBeenCalled();
    expect(result.current.isRecording).toBe(false);

    await act(async () => {
      releaseStartCue?.();
      await flushMicrotasks();
    });

    expect(getUserMedia).toHaveBeenCalledTimes(1);
    expect(FakeMediaRecorder.instances).toHaveLength(1);
    expect(result.current.isRecording).toBe(true);
  });

  it("continues recording when optional start feedback rejects", async () => {
    feedbackMocks.playInteractionCue.mockRejectedValueOnce(
      new Error("audio unavailable"),
    );
    const { result } = renderHook(() => useVoiceRecorder(5_000));

    await act(async () => {
      result.current.start();
      await flushMicrotasks();
    });

    expect(getUserMedia).toHaveBeenCalledTimes(1);
    expect(result.current.isRecording).toBe(true);
  });

  it("plays record-stop only after requesting a real recorder stop", async () => {
    const { result } = renderHook(() => useVoiceRecorder(5_000));
    await act(async () => {
      result.current.start();
      await flushMicrotasks();
    });
    const recorder = FakeMediaRecorder.instances[0];
    const stopSpy = vi.spyOn(recorder, "stop");
    feedbackMocks.playInteractionCue.mockClear();

    act(() => {
      result.current.stop();
    });

    expect(stopSpy).toHaveBeenCalledTimes(1);
    expect(feedbackMocks.playInteractionCue).toHaveBeenCalledTimes(1);
    expect(feedbackMocks.playInteractionCue).toHaveBeenCalledWith("recordStop");
    expect(stopSpy.mock.invocationCallOrder[0]).toBeLessThan(
      feedbackMocks.playInteractionCue.mock.invocationCallOrder[0],
    );

    act(() => {
      result.current.stop();
    });
    expect(feedbackMocks.playInteractionCue).toHaveBeenCalledTimes(1);
  });

  it("cancels a start still waiting on feedback when unmounted", async () => {
    let releaseStartCue: (() => void) | undefined;
    feedbackMocks.playInteractionCue.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          releaseStartCue = resolve;
        }),
    );
    const { result, unmount } = renderHook(() => useVoiceRecorder(5_000));

    await act(async () => {
      result.current.start();
      await flushMicrotasks();
    });
    unmount();

    releaseStartCue?.();
    await flushMicrotasks();

    expect(getUserMedia).not.toHaveBeenCalled();
    expect(FakeMediaRecorder.instances).toHaveLength(0);
  });

  it("cancels a pending microphone start when Finish is pressed", async () => {
    let resolveUserMedia: ((value: MediaStream) => void) | undefined;
    const pendingUserMedia = new Promise<MediaStream>((resolve) => {
      resolveUserMedia = resolve;
    });
    getUserMedia = vi.fn(() => pendingUserMedia);
    Object.defineProperty(navigator, "mediaDevices", {
      value: { getUserMedia },
      configurable: true,
    });
    const { result } = renderHook(() => useVoiceRecorder(5_000));

    await act(async () => {
      result.current.start();
      result.current.start();
      await flushMicrotasks();
    });
    expect(getUserMedia).toHaveBeenCalledTimes(1);

    let blobPromise!: Promise<Blob | null>;
    act(() => {
      blobPromise = result.current.stopAndGetBlob();
    });
    await expect(blobPromise).resolves.toBeNull();

    await act(async () => {
      resolveUserMedia?.(stream);
      await pendingUserMedia;
      await flushMicrotasks();
    });

    expect(trackStop).toHaveBeenCalledTimes(1);
    expect(FakeMediaRecorder.instances).toHaveLength(0);
    expect(result.current.isRecording).toBe(false);
  });

  it("closes a microphone stream that arrives after unmount", async () => {
    let resolveUserMedia: ((value: MediaStream) => void) | undefined;
    const pendingUserMedia = new Promise<MediaStream>((resolve) => {
      resolveUserMedia = resolve;
    });
    Object.defineProperty(navigator, "mediaDevices", {
      value: { getUserMedia: vi.fn(() => pendingUserMedia) },
      configurable: true,
    });
    const { result, unmount } = renderHook(() => useVoiceRecorder(5_000));

    await act(async () => {
      result.current.start();
      await flushMicrotasks();
    });
    unmount();

    resolveUserMedia?.(stream);
    await pendingUserMedia;
    await flushMicrotasks();

    expect(trackStop).toHaveBeenCalledTimes(1);
    expect(FakeMediaRecorder.instances).toHaveLength(0);
  });

  it("records without AudioContext when MediaRecorder is available", async () => {
    vi.stubGlobal("AudioContext", undefined);
    const { result } = renderHook(() => useVoiceRecorder(5_000));

    expect(result.current.isSupported).toBe(true);

    await act(async () => {
      result.current.start();
      await flushMicrotasks();
    });

    expect(result.current.isRecording).toBe(true);
    expect(result.current.levels).toEqual([]);

    let artifactPromise!: ReturnType<typeof result.current.stopAndFinalize>;
    act(() => {
      artifactPromise = result.current.stopAndFinalize();
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(20);
    });

    const artifact = await artifactPromise;
    expect(artifact).toMatchObject({
      mimeType: "audio/webm",
      durationMs: 0,
      sampleRateHz: 16_000,
      channelCount: 1,
      previewUrl: "blob:voice",
    });
    expect(artifact?.blob).toBeInstanceOf(Blob);
  });

  it("revokes preview object URLs when replaced and on unmount", async () => {
    const createObjectURL = vi
      .fn()
      .mockReturnValueOnce("blob:first")
      .mockReturnValueOnce("blob:second");
    Object.defineProperty(URL, "createObjectURL", {
      value: createObjectURL,
      configurable: true,
    });
    const revokeObjectURL = vi.fn();
    Object.defineProperty(URL, "revokeObjectURL", {
      value: revokeObjectURL,
      configurable: true,
    });
    const { result, unmount } = renderHook(() => useVoiceRecorder(5_000));

    await act(async () => {
      result.current.start();
      await flushMicrotasks();
    });
    act(() => result.current.stop());
    await act(async () => {
      await vi.advanceTimersByTimeAsync(20);
    });
    expect(result.current.audioAssetUrl).toBe("blob:first");

    await act(async () => {
      result.current.start();
      await flushMicrotasks();
    });
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:first");

    act(() => result.current.stop());
    await act(async () => {
      await vi.advanceTimersByTimeAsync(20);
    });
    expect(result.current.audioAssetUrl).toBe("blob:second");

    unmount();
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:second");
  });

  it("emits assisted reactive-waveform metadata when capture starts", async () => {
    const { result } = renderHook(() => useVoiceRecorder(5_000));

    await act(async () => {
      result.current.start();
      await flushMicrotasks();
    });

    expect(analyticsMocks.captureHaruTelemetry).toHaveBeenCalledWith(
      "voice_capture_status",
      expect.objectContaining({
        phase: "started",
        voiceExperienceVariant: "assist_v2",
        waveformMode: "reactive_red",
        guidanceCopyVersion: "voice-guidance-2026-08-v2",
        sttPipelineVersion: "haru-qwen3-asr-v2",
      }),
    );
  });

  it("emits only coded unsupported outcome metadata when capture is unavailable", () => {
    vi.stubGlobal("MediaRecorder", undefined);
    const { result } = renderHook(() => useVoiceRecorder(5_000));

    act(() => result.current.start());

    expect(analyticsMocks.captureHaruTelemetry).toHaveBeenCalledWith(
      "voice_capture_status",
      expect.objectContaining({
        phase: "failed",
        permission: "unavailable",
        voiceExperienceVariant: "assist_v2",
        waveformMode: "reactive_red",
        outcomeReason: "unsupported",
      }),
    );
    expect(JSON.stringify(analyticsMocks.captureHaruTelemetry.mock.calls)).not.toContain(
      "transcript",
    );
    expect(JSON.stringify(analyticsMocks.captureHaruTelemetry.mock.calls)).not.toContain(
      "audioBlob",
    );
  });
});
