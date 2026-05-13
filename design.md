# design.md

# Memory Garden Design Specification

A Duolingo-inspired cognitive training interface for older adults.

This document defines the product interaction model, visual system, component behavior, screen architecture, and implementation conventions for a click-first learning app. The goal is not to copy Duolingo literally. The goal is to reproduce the underlying interaction qualities that make Duolingo feel approachable, tactile, low-friction, habit-forming, and easy to resume.

The app teaches short cultural language concepts such as four-character idioms, proverbs, daily expressions, and autobiographical memory prompts. The primary users are older adults, so every Duolingo-style mechanic must be adapted for accessibility, lower cognitive load, and emotional safety.

---

## 1. Product Design Goal

The interface should feel like a friendly daily lesson game, not a medical test.

The user should be able to complete one session in 5 to 10 minutes with almost no typing. Most actions should be taps, selections, matching gestures, or simple voice responses. The core loop is:

```text
Open app
  -> Continue from current lesson node
  -> Answer short click-based exercises
  -> Receive immediate feedback
  -> Connect new content to a personal memory
  -> Review older memory cards through recognition-first questions
  -> Finish with visible progress and a small reward
```

The design should optimize for:

1. Low-friction daily repetition.
2. Recognition before free recall.
3. Immediate, non-punitive feedback.
4. Large touch targets.
5. Clear progression.
6. Emotional comfort.
7. Habit formation through streaks, progress, and small rewards.
8. Personal memory reinforcement without making the user feel examined.

---

## 2. Duolingo-Inspired Principles

### 2.1 One screen, one decision

Each exercise screen should ask one clear question and present one primary action. Avoid multi-part instructions on the same screen.

Bad:

```text
Read the idiom, remember its meaning, choose the best answer, and then explain why.
```

Good:

```text
Which situation best matches this idiom?
```

The user should never need to infer what to do next. The next action should be visually obvious.

### 2.2 Click-first, type-last

Default interaction types:

1. Tap one answer.
2. Tap multiple answer chips.
3. Match two cards.
4. Reorder cards.
5. Choose a picture.
6. Listen and choose.
7. Speak a short answer.
8. Type only when no lower-friction alternative works.

Recommended interaction distribution:

```text
Tap / select: 80%
Voice: 15%
Typing: 5%
```

Typing should be treated as an advanced or optional mode, not a default requirement.

### 2.3 Immediate feedback

Every submitted answer should produce instant feedback. The feedback should be visual, tactile, and verbal.

Correct answer feedback:

```text
Green highlight
Small bounce animation
Positive sound
Bottom feedback tray
Continue button enabled
```

Incorrect answer feedback:

```text
Soft red or amber highlight
Subtle shake animation
Short hint
No harsh language
Retry or continue depending on exercise type
```

Do not use shame-oriented feedback such as:

```text
Wrong.
Failed.
You forgot.
Incorrect again.
```

Use recovery-oriented feedback:

```text
Almost. Try one more time.
Good attempt. Here is a hint.
Let us look at it together.
```

### 2.4 Progress is always visible

Duolingo-style products work partly because progress is never abstract. Users see a path, a streak, XP, hearts, lesson completion, locked nodes, and rewards.

For this product, progress should be visible but not overly competitive.

Use:

1. Daily streak.
2. Current lesson path node.
3. Session progress bar.
4. Garden growth animation.
5. Memory cards reviewed today.
6. Weekly routine completion.

Avoid:

1. Public leaderboards in the MVP.
2. Aggressive loss aversion.
3. Punishing the user for memory mistakes.
4. Medicalized scores.

### 2.5 Guided path over open menu

A large menu creates decision fatigue. Use a linear or semi-linear lesson path where the app chooses the next best activity.

The user should usually see one primary call to action:

```text
Continue
```

Secondary actions may exist, but they should not compete with the primary route.

### 2.6 Practice is forward progress

Review exercises should not feel like going backward. Memory review nodes should appear inside the main path, mixed with new content.

Example path sequence:

```text
New idiom lesson
Review older idiom
Personal memory recall
Attention warm-up
New proverb lesson
Photo recall
```

The design should communicate that review is part of the journey, not remediation.

### 2.7 Delight must be calm

The visual language may be playful, but this is not a hyperactive app for children. Older users need clarity and comfort.

Use:

1. Rounded shapes.
2. Tactile depth.
3. Calm motion.
4. Clear hierarchy.
5. Friendly mascot moments.
6. Encouraging microcopy.

Avoid:

1. Fast flashing animations.
2. Overcrowded confetti.
3. Meme-heavy copy.
4. Shame-based streak pressure.
5. Tiny decorative details that reduce readability.

---

## 3. Visual Direction

### 3.1 Brand positioning

The app should feel:

```text
Friendly
Tactile
Simple
Optimistic
Culturally familiar
Trustworthy
Non-medical
```

It should not feel:

```text
Clinical
Childish
Punitive
Corporate
Data-heavy
Overstimulating
```

### 3.2 Color system

