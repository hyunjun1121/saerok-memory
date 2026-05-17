# Prompt for Google Jules

You are working in the `hyunjun1121/saerok-memory` GitHub repository.

Implement a scoped MVP that strengthens the app's dementia-care relevance while preserving the existing Duolingo-style, click-first UI/UX for older Korean adults.

## Context

This is a React 18 + TypeScript + Vite app for older Korean adults. It currently teaches Korean idioms and cultural expressions through short recognition-first exercises. It already has a personal-memory card concept stored in `localStorage`, but the current "personal memory topic selection" flow feels weak because the screen looks like a simple category picker instead of a meaningful memory cue that will be reviewed later.

The intended product direction is:

- Keep the friendly, lightweight, non-punitive learning flow.
- Make personal memory questions meaningful by storing selected personal cues and asking about them again after time has passed.
- Add cognitive-routine exercises inspired by cognitive screening domains, but do not implement, copy, score, or market the app as an MMSE, K-MMSE, MoCA, CIST, or any medical diagnostic test.
- Avoid product naming decisions. Do not rename the app, brand, routes, or application documents in this task.

## Important Medical and Copyright Constraints

Do not reproduce official MMSE forms, exact scoring, total 30-point interpretation, official stimuli, official instructions, or copyrighted layouts.

Do not claim that the app diagnoses, screens, prevents, treats, or detects dementia.

Use safe wording in UI copy such as:

- cognitive routine
- memory practice
- recall practice
- attention practice
- drawing practice
- family conversation cue
- not a medical test
- consult a healthcare professional for medical concerns

Do not use wording such as:

- dementia diagnosis
- dementia screening result
- cognitive impairment detected
- MMSE score
- normal / mild / moderate / severe dementia
- medical grade assessment

The implementation may be inspired by public descriptions of cognitive domains such as delayed recall, attention/calculation, language repetition, and visuospatial drawing, but it must be original, gentle, and non-diagnostic.

## Jules-Specific Working Style

Before editing, inspect the repository structure, `AGENTS.md`, `README.md`, `design.md`, package scripts, and existing exercise components.

Treat `design.md` as the canonical UI/UX design reference for this task. The new cognitive routines must fit the existing product design rather than introducing a separate clinical-test interface.

When planning the implementation, explicitly map the new screens and interactions back to the relevant `design.md` principles, especially:

- click-first interaction
- recognition before free recall
- low cognitive load for older adults
- large touch targets
- gentle feedback
- personal memory reinforcement without making the user feel examined
- review as forward progress
- no punishment for memory mistakes
- privacy-first memory sharing

If a requested feature conflicts with `design.md`, preserve the intent of the feature while adapting the UI to the existing design system.

Use a narrow, reviewable branch and provide a clear plan before making code changes.

Keep the implementation self-contained. Prefer local state and `localStorage`; do not add a backend.

Do not edit grant/application assets or generated documents unless the codebase requires ignoring them. The web app changes should live mainly under `src/**` and tests.

Do not add new dependencies unless they are clearly necessary and justified in the final summary.

All visible app text must continue to use i18n keys. Add Korean strings to `src/locales/ko.json`; keep English and Japanese fallback entries coherent if those locale files exist. Do not hard-code user-facing strings in components.

## Current Code Hints

Relevant existing files include:

- `src/app/lesson/LessonScreen.tsx`
- `src/features/lessons/ExerciseRenderer.tsx`
- `src/features/lessons/exerciseTypes/PersonalMemoryRecall.tsx`
- `src/features/memory/types.ts`
- `src/features/memory/memoryScheduler.ts`
- `src/features/memory/memoryReviewGenerator.ts`
- `src/data/mockExercises.ts`
- `src/locales/ko.json`
- `src/app/family/FamilyScreen.tsx`
- `src/app/settings/SettingsScreen.tsx`

The current memory card flow already stores `memoryCards` in `localStorage` and calculates review intervals with `calculateNextReviewState`. Improve this rather than replacing it with a separate unrelated system.

