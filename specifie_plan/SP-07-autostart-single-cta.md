# SP-07 — 켜자마자 오늘 루틴 + 단일 CTA + 짧은 온보딩

> **AXIS 고정**: 본 파일은 실행 워크플로. 방향·우선순위·수용기준은 `high_level_plan.md` 의 HL-7 와 `specifie_plan.md` 의 SP-07 에 고정된다. 본 파일에서 새 범위를 추가하지 않는다.

| 우선순위 | 의존(선행 SP) | 터치 파일 | 미터치(HL-10) |
|---|---|---|---|
| P0 | 없음 | `src/App.tsx`, `src/app/home/HomeScreen.tsx`, `src/app/settings/SettingsScreen.tsx`, `src/features/profile/learnerProfileStorage.ts`, `src/locales/{ko,en,ja}.json`, 신규 `src/app/onboarding/OnboardingScreen.tsx` | 키오스크/복지관대시보드/일본/임상 |

## 0. 목표

App 런치 시 `autoStartTodayRoutine===true` 이고 오늘 루틴이 미완료면 `/` → `/lesson` 으로 0탭 자동 진입시킨다. Home 은 5노드 지그재그 경로(`mockPathNodes`)와 advisory 카드를 제거하고 오늘 라벨("오늘은 ~하는 날이에요") + 단일 전폭 `Button3D` CTA 로 축소한다. `onboarded===false` 시 2~3단계(언어 / 글자 크게 / 입력 방식) 짧은 first-run 게이트를 둔다. 런치 시 저장된 `learnerProfile` 의 `preferredInputMode`/`largeTextMode`/`soundFeedbackEnabled` 를 자동 적용하고, Settings 에 비임상 "시작할 때 바로 오늘 루틴 열기" 토글을 추가한다. 죽은 플래그(`autoStartTodayRoutine`/`onboarded`)를 활성 코드로 만든다.

## 1. 현재 구현 (소스 재확인 결과)

- `src/App.tsx:25-47` — `App()` 가 `BrowserRouter`/`Routes` 만 렌더. useEffect, `getLearnerProfile()` 읽기, `/lesson` 자동이동 **전부 없음**. 유일 redirect 는 catch-all `* → /`(`App.tsx:40`). 런치 항상 Home.
  ```tsx
  // App.tsx:25-47 (현재)
  export default function App() {
    return (
      <GamificationProvider>
        <BrowserRouter>
          <Suspense fallback={<LoadingFallback />}>
            <Routes>
              <Route path="/kiosk" element={<KioskHomeScreen />} />
              <Route element={<AppShell />}>
                <Route path="/" element={<HomeScreen />} />
                ...
                <Route path="*" element={<Navigate to="/" replace />} />
              </Route>
            </Routes>
          </Suspense>
        </BrowserRouter>
      </GamificationProvider>
    );
  }
  ```
  멘토 갭: 자동시작 전무, 프로필 미읽기. SP-07 치명 1.

- `src/features/profile/learnerProfileStorage.ts:21-30` — `defaultLearnerProfile` 의 `autoStartTodayRoutine: false`(`:25`), `onboarded: false`(`:27`). grep 결과 이 두 필드를 **읽는 곳 0**(`soundFeedbackEnabled` 만 `useInteractionFeedback` 에서 읽음). 플래그가 죽은 코드. SP-07 치명 2.
  ```ts
  // learnerProfileStorage.ts:21-30 (현재)
  export const defaultLearnerProfile: LearnerProfile = {
    preferredInputMode: "speech",
    largeTextMode: false,
    kioskModePreferred: false,
    autoStartTodayRoutine: false,
    soundFeedbackEnabled: true,
    onboarded: false,
    createdAt: "",
    updatedAt: "",
  };
  ```

- `src/app/home/HomeScreen.tsx:9-15` — 5노드 `mockPathNodes`(locked/family_memory/current/completed/completed) 세로 지그재그 경로 정의.
  ```tsx
  // HomeScreen.tsx:9-15 (현재)
  const mockPathNodes = [
    { id: "node_5", state: "locked" as LessonNodeState, position: "center" as const },
    { id: "node_4", state: "family_memory" as LessonNodeState, position: "left" as const },
    { id: "node_3", state: "current" as LessonNodeState, position: "right" as const },
    { id: "node_2", state: "completed" as LessonNodeState, position: "left" as const },
    { id: "node_1", state: "completed" as LessonNodeState, position: "center" as const },
  ];
  ```
