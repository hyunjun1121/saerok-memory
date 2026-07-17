# SP-03 — 큰 글자 + 명확한 선택 + 큰 터치 타겟

> **AXIS 고정**: 본 파일은 실행 워크플로. 방향·우선순위·수용기준은 `high_level_plan.md` 의 HL-3 와 `specifie_plan.md` 의 SP-3 에 고정된다. 본 파일에서 새 범위를 추가하지 않는다.

| 우선순위 | 의존(선행 SP) | 터치 파일 | 미터치(HL-10) |
|---|---|---|---|
| P0 | SP-02 | `ChoiceCard.tsx`, `BottomNavigation.tsx`, `TopStatusBar.tsx`, `ScenarioCard.tsx`, `WeeklyRewardCard.tsx`, `SupportResourceCard.tsx`, `MascotBubble.tsx`, `Button3D.tsx`, `FamilyScreen.tsx`, `VerbalFluencyPractice.tsx` | 키오스크/복지관대시보드/일본/임상 |

## 0. 목표
모든 상호작용/본문 텍스트를 `text-base` 이상으로 올리고, 보상·연속 참여 숫자는 `text-xl`+로 강조한다. `ChoiceCard` 의 선택(selected) 상태를 채움 + 체크 아이콘으로 명확히 하고, `FamilyScreen` 탭과 `VerbalFluency` 단어 칩에 최소 터치 높이(min-h)를 부여한다. `MascotBubble` 에 `praising` 상태를 추가·`encouraging` 의 빨간 틴트를 제거하며 `aria-live` 를 건다. `Button3D` 에 `aria-pressed` 를 추가한다(색상은 SP-02 영역이므로 건드리지 않는다). SP-08 의 Result 마스코트 칭찬이 `praising` mood를 소비하므로 본 SP에서 상태를 먼저 준비한다.

## 1. 현재 구현 (소스 재확인 결과)

- **`src/components/ChoiceCard.tsx:36`** — base `"relative flex items-center min-h-[64px] w-full rounded-2xl border-[3px] px-5 py-4 text-left transition-all active:scale-[0.99] select-none"`. press 피드백 `active:scale-[0.99]` 로 미약.
- **`src/components/ChoiceCard.tsx:41`** — selected = `"border-blue-500 bg-blue-50 text-ink ring-4 ring-blue-200"`. 청색 틴트+ring만 있고 채움·체크 없이 모호(멘토 "선택 명확화" 위반).
- **`src/components/ChoiceCard.tsx:67`** — `aria-pressed={isPressed}` 이미 존재(양호, 유지).
- **`src/components/ChoiceCard.tsx:74`** — 라벨 `text-xl font-bold`(양호, 유지).
- **`src/components/ChoiceCard.tsx:76`** — description `text-base text-gray-500`(회색 명도 약함).
- **`src/components/ChoiceCard.tsx:86`** — status 배지 `text-xs font-extrabold`(과소).
- **`src/components/ChoiceCard.tsx:93-97`** — `state === "correct"` 일 때만 `Check` 아이콘(selected에는 체크 없음).
- **`src/components/BottomNavigation.tsx:69`** — `<span className={twMerge("font-bold", isActive ? "text-base" : "text-sm")}>`. 비활성 라벨 `text-sm` 로 작음.
- **`src/components/TopStatusBar.tsx:48`** — streak 숫자 `text-base font-bold text-orange-600`.
- **`src/components/TopStatusBar.tsx:55`** — garden 숫자 `text-base font-bold text-blue-600`.
- **`src/components/TopStatusBar.tsx:61`** — Settings 링크 `text-gray-400`(저명도).
- **`src/components/ScenarioCard.tsx:27`** — title `text-sm font-extrabold uppercase tracking-wide text-amber-700`.
- **`src/components/ScenarioCard.tsx:35`** — benefit `text-sm font-medium leading-relaxed text-amber-800`.
- **`src/components/WeeklyRewardCard.tsx:30`** — catalogNote `text-sm font-medium leading-relaxed text-amber-800`.
- **`src/components/SupportResourceCard.tsx:56`** — pending 노트 `text-sm font-medium leading-relaxed text-gray-700`.
- **`src/components/SupportResourceCard.tsx:63`** — resource 라인 `text-sm font-medium text-ink`.
- **`src/components/SupportResourceCard.tsx:68`** — phone 라인 (라벨만, 숫자는 일반 텍스트).
- **`src/components/SupportResourceCard.tsx:89`** — verifyNote `text-xs font-medium leading-relaxed text-teal-800`.
- **`src/components/MascotBubble.tsx:4`** — `mood: "happy" | "thinking" | "encouraging" | "calm"`(`praising` 없음).
- **`src/components/MascotBubble.tsx:25-28`** — `encouraging` = `border-red-200 bg-red-50`(오답 인상).
- **`src/components/MascotBubble.tsx:55-61`** — 버블 div에 `role/aria-live` 없음.
- **`src/components/Button3D.tsx:46-56`** — `<button>` 에 `aria-pressed` 없음(`pressed` prop은 존재). 색상 클래스(`:33-43`)는 SP-02 영역.
- **`src/app/family/FamilyScreen.tsx:204-233`** — family/counselor 탭 버튼 `py-2 text-sm font-bold`, min-h 없음(~36px, 56px 미달).
- **`src/features/lessons/exerciseTypes/VerbalFluencyPractice.tsx:232-241`** — 단어 칩 `<button className="rounded-full border-2 border-green-200 bg-white px-4 py-2 text-base font-extrabold text-green-800">`, min-h 없음.

