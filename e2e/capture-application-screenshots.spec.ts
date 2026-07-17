import { expect, test, type Page } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import {
  HARU_WEEK_PLAN,
  HARU_WEEK_QUESTION_META,
} from "../src/data/haru7DayExercises";
import { mockExercises } from "../src/data/mockExercises";

type Locale = "ko" | "ja" | "en";

type CaptureScreen = {
  name: string;
  fileNameKo: string;
  path: string;
  selector: string;
  prepare?: (page: Page, locale: Locale) => Promise<void>;
};

const outputRoot =
  process.env.SCREENSHOT_OUTPUT_DIR ??
  path.resolve(process.cwd(), "피우다프로젝트", "application_assets", "auto_screenshots");
const locales = (process.env.SCREENSHOT_LOCALES ?? "ko,ja,en")
  .split(",")
  .map((locale) => locale.trim())
  .filter((locale): locale is Locale => ["ko", "ja", "en"].includes(locale));
const isFlatOutput = process.env.SCREENSHOT_FLAT_OUTPUT === "1";
const captureViewportWidth = Number(process.env.SCREENSHOT_VIEWPORT_WIDTH ?? "540");
const captureViewportHeight = Number(process.env.SCREENSHOT_VIEWPORT_HEIGHT ?? "960");

type CapturePersonalization = {
  kind: "none" | "profile" | "prior_response";
  sourceQuestionIds?: string[];
};

type CaptureHaruResponse = {
  questionId: string;
  responseType: "single_choice" | "voice" | "button_sequence";
  selectedOptionId?: string;
  submittedSequence?: string[];
  responseTimeMs: number;
  isCorrect: boolean | null;
  voiceDurationSeconds?: number;
  sttStatus?: "completed" | "failed";
  sttConfidence?: number;
  personalization: CapturePersonalization;
};

type CaptureHaruSession = {
  day: number;
  status: "completed";
  questionIds: string[];
  questionCount: number;
  startedAt: string;
  endedAt: string;
  durationSeconds: number;
  completionMessage: string;
  responses: CaptureHaruResponse[];
};

function localizedText(
  value: string | { ko: string; ja: string; en: string },
  locale: Locale,
): string {
  return typeof value === "string" ? value : (value[locale] ?? value.ko);
}

function capturePersonalization(
  scriptedSource: (typeof HARU_WEEK_QUESTION_META)[number]["scriptedSource"],
): CapturePersonalization {
  if (!scriptedSource) return { kind: "none" };
  if (scriptedSource.kind === "profile") return { kind: "profile" };
  return {
    kind: "prior_response",
    sourceQuestionIds: [scriptedSource.sourceQuestionId],
  };
}

function assertCanonicalHaruSessions(sessions: readonly CaptureHaruSession[]): void {
  const responses = sessions.flatMap((session) => session.responses);
  const evaluatedResponses = responses.filter(
    (response) => typeof response.isCorrect === "boolean",
  );
  const totals = [
    sessions.length,
    responses.length,
    evaluatedResponses.length,
    evaluatedResponses.filter((response) => response.isCorrect).length,
    responses.filter((response) => response.responseType === "voice").length,
  ];

  if (totals.join("/") !== "7/42/28/27/7") {
    throw new Error(`Invalid canonical Haru capture fixture: ${totals.join("/")}`);
  }
}

function buildCanonicalHaruSessions(locale: Locale): CaptureHaruSession[] {
  const sessions = HARU_WEEK_PLAN.map((plan) => {
    const questions = HARU_WEEK_QUESTION_META
      .filter((question) => question.day === plan.day)
      .sort((left, right) => left.order - right.order);
    const startedAt = new Date(`${plan.dateISO}T10:00:00+09:00`);
    const endedAt = new Date(
      startedAt.getTime() + plan.recordedSummary.durationSeconds * 1_000,
    );

    return {
      day: plan.day,
      status: "completed",
      questionIds: [...plan.exerciseIds],
      questionCount: plan.exerciseIds.length,
      startedAt: startedAt.toISOString(),
      endedAt: endedAt.toISOString(),
      durationSeconds: plan.recordedSummary.durationSeconds,
      completionMessage: localizedText(plan.completionMessage, locale),
      responses: questions.map((question) => {
        const recorded = question.recordedResponse;
        return {
          questionId: question.exerciseId,
          responseType: question.responseType,
          responseTimeMs: recorded.responseTimeMs,
          isCorrect: recorded.isCorrect,
          ...(recorded.selectedOptionId
            ? { selectedOptionId: recorded.selectedOptionId }
            : {}),
          ...(recorded.submittedSequence
            ? { submittedSequence: [...recorded.submittedSequence] }
            : {}),
          ...(recorded.voiceDurationSeconds !== undefined
            ? { voiceDurationSeconds: recorded.voiceDurationSeconds }
            : {}),
          ...(recorded.sttStatus ? { sttStatus: recorded.sttStatus } : {}),
          ...(recorded.sttConfidence !== undefined
            ? { sttConfidence: recorded.sttConfidence }
            : {}),
          personalization: capturePersonalization(question.scriptedSource),
        };
      }),
    };
  });
  assertCanonicalHaruSessions(sessions);
  return sessions;
}

