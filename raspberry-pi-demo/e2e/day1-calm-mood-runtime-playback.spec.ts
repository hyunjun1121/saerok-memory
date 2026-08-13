import { readFileSync } from "node:fs";

import { expect, test, type Page, type Request, type Response } from "@playwright/test";

const OFFLINE_PROGRESS_KEY = "haru:offline:progress:v1";
const DEBOUNCE_SETTLE_MS = 230;

interface CalmAuditEntry {
  id: string;
  text: string;
  sourcePath: string;
  previousPath: string;
  path: string;
  sha256: string;
}

interface CalmRuntimeAudit {
  questionId: "D1_Q1";
  entryCount: 4;
  entries: CalmAuditEntry[];
}

interface AudioProbeState {
  plays: string[];
}

const audit = JSON.parse(readFileSync(
  new URL(
    "../tools/fish-day1-browser/calm-mood-candidates/calm-mood-runtime-import.json",
    import.meta.url,
  ),
  "utf8",
)) as CalmRuntimeAudit;

async function pressKey(page: Page, key: "1" | "2" | "3" | "4"): Promise<void> {
  await page.keyboard.press(key);
  await page.waitForTimeout(DEBOUNCE_SETTLE_MS);
}

async function installAudioProbe(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const probeWindow = window as typeof window & { __haruCalmAudioProbe: AudioProbeState };
    const nativePlay = HTMLMediaElement.prototype.play;
    let requestSequence = 0;
    probeWindow.__haruCalmAudioProbe = { plays: [] };

    Object.defineProperty(HTMLMediaElement.prototype, "play", {
      configurable: true,
      writable: true,
      value: async function playWithProbe(this: HTMLMediaElement): Promise<void> {
        const source = this.currentSrc || this.src;
        probeWindow.__haruCalmAudioProbe.plays.push(source);
        const nativePlayback = Reflect.apply(nativePlay, this, []).catch(() => undefined);
        const probeUrl = new URL(source);
        probeUrl.searchParams.set("__haru_calm_runtime_probe", String(requestSequence));
        requestSequence += 1;
        const response = await fetch(probeUrl, { cache: "no-store" });
        await response.arrayBuffer();
        await nativePlayback;
        if (!response.ok) throw new Error(`Audio returned ${response.status}: ${source}`);
      },
    });
  });
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript((storageKey) => localStorage.removeItem(storageKey), OFFLINE_PROGRESS_KEY);
});

test("plays all four selected calm Q1 options through physical keys and never plays replaced B paths", async ({ page }) => {
  expect(audit.questionId).toBe("D1_Q1");
  expect(audit.entryCount).toBe(4);
  expect(audit.entries.map((entry) => entry.id)).toEqual([
    "exercise.D1_Q1.option.A",
    "exercise.D1_Q1.option.B",
    "exercise.D1_Q1.option.C",
    "exercise.D1_Q1.option.D",
  ]);

  await installAudioProbe(page);
  const externalRequests: string[] = [];
  const audioResponses: Array<{ url: string; status: number; contentType: string | null }> = [];
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("request", (request: Request) => {
    const url = new URL(request.url());
    if (url.protocol !== "http:" && url.protocol !== "https:") return;
    if (["127.0.0.1", "localhost", "::1"].includes(url.hostname)) return;
    externalRequests.push(request.url());
  });
  page.on("response", (response: Response) => {
    const url = new URL(response.url());
    if (!url.pathname.endsWith(".ogg")) return;
    audioResponses.push({
      url: response.url(),
      status: response.status(),
      contentType: response.headers()["content-type"] ?? null,
    });
  });

  await page.goto("/#/lesson?day=1&restart=1");
  await expect(page.locator('[data-screen="lesson-start"]')).toBeVisible();

  const manifestEntries = await page.evaluate(async (ids) => {
    const response = await fetch("assets/audio/narration/manifest.json", { cache: "no-store" });
    if (!response.ok) throw new Error(`Narration manifest returned ${response.status}`);
    const manifest = await response.json() as {
      entries: Array<{ id: string; locale: string; text: string; path: string; sha256: string }>;
    };
    return ids.map((id) => manifest.entries.find((entry) => entry.locale === "ko" && entry.id === id));
  }, audit.entries.map((entry) => entry.id));
  expect(manifestEntries).toEqual(audit.entries.map(({ id, text, path, sha256 }) => ({
    id,
    locale: "ko",
    text,
    path,
    audioPath: path,
    sha256,
    durationMs: expect.any(Number),
    origin: expect.any(Object),
  })));

  await pressKey(page, "2");
  await expect(page.locator('[data-exercise-id="D1_Q1"]')).toBeVisible();
  for (const key of ["1", "2", "3", "4"] as const) await pressKey(page, key);

  const expectedUrls = audit.entries.map((entry) => new URL(entry.path, page.url()).href);
  const replacedUrls = new Set(audit.entries.map((entry) => new URL(entry.previousPath, page.url()).href));
  await expect.poll(() => page.evaluate(() => {
    const probeWindow = window as typeof window & { __haruCalmAudioProbe: AudioProbeState };
    return [...probeWindow.__haruCalmAudioProbe.plays];
  })).toEqual(expect.arrayContaining(expectedUrls));

  const played = await page.evaluate(() => {
    const probeWindow = window as typeof window & { __haruCalmAudioProbe: AudioProbeState };
    return [...probeWindow.__haruCalmAudioProbe.plays];
  });
  expect(played.filter((url) => replacedUrls.has(url))).toEqual([]);

  await expect.poll(() => expectedUrls.every((expectedUrl) => {
    const expectedPath = new URL(expectedUrl).pathname;
    return audioResponses.some((response) => (
      new URL(response.url).pathname === expectedPath &&
      response.status === 200 &&
      response.contentType?.startsWith("audio/ogg")
    ));
  })).toBe(true);

  await pressKey(page, "4");
  await expect(page.locator('[data-screen="lesson-feedback"]')).toBeVisible();
  expect(pageErrors).toEqual([]);
  expect(externalRequests).toEqual([]);
});
