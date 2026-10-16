# Haru Agent Guide

This file is intended for Google Jules, Codex, and any other coding agent working in this repository. Read it before planning or editing.

Jules automatically looks for `AGENTS.md` in the root of the repository. Keep this file current because Jules uses it to understand setup, conventions, task boundaries, and expected validation before it proposes or completes changes.

## Product Summary

Haru, formerly developed as Memory Garden, is a Duolingo-style daily cognitive and memory routine app for older adults.

The app helps users complete short, friendly daily routines that can accumulate into a sense of progress. It combines cultural language learning, recall practice, personal memory cues, gentle cognitive routines, garden-like rewards, and family/caregiver support.

The product should feel like a warm daily routine. It may provide Haru-branded, evidence-informed attention/risk insights when they are transparently based on Haru's own repeated routine data, memory-cue patterns, and caregiver observations. Keep those insights calm, explainable, and clearly framed as Haru support signals.

## Current Product Direction

- Brand name: `Haru`.
- Korean meaning: `하루`, a daily routine and one day at a time.
- Japanese meaning: `はる` or `春`, spring, warmth, and a new beginning.
- Preferred product framing: a daily memory and cognitive routine that helps older adults revisit their day, preserve personal memory cues, and create conversation material for families or care professionals.
- Learner-facing screens should remain mobile-first, friendly, sparse, and click-first.
- Caregiver/counselor-facing screens may be denser and may include Haru's own advisory attention/risk levels, while remaining calm and explainable.

## Current Source Snapshot (2026-10-14)

> **Git state — inspect before any Git operation.** At this snapshot, the branch is `feat/haru-sound-feedback`, `HEAD` is `3878721`, the index is clean, and the worktree contains substantial uncommitted changes across the STT/RAG consent flow and Raspberry Pi demo, plus local documents and generated files. These are user work. Never run `git stash`, `git reset`, `git checkout --`, `git clean`, or `git restore` against them. Commit only when the user asks. Recheck branch, `HEAD`, index, and worktree at the start of every task; this snapshot will age.

The demo remains a polished, mobile-first daily routine. Keep the learner flow simple, accessible, and action-led; use caregiver/counselor screens for denser summaries. The source-specific facts below were checked against the current tree on 2026-10-14.

Demo direction (explicit gaps being closed):

- Launch lands directly on the routine start screen. `/` redirects to `/lesson`. `LaunchGate` only restores language and seeds the demo memory card — it no longer auto-navigates to onboarding. Onboarding stays reachable from Settings but is not a wall.
- Text must stay large for low-vision users (root rem floors, large touch targets, clear selection states — `SP-03`).
- On-screen copy must be short, one-line imperatives, learner-facing. Brain-activation / motivation copy is allowed (`SP-01`) but kept calm.
- The live demo routine is action-only: tap, trace, draw, speak, record. Knowledge quizzes and math stay in the catalog, reachable by deep link / capture, but are excluded from the everyday routine so the demo stays simple and varied.

### Current routine

`DEMO_ROUTINE_IDS` in `src/features/lessons/sessionBuilder.ts` — 11 exercises, in order:

`ex_orientation → ex_recall_dining → ex_market_money → ex_number_pattern → ex_stroop_touch → ex_verbal_fluency → ex_audio → ex_shape → ex_proverb → ex_mood_voice → ex_6`

`HARU_WEEK_PLAN` is a fixed scripted demo for Korean dates 2026-07-20–26 and Japanese dates 2026-07-27–2026-08-02. Those dates have passed; as of this snapshot the daily routine falls back to `DEMO_ROUTINE_IDS`. Do not present the scripted week as live response-driven generation. Separately, the opt-in local RAG flow can generate a next-day memory question from stored records. With `initialExerciseId`, `buildDailySessionExercises` slices the full catalog from that exercise without a cap, keeping authored exercises reachable for capture/deep links.

### Current routes (verified in src/App.tsx)

