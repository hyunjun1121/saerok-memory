# SP-06 — 일상생활 콘텐츠 재작성 + 요일 루틴 sessionBuilder 실제 연결 + 사자성어 제거/전환

> **AXIS 고정**: 본 파일은 실행 워크플로. 방향·우선순위·수용기준은 `high_level_plan.md` 의 HL-6 와 `specifie_plan.md` 의 SP-06 에 고정된다. 본 파일에서 새 범위를 추가하지 않는다.

| 우선순위 | 의존(선행 SP) | 터치 파일 | 미터치(HL-10) |
|---|---|---|---|
| P0 | 없음(데이터/로직 독립) | `src/data/mockExercises.ts`, `src/features/lessons/sessionBuilder.ts`, `src/features/lessons/exerciseTypes/StroopTouchPractice.tsx`, `src/features/lessons/exerciseTypes/TrailSwitchingPractice.tsx`, `src/features/lessons/exerciseTypes/types.ts`(선택) | 키오스크 `/kiosk`/`KioskHomeScreen`, `dailyRoutinePlan.ts` 구조, 복지관대시보드, 일본, 임상 |

## 0. 목표

`ex_attention`을 추상 숫자 수열(12→10→8)에서 구체 일상 give/take("사과 9개에서 2개 드리면?")로 재작성하고, `ex_digit_span`을 MMSE식 역방향 작업기억(`482→284`)에서 순방향 반복/확인으로 전환한다. 사자성어(고진감래/일석이조/동문서답) 지식 과제를 일일 세션에서 제외/전환하고, `sessionBuilder.buildDailySessionExercises`에 `getDailyRoutinePlan()`(오늘 도메인)을 연결해 요일마다 다른 루틴이 실제로 선택되게 한다. Stroop에 색 이름 텍스트 폴백을 시각적으로 구현하고, Trail의 number/symbol 구분에서 색 단독 의존을 제거한다. 공식 MMSE/MoCA/CIST 문항·컷오프는 복제하지 않는다.

## 1. 현재 구현 (소스 재확인 결과)

