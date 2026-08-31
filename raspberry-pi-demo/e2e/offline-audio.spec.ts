import { expect, test, type Page, type Request, type Response } from "@playwright/test";

import { isAppAudioAsset, isAppHttpRequest } from "./appOrigin";

const KEY_BY_SLOT = {
  topLeft: "1",
  topRight: "2",
  bottomLeft: "3",
  bottomRight: "4",
} as const;

const OFFLINE_PROGRESS_KEY = "haru:offline:progress:v1";
const NARRATION_MANIFEST_PATH = "assets/audio/narration/manifest.json";
const DEBOUNCE_SETTLE_MS = 230;
const EXPECTED_LANGUAGE = process.env.EXPECTED_LANGUAGE === "ja" ? "ja" : "ko";

const UI_AUDIO_PATHS = {
  select: "assets/audio/ui/select.wav",
  confirm: "assets/audio/ui/confirm.wav",
  success: "assets/audio/ui/success.wav",
  retry: "assets/audio/ui/retry.wav",
  recordStart: "assets/audio/ui/record-start.wav",
  recordStop: "assets/audio/ui/record-stop.wav",
} as const;

type PhysicalSlot = keyof typeof KEY_BY_SLOT;

interface AudioProbeState {
  failPlayback: boolean;
  plays: string[];
  pauses: string[];
}

interface AudioResponseRecord {
  url: string;
  status: number;
}

interface NarrationManifestEntry {
  id: string;
  locale: "ko" | "ja";
  path: string;
}

interface NarrationManifestPayload {
  entries: NarrationManifestEntry[];
}

async function pressPhysicalButton(page: Page, slot: PhysicalSlot): Promise<void> {
  await page.keyboard.press(KEY_BY_SLOT[slot]);
  await page.waitForTimeout(DEBOUNCE_SETTLE_MS);
}

async function pressNfcCard(page: Page): Promise<void> {
  await page.keyboard.press("5");
  await page.waitForTimeout(DEBOUNCE_SETTLE_MS);
}

async function selectAndConfirm(page: Page, slot: PhysicalSlot): Promise<void> {
  await pressPhysicalButton(page, slot);
  await pressPhysicalButton(page, slot);
}

async function installAudioProbe(page: Page, failPlayback = false): Promise<void> {
  await page.addInitScript((shouldFail) => {
    const probeWindow = window as typeof window & {
      __haruAudioProbe: AudioProbeState;
      __setHaruAudioFailure: (enabled: boolean) => void;
    };
    const nativePlay = HTMLMediaElement.prototype.play;
    const nativePause = HTMLMediaElement.prototype.pause;
    let requestSequence = 0;

    probeWindow.__haruAudioProbe = {
      failPlayback: shouldFail,
      plays: [],
      pauses: [],
    };
    probeWindow.__setHaruAudioFailure = (enabled: boolean) => {
      probeWindow.__haruAudioProbe.failPlayback = enabled;
    };

    Object.defineProperty(HTMLMediaElement.prototype, "play", {
      configurable: true,
      writable: true,
      value: async function playWithProbe(this: HTMLMediaElement): Promise<void> {
        const source = this.currentSrc || this.src;
        probeWindow.__haruAudioProbe.plays.push(source);
        if (probeWindow.__haruAudioProbe.failPlayback) {
          throw new DOMException("Forced offline audio failure", "NotAllowedError");
        }

        // Keep native playback in the path, while a cache-busted same-origin fetch
        // makes the HTTP status deterministic in headless Chromium.
        const nativePlayback = Reflect.apply(nativePlay, this, [])
          .catch(() => undefined);
        const probeUrl = new URL(source);
        probeUrl.searchParams.set("__haru_audio_probe", String(requestSequence));
        requestSequence += 1;
        const response = await fetch(probeUrl, { cache: "no-store" });
        await response.arrayBuffer();
        await nativePlayback;
        if (!response.ok) throw new Error(`Audio returned ${response.status}: ${source}`);
      },
    });

    Object.defineProperty(HTMLMediaElement.prototype, "pause", {
      configurable: true,
      writable: true,
      value: function pauseWithProbe(this: HTMLMediaElement): void {
        probeWindow.__haruAudioProbe.pauses.push(this.currentSrc || this.src);
        Reflect.apply(nativePause, this, []);
      },
    });
  }, failPlayback);
}

