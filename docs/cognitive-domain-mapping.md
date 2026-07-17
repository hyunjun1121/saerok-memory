# Haru Cognitive Domain Mapping (SP-13)

작성일: 2026-06-23

이 문서는 Haru의 일상 루틴이 어떤 광범위한 인지 영역(broad cognitive domain)에서 영감을 받았는지를 정리한다. Haru 루틴은 공식 검사 도구의 문항·채점표·컷오프·해석 기준을 복제하지 않는다. 모든 루틴은 Haru 자체의 일상 활동 콘텐츠로, 활동 기록은 “참고 신호 / 대화 준비 / 상담 고려” 용도로만 사용된다.

## 원칙

- 공식 검사명(MMSE, K-MMSE, MoCA, CIST, AD8, GPCOG, TICS, SAGE, SLUMS, ACE-III 등)은 사용자 화면/리포트 점수 라벨로 사용하지 않는다.
- 공식 문항, 정확한 지시문, 저작권 자극 자료, 채점 기준, 컷오프, 해석 표는 복제하지 않는다.
- 단일 세션의 낮은 수행은 절대 진단으로 표현하지 않는다.
- 인지 영역명은 학습자 화면에서 비임상 언어(예: “번호 기억 활동”, “단어 떠올리기”, “보이는 색 고르기”)로 풀어서 표시한다.

## 루틴 → 광범위 영역 참고 매핑

| Haru 루틴 (`ExerciseType`) | 참고한 광범위 영역 | 학습자 화면 표현(비임상) |
| --- | --- | --- |
| `delayed_word_recall` | 지연 회상 / 단기기억 | 단어 기억 활동 |
| `attention_pattern` | 주의 / 간단한 규칙 추론 | 오늘의 활동(장보기 이야기) |
| `digit_span_practice` | 작업기억 / 숫자 기억 | 번호 기억 활동 |
| `verbal_fluency_practice` | 범주 언어 유창성 | 단어 떠올리기 |
| `trail_switching_practice` | 주의 전환 / 순차 추적 | 차례대로 누르기 |
| `stroop_touch_practice` | 선택적 주의 / 색 집중 | 보이는 색 고르기 |
| `orientation_practice` | 시간 지남 인식 | 오늘 날짜 확인 |
| `shape_copy_practice` | 시공간 / 도형 모사 | 손글씨 연습장 |
| `speech_repeat_practice` | 언어 발화 / 따라 말하기 | 아침 인사 |
| `personal_memory_recall` | 자서전적 기억 / 회상 | 나의 이야기 |

## 데이터 사용 경계

- `cognitiveRoutineResults` 메타데이터(반응 시간, 다시 누른 횟수, 선택 흐름 등)는 Haru 자체 참고 신호를 조합하는 데 사용된다.
- 보호자 화면은 raw 점수·오류 횟수·반응 시간을 직접 노출하지 않고 참여 흐름·대화 제안·상담 자원 안내로 변환한다(`generateFamilySupportSummary`).
- 상담사 화면은 활동 기록을 더 구체적으로 보여주되 “정답률/저하” 대신 “최근 활동 기록/반복 확인된 변화”와 같은 비임상 표현을 쓴다.
- `haruAdvisory`는 단일 낮은 결과만으로 `needsConversation`이 되지 않도록 보수적으로 동작한다(2회 이상 반복 또는 보호자 관찰과 함께 나타날 때만).

## 참고 아카이브

`cognitve-reference/` 아카이브는 광범위한 영역과 작업 계열을 이해하는 용도로만 참고한다. 공식 도구의 문항·점수·컷오프를 앱에 복제하지 않는다.