Use a bright green as the primary action color, inspired by Duolingo's strong green identity, but define our own palette and do not copy trademarked brand assets.

Recommended tokens:

```css
:root {
  --color-primary-50: #eefbe8;
  --color-primary-100: #d8f6ca;
  --color-primary-200: #b9eda0;
  --color-primary-300: #93df6e;
  --color-primary-400: #70cf42;
  --color-primary-500: #58bd2f;
  --color-primary-600: #429623;
  --color-primary-700: #34731f;
  --color-primary-800: #2d5c20;
  --color-primary-900: #264d1f;

  --color-blue-500: #1cb0f6;
  --color-yellow-500: #ffc800;
  --color-orange-500: #ff9600;
  --color-red-500: #ff4b4b;
  --color-purple-500: #ce82ff;

  --color-ink: #2b2f33;
  --color-muted: #6b7280;
  --color-border: #d9dee8;
  --color-surface: #ffffff;
  --color-background: #f7f8fb;
}
```

Use green for:

1. Primary action buttons.
2. Current path node.
3. Correct answer states.
4. Positive completion states.

Use blue for:

1. Informational highlights.
2. Audio or listening activities.
3. Optional help states.

Use yellow or orange for:

1. Streaks.
2. Rewards.
3. Attention prompts.
4. Soft warning states.

Use red sparingly for:

1. Incorrect answer state.
2. Heart loss, if hearts are enabled.
3. Safety alerts for caregivers, never as a user-facing punishment.

### 3.3 Typography

Use rounded, highly legible typography. The type system should support short, large, friendly headings and highly readable body text.

Recommended stack:

```css
font-family: Inter, Nunito, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
```

Type scale:

```css
--font-size-xs: 12px;
--font-size-sm: 14px;
--font-size-md: 17px;
--font-size-lg: 20px;
--font-size-xl: 24px;
--font-size-2xl: 30px;
--font-size-3xl: 36px;
```

Older-adult defaults:

```text
Body text: 18px minimum
Question text: 24px minimum
Large lesson title: 32px minimum
Button text: 18px minimum
Line height: 1.35 to 1.55
```

Avoid long paragraphs. Prefer short clauses and direct wording.

### 3.4 Korean typography and Duolingo-style font strategy

For a Korean Duolingo-style web or app demo, use **Pretendard** as the default Korean UI font.

Duolingo's official brand typography is centered around **Feather Bold** for large, expressive headlines and short brand moments. Duolingo also identifies **DIN Next Rounded** as the typeface for longer text sections. This means the Duolingo visual feeling is not just “a cute font.” It comes from a combination of rounded sans typography, heavy headline weights, bright color, tactile buttons, large radii, and strong pressed states.

There is no verified public source that identifies a dedicated Korean font used by Duolingo's Korean UI. Therefore, do not claim that the product is using Duolingo's actual Korean font. Instead, define our type system as a Korean-first adaptation of the Duolingo interaction style.

Recommended Korean font order:

1. **Pretendard**  
   Best default for the demo. It is modern, stable for UI, natural for mixed Korean and Latin text, available in 9 weights, and supports variable font usage. It is based on Inter, Source Han Sans, and M PLUS 1p, which makes it a practical cross-platform Korean UI font.

2. **SUIT**  
   Good alternative when the product should feel slightly softer and more app-like. It works well for buttons, labels, and friendly education surfaces.

3. **LINE Seed Sans KR**  
   Good alternative when the product needs a rounder and more branded feeling. It is more expressive than Pretendard, so it can work well for onboarding, mascot speech bubbles, and marketing surfaces.

4. **Noto Sans KR**  
   Safe fallback for multilingual coverage and long text, but less distinctive. It is more neutral and does not naturally create the rounded, tactile Duolingo-like feeling.

Recommended demo stack:

```css
@import url("https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard-dynamic-subset.min.css");

:root {
  font-family:
    "Pretendard",
    "Nunito",
    "DIN Round Pro",
    "DIN Next Rounded",
    "Noto Sans KR",
    system-ui,
    -apple-system,
    BlinkMacSystemFont,
    "Segoe UI",
    sans-serif;
}
```

Use **Pretendard** for Korean UI text and **Nunito** as an optional Latin fallback when the demo needs a more rounded Latin feel. Do not depend on proprietary DIN fonts unless the project has an appropriate license.

For a Korean-first app, the actual Duolingo-like quality should come from weight, spacing, and component treatment rather than from the font alone.

```css
body {
  font-family: "Pretendard", system-ui, sans-serif;
  font-weight: 600;
  letter-spacing: -0.01em;
}

.lesson-title {
  font-weight: 800;
  letter-spacing: -0.03em;
}

.choice-button,
.cta-button {
  font-weight: 800;
  letter-spacing: -0.01em;
}

.feedback-title {
  font-weight: 800;
  letter-spacing: -0.02em;
}

.feedback-body {
  font-weight: 600;
  letter-spacing: -0.01em;
}
```

Use the following typography rules in implementation:

```text
Korean body text: Pretendard 600
Korean button labels: Pretendard 800
Korean lesson titles: Pretendard 800 or 900
Korean feedback tray titles: Pretendard 800
Latin-only playful labels: Nunito 800 if available
Long explanatory text: Pretendard 500 or 600
```

For demo implementation, prefer this practical mapping:

```text
Production-like Korean UI: Pretendard
More playful brand moments: Pretendard Heavy or LINE Seed Sans KR
Latin Duolingo-like warmth: Nunito fallback
Long-form readable fallback: Noto Sans KR
Final default stack: Pretendard + Nunito fallback
```

Avoid these mistakes:

```text
Do not use Feather Bold or Duolingo proprietary type assets.
Do not claim that Pretendard is Duolingo's Korean font.
Do not rely on Noto Sans KR alone if the goal is a rounded game-like feel.
Do not use thin weights for buttons or lesson titles.
Do not over-tighten Korean letter spacing in long body text.
```

The recommended default is:

```text
Pretendard for all Korean UI.
Heavy weights for the Duolingo-like tactile feeling.
Rounded 3D buttons and feedback trays to create the product feel.
Nunito only as a Latin companion, not as the Korean primary font.
```

### 3.5 Shape language

Use a small set of repeated primitive shapes:

1. Rounded rectangle.
2. Circle.
3. Soft triangle or pointer.
4. Capsule.

These shapes should define cards, buttons, lesson nodes, progress pills, badges, and mascot containers.

Core radius tokens:

```css
--radius-sm: 10px;
--radius-md: 14px;
--radius-lg: 18px;
--radius-xl: 24px;
--radius-pill: 999px;
```

Use larger radius for friendly affordance and easier visual grouping.

### 3.5 Depth and tactile surfaces

Duolingo-style buttons feel pressable because they have visible depth. Implement this with a bottom border or offset shadow, not only a flat background.

Button base:

```css
.button-3d {
  border-radius: 16px;
  border: 2px solid var(--button-border);
  background: var(--button-bg);
  box-shadow: 0 5px 0 var(--button-shadow);
  transform: translateY(0);
  transition: transform 90ms ease, box-shadow 90ms ease, background 120ms ease;
}

.button-3d:active {
  transform: translateY(4px);
  box-shadow: 0 1px 0 var(--button-shadow);
}
```

Do not rely only on color to show state. Combine color, border, icon, label, and motion.

---

## 4. Core App Shell

### 4.1 Mobile-first layout

Primary target:

```text
Mobile portrait
Tablet portrait
Tablet landscape as secondary
```

Desktop can be supported later for caregiver dashboards and content management.

### 4.2 Global structure

```text
AppShell
  TopStatusBar
    Hearts or Energy
    Streak
    XP or Garden Points
  MainContent
  BottomNavigation
```

The learner-facing app should use a simple bottom navigation model:

```text
Home
Review
Garden
Family
Profile
```

For MVP, reduce to:

```text
Home
Garden
Family
```

The main learning flow should be launched from Home with one primary button.

### 4.3 Top status bar

The top bar should show only high-value status markers.

Recommended MVP:

```text
Streak: visible
Garden points: visible
Hearts: optional
```

Hearts are risky for older adults because they can make mistakes feel costly. If used, hearts should recover quickly and should not block memory practice.

Better alternative:

```text
Energy flowers
```

Energy flowers can show session effort without penalizing mistakes.

---

## 5. Home Path / Lesson Map

### 5.1 Purpose

The home path tells the user where they are and what to do next. It should remove planning burden.

### 5.2 Layout

Use a vertical path with circular nodes.

```text
Unit header card
  -> Lesson node completed
  -> Lesson node completed
  -> Current lesson node, emphasized
  -> Locked lesson node
  -> Review node
```

Nodes should alternate slightly left and right to create a playful path.

### 5.3 Node states

```ts
export type LessonNodeState =
  | "completed"
  | "current"
  | "locked"
  | "review_due"
  | "bonus"
  | "family_memory";
```

Visual mapping:

```text
completed: green circle with check icon
current: green circle with larger size and glow
locked: gray circle with lock icon
review_due: blue or purple circle with refresh icon
bonus: yellow circle with star icon
family_memory: pink or warm orange circle with photo icon
```

### 5.4 Node behavior

When the user taps a node:

```text
completed -> show replay popup
current -> start lesson
locked -> show unlock requirement
review_due -> start review session
family_memory -> start personal memory review
```

Completed nodes should remain tappable so the user can revisit content.

### 5.5 Unit header

A unit should have a friendly, descriptive title.

Bad:

```text
Unit 3
```

Good:

```text
Unit 3: Turning Hard Times Into Good Memories
```

For older users, descriptive titles reduce uncertainty.

---

## 6. Exercise Screen

### 6.1 Standard layout

```text
ExerciseScreen
  Header
    Close button
    Progress bar
    Optional hearts/energy
  Prompt area
    Exercise type label
    Question
    Optional illustration or audio button
  Answer area
    Options, cards, chips, or matching pairs
  Bottom action area
    Check button
    Feedback tray when submitted
```

