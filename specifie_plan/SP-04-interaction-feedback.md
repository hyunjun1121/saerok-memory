# SP-04 — 즉각·명확 상호작용 피드백 (Button3D tap + FeedbackTray success 집중화 + Trail/Stroop/Digit/Pair/Picture tap·success + SpeechRepeat speakCalmly 교체)

> **AXIS 고정**: 본 파일은 실행 워크플로. 방향·우선순위·수용기준은 `high_level_plan.md` 의 HL-4 와 `specifie_plan.md` 의 SP-04 에 고정된다. 본 파일에서 새 범위를 추가하지 않는다.

| 우선순위 | 의존(선행 SP) | 터치 파일 | 미터치(HL-10) |
|---|---|---|---|
| P0 | SP-02 | `src/components/Button3D.tsx`, `src/components/FeedbackTray.tsx`, `src/features/lessons/exerciseTypes/PictureChoice.tsx`, `src/features/lessons/exerciseTypes/TrailSwitchingPractice.tsx`, `src/features/lessons/exerciseTypes/StroopTouchPractice.tsx`, `src/features/lessons/exerciseTypes/DigitSpanPractice.tsx`, `src/features/lessons/exerciseTypes/PairMatching.tsx`, `src/features/lessons/exerciseTypes/SpeechRepeatPractice.tsx`, `src/features/lessons/exerciseTypes/AudioChoice.tsx` | 키오스크/복지관대시보드/일본/임상 |

## 0. 목표

멘토의 "건드리면 반드시 반응, 잘했으면 잘했다고, 차분한 목소리"를 구현한다. 가장 많이 누르는 `Button3D` 의 onClick 에 `tap()` 을 연결(최대 효과). `FeedbackTray` 가 `correct` variant 로 마운트될 때 `success()` 를 1곳에서 집중화하여 모든 exercise 가 `correct_feedback` 만 set 하면 정답 음+진동이 일괄 적용되도록 한다. plain `<button>` 인 Trail/Stroop/Digit/Pair/Picture 의 touch 버튼에 `tap()` 을, 완료/정답 분기에 `success()` 를 추가한다. SpeechRepeat/AudioChoice 의 raw `SpeechSynthesisUtterance` 를 공유 `speakCalmly()` 로 교체한다. SpeechRepeat 의 Continue 대기 동작은 절대 건드리지 않는다.

## 1. 현재 구현 (소스 재확인 결과)

- **원시함수 양호** `src/utils/interactionFeedback.ts`:
  - `playSoftTapTone()` `:62-64` (520Hz/120ms)
  - `playSoftSuccessTone()` `:67-70` (2음)
  - `vibrateLightly()` `:73-81` (navigator.vibrate 가드)
  - `speakCalmly()` `:84-103` (rate 0.92, cancel-safe, 미지원 no-op)
