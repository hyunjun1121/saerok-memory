import { expect, test, type Page, type Request } from "@playwright/test";

const KEY_BY_SLOT = {
  topLeft: "1",
  topRight: "2",
  bottomLeft: "3",
  bottomRight: "4",
} as const;

const OFFLINE_PROGRESS_KEY = "haru:offline:progress:v1";
const DEBOUNCE_SETTLE_MS = 230;
const EXPECTED_LANGUAGE = process.env.EXPECTED_LANGUAGE ?? "ko";

type PhysicalSlot = keyof typeof KEY_BY_SLOT;

async function pressPhysicalButton(page: Page, slot: PhysicalSlot): Promise<void> {
  await page.keyboard.press(KEY_BY_SLOT[slot]);
  await page.waitForTimeout(DEBOUNCE_SETTLE_MS);
}

async function pressMappedKey(page: Page, key: string): Promise<void> {
  await page.keyboard.press(key);
  await page.waitForTimeout(DEBOUNCE_SETTLE_MS);
}

async function selectAndConfirm(page: Page, slot: PhysicalSlot): Promise<void> {
  await pressPhysicalButton(page, slot);
  await pressPhysicalButton(page, slot);
}

function watchNonLoopbackRequests(page: Page): string[] {
  const externalRequests: string[] = [];
  page.on("request", (request: Request) => {
    const url = new URL(request.url());
    if (url.protocol === "data:" || url.protocol === "blob:") return;
    if (url.hostname === "127.0.0.1" || url.hostname === "localhost" || url.hostname === "::1") return;
    externalRequests.push(request.url());
  });
  return externalRequests;
}

async function openHashRoute(page: Page, route: string): Promise<void> {
  await page.goto(`/#${route}`);
  await expect(page.locator(".offline-app")).toBeVisible();
}

