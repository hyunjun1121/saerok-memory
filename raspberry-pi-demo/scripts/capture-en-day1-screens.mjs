import { mkdir, readFile, readdir, rename, rmdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

const demoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const captureLocale = process.env.SCREENSHOT_LOCALE ?? "en";
const localeConfig = {
  en: { expectedLanguage: "en", label: "English", defaultPort: 4175 },
  ja: { expectedLanguage: "ja", label: "Japanese", defaultPort: 4174 },
}[captureLocale];
if (!localeConfig) {
  throw new Error(`Unsupported screenshot locale: ${captureLocale}. Use en or ja.`);
}

const baseUrl = (
  process.env.PLAYWRIGHT_BASE_URL
    ?? `http://127.0.0.1:${localeConfig.defaultPort}`
).replace(/\/$/, "");
const runDate = new Date().toISOString().slice(0, 10).replaceAll("-", "");
const outputDirectory = path.resolve(
  process.env.SCREENSHOT_OUTPUT_DIR
    ?? path.join(demoRoot, "runtime", "visual-review", `${captureLocale}-day1-all-screens-${runDate}`),
);

const viewport = { width: 540, height: 960 };
const deviceScaleFactor = 2;
const progressStorageKey = "haru:offline:progress:v1";
const buttonKeyBySlot = {
  topLeft: "1",
  topRight: "2",
  bottomLeft: "3",
  bottomRight: "4",
};
const slotByOption = {
  A: "topLeft",
  B: "topRight",
  C: "bottomLeft",
  D: "bottomRight",
};
const dayOneResponses = [
  { exerciseId: "D1_Q1", kind: "single_choice", selectedIds: ["B"] },
  { exerciseId: "D1_Q2", kind: "single_choice", selectedIds: ["A"] },
  { exerciseId: "D1_Q3", kind: "single_choice", selectedIds: ["A"] },
  { exerciseId: "D1_Q4", kind: "single_choice", selectedIds: ["C"] },
  { exerciseId: "D1_Q5", kind: "voice", selectedIds: [] },
  { exerciseId: "D1_Q6", kind: "button_sequence", selectedIds: ["A", "B", "C"] },
];

const captures = [];
const capturedFiles = new Set();
const fileNamingConvention = `${captureLocale}-day01-screen-{sequence:03d}-{group}-{question-or-screen}-{state-or-page}.png`;

function normalizeFileSegment(value) {
  return String(value)
    .trim()
    .toLowerCase()
    .replaceAll("_", "-")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function buildCaptureFileName(sequence, details) {
  const subject = details.question ?? details.screenId;
  const state = details.page
    ? `page-${String(details.page).padStart(2, "0")}`
    : details.state;
  const segments = [
    captureLocale,
    "day01",
    "screen",
    String(sequence).padStart(3, "0"),
    details.group,
    subject,
    state,
  ]
    .filter(Boolean)
    .map(normalizeFileSegment);

  return `${segments.join("-")}.png`;
}

function initialProgress() {
  return {
    schemaVersion: 1,
    activeDay: 1,
    completedDays: [],
    responses: [],
  };
}

function progressBeforeQuestion(questionIndex) {
  return {
    ...initialProgress(),
    responses: dayOneResponses.slice(0, questionIndex).map((response) => ({
      ...response,
      responseMs: 1_000,
      completedAt: "2026-07-20T09:00:00.000Z",
    })),
  };
}

function completedDayOneProgress() {
  return {
    ...progressBeforeQuestion(dayOneResponses.length),
    completedDays: [1],
    activeDay: 2,
  };
}

async function createOutputDirectory() {
  await mkdir(path.dirname(outputDirectory), { recursive: true });
  try {
    await mkdir(outputDirectory);
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "EEXIST") {
      throw new Error(`Capture output directory already exists: ${outputDirectory}`);
    }
    throw error;
  }
}

async function removeEmptyDirectories(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const childDirectory = path.join(directory, entry.name);
    await removeEmptyDirectories(childDirectory);
    if ((await readdir(childDirectory)).length === 0) await rmdir(childDirectory);
  }
}