- `/kiosk` — standalone tablet/kiosk mode (no app-shell nav, wider layout)
- `/` → redirects to `/lesson`
- `/lesson` — routine start screen, then exercise flow (deep link `?captureExerciseId=ex_xxx` forces one exercise to render)
- `/result` — post-routine screen; two `Button3D` buttons each reveal a pairing code (not navigation); a separate 미리보기 button navigates to `/connect/<role>`
- `/connect/caregiver` — caregiver report view (`data-screen="caregiver-app"`)
- `/connect/counselor` — counselor ops view (`data-screen="counselor-app"`)
- `/connect/counselor/participant/:id` — per-participant counselor detail
- `/garden`, `/family`, `/settings`, `/onboarding` — still routed. The Home hub was removed (`src/app/home/` was deleted).
- `*` (catch-all) → redirects to `/lesson` (unknown URLs fall through to the routine start).

### Screenshot capture system

`e2e/capture-application-screenshots.spec.ts` seeds a canonical scripted-week fixture, then builds the screen deck from the lesson intro, every `mockExercises` entry via deep link, `/result` reveal states, and the caregiver/counselor destinations. The exercise portion stays complete as catalog entries are added or renamed.

- Viewport 540×960 (exact 9:16), `deviceScaleFactor: 2` → 1080×1920 PNG, `fullPage: false`, `animations: disabled`.
- Tall screens (caregiver / counselor) use a smart `document.body.style.zoom` to fit (floor 0.7), reset after capture.
- Per-exercise `prepare` steps: shape-copy traces a canvas stroke; voice screens (verbal fluency, speech repeat, `personal_memory_recall` story mode) start the listening state via `[data-recording-toggle]` + the fake mic stream.
- i18n sanity asserts before each shot: body must not contain `??`, `family.report`, `family.cues`, `family.observation`, `family.advisory`, or `exercise.` (these signal unrendered keys).
- Env knobs: `SCREENSHOT_LOCALES` (default `ko,ja,en`), `SCREENSHOT_OUTPUT_DIR`, `SCREENSHOT_FLAT_OUTPUT=1`, `SCREENSHOT_VIEWPORT_WIDTH` / `SCREENSHOT_VIEWPORT_HEIGHT`, `PLAYWRIGHT_BASE_URL` (point at a warm dev/preview server to avoid cold-start `불러오는 중…` timeouts).
- Output: `피우다프로젝트/application_assets/auto_screenshots/<locale>/`.
- Run: `npm run capture:screens` (uses `playwright.config.ts`; default baseURL `127.0.0.1:4173` with an auto-managed Vite preview unless `PLAYWRIGHT_BASE_URL` overrides).

Note: the Korean directory name `피우다프로젝트` has hit Unicode NFC/NFD normalization quirks on Windows where `ls`, `Glob`, and PowerShell enumerate different file counts. If a capture count looks wrong, verify with multiple tools before assuming files are missing.

### Copy safety (enforced by test)

`src/locales/copySafety.test.ts` gates all copy and must stay green. `GLOBAL_BANS` (banned everywhere): `mmse`, `moca`, `cist`, `ad8`, `gpcog`, `tics`, `sage`, `slums`, `ace-iii`, `k-mmse`, `medical-grade`. `LEARNER_BANS` are banned in learner-facing namespaces only (`navigation`, `home`, `lesson`, `result`, `exercise`, `routine`, `speech`, `weekly`, `choice`, `feedback`, `topbar`, `garden`, `common`): **ko** 검사 / 스크리닝 / 선별 / 진단 / 위험도 / 치매 위험 / 점수; **en** diagnosis / screening / dementia risk / risk score / medical test; **ja** 診断 / スクリーニング / 検査 / リスク / スコア. Keep this list in sync with the test. Richer risk/advisory wording is allowed only in caregiver / counselor / report contexts (the `support` and `family` namespaces are scanned for `GLOBAL_BANS` only) and must stay calm and explainable.

### Deployment

- Vercel project configuration is `hyunjun-kims-projects/haru`; the configured stable alias is `https://saerok-memory.vercel.app`.
- Production status and latest deployment are not verified in this snapshot. Confirm them through the Vercel dashboard/CLI before describing production as current.
- Deploy from the working tree with `vercel --prod --yes` only when the user explicitly asks. Do not commit unless asked.

### Local speech and memory services