function screenshotPath(locale: string, fileName: string) {
  if (isFlatOutput) {
    return path.join(outputRoot, fileName);
  }
  return path.join(outputRoot, locale, fileName);
}

async function seedCaptureState(page: Page, locale: Locale) {
  const canonicalHaruSessions = buildCanonicalHaruSessions(locale);
  await page.addInitScript(
    ({ captureLocale, haruDemoSessions }) => {
      localStorage.clear();
      localStorage.setItem("memoryGardenLang", captureLocale);
      localStorage.setItem("haruDemoSessions", JSON.stringify(haruDemoSessions));
      // App has no Home hub: "/" redirects to /lesson (the routine start screen).
      // Seed an onboarded learner profile so deep links to /lesson stay put
      // (LaunchGate no longer auto-navigates).
      localStorage.setItem(
        "learnerProfile",
        JSON.stringify({
          preferredInputMode: "mixed",
          largeTextMode: false,
          kioskModePreferred: false,
          autoStartTodayRoutine: false,
          soundFeedbackEnabled: true,
          onboarded: true,
          createdAt: "2026-05-01T00:00:00.000Z",
          updatedAt: "2026-05-01T00:00:00.000Z",
        }),
      );
      localStorage.setItem(
        "streakState",
        JSON.stringify({
          currentStreak: 12,
          lastSessionDate: "2026-05-17",
          longestStreak: 18,
        }),
      );
      localStorage.setItem(
        "gardenState",
        JSON.stringify({
          waterDrops: 24,
          leaves: 9,
          flowers: 5,
          photoFlowers: 1,
          treeLevel: 4,
        }),
      );
      const observationNote =
        captureLocale === "ja"
          ? "約束の時間を一度確認することが増えましたが、朝の散歩は続いています。"
          : captureLocale === "en"
            ? "Appointment times need one extra reminder, but the morning walk is still steady."
            : "약속 시간을 한 번 더 확인하는 일이 늘었지만, 아침 산책은 잘 이어가고 있습니다.";
      localStorage.setItem(
        "caregiverObservationRecords",
        JSON.stringify([
          {
            id: "capture_observation_1",
            createdAt: "2026-05-20T09:00:00.000Z",
            selectedDomains: ["appointments", "dailyRoutine", "sleepAppetite"],
            domainResponses: {
              appointments: "occasionallyDifferent",
              dailyRoutine: "aboutSame",
              sleepAppetite: "notSure",
            },
            note: observationNote,
          },
        ]),
      );
    },
    { captureLocale: locale, haruDemoSessions: canonicalHaruSessions },
  );
}

async function drawOnCanvas(page: Page) {
  const canvas = page.locator("canvas").first();
  await expect(canvas).toBeVisible();
  const box = await canvas.boundingBox();
  if (!box) return;

  await page.mouse.move(box.x + 80, box.y + 130);
  await page.mouse.down();
  await page.mouse.move(box.x + 140, box.y + 55);
  await page.mouse.move(box.x + 220, box.y + 130);
  await page.mouse.move(box.x + 220, box.y + 175);
  await page.mouse.move(box.x + 80, box.y + 175);
  await page.mouse.move(box.x + 80, box.y + 130);
  await page.mouse.up();
}

// Start the speech panel's recording so the listening state (red pulse +
// equalizer) is visible in the screenshot. Chromium lacks Web Speech
// Recognition, so SpeechCapturePanel falls back to MediaRecorder with the fake
// mic stream — isListening flips on once getUserMedia resolves.
async function startListening(page: Page) {
  const toggle = page.locator("[data-recording-toggle]").first();
  if ((await toggle.count()) > 0) {
    await toggle.click();
    await page.waitForTimeout(600);
  }
}

async function capture(page: Page, locale: Locale, fileName: string, selector: string) {
  await page.evaluate(() => document.fonts.ready);
  await expect(page.locator("body")).not.toContainText("??");
  await expect(page.locator("body")).not.toContainText("family.report");
  await expect(page.locator("body")).not.toContainText("family.cues");
  await expect(page.locator("body")).not.toContainText("family.observation");
  await expect(page.locator("body")).not.toContainText("family.advisory");
  await expect(page.locator("body")).not.toContainText("exercise.");
  const target = await page.locator(selector).first();
  await expect(target).toBeVisible();
  await target.scrollIntoViewIfNeeded();
  await page.waitForTimeout(120);
  const scale = await page.evaluate(
    ({ targetSelector, viewportHeight }) => {
      const target = document.querySelector(targetSelector) as HTMLElement | null;
      if (!target) {
        return 1;
      }
      const targetRect = target.getBoundingClientRect();
      if (targetRect.height <= viewportHeight) {
        return 1;
      }
      const rawScale = (viewportHeight * 0.98) / targetRect.height;
      return Math.max(0.7, rawScale);
    },
    { targetSelector: selector, viewportHeight: captureViewportHeight },
  );
  if (scale < 1) {
    await page.evaluate((zoomScale) => {
      document.body.style.zoom = `${zoomScale}`;
    }, scale);
  } else {
    await page.evaluate(() => {
      document.body.style.zoom = "";
    });
  }
  await page.screenshot({
    path: screenshotPath(locale, fileName),
    fullPage: false,
    animations: "disabled",
  });
  await page.evaluate(() => {
    document.body.style.zoom = "";
  });
}

