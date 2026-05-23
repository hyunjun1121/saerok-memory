# Prompt for Google Jules

You are working in the `hyunjun1121/saerok-memory` GitHub repository.

Implement a scoped product/UI upgrade for the Haru demo. The goal is to finish the visual brand asset integration and add a genuinely useful family, caregiver, and counselor-facing report view, while preserving the existing older-adult-friendly daily routine experience.

## Jules Workflow Context

Use the repository root `AGENTS.md` as persistent agent guidance. Jules automatically looks for `AGENTS.md` in the repository root, so treat that file as the first source of project rules before planning or editing.

Official Jules references used to prepare this task:

- https://jules.google/docs/
- https://jules.google/docs/running-tasks/
- https://jules.google/docs/tasks-repos/
- https://jules.google/docs/faq/

Work in a narrow, reviewable scope. Produce a clear implementation plan before editing. After editing, run the feasible validation commands and summarize exact results.

## Project Context

This is a React 18 + TypeScript + Vite app for older adults. The product is now named Haru. The intended experience is:

- The user completes a short daily cognitive and memory routine.
- Each day feels like a small milestone that accumulates into visible progress.
- The learner-facing flow should remain light, friendly, non-punitive, and Duolingo-like.
- Family members, caregivers, or counselors should be able to view a separate report-style screen that helps them understand activity patterns and choose conversation topics.
- The app may include Haru's own evidence-informed advisory attention/risk levels in caregiver/counselor/report contexts. It must not present those levels as a medical device output, official dementia screening result, diagnostic test, treatment, prevention tool, or official clinical score.

## Required Inputs To Inspect First

Before planning or editing, inspect:

- `AGENTS.md`
- `README.md`
- `design.md`
- `package.json`
- `src/App.tsx`
- `src/components/AppShell.tsx`
- `src/components/BottomNavigation.tsx`
- `src/components/TopStatusBar.tsx`
- `src/app/home/HomeScreen.tsx`
- `src/app/family/FamilyScreen.tsx`
- `src/app/garden/GardenScreen.tsx`
- `src/app/result/ResultScreen.tsx`
- `src/app/settings/SettingsScreen.tsx`
- `src/features/cognitive/cognitiveRoutineStorage.ts`
- `src/features/memory/memoryCardStorage.ts`
- `src/features/memory/types.ts`
- `src/features/memory/memoryReviewGenerator.ts`
- `src/locales/ko.json`
- `src/locales/ja.json`
- `src/locales/en.json`
- the `image/` folder if present

Do not edit grant application documents, generated document artifacts, videos, PDFs, HWP/HWPX/DOCX files, or files under the grant application folder unless they are necessary to ignore build artifacts. The web app implementation should live mainly under `src/**`, `public/**`, and focused tests.

## Important Existing Product Rules

Follow `design.md` as the canonical UI/UX reference.

Preserve:

- click-first interaction
- recognition before free recall
- large touch targets
- low cognitive load
- gentle feedback
- warm visual reward language
- review as forward progress
- no punishment for mistakes
- privacy-first family sharing
- mobile-first layout for the learner experience

For family, caregiver, and counselor views, desktop/tablet density may be higher than learner screens, but keep the UI calm, readable, and non-clinical.

## Medical And Safety Constraints

This task should follow the updated product direction: Haru should not be so defensive that it avoids all useful interpretation. It can provide Haru-specific advisory signals if they are based on local routine data, memory patterns, and caregiver observations, and if the UI clearly explains that these are not medical diagnoses or official screening results.

Do not use or display:

- dementia diagnosis
- dementia screening result
- cognitive impairment detected
- MMSE score
- K-MMSE score
- MoCA score
- CIST score
- normal / mild / moderate / severe dementia
- medical-grade assessment
- detects dementia
- prevents dementia
- treats dementia

Use safe wording such as:

- daily cognitive routine
- memory practice
- recall practice
- attention practice
- drawing practice
- speech practice
- activity report
- conversation cue
- care conversation support
- Haru advisory insight
- attention level
- conversation-needed signal
- expert consultation consideration
- not a medical test
- consult a healthcare professional for medical concerns

Low performance from a single session must never be presented as diagnosis or disease progression. Repeated patterns may feed a Haru-specific advisory level when the report explains the contributing signals and pairs the output with a first-run/startup disclaimer.

## Scope A: Finish Haru Visual Asset Integration

The prior local work generated Haru visual assets under the repository `image/` folder. Finish integrating them into the demo if those files are present.

Expected asset handling:

- Create or update `public/assets/haru/`.
- Use stable web-friendly filenames.
- Use the transparent revised mascot and logo assets when present.
- Use the garden scene, app icon, memory bloom symbol, water drop reward icon, family illustration, cognitive routine icon sheet, and background pattern when present and suitable.
- Do not regenerate images.
- If an expected image is missing, implement a graceful fallback using existing icons and report the missing file.

Suggested asset mapping if files exist:

- `image/revised_01_transparent.png` -> mascot
- `image/revised_02_transparent.png` -> mascot pose sheet
- `image/revised_04_transparent.png` -> Korean logo
- `image/revised_05_transparent.png` -> Japanese hiragana logo
- `image/revised_06_transparent.png` -> Japanese kanji logo or Japan variant mark
- `image/revised_08_transparent.png` -> water drop reward icon
- `image/revised_09.png` -> garden reward scene
- `image/03.png` -> app icon
- `image/07.png` -> memory bloom symbol
- `image/10.png` -> cognitive routine icons
- `image/11.png` -> family connection illustration
- `image/12.png` -> soft background pattern