### 6.2 Header

The progress bar should show intra-session completion.

```text
Question 3 of 8
```

Do not show too many metrics on the exercise screen. Keep the user focused.

### 6.3 Prompt area

Prompt copy should be short.

Examples:

```text
Which meaning fits this idiom?
Which situation matches the phrase?
Who was with you in that memory?
Tap the picture you saw earlier.
Put these moments in order.
```

Use a large illustration or icon when it improves recognition.

### 6.4 Answer area

The answer area should usually contain 2 to 4 choices.

Older-adult default:

```text
2 choices for difficult personal recall
3 choices for normal memory review
4 choices for familiar idiom meaning questions
```

Do not place more than 4 answer choices in a normal exercise.

### 6.5 Bottom action area

The bottom action area is fixed to the bottom of the screen.

States:

```ts
export type CheckButtonState =
  | "disabled"
  | "enabled"
  | "checking"
  | "continue";
```

Behavior:

```text
No answer selected -> disabled Check button
Answer selected -> enabled Check button
Submitted correct -> feedback tray + Continue
Submitted incorrect -> feedback tray + Try Again or Continue
```

The Check button should not move across screens.

---

## 7. Bottom Feedback Tray

### 7.1 Purpose

The feedback tray is the emotional center of the lesson experience. It tells the user what happened, what to learn, and what to do next.

### 7.2 Correct tray

```text
Background: light green
Title: Nice work!
Body: This phrase means that good things can come after a hard time.
Button: Continue
```

### 7.3 Incorrect tray

```text
Background: light red or amber
Title: Almost there
Body: This one is about a good result after effort. Try again.
Button: Try again
```

### 7.4 Personal memory tray

```text
Background: light blue or warm cream
Title: You remembered that
Body: Last time, you connected this phrase with family.
Button: Continue
```

### 7.5 Implementation API

```ts
export interface FeedbackTrayProps {
  variant: "correct" | "incorrect" | "hint" | "memory" | "neutral";
  title: string;
  body?: string;
  primaryActionLabel: string;
  onPrimaryAction: () => void;
  secondaryActionLabel?: string;
  onSecondaryAction?: () => void;
}
```

The tray should animate from the bottom with a short slide and fade.

```text
Duration: 180ms to 240ms
Easing: ease-out
Reduced motion: instant fade only
```

---

## 8. Core Exercise Types

### 8.1 Multiple choice meaning

Use for teaching new idioms, proverbs, or expressions.

Data shape:

```ts
export interface MultipleChoiceExercise {
  type: "multiple_choice_meaning";
  id: string;
  prompt: string;
  targetText: string;
  options: AnswerOption[];
  correctOptionId: string;
  explanation: string;
}

export interface AnswerOption {
  id: string;
  label: string;
  accessibilityLabel?: string;
}
```

Interaction:

```text
Tap option
Option becomes selected
Tap Check
Show correct or incorrect tray
Continue
```

### 8.2 Situation match

Use to make abstract meanings concrete.

Example prompt:

```text
Which situation fits this phrase?
```

Options should be everyday scenarios, not dictionary definitions.

### 8.3 Pair matching

Use for concepts and meanings.

Layout:

```text
Left column: terms
Right column: meanings
```

For older users, limit to 3 pairs in MVP.

Interaction:

```text
Tap left card
Tap right card
Matched pair locks in place
All pairs matched -> Check enabled
```

### 8.4 Word order / sequence order

Use for attention and working memory.

Example:

```text
Put the pictures in the order you saw them.
```

Prefer tap-to-place over drag-and-drop because drag gestures can be harder for older users.

### 8.5 Audio choice

Use for pronunciation, listening, or voice-based recall.

Interaction:

```text
Tap large play button
Listen
Choose answer
Check
```

The play button must be large and repeatable.

### 8.6 Picture choice

Use for autobiographical memory and family photo recall.

Interaction:

```text
Show prompt
Display 2 to 4 images
User taps image
Check
```

Never automatically infer sensitive relationships from photos in MVP. Use caregiver-provided labels.

### 8.7 Personal memory recall

This is the product differentiator.

Example prompt:

```text
Last time, which topic did you connect with this phrase?
```

Options:

```text
Family
Health
Travel
Friends
```

The user is not asked to type the memory. The app turns prior selected answers into future recognition-based questions.

### 8.8 Gentle voice recall

Use sparingly.

Example prompt:

```text
Would you like to say one short sentence about that memory?
```

Options:

```text
Speak
Skip
Choose from options instead
```

Voice should be optional. The user must be able to complete the session without speaking.

---

## 9. Personal Memory System

### 9.1 Memory card concept

A memory card is a structured record created through choices, not a long diary entry.

