# SP-02 — 노안 고대비 컬러 시스템 (FOUNDATION)

> **AXIS 고정**: 본 파일은 실행 워크플로. 방향·우선순위·수용기준은 `high_level_plan.md` 의 HL-2 와 `specifie_plan.md` 의 SP-02 에 고정된다. 본 파일에서 새 범위를 추가하지 않는다.

| 우선순위 | 의존(선행 SP) | 터치 파일 | 미터치(HL-10) |
|---|---|---|---|
| P0 | 없음 | `src/styles/tokens.css`, `tailwind.config.ts`, `src/components/Button3D.tsx`, `src/components/LessonNode.tsx`, `src/components/FeedbackTray.tsx`, `src/app/home/HomeScreen.tsx`, `src/app/result/ResultScreen.tsx` | 키오스크/복지관대시보드/일본/임상 |

## 0. 목표
멘토 1순위 시각 결함(흰 글씨 on 저명도 녹/청 = WCAG AA FAIL)을 cream+ink+amber 웜 고대비 체계로 치환한다. `Button3D` primary/secondary/danger 가 AA(4.5:1, 큰 텍스트 3:1)를 통과하도록 토큰을 추가하고 className을 재정의하며, Home hero·LessonNode·Result 배경을 웜/ink 체계로 통일한다. 본 섹션은 색/토큰 기반이므로 SP-03(글자/터치)·SP-04(피드백)보다 **먼저** 수행한다.

## 1. 현재 구현 (소스 재확인 결과)
- **토큰** `src/styles/tokens.css:7-18`: `--color-primary-500 #58bd2f`, `--color-primary-400 #70cf42`, `--color-primary-700 #34731f`, `--color-blue-500 #1cb0f6`, `--color-blue-600 #0c84d6`. **`blue-400` 토큰 없음** → secondary hover `hover:bg-blue-400`가 깨짐. amber 토큰 전무.
- **이미 있는 웜 고대비 토큰(미사용)** `tokens.css:24-32`: `--color-ink #2b2f33`, `--color-surface-warm #fffaf0`, `--color-background-warm #fdf8ef`, `--color-orange-500 #ff9600`. 멘토 갭: 이 토큰이 존재하나 핵심 CTA가 이걸 쓰지 않음.
- **body 배경 차냉** `tokens.css:51-52`: `body { @apply bg-[#f7f8fb] ... }` — warm 토큰 미사용.
- **Button3D 치명** `src/components/Button3D.tsx:33-38`: primary `bg-primary-500 text-white`(2.4:1 FAIL), secondary `bg-blue-500 text-white hover:bg-blue-400`(2.44:1 FAIL, blue-400 미정의), danger `bg-red-500 text-white`(3.3:1 FAIL).
- **HomeScreen hero** `src/app/home/HomeScreen.tsx:32` hero 카드 `bg-primary-500`; `:37` h1 `text-white`; `:40` 서브 `text-primary-50`(primary-500 위 2.6:1 FAIL). 멘토 갭: hero 전체가 FAIL 조합.
- **LessonNode** `src/components/LessonNode.tsx:35-39` completed/current `bg-primary-500 ... text-white`; `:45` current `ring-4 ring-primary-200` 헤일로(저명도 녹). 멘토 갭: 완료/현재 노드가 FAIL.
- **FeedbackTray correct** `src/components/FeedbackTray.tsx:28-30`: `bg-primary-50 text-primary-800` + icon `text-primary-500`(dark-on-light 8.7:1 PASS, 양호 — 패턴 유지). 단 icon만 `text-primary-500` on `bg-primary-50` = 3.1:1 경계 → `text-primary-700`(5.4:1)로 강화(AXIS SP-02 수정계획 8).
- **ResultScreen 배경** `src/app/result/ResultScreen.tsx:31`: 전면 `bg-primary-50`(연녹 wash). 멘토 갭: 웜 체계 정합 위배.
- **공유 파일 주의**: `Button3D`는 SP-03(aria-pressed), SP-04(tap 피드백)도 터치. 본 섹션에서는 **색/shadow/bg className만** 변경하고, `aria-pressed`/`onClick tap`은 SP-03/SP-04에 양보. `ResultScreen` 배경은 SP-08(mascot 칭찬)도 터치 → 본 섹션은 bg className만.