## Feature Requirements

### 1. Make the personal memory feature meaningful

Refactor the personal-memory creation and review flow so it is clearly about creating a memory cue for later review.

Requirements:

- A personal memory should represent one structured memory cue, not disconnected category-only cards when possible.
- Store structured fields such as topic, emotion, people tag, place tag, linked concept, created time, updated time, sharing preference, sensitivity, and review state.
- If the user answers multiple memory-cue prompts in the same lesson for the same concept, merge those answers into one memory card or draft instead of always creating unrelated cards.
- Keep free text out of the core flow. Use choice cards.
- Update prompts and feedback so the user understands that the app will ask about this cue again later.
- Review questions should ask about previously selected fields, for example topic, emotion, place, or people, using recognition-first multiple choice.
- Review scheduling must respect `dueAt` and priority. Do not randomly pick any saved card when there are due cards. Use or extend `calculatePriority`.
- When a review answer is correct without hints, mark it as remembered. When the user needs a hint or misses, update the review state accordingly.
- Avoid shame, failure language, or medical labels.

### 2. Add a delayed three-word recall routine

Add a new cognitive routine exercise type for delayed recall.

Behavior:

- Early in a lesson, show three familiar Korean words as a memory set.
- Tell the user, through i18n text, that the words will be asked again later.
- The user confirms they are ready; no typing is required.
- After several unrelated exercises, ask the user to pick the three remembered words from a larger set of choices.
- Use multi-select choice cards with large tap targets.
- Provide gentle feedback. Do not display a medical score.
- Store lightweight local results in `localStorage`, for example under `cognitiveRoutineResults`, including timestamp, routine type, selected answers, expected answers, and whether the user completed it.
- Make the word set deterministic in mock data so tests are stable.

Implementation guidance:

- Add an exercise type such as `delayed_word_recall`.
- Add any needed payload fields to `ExercisePayload`, for example `phase`, `wordSetId`, `words`, `options`, and `requiredSelectionCount`.
- Ensure `ExerciseRenderer` handles the new type.

### 3. Add a gentle attention/calculation routine

Add a new recognition-first attention routine inspired by serial subtraction, without copying any official test wording or scoring.

Behavior:

- Present a number pattern such as decreasing by a fixed amount.
- Ask the user to choose the next number from large multiple-choice buttons.
- Keep it easy and supportive.
- Provide a hint after the first miss.
- Store lightweight local result data under the same cognitive routine result storage.

Implementation guidance:

- Add an exercise type such as `number_pattern_choice` or `attention_pattern`.
- Do not label it as MMSE or dementia screening.
- Add tests for correct selection, first-miss hint behavior, and stored result shape.

### 4. Add a non-diagnostic drawing-copy routine

Add a simple visuospatial drawing practice component.

Behavior:

- Show an original simple shape pattern to copy. Do not reproduce the official MMSE intersecting-pentagon stimulus.
- Provide a touch/mouse canvas where the user can draw.
- Include clear/reset and done buttons.
- Store a local completion record. If saving the drawing data URL is simple and safe, store it locally; otherwise store completion metadata only.
- Do not automatically judge the drawing as normal or abnormal.
- The UI should say this is drawing practice, not a medical test.

Implementation guidance:

- Add an exercise type such as `shape_copy_practice`.
- Use plain Canvas APIs; do not add a drawing library unless unavoidable.
- Ensure it works on desktop mouse and mobile touch events.

### 5. Add a gentle speech repetition routine

Add a language/pronunciation routine without requiring perfect speech recognition.

Behavior:

- Show and optionally read aloud a short Korean phrase using browser `speechSynthesis` if available.
- Ask the user to repeat it aloud.
- Provide a simple "I said it" completion button.
- If Web Speech Recognition is available in the browser, optionally capture a transcript, but do not require this for completion and do not fail the exercise if unavailable.
- Store a local completion record and optional transcript.
- Do not use harsh tongue-twister difficulty as the default. Keep the first routine simple and older-adult friendly.

