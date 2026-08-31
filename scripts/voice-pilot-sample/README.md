# Haru 음성 UX 샘플 데이터 분석 도구

20명 × 7일 **샘플 데이터**를 운영 지표와 STT 사용성 지표로 변환한다.
입력 계약은 `dataKind="sample"`이다.

## 실행

생성기가 기본 위치에 `operational_export.json`을 만든 뒤:

```powershell
node scripts/voice-pilot-sample/analyze.mjs
node scripts/voice-pilot-sample/capture-dashboard.mjs
```

명시 경로:

```powershell
node scripts/voice-pilot-sample/analyze.mjs `
  --input docs/voice-pilot-sample-20x7/operational_export.json `
  --output docs/voice-pilot-sample-20x7/analysis

node scripts/voice-pilot-sample/capture-dashboard.mjs `
  --dashboard docs/voice-pilot-sample-20x7/analysis/dashboard.html `
  --output docs/voice-pilot-sample-20x7/analysis/charts/png
```

검토용 transcript는 일반 운영 export와 분리된 restricted review에서 읽는다. 기본 경로는
입력 파일 옆 `restricted/stt_review_rows.json`이다.

```powershell
node scripts/voice-pilot-sample/analyze.mjs `
  --input path/to/operational_export.json `
  --review path/to/restricted/stt_review_rows.json
```

## 입력 계약

`operational_export.json`:

```text
{
  schemaVersion, generatedAt, dataKind, seed,
  participants[], consentReceipts[], routineSessions[],
  questionAttempts[], telemetryEvents[]
}
```

일반 운영 export에는 transcript나 `sttReviewRows`를 넣지 않는다. STT 비교 row는
`restricted/stt_review_rows.json`의 `rows[]`에만 둔다. voice attempt가 있는데 이
제한 파일이 없으면 분석기는 조용히 빈 결과를 만들지 않고 중단한다.

필수 결합 필드:

- participant: `participantId`; cohort용 `ageBand`, `preferredInputMode`,
  `voiceExperienceVariant`는 선택.
- session: `participantId`, `sessionId`, `day`; `state` 또는 `status`.
- attempt: `participantId`, `sessionId`, `questionId`, `questionType`, `day`;
  `status`, `completedAt`, timing, `response`는 선택.
- STT review: `participantId`, `voiceExperienceVariant`, `day`, `questionId`,
  `sessionId`, `status`, `noSpeech`, `retryCount`, `latencyMs`,
  `usableTranscript`, `preprocessingVersion`.
- restricted fields: `referenceTranscript`, `hypothesisTranscript`,
  `semanticSlots[{slotId, expectedValues, preserved}]`.
- 같은 발화를 paired 비교할 때 `pairId`를 추가한다. 없으면 variant별 집계만
  생성한다.

권장 variant와 전처리 metadata:

| variant | preprocessingVersion | 의미 |
| --- | --- | --- |
| `baseline_v1` | `decode-resample-only-v1` | decode/mono/16 kHz resample 기준 |
| `assist_v2` | `haru-dc-hp80-rms-v2` | 현재 DC 제거·80 Hz high-pass·bounded RMS 보정 |

## 산출물

```text
analysis/
  artifact-index.json
  metrics.json
  dashboard.html
  findings.md
  methodology.md
  charts/
    01_daily_retention.svg
    02_participant_week.svg
    03_stt_variant_comparison.svg
    04_question_dropoff_hotspots.svg
    05_question_timing.svg
    06_cohort_completion.svg
    png/
      dashboard-full.png
      01-overview.png ...
```

`metrics.json`, HTML, Markdown, SVG, PNG에는 transcript나 음성 object key를 넣지
않는다. `methodology.md`에는 계약 설명을 위해 필드명만 적는다.
`artifact-index.json`은 이 분석 폴더만 목록화한다. 루트 `manifest.json.files`는
`fileInventoryScope=generated_data_outputs_only`인 생성 데이터 목록이며 분석 파일
목록이 아니다.

## 검증

```powershell
node --test scripts/voice-pilot-sample/*.test.mjs
```

주 지표는 후속 기억 단서에 활용 가능한 **사용 가능 전사율**이다. CER/WER/semantic slot 보존, no-speech,
재시도, 음성 단계 이탈, 지연 p50/p90, 익일 복귀를 보조 지표로 제공한다.

## 로컬 실제 음성 평가

샘플 데이터 분석기와 실제 음성 평가는 분리되어 있다. 실제 음성 harness는 명시적으로
동의받은 로컬 파일만 읽고, 같은 decode/resample 결과를 baseline과 assist에
메모리에서 각각 전달한다. Qwen 모델·GPU는 로컬 STT 환경을 그대로 사용한다.
음성 파일을 복사하거나 출력에 직렬화하지 않는다.

1. `stt-evaluation-manifest.example.json`을 repo 밖 로컬 작업 폴더로 복사한다.
2. 실제 clip path, 사람 reference transcript, semantic slot을 채운다.
3. 배치 전체의 동의를 확인한 뒤 `consentConfirmed=true`로 바꾼다.
4. manifest를 먼저 검사한다.

```powershell
backend\.venv\Scripts\python.exe scripts\voice-pilot-sample\evaluate_stt.py `
  --manifest C:\local-haru-eval\manifest.json `
  --validate-only
```

5. 로컬 Qwen으로 같은 clip을 두 조건에 decode한다. clip ID를 고정 해시로 정렬한 뒤
   baseline-first와 assist-first를 번갈아 배정해 두 순서의 수 차이를 최대 1로 제한한다.
   reviewer용 transcript 파일과 조건 대응표를 분리하며, 둘 다
   repo 밖 경로만 허용한다.

```powershell
backend\.venv\Scripts\python.exe scripts\voice-pilot-sample\evaluate_stt.py `
  --manifest C:\local-haru-eval\manifest.json `
  --output C:\local-haru-eval\restricted_review.json `
  --mapping-output C:\local-haru-eval\condition_mapping.json
```

6. reviewer에게는 `restricted_review.json`만 전달한다. `condition_mapping.json`은
   열거나 공유하지 않는다. reviewer는 각 row의 `usableTranscript`와 모든
   `semanticSlots[].preserved`를 boolean으로 채운다. 끝나면
   `humanReviewComplete=true`로 바꾼다.
7. transcript 없는 결과만 만든다.

```powershell
node scripts/voice-pilot-sample/score-stt-review.mjs `
  --review C:\local-haru-eval\restricted_review.json `
  --mapping C:\local-haru-eval\condition_mapping.json `
  --output C:\local-haru-eval\stt_metrics.json
```

scorer는 동의, human review 완료, null label 부재, pair별 정확히 두 조건,
baseline/assist 전처리 metadata를 검증한다. 출력에는 reference/hypothesis, semantic
expected value, audio path가 없다. 지연값은 순서를 교차 배치해도 로컬 장비·캐시 영향이
남는 기술 지표이며 인과 효과로 해석하지 않는다.
실제 음성 평가 결과도 제품 사용성 자료일 뿐 임상 결과나 전체 사용자 STT 성능
보장이 아니다. restricted review과 condition mapping은 commit·배포 금지다.