- `src/app/home/HomeScreen.tsx:22-28` — `handleNodePress` 와 `handleContinue` 가 모두 `navigate("/lesson")`. 경로 노드 탭과 하단 CTA 가 동일 목적지 → 경로는 시각 잡음만.
- `src/app/home/HomeScreen.tsx:47-59` — advisory 카드(Sparkles + advisoryTitle/advisoryBody)가 단일 CTA 와 주의 경쟁.
- `src/app/home/HomeScreen.tsx:61-80` — `mockPathNodes.map` + 세로 연결선 + `MascotBubble`.
- `src/app/home/HomeScreen.tsx:82-88` — 하단 고정 `Button3D` CTA.
- `src/app/home/HomeScreen.tsx:40-42` — 오늘 라벨 `"오늘은 {{name}} 날이에요."` (정확, **유지 대상**, 공유 파일 주의).
  ```tsx
  // HomeScreen.tsx:40-42 (현재, 유지)
  <p className="text-base font-semibold text-primary-50">
    {t("home.todayRoutineName", { name: t(todayPlan.nameKey) })}
  </p>
  ```
  멘토 갭: 단일 CTA 아님. SP-07 치명 3.

- `/onboarding` 라우트, `onboarded` 검사, Welcome 화면 **전무**. SP-07 치명 4.

- `src/App.tsx` 가 `learnerProfile` localStorage 를 런치에 읽지 않음. `preferredInputMode`/`largeTextMode` 자동 적용 없음. 언어(`memoryGardenLang`)만 i18n 에서 읽음. SP-07 치명 5.

- `src/app/settings/SettingsScreen.tsx:89-104` — 언어 섹션 + 데이터 삭제 섹션만. auto-start 토글, 입력 방식/글자 크기 적용 UI 없음. SP-07 Settings 갭.

- `src/data/dailyRoutinePlan.ts:28-30` — `getDailyRoutinePlan(date)` 로 오늘 도메인/nameKey 획득. 단일 루틴/일 지원(양호).
- `src/features/cognitive/cognitiveRoutineStorage.ts:24-26` — `getCognitiveRoutineResults()` 로 오늘 완료 여부 판단 가능(오늘 날짜 ISO timestamp 의 completed 결과 존재 여부).
- `src/features/gamification/weeklyRewards.ts:69` — `getCompletedDaysThisWeek(results, now)` 가 이미 요일 완료 판단에 사용됨. 오늘 완료 여부 산출에 재사용 가능.

## 2. 전제 / 선행 작업

- 의존 SP: 없음. HL-7 은 사용자 명시 1순위로 진입 경로 재구성이 선행된다(부록 A 추천 순서상 SP-2 다음).
- **공유 파일 주의 (SP-02)**: `src/app/home/HomeScreen.tsx` 의 hero 카드 색상은 SP-02(고대비 컬러)가 함께 수정한다. 본 SP-07 은 hero 의 **구조/라벨**만 다루고, `bg-primary-500`→`bg-primary-700` 등 색 변경은 SP-02 에 맡긴다. 본 파일의 className 변경은 오늘 라벨(`text-primary-50`)을 유지하는 선에서 최소화한다.
- **공유 파일 주의 (Kiosk)**: `getDailyRoutinePlan`(`dailyRoutinePlan.ts`)은 `HomeScreen.tsx:7,20` 와 `KioskHomeScreen.tsx` 양쪽에서 사용. 절대 삭제/시그니처 변경 금지. 본 SP-07 은 import 만 유지한다.
- `autoStartTodayRoutine` 기본 true 는 단일 사용자 기기(가정용 태블릿) 전제. kiosk 모드(`/kiosk`)는 본 게이트와 무관하게 standalone 라우트(`App.tsx:32`)이므로 영향 없음.
- "오늘 루틴 미완료" 판단은 `getCognitiveRoutineResults()` 에서 오늘(로컬 날짜) `completed===true` 결과 존재 여부로 정의한다. 완료된 날에는 자동이동 대신 Home 유지(재진입 시 결과 화면이 아닌 Home 대기 상태).
- 공산품 비의료 카피 유지: 온보딩/Settings 토글 라벨에 "검사/진단/점수/예방/치료" 금지. deficit 프레이밍("부족하다") 금지.

