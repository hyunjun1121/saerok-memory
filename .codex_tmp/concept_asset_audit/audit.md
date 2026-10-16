# Haru extracted concept/presentation asset audit

Scope: `피우다프로젝트/일본인멘토_피드백/오가사_Haru_추출이미지`

Inventory: 26 decodable image files — 20 JPEG, 6 PNG. All SHA-256 hashes unique. PNG transparency exists in logo and four military portraits; QR PNG is opaque RGB. All JPEGs are opaque. Dimensions below are source pixels. Approximate print dimensions assume 300 ppi.

## Complete visual inventory

| # | File | Technical | Visual content | Print / brand assessment |
|---:|---|---|---|---|
| 1 | `개발계획서_01_Haru_탁상형기기_제품목업_p03_p10_p28.jpg` | 1448×1086, 4:3, opaque JPEG; ~123×92 mm at 300 ppi | White tabletop Haru hardware concept on wood table; tilted touch display, turtle mascot, mic/speakers, four colored physical buttons, card reader | Strong, clear product-concept hero. Enough for quarter/half-page use. Must label as **탁상형 기기 콘셉트** so flyer does not imply shipped hardware. Keep device fully visible; crop only surrounding wall/table. |
| 2 | `개발계획서_02_한국어_요일선택_화면_p03.jpg` | 1080×1920, 9:16, opaque JPEG; ~91×163 mm | Korean old/proposed weekday-choice UI: four colored square answers, progress bar, listen/confirm controls | Technically printable, but extracted JPEG is highly compressed and visual system differs from live capture set. Do not use when current app screenshots exist. |
| 3 | `개발계획서_03_일본어_단어순서선택_화면_p03.jpg` | 1080×1920, 9:16, opaque JPEG; ~91×163 mm | Japanese word-order/recognition UI with `りんご`, `傘`, `バス`, `帽子` choices | Technically printable; old/proposed UI and knowledge-style task. Weak fit for current action-only demo routine. Avoid. |
| 4 | `개발계획서_04_한국어_어르신_탁상형기기사용_p05.jpg` | 1335×1011, 1.320:1, opaque JPEG; ~113×86 mm | Older woman from rear/side using white tabletop unit; Korean mood-choice screen; hand pressing red button; care-card prop | Best human-use concept image in folder. Warm, legible interaction and complete hand/device crop. Same base scene as #12. Use only with **사용 장면 콘셉트** framing; Korean flyer favors this over #12. |
| 5 | `개발계획서_05_한국어_1일차_시작화면_p06.jpg` | 476×808, 0.589:1, opaque JPEG; ~40×68 mm | Korean old/proposed Day 1 start screen; Haru logo, small turtle, fictional user/consent/date panel | Low resolution; fine only as a small thumbnail. Contains fictional personal details and a future date. Avoid. |
| 6 | `개발계획서_06_한국어_오늘기분_선택화면_p06.jpg` | 422×838, 0.504:1, opaque JPEG; ~36×71 mm | Korean mood-selection screen with four large colored choices | Low resolution and old/proposed UI. Avoid. |
| 7 | `개발계획서_07_한국어_요일선택_화면_p06.jpg` | 407×728, 0.559:1, opaque JPEG; ~34×62 mm | Korean weekday-choice screen; same layout family as #2/#6 | Low resolution; redundant with higher-resolution #2 and current captures. Avoid. |
| 8 | `개발계획서_08_한국어_오늘이야기_음성녹음화면_p06.jpg` | 376×775, 0.485:1, opaque JPEG; ~32×66 mm | Korean daily-story voice screen with green recording area and orange finish button | Lowest-resolution screen in folder. Avoid. |
| 9 | `개발계획서_09_Haru_마스코트_활기찬표정_p08_p26.jpg` | 490×701, 0.699:1, opaque JPEG; ~41×59 mm | Full-body bright-green 3D turtle, raised fist/open smile, white background | Promotional expression reads clearly. Small and lacks alpha, so use only about 30–35 mm wide or remove white background carefully. Near-duplicate pose of #10. Prefer current transparent mascot asset if available. |
| 10 | `개발계획서_10_Haru_마스코트_차분한미소_p08_p26.jpg` | 510×759, 0.672:1, opaque JPEG; ~43×64 mm | Same turtle/body pose as #9; closed mouth, calmer eyes/smile; white background | Calmer tone fits Haru, but still small/opaque and visually redundant with #9. Use at most one mascot; current transparent brand asset preferred. |
| 11 | `개발계획서_11_Haru_마스코트_노년형_지팡이_p08_p26.jpg` | 517×734, 0.704:1, opaque JPEG; ~44×62 mm | Elderly-styled turtle with white eyebrows, wrinkles and cane; white background | Technically small but usable. Do not recommend: age/frailty caricature weakens dignified older-adult positioning. |
| 12 | `개발계획서_12_일본어_어르신_탁상형기기사용_p23.jpg` | 1448×1086, 4:3, opaque JPEG; ~123×92 mm | Same older-woman/tabletop-device scene as #4, with Japanese mood UI and slightly wider/higher-resolution framing | Near duplicate of #4 (pHash distance 4/64). Choose one, never both. Use this only for Japanese-facing context; label as concept. |
| 13 | `개발계획서_13_일본어_1일차_시작화면_p24.jpg` | 588×911, 0.645:1, opaque JPEG; ~50×77 mm | Japanese old/proposed Day 1 start screen, turtle, fictional user/consent panel | Moderate-low resolution; old/proposed UI and fictional details. Avoid. |
| 14 | `개발계획서_14_일본어_오늘기분_선택화면_p24.jpg` | 560×911, 0.615:1, opaque JPEG; ~47×77 mm | Japanese mood selection, same four-choice layout family | Small and redundant. Avoid. |
| 15 | `개발계획서_15_일본어_요일선택_화면_p24.jpg` | 589×911, 0.647:1, opaque JPEG; ~50×77 mm | Japanese weekday-choice screen | Small and redundant with #2/#7. Avoid. |
| 16 | `개발계획서_16_일본어_오늘이야기_음성녹음화면_p24.jpg` | 586×911, 0.643:1, opaque JPEG; ~50×77 mm | Japanese voice-recording screen, green record area and orange finish button | Small, old/proposed UI. Avoid. |
| 17 | `발표자료_01_Haru_컬러로고.png` | 2400×1223, 1.962:1 canvas, RGBA; meaningful-alpha bounds ~2104×841; ~203×104 mm canvas at 300 ppi | Haru coral wordmark plus five-petal pictogram (puzzle, heart, target, A/あ, grid) and teal stem | Strong usable raster logo; true transparency and ample resolution. Non-destructively trim transparent padding. Slight dimensional shading makes it less crisp than a flat/vector master; prefer cleaner current/vector logo if available. |
| 18 | `발표자료_02_Haru_오늘의루틴_시작화면.jpg` | 1080×2520, 0.429:1, opaque JPEG, 72 dpi metadata; ~91×213 mm at 300 ppi | Android browser capture of old routine start page; status bar and browser chrome visible; old copy and small mascot | Do not use: browser chrome, stale/proposed visual state, and copy not representative of polished live app. |
| 19 | `발표자료_03_Haru_접속_QR코드.png` | 512×512, square, opaque RGB PNG; ~43×43 mm at 300 ppi | High-contrast black/white QR with quiet zone | Successfully decodes to `https://saerok-memory.vercel.app/lesson`; direct HEAD request returned HTTP 200 on 2026-08-06. Good print candidate around 25–35 mm. Recheck destination availability immediately before final print/export; do not crop quiet zone. |
| 20 | `발표자료_04_오늘날짜_요일선택_화면.jpg` | 1080×2520, 0.429:1, opaque JPEG, 72 dpi metadata | Android browser capture of Korean weekday check; four white rounded choices | Technically tall enough, but status/browser chrome and older UI reduce polish. Current screenshot deck preferred. |
| 21 | `발표자료_05_보호자앱_일상리포트_화면.jpg` | 1080×2520, 0.429:1, opaque JPEG, 72 dpi metadata | Korean caregiver report: participation flow, observed changes, mood/daily signals, recorded story; fictional user and observations | Capability message is useful, but this is old/proposed UI with fictional sensitive-looking observations and device chrome. Do not use; current caregiver capture preferred. |
| 22 | `발표자료_06_가족외식기억_음성녹음_화면.jpg` | 1080×2520, 0.429:1, opaque JPEG, 72 dpi metadata | Android browser capture of Korean family-meal recall voice recording; waveform and finish button | Clear feature concept, but status/browser chrome and stale UI. Current live voice screen preferred. |
| 23 | `발표자료_07_군복인물_정면사진.png` | 600×400, 3:2 canvas, RGBA; subject bounds 413×342; ~51×34 mm canvas at 300 ppi | Cutout bust portrait, front-facing male in ROK Army uniform, no hat | Transparent and clean enough only for small team thumbnail. Low effective resolution; military identity dominates. Use only if identity, role, consent and context are verified. |
| 24 | `발표자료_08_군복인물_안경정면사진.png` | 600×400, 3:2 canvas, RGBA; subject bounds 367×339; ~51×34 mm | Cutout bust portrait, front-facing male with glasses in ROK Army uniform | Same constraints as #23; smallest effective subject width. Avoid as decorative company imagery. |
| 25 | `발표자료_09_군복인물_모자정면사진.png` | 600×400, 3:2 canvas, RGBA; subject bounds 406×345; ~51×34 mm | Cutout bust portrait, front-facing male wearing military cap/uniform | Same constraints as #23. Avoid unless verified team panel requires it. |
| 26 | `발표자료_10_군복인물_브이포즈사진.png` | 3300×2475, 4:3 canvas, RGBA; subject bounds ~1735×1994; ~279×210 mm canvas | High-resolution cutout of smiling ROK Army soldier in cap/uniform, three-quarter pose with V sign | Best technical portrait quality and friendly pose. Still carries strong military/affiliation implication. Use only with verified founder/team story, consent and accurate caption; not as generic hero image. White background hides minor cutout fringe best. |

