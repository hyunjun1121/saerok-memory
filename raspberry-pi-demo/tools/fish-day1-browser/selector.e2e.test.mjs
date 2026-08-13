import assert from "node:assert/strict";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { chromium } from "@playwright/test";

import { createDay1SelectorServer } from "./server.mjs";

const rootDirectory = dirname(fileURLToPath(import.meta.url));
const inventory = JSON.parse(readFileSync(join(rootDirectory, "day1-inventory.json"), "utf8"));

test("reviews and persists every Day 1 A/B candidate", { timeout: 90_000 }, async () => {
  const selectionsPath = join(mkdtempSync(join(tmpdir(), "haru-day1-e2e-")), "day1-selections.json");
  const server = createDay1SelectorServer({ rootDirectory, selectionsPath });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const pageErrors = [];
  const consoleErrors = [];
  const externalRequests = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (url.origin !== baseUrl && url.protocol !== "blob:") externalRequests.push(request.url());
  });
  await page.addInitScript(() => {
    Object.defineProperty(HTMLMediaElement.prototype, "paused", {
      configurable: true,
      get() { return !this.__haruPlaying; },
    });
    HTMLMediaElement.prototype.play = function play() {
      this.__haruPlaying = true;
      this.dispatchEvent(new Event("play"));
      return Promise.resolve();
    };
    HTMLMediaElement.prototype.pause = function pause() {
      this.__haruPlaying = false;
      this.dispatchEvent(new Event("pause"));
    };
  });

  try {
    await page.goto(baseUrl, { waitUntil: "networkidle" });
    const rows = page.locator("[data-testid='tts-row']");
    await rows.first().waitFor();
    assert.equal(await rows.count(), 31);
    assert.equal(await page.locator("h1").textContent(), "문장별 TTS A/B 선택");
    assert.equal(await page.getAttribute("html", "lang"), "ko");

    for (const [offset, entry] of inventory.entries.entries()) {
      const row = rows.nth(offset);
      assert.equal(await row.getAttribute("data-entry-id"), entry.id);
      assert.equal(await row.locator("[data-testid='entry-text']").textContent(), entry.text);
      assert.equal(await row.locator("audio[data-side='left']").getAttribute("src"), entry.leftTargetPath);
      assert.equal(await row.locator("audio[data-side='right']").getAttribute("src"), entry.rightTargetPath);
      for (const path of [entry.leftTargetPath, entry.rightTargetPath]) {
        const response = await fetch(`${baseUrl}/${path}`, { method: "HEAD" });
        assert.equal(response.status, 200, path);
        assert.equal(response.headers.get("content-type"), "audio/mpeg");
        assert.ok(Number(response.headers.get("content-length")) > 0, path);
      }
    }

    const firstLeftPlay = rows.nth(0).locator("button[data-action='play'][data-side='left']");
    const firstRightPlay = rows.nth(0).locator("button[data-action='play'][data-side='right']");
    await firstLeftPlay.click();
    assert.equal(await firstLeftPlay.getAttribute("aria-pressed"), "true");
    await firstRightPlay.click();
    assert.equal(await firstLeftPlay.getAttribute("aria-pressed"), "false");
    assert.equal(await firstRightPlay.getAttribute("aria-pressed"), "true");
    assert.equal(await page.locator("button[data-action='play'].is-playing").count(), 1);
    assert.equal(await page.locator("input[type='radio']:checked").count(), 0);

    await rows.nth(0).locator("input[value='left']").check();
    await rows.nth(1).locator("input[value='right']").check();
    assert.equal(await page.locator("[data-testid='selection-progress']").textContent(), "2 / 31");
    await page.waitForFunction(() => document.querySelector("#save-status")?.textContent?.includes("2개 선택 저장됨"));

    await page.reload({ waitUntil: "networkidle" });
    assert.equal(await rows.nth(0).locator("input[value='left']").isChecked(), true);
    assert.equal(await rows.nth(1).locator("input[value='right']").isChecked(), true);
    assert.equal(await page.locator("[data-testid='selection-progress']").textContent(), "2 / 31");

    await page.locator("button[data-filter='unselected']").click();
    assert.equal(await page.locator("[data-testid='tts-row']:visible").count(), 29);
    await page.locator("button[data-filter='selected']").click();
    assert.equal(await page.locator("[data-testid='tts-row']:visible").count(), 2);
    await page.locator("button[data-filter='left']").click();
    assert.equal(await page.locator("[data-testid='tts-row']:visible").count(), 1);
    await page.locator("button[data-filter='right']").click();
    assert.equal(await page.locator("[data-testid='tts-row']:visible").count(), 1);
    await page.locator("button[data-filter='all']").click();

    for (let index = 2; index < inventory.entryCount; index += 1) {
      await rows.nth(index).locator(`input[value='${index % 2 === 0 ? "left" : "right"}']`).check();
    }
    assert.equal(await page.locator("[data-testid='selection-progress']").textContent(), "31 / 31");
    assert.equal(await page.locator("#export-selections").isEnabled(), true);
    await page.waitForFunction(() => document.querySelector("#save-status")?.textContent?.includes("31개 선택 저장됨"));

    const downloadPromise = page.waitForEvent("download");
    await page.locator("#export-selections").click();
    const download = await downloadPromise;
    assert.equal(download.suggestedFilename(), "haru-day1-tts-selections.json");
    const downloaded = JSON.parse(readFileSync(await download.path(), "utf8"));
    assert.equal(downloaded.complete, true);
    assert.equal(downloaded.selectedCount, 31);
    assert.deepEqual(downloaded.selections.map((selection) => selection.index), inventory.entries.map((entry) => entry.index));

    const stored = JSON.parse(readFileSync(selectionsPath, "utf8"));
    assert.equal(stored.selectedCount, 31);
    assert.equal(new Set(stored.selections.map((selection) => selection.id)).size, 31);

    await page.setViewportSize({ width: 540, height: 960 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth), true);
    assert.deepEqual(pageErrors, []);
    assert.deepEqual(consoleErrors, []);
    assert.deepEqual(externalRequests, []);
  } finally {
    await browser.close();
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});
