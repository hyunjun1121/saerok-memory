# SP-10 — [범위 박스] 키오스크 / 복지관 대시보드 / 일본 현지 / 임상 검증

> **AXIS 고정**: 본 파일은 실행 워크플로가 아닌 **SCOPE-FENCE(범위 펜스) 문서**다. 방향·우선순위·수용기준은 `high_level_plan.md` 의 HL-10 와 `specifie_plan.md` 의 SP-10 에 고정된다. 본 파일에서 새 범위를 추가하지 않는다. 키오스크·복지관 대시보드·일본 현지·임상 검증은 **이번 app 구현에서 미터치(삭제 불가, 그대로 유지)** 한다.

| 우선순위 | 의존(선행 SP) | 터치 파일 | 미터치(HL-10) |
|---|---|---|---|
| P2 | 없음 | (없음 — 본 SP는 코드 변경 step 없음) | 키오스크/복지관대시보드/일본/임상 |

> 본 SP는 **step(코드 변경)이 없다**. HL-10/SP-10 AXIS가 "이번 app 구현에서 제외, 그대로 유지"를 명시하므로, 이 문서는 (1) 미터치 범위 박스 현황 (2) 알려진 결함 (3) 별도 과제 문서 포인터 만을 본문으로 제공한다. 아래 "3. 작업 워크플로" 자리에는 코드 step 대신 "범위 박스 현황 / 알려진 결함 / 별도 과제" 구성을 둔다(템플릿 지시에 따름).

## 0. 목표

HL-10/SP-10은 키오스크(`/kiosk`), 복지관 운영자 대시보드, 일본 현지 보상/캐릭터/기관, 식약처/임상 검증을 **이번 app 구현 범위에서 명시적으로 제외**한다. 이 영역의 파일들은 이미 라우트/import에 연결되어 있어 **삭제하면 app이 깨지므로 그대로 둔다(수정 X)**. 본 SP의 유일한 산출물은 (a) 미터치 대상의 정확한 현황 정리, (b) 이미 알려진 kiosk i18n 결함(`routine.startButton` raw key 노출)의 별도 표시, (c) 각 별도 과제 문서로의 포인터다. **범위 박스 안 항목을 이번 SP의 실행 step으로 만들지 않는다.**

## 1. 현재 구현 (소스 재확인 결과)

### 1.1 키오스크 라우트 연결 상태 (연결됨, 그대로 유지)
- `src/App.tsx:13` — `const KioskHomeScreen = lazy(() => import('./app/kiosk/KioskHomeScreen'));`
- `src/App.tsx:32` — `<Route path="/kiosk" element={<KioskHomeScreen />} />` (AppShell 외부 standalone 라우트, 주석 "Kiosk/tablet mode runs standalone")
- 결론: `/kiosk`는 라우트로 연결되어 있고, app 본루틴(`/`)과 분리된 standalone 화면. 삭제 시 `App.tsx` lazy import가 깨짐 → 미터치.

### 1.2 KioskHomeScreen (연결됨, 그대로 유지)
- `src/app/kiosk/KioskHomeScreen.tsx:5` — `import { getDailyRoutinePlan } from "../../data/dailyRoutinePlan";`
- `src/app/kiosk/KioskHomeScreen.tsx:6` — `import { useKioskControls } from "../../features/kiosk/useKioskControls";`
- `src/app/kiosk/KioskHomeScreen.tsx:14` — `const todayPlan = getDailyRoutinePlan();`
- `src/app/kiosk/KioskHomeScreen.tsx:20` — `useKioskControls({ onPrimary: startRoutine });`
- 단일 큰 CTA(`:41-50`), 오늘 루틴 이름(`:32-34`), 데모 모드 안내(`:52-54`). anonymous/local-demo 한정.
- 멘토 갭: 없음(app 본루틴과 무관). 단 아래 1.5 i18n 결함은 별도.

### 1.3 useKioskControls (연결됨, 그대로 유지)
- `src/features/kiosk/useKioskControls.ts:13-42` — Enter/Space 주요 버튼 실행(`:24-28`), 숫자 1-4 선택(`:30-36`). `enabled=false` 또는 `window` 미존재 시 no-op(`:19-21`). 키보드 없는 태블릿에서도 on-screen 버튼 동작(graceful degrade).
- 멘토 갭: 없음.

### 1.4 이중 활성 데이터 파일 (삭제 절대 금지)
- `src/data/dailyRoutinePlan.ts:28-30` `getDailyRoutinePlan()` — Home(`HomeScreen.tsx`)과 Kiosk(`KioskHomeScreen.tsx:14`)이 **둘 다** 사용. SP-6이 Home/sessionBuilder 쪽만 수정하더라도 이 파일 자체는 Kiosk 의존이 살아있으므로 삭제 불가.
- `src/features/family/familySupportSummary.ts` — `/family`(`FamilyScreen.tsx`)에서 사용.
- `src/data/supportResources.ts:26-36` — `getVerifiedSupportResources()`가 의도적 빈 catalog(placeholder 생략). `lastVerifiedAt && sourceUrl` 필터로 항상 빈 배열 → SupportResourceCard는 `support.pending` placeholder. SP-9 영역이나, 본 SP에서는 "미터치(이번엔 입력 안 함)"로 명시.