- **훅 양호** `src/hooks/useInteractionFeedback.ts:13-32`: `tap()`(`:14-18`, tap+vibrate 15), `success()`(`:20-24`, success+vibrate [18,40,18]), `speak()`(`:26-29`). 전부 `isSoundFeedbackEnabled()` 게이트.
- **유일 호출처** `src/components/ChoiceCard.tsx:34,57-60`: `const { tap } = useInteractionFeedback();` → `handleSelect` 의 첫 줄 `tap();`.
- **Button3D 피드백 0** `src/components/Button3D.tsx:1-61`: `useInteractionFeedback` import 조차 없음. CSS press(`active:translate-y-1`)만.
- **success()/speak() 호출처 0**: grep 결과 코드 어디서도 `success()`/`speak()` 호출 안 됨.
- **FeedbackTray** `src/components/FeedbackTray.tsx:59-68`: `role="status" aria-live="polite" aria-atomic="true"`(양호). 단 variant 변화 시 success 음 없음. 내부 `<Button3D onClick={onPrimaryAction}>`(`:82-88`)는 Step 1 에 의해 tap 이 묻음.
- **MultipleChoiceMeaning** `src/features/lessons/exerciseTypes/MultipleChoiceMeaning.tsx:48-58`: 정답 시 `setGlobalState("correct_feedback")`만(success 음 없음). 단 ChoiceCard(`:91-99`)를 쓰므로 선택 tap 은 묻음. FeedbackTray 집중화 채택 시 이 파일은 수정 불필요.
- **PictureChoice** `src/features/lessons/exerciseTypes/PictureChoice.tsx:31-51,82-101`: plain `<button onClick={() => handleSelect(option.id)}>`(`:87`). 정답 시 `setGlobalState("correct_feedback")`(`:44`). tap/success 없음.
- **Trail** `src/features/lessons/exerciseTypes/TrailSwitchingPractice.tsx:75-108,163-192`: 노드 `<button onClick={() => handleNodeClick(node)}>`(`:171`). 완료 시 `setGlobalState("correct_feedback")`(`:104`). tap/success 없음.
- **Stroop** `src/features/lessons/exerciseTypes/StroopTouchPractice.tsx:117-156,211-241`: 색 타일 `<button onClick={() => handleSelectColor(color)}>`(`:218`). trial 완료 시 `setGlobalState(... "correct_feedback")`(`:150`). tap/success 없음.
- **Digit** `src/features/lessons/exerciseTypes/DigitSpanPractice.tsx:54-68,170-187`: 키패드 `<button onClick={() => addDigit(digit)}>`(`:174`). 정답 시 `setGlobalState("correct_feedback")`(`:103`). tap/success 없음.
- **Pair** `src/features/lessons/exerciseTypes/PairMatching.tsx:69-99,124-153`: 카드 `<button onClick={() => handleLeftSelect(item.id)}>`(`:128`). 매치 시 `setMatchedIds`(`:49`)는 별도 음 없음. `handleCheck` 정답 시 `setGlobalState("correct_feedback")`(`:89`). tap/success 없음.
- **ShapeCopy** `src/features/lessons/exerciseTypes/ShapeCopyPractice.tsx`: canvas 드로잉(버튼 아님), 정답 시 `setGlobalState("correct_feedback")`(`:236`). FeedbackTray 집중화로 자동 적용되므로 별도 tap 불필요(canvas 터치는 그리기 입력).
- **SpeechRepeat** `src/features/lessons/exerciseTypes/SpeechRepeatPractice.tsx`:
  - `:39-49` `handlePlay` 가 raw `SpeechSynthesisUtterance` 직접 사용(`speakCalmly` 우회).
  - `:67-68` 저장 후 `setGlobalState("correct_feedback")` 하고 `onComplete` 미호출(주석 `:67`, `:71-73`). **Continue 대기 유지 — 변경 금지**.
- **AudioChoice** `src/features/lessons/exerciseTypes/AudioChoice.tsx:35-41`: `playAudio` 가 raw `SpeechSynthesisUtterance` 직접 사용(`speakCalmly` 우회). ChoiceCard(`:97-104`)를 쓰므로 선택 tap 은 묻음.

## 2. 전제 / 선행 작업

- **선행**: SP-02(Button3D variant className 이 웜 체계로 재정의됨). SP-04 는 className 이 아닌 onClick/핸들러/음성 원시함수만 건드리므로 SP-02 와 충돌 없음. 단 Button3D 는 SP-02 와 SP-04 가 같은 파일을 공유 → SP-04는 `tap()` wiring 만 추가(className 변경 금지).
- **공유 파일 주의**:
  - `Button3D.tsx`: SP-02(variant), SP-04(onClick tap) 공유. 본 SP 는 `tap()` 연결만.
  - `FeedbackTray.tsx`: 본 SP 단독(success 집중화). 단 icon 색상은 SP-02 에서 별도.
  - `SpeechRepeatPractice.tsx`: Continue 대기 로직(`:33-37,67-73`) 절대 수정 금지. raw TTS(`:39-49`)만 교체.
