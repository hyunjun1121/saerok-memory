import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  FISH_VISIBLE_ATTRIBUTION,
  validateComparison,
  validateManifestShape,
  validatePlayerAttribution,
} from './validate-comparison.mjs';

const root = dirname(fileURLToPath(import.meta.url));

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function renderMethod(method) {
  return `
      <section class="method" data-method="${escapeHtml(method.id)}">
        <header>
          <p class="eyebrow">${escapeHtml(method.model.id)}</p>
          <h2>${escapeHtml(method.name)}</h2>
          <p>${escapeHtml(method.voiceInventory.selectionRationale)}</p>
          <div class="method-meta">
            <span>${escapeHtml(method.model.license)}</span>
            <a href="${escapeHtml(method.reportPath)}">기술 보고서</a>
          </div>
        </header>
        <div class="samples">
          ${method.samples.map((sample, index) => `
            <article class="sample">
              <div class="sample-title">
                <span class="number">${String(index + 1).padStart(2, '0')}</span>
                <strong>${escapeHtml(sample.label)}</strong>
                <small>${escapeHtml(sample.voice)} · ${(sample.durationMs / 1000).toFixed(2)}초</small>
              </div>
              ${sample.note ? `<p class="note">${escapeHtml(sample.note)}</p>` : ''}
              <audio controls preload="metadata" src="${escapeHtml(sample.path)}"></audio>
            </article>
          `).join('')}
        </div>
      </section>`;
}

export function renderPlayer(inputManifest) {
  const manifest = validateManifestShape(inputManifest);
  const methodMarkup = manifest.methods.map(renderMethod).join('');
  return `<!doctype html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Haru 한국어 TTS 비교</title>
  <style>
    :root { color-scheme:light; font-family:"Noto Sans KR",Arial,sans-serif; background:#f4f0e7; color:#25231f; }
    * { box-sizing:border-box; }
    body { margin:0; }
    main { width:min(1180px,100%); margin:auto; padding:40px; }
    .hero { display:grid; gap:12px; margin-bottom:30px; padding:34px; border:3px solid #25231f; background:#fffdf8; }
    .hero h1 { margin:0; font-size:clamp(32px,5vw,60px); line-height:1.05; }
    .prompt { margin:0; font-size:clamp(24px,3vw,38px); font-weight:900; word-break:keep-all; }
    .meta,.eyebrow { margin:0; color:#675f51; font-weight:700; }
    .grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:22px; align-items:start; }
    .method { border:3px solid #25231f; background:#fffdf8; box-shadow:7px 7px 0 #25231f; }
    .method header { min-height:230px; padding:24px; border-bottom:3px solid #25231f; }
    .method header>p:not(.eyebrow) { line-height:1.55; }
    .method-meta { display:flex; justify-content:space-between; gap:12px; margin-top:18px; font-weight:800; }
    .method-meta a,.license-note a { color:#215f3d; text-underline-offset:3px; }
    h2 { margin:8px 0 14px; font-size:31px; line-height:1.15; }
    .samples { display:grid; }
    .sample { display:grid; gap:12px; padding:18px; border-bottom:1px solid #bdb6a8; }
    .sample:last-child { border-bottom:0; }
    .sample-title { display:grid; grid-template-columns:42px 1fr; gap:2px 10px; align-items:center; }
    .number { grid-row:1/3; display:grid; width:38px; height:38px; place-items:center; border:2px solid #25231f; background:#e8dcbd; font-weight:900; }
    strong { font-size:18px; }
    small { color:#675f51; }
    .note { margin:0; padding:9px 11px; border-left:4px solid #b05d33; background:#f7eadc; font-size:13px; line-height:1.45; }
    audio { width:100%; }
    .license-note { display:flex; flex-wrap:wrap; gap:8px 14px; margin-top:30px; padding:18px 20px; border:2px solid #25231f; background:#fffdf8; font-weight:800; }
    @media (max-width:850px) { .grid { grid-template-columns:1fr; } .method header { min-height:0; } }
    @media (max-width:600px) { main { padding:18px; } .hero { padding:22px; } }
  </style>
</head>
<body>
  <main>
    <section class="hero">
      <p class="eyebrow">Haru D1_Q1 · 한국어 · 같은 문장</p>
      <h1>한국어 TTS 목소리 비교</h1>
      <p class="prompt" lang="ko">${escapeHtml(manifest.prompt.text)}</p>
      <p class="meta">Qwen3-TTS · Fish Speech S2 Pro</p>
      <p class="meta">한 번에 한 음성만 재생됩니다. 발음·속도·명료도·어르신 청취 편안함을 직접 비교하세요.</p>
    </section>
    <div class="grid">${methodMarkup}
    </div>
    <footer class="license-note">
      <strong>${FISH_VISIBLE_ATTRIBUTION}</strong>
      <a href="fish/LICENSE">Fish Audio Research License Agreement</a>
      <a href="fish/NOTICE.txt">Fish Audio NOTICE</a>
      <span>평가·비상업 비교용입니다. 상업적 사용에는 Fish Audio와 별도 서면 계약이 필요합니다.</span>
    </footer>
  </main>
  <script>
    document.addEventListener('play', (event) => {
      if (!(event.target instanceof HTMLAudioElement)) return;
      for (const audio of document.querySelectorAll('audio')) {
        if (audio !== event.target) audio.pause();
      }
    }, true);
  </script>
</body>
</html>
`;
}

export function buildPlayer(rootDirectory = root) {
  const { manifest } = validateComparison(rootDirectory);
  const path = join(rootDirectory, 'index.html');
  writeFileSync(path, renderPlayer(manifest), 'utf8');
  validatePlayerAttribution(rootDirectory);
  return path;
}

const isCli = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isCli) console.log(`Wrote ${buildPlayer()}`);
