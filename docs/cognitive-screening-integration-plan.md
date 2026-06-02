# Haru 인지 루틴 확장 판단서

## 범위

이 문서는 `deep-research-report.md`와 현재 코드 구조를 대조해 Haru에 어떤 인지 과제를 우선 추가할지 정리한 실행 판단서이다. 목표는 고령 사용자가 매일 부담 없이 수행할 수 있는 근거 기반의 인지 루틴을 늘리고 보호자·상담사가 참고할 활동 데이터를 축적하는 것이다.

Haru는 신뢰 가능한 의료·인지과학 자료를 바탕으로 Haru 자체의 주의도·참고 위험도 평가를 구축한다. 결과 표현은 “연습 기록”, “참여 흐름”, “대화 준비 자료”, “Haru 자체 주의도”, “필요 시 전문가 상담 권유”로 확장한다.

프로그램 실행 또는 첫 사용 시에는 Haru 자체 참고 신호의 용도와 해석 범위를 간결히 안내한다. 반복 루틴 데이터, 회상 변화, 반응시간, 오류 패턴, 그리기 telemetry, 의미 유창성, 보호자 관찰을 조합해 사용자가 합리적으로 참고할 수 있는 신호를 제공한다.

## 확인한 현재 구조

| 현재 자산 | 파일 | 확장 의미 |
|---|---|---|
| Exercise discriminated union | `src/data/mockExercises.ts` | 새 과제 type을 추가하기 쉬운 구조 |
| Exercise renderer | `src/features/lessons/ExerciseRenderer.tsx` | type별 컴포넌트 등록 방식 |
| 인지 루틴 저장소 | `src/features/cognitive/cognitiveRoutineStorage.ts` | 과제 완료 여부와 metadata를 localStorage에 저장 가능 |
| 보호자·상담사 리포트 | `src/features/family/caregiverReport.ts` | 반복 기록과 공유 기억을 요약 가능 |
| 개인 기억 카드 | `src/features/memory/*` | 자전적 회상과 지연 복습에 연결 가능 |
| i18n | `src/locales/ko.json`, `ja.json`, `en.json` | 한국어·일본어·영어 루틴 확장 가능 |

현재 구현된 과제는 의미 선택, 상황 매칭, 짝 맞추기, 순서 배열, 오디오 선택, 그림 선택, 개인 기억 회상, 지연 단어 회상, 주의 패턴, 도형 따라 그리기, 말 따라하기이다. 따라서 연구 보고서가 권장한 지연회상, 작업기억, 언어 유창성, 시공간, 보호자 보고 흐름을 기존 lesson 엔진에 점진적으로 붙일 수 있다.

## 외부 근거 확인 메모

