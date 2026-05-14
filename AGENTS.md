# Memory Garden (기억정원)

## Project Summary
기억정원 (Memory Garden) is a Duolingo-style, click-first cognitive routine app for older Korean adults (ages 60–80). It teaches Korean four-character idioms (사자성어), proverbs, and cultural expressions through recognition-based exercises, connecting each concept to the user's personal autobiographical memories via structured choice flows (no free-text input).

## Tech Stack
- **Framework**: React 18 with TypeScript (strict mode)
- **Styling**: Tailwind CSS with custom token extensions
- **Korean font**: Pretendard (loaded via CDN)
- **Routing**: React Router v6
- **State**: React Context + `useReducer`
- **i18n**: `react-i18next` with `ko`, `ja`, and `en` support
- **Testing**: Vitest + React Testing Library (unit), Playwright (E2E)
- **Build**: Vite

## File Structure
```
src/
  app/
    home/
    lesson/
    result/
    garden/
    family/
    settings/
  components/
    Button3D.tsx
    ChoiceCard.tsx
    FeedbackTray.tsx
    LessonNode.tsx
    ProgressBar.tsx
    MascotBubble.tsx
  features/
    lessons/
      ExerciseRenderer.tsx
      exerciseTypes/
        MultipleChoiceMeaning.tsx
        SituationMatch.tsx
        PairMatching.tsx
        SequenceOrder.tsx
        AudioChoice.tsx
        PictureChoice.tsx
        PersonalMemoryRecall.tsx
    memory/
      MemoryCard.tsx
      memoryScheduler.ts
      memoryReviewGenerator.ts
    gamification/
      streaks.ts
      gardenProgress.ts
      rewards.ts
  data/
    mockLessons.ts
    mockConcepts.ts
    mockExercises.ts
  styles/
    tokens.css
```

## Key Conventions
- **Naming Patterns**: Use PascalCase for components and camelCase for functions/files.
- **Component API Contracts**: Define clear props for all components, avoiding complex nested objects if simple primitives work.
- **i18n Key Format**: Use dot-notation namespaced keys (e.g., `feedback.correct.title`). All visible text MUST use i18n keys.
- **Exercise Type Registration**: Exercise types are dynamically rendered via `ExerciseRenderer.tsx` based on their type discriminator.

## MVP Scope
**In-scope**:
- Minimal sign-up
- Daily 5-minute sessions
- 30 idioms
- 5 multiple-choice exercise types
- Personal memory card saving
- Simple spaced review
- Streaks & Garden points
- Guardian invite (1 person)
- TTS (Text-to-speech) reading
- Admin content CMS

**Out of scope**:
- Medical diagnosis/scores
- Facial recognition
- Automatic family relation inference
- Insurance/hospital integration
- Complex LLM free-chat
- Excessive ranking/competition

## Canonical References
- `README.md` — Product scope and philosophy
- `design.md` — UI/UX specification, implementation details
