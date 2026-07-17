# SP-08 — 지속 참여 보상 + 마스코트 칭찬

> **AXIS 고정**: 본 파일은 실행 워크플로. 방향·우선순위·수용기준은 `high_level_plan.md` 의 HL-8 와 `specifie_plan.md` 의 SP-08 에 고정된다. 본 파일에서 새 범위를 추가하지 않는다.

| 우선순위 | 의존(선행 SP) | 터치 파일 | 미터치(HL-10) |
|---|---|---|---|
| P1 | SP-02, SP-03 | `src/locales/{ko,en,ja}.json`, `src/components/WeeklyRewardCard.tsx`, `src/components/MascotBubble.tsx`, `src/app/result/ResultScreen.tsx`, `src/features/gamification/useGamification.ts`, `src/features/gamification/rewards.ts`, `src/features/gamification/rewards.test.ts` | 키오스크/복지관대시보드/일본/임상 |

## 0. 목표
죽어 있는 주간 보상 카탈로그(`REWARD_CATALOG`)를 살려 `WeeklyRewardCard`에 렌더하고, 수령(`claimedRewardIds`) 상태를 노출한다. 카탈로그 i18n 키(`weekly.catalog.*`) 3 locale에 추가하여 raw key 노출을 없앤다. 비경쟁 자랑 카드 UI를 구성한다(공개 리더보드 없음). 완료 화면(`ResultScreen`)에 `MascotBubble` 칭찬을 추가한다(칭찬 mood는 SP-03 소유 `praising` 선행 필요). `recordWeeklyCompletion` + `addReward(weekly_completion/streak_milestone)` 이벤트를 실제로 발생시키고, 점수형 `rewards.ts` 죽은 코드를 정리(연결 또는 삭제)한다. raw 인지 점수 미노출 원칙은 유지.

## 1. 현재 구현 (소스 재확인 결과)
- **카탈로그 죽음(치명)**: `src/features/gamification/weeklyRewards.ts:24-43` `REWARD_CATALOG`(garden_sticker/welfare_coupon/praise_card)가 정의되어 있으나 grep 결과 컴포넌트에서 import하는 곳 **0건**(weeklyRewards.test.ts만 참조). `claimedRewardIds`(`weeklyRewards.ts:48`) 필드는 존재하나 어디에서도 push/읽기 안 됨. `recordWeeklyCompletion`(`weeklyRewards.ts:88-96`)는 Result에서 호출되지 않음(`ResultScreen.tsx:14-22` effect는 `completeSession()`만 호출).
- **WeeklyRewardCard 단순**: `src/components/WeeklyRewardCard.tsx:11-35` completedDays 수만 표시. catalogNote(`:30-32`) 한 줄만 렌더. 카탈로그 아이템 렌더 없음, 수령 표시 없음. 자랑 카드 UI 없음.
- **i18n 누락**: `src/locales/ko.json:56-61` weekly에 title/completedDays/catalogNote/bragCard만. `weekly.catalog.*`(stickerTitle/Body, couponTitle/Body, praiseTitle/Body) **3 locale 전부 없음**. `weekly.bragCard`(`ko.json:60`)는 존재하나 참조 컴포넌트 0건. `en.json:56-61`/`ja.json:56-61` 동일 구조.
- **마스코트 칭찬 없음**: `src/app/result/ResultScreen.tsx:1-9` MascotBubble import 안 함. MascotBubble은 Home(`HomeScreen.tsx:75` mood="encouraging")/Lesson(`LessonScreen.tsx:95` mood="calm")에만 사용. `MascotBubble.tsx:4` mood union = `"happy"|"thinking"|"encouraging"|"calm"` — `praising` 없음(SP-03 소유).
- **이벤트 미발생(치명)**: `src/features/gamification/useGamification.ts:64-66` `addReward(event)` 정의는 있으나 **호출 0건**(completeSession `:59-62`은 flat `addGardenReward('session_complete')`만). `gardenProgress.ts:9-14` RewardEvent에 weekly_completion/streak_milestone 지원되나 UI 발생 없음.
- **rewards.ts 죽은 코드**: `src/features/gamification/rewards.ts:1-20` `calculateExerciseReward`/`calculateSessionCompletionReward`(점수형)는 보상 흐름에 연결 안 됨. `rewards.test.ts:6-13`만 참조. "점수 불필요" 정합성 위반.
- **양호**: 점수 미노출(`ResultScreen.tsx:43-61` streak/물방울만, raw 점수 없음). 리더보드 없음(`GardenScreen.tsx` 전체). `WeeklyRewardCard.tsx:9-10` 주석 "Never ranks the learner against others".
- **멘토 갭 정리**: 카탈로그 렌더 부재, i18n 키 부재, 자랑 카드 UI 부재, Result 칭찬 부재, 보상 이벤트 부재, 죽은 rewards.ts.