async function expectQuestionViewportFit(page: Page): Promise<void> {
  await page.evaluate(() => document.fonts.ready);
  const metrics = await page.evaluate(() => {
    const main = document.querySelector<HTMLElement>(".screen-main");
    const guide = document.querySelector<HTMLElement>(".button-guide");
    const questionCopy = document.querySelector<HTMLElement>(".question-copy");
    const choiceGrid = document.querySelector<HTMLElement>(".choice-grid");
    if (!main || !guide || !questionCopy) throw new Error("Missing viewport layout elements.");
    const guideBox = guide.getBoundingClientRect();
    const copyBox = questionCopy.getBoundingClientRect();
    const gridBox = choiceGrid?.getBoundingClientRect();
    const prompt = questionCopy.querySelector<HTMLElement>("h1");
    const splitWords: string[] = [];
    const orphanLines: string[] = [];
    const overflowingText: string[] = [];
    const readableText = [
      ...questionCopy.querySelectorAll<HTMLElement>("h1, p"),
      ...document.querySelectorAll<HTMLElement>(".choice-card__label, .guide-key span"),
    ];
    for (const element of readableText) {
      if (element.scrollWidth > element.clientWidth + 1 || element.scrollHeight > element.clientHeight + 5) {
        overflowingText.push(element.textContent?.trim() ?? "");
      }
      const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
      let node = walker.nextNode();
      const renderedLines = new Map<number, string>();
      while (node) {
        const value = node.textContent ?? "";
        for (const match of value.matchAll(/\S+/g)) {
          if (match.index === undefined) continue;
          const range = document.createRange();
          range.setStart(node, match.index);
          range.setEnd(node, match.index + match[0].length);
          const lineTops = new Set(
            [...range.getClientRects()]
              .filter((rect) => rect.width > 0 && rect.height > 0)
              .map((rect) => Math.round(rect.top * 10) / 10),
          );
          if (lineTops.size > 1) splitWords.push(match[0]);
        }
        for (let index = 0; index < value.length; index += 1) {
          const character = value[index];
          if (/\s/.test(character)) continue;
          const range = document.createRange();
          range.setStart(node, index);
          range.setEnd(node, index + 1);
          const rect = [...range.getClientRects()].find((candidate) => candidate.width > 0 && candidate.height > 0);
          if (!rect) continue;
          const lineTop = Math.round(rect.top * 10) / 10;
          renderedLines.set(lineTop, `${renderedLines.get(lineTop) ?? ""}${character}`);
        }
        node = walker.nextNode();
      }
      if (renderedLines.size > 1) {
        for (const line of renderedLines.values()) {
          if ([...line].length === 1) orphanLines.push(`${element.textContent?.trim() ?? ""}: ${line}`);
        }
      }
    }
    return {
      mainClientHeight: main.clientHeight,
      mainScrollHeight: main.scrollHeight,
      documentHeight: document.documentElement.scrollHeight,
      viewportHeight: window.innerHeight,
      guideBottom: guideBox.bottom,
      guideBottomGap: window.innerHeight - guideBox.bottom,
      progressCopyGap: copyBox.top - (
        document.querySelector<HTMLElement>(".progress")?.getBoundingClientRect().bottom ?? copyBox.top
      ),
      choiceGap: gridBox ? gridBox.y - copyBox.bottom : null,
      choiceBottom: gridBox?.bottom ?? null,
      guideTop: guideBox.top,
      promptWordBreak: prompt ? getComputedStyle(prompt).wordBreak : null,
      promptLineBreak: prompt ? getComputedStyle(prompt).lineBreak : null,
      splitWords,
      orphanLines,
      overflowingText,
      cardVerticalGains: choiceGrid
        ? [...choiceGrid.querySelectorAll<HTMLElement>(".choice-card")].map((card) => {
            const box = card.getBoundingClientRect();
            return box.height - box.width;
          })
        : [],
    };
  });

  expect(metrics.mainScrollHeight).toBeLessThanOrEqual(metrics.mainClientHeight + 1);
  expect(metrics.documentHeight).toBe(metrics.viewportHeight);
  expect(metrics.guideBottom).toBeLessThanOrEqual(metrics.viewportHeight);
  expect(metrics.overflowingText).toEqual([]);
  if (EXPECTED_LANGUAGE === "ko") {
    expect(metrics.promptWordBreak).toBe("keep-all");
    expect(metrics.splitWords).toEqual([]);
  } else {
    expect(metrics.promptLineBreak).toBe("strict");
    expect(metrics.promptWordBreak).toBe("auto-phrase");
    expect(metrics.orphanLines).toEqual([]);
  }
  expect(metrics.progressCopyGap).toBeGreaterThanOrEqual(5);
  expect(metrics.progressCopyGap).toBeLessThanOrEqual(7);
  if (metrics.choiceGap !== null && metrics.choiceBottom !== null) {
    expect(metrics.choiceGap).toBeGreaterThanOrEqual(5);
    expect(metrics.choiceGap).toBeLessThanOrEqual(7);
    const choiceGuideGap = metrics.guideTop - metrics.choiceBottom;
    expect(choiceGuideGap).toBeGreaterThanOrEqual(9);
    expect(choiceGuideGap).toBeLessThanOrEqual(EXPECTED_LANGUAGE === "ko" ? 11 : 51);
    expect(Math.min(...metrics.cardVerticalGains)).toBeGreaterThan(0);
    expect(Math.max(...metrics.cardVerticalGains)).toBeLessThanOrEqual(6);
  }
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript((storageKey) => localStorage.removeItem(storageKey), OFFLINE_PROGRESS_KEY);
});

test("runs at physical 1080x1920 output geometry without touch input", async ({ page }) => {
  await openHashRoute(page, "/lesson?day=1");

  const geometry = await page.evaluate(() => ({
    width: window.innerWidth,
    height: window.innerHeight,
    dpr: window.devicePixelRatio,
    touchEvents: "ontouchstart" in window,
    coarsePointer: window.matchMedia("(pointer: coarse)").matches,
    anyCoarsePointer: window.matchMedia("(any-pointer: coarse)").matches,
  }));

  expect(geometry).toEqual({
    width: 540,
    height: 960,
    dpr: 2,
    touchEvents: false,
    coarsePointer: false,
    anyCoarsePointer: false,
  });
  expect(geometry.width * geometry.dpr).toBe(1080);
  expect(geometry.height * geometry.dpr).toBe(1920);
  expect(await page.locator("html").getAttribute("lang")).toBe(EXPECTED_LANGUAGE);
  await expect(page.locator(".offline-app")).toHaveCSS("cursor", "none");
});

