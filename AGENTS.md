# Memory Garden Agent Guide

This file is intended for Google Jules, Codex, and any other coding agent working in this repository. Read it before planning or editing.

## Product Summary

Memory Garden is a Duolingo-style, click-first cognitive routine app for older Korean adults, especially users around ages 60-80.

The app teaches Korean four-character idioms, proverbs, and cultural expressions through short recognition-based exercises. It connects learning content to structured personal memory cues without requiring free-text input.

The product should feel like a friendly daily learning routine, not a hospital exam.

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

If a command cannot run in the agent environment, report the exact command, error, and closest alternative that was run.

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
    gamification/
    lessons/
      ExerciseRenderer.tsx
      exerciseTypes/
    memory/
  locales/
  styles/
```

Grant application files, generated documents, videos, and render artifacts are not part of the web app implementation. Do not edit them unless the user explicitly asks for grant/document work.

## Main Routes

- `/` - learning home
- `/lesson` - daily lesson session
- `/result` - session result
- `/garden` - memory garden reward view
- `/family` - family/caregiver view
- `/settings` - language and local data management

## Coding Conventions

- Use PascalCase for React components.
- Use camelCase for functions and variables.
- Keep component props explicit and typed.
- Prefer existing components such as `Button3D`, `ChoiceCard`, `FeedbackTray`, `ProgressBar`, and `MascotBubble`.
- Keep changes scoped to the requested behavior.
- Do not add dependencies unless there is a clear technical need.
- Do not introduce a backend for MVP features unless explicitly requested.
- Prefer small typed helper modules over scattered `JSON.parse(localStorage.getItem(...))` calls.
- Storage code must tolerate missing storage, invalid JSON, and unavailable browser APIs.

## i18n Rules

All visible user-facing text must go through i18n.

- Add Korean strings to `src/locales/ko.json`.
- Keep `src/locales/en.json` and `src/locales/ja.json` coherent when adding new keys.
- Use dot-notation namespaced keys such as `feedback.correct.title`.
- Do not hard-code visible UI text inside TSX components.

## UI And Accessibility Principles

The target user is an older adult using a lightweight daily routine. Preserve the current click-first, Duolingo-like interaction model.

Use `design.md` as the canonical UI/UX design reference. New screens and exercise components should match its interaction patterns, emotional tone, accessibility rules, and lesson-flow model.

- Use large tap targets.
- Keep each screen focused on one task.
- Prefer recognition-first choices over typing.
- Avoid dense questionnaires.
- Avoid hidden gestures or precision-only controls.
- Use gentle feedback and clear next actions.
- Do not punish memory errors.
- Do not add competitive leaderboards or excessive ranking.
- Keep visual style consistent with the existing app.

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
- `src/app/lesson/LessonScreen.tsx`

Personal memory should be represented as a structured cue for later review, not as a meaningless category picker.

Memory cards may include:

- topic
- emotion tag
- people tags
- place tag
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

## Medical And Copyright Safety

This app must not copy, implement, score, or market itself as MMSE, K-MMSE, MoCA, CIST, or any other official cognitive screening instrument.

Do not reproduce:

- official test forms
- exact official instructions
- official scoring rules
- total 30-point MMSE interpretation
- official MMSE stimuli or layouts
- official diagnostic thresholds

Do not use UI or documentation claims such as:

- dementia diagnosis
- dementia screening result
- cognitive impairment detected
- MMSE score
- normal / mild / moderate / severe dementia
- medical-grade assessment
- detects dementia
- prevents dementia
- treats dementia

Use safe language such as:

- cognitive routine
- memory practice
- recall practice
- attention practice
- drawing practice
- family conversation cue
- not a medical test
- consult a healthcare professional for medical concerns

Low performance in the app must never be presented as a diagnosis or risk label.

## Privacy And Family Sharing

Memory cards are private by default.

- `shareWithFamily` must default to `false`.
- Do not show personal memory details on the family/caregiver screen unless the card is explicitly shareable.
- Family-facing summaries should be non-medical and non-alarming.
- Prefer summaries such as completed routines, due memory cues, and conversation prompts.
- Settings must let users delete locally stored personal memory and cognitive routine data.

## Browser API Rules

Features may use browser APIs such as `localStorage`, `speechSynthesis`, Web Speech Recognition, pointer events, touch events, and canvas.

Use them defensively:

- Guard for API availability.
- Keep completion possible when speech recognition is unavailable.
- Do not fail the lesson because a browser API is missing.
- Keep TypeScript types safe for browser-specific APIs.

## Task-Specific Prompt

For the planned cognitive feature expansion, use:

```text
피우다프로젝트/jules_cognitive_features_prompt.md
```

That file is a task prompt for Jules. This `AGENTS.md` is the persistent repository guide.

## Expected Agent Workflow

Before coding:

1. Inspect this file, `README.md`, `design.md`, package scripts, and relevant source files.
2. Produce a narrow implementation plan that explains how the UI follows `design.md`.
3. Keep the change reviewable and scoped.

During coding:

1. Follow existing architecture and UI patterns.
2. Add or update focused tests with each behavioral change.
3. Avoid unrelated refactors.
4. Avoid editing grant/document assets.

Before finishing:

1. Run the validation commands that are feasible in the environment.
2. Summarize files changed.
3. Summarize new exercise types and storage keys if any.
4. State medical/copyright safety measures.
5. Report validation results and any remaining limitations.

## Out Of Scope Unless Explicitly Requested

- Medical diagnosis or clinical scoring
- Facial recognition
- Automatic family relation inference
- Hospital, insurance, or EHR integration
- Complex LLM free-chat
- Competitive ranking
- Backend migration
- Grant application document editing
- Product renaming or brand changes