## 2. 전제 / 선행 작업
- **SP-02(고대비 토큰) 선행**: WeeklyRewardCard의 amber/orange/ink className, Result 배경(surface-warm), MascotBubble praising(amber) 스타일이 SP-2 웜 토큰(amber-700/800, surface-warm, ink)에 의존. SP-2 토큰이 먼저 깔려야 className이 유효.
- **SP-03(MascotBubble praising) 선행 — 공유 파일 주의**: `MascotBubble.tsx` mood union에 `praising` 추가, praising 스타일(`bg-amber-50 border-amber-300`), `aria-live` 추가는 **SP-03 소유**. 본 SP-08의 Result 칭찬 step은 SP-03이 `praising` mood를 추가한 이후에 동작한다. SP-03이 완료되기 전이면 mood를 `"happy"`로 임시 사용 가능(단 최종 상태는 `praising`). MascotBubble.tsx를 양쪽이 동시 수정하지 않도록 SP-03 먼저 병합.
- **공유 파일**: `MascotBubble.tsx`(SP-03 동시 수정 위험 → 본 SP-08은 MascotBubble.tsx를 직접 편집하지 않고 소비만), `useGamification.ts`(독점), `WeeklyRewardCard.tsx`(독점), locale JSON(S-1과 동기화 필요하나 동일 weekly namespace라 충돌 적음).

## 3. 작업 워크플로

### Step 1 — 카탈로그 i18n 키 3 locale 추가
- 파일: `src/locales/ko.json:60`, `src/locales/en.json:60`, `src/locales/ja.json:60`
- FROM (ko):
```json
    "catalogNote": "복지관에서 받을 수 있는 작은 보상은 운영 기관이 정해요.",
    "bragCard": "이번 주 기억 루틴 {{count}}일 완료"
  },
```
- TO (ko): `catalogNote` 아래에 `catalog` 객체 추가
```json
    "catalogNote": "복지관에서 받을 수 있는 작은 보상은 운영 기관이 정해요.",
    "bragCard": "이번 주 기억 루틴 {{count}}일 완료",
    "catalog": {
      "stickerTitle": "기억 정원 스티커",
      "stickerBody": "이번 주 이어하기를 모으면 정원에 붙일 스티커를 받아요.",
      "couponTitle": "복지관 작은 교환권",
      "couponBody": "운영 기관이 정한 작은 교환권(예: 쓰레기봉투 등)을 받을 수 있어요.",
      "praiseTitle": "칭찬 카드",
      "praiseBody": "이번 주 노력을 칭찬하는 카드를 받아요."
    }
  },
```
- en: 동일 구조(stickerTitle "Garden memory sticker" / stickerBody "...", couponTitle "Small exchange coupon", couponBody "A small exchange coupon (e.g. trash bag) set by the operating organization.", praiseTitle "Praise card", praiseBody "A card celebrating this week's effort.")
- ja: 동일 구조(stickerTitle "記憶の庭シール" / couponTitle "福祉施設の小さな引換券" / couponBody "運営機関が決めた小さな引換券（例：ゴミ袋など）を受け取れます。" / praiseTitle "ほめるカード" / praiseBody "今週のがんばりをほめるカードを受け取ります。")
- verify: `npm run typecheck && npm test -- rewards weeklyRewards`
- checkpoint: `git add -A && git commit -m "SP-08: add weekly.catalog.* i18n keys (ko/en/ja)"`

