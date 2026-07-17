# specifie_plan.md

# Haru / 피우다 — 멘토링 기반 Specific 구현 계획 (전면 재작성)

작성일: 2026-06-23
대상 저장소: `saerok-memory` (`main`)
상위 문서: `high_level_plan.md` (HL-1 ~ HL-10)
파일명 주의: 요청 명칭 그대로 `specifie_plan.md`.

> 이전 `specifie_plan.md`를 **전면 대체**한다. 이번 버전은 실제 코드베이스를 9개 차원 + 색 검증 에이전트로 매핑한 결과를 기반으로, **현재 구현의 정확한 상태 → 파일/경로/라인 → FROM→TO 수정**만 담는다. 키오스크/복지관 대시보드/일본/임상은 app 구현에서 제외(SP-10 참조).
>
> **실행 워크플로**: 본 파일(HL-1~HL-10 축)의 각 SP를 step-by-step로 풀어놓은 워크플로는 `specifie_plan/` 폴더(`SP-01-*.md` … `SP-10-*.md`, 인덱스 `specifie_plan/README.md`)에 있다. 본 파일과 `high_level_plan.md`가 **축**이고, 폴더 파일들은 그 축에 고정된 실행 계획이다(새 범위 추가 없음).

라인 번호는 2026-06-23 현재 작업물 기준이며, 수정 중 이동할 수 있다. 함수/클래스/키 이름으로 식별할 것.

검증은 매 단계: `npm run typecheck && npm run lint && npm test && npm run build`.

---

## SP-1. 비의료·비검사 포지셔닝 + 동기부여 카피 강화  ← HL-1 (P1)

### 멘토 요구
검사/스크린/선별/진단/위험도/점수 회피. "매일 하시면 뇌가 활성화돼요" 동기부여 메시지(영양제 안 먹어도 뇌가 활성화).

### 현재 구현 상태
- **양호**: `src/locales/copySafety.test.ts:13-27` `LEARNER_NAMESPACES`가 12개 namespace(navigation/home/lesson/result/exercise/routine/speech/weekly/choice/feedback/topbar/garden/common)에서 금지어 강제. `LEARNER_BANS.ko = ['검사','스크리닝','선별','진단','위험도','치매 위험','점수']`(`copySafety.test.ts:46`). learner 화면 카피는 "오늘 루틴/완료/연속 참여"로 비의료화.
- **갭 1(동기부여 부재)**: Result(완료 화면)에 뇌 활성화 혜택 메시지가 없음. `ko.json:226-231` `result` = title/streak/points/done뿐. `ResultScreen.tsx:33-66`도 streak/물방울만. 멘토의 "영양제 안 먹어도 뇌가 활성화"가 구현에 없음.
- **갭 2(스캔 누락)**: `support` namespace가 `support.body`(`ko.json:64`)에 "진단이나 선별 결과가 아니에요"를 포함하나 `LEARNER_NAMESPACES`에서 **제외** → 누출 시 검사 안 됨.
- **양호**: 보호자/상담사 분리는 `family.tabs`/`counselorTitle`/`counselorDisclaimer`로 구현(`ko.json:412-423`). `family.advisory.levels` = 안정적/살펴보기/상담 대화 준비(비임상, `ko.json:355-368`).

### 관련 파일/경로
- `src/locales/ko.json`, `src/locales/en.json`, `src/locales/ja.json`
- `src/locales/copySafety.test.ts`
- `src/app/result/ResultScreen.tsx`
- `src/features/family/familySupportSummary.ts:130-135`(encouragement)

### 수정 계획
1. **동기부여 키 추가(3 locale)** — `result` namespace에:
   - ko: `"encouragement": "매일 이어갈수록 뇌가 활성화돼요. 작은 루틴이 큰 힘이 됩니다."`
   - en: `"encouragement": "A little each day keeps your brain active. Small routines add up."`
   - ja: `"encouragement": "毎日続けると、脳が少しずつ活性化します。小さなルーティンが大きな力に。"`
2. **Result 렌더** — `ResultScreen.tsx`에 title 아래, streak/points 위에 `<p className="text-center text-lg font-bold text-ink">{t("result.encouragement")}</p>` 삽입(`text-ink` 고대비, HL-2/SP-2와 정합).
3. **보호자 encouragement 혜택화** — `familySupportSummary.ts:130-135`에서 encouragement를 streak 카운트 대신, `participation.completed >= 3`일 때 신규 키 `family.encouragementBrainActive`(ko "매일 이어가면 뇌가 활성화되는 흐름이에요.") 사용.
4. **copySafety 확장** — `copySafety.test.ts`:
   - `support`·`family` namespace를 GLOBAL_BANS(공식 검사명 MMSE/MoCA/CIST)로 스캔하는 두 번째 검사 추가(진단/선별/점수는 보호자 문맥에서 허용되므로 learner 전용 BANS는 적용하지 않되, 공식 도구명 누출은 잡기).
   - 동기부여 단정 추가: `result.encouragement` 키가 3 locale에 존재 + '뇌' 토큰 포함.

### 완료 기준
Result에 뇌 활성화 문구 표시. `support`/`family`에서 공식 검사명 누출 시 테스트 실패. 동기부여 키 3 locale 존재.

---

## SP-2. 노안 고대비 컬러 시스템  ← HL-2 (P0, 멘토 1순위)

### 멘토 요구
청색/녹색 저명도 + 흰 글씨 = 안 보임 → 회피. 배경-글자 고대비. 논문 p.5: 청색/녹색 회피, 고대비, 색 단독 정보 금지.

### 현재 구현 상태 (치명)
- **토큰** `src/styles/tokens.css:7-18`: 녹색 램프 `primary-500 #58bd2f`(명도 L0.387) / `primary-400 #70cf42`(L0.485) / `primary-700 #34731f`(L0.131). 청색 `blue-500 #1cb0f6`(L0.380) / `blue-600 #0c84d6`. **`blue-400` 토큰 없음**(hover 깨짐).
- **치명 조합(측정값)**:
  - 흰 글씨 on `primary-500 #58bd2f` = **2.4:1 FAIL**(AA 4.5)
  - 흰 글씨 on `primary-400 #70cf42`(hover) = **1.96:1 FAIL**
  - 흰 글씨 on `blue-500 #1cb0f6` = **2.44:1 FAIL**
  - 흰 글씨 on `red-500 #ff4b4b` = 3.3:1 FAIL; on `red-600 #d6332a` = **4.81:1 PASS**
