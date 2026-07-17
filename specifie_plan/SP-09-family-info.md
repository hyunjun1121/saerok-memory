# SP-09 — 보호자/상담사 정보 분리 강화 + 치매안심센터 자원 카드

> **AXIS 고정**: 본 파일은 실행 워크플로. 방향·우선순위·수용기준은 `high_level_plan.md` 의 HL-9 와 `specifie_plan.md` 의 SP-09 에 고정된다. 본 파일에서 새 범위를 추가하지 않는다.

| 우선순위 | 의존(선행 SP) | 터치 파일 | 미터치(HL-10) |
|---|---|---|---|
| P1 | 없음 | `src/features/family/haruAdvisory.ts`, `src/features/family/familySupportSummary.ts`, `src/app/family/FamilyScreen.tsx`, `src/data/supportResources.ts`, `src/features/family/haruAdvisory.test.ts`, `src/app/family/FamilyScreen.test.tsx` | 키오스크/복지관대시보드/일본/임상 |

## 0. 목표

보호자 탭이 상담사 `report.*` 객체 대신 `familySummary.*` 만 표시하도록 의존을 단절한다. 멘토 지적대로 caregiver 관찰 1건 `oftenDifferent` 가 즉시 `needsConversation` 으로 점등되는 현상을 `watch` 로 강등하고, `needsConversation` 은 30일 내 ≥2건의 `oftenDifferent`(또는 ≥2 도메인)에서만 발생하도록 보수화한다. 자원 카드도 동일한 "반복 걱정(≥2)" 게이트 아래에서만 점등되도록 한다. 검증된 치매안심센터 자원 1건 이상을 `lastVerifiedAt` + `sourceUrl` + 대표전화 + 홈페이지와 함께 입력하되, 미검증 데이터는 하드코딩하지 않는다. 공산품 비의료 카피(검사/진단/점수/예방/치료 금지)와 공식 MMSE/MoCA/CIST 문항·컷오프 복제 금지 원칙을 유지한다.

## 1. 현재 구현 (소스 재확인 결과)

- `src/features/family/haruAdvisory.ts:392-408` `addObservationSignals` — 도메인별 가장 강한 응답(`strongestByDomain`)을 모으고, `:394`에서 `const level: HaruAdvisoryLevel = response === "oftenDifferent" ? "needsConversation" : "watch";` 로 매핑. caregiver 관찰 1건 `oftenDifferent` 가 **즉시** `level:"needsConversation"`, `weight:2`. `:130-143` `deriveOverallLevel`는 `hasConversationSignal || weightedTotal>=4`면 전체를 needsConversation. → 멘토 갭(치명 2): 단일 관찰로 needsConversation 발생.
- `src/features/family/familySupportSummary.ts:91-108` `shouldShowSupportResource` — `:96-98`에서 `if (advisoryLevel === "needsConversation") { return true; }` 로 **무조건** 단락. `:100-107`의 30일 ≥2 `oftenDifferent` 분기는 있으나 needsConversation 단락이 먼저라 도달 불가. → 멘토 갭(치명 3): 단일 관찰로 자원 카드 점등, "반복 걱정" 위반.
- `src/app/family/FamilyScreen.tsx:272-293` 보호자(family) 탭 metric 타일 — `:275` `report.routineTrend.completedThisWindow`, `:280` `report.overview.lastPracticeDate`, `:285` `report.dueMemoryCount`, `:290` `report.shareableMemoryCount` 로 **상담사 `report` 객체**에서 읽음. `familySummary`(`:83-88`)는 같이 계산되나 encouragement/conversationStarters/showSupportResource(`:309,311,325`)에만 사용. → 멘토 갭(갭 1): 보호자 탭이 상담사 report 경유.
- `src/features/family/familySupportSummary.ts:23-33` `FamilySupportSummary` 인터페이스 — `completedThisWeek`, `attemptedThisWeek`, `hasRecentActivity`, `lastPracticeDate`, `shareableMemoryCount`, `conversationStarters`, `encouragement`, `showSupportResource` 보유. **`dueMemoryCount` 없음**(보호자용엔 복습 카운트 노출 의도적 제외, 양호). 보호자 탭 전환 시 `report.dueMemoryCount`(`:285`)와 `familySummary.dueMemoryCount`(없음) 불일치 → 타일을 familySummary 체계로 재구성 필요.
- `src/data/supportResources.ts:26-36` `getVerifiedSupportResources` — catalog가 **의도적 비어 있음**(placeholder 주석만). `:33-35` filter가 `lastVerifiedAt && sourceUrl` 요구 → 항상 빈 배열. → 멘토 갭(갭 4): `SupportResourceCard`(`:55-58`)가 항상 `support.pending` placeholder. `:13-22` 인터페이스는 `representativePhone`, `homepageUrl`, `lastVerifiedAt`, `sourceUrl`, `region` 필드 준비됨.
- `src/components/SupportResourceCard.tsx:20-22` — `resource.lastVerifiedAt && resource.sourceUrl` 로 다시 1차 필터(이중 검증, 양호). `:66-79` 전화/홈페이지 렌더 준비됨.
- `src/features/family/haruAdvisory.test.ts:36-116` — 1건 `appointments: oftenDifferent` 관찰이 routine 메타데이터와 합쳐져 needsConversation 되는 케이스를 단정(`:91`). `:118-137` 단일 저조 회상 → watch 단정(SP-08 보수화). 본 SP-09 는 **단일 `oftenDifferent` 관찰만으로 needsConversation** 되는 케이스 보수화 단정이 누락됨.

