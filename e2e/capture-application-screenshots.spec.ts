import { expect, test, type Page } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import path from "node:path";

type CaptureScreen = {
  name: string;
  path: string;
  selector: string;
  prepare?: (page: Page, locale: string) => Promise<void>;
};

const outputRoot =
  process.env.SCREENSHOT_OUTPUT_DIR ??
  path.resolve(process.cwd(), "피우다프로젝트", "application_assets", "auto_screenshots");

const locales = (process.env.SCREENSHOT_LOCALES ?? "ko")
  .split(",")
  .map((locale) => locale.trim())
  .filter(Boolean);

const sampleNow = new Date("2026-05-17T09:00:00+09:00").getTime();

function screenshotPath(locale: string, fileName: string) {
  return path.join(outputRoot, locale, fileName);
}

function localizedSeed(locale: string) {
  if (locale === "ja") {
    return {
      emotion: "安心",
      summary: "昨日、娘と近所の公園を散歩して、ベンチでお茶を飲んだ記憶",
      transcript: "昨日、娘と近所の公園で散歩して、ベンチでお茶を飲みました。",
      person: "娘",
      place: "近所の公園",
      object: "お茶",
      timeHint: "昨日",
    };
  }

  if (locale === "en") {
    return {
      emotion: "calm",
      summary: "A memory of walking in the neighborhood park with my daughter and drinking tea on a bench",
      transcript: "Yesterday, I walked with my daughter in the neighborhood park and drank tea on a bench.",
      person: "daughter",
      place: "neighborhood park",
      object: "tea",
      timeHint: "yesterday",
    };
  }

  return {
    emotion: "편안함",
    summary: "어제 딸과 동네 공원을 산책하고 벤치에서 차를 마신 기억",
    transcript: "어제 딸과 동네 공원에서 산책하고 벤치에서 차를 마셨습니다.",
    person: "딸",
    place: "동네 공원",
    object: "차",
    timeHint: "어제",
  };
}

async function seedCaptureState(page: Page, locale: string) {
  await page.addInitScript(
    ({ captureLocale, now }) => {
      const seed = (() => {
        if (captureLocale === "ja") {
          return {
            emotion: "安心",
            summary: "昨日、娘と近所の公園を散歩して、ベンチでお茶を飲んだ記憶",
            transcript: "昨日、娘と近所の公園で散歩して、ベンチでお茶を飲みました。",
            person: "娘",
            place: "近所の公園",
            object: "お茶",
            timeHint: "昨日",
          };
        }

        if (captureLocale === "en") {
          return {
            emotion: "calm",
            summary: "A memory of walking in the neighborhood park with my daughter and drinking tea on a bench",
            transcript: "Yesterday, I walked with my daughter in the neighborhood park and drank tea on a bench.",
            person: "daughter",
            place: "neighborhood park",
            object: "tea",
            timeHint: "yesterday",
          };
        }

        return {
          emotion: "편안함",
          summary: "어제 딸과 동네 공원을 산책하고 벤치에서 차를 마신 기억",
          transcript: "어제 딸과 동네 공원에서 산책하고 벤치에서 차를 마셨습니다.",
          person: "딸",
          place: "동네 공원",
          object: "차",
          timeHint: "어제",
        };
      })();

      const isoNow = new Date(now).toISOString();
      const yesterday = new Date(now - 24 * 60 * 60 * 1000).toISOString();
      const lastWeek = new Date(now - 8 * 24 * 60 * 60 * 1000).toISOString();

      localStorage.clear();
      localStorage.setItem("memoryGardenLang", captureLocale);
      localStorage.setItem(
        "streakState",
        JSON.stringify({
          currentStreak: 5,
          lastSessionDate: "2026-05-16",
          longestStreak: 8,
        }),
      );
      localStorage.setItem(
        "gardenState",
        JSON.stringify({
          waterDrops: 12,
          leaves: 4,
          flowers: 2,
          photoFlowers: 0,
          treeLevel: 2,
        }),
      );
      localStorage.setItem(
        "memoryCards",
        JSON.stringify([
          {
            id: "mem_capture_daily_walk",
            userId: "local_user",
            createdAt: yesterday,
            updatedAt: isoNow,
            source: "daily_lesson",
            linkedConceptId: "daily_memory_1",
            topic: "family",
            emotionTag: seed.emotion,
            textSummary: seed.summary,
            originalTranscript: seed.transcript,
            storyCues: {
              people: [seed.person],
              places: [seed.place],
              objects: [seed.object],
              emotions: [seed.emotion],
              timeHints: [seed.timeHint],
            },
            sensitivity: "personal",
            shareWithFamily: true,
            reviewState: {
              dueAt: yesterday,
              intervalDays: 1,
              ease: 2.5,
              reviewCount: 0,
            },
          },
        ]),
      );
      localStorage.setItem(
        "cognitiveRoutineResults",
        JSON.stringify([
          {
            id: "routine_capture_word_recall",
            type: "delayed_word_recall",
            timestamp: isoNow,
            completed: true,
            metadata: { phase: "recall", expectedAnswers: ["w_1", "w_3", "w_5"] },
          },
          {
            id: "routine_capture_attention",
            type: "attention_pattern",
            timestamp: isoNow,
            completed: true,
            metadata: { pattern: [12, 10, 8], selectedId: "opt_3" },
          },
          {
            id: "routine_capture_shape",
            type: "shape_copy_practice",
            timestamp: isoNow,
            completed: true,
            metadata: { hasDrawn: true },
          },
          {
            id: "routine_capture_previous",
            type: "speech_repeat_practice",
            timestamp: lastWeek,
            completed: true,
            metadata: { phraseId: "practice_1" },
          },
        ]),
      );
    },
    { captureLocale: locale, now: sampleNow },
  );
}