- **사용처**: `Button3D.tsx:34` primary, `:36` secondary, `:38` danger. `HomeScreen.tsx:32` hero 카드 `bg-primary-500` + `text-white`(`:37` h1, 2.4:1) + `text-primary-50` 서브(`:40`, 2.6:1 FAIL). `LessonNode.tsx:36-39` 완료/현재 노드 `bg-primary-500 text-white` + `ring-primary-200` 헤일로. `ResultScreen.tsx:31-38` 전면 `bg-primary-50`(연녹색 wash).
- **이미 있는 고대비 토큰(미사용)** `tokens.css:24-32`: `ink #2b2f33`, `surface-warm #fffaf0`, `background-warm #fdf8ef`, `orange-500 #ff9600`. ink on surface-warm = **12.96:1 AAA**, ink on orange-500 = 6.17:1, 흰 글씨 on amber `#b35900` = 4.83:1.
- **양호 패턴(유지)**: `FeedbackTray.tsx:28-29` correct = `bg-primary-50 text-primary-800`(dark-on-light, 8.7:1 PASS).
- **body 배경**: `tokens.css` body가 아직 `bg-[#f7f8fb]`(차냉). `src/index.css:1-31`은 별개 vendor/landing 스타일(purple `#aa3bff`)로 app 디자인과 무관 → **건드리지 않음**.

### 관련 파일/경로
- `src/styles/tokens.css`, `tailwind.config.ts`
- `src/components/Button3D.tsx`, `src/components/LessonNode.tsx`, `src/components/FeedbackTray.tsx`(icon만)
- `src/app/home/HomeScreen.tsx`, `src/app/result/ResultScreen.tsx`

### 수정 계획
1. **토큰 추가** `tokens.css`: `--color-amber-700: #b35900;`(흰 글씨 4.83:1), `--color-amber-800: #8f4400;`(흰 글씨 ~6.1:1). body 배경 `bg-[#f7f8fb]` → `bg-[var(--color-background-warm)]`(`#fdf8ef`). tailwind.config.ts에도 amber-700/800 매핑.
2. **Button3D primary** `Button3D.tsx:34`:
   - FROM `"border-2 border-primary-700 bg-primary-500 text-white shadow-[0_5px_0_var(--color-primary-700)] hover:bg-primary-400"`
   - TO `"border-2 border-amber-800 bg-orange-500 text-white shadow-[0_5px_0_var(--color-amber-800)] hover:bg-[#c46200]"` (흰 글씨 on orange-500 + amber 테두리로 AA 통과). 또는 노인 저자극 우선이면 TO `"border-2 border-orange-500 bg-[#fffaf0] text-ink shadow-[0_5px_0_var(--color-orange-500)] hover:bg-amber-50"` (cream+ink 12.96:1 AAA).
3. **Button3D secondary** `:36`:
   - FROM `bg-blue-500 text-white hover:bg-blue-400` (blue-400 없음)
   - TO `"border-2 border-ink bg-[#fffaf0] text-ink shadow-[0_5px_0_var(--color-ink)] hover:bg-gray-100"` (cream+ink 12.96:1).
4. **Button3D danger** `:38`:
   - FROM `bg-red-500 text-white`(3.3:1 FAIL)
   - TO `"border-2 border-[#a8281f] bg-red-600 text-white shadow-[0_5px_0_#a8281f] hover:bg-[#b82a21]"` (흰 글씨 on red-600 `#d6332a` = 4.81:1 PASS).
5. **Home hero** `HomeScreen.tsx:32,37,40`: `bg-primary-500` → `bg-primary-700`(또는 amber). h1 `text-white`(primary-700 위 5.8:1 PASS) 유지, 서브 `text-primary-50` → `text-primary-100`(primary-700 위 6.9:1).
6. **LessonNode** `LessonNode.tsx:36-39`: `bg-primary-500 text-white` → `bg-primary-700 text-white`. `ring-primary-200` 헤일로 → `ring-[#fffaf0]`(cream)로 분리 강화.
7. **Result 배경** `ResultScreen.tsx:31-38`: `bg-primary-50` 연녹 wash → `bg-surface-warm`(`#fffaf0`). 녹색은 작은 확인 체크 아이콘에만 남김.
8. **FeedbackTray icon** `:28-48`: icon `text-primary-500` on `bg-primary-50`(3.1:1 경계) → `text-primary-700`(5.4:1). memory icon 동일.
9. **Button3D min-h 유지**(`md min-h-[60px]`/`lg 68`/`xl 80`는 양호 → 변경 없음, HL-3 참조).

### 완료 기준
primary/secondary/danger가 AA 통과. 흰 글씨 on 저명도 녹/청이 핵심 CTA에서 제거. body warm 배경. `blue-400` 미정의 hover 문제 해결(secondary에서 blue 제거로 소멸).

---

## SP-3. 큰 글자 + 명확 선택 + 큰 터치 타겟  ← HL-3 (P0)

### 멘토 요구
글자가 버튼을 꽉 채우게. 선택 모호 금지. 큰 터치 타겟.

### 현재 구현 상태
- **버튼 min-h 양호**: `Button3D.tsx:24,27-29` base `min-h-[60px]`, md/lg/xl = 60/68/80px, 글자 lg/xl/2xl. `ChoiceCard.tsx:36` base `min-h-[64px] border-[3px]`, 라벨 `text-xl`(`:74`, 양호).
- **작은 글자(갭)**: `ChoiceCard.tsx:86` status 배지 `text-xs`. `BottomNavigation.tsx:69` 비활성 라벨 `text-sm`(활성만 `text-base`). `TopStatusBar.tsx:48,55` streak/물방울 숫자 `text-base`(너무 작음). `ScenarioCard.tsx:27,38` title/benefit `text-sm`. `WeeklyRewardCard.tsx:30` catalogNote `text-sm`. `SupportResourceCard.tsx:63,89` resource/verifyNote `text-sm`/`text-xs`.
- **선택 모호(갭)**: `ChoiceCard.tsx:41` selected = `border-blue-500 bg-blue-50 text-ink ring-4 ring-blue-200`(틴트+ring만, 채움 없음). press = `active:scale-[0.99]`(미약). `aria-pressed={isPressed}`는 있음(`:67`, 양호).
- **터치 타겟 부족(갭)**: `FamilyScreen.tsx:204-233` family/counselor 탭 버튼 `py-2`만, min-h 없음(~36px, 56px 미달). `VerbalFluencyPractice.tsx:232-241` 단어 칩 버튼 `px-4 py-2`만.
- **마스코트(갭)**: `MascotBubble.tsx:3` mood union = happy/thinking/encouraging/calm(**'praising' 없음**). `:25-28` 'encouraging' = `border-red-200 bg-red-50`(오답처럼 보임). praise 메시지에 `aria-live` 없음.

