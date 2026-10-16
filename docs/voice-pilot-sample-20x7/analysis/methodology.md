# Haru 음성 사용 데이터 분석 기준

## 목적

20명 × 7일 샘플 데이터에서 참여·이탈·문항 시간·재시도·STT 흐름을 같은 기준으로 분석한다. 입력은 `dataKind="sample"`을 사용한다.

## 입력 계약

`operational_export.json` 최상위:

- `schemaVersion`, `generatedAt`, `dataKind`, `seed`
- `participants[]`, `consentReceipts[]`, `routineSessions[]`
- `questionAttempts[]`, `telemetryEvents[]`

`restricted/stt_review_rows.json`에는 transcript가 있는 `rows[]`만 분리 보관한다. 일반 운영 export에 STT review row를 넣지 않는다.

STT review row:

- 결합 키: `participantId`, `pairId`, `voiceExperienceVariant`, `day`, `questionId`, `sessionId`
- 운영값: `status`, `noSpeech`, `retryCount`, `latencyMs`, `audioDurationMs`
- restricted fields: `referenceTranscript`, `hypothesisTranscript`, `usableTranscript`, `semanticSlots[]`
- 재현 metadata: `engine`, `model`, `modelRevision`, `preprocessingVersion`

`voiceExperienceVariant`는 `baseline_v1`과 `assist_v2`를 사용한다. baseline은 decode/resample-only metadata, assist는 현재 `haru-dc-hp80-rms-v2` metadata다.

## 지표 정의

- **사용 가능 전사율(주 지표):** `usableTranscript=true / 전체 STT review rows`. no-speech와 실패를 분모에 포함한다.
- **CER:** NFKC 정규화 후 공백·문장부호를 제외한 문자 단위 Levenshtein edit 합 / reference 문자 합.
- **WER:** 공백 토큰 단위 edit 합 / reference token 합. 일본어처럼 공백 없는 전사는 참고값이며 형태소 WER이 아니다.
- **semantic slot preservation:** explicit `semanticSlots[]`의 preserved/전체. slot이 없을 때 lexical token proxy를 사용하고 결과에 출처를 남긴다.
- **no-speech:** `noSpeech=true` 또는 status `no_speech` 비율.
- **retry:** `retryCount>0`인 review row 비율.
- **voice dropout:** 제시된 voice attempt 중 completedAt 없음, invalid, 또는 skipReason 존재 비율.
- **latency:** `latencyMs`의 p50과 선형보간 p90.
- **익일 복귀:** 1~6일차 음성 단계에서 이탈한 참여자-일 중 같은 참여자가 바로 다음 날 session을 시작한 비율. 한 사람이 여러 날 이탈하면 각 참여자-일을 별도 관측한다.

## 비교 방법

동일 `pairId`에서 baseline과 assist가 모두 존재할 때만 paired delta를 계산한다. 유의성 검정과 신뢰구간은 적용하지 않는다. 후속 분석에서도 동일 입력의 두 decode, blind human review, 원인별 실패 annotation을 유지한다.

## 개인정보·노출 통제

- 계산 결과 `metrics.json`, HTML, Markdown, SVG에는 transcript와 음성 object key를 넣지 않는다.
- PNG 캡처에도 reference/hypothesis/semantic expectedValues를 넣지 않는다.
- cohort는 n < 3이면 suppressed 처리한다.
- 운영 적용 시 동의·국가별 저장·삭제 정책을 별도로 검증한다.