## 2. 전제 / 선행 작업

- **의존(deps): 없음.** SP-09 는 독립 실행 가능.
- **공유 파일 조정 주의**:
  - `supportResources.ts` + `SupportResourceCard.tsx` 는 `/family`(`FamilyScreen.tsx:28,89,326`)에 연결되어 SP-10 범위. **삭제 금지**, 데이터만 채운다.
  - `familySupportSummary.ts` 도 `/family`(`:26-27,83`)에 연결, SP-10 미터치 파일. 인터페이스 확장 시 기존 필드 호환 유지.
  - `FamilyScreen.tsx` 탭 버튼(`:204-233`)은 SP-03(min-h)도 터치. 본 SP-09 는 metric 타일 영역(`:272-293`)만, 탭 버튼 className 은 건드리지 않는다(SP-03 영역).
  - `haruAdvisory.ts` 는 `caregiverReport.ts`(`:611-616`)와 `familySupportSummary.ts`(`:123-128`) 양쪽에서 import. 보수화 변경은 상담사 탭 advisory(`FamilyScreen.tsx:532-581`)에도 동일 적용됨 — 상담사 탭은 추가 컨텍스트(activityHighlights/observation 레코드)가 있으므로 정합.

## 3. 작업 워크플로

### Step 1 — caregiver 관찰 단일 oftenDifferent → watch 강등 (보수화 핵심)
- 파일: `src/features/family/haruAdvisory.ts:394`
- FROM: `    const level: HaruAdvisoryLevel = response === "oftenDifferent" ? "needsConversation" : "watch";`
- TO: `    const level: HaruAdvisoryLevel = "watch"; // SP-09: a single caregiver observation is only a watch cue. needsConversation is reserved for repeated (>=2) often-different observations or compound signals — never from one observation.`
- verify: `npm run typecheck && npx vitest run src/features/family/haruAdvisory.test.ts`
- checkpoint: `git add -A && git commit -m "SP-09: demote single often-different caregiver observation to watch"`

### Step 2 — 반복(≥2) 관찰에서만 needsConversation 승격 로직 추가
- 파일: `src/features/family/haruAdvisory.ts` (`addObservationSignals` 내, `:392` forEach 직전에 집계 추가 후 level 산출에서 반영)
- FROM:
```
  strongestByDomain.forEach((response, observationDomain) => {
    const domain = OBSERVATION_DOMAIN_MAP[observationDomain];
    const level: HaruAdvisoryLevel = "watch";
    addSignal(signals, {
      domain,
      level,
      weight: level === "needsConversation" ? 2 : 1,
```
- TO: `strongestByDomain` 에서 `oftenDifferent` 인 도메인 수를 먼저 세고, ≥2 면 해당 signal 들을 needsConversation(weight 2)로, 아니면 watch(weight 1)로 일괄 산정.
```
  const repeatedOftenDifferentDomains = [...strongestByDomain.entries()].filter(
    ([response]) => response === "oftenDifferent",
  );
  const hasRepeatedConcern = repeatedOftenDifferentDomains.length >= 2;

  strongestByDomain.forEach((response, observationDomain) => {
    const domain = OBSERVATION_DOMAIN_MAP[observationDomain];
    // SP-09: needsConversation only from a repeated (>=2) often-different concern.
    const level: HaruAdvisoryLevel =
      response === "oftenDifferent" && hasRepeatedConcern ? "needsConversation" : "watch";
    addSignal(signals, {
      domain,
      level,
      weight: level === "needsConversation" ? 2 : 1,
```
- verify: `npx vitest run src/features/family/haruAdvisory.test.ts` (Step 1 + 2 동작 단정: 단일 oftenDifferent → watch, 2개 → needsConversation)
- checkpoint: `git add -A && git commit -m "SP-09: needsConversation only from >=2 repeated often-different observations"`