### 관련 파일/경로
- `src/components/{Button3D,ChoiceCard,BottomNavigation,TopStatusBar,ScenarioCard,WeeklyRewardCard,SupportResourceCard,MascotBubble}.tsx`
- `src/app/family/FamilyScreen.tsx`, `src/features/lessons/exerciseTypes/VerbalFluencyPractice.tsx`

### 수정 계획
1. **ChoiceCard selected 강화** `ChoiceCard.tsx:41`: FROM `border-blue-500 bg-blue-50 ... ring-blue-200` → TO `border-ink bg-orange-500 text-white ring-4 ring-amber-200`(채움+체크로 명확) 또는 selected 시 좌측 큰 체크 아이콘 + `bg-amber-50 border-orange-500 border-[3px]`(SP-2 웜 체계 정합).
2. **ChoiceCard press 강화** `:36`: `active:scale-[0.99]` → `active:scale-[0.97] active:translate-y-[1px]`.
3. **ChoiceCard status 배지** `:86`: `text-xs` → `text-sm font-extrabold`; description `text-gray-500` → `text-gray-700`.
4. **BottomNavigation 비활성 라벨** `:69`: `text-sm` → `text-base`(활성과 동일). active 표시는 색+pill 유지.
5. **TopStatusBar 숫자** `:48,55`: `text-base` → `text-xl font-extrabold`(보상 피드백 강조). Settings 아이콘 `:61` `text-gray-400` → `text-gray-600`.
6. **카드 본문 하한선**: `ScenarioCard.tsx:27,38`, `WeeklyRewardCard.tsx:30`, `SupportResourceCard.tsx:63,89` — `text-sm`→`text-base`, `text-xs`→`text-sm`. SupportResourceCard phone/홈페이지 라인 `text-base font-bold`.
7. **FamilyScreen 탭 버튼** `:204-233`: className에 `min-h-[56px] py-3` 추가(저장소 56px 관례와 정합).
8. **VerbalFluency 칩** `:232-241`: `min-h-[48px]` 추가(보조 칩).
9. **Button3D aria-pressed** `Button3D.tsx:46-57`: `<button>`에 `aria-pressed={pressed || undefined}` 추가(pressed prop이 이미 있음).
10. **MascotBubble praising** `MascotBubble.tsx`:
    - mood union에 `"praising"` 추가(`"happy"|"thinking"|"encouraging"|"calm"|"praising"`).
    - praising 스타일: `bg-amber-50 border-amber-300`, 텍스트 `text-xl font-bold`.
    - 'encouraging' 빨간 틴트 `border-red-200 bg-red-50` → amber/green로 변경(오답 인상 제거).
    - 버블 div에 `role="status" aria-live="polite"` 추가(praise 전달).

### 완료 기준
모든 상호작용/본문 텍스트 ≥ `text-base`. selected가 채움+체크로 명확. FamilyScreen 탭·VerbalFluency 칩 ≥ 48/56px. MascotBubble에 praising + aria-live.

---

## SP-4. 즉각·명확 상호작용 피드백  ← HL-4 (P0, 멘토 치명)

### 멘토 요구
건드리면 반드시 반응. 잘했으면 잘했다고. 차분한 목소리.

### 현재 구현 상태 (치명)
- **원시함수 양호**: `src/utils/interactionFeedback.ts` — `playSoftTapTone()`(`:62-64`, 520Hz/120ms), `playSoftSuccessTone()`(`:67-70`, 2음), `vibrateLightly()`(`:73-81`, navigator.vibrate 가드), `speakCalmly()`(`:84-103`, rate 0.92, cancel-safe). 전부 미지원 시 no-op.
- **훅 양호**: `src/hooks/useInteractionFeedback.ts:13-32` — `tap()`(tap+vibrate), `success()`(success+vibrate[18,40,18]), `speak()`. 전부 `isSoundFeedbackEnabled()` 게이트.
- **치명(연결 부재)**: 실제 호출은 `ChoiceCard.tsx:57-60`의 `tap()` **한 곳**만.
  - `Button3D.tsx:1-61`: 피드백 0(CSS press만).
  - `success()`/`speak()`는 **코드 어디서도 호출 안 됨**.
  - `MultipleChoiceMeaning.tsx:48-58` 정답 시 `correct_feedback`만 set(success 음 없음).
  - `PictureChoice.tsx:31-51`, `TrailSwitchingPractice.tsx`, `StroopTouchPractice.tsx`, `DigitSpanPractice.tsx`, `PairMatching.tsx`, `ShapeCopyPractice.tsx`: plain `<button>`, 피드백 없음.
- **FeedbackTray** `FeedbackTray.tsx:59-68`: `role="status" aria-live="polite" aria-atomic="true"`(양호) 단 success 음 없음.
- **양호(이미 수정됨, 유지)**: `SpeechRepeatPractice.tsx:67-73` — 저장 후 `correct_feedback` set하고 `onComplete` 호출하지 않음(주석 "advancement happens when learner taps Continue"). SP-03 요구대로 동작 → 변경 금지.
- **마이너**: `SpeechRepeatPractice.tsx:39-49`·`AudioChoice.tsx:36-40`이 raw `SpeechSynthesisUtterance`를 직접 사용(`speakCalmly` 우회).

### 관련 파일/경로
- `src/components/{Button3D,FeedbackTray}.tsx`
- `src/features/lessons/exerciseTypes/{MultipleChoiceMeaning,PictureChoice,TrailSwitchingPractice,StroopTouchPractice,DigitSpanPractice,PairMatching,ShapeCopyPractice,SpeechRepeatPractice}.tsx`
- `src/hooks/useInteractionFeedback.ts`, `src/utils/interactionFeedback.ts`