## 2. 전제 / 선행 작업
- **deps: 없음.** 색 토큰 기반 작업이므로 가장 먼저.
- **공유 파일 조정**: `Button3D.tsx` — 본 섹션은 `variantClasses` 객체(색/shadow/bg)만 수정. `aria-pressed`(`Button3D.tsx:46-57` button element)는 SP-03, `onClick` 내 `tap()` 연결은 SP-04에서. 충돌 회피를 위해 각 step 은 독립 commit.
- `tokens.css` body 규칙과 `src/index.css`(vendor/landing, purple `#aa3bff`)는 별개 → `index.css` 건드리지 않음(AXIS SP-02 명시).

## 3. 작업 워크플로

### Step 1 — amber 토큰 추가 (tokens.css)
- 파일: `src/styles/tokens.css:22`(`--color-red-600` 라인 직후, `--color-purple-500:23` 앞)
- FROM:
```
    --color-red-600: #d6332a;
    --color-purple-500: #ce82ff;
```
- TO:
```
    --color-red-600: #d6332a;
    --color-amber-700: #b35900;
    --color-amber-800: #8f4400;
    --color-amber-50: #fff7e6;
    --color-purple-500: #ce82ff;
```
- verify: `npm run typecheck` (Tailwind JIT가 `amber-*` arbitrary class를 위해 토큰 참조 가능한지 build 단계에서 확인)
- checkpoint: `git add -A && git commit -m "SP-02: add amber-700/800/50 contrast tokens"`

### Step 2 — body 배경 warm 전환 (tokens.css)
- 파일: `src/styles/tokens.css:51-52`
- FROM:
```
  body {
    @apply bg-[#f7f8fb] text-ink antialiased;
```
- TO:
```
  body {
    @apply bg-[var(--color-background-warm)] text-ink antialiased;
```
- verify: `npm run build` (warm `#fdf8ef` 적용, 차냉 `#f7f8fb` 제거)
- checkpoint: `git add -A && git commit -m "SP-02: switch body background to warm #fdf8ef"`

### Step 3 — tailwind.config amber 매핑 추가
- 파일: `tailwind.config.ts:27`(`ink: "#2b2f33",` 라인 후)
- FROM:
```
        ink: "#2b2f33",
      },
```
- TO:
```
        ink: "#2b2f33",
        amber: {
          50: "#fff7e6",
          700: "#b35900",
          800: "#8f4400",
        },
      },
```
- verify: `npm run typecheck && npm run build` (`bg-amber-50`/`border-amber-800` 등 JIT 클래스 생성 확인)
- checkpoint: `git add -A && git commit -m "SP-02: map amber tokens in tailwind config"`

### Step 4 — Button3D primary/secondary/danger 재정의
- 파일: `src/components/Button3D.tsx:33-38`
- FROM:
```
    primary:
      "border-2 border-primary-700 bg-primary-500 text-white shadow-[0_5px_0_var(--color-primary-700)] hover:bg-primary-400",
    secondary:
      "border-2 border-blue-600 bg-blue-500 text-white shadow-[0_5px_0_var(--color-blue-600)] hover:bg-blue-400",
    danger:
      "border-2 border-red-600 bg-red-500 text-white shadow-[0_5px_0_var(--color-red-600)] hover:bg-red-400",
```
- TO:
```
    primary:
      "border-2 border-amber-800 bg-orange-500 text-white shadow-[0_5px_0_var(--color-amber-800)] hover:bg-[#c46200]",
    secondary:
      "border-2 border-ink bg-[var(--color-surface-warm)] text-ink shadow-[0_5px_0_var(--color-ink)] hover:bg-amber-50",
    danger:
      "border-2 border-[#a8281f] bg-red-600 text-white shadow-[0_5px_0_#a8281f] hover:bg-[#b82a21]",
```
- verify: `npm run typecheck && npm test` (기존 Button3D 스냅샷/렌더 테스트 통과; 대비: 흰 글씨 on orange-500 = 6.17:1 PASS, 흰 글씨 on red-600 `#d6332a` = 4.81:1 PASS, cream+ink secondary = 12.96:1 AAA)
- checkpoint: `git add -A && git commit -m "SP-02: Button3D primary/secondary/danger to AA-pass warm palette"`