- `backend/` is a local FastAPI gateway on `127.0.0.1:8765`. It decodes and conditions audio locally, then sends a WAV copy to Microsoft MAI-Transcribe-2 for speech recognition. This is not fully offline processing. Use Windows Credential Manager target `NexQ:azure_speech`; `STT_API_KEY` overrides it. Configure endpoint/model/output language with `STT_ENDPOINT`, `STT_MODEL_ID`, and `STT_OUTPUT_LANGUAGE`. Never put API keys in source, logs, or committed `.env` files.
- The current STT runtime does not load or download a local speech model and does not need a GPU. Keep the gateway local; do not deploy it to Vercel. If the gateway or Microsoft API is unavailable, voice exercises must still complete without a transcript.
- Voice recording and Microsoft transfer are distinct consent scopes. Only submit audio when the current explicit STT/Microsoft transfer consent is true. Older local-STT consent records fail closed and require a new opt-in. Store original audio in browser IndexedDB only when its storage consent is enabled; store transcript data locally only with transcript consent.
- `rag_backend/` runs locally on `127.0.0.1:8000`. SQLite at `rag_backend/data/haru.db` is the source of truth; the local `intfloat/multilingual-e5-small` model under `rag_backend/models/` is a text embedding model needed by RAG, not a speech model. Do not remove it as part of voice-model cleanup. Neo4j is an optional derived mirror. Neither local service belongs in the Vercel deployment.
- Next-day question evidence, answer choices, and correct answers are selected locally from consented records in SQLite. Meta Muse phrasing is a separate opt-in (`museQuestionGeneration`, default off); its request contains only a generic relation type, market, language instructions, and generic example wording. It must never contain audio, transcript text, personal names/facts, choices, or the answer. If Meta or its key is unavailable, use local wording. Defaults are `https://api.meta.ai/v1`, `muse-wonder-1.0`, and Responses API; read the key from Windows Credential Manager target `NexQ:custom`. `MODEL_API_KEY`, `MUSE_BASE_URL`, `MUSE_MODEL`, and `MUSE_REASONING_EFFORT` override the defaults.
- A prior preflight identified about 50.5 GiB across ignored legacy model/cache/virtualenv paths. Cleanup was blocked, so none were removed and no disk space was reclaimed. Leftovers may remain under `backend/models/`, `raspberry-pi-demo/tools/tts*/`, and `raspberry-pi-demo/tools/kokoro/`; they are not used by the root app's current STT gateway. Inspect actual paths before cleanup and preserve local RAG embeddings and user audio.

### Validation baseline

- Historical baseline from 2026-07-24: `npm run typecheck`, lint, build, and 475 tests across 65 files passed. This does not describe the current worktree.
- For the current STT/MUSE integration, `npm run typecheck`, `npm run build`, targeted ESLint, and Python compile checks passed in the preceding work. Vitest, Pytest, browser/API calls, and the modified Raspberry Pi demo were not verified in that pass.
- Older STT tests may still encode the removed local/Qwen model contract; update them before treating them as coverage for the Microsoft adapter.
- Do not claim any check ran unless its result is available for the current changes.

### SP-01..SP-09 commit trail (feat/mentor-ui-revamp)

- `SP-01` brain-activation motivation copy + copySafety support/family scan
- `SP-02` warm/ink surfaces — amber contrast tokens, Button3D AA palette, Home/Lesson/Result/FeedbackTray visuals
- `SP-03` large-text floors, clear selection, larger touch targets
- `SP-04` immediate interaction feedback (tap + centralized success + calm TTS)
- `SP-05` real-time waveform, 60s cap, MediaRecorder fallback, pronunciation metadata
- `SP-06` everyday content rewrite + weekday sessionBuilder + Stroop/Trail a11y
- `SP-07` launch auto-start to /lesson + single CTA + short onboarding
- `SP-08` weekly reward catalog render, brag card, Result mascot praise, reward events
- `SP-09` conservative caregiver advisory + family tab decoupled from report

## Evidence-Informed Advisory Direction

The product direction is no longer purely defensive. Haru should make reasonable, useful decisions from credible medical and cognitive-science references, while being honest about what has and has not been clinically validated.

Allowed direction:

- Build Haru's own longitudinal attention/risk framework using multiple weak signals rather than one raw score.
- Combine repeated routine participation, delayed recall metadata, attention/color-focus metadata, digit span or number-pattern metadata, verbal fluency counts, drawing telemetry, memory-review changes, and caregiver observation domains.
- Show these as Haru advisory levels such as `steady`, `watch`, or `needs conversation`, or equivalent localized labels.
- Explain which signals contributed to the level in plain language.
- Show a concise startup or first-run note explaining how Haru's advisory output supports routines and conversation preparation.
- Recommend professional consultation when patterns are consistently concerning or when family/caregiver observations raise concern.

Required guardrails:

- Do not call Haru's advisory level an MMSE, MoCA, CIST, K-MMSE, AD8, GPCOG, TICS, SAGE, SLUMS, ACE-III, or official clinical score.
- Do not copy official forms, item wording, copyrighted stimuli, scoring rubrics, cutoffs, or interpretation tables.
- Do not claim clinical validation, sensitivity, specificity, disease detection, treatment, or prevention unless a future validated Haru study actually supports it.
- Do not produce a single deterministic disease label from one session.
- Keep the learner-facing flow supportive; place richer risk/explanation content mainly in caregiver/counselor/report contexts.

## Tech Stack

- React 18, TypeScript strict mode, Vite 6, React Router v6
- Tailwind CSS with custom tokens (`src/styles/tokens.css`)
- `react-i18next` with Korean, Japanese, and English locales (`src/locales/`)
- React Context and reducer-style state where already established
- Vitest + React Testing Library for unit/component tests; Playwright for the screenshot-capture deck
- **Path alias `@/` → `src/`** is wired into `tsconfig.app.json` (`compilerOptions.paths`) AND both `vite.config.ts` and `vitest.config.ts` (`resolve.alias`). Prefer `@/…` imports over relative paths; never go deeper than one `../`. Gotcha: `vitest.config.ts` is standalone — it does NOT inherit `vite.config.ts` — so any resolver/alias change must be mirrored in both configs or tests fail to collect.

## Setup And Validation Commands

Use the existing project scripts.

```bash
npm install
npm run stt:install
npm run rag:install
npm run rag:download
```

Start the local stack:

```bash
npm run dev:local
```

App validation commands:

```bash
npm run test
npm run typecheck
npm run lint
npm run build
```

`npm run dev:local` starts Vite (`127.0.0.1:5173`), local STT (`:8765`), and local RAG (`:8000`). `rag:download` fetches the E5 text embedding model, not a speech model. Individual service setup and credentials are documented in `README.md`, `backend/README.md`, and `rag_backend/README.md`.

If a command cannot run in the agent environment, report the exact command, the exact error, and the closest alternative that was run.

Jules usually runs inside a short-lived Linux VM. Do not rely on Windows-only paths or shell syntax in Jules tasks unless a user explicitly asks for local Windows work.

## Important Directories