// Per-exercise prepare step. Voice screens (verbal fluency / speech repeat,
// and personal_memory_recall "story" mode which auto-records) get the listening
// state captured; shape-copy gets a traced stroke. Everything else is static.
function prepareFor(ex: (typeof mockExercises)[number]): CaptureScreen["prepare"] {
  if (ex.type === "shape_copy_practice") {
    return async (page) => {
      await drawOnCanvas(page);
    };
  }
  const isVoice =
    ex.type === "verbal_fluency_practice" ||
    ex.type === "speech_repeat_practice" ||
    (ex.type === "personal_memory_recall" && ex.payload?.memoryField === "story");
  if (isVoice) {
    return async (page) => {
      await startListening(page);
    };
  }
  return undefined;
}

// Demo deck: lesson intro, EVERY exercise in the catalog (captured by deeplink,
// which renders each exactly as authored regardless of whether it is in the
// live routine — so the deck stays complete as exercises are added), then the
// post-routine connect flow. /result has two buttons; pressing each reveals a
// pairing code — both reveal states are captured, plus the two /connect
// destinations reached via "미리보기".
let deckNo = 0;
const nextDeckNo = () => String(++deckNo).padStart(2, "0");

const screens: CaptureScreen[] = [
  {
    name: "lesson-start",
    fileNameKo: `${nextDeckNo()}_레슨_시작화면.png`,
    path: "/lesson?day=1",
    selector: '[data-screen="lesson-start"], [data-screen="lesson"] main',
  },
  ...mockExercises.map((ex) => ({
    name: `lesson-${ex.id}`,
    fileNameKo: `${nextDeckNo()}_${ex.id}.png`,
    path: `/lesson?captureExerciseId=${ex.id}`,
    selector: `[data-exercise-id="${ex.id}"]`,
    prepare: prepareFor(ex),
  })),
  {
    name: "result",
    fileNameKo: `${nextDeckNo()}_세션_결과.png`,
    path: "/result",
    selector: '[data-screen="result"]',
  },
  {
    // /result → press caregiver button (1st) → pairing-code reveal.
    name: "result-caregiver-code",
    fileNameKo: `${nextDeckNo()}_결과_보호자연결.png`,
    path: "/result",
    selector: '[data-screen="result"]',
    prepare: async (page) => {
      await page.locator('[data-screen="result"]').getByRole("button").nth(0).click();
      await page.waitForTimeout(300);
    },
  },
  {
    // /result → press counselor button (2nd) → pairing-code reveal.
    name: "result-counselor-code",
    fileNameKo: `${nextDeckNo()}_결과_상담사연결.png`,
    path: "/result",
    selector: '[data-screen="result"]',
    prepare: async (page) => {
      await page.locator('[data-screen="result"]').getByRole("button").nth(1).click();
      await page.waitForTimeout(300);
    },
  },
  {
    // Standalone caregiver view (/connect/caregiver). Tall — zoom-to-fit.
    name: "connect-caregiver",
    fileNameKo: `${nextDeckNo()}_보호자_앱.png`,
    path: "/connect/caregiver",
    selector: '[data-screen="caregiver-app"]',
  },
  {
    // Standalone counselor ops view (/connect/counselor). Tall — zoom-to-fit.
    name: "connect-counselor",
    fileNameKo: `${nextDeckNo()}_상담사_앱.png`,
    path: "/connect/counselor",
    selector: '[data-screen="counselor-app"]',
  },
  {
    // One-week participant detail. Tall — zoom-to-fit.
    name: "connect-counselor-participant",
    fileNameKo: `${nextDeckNo()}_상담사_참여자_상세.png`,
    path: "/connect/counselor/participant/1",
    selector: '[data-screen="counselor-participant"]',
  },
];

for (const locale of locales) {
  test.describe(`application screenshots: ${locale}`, () => {
    test.beforeEach(async ({ page }) => {
      await mkdir(outputRoot, { recursive: true });
      if (!isFlatOutput) {
        await mkdir(path.join(outputRoot, locale), { recursive: true });
      }
      await page.setViewportSize({
        width: captureViewportWidth,
        height: captureViewportHeight,
      });
      await seedCaptureState(page, locale);
    });

    for (const screen of screens) {
      test(`captures ${screen.name}`, async ({ page }) => {
        await page.goto(screen.path);
        await expect(page.locator(screen.selector)).toBeVisible();
        await screen.prepare?.(page, locale);
        await page.waitForTimeout(250);
        await capture(page, locale, screen.fileNameKo, screen.selector);
      });
    }
  });
}