## 2. 전제 / 선행 작업
- **SP-02 선행 필수**: 본 SP의 className(amber/orange/ink/surface-warm)은 SP-02 가 토큰과 Button3D 컬러를 웜 고대비 체계로 재정의한 이후 정합한다. SP-02 가 `amber-700/800`, `orange-500`, `ink`, `surface-warm` 토큰을 확보한 상태에서 본 단계를 실행한다.
- **공유 파일 조정 주의**:
  - `Button3D.tsx`: 본 SP는 `aria-pressed` 추가만. 색상 variant(`variantClasses`)는 SP-02 가 소유 → 본 파일에서 variant 색상 클래스를 변경하지 않는다.
  - `MascotBubble.tsx`: `praising` 상태 추가 + 빨간 틴트 제거 + `aria-live` 는 본 SP. 단 `praising` mood를 실제로 소비(렌더)하는 곳은 SP-08 의 ResultScreen 이므로, 본 SP에서는 상태·스타일·접근성 준비까지만 하고 Result 렌더는 SP-08 로 연기한다.

## 3. 작업 워크플로

### Step 1 — ChoiceCard selected 상태를 채움 + 체크로 강화
- 파일: `src/components/ChoiceCard.tsx:41`
- FROM: `    selected: "border-blue-500 bg-blue-50 text-ink ring-4 ring-blue-200",`
- TO: `    selected: "border-amber-700 bg-amber-50 text-ink ring-4 ring-amber-200",`
- verify: `npm run typecheck && npm test -- ChoiceCard`
- checkpoint: `git add -A && git commit -m "SP-03: ChoiceCard selected를 amber 채움+링로 명확화"`

> 참고: 틴트 색을 amber 웜 체계로 전환(SP-02 정합). 청색 단독 틴트 제거로 색 의존성 완화. 본 step은 채움+링 명확화가 목적이며, 체크 아이콘은 Step 2에서 selected에도 노출한다.

### Step 2 — ChoiceCard selected 에도 체크 아이콘 노출 (선택 명확화)
- 파일: `src/components/ChoiceCard.tsx:93-97`
- FROM:
```
      {state === "correct" && (
        <span className="flex-shrink-0 ml-2 text-primary-600">
          <Check size={24} strokeWidth={3} />
        </span>
      )}
```
- TO:
```
      {(state === "selected" || state === "correct") && (
        <span className="flex-shrink-0 ml-2 text-amber-700" aria-hidden="true">
          <Check size={24} strokeWidth={3} />
        </span>
      )}
```
- verify: `npm run typecheck && npm test -- ChoiceCard`
- checkpoint: `git add -A && git commit -m "SP-03: ChoiceCard selected에 체크 아이콘 추가로 선택 명확화"`

