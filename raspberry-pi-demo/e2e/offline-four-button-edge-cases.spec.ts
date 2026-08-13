import { expect, test, type Page } from "@playwright/test";

const KEY_BY_SLOT = {
  topLeft: "1",
  topRight: "2",
  bottomLeft: "3",
  bottomRight: "4",
} as const;

const OFFLINE_PROGRESS_KEY = "haru:offline:progress:v1";
const DEBOUNCE_SETTLE_MS = 230;

type PhysicalSlot = keyof typeof KEY_BY_SLOT;
type ResponseKind = "single_choice" | "button_sequence" | "voice";

interface StoredResponse {
  exerciseId: string;
  kind: ResponseKind;
  selectedIds: string[];
  responseMs: number;
  completedAt: string;
}

interface StoredProgress {
  schemaVersion: 1;
  activeDay: number;
  completedDays: number[];
  responses: StoredResponse[];
}

interface HaruMicProbe {
  requests: number;
  stops: number;
  closes: number;
  reads: number;
}

declare global {
  interface Window {
    __haruMicProbe?: HaruMicProbe;
  }
}

function response(
  exerciseId: string,
  kind: ResponseKind,
  index: number,
): StoredResponse {
  return {
    exerciseId,
    kind,
    selectedIds: [],
    responseMs: 1_000 + index,
    completedAt: `2026-08-10T00:00:${String(index).padStart(2, "0")}.000Z`,
  };
}

function dayOneResponses(count: number): StoredResponse[] {
  const kinds: readonly ResponseKind[] = [
    "single_choice",
    "single_choice",
    "single_choice",
    "single_choice",
    "voice",
    "button_sequence",
  ];
  return kinds.slice(0, count).map((kind, index) =>
    response(`D1_Q${index + 1}`, kind, index),
  );
}

async function openHashRoute(page: Page, route: string): Promise<void> {
  await page.goto(`/#${route}`);
  await expect(page.locator(".offline-app")).toBeVisible();
}

async function pressPhysicalButton(
  page: Page,
  slot: PhysicalSlot,
  controlledClock = false,
): Promise<void> {
  await page.keyboard.press(KEY_BY_SLOT[slot]);
  if (controlledClock) {
    await page.clock.runFor(DEBOUNCE_SETTLE_MS);
  } else {
    await page.waitForTimeout(DEBOUNCE_SETTLE_MS);
  }
}

async function selectAndConfirm(page: Page, slot: PhysicalSlot): Promise<void> {
  await pressPhysicalButton(page, slot);
  await pressPhysicalButton(page, slot);
}

async function seedProgress(page: Page, progress: StoredProgress): Promise<void> {
  await openHashRoute(page, "/kiosk");
  await page.evaluate(
    ({ key, value }) => localStorage.setItem(key, JSON.stringify(value)),
    { key: OFFLINE_PROGRESS_KEY, value: progress },
  );
}

async function readProgress(page: Page): Promise<StoredProgress> {
  return page.evaluate((key) => {
    const raw = localStorage.getItem(key);
    if (!raw) throw new Error(`Missing progress at ${key}`);
    return JSON.parse(raw) as StoredProgress;
  }, OFFLINE_PROGRESS_KEY);
}

async function seedDayOneResume(page: Page, answeredCount: number): Promise<void> {
  await seedProgress(page, {
    schemaVersion: 1,
    activeDay: 1,
    completedDays: [],
    responses: dayOneResponses(answeredCount),
  });
}

async function overrideDebounce(page: Page, debounceMs: number): Promise<void> {
  await page.route("**/config/runtime.json", async (route) => {
    const original = await route.fetch();
    const runtime = await original.json() as {
      input: { debounceMs: number };
      [key: string]: unknown;
    };
    await route.fulfill({
      response: original,
      json: {
        ...runtime,
        input: { ...runtime.input, debounceMs },
      },
    });
  });
}

async function installSuccessfulMicrophone(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const probe: HaruMicProbe = {
      requests: 0,
      stops: 0,
      closes: 0,
      reads: 0,
    };
    window.__haruMicProbe = probe;
    const track = {
      stop: () => {
        probe.stops += 1;
      },
    };
    const stream = { getTracks: () => [track] };
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: {
        getUserMedia: async () => {
          probe.requests += 1;
          return stream;
        },
      },
    });

    class FakeAnalyser {
      fftSize = 0;
      smoothingTimeConstant = 0;
      frequencyBinCount = 64;

      getByteTimeDomainData(samples: Uint8Array): void {
        probe.reads += 1;
        samples.forEach((_, index) => {
          samples[index] = index % 2 === 0 ? 96 : 160;
        });
      }
    }

    class FakeAudioContext {
      createAnalyser(): FakeAnalyser {
        return new FakeAnalyser();
      }

      createMediaStreamSource(): { connect: () => void } {
        return { connect: () => undefined };
      }

      close(): Promise<void> {
        probe.closes += 1;
        return Promise.resolve();
      }
    }

    Object.defineProperty(window, "AudioContext", {
      configurable: true,
      value: FakeAudioContext,
    });
  });
}