test("stacks the question and physical-button guide at the top with only bottom whitespace", async ({ page }) => {
  await openHashRoute(page, "/lesson?day=1&restart=1");
  const startBottomWhitespace = await page.locator('[data-screen="lesson-start"]')
    .evaluate(() => {
      const app = document.querySelector<HTMLElement>(".offline-app");
      const guide = document.querySelector<HTMLElement>(".button-guide");
      if (!app || !guide) throw new Error("Missing start-screen layout elements.");
      return app.getBoundingClientRect().bottom - guide.getBoundingClientRect().bottom;
    });
  await pressPhysicalButton(page, "topRight");
  await page.evaluate(() => document.fonts.ready);

  const metrics = await page.locator('[data-screen="lesson-question"][data-exercise-id="D1_Q1"]')
    .evaluate((question) => {
      const cards = [...question.querySelectorAll<HTMLElement>(".choice-card")];
      const questionCopy = question.querySelector<HTMLElement>(".question-copy");
      const choiceGrid = question.querySelector<HTMLElement>(".choice-grid");
      const guide = document.querySelector<HTMLElement>(".button-guide");
      const guideTitle = document.querySelector<HTMLElement>(".button-guide__title");
      const guideKeys = [...document.querySelectorAll<HTMLElement>(".guide-key")];
      const guideLabels = [...document.querySelectorAll<HTMLElement>(".guide-key span")];
      if (!questionCopy || !choiceGrid || !guide || !guideTitle || cards.length !== 4 || guideKeys.length !== 4 || guideLabels.length !== 4) {
        throw new Error("Missing choice or physical-button guide elements.");
      }
      return {
        cardBoxes: cards.map((card) => card.getBoundingClientRect().toJSON()),
        questionCopyBox: questionCopy.getBoundingClientRect().toJSON(),
        choiceGridBox: choiceGrid.getBoundingClientRect().toJSON(),
        choiceGridRowGap: Number.parseFloat(getComputedStyle(choiceGrid).rowGap),
        choiceGridColumnGap: Number.parseFloat(getComputedStyle(choiceGrid).columnGap),
        guideBox: guide.getBoundingClientRect().toJSON(),
        guideTitleFontSize: Number.parseFloat(getComputedStyle(guideTitle).fontSize),
        guideKeyHeights: guideKeys.map((key) => key.getBoundingClientRect().height),
        guideLabelFontSizes: guideLabels.map((label) => Number.parseFloat(getComputedStyle(label).fontSize)),
        progressCopyGap: questionCopy.getBoundingClientRect().y - (
          document.querySelector<HTMLElement>(".progress")?.getBoundingClientRect().bottom
            ?? questionCopy.getBoundingClientRect().y
        ),
        pageHeight: document.documentElement.scrollHeight,
        viewportHeight: window.innerHeight,
      };
    });

  for (const card of metrics.cardBoxes) {
    expect(card.width).toBeGreaterThanOrEqual(239);
    expect(card.width).toBeLessThanOrEqual(241);
    expect(card.height).toBeGreaterThanOrEqual(243);
    expect(card.height).toBeLessThanOrEqual(245);
  }
  expect(metrics.choiceGridRowGap).toBeGreaterThanOrEqual(13);
  expect(metrics.choiceGridRowGap).toBeLessThanOrEqual(15);
  expect(metrics.choiceGridColumnGap).toBeGreaterThanOrEqual(11);
  expect(metrics.choiceGridColumnGap).toBeLessThanOrEqual(13);
  expect(metrics.choiceGridBox.y - (metrics.questionCopyBox.y + metrics.questionCopyBox.height))
    .toBeGreaterThanOrEqual(5);
  expect(metrics.choiceGridBox.y - (metrics.questionCopyBox.y + metrics.questionCopyBox.height))
    .toBeLessThanOrEqual(7);
  expect(metrics.progressCopyGap).toBeGreaterThanOrEqual(5);
  expect(metrics.progressCopyGap).toBeLessThanOrEqual(7);
  const choiceGuideGap = metrics.guideBox.y - (metrics.choiceGridBox.y + metrics.choiceGridBox.height);
  expect(choiceGuideGap).toBeGreaterThanOrEqual(9);
  expect(choiceGuideGap).toBeLessThanOrEqual(11);
  expect(metrics.guideTitleFontSize).toBeGreaterThanOrEqual(22);
  expect(Math.min(...metrics.guideKeyHeights)).toBeGreaterThanOrEqual(79);
  expect(Math.max(...metrics.guideKeyHeights)).toBeLessThanOrEqual(81);
  expect(Math.min(...metrics.guideLabelFontSizes)).toBeGreaterThanOrEqual(21);
  expect(metrics.guideBox.height).toBeGreaterThanOrEqual(222);
  expect(metrics.guideBox.height).toBeLessThanOrEqual(225);
  expect(metrics.guideBox.y + metrics.guideBox.height).toBeLessThanOrEqual(metrics.viewportHeight);
  const bottomWhitespace = metrics.viewportHeight - (metrics.guideBox.y + metrics.guideBox.height);
  expect(Math.abs(startBottomWhitespace - bottomWhitespace)).toBeLessThanOrEqual(0.5);
  if (EXPECTED_LANGUAGE === "ko") {
    expect(bottomWhitespace).toBeGreaterThanOrEqual(45);
    expect(bottomWhitespace).toBeLessThanOrEqual(55);
  } else {
    expect(bottomWhitespace).toBeGreaterThanOrEqual(6);
    expect(bottomWhitespace).toBeLessThanOrEqual(12);
  }
  expect(metrics.pageHeight).toBe(metrics.viewportHeight);
});