### Step 3 — ChoiceCard press 피드백 + 본문 글자 하한선
- 파일: `src/components/ChoiceCard.tsx:36` 와 `:76`, `:86`
- FROM(36): `    "relative flex items-center min-h-[64px] w-full rounded-2xl border-[3px] px-5 py-4 text-left transition-all active:scale-[0.99] select-none";`
- TO(36): `    "relative flex items-center min-h-[64px] w-full rounded-2xl border-[3px] px-5 py-4 text-left transition-all active:scale-[0.97] active:translate-y-[1px] select-none";`
- FROM(76): `              <span className="text-base text-gray-500 font-medium mt-1">`
- TO(76): `              <span className="text-base text-gray-700 font-medium mt-1">`
- FROM(86): `          className="ml-3 flex-shrink-0 rounded-full bg-white/80 px-3 py-1 text-xs font-extrabold text-ink shadow-sm"`
- TO(86): `          className="ml-3 flex-shrink-0 rounded-full bg-white/80 px-3 py-1 text-sm font-extrabold text-ink shadow-sm"`
- verify: `npm run typecheck && npm run lint && npm test`
- checkpoint: `git add -A && git commit -m "SP-03: ChoiceCard press 강화 + description/배지 글자 하한선 text-base/sm"`

### Step 4 — BottomNavigation 비활성 라벨 + TopStatusBar 숫자/아이콘 확대
- 파일: `src/components/BottomNavigation.tsx:69` 와 `src/components/TopStatusBar.tsx:48`, `:55`, `:61`
- FROM(BottomNavigation:69): `              <span className={twMerge("font-bold", isActive ? "text-base" : "text-sm")}>`
- TO(BottomNavigation:69): `              <span className={twMerge("font-bold", isActive ? "text-base" : "text-base")}>`
- FROM(TopStatusBar:48): `          <span className="text-base font-bold text-orange-600">{streak}</span>`
- TO(TopStatusBar:48): `          <span className="text-xl font-extrabold text-orange-600">{streak}</span>`
- FROM(TopStatusBar:55): `          <span className="text-base font-bold text-blue-600">{gardenPoints}</span>`
- TO(TopStatusBar:55): `          <span className="text-xl font-extrabold text-blue-600">{gardenPoints}</span>`
- FROM(TopStatusBar:61): `        className="p-2 -mr-2 rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors flex items-center justify-center min-w-[48px] min-h-[48px]"`
- TO(TopStatusBar:61): `        className="p-2 -mr-2 rounded-full text-gray-600 hover:text-gray-800 hover:bg-gray-100 transition-colors flex items-center justify-center min-w-[48px] min-h-[48px]"`
- verify: `npm run typecheck && npm run lint && npm test`
- checkpoint: `git add -A && git commit -m "SP-03: nav/상태바 글자 하한선 text-base, 보상 숫자 text-xl 강조"`