async function installDeniedMicrophone(page: Page): Promise<void> {
  await page.addInitScript(() => {
    window.__haruMicProbe = {
      requests: 0,
      stops: 0,
      closes: 0,
      reads: 0,
    };
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: {
        getUserMedia: async () => {
          if (window.__haruMicProbe) window.__haruMicProbe.requests += 1;
          throw new DOMException("Microphone unavailable", "NotAllowedError");
        },
      },
    });
  });
}

test("feedback retry deletes the committed response and survives a reload", async ({ page }) => {
  await openHashRoute(page, "/lesson?day=1");
  await pressPhysicalButton(page, "topRight");
  await selectAndConfirm(page, "topLeft");
  await expect(page.locator('[data-screen="lesson-feedback"]')).toBeVisible();
  expect((await readProgress(page)).responses.map((entry) => entry.exerciseId)).toEqual(["D1_Q1"]);

  await pressPhysicalButton(page, "topLeft");
  await expect(page.locator('[data-exercise-id="D1_Q1"][data-screen="lesson-question"]')).toBeVisible();
  expect((await readProgress(page)).responses).toEqual([]);

  await page.reload();
  await expect(page.locator('[data-screen="lesson-start"]')).toBeVisible();
  await pressPhysicalButton(page, "topRight");
  await expect(page.locator('[data-exercise-id="D1_Q1"][data-screen="lesson-question"]')).toBeVisible();
});

test("mid-day reload resumes at the first unanswered question", async ({ page }) => {
  await openHashRoute(page, "/lesson?day=1");
  await pressPhysicalButton(page, "topRight");
  await selectAndConfirm(page, "topLeft");
  await pressPhysicalButton(page, "topRight");
  await expect(page.locator('[data-exercise-id="D1_Q2"][data-screen="lesson-question"]')).toBeVisible();

  await page.reload();
  await expect(page.locator('[data-screen="lesson-start"]')).toBeVisible();
  await pressPhysicalButton(page, "topRight");
  await expect(page.locator('[data-exercise-id="D1_Q2"][data-screen="lesson-question"]')).toBeVisible();
});