### Step 2 — WeeklyRewardCard 카탈로그 렌더 + 수령 표시
- 파일: `src/components/WeeklyRewardCard.tsx:1-35`
- FROM:
```tsx
import { useTranslation } from "react-i18next";
import { Award } from "lucide-react";

export interface WeeklyRewardCardProps {
  completedDays: number;
  className?: string;
}
```
- TO:
```tsx
import { useTranslation } from "react-i18next";
import { Award, Check } from "lucide-react";
import { REWARD_CATALOG, getWeeklyRewardState } from "../features/gamification/weeklyRewards";

export interface WeeklyRewardCardProps {
  completedDays: number;
  className?: string;
}
```
그리고 section 내부(`:30-32` catalogNote 한 줄)를 카탈로그 리스트로 교체:
- FROM (본문):
```tsx
      <p className="text-sm font-medium leading-relaxed text-amber-800">
        {t("weekly.catalogNote")}
      </p>
    </section>
```
- TO (본문):
```tsx
      <ul className="flex flex-col gap-2">
        {REWARD_CATALOG.map((item) => {
          const claimed = getWeeklyRewardState().claimedRewardIds.includes(item.id);
          return (
            <li
              key={item.id}
              className="flex items-start gap-2 rounded-xl bg-white p-3 border-2 border-amber-200"
            >
              <div className="mt-0.5 shrink-0 text-amber-600">
                {claimed ? <Check className="h-5 w-5" aria-hidden="true" /> : <Award className="h-5 w-5" aria-hidden="true" />}
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="text-base font-bold text-ink">{t(item.titleKey)}</span>
                <span className="text-sm font-medium leading-relaxed text-amber-900">{t(item.descriptionKey)}</span>
              </div>
            </li>
          );
        })}
      </ul>
      <p className="text-sm font-medium leading-relaxed text-amber-800">
        {t("weekly.catalogNote")}
      </p>
    </section>
```
- verify: `npm run typecheck && npm test -- rewards weeklyRewards`
- checkpoint: `git add -A && git commit -m "SP-08: render REWARD_CATALOG + claimedRewardIds in WeeklyRewardCard"`

### Step 3 — 자랑 카드 UI (공유/복사, 비경쟁)
- 파일: `src/components/WeeklyRewardCard.tsx`(section 내, 카탈로그 리스트 위 completedDays 아래에 삽입)
- 행동: `weekly.bragCard`(`{{count}}` 보간)로 자랑 카드 블록 렌더 + 공유 버튼(Web Share API, 미지원 시 clipboard 복사). 공개 리더보드 아님(개인 카드 공유만).
- TO(삽입 블록, completedDays `<p>` 아래):
```tsx
      <div className="flex items-center justify-between gap-3 rounded-xl bg-amber-100 border-2 border-amber-300 p-3">
        <span className="text-base font-bold text-amber-900">{t("weekly.bragCard", { count: completedDays })}</span>
        <button
          type="button"
          className="min-h-[48px] rounded-xl bg-white border-2 border-amber-400 px-4 text-sm font-bold text-amber-900 active:scale-[0.97]"
          onClick={() => {
            const text = t("weekly.bragCard", { count: completedDays });
            if (navigator.share) {
              navigator.share({ text }).catch(() => {});
            } else {
              navigator.clipboard?.writeText(text).catch(() => {});
            }
          }}
        >
          {t("weekly.bragCardShare", { defaultValue: "자랑하기" })}
        </button>
      </div>
```
(`weekly.bragCardShare` 키를 3 locale에 추가 — ko "자랑하기" / en "Share" / ja "シェア". 동일 Step에서 locale 추가.)
- verify: `npm run typecheck && npm test`
- checkpoint: `git add -A && git commit -m "SP-08: add brag card UI with share/clipboard (no leaderboard)"`

### Step 4 — Result 마스코트 칭찬 추가 (SP-03 praising 선행)
- 파일: `src/app/result/ResultScreen.tsx:1-35`
- FROM (import + 상단):
```tsx
import { Button3D } from "../../components/Button3D";
import { WeeklyRewardCard } from "../../components/WeeklyRewardCard";
```
- TO (import 추가):
```tsx
import { Button3D } from "../../components/Button3D";
import { WeeklyRewardCard } from "../../components/WeeklyRewardCard";
import { MascotBubble } from "../../components/MascotBubble";
```
h1(`:33-35`) 아래에 MascotBubble 칭찬 삽입:
- TO(h1 직후):
```tsx
        <h1 className="text-4xl font-extrabold text-primary-800 text-center drop-shadow-sm">
          {t("result.title")}
        </h1>

        <MascotBubble mood="praising" message={t("result.mascotPraise")} />
```
- **SP-03 의존**: `mood="praising"`은 SP-03이 `MascotBubble.tsx` mood union에 `praising`을 추가한 후에만 typecheck 통과. SP-03 미완 시 임시로 `mood="happy"` 사용(주석 표기). MascotBubble.tsx 자체는 본 SP-08에서 편집하지 않음(충돌 방지).
- verify: `npm run typecheck`(SP-03 praising 머지 후) `&& npm test`
- checkpoint: `git add -A && git commit -m "SP-08: add MascotBubble praising to ResultScreen"`

