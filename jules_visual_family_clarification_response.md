# Jules Clarification Response: Haru Visual Assets And Family/Counselor View

Use these answers to proceed with the Haru visual asset integration and `/family` support-screen upgrade.

## 1. Scope A: Visual Assets

Yes, update `index.html` to reflect the product name `Haru` instead of `Memory Garden`.

Yes, update the favicon to the app icon if `public/assets/haru/app_icon.png` exists. If the copied file has a different stable name, either rename it to `app_icon.png` or update the reference consistently. If the icon is missing, leave the existing favicon and report the missing asset.

For top status bar branding and the home screen:

- Prefer locale-aware logo rendering if it is simple and low-risk.
- Use the Korean logo for `ko`.
- Use the Japanese hiragana logo for `ja`.
- For `en`, use a simple `Haru` text mark with the app icon, or fall back to the Korean logo if that better matches the current component structure.
- Do not use the Japanese kanji logo as the primary Japanese logo unless the hiragana logo has a rendering or legibility issue. The kanji logo can be a secondary Japan variant mark if useful.
- Use the mascot image in mascot bubbles or equivalent mascot locations, but keep layout stable and readable. Do not force the full pose sheet into small UI areas.

For the garden screen:

- Use `garden_scene.png` as the primary reward/garden visual if it fits cleanly.
- It is acceptable to replace the large `TreePine` hero icon with the garden scene.
- Keep the existing progress metrics, level, drops, leaves, and flowers readable. Do not turn the screen into a purely decorative image.
- If the garden scene makes the mobile layout crowded, use it as a contained hero/background visual and keep the existing icons for metric cards.

For the result screen:

- Prefer `memory_bloom.png` as the main completion/reward symbol.
- Use `garden_scene.png` only as a subtle supporting background or not at all on the result screen.
- The result screen should feel like a completed daily milestone, so the memory bloom symbol is a better primary fit than the full garden scene.

Recommended stable asset names:

- `mascot.png`
- `mascot_pose_sheet.png`
- `logo_ko.png`
- `logo_ja_hiragana.png`
- `logo_ja_kanji.png`
- `water_drop.png`
- `garden_scene.png`
- `app_icon.png`
- `memory_bloom.png`
- `cognitive_routine_icons.png`
- `family_connection.png`
- `background_pattern.png`

## 2. Scope B: Family/Counselor View

Yes, add a simple segmented control or two-tab mode switch at the top of `FamilyScreen`.

Use two modes:

- Family
- Counselor

Keep the route as `/family`. Do not add a new route unless the existing screen becomes unmanageable.

The segmented control should be custom-built with existing React and Tailwind classes. Do not add Radix UI or any new UI dependency for this.

For conversation cues, create a typed utility such as:

```ts
generateConversationCues(cards: MemoryCard[], t: TFunction): ConversationCue[]
```

This is acceptable. The helper should:

- Read only cards with `shareWithFamily === true` before using personal memory details.
- Prefer `textSummary`, `emotionTag`, `peopleTags`, `placeTag`, and `storyCues` when they are shareable.
- Return localized cue text through i18n templates.
- Return neutral routine-based prompts when there are no shareable memory cards.
- Avoid official medical, diagnostic, disease-risk, decline, impairment, and screening language. Haru-specific advisory wording is allowed only in the report/advisory context, not in casual memory-cue text.

Example safe cue directions:

- Ask about a shared story summary.
- Ask what made a shared feeling stand out.
- Ask about a shared person or place cue.
- If no shareable data exists, ask which activity felt easiest today or what they would like to try again tomorrow.

The counselor view may show denser information than the older-adult learner screens, but it must remain calm and non-clinical.

Allowed counselor labels:

- Activity overview
- Routine participation
- Practice areas
- Conversation cues
- Shareable memories
- Notes for the next conversation
- Local demo data only
- Not a medical test
- Haru advisory level
- Watch area
- Conversation recommended
- Consider professional consultation

Avoid charts or labels that imply formal diagnosis, disease progression, official dementia-risk estimates, impairment level, or clinical scoring. Haru-specific advisory attention/risk levels are acceptable if they are clearly presented as Haru's own support signal, explain their basis, and appear with the app's disclaimer that the result is not a medical diagnosis or official screening result.

Updated product direction: do not be so defensive that the report avoids all useful interpretation. It is acceptable to combine repeated routine data, memory-review changes, drawing or attention metadata, and caregiver observations into a Haru-specific advisory level. Do not call that level MMSE, MoCA, CIST, K-MMSE, dementia risk, screening positive/negative, or a clinical score.

## 3. Scope C: i18n

Yes, add all new Family/Counselor UI text and conversation cue templates to:

- `src/locales/ko.json`
- `src/locales/ja.json`
- `src/locales/en.json`

Keep Korean, Japanese, and English content coherent. Do not hard-code visible copy in TSX components.

Do not take over broader lesson-content localization in this Jules task. The lesson localization work is being handled separately.

## 4. Scope D: Tests

Yes, add React Testing Library tests for the updated `FamilyScreen`.

Yes, add focused unit tests for the conversation cue helper.

Recommended test coverage:

- `/family` renders with no local data.
- The segmented Family/Counselor mode switch works.
- Routine completion counts render from local cognitive routine data.
- Private memory details are hidden when `shareWithFamily` is false.
- A shareable memory can produce a conversation cue.
- The Counselor view avoids official diagnostic wording while allowing Haru-specific advisory wording.
- The conversation cue helper tolerates empty or partial card data.

## Final Direction

Proceed with these assumptions. Keep the change scoped to visual asset integration and the `/family` support-screen upgrade. Do not add dependencies, backend storage, authentication, official medical scoring, or diagnostic claims. Haru-specific advisory attention/risk levels are allowed if they follow the disclaimer and explanation rules above.