```text
src/
  main.tsx, App.tsx            app entry + router (every screen is lazy-loaded)
  i18n.ts                      i18next bootstrap
  index.css, styles/tokens.css global stylesheet + design tokens
  setupTests.ts, vite-env.d.ts test setup + Vite ambient types
  app/                         one folder per route screen (mirrors the route tree)
    lesson/  result/  garden/  family/  settings/  onboarding/
    kiosk/                       standalone tablet/kiosk shell (/kiosk)
    connect/
      caregiver/  CaregiverAppScreen.tsx                 -> /connect/caregiver
      counselor/  CounselorAppScreen.tsx,
                   CounselorParticipantScreen.tsx,
                   counselorData.ts                       -> /connect/counselor, /connect/counselor/participant/:id
  components/                  shared app-chrome / primitives ONLY (7 widgets)
    AppShell  TopStatusBar  BottomNavigation  ProgressBar
    Button3D  ChoiceCard  MascotBubble
  data/                        content catalog
    mockExercises.ts  dailyRoutinePlan.ts  supportResources.ts
  features/                    one folder per domain
    buddy/      buddyConfig.ts, BuddyMascot.tsx
    cognitive/  cognitiveRoutineStorage.ts
    family/     caregiverObservationStorage, caregiverReport, conversationCues,
                 demoReportData, familySupportSummary, haruAdvisory
                 ui/SupportResourceCard.tsx
    gamification/ gardenProgress, streaks, useGamification,
                 weeklyRewards.ts (also exports REWARD_CATALOG; covered by weeklyRewardsCatalog.test.ts)
    kiosk/      useKioskControls.ts
    lessons/    ExerciseRenderer.tsx, sessionBuilder.ts, haruRagSync.ts,
                haruGeneratedQuestionStorage.ts, haruAdminUsageRecordStorage.ts
                 exerciseTypes/   16 exercise components + types.ts
                 ui/              FeedbackTray.tsx, ScenarioCard.tsx
    memory/     memoryCardStorage, memoryReviewGenerator, memoryScheduler,
                 memoryStory, types
    profile/    learnerProfileStorage.ts, haruConsentStorage.ts,
                haruPrivacyControls.ts, haruDataExport.ts, haruDataDeletion.ts
    speech/     SpeechCapturePanel, stt.ts (+test), useSpeechCapture,
                 useVoiceRecorder, VoiceWaveform
  hooks/                       interactionFeedback.ts, useInteractionFeedback.ts
  utils/                       localizedText.ts, safeStorage.ts
  locales/                     ko.json, en.json, ja.json, copySafety.test.ts

backend/                       local Microsoft STT gateway (see Local speech and memory services)
rag_backend/                   local SQLite/E5 memory RAG + optional Meta Muse question phrasing
raspberry-pi-demo/             separate offline Raspberry Pi kiosk application
scripts/dev-local-services.mjs local Vite + STT + RAG process launcher
e2e/                           capture-application-screenshots.spec.ts (screenshot-capture engine)
image/                         Haru visual source assets and image-generation prompts
public/                        static assets served by Vite
피우다프로젝트/                  grant application sources, generated documents, screenshots
cognitve-reference/            local evidence archive (papers, official-tools, data, code)
elements/, docs/, mentoring/, specifie_plan/   scratch / working folders, not part of the app build
```

Grant application files, generated documents, videos, HWP/HWPX/DOCX/PDF render artifacts, and application screenshots are not part of routine web-app implementation. Do not edit them unless the user explicitly asks for grant/document work.

## Import & Layout Conventions

A structure refactor was applied on 2026-07-17 and is committed in the `e1ea674` baseline — it added the `@/` alias, rewrote every import to `@/`-absolute, and co-located modules with their features. Rules that follow from it (keep these when adding or moving code):

- **Import with `@/…`, not deep relatives.** Every import under `src/` is `@/`-absolute; nothing is deeper than one `../`. New code must follow suit.
- **`app/` mirrors the route tree.** Each route screen lives in its own folder named after the route. The `/connect/*` screens live in `app/connect/{caregiver,counselor}/` — not in `app/result/`.
- **`components/` is app-chrome and shared primitives only** (the 7 listed above). A widget with a single consumer lives under that feature's `ui/` folder instead: `features/lessons/ui/{FeedbackTray,ScenarioCard}.tsx`, `features/family/ui/SupportResourceCard.tsx`.
- **`hooks/` is the home for cross-cutting hooks and their helpers.** `interactionFeedback.ts` and its hook `useInteractionFeedback.ts` are siblings there.
- **There is no `services/` directory.** `stt.ts` lives in `features/speech/`. Do not re-introduce `services/`.
- **Moves are safe:** because every import is `@/`-absolute, moving a module only requires updating one path segment at each import site (typecheck catches them all). Keep both `vite.config.ts` and `vitest.config.ts` resolvers in sync.

## Main Routes

Current route map is maintained in the **Current Source Snapshot** section above (verified against `src/App.tsx`). Summary: `/` → `/lesson`; `/lesson`, `/result`, `/connect/caregiver`, `/connect/counselor`, `/connect/counselor/participant/:id`, `/garden`, `/family`, `/settings`, `/onboarding`, `/kiosk`, plus a `*` catch-all → `/lesson`. The Home hub was removed (`src/app/home/` was deleted).

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

- `피우다프로젝트/jules_cognitive_features_prompt.md` - cognitive routine MVP, personal memory cue strengthening, and Haru-specific advisory/risk storage direction.
- `피우다프로젝트/jules_clarification_response.md` - clarification response for the cognitive routine task.
- `jules_caregiver_counselor_dashboard_prompt.md` - Haru visual asset integration and family/caregiver/counselor report screen upgrade.

If a prompt conflicts with this file, follow the stricter medical, privacy, i18n, and scope-safety rule.