### Step 3 — 자원 카드 게이트: needsConversation 무조건 단락 제거
- 파일: `src/features/family/familySupportSummary.ts:96-98`
- FROM:
```
  if (advisoryLevel === "needsConversation") {
    return true;
  }

  const cutoff = now.getTime() - 30 * ONE_DAY_MS;
```
- TO: needsConversation 단락을 제거하고, 단일 공통 게이트(30일 내 ≥2건 oftenDifferent)로 통일. advisory 가 needsConversation 이더라도 반복 관찰이 없으면 표시하지 않는다.
```
  // SP-09: the support resource card is offered only when there is a repeated
  // (>=2) caregiver concern in the last 30 days — never from a single session,
  // even if the advisory level reached needsConversation via compound signals.
  const cutoff = now.getTime() - 30 * ONE_DAY_MS;
```
- verify: `npx vitest run src/app/family/FamilyScreen.test.tsx src/features/family/haruAdvisory.test.ts`
- checkpoint: `git add -A && git commit -m "SP-09: gate support resource card on repeated (>=2) concerns only"`

### Step 4 — 보호자 탭 metric 타일을 familySummary.* 로 전환
- 파일: `src/app/family/FamilyScreen.tsx:272-293`
- FROM: 4개 타일이 `report.routineTrend.completedThisWindow`, `report.overview.lastPracticeDate`, `report.dueMemoryCount`, `report.shareableMemoryCount` 를 읽음.
- TO: 보호자 탭 전용 값으로 교체. `completedThisWeek` → `familySummary.completedThisWeek`; `lastPracticeDate` → `familySummary.lastPracticeDate`; `shareableMemoryCount` → `familySummary.shareableMemoryCount`. **`dueMemoryCount` 타일은 제거**(familySummary 에는 복습 카운트가 없음 — 의도적 경량화와 정합). 타일 grid를 `grid-cols-3` 로 축소하거나 3개 타일(이번 주 완료 / 최근 활동일 / 공유 기억)만 유지. 상담사 report 의존 제거 확인.
  - `:275`: `{report.routineTrend.completedThisWindow}` → `{familySummary.completedThisWeek}`
  - `:280`: `{formatDate(report.overview.lastPracticeDate)}` → `{formatDate(familySummary.lastPracticeDate)}`
  - `:283-287` `dueMemoryCount` 타일 블록 전체 제거
  - `:290`: `{report.shareableMemoryCount}` → `{familySummary.shareableMemoryCount}`
- verify: `npm run typecheck && npx vitest run src/app/family/FamilyScreen.test.tsx`
- checkpoint: `git add -A && git commit -m "SP-09: family tab reads familySummary only, drop dueMemory tile"`

### Step 5 — hasData 단정에서 report 의존 정리 (Step 4 부수 정합)
- 파일: `src/app/family/FamilyScreen.tsx:91-94`
- FROM:
```
  const hasData =
    report.overview.completedRoutines > 0 ||
    report.overview.dueMemoryCount > 0 ||
    report.overview.shareableMemoryCount > 0;
```
- TO: 보호자 탭 표시 여부도 familySummary 기반으로 정합(dueMemoryCount 제거 반영).
```
  const hasData =
    familySummary.completedThisWeek > 0 ||
    familySummary.shareableMemoryCount > 0;
```
- verify: `npm run typecheck && npx vitest run src/app/family/FamilyScreen.test.tsx`
- checkpoint: `git add -A && git commit -m "SP-09: family tab hasData flag from familySummary"`

