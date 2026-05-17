# Haru Agent Guide

This file is intended for Google Jules, Codex, and any other coding agent working in this repository. Read it before planning or editing.

Jules automatically looks for `AGENTS.md` in the root of the repository. Keep this file current because Jules uses it to understand setup, conventions, task boundaries, and expected validation before it proposes or completes changes.

## Product Summary

Haru, formerly developed as Memory Garden, is a Duolingo-style daily cognitive and memory routine app for older adults.

The app helps users complete short, friendly daily routines that can accumulate into a sense of progress. It combines cultural language learning, recall practice, personal memory cues, gentle cognitive routines, garden-like rewards, and family/caregiver support.

The product should feel like a warm daily routine, not a hospital exam. It must not present itself as a dementia diagnosis, dementia screening, medical treatment, prevention tool, or clinical scoring system.

## Current Product Direction

- Brand name: `Haru`.
- Korean meaning: `하루`, a daily routine and one day at a time.
- Japanese meaning: `はる` or `春`, spring, warmth, and a new beginning.
- Preferred product framing: a daily memory and cognitive routine that helps older adults revisit their day, preserve personal memory cues, and create conversation material for families or care professionals.
- Learner-facing screens should remain mobile-first, friendly, sparse, and click-first.
- Caregiver/counselor-facing screens may be denser, but must remain non-medical and non-alarming.

## Tech Stack

- React 18
- TypeScript strict mode
- Vite
- React Router v6
- Tailwind CSS with custom tokens
- `react-i18next` with Korean, Japanese, and English locales
- React Context and reducer-style state where already established
- Vitest and React Testing Library for unit/component tests
- Playwright may exist for browser-level checks

## Setup And Validation Commands

Use the existing project scripts.

```bash
npm install
npm run test
npm run typecheck
npm run lint
npm run build
```

If a command cannot run in the agent environment, report the exact command, the exact error, and the closest alternative that was run.

Jules usually runs inside a short-lived Linux VM. Do not rely on Windows-only paths or shell syntax in Jules tasks unless a user explicitly asks for local Windows work.

## Important Directories

```text
src/
  app/
    home/
    lesson/
    result/
    garden/
    family/
    settings/
  components/
  data/
  features/
    cognitive/
    gamification/
    lessons/
      ExerciseRenderer.tsx
      exerciseTypes/
    memory/
  locales/
  styles/
  utils/

image/
  Haru visual source assets and image-generation prompts

public/
  Static assets served by Vite

피우다프로젝트/
  Grant application sources, generated documents, screenshots, and application work artifacts
```

Grant application files, generated documents, videos, HWP/HWPX/DOCX/PDF render artifacts, and application screenshots are not part of routine web-app implementation. Do not edit them unless the user explicitly asks for grant/document work.

## Main Routes

- `/` - learning home
- `/lesson` - daily lesson session
- `/result` - session result
- `/garden` - memory garden reward view
- `/family` - family/caregiver/counselor support view
- `/settings` - language and local data management

## Jules Task Workflow

Before coding:

1. Inspect this file, `README.md`, `design.md`, `package.json`, and the source files relevant to the task.
2. Read any task-specific prompt file referenced by the user.
3. Produce a narrow implementation plan.
4. Explain how new UI follows `design.md`.
5. Identify any medical, privacy, i18n, or asset-handling risks before editing.

During coding:

1. Keep the change scoped to the requested behavior.
2. Follow the current architecture and UI patterns.
3. Add or update focused tests with behavioral changes.
4. Avoid unrelated refactors.
5. Do not add dependencies unless strongly justified.
6. Do not edit grant/document assets unless explicitly requested.

Before finishing:

1. Run feasible validation commands.
2. Report exact validation results.
3. Summarize files changed.
4. Summarize new routes, exercise types, storage keys, or assets if any.
5. State medical/copyright/privacy safety measures.
6. Report remaining limitations or missing assets.

## Task Prompt Index

Use these prompt files when the user asks Jules to continue related work:

- `피우다프로젝트/jules_cognitive_features_prompt.md` - cognitive routine MVP, personal memory cue strengthening, non-diagnostic routine storage.
- `피우다프로젝트/jules_clarification_response.md` - clarification response for the cognitive routine task.
- `jules_caregiver_counselor_dashboard_prompt.md` - Haru visual asset integration and family/caregiver/counselor report screen upgrade.

If a prompt conflicts with this file, follow the stricter medical, privacy, i18n, and scope-safety rule.

## Coding Conventions

- Use PascalCase for React components.
- Use camelCase for functions and variables.
- Keep component props explicit and typed.
- Prefer existing components such as `Button3D`, `ChoiceCard`, `FeedbackTray`, `ProgressBar`, and `MascotBubble`.
- Prefer small typed helper modules over scattered `JSON.parse(localStorage.getItem(...))` calls.
- Storage code must tolerate missing storage, invalid JSON, and unavailable browser APIs.
- Do not introduce a backend for MVP features unless explicitly requested.
- Avoid broad styling rewrites unless the task is specifically about visual redesign.

## i18n Rules

All visible user-facing text must go through i18n or typed localized data.

- Add Korean strings to `src/locales/ko.json`.
- Keep `src/locales/en.json` and `src/locales/ja.json` coherent when adding new keys.
- Use dot-notation namespaced keys such as `feedback.correct.title`.
- Do not hard-code visible UI text inside TSX components.
- Exercise mock data may use the localized text helper pattern in `src/utils/localizedText.ts`.
- When adding Japanese content, do not leave Korean lesson prompts visible in Japanese mode.
- Speech synthesis and recognition language should follow the active locale where feasible.

## UI And Accessibility Principles

The target user is an older adult using a lightweight daily routine. Preserve the current click-first, Duolingo-like interaction model.