### Step 5 — HomeScreen hero 웜/ink 체계
- 파일: `src/app/home/HomeScreen.tsx:32` (hero 카드), `:40` (서브 텍스트)
- FROM (`:32`):
```
      <div className="w-full bg-primary-500 rounded-2xl p-6 shadow-card border-2 border-primary-700 mb-8 relative overflow-hidden">
```
- TO (`:32`):
```
      <div className="w-full bg-primary-700 rounded-2xl p-6 shadow-card border-2 border-amber-800 mb-8 relative overflow-hidden">
```
- FROM (`:40`):
```
          <p className="text-base font-semibold text-primary-50">
```
- TO (`:40`):
```
          <p className="text-base font-semibold text-primary-100">
```
- verify: `npm run typecheck && npm test` (h1 `text-white` on primary-700 = 5.8:1 PASS 유지; 서브 primary-100 on primary-700 = 6.9:1 PASS)
- checkpoint: `git add -A && git commit -m "SP-02: HomeScreen hero to primary-700/amber border, fix sub-text contrast"`

### Step 6 — LessonNode completed/current 웜 체계 + cream 헤일로
- 파일: `src/components/LessonNode.tsx:35-39` (completed block), `:43-50` (current block)
- FROM (`:35-39` completed):
```
    completed: {
      bg: "bg-primary-500",
      border: "border-primary-700",
      shadow: "shadow-[0_6px_0_var(--color-primary-700)]",
      text: "text-white",
      defaultIcon: <Check size={28} strokeWidth={3} />,
      animate: false,
    },
```
- TO (`:35-39` completed):
```
    completed: {
      bg: "bg-primary-700",
      border: "border-amber-800",
      shadow: "shadow-[0_6px_0_var(--color-amber-800)]",
      text: "text-white",
      defaultIcon: <Check size={28} strokeWidth={3} />,
      animate: false,
    },
```
- FROM (`:43-50` current):
```
    current: {
      bg: "bg-primary-500",
      border: "border-primary-700 ring-4 ring-primary-200 ring-offset-2",
      shadow: "shadow-[0_6px_0_var(--color-primary-700)]",
      text: "text-white",
      defaultIcon: <Star size={28} strokeWidth={2.5} fill="currentColor" />,
      animate: true,
    },
```
- TO (`:43-50` current):
```
    current: {
      bg: "bg-primary-700",
      border: "border-amber-800 ring-4 ring-[var(--color-surface-warm)] ring-offset-2",
      shadow: "shadow-[0_6px_0_var(--color-amber-800)]",
      text: "text-white",
      defaultIcon: <Star size={28} strokeWidth={2.5} fill="currentColor" />,
      animate: true,
    },
```
- verify: `npm run typecheck && npm test` (흰 글씨 on primary-700 = 5.8:1 PASS; cream 헤일로로 분리 강화)
- checkpoint: `git add -A && git commit -m "SP-02: LessonNode completed/current to primary-700 with cream halo"`

### Step 7 — ResultScreen 배경 warm 전환
- 파일: `src/app/result/ResultScreen.tsx:31`
- FROM:
```
    <div data-screen="result" className="flex flex-col items-center justify-between min-h-[100dvh] pt-12 pb-8 px-6 bg-primary-50">
```
- TO:
```
    <div data-screen="result" className="flex flex-col items-center justify-between min-h-[100dvh] pt-12 pb-8 px-6 bg-[var(--color-surface-warm)]">
```
- verify: `npm run typecheck && npm test` (연녹 wash `bg-primary-50` → cream `#fffaf0`; `:37` 보라/`:44` orange border는 SP-08 범위이므로 본 step 은 bg만)
- checkpoint: `git add -A && git commit -m "SP-02: ResultScreen background to warm surface cream"`

### Step 8 — FeedbackTray correct/memory icon 대비 강화
- 파일: `src/components/FeedbackTray.tsx:30` (correct icon), `:48` (memory icon)
- FROM (`:30`):
```
      icon: <CheckCircle2 className="text-primary-500 w-8 h-8" strokeWidth={2.5} />,
```
- TO (`:30`):
```
      icon: <CheckCircle2 className="text-primary-700 w-8 h-8" strokeWidth={2.5} />,
```
- FROM (`:48`):
```
      icon: <CheckCircle2 className="text-blue-500 w-8 h-8" strokeWidth={2.5} />,
```
- TO (`:48`):
```
      icon: <CheckCircle2 className="text-ink w-8 h-8" strokeWidth={2.5} />,
```
- verify: `npm run typecheck && npm test` (correct icon primary-700 on primary-50 = 5.4:1 PASS; memory icon ink on blue-50 = AAA. dark-on-light 패턴 유지)
- checkpoint: `git add -A && git commit -m "SP-02: FeedbackTray correct/memory icon contrast to AA"`

