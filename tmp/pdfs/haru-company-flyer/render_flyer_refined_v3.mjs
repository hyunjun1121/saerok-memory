import { chromium } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import path from 'node:path';

const root = 'C:\\project\\saerok-memory';
const outputDir = path.join(
  root,
  '피우다프로젝트',
  '전단지',
  '제로베이스_회사소개_전단지',
);
const stem = 'Haru_회사소개_전단지_대형타이포_재배치_v4';
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
  const undersized = [];
  const typography = {};
  const sections = {};

  for (const element of root.querySelectorAll('*')) {
    const rect = element.getBoundingClientRect();
    if (!rect.width || !rect.height) continue;
    if (
      rect.left < pageRect.left - 1 ||
      rect.top < pageRect.top - 1 ||
      rect.right > pageRect.right + 1 ||
      rect.bottom > pageRect.bottom + 1
    ) {
      outside.push({
        cls: element.className?.toString() || element.tagName,
        rect: [rect.left, rect.top, rect.right, rect.bottom],
      });
    }
  }

  for (const element of root.querySelectorAll('p,h1,h2,h3,.fact,.principle,.audience-pill,.photo-label')) {
    const style = getComputedStyle(element);
    if (element.scrollWidth > element.clientWidth + 1 || element.scrollHeight > element.clientHeight + 1) {
      overflow.push({
        cls: element.className?.toString() || element.tagName,
        text: element.textContent.trim(),
        scroll: [element.scrollWidth, element.scrollHeight],
        client: [element.clientWidth, element.clientHeight],
        fontSize: style.fontSize,
      });
    }
    const pt = Number.parseFloat(style.fontSize) * 0.75;
    if (element.textContent.trim() && pt < 8.2) {
      undersized.push({
        cls: element.className?.toString() || element.tagName,
        text: element.textContent.trim(),
        pt,
      });
    }
  }

  for (const [name, selector] of Object.entries({
    heroTitle: '.hero-title',
    heroSubtitle: '.hero-subtitle',
    heroPromise: '.hero-promise',
    heroBody: '.hero-body',
    fact: '.fact',
    sectionHeading: '.section-heading',
    valueTitle: '.value-card h3',
    valueBody: '.value-card p',
    flowTitle: '.flow-step h3',
    miniHeading: '.mini-heading',
    principle: '.principle',
    audience: '.audience-pill',
    footer: '.footer-text',
  })) {
    const element = root.querySelector(selector);
    const style = getComputedStyle(element);
    typography[name] = {
      pt: Number((Number.parseFloat(style.fontSize) * 0.75).toFixed(2)),
      weight: style.fontWeight,
      lineHeightPx: Number.parseFloat(style.lineHeight),
    };
  }

  for (const [name, selector] of Object.entries({
    hero: '.hero',
    value: '.value-section',
    flow: '.flow-section',
    bottom: '.bottom-section',
    footer: '.footer-strip',
  })) {
    const rect = root.querySelector(selector).getBoundingClientRect();
    sections[name] = {
      x: Number(((rect.left - pageRect.left) / 3.7795275591).toFixed(2)),
      y: Number(((rect.top - pageRect.top) / 3.7795275591).toFixed(2)),
      w: Number((rect.width / 3.7795275591).toFixed(2)),
      h: Number((rect.height / 3.7795275591).toFixed(2)),
    };
  }

  return { outside, overflow, undersized, typography, sections, page: [pageRect.width, pageRect.height] };
});

await page.locator('.page').screenshot({
  path: pngPath,
  animations: 'disabled',
  type: 'png',
});

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
