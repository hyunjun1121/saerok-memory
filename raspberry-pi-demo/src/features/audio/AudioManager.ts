import {
  getNarrationEntry,
  parseNarrationManifest,
  type NarrationLocale,
  type NarrationManifest,
} from "@/features/audio/narrationManifest";

export const NARRATION_MANIFEST_URL = "assets/audio/narration/manifest.json";

export const UI_AUDIO_PATHS = {
  select: "assets/audio/ui/select.wav",
  confirm: "assets/audio/ui/confirm.wav",
  success: "assets/audio/ui/success.wav",
  retry: "assets/audio/ui/retry.wav",
  routineComplete: "assets/audio/ui/routine-complete.wav",
  recordStart: "assets/audio/ui/record-start.wav",
  recordStop: "assets/audio/ui/record-stop.wav",
} as const;

export type UiAudioEffect = keyof typeof UI_AUDIO_PATHS;
export type AudioPlayResult =
  | { status: "played" }
  | { status: "missing" | "unavailable" | "blocked" | "error" };

export interface AudioElementLike {
  currentTime: number;
  preload: string;
  play(): Promise<void>;
  pause(): void;
}

interface AudioManagerOptions {
  fetcher?: typeof fetch;
  createAudio?: (src: string) => AudioElementLike;
  manifestUrl?: string;
}

function defaultCreateAudio(src: string): AudioElementLike {
  return new Audio(src);
}

function playbackFailure(error: unknown): AudioPlayResult {
  if (error instanceof DOMException && error.name === "NotAllowedError") {
    return { status: "blocked" };
  }
  return { status: "error" };
}

export class AudioManager {
  private readonly fetcher: typeof fetch;
  private readonly createAudio: (src: string) => AudioElementLike;
  private readonly manifestUrl: string;
  private manifest: NarrationManifest | null = null;
  private loadPromise: Promise<boolean> | null = null;
  private narration: AudioElementLike | null = null;

  constructor(options: AudioManagerOptions = {}) {
    this.fetcher = options.fetcher ?? globalThis.fetch.bind(globalThis);
    this.createAudio = options.createAudio ?? defaultCreateAudio;
    this.manifestUrl = options.manifestUrl ?? NARRATION_MANIFEST_URL;
  }

  load(): Promise<boolean> {
    if (this.manifest) return Promise.resolve(true);
    if (this.loadPromise) return this.loadPromise;

    this.loadPromise = this.fetcher(this.manifestUrl, { cache: "no-store" })
      .then((response) => {
        if (!response.ok) throw new Error(`narration manifest returned ${response.status}`);
        return response.json() as Promise<unknown>;
      })
      .then((payload) => {
        this.manifest = parseNarrationManifest(payload);
        return true;
      })
      .catch(() => {
        this.manifest = null;
        return false;
      });

    return this.loadPromise;
  }

  async playNarration(id: string, locale: NarrationLocale): Promise<AudioPlayResult> {
    if (!(await this.load()) || !this.manifest) return { status: "unavailable" };
    const entry = getNarrationEntry(this.manifest, id, locale);
    if (!entry) return { status: "missing" };

    this.stopNarration();
    let audio: AudioElementLike | null = null;
    try {
      audio = this.createAudio(entry.path);
      audio.preload = "auto";
      this.narration = audio;
      await audio.play();
      return { status: "played" };
    } catch (error) {
      if (audio && this.narration === audio) this.narration = null;
      return playbackFailure(error);
    }
  }

  async playUi(effect: UiAudioEffect): Promise<AudioPlayResult> {
    try {
      const audio = this.createAudio(UI_AUDIO_PATHS[effect]);
      audio.preload = "auto";
      await audio.play();
      return { status: "played" };
    } catch (error) {
      return playbackFailure(error);
    }
  }

  stopNarration(): void {
    if (!this.narration) return;
    this.narration.pause();
    this.narration.currentTime = 0;
    this.narration = null;
  }
}

export const audioManager = new AudioManager();