- **음성 게이트**: 모든 `tap()/success()/speak()` 는 `isSoundFeedbackEnabled()` 를 통해 사용자 설정 존중. 미지원 환경(WebAudio/Vibration/speechSynthesis 없음)은 no-op → 루틴 계속 작동.

## 3. 작업 워크플로

### Step 1 — Button3D onClick 에 tap() 연결 (최대 효과)

- 파일: `src/components/Button3D.tsx:1-20`
- FROM:
  ```tsx
  import type { ButtonHTMLAttributes } from "react";
  import { twMerge } from "tailwind-merge";

  export interface Button3DProps extends ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: "primary" | "secondary" | "danger" | "neutral" | "disabled";
    size?: "md" | "lg" | "xl";
    pressed?: boolean;
    fullWidth?: boolean;
  }

  export function Button3D({
    variant = "primary",
    size = "lg",
    pressed = false,
    fullWidth = false,
    disabled = false,
    children,
    className,
    ...props
  }: Button3DProps) {
    const isActuallyDisabled = disabled || variant === "disabled";
  ```
- TO:
  ```tsx
  import type { ButtonHTMLAttributes } from "react";
  import { twMerge } from "tailwind-merge";
  import { useInteractionFeedback } from "../hooks/useInteractionFeedback";

  export interface Button3DProps extends ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: "primary" | "secondary" | "danger" | "neutral" | "disabled";
    size?: "md" | "lg" | "xl";
    pressed?: boolean;
    fullWidth?: boolean;
  }

  export function Button3D({
    variant = "primary",
    size = "lg",
    pressed = false,
    fullWidth = false,
    disabled = false,
    children,
    className,
    onClick,
    ...props
  }: Button3DProps) {
    const { tap } = useInteractionFeedback();
    const isActuallyDisabled = disabled || variant === "disabled";

    const handleClick: React.MouseEventHandler<HTMLButtonElement> = (event) => {
      if (isActuallyDisabled) return;
      tap();
      onClick?.(event);
    };
  ```
  그리고 `<button>`(`:46-57`)의 `{...props}` 앞에 `onClick={handleClick}` 를 명시적으로 주입(props spread 보다 우선). `disabled={isActuallyDisabled}` 유지.
- verify: `npm run typecheck`
- checkpoint: `git add -A && git commit -m "SP-04: wire Button3D onClick to tap() feedback"`

### Step 2 — FeedbackTray correct 시 success() 집중화 (정답 음 1곳)

- 파일: `src/components/FeedbackTray.tsx:1-25`
- FROM:
  ```tsx
  import { twMerge } from "tailwind-merge";
  import { Button3D } from "./Button3D";
  import { CheckCircle2, XCircle, Info } from "lucide-react";

  export interface FeedbackTrayProps {
    variant: "correct" | "incorrect" | "hint" | "memory" | "neutral";
    title: string;
    body?: string;
    primaryActionLabel: string;
    onPrimaryAction: () => void;
    secondaryActionLabel?: string;
    onSecondaryAction?: () => void;
    className?: string;
  }

  export function FeedbackTray({
    variant,
    title,
    body,
    primaryActionLabel,
    onPrimaryAction,
    secondaryActionLabel,
    onSecondaryAction,
    className,
  }: FeedbackTrayProps) {
  ```
- TO:
  ```tsx
  import { useEffect } from "react";
  import { twMerge } from "tailwind-merge";
  import { Button3D } from "./Button3D";
  import { CheckCircle2, XCircle, Info } from "lucide-react";
  import { useInteractionFeedback } from "../hooks/useInteractionFeedback";

  export interface FeedbackTrayProps {
    variant: "correct" | "incorrect" | "hint" | "memory" | "neutral";
    title: string;
    body?: string;
    primaryActionLabel: string;
    onPrimaryAction: () => void;
    secondaryActionLabel?: string;
    onSecondaryAction?: () => void;
    className?: string;
  }

  export function FeedbackTray({
    variant,
    title,
    body,
    primaryActionLabel,
    onPrimaryAction,
    secondaryActionLabel,
    onSecondaryAction,
    className,
  }: FeedbackTrayProps) {
    const { success } = useInteractionFeedback();

    // Centralize the correct-answer cue: every exercise that sets
    // correct_feedback now gets the success tone + vibration in one place.
    useEffect(() => {
      if (variant === "correct") {
        success();
      }
    }, [variant, success]);
  ```