### Step 5 — result.mascotPraise i18n 키 3 locale 추가
- 파일: `src/locales/ko.json:230`, `src/locales/en.json:230`, `src/locales/ja.json:230`
- FROM (ko):
```json
    "points": "오늘 모은 물방울: {{points}}",
    "done": "마치기"
  },
```
- TO (ko):
```json
    "points": "오늘 모은 물방울: {{points}}",
    "mascotPraise": "오늘도 멋지게 해내셨어요! 매일 이어갈수록 뇌가 한 뼘 더 깨어요.",
    "done": "마치기"
  },
```
- en: `"mascotPraise": "You did wonderfully today! Each day you keep going, your brain wakes up a little more."`
- ja: `"mascotPraise": "今日もすてきにやり遂げました！毎日続けるほど、脳が少しずつ目を覚まします。"`
- verify: `npm run typecheck && npm test`
- checkpoint: `git add -A && git commit -m "SP-08: add result.mascotPraise i18n keys (ko/en/ja)"`

### Step 6 — recordWeeklyCompletion + 보상 이벤트 연결 (useGamification)
- 파일: `src/features/gamification/useGamification.ts:1-16,59-66`
- FROM (import):
```tsx
import {
  type GardenState, addGardenReward, type RewardEvent, initialGardenState
} from "./gardenProgress";
```
- TO (import + weeklyRewards 함수):
```tsx
import {
  type GardenState, addGardenReward, type RewardEvent, initialGardenState
} from "./gardenProgress";
import { recordWeeklyCompletion, getCompletedDaysThisWeek } from "./weeklyRewards";
import { getCognitiveRoutineResults } from "../cognitive/cognitiveRoutineStorage";
```
completeSession(`:59-62`) 확장:
- FROM:
```tsx
  const completeSession = useCallback(() => {
    setStreakState(prev => updateStreak(prev));
    setGardenReward(prev => addGardenReward(prev, "session_complete"));
  }, []);
```
- TO:
```tsx
  const completeSession = useCallback(() => {
    setStreakState(prev => {
      const next = updateStreak(prev);
      // streak_milestone: 3/7/14/30일 도달 시 정원 나무 성장
      if ([3, 7, 14, 30].includes(next.currentStreak)) {
        setGardenState(g => addGardenReward(g, "streak_milestone"));
      }
      return next;
    });
    setGardenState(prev => addGardenReward(prev, "session_complete"));

    // weekly_completion: 7일 윈도 내 완료 일수가 1일→다음 임계(예 3,5,7) 도달 시 꽃
    const before = getCompletedDaysThisWeek(getCognitiveRoutineResults()).length;
    recordWeeklyCompletion();
    const after = before + 1; // 오늘 완료 반영 가정(같은 날 중복 시 recordWeeklyCompletion이 멱등)
    if ([3, 5, 7].includes(after)) {
      setGardenState(g => addGardenReward(g, "weekly_completion"));
    }
  }, []);
```
- verify: `npm run typecheck && npm test`
- checkpoint: `git add -A && git commit -m "SP-08: fire weekly_completion/streak_milestone in completeSession"`

### Step 7 — 죽은 점수형 rewards.ts 정리 (삭제)
- 파일: `src/features/gamification/rewards.ts:1-20`, `src/features/gamification/rewards.test.ts:1-13`(전체)
- 행동: 점수형 `calculateExerciseReward`/`calculateSessionCompletionReward`는 보상 흐름에 연결되지 않고 "점수 불필요" 정합성 위반 → 삭제. `rewards.test.ts`도 함께 삭제(참조 0건, grep 확인).
- FROM: 두 파일 존재
- TO: 두 파일 삭제 (`git rm src/features/gamification/rewards.ts src/features/gamification/rewards.test.ts`)
- verify: `npm run typecheck && npm run lint && npm test && npm run build`(삭제 후 잔여 참조 없음 단정)
- checkpoint: `git add -A && git commit -m "SP-08: remove dead score-based rewards.ts (score-not-needed alignment)"`

## 4. 단계별 테스트
- 매 step: `npm run typecheck && npm run lint && npm test && npm run build`.
- SP-08 전용 단정(신규 테스트 파일 `src/features/gamification/weeklyRewardsCatalog.test.ts` 제안):
  - `REWARD_CATALOG`의 모든 `titleKey`/`descriptionKey`가 3 locale(ko/en/ja)에 존재 → raw key 미노출 단정(i18n 로드 후 키 조회).
  - `recordWeeklyCompletion` 호출 후 `claimedRewardIds`/`completedDays`가 갱신되는지 단정(기존 `weeklyRewards.test.ts:42-43` 확장).
  - `useGamification.completeSession()` 호출 시 streak 3/7/14/30 도달 → gardenState.treeLevel 증가(streak_milestone) 단정.
  - completeSession 후 completedDaysThisWeek가 3/5/7 임계 도달 → gardenState.flowers 증가(weekly_completion) 단정.
  - rewards.ts 삭제 후 `import ... from "./rewards"` 잔여 0건 단정(grep 기반).