### 1.5 알려진 결함 — kiosk `routine.startButton` i18n 누락 (별도 표시, 이번엔 수정 안 함)
- `src/app/kiosk/KioskHomeScreen.tsx:47` — `aria-label={t("routine.startButton")}`
- `src/app/kiosk/KioskHomeScreen.tsx:49` — `{t("routine.startButton")}` (버튼 텍스트)
- 소스 재확인 결과 `routine` namespace(`src/locales/ko.json:46-55`, `en.json:46-55`, `ja.json:46-55`)에는 `todayLabel/attentionDay/memoryDay/languageDay/dailyFlowDay/moodDay/reviewDay/fallback` 만 존재. **`startButton` 키 없음**.
  - 참고: `lesson.start.startButton`(`ko.json:223` "시작하기" / `en.json:223` "Start" / `ja.json:223` "開始")은 **별개의 namespace**에 존재. kiosk가 호출하는 `routine.startButton`과 다름.
- 결과: kiosk 시작 버튼이 raw key 문자열 `routine.startButton` 을 사용자에게 그대로 표시.
- 처리: **app 본루틴과 무관** → 이번에는 별도 표시만. 키오스크를 다시 손댈 때 3 locale `routine` namespace에 `startButton` 추가(ko "오늘 루틴 시작하기" / en / ja). HL-10이 "저렴한 1줄 수정이나 app 본루틴과 무관하므로 이번엔 별도 표시"로 명시.

## 2. 전제 / 선행 작업

- **deps: 없음.** 본 SP는 코드 변경을 수반하지 않으므로 선행 SP 없음.
- **공유 파일 조정 주의사항**: `dailyRoutinePlan.ts`는 Home과 Kiosk가 공유. SP-6이 이 파일 기반으로 sessionBuilder를 수정할 때 Kiosk 의존(`KioskHomeScreen.tsx:14` `getDailyRoutinePlan()`)을 끊지 않도록 주의(함수 시그니처/반환값 호환성 유지). 본 SP 자체는 이 파일을 건드리지 않는다.
- `supportResources.ts`는 SP-9 영역. 본 SP에서 "미터치"로만 표기하고 입력 step을 만들지 않는다.

## 3. 작업 워크플로

> 템플릿 지시에 따라, 본 SP는 코드 step 대신 **"범위 박스 현황 / 알려진 결함 / 별도 과제"** 구성을 본문으로 둔다. FROM/TO/verify/checkpoint 코드 step은 존재하지 않는다(AXIS: "이번 app 구현에서 제외, 그대로 유지").

### 3.1 범위 박스 현황 (미터치 — 그대로 유지, 삭제 불가)

| 항목 | 파일/라우트 | 현재 상태 | 이번 처리 |
|---|---|---|---|
| 키오스크 모드 | `/kiosk`, `src/app/kiosk/KioskHomeScreen.tsx`, `src/features/kiosk/useKioskControls.ts` | App.tsx 라우트로 연결됨(standalone) | **미터치, 유지** |
| 이중 활성 데이터 | `src/data/dailyRoutinePlan.ts` (`getDailyRoutinePlan`) | Home + Kiosk 둘 다 사용 | **미터치, 삭제 금지** (SP-6은 Home/sessionBuilder 쪽만) |
| 복지관 운영자 대시보드 | (`StaffSummaryScreen` 미구현) | 미구현 | **별도 과제** (`docs/welfare-center-hybrid-plan.md`) |
| 보호자 자원 데이터 | `src/data/supportResources.ts` | 의도적 빈 catalog | **미터치** (SP-9 영역, 입력은 별도) |
| 일본 현지 보상/캐릭터/기관 | `src/locales/ja.json` (i18n만) | 한국 변경사항과 동기화만 | **별도 과제** (`docs/japan-localization-research-plan.md`) |
| 식약처/의료기기/임상 검증 | (문서 only) | app 카피 비의료 유지(HL-1/SP-1) | **별도 설계** |

### 3.2 알려진 결함 (별도 표시 — 이번엔 수정 안 함)

- **kiosk `routine.startButton` i18n 누락 (raw key 노출)**
  - 위치: `src/app/kiosk/KioskHomeScreen.tsx:47` (`aria-label`), `:49` (버튼 텍스트)
  - 원인: `t("routine.startButton")` 호출이나 `routine` namespace(`ko/en/ja.json:46-55`)에 `startButton` 키 없음. `lesson.start.startButton`(`:223`)은 별개 namespace.
  - 증상: kiosk 시작 버튼에 raw key `routine.startButton` 표시.
  - 처리: app 본루틴과 무관 → 이번 SP에서 수정 step화 금지. 키오스크 재작업 시 3 locale `routine` 에 `startButton` 추가. 본 문서에 명시만.

### 3.3 별도 과제 문서 포인터