## 3. 작업 워크플로

### Step 1 — `autoStartTodayRoutine` 기본값 true 로 전환 (죽은 플래그 활성화 1단계)
- 파일: `src/features/profile/learnerProfileStorage.ts:25`
- FROM: `  autoStartTodayRoutine: false,`
- TO: `  autoStartTodayRoutine: true,`
- verify: `npm run typecheck && npm test -- learnerProfile`
- checkpoint: `git add -A && git commit -m "SP-07: default autoStartTodayRoutine to true (single-user device)"`

### Step 2 — 오늘 루틴 완료 여부 헬퍼 추가 (자동이동 판단 기반)
- 파일: `src/features/cognitive/cognitiveRoutineStorage.ts` (말단에 추가)
- FROM: (파일 끝, `clearCognitiveRoutineResults` 함수 이후에 해당 헬퍼 없음)
- TO:
  ```ts
  export function isTodayRoutineCompleted(now: Date = new Date()): boolean {
    const today = now.toDateString();
    return getCognitiveRoutineResults().some(
      (r) => r.completed && new Date(r.timestamp).toDateString() === today
    );
  }
  ```
- verify: `npm run typecheck && npm test -- cognitiveRoutineStorage`
- checkpoint: `git add -A && git commit -m "SP-07: add isTodayRoutineCompleted helper for launch auto-start"`

### Step 3 — App 런치 자동시작 + 프로필 자동 적용 이펙트
- 파일: `src/App.tsx:25-47`
- FROM:
  ```tsx
  export default function App() {
    return (
      <GamificationProvider>
        <BrowserRouter>
          <Suspense fallback={<LoadingFallback />}>
            <Routes>
              {/* Kiosk/tablet mode runs standalone (no app-shell nav, wider layout). */}
              <Route path="/kiosk" element={<KioskHomeScreen />} />
              <Route element={<AppShell />}>
                <Route path="/" element={<HomeScreen />} />
                <Route path="/result" element={<ResultScreen />} />
                <Route path="/lesson" element={<LessonScreen />} />
                <Route path="/garden" element={<GardenScreen />} />
                <Route path="/family" element={<FamilyScreen />} />
                <Route path="/settings" element={<SettingsScreen />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Route>
            </Routes>
          </Suspense>
        </BrowserRouter>
      </GamificationProvider>
    );
  }
  ```
- TO: (import 에 `useEffect`/`useState` 추가, `react-router-dom` 에 `useLocation`/`useNavigate` 추가, `getLearnerProfile`/`isTodayRoutineCompleted` import. `LaunchGate` 자식 컴포넌트를 `BrowserRouter` 내부에 두어 `useLocation`/`useNavigate` 사용. 프로필 자동 적용은 i18n 언어(`memoryGardenLang`) 복원과 함께 effect 로 수행.)
  ```tsx
  function LaunchGate({ children }: { children: React.ReactNode }) {
    const location = useLocation();
    const navigate = useNavigate();
    const { i18n } = useTranslation();

    useEffect(() => {
      const profile = getLearnerProfile();
      // Restore last profile: language + sound feedback gating.
      const savedLang = localStorage.getItem("memoryGardenLang");
      if (savedLang && savedLang !== i18n.language) {
        i18n.changeLanguage(savedLang);
      }
      // Auto-start today's routine: 0-tap entry when on "/" and not done today.
      if (
        profile.autoStartTodayRoutine &&
        location.pathname === "/" &&
        !isTodayRoutineCompleted()
      ) {
        navigate("/lesson", { replace: true });
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return <>{children}</>;
  }

  export default function App() {
    return (
      <GamificationProvider>
        <BrowserRouter>
          <LaunchGate>
            <Suspense fallback={<LoadingFallback />}>
              <Routes>
                {/* Kiosk/tablet mode runs standalone (no app-shell nav, wider layout). */}
                <Route path="/kiosk" element={<KioskHomeScreen />} />
                <Route element={<AppShell />}>
                  <Route path="/" element={<HomeScreen />} />
                  <Route path="/result" element={<ResultScreen />} />
                  <Route path="/lesson" element={<LessonScreen />} />
                  <Route path="/garden" element={<GardenScreen />} />
                  <Route path="/family" element={<FamilyScreen />} />
                  <Route path="/settings" element={<SettingsScreen />} />
                  <Route path="/onboarding" element={<OnboardingScreen />} />
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Route>
              </Routes>
            </Suspense>
          </LaunchGate>
        </BrowserRouter>
      </GamificationProvider>
    );
  }
  ```
  주의: `OnboardingScreen` 은 Step 5 에서 생성(이 단계에서는 lazy import 라인과 라우트만 추가; Step 5 완료 전까지는 `OnboardingScreen` 경로가 미참조 경고 가능 → Step 5 에서 해소). `i18n` 언어 복원은 기존 `memoryGardenLang` 키 사용, `getLearnerProfile` 읽기로 프로필 활성 보장.