```ts
export interface MemoryCard {
  id: string;
  userId: string;
  createdAt: string;
  updatedAt: string;
  source: "daily_lesson" | "family_upload" | "voice_note" | "manual_entry";
  linkedConceptId?: string;
  topic?: MemoryTopic;
  peopleTags?: string[];
  placeTag?: string;
  emotionTag?: string;
  imageAssetIds?: string[];
  textSummary?: string;
  originalTranscript?: string;
  sensitivity: "low" | "personal" | "sensitive";
  shareWithFamily: boolean;
  reviewState: ReviewState;
}

export type MemoryTopic =
  | "family"
  | "health"
  | "travel"
  | "work"
  | "food"
  | "hobby"
  | "friends"
  | "daily_life"
  | "unknown";

export interface ReviewState {
  dueAt: string;
  intervalDays: number;
  ease: number;
  lastResult?: "remembered" | "hint_used" | "missed" | "skipped";
  reviewCount: number;
}
```

### 9.2 Memory creation through choices

Example flow:

```text
Question: Have you had a time when effort led to a good result?
Choices: Family, Health, Work, Hobby, Not sure

Question: How did that feel?
Choices: Proud, Relieved, Thankful, Tired

Question: Was anyone with you?
Choices: Spouse, Child, Friend, Alone, Skip
```

This creates a MemoryCard without requiring typing.

### 9.3 Memory review generation

The review engine turns MemoryCards into recognition-first exercises.

Examples:

```text
Which topic did you choose last time?
Who was connected to that memory?
How did that memory feel?
Which phrase did we connect to that memory?
```

Review difficulty levels:

```text
Level 1: Two-choice recognition
Level 2: Three-choice recognition
Level 3: Four-choice recognition
Level 4: First-letter or category hint
Level 5: Optional voice recall
```

Do not jump to free recall until the user has succeeded several times.

---

## 10. Spaced Review and Lesson Scheduling

### 10.1 Scheduling principle

New content and personal memories should return at expanding intervals.

Recommended MVP intervals:

```text
First review: 1 day
Second review: 3 days
Third review: 7 days
Fourth review: 21 days
Maintenance: 45 days
```

If the user misses an item, shorten the interval and lower difficulty.

### 10.2 Review priority formula

```ts
priority = forgettingRisk + errorWeight + personalWeight + dueWeight - recentSuccessWeight;
```

Where:

```text
forgettingRisk: time since last successful review
dueWeight: whether the card is due today
errorWeight: recent misses or hint usage
personalWeight: family/photo/emotion-linked memories
recentSuccessWeight: repeated recent correct answers
```

### 10.3 Session composition

A daily session should mix new learning and review.

Default 8-question session:

```text
1 orientation warm-up
2 new concept questions
2 review concept questions
2 personal memory recall questions
1 attention or sequence exercise
```

For tired users or low confidence days:

```text
1 orientation warm-up
1 new concept question
2 easier review questions
1 personal memory recognition question
```

---

## 11. Gamification System

### 11.1 XP or garden points

Use points to reward completion, not raw correctness.

Recommended:

```text
Complete exercise: +2 points
Correct without hint: +3 points
Use hint and continue: +1 point
Finish session: +10 points
Review old memory: +5 points
```

Do not subtract points for incorrect answers in MVP.

### 11.2 Streaks

Streaks should encourage return behavior without causing guilt.

Rules:

```text
Complete one session per day -> streak continues
Miss one day -> offer streak repair with a light review
Long absence -> welcome back without shame
```

Copy examples:

```text
Welcome back. Let us do a short one today.
Your garden waited for you.
A small review is enough for today.
```

Avoid:

```text
You lost your streak.
You failed yesterday.
You broke your progress.
```

### 11.3 Garden metaphor

Instead of a leaderboard-first system, use a personal garden.

Mapping:

```text
Session complete -> water drop
Weekly completion -> flower bloom
Memory review -> new leaf
Family photo review -> photo flower
Streak milestone -> tree growth
```

This creates visual progress without social pressure.

### 11.4 Hearts or energy

Hearts are a recognizable Duolingo-style mechanic, but they can be punitive. For this product, prefer energy flowers.

Energy flowers:

```text
Represent effort capacity
Do not block the session
Regenerate daily
Can be restored by easy review
```

If hearts are implemented, they should never prevent memory review or caregiver-recommended sessions.

---

## 12. Accessibility for Older Adults

### 12.1 Touch targets

Minimum target sizes:

```text
Primary button: 56px height minimum
Choice card: 64px height minimum
Icon button: 48px by 48px minimum
Path node: 64px by 64px minimum
```

Recommended spacing:

```text
At least 12px between tappable elements
At least 20px horizontal screen padding
```

### 12.2 Text readability

Use high contrast and large text.

Rules:

```text
No body text below 17px
No low-contrast gray for essential instructions
No long paragraphs in lesson screens
No all-caps paragraphs
```

### 12.3 Motion

All animations must respect reduced-motion settings.

Allowed default motion:

```text
Button press: 80ms to 120ms
Feedback tray slide: 180ms to 240ms
Correct answer bounce: small scale, less than 1.04
Path node pulse: slow and subtle
```

Avoid:

```text
Rapid flashing
Continuous bounce loops
Large camera movement
Confetti covering text
```

### 12.4 Audio

Audio is useful but must be optional.

Requirements:

```text
Every audio prompt has visible text
Every voice task has a skip option
Playback button is large
Replay is unlimited
Volume guidance is clear
```

### 12.5 Error recovery

Users must be able to recover from mistakes easily.

```text
Allow answer changes before Check
Use Try Again for low-stakes errors
Use Continue with explanation for repeated errors
Avoid modal error dialogs
```

---

## 13. Component Library

### 13.1 Button3D

Purpose:

```text
Primary Duolingo-style tactile button.
```

Props:

```ts
export interface Button3DProps {
  variant: "primary" | "secondary" | "danger" | "neutral" | "disabled";
  size: "md" | "lg" | "xl";
  pressed?: boolean;
  fullWidth?: boolean;
  disabled?: boolean;
  children: React.ReactNode;
  onClick?: () => void;
}
```

Behavior:

```text
Default: raised with bottom shadow
Pressed: moves down and shadow compresses
Disabled: gray, no shadow motion
Loading: spinner, no repeated taps
```

### 13.2 ChoiceCard

Purpose:

```text
Answer choice for multiple-choice exercises.
```

Props:

```ts
export interface ChoiceCardProps {
  id: string;
  label: string;
  description?: string;
  icon?: React.ReactNode;
  state: "idle" | "selected" | "correct" | "incorrect" | "disabled";
  onSelect: (id: string) => void;
}
```

State mapping:

```text
idle: white surface, gray border
selected: blue border, light blue background
correct: green border, light green background, check icon
incorrect: red border, light red background, retry icon
```

### 13.3 LessonNode

Purpose:

```text
Circular path node on the home screen.
```

Props:

```ts
export interface LessonNodeProps {
  id: string;
  state: LessonNodeState;
  icon: React.ReactNode;
  label?: string;
  position: "left" | "center" | "right";
  onPress: (id: string) => void;
}
```

### 13.4 ProgressBar

Purpose:

```text
Show session progress.
```

Props:

```ts
export interface ProgressBarProps {
  value: number;
  max: number;
  label?: string;
}
```

Use a rounded capsule with animated fill.

### 13.5 FeedbackTray

Defined above. This component should be shared across all exercise types.

### 13.6 MascotBubble

Purpose:

```text
Small character guidance moments.
```

Props:

```ts
export interface MascotBubbleProps {
  mood: "happy" | "thinking" | "encouraging" | "calm";
  message: string;
  showMascot?: boolean;
}
```

Use mascot bubbles sparingly. The mascot should guide, not dominate.

---

## 14. Exercise State Machine

### 14.1 Standard exercise state

```ts
export type ExerciseState =
  | "intro"
  | "awaiting_answer"
  | "answer_selected"
  | "checking"
  | "correct_feedback"
  | "incorrect_feedback"
  | "hint_feedback"
  | "completed";
```

### 14.2 Standard transition

```text
intro
  -> awaiting_answer
  -> answer_selected
  -> checking
  -> correct_feedback or incorrect_feedback
  -> completed
```

### 14.3 Incorrect answer flow

For normal concept questions:

```text
First miss -> show hint -> retry
Second miss -> show explanation -> continue
```

For personal memory questions:

```text
First miss -> show gentle hint -> retry with fewer choices
Second miss -> reveal answer softly -> continue
```

Never lock the user in repeated failure.

---

## 15. Screen Inventory

### 15.1 Onboarding

Goal:

```text
Get the user into the first lesson quickly.
```

Steps:

```text
Welcome
Choose text size
Choose daily reminder time
Choose interest topics
Start first session
```

Avoid long account setup before the first demo lesson.

### 15.2 Home Path

Primary screen after onboarding.

Required elements:

```text
Top status bar
Current unit card
Vertical lesson path
Floating Continue button if user scrolls away
```

### 15.3 Lesson Intro

Short pre-lesson screen.

```text
Today: A phrase about effort and reward
Estimated time: 5 minutes
Primary button: Start
```

### 15.4 Exercise Screen

Reusable for all exercise types.

### 15.5 Session Result

Show completion, not a report card.

Elements:

```text
Garden animation
Points earned
Memory cards reviewed
Streak status
Continue button
```

Copy example:

```text
You practiced 8 small memories today.
Your garden grew a little more.
```

### 15.6 Garden

A non-competitive progress space.

Elements:

```text
Growing tree or garden
Recent badges
Memory flowers
Weekly completion calendar
```

### 15.7 Family Memory Upload

Caregiver-facing or family-facing flow.

Required fields:

```text
Photo
Who is in it
Where it was
Approximate date or era
Can this be used in memory practice?
```

Do not require exact dates.

### 15.8 Settings

Required settings:

```text
Text size
Sound on/off
Reduced motion
Voice input on/off
Family sharing permissions
Delete memory cards
Export data
Privacy consent
```

---

## 16. Content Model

### 16.1 Lesson entity