test("fresh-run route clears stale day progress and then advances from question one", async ({ page }) => {
  await seedDayOneResume(page, 5);
  await openHashRoute(page, "/lesson?day=1&restart=1");
  await expect(page).toHaveURL(/#\/lesson\?day=1&restart=1$/);
  expect((await readProgress(page)).responses).toEqual([]);

  await pressPhysicalButton(page, "topRight");
  await expect(page.locator('[data-exercise-id="D1_Q1"][data-screen="lesson-question"]')).toBeVisible();
  await expect(page.locator(".progress__label")).toHaveText("1 / 6");
  await selectAndConfirm(page, "topLeft");
  await expect(page.locator('[data-screen="lesson-feedback"]')).toBeVisible();
  await pressPhysicalButton(page, "topRight");

  await expect(page.locator('[data-exercise-id="D1_Q2"][data-screen="lesson-question"]')).toBeVisible();
  await expect(page.locator(".progress__label")).toHaveText("2 / 6");
  expect((await readProgress(page)).responses.map((entry) => entry.exerciseId)).toEqual(["D1_Q1"]);
});

test("fresh-run URL stays explicit and reloads from day-one question one", async ({ page }) => {
  await openHashRoute(page, "/lesson?day=1&restart=1");
  await pressPhysicalButton(page, "topRight");
  await expect(page.locator('[data-exercise-id="D1_Q1"]')).toBeVisible();
  await selectAndConfirm(page, "topLeft");
  await pressPhysicalButton(page, "topRight");
  await expect(page.locator('[data-exercise-id="D1_Q2"]')).toBeVisible();

  await page.reload();
  await expect(page).toHaveURL(/#\/lesson\?day=1&restart=1$/);
  await expect(page.locator('[data-screen="lesson-start"]')).toBeVisible();
  expect((await readProgress(page)).responses).toEqual([]);
  await pressPhysicalButton(page, "topRight");
  await expect(page.locator('[data-exercise-id="D1_Q1"]')).toBeVisible();
});

test("reload recovers an all-answered but incomplete day directly to result", async ({ page }) => {
  await openHashRoute(page, "/lesson?day=1");
  await page.evaluate(
    ({ key, value }) => localStorage.setItem(key, JSON.stringify(value)),
    {
      key: OFFLINE_PROGRESS_KEY,
      value: {
        schemaVersion: 1,
        activeDay: 1,
        completedDays: [],
        responses: dayOneResponses(6),
      } satisfies StoredProgress,
    },
  );

  await page.reload();
  await expect(page.locator('[data-screen="result"]')).toBeVisible();
  const recovered = await readProgress(page);
  expect(recovered.completedDays).toEqual([1]);
  expect(recovered.responses).toHaveLength(6);
});

test("query-only day switch resets transient state and uses the new day's resume point", async ({ page }) => {
  await seedProgress(page, {
    schemaVersion: 1,
    activeDay: 1,
    completedDays: [],
    responses: [
      ...dayOneResponses(5),
      response("D2_Q1", "single_choice", 6),
    ],
  });
  await openHashRoute(page, "/lesson?day=1");
  await pressPhysicalButton(page, "topRight");
  await expect(page.locator('[data-exercise-id="D1_Q6"]')).toBeVisible();
  await pressPhysicalButton(page, "topLeft");

  await page.evaluate(() => {
    window.location.hash = "/lesson?day=2";
  });
  await expect(page).toHaveURL(/#\/lesson\?day=2$/);
  await expect(page.locator('[data-screen="lesson-start"]')).toBeVisible();
  await pressPhysicalButton(page, "topRight");
  await expect(
    page.locator('[data-exercise-id="D2_Q2"][data-question-kind="single_choice"]'),
  ).toBeVisible();
});

test("sequence supports pending changes, duplicate rejection, reset, and submit", async ({ page }) => {
  await seedDayOneResume(page, 5);
  await openHashRoute(page, "/lesson?day=1");
  await pressPhysicalButton(page, "topRight");
  const sequence = page.locator('[data-exercise-id="D1_Q6"][data-question-kind="button_sequence"]');
  await expect(sequence).toBeVisible();
  const optionA = sequence.locator('[data-slot="topLeft"]');
  const optionB = sequence.locator('[data-slot="topRight"]');

  await pressPhysicalButton(page, "topLeft");
  await expect(optionA).toHaveAttribute("aria-pressed", "true");
  await pressPhysicalButton(page, "topRight");
  await expect(optionA).toHaveAttribute("aria-pressed", "false");
  await expect(optionB).toHaveAttribute("aria-pressed", "true");
  await pressPhysicalButton(page, "topRight");
  await expect(optionB).toHaveAttribute("aria-disabled", "true");
  await expect(sequence.locator(".choice-card__order")).toHaveCount(1);

  await pressPhysicalButton(page, "topRight");
  await expect(sequence.locator(".choice-card__order")).toHaveCount(1);
  await selectAndConfirm(page, "topLeft");
  await selectAndConfirm(page, "bottomLeft");
  await expect(sequence.locator('[aria-disabled="true"]')).toHaveCount(3);

  await pressPhysicalButton(page, "topLeft");
  await expect(sequence.locator('[aria-disabled="true"]')).toHaveCount(0);
  await expect(sequence.locator(".choice-card__order")).toHaveCount(0);

  await selectAndConfirm(page, "topLeft");
  await selectAndConfirm(page, "topRight");
  await selectAndConfirm(page, "bottomLeft");
  await pressPhysicalButton(page, "bottomRight");
  await expect(page.locator('[data-screen="lesson-feedback"]')).toBeVisible();
  const stored = await readProgress(page);
  expect(stored.responses.find((entry) => entry.exerciseId === "D1_Q6")?.selectedIds)
    .toEqual(["A", "B", "C"]);
});

test("voice microphone success updates amplitude and stops resources on review", async ({ page }) => {
  await installSuccessfulMicrophone(page);
  await seedDayOneResume(page, 4);
  await openHashRoute(page, "/lesson?day=1");
  await pressPhysicalButton(page, "topRight");
  const voice = page.locator('[data-exercise-id="D1_Q5"][data-question-kind="voice"]');
  await expect(voice).toBeVisible();

  await pressPhysicalButton(page, "topRight");
  await expect(voice.locator('[data-voice-stage="recording"]')).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.__haruMicProbe?.reads ?? 0)).toBeGreaterThan(0);
  await expect(voice.locator(".voice-waveform")).toHaveAttribute("data-fallback", "false");
  await expect.poll(() => voice.locator(".voice-waveform").evaluate(
    (element) => element.style.getPropertyValue("--voice-level"),
  )).not.toBe("");

  await pressPhysicalButton(page, "topRight");
  await expect(voice.locator('[data-voice-stage="review"]')).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.__haruMicProbe?.stops ?? 0)).toBeGreaterThanOrEqual(1);
  await expect.poll(() => page.evaluate(() => window.__haruMicProbe?.closes ?? 0)).toBeGreaterThanOrEqual(1);
  await pressPhysicalButton(page, "topRight");
  await expect(page.locator('[data-screen="lesson-feedback"]')).toBeVisible();
  const storedVoice = (await readProgress(page)).responses.find(
    (entry) => entry.exerciseId === "D1_Q5",
  );
  expect(storedVoice).toMatchObject({ kind: "voice", selectedIds: [] });
  expect(JSON.stringify(storedVoice)).not.toMatch(/audio|blob|media|transcript/i);
});

