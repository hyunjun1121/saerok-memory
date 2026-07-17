# SP-01 — Result 뇌활성화 동기부여 카피 + copySafety 확장(support/family GLOBAL_BANS)

> **AXIS 고정**: 본 파일은 실행 워크플로. 방향·우선순위·수용기준은 `high_level_plan.md` 의 HL-1 와 `specifie_plan.md` 의 SP-01 에 고정된다. 본 파일에서 새 범위를 추가하지 않는다.

| 우선순위 | 의존(선행 SP) | 터치 파일 | 미터치(HL-10) |
|---|---|---|---|
| P1 | 없음(단, SP-02/SP-08 이 ResultScreen.tsx 공동 편집) | `src/locales/ko.json`, `src/locales/en.json`, `src/locales/ja.json`, `src/locales/copySafety.test.ts`, `src/app/result/ResultScreen.tsx`(encouragement `<p>` 라인만), `src/features/family/familySupportSummary.ts` | 키오스크/복지관대시보드/일본/임상 |

## 0. 목표
Result(완료) 화면에 멘토가 요청한 "매일 하시면 뇌가 활성화돼요" 혜택 동기부여 카피를 3 locale에 추가하고 렌더한다. `copySafety.test.ts` 의 검사를 `support`/`family` namespace까지 `GLOBAL_BANS`(공식 검사명)로 확장하고, 동기부여 키(`result.encouragement`)가 3 locale에 존재 + '뇌' 토큰을 포함함을 단정한다. 보호자 encouragement도 streak 카운트 대신 뇌 활성화 혜택 문구로 혜택화한다.

## 1. 현재 구현 (소스 재확인 결과)

- **`src/locales/copySafety.test.ts:13-27`** — `LEARNER_NAMESPACES` = navigation/home/lesson/result/exercise/routine/speech/weekly/choice/feedback/topbar/garden/common(12개). **`support`, `family` 제외** 확인.
- **`src/locales/copySafety.test.ts:30-42`** — `GLOBAL_BANS` = `["mmse","moca","cist","k-mmse","ad8","gpcog","tics","sage","slums","ace-iii","medical-grade"]`. 현재 learner namespace에만 적용되고, support/family namespace는 GLOBAL_BANS 검사 대상 아님.
- **`src/locales/copySafety.test.ts:45-49`** — `LEARNER_BANS.ko = ["검사","스크리닝","선별","진단","위험도","치매 위험","점수"]` 등.
- **`src/locales/copySafety.test.ts:78-116`** — `describe("learner-facing copy safety")` 는 (a) 각 locale learner copy의 GLOBAL_BANS+LEARNER_BANS 검사, (b) 3 locale top-level key 동일성 단정. **support/family 전용 GLOBAL_BANS 검사 없음**. **`result.encouragement` 존재 단정 없음**.
- **`src/locales/ko.json:226-231`** — `result` = title/streak/points/done **4개만**. encouragement 없음. (en.json:226-231, ja.json:226-231 동일 구조.)
- **`src/app/result/ResultScreen.tsx:33-35`** — `<h1 className="text-4xl font-extrabold text-primary-800 ...">{t("result.title")}</h1>` 만 있고, 그 아래 title과 이미지(37-40) 사이에 encouragement 문구 부재. streak/물방울만(43-57). **멘토 갭: "영양제 안 먹어도 뇌가 활성화" 혜택 메시지 전무.**
- **`src/features/family/familySupportSummary.ts:130-135`** — `encouragement` = `participation.completed >= 3 ? {key:"weekly.completedDays",...} : {key:"family.summaryEmpty"}`. streak/완료 카운트 기반이라 혜택(뇌 활성화) 메시지 아님. `family.encouragementBrainActive` 키는 3 locale 전부 부재.
- **`src/locales/ko.json:64`** — `support.body` 가 "진단이나 선별 결과가 아니에요" 포함. 이는 support namespace가 LEARNER_NAMESPACES 밖이라 LEARNER_BANS(진단/선별)에 걸리지 않지만(보호자 문맥 허용), 공식 도구명(MMSE 등) 누출은 현재 잡히지 않음.

