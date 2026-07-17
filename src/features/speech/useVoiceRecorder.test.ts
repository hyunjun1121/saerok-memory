import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useVoiceRecorder } from "@/features/speech/useVoiceRecorder";

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
  let trackStop: ReturnType<typeof vi.fn>;
  let getUserMedia: ReturnType<typeof vi.fn>;
  let stream: MediaStream;

  beforeEach(() => {
    vi.useFakeTimers();
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
  });

  it("awaits the final blob when the timer stops just before Finish", async () => {
    const { result } = renderHook(() => useVoiceRecorder(5_000));

    await act(async () => {
      result.current.start();
      await Promise.resolve();
      await Promise.resolve();
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

    act(() => {
      result.current.start();
      result.current.start();
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
      await Promise.resolve();
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

    act(() => {
      result.current.start();
    });
    unmount();

    resolveUserMedia?.(stream);
    await pendingUserMedia;
    await Promise.resolve();

    expect(trackStop).toHaveBeenCalledTimes(1);
    expect(FakeMediaRecorder.instances).toHaveLength(0);
  });
});
