# high_level_plan.md

# Haru / 피우다 — 멘토링(권효순) 기반 App 수정 High-Level 계획 (전면 재작성)

작성일: 2026-06-23
대상 저장소: `saerok-memory` (현재 `main` 브랜치 작업물)
보조 문서: `specifie_plan.md` (항목별 현재 구현 → 파일/경로 → 구체적 수정)
참고: 멘토링 메모(`mentoring/feedback.md`), 첨부 논문 `노인모바일인터페이스2014.pdf`

> 이 문서는 이전 `high_level_plan.md`를 **전면 대체**한다. 이전 문서는 키오스크·복지관 대시보드·일본 보상 리서치·임상 검증까지 "구현 작업"으로 묶어 범위가 너무 넓었고, 정작 멘토의 핵심 UI/UX/콘텐츠 요청과 사용자 1순위(키자마자 오늘 루틴 실행)가 희석되어 "전혀 작업이 안 된" 결과를 낳았다. 본 문서는 **지금 이 app에 구현할 작업만** 담고, 범위 밖(키오스크/복지관 대시보드/일본/임상)은 명시적으로 제외한다.

---

## 0. 전제와 범위

Haru는 60~80대 고령자를 위한 "매일 가볍게 뇌를 깨우는 루틴" app이다. 멘토의 핵심 피드백은 두 축이다.

1. **어르신이 매일 쉽게 쓴다**: 키자마자 오늘 루틴 한 번에 실행, 큰 글자·큰 버튼·고대비, 터치/말하기 중심, 숫자·지식·학력 바이어스 제거, 터치/발화에 즉각 반응(진동·소리·효과), 너무 많은 기능/메뉴 숨기기.
2. **보호자·상담사가 부담 없이 본다**: 점수·진단 느낌 회피, 보호자는 독려+대화 준비+치매안심센터 안내, 상담사는 사실 기록(단 점수 아님).

첨부 논문(p.4–p.5)이 위 요청과 일치한다: 큰 터치 타겟, 선택 확인 명확화, 더블클릭 금지, 단순 언어, 중심 정보 배치, 인지 부담 감소, **청색/녹색 계열 회피**, **고대비**, **색상 단독 정보 금지**, 비텍스트 객체 대체 텍스트.

**범위 박스(이번 구현에서 제외 → HL-10):**

| 항목 | 상태 | 이번 처리 |
|---|---|---|
| 키오스크/태블릿 모드 (`/kiosk`, `KioskHomeScreen`, `useKioskControls`) | App.tsx에 라우트로 **연결되어 있음**(삭제 불가) | 그대로 둠(수정 X). 단, 결함 1건은 별도 표시 |
| 복지관 운영자 대시보드 | 미구현 | 별도 과제(`docs/welfare-center-hybrid-plan.md`) |
| 일본 보상/캐릭터/기관 리서치 | i18n만 있음 | 별도 과제(`docs/japan-localization-research-plan.md`) |
| 식약처/의료기기 분류, 임상 검증 | 문서만 | 별도. app 카피는 비의료 유지(HL-1) |

이들 파일이 **이미 라우트/import에 연결되어 있으므로 삭제하면 안 된다**(키오스크 라우트, `dailyRoutinePlan`은 Home+Kiosk 둘 다 사용, `familySupportSummary`/`supportResources`는 `/family`에서 사용). "두지 않는다"가 아니라 "이번에 손대지 않는다"가 정확하다.

---

## 1. 멘토링에서 식별한 수정 사항 (App 구현 대상만)

아래 HL-1 ~ HL-9가 **지금 app에 구현할 작업**이고, HL-10은 제외/별도 과제다. 각 항목의 현재 구현 상태·관련 파일·구체적 수정은 `specifie_plan.md`의 동일 번호(SP-x)에서 다룬다.

### HL-1. 비의료·비검사 포지셔닝 + 동기부여 카피 강화