- **복지관 운영자 대시보드 / 하이브리드**: `docs/welfare-center-hybrid-plan.md`
  - 운영 모드 구분(개인 스마트폰 / 복지관 키오스크 / 집 연계 복습), 운영자 요약 범위(참석자 수·완료 수·평균 소요·보상 수령 — 개인 인지 원자료 제외), 남은 과제(`StaffSummaryScreen`, 카드/QR 로그인, 서버 동기화=범위 밖).
- **일본 현지 보상/캐릭터/기관 리서치**: `docs/japan-localization-research-plan.md`
  - 조사 항목(包括支援センター 맥락, 보상 선호, 캐릭터/톤/색상, 의료 오해 점검, 공식 상담 자원). 일본어 i18n은 한국 변경사항(SP-1/SP-8)과 동기화만.
- **식약처/의료기기 분류·임상 검증**: app 카피 비의료 유지(HL-1/SP-1), 본격 검증은 별도 설계.

## 4. 단계별 테스트

본 SP는 코드 변경이 없으므로 **SP-10 전용 단정 테스트는 없다**. 표준 회귀만:

- `npm run typecheck && npm run lint && npm test && npm run build` — 다른 SP(특히 SP-6 `dailyRoutinePlan.ts` 공유 파일 수정, SP-9 `supportResources.ts` 수정) 후에도 `/kiosk` 라우트·`KioskHomeScreen` import가 깨지지 않음을 회귀로 확인.
- (참고) kiosk i18n 결함을 잡을 경우에만: 3 locale `routine.startButton` 키 존재 단정 테스트 추가 가능. 단 이번 SP 범위 아님.

## 5. 수용 기준 (high_level_plan HL-10에서)

- 키오스크 `/kiosk`, `KioskHomeScreen`, `useKioskControls` 가 **수정 없이 유지**됨(삭제 불가, 라우트 연결 상태 보존).
- 복지관 운영자 대시보드·일본 현지 보상/캐릭터/기관·식약처/임상 검증이 **이번 app 구현에 포함되지 않음**(별도 과제 문서로 분리 유지).
- 알려진 결함(kiosk `routine.startButton` raw key 노출)이 본 문서에 명시되고, 이번 SP의 실행 step으로 변환되지 않음.
- 공산품 비의료 카피 유지(검사/진단/점수/예방/치료 금지), 공식 MMSE/MoCA/CIST 문항·컷오프 복제 금지(HL-1 정합).

## 6. 범위 펜스 (절대 미터치)

- **키오스크** `/kiosk`, `src/app/kiosk/KioskHomeScreen.tsx`, `src/features/kiosk/useKioskControls.ts` — 라우트 연결됨, 그대로 유지.
- **`src/data/dailyRoutinePlan.ts`** — Home + Kiosk 이중 활성. 삭제 절대 금지. SP-6은 Home/sessionBuilder 쪽만 수정.
- **복지관 운영자 대시보드** (`StaffSummaryScreen`, 익명 집계) — 미구현, 별도(`docs/welfare-center-hybrid-plan.md`).
- **일본 현지 보상/캐릭터/기관** — 별도(`docs/japan-localization-research-plan.md`). 일본어 i18n(`ja.json`)은 한국 변경사항과 동기화만.
- **식약처/의료기기 분류·임상 검증** — app 카피 비의료 유지만(HL-1/SP-1).
- **`src/data/supportResources.ts`** catalog 입력 — SP-9 영역. 본 SP에서 입력 step화 금지.

## 7. 추가 발견 (보류 — step화 금지)

- `src/locales/{ko,en,ja}.json` 의 `routine` namespace에 `startButton` 키가 없어 kiosk가 raw key를 표시(3.2 결함). 수정은 1줄×3 locale이나 AXIS가 "app 본루틴과 무관, 이번엔 별도 표시"하므로 **보류**. 별도 SP/axis 승인 후 처리.
- `lesson.start.startButton`(`ko/en/ja.json:223`)가 의미상 kiosk 시작 버튼과 유사("시작하기"/"Start"/"開始"). kiosk 재작업 시 `routine.startButton`을 새로 넣을지 `lesson.start.startButton`으로 redirect 할지 결정 필요 — 본 SP에서 결정하지 않음(보류).
- `docs/welfare-center-hybrid-plan.md`의 "서버 동기화는 MVP 범위 밖" 명시와 `docs/japan-localization-research-plan.md`의 "공식 연락처 검증 전 하드코딩 금지" 원칙이 SP-9 자원 입력과 충돌 주의. 본 SP에서 조치하지 않음(보류).

## 8. 롤백 메모

- 본 SP는 **코드 변경 commit이 없다**(scope-fence 문서). 롤백 대상 없음.
- 단, 본 문서 파일 자체(`specifie_plan/SP-10-out-of-scope.md`)가 잘못 작성/누락된 경우 `git revert` 또는 문서 재작성으로 복구.
- 주의사항: 다른 SP(특히 SP-6 공유 파일 `dailyRoutinePlan.ts`, SP-9 `supportResources.ts`)가 범위 펜스를 넘어 키오스크 의존을 끊지 않았는지 회귀로 확인. `/kiosk` 라우트가 `npm run build` 후에도 lazy import·렌더에 문제가 없어야 함.