test("voice denial fallback supports replay, cancel, retry, and confirmation", async ({ page }) => {
  await installDeniedMicrophone(page);
  await seedDayOneResume(page, 4);
  await openHashRoute(page, "/lesson?day=1");
  await pressPhysicalButton(page, "topRight");
  const voice = page.locator('[data-exercise-id="D1_Q5"][data-question-kind="voice"]');

  await pressPhysicalButton(page, "topLeft");
  await expect(voice.locator('[data-voice-stage="ready"]')).toBeVisible();
  await pressPhysicalButton(page, "topRight");
  await expect(voice.locator('[data-voice-stage="recording"] .voice-waveform')).toHaveAttribute(
    "data-fallback",
    "true",
  );
  const waveformProfiles: string[] = [];
  for (let sample = 0; sample < 5; sample += 1) {
    waveformProfiles.push(await voice.locator(".voice-waveform").evaluate((waveform) => (
      [...waveform.querySelectorAll("span")]
        .map((bar) => getComputedStyle(bar).transform)
        .join("|")
    )));
    await page.waitForTimeout(140);
  }
  expect(new Set(waveformProfiles).size).toBeGreaterThanOrEqual(4);
  expect(waveformProfiles.some((profile) => new Set(profile.split("|")).size >= 8)).toBe(true);
  await pressPhysicalButton(page, "bottomLeft");
  await expect(voice.locator('[data-voice-stage="ready"]')).toBeVisible();

  await pressPhysicalButton(page, "topRight");
  await pressPhysicalButton(page, "topRight");
  await expect(voice.locator('[data-voice-stage="review"]')).toBeVisible();
  await pressPhysicalButton(page, "topLeft");
  await expect(voice.locator('[data-voice-stage="recording"]')).toBeVisible();
  await pressPhysicalButton(page, "topRight");
  await pressPhysicalButton(page, "topRight");
  await expect(page.locator('[data-screen="lesson-feedback"]')).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.__haruMicProbe?.requests ?? 0)).toBeGreaterThanOrEqual(3);
});

test("voice timeout requires the post-timeout guard before confirmation", async ({ page }) => {
  await page.clock.install({ time: new Date("2026-08-10T00:00:00.000Z") });
  await installDeniedMicrophone(page);
  await seedDayOneResume(page, 4);
  await openHashRoute(page, "/lesson?day=1");
  await pressPhysicalButton(page, "topRight", true);
  const voice = page.locator('[data-exercise-id="D1_Q5"][data-question-kind="voice"]');
  await pressPhysicalButton(page, "topRight", true);
  await expect(voice.locator('[data-voice-stage="recording"]')).toBeVisible();

  await page.clock.runFor(25_000);
  await expect(voice.locator('[data-voice-stage="review"]')).toBeVisible();
  await pressPhysicalButton(page, "topRight", true);
  await expect(voice.locator('[data-voice-stage="review"]')).toBeVisible();
  await expect(page.locator('[data-screen="lesson-feedback"]')).toHaveCount(0);

  await page.clock.runFor(600);
  await pressPhysicalButton(page, "topRight", true);
  await expect(page.locator('[data-screen="lesson-feedback"]')).toBeVisible();
});