- verify: `npm run typecheck && npm run lint && npm test`
- checkpoint: `git add -A && git commit -m "SP-07: launch auto-start to /lesson + restore last profile on mount"`

### Step 4 — Home 을 단일 CTA 로 축소 (5노드 경로·advisory 제거)
- 파일: `src/app/home/HomeScreen.tsx:1-91`
- FROM: (전체 파일. `LessonNode` import `:4`, `mockPathNodes` `:9-15`, advisory 섹션 `:47-59`, 경로+연결선+map `:61-80`, `handleNodePress` `:22-24`, `Sparkles` import `:3` 모두 포함)
- TO: (`mockPathNodes`, `LessonNode` import, `Sparkles` import, `handleNodePress`, advisory 섹션, 경로 map/연결선 제거. 오늘 라벨 + `MascotBubble` greeting(단일 CTA 를 방해하지 않는 위치) + 단일 전폭 `Button3D` CTA 만 남김. hero 카드 색상은 SP-02 가 담당하므로 그대로 유지.)
  ```tsx
  import { useTranslation } from "react-i18next";
  import { useNavigate } from "react-router-dom";
  import { MascotBubble } from "../../components/MascotBubble";
  import { Button3D } from "../../components/Button3D";
  import { getDailyRoutinePlan } from "../../data/dailyRoutinePlan";

  export default function HomeScreen() {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const todayPlan = getDailyRoutinePlan();

    const handleContinue = () => {
      navigate("/lesson");
    };

    return (
      <div data-screen="home" className="flex flex-col items-center justify-center min-h-full py-8 px-4 w-full max-w-md mx-auto">
        <div className="w-full bg-primary-500 rounded-2xl p-6 shadow-card border-2 border-primary-700 mb-8 relative overflow-hidden">
          <div className="relative z-10 flex flex-col gap-2">
            <span className="text-primary-100 font-bold text-sm tracking-wide uppercase">
              {t("home.unitLabel")}
            </span>
            <h1 className="text-2xl font-extrabold text-white">
              {t("home.unitTitle")}
            </h1>
            <p className="text-base font-semibold text-primary-50">
              {t("home.todayRoutineName", { name: t(todayPlan.nameKey) })}
            </p>
          </div>
          <div className="absolute right-[-20px] bottom-[-20px] w-32 h-32 bg-white/10 rounded-full blur-2xl pointer-events-none" />
        </div>

        <div className="mb-8 w-full">
          <MascotBubble
            mood="encouraging"
            message={t("home.mascotGreeting")}
          />
        </div>

        <div className="fixed bottom-[96px] left-0 right-0 px-4 w-full max-w-md mx-auto z-30 pointer-events-none">
          <div className="pointer-events-auto">
            <Button3D variant="primary" size="xl" fullWidth onClick={handleContinue}>
              {t("home.continueButton")}
            </Button3D>
          </div>
        </div>
      </div>
    );
  }
  ```
  주의: `getDailyRoutinePlan` import 유지(Kiosk 공유). 오늘 라벨 키 `home.todayRoutineName`/"오늘은 {{name}} 날이에요" 유지. `LessonNode`/`Sparkles` import 제거로 미사용 import 정리. `Button3D` 에 `size="xl"` 추가(큰 터치 타겟, HL-3/SP-3 정합).
- verify: `npm run typecheck && npm run lint && npm test && npm run build`
- checkpoint: `git add -A && git commit -m "SP-07: collapse Home to single CTA (remove path nodes + advisory)"`