## Duplicate / similarity findings

- Exact byte duplicates: none.
- #4 and #12: same source scene; only language/screen treatment and framing differ. Select Korean or Japanese version by audience.
- #9 and #10: same mascot/body pose with facial-expression edits. Select at most one.
- #2/#7/#15 and #6/#14 and #8/#16: repeated old UI families across resolution/language variants; current app captures should supersede them.
- #18/#20/#21/#22: same old Android-browser capture style, each unique screen.
- #23–#26: unique portrait assets; #26 is the only one suitable above small thumbnail size.

## Recommended shortlist from this folder

1. `발표자료_01_Haru_컬러로고.png` — high-resolution transparent brand identifier. Use only if current brand folder lacks a cleaner master.
2. `개발계획서_04_한국어_어르신_탁상형기기사용_p05.jpg` — strongest Korean human-use narrative. Keep user, hand and full device intact; label as concept scene.
3. `개발계획서_01_Haru_탁상형기기_제품목업_p03_p10_p28.jpg` — clearest standalone product concept. Label as tabletop-device concept, not a released product.
4. `발표자료_03_Haru_접속_QR코드.png` — valid QR to `/lesson`; retain quiet zone and recheck URL before print.
5. Conditional only: `발표자료_10_군복인물_브이포즈사진.png` — excellent resolution, but use solely in a verified team/founder section with consent and non-affiliation-misleading caption.

Not recommended: extracted old/proposed UI screenshots, low-resolution opaque mascot JPGs, elderly-with-cane caricature, low-resolution military headshots.

## Inspection artifacts

- `01_dev_01-04.png`
- `02_dev_05-08.png`
- `03_dev_09-12.png`
- `04_dev_13-16.png`
- `05_presentation_01-06.png`
- `06_presentation_07-10.png`

These contact sheets live beside this memo in `.codex_tmp/concept_asset_audit/`. They are inspection-only; source assets remain untouched.