## 2. 전제 / 선행 작업
- 의존 SP: 없음. 단독 실행 가능.
- **공유 파일 조정 주의(중요)**: `src/app/result/ResultScreen.tsx` 는 SP-02(배경/대비, `bg-primary-50` → `bg-surface-warm` 등)와 SP-08(Result 마스코트 칭찬 `<MascotBubble>` 추가)도 편집한다. **본 SP-01은 ResultScreen.tsx에서 encouragement `<p>` 라인 추가(타이틀 아래, 마스코트 자리는 건드리지 않음)만 터치**하고, bg className·마스코트 컴포넌트는 건드리지 않는다. 충돌 회피를 위해 본 SP의 ResultScreen 편집은 title `</h1>` 직후 1줄 삽입으로 최소화.
- 비의료 카피 유지: "뇌가 활성화돼요"는 혜택/동기부여 표현이지 검사/진단/점수가 아님 → LEARNER_BANS(검사/진단/위험도/점수)에 해당하지 않음. 다만 copySafety 통과 여부는 Step 7에서 verify.

## 3. 작업 워크플로

### Step 1 — ko.json result namespace에 encouragement 키 추가
- 파일: `src/locales/ko.json:226-231`
- FROM:
```
  "result": {
    "title": "오늘 루틴 완료!",
    "streak": "연속 참여: {{streak}}일",
    "points": "오늘 모은 물방울: {{points}}",
    "done": "마치기"
  },
```
- TO:
```
  "result": {
    "title": "오늘 루틴 완료!",
    "encouragement": "매일 이어갈수록 뇌가 활성화돼요. 작은 루틴이 큰 힘이 됩니다.",
    "streak": "연속 참여: {{streak}}일",
    "points": "오늘 모은 물방울: {{points}}",
    "done": "마치기"
  },
```
- verify: `npm run typecheck` (JSON 정합)
- checkpoint: `git add -A && git commit -m "SP-01: add result.encouragement (ko)"`

### Step 2 — en.json result namespace에 encouragement 키 추가
- 파일: `src/locales/en.json:226-231`
- FROM:
```
  "result": {
    "title": "Today's Routine Complete!",
    "streak": "Participation streak: {{streak}} day(s)",
    "points": "Drops collected today: {{points}}",
    "done": "Finish"
  },
```
- TO:
```
  "result": {
    "title": "Today's Routine Complete!",
    "encouragement": "A little each day keeps your brain active. Small routines add up.",
    "streak": "Participation streak: {{streak}} day(s)",
    "points": "Drops collected today: {{points}}",
    "done": "Finish"
  },
```
- verify: `npm run typecheck`
- checkpoint: `git add -A && git commit -m "SP-01: add result.encouragement (en)"`

### Step 3 — ja.json result namespace에 encouragement 키 추가
- 파일: `src/locales/ja.json:226-231`
- FROM:
```
  "result": {
    "title": "今日のルーティン完了！",
    "streak": "連続参加：{{streak}}日",
    "points": "今日集めたしずく：{{points}}",
    "done": "終わる"
  },
```
- TO:
```
  "result": {
    "title": "今日のルーティン完了！",
    "encouragement": "毎日続けると、脳が少しずつ活性化します。小さなルーティンが大きな力に。",
    "streak": "連続参加：{{streak}}日",
    "points": "今日集めたしずく：{{points}}",
    "done": "終わる"
  },
```
- verify: `npm run typecheck`
- checkpoint: `git add -A && git commit -m "SP-01: add result.encouragement (ja)"`