## 4. 단계별 테스트
- 매 step: `npm run typecheck && npm run lint && npm test && npm run build`.
- **SP-02 전용 단정(권장 추가)**: 색 토큰/className 존재 단정. 예: `Button3D.test.tsx`(없으면 신규)에서 primary 렌더 시 className이 `bg-orange-500`·`border-amber-800` 포함, secondary가 `text-ink` 포함, `blue-500`/`bg-primary-500 text-white`(FAIL 조합)이 primary/secondary에서 부재 단정.
- **대비 수치 단정**: primary(흰 글씨 on orange-500) ≥ 4.5:1, danger(흰 글씨 on red-600) ≥ 4.5:1, secondary(ink on surface-warm) ≥ 4.5:1 — `specifie_plan.md` 부록 B 기준. (색상 hex → 명도 계산은 별도 유틸 또는 수동 검증표로 단정.)
- Playwright 스크린샷(ko/en/ja)으로 hero·Result·Button3D 시각 확인(AXIS 부록 B).

## 5. 수용 기준 (high_level_plan HL-2에서)
- `Button3D` primary/secondary/danger 가 WCAG AA(일반 4.5:1, 큰 텍스트 3:1) 통과.
- 흰 글씨 on 저명도 녹/청 조합이 핵심 CTA에서 사라짐.
- body 배경이 warm 계열(`#fdf8ef`).
- `blue-400` 미정의 hover 문제 해결(secondary에서 blue 제거로 소멸).
- FeedbackTray의 dark-on-light 양호 패턴 유지.

## 6. 범위 펜스 (절대 미터치)
- 키오스크 `/kiosk`, `KioskHomeScreen`, `useKioskControls` — 라우트 연결됨, 그대로 유지(HL-10/SP-10).
- 복지관 운영자 대시보드 — 미구현, 별도(`docs/welfare-center-hybrid-plan.md`).
- 일본 현지 보상/캐릭터/기관 — 별도(`docs/japan-localization-research-plan.md`). 일본어 i18n은 한국 변경사항과 동기화만(본 섹션은 색 토큰이라 i18n 무관).
- 식약처/임상 검증 — app 카피 비의료 유지만(HL-1).
- `src/index.css`(vendor/landing purple) — app 디자인과 무관, 건드리지 않음.
- 공식 MMSE/MoCA/CIST 문항·컷오프 복제 금지(본 섹션 무관하나 AXIS 원칙).
- `Button3D` 의 `aria-pressed`(SP-03), `onClick tap()`(SP-04) — 본 섹션은 색/shadow/bg 만.
- `ResultScreen` 의 mascot 칭찬/보상 카드(SP-08) — 본 섹션은 bg className 만.

## 7. 추가 발견 (보류 — step화 금지)
- `tokens.css:46-48` `--button-bg`/`--button-border`/`--button-shadow` 가 primary-500/700 기반으로 정의되어 있으나 실제 참조 컴포넌트 미확인(SP-02 범위 밖). 웜 체계로의 재정의는 별도 조사 후.
- `tokens.css:33` `--focus-ring` 이 `rgba(88,189,47,...)`(primary-500) 기반. 키보드 포커스 링 색도 웜 정합 검토 가치 있으나 접근성 focus 토큰은 별도 검증 필요 → 보류.
- `tailwind.config.ts:23-26` `duoBlue/duoYellow/duoOrange/duoRed` 별칭이 Duolingo 잔재. 사용처 스캔 후 통합 여부는 별도(SP-02 범위 밖).
- `LessonNode.tsx:59-66` review_due `bg-purple-500 text-white`(저명도 보라, 대비 경계)도 웜 정합 대상이나 AXIS SP-02는 completed/current만 명시 → 보류.

## 8. 롤백 메모
- 각 step 은 독립 commit 이므로 `git revert <sha>` 로 단계별 롤백 가능.
- Step 1(amber 토큰)·Step 3(tailwind 매핑)은 다른 step 의 선행 의존 — revert 시 자식 step 부터 역순으로(Step 8 → 1).
- Step 4(Button3D)는 `hover:bg-[#c46200]`/`hover:bg-amber-50` arbitrary 값을 쓰므로 Step 1/3 선행 필수. Step 1/3 없이 Step 4 만 revert 시 `amber-50`/`amber-800` 미정의로 build break.
- Step 2(body warm)는 전역 시각 변화 — revert 시 차냉 배경 복귀(기능 영향 없음).