### Step 6 — 검증된 치매안심센터 자원 1건 입력
- 파일: `src/data/supportResources.ts:27-31`
- FROM:
```
  const catalog: SupportResource[] = [
    // Placeholder entries intentionally omitted. Populate only after verifying
    // against an official source (e.g. 한국치매안심센터 통합정보시스템) and setting
    // lastVerifiedAt + sourceUrl on each entry.
  ];
```
- TO: 1건 `dementiaSafetyCenter` 입력. **출처는 실제 운영기관 공식 정보로만 채운다** — 본 워크플로에서는 placeholder 값 없이 TODO 표기와 함께 검증 절차를 명시만 하고, 검증 전에는 filter 가 걸러 표시되지 않도록 `lastVerifiedAt`/`sourceUrl` 없이 두지 않는다(즉 검증 완료 전까지는 카드 미표시 상태 유지, 미검증 하드코딩 금지). 검증 완료 시점에만 아래 값 채움:
```
  const catalog: SupportResource[] = [
    // SP-09: Populate ONLY after verifying against an official source
    // (한국치매안심센터 통합정보시스템, https://www.nid.or.kr). Until then the
    // filter below keeps this entry off any user-facing card. Do NOT hard-code
    // a phone number or URL before verification.
    //
    // {
    //   id: "kr_national_dementia_center",
    //   resourceType: "dementiaSafetyCenter",
    //   name: "치매안심센터 (한국치매안심센터 통합정보시스템)",
    //   region: "대한민국",
    //   representativePhone: "<verified 대표 전화>",
    //   homepageUrl: "<verified 공식 홈페이지>",
    //   lastVerifiedAt: "<ISO date after manual verification>",
    //   sourceUrl: "<traceable official source URL>",
    // },
  ];
```
- verify: `npm run typecheck && npx vitest run src/app/family/FamilyScreen.test.tsx` (검증 전에는 SupportResourceCard 가 여전히 pending placeholder 표시, raw 전화번호 노출 없음 단정)
- checkpoint: `git add -A && git commit -m "SP-09: document verified dementia safety center entry path (no unverified data)"`

### Step 7 — 단위 테스트: 단일 관찰 → watch, 반복 → needsConversation, 자원 카드 반복 게이트
- 파일: `src/features/family/haruAdvisory.test.ts` (신규 `it` 블록 추가)
- FROM: (기존 `:118-137` 단일 회상 watch 단정만 존재, 관찰 단일/반복 단정 없음)
- TO: 3개 단정 추가.
  1. 단일 caregiver 관찰 `oftenDifferent` 1건 → `summary.level === "watch"`, 모든 signal `level !== "needsConversation"`.
  2. 2개 서로 다른 도메인 `oftenDifferent` (예 appointments + navigation) → `summary.level === "needsConversation"`.
  3. `familySupportSummary.ts`용: 1건 `oftenDifferent` 관찰 + advisory watch 일 때 `showSupportResource === false`; 30일 내 2건 `oftenDifferent` 일 때만 `true`.
- verify: `npx vitest run src/features/family/haruAdvisory.test.ts src/features/family/familySupportSummary`
- checkpoint: `git add -A && git commit -m "SP-09: tests for single-observation watch, repeated needsConversation, support-resource gate"`

### Step 8 — FamilyScreen 테스트: 보호자 탭 report.* 미참조 확인
- 파일: `src/app/family/FamilyScreen.test.tsx`
- FROM: `:76-96` 보호자 탭 카운트 단정이 counselor 탭 전환 후 `report.*` 값으로 검증.
- TO: 보호자(family) 탭 디폴트 상태에서 metric 타일이 `familySummary.*` 값을 표시하는 단정 추가. 특히 (1) 보호자 탭에 `dueReviewCount`/`dueMemoryCount` 타일이 렌더되지 않음, (2) 보호자 탭이 familySummary.completedThisWeek 값을 표시함. 기존 counselor 탭 카운트 단정(`:76-96`)은 report 기반이므로 그대로 유지(counselor 탭은 report 사용 정당).
- verify: `npm run typecheck && npm run lint && npm test && npm run build`
- checkpoint: `git add -A && git commit -m "SP-09: family tab asserts familySummary metrics, no report.* leak"`

## 4. 단계별 테스트