### Step 4 — family.encouragementBrainActive 키 3 locale 추가 (보호자 혜택화용)
- 파일: `src/locales/ko.json`(family 내), `src/locales/en.json`(family 내), `src/locales/ja.json`(family 내)
- ko FROM(`ko.json:248` 부근 `summaryEmpty` 라인 인접): `"summaryEmpty": "아직 공유할 활동 기록이 없습니다. 꾸준히 연습해보세요!",`
- ko TO(해당 라인 아래에 신규 키 추가):
```
    "summaryEmpty": "아직 공유할 활동 기록이 없습니다. 꾸준히 연습해보세요!",
    "encouragementBrainActive": "매일 이어가면 뇌가 활성화되는 흐름이에요.",
```
- en FROM(`en.json:248`): `"summaryEmpty": "There is no activity to share yet. Keep practicing gently.",`
- en TO:
```
    "summaryEmpty": "There is no activity to share yet. Keep practicing gently.",
    "encouragementBrainActive": "Keeping it up each day helps the brain stay active.",
```
- ja FROM(`ja.json:248`): `"summaryEmpty": "まだ共有できる活動記録はありません。無理なく続けてみましょう。",`
- ja TO:
```
    "summaryEmpty": "まだ共有できる活動記録はありません。無理なく続けてみましょう。",
    "encouragementBrainActive": "毎日続けると、脳が活性化する流れになります。",
```
- verify: `npm run typecheck && npm test -- copySafety` (top-level key 동일성 단정 통과해야 함 — 3 locale 모두 같은 키 추가하므로 OK)
- checkpoint: `git add -A && git commit -m "SP-01: add family.encouragementBrainActive (ko/en/ja)"`

### Step 5 — ResultScreen.tsx에 encouragement `<p>` 렌더 (title 아래만 터치)
- 파일: `src/app/result/ResultScreen.tsx:33-35`
- FROM:
```
        <h1 className="text-4xl font-extrabold text-primary-800 text-center drop-shadow-sm">
          {t("result.title")}
        </h1>
```
- TO:
```
        <h1 className="text-4xl font-extrabold text-primary-800 text-center drop-shadow-sm">
          {t("result.title")}
        </h1>

        <p className="text-center text-lg font-bold text-ink">
          {t("result.encouragement")}
        </p>
```
- verify: `npm run typecheck && npm test` (ResultScreen 관련 스냅샷/렌더 테스트 통과 확인)
- checkpoint: `git add -A && git commit -m "SP-01: render result.encouragement on Result screen"`
- **공유 파일 주의**: 본 step은 title `</h1>` 직후에만 삽입. 아래쪽 배경(`bg-primary-50`, SP-02 영역)과 마스코트 자리(SP-08 영역)는 건드리지 않는다. className은 `text-ink`(SP-2 웜/ink 고대비 체계 정합)를 사용하되, SP-02 미병합 시에도 `text-ink` 토큰은 이미 `tokens.css`에 존재하므로 깨지지 않음.

### Step 6 — familySupportSummary.ts encouragement 혜택화 (streak → 뇌 활성화)
- 파일: `src/features/family/familySupportSummary.ts:130-135`
- FROM:
```
  const encouragement: ReportCopyItem =
    participation.completed >= 3
      ? { key: "weekly.completedDays", values: { count: participation.completed } }
      : participation.completed > 0
        ? { key: "family.summaryEmpty" }
        : { key: "family.summaryEmpty" };
```
- TO:
```
  const encouragement: ReportCopyItem =
    participation.completed >= 3
      ? { key: "family.encouragementBrainActive" }
      : participation.completed > 0
        ? { key: "weekly.completedDays", values: { count: participation.completed } }
        : { key: "family.summaryEmpty" };
```
- verify: `npm run typecheck && npm test -- familySupportSummary` (encouragement 분기 단정이 있다면 갱신)
- checkpoint: `git add -A && git commit -m "SP-01: family encouragement uses brain-active benefit at >=3 completions"`
- **의도**: 완료 3회 이상(꾸준함 신호)일 때 뇌 활성화 혜택 메시지 우선. 1~2회는 기존 streak 카운트 유지, 0회는 기존 empty. 멘토 "매일 하시면 뇌가 활성화" 이행.