### 수정 계획
1. **Button3D tap 연결(최대 효과)** `Button3D.tsx`: `useInteractionFeedback` import → `tap()` destructure → onClick 핸들러 시작 부분에서 `tap()` 호출(consumer onClick을 감싸서 먼저 실행). disabled/no-op 가드 유지.
2. **FeedbackTray success 집중화** `FeedbackTray.tsx`: `useEffect`로 variant===`correct`(또는 `correct_feedback`) 마운트 시 `success()` 1회 호출. → 모든 exercise가 `correct_feedback`을 set하기만 하면 정답 반응이 일괄 적용(Exercise별 개별 수정 최소화).
3. **MultipleChoiceMeaning** `:48-58`: 정답 시 `success()` 추가(hint/incorrect는 별도 부드러운 큐 선택). (단 FeedbackTray 집중화로 생략 가능 — 집중화 채택 시 이 항목은 생략.)
4. **PictureChoice** `:31-51`: plain `<button>` → `<ChoiceCard>`로 교체(MultipleChoiceMeaning 패턴) 또는 `tap()`/`success()` 수동 추가.
5. **Trail/Stroop/Digit/Pair/Shape**: 각 touch 버튼 onClick에 `tap()`, 완료/정답 시 `success()`:
   - `TrailSwitchingPractice.tsx`: 노드 onClick `tap()`, trail 완료 시 `success()`.
   - `StroopTouchPractice.tsx`: 색 타일 onClick `tap()`, trial 정답 `success()`.
   - `DigitSpanPractice.tsx`: 숫자 패드 키 onClick `tap()`.
   - `PairMatching.tsx`: 카드 onClick `tap()`, 매치 시 `success()`.
6. **SpeechRepeat calm 음성 통일** `SpeechRepeatPractice.tsx:39-49`: raw `SpeechSynthesisUtterance` → `speakCalmly(phrase, getSpeechLanguage(i18n.language))`. `AudioChoice.tsx:36-40`도 동일. (자동진입 동작은 변경 금지 — 이미 Continue 대기.)
7. **SpeechRepeat 정답 반응** `:67-73`: `correct_feedback` set 시 `success()` 추가(FeedbackTray 집중화와 중복 주의 — 한 쪽만).

### 완료 기준
모든 상호작용이 100~200ms 내 진동/소리/시각 중 ≥1 반응. 정답 시 success 음+진동. SpeechRepeat Continue 대기 유지. 미지원 환경에서 루틴 계속 작동.

---

## SP-5. 음성 우선 회상·말하기 + "듣고 있어요" 명확 표시  ← HL-5 (P1)

### 멘토 요구
말로 편하게. "듣고 있어요" 명확 표시(초록 테두리/파형). 인식 실패해도 녹음/기록으로 안 끊김. 차분한 목소리. 따라 읽기 + 발음 변화 포착. 말 길면 제한.

### 현재 구현 상태 (양호 + 갭)
- **양호**: 음성이 기본 입력. `PersonalMemoryRecall.tsx:176-205` story 모드에서 `SpeechCapturePanel`이 textarea **위**에 렌더(음성 우선). `VerbalFluencyPractice.tsx:196-223`도 패널이 위, 음성 모드 실제 동작. ex_6 프롬프트 `mockExercises.ts:685` = "오늘 또는 어제 있었던 일을 세 문장만…누구와/어디/어떤 기분" — 멘토 핵심과 일치. `SpeechRepeatPractice.tsx:43-46` calm TTS rate 0.92. stop 버튼 명확(`SpeechCapturePanel.tsx:90-108`).
- **갭 1(파형)**: `SpeechCapturePanel.tsx:53-54,76-81` — listening 시 정적 `border-primary-500 ring-4 ring-primary-200` + `animate-pulse` 점 1개. 실시간 멀티바 파형 아님.
- **갭 2(cap)**: `useSpeechCapture.ts:79-135` — `continuous=true`, `interimResults=false`, `durationMs`는 stop/error/end에서 측정만. **자동 stop 없음**(무한 실행). `speech.durationHint`(20초)은 안내 문구만.
- **갭 3(폴백)**: `SpeechCapturePanel.tsx:36-47` 미지원 시 텍스트 입력 안내만. **MediaRecorder/오디오 자산 없음**.
- **갭 4(발음 신호)**: `SpeechRepeatPractice.tsx:56-65` metadata에 phrase/transcript/durationMs/error는 있으나 **target 대비 유사도/발음 비교 없음**.
- **갭 5(메타데이터 누락)**: `PersonalMemoryRecall.tsx:144-157` handleSaveStory가 transcript/summary/cues만 저장, inputMode/durationMs/error는 버림.

### 관련 파일/경로
- `src/features/speech/{useSpeechCapture,SpeechCapturePanel}.tsx`
- `src/features/lessons/exerciseTypes/{SpeechRepeatPractice,PersonalMemoryRecall,VerbalFluencyPractice}.tsx`

### 수정 계획
1. **실시간 파형** `SpeechCapturePanel.tsx:76-81`: 점 1개 → 약 5~7개 세로바(`<span className="h-3 w-1 animate-pulse rounded-full bg-primary-500" style={{animationDelay: `${i*0.12}s`}} />`). 초록 링(`:53-54`)은 유지(단 SP-2 후 초록이 고대비 문제면 amber/ink 테두리로). 가능하면 AnalyserNode+MediaStream으로 실제 진폭 연동(선택).
2. **발화 cap** `useSpeechCapture.ts`: `MAX_DURATION_MS`(예 60000) 정의, `start()`에서 `const maxRef = window.setTimeout(() => stop(), MAX_DURATION_MS)`, stop/error/end에서 `clearTimeout(maxRef)`. durationHint(20초)를 cap과 일치시키거나 cap을 안내값으로.
3. **MediaRecorder 폴백** `useSpeechCapture.ts`: `onerror` 또는 `isSupported=false` 시 `getUserMedia`+`MediaRecorder`로 blob 녹음 → `audioAssetUrl` 노출. metadata에 포함(루틴은 절대 안 끊김 + 오디오 보존).
4. **발음/언어 신호** `SpeechRepeatPractice.tsx:56-65`: `capture.transcript` vs target phrase 토큰 중첩/편집거리로 `pronunciationSimilarity` 산출 → metadata 추가. 세션 누적 delta로 발음 추이(언어 도메인 신호) 보존.
5. **ex_6 메타데이터 저장** `PersonalMemoryRecall.tsx:144-157`: handleSaveStory에 `inputMode: capture.transcript?"speech":"typed"`, `durationMs: capture.durationMs`, `recognitionError: capture.error` 추가 저장(memoryCardStorage 또는 cognitiveRoutineStorage).

