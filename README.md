# Haru (하루)

Haru는 60-80대 고령 사용자를 위한 Duolingo 스타일의 일일 인지·회상 루틴 앱입니다. 사용자는 사자성어와 문화 표현을 짧은 선택형 학습으로 익히고, 부담이 적은 선택·말하기 흐름으로 개인 기억 단서를 남깁니다.

## 현재 구현 범위

- 일일 5분 학습 흐름
- 사자성어 의미 선택, 상황 매칭, 짝 맞추기
- 개인 기억 선택 및 감정 기억 저장
- 저장된 기억 기반 복습 문제 생성
- 스트릭과 정원 물방울 보상
- 정원 화면
- 가족 보호자 및 상담사 화면
- 한국어, 영어, 일본어 i18n
- 로컬 저장소 기반 MVP 상태 관리

의료 진단, 점수화, 가족 관계 자동 추론, 자유 채팅, 병원/보험 연동은 구현 범위가 아닙니다.

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
- `/family` 보호자 초대
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
- Vitest 11개 파일, 33개 테스트 통과
- Vite production build 통과
- agent-browser로 주요 브라우저 흐름 확인

브라우저로 확인한 흐름:

- 가족 탭이 `/family`로 이동
- 기억 주제 선택지가 한국어로 표시
- 학습 세션 완료 후 `/result` 도달
- 홈 복귀 시 스트릭/물방울 상태가 즉시 반영
- 저장된 기억 카드가 `{ topic: "family" }`, `{ emotionTag: "뿌듯함" }` 형태로 분리 저장

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
- `streakState`
- `gardenState`

설정 화면에서 기억 카드를 삭제할 수 있습니다.

## 참고 문서

- `design.md`: UI/UX 및 제품 설계 상세
- `AGENTS.md`: 개발 컨벤션과 MVP 범위
