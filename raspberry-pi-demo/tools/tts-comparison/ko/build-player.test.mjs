import assert from 'node:assert/strict';
import { test } from 'node:test';

import { renderPlayer } from './build-player.mjs';
import { validShape } from './test-fixtures.mjs';

test('renders Korean-only two-method player with all 19 samples', () => {
  const html = renderPlayer(validShape());
  assert.match(html, /<html lang="ko">/u);
  assert.match(html, /영자 어르신, 오늘 기분은 어떠세요\?/u);
  assert.match(html, /한국어 TTS 목소리 비교/u);
  assert.match(html, /Qwen3-TTS · Fish Speech S2 Pro/u);
  assert.doesNotMatch(html, /Kokoro/u);
  assert.equal((html.match(/<audio /gu) ?? []).length, 19);
});

test('renders exact Fish attribution, local license links, and commercial warning', () => {
  const html = renderPlayer(validShape());
  assert.match(html, />Built with Fish Audio</u);
  assert.match(html, /href="fish\/LICENSE"/u);
  assert.match(html, /href="fish\/NOTICE\.txt"/u);
  assert.match(html, /상업적 사용에는 Fish Audio와 별도 서면 계약/u);
});

test('pauses every other audio element when playback starts', () => {
  const html = renderPlayer(validShape());
  assert.match(html, /document\.addEventListener\('play'/u);
  assert.match(html, /if \(audio !== event\.target\) audio\.pause\(\)/u);
});

test('escapes untrusted manifest labels and paths', () => {
  const manifest = validShape();
  manifest.methods[0].samples[0].label = '<img src=x onerror=alert(1)>';
  manifest.methods[0].samples[0].path = 'qwen/audio/a&b.ogg';
  const html = renderPlayer(manifest);
  assert.doesNotMatch(html, /<img src=x/u);
  assert.match(html, /&lt;img src=x onerror=alert\(1\)&gt;/u);
  assert.match(html, /a&amp;b\.ogg/u);
});