### 완료 기준
"듣고 있어요"가 실시간 파형. 발화 maxDurationMs 자동 종료. 미지원/실패 시 오디오 폴백 저장 + 루틴 유지. SpeechRepeat에 발음 유사도 메타데이터. ex_6 음성 메타데이터 보존.

---

## SP-6. 일상생활 콘텐츠 + 요일 루틴 실제 연결  ← HL-6 (P0, 사용자 명시)

### 멘토 요구
건조 숫자/수학/지식(학력 바이어스) → 일상 맥락. 문제 느낌 회피. 요일별 루틴. 단기기억 반복 훈련. CIST 광역 도메인(MMSE 편중 회피).

### 현재 구현 상태 (치명·표면 개편)
- **치명 1(추상 숫자)**: `mockExercises.ts:236-277` `ex_attention` = scenario 포장이지만 실제는 `pattern:[12,10,8]`(`:262`), options 4/5/6/7, 정답 6(`:263-268`). scenarioBody(`:253-254`)가 "감 12개…10개…8개"로 숫자 수열을 옮긴 것. 멘토가 지적한 "12,10,8 다음 숫자" 그 자체.
- **치명 2(역방향 작업기억)**: `mockExercises.ts:278-310` `ex_digit_span` = `digits:["4","8","2"]`, `direction:"backward"`(`:300`), 정답 `[2,8,4]`(`:303`). MMSE식 역방향. scenarioBody "버스 번호 482…거꾸로"(`:283`).
- **치명 3(사자성어 지식)**: `mockExercises.ts:158-234,469-542` `ex_2/3/4/5/ex_audio` = 고진감래/일석이조/동문서답 의미·매칭·오디오. 순수 학력/지식, scenario/domain 없음, **매 세션 등장**.
- **치명 4(요일 미연결)**: `dailyRoutinePlan.ts:18-26` 요일 계획 양호(0/6=review, 1=attention, 2=memory, 3=language, 4=dailyFlow, 5=moodSocial). 그러나 `sessionBuilder.ts:34-62` `buildDailySessionExercises`가 `getDailyRoutinePlan()`/`payload.domain`/`recommendedDays` **전부 무시** → 전체 배열을 `slice(0, MAX_NORMAL_SESSION=8)`. **모든 날 같은 순서**. `HomeScreen.tsx:20,40-42`는 오늘 라벨만 표시(표면).
- **갭 5(Stroop 색 의존 + 거짓 폴백)**: `mockExercises.ts:420-468` `ex_stroop_touch` = `word:파랑 inkColor:red`(`:446-448`). scenarioBody(`:438-439`) "색이 잘 안 보이면 글자로 된 색 이름도 함께 표시돼요" 약속. 그러나 `StroopTouchPractice.tsx:192-202`는 word를 잉크색 텍스트로만 렌더(**텍스트 폴백 구현 안 됨**).
- **갭 6(Trail 색 의존)**: `TrailSwitchingPractice.tsx:176-178` group 구분 = number `border-blue-400 bg-blue-50` vs symbol `border-green-500 bg-green-50`(색 단독 구분 + SP-2 저명도 청/녹).
- **양호**: `SequenceOrder` `mockExercises.ts:493-517` 일상 순서(아침 인사/회상/정원 물). 단 '세 단어 기억하기'가 lesson 내부 단계 섞임. `types.ts:56-97` ExercisePayload에 domain/recommendedDays/scenarioTitle/scenarioBody/benefitCopy 존재(데이터층 준비됨, 미사용).
- **정합성**: `types.ts` `RoutineDomain`에 `review` 없음 ↔ `dailyRoutinePlan`은 review 포함(어휘 불일치).

### 관련 파일/경로
- `src/data/mockExercises.ts`, `src/data/dailyRoutinePlan.ts`
- `src/features/lessons/sessionBuilder.ts`
- `src/features/lessons/exerciseTypes/{AttentionPattern,DigitSpanPractice,TrailSwitchingPractice,StroopTouchPractice,SequenceOrder,types}.tsx`

### 수정 계획
1. **ex_attention 재작성** `mockExercises.ts:236-277`: 추상 수열 제거. TO prompt "사과 9개가 있는데 이웃에게 2개 드리면 몇 개 남을까요?" options [5/6/7/8] 정답 7. 또는 일상 세기(벽 액자 수, 식탁 접시). scenarioTitle/benefitCopy 유지.
2. **ex_digit_span 전환** `:278-310`: `direction:"backward"` → 순방향 반복/확인("버스 번호 482를 그대로 다시 눌러볼게요"). 역방향은 초기 난이도에서 제거(단기기억=반복 훈련 정합).
3. **사자성어 과제 처리** `:158-234,469-542`: `ex_2/3/4/5/ex_audio`를 일일 세션에서 **제외**(또는 일상 표현 사용으로 전환 + domain/scenario 추가). 지식 바이어스 제거.
4. **요일 계획 연결(핵심)** `sessionBuilder.ts:34-62`: `getDailyRoutinePlan(now)`로 오늘 domain 획득 → `payload.domain === todayPlan.domain`(또는 `recommendedDays.includes(now.getDay())`)인 exercise 우선 필터/재정렬. 매칭 없으면 기존 slice 폴백. → recommendedDays/domain이 활성 데이터.
5. **RoutineDomain 정합** `types.ts:56-97`: `RoutineDomain`에 `review` 추가(또는 매핑)하여 sessionBuilder 필터가 단일 어휘 사용.
6. **Stroop 텍스트 폴백 구현** `StroopTouchPractice.tsx:192-202`: 잉크색 word와 함께 색 이름 텍스트 라벨(또는 aria-label)을 항상 렌더 → 색각 없이도 해결 가능. scenarioBody 약속 이행.
7. **Trail 색 의존 제거** `TrailSwitchingPractice.tsx:176-178`: number/symbol 구분을 색 대신 **모양+라벨+아이콘**(number=사각+숫자, symbol=둥근+아이콘)로. SP-2 웜 체계 정합.
8. **SequenceOrder 정제** `mockExercises.ts:493-517`: '세 단어 기억하기'(lesson 내부) → 순수 일상(밥 먹기/설거지/산책/전화)로 교체.

### 완료 기준
`ex_attention`/`ex_digit_span` 구체 일상. 사자성어가 일일 세션에서 제외/전환. 요일마다 다른 domain이 sessionBuilder로 실제 선택. Stroop 텍스트 폴백 구현. Trail 색 단독 구분 제거.

---