### Step 5 — 짧은 온보딩 first-run 게이트 (2~3단계)
- 파일: 신규 `src/app/onboarding/OnboardingScreen.tsx`, `src/App.tsx`(lazy import 추가)
- FROM: (`src/app/onboarding/OnboardingScreen.tsx` 없음)
- TO: (언어 / 글자 크게 / 입력 방식 3단계. `saveLearnerProfile({ onboarded: true, ... })` 후 `navigate("/", { replace: true })`. 긴 설문 금지, 비의료 카피. `home.continueButton`/`settings.*` 기존 키 재사용 + 신규 `onboarding.*` 키(Step 6) 사용.)
  ```tsx
  import { useState } from "react";
  import { useTranslation } from "react-i18next";
  import { useNavigate } from "react-router-dom";
  import { Button3D } from "../../components/Button3D";
  import { saveLearnerProfile, type PreferredInputMode } from "../../features/profile/learnerProfileStorage";

  const STEPS = ["language", "largeText", "inputMode"] as const;

  export default function OnboardingScreen() {
    const { t, i18n } = useTranslation();
    const navigate = useNavigate();
    const [step, setStep] = useState(0);

    const finish = (preferredInputMode: PreferredInputMode, largeTextMode: boolean) => {
      saveLearnerProfile({ onboarded: true, preferredInputMode, largeTextMode });
      navigate("/", { replace: true });
    };

    // ... 3-step UI: language -> largeText toggle -> inputMode choice -> finish
    // (각 단계 Button3D min-h 유지, 비의료 카피)
  }
  ```
  그리고 `App.tsx` 상단 lazy import 영역에:
  ```tsx
  const OnboardingScreen = lazy(() => import("./app/onboarding/OnboardingScreen"));
  ```
  `LaunchGate`(Step 3)의 effect 에 first-run 분기 추가: `if (!profile.onboarded && location.pathname === "/") { navigate("/onboarding", { replace: true }); return; }` 를 auto-start 분기 **앞**에 배치(온보딩이 자동시작보다 우선).
- verify: `npm run typecheck && npm run lint && npm test`
- checkpoint: `git add -A && git commit -m "SP-07: add short 3-step onboarding first-run gate"`

### Step 6 — 온보딩 + Settings 토글 i18n 키 추가 (3 locale)
- 파일: `src/locales/ko.json`, `src/locales/en.json`, `src/locales/ja.json`
- FROM: (`onboarding` namespace 없음; `settings` 에 `autoStart` 키 없음)
- TO: 각 locale 에:
  - `onboarding.title` / `onboarding.step.languageTitle` / `onboarding.step.largeTextTitle` / `onboarding.step.inputModeTitle` / `onboarding.next` / `onboarding.finish`
  - `settings.autoStartTitle` (ko "시작할 때 바로 오늘 루틴 열기", en "Open today's routine right away on start", ja "起動時に今日のルーティンをすぐ開く")
  - `settings.autoStartOn` / `settings.autoStartOff` (ko "켜기"/"끄기")
  비의료, deficit 프레이밍 없음. ko/en/ja 동기화.
- verify: `npm run typecheck && npm test -- copySafety`
- checkpoint: `git add -A && git commit -m "SP-07: add onboarding + autoStart settings i18n keys (ko/en/ja)"`

### Step 7 — Settings 에 autoStart 토글 추가
- 파일: `src/app/settings/SettingsScreen.tsx:89-104`(데이터 관리 섹션 앞에 신규 섹션 삽입)
- FROM:
  ```tsx
      <section className="bg-white p-6 rounded-3xl border-2 border-gray-200 shadow-sm flex flex-col gap-4">
        <div className="flex items-center gap-3 border-b-2 border-gray-100 pb-4">
          <div className="p-2 bg-red-50 rounded-xl">
            <Shield className="w-6 h-6 text-red-500" />
          </div>
          <h2 className="text-xl font-bold text-ink">{t("settings.dataManagement")}</h2>
        </div>
  ```