async function capture(page: Page, locale: string, fileName: string) {
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({
    path: screenshotPath(locale, fileName),
    fullPage: true,
  });
}

function counselorTabName(locale: string) {
  if (locale === "ja") return "カウンセラー";
  if (locale === "en") return "Counselor";
  return "상담사";
}

const screens: CaptureScreen[] = [
  {
    name: "home",
    path: "/",
    selector: '[data-screen="home"]',
  },
  {
    name: "lesson-word-encoding",
    path: "/lesson",
    selector: '[data-exercise-id="ex_1"]',
  },
  {
    name: "lesson-attention-pattern",
    path: "/lesson?captureExerciseId=ex_attention",
    selector: '[data-exercise-id="ex_attention"]',
  },
  {
    name: "lesson-shape-copy",
    path: "/lesson?captureExerciseId=ex_shape",
    selector: '[data-exercise-id="ex_shape"]',
  },
  {
    name: "lesson-memory-story",
    path: "/lesson?captureExerciseId=ex_6",
    selector: '[data-exercise-id="ex_6"]',
    prepare: async (page, locale) => {
      await page.locator("#memory-story-text").fill(localizedSeed(locale).transcript);
    },
  },
  {
    name: "lesson-memory-emotion",
    path: "/lesson?captureExerciseId=ex_7",
    selector: '[data-exercise-id="ex_7"]',
  },
  {
    name: "result",
    path: "/result",
    selector: '[data-screen="result"]',
  },
  {
    name: "garden",
    path: "/garden",
    selector: '[data-screen="garden"]',
  },
  {
    name: "family",
    path: "/family",
    selector: '[data-screen="family"]',
  },
  {
    name: "family-counselor-report",
    path: "/family",
    selector: '[data-screen="family"]',
    prepare: async (page, locale) => {
      await page.getByRole("tab", { name: counselorTabName(locale) }).click();
    },
  },
  {
    name: "settings",
    path: "/settings",
    selector: '[data-screen="settings"]',
  },
];

for (const locale of locales) {
  test.describe(`application screenshots: ${locale}`, () => {
    test.beforeEach(async ({ page }) => {
      await mkdir(path.join(outputRoot, locale), { recursive: true });
      await seedCaptureState(page, locale);
    });

    for (const [index, screen] of screens.entries()) {
      test(`captures ${screen.name}`, async ({ page }) => {
        await page.goto(screen.path);
        await expect(page.locator(screen.selector)).toBeVisible();
        await screen.prepare?.(page, locale);
        await capture(page, locale, `${String(index + 1).padStart(2, "0")}_${screen.name}.png`);
      });
    }
  });
}