### Step 7 — copySafety.test.ts: support/family namespace GLOBAL_BANS 검사 추가
- 파일: `src/locales/copySafety.test.ts:78-116`(기존 describe 블록 끝, `});` 직전에 신규 `it` 추가)
- FROM(기존 describe 닫기 전):
```
  it("all three locales share the same set of top-level keys", () => {
    const koKeys = Object.keys(ko).sort();
    const enKeys = Object.keys(en).sort();
    const jaKeys = Object.keys(ja).sort();
    expect(enKeys).toEqual(koKeys);
    expect(jaKeys).toEqual(koKeys);
  });
});
```
- TO(동일 describe 내에 두 번째 `it` 추가 후 닫기):
```
  it("all three locales share the same set of top-level keys", () => {
    const koKeys = Object.keys(ko).sort();
    const enKeys = Object.keys(en).sort();
    const jaKeys = Object.keys(ja).sort();
    expect(enKeys).toEqual(koKeys);
    expect(jaKeys).toEqual(koKeys);
  });

  // SP-01: support and family namespaces are not learner-facing, so
  // LEARNER_BANS (clinical framing) are allowed there contextually, but the
  // GLOBAL_BANS (official instrument names / medical-grade claims) must never
  // leak into any user-facing copy.
  it("support and family namespaces contain no official test names (GLOBAL_BANS)", () => {
    const SCAN_NAMESPACES = ["support", "family"];
    const cases: { locale: Locale; data: Record<string, unknown> }[] = [
      { locale: "ko", data: ko },
      { locale: "en", data: en },
      { locale: "ja", data: ja },
    ];
    const offenders: string[] = [];
    for (const { locale, data } of cases) {
      const leaves: { path: string; value: string }[] = [];
      for (const ns of SCAN_NAMESPACES) {
        if (data[ns] !== undefined) {
          collectLeaves(data[ns], ns, leaves);
        }
      }
      for (const { path, value } of leaves) {
        const lowered = value.toLowerCase();
        for (const ban of GLOBAL_BANS) {
          if (lowered.includes(ban)) {
            offenders.push(`${locale} ${path}: "${value}" (contains "${ban}")`);
          }
        }
      }
    }
    expect(offenders, offenders.join("\n")).toEqual([]);
  });
});
```
- verify: `npm test -- copySafety`
- checkpoint: `git add -A && git commit -m "SP-01: scan support/family namespaces against GLOBAL_BANS"`

### Step 8 — copySafety.test.ts: 동기부여 키 존재 + '뇌' 토큰 단정 추가
- 파일: `src/locales/copySafety.test.ts`(Step 7에서 추가한 `it` 직후, 동일 describe 내)
- FROM: Step 7 TO 끝(`});` 닫는 줄 직전 위치)
- TO(Step 7의 `it` 뒤에 세 번째 `it` 추가):
```
  // SP-01 / HL-1: the brain-activation motivation copy must exist in every
  // locale and carry the benefit token ("brain" / "뇌" / "脳").
  it("result.encouragement exists in all locales and mentions the brain benefit", () => {
    const tokenByLocale: Record<Locale, string[]> = {
      ko: ["뇌"],
      en: ["brain"],
      ja: ["脳"],
    };
    const cases: { locale: Locale; data: Record<string, unknown> }[] = [
      { locale: "ko", data: ko },
      { locale: "en", data: en },
      { locale: "ja", data: ja },
    ];
    for (const { locale, data } of cases) {
      const result = data.result as Record<string, unknown> | undefined;
      expect(result, `${locale} missing result namespace`).toBeDefined();
      const encouragement = result?.encouragement;
      expect(typeof encouragement, `${locale} result.encouragement missing`).toBe("string");
      const text = (encouragement as string) ?? "";
      const hit = tokenByLocale[locale].some((tok) => text.includes(tok));
      expect(hit, `${locale} result.encouragement lacks brain token: "${text}"`).toBe(true);
    }
  });
});
```
- verify: `npm test -- copySafety`
- checkpoint: `git add -A && git commit -m "SP-01: assert result.encouragement brain-benefit token in 3 locales"`

## 4. 단계별 테스트
- 매 step: `npm run typecheck`
- Step 4/7/8 후: `npm test -- copySafety`
- Step 5 후: `npm test`(ResultScreen 렌더/스냅샷 회귀)
- 최종 게이트: `npm run typecheck && npm run lint && npm test && npm run build`
- **SP-01 전용 단정(신규)**:
  - `copySafety.test.ts`: "support and family namespaces contain no official test names (GLOBAL_BANS)" — support/family에서 mmse/moca/cist 등 누출 시 실패(Step 7).
  - `copySafety.test.ts`: "result.encouragement exists in all locales and mentions the brain benefit" — `result.encouragement` 부재 시 실패, '뇌'/'brain'/'脳' 토큰 누락 시 실패(Step 8).