## SP-7. 켜자마자 오늘 루틴 + 단일 CTA + 짧은 온보딩  ← HL-7 (P0, 사용자 명시 1순위)

### 멘토/사용자 요구
키자마자 바로 오늘 루틴 실행. 딱 누르면 그날 할 것만. 메뉴 헤매지 않게. 기능 숨기기. "부족하다" 내부만. 자동로그인/프로필 자동 적용.

### 현재 구현 상태 (치명)
- **치명 1(자동시작 없음)**: `App.tsx:25-47` 라우트만 렌더, useEffect/프로필 읽기/`/lesson` 자동이동 **전무**. 유일 redirect는 catch-all `* → /`(`App.tsx:40`). 런치 항상 Home.
- **치명 2(죽은 플래그)**: `learnerProfileStorage.ts:14,16,25-27` `autoStartTodayRoutine:false`·`onboarded:false` 정의. 그러나 grep 결과 **읽는 곳 0**(soundFeedbackEnabled만 useInteractionFeedback에서 읽음). 자동시작 불가.
- **치명 3(단일 CTA 아님)**: `HomeScreen.tsx:9-15` 5노드 `mockPathNodes`(locked/family_memory/current/completed/completed) 세로 지그재그 경로. `:22-28` handleNodePress/handleContinue 둘 다 `navigate('/lesson')`(경로 노드와 CTA가 동일 → 경로는 시각 잡음만). `:47-59` advisory 카드 + MascotBubble 복수 섹션이 시작 액션과 경쟁.
- **치명 4(first-run 없음)**: `/onboarding` 라우트·onboarded 검사·Welcome 화면 없음.
- **치명 5(자동 적용 없음)**: `learnerProfile` localStorage를 런치에 읽지 않음. currentProfile/lastLearner 개념 없음. 언어(`memoryGardenLang`)만 i18n에서 읽음.
- **양호**: `HomeScreen.tsx:40-42` 오늘 라벨 "오늘은 {{name}} 날이에요" 정확. `dailyRoutinePlan.ts` 단일 루틴/일 지원. `learnerProfileStorage.ts:1-3` 주석 "nothing here ever implies a deficit"(의도 양호). `AppShell.tsx:10-13` `/lesson`·`/result`에서 nav 숨김(양호, 단 Home은 nav 3개 노출).
- **Settings 양호**: `SettingsScreen.tsx:20-107` 언어+데이터 삭제만(커스터마이징 숨김 정합), 단 auto-start 켤 곳 없음.

### 관련 파일/경로
- `src/App.tsx`, `src/components/AppShell.tsx`
- `src/app/home/HomeScreen.tsx`, `src/app/settings/SettingsScreen.tsx`
- `src/features/profile/learnerProfileStorage.ts`

### 수정 계획
1. **런치 자동시작** `App.tsx`: useEffect로 `getLearnerProfile()` 읽기. `autoStartTodayRoutine===true` && 현재 경로 `/` && 오늘 루틴 미완료 시 `<Navigate to="/lesson" replace/>`(또는 Home 내부에서 자동 navigate). 0탭 진입. 플래그 off면 Home 유지.
2. **Home 단일 CTA 축소** `HomeScreen.tsx:9-59`: `mockPathNodes` 5노드 경로 + LessonNode map **제거**, advisory 카드 제거. TO: 오늘 라벨(`:40-42`) + 단일 전폭 `Button3D xl` "오늘 루틴 시작하기"(`continueButton`) → `navigate('/lesson')`. MascotBubble greeting은 유지 가능(단일 CTA를 방해하지 않는 한).
3. **first-run 게이트** `App.tsx`: `!getLearnerProfile().onboarded` 시 짧은 온보딩(2~3단계: 언어 / 글자 크게 / 말하기 vs 누르기) → `saveLearnerProfile({onboarded:true})` 후 진행. 긴 설문 금지.
4. **플래그 활성화** `learnerProfileStorage.ts`: `autoStartTodayRoutine` 기본값 `false` → `true`(단일 사용자 기기 가정). App가 런치 시 learnerProfile 읽어 preferredInputMode/largeTextMode/kioskModePreferred/soundFeedbackEnabled 자동 적용(마지막 프로필).
5. **Settings 토글** `SettingsScreen.tsx`: 비임상 "시작할 때 바로 오늘 루틴 열기" 토글 → `autoStartTodayRoutine` saveLearnerProfile(deficit 프레이밍 없음).
6. **Home nav(선택)** `AppShell.tsx`: 오늘 루틴 대기 중 Home에서 BottomNavigation을 숨기거나 항목 축소(단일 CTA 강조).

### 완료 기준
`autoStartTodayRoutine=true` 시 런치 0탭 `/lesson`. Home 단일 CTA(경로/다중 카드 없음). `onboarded` false 시 짧은 first-run. 런치 시 프로필 자동 적용. 플래그가 더 이상 죽은 코드 아님.

---

## SP-8. 지속 참여 보상 + 마스코트 칭찬  ← HL-8 (P1)

### 멘토 요구
점수보다 연속/참여/주간 작은 보상. 자랑 카드(리더보드 X). 캐릭터 칭찬. 뇌 활성화 메시지.

### 현재 구현 상태 (양호 + 갭)
- **양호**: 점수 미노출. `ResultScreen.tsx:43-61` streak(Flame)+물방울+WeeklyRewardCard. raw 점수 없음. `WeeklyRewardCard.tsx:9-10` "Never ranks the learner against others". `GardenScreen.tsx` 리더보드 없음. `useGamification.ts:59-62` completeSession = streak + `addGardenReward('session_complete')`(물방울+1).
- **치명(카탈로그 죽음)**: `weeklyRewards.ts:24-43` `REWARD_CATALOG`(garden_sticker/welfare_coupon/praise_card)가 **어떤 UI도 import 안 함**(weeklyRewards.test.ts만). `claimedRewardIds` push 안 됨. `recordWeeklyCompletion` Result에서 호출 안 됨(`ResultScreen.tsx:14-22`). WeeklyRewardCard 카운트는 `getCompletedDaysThisWeek(getCognitiveRoutineResults())` 별도 산출.
- **갭(i18n 누락)**: `ko.json:56-61` weekly에 title/completedDays/catalogNote/bragCard만. **`weekly.catalog.*`(stickerTitle/Body, couponTitle/Body, praiseTitle/Body) 3 locale 전부 없음** → 렌더해도 raw key.
- **갭(자랑 카드 UI 없음)**: `weekly.bragCard`(ko "이번 주 기억 루틴 {{count}}일 완료") 3 locale에 존재하나 **참조 컴포넌트 0**.
- **갭(마스코트 칭찬 없음)**: `ResultScreen.tsx:1-70` MascotBubble import 안 함. MascotBubble은 Home(`:75` encouraging)/Lesson(`:95` calm)만. 완료 순간 칭찬 없음.
- **갭(이벤트 미발생)**: `useGamification.ts` addReward가 memory_review/family_photo_review/weekly_completion/streak_milestone 지원(`gardenProgress.ts:19-35`)하나 **UI에서 발생 0**(completeSession은 flat +1만). `rewards.ts:1-20` calculateExerciseReward/calculateSessionCompletionReward 죽은 코드(test만).