- verify: `npm run typecheck && npm test -- FeedbackTray`(신규 테스트는 §4 참조)
- checkpoint: `git add -A && git commit -m "SP-04: centralize success() cue in FeedbackTray on correct variant"`

### Step 3 — TrailSwitching 노드 tap, 완료 success

- 파일: `src/features/lessons/exerciseTypes/TrailSwitchingPractice.tsx:46-108`
- FROM(훅 누락 + 핸들러): `const { t } = useTranslation();`(`:46`) 그리고 `handleNodeClick` 본문에 tap/success 없음.
- TO: import 추가 `import { useInteractionFeedback } from "../../../hooks/useInteractionFeedback";`, 컴포넌트 내 `const { tap, success } = useInteractionFeedback();`.
  - `handleNodeClick`(`:75`) 진입 가드 통과 직후 `tap();` 호출(노드 클릭 반응).
  - 완료 분기(`:91` `if (nextClickedNodeIds.length === expectedTrail.length)`) 내 `setGlobalState("correct_feedback")`(`:104`) 앞에 `success();` 추가(FeedbackTray 집중화와 중복을 피하기 위해 **success() 호출은 생략**하고 FeedbackTray 에만 위임 — Step 2 집중화 채택). 따라서 본 Step 은 **노드 tap() 만 추가**.
- verify: `npm run typecheck && npm test -- TrailSwitchingPractice`
- checkpoint: `git add -A && git commit -m "SP-04: TrailSwitching node tap feedback (success via FeedbackTray)"`

### Step 4 — Stroop 색 타일 tap (success 는 FeedbackTray 집중화에 위임)

- 파일: `src/features/lessons/exerciseTypes/StroopTouchPractice.tsx:93-156`
- FROM: `const { t } = useTranslation();`(`:93`)만 있고 `handleSelectColor`(`:117`) 본문에 tap 없음.
- TO: import 추가 `import { useInteractionFeedback } from "../../../hooks/useInteractionFeedback";`, 컴포넌트 내 `const { tap } = useInteractionFeedback();`. `handleSelectColor` 의 가드(`:118-120`) 통과 직후 `tap();` 추가. trial 완료(`:137-150`)의 success 는 FeedbackTray 집중화(`correct_feedback` set)로 위임 → 본 파일엔 success 미추가.
- verify: `npm run typecheck && npm test -- StroopTouchPractice`
- checkpoint: `git add -A && git commit -m "SP-04: Stroop color tile tap feedback"`

### Step 5 — DigitSpan 키패드 tap

- 파일: `src/features/lessons/exerciseTypes/DigitSpanPractice.tsx:40-68`
- FROM: `const { t } = useTranslation();`(`:40`)만. `addDigit`(`:54`)에 tap 없음.
- TO: import 추가 `import { useInteractionFeedback } from "../../../hooks/useInteractionFeedback";`, 컴포넌트 내 `const { tap } = useInteractionFeedback();`. `addDigit` 가드(`:55-57`) 통과 직후(실제 digit 추가 분기) `tap();` 추가. 정답 success 는 FeedbackTray 집중화 위임.
- verify: `npm run typecheck && npm test -- DigitSpanPractice`(테스트 미존재 시 `npm run typecheck && npm run lint`)
- checkpoint: `git add -A && git commit -m "SP-04: DigitSpan keypad tap feedback"`

### Step 6 — PairMatching 카드 tap + 매치 시 success