async function flattenExistingOutput() {
  const manifestPath = path.join(outputDirectory, "manifest.json");
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  if (!Array.isArray(manifest.captures) || manifest.captures.length === 0) {
    throw new Error(`No captures found in manifest: ${manifestPath}`);
  }

  const moves = manifest.captures.map((capture, index) => {
    const sourcePath = path.resolve(outputDirectory, capture.file);
    const sourceRelativePath = path.relative(outputDirectory, sourcePath);
    if (sourceRelativePath.startsWith("..") || path.isAbsolute(sourceRelativePath)) {
      throw new Error(`Capture file is outside the output directory: ${capture.file}`);
    }
    return {
      capture,
      sourcePath,
      sourceRelativePath,
      targetFile: buildCaptureFileName(index + 1, capture),
    };
  });

  const targetFiles = new Set();
  for (const move of moves) {
    if (targetFiles.has(move.targetFile)) {
      throw new Error(`Duplicate flattened capture name: ${move.targetFile}`);
    }
    targetFiles.add(move.targetFile);
  }

  const rootNames = new Set(await readdir(outputDirectory));
  for (const move of moves) {
    if (move.sourceRelativePath !== move.targetFile && rootNames.has(move.targetFile)) {
      throw new Error(`Refusing to overwrite existing capture: ${move.targetFile}`);
    }
  }

  for (const move of moves) {
    if (move.sourceRelativePath !== move.targetFile) {
      await rename(move.sourcePath, path.join(outputDirectory, move.targetFile));
    }
  }
  await removeEmptyDirectories(outputDirectory);

  manifest.schemaVersion = 2;
  manifest.fileLayout = "flat";
  manifest.fileNamingConvention = fileNamingConvention;
  manifest.flattenedAt = new Date().toISOString();
  manifest.captures = moves.map(({ capture, targetFile }) => ({ ...capture, file: targetFile }));
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  process.stdout.write(`Flattened ${moves.length} ${localeConfig.label} kiosk screens in ${outputDirectory}\n`);
}

function getPngDimensions(buffer) {
  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
  };
}

function isLocalRequest(url) {
  const parsed = new URL(url);
  return parsed.origin === new URL(baseUrl).origin;
}

async function pressKey(page, key) {
  await page.keyboard.press(key);
  await page.waitForTimeout(230);
}

async function pressSlot(page, slot) {
  await pressKey(page, buttonKeyBySlot[slot]);
}

async function openRoute(page, route) {
  await page.goto(`${baseUrl}/#${route}`, { waitUntil: "networkidle" });
  await page.locator(".offline-app").waitFor();
}

async function enterDayOneStart(page) {
  await openRoute(page, "/lesson?day=1");
  await page.locator('[data-screen="nfc-login"]').waitFor();
  await pressKey(page, "5");
  await page.locator('[data-screen="lesson-start"]').waitFor();
}

async function openDayOneQuestion(page, questionIndex) {
  await enterDayOneStart(page);
  await pressKey(page, "2");
  await page.locator(`[data-screen="lesson-question"][data-exercise-id="D1_Q${questionIndex + 1}"]`).waitFor();
}

async function waitForPageIndex(page, expectedIndex) {
  await page.waitForFunction((index) => {
    const pages = [...document.querySelectorAll(".route-pages span")];
    return pages.findIndex((item) => item.classList.contains("is-active")) === index;
  }, expectedIndex);
}

