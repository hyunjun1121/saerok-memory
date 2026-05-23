import { expect, test, type Page } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import path from "node:path";

type Locale = "ko" | "ja" | "en";

type CaptureScreen = {
  name: string;
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

function screenshotPath(locale: string, fileName: string) {
  return path.join(outputRoot, locale, fileName);
}

function storyText(locale: Locale) {
  if (locale === "ja") {
    return "昨日、娘と近所の公園をゆっくり歩きました。ベンチでお茶を飲みながら、春の花を見て昔の遠足を思い出しました。";
  }

  if (locale === "en") {
    return "Yesterday, I walked slowly with my daughter in the neighborhood park and drank tea on a bench while remembering a spring picnic.";
  }

  return "어제 딸과 동네 공원을 천천히 걸었습니다. 벤치에서 차를 마시며 봄꽃을 보니 예전 소풍 생각이 났습니다.";
}

async function seedCaptureState(page: Page, locale: Locale) {
  await page.addInitScript(
    ({ captureLocale }) => {
      localStorage.clear();
      localStorage.setItem("memoryGardenLang", captureLocale);
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
            selectedDomains: ["appointments", "dailyRoutine"],
            note: observationNote,
          },
        ]),
      );
    },
    { captureLocale: locale },
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

async function capture(page: Page, locale: Locale, fileName: string) {
  await page.evaluate(() => document.fonts.ready);
  await expect(page.locator("body")).not.toContainText("??");
  await expect(page.locator("body")).not.toContainText("family.report");
  await expect(page.locator("body")).not.toContainText("family.cues");
  await expect(page.locator("body")).not.toContainText("family.observation");
  await expect(page.locator("body")).not.toContainText("exercise.");
  await page.screenshot({
    path: screenshotPath(locale, fileName),
    fullPage: true,
  });
}

function tabName(locale: Locale, tab: "caregiver" | "counselor") {
  if (tab === "caregiver") {
    if (locale === "ja") return "見守り";
    if (locale === "en") return "Caregiver";
    return "보호자";
  }

  if (locale === "ja") return "相談員";
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
    name: "lesson-delayed-word-encode",
    path: "/lesson?captureExerciseId=ex_1",
    selector: '[data-exercise-id="ex_1"]',
  },
  {
    name: "lesson-meaning-choice",
    path: "/lesson?captureExerciseId=ex_2",
    selector: '[data-exercise-id="ex_2"]',
  },
  {
    name: "lesson-situation-match",
    path: "/lesson?captureExerciseId=ex_3",
    selector: '[data-exercise-id="ex_3"]',
  },
  {
    name: "lesson-attention-pattern",
    path: "/lesson?captureExerciseId=ex_attention",
    selector: '[data-exercise-id="ex_attention"]',
  },
  {
    name: "lesson-orientation",
    path: "/lesson?captureExerciseId=ex_orientation",
    selector: '[data-exercise-id="ex_orientation"]',
  },
  {
    name: "lesson-digit-span",
    path: "/lesson?captureExerciseId=ex_digit_span",
    selector: '[data-exercise-id="ex_digit_span"]',
  },
  {
    name: "lesson-verbal-fluency",
    path: "/lesson?captureExerciseId=ex_verbal_fluency",
    selector: '[data-exercise-id="ex_verbal_fluency"]',
  },
  {
    name: "lesson-trail-switching",
    path: "/lesson?captureExerciseId=ex_trail_switching",
    selector: '[data-exercise-id="ex_trail_switching"]',
  },
  {
    name: "lesson-pair-matching",
    path: "/lesson?captureExerciseId=ex_5",
    selector: '[data-exercise-id="ex_5"]',
  },
  {
    name: "lesson-sequence-order",
    path: "/lesson?captureExerciseId=ex_sequence",
    selector: '[data-exercise-id="ex_sequence"]',
  },
  {
    name: "lesson-audio-choice",
    path: "/lesson?captureExerciseId=ex_audio",
    selector: '[data-exercise-id="ex_audio"]',
  },
  {
    name: "lesson-picture-choice",
    path: "/lesson?captureExerciseId=ex_picture",
    selector: '[data-exercise-id="ex_picture"]',
  },
  {
    name: "lesson-shape-copy",
    path: "/lesson?captureExerciseId=ex_shape",
    selector: '[data-exercise-id="ex_shape"]',
    prepare: async (page) => {
      await drawOnCanvas(page);
    },
  },
  {
    name: "lesson-speech-repeat",
    path: "/lesson?captureExerciseId=ex_speech",
    selector: '[data-exercise-id="ex_speech"]',
  },
  {
    name: "lesson-delayed-word-recall",
    path: "/lesson?captureExerciseId=ex_recall",
    selector: '[data-exercise-id="ex_recall"]',
  },
  {
    name: "lesson-memory-story",
    path: "/lesson?captureExerciseId=ex_6",
    selector: '[data-exercise-id="ex_6"]',
    prepare: async (page, locale) => {
      await page.locator("#memory-story-text").fill(storyText(locale));
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
    name: "report-counselor",
    path: "/family",
    selector: '[data-screen="family"]',
    prepare: async (page, locale) => {
      await page.getByRole("tab", { name: tabName(locale, "counselor") }).click();
    },
  },
  {
    name: "report-caregiver",
    path: "/family",
    selector: '[data-screen="family"]',
    prepare: async (page, locale) => {
      await page.getByRole("tab", { name: tabName(locale, "caregiver") }).click();
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
