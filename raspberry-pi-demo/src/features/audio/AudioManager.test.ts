import {
  AudioManager,
  JAPANESE_DAY1_OVERRIDE_MANIFEST_URL,
  type AudioElementLike,
} from "@/features/audio/AudioManager";
import type { NarrationManifest } from "@/features/audio/narrationManifest";

const manifest: NarrationManifest = {
  schemaVersion: 1,
  sourceSha256: "b".repeat(64),
  model: {
    id: "Qwen/Qwen3-TTS-12Hz-1.7B-CustomVoice",
    revision: "0c0e3051f131929182e2c023b9537f8b1c68adfe",
    license: "Apache-2.0",
    sourceUrl: "https://huggingface.co/Qwen/Qwen3-TTS-12Hz-1.7B-CustomVoice",
  },
  audio: {
    codec: "opus",
    container: "ogg",
    channels: 1,
    loudnessTargetLufs: -16,
    truePeakDbtp: -1,
  },
  entries: [
    {
      id: "guide.choice",
      locale: "ko",
      text: "버튼을 눌러 선택해 주세요.",
      path: "assets/audio/narration/ko/guide__choice.ogg",
      sha256: "a".repeat(64),
    },
  ],
};

class FakeAudio implements AudioElementLike {
  currentTime = 0;
  preload = "none";
  readonly pause = vi.fn();
  readonly play = vi.fn<() => Promise<void>>(async () => undefined);

  constructor(readonly src: string) {}
}

describe("AudioManager", () => {
  it("prefers the selected Fish Audio veteran voice for Japanese Day 1", async () => {
    const overrideManifest = {
      schemaVersion: 1,
      locale: "ja",
      market: "jp",
      day: 1,
      provider: "Fish Audio",
      selectionCount: 1,
      entries: [{
        id: "day.1.greeting",
        text: "春子さん、月曜日の活動を始めましょう。",
        voiceId: "veteran",
        tagStyle: "gentle_double_pause",
        taggedText: "春子さん、[short pause]月曜日の活動を[short pause]始めましょう。",
        runtimePath: "/assets/audio/narration/ja/day1/01_day_1_greeting.mp3",
      }],
    };
    const fetcher = vi.fn(async (url: RequestInfo | URL) => {
      if (url.toString() === JAPANESE_DAY1_OVERRIDE_MANIFEST_URL) {
        return new Response(JSON.stringify(overrideManifest));
      }
      return new Response(JSON.stringify(manifest));
    });
    const created: FakeAudio[] = [];
    const manager = new AudioManager({
      fetcher,
      createAudio: (src) => {
        const audio = new FakeAudio(src);
        created.push(audio);
        return audio;
      },
    });

    expect(await manager.playNarration("day.1.greeting", "ja")).toEqual({ status: "played" });
    expect(created[0]?.src).toBe("/assets/audio/narration/ja/day1/01_day_1_greeting.mp3");
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher).toHaveBeenCalledWith(JAPANESE_DAY1_OVERRIDE_MANIFEST_URL, { cache: "no-store" });
  });

  it("loads the local manifest and plays a local narration entry", async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify(manifest)));
    const created: FakeAudio[] = [];
    const manager = new AudioManager({
      fetcher,
      createAudio: (src) => {
        const audio = new FakeAudio(src);
        created.push(audio);
        return audio;
      },
    });

    expect(await manager.load()).toBe(true);
    expect(await manager.playNarration("guide.choice", "ko")).toEqual({ status: "played" });
    expect(fetcher).toHaveBeenCalledWith("assets/audio/narration/manifest.json", {
      cache: "no-store",
    });
    expect(created[0]?.src).toBe("assets/audio/narration/ko/guide__choice.ogg");
  });

  it("returns missing without speech synthesis or network fallback", async () => {
    const createAudio = vi.fn((src: string) => new FakeAudio(src));
    const manager = new AudioManager({
      fetcher: async () => new Response(JSON.stringify(manifest)),
      createAudio,
    });
    await manager.load();

    expect(await manager.playNarration("unknown", "ko")).toEqual({ status: "missing" });
    expect(createAudio).not.toHaveBeenCalled();
  });

  it("fails closed when the manifest is unavailable or invalid", async () => {
    const unavailable = new AudioManager({
      fetcher: async () => {
        throw new Error("offline file missing");
      },
      createAudio: (src) => new FakeAudio(src),
    });
    expect(await unavailable.load()).toBe(false);
    expect(await unavailable.playNarration("guide.choice", "ko")).toEqual({ status: "unavailable" });

    const remoteManifest = structuredClone(manifest);
    remoteManifest.entries[0].path = "https://example.com/voice.ogg";
    const invalid = new AudioManager({
      fetcher: async () => new Response(JSON.stringify(remoteManifest)),
      createAudio: (src) => new FakeAudio(src),
    });
    expect(await invalid.load()).toBe(false);
  });

  it("keeps UI effects on a separate local channel", async () => {
    const created: FakeAudio[] = [];
    const manager = new AudioManager({
      fetcher: async () => new Response(JSON.stringify(manifest)),
      createAudio: (src) => {
        const audio = new FakeAudio(src);
        created.push(audio);
        return audio;
      },
    });
    await manager.load();

    await manager.playNarration("guide.choice", "ko");
    expect(await manager.playUi("select")).toEqual({ status: "played" });
    expect(created.map((audio) => audio.src)).toEqual([
      "assets/audio/narration/ko/guide__choice.ogg",
      "assets/audio/ui/select.wav",
    ]);
    expect(created[0]?.pause).not.toHaveBeenCalled();
  });

  it("stops prior narration and reports autoplay rejection", async () => {
    const created: FakeAudio[] = [];
    const manager = new AudioManager({
      fetcher: async () => new Response(JSON.stringify(manifest)),
      createAudio: (src) => {
        const audio = new FakeAudio(src);
        if (created.length === 1) {
          audio.play.mockRejectedValueOnce(new DOMException("blocked", "NotAllowedError"));
        }
        created.push(audio);
        return audio;
      },
    });
    await manager.load();
    await manager.playNarration("guide.choice", "ko");

    expect(await manager.playNarration("guide.choice", "ko")).toEqual({ status: "blocked" });
    expect(created[0]?.pause).toHaveBeenCalledOnce();
  });

  it("does not lose the active narration when an older play promise rejects late", async () => {
    const created: FakeAudio[] = [];
    let rejectFirst: ((error: unknown) => void) | undefined;
    const manager = new AudioManager({
      fetcher: async () => new Response(JSON.stringify(manifest)),
      createAudio: (src) => {
        const audio = new FakeAudio(src);
        if (created.length === 0) {
          audio.play.mockImplementationOnce(() => new Promise<void>((_, reject) => {
            rejectFirst = reject;
          }));
        }
        created.push(audio);
        return audio;
      },
    });
    await manager.load();

    const firstPlay = manager.playNarration("guide.choice", "ko");
    await Promise.resolve();
    await manager.playNarration("guide.choice", "ko");
    rejectFirst?.(new DOMException("superseded", "AbortError"));
    await firstPlay;
    manager.stopNarration();

    expect(created[1]?.pause).toHaveBeenCalledOnce();
  });
});