## Coding Conventions

- Use PascalCase for React components.
- Use camelCase for functions and variables.
- Keep component props explicit and typed.
- Import with the `@/` alias (`@/features/…`, `@/components/…`, `@/app/…`), never deeper than one `../`. See Import & Layout Conventions.
- Prefer existing primitives such as `Button3D`, `ChoiceCard`, `ProgressBar`, `MascotBubble`, and the app-chrome (`AppShell`, `TopStatusBar`, `BottomNavigation`). Feature-specific widgets live with their feature: `FeedbackTray`/`ScenarioCard` under `features/lessons/ui/`, `SupportResourceCard` under `features/family/ui/`.
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

Memory cards are stored in browser `localStorage` under `memoryCards`. Consent-enabled original recordings live in browser IndexedDB; consent-enabled usage snapshots and extracted memory evidence are also stored in the local RAG SQLite database. Keep these stores distinct when changing export, deletion, or privacy flows. The RAG embedding model is local text infrastructure, not a speech model.

The generated next-day question is stored locally under `haruGeneratedNextDayQuestion`; the local ingestion retry queue is `haruRagSyncOutbox`. `LessonScreen` requests generation from the local RAG service after the required storage, personalization, and Muse consent checks. This is an app-triggered flow, not a background scheduler.

Important files:

- `src/features/lessons/exerciseTypes/PersonalMemoryRecall.tsx`
- `src/features/memory/types.ts`
- `src/features/memory/memoryScheduler.ts`
- `src/features/memory/memoryReviewGenerator.ts`
- `src/features/memory/memoryCardStorage.ts`
- `src/features/lessons/haruRagSync.ts`
- `src/features/lessons/haruGeneratedQuestionStorage.ts`
- `src/features/profile/haruConsentStorage.ts`
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

These routines must be original and lightweight. They can feed Haru's own evidence-informed advisory/risk model, but the routines must not be presented as official clinical tests or scored with official medical cutoffs.

Suggested MVP exercise families:

- delayed word recall with an encode step and later recognition step
- simple number pattern choice
- simple shape copy practice using canvas
- speech/story capture through the existing local gateway and consented Microsoft STT flow
- structured personal memory cue creation and later recognition review

Use local storage for lightweight routine completion records, for example `cognitiveRoutineResults`.

## Cognitive Reference Archive

The project now has a local evidence archive at `cognitve-reference/`, built from `deep-research-report.md`.

Important files:

- `deep-research-report.md` - synthesized product analysis and priority roadmap.
- `cognitve-reference/README.md` - archive status, folder layout, limitations, and counts.
- `cognitve-reference/metadata/download_manifest.csv` - authoritative manifest of downloaded PDFs, data, metadata, saved pages, cloned repositories, and restricted/failed items.
- `cognitve-reference/metadata/report_url_coverage.csv` - maps every report URL to a local artifact or explicit non-download record.
- `cognitve-reference/papers/` - public paper PDFs that were successfully downloaded.
- `cognitve-reference/official-tools/` - publicly available forms or guide PDFs for reference only; do not copy official item content into the app without license and expert review.
- `cognitve-reference/data/ncpt_zenodo_7249732/` - public cognitive-performance dataset files and norms from Zenodo, useful for offline analysis and reporting-pattern experiments.
- `cognitve-reference/code/` - public GitHub repositories cloned as implementation references only. These are not proof of clinical validity.
- `cognitve-reference/web-pages/` - saved official/commercial/fallback pages when direct PDFs were unavailable.

Use the archive this way:

- Treat `deep-research-report.md` as the product-level synthesis: it prioritizes informant observation, five-word delayed recall, generic digit span, semantic verbal fluency, TMT-lite, dCDT-like drawing telemetry, TICS/GPCOG-style remote and caregiver flows, and touch Stroop.
- Use papers and official pages to justify broad cognitive domains and product rationale, not to reproduce official instruments.
- Use official-tool PDFs only to understand high-level task families, workflow constraints, and licensing/medical-risk boundaries. Do not copy prompts, item lists, layouts, scoring rubrics, cutoffs, or interpretations.
- Use cloned repositories to learn generic task mechanics such as touch trails, Stroop timing, or drawing telemetry. Do not assume their code is clinically validated.
- Use NCPT/Zenodo data for offline exploratory analytics, demo reporting patterns, and Haru-specific model design. Do not present external population norms, percentile labels, or clinical interpretations as if they directly validate Haru until a separate validation plan exists.
- Any public factual claim in README, grant text, product copy, or documentation must be traceable to `download_manifest.csv`, a saved source file, or a newly inspected authoritative source.
- If a referenced source is marked `not_downloaded`, do not claim the PDF was archived. Use the saved metadata/page fallback and state limitations plainly.