```ts
export interface Lesson {
  id: string;
  unitId: string;
  title: string;
  description: string;
  conceptIds: string[];
  exerciseIds: string[];
  estimatedMinutes: number;
  difficulty: 1 | 2 | 3 | 4 | 5;
  lessonType: "new_concept" | "review" | "personal_memory" | "attention" | "mixed";
}
```

### 16.2 Concept entity

```ts
export interface Concept {
  id: string;
  type: "idiom" | "proverb" | "expression" | "attention_pattern";
  displayText: string;
  romanization?: string;
  simpleMeaning: string;
  detailedMeaning?: string;
  exampleSituationIds: string[];
  memoryPromptIds: string[];
  audioAssetId?: string;
  imageAssetId?: string;
}
```

For English-only UI builds, `displayText` can be romanized or translated. If Korean content is introduced later, keep the content strings in localization files.

### 16.3 Exercise entity

```ts
export interface Exercise {
  id: string;
  lessonId: string;
  type: ExerciseType;
  prompt: string;
  payload: unknown;
  correctAnswer: unknown;
  explanation?: string;
  difficulty: 1 | 2 | 3 | 4 | 5;
  accessibilityHint?: string;
}

export type ExerciseType =
  | "multiple_choice_meaning"
  | "situation_match"
  | "pair_matching"
  | "sequence_order"
  | "audio_choice"
  | "picture_choice"
  | "personal_memory_recall"
  | "voice_recall";
```

---

## 17. Server-Driven Lesson Rendering

### 17.1 Why consider server-driven UI

Lesson content changes often. Exercise composition, answer choices, review cards, and experiments should not require a mobile app release every time.

Use a server-driven lesson format for exercise payloads while keeping the native component library stable.

### 17.2 Safe MVP approach

Do not send arbitrary UI from the backend in MVP. Instead, send structured exercise JSON that maps to known client components.

```ts
export interface LessonRunResponse {
  sessionId: string;
  lessonId: string;
  exercises: Exercise[];
  reviewCards: MemoryCard[];
  theme?: LessonTheme;
}
```

The client renders each exercise by `type`.

### 17.3 Versioning

Each exercise payload must include a version.

```ts
export interface VersionedExercise extends Exercise {
  schemaVersion: number;
}
```

Client behavior:

```text
Known schema -> render normally
Older schema -> render compatibility path
Unknown schema -> skip safely and request fallback exercise
```

---

## 18. Copywriting Guidelines

### 18.1 Voice

The product voice should be:

```text
Clear
Warm
Short
Respectful
Encouraging
Never patronizing
```

### 18.2 Good prompt examples

```text
Which meaning fits this phrase?
Which moment sounds most similar?
Who was part of this memory?
Tap the picture you remember.
Let us try a short review.
```

### 18.3 Bad prompt examples

```text
Can you still remember this?
You forgot this yesterday.
Your memory score is low.
This should be easy.
```

### 18.4 Feedback examples

Correct:

```text
Nice work.
You found it.
That memory came back.
Good match.
```

Incorrect:

```text
Almost.
Let us use a hint.
This one is tricky.
Try one more time.
```

Skipped:

```text
No problem. We can come back to it later.
```

---

## 19. Implementation With Tailwind

### 19.1 Tailwind token extension

```ts
// tailwind.config.ts
export default {
  theme: {
    extend: {
      colors: {
        primary: {
          50: "#eefbe8",
          100: "#d8f6ca",
          200: "#b9eda0",
          300: "#93df6e",
          400: "#70cf42",
          500: "#58bd2f",
          600: "#429623",
          700: "#34731f",
          800: "#2d5c20",
          900: "#264d1f",
        },
        duoBlue: "#1cb0f6",
        duoYellow: "#ffc800",
        duoOrange: "#ff9600",
        duoRed: "#ff4b4b",
        ink: "#2b2f33",
      },
      borderRadius: {
        xl: "18px",
        "2xl": "24px",
      },
      boxShadow: {
        button: "0 5px 0 rgba(0,0,0,0.18)",
        card: "0 2px 0 rgba(0,0,0,0.08)",
      },
    },
  },
};
```

### 19.2 Button class example

```tsx
export function Button3D({ children, disabled, onClick }: Button3DProps) {
  return (
    <button
      disabled={disabled}
      onClick={onClick}
      className="w-full rounded-2xl border-2 border-primary-700 bg-primary-500 px-6 py-4 text-lg font-bold text-white shadow-button transition active:translate-y-1 active:shadow-none disabled:border-gray-300 disabled:bg-gray-200 disabled:text-gray-500 disabled:shadow-none"
    >
      {children}
    </button>
  );
}
```

### 19.3 Choice card class example