- 파일: `src/features/lessons/exerciseTypes/PairMatching.tsx:28-85`
- FROM: `const { t } = useTranslation();`(`:28`)만. `handleLeftSelect`/`handleRightSelect`(`:69-85`)와 `resolveSelection`(`:45`)에 tap/success 없음.
- TO: import 추가 `import { useInteractionFeedback } from "../../../hooks/useInteractionFeedback";`, 컴포넌트 내 `const { tap, success } = useInteractionFeedback();`.
  - `handleLeftSelect`(`:69`)/`handleRightSelect`(`:78`) 진입 시 `tap();` 추가(선택 반응).
  - `resolveSelection`(`:45`) 의 매치 분기(`:46` `if (leftId === rightId)`) 내 `setMatchedIds` 후 `success();` 추가(쌍 매치 즉정 정답 큐 — FeedbackTray 의 correct_feedback 과 별개 타이밍).
- verify: `npm run typecheck && npm test -- PairMatching`
- checkpoint: `git add -A && git commit -m "SP-04: PairMatching card tap + match success feedback"`

### Step 7 — PictureChoice plain button tap (ChoiceCard 교체 없이 최소 변경)

- 파일: `src/features/lessons/exerciseTypes/PictureChoice.tsx:27-51`
- FROM: `const { t } = useTranslation();`(`:27`)만. `handleSelect`(`:31`)에 tap 없음.
- TO: import 추가 `import { useInteractionFeedback } from "../../../hooks/useInteractionFeedback";`, 컴포넌트 내 `const { tap } = useInteractionFeedback();`. `handleSelect` 가드(`:32-34`) 통과 직후 `tap();` 추가. 정답 success 는 FeedbackTray 집중화 위임(`correct_feedback` set `:44`). ChoiceCard 교체(SP-04 명시적 선택지)는 범위 확장이므로 보류(§7).
- verify: `npm run typecheck`
- checkpoint: `git add -A && git commit -m "SP-04: PictureChoice option tap feedback"`

### Step 8 — SpeechRepeat raw TTS 를 speakCalmly 로 교체 (Continue 대기 유지)

- 파일: `src/features/lessons/exerciseTypes/SpeechRepeatPractice.tsx:1-49`
- FROM:
  ```tsx
  import { useEffect, useState } from "react";
  import { useTranslation } from "react-i18next";
  import { Play } from "lucide-react";
  import { Button3D } from "../../../components/Button3D";
  import { SpeechCapturePanel } from "../../speech/SpeechCapturePanel";
  import { useSpeechCapture } from "../../speech/useSpeechCapture";
  import type { ExerciseState } from "./types";
  import { saveCognitiveRoutineResult } from "../../cognitive/cognitiveRoutineStorage";
  import { getSpeechLanguage } from "../../../utils/localizedText";
  ...
    const handlePlay = () => {
      if (!("speechSynthesis" in window)) return;

      setIsPlaying(true);
      const utterance = new SpeechSynthesisUtterance(phrase);
      utterance.lang = getSpeechLanguage(i18n.language);
      utterance.rate = 0.92;
      utterance.onend = () => setIsPlaying(false);
      utterance.onerror = () => setIsPlaying(false);
      window.speechSynthesis.speak(utterance);
    };
  ```
- TO:
  ```tsx
  import { useEffect, useState } from "react";
  import { useTranslation } from "react-i18next";
  import { Play } from "lucide-react";
  import { Button3D } from "../../../components/Button3D";
  import { SpeechCapturePanel } from "../../speech/SpeechCapturePanel";
  import { useSpeechCapture } from "../../speech/useSpeechCapture";
  import type { ExerciseState } from "./types";
  import { saveCognitiveRoutineResult } from "../../cognitive/cognitiveRoutineStorage";
  import { getSpeechLanguage } from "../../../utils/localizedText";
  import { useInteractionFeedback } from "../../../hooks/useInteractionFeedback";
  ...
    const { t, i18n } = useTranslation();
    const { speak } = useInteractionFeedback();
    const [isPlaying, setIsPlaying] = useState(false);
    ...
    const handlePlay = () => {
      // Use the shared calm-TTS primitive so speech respects the learner's
      // sound setting and is a safe no-op where speechSynthesis is missing.
      speak(phrase, getSpeechLanguage(i18n.language));
      setIsPlaying(true);
      // Clear the playing state shortly after; speakCalmly cancels prior
      // utterances and does not expose onend, so we approximate the end.
      window.setTimeout(() => setIsPlaying(false), 1500);
    };
  ```
  **주의**: `handleFinish`(`:51-69`)와 Continue 대기 useEffect(`:33-37`)는 건드리지 않는다.
