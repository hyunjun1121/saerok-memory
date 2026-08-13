import { readFileSync } from "node:fs";

import { expect, test, type Page, type Request, type Response } from "@playwright/test";

import { isAppHttpRequest } from "./appOrigin";

const KEY_BY_SLOT = {
  topLeft: "1",
  topRight: "2",
  bottomLeft: "3",
  bottomRight: "4",
} as const;

const OFFLINE_PROGRESS_KEY = "haru:offline:progress:v1";
const DEBOUNCE_SETTLE_MS = 230;

type PhysicalSlot = keyof typeof KEY_BY_SLOT;

interface AuditEntry {
  id: string;
  path: string;
  previousPath: string;
}

interface Day1Audit {
  choice: "right";
  entryCount: 31;
  entries: AuditEntry[];
}

interface AudioProbeState {
  plays: string[];
}

interface AudioResponseRecord {
  url: string;
  status: number;
}

const audit = JSON.parse(readFileSync(
  new URL("../tools/fish-day1-browser/day1-runtime-import.json", import.meta.url),
  "utf8",
)) as Day1Audit;
const calmAudit = JSON.parse(readFileSync(
  new URL(
    "../tools/fish-day1-browser/calm-mood-candidates/calm-mood-runtime-import.json",
    import.meta.url,
  ),
  "utf8",
)) as { entryCount: 4; entries: AuditEntry[] };
const calmById = new Map(calmAudit.entries.map((entry) => [entry.id, entry]));
const expectedEntries = audit.entries.map((entry) => calmById.get(entry.id) ?? entry);

async function pressPhysicalButton(page: Page, slot: PhysicalSlot): Promise<void> {
  await page.keyboard.press(KEY_BY_SLOT[slot]);
  await page.waitForTimeout(DEBOUNCE_SETTLE_MS);
}

async function selectOptionsThenConfirm(
  page: Page,
  slots: readonly PhysicalSlot[],
  confirmedSlot: PhysicalSlot,
): Promise<void> {
  for (const slot of slots) await pressPhysicalButton(page, slot);
  await pressPhysicalButton(page, confirmedSlot);
}

async function installAudioProbe(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const probeWindow = window as typeof window & { __haruDay1AudioProbe: AudioProbeState };
    const nativePlay = HTMLMediaElement.prototype.play;
    let requestSequence = 0;

    probeWindow.__haruDay1AudioProbe = { plays: [] };
    Object.defineProperty(HTMLMediaElement.prototype, "play", {
      configurable: true,
      writable: true,
      value: async function playWithProbe(this: HTMLMediaElement): Promise<void> {
        const source = this.currentSrc || this.src;
        probeWindow.__haruDay1AudioProbe.plays.push(source);

        const nativePlayback = Reflect.apply(nativePlay, this, [])
          .catch(() => undefined);
        const probeUrl = new URL(source);
        probeUrl.searchParams.set("__haru_day1_b_runtime_probe", String(requestSequence));
        requestSequence += 1;
        const response = await fetch(probeUrl, { cache: "no-store" });
        await response.arrayBuffer();
        await nativePlayback;
        if (!response.ok) throw new Error(`Audio returned ${response.status}: ${source}`);
      },
    });
  });
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
    if (!url.pathname.endsWith(".ogg")) return;
    audioResponses.push({ url: response.url(), status: response.status() });
  });

  return { audioResponses, externalRequests };
}

function absoluteAssetUrl(page: Page, path: string): string {
  return new URL(path, page.url()).href;
}

async function readPlayedNarrationUrls(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const probeWindow = window as typeof window & { __haruDay1AudioProbe: AudioProbeState };
    return probeWindow.__haruDay1AudioProbe.plays.filter((url) => new URL(url).pathname.endsWith(".ogg"));
  });
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript((storageKey) => localStorage.removeItem(storageKey), OFFLINE_PROGRESS_KEY);
});