test("keeps the lesson stage fixed when the viewport is taller than the kiosk target", async ({ page }) => {
  await page.setViewportSize({ width: 540, height: 1310 });
  await openHashRoute(page, "/lesson?day=1&restart=1");
  await page.evaluate(() => document.fonts.ready);

  const startGuide = await page.locator(".button-guide").evaluate((guide) => {
    const box = guide.getBoundingClientRect();
    return { top: box.top, bottom: box.bottom };
  });

  await pressPhysicalButton(page, "topRight");
  const question = page.locator('[data-screen="lesson-question"][data-exercise-id="D1_Q1"]');
  await expect(question).toBeVisible();
  await page.evaluate(() => document.fonts.ready);

  const questionLayout = await question.evaluate((element) => {
    const grid = element.querySelector<HTMLElement>(".choice-grid");
    const guide = document.querySelector<HTMLElement>(".button-guide");
    if (!grid || !guide) throw new Error("Missing tall-viewport layout elements.");
    const gridBox = grid.getBoundingClientRect();
    const guideBox = guide.getBoundingClientRect();
    return {
      guideTop: guideBox.top,
      guideBottom: guideBox.bottom,
      choiceGuideGap: guideBox.top - gridBox.bottom,
      documentHeight: document.documentElement.scrollHeight,
      viewportHeight: window.innerHeight,
    };
  });

  expect(Math.abs(startGuide.top - questionLayout.guideTop)).toBeLessThanOrEqual(0.5);
  expect(questionLayout.choiceGuideGap).toBeGreaterThanOrEqual(9);
  expect(questionLayout.choiceGuideGap).toBeLessThanOrEqual(11);
  if (EXPECTED_LANGUAGE === "ko") {
    expect(questionLayout.guideTop).toBeGreaterThanOrEqual(686);
    expect(questionLayout.guideTop).toBeLessThanOrEqual(688);
  } else {
    expect(questionLayout.guideTop).toBeGreaterThanOrEqual(726);
    expect(questionLayout.guideTop).toBeLessThanOrEqual(728);
  }
  expect(questionLayout.viewportHeight - questionLayout.guideBottom).toBeGreaterThanOrEqual(350);
  expect(questionLayout.documentHeight).toBe(questionLayout.viewportHeight);
});