```tsx
export function ChoiceCard({ label, state, onSelect, id }: ChoiceCardProps) {
  const stateClass = {
    idle: "border-gray-300 bg-white text-ink",
    selected: "border-blue-500 bg-blue-50 text-ink",
    correct: "border-primary-600 bg-primary-50 text-ink",
    incorrect: "border-red-500 bg-red-50 text-ink",
    disabled: "border-gray-200 bg-gray-100 text-gray-400",
  }[state];

  return (
    <button
      onClick={() => onSelect(id)}
      className={`min-h-16 w-full rounded-2xl border-2 px-5 py-4 text-left text-lg font-semibold transition active:scale-[0.99] ${stateClass}`}
    >
      {label}
    </button>
  );
}
```

---

## 20. Animation Guidelines

### 20.1 Button press

```text
On pointer down: translateY(4px), compress shadow
On pointer up: return to raised state
Duration: 80ms to 120ms
```

### 20.2 Correct answer

```text
Selected card turns green
Check icon appears
Card scales to 1.02 then back to 1.0
Feedback tray slides up
```

### 20.3 Incorrect answer

```text
Selected card turns soft red
Small horizontal shake, max 4px
Feedback tray gives hint
```

### 20.4 Path node pulse

Current node may pulse slowly.

```text
Scale 1.00 -> 1.04 -> 1.00
Duration 1600ms
Repeat max 3 times
Stop after user interacts
```

### 20.5 Reduced motion

If reduced motion is enabled:

```text
Disable shake
Disable pulse
Replace tray slide with fade
Disable confetti
Keep color and text feedback
```

---

## 21. Privacy and Consent UX

### 21.1 Consent must be granular

Separate these permissions:

```text
Store personal memory choices
Store voice transcript
Store original audio
Share selected memory cards with family
Use de-identified data for product improvement
```

### 21.2 Memory card controls

Every memory card should support:

```text
View
Edit tags
Hide from review
Share with family
Delete
```

### 21.3 Family sharing

Default state:

```text
Private
```

The user must explicitly choose which memory cards can be shared.

### 21.4 Sensitive content

If a memory topic is sensitive, avoid turning it into playful quizzes.

Sensitive examples:

```text
Medical diagnosis
Bereavement
Financial trouble
Family conflict
Traumatic events
```

Sensitive cards may be stored for continuity but should not be resurfaced without explicit user consent.

---

## 22. MVP Build Order

### Phase 1: Visual and interaction shell

Build:

```text
App shell
Home path
Button3D
ChoiceCard
ProgressBar
FeedbackTray
Session result screen
```

### Phase 2: Basic lesson engine

Build:

```text
Exercise renderer
Multiple choice meaning
Situation match
Pair matching
Session state machine
Local mock lesson data
```

### Phase 3: Personal memory loop

Build:

```text
Memory card creation through choices
Memory review exercise generation
Spaced review schedule
Garden reward mapping
```

### Phase 4: Family and media

Build:

```text
Caregiver photo upload
Manual photo tags
Picture choice exercise
Family encouragement message
```

### Phase 5: Voice support

Build:

```text
TTS for prompts
Optional STT for short recall
Transcript review before saving
Voice consent flow
```

---

## 23. File and Component Structure

Recommended structure:

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

---

## 24. QA Checklist

Before shipping a screen, verify:

```text
There is one obvious primary action.
All touch targets are at least 48px, preferably 56px or larger.
No required text is below 17px.
The screen works without audio.
The screen works without voice input.
The screen works with reduced motion.
The user can recover from mistakes.
No copy shames the user.
The Check or Continue button stays in a predictable place.
The exercise can be completed in less than 30 seconds.
The answer state is not communicated by color alone.
```

Before shipping a lesson, verify:

```text
The session has a mix of new content and review.
Personal memory questions are recognition-first.
Sensitive content is not resurfaced carelessly.
Incorrect answers produce hints, not punishment.
The result screen rewards completion.
The next session is already scheduled.
```

---

## 25. Design Do and Do Not

### Do

```text
Use large rounded buttons.
Use short direct prompts.
Use bottom feedback trays.
Use a visible lesson path.
Use review as forward progress.
Use personal memory cards carefully.
Use calm positive reinforcement.
Use structured JSON for exercise rendering.
Use one primary action per screen.
```

### Do not

```text
Do not require typing for normal lessons.
Do not present medical scores in the learner app.
Do not use public leaderboards in MVP.
Do not punish memory failure.
Do not overload screens with metrics.
Do not infer family relationships automatically from photos.
Do not save voice recordings by default.
Do not copy Duolingo trademarked assets, logos, or characters.
```

---

## 26. Definition of Done for the Duolingo-Style Demo

The demo is acceptable when a user can complete this flow:

```text
Open app
Tap Continue on the home path
Complete 6 to 8 click-based exercises
Learn one new phrase or idiom concept
Create one personal memory card through choices
Review one older memory card through recognition
Receive immediate feedback after each answer
Finish with a result screen
See the garden grow
Return to the home path with the next node unlocked
```

The demo should prove the product feel:

```text
Fast to start
Easy to understand
Tactile to tap
Friendly after mistakes
Rewarding after completion
Built around recognition and gentle recall
Accessible for older adults
```

If the demo requires keyboard input to feel complete, the design has failed.