test("routes the final 27 B plus 4 calm narrations through real four-key UI playback", async ({ page }) => {
  expect(audit.choice).toBe("right");
  expect(audit.entryCount).toBe(31);
  expect(expectedEntries).toHaveLength(31);

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

  await page.goto("/#/lesson?day=1&restart=1");
  await expect(page.locator('[data-screen="lesson-start"]')).toBeVisible();

  const manifestPaths = await page.evaluate(async (expectedEntries) => {
    const response = await fetch("assets/audio/narration/manifest.json", { cache: "no-store" });
    if (!response.ok) throw new Error(`Narration manifest returned ${response.status}`);
    const manifest = await response.json() as {
      entries: Array<{ id: string; locale: string; path: string }>;
    };
    return expectedEntries.map(({ id }) => ({
      id,
      path: manifest.entries.find((entry) => entry.locale === "ko" && entry.id === id)?.path ?? null,
    }));
  }, expectedEntries);
  expect(manifestPaths).toEqual(expectedEntries.map(({ id, path }) => ({ id, path })));

  await pressPhysicalButton(page, "topRight");

  await expect(page.locator('[data-exercise-id="D1_Q1"]')).toBeVisible();
  await selectOptionsThenConfirm(
    page,
    ["topLeft", "topRight", "bottomLeft", "bottomRight"],
    "bottomRight",
  );
  await expect(page.locator('[data-screen="lesson-feedback"]')).toBeVisible();
  await pressPhysicalButton(page, "topRight");

  await expect(page.locator('[data-exercise-id="D1_Q2"]')).toBeVisible();
  await selectOptionsThenConfirm(
    page,
    ["topLeft", "topRight", "bottomLeft", "bottomRight"],
    "bottomRight",
  );
  await expect(page.locator('[data-screen="lesson-feedback"]')).toBeVisible();
  await pressPhysicalButton(page, "topRight");

  await expect(page.locator('[data-exercise-id="D1_Q3"]')).toBeVisible();
  await selectOptionsThenConfirm(
    page,
    ["topRight", "bottomLeft", "bottomRight", "topLeft"],
    "topLeft",
  );
  await expect(page.locator('[data-screen="lesson-feedback"]')).toBeVisible();
  await pressPhysicalButton(page, "topRight");

  await expect(page.locator('[data-exercise-id="D1_Q4"]')).toBeVisible();
  await selectOptionsThenConfirm(
    page,
    ["topLeft", "topRight", "bottomRight", "bottomLeft"],
    "bottomLeft",
  );
  await expect(page.locator('[data-screen="lesson-feedback"]')).toBeVisible();
  await pressPhysicalButton(page, "topRight");

  const voiceQuestion = page.locator('[data-exercise-id="D1_Q5"][data-question-kind="voice"]');
  await expect(voiceQuestion).toBeVisible();
  await pressPhysicalButton(page, "topRight");
  await expect(voiceQuestion.locator('[data-voice-stage="recording"]')).toBeVisible();
  await pressPhysicalButton(page, "topRight");
  await expect(voiceQuestion.locator('[data-voice-stage="review"]')).toBeVisible();
  await pressPhysicalButton(page, "topRight");
  await expect(page.locator('[data-screen="lesson-feedback"]')).toBeVisible();
  await pressPhysicalButton(page, "topRight");

  const sequenceQuestion = page.locator(
    '[data-exercise-id="D1_Q6"][data-question-kind="button_sequence"]',
  );
  await expect(sequenceQuestion).toBeVisible();
  await pressPhysicalButton(page, "bottomRight");
  await selectOptionsThenConfirm(page, ["topLeft"], "topLeft");
  await selectOptionsThenConfirm(page, ["topRight"], "topRight");
  await selectOptionsThenConfirm(page, ["bottomLeft"], "bottomLeft");
  await pressPhysicalButton(page, "topRight");
  await expect(page.locator('[data-screen="lesson-feedback"]')).toBeVisible();
  await pressPhysicalButton(page, "topRight");
  await expect(page.locator('[data-screen="result"]')).toBeVisible();

  const expectedUrls = expectedEntries.map(({ path }) => absoluteAssetUrl(page, path));
  const previousUrls = new Set([
    ...audit.entries.map(({ previousPath }) => absoluteAssetUrl(page, previousPath)),
    ...calmAudit.entries.map(({ previousPath }) => absoluteAssetUrl(page, previousPath)),
  ]);

  await expect.poll(async () => {
    const played = await readPlayedNarrationUrls(page);
    return expectedUrls.every((url) => played.includes(url));
  }).toBe(true);
  const playedNarrations = await readPlayedNarrationUrls(page);
  expect([...new Set(playedNarrations)].sort()).toEqual([...expectedUrls].sort());
  expect(playedNarrations.filter((url) => previousUrls.has(url))).toEqual([]);

  await expect.poll(() => expectedUrls.every((expectedUrl) => {
    const expectedPath = new URL(expectedUrl).pathname;
    return audioResponses.some((response) => (
      new URL(response.url).pathname === expectedPath && response.status === 200
    ));
  })).toBe(true);
  expect(pageErrors).toEqual([]);
  expect(externalRequests).toEqual([]);
});