test("invalid runtime config fails closed with a diagnostic screen", async ({ page }) => {
  await page.route("**/config/runtime.json", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        input: {
          version: 1,
          debounceMs: 200,
          bindings: {
            topLeft: { key: "1", code: "Digit1" },
            topRight: { key: "1", code: "Digit1" },
            bottomLeft: { key: "3", code: "Digit3" },
            bottomRight: { key: "4", code: "Digit4" },
          },
        },
      }),
    });
  });

  await page.goto("/#/lesson?day=1");
  await expect(page.locator('[data-screen="runtime-error"]')).toBeVisible();
  await expect(page.getByRole("alert")).toBeVisible();
  await page.keyboard.press("2");
  await page.waitForTimeout(DEBOUNCE_SETTLE_MS);
  await expect(page.locator('[data-screen="runtime-error"]')).toBeVisible();
  await expect(page.locator('[data-screen="lesson-start"]')).toHaveCount(0);
});

test("held, repeated, chorded, and bounced input cannot double-activate", async ({ page }) => {
  await overrideDebounce(page, 1_000);
  await openHashRoute(page, "/lesson?day=1");

  await page.keyboard.down("2");
  await expect(page.locator('[data-exercise-id="D1_Q1"]')).toBeVisible();
  await expect(page.locator(".guide-key--yellow.is-active")).toBeVisible();
  await page.keyboard.down("2");
  await page.keyboard.down("1");
  await page.keyboard.up("1");
  await expect(page.locator('.choice-card[aria-pressed="true"]')).toHaveCount(0);
  await page.keyboard.up("2");
  await expect(page.locator(".guide-key.is-active")).toHaveCount(0);

  await page.keyboard.press("2");
  await page.waitForTimeout(50);
  await expect(page.locator('.choice-card[aria-pressed="true"]')).toHaveCount(0);
  await page.waitForTimeout(1_050);
  await page.keyboard.press("2");
  await expect(page.locator('[data-slot="topRight"]')).toHaveAttribute("aria-pressed", "true");

  await page.keyboard.press("2");
  await page.waitForTimeout(50);
  await expect(page.locator('[data-screen="lesson-feedback"]')).toHaveCount(0);
  await page.waitForTimeout(1_050);
  await page.keyboard.press("2");
  await expect(page.locator('[data-screen="lesson-feedback"]')).toBeVisible();
});

test("blur releases a held key without bypassing its debounce window", async ({ page }) => {
  await overrideDebounce(page, 1_000);
  await openHashRoute(page, "/lesson?day=1");

  await page.keyboard.down("2");
  await expect(page.locator('[data-exercise-id="D1_Q1"]')).toBeVisible();
  await expect(page.locator(".guide-key--yellow.is-active")).toBeVisible();
  await page.evaluate(() => window.dispatchEvent(new Event("blur")));
  await expect(page.locator(".guide-key.is-active")).toHaveCount(0);
  await page.keyboard.up("2");

  await page.keyboard.press("2");
  await page.waitForTimeout(50);
  await expect(page.locator('.choice-card[aria-pressed="true"]')).toHaveCount(0);
  await page.waitForTimeout(1_050);
  await page.keyboard.press("2");
  await expect(page.locator('[data-slot="topRight"]')).toHaveAttribute("aria-pressed", "true");
});

test("pointer clicks alone cannot navigate menus or answer a lesson", async ({ page }) => {
  await openHashRoute(page, "/kiosk");
  await page.locator('[data-path="/lesson?restart=1"]').click();
  await expect(page).toHaveURL(/#\/kiosk$/);
  await expect(page.locator('[data-path="/lesson?restart=1"]')).not.toHaveClass(/is-selected/);

  await openHashRoute(page, "/lesson?day=1");
  await page.locator('[data-screen="lesson-start"]').click();
  await page.locator(".guide-key--yellow").click();
  await expect(page.locator('[data-screen="lesson-start"]')).toBeVisible();
  await pressPhysicalButton(page, "topRight");
  const bottomRightChoice = page.locator('[data-slot="bottomRight"]');
  await bottomRightChoice.click();
  await expect(bottomRightChoice).toHaveAttribute("aria-pressed", "false");
  await expect(page.locator('[data-screen="lesson-feedback"]')).toHaveCount(0);
  await expect.poll(() => page.evaluate((key) => localStorage.getItem(key), OFFLINE_PROGRESS_KEY)).toBeNull();
});

test("bottom-right physical button selects and confirms its spatial choice", async ({ page }) => {
  await openHashRoute(page, "/lesson?day=1");
  await pressPhysicalButton(page, "topRight");
  await selectAndConfirm(page, "bottomRight");
  await expect(page.locator('[data-screen="lesson-feedback"]')).toBeVisible();
  const stored = await readProgress(page);
  expect(stored.responses).toContainEqual(expect.objectContaining({
    exerciseId: "D1_Q1",
    selectedIds: ["D"],
  }));
});
