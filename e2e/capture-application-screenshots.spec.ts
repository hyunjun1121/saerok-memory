import { expect, test, type Page } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import path from "node:path";

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
const captureViewportWidth = Number(process.env.SCREENSHOT_VIEWPORT_WIDTH ?? "390");
const captureViewportHeight = Number(process.env.SCREENSHOT_VIEWPORT_HEIGHT ?? "960");

function screenshotPath(locale: string, fileName: string) {
  if (isFlatOutput) {
    return path.join(outputRoot, fileName);
  }
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
    name: "lesson-start",
    fileNameKo: "01_레슨_시작화면.png",
    path: "/lesson",
    selector: '[data-screen="lesson-start"], [data-screen="lesson"], [data-screen="home"] main',
  },
  {
    name: "home",
    fileNameKo: "02_메인_홈화면.png",
    path: "/",
    selector: '[data-screen="home"]',
  },
  {
    name: "lesson-delayed-word-encode",
    fileNameKo: "03_지연회상_단어_암기.png",
    path: "/lesson?captureExerciseId=ex_1",
    selector: '[data-exercise-id="ex_1"]',
  },
  {
    name: "lesson-meaning-choice",
    fileNameKo: "04_의미_선택.png",
    path: "/lesson?captureExerciseId=ex_2",
    selector: '[data-exercise-id="ex_2"]',
  },
  {
    name: "lesson-situation-match",
    fileNameKo: "05_상황_매칭.png",
    path: "/lesson?captureExerciseId=ex_3",
    selector: '[data-exercise-id="ex_3"]',
  },
  {
    name: "lesson-attention-pattern",
    fileNameKo: "06_주의집중_숫자_패턴.png",
    path: "/lesson?captureExerciseId=ex_attention",
    selector: '[data-exercise-id="ex_attention"]',
  },
  {
    name: "lesson-orientation",
    fileNameKo: "07_일상일정_인증.png",
    path: "/lesson?captureExerciseId=ex_orientation",
    selector: '[data-exercise-id="ex_orientation"]',
  },
  {
    name: "lesson-digit-span",
    fileNameKo: "08_작업기억_숫자기억.png",
    path: "/lesson?captureExerciseId=ex_digit_span",
    selector: '[data-exercise-id="ex_digit_span"]',
  },
  {
    name: "lesson-verbal-fluency",
    fileNameKo: "09_단어_연상_연습.png",
    path: "/lesson?captureExerciseId=ex_verbal_fluency",
    selector: '[data-exercise-id="ex_verbal_fluency"]',
  },
  {
    name: "lesson-trail-switching",
    fileNameKo: "10_주의전환_선_잇기.png",
    path: "/lesson?captureExerciseId=ex_trail_switching",
    selector: '[data-exercise-id="ex_trail_switching"]',
  },
  {
    name: "lesson-pair-matching",
    fileNameKo: "11_단어쌍_매칭.png",
    path: "/lesson?captureExerciseId=ex_5",
    selector: '[data-exercise-id="ex_5"]',
  },
  {
    name: "lesson-sequence-order",
    fileNameKo: "12_순서_기억_정렬.png",
    path: "/lesson?captureExerciseId=ex_sequence",
    selector: '[data-exercise-id="ex_sequence"]',
  },
  {
    name: "lesson-audio-choice",
    fileNameKo: "13_듣기_선택.png",
    path: "/lesson?captureExerciseId=ex_audio",
    selector: '[data-exercise-id="ex_audio"]',
  },
  {
    name: "lesson-picture-choice",
    fileNameKo: "14_그림_선택.png",
    path: "/lesson?captureExerciseId=ex_picture",
    selector: '[data-exercise-id="ex_picture"]',
  },
  {
    name: "lesson-shape-copy",
    fileNameKo: "15_도형_그리기.png",
    path: "/lesson?captureExerciseId=ex_shape",
    selector: '[data-exercise-id="ex_shape"]',
    prepare: async (page) => {
      await drawOnCanvas(page);
    },
  },
  {
    name: "lesson-speech-repeat",
    fileNameKo: "16_음성_반복.png",
    path: "/lesson?captureExerciseId=ex_speech",
    selector: '[data-exercise-id="ex_speech"]',
  },
  {
    name: "lesson-delayed-word-recall",
    fileNameKo: "17_지연회상_단어_회상.png",
    path: "/lesson?captureExerciseId=ex_recall",
    selector: '[data-exercise-id="ex_recall"]',
  },
  {
    name: "lesson-memory-story",
    fileNameKo: "18_개인기억_이야기.png",
    path: "/lesson?captureExerciseId=ex_6",
    selector: '[data-exercise-id="ex_6"]',
    prepare: async (page, locale) => {
      await page.locator("#memory-story-text").fill(storyText(locale));
    },
  },
  {
    name: "lesson-memory-emotion",
    fileNameKo: "19_개인기억_감정_선택.png",
    path: "/lesson?captureExerciseId=ex_7",
    selector: '[data-exercise-id="ex_7"]',
  },
  {
    name: "result",
    fileNameKo: "20_세션_결과.png",
    path: "/result",
    selector: '[data-screen="result"]',
  },
  {
    name: "garden",
    fileNameKo: "21_기억_정원.png",
    path: "/garden",
    selector: '[data-screen="garden"]',
  },
  {
    name: "report-counselor",
    fileNameKo: "22_상담사_보고서.png",
    path: "/family",
    selector: '[data-screen="family"]',
    prepare: async (page, locale) => {
      await page.getByRole("tab", { name: tabName(locale, "counselor") }).click();
    },
  },
  {
    name: "report-caregiver",
    fileNameKo: "23_보호자_보고서.png",
    path: "/family",
    selector: '[data-screen="family"]',
    prepare: async (page, locale) => {
      await page.getByRole("tab", { name: tabName(locale, "caregiver") }).click();
    },
  },
  {
    name: "settings",
    fileNameKo: "24_설정_삭제_영역.png",
    path: "/settings",
    selector: '[data-screen="settings"]',
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
