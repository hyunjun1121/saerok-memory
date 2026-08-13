# Fish Audio Day 1 browser run

`day1-inventory.json` is the ordered work queue. Its `text` values are exact Korean source strings from `../tts/narration-source.json`; do not add tags by hand.

## Progress

- Complete: 31/31 entries
- Verified targets: 62/62 non-empty MP3 files

## Per-entry workflow

1. Take the lowest-index entry still needing files.
2. Click the Fish Audio text field, replace its contents with the entry's exact `text`, then click `자동 태그`.
3. After automatic tagging finishes, click `음성 생성` once and wait for both result cards.
4. Download the left result first and the right result second. Chrome saves directly to `C:\Users\mnb92\Downloads`.
5. Move and rename those two downloads to the entry's `leftTargetPath` and `rightTargetPath`, resolved from this directory.
6. Mark `status` as `complete` only after both target files exist and are non-empty.

## Resume rules

- Filesystem wins over recorded status: skip an entry only when both target files exist and are non-empty.
- If either target is absent or empty, treat the entry as `pending`. Reuse the still-visible matching result card when possible; otherwise regenerate that entry before continuing.
- Keep each generation's left/right pair together. Do not reuse a result from another text.
- Finish one pair and its filenames before generating the next entry, so Chrome's newest two downloads remain unambiguous.
- Never overwrite a non-empty target without checking it first.
- Current queue is complete. After any later file change, resume from the first entry whose left or right target is absent or empty.

## A/B selection page

Run from `raspberry-pi-demo`:

```powershell
node tools/fish-day1-browser/server.mjs 4192
```

Open `http://127.0.0.1:4192`.

- Each sentence shows the two generated candidates as A and B.
- Listening never selects a candidate. Use the separate `A안 선택` or `B안 선택` control.
- Starting another candidate stops the currently playing audio.
- Every selection is written immediately to `day1-selections.json`.
- Once all 31 entries are selected, export creates `haru-day1-tts-selections.json`.
- The final selection document keeps the narration id, exact text, chosen side, and selected audio path needed for app integration.

The 62 deterministic audio files in `audio/` are the canonical working set. Their SHA-256 values match all 62 Fish downloads one-to-one. Keep the original files in Downloads as backup until selection and app integration are complete.

## B안 최종 런타임 적용

기본 31개 문장은 B안(`right`)으로 확정한 뒤, 첫 문항의 기분 선택지
4개만 `calm-mood-candidates/selections.json`의 최종 선택으로 교체합니다. 기본 선택 상태는
`day1-selections.json`, 원본 MP3→런타임 Ogg 매핑과 SHA-256은
`day1-runtime-import.json`에 보관합니다.

```powershell
npm run tts:day1:apply-b
node tools/tts/validate-output.mjs
```

가져오기 도구는 기본 31개가 모두 B안인지 확인한 뒤 최종 기분 선택지
4개를 다시 적용합니다. inventory·나레이션 source·manifest의
ID와 문장이 정확히 일치하는지 먼저 확인합니다. MP3는 보존하고 새
content-hash Ogg Opus 파일을 만든 뒤 Day 1의 31개 manifest 항목만
교체합니다. 다른 날짜와 공유하던 기존 Qwen 파일은 덮어쓰지 않습니다.

출처는 manifest 각 항목의 `origin`과 `model-source.json.audioOverrides`에
`user-selected-browser-export`로 기록합니다. 다운로드 MP3에 Fish 모델,
revision, license 정보가 없으므로 이를 추정하거나 Qwen Apache-2.0으로
표시하지 않습니다.
