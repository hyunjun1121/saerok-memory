import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type AudioEventName = "ended" | "error";
type AudioListener = () => void;

class FakeAudio {
  static instances: FakeAudio[] = [];
  static playResult: "resolve" | "reject" | "throw" = "resolve";

  readonly src: string;
  preload = "";
  volume = 1;
  currentTime = 0;
  pause = vi.fn();
  play = vi.fn(() => {
    if (FakeAudio.playResult === "throw") {
      throw new Error("play failed");
    }
    return FakeAudio.playResult === "reject"
      ? Promise.reject(new Error("play rejected"))
      : Promise.resolve();
  });

  private readonly listeners = new Map<AudioEventName, Set<AudioListener>>();

  constructor(src: string) {
    this.src = src;
    FakeAudio.instances.push(this);
  }

  addEventListener(name: AudioEventName, listener: AudioListener): void {
    const listeners = this.listeners.get(name) ?? new Set<AudioListener>();
    listeners.add(listener);
    this.listeners.set(name, listeners);
  }

  removeEventListener(name: AudioEventName, listener: AudioListener): void {
    this.listeners.get(name)?.delete(listener);
  }

  emit(name: AudioEventName): void {
    this.listeners.get(name)?.forEach((listener) => listener());
  }
}

async function loadFeedbackModule() {
  vi.resetModules();
  return import("@/hooks/interactionFeedback");
}

describe("interaction sound assets", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    FakeAudio.instances = [];
    FakeAudio.playResult = "resolve";
    vi.stubGlobal("Audio", FakeAudio);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it.each([
    ["select", "/assets/audio/ui/select.wav", 0.18],
    ["confirm", "/assets/audio/ui/confirm.wav", 0.18],
    ["success", "/assets/audio/ui/success.wav", 0.22],
    ["retry", "/assets/audio/ui/retry.wav", 0.12],
    ["routineComplete", "/assets/audio/ui/routine-complete.wav", 0.24],
    ["recordStart", "/assets/audio/ui/record-start.wav", 0.16],
    ["recordStop", "/assets/audio/ui/record-stop.wav", 0.16],
  ] as const)("maps %s to its licensed asset", async (cue, src, volume) => {
    const { playInteractionCue } = await loadFeedbackModule();

    const playback = playInteractionCue(cue);
    const audio = FakeAudio.instances.at(-1);

    expect(audio).toBeDefined();
    expect(audio?.src).toBe(src);
    expect(audio?.preload).toBe("auto");
    expect(audio?.volume).toBe(volume);
    expect(audio?.play).toHaveBeenCalledTimes(1);

    audio?.emit("ended");
    await expect(playback).resolves.toBeUndefined();
  });

  it("keeps one active channel and resolves interrupted playback", async () => {
    const { playInteractionCue } = await loadFeedbackModule();
    const firstPlayback = playInteractionCue("success");
    const firstAudio = FakeAudio.instances.at(-1);

    const secondPlayback = playInteractionCue("retry");
    const secondAudio = FakeAudio.instances.at(-1);

    await expect(firstPlayback).resolves.toBeUndefined();
    expect(firstAudio?.pause).toHaveBeenCalledTimes(1);
    expect(firstAudio?.currentTime).toBe(0);

    secondAudio?.emit("ended");
    await expect(secondPlayback).resolves.toBeUndefined();
  });

  it("reuses cue audio while restarting it from the beginning", async () => {
    const { playInteractionCue } = await loadFeedbackModule();
    const firstPlayback = playInteractionCue("select");
    const audio = FakeAudio.instances.at(-1);

    const secondPlayback = playInteractionCue("select");

    await expect(firstPlayback).resolves.toBeUndefined();
    expect(FakeAudio.instances).toHaveLength(1);
    expect(audio?.pause).toHaveBeenCalledTimes(1);
    expect(audio?.play).toHaveBeenCalledTimes(2);
    expect(audio?.currentTime).toBe(0);

    audio?.emit("ended");
    await expect(secondPlayback).resolves.toBeUndefined();
  });

  it.each(["reject", "throw"] as const)(
    "treats a %s from Audio.play as an optional-audio no-op",
    async (playResult) => {
      FakeAudio.playResult = playResult;
      const { playInteractionCue } = await loadFeedbackModule();

      await expect(playInteractionCue("confirm")).resolves.toBeUndefined();
    },
  );

  it("is a safe no-op when the Audio constructor is unavailable", async () => {
    vi.stubGlobal("Audio", undefined);
    const { playInteractionCue } = await loadFeedbackModule();

    await expect(playInteractionCue("success")).resolves.toBeUndefined();
  });

  it("settles record-start playback within 350ms even without media events", async () => {
    const { playInteractionCue } = await loadFeedbackModule();
    let settled = false;

    const playback = playInteractionCue("recordStart").then(() => {
      settled = true;
    });
    const audio = FakeAudio.instances.at(-1);
    if (audio) {
      audio.currentTime = 0.25;
    }
    await vi.advanceTimersByTimeAsync(349);

    expect(settled).toBe(true);
    expect(audio?.pause).toHaveBeenCalledTimes(1);
    expect(audio?.currentTime).toBe(0);
    await playback;
  });

  it("stops and settles active playback explicitly", async () => {
    const { playInteractionCue, stopInteractionCue } = await loadFeedbackModule();
    const playback = playInteractionCue("routineComplete");
    const audio = FakeAudio.instances.at(-1);

    stopInteractionCue();

    await expect(playback).resolves.toBeUndefined();
    expect(audio?.pause).toHaveBeenCalledTimes(1);
    expect(audio?.currentTime).toBe(0);
  });
});