### Step 5 — 카드 본문 하한선 (ScenarioCard / WeeklyRewardCard / SupportResourceCard)
- 파일: `src/components/ScenarioCard.tsx:27`, `:35`; `src/components/WeeklyRewardCard.tsx:30`; `src/components/SupportResourceCard.tsx:56`, `:63`, `:68`, `:89`
- FROM(ScenarioCard:27): `        <p className="text-sm font-extrabold uppercase tracking-wide text-amber-700">`
- TO(ScenarioCard:27): `        <p className="text-base font-extrabold uppercase tracking-wide text-amber-700">`
- FROM(ScenarioCard:35): `        <p className="mt-2 text-sm font-medium leading-relaxed text-amber-800">`
- TO(ScenarioCard:35): `        <p className="mt-2 text-base font-medium leading-relaxed text-amber-800">`
- FROM(WeeklyRewardCard:30): `      <p className="text-sm font-medium leading-relaxed text-amber-800">`
- TO(WeeklyRewardCard:30): `      <p className="text-base font-medium leading-relaxed text-amber-800">`
- FROM(SupportResourceCard:56): `            <p className="rounded-xl bg-white px-3 py-2 text-sm font-medium leading-relaxed text-gray-700">`
- TO(SupportResourceCard:56): `            <p className="rounded-xl bg-white px-3 py-2 text-base font-medium leading-relaxed text-gray-700">`
- FROM(SupportResourceCard:63): `                className="flex flex-col gap-1 rounded-xl bg-white px-3 py-3 text-sm font-medium text-ink"`
- TO(SupportResourceCard:63): `                className="flex flex-col gap-1 rounded-xl bg-white px-3 py-3 text-base font-medium text-ink"`
- FROM(SupportResourceCard:68): `                    {t("support.phoneLabel")}: {resource.representativePhone}` (해당 `<p>` 에 클래스 없음)
- TO(SupportResourceCard:68): `                    <p className="text-base font-bold">{t("support.phoneLabel")}: {resource.representativePhone}</p>` (해당 라인의 `<p>`/텍스트 노드에 `text-base font-bold` 부여 — 파일의 실제 JSX 구조에 맞춰 `<p className="text-base font-bold">…</p>`로 감싸거나 기존 요소 클래스에 추가)
- FROM(SupportResourceCard:89): `          <p className="text-xs font-medium leading-relaxed text-teal-800">`
- TO(SupportResourceCard:89): `          <p className="text-sm font-medium leading-relaxed text-teal-800">`
- verify: `npm run typecheck && npm run lint && npm run build`
- checkpoint: `git add -A && git commit -m "SP-03: 카드 본문 글자 하한선 text-base, 전화라인 text-base font-bold"`

> 주의: SupportResourceCard:68 의 실제 JSX는 `<p>` 없이 텍스트 노드일 수 있으므로, 편집 시 해당 블록(`representativePhone` 출력부)을 확인하여 `text-base font-bold` 가 적용되도록 한다(라인 근사치).

### Step 6 — FamilyScreen 탭 + VerbalFluency 칩 최소 터치 높이
- 파일: `src/app/family/FamilyScreen.tsx:211`, `:225` 와 `src/features/lessons/exerciseTypes/VerbalFluencyPractice.tsx:236`
- FROM(FamilyScreen:211): `            "flex-1 rounded-lg py-2 text-center text-sm font-bold transition-colors",`
- TO(FamilyScreen:211): `            "flex-1 rounded-lg min-h-[56px] py-3 text-center text-base font-bold transition-colors",`
- FROM(FamilyScreen:225): `            "flex-1 rounded-lg py-2 text-center text-sm font-bold transition-colors",`
- TO(FamilyScreen:225): `            "flex-1 rounded-lg min-h-[56px] py-3 text-center text-base font-bold transition-colors",`
- FROM(VerbalFluencyPractice:236): `                  className="rounded-full border-2 border-green-200 bg-white px-4 py-2 text-base font-extrabold text-green-800"`
- TO(VerbalFluencyPractice:236): `                  className="rounded-full border-2 border-amber-300 bg-white min-h-[48px] px-4 py-2 text-base font-extrabold text-amber-800"`
- verify: `npm run typecheck && npm test -- FamilyScreen`
- checkpoint: `git add -A && git commit -m "SP-03: FamilyScreen 탭 min-h-56 + VerbalFluency 칩 min-h-48 amber 톤"`

> VerbalFluency 칩의 `border-green-200/text-green-800` 은 저명도 녹색(SL-2 회피 대상)이므로 amber 계열로 전환. 본 step은 SP-03 터치 타겟 영역에 속하나 색 전환은 SP-02 정합을 위해 같이 처리.