- **수동 확인(권장)**: Playwright 스크린샷 ko/en/ja로 Result 화면의 encouragement 문구 표시 + raw key("result.encouragement") 미노출 확인.

## 5. 수용 기준 (high_level_plan HL-1에서)
- Result에 뇌 활성화 동기부여 문구가 표시된다(`result.encouragement` 3 locale + ResultScreen 렌더).
- `copySafety`가 `support`/`family` namespace까지 GLOBAL_BANS(공식 검사명)를 검사한다(누출 시 실패).
- 동기부여 키가 3 locale에 존재 + 뇌 혜택 토큰을 포함한다(단정 추가).
- learner 화면 카피는 "검사/스크린/선별/진단/위험도/점수"를 회피한 비의료 포지셔닝을 유지한다(기존 LEARNER_BANS 회귀 없음).
- `npm run typecheck && npm run lint && npm test && npm run build` 통과.

## 6. 범위 펜스 (절대 미터치)
- 키오스크 `/kiosk`, `KioskHomeScreen`, `useKioskControls` — 라우트 연결됨, 그대로 유지(별도: `KioskHomeScreen`의 `routine.startButton` raw-key 결함도 이번엔 수정 X).
- 복지관 운영자 대시보드 — 미구현, 별도(`docs/welfare-center-hybrid-plan.md`).
- 일본 현지 보상/캐릭터/기관 — 별도(`docs/japan-localization-research-plan.md`). 일본어 i18n은 본 SP의 한국 변경사항과 동기화만(ja.json의 `result.encouragement`/`family.encouragementBrainActive` 추가 포함).
- 식약처/임상 검증 — app 카피 비의료 유지만.
- **공유 파일 ResultScreen.tsx**: 본 SP는 encouragement `<p>` 라인(Step 5)만 터치. 배경 `bg-primary-50`→warm(SP-02), 마스코트 `<MascotBubble>` 추가(SP-08)는 미터치.
- `LEARNER_BANS`(진단/선별/점수 등)를 support/family에 적용하지 않는다(보호자 문맥에서 허용되므로; specifie_plan SP-01 명시). support/family에는 GLOBAL_BANS(공식 도구명)만 적용.

## 7. 추가 발견 (보류 — step화 금지)
- `support.body`(`ko.json:64`)가 "진단이나 선별 결과가 아니에요"를 포함. 이는 의도적 부정문(비의료 선언)이나, 향후 support 카피 전반의 톤 정비(부정문 대신 긍정적 안내)가 별도 SP에서 검토 가능. 본 SP에서는 GLOBAL_BANS 검사만 추가하고 문구 자체는 손대지 않음.
- `family.advisory.levels.needsConversation` = "상담 대화 준비" 등 보호자 라벨이 비임상 양호하나, SP-09(advisory 보수화)와 연계 검토 필요 — 본 SP 범위 아님.
- `result` namespace에 mascotPraise 키(SP-08 예정)와 weekly catalog 키(SP-08 예정)가 아직 없음 — 본 SP에서는 encouragement만 추가, 나머지는 SP-08 범위.

## 8. 롤백 메모
- 각 step은 독립 commit이므로 `git revert <sha>` 로 단계별 롤백 가능.
- Step 5(ResultScreen.tsx)는 SP-02/SP-08과 동일 파일을 공유하므로, SP-02/SP-08 병합 후 revert 시 해당 SP들의 변경사항과 충돌 주의. revert 시 encouragement `<p>` 블록만 선택적 제거.
- Step 7/8(copySafety.test.ts)은 신규 `it` 추가이므로, 기존 learner copy safety 테스트에 영향 없음. revert 안전.
- Step 4(family.encouragementBrainActive 3 locale 추가)는 Step 6(familySupportSummary.ts)이 해당 키를 참조하므로, Step 6만 먼저 revert하면 미사용 키가 되어도 typecheck/test에 영향 없음(raw key 미노출).