- verify: `npm run typecheck && npm test -- SpeechRepeatPractice`
- checkpoint: `git add -A && git commit -m "SP-04: SpeechRepeat uses speakCalmly (Continue wait unchanged)"`

### Step 9 — AudioChoice raw TTS 를 speakCalmly 로 교체

- 파일: `src/features/lessons/exerciseTypes/AudioChoice.tsx:1-41`
- FROM:
  ```tsx
  import { useState } from "react";
  import { Volume2 } from "lucide-react";
  import { useTranslation } from "react-i18next";
  import { Button3D } from "../../../components/Button3D";
  import { ChoiceCard } from "../../../components/ChoiceCard";
  import type { ExerciseState } from "./types";
  import { getSpeechLanguage } from "../../../utils/localizedText";
  ...
    const playAudio = () => {
      if (!audioText || !("speechSynthesis" in window)) return;
      const utterance = new SpeechSynthesisUtterance(audioText);
      utterance.lang = getSpeechLanguage(i18n.language);
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(utterance);
    };
  ```
- TO:
  ```tsx
  import { useState } from "react";
  import { Volume2 } from "lucide-react";
  import { useTranslation } from "react-i18next";
  import { Button3D } from "../../../components/Button3D";
  import { ChoiceCard } from "../../../components/ChoiceCard";
  import type { ExerciseState } from "./types";
  import { getSpeechLanguage } from "../../../utils/localizedText";
  import { useInteractionFeedback } from "../../../hooks/useInteractionFeedback";
  ...
    const { t, i18n } = useTranslation();
    const { speak } = useInteractionFeedback();
    ...
    const playAudio = () => {
      if (!audioText) return;
      speak(audioText, getSpeechLanguage(i18n.language));
    };
  ```
- verify: `npm run typecheck`
- checkpoint: `git add -A && git commit -m "SP-04: AudioChoice uses speakCalmly for playback"`

## 4. 단계별 테스트

표준 게이트: `npm run typecheck && npm run lint && npm test && npm run build`.

SP-04 전용 단정(권장 신규/확장):
- `src/components/Button3D.test.tsx`(신규 권장): Button3D 클릭 시 `useInteractionFeedback` 의 `tap` 이 호출됨(mock `useInteractionFeedback` 또는 `playSoftTapTone` spy). disabled variant 클릭 시 tap 미호출.
- `src/components/FeedbackTray.test.tsx`(신규 권장): `variant="correct"` 마운트 시 `success` 가 1회 호출됨(useEffect 의존성). `variant="incorrect"` 시 미호출.
- `src/features/lessons/exerciseTypes/TrailSwitchingPractice.test.tsx`(기존 존재): 노드 클릭 시 tap 호출 단정 추가.
- `src/features/lessons/exerciseTypes/StroopTouchPractice.test.tsx`(기존 존재): 색 타일 클릭 시 tap 호출 단정 추가.
- `src/features/lessons/exerciseTypes/PairMatching.test.tsx`(기존 존재): 카드 선택 tap, 쌍 매치 시 success 호출 단정 추가.
- `src/features/lessons/exerciseTypes/SpeechRepeatPractice.test.tsx`(기존 존재): handlePlay 가 `speakCalmly` 경유(`SpeechSynthesisUtterance` 직접 생성 아님), `handleFinish` 후 `onComplete` 미호출(Continue 대기) 유지 단정 회귀.

