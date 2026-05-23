# Haru (하루)

Haru는 60-80대 고령 사용자를 위한 Duolingo 스타일의 일일 인지·회상 루틴 앱입니다. 사용자는 사자성어와 문화 표현을 짧은 선택형 학습으로 익히고, 부담이 적은 선택·말하기 흐름으로 개인 기억 단서를 남깁니다.

## 현재 구현 범위

- 일일 5분 학습 흐름
- 사자성어 의미 선택, 상황 매칭, 짝 맞추기, 순서 배열
- 오디오 선택, 그림 선택
- 5단어 지연회상, 주의 패턴 및 주의 전환(TMT-lite), 날짜·요일 감각, 작업기억 숫자 입력(순방향/역방향), 색상 집중 루틴(Stroop)
- 도형 따라 그리기(그리기 연습), 말 따라하기, 언어 유창성 연습
- 개인 기억 이야기 저장 및 감정 기억 저장
- 저장된 기억 기반 복습 문제 생성
- 스트릭과 정원 물방울 보상
- 정원 화면
- 보호자 및 상담사 리포트 화면
- 한국어, 영어, 일본어 i18n
- 로컬 저장소 기반 MVP 상태 관리

의료 진단, 공식 검사 점수화, 가족 관계 자동 추론, 자유 채팅, 병원/보험 연동은 구현 범위가 아닙니다.

## 기술 스택

- React 18
- TypeScript strict mode
- Vite
- React Router v6
- Tailwind CSS
- react-i18next
- lucide-react
- Vitest + React Testing Library
- ESLint flat config

## 주요 화면

- `/` 학습 홈
- `/lesson` 일일 학습 세션
- `/result` 세션 완료 결과
- `/garden` 기억 정원
- `/family` 보호자 및 상담사 리포트
- `/settings` 언어 및 데이터 관리

## 주요 설계

### 선택형 학습

사용자 입력은 버튼 선택 중심입니다. 고령 사용자가 부담 없이 진행할 수 있도록 각 문항은 큰 터치 영역과 명확한 피드백을 제공합니다.

### 기억 카드

개인 기억은 `localStorage`의 `memoryCards`에 저장됩니다.

- 주제 선택은 `topic`에 저장됩니다.
- 감정 선택은 `emotionTag`에 저장됩니다.
- 복습 문제는 저장된 `topic` 또는 `emotionTag`를 바탕으로 생성됩니다.
- 기존에 감정이 `topic`에 저장된 legacy 데이터도 감정 복습으로 처리합니다.

5단어 지연회상 루틴은 공식 검사 자극물을 쓰지 않는 Haru용 단어 세트입니다. encoding 단계에서는 단어와 범주 단서를 함께 보여주고, recall 단계에서는 사용자가 먼저 떠올린 단어, 선택 답안, 기대 답안, 맞게 선택한 개수, 계획 지연 시간, 실제 관찰 지연 시간을 `cognitiveRoutineResults` metadata로 저장합니다.

날짜·요일 감각 루틴은 MMSE/MoCA/GPCOG류의 정식 지남력 문항을 복제하지 않습니다. 오늘의 날짜와 요일을 선택형으로 확인하고, 선택한 항목과 기대 항목, 응답 시간, 일치 여부를 `orientation_practice` 활동 기록으로 저장합니다.

보호자 관찰 메모는 `localStorage`의 `caregiverObservationRecords`에 저장됩니다. 공식 선별검사 문항이나 점수표가 아니라, 상담 전 가족이 관찰한 일상 변화 영역, 영역별 변화 정도, 자유 메모를 보관하는 용도입니다.

도형 따라 그리기 루틴은 공식 시계그리기 검사의 문항이나 채점표를 복제하지 않습니다. 대신 `shape_copy_practice` 완료 시 획 수, 첫 터치 지연, 그리기 시간, 멈춤 횟수, 지우기 횟수, 샘플링된 터치 경로를 `cognitiveRoutineResults` metadata로 저장해 추후 활동 리포트의 원자료로 사용합니다.