Use `design.md` as the canonical UI/UX design reference. New screens and exercise components should match its interaction patterns, emotional tone, accessibility rules, and lesson-flow model.

- Use large tap targets.
- Keep each learner-facing screen focused on one task.
- Prefer recognition-first choices over typing.
- Avoid dense questionnaires in learner screens.
- Avoid hidden gestures or precision-only controls.
- Use gentle feedback and clear next actions.
- Do not punish memory errors.
- Do not add competitive leaderboards or excessive ranking.
- Keep visual style consistent with Haru's warm, simple brand direction.
- Do not create nested decorative cards.
- Keep text readable over images and responsive at mobile widths.

## Haru Visual Assets

Haru image source files may exist in `image/`. If a task asks to apply them to the app:

- Copy web-ready assets into `public/assets/haru/` with stable filenames.
- Prefer transparent revised assets where available.
- Do not regenerate images unless explicitly asked.
- Use graceful fallbacks when an expected image is missing.
- Keep asset use restrained and functional: branding, mascot, reward, garden, family/caregiver support, and cognitive routine cues.
- After visual changes, run a build and inspect the rendered app when feasible.

## Exercise System

Exercise types are discriminated by `Exercise.type` in `src/data/mockExercises.ts` and rendered through `src/features/lessons/ExerciseRenderer.tsx`.

When adding a new exercise type:

1. Extend `ExerciseType`.
2. Extend `ExercisePayload` only with typed fields needed by the new exercise.
3. Add a focused component under `src/features/lessons/exerciseTypes/`.
4. Register it in `ExerciseRenderer`.
5. Add or update tests so every declared exercise type renders without the unsupported fallback.
6. Keep feedback behavior compatible with `ExerciseState`.

## Memory System

The current MVP stores memory cards in browser `localStorage` under `memoryCards`.

Important files:

- `src/features/lessons/exerciseTypes/PersonalMemoryRecall.tsx`
- `src/features/memory/types.ts`
- `src/features/memory/memoryScheduler.ts`
- `src/features/memory/memoryReviewGenerator.ts`
- `src/features/memory/memoryCardStorage.ts`
- `src/app/lesson/LessonScreen.tsx`

Personal memory should be represented as a structured cue for later review, not as a meaningless category picker.

Memory cards may include:

- topic
- emotion tag
- people tags
- place tag
- story cue summary
- original transcript when explicitly entered or captured
- linked concept
- created and updated time
- sensitivity
- family sharing flag
- review state

If multiple memory cue prompts in the same lesson refer to the same concept/session, prefer merging fields into one structured card or draft rather than creating disconnected cards.

Review scheduling should respect `dueAt` and priority. Due cards should be reviewed before random non-due cards.

## Cognitive Routine Direction

The app may include gentle cognitive routines inspired by broad cognitive domains such as:

- delayed recall
- attention and simple number patterns
- language repetition
- visuospatial drawing practice
- personal memory recognition

These routines must be original, lightweight, and non-diagnostic.

Suggested MVP exercise families:

- delayed word recall with an encode step and later recognition step
- simple number pattern choice
- simple shape copy practice using canvas
- speech repeat practice using optional browser speech APIs
- structured personal memory cue creation and later recognition review

Use local storage for lightweight routine completion records, for example `cognitiveRoutineResults`.

## Caregiver And Counselor Screens

The `/family` area may support family, caregiver, and counselor views. These screens should help supporters understand routine participation and prepare supportive conversations.

Allowed summaries:

- completed routines
- last practice date
- routine participation by date
- due memory cues
- explicitly shareable memory summaries
- safe conversation starters
- privacy and local-demo limitations

Do not show private memory details unless `shareWithFamily === true`.

Do not show diagnostic categories, disease risk, medical scores, or alarming trend labels.

Frame any lower performance or missed item as a practice support need, not as impairment.

## Medical And Copyright Safety

This app must not copy, implement, score, or market itself as MMSE, K-MMSE, MoCA, CIST, or any other official cognitive screening instrument.

Do not reproduce:

- official test forms
- exact official instructions
- official scoring rules
- total 30-point MMSE interpretation
- official MMSE stimuli or layouts
- official diagnostic thresholds

Do not use UI, docs, README, prompts, or comments that claim:

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

Use safe language such as:

- daily cognitive routine
- memory practice
- recall practice
- attention practice
- drawing practice
- speech practice
- family conversation cue
- activity report
- not a medical test
- consult a healthcare professional for medical concerns

Low performance in the app must never be presented as a diagnosis or risk label.

## Privacy And Family Sharing

Memory cards are private by default.

- `shareWithFamily` must default to `false`.
- Do not show personal memory details on family/caregiver/counselor screens unless the card is explicitly shareable.
- Family-facing summaries should be non-medical and non-alarming.
- Prefer summaries such as completed routines, due memory cues, and conversation prompts.
- Settings must let users delete locally stored personal memory and cognitive routine data.
- If future backend storage is added, require explicit consent, access control, deletion, and privacy copy.

## Browser API Rules

Features may use browser APIs such as `localStorage`, `speechSynthesis`, Web Speech Recognition, pointer events, touch events, and canvas.

Use them defensively:

- Guard for API availability.
- Keep completion possible when speech recognition is unavailable.
- Do not fail the lesson because a browser API is missing.
- Keep TypeScript types safe for browser-specific APIs.
- Store only what is needed for the MVP.

## Out Of Scope Unless Explicitly Requested

- Medical diagnosis or clinical scoring
- Official cognitive-screening instrument reproduction
- Facial recognition
- Automatic family relation inference
- Hospital, insurance, or EHR integration
- Complex LLM free-chat
- Competitive ranking
- Backend migration
- Grant application document editing
- Further product renaming