- 매 step: `npm run typecheck && npm run lint && npm test && npm run build`
- SP-09 전용 단정:
  - `src/features/family/haruAdvisory.test.ts` — 단일 `oftenDifferent` 관찰 → watch, 2개 도메인 → needsConversation, 회상 단일 저조 → watch 유지(SP-08 단정 회귀 없음).
  - `src/app/family/FamilyScreen.test.tsx` — 보호자 탭이 `familySummary.*` 값 표시, `report.dueMemoryCount` 타일 미렌더, 단일 관찰로 SupportResourceCard 미렌더(`showSupportResource===false`).
  - 비의료 회귀: `expect(JSON.stringify(summary)).not.toMatch(/diagnosis|dementia|score|MMSE|MoCA/i)` (기존 `:115` 단정 유지).
- 검증 전 자원: `getVerifiedSupportResources()` 가 빈 배열 반환 → SupportResourceCard pending 표시, raw 전화번호/URL 미노출 수동 확인.

## 5. 수용 기준 (high_level_plan HL-9에서)

- 보호자 탭이 `familySummary.*` 만 표시 (`report.*` 의존 제거).
- 단일 caregiver 관찰 `oftenDifferent` 로 `needsConversation` 미발생 (watch 로 강등).
- 자원 카드가 "반복 걱정(30일 내 ≥2건 oftenDifferent)"에서만 점등.
- 치매안심센터 자원이 검증 데이터(`lastVerifiedAt` + `sourceUrl` + 대표전화 + 홈페이지)와 표시; 미검증 시 표시 안 함(pending 유지).
- `npm run typecheck && npm run lint && npm test && npm run build` 통과.

## 6. 범위 펜스 (절대 미터치)

- 키오스크 `/kiosk`, `KioskHomeScreen`, `useKioskControls` — 라우트 연결됨, 그대로 유지.
- 복지관 운영자 대시보드 — 미구현, 별도(`docs/welfare-center-hybrid-plan.md`).
- 일본 현지 보상/캐릭터/기관 — 별도(`docs/japan-localization-research-plan.md`).
- 식약처/임상 검증 — app 카피 비의료 유지만.
- `FamilyScreen.tsx:204-233` 탭 버튼 className(min-h) — SP-03 영역.
- `caregiverReport.ts` 본체 — 상담사 탭 report 는 그대로 유지; 본 SP-09 는 보호자 탭의 report 의존만 끊음.

## 7. 추가 발견 (보류 — step화 금지)

- `familySupportSummary.ts:130-135` `encouragement` 가 streak 카운트(`weekly.completedDays`)를 쓰고 있음. SP-1(HL-1)에서 "뇌 활성화" 혜택 카피로 전환 예정이나 본 SP-09 범위 아님 → 보류.
- `FamilyScreen.tsx:125-129` `advisoryLevelClass` 가 `report.advisory.level` 기반. Step 1-2 보수화로 인해 상담사 탭 advisory 도 watch 로 내려가는 부수 효과 존재(정합, 상담사는 activityHighlights/observation 추가 컨텍스트로 판단) — 동작 회귀 확인 필요하나 본 SP-09 범위 내.
- `haruAdvisory.ts:201-208` `addParticipationSignals` 의 "참여 중단(previous>=3 && recent===0)" 은 단일 신호로 needsConversation(weight 2) 가능. 멘토 "단일 결과로 needsConversation 금지"와의 정합 재검토 후보이나, 이는 참여 **추세 중단**(복합 맥락)으로 분류되어 현행 유지 → 별도 검토 시 보류.
- `SupportResourceCard.tsx:27` `border-teal-100 bg-teal-50` — SP-2 고대비(청색/녹색 회피)와의 정합 검토 대상이나 본 SP-09(로직/데이터) 범위 아님 → SP-2 보류.

## 8. 롤백 메모

- 각 step 은 독립 commit 이므로 `git revert <sha>` 로 단계별 롤백 가능.
- Step 1(haruAdvisory 보수화)을 롤백하면 단일 관찰이 다시 needsConversation 으로 복원 — Step 2/3/7 테스트가 실패하므로 함께 롤백 권장.
- Step 3(자원 카드 게이트) 롤백 시 needsConversation 단락이 복원되어 단일 관찰로 자원 카드 점등 회귀.
- Step 4/5(보호자 탭 familySummary 전환) 롤백 시 `report.*` 의존 복원 — Step 8 테스트 실패.
- Step 6 은 catalog 가 주석 처리된 상태이므로 롤백해도 사용자 화면 변화 없음(검증 전에는 어차피 미표시). 검증 완료 후 값 채운 시점부터 롤백이 사용자 화면에 영향.