- **요청**: "스크린/검사/선별/진단/위험도/점수" 표현 회피. 어르신에게는 "오늘 루틴 / 뇌를 깨워요 / 하루 회상". 멘토: "매일 하시면 뇌가 활성화돼요" 같은 **동기부여 메시지**가 필요(영양제 안 먹어도 뇌가 활성화).
- **현황(양호)**: `copySafety.test.ts`가 learner 화면 12개 namespace에서 금지어(검사/스크리닝/선별/진단/위험도/치매 위험/점수)를 강제. Home/Result는 "오늘 루틴/완료/연속 참여"로 비의료화됨.
- **갭**: Result(완료 화면)에 **"뇌가 활성화돼요" 혜택 메시지가 전무**(streak/물방울 수만 표시). `support`/`family` namespace는 스캔 제외(누출 감지 안 됨).
- **방향**: Result에 동기부여 카피 추가, 보호자 encouragement에도 혜택 문구, copySafety 스캔을 `support`/`family`까지 GLOBAL_BANS로 확장 + "동기부여 키 존재" 단정 추가.

### HL-2. 노안 고대비 컬러 시스템 (멘토 1순위 시각)

- **요청**: 청색/녹색 저명도 조합 + 흰 글씨 = 노안에 안 보임 → 회피. 배경-글자 **고대비**. 색은 많아도 되되 구분 가능해야.
- **현황(치명)**: `Button3D` primary = 흰 글씨 on `primary-500 #58bd2f` = **2.4:1 (WCAG AA 4.5 미달, FAIL)**. secondary = 흰 글씨 on `blue-500 #1cb0f6` = **2.44:1 FAIL**. Home hero 카드, `LessonNode` 완료/현재 노드도 동일. hover(`primary-400`)는 1.96:1로 더 악화. `blue-400` 토큰이 없어 secondary hover가 깨짐.
- **양호 요소**: cream `#fffaf0` + ink `#2b2f33` = **12.96:1 (AAA)**, ink on orange-500 = 6.17:1, 흰 글씨 on amber `#b35900` = 4.83:1 — 고대비 웜 색상표가 **이미 토큰에 존재**하나 사용 안 함. body 배경은 아직 차냉 `#f7f8fb`.
- **방향**: primary/secondary를 cream+ink+amber(또는 orange-500+amber border)로 재정의. Home hero·LessonNode·Result 배경을 웜/ink 체계로. amber-700/800 토큰 추가, body 배경→warm. 저명도 녹/청을 **핵심 채움색에서 제거**(FeedbackTray의 dark-on-light 패턴은 유지).

### HL-3. 큰 글자 + 명확한 선택 + 큰 터치 타겟

- **요청**: 버튼은 큰데 글자가 작다 → **글자가 버튼을 꽉 채우게**. 선택은 모호하면 안 됨(눌렀는지 명확). 큰 터치 타겟.
- **현황(부분)**: 버튼 min-h 60~80px는 양호. 그러나 `ChoiceCard` status 배지 `text-xs`, `BottomNavigation` 비활성 라벨 `text-sm`, `TopStatusBar` 숫자 `text-base`, `ScenarioCard`/`WeeklyRewardCard`/`SupportResourceCard` 본문 `text-sm`/`text-xs`가 작음. `ChoiceCard` selected = 청색 틴트+ring만(채움 없음, 모호). `FamilyScreen` 탭 버튼에 min-h 없음(~36px). `VerbalFluency` 칩 버튼도 min-h 없음. `MascotBubble`에 **'praising' 상태가 없고 'encouraging'이 빨간 틴트**(오답처럼 보임).
- **방향**: 모든 상호작용/본문 텍스트 하한선 `text-base`, 숫자/보상 숫자는 `text-xl`+. `ChoiceCard` selected를 채움+체크로 강화. FamilyScreen 탭·VerbalFluency 칩에 min-h. press 애니메이션 강화, `Button3D`에 `aria-pressed` 추가. `MascotBubble`에 `praising` 상태 추가 + 빨간 틴트 제거 + `aria-live`.

### HL-4. 즉각·명확 상호작용 피드백 (멘토: "앱이 반응하고 있음" 인지)