- 시각 확인: Playwright 스크린샷(ko/en/ja) Result/Garden에서 raw i18n key 카탈로그/칭찬이 모두 번역되어 표시되는지 확인(raw key 노출 0).

## 5. 수용 기준 (high_level_plan HL-8에서)
- Result에 마스코트 칭찬 표시(`result.mascotPraise` + MascotBubble praising).
- 주간 보상 카탈로그가 렌더되고 i18n 키(`weekly.catalog.*`)가 3 locale에 존재(raw key 미노출).
- raw 인지 점수 미노출 유지(streak/물방울/참여일수만).
- 자랑 카드 UI 존재(공개 리더보드 없음 — 개인 카드 공유만).
- `weekly_completion`/`streak_milestone` 보상 이벤트가 실제 발생(gardenState.flowers/treeLevel 반영).
- 점수형 죽은 rewards.ts 정리(삭제) — "점수 불필요" 정합성.

## 6. 범위 펜스 (절대 미터치)
- 키오스크 `/kiosk`, `KioskHomeScreen`, `useKioskControls` — 라우트 연결됨, 그대로 유지.
- 복지관 운영자 대시보드 — 미구현, 별도(`docs/welfare-center-hybrid-plan.md`).
- 일본 현지 보상/캐릭터/기관 — 별도(`docs/japan-localization-research-plan.md`); 일본어 i18n은 한국 카탈로그/칭찬 키와 동기화만.
- 식약처/임상 검증 — app 카피 비의료 유지만(raw 점수/진단/검사/예방/치료 카피 금지).
- `MascotBubble.tsx` 본체 편집(mood union praising 추가, aria-live, encouraging 빨간 틴트 제거) — SP-03 소유, 본 SP-08은 소비만.
- 공식 MMSE/MoCA/CIST 문항·컷오프 복제 금지(카탈로그/칭찬 카피에 검사/진단/점수 토큰 사용 금지).

## 7. 추가 발견 (보류 — step화 금지)
- `weeklyRewards.ts:24-43` 카탈로그에 복지 모드 `welfare_coupon`이 존재하나 실물 재고/교환권 발급은 운영 기관 영역. SP-08은 구조만 표면 노출(실물 풀필먼트는 HL-10 복지관 과제). 실물 토큰(예 쓰레기봉투) 하드코딩은 미수행(미검증 데이터 금지 원칙).
- `WeeklyRewardCard`의 `getWeeklyRewardState()`를 렌더 시마다 호출하면 매 렌더마다 localStorage 읽기 발생. 성능 최적화(컴포넌트 상단 useMemo/prop 주입)는 별도 리팩터 후보 — 본 SP-08 범위 아님(보류).
- 자랑 카드 공유 시 `navigator.share` 미지원 환경 폴백(이미지 캡처/캔버스)은 SP-08 범위 아님(텍스트 복사 폴백만).
- Result `bg-primary-50`(`ResultScreen.tsx:31`) 배경을 `surface-warm`으로 변경은 SP-02 소유 — 본 SP-08에서 미터치.

## 8. 롤백 메모
- 각 step은 독립 commit이므로 `git revert <sha>`로 단계별 롤백 가능.
- Step 6(useGamification completeSession 확장)은 streak/weekly 임계 로직이 들어가 가장 영향 범위가 큼. 롤백 시 completeSession을 원래 flat `session_complete` 1건으로 복원. 임계값(3/5/7, 3/7/14/30)은 운영 데이터 기반 조정 가능하므로 상수화 권장(별도 리팩터).
- Step 7(rewards.ts 삭제)은 되돌리면 점수형 보상이 다시 죽은 코드로 부활 — "점수 불필요" 정책과 충돌. 삭제 확정 전 rewards.test.ts 외 참조 0건을 grep으로 재확인 후 삭제.
- Step 2/3(WeeklyRewardCard 카탈로그/자랑 카드)는 SP-02 웜 className(amber/ink)에 의존. SP-02가 롤백되면 카드 스타일이 토큰 미정의로 깨질 수 있음 → SP-02 먼저 확정.
- Step 4(Result MascotBubble)는 SP-03 praising mood에 의존. SP-03 롤백 시 `mood="praising"`이 type error → 임시 `happy`로 강등.
- locale JSON(ko/en/ja weekly + result)은 SP-1(copySafety 확장)과 동일 namespace 공유. 충돌 시 JSON 병합 주의.