test("changes a choice, then confirms only after the selected key is pressed again", async ({ page }) => {
  await openHashRoute(page, "/lesson?day=1");
  await expect(page.locator('[data-screen="lesson-start"]')).toBeVisible();

  await pressPhysicalButton(page, "topRight");
  const question = page.locator('[data-screen="lesson-question"][data-exercise-id="D1_Q1"]');
  await expect(question).toBeVisible();

  const optionA = page.locator('[data-slot="topLeft"]');
  const optionB = page.locator('[data-slot="topRight"]');
  await pressPhysicalButton(page, "topLeft");
  await expect(optionA).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator('[data-screen="lesson-feedback"]')).toHaveCount(0);

  await pressPhysicalButton(page, "topRight");
  await expect(optionA).toHaveAttribute("aria-pressed", "false");
  await expect(optionB).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator('[data-screen="lesson-feedback"]')).toHaveCount(0);

  await pressPhysicalButton(page, "topRight");
  await expect(page.locator('[data-screen="lesson-feedback"]')).toBeVisible();
});

test("loads physical key bindings from runtime config instead of hardcoding number keys", async ({ page }) => {
  await page.route("**/config/runtime.json", async (route) => {
    const response = await route.fetch();
    const runtime = await response.json() as Record<string, unknown>;
    await route.fulfill({
      response,
      json: {
        ...runtime,
        input: {
          version: 1,
          debounceMs: 200,
          bindings: {
            topLeft: { key: "q", code: "KeyQ" },
            topRight: { key: "w", code: "KeyW" },
            bottomLeft: { key: "a", code: "KeyA" },
            bottomRight: { key: "s", code: "KeyS" },
          },
        },
      },
    });
  });

  await openHashRoute(page, "/lesson?day=1");
  await pressMappedKey(page, "2");
  await expect(page.locator('[data-screen="lesson-start"]')).toBeVisible();

  await pressMappedKey(page, "w");
  await expect(page.locator('[data-screen="lesson-question"][data-exercise-id="D1_Q1"]')).toBeVisible();
  await pressMappedKey(page, "q");
  await expect(page.locator('[data-slot="topLeft"]')).toHaveAttribute("aria-pressed", "true");
});

test("completes all six day-one activities with four physical keys and stores no voice content", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: {
        getUserMedia: () => Promise.reject(new DOMException("Microphone unavailable", "NotAllowedError")),
      },
    });
  });
  const externalRequests = watchNonLoopbackRequests(page);
  await openHashRoute(page, "/lesson?day=1");
  await pressPhysicalButton(page, "topRight");

  for (const exerciseId of ["D1_Q1", "D1_Q2", "D1_Q3", "D1_Q4"]) {
    await expect(page.locator(`[data-screen="lesson-question"][data-exercise-id="${exerciseId}"]`)).toBeVisible();
    await expectQuestionViewportFit(page);
    await selectAndConfirm(page, "topLeft");
    await expect(page.locator('[data-screen="lesson-feedback"]')).toBeVisible();
    await pressPhysicalButton(page, "topRight");
  }

  const voiceQuestion = page.locator(
    '[data-screen="lesson-question"][data-exercise-id="D1_Q5"][data-question-kind="voice"]',
  );
  await expect(voiceQuestion).toBeVisible();
  await expectQuestionViewportFit(page);
  await pressPhysicalButton(page, "topRight");
  await expect(voiceQuestion.locator('[data-voice-stage="recording"]')).toBeVisible();
  await expect(page.locator(".voice-waveform")).toHaveAttribute("data-fallback", "true");
  await pressPhysicalButton(page, "topRight");
  await expect(voiceQuestion.locator('[data-voice-stage="review"]')).toBeVisible();
  await pressPhysicalButton(page, "topRight");
  await expect(page.locator('[data-screen="lesson-feedback"]')).toBeVisible();
  await pressPhysicalButton(page, "topRight");

  const sequenceQuestion = page.locator(
    '[data-screen="lesson-question"][data-exercise-id="D1_Q6"][data-question-kind="button_sequence"]',
  );
  await expect(sequenceQuestion).toBeVisible();
  await expectQuestionViewportFit(page);
  await selectAndConfirm(page, "topLeft");
  await selectAndConfirm(page, "topRight");
  await selectAndConfirm(page, "bottomLeft");
  await pressPhysicalButton(page, "topRight");
  await expect(page.locator('[data-screen="lesson-feedback"]')).toBeVisible();
  await pressPhysicalButton(page, "topRight");

  await expect(page.locator('[data-screen="result"]')).toBeVisible();
  await expect.poll(async () => page.evaluate((key) => localStorage.getItem(key), OFFLINE_PROGRESS_KEY)).not.toBeNull();

  const savedProgress = await page.evaluate((key) => {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) as Record<string, unknown> : null;
  }, OFFLINE_PROGRESS_KEY);
  expect(savedProgress).not.toBeNull();
  expect(savedProgress?.completedDays).toEqual([1]);
  expect(savedProgress?.responses).toHaveLength(6);
  expect(JSON.stringify(savedProgress)).not.toMatch(/audio|transcript|confidence|blob|media/i);
  expect(externalRequests).toEqual([]);
});