- **요청**: 터치가 됐는지 몰라 불안 → 건드리면 **반드시 반응**. 잘했으면 잘했다고. 차분한 목소리.
- **현현재(치명)**: 피드백 원시함수(`tap`/`success`/`speak`, WebAudio+vibrate+calm TTS)는 잘 만들어져 있음. 그러나 **실제로 호출하는 곳은 `ChoiceCard.tap()` 하나**. `Button3D`(가장 많이 누르는 확인/계속 버튼) = **피드백 0**. `success()`/`speak()`는 **코드 어디서도 호출 안 됨**. Trail/Stroop/Digit/Pair/Shape/PictureChoice는 plain `<button>`으로 tap/success 없음. `FeedbackTray`는 `aria-live`는 있으나 정답 톤 없음. (SpeechRepeat는 피드백 후 Continue 대기하도록 이미 수정됨 → 유지.)
- **방향**: `Button3D` onClick에 `tap()` 연결(가장 효과 큼), `FeedbackTray`가 correct로 마운트 시 `success()` 1곳 집중화(모든 exercise 일괄 적용), Trail/Stroop/Digit/Pair/Picture에 `tap()`/`success()` 추가. SpeechRepeat의 raw `SpeechSynthesis`를 공유 `speakCalmly()`로 교체.

### HL-5. 음성 우선 회상·말하기 + "듣고 있어요" 명확 표시

- **요청**: 터치/타이핑보다 **말로 편하게**. "오늘 3~5문장 말해주세요" 핵심 루틴. **"듣고 있어요" 명확 표시**(줌/디스코드 초록 테두리/파형). 인식 실패해도 **녹음/기록으로 안 끊김**. 차분한 목소리. 따라 읽기 + 발음 변화 포착(언어 신호). 말이 길어지면 제한.
- **현황(양호+갭)**: 음성이 **기본 입력**(SpeechCapturePanel이 textarea 위), ex_6 프롬프트가 멘토 핵심과 일치, calm TTS(rate 0.92), 명확한 stop 버튼. 갭: "듣고 있어요"가 **정적 링+펄스 점**(실시간 파형 아님), **발화 시간 cap 없음**(durationMs 측정만, 무한 실행), **MediaRecorder/오디오 자산 폴백 없음**(텍스트만), **발음/언어 변화 신호 없음**, ex_6 음성 메타데이터가 저장 시 누락.
- **방향**: 펄스 점 → 실시간 멀티바 파형(초록 링 유지), `useSpeechCapture`에 maxDurationMs cap 자동 stop, MediaRecorder 폴백, SpeechRepeat에 `pronunciationSimilarity` 메타데이터, ex_6 음성 메타데이터 저장.

### HL-6. 일상생활 콘텐츠 + 요일 루틴 실제 연결 (사용자 명시: 숫자/지식 거부감 제거)

- **요청**: 건조한 숫자/수학/지식(학력 바이어스) 대신 **일상 맥락**("사과 9개에서 2개 드리면?"). 문제처럼 느껴지지 않게. 요일별 루틴("월=주의, 화=기억, 수=말하기…"). 단기기억은 반복 훈련. CIST처럼 광역 도메인(MMSE 단일 편중 회피).
- **현황(치명·표면 개편)**: `domain`/`recommendedDays`/`scenarioTitle` 필드는 추가됐으나 **표면 장식**. `ex_attention`은 여전히 추상 "12,10,8→6" 숫자 패턴(이야기 포장), `ex_digit_span`은 역방향 "482→284" 작업기억, 사자성어(고진감래/일석이조) 지식 과제가 **매 세션마다 등장**(scenario/domain 없음). Stroop/Trail은 색 의존. Stroop은 "글자 색 이름도 표시"를 scenario에 약속했으나 **구현 안 됨**. **요일 계획이 세션 빌더에 연결되지 않음** → `buildDailySessionExercises`가 `getDailyRoutinePlan()`/`domain`/`recommendedDays`를 무시하고 전체 배열을 cap 8로 slice → **모든 날 같은 순서**.
- **방향**: `ex_attention`→구체 give/take 재작성, `ex_digit_span`→순방향 반복/확인으로 전환, 사자성어 과제 제거/일상 표현으로 전환, **sessionBuilder에 요일 계획 연결**(오늘 도메인으로 필터/재정렬), Stroop 텍스트 폴백 구현, Trail 색 의존 제거.

### HL-7. 켜자마자 오늘 루틴 + 단일 CTA + 짧은 온보딩 (사용자 명시 1순위)

