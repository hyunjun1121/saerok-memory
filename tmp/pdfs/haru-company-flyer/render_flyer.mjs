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
const htmlPath = path.join(outputDir, 'Haru_회사소개_전단지_최신화면반영_편집원본.html');
const pdfPath = path.join(outputDir, 'Haru_회사소개_전단지_최신화면반영_인쇄공유용.pdf');
const rawPngPath = path.join(
  root,
  'tmp',
  'pdfs',
  'haru-company-flyer',
  'Haru_회사소개_전단지_최신화면반영_4x.png',
);

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 794, height: 1123 },
  deviceScaleFactor: 4,
  locale: 'ko-KR',
});
const page = await context.newPage();

await page.goto(pathToFileURL(htmlPath).href, { waitUntil: 'load' });
await page.evaluate(() => document.fonts.ready);
await page.locator('.page').screenshot({
  path: rawPngPath,
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

console.log(JSON.stringify({ htmlPath, pdfPath, rawPngPath }, null, 2));
