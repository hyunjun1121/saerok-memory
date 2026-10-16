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
const stem = 'Haru_회사소개_전단지_기준카피정합_v6';
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
  const componentOverflow = [];
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
      outside.push({ cls: element.className?.toString() || element.tagName, rect: [rect.left, rect.top, rect.right, rect.bottom] });
    }
  }

  for (const element of root.querySelectorAll('p,h1,h2,h3,li,.hero-chip,.target-pill,.difference-item')) {
    const style = getComputedStyle(element);
    if (element.scrollWidth > element.clientWidth + 1 || element.scrollHeight > element.clientHeight + 1) {
      overflow.push({ cls: element.className?.toString() || element.tagName, text: element.textContent.trim(), scroll: [element.scrollWidth, element.scrollHeight], client: [element.clientWidth, element.clientHeight], fontSize: style.fontSize });
    }
    const pt = Number.parseFloat(style.fontSize) * 0.75;
    if (element.textContent.trim() && pt < 8.2) {
      undersized.push({ cls: element.className?.toString() || element.tagName, text: element.textContent.trim(), pt });
    }
  }

  for (const parent of root.querySelectorAll('.solution-card,.flow-panel,.bottom-card,.footer-strip')) {
    const parentRect = parent.getBoundingClientRect();
    for (const element of parent.querySelectorAll('p,h3,.target-pill,.difference-item')) {
      const rect = element.getBoundingClientRect();
      if (
        rect.left < parentRect.left - 1 ||
        rect.top < parentRect.top - 1 ||
        rect.right > parentRect.right + 1 ||
        rect.bottom > parentRect.bottom + 1
      ) {
        componentOverflow.push({
          parent: parent.className?.toString() || parent.tagName,
          cls: element.className?.toString() || element.tagName,
          text: element.textContent.trim(),
          rect: [rect.left, rect.top, rect.right, rect.bottom],
          parentRect: [parentRect.left, parentRect.top, parentRect.right, parentRect.bottom],
        });
      }
    }
  }

  for (const [name, selector] of Object.entries({
    heroTitle: '.hero-title',
    heroSubtitle: '.hero-subtitle',
    heroPromise: '.hero-promise',
    heroBody: '.hero-body',
    heroChip: '.hero-chip',
    sectionHeading: '.section-heading',
    whyBody: '.why-list li',
    solutionTitle: '.solution-card h3',
    solutionBody: '.solution-card p',
    flowTitle: '.flow-step h3',
    flowNote: '.flow-note',
    miniHeading: '.mini-heading',
    difference: '.difference-item',
    target: '.target-pill',
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
    main: '.main-block',
    flow: '.flow-section',
    bottom: '.bottom-grid',
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

  const heroImage = root.querySelector('.hero-photo');
  return {
    outside,
    overflow,
    componentOverflow,
    undersized,
    typography,
    sections,
    heroImage: {
      natural: [heroImage.naturalWidth, heroImage.naturalHeight],
      rendered: [heroImage.clientWidth, heroImage.clientHeight],
      objectFit: getComputedStyle(heroImage).objectFit,
      objectPosition: getComputedStyle(heroImage).objectPosition,
    },
    page: [pageRect.width, pageRect.height],
  };
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