function watchNetwork(page: Page): {
  audioResponses: AudioResponseRecord[];
  externalRequests: string[];
} {
  const audioResponses: AudioResponseRecord[] = [];
  const externalRequests: string[] = [];

  page.on("request", (request: Request) => {
    const url = new URL(request.url());
    if (url.protocol !== "http:" && url.protocol !== "https:") return;
    if (isAppHttpRequest(request.url())) return;
    externalRequests.push(request.url());
  });
  page.on("response", (response: Response) => {
    const url = new URL(response.url());
    if (!/\.(?:ogg|mp3|wav)$/i.test(url.pathname)) return;
    audioResponses.push({ url: response.url(), status: response.status() });
  });

  return { audioResponses, externalRequests };
}

async function openDayOne(page: Page): Promise<void> {
  await page.goto("/#/lesson?day=1");
  await expect(page.locator('[data-screen="nfc-login"]')).toBeVisible();
  await pressNfcCard(page);
  await expect(page.locator('[data-screen="lesson-start"]')).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("lang", EXPECTED_LANGUAGE);
}

async function getAudioProbe(page: Page): Promise<AudioProbeState> {
  return page.evaluate(() => {
    const probeWindow = window as typeof window & { __haruAudioProbe: AudioProbeState };
    return {
      failPlayback: probeWindow.__haruAudioProbe.failPlayback,
      plays: [...probeWindow.__haruAudioProbe.plays],
      pauses: [...probeWindow.__haruAudioProbe.pauses],
    };
  });
}

async function getNarrationPaths(
  page: Page,
  ids: readonly string[],
): Promise<Record<string, string>> {
  return page.evaluate(async ({ locale, narrationIds, manifestPath, japaneseManifestPath }) => {
    const response = await fetch(manifestPath, { cache: "no-store" });
    if (!response.ok) throw new Error(`Narration manifest returned ${response.status}`);
    const manifest = await response.json() as NarrationManifestPayload;
    const japaneseOverrides = locale === "ja"
      ? await fetch(japaneseManifestPath, { cache: "no-store" }).then(async (overrideResponse) => {
        if (!overrideResponse.ok) throw new Error(`Japanese narration manifest returned ${overrideResponse.status}`);
        return await overrideResponse.json() as {
          entries: Array<{ id: string; runtimePath: string }>;
        };
      })
      : null;
    const paths: Record<string, string> = {};
    for (const id of narrationIds) {
      const override = japaneseOverrides?.entries.find((candidate) => candidate.id === id);
      const entry = manifest.entries.find((candidate) => candidate.id === id && candidate.locale === locale);
      if (!entry && !override) throw new Error(`Narration entry missing: ${locale}/${id}`);
      paths[id] = override?.runtimePath ?? entry?.path ?? "";
    }
    return paths;
  }, {
    locale: EXPECTED_LANGUAGE,
    narrationIds: ids,
    manifestPath: NARRATION_MANIFEST_PATH,
    japaneseManifestPath: "assets/audio/narration/ja/day1/manifest.json",
  });
}

function absoluteAssetUrl(page: Page, path: string): string {
  return new URL(path, page.url()).href;
}

async function expectPlayedWithHttp200(
  page: Page,
  paths: readonly string[],
  audioResponses: readonly AudioResponseRecord[],
): Promise<void> {
  const expectedUrls = paths.map((path) => absoluteAssetUrl(page, path));
  await expect.poll(async () => {
    const { plays } = await getAudioProbe(page);
    return expectedUrls.every((url) => plays.includes(url));
  }).toBe(true);
  await expect.poll(() => expectedUrls.every((expectedUrl) => {
    const expectedPath = new URL(expectedUrl).pathname;
    return audioResponses.some((response) => (
      new URL(response.url).pathname === expectedPath && response.status === 200
    ));
  })).toBe(true);
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript((storageKey) => localStorage.removeItem(storageKey), OFFLINE_PROGRESS_KEY);
});