- TO: (위 데이터 관리 `<section>` **앞**에 신규 autoStart 섹션 추가. `getLearnerProfile().autoStartTodayRoutine` 초기값 읽기, 토글 시 `saveLearnerProfile({ autoStartTodayRoutine: next })`. 비임상 라벨.)
  ```tsx
      <section className="bg-white p-6 rounded-3xl border-2 border-gray-200 shadow-sm flex flex-col gap-4 mb-6">
        <div className="flex items-center gap-3 border-b-2 border-gray-100 pb-4">
          <div className="p-2 bg-primary-50 rounded-xl">
            <Zap className="w-6 h-6 text-primary-500" />
          </div>
          <h2 className="text-xl font-bold text-ink">{t("settings.autoStartTitle")}</h2>
        </div>
        <div className="flex gap-3">
          <Button3D
            variant={getLearnerProfile().autoStartTodayRoutine ? "primary" : "neutral"}
            className="flex-1"
            onClick={() => saveLearnerProfile({ autoStartTodayRoutine: true })}
          >
            {t("settings.autoStartOn")}
          </Button3D>
          <Button3D
            variant={!getLearnerProfile().autoStartTodayRoutine ? "primary" : "neutral"}
            className="flex-1"
            onClick={() => saveLearnerProfile({ autoStartTodayRoutine: false })}
          >
            {t("settings.autoStartOff")}
          </Button3D>
        </div>
      </section>
  ```
  import 에 `Zap` 추가(`lucide-react`), `getLearnerProfile`/`saveLearnerProfile` import 추가(`learnerProfileStorage`). 토글 후 즉시 반영을 위해 `useState` 로 로컬 상태 보관 권장(버튼 variant 동기화).
- verify: `npm run typecheck && npm run lint && npm test && npm run build`
- checkpoint: `git add -A && git commit -m "SP-07: add autoStart today-routine toggle in Settings"`

### Step 8 — 자동시작/단일 CTA 단정 테스트 추가
- 파일: `src/App.test.tsx`(기존 smoke test 확장), 신규 `src/app/home/HomeScreen.test.tsx`(경로 노드 제거 단정)
- FROM: (`App.test.tsx` smoke + family route 2건만)
- TO: 신규 단정:
  - `App.test.tsx`: `localStorage` 에 `autoStartTodayRoutine:true` 인 `learnerProfile` 세팅 후 `/` 렌더 시 `/lesson` 으로 이동 단정(`isTodayRoutineCompleted` 가 false 인 상태). `autoStartTodayRoutine:false` 시 Home 유지 단정. `onboarded:false` 시 `/onboarding` 이동 단정.
  - `HomeScreen.test.tsx`: 경로 노드(`node_1`~`node_5`) 렌더링 없음 단정, 단일 `home.continueButton`("오늘 루틴 시작하기") 존재 단정, advisory(`home.advisoryTitle`) 미렌더 단정.
  - mock: `isTodayRoutineCompleted`/`getLearnerProfile` 를 `vi.mock` 으로 제어(cognitiveRoutineStorage, learnerProfileStorage).
- verify: `npm test -- App HomeScreen`
- checkpoint: `git add -A && git commit -m "SP-07: add launch auto-start + single-CTA assertion tests"`

## 4. 단계별 테스트

매 단계 공통: `npm run typecheck && npm run lint && npm test && npm run build`.

SP-07 전용 단정:
- `src/App.test.tsx` — `autoStartTodayRoutine=true` & 오늘 미완료 시 `/` → `/lesson` 자동이동(0탭). `autoStartTodayRoutine=false` 시 Home 유지. `onboarded=false` 시 `/onboarding` 진입.
- `src/app/home/HomeScreen.test.tsx` — 경로 노드 5개 미렌더, advisory 카드 미렌더, 단일 `home.continueButton` CTA 존재.
- `src/features/cognitive/cognitiveRoutineStorage.test.ts`(확장) — `isTodayRoutineCompleted` 가 오늘 completed 결과 존재 시 true, 없을 시 false.
- `src/app/settings/SettingsScreen.test.tsx`(신규/확장) — autoStart 토글 켜기/끄기 시 `learnerProfile.autoStartTodayRoutine` 저장값 반영.
- Playwright 스크린샷(ko) — Home 이 단일 큰 CTA 만 표시(5노드 경로 없음) 시각 확인.

## 5. 수용 기준 (high_level_plan HL-7에서)