### 관련 파일/경로
- `src/app/result/ResultScreen.tsx`, `src/app/garden/GardenScreen.tsx`
- `src/components/{WeeklyRewardCard,MascotBubble}.tsx`
- `src/features/gamification/{weeklyRewards,useGamification,gardenProgress,rewards}.ts`
- `src/locales/{ko,en,ja}.json`

### 수정 계획
1. **카탈로그 i18n 추가** 3 locale weekly에 `catalog.{stickerTitle,stickerBody,couponTitle,couponBody,praiseTitle,praiseBody}`.
2. **WeeklyRewardCard 카탈로그 렌더** `WeeklyRewardCard.tsx:9-35`: catalogNote 단일 줄 → `REWARD_CATALOG` 아이템(스티커/쿠폰/칭찬 카드) + 수령 표시(`claimedRewardIds`). 구체 복지 실물 보상 토큰(예 쓰레기봉투 교환권) 추가(운영기관 설정 표시).
3. **주간 보상 상태 연결** `ResultScreen.tsx:14-22`: completeSession effect에서 `recordWeeklyCompletion()` 호출. `claimedRewardIds`를 WeeklyRewardCard 수령 UI에 연결.
4. **자랑 카드 UI** `WeeklyRewardCard.tsx`: `weekly.bragCard`(count 보간)로 공유/저장 가능 자랑 카드 렌더 + 공유 버튼(Web Share API, 미지원 시 클립보드 복사).
5. **Result 마스코트 칭찬** `ResultScreen.tsx`: 신규 키 `result.mascotPraise`(ko "오늘도 멋지게 해내셨어요! 뇌가 한 뼘 더 깨었어요.") + `<MascotBubble mood="praising" message={t("result.mascotPraise")} />`(SP-3 praising 상태 필요).
6. **보상 이벤트 발생** `useGamification.ts`: 7일 윈도 완료 시 `addReward('weekly_completion')`, streak N 도달 시 `addReward('streak_milestone')`(gardenProgress의 treeLevel+1). RewardEvent가 활성화.
7. **rewards.ts 처리**: `calculateExerciseReward`/`calculateSessionCompletionReward`를 보상 흐름에 연결하거나 **삭제**(점수형 보상은 "점수 불필요" 정합성 위반 → 삭제 권장).

### 완료 기준
주간 보상 카탈로그 렌더 + 수령. 자랑 카드 UI. Result에 마스코트 칭찬. `weekly_completion`/`streak_milestone` 발생. raw 점수 미노출 유지. 죽은 rewards.ts 정리.

---

## SP-9. 보호자/상담사 정보 분리 강화 + 치매안심센터 자원 카드  ← HL-9 (P1)

### 멘토 요구
보호자 raw 사실/점수 과잉 금지(불안). 보호자 = 독려+대화 준비+치매안심센터(대표 전화·홈페이지). 상담사 = 구체적 사실(점수 아님). advisory는 단일 결과로 needsConversation 금지(반복/복합만).

### 현재 구현 상태 (양호 + 갭)
- **양호**: `FamilyScreen.tsx:62` 기본 탭 `"family"`(보호자). `familySupportSummary.ts:1-4,23-33` 의도적 경량화(raw count/error/반응시간 미노출, completedThisWeek/attemptedThisWeek/shareableMemoryCount/conversationStarters/encouragement/showSupportResource 노출). `haruAdvisory.ts:241-261` 단일 루틴 결과는 watch만(ratio<0.4/<0.7 → weight 1), needsConversation 금지(보수적, 양호). `FamilyScreen.tsx:608-626` activityHighlights(단어 수/자릿수/오류/반응시간)는 **counselor 탭에서만**. `haruAdvisory.ts:134` `weightedTotal>=4 || hasConversationSignal` → needsConversation.
- **갭 1(보호자가 상담사 report 읽음)**: `FamilyScreen.tsx:272-293` 보호자 탭 metric 타일이 `report.routineTrend.completedThisWindow`/`report.overview.lastPracticeDate`/`report.dueMemoryCount`/`report.shareableMemoryCount` = **상담사 report 객체**에서 읽음(familySummary 아님). raw 점수는 아니지만 사실 report 경유.
- **치명 2(단일 관찰 즉시 needsConversation)**: `haruAdvisory.ts:394` `response==="oftenDifferent" ? "needsConversation" : "watch"` → caregiver 관찰 1건 oftenDifferent가 **즉시 needsConversation**(weight 2). `deriveOverallLevel`이 needsConversation 하나라도 있으면 전체 needsConversation. → 자원 카드까지 점등.
- **치명 3(자원 카드 단일 샷)**: `familySupportSummary.ts:96-98` `advisoryLevel==="needsConversation"` → `showSupportResource=true`(무조건). 갭 2 때문에 단일 관찰로 자원 카드 점등 → "반복 걱정" 위반. `:100-107` ≥2 oftenDifferent(30일) 분기도 있으나 needsConversation 단락이 먼저.
- **갭 4(자원 비어 있음)**: `supportResources.ts:26-36` catalog **의도적 비어 있음**(placeholder 생략). `getVerifiedSupportResources`가 `lastVerifiedAt && sourceUrl` 필터 → 항상 빈 배열 → SupportResourceCard가 항상 `support.pending` placeholder. `FamilyScreen.tsx:325-327` 보호자 탭에서만, `showSupportResource`일 때만 렌더.

### 관련 파일/경로
- `src/app/family/FamilyScreen.tsx`
- `src/features/family/{haruAdvisory,familySupportSummary,caregiverReport}.ts`
- `src/data/supportResources.ts`, `src/components/SupportResourceCard.tsx`