- **요청(사용자)**: **"키자마자 바로 하루의 작업 실행"**. 딱 누르면 그날 할 것만. 메뉴 헤매지 않게. 너무 많은 기능 숨기기. "부족하다" 느끼지 않게 내부 커스터마이징만. 자동로그인/마지막 프로필 자동 적용.
- **현황(치명)**: **런치 자동시작 전무**. `autoStartTodayRoutine`/`onboarded` 플래그는 **죽은 코드**(아무도 안 읽음). Home은 **5노드 mockPathNodes 경로** + advisory 카드 + 마스코트로 단일 CTA가 아님(메뉴/경로 헤매기). first-run 게이트 없음. 마지막 프로필 자동 적용 없음(언어만). 오늘 라벨("오늘은 ~하는 날이에요")은 정확함.
- **방향**: App 런치 이펙트 — `autoStartTodayRoutine` true면 `/` → `/lesson` 자동 이동. Home을 **하나의 큰 CTA**로 축소(5노드 경로·advisory 제거, 오늘 라벨+단일 버튼만). `onboarded` 기반 짧은 first-run(2~3단계). `autoStartTodayRoutine` 기본 true. 런치 시 프로필 자동 적용. Settings에 비임상 토글 추가.

### HL-8. 지속 참여 보상 + 마스코트 칭찬

- **요청**: 점수 자체보다 **연속/참여/주간 작은 보상**(쓰레기봉투 등)이 동기. 공개 리더보드 말고 자랑 카드. 캐릭터 칭찬. 뇌 활성화 메시지.
- **현황(양호+갭)**: 점수 미노출/리더보드 없음(양호). 갭: 주간 보상 카탈로그(`REWARD_CATALOG`)가 **죽은 코드**(렌더링 안 됨, `claimedRewardIds` 안 씀, i18n 키 `weekly.catalog.*` 누락). `weekly.bragCard` 문자열만 있고 UI 없음. **Result에 마스코트 칭찬 없음**(MascotBubble은 Home/Lesson만). `recordWeeklyCompletion` 호출 안 됨. `rewards.ts`(점수형) 죽은 코드. `streak_milestone`/`weekly_completion` 이벤트 미발생.
- **방향**: `WeeklyRewardCard`에 카탈로그 아이템+수령 표시 렌더, 카탈로그 i18n 키 추가, 자랑 카드 UI(공유), Result에 MascotBubble 칭찬, `recordWeeklyCompletion`+`addReward(weekly_completion/streak_milestone)` 연결, 점수형 `rewards.ts`는 연결하거나 삭제.

### HL-9. 보호자/상담사 정보 분리 강화 + 치매안심센터 자원 카드

- **요청**: 보호자에게 raw 사실/점수 과잉 노출 금지(불안). 보호자 = 독려+대화 준비+가까운 치매안심센터(대표 전화·홈페이지). 상담사 = 더 구체적 사실(단 점수 아님). Haru advisory는 단일 결과로 needsConversation 금지(반복/복합일 때만).
- **현황(양호+갭)**: 기본 탭 보호자(양호), `familySupportSummary`가 raw metric 숨김(양호), haruAdvisory는 단일 루틴 결과에 보수적(watch)(양호). 갭: 보호자 탭 metric 타일이 **상담사 report 객체**(`report.*`)에서 읽음(familySummary 아님). **단일 caregiver 관찰 'oftenDifferent'가 즉시 needsConversation**(`haruAdvisory:394`) → 자원 카드까지 점등("반복 걱정" 위반). `supportResources` 카탈로그가 **의도적 비어 있어** 항상 pending placeholder.
- **방향**: 보호자 탭을 `familySummary.*`만 사용, 단일 oftenDifferent → watch로 강등(≥2개 도메인/기록에서 needsConversation), 자원 카드를 반복 걱정(≥2)에서만, 검증된 치매안심센터 1건 이상 입력(대표 전화+홈페이지+lastVerifiedAt+sourceUrl). 미검증 데이터는 하드코딩 금지.

### HL-10. [범위 밖 — 이번 app 구현에서 제외 / 별도 과제]