- `autoStartTodayRoutine=true` 일 때 app 런치 즉시 `/lesson` 진입(0탭). 오늘 이미 완료한 경우 Home 유지.
- Home 이 단일 CTA(5노드 경로/다중 카드 없음). 오늘 라벨 "오늘은 ~하는 날이에요" 유지.
- `onboarded=false` 시 짧은 first-run(2~3단계) 후 진행.
- 런치 시 저장된 프로필 자동 적용(언어, 입력 방식, 글자 크기, 소리 피드백).
- `autoStartTodayRoutine`/`onboarded` 플래그가 더 이상 죽은 코드가 아님(읽는 곳 ≥1).
- Settings 에 비임상 "시작할 때 바로 오늘 루틴 열기" 토글 존재.
- `npm run typecheck`, `npm run lint`, `npm test`, `npm run build` 통과.

## 6. 범위 펜스 (절대 미터치)

- 키오스크 `/kiosk`, `KioskHomeScreen`, `useKioskControls` — `App.tsx:32` 라우트로 연결됨, 그대로 유지. standalone 게이트 밖(본 SP-07 LaunchGate 의 자동이동이 `/kiosk` 경로에 영향 없음 — `location.pathname === "/"` 조건).
- `getDailyRoutinePlan`(`dailyRoutinePlan.ts`) — Home + Kiosk 양쪽 사용, 시그니처/동작 변경 금지(Home import 만 유지).
- 복지관 운영자 대시보드 — 미구현, 별도(`docs/welfare-center-hybrid-plan.md`).
- 일본 현지 보상/캐릭터/기관 — 별도(`docs/japan-localization-research-plan.md`). 일본어 i18n 은 한국 변경사항(Step 6)과 동기화만.
- 식약처/임상 검증 — app 카피 비의료 유지만(온보딩/Settings 라벨에 검사/진단/점수/예방/치료 금지).
- HomeScreen hero 카드 색상(`bg-primary-500`, `text-white`, `text-primary-50`) — SP-02(고대비) 담당. 본 SP-07 은 색 변경 없이 구조/라벨만.
- `KioskHomeScreen` 의 결함(`routine.startButton` raw key, `specifie_plan.md` SP-10) — 키오스크 재작업 시 처리, 본 SP-07 미터치.

## 7. 추가 발견 (보류 — step화 금지)

- `App.tsx` 의 `LaunchGate` 가 `useTranslation().i18n.changeLanguage` 로 언어를 복원하지만, `learnerProfile` 에 언어 필드가 없음(별도 `memoryGardenLang` localStorage 키 사용). 프로필에 `language` 필드 추가 정합은 별도 검토(본 SP-07 범위 밖, 보류).
- `preferredInputMode`/`largeTextMode` 를 "런치 시 자동 적용" 했으나, 이 값을 실제 UI 에 반영하는 글자 크기 scaling / 입력 기본값 적용 로직이 현재 UI 어디에도 연결되어 있지 않음. SP-07 은 값 저장까지만 담당하고, 렌더 반영은 HL-3/SP-3(글자 하한선) 또는 별도 접근성 SP 에서 처리 권장(보류).
- `isTodayRoutineCompleted` 가 `toDateString()`(로컬 날짜) 기준이어 타임존 경계에서 미세 부정확 가능. 서버 동기화/다기기 시나리오는 본 SP-07(단일 기기 전제) 범위 밖(보류).
- `App.test.tsx` 의 family route 테스트가 `localStorage.clear()` 후 `/family` 로 pushState → `onboarded:false` 일 때 first-run 게이트가 `/onboarding` 으로 보낼 수 있어 기존 테스트와 충돌 가능. 테스트 시 `onboarded:true` profile 세팅 필요(Step 8 에서 반영, 충돌 시 보류 아님).

## 8. 롤백 메모

- 각 Step 은 독립 commit 이므로 `git revert <sha>` 로 단계별 롤백 가능.
- Step 3(LaunchGate) 롤백 시 Step 5(onboarding 라우트)가 미참조 lazy import 가 되어 build 경고 → Step 5 도 함께 revert.
- Step 4(Home 단일 CTA) 롤백 시 `LessonNode`/`Sparkles` import 와 `mockPathNodes` 복원 필요(해당 commit 만 revert 하면 자동 복원).
- Step 1(기본값 true) 롤백 시 기존 사용자 localStorage 의 `autoStartTodayRoutine` 이 이미 true 로 저장되어 있을 수 있음 → `learnerProfile` localStorage 삭제 또는 Settings 토글로 false 로 전환 필요.
- 공유 파일(HomeScreen)은 SP-02 와 동시 수정 가능. 충돌 시 구조(Step 4)와 색상(SP-02)을 분리하여 resolve.