### Step 7 — MascotBubble praising 상태 추가 + encouraging 빨간 틴트 제거 + aria-live
- 파일: `src/components/MascotBubble.tsx:4`, `:16-33`, `:55-61`
- FROM(4): `  mood: "happy" | "thinking" | "encouraging" | "calm";`
- TO(4): `  mood: "happy" | "thinking" | "encouraging" | "calm" | "praising";`
- FROM(25-28):
```
    encouraging: {
      bubbleBorder: "border-red-200",
      bubbleBg: "bg-red-50",
    },
```
- TO(25-28):
```
    encouraging: {
      bubbleBorder: "border-amber-200",
      bubbleBg: "bg-amber-50",
    },
    praising: {
      bubbleBorder: "border-amber-300",
      bubbleBg: "bg-amber-50",
    },
```
- FROM(55-61):
```
        <div
          className={twMerge(
            "relative px-5 py-4 rounded-2xl border-2 text-lg font-medium text-ink shadow-sm z-20",
            config.bubbleBorder,
            config.bubbleBg
          )}
        >
          {message}
        </div>
```
- TO(55-61):
```
        <div
          role="status"
          aria-live="polite"
          className={twMerge(
            "relative px-5 py-4 rounded-2xl border-2 text-xl font-bold text-ink shadow-sm z-20",
            config.bubbleBorder,
            config.bubbleBg
          )}
        >
          {message}
        </div>
```
- verify: `npm run typecheck && npm run lint && npm test`
- checkpoint: `git add -A && git commit -m "SP-03: MascotBubble praising 추가 + encouraging 빨간틴트 제거 + aria-live"`

> praising mood 렌더 소비(사용처)는 SP-08 ResultScreen. 본 step은 상태·스타일·접근성 준비만. `MascotBubble` 을 사용하는 기존 호출부(Home/Lesson)는 mood 값이 변경되지 않으므로 타입/동작 영향 없음.

### Step 8 — Button3D aria-pressed 추가 (색상은 미건드)
- 파일: `src/components/Button3D.tsx:46-56`
- FROM:
```
    <button
      disabled={isActuallyDisabled}
      className={twMerge(
        baseClasses,
        sizeClasses[size],
        variantClasses[isActuallyDisabled ? "disabled" : variant],
        fullWidth ? "w-full" : "",
        pressed && !isActuallyDisabled ? "translate-y-1 shadow-none" : "",
        className
      )}
      {...props}
    >
```
- TO:
```
    <button
      disabled={isActuallyDisabled}
      aria-pressed={pressed || undefined}
      className={twMerge(
        baseClasses,
        sizeClasses[size],
        variantClasses[isActuallyDisabled ? "disabled" : variant],
        fullWidth ? "w-full" : "",
        pressed && !isActuallyDisabled ? "translate-y-1 shadow-none" : "",
        className
      )}
      {...props}
    >
```
- verify: `npm run typecheck && npm run lint && npm test`
- checkpoint: `git add -A && git commit -m "SP-03: Button3D aria-pressed 추가 (색상은 SP-02 영역, 미건드)"`

> `aria-pressed={pressed || undefined}` — pressed 가 false 일 때는 속성 생략(undefined), true 일 때만 `"true"` 노출. `variantClasses` 색상은 SP-02 가 소유하므로 본 step에서 변경하지 않는다.

## 4. 단계별 테스트
- 매 step: `npm run typecheck && npm run lint && npm test && npm run build`.
- SP-03 전용 단정 제안(기존 테스트 파일에 추가 권장):
  - `src/components/ChoiceCard.test.tsx`: selected 상태 렌더 시 `Check` 아이콘(lucide `Check`)이 문서에 노출됨 단정; selected className에 `bg-amber-50`/`ring-amber-200` 포함 단정.
  - `src/app/family/FamilyScreen.test.tsx`: 탭 버튼이 `min-h-[56px]` className 포함 단정(`toHaveClass` 또는 `className` 매칭).
  - `src/features/lessons/exerciseTypes/SpeechRepeatPractice.test.tsx` 또는 신규 `MascotBubble.test.tsx`(없으면 제안): `mood="praising"` 전달 시 `role="status"`/`aria-live="polite"` 단정; `encouraging` 가 `border-red-200`/`bg-red-50` 를 포함하지 않음 단정.
  - Button3D: `pressed` prop true 시 `aria-pressed="true"` 단정(기존 Button3D 테스트가 있으면 확장).
- 비의료 카피 회귀: 본 SP는 카피 키를 추가하지 않으므로 `copySafety.test.ts` 영향 없음(회귀 통과 유지).