async function capture(session, details) {
  const relativePath = buildCaptureFileName(captures.length + 1, details);
  if (capturedFiles.has(relativePath)) {
    throw new Error(`Duplicate capture path: ${relativePath}`);
  }

  const { page, issues, externalRequests } = session;
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(80);

  const state = await page.evaluate(() => {
    const rootScreen = document.querySelector("[data-screen]");
    return {
      language: document.documentElement.lang,
      viewport: [window.innerWidth, window.innerHeight],
      deviceScaleFactor: window.devicePixelRatio,
      documentHeight: document.documentElement.scrollHeight,
      bodyTextLength: document.body.innerText.trim().length,
      screen: rootScreen?.getAttribute("data-screen") ?? "info-card",
      hasErrorOverlay: Boolean(document.querySelector(".vite-error-overlay, [data-nextjs-dialog], #webpack-dev-server-client-overlay")),
    };
  });

  if (issues.length > 0) {
    throw new Error(`Browser errors before ${relativePath}: ${issues.join(" | ")}`);
  }
  if (externalRequests.length > 0) {
    throw new Error(`External requests before ${relativePath}: ${externalRequests.join(" | ")}`);
  }
  if (state.language !== localeConfig.expectedLanguage) {
    throw new Error(`Expected ${localeConfig.label} build for ${relativePath}; received ${state.language}.`);
  }
  if (state.viewport[0] !== viewport.width || state.viewport[1] !== viewport.height) {
    throw new Error(`Unexpected viewport for ${relativePath}: ${state.viewport.join("×")}.`);
  }
  if (state.deviceScaleFactor !== deviceScaleFactor) {
    throw new Error(`Unexpected device scale factor for ${relativePath}: ${state.deviceScaleFactor}.`);
  }
  if (state.documentHeight > viewport.height || state.bodyTextLength === 0 || state.hasErrorOverlay) {
    throw new Error(`Capture state is not viewport-safe for ${relativePath}: ${JSON.stringify(state)}.`);
  }

  const absolutePath = path.join(outputDirectory, relativePath);
  await page.screenshot({ path: absolutePath, fullPage: false, animations: "disabled" });
  const dimensions = getPngDimensions(await readFile(absolutePath));
  if (dimensions.width !== viewport.width * deviceScaleFactor || dimensions.height !== viewport.height * deviceScaleFactor) {
    throw new Error(`Unexpected PNG dimensions for ${relativePath}: ${dimensions.width}×${dimensions.height}.`);
  }

  capturedFiles.add(relativePath);
  captures.push({ file: relativePath, ...details, screen: state.screen, ...dimensions });
  process.stdout.write(`${String(captures.length).padStart(2, "0")} ${relativePath}\n`);
}

async function withPage(browser, progress, callback) {
  const context = await browser.newContext({
    viewport,
    deviceScaleFactor,
    hasTouch: false,
    isMobile: false,
    colorScheme: "light",
    reducedMotion: "reduce",
  });
  const page = await context.newPage();
  const issues = [];
  const externalRequests = [];

  page.on("pageerror", (error) => issues.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") issues.push(message.text());
  });
  page.on("request", (request) => {
    const url = request.url();
    if (url.startsWith("data:") || url.startsWith("blob:") || isLocalRequest(url)) return;
    externalRequests.push(url);
  });
  await page.addInitScript(
    ({ storageKey, storedProgress }) => {
      localStorage.setItem(storageKey, JSON.stringify(storedProgress));
    },
    { storageKey: progressStorageKey, storedProgress: progress },
  );

  try {
    await callback({ page, issues, externalRequests });
  } finally {
    await context.close();
  }
}

async function captureChoiceQuestion(browser, question) {
  await withPage(browser, progressBeforeQuestion(question.index), async (session) => {
    await openDayOneQuestion(session.page, question.index);
    await capture(session, { group: "lesson", question: question.id, state: "idle" });
  });

  for (const option of ["A", "B", "C", "D"]) {
    await withPage(browser, progressBeforeQuestion(question.index), async (session) => {
      await openDayOneQuestion(session.page, question.index);
      await pressSlot(session.page, slotByOption[option]);
      await capture(session, {
        group: "lesson",
        question: question.id,
        state: `selected-${option.toLowerCase()}`,
      });
    });
  }

  if (question.correctOption) {
    await withPage(browser, progressBeforeQuestion(question.index), async (session) => {
      await openDayOneQuestion(session.page, question.index);
      const slot = slotByOption[question.correctOption];
      await pressSlot(session.page, slot);
      await pressSlot(session.page, slot);
      await session.page.locator('[data-screen="lesson-feedback"]').waitFor();
      await capture(session, {
        group: "lesson",
        question: question.id,
        state: "feedback-correct",
      });
    });
    await withPage(browser, progressBeforeQuestion(question.index), async (session) => {
      await openDayOneQuestion(session.page, question.index);
      const slot = slotByOption[question.wrongOption];
      await pressSlot(session.page, slot);
      await pressSlot(session.page, slot);
      await session.page.locator('[data-screen="lesson-feedback"]').waitFor();
      await capture(session, {
        group: "lesson",
        question: question.id,
        state: "feedback-different",
      });
    });
    return;
  }

  await withPage(browser, progressBeforeQuestion(question.index), async (session) => {
    await openDayOneQuestion(session.page, question.index);
    const slot = slotByOption[question.submittedOption];
    await pressSlot(session.page, slot);
    await pressSlot(session.page, slot);
    await session.page.locator('[data-screen="lesson-feedback"]').waitFor();
    await capture(session, {
      group: "lesson",
      question: question.id,
      state: "feedback-saved",
    });
  });
}