test("plays representative narration and UI cues from local HTTP 200 assets", async ({ page }) => {
  await installAudioProbe(page);
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: {
        getUserMedia: () => Promise.reject(new DOMException("Microphone unavailable", "NotAllowedError")),
      },
    });
  });
  const { audioResponses, externalRequests } = watchNetwork(page);
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));

  await openDayOne(page);
  const narrationPaths = await getNarrationPaths(page, [
    "day.1.greeting",
    "exercise.D1_Q1.prompt",
    "exercise.D1_Q1.option.A",
    "feedback.saved",
    "exercise.D1_Q5.prompt",
    "guide.voice_review",
    "exercise.D1_Q6.sequence",
  ]);
  await expectPlayedWithHttp200(page, [narrationPaths["day.1.greeting"]], audioResponses);
  const greetingUrl = absoluteAssetUrl(page, narrationPaths["day.1.greeting"]);
  await expect.poll(async () => {
    const { plays } = await getAudioProbe(page);
    return plays.filter((path) => path === greetingUrl).length;
  }).toBe(1);

  await pressPhysicalButton(page, "topRight");
  await expect(page.locator('[data-screen="lesson-question"][data-exercise-id="D1_Q1"]')).toBeVisible();
  await selectAndConfirm(page, "topLeft");
  await expect(page.locator('[data-screen="lesson-feedback"]')).toBeVisible();

  await pressPhysicalButton(page, "topLeft");
  await expect(page.locator('[data-screen="lesson-question"][data-exercise-id="D1_Q1"]')).toBeVisible();
  await selectAndConfirm(page, "topLeft");
  await expect(page.locator('[data-screen="lesson-feedback"]')).toBeVisible();
  await pressPhysicalButton(page, "topRight");

  for (const [exerciseId, slot] of [
    ["D1_Q2", "topLeft"],
    ["D1_Q3", "topLeft"],
    ["D1_Q4", "bottomLeft"],
  ] as const) {
    await expect(page.locator(`[data-screen="lesson-question"][data-exercise-id="${exerciseId}"]`)).toBeVisible();
    await selectAndConfirm(page, slot);
    await expect(page.locator('[data-screen="lesson-feedback"]')).toBeVisible();
    await pressPhysicalButton(page, "topRight");
  }

  const voiceQuestion = page.locator(
    '[data-screen="lesson-question"][data-exercise-id="D1_Q5"][data-question-kind="voice"]',
  );
  await expect(voiceQuestion).toBeVisible();
  await pressPhysicalButton(page, "topRight");
  await expect(voiceQuestion.locator('[data-voice-stage="recording"]')).toBeVisible();
  await pressPhysicalButton(page, "topRight");
  await expect(voiceQuestion.locator('[data-voice-stage="review"]')).toBeVisible();
  await pressPhysicalButton(page, "topRight");
  await expect(page.locator('[data-screen="lesson-feedback"]')).toBeVisible();
  await pressPhysicalButton(page, "topRight");

  await expect(page.locator(
    '[data-screen="lesson-question"][data-exercise-id="D1_Q6"][data-question-kind="button_sequence"]',
  )).toBeVisible();

  const expectedPaths = [
    narrationPaths["day.1.greeting"],
    narrationPaths["exercise.D1_Q1.prompt"],
    narrationPaths["exercise.D1_Q1.option.A"],
    narrationPaths["feedback.saved"],
    narrationPaths["exercise.D1_Q5.prompt"],
    narrationPaths["guide.voice_review"],
    narrationPaths["exercise.D1_Q6.sequence"],
    ...Object.values(UI_AUDIO_PATHS),
  ];
  await expectPlayedWithHttp200(page, expectedPaths, audioResponses);

  const probe = await getAudioProbe(page);
  expect(probe.plays.length).toBeGreaterThanOrEqual(expectedPaths.length);
  expect(probe.plays.every(isAppAudioAsset)).toBe(true);
  expect(probe.pauses.length).toBeGreaterThan(0);
  expect(pageErrors).toEqual([]);
  expect(externalRequests).toEqual([]);
});

test("keeps four-key progress available when every audio play rejects", async ({ page }) => {
  await installAudioProbe(page, true);
  const { externalRequests } = watchNetwork(page);
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));

  await openDayOne(page);
  await expect(page.locator(".audio-warning")).toBeVisible();
  await pressPhysicalButton(page, "topRight");

  const firstQuestion = page.locator('[data-screen="lesson-question"][data-exercise-id="D1_Q1"]');
  await expect(firstQuestion).toBeVisible();
  await pressPhysicalButton(page, "topLeft");
  await expect(firstQuestion.locator('[data-slot="topLeft"]')).toHaveAttribute("aria-pressed", "true");
  await pressPhysicalButton(page, "topLeft");
  await expect(page.locator('[data-screen="lesson-feedback"]')).toBeVisible();
  await pressPhysicalButton(page, "topRight");
  await expect(page.locator('[data-screen="lesson-question"][data-exercise-id="D1_Q2"]')).toBeVisible();

  const probe = await getAudioProbe(page);
  expect(probe.failPlayback).toBe(true);
  expect(probe.plays.length).toBeGreaterThanOrEqual(6);
  expect(probe.plays.every(isAppAudioAsset)).toBe(true);
  expect(pageErrors).toEqual([]);
  expect(externalRequests).toEqual([]);
});
