import { chromium } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import path from 'node:path';

const root = 'C:\\project\\saerok-memory';
const outputDir = path.join(root, '피우다프로젝트', '전단지', '제로베이스_회사소개_전단지');
const stem = 'Haru_회사소개_전단지_대표자행하단이동_v13';
const htmlPath = path.join(outputDir, `${stem}_편집원본.html`);
const pdfPath = path.join(outputDir, `${stem}_인쇄공유용.pdf`);
const pngPath = path.join(outputDir, `${stem}_고해상도.png`);

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 794, height: 1123 },
  deviceScaleFactor: 3.125,
  locale: 'ko-KR',
});
const page = await context.newPage();
await page.goto(pathToFileURL(htmlPath).href, { waitUntil: 'load' });
await page.evaluate(() => document.fonts.ready);

const audit = await page.evaluate(() => {
  const root = document.querySelector('.page');
  const pageRect = root.getBoundingClientRect();
  const outside = [];
  const overflow = [];
  const overlaps = [];
  const undersized = [];
  const textSafeAreaRisk = [];
  const contentSafeAreaRisk = [];
  const sectionBoxes = {};
  const selectors = [
    '.hero', '.main', '.why-copy', '.flow', '.flow-panel', '.bottom', '.qr-card', '.qr-wrap', '.footer', '.contact',
    '.solution-card', '.bottom-card', '.target-pill', '.hero-badge',
  ];

  for (const element of root.querySelectorAll('*')) {
    const rect = element.getBoundingClientRect();
    if (!rect.width || !rect.height) continue;
    if (
      rect.left < pageRect.left - 0.1 || rect.top < pageRect.top - 0.1 ||
      rect.right > pageRect.right + 0.1 || rect.bottom > pageRect.bottom + 0.1
    ) {
      outside.push({
        className: element.className?.toString() || element.tagName,
        rect: [rect.left, rect.top, rect.right, rect.bottom],
      });
    }
  }

  for (const element of root.querySelectorAll('p,h1,h2,h3,li,.hero-badge,.target-pill,.difference-item,.contact-item')) {
    const style = getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    if (element.scrollWidth > element.clientWidth + 1 || element.scrollHeight > element.clientHeight + 1) {
      overflow.push({
        className: element.className?.toString() || element.tagName,
        text: element.textContent.trim(),
        scroll: [element.scrollWidth, element.scrollHeight],
        client: [element.clientWidth, element.clientHeight],
      });
    }
    const pt = Number.parseFloat(style.fontSize) * 0.75;
    if (element.textContent.trim() && pt < 8.1) {
      undersized.push({ className: element.className?.toString() || element.tagName, text: element.textContent.trim(), pt });
    }
    const safePx = 7 * 3.7795275591;
    if (
      element.textContent.trim() &&
      (rect.left < pageRect.left + safePx || rect.top < pageRect.top + safePx ||
       rect.right > pageRect.right - safePx || rect.bottom > pageRect.bottom - safePx)
    ) {
      textSafeAreaRisk.push({
        className: element.className?.toString() || element.tagName,
        text: element.textContent.trim(),
        gapsMm: {
          left: Number(((rect.left - pageRect.left) / 3.7795275591).toFixed(2)),
          top: Number(((rect.top - pageRect.top) / 3.7795275591).toFixed(2)),
          right: Number(((pageRect.right - rect.right) / 3.7795275591).toFixed(2)),
          bottom: Number(((pageRect.bottom - rect.bottom) / 3.7795275591).toFixed(2)),
        },
      });
    }
  }

  for (const element of root.querySelectorAll('.hero-copy,.hero-badges,.main,.flow,.bottom,.qr-card,.footer,.contact')) {
    const rect = element.getBoundingClientRect();
    const safePx = 7 * 3.7795275591;
    if (
      rect.left < pageRect.left + safePx || rect.top < pageRect.top + safePx ||
      rect.right > pageRect.right - safePx || rect.bottom > pageRect.bottom - safePx
    ) {
      contentSafeAreaRisk.push({
        className: element.className?.toString() || element.tagName,
        gapsMm: {
          left: Number(((rect.left - pageRect.left) / 3.7795275591).toFixed(2)),
          top: Number(((rect.top - pageRect.top) / 3.7795275591).toFixed(2)),
          right: Number(((pageRect.right - rect.right) / 3.7795275591).toFixed(2)),
          bottom: Number(((pageRect.bottom - rect.bottom) / 3.7795275591).toFixed(2)),
        },
      });
    }
  }

  const groups = [
    ['.why-copy', 'p'],
    ['.solution-card', 'h3,p,.solution-art'],
    ['.flow-panel', '.flow-num,.flow-title,.flow-art,.flow-arrow,.flow-note'],
    ['.bottom-card', '.mini-heading,.difference-item,.target-pill'],
    ['.qr-card', '.qr-heading,.qr-wrap,.qr-caption'],
    ['.footer', 'img,p'],
    ['.contact', '.contact-item'],
  ];
  for (const [parentSelector, childSelector] of groups) {
    for (const parent of root.querySelectorAll(parentSelector)) {
      const p = parent.getBoundingClientRect();
      for (const child of parent.querySelectorAll(childSelector)) {
        const c = child.getBoundingClientRect();
        if (c.left < p.left - 1 || c.top < p.top - 1 || c.right > p.right + 1 || c.bottom > p.bottom + 1) {
          overlaps.push({ parent: parentSelector, child: child.className?.toString() || child.tagName, text: child.textContent.trim() });
        }
      }
    }
  }

  for (const selector of selectors) {
    sectionBoxes[selector] = [...root.querySelectorAll(selector)].map((element) => {
      const r = element.getBoundingClientRect();
      return {
        x: Number(((r.left - pageRect.left) / 3.7795275591).toFixed(2)),
        y: Number(((r.top - pageRect.top) / 3.7795275591).toFixed(2)),
        w: Number((r.width / 3.7795275591).toFixed(2)),
        h: Number((r.height / 3.7795275591).toFixed(2)),
      };
    });
  }

  return {
    page: [pageRect.width, pageRect.height],
    outside,
    overflow,
    overlaps,
    undersized,
    textSafeAreaRisk,
    contentSafeAreaRisk,
    sectionBoxes,
    imageCount: root.querySelectorAll('img').length,
    editableTextCount: root.querySelectorAll('p,h1,h2,h3,li,.hero-badge,.target-pill,.difference-item,.contact-item').length,
    heroNaturalSize: [root.querySelector('.hero-photo').naturalWidth, root.querySelector('.hero-photo').naturalHeight],
    qrNaturalSize: [root.querySelector('.qr-wrap img').naturalWidth, root.querySelector('.qr-wrap img').naturalHeight],
    qrHref: root.querySelector('.qr-wrap').href,
  };
});

await page.locator('.page').screenshot({ path: pngPath, animations: 'disabled', type: 'png' });
await page.pdf({
  path: pdfPath,
  width: '210mm',
  height: '297mm',
  printBackground: true,
  preferCSSPageSize: true,
  margin: { top: '0', right: '0', bottom: '0', left: '0' },
});

await browser.close();
console.log(JSON.stringify({ htmlPath, pdfPath, pngPath, audit }, null, 2));