async function captureVoiceQuestion(browser) {
  await withPage(browser, progressBeforeQuestion(4), async (session) => {
    const { page } = session;
    await openDayOneQuestion(page, 4);
    await capture(session, { group: "lesson", question: "D1_Q5", state: "ready" });

    await pressKey(page, "2");
    await page.locator('[data-voice-stage="recording"]').waitFor();
    await page.waitForFunction(() => document.querySelector(".voice-waveform")?.getAttribute("data-fallback") === "true");
    await capture(session, {
      group: "lesson",
      question: "D1_Q5",
      state: "recording-fallback",
    });

    await pressKey(page, "2");
    await page.locator('[data-voice-stage="review"]').waitFor();
    await capture(session, { group: "lesson", question: "D1_Q5", state: "review" });

    await pressKey(page, "2");
    await page.locator('[data-screen="lesson-feedback"]').waitFor();
    await capture(session, {
      group: "lesson",
      question: "D1_Q5",
      state: "feedback-saved",
    });
  });
}

async function captureSequenceQuestion(browser) {
  await withPage(browser, progressBeforeQuestion(5), async (session) => {
    const { page } = session;
    await openDayOneQuestion(page, 5);
    await capture(session, { group: "lesson", question: "D1_Q6", state: "idle" });

    await pressSlot(page, "topLeft");
    await capture(session, { group: "lesson", question: "D1_Q6", state: "step-1-selected" });
    await pressSlot(page, "topLeft");
    await capture(session, { group: "lesson", question: "D1_Q6", state: "step-1-confirmed" });

    await pressSlot(page, "topRight");
    await capture(session, { group: "lesson", question: "D1_Q6", state: "step-2-selected" });
    await pressSlot(page, "topRight");
    await capture(session, { group: "lesson", question: "D1_Q6", state: "step-2-confirmed" });

    await pressSlot(page, "bottomLeft");
    await capture(session, { group: "lesson", question: "D1_Q6", state: "step-3-selected" });
    await pressSlot(page, "bottomLeft");
    await capture(session, { group: "lesson", question: "D1_Q6", state: "review-correct-order" });

    await pressKey(page, "2");
    await page.locator('[data-screen="lesson-feedback"]').waitFor();
    await capture(session, { group: "lesson", question: "D1_Q6", state: "feedback-correct" });
  });

  await withPage(browser, progressBeforeQuestion(5), async (session) => {
    const { page } = session;
    await openDayOneQuestion(page, 5);
    for (const slot of ["bottomRight", "bottomLeft", "topRight"]) {
      await pressSlot(page, slot);
      await pressSlot(page, slot);
    }
    await capture(session, { group: "lesson", question: "D1_Q6", state: "review-different-order" });
    await pressKey(page, "2");
    await page.locator('[data-screen="lesson-feedback"]').waitFor();
    await capture(session, { group: "lesson", question: "D1_Q6", state: "feedback-different" });
  });
}

async function captureSpatialMenu(browser, route, screenId) {
  await withPage(browser, initialProgress(), async (session) => {
    await openRoute(session.page, route);
    await session.page.locator(`[data-screen="${screenId}"]`).waitFor();
    await capture(session, { group: "navigation", screenId, state: "idle" });
  });

  for (const [option, slot] of Object.entries(slotByOption)) {
    await withPage(browser, initialProgress(), async (session) => {
      await openRoute(session.page, route);
      await session.page.locator(`[data-screen="${screenId}"]`).waitFor();
      await pressSlot(session.page, slot);
      await capture(session, {
        group: "navigation",
        screenId,
        state: `selected-${option.toLowerCase()}`,
      });
    });
  }
}

async function capturePagedRoute(browser, route, totalPages, details) {
  await withPage(browser, initialProgress(), async (session) => {
    const { page } = session;
    await openRoute(page, route);
    await page.locator(".route-pages").waitFor();
    for (let pageIndex = 0; pageIndex < totalPages; pageIndex += 1) {
      await waitForPageIndex(page, pageIndex);
      await capture(session, {
        group: "navigation",
        ...details,
        page: pageIndex + 1,
      });
      if (pageIndex < totalPages - 1) await pressKey(page, "2");
    }
  });
}