Implementation guidance:

- Add an exercise type such as `speech_repeat_practice`.
- Keep browser API usage defensive and typed safely for TypeScript.

### 6. Improve family/caregiver value without overclaiming

Update the family/caregiver screen to explain or summarize non-sensitive progress from the new routines.

Requirements:

- Show gentle, non-medical summaries such as completed routines, memory cues due for review, and conversation prompts.
- Do not show diagnostic categories or medical risk labels.
- Respect `shareWithFamily`. Personal memory details should not be shown as shared unless the card is explicitly marked shareable.
- Keep privacy copy clear.

### 7. Update settings/data deletion

Update settings so the user can remove all locally stored memory and cognitive routine data.

Requirements:

- Existing memory-card deletion should remain.
- Add deletion for cognitive routine results and drawing/speech records if stored separately.
- Use clear i18n labels and safe confirmation if the existing UI pattern supports it.

## Data and Storage Guidance

Create small storage helpers if helpful, for example:

- `src/features/memory/memoryCardStorage.ts`
- `src/features/cognitive/cognitiveRoutineStorage.ts`

Prefer typed helpers over scattered `JSON.parse(localStorage.getItem(...))` calls.

Storage should be resilient:

- tolerate missing storage
- tolerate invalid JSON
- never crash the lesson screen
- keep privacy defaults conservative

## UI/UX Requirements

- Preserve the existing Duolingo-like lesson layout and bottom fixed action button pattern.
- Follow `design.md` as the source of truth for interaction style, emotional tone, accessibility, and lesson-flow structure.
- Reuse existing design patterns from `Button3D`, `ChoiceCard`, `FeedbackTray`, lesson progress, reward/garden feedback, and bottom navigation.
- Keep new cognitive routines visually integrated into the current lesson path. Do not make them look like a separate medical assessment screen.
- Use large touch targets, high contrast, simple wording, and low cognitive load.
- Do not introduce dense clinical questionnaires.
- Do not add leaderboards, rankings, or punitive scoring.
- Keep feedback encouraging and concrete.
- Make the new routines feel like part of the lesson path, not a hospital exam.

## Testing Requirements

Add or update focused tests. At minimum:

- `ExerciseRenderer` renders every declared exercise type without fallback.
- Memory cue creation merges multiple fields into one structured card where appropriate.
- Due memory cards are selected before non-due random cards.
- Memory review updates `reviewState` correctly for remembered, hint-used, and missed outcomes.
- Delayed word recall requires selecting the expected count and records a local result.
- Number pattern choice handles correct and first-miss hint behavior.
- Drawing practice can render and complete without throwing in the test environment.
- Speech repetition can render and complete when browser speech APIs are unavailable.
- Settings deletion clears the new local storage keys.

Run these commands before finishing:

```bash
npm install
npm run test
npm run typecheck
npm run build
```

If one of these cannot be run in Jules, explain exactly why and run the closest available alternative.

## Acceptance Criteria

The task is complete when:

- The app has meaningful personal-memory cue creation and later recognition-based review.
- The lesson flow includes at least one delayed word recall encode step and one later recall step.
- The lesson flow includes an attention number-pattern routine.
- The app includes simple drawing-copy and speech-repeat practice routines, even if their MVP scoring is completion-only.
- Family/caregiver and settings screens reflect the new local data safely.
- No UI claims to diagnose, screen, treat, cure, prevent, or detect dementia.
- The implementation does not copy official MMSE text, official MMSE scoring, official forms, or official stimuli.
- All visible user text is routed through i18n.
- Tests, typecheck, and build pass, or failures are clearly documented with actionable details.

## Final Response Format

When finished, summarize:

- Files changed
- New exercise types and storage keys
- Medical/copyright safety measures
- Tests and build commands run, with results
- Any limitations or follow-up work
