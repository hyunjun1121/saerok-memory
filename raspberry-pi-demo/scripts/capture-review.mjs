import { mkdir } from "node:fs/promises";
import path from "node:path";
import { chromium } from "@playwright/test";

const baseUrl = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:5175";
const output = path.resolve("runtime", "visual-review");
await mkdir(output, { recursive: true });

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 540, height: 960 },
  deviceScaleFactor: 2,
  hasTouch: false,
});
const page = await context.newPage();

async function press(key) {
  await page.keyboard.press(key);
  await page.waitForTimeout(230);
}

async function shot(name) {
  await page.screenshot({ path: path.join(output, name), fullPage: false });
}

await page.goto(`${baseUrl}/#/lesson?day=1`);
await page.locator('[data-screen="lesson-start"]').waitFor();
await shot("01-start.png");
await press("2");
await page.locator('[data-exercise-id="D1_Q1"]').waitFor();
await press("2");
await shot("02-choice-selected.png");

await page.evaluate(() => localStorage.clear());
await page.reload();
await page.locator('[data-screen="lesson-start"]').waitFor();
await press("2");
for (const exerciseId of ["D1_Q1", "D1_Q2", "D1_Q3", "D1_Q4"]) {
  await page.locator(`[data-exercise-id="${exerciseId}"]`).waitFor();
  await press("1");
  await press("1");
  await page.locator('[data-screen="lesson-feedback"]').waitFor();
  await press("2");
}
await page.locator('[data-exercise-id="D1_Q5"]').waitFor();
await press("2");
await page.locator('[data-voice-stage="recording"]').waitFor();
await shot("03-voice.png");
await press("2");
await press("2");
await page.locator('[data-screen="lesson-feedback"]').waitFor();
await press("2");
await page.locator('[data-exercise-id="D1_Q6"]').waitFor();
for (const key of ["1", "2", "3"]) {
  await press(key);
  await press(key);
}
await shot("04-sequence-review.png");

await page.goto(`${baseUrl}/#/result?day=1`);
await page.locator('[data-screen="result"]').waitFor();
await shot("05-result.png");
await browser.close();

process.stdout.write(`${output}\n`);