- **키오스크/태블릿** (`/kiosk`, `KioskHomeScreen.tsx`, `useKioskControls.ts`): 라우트로 연결됨 → **수정 없이 유지**. 단, 알려진 결함: `KioskHomeScreen`이 존재하지 않는 i18n 키 `routine.startButton`을 호출 → raw key 노출. 키오스크를 다시 손댈 때 3개 locale에 키 추가(저렴한 1줄 수정이나, app 본루틴과 무관하므로 이번엔 별도 표시).
- **복지관 운영자 대시보드**: 미구현 → `docs/welfare-center-hybrid-plan.md` 별도.
- **일본 현지 보상/캐릭터/기관 리서치**: `docs/japan-localization-research-plan.md` 별도. 일본어 i18n은 한국 변경사항과 동기화만.
- **식약처/의료기기 분류·임상 검증**: app 카피 비의료 유지(HL-1), 본격 검증은 별도 설계.

---

## 2. 우선순위

### P0 — 즉시 반영 (멘토 치명 지적 + 사용자 1순위)

1. **HL-2** 고대비 컬러 (white-on-green/blue FAIL → cream+ink+amber).
2. **HL-7** 런치 자동시작 + 단일 CTA + 짧은 온보딩 (사용자 명시 1순위).
3. **HL-4** 상호작용 피드백 (Button3D tap + FeedbackTray success 중앙화).
4. **HL-6** 일상 콘텐츠 재작성 + 요일 루틴 실제 연결 + 사자성어 제거.
5. **HL-3** 큰 글자·명확 선택·터치 타겟 하한선.

### P1 — 다음 스프린트

6. **HL-5** 음성 파형/cap/녹음 폴백/발음 신호.
7. **HL-1** 동기부여(뇌 활성화) 카피 + copySafety 확장.
8. **HL-8** 주간 보상 카탈로그 렌더 + 자랑 카드 + Result 마스코트 칭찬.
9. **HL-9** 보호자 탭 분리 + advisory 보수화 + 치매안심센터 자원 입력.

### P2 / 별도 과제

10. **HL-10** 키오스크/복지관/일본/임상 — app 구현 제외, 별도 문서/과제.

---

## 3. 수용 기준 (Acceptance Criteria)

- **색/대비**: `Button3D` primary/secondary/danger가 WCAG AA(일반 4.5:1, 큰 텍스트 3:1) 통과. 흰 글씨 on 저명도 녹/청 조합이 핵심 CTA에서 사라짐. body 배경이 warm 계열. (대비 수치는 `specifie_plan.md` SP-2에 명시.)
- **자동시작**: `autoStartTodayRoutine=true`일 때 app 런치 즉시 `/lesson` 진입(0탭). Home이 단일 CTA(5노드 경로/다중 카드 없음). `onboarded` false 시 짧은 first-run.
- **피드백**: 모든 상호작용(Button3D, ChoiceCard, Trail/Stroop/Digit/Pair/Picture)이 100~200ms 내 진동/소리/시각 중 ≥1 반응. 정답 시 `success()` 음+진동. SpeechRepeat는 Continue 대기 유지.
- **콘텐츠**: `ex_attention`/`ex_digit_span`가 구체 일상 과제. 사자성어 지식 과제가 일일 세션에서 제거. 요일마다 다른 루틴 도메인이 실제로 선택됨(`sessionBuilder`가 `getDailyRoutinePlan()` 사용). Stroop에 텍스트 색 이름 폴백 존재.
- **음성**: "듣고 있어요"가 실시간 파형. 발화 시 maxDurationMs 자동 종료. 인식 미지원/실패 시 루틴이 깨지지 않음.
- **카피**: Result에 뇌 활성화 동기부여 문구. `copySafety`가 `support`/`family` namespace까지 GLOBAL_BANS 검사.
- **보상**: Result에 마스코트 칭찬. 주간 보상 카탈로그가 렌더되고 i18n 키 존재. raw 인지 점수 미노출 유지.
- **보호자**: 보호자 탭이 `familySummary.*`만 표시. 단일 관찰로 needsConversation/자원 카드 미발생. 치매안심센터 자원이 검증 데이터와 함께 표시(미검증 시 표시 안 함).
- **검증**: `npm run typecheck`, `npm run lint`, `npm test`, `npm run build` 통과.

---

## 4. 상세 구현 문서와의 관계

본 문서는 전략/우선순위/수용기준을 정의한다. 각 항목의 **현재 구현 상태·정확한 파일/경로/라인·구체적 수정(FROM→TO)**은 `specifie_plan.md`의 동일 번호(SP-1 ~ SP-10)에서 다룬다. 두 문서는 1:1로 대응한다.