- **추상 숫자(치명 1)**: `src/data/mockExercises.ts:262` `pattern: [12, 10, 8]`, `:263-268` options 4/5/6/7, `:270` 정답 `opt_3`(6). `:252-256` scenarioBody가 "감 12개…10개…8개"로 숫자 수열을 옮긴 것. `AttentionPattern.tsx:82-92`는 pattern 배열을 `text-4xl`로 나열하고 다음 칸 `?`를 렌더 — 수열 추론 UI 그 자체.
- **역방향 작업기억(치명 2)**: `mockExercises.ts:300` `digits: ["4","8","2"]`, `:301` `direction: "backward"`, `:303` `correctAnswer: ["2","8","4"]`. `:283-285` prompt "버스 번호 482를…거꾸로 눌러볼게요". `DigitSpanPractice.tsx:45` `expectedDigits = direction === "backward" ? [...digits].reverse() : digits`.
- **사자성어 지식(치명 3)**: `mockExercises.ts:158-183` `ex_2`(고진감래 뜻), `:184-208` `ex_3`(고진감래 상황), `:209-234` `ex_4`(일석이조 뜻), `:469-492` `ex_5`(사자성어 pair_matching), `:518-542` `ex_audio`(고진감래 듣고 고르기). 전부 학력/지식, `domain`/`recommendedDays` 없음 → 매 세션 등장(현재 sessionBuilder가 전체 배열을 slice하므로).
- **요일 미연결(치명 4)**: `src/features/lessons/sessionBuilder.ts:34-62` `buildDailySessionExercises`는 `getDailyRoutinePlan()`을 import조차 하지 않음. `:40` `[...exercises]` 복사 → `:61` `session.slice(0, MAX_NORMAL_SESSION=8)`만. `src/data/dailyRoutinePlan.ts:18-26` 요일 계획은 양호하나 `payload.domain`/`recommendedDays`를 아무도 읽지 않음. `src/app/lesson/LessonScreen.tsx:22-28`가 `buildDailySessionExercises({exercises: mockExercises, ...})` 호출. `HomeScreen.tsx:20`는 `getDailyRoutinePlan()`으로 오늘 라벨만 표시.
- **Stroop 텍스트 폴백 미구현(갭 5)**: `mockExercises.ts:437-441` scenarioBody "색이 잘 안 보이면 글자로 된 색 이름도 함께 표시돼요" 약속. 그러나 `StroopTouchPractice.tsx:190-203`은 `currentTrial.word`를 `COLOR_CLASSES[inkColor].text`(잉크색 텍스트)로만 렌더. 시각적 색 이름 라벨은 없음(`aria-label`만 존재 `:197-199`).
- **Trail 색 의존(갭 6)**: `TrailSwitchingPractice.tsx:176-178` node className = number `border-blue-400 bg-blue-50 text-blue-900` vs symbol `border-green-500 bg-green-50 text-green-900`. legend(`:133-143`)는 Hash/Image 아이콘+텍스트로 보조하지만, 노드 자체는 색으로 구분(SP-2 저명도 청/녹).
- **RoutineDomain 어휘 불일치**: `types.ts:56-62` `RoutineDomain` = memory/attention/language/dailyFlow/visuospatial/moodSocial(`review` 없음). `dailyRoutinePlan.ts:4-10` `RoutineDayDomain` = attention/memory/language/dailyFlow/moodSocial/**review**. sessionBuilder가 도메인 매칭을 하려면 `review` 매핑이 필요.
- **SequenceOrder '세 단어 기억하기' 혼입**: `mockExercises.ts:505` `step_2` label "세 단어 기억하기"가 일상 순서 아이템에 섞여 lesson 내부 단계 느낌.
- **정합성(양호)**: `types.ts:91-96` ExercisePayload에 `domain`/`recommendedDays`/`scenarioTitle`/`scenarioBody`/`benefitCopy` 존재(데이터층 준비됨). `ex_attention`(`:245-246`), `ex_digit_span`(`:288-289`), `ex_trail_switching`(`:390-391`), `ex_stroop_touch`(`:430-431`) 등은 이미 domain/recommendedDays 보유 → sessionBuilder 연결 시 즉시 활성.
- **공유 파일 주의**: `dailyRoutinePlan.ts`는 Home(`HomeScreen.tsx:7,20`) + Kiosk(`KioskHomeScreen.tsx:5,14`) 둘 다 사용. **구조/요일 매핑은 건드리지 않고** sessionBuilder 쪽 소비 + mockExercises 데이터 필드만 수정.

## 2. 전제 / 선행 작업

- 의존 SP: 없음. SP-06은 데이터(`mockExercises.ts`)와 로직(`sessionBuilder.ts`) + 두 컴포넌트 시각만 다룬다.
- **공유 파일 조정**: `dailyRoutinePlan.ts`는 수정하지 않는다(Home+Kiosk 이중 활성, HL-10). `mockExercises.ts`의 `domain`/`recommendedDays` 필드만 채우거나 sessionBuilder에서 소비한다.
- `sessionBuilder.test.ts:30-67` 기존 3개 단정(warm-up first, due card 삽입, capture 무제한 slice)이 깨지지 않게 폴백을 유지한다.
- 공식 MMSE/MoCA/CIST 문항·컷오프 복제 금지. give/take·순방향 반복은 Haru 오리지널 일상 프레이밍.

## 3. 작업 워크플로

### Step 1 — `ex_attention` 추상 수열 → 구체 give/take 재작성
- 파일: `src/data/mockExercises.ts:236-277`
- FROM: `pattern: [12, 10, 8]` + options 4/5/6/7 + 정답 `opt_3`(6) + prompt/scenarioBody "감 … 12/10/8" 수열
- TO: prompt `"사과 9개가 있는데 이웃에게 2개 드리면 몇 개가 남을까요?"`, `pattern` 필드 제거(또는 일상 세기 `count`로 대체), options `5/6/7/8`, 정답 `opt_3`(7). scenarioTitle "나눠 드리기" 유지, scenarioBody → "처음에 사과 9개, 이웃에게 2개 나눠 드렸어요." benefitCopy 유지. `AttentionPattern.tsx:82-92` 수열 UI(`pattern.map` + `?`칸)는 give/take에 맞지 않으므로 scenarioBody 중심 단일 질문 표시로 단순화(또는 `pattern` 옵셔널 처리 후 해당 블록 조건부 렌더). `domain:"attention"`/`recommendedDays:[1,6]` 유지.
- verify: `npm run typecheck && npm test -- AttentionPattern`
- checkpoint: `git add -A && git commit -m "SP-06: rewrite ex_attention to concrete give/take"`

### Step 2 — `ex_digit_span` 역방향 → 순방향 반복 전환
- 파일: `src/data/mockExercises.ts:278-310`
- FROM: `digits: ["4","8","2"]`, `direction: "backward"`, `correctAnswer: ["2","8","4"]`, prompt "버스 번호 482를…거꾸로 눌러볼게요"
- TO: `direction: "forward"`, `correctAnswer: ["4","8","2"]`(digits와 동일), prompt `"버스 번호 482를 천천히 기억한 뒤, 그대로 다시 눌러볼게요."`. scenarioBody는 "전광판에 잠깐 뜬 번호를 확인하는 일상 장면" 유지. `DigitSpanPractice.tsx:45`는 forward 분기(`digits` 그대로)를 이미 지원하므로 로직 변경 불필요 — 데이터만 전환. 단기기억=반복 훈련 정합. `domain:"memory"`/`recommendedDays:[2,4]` 유지.
- verify: `npm run typecheck && npm test -- DigitSpan`
- checkpoint: `git add -A && git commit -m "SP-06: switch ex_digit_span to forward repeat"`

### Step 3 — 사자성어 과제 일상 표현으로 전환(지식 바이어스 제거)
- 파일: `src/data/mockExercises.ts:158-234, 469-542` (`ex_2`, `ex_3`, `ex_4`, `ex_5`, `ex_audio`)
- FROM: 고진감래/일석이조/동문서답 의미·상황·매칭·오디오(순수 학력/지식, `domain`/`recommendedDays` 없음)
- TO: 각 과제를 일상 표현으로 교체 + `domain`/`recommendedDays` 부여. 예:
  - `ex_2`(multiple_choice_meaning) → prompt `"이른 아침에 이웃에게 건네기 좋은 말은?"`, options [안녕하세요/잘 가세요/맛있게 드세요/고맙습니다], 정답 안녕하세요, `domain:"language"`, `recommendedDays:[3,5]`.
  - `ex_3`(situation_match) → 일상 상황(시장/산책/전화) 매칭으로 교체, `domain` 부여.
  - `ex_4` → 일상 표현 뜻 매칭, `domain` 부여.
  - `ex_5`(pair_matching) → 일상 행동과 상황 연결(예: "밥 먹기"↔"식탁", "전화"↔"가족 목소리"), `domain` 부여.
  - `ex_audio`(audio_choice) → 일상 감각 표현(예: "시원하다"/"따뜻하다") 듣고 고르기, `domain` 부여.
  사자성어 한자/의미 전부 제거. 공식 문항이 아니므로 자유 일상 표현 가능.
- verify: `npm run typecheck && npm run lint && npm test`
- checkpoint: `git add -A && git commit -m "SP-06: replace idiom-knowledge tasks with everyday expressions"`

### Step 4 — `sessionBuilder`에 `getDailyRoutinePlan` 연결(요일 도메인 필터/재정렬) — 핵심
- 파일: `src/features/lessons/sessionBuilder.ts:1-2, 34-62`
- FROM: import에 `getDailyRoutinePlan` 없음; `:40` `const session = [...exercises]`; `:61` `return session.slice(0, MAX_NORMAL_SESSION)` — 오늘 도메인 무시, 모든 날 같은 순서
- TO:
  - `:1-2` import 추가: `import { getDailyRoutinePlan, type RoutineDayDomain } from "../../data/dailyRoutinePlan";`
  - `buildDailySessionExercises` 본문(`:40` 이후, capture slice 이전)에 요일 기반 정렬 삽입:
    - `const todayPlan = getDailyRoutinePlan(now);`
    - `review` 도메인은 도메인 필터 없이 전체 유지(복습); 그 외 도메인은 `payload.domain` 또는 `recommendedDays?.includes(now.getDay())` 기준으로 today-matching 우선 정렬(안정 정렬: 매칭 항목을 앞으로, 비매칭은 원래 순서).
    - 매칭 항목 수가 0이면 폴백: 원래 배열 순서 유지(기존 동작 보존, `sessionBuilder.test.ts:30-37` warm-up first 단정 유지).
    - warm-up(`session[0]`, ex_1 delayed_word_recall encode)은 항상 첫 위치 유지 — 정렬은 `session.slice(1)`에만 적용 후 앞에 다시 붙임.
  - `now`가 이미 `BuildSessionOptions.now`로 전달됨(`:38` default `new Date()`) → 재사용.
- verify: `npm run typecheck && npm test -- sessionBuilder` (신규 단정: 특정 요일에서 matching domain이 앞에 오는지, warm-up이 첫 위치인지, 매칭 0일 때 폴백 순서 보존)
- checkpoint: `git add -A && git commit -m "SP-06: connect sessionBuilder to daily routine plan (weekday domain)"`

### Step 5 — `RoutineDomain`/`review` 정합(선택, 매핑)
- 파일: `src/features/lessons/exerciseTypes/types.ts:56-62` 및 `src/data/dailyRoutinePlan.ts` 참조
- FROM: `RoutineDomain`(types.ts) = memory/attention/language/dailyFlow/visuospatial/moodSocial — `review` 없음; `RoutineDayDomain`(dailyRoutinePlan)은 `review` 포함
- TO: 두 타입 간 매항이 필요하므로 sessionBuilder 내에서 `RoutineDayDomain`→매칭 로직을 문자열 비교로 처리하거나, `types.ts` `RoutineDomain`에 `"review"`를 추가. 가장 낮은 리스크는 sessionBuilder에서 `todayPlan.domain === "review"`일 때 도메인 필터를 건너뛰는 분기(Step 4에 이미 포함). `review`가 mockExercises의 어떤 항목에도 `domain`으로 할당되지 않으므로 매칭 불가 → 자연스럽게 폴백. 본 step은 Step 4의 분기로 충분하면 병합 가능. `RoutineDomain`에 `"review"`를 추가하려면 `types.ts:56-62` union에 `"review"` 추가 + 영향도 점검.
- verify: `npm run typecheck`
- checkpoint: `git add -A && git commit -m "SP-06: align review domain between types and routine plan"`

### Step 6 — Stroop 텍스트 색 이름 폴백 시각적 구현
- 파일: `src/features/lessons/exerciseTypes/StroopTouchPractice.tsx:190-203`
- FROM: 잉크색 word만 렌더 — `<span className="text-6xl ... COLOR_CLASSES[inkColor].text" aria-label={...}>{currentTrial.word}</span>`
- TO: 잉크색 word 아래에 색 이름 텍스트 라벨을 항상 시각적으로 표시(색각 없이도 해결 가능). 예: word span 아래 `<p className="mt-3 text-xl font-extrabold text-gray-700">{t(\`exercise.cognitive.colors.${currentTrial.inkColor}\`)}</p>` 추가(scenarioBody `:437-441` "글자로 된 색 이름도 함께 표시돼요" 약속 이행). 이미 버튼 영역(`:211-241`)은 색 이름 + swatch로 구성되어 있으므로, 과제 영역에도 색 이름 명시 → 더 이상 색 단독 정보 아님. `aria-label`(`:197-199`)은 유지.
- verify: `npm run typecheck && npm test -- Stroop`
- checkpoint: `git add -A && git commit -m "SP-06: add visible color-name text fallback to Stroop trial"`

### Step 7 — Trail number/symbol 색 단독 의존 제거
- 파일: `src/features/lessons/exerciseTypes/TrailSwitchingPractice.tsx:176-178`
- FROM: number `"rounded-xl border-blue-400 bg-blue-50 text-blue-900"` vs symbol `"rounded-full border-green-500 bg-green-50 text-green-900"` — 청/녹 색으로 그룹 구분(SP-2 저명도 문제 + 색 단독)
- TO: 모양+라벨로 구분. number = 사각 `"rounded-xl border-ink bg-surface-warm text-ink"`(또는 amber 계), symbol = 둥근 `"rounded-full border-orange-500 bg-amber-50 text-ink"`. legend(`:133-143` Hash/Image 아이콘+텍스트)와 정렬. `isDone` 상태(`:180` `border-primary-500 bg-primary-500 text-white`)는 SP-2 후 고대비 토큰으로 교체 권장이나 본 step 범위는 group 구분 색 제거에 한정(완료 표시는 SP-2/SP-3 영역). 노드 내 아이콘(`:184-188` Hash/Image)은 이미 모양 보조이므로 유지.
- verify: `npm run typecheck && npm test -- Trail`
- checkpoint: `git add -A && git commit -m "SP-06: remove color-only group distinction in Trail nodes"`

### Step 8 — SequenceOrder '세 단어 기억하기' → 순수 일상 교체
- 파일: `src/data/mockExercises.ts:493-517`
- FROM: `:505` `step_2` label "세 단어 기억하기"(lesson 내부 단계 혼입)
- TO: 일상 행동으로 교체 — 예 "밥 먹기" / "설거지하기" / "가볍게 산책하기" / "가족에게 전화하기" 중 하나. 전체 4단계가 자연스러운 하루 흐름이 되도록 정렬(`correctOrder`도 교체에 맞춰 조정). `SequenceOrder.tsx` 로직 변경 불필요.
- verify: `npm run typecheck && npm test -- SequenceOrder`
- checkpoint: `git add -A && git commit -m "SP-06: replace lesson-internal word-memory step in SequenceOrder"`

## 4. 단계별 테스트

- 공통: 매 step 후 `npm run typecheck && npm run lint && npm test && npm run build`.
- SP-06 전용 단정(기존 `src/features/lessons/sessionBuilder.test.ts:25-67` 확장):
  - 신규 단정: 특정 요일(예 월요일=`getDay()===1` → attention)에서 attention `domain` 과제가 비attention 과제보다 앞에 정렬되는지.
  - warm-up(`ex_1`)이 요일 정렬 후에도 항상 `session[0]`인지 유지(`sessionBuilder.test.ts:37,52` 기존 단정 회귀 없음).
  - 매칭 항목이 0개인 요일(예 `review`)에서 폴백으로 원래 순서가 보존되는지.
  - capture 모드(`initialExerciseId`)에서 요일 정렬이 적용되지 않고 무제한 slice 유지(`sessionBuilder.test.ts:55-66` 회귀 없음).
- 콘텐츠 단정(권장, 신규 테스트 파일 `src/data/mockExercises.content.test.ts`):
  - `ex_attention`에 `pattern` 수열 추론 단서가 더 이상 없고 give/take 문맥이 존재.
  - `ex_digit_span.direction === "forward"`.
  - 사자성어(고진감래/일석이조/동문서답) 토큰이 mockExercises 어디에도 등장하지 않음.
- 컴포넌트 단정: Stroop 렌더에 색 이름 텍스트 노드 존재, Trail number/symbol className에 `blue-400`/`green-500` 등 저명도 색이 group 구분으로 남아있지 않음.

## 5. 수용 기준 (high_level_plan HL-6에서)

- `ex_attention`/`ex_digit_span`이 구체 일상 과제(give/take, 순방향 반복)이다.
- 사자성어 지식 과제가 일일 세션에서 제거/전환되었다.
- 요일마다 다른 루틴 도메인이 `sessionBuilder`로 실제로 선택된다(`getDailyRoutinePlan()` 사용).
- Stroop에 텍스트 색 이름 폴백이 존재한다(scenarioBody 약속 이행).
- Trail 색 단독 구분이 제거되었다.
- 검증 통과: `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`.

## 6. 범위 펜스 (절대 미터치)

- 키오스크 `/kiosk`, `KioskHomeScreen.tsx`, `useKioskControls` — 라우트 연결됨, 그대로 유지(HL-10).
- `src/data/dailyRoutinePlan.ts`의 요일 매핑/구조/`RoutineDayDomain` — Home+Kiosk 이중 활성, 수정 금지(sessionBuilder 소비 쪽만).
- 복지관 운영자 대시보드 — 미구현, 별도(`docs/welfare-center-hybrid-plan.md`).
- 일본 현지 보상/캐릭터/기관 — 별도(`docs/japan-localization-research-plan.md`), 일본어 i18n 값은 한국 변경과 동기화만(본 SP는 콘텐츠 값 자체 변경이므로 ko/en/ja 3 locale 동기화는 Step 1/2/3/8에 포함, 일본 현지 보상/기관 리서치는 제외).
- 식약처/임상 검증 — app 카피 비의료 유지만(검사/진단/점수/예방/치료 금지). 공식 MMSE/MoCA/CIST 문항·컷오프 복제 금지.
- `LessonScreen.tsx`의 세션 소비 호출부(`:22-28`) — sessionBuilder 시그니처는 변경하지 않으므로 미터치.

## 7. 추가 발견 (보류 — step화 금지)

- `AttentionPattern.tsx:82-92`의 수열 표시 UI가 give/take 재작성 후 의미 없어짐 → 컴포넌트 자체 재설계(시각 표현 방식)가 필요하나, 본 SP는 데이터 재작성 + 최소 UI 단순화에 한정. 컴포넌트 전면 재설계는 별도.
- `StroopTouchPractice.tsx:36-64` `COLOR_CLASSES`가 여전히 blue/green swatch를 포함 → SP-2(고대비 토큰)에서 일괄 처리 예정. 본 SP는 텍스트 폴백 추가만.
- `DigitSpanPractice.tsx:139-155` study 단계의 `border-blue-100 bg-blue-50` 저명도 청 박스 → SP-2 웜 체계로 이관.
- `types.ts:91` 주석 "never copies official test items/cutoffs" — SP-1 copySafety와 연계 가능하나 본 SP 범위 아님.
- `mockExercises.ts` 전체 과제에 `domain`/`recommendedDays`가 누락된 항목(`ex_picture`, `ex_7` 등)이 있음 → 요일 필터 강화를 위해 전수 부여가 이상적이나, 본 SP는 멘토가 지적한 사자성어/attention/digit 범위 + 폴백 보존에 한정. 전수는 별도.

## 8. 롤백 메모

- 각 step은 독립 commit이므로 `git revert <sha>`로 단계별 롤백 가능.
- Step 4(sessionBuilder)와 Step 5(review 정합)는 서로 의존 — Step 5를 Step 4에 병합한 경우 단일 revert로 롤백.
- Step 3(사자성어 교체)은 데이터 교체이므로, 기존 사자성어 단정을 가진 테스트가 있으면 함께 업데이트 필요(롤백 시 테스트도 함께 복원).
- `sessionBuilder.test.ts:55-66`(capture 무제한 slice) 단정이 Step 4 후에도 통과해야 함 — 폴백 분기 누락 시 capture 경로가 요일 정렬에 오염될 수 있으므로, Step 4는 반드시 `initialExerciseId` 분기(`:53-58`) 이전에 정렬이 적용되지 않도록 순서 보존.