### 수정 계획
1. **보호자 탭 familySummary 사용** `FamilyScreen.tsx:272-293`: `report.routineTrend.completedThisWindow` → `familySummary.completedThisWeek`; `report.shareableMemoryCount` → `familySummary.shareableMemoryCount`; dueMemoryCount/lastPracticeDate는 familySummary로 이동하거나 제거. 보호자 탭에서 상담사 report 의존 제거.
2. **advisory 보수화** `haruAdvisory.ts:394`: 단일 oftenDifferent → `"watch"`(weight 1)로 강등. needsConversation은 caregiver 관찰이 **≥2건 oftenDifferent**(또는 ≥2 도메인)일 때만. 멘토 "단일 결과로 needsConversation 금지" 이행.
3. **자원 카드 반복 걱정 게이트** `familySupportSummary.ts:96-98`: `advisoryLevel==="needsConversation"` 무조건 단락 제거. TO: needsConversation **AND** 30일 내 ≥2건 oftenDifferent 관찰. "반복 걱정" 정합.
4. **치매안심센터 자원 입력** `supportResources.ts:26-36`: catalog에 ≥1건 `dementiaSafetyCenter`(대표 전화 + 홈페이지 + `lastVerifiedAt` ISO + `sourceUrl`) 입력. 출처: 한국치매안심센터 통합정보시스템 등 공식. **미검증 데이터 하드코딩 금지** — lastVerifiedAt/sourceUrl 없으면 표시 안 함(pending 유지).
5. **테스트** `FamilyScreen.test.tsx`·`haruAdvisory.test.ts`: 보호자 탭 raw metric 숨김, 단일 oftenDifferent → watch, 자원 카드 반복 걱정 게이트 검증.

### 완료 기준
보호자 탭이 familySummary만 표시. 단일 oftenDifferent로 needsConversation/자원 카드 미발생. 치매안심센터 자원이 검증 데이터와 표시(미검증 시 미표시).

---

## SP-10. [범위 밖] 키오스크 / 복지관 / 일본 / 임상  ← HL-10 (이번 app 구현 제외)

### 처리 원칙
이하 파일들은 **이미 라우트/import에 연결되어 있어 삭제 불가**. 이번 app 구현 작업에서는 **수정하지 않고 그대로 둔다**. 별도 과제로만 다룬다.

### 현재 연결 상태 (검증 완료)
- `/kiosk` 라우트: `App.tsx:13` lazy import, `App.tsx:32` `<Route path="/kiosk" element={<KioskHomeScreen/>}/>` — standalone, AppShell 외부. **연결됨**.
- `KioskHomeScreen.tsx:5,6,14,20`: `getDailyRoutinePlan`(dailyRoutinePlan), `useKioskControls` 사용 — **연결됨**.
- `dailyRoutinePlan.ts`: Home(`HomeScreen.tsx:7,20`) + Kiosk 둘 다 사용 — **이중 활성**(삭제 절대 금지, SP-6에서 Home/sessionBuilder 쪽만 수정).
- `familySupportSummary.ts`(`FamilyScreen.tsx:26-27,83`) + `supportResources.ts`(`FamilyScreen.tsx:28,89`, `SupportResourceCard` `:326`): `/family`에서 사용 — **연결됨**.

### 알려진 결함(별도 표시, 이번엔 수정 안 함)
- **KioskHomeScreen i18n 누락(치명 but app 본루틴과 무관)**: `KioskHomeScreen.tsx:47,49`가 `t("routine.startButton")` 호출 → `routine` namespace에 `startButton` 키 **3 locale 전부 없음**(`routine.todayLabel/attentionDay/.../fallback`만 존재) → kiosk 시작 버튼이 raw key "routine.startButton" 표시. 키오스크를 다시 손댈 때 3 locale `routine`에 `startButton` 추가(ko "오늘 루틴 시작하기" 등). app 본루틴과 무관하므로 **이번에는 별도 표시만**.

### 별도 과제 문서
- 복지관 운영자 대시보드/하이브리드: `docs/welfare-center-hybrid-plan.md`
- 일본 현지 보상/캐릭터/기관: `docs/japan-localization-research-plan.md` (일본어 i18n은 SP-1/SP-8 한국 변경사항과 동기화만)
- 식약처/의료기기 분류·임상 검증: app 카피 비의료 유지(SP-1), 본격 검증은 별도 설계.

---

## 부록 A. 추천 작업 순서

1. **SP-2**(고대비 토큰·Button3D·Home/LessonNode/Result) — 시각 기반이라 먼저. 이후 모든 className이 웜 체계 정합.
2. **SP-7**(런치 자동시작 + Home 단일 CTA + first-run) — 사용자 1순위, 진입 경로 재구성.
3. **SP-4**(Button3D tap + FeedbackTray success 집중화) — SP-2 후 Button3D 한 번에.
4. **SP-6**(콘텐츠 재작성 + sessionBuilder 요일 연결 + 사자성어 제거) — 데이터/로직.
5. **SP-3**(글자 하한선 + ChoiceCard 선택 강화 + 터치 타겟 + MascotBubble praising).
6. **SP-5**(음성 파형 + cap + 폴백 + 발음 신호).
7. **SP-1**(동기부여 카피 + copySafety 확장).
8. **SP-8**(주간 보상 카탈로그 + 자랑 카드 + Result 마스코트 칭찬).
9. **SP-9**(보호자 탭 분리 + advisory 보수화 + 치매안심센터 자원).
10. SP-10 — 제외/별도.

## 부록 B. 검증

매 단계: `npm run typecheck && npm run lint && npm test && npm run build`.
추가:
- 대비 수치(SP-2): primary/secondary/danger AA(4.5:1, 큰 텍스트 3:1) 단정.
- 피드백(SP-4): Button3D/ChoiceCard/Trail/Stroop/Digit/Pair/Picture의 tap/success 호출 단정.
- 콘텐츠(SP-6): 요일 domain이 sessionBuilder에서 선택됨, 사자성어 과제 제외됨 단정.
- 자동시작(SP-7): autoStartTodayRoutine 시 `/lesson` 진입, Home 단일 CTA 단정.
- 카피(SP-1): `result.encouragement` 존재 + `support`/`family` GLOBAL_BANS.
- 보호자(SP-9): 단일 oftenDifferent → watch, 자원 카드 반복 게이트.
- Playwright 스크린샷(ko/en/ja)으로 raw i18n key/대비 시각 확인.
