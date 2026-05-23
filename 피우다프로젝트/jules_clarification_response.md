# Jules Clarification Response

This file is a paste-ready response to Jules for the cognitive routine implementation task.

## Short Answer

Yes, your assumptions are mostly correct. Please proceed with the implementation using the clarifications below. Keep the work scoped, follow `AGENTS.md`, and treat `design.md` as the canonical UI/UX reference.

## Jules Workflow Context

Jules works best with a clear, scoped prompt and can ask for feedback before coding. Since this is a clarification response, use it to update your plan and then continue with a narrow implementation. Jules runs each task in its own VM, clones the repository, installs dependencies, modifies files, and can run discrete commands such as tests, typecheck, lint, and build.

Official Jules references used for this workflow expectation:

- https://jules.google/docs/
- https://jules.google/docs/running-tasks/
- https://jules.google/docs/tasks-repos/
- https://jules.google/docs/faq/

## 1. Merging Memory Cues

Yes. If multiple `personal_memory_recall` exercises in the same lesson/session share the same `linkedConceptId`, they should be merged into one structured `MemoryCard` or one in-progress draft that becomes a `MemoryCard`.

Expected behavior:

- Use one card for the same `userId`, `lessonId` or active session, `source`, and `linkedConceptId`.
- Combine selected fields such as `topic`, `emotionTag`, `peopleTags`, and `placeTag` into that card.
- Preserve `createdAt` from the first cue and update `updatedAt` whenever another field is added.
- Do not create disconnected cards for every cue when they clearly describe the same memory.
- Do not overwrite a non-empty field unless the user is still in the same active creation flow and is intentionally changing the answer.
- Keep `shareWithFamily` defaulting to `false`.
- Keep `sensitivity` conservative, preferably `personal` by default unless the payload explicitly marks a cue as lower sensitivity.
- Use typed storage helpers rather than scattered `JSON.parse(localStorage.getItem(...))` calls.
- Existing due review cards should be reviewed through the review flow, not silently mutated as if they were a new creation draft.

Implementation preference:

- A helper such as `upsertMemoryCueCard` is appropriate.
- Match the active draft by a stable composite key such as local user, source, lesson/session id if available, and `linkedConceptId`.
- If lesson/session id is not currently available in the component boundary, pass it through the exercise payload or component props in a minimal typed way.

## 2. Delayed Word Recall

Yes. Model `delayed_word_recall` as one exercise type with a phase payload property, for example:

```ts
phase: "encode" | "recall"
```

Recommended payload fields:

```ts
wordSetId: string;
phase: "encode" | "recall";
words?: string[];
options?: AnswerOption[];
requiredSelectionCount?: number;
```

Expected behavior:

- The encode phase presents the three words and asks the user to confirm readiness.
- The recall phase appears later in the same lesson after unrelated exercises.
- The recall phase uses recognition-first multi-select choices.
- The user should not type the words.
- The routine should store lightweight local results under a typed storage helper, for example `cognitiveRoutineResults`.
- Store timestamp, routine type, `wordSetId`, selected answers, expected answers, phase or completion status, and whether the recall was completed.
- Do not display an official diagnostic score or clinical interpretation. The stored metadata may later contribute to a Haru-specific advisory attention/risk model if that output is clearly explained and paired with the app disclaimer.

Mock data:

- Yes, it is acceptable for you to choose three simple, familiar Korean nouns for mock data.
- Keep the set deterministic so tests are stable.
- Avoid any official or published cognitive test word sets if you encounter them during implementation.
- The visible words should live in locale/mock data as appropriate; the exercise component should not hard-code user-facing strings.

## 3. Drawing Routine

Use a static SVG or CSS-rendered reference shape for the prompt, and use a canvas for the user's drawing area.

Recommended target shape:

- Use a simple house-like outline or another original, friendly shape made from basic lines.
- Prefer a low-friction shape over a precise or difficult figure.
- Do not use the official intersecting pentagon stimulus.
- Avoid designs that look like a copied clinical test form.

Expected behavior:

- Show the reference shape clearly above or beside the drawing area depending on responsive layout.
- Provide a touch and mouse compatible canvas.
- Include clear, reset, and done controls.
- Completion should not depend on automatic correctness judgment.
- Store completion metadata locally.
- If saving a small drawing data URL is simple and safe, it is acceptable, but metadata-only storage is also acceptable for MVP.
- Do not label the drawing as normal, abnormal, pass, fail, or diagnostic. Drawing metadata may later be used as one contributor to Haru's own advisory level.

Implementation preference:

- Use plain browser Canvas APIs.
- Keep browser API access defensive and testable.
- Add a component test that verifies render and completion do not throw in the test environment.

## 4. Attention Pattern Routine

For the MVP, prefer a simpler pattern than serial subtraction from 100 by 7.

Recommended default:

- Use a recognition-first number pattern such as subtracting 5 or subtracting 2.
- Keep the numbers small enough for low cognitive load.
- Ask the user to choose the next number from large multiple-choice cards.

Rationale:

- The product should feel like a daily cognitive routine, not a clinical screening test.
- A hard serial subtraction sequence can feel stressful and too close to a test.
- The first implementation should favor confidence, accessibility, and completion.

Expected behavior:

- Use an exercise type such as `number_pattern_choice` or `attention_pattern`.
- Show one simple sequence and ask for the next number.
- Provide a gentle hint after the first miss.
- Do not show medical scoring.
- Store a lightweight local result with routine type, prompt metadata, selected answer, expected answer, completion status, and timestamp.

## 5. Family Screen

Yes. The Family screen should avoid diagnostic charts.

Expected behavior when there is no data:

- Show a static, gentle empty state.
- Explain that family-visible information will appear only when the user has practice history or explicitly shareable memory cues.
- Do not imply that the app has performed a medical assessment.

Expected behavior when data exists:

- Show useful summaries, such as completed routines, memory cues due for review, available conversation prompts, and Haru-specific advisory attention/risk levels.
- Respect `shareWithFamily`.
- Do not show personal memory details unless the card is explicitly marked shareable.
- Avoid official disease-risk labels, diagnostic labels, clinical scores, and alarming wording. Trend charts are allowed when they explain routine data and Haru's own advisory level without implying formal medical scoring.

Good summary examples:

- Routine completions this week.
- Memory cues ready for review.
- Shared conversation cues.
- Last practice date.
- Haru attention level.
- Conversation recommended.
- Consider professional consultation.

Avoid:

- Dementia risk.
- Official clinical risk estimate.
- Cognitive impairment detected.
- Normal or abnormal.
- Medical score.
- Any interpretation that sounds like screening, diagnosis, treatment, prevention, or detection.

## Additional Implementation Guidance

Please preserve the existing Duolingo-style flow:

- One screen, one decision.
- Click-first interactions.
- Recognition before free recall.
- Large touch targets.
- Immediate gentle feedback.
- Review as forward progress.
- No punishment for misses.
- No dense clinical report screens.

Please preserve medical and copyright safety while following the updated product direction:

- Do not copy MMSE, K-MMSE, MoCA, CIST, or any official screening form.
- Do not use official scoring, official stimuli, official instructions, or diagnostic thresholds.
- Do not call this a dementia screening test.
- You may build Haru's own advisory attention/risk level from repeated routine data and caregiver observations.
- Use safe wording such as memory practice, recall practice, attention practice, drawing practice, cognitive routine, Haru advisory level, conversation-needed signal, expert-consultation consideration, and not a medical test.

Please keep data handling conservative:

- Store locally only.
- Default family sharing to private.
- Add deletion support for new cognitive routine storage keys.
- Tolerate missing storage, invalid JSON, and unavailable browser APIs.

## Requested Next Step

Please revise your implementation plan using these clarifications, then proceed with the scoped code changes. Before finishing, run the feasible validation commands:

```bash
npm install
npm run test
npm run typecheck
npm run lint
npm run build
```

If any command cannot run in the Jules VM, report the exact command, the error, and the closest alternative you ran.
