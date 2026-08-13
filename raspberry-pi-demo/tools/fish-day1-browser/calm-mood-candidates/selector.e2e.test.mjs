import assert from "node:assert/strict";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { chromium } from "@playwright/test";

import { createCalmMoodSelectorServer } from "./server.mjs";

const rootDirectory = dirname(fileURLToPath(import.meta.url));
const manifest = JSON.parse(readFileSync(join(rootDirectory, "manifest.json"), "utf8"));

test("reviews, selects, and persists all 24 calm mood candidates", { timeout: 90_000 }, async () => {
  const selectionsPath = join(mkdtempSync(join(tmpdir(), "haru-calm-mood-e2e-")), "selections.json");
  const server = createCalmMoodSelectorServer({ rootDirectory, selectionsPath });
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
    const rows = page.locator("[data-testid='option-row']");
    await rows.first().waitFor();

    assert.equal(await page.getAttribute("html", "lang"), "ko");
    assert.equal(await page.locator("h1").textContent(), "기분 선택지 TTS 고르기");
    assert.equal(await rows.count(), 4);
    assert.equal(await page.locator("[data-testid='candidate']").count(), 24);
    assert.equal(await page.locator("[data-testid='selection-progress']").textContent(), "0 / 4");

    for (const [optionIndex, option] of manifest.options.entries()) {
      const row = rows.nth(optionIndex);
      assert.equal(await row.getAttribute("data-option-id"), option.id);
      assert.equal(await row.locator("[data-testid='option-text']").textContent(), option.text);
      assert.equal(await row.locator("[data-testid='candidate']").count(), 6);

      for (const candidatePath of option.candidates) {
        const candidate = row.locator(`[data-audio-path='${candidatePath}']`);
        assert.equal(await candidate.count(), 1);
        assert.equal(await candidate.locator("audio").getAttribute("src"), candidatePath);
        const response = await fetch(`${baseUrl}/${candidatePath}`, { method: "HEAD" });
        assert.equal(response.status, 200, candidatePath);
        assert.equal(response.headers.get("content-type"), "audio/mpeg");
        assert.ok(Number(response.headers.get("content-length")) > 0, candidatePath);
      }
    }

    const firstPlay = page.locator("button[data-action='play']").nth(0);
    const secondPlay = page.locator("button[data-action='play']").nth(1);
    await firstPlay.click();
    assert.equal(await firstPlay.getAttribute("aria-pressed"), "true");
    await secondPlay.click();
    assert.equal(await firstPlay.getAttribute("aria-pressed"), "false");
    assert.equal(await secondPlay.getAttribute("aria-pressed"), "true");
    assert.equal(await page.locator("button[data-action='play'].is-playing").count(), 1);
    assert.equal(await page.locator("input[type='radio']:checked").count(), 0);

    const selectedPaths = [];
    for (let optionIndex = 0; optionIndex < manifest.options.length; optionIndex += 1) {
      const candidateIndex = optionIndex + 1;
      const candidatePath = manifest.options[optionIndex].candidates[candidateIndex];
      selectedPaths.push(candidatePath);
      await rows.nth(optionIndex).locator(`input[value='${candidatePath}']`).check();
    }
    await page.waitForFunction(() => document.querySelector("#save-status")?.textContent?.includes("4개 선택 저장됨"));
    assert.equal(await page.locator("[data-testid='selection-progress']").textContent(), "4 / 4");
    assert.equal(await page.locator("#export-selections").isEnabled(), true);

    await page.reload({ waitUntil: "networkidle" });
    for (const path of selectedPaths) {
      assert.equal(await page.locator(`input[value='${path}']`).isChecked(), true);
    }
    assert.equal(await page.locator("[data-testid='selection-progress']").textContent(), "4 / 4");

    const replacementPath = manifest.options[0].candidates[5];
    await rows.nth(0).locator(`input[value='${replacementPath}']`).check();
    await page.waitForFunction(() => document.querySelector("#save-status")?.textContent?.includes("4개 선택 저장됨"));

    const downloadPromise = page.waitForEvent("download");
    await page.locator("#export-selections").click();
    const download = await downloadPromise;
    assert.equal(download.suggestedFilename(), "haru-day1-q1-calm-mood-selections.json");
    const exported = JSON.parse(readFileSync(await download.path(), "utf8"));
    assert.equal(exported.complete, true);
    assert.equal(exported.selectedCount, 4);
    assert.deepEqual(exported.selections.map((selection) => selection.id), manifest.options.map((option) => option.id));
    assert.equal(exported.selections[0].audioPath, replacementPath);

    await page.setViewportSize({ width: 540, height: 960 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth), true);
    const targetSizes = await page.locator("button[data-action='play'], .select-control").evaluateAll((elements) => (
      elements.map((element) => {
        const rect = element.getBoundingClientRect();
        return { width: rect.width, height: rect.height };
      })
    ));
    assert.equal(targetSizes.every(({ width, height }) => width >= 44 && height >= 44), true);
    assert.deepEqual(pageErrors, []);
    assert.deepEqual(consoleErrors, []);
    assert.deepEqual(externalRequests, []);
  } finally {
    await browser.close();
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});