async function main() {
  if (process.argv.includes("--flatten-existing")) {
    await flattenExistingOutput();
    return;
  }

  await createOutputDirectory();
  const browser = await chromium.launch({ headless: true });

  try {
    await withPage(browser, initialProgress(), async (session) => {
      await openRoute(session.page, "/lesson?day=1");
      await session.page.locator('[data-screen="nfc-login"]').waitFor();
      await capture(session, { group: "entry", state: "nfc-login" });
    });
    await withPage(browser, progressBeforeQuestion(0), async (session) => {
      await enterDayOneStart(session.page);
      await capture(session, { group: "entry", state: "day1-start" });
    });
    await withPage(browser, completedDayOneProgress(), async (session) => {
      await openRoute(session.page, "/result?day=1");
      await session.page.locator('[data-screen="result"]').waitFor();
      await capture(session, { group: "entry", state: "day1-complete" });
    });

    await captureChoiceQuestion(browser, { id: "D1_Q1", index: 0, submittedOption: "B" });
    await captureChoiceQuestion(browser, { id: "D1_Q2", index: 1, correctOption: "A", wrongOption: "D" });
    await captureChoiceQuestion(browser, { id: "D1_Q3", index: 2, correctOption: "A", wrongOption: "D" });
    await captureChoiceQuestion(browser, { id: "D1_Q4", index: 3, correctOption: "C", wrongOption: "A" });
    await captureVoiceQuestion(browser);
    await captureSequenceQuestion(browser);

    await captureSpatialMenu(browser, "/kiosk", "kiosk-menu");
    await withPage(browser, initialProgress(), async (session) => {
      await openRoute(session.page, "/garden");
      await session.page.locator(".info-card").waitFor();
      await capture(session, { group: "navigation", screenId: "garden", state: "info" });
    });
    await captureSpatialMenu(browser, "/family", "family-menu");

    await withPage(browser, initialProgress(), async (session) => {
      const { page } = session;
      await openRoute(page, "/connect");
      await page.locator('[data-screen="support-connection"]').waitFor();
      await capture(session, { group: "navigation", screenId: "support-connection", state: "idle" });
      await pressKey(page, "2");
      await capture(session, { group: "navigation", screenId: "support-connection", state: "caregiver-selected" });
      await pressKey(page, "2");
      await page.locator('[data-connect-role="caregiver"]').waitFor();
      await capture(session, { group: "navigation", screenId: "support-connection", state: "caregiver-code" });
      await pressKey(page, "4");
      await capture(session, { group: "navigation", screenId: "support-connection", state: "counselor-selected" });
      await pressKey(page, "4");
      await page.locator('[data-connect-role="counselor"]').waitFor();
      await capture(session, { group: "navigation", screenId: "support-connection", state: "counselor-code" });
    });

    await capturePagedRoute(browser, "/settings", 3, { screenId: "settings" });
    await capturePagedRoute(browser, "/onboarding", 3, { screenId: "onboarding" });
    await capturePagedRoute(browser, "/connect/caregiver", 7, { screenId: "caregiver-report" });
    await capturePagedRoute(browser, "/connect/counselor", 7, { screenId: "counselor-report" });
    await capturePagedRoute(browser, "/connect/counselor/participant/demo", 7, { screenId: "participant-report" });
  } finally {
    await browser.close();
  }

  const manifest = {
    schemaVersion: 2,
    generatedAt: new Date().toISOString(),
    locale: captureLocale,
    scope: `${localeConfig.label} kiosk app: all stable routes plus the complete Day 1 lesson state matrix. Days 2–7 lesson questions are intentionally excluded.`,
    baseUrl,
    viewport,
    deviceScaleFactor,
    imageDimensions: { width: viewport.width * deviceScaleFactor, height: viewport.height * deviceScaleFactor },
    fileLayout: "flat",
    fileNamingConvention,
    captureCount: captures.length,
    captures,
  };
  await writeFile(path.join(outputDirectory, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  process.stdout.write(`Captured ${captures.length} ${localeConfig.label} kiosk screens in ${outputDirectory}\n`);
}

await main();