수동: 소리 ON 상태에서 정답 선택 시 오름차순 성공 음 + 진동, 버튼 탭 시 짧은 탭 음 확인. 소리 OFF(`isSoundFeedbackEnabled()===false`) 시 정숙 + 시각(테두리/체크)만.

## 5. 수용 기준 (high_level_plan HL-4에서)

- 모든 상호작용(Button3D, ChoiceCard, Trail/Stroop/Digit/Pair/Picture)이 100~200ms 내 진동/소리/시각 중 ≥1 반응.
- 정답 시 `success()` 음+진동(FeedbackTray 집중화로 모든 exercise 일괄).
- SpeechRepeat 는 Continue 대기 유지(자동진입 변경 없음).
- 미지원 환경(WebAudio/Vibration/speechSynthesis 결손)에서 루틴이 계속 작동(no-op).
- `npm run typecheck && npm run lint && npm test && npm run build` 통과.

## 6. 범위 펜스 (절대 미터치)

- 키오스크 `/kiosk`, `KioskHomeScreen`, `useKioskControls` — 라우트 연결됨, 그대로 유지(HL-10).
- 복지관 운영자 대시보드 — 미구현, 별도(`docs/welfare-center-hybrid-plan.md`).
- 일본 현지 보상/캐릭터/기관 — 별도(`docs/japan-localization-research-plan.md`).
- 식약처/임상 검증 — app 카피 비의료 유지만.
- Button3D variant className(SP-02 영역) — 본 SP 는 onClick tap wiring 만.
- SpeechRepeat Continue 대기 로직(`SpeechRepeatPractice.tsx:33-37,51-73`) — 자동진입 변경 금지.
- ShapeCopy canvas 드로잉 — 그리기 입력이므로 tap 미추가(FeedbackTray 집중화로 정답 음 자동 적용).
- 공식 MMSE/MoCA/CIST 문항·컷오프 복제 금지(본 SP 와 무관하나 원칙 유지).

## 7. 추가 발견 (보류 — step화 금지)

- `PictureChoice.tsx` 의 plain `<button>` 을 `ChoiceCard` 로 교체하면 선택 강화/통일(SP-3 정합)에 유리하나, ChoiceCard 의 state 머신(idle/selected/correct/incorrect/disabled) 매핑 + imageUrl 슬롯이 필요해 범위 확장 → 보류.
- `MultipleChoiceMeaning` 은 ChoiceCard 사용으로 선택 tap 이 이미 묻음. FeedbackTray 집중화(Step 2)로 success 도 자동 적용 → 추가 수정 불필요(이미 본문에 반영됨).
- `success()` 의 `vibrateLightly([18,40,18])` 패턴이 iOS Safari 에서 무시됨(미지원 no-op). 진동 신뢰성 강화는 별도.
- `speakCalmly` 가 `onend`/`onerror` 를 노출하지 않아 SpeechRepeat 의 `isPlaying` 상태를 근사(setTimeout)로 처리함. 정확한 end 콜백이 필요하면 `speakCalmly` 시그니처 확장이 필요 → 본 SP 범위 밖.
- `FeedbackTray` 의 `memory` variant(단어 회상 완료)도 success 큐가 어울리나, SP-04 는 `correct` 에 한정. `memory` 확장은 보류.

## 8. 롤백 메모

- 각 Step 은 독립 commit 이므로 `git revert <sha>` 로 단계별 롤백 가능.
- Step 1(Button3D tap)과 Step 2(FeedbackTray success)는 독립. Step 1 만 롤백해도 FeedbackTray success 는 정상.
- Step 3-7(exercise tap)은 FeedbackTray success 집중화(Step 2)에 의존하지만, 각 exercise 의 tap 만 롤백해도 루틴 동작에는 영향 없음(tap 만 사라짐).
- Step 8(SpeechRepeat speakCalmly) 롤백 시 raw `SpeechSynthesisUtterance` 복원 필요. Continue 대기 로직은 한 번도 건드리지 않았으므로 무결.
- 공유 파일(Button3D)은 SP-02 와 병합 시 className 영역을 건드리지 않았는지 확인할 것.