## 5. 수용 기준 (high_level_plan HL-3에서)
- 모든 상호작용/본문 텍스트가 `text-base` 이상. 숫자/보상 숫자는 `text-xl`+ 로 강조(TopStatusBar streak/garden).
- `ChoiceCard` selected 가 채움(`bg-amber-50`)+링(`ring-amber-200`)+체크 아이콘으로 명확. 청색 단독 틴트 제거.
- `FamilyScreen` 탭 ≥ `min-h-[56px]`, `VerbalFluency` 칩 ≥ `min-h-[48px]`.
- `MascotBubble` 에 `praising` 상태 존재 + `encouraging` 빨간 틴트 제거 + `aria-live="polite"`.
- `Button3D` 에 `aria-pressed` 추가(색상은 SP-02).
- `npm run typecheck && npm run lint && npm test && npm run build` 통과.

## 6. 범위 펜스 (절대 미터치)
- 키오스크 `/kiosk`, `KioskHomeScreen`, `useKioskControls` — 라우트 연결됨, 그대로 유지.
- 복지관 운영자 대시보드 — 미구현, 별도(`docs/welfare-center-hybrid-plan.md`).
- 일본 현지 보상/캐릭터/기관 — 별도(`docs/japan-localization-research-plan.md`). 일본어 i18n 은 본 SP의 className 변경과 무관(카피 키 미추가).
- 식약처/임상 검증 — app 카피 비의료 유지만(본 SP 카피 변경 없음).
- `Button3D` variant 색상 클래스(`variantClasses`) — SP-02 영역, 본 SP는 `aria-pressed`만.
- `MascotBubble` `praising` 의 실제 소비처(ResultScreen 렌더) — SP-08.
- `FeedbackTray` success/tap 연결, Trail/Stroop/Digit/Pair/PictureChoice 피드백 — SP-04.

## 7. 추가 발견 (보류 — step화 금지)
- `VerbalFluencyPractice.tsx:247,253` 의 uniqueWords/repeatedWords 라벨도 `text-sm font-bold text-gray-500` 로 본문 하한선 위반. 본 SP "카드 본문" 범주에 넣을 수 있으나 exercise 내부 통계 라벨로 SP-03 원 목록(ScenarioCard/WeeklyRewardCard/SupportResourceCard)에 명시되지 않았으므로 보류. SP-03 범위 확장 승인 시 Step 5에 추가 가능.
- `ChoiceCard` correct 상태(`ChoiceCard.tsx:42`)가 여전히 `border-primary-600 bg-primary-50 ... ring-primary-200`(녹색). SP-02 웜 체계 정합 차원에서 amber 전환이 필요해 보이나, correct 상태 색상은 "정답" 의미론을 가지므로 SP-02/SP-04 협의 후 처리 권장 → 보류.
- `BottomNavigation.tsx:39` nav 컨테이너가 `border-gray-200 bg-white` 로 고대비는 양호하나, 활성 pill(`:62-63`) `bg-primary-100 text-primary-700 ring-primary-400` 가 저명도 녹색 계열 → SP-02 정합 대상이나 본 SP 범위 밖(색상) → 보류.
- `SupportResourceCard.tsx:27,38,76` 의 teal 계열(`border-teal-100 bg-teal-50`, `text-teal-600/700/900`)이 노안 저명도 청계열. SP-02 웜 전환 대상이나 색상 영역 → 보류.
- `TopStatusBar.tsx:55` garden 숫자 색을 `text-blue-600` 에서 웜/ink 계열로 바꾸는 것도 SP-02 영역(본 SP는 크기만 `text-xl`로 변경).

## 8. 롤백 메모
- 각 step 은 독립 commit 이므로 `git revert <sha>` 로 단계별 롤백 가능.
- Step 7(MascotBubble)은 mood union 타입을 확장하므로, SP-08 ResultScreen 이 `mood="praising"` 을 이미 렌더 통합한 시점에서 Step 7 만 롤백하면 SP-08 타입 에러 발생 → 롤백 순서는 SP-08 연동 이후라면 SP-08 커밋부터 역순으로.
- Step 6(FamilyScreen/VerbalFluency)은 className 문자열 변경만이므로 안전하게 revert.
- Step 2(Check on selected)와 Step 1(selected amber)은 시각적으로 짝 → 둘 다 롤백하지 않으면 selected 가 amber 틴트만 남고 체크 없는 상태가 됨(기능엔 문제없으나 의도 훼손). 가능하면 세트로 취급.