test("renders every supported hash route and unknown routes without external requests", async ({ page }) => {
  const externalRequests = watchNonLoopbackRequests(page);
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));

  const routes = [
    "/",
    "/lesson?day=1",
    "/result?day=1",
    "/kiosk",
    "/garden",
    "/family",
    "/settings",
    "/onboarding",
    "/connect/caregiver",
    "/connect/counselor",
    "/connect/counselor/participant/demo",
    "/not-a-real-route",
  ];

  for (const route of routes) {
    await openHashRoute(page, route);
    await expect(page.locator(".screen-header")).toBeVisible();
    await expect(page.locator(".button-guide")).toBeVisible();
  }

  expect(pageErrors).toEqual([]);
  expect(externalRequests).toEqual([]);
});

test("navigates kiosk menu using select-then-confirm keyboard input only", async ({ page }) => {
  await openHashRoute(page, "/kiosk");
  await expect(page.locator('[data-screen="kiosk-menu"]')).toBeVisible();

  await pressPhysicalButton(page, "topLeft");
  await expect(page.locator('[data-path="/lesson?restart=1"]')).toHaveClass(/is-selected/);
  await expect(page).toHaveURL(/#\/kiosk$/);

  await pressPhysicalButton(page, "topLeft");
  await expect(page).toHaveURL(/#\/lesson(?:\?|$)/);
  await expect(page.locator('[data-screen="lesson-start"]')).toBeVisible();
});

for (const day of [2, 3, 4, 5, 6, 7]) {
  test(`completes every authored day-${day} question with four keys only`, async ({ page }) => {
    await openHashRoute(page, `/lesson?day=${day}`);
    await pressPhysicalButton(page, "topRight");

    for (let order = 1; order <= 6; order += 1) {
      const exerciseId = `D${day}_Q${order}`;
      const question = page.locator(`[data-screen="lesson-question"][data-exercise-id="${exerciseId}"]`);
      await expect(question).toBeVisible();
      await expectQuestionViewportFit(page);
      const kind = await question.getAttribute("data-question-kind");
      if (kind === "voice") {
        await pressPhysicalButton(page, "topRight");
        await pressPhysicalButton(page, "topRight");
        await pressPhysicalButton(page, "topRight");
      } else if (kind === "button_sequence") {
        await selectAndConfirm(page, "topLeft");
        await selectAndConfirm(page, "topRight");
        await selectAndConfirm(page, "bottomLeft");
        await pressPhysicalButton(page, "topRight");
      } else {
        await selectAndConfirm(page, "topLeft");
      }
      await expect(page.locator('[data-screen="lesson-feedback"]')).toBeVisible();
      expect(await page.evaluate(() => ({
        scrollY: window.scrollY,
        overflow: document.documentElement.scrollHeight > window.innerHeight,
      }))).toEqual({ scrollY: 0, overflow: false });
      await pressPhysicalButton(page, "topRight");
    }

    await expect(page.locator('[data-screen="result"]')).toBeVisible();
    const saved = await page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? "{}"), OFFLINE_PROGRESS_KEY);
    expect(saved.completedDays).toContain(day);
    expect(saved.responses.filter((entry: { exerciseId?: string }) => entry.exerciseId?.startsWith(`D${day}_`))).toHaveLength(6);
  });
}