### 보상과 정원

`GamificationProvider`가 스트릭과 정원 상태를 공유합니다. 세션 완료 후 결과 화면에서 보상이 반영되며, 홈으로 돌아오면 상단 상태 바가 즉시 갱신됩니다.

### 운동 유형 등록

`ExerciseRenderer`는 현재 선언된 학습 유형을 모두 처리합니다.

- `multiple_choice_meaning`
- `situation_match`
- `pair_matching`
- `sequence_order`
- `audio_choice`
- `picture_choice`
- `personal_memory_recall`
- `delayed_word_recall`
- `attention_pattern`
- `digit_span_practice`
- `verbal_fluency_practice`
- `trail_switching_practice`
- `stroop_touch_practice`
- `orientation_practice`
- `shape_copy_practice`
- `speech_repeat_practice`

## 설치

```bash
npm install
```

## 개발 서버

```bash
npm run dev
```

기본 Vite 주소는 `http://localhost:5173/`입니다.

## 검증 명령

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

현재 검증 상태:

- TypeScript build mode 통과
- ESLint 통과
- Vitest 24개 파일, 73개 테스트 통과
- Vite production build 통과
- Playwright 화면 캡처 69개 통과

Playwright로 확인한 화면:

- 한국어, 일본어, 영어 각 23개 화면 캡처
- 홈, lesson exercise 전체, 결과, 정원, 보호자/상담사 리포트, 설정 화면
- raw i18n key와 깨진 `??` 텍스트 미노출 검사

## 프로젝트 구조

```text
src/
  app/
    family/
    garden/
    home/
    lesson/
    result/
    settings/
  components/
  data/
  features/
    gamification/
    lessons/
    memory/
  locales/
  styles/
```

## 로컬 데이터

앱은 현재 MVP 상태로 서버 없이 동작하며 다음 값을 브라우저 `localStorage`에 저장합니다.

- `memoryGardenLang`
- `memoryCards`
- `cognitiveRoutineResults`
- `streakState`
- `gardenState`

설정 화면에서 기억 카드와 인지 루틴 기록을 삭제할 수 있습니다.

## 참고 문서

- `design.md`: UI/UX 및 제품 설계 상세
- `AGENTS.md`: 개발 컨벤션과 MVP 범위
- `docs/cognitive-screening-integration-plan.md`: 연구 보고서와 코드 구조를 대조한 인지 루틴 확장 판단서

## 의료 근거 기반 Haru 자체 평가 방향

Haru는 단순히 “의학적 판단을 하지 않는다”는 방어적 MVP에 머무르지 않는다. 공개 논문, 공식 기관 자료, 공개 데이터셋, 보호자 관찰 흐름을 근거로 Haru 자체의 주의도·참고 위험도 평가를 설계한다.

제품 실행 또는 첫 사용 시에는 Haru의 결과가 의학적 진단, 공식 선별검사, 치료나 예방 효과를 뜻하지 않는다는 안내를 보여준다. 그 전제 위에서 앱 내부에서는 반복 루틴 기록, 회상 변화, 반응시간, 오류 패턴, 그리기 telemetry, 의미 유창성, 보호자 관찰을 조합해 사용자와 보호자/상담사에게 실질적인 참고 정보를 제공한다.

허용되는 결과 표현:

- Haru 자체 주의도
- Haru 참고 위험도
- 대화 권장 신호
- 전문가 상담 고려 신호
- 변화가 반복되는 영역과 그 근거 설명

금지되는 결과 표현:

- 공식 치매 진단
- 공식 선별 양성/음성
- MMSE, MoCA, CIST, K-MMSE 등 공식 검사 점수
- 임상적으로 검증된 질병 위험도처럼 보이는 수치
- 치료, 예방, 감지 성능을 보장하는 문구