Integrate assets into:

- top status bar branding
- home screen hero/unit card
- mascot bubble or equivalent mascot location
- result reward screen
- garden reward screen
- family/caregiver screen
- app title and favicon if appropriate

Keep the UI professional and restrained. Do not create nested decorative cards. Do not let images make text unreadable. Use responsive constraints so the mobile layout remains stable.

## Scope B: Add A Family, Caregiver, And Counselor Report View

The existing `/family` route is currently closer to a guardian invite or simple summary screen. Upgrade it into a more useful evidence-informed support screen with Haru-specific advisory insight, while avoiding official diagnosis or clinical-score framing.

The screen should serve two audiences:

1. Family or guardian users who want gentle activity visibility and conversation cues.
2. Counselors or field practitioners who want a lightweight report to prepare supportive conversations.

Do not add authentication or a backend. This is an MVP demo using local data only.

### Required Information Architecture

Add a clear mode switch or segmented control within `/family`, or split into nested tabs if the existing structure supports it:

- Family view
- Counselor view

The bottom navigation can still label this route as family or support. Keep route changes minimal unless a separate route is clearly better.

### Family View Requirements

Show:

- invite or connection state as a demo placeholder
- weekly routine completion count
- memory cues due for review
- shared memory count
- last practice date if available
- gentle conversation starters based only on shareable memory cards
- a clear privacy note that personal memory details are private by default

Respect:

- `shareWithFamily === true` before showing personal memory details
- local-only MVP storage
- no diagnostic labels

If there is no data, show a helpful empty state that explains what will appear after routines are completed.

### Counselor View Requirements

Add a report-style support panel that can help a counselor prepare for a session.

Show safe, useful summaries such as:

- recent routine activity by date
- completed routine types
- missed or hint-used practice counts if available, framed as practice support needs rather than impairment
- memory cue categories available for conversation
- shareable story summaries when explicitly shareable
- suggested conversation prompts based on stored non-sensitive or shareable cues
- privacy and limitations notice

The counselor view must not:

- calculate an official dementia-risk estimate
- infer a diagnosis
- show a medical score
- claim clinical validity
- reveal private stories unless shareable
- overstate data quality

The counselor view may calculate or display a Haru-specific advisory attention/risk level if it is clearly labeled as Haru's own support signal, not a clinical dementia-risk estimate. The explanation should show contributing factors such as routine consistency, delayed recall, attention/color-focus, drawing telemetry, memory-review changes, and caregiver observations.

Recommended safe labels:

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

### Conversation Cue Logic

Implement simple deterministic helper logic, preferably in a typed utility file, to produce conversation cues from locally stored data.

Examples:

- If a shareable memory card has a `textSummary`, suggest asking about that shared story.
- If a shareable card has `emotionTag`, suggest asking what made that feeling stand out.
- If a card has people or place cues and is shareable, suggest a gentle follow-up around that person or place.
- If no shareable memory data exists, suggest neutral routine-based prompts such as asking which activity felt easiest today.

Keep all generated copy i18n-based or generated from localized templates. Do not hard-code visible UI text inside TSX components.

## Scope C: i18n For New UI Only

All new visible text must use i18n keys.

Add new strings to:

- `src/locales/ko.json`
- `src/locales/ja.json`
- `src/locales/en.json`

Keep Korean, Japanese, and English entries coherent.

Important: Do not take over the broader existing lesson-content localization task in this Jules task. If existing mock exercise prompts are not fully localized, leave that for a separate task unless you must touch a specific string introduced by this work.

## Scope D: Tests

Add or update focused tests for the new behavior.

Suggested tests:

- family/counselor screen renders with no local data
- family/counselor screen summarizes local routine results
- private memory details are not shown when `shareWithFamily` is false
- shareable memory cue can appear as a conversation cue
- counselor view avoids official diagnostic language while allowing Haru-specific advisory wording
- helper functions tolerate missing or invalid local data

Prefer React Testing Library and Vitest consistent with the repository.

## Implementation Preferences

- Keep the implementation local-first.
- Do not add a backend.
- Do not add new dependencies unless strongly justified.
- Prefer typed helper modules over scattered `JSON.parse(localStorage.getItem(...))`.
- Keep browser storage helpers defensive.
- Reuse existing UI components such as `Button3D`, `ChoiceCard`, `MascotBubble`, `TopStatusBar`, and existing Tailwind tokens where appropriate.
- Preserve mobile layout quality.
- Add tablet/desktop improvements for the counselor report only if it stays simple.

## Validation Commands

Run the feasible commands:

```bash
npm install
npm run test
npm run typecheck
npm run lint
npm run build
```

If a command cannot run in the Jules VM, report:

- the exact command
- the exact error
- the closest alternative command you ran

## Final Response Requirements

In the final response, report:

- files changed
- new or moved assets
- new route or screen behavior
- storage keys read or written
- medical safety wording used
- tests added or updated
- validation commands and exact results
- any missing image assets or limitations

Do not claim clinical validation. Do not claim medical efficacy. Do not claim the screen is suitable for diagnosis or formal screening.