Recommended product application:

- Implement original Haru micro-routines that reflect cognitive domains rather than official test clones.
- Store activity metadata such as response time, retry count, selected options, word count, drawing stroke count, hesitation-like timing, and caregiver observation domains.
- Present results as daily activity records, supportive conversation cues, and routine participation trends.
- Avoid diagnostic labels, clinical cutoffs, official test names in result labels, and medical scoring.
- Haru-specific advisory flags are allowed when they are explainable, longitudinal, and clearly labeled as Haru's own support signal.
- Route potentially concerning patterns to actionable wording such as “prepare a conversation,” “consider a professional consultation for medical concerns,” or “try a simpler routine next time.”

## Caregiver And Counselor Screens

`/connect/caregiver` and `/connect/counselor` are the caregiver and counselor views; `/connect/counselor/participant/:id` is the participant detail. `/family` is a separate routed screen. Use supporter views to summarize routine participation and prepare supportive conversations.

Allowed summaries:

- completed routines
- last practice date
- routine participation by date
- due memory cues
- explicitly shareable memory summaries
- safe conversation starters
- privacy and local-demo limitations

Do not show private memory details unless `shareWithFamily === true`.

Do not show diagnostic categories, official disease-risk estimates, medical scores, or alarming trend labels. Haru-specific advisory attention/risk levels are allowed if they are transparent, longitudinal, and paired with clear next-step guidance.

Frame any lower performance or missed item as a practice support need, not as impairment.

## Medical And Copyright Safety

This app must not copy, implement, score, or market itself as MMSE, K-MMSE, MoCA, CIST, or any other official cognitive screening instrument. It may implement original routines inspired by broad cognitive domains and may calculate Haru's own advisory support/risk index from repeated data.

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
- Haru advisory insight
- attention level
- conversation-needed signal
- consult a healthcare professional for medical concerns

Low performance in a single app session must never be presented as a diagnosis. Repeated low performance, changed patterns, or caregiver concerns may contribute to a Haru-specific advisory level if the UI explains the basis and limits.

## Privacy And Family Sharing

Memory cards are private by default.

- `shareWithFamily` must default to `false`.
- Do not show personal memory details on family/caregiver/counselor screens unless the card is explicitly shareable.
- Family-facing summaries should be evidence-informed, non-alarming, and clearly separated from official diagnosis or clinical screening.
- Prefer summaries such as completed routines, due memory cues, and conversation prompts.
- Settings must let users delete locally stored personal memory and cognitive routine data.
- Keep browser storage and the local STT/RAG services within the device. Microsoft speech transfer and Meta question phrasing require separate explicit consent; do not describe this system as fully offline. Any future hosted storage or processing requires explicit consent, access control, deletion, and privacy copy.

## Browser API Rules

Features may use browser APIs such as `localStorage`, IndexedDB, `speechSynthesis`, pointer/touch events, and canvas. The current speech-to-text path uses the local STT gateway and consented Microsoft API; it is not browser-only recognition.

Use them defensively:

- Guard for API availability.
- Keep completion possible when the local gateway, Microsoft API, or optional browser speech API is unavailable.
- Do not fail the lesson because a browser API is missing.
- Keep TypeScript types safe for browser-specific APIs.
- Store only what is needed for the MVP.

## Out Of Scope Unless Explicitly Requested

- Medical diagnosis, official clinical scoring, or official screening-result claims
- Official cognitive-screening instrument reproduction
- Facial recognition
- Automatic family relation inference
- Hospital, insurance, or EHR integration
- Complex LLM free-chat
- Competitive ranking
- Adding a hosted backend or migrating local STT/RAG services without an explicit request
- Grant application document editing
- Further product renaming