| 근거 | 확인한 핵심 | 제품 반영 |
|---|---|---|
| [AD8 공식 페이지](https://knightadrc.wustl.edu/professionals-clinicians/ad8-instrument/) | 정상 노화와 치매 징후를 구분하기 위한 짧은 informant 도구로 소개되며 민감도·특이도 수치를 제시함 | 공식 문항 복제 대신 보호자 변화체크 흐름을 별도 모드로 설계 |
| [GPCOG 공식 사이트](https://gpcog.com.au/) | 일차의료용 인지 선별 도구이며 환자 평가와 informant interview를 분리함. 추가 관리 책임은 임상의에게 있음을 고지함 | Haru의 사용자 화면과 보호자 화면을 분리하는 근거 |
| [SAGE 공식 소개](https://wexnermedical.osu.edu/brain-spine-neuro/memory-disorders/sage) | 자가시행형 인지 선별 도구로 소개됨 | Haru 장기 방향은 “자가형 종합 루틴”이 적합하지만 공식 양식 복제는 피함 |
| [TICS primary care 연구](https://pubmed.ncbi.nlm.nih.gov/35346928/) | 대면 검사가 어려울 때 전화 기반 인지 선별의 유용성을 검토함 | 음성·비대면 루틴 확장의 근거 |
| [Clock Drawing Test 리뷰](https://pmc.ncbi.nlm.nih.gov/articles/PMC5619209/) | 시계그리기 검사는 치매 선별에 쓰이나 채점 방식과 해석에 주의 필요 | 현재 `shape_copy_practice`를 결과 점수보다 터치 궤적·멈춤 시간 기록으로 확장 |

## 우선 추가할 과제

| 우선순위 | 과제 | 보고서 근거 | 현재 코드 적합성 | 제품 표현 |
|---|---|---|---|---|
| 1 | 5단어 지연회상 | 5-word delayed recall은 짧고 모바일에 적합 | `delayed_word_recall`을 5단어, 범주 단서, 자유회상 입력, 선택형 재인 확인으로 확장함 | “기억 연습”, “나중에 다시 떠올리기” |
| 2 | Digit Span 순·역방향 | 작업기억과 주의 조작을 짧게 확인 가능 | 새 `digit_span_practice` type으로 바로 구현 가능 | “작업기억 연습” |
| 3 | 보호자 변화체크 | AD8/GPCOG처럼 informant 정보가 조기 변화 파악에 유용 | `/family`와 report 구조 존재. 공식 AD8 문항은 복제하지 않고 Haru 원문 문항 필요 | “보호자 관찰 메모” |
| 4 | 범주 유창성 | 동물 이름 대기 등 semantic retrieval에 유용 | `speech_repeat_practice`와 STT 방어 코드 존재. 60초 타이머와 중복어 기록 필요 | “말로 떠올리기 연습” |
| 5 | GPCOG/TICS식 분기 루틴 | 사용자 과제와 보호자 interview 결합, 비대면 친화 | lesson + family report를 연결해야 하므로 단기 확장 | “사용자 루틴 + 보호자 확인” |
| 6 | 날짜·요일 지남력 | 오늘 날짜·요일 확인은 가장 짧은 인지 전반 기본층 | 선택형 UI로 바로 구현 가능. 장소 문항은 개인정보·위치권한 이슈가 있어 보류 | “날짜 감각 연습” |
| 7 | dCDT/TMT/Stroop | 디지털 궤적·반응시간이 장점 | canvas와 선택형 UI가 있으나 데이터 모델 확장이 필요 | “그리기·주의 전환 연습” |

## 이번 코드 반영

`digit_span_practice`를 신규 exercise type으로 추가했다. 사용자는 숫자를 본 뒤 다음 화면에서 순서 또는 역순으로 누른다. 결과는 `cognitiveRoutineResults`에 `digit_span_practice` type과 metadata로 저장된다.

또한 기존 `delayed_word_recall` mock lesson을 3단어에서 5단어 지연회상으로 바꿨다. Haru용 단순 단어 세트를 사용하며, 각 단어에 Haru 원문 범주 단서를 붙이고, encoding/recall 단계에서 범주 단서, 계획 지연 시간, 실제 관찰 지연 시간, 선택 답안, 기대 답안, 맞게 선택한 개수를 `cognitiveRoutineResults` metadata로 저장하도록 확장했다. 이어서 recall 단계에는 사용자가 먼저 떠올린 단어를 적는 자유회상 입력을 추가했고, 이후 기존 선택형 재인 확인을 계속하도록 했다.

이번 이어진 반영에서는 `verbal_fluency_practice`를 추가했다. 첫 버전은 “동물” 범주에서 떠오르는 단어를 적는 방식이며, 30초 타이머와 단어 추가 UI, 서로 다른 단어 수와 반복 단어 수를 기록한다. 이 값은 언어 유창성 루틴의 활동 metadata로 축적한다.

보호자 변화체크는 `/family`의 보호자 탭에 “보호자 관찰 메모”로 추가했다. Haru 원문 관찰 영역과 자유 메모를 저장한다. 이번 확장에서는 각 영역에 대해 “큰 변화 없음 / 가끔 달라 보임 / 자주 달라 보임 / 잘 모르겠음” 수준의 구조화 응답도 함께 저장하도록 바꿨다. 저장된 최신 관찰은 상담사 탭에도 표시되어 다음 상담 전 대화 준비 자료로 활용된다. 현재 영역은 익숙한 일상, 대화 흐름, 약속 기억, 길 찾기, 약·돈 관리, 기분·사회활동, 수면·식사, 집 안 안전의 8개다.

Haru 자체 종합 주의 신호는 `src/features/family/haruAdvisory.ts`로 구현했다. 이 모듈은 단일 점수 대신 여러 약한 신호를 결합한다. 입력은 반복 루틴 참여 흐름, 지연 단어 회상 metadata, 숫자 기억 metadata, 범주 유창성, 주의 전환, 색상 집중, 날짜 감각, 그리기 telemetry, 공유 허용 기억 카드, 보호자 관찰 기록이다. 출력은 `steady`, `watch`, `needsConversation` 수준, 영역별 요약, 참고한 신호, 다음 대화 액션으로 구성된다.

디지털 실행기능 루틴으로 `trail_switching_practice`를 추가했다. 숫자와 그림 단서를 번갈아 누르는 TMT-lite 형태로 구성했다. 저장값은 완료 여부, 클릭 순서, 오류 수, 소요시간이며, 상담사 화면에서는 주의 전환 활동 기록으로 활용한다.

이번 반영에서는 기존 `shape_copy_practice`를 dCDT-lite 방향으로 확장했다. 단순 도형 따라 그리기 안에서 획 수, 첫 터치까지 걸린 시간, 그리기 지속 시간, 멈춤 횟수, 지우기 횟수, 경로 길이, 샘플링된 터치 경로를 저장한다. 이 값은 추후 보호자·상담사 리포트의 시공간/운동 참여 흐름을 구성하기 위한 원자료다.

날짜·요일 지남력의 기본층으로 `orientation_practice`를 추가했다. 오늘 날짜와 요일을 선택형으로 확인한다. 저장값은 기대 날짜, 선택 날짜, 일치 여부, 응답 시간, locale이며, 화면과 리포트에서는 “날짜 감각 루틴 참여 기록”으로 표현한다. 장소 지남력은 위치권한과 개인정보 이슈가 있어 MVP에서는 보류한다.

저장 metadata는 다음 개발을 위한 루틴 기록이다.

```ts
{
  direction,
  spanLength,
  presentedDigits,
  expectedDigits,
  enteredDigits,
  missCount
}
```

`delayed_word_recall` metadata:

```ts
{
  phase,
  wordSetId,
  words,
  wordCategoryCues,
  wordCount,
  selectedAnswers,
  expectedAnswers,
  correctCount,
  requiredSelectionCount,
  presentedOptions,
  plannedDelayMinutes,
  observedDelayMs,
  observedDelayMinutes,
  recallMode,
  freeRecallEntries,
  freeRecallCorrectCount,
  freeRecallExtraCount
}
```

`verbal_fluency_practice` metadata:

```ts
{
  category,
  durationSeconds,
  elapsedSeconds,
  entries,
  uniqueCount,
  repetitionCount
}
```

`caregiverObservationRecords` metadata:

```ts
{
  selectedDomains,
  domainResponses,
  note,
  createdAt
}
```

`haruAdvisorySummary` output:

```ts
{
  level,
  dataCompleteness,
  summary,
  domainSummaries,
  signals,
  nextSteps
}
```

`trail_switching_practice` metadata:

```ts
{
  expectedTrail,
  clickedNodeIds,
  errorCount,
  elapsedMs,
  nodeCount
}
```

`shape_copy_practice` metadata:

```ts
{
  hasDrawn,
  template,
  strokeCount,
  sampledPointCount,
  drawingDurationMs,
  firstTouchLatencyMs,
  hesitationCount,
  clearCount,
  pathLengthPx,
  sampledPath
}
```

`orientation_practice` metadata:

```ts
{
  kind,
  targetDateISO,
  locale,
  expectedOption,
  selectedOption,
  matchedExpected,
  responseMs
}
```

## 다음 구현 순서 (포스트 MVP 로드맵)

현재 5단어 지연회상, Digit Span, 언어 유창성, 그리기 궤적(dCDT-lite), 주의 전환(TMT-lite), 날짜 지남력, 보호자 변화 관찰이 모두 구현되어 로컬 스토리지 데이터 축적 및 상담 리포트 화면 연동까지 완료되었습니다. 이후의 포스트 MVP 개발 방향은 다음과 같습니다.

1. **상황별 음성 인식/합성 기능 고도화**:
   - 현재 구현된 텍스트 및 버튼 기반의 자유회상 흐름 외에, 디바이스의 Web Speech API(음성인식)가 활성화되어 있을 때 자동으로 음성을 텍스트로 치환하여 필드에 채워 넣는 UX를 보강합니다.
   - 브라우저나 OS별 음성 엔진의 한국어/일본어/영어 지원 편차를 방어하기 위한 Graceful Fallback 처리를 고도화합니다.

2. **종단 인지/행동 트렌드 시각화 보강**:
   - 누적된 `cognitiveRoutineResults`를 바탕으로 주간/월간 단위의 반응시간 변화 추이, 그리기 hesitation 빈도 변화, 주의 전환 오류 횟수의 변화 흐름을 직관적인 차트나 마이크로 애니메이션 리포트로 보호자/상담사 탭에 추가 제공합니다.

3. **Haru 자체 주의도 모델 정교화**:
   - 1차 룰엔진은 구현되었다. 다음 단계에서는 파일럿 사용 데이터와 전문가 자문을 바탕으로 신호 가중치, 도메인 우선순위, 다음 대화 액션의 설명 가능성을 조정한다.
   - 상담 전문가가 현장에서 이해하기 쉬운 방식으로 신호 근거와 사용자 맥락을 함께 볼 수 있도록 시각화를 보강한다.

4. **사용성 및 접근성 피드백 보강**:
   - 60-80대 노인 사용자의 터치 실수(오클릭)나 그리기 캔버스 리셋 빈도를 분석하여, 터치 타겟 크기를 미세조정하고 유연한 다음 단계 유도를 강화합니다.

## 명시적으로 피할 것

- 정식 MMSE, MoCA, ACE-III, CIST, K-MMSE 전체 복제
- 공식 검사 문항, 공식 점수표, cutoff, 진단 라벨 표시
- “치매 감지”, “치매 예방”, “인지장애 판정” 같은 확정 표현
- 보호자 화면에서 사용자가 공유하지 않은 개인 기억 노출
- 단일 점수로 사용자를 정상/위험/질환군으로 분류하는 UI
- Haru 자체 참고 위험도를 공식 의학 지표처럼 표시하는 UI

## 완료 판단 기준

이 확장 목표가 완료되려면 다음 증거가 필요하다.

- 적어도 5단어 지연회상, Digit Span, 범주 유창성, 날짜·요일 지남력, 보호자 변화체크가 구현되어 lesson 또는 report 흐름에서 접근 가능해야 한다.
- 모든 신규 과제는 한국어·일본어·영어 visible text를 i18n 또는 localized mock data로 제공해야 한다.
- `cognitiveRoutineResults`에 도메인, 과제명, 완료 여부, 핵심 metadata가 저장되어야 한다.
- 상담사 화면은 의료 점수 대신 참여 흐름과 대화 준비 자료를 보여야 한다.
- `npm run typecheck`, `npm run test`, `npm run build`가 통과해야 한다.
- 의료·저작권 안전 문구가 README 또는 AGENTS.md에 반영되어야 한다.

현재 검증 결과:

- `npm run typecheck`: PASS
- `npm run lint`: PASS
- `npm run test`: PASS, 26개 테스트 파일 / 79개 테스트
- `npm run build`: PASS
- Playwright 화면 캡처: ko/ja/en 각 23장, 총 69장 PASS. Windows webServer 종료 지연을 피하기 위해 최종 실행은 Vite preview 서버와 `PLAYWRIGHT_BASE_URL` 지정 방식으로 수행했다.
