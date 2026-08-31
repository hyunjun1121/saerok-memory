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
- Haru 자체 종합 주의 신호: 반복 루틴, 공유 기억 단서, 보호자 관찰을 결합한 설명 가능한 advisory 요약
- 한국어, 영어, 일본어 i18n
- 로컬 저장소 기반 MVP 상태 관리

현재 MVP는 일일 루틴, 기억 단서, 로컬 활동 기록, 보호자·상담사 리포트에 집중합니다.

## Raspberry Pi 오프라인 데모

`raspberry-pi-demo/`는 Raspberry Pi 5와 세로형 1080×1920 화면, USB NFC 리더기, 2×2 USB 버튼을 위한 별도 정적 패키지입니다. STT·RAG·원격 API 없이 미리 생성한 한국어·일본어 음성과 브라우저 저장소만 사용합니다. NFC 리더기가 키보드 숫자 `5`를 보내면 로그인 대기 화면에서 활동 시작 화면으로 이동합니다.

Pi 설치·장치 설정·자동 시작·문제 해결의 전체 안내는 [`raspberry-pi-demo/README.md`](raspberry-pi-demo/README.md)에 있습니다. 아래는 새 Raspberry Pi OS Desktop 64-bit에서 한국어 kiosk를 설치하는 복붙용 최소 경로입니다. 현재 Pi 데모가 올라간 브랜치는 `feat/haru-sound-feedback`입니다.

```bash
sudo apt-get update
sudo apt-get install -y ca-certificates git
cd "$HOME"
git clone --depth 1 --filter=blob:none --sparse \
  --branch feat/haru-sound-feedback \
  https://github.com/hyunjun1121/saerok-memory.git
cd saerok-memory
git sparse-checkout set raspberry-pi-demo
cd raspberry-pi-demo
test -f package.json && test -f scripts/provision-pi.sh

# Node.js·Chromium·오디오 도구 설치, 양쪽 build, 한국어 자동 시작 설정
bash scripts/provision-pi.sh --enable-autostart --market ko

# 화면 출력 이름 확인 후 실제 출력·장착 방향으로 설정(예: 90 또는 270)
bash scripts/display-pi.sh list
bash scripts/display-pi.sh set HDMI-A-1 90

# USB 오디오/마이크와 NFC·2×2 버튼을 연결한 뒤 장치 진단
bash scripts/doctor-pi.sh --kiosk --audio --buttons --nfc
sudo reboot
```

일본어 kiosk는 위 설치 명령의 마지막 인자만 `--market ja`로 바꿉니다.

```bash
cd "$HOME/saerok-memory/raspberry-pi-demo"
bash scripts/provision-pi.sh --enable-autostart --market ja
```

이미 clone한 Pi의 업데이트·재빌드와 수동 실행:

```bash
cd "$HOME/saerok-memory"
git switch feat/haru-sound-feedback
git pull --ff-only origin feat/haru-sound-feedback
cd raspberry-pi-demo
bash scripts/bootstrap-pi.sh
bash scripts/start-ko.sh       # 한국어
# bash scripts/start-ja.sh     # 일본어
```

Pi 데모의 개별 빌드·오프라인 검사:

```bash
cd "$HOME/saerok-memory/raspberry-pi-demo"
npm ci --include=dev --include=optional --ignore-scripts=false --no-audit --no-fund
npm run build:ko
npm run build:ja
npm run check:offline
```

## 개발 PC 설치·검증

루트 웹앱만 실행할 때는 Node.js와 npm을 준비한 뒤 다음 명령을 사용합니다.

```bash
git clone --branch feat/haru-sound-feedback https://github.com/hyunjun1121/saerok-memory.git
cd saerok-memory
npm ci --include=dev --include=optional --ignore-scripts=false --no-audit --no-fund
npm run typecheck
npm run lint
npm test
npm run build
```

브라우저 개발 서버와 선택적 로컬 STT·RAG 서비스를 함께 실행하려면:

```bash
npm run dev:local
```

STT·RAG는 로컬 GPU/로컬 서비스이며 Vercel 정적 배포에 포함하지 않습니다. 필요한 경우에만 다음을 별도로 실행합니다.

```bash
npm run stt:install
npm run stt:download
npm run stt:dev       # 127.0.0.1:8765
npm run rag:install
npm run rag:download
npm run rag:dev       # 127.0.0.1:8000
```

개발 서버를 종료한 뒤 루트 변경을 원격 브랜치에 반영하는 명령은 다음과 같습니다. 임시 산출물과 비밀값이 포함된 `.env*` 파일은 커밋하지 않습니다.

```bash
git status --short
# 앱 소스·설정과 필요한 개인정보 문서만 명시적으로 추가합니다.
git add README.md package.json package-lock.json .env.example .vercelignore \
  eslint.config.js index.html tsconfig.json tsconfig.api.json vitest.config.ts \
  vercel.json vercel.japan.json api backend rag_backend raspberry-pi-demo \
  scripts src supabase public/assets/audio/narration/ja/day1 \
  docs/haru-privacy-consent-demo.md docs/user-data-collection.md
git commit -m "docs: record full build and Raspberry Pi setup"
git push origin feat/haru-sound-feedback
```

`피우다프로젝트/`, `docs/patent/`, `docs/voice-pilot-sample-20x7/`, `.tmp*/`, `tmp/` 같은 발표 자료·특허 원본·로컬 생성물은 공개 저장소에 올리기 전에 별도 검토합니다. Pi 데모만 필요한 경우에는 루트 전체를 받지 않고 위의 sparse clone 명령을 사용하면 됩니다.

## 멘토링 기반 개정 (2026-06-23)

권효순 멘토링 메모와 첨부 논문을 바탕으로, “기능이 많고 평가처럼 보일 수 있는 앱”을 “어르신이 매일 쉽게 쓰고 보호자·복지관이 부담 없이 쓰는 일상 기억/뇌 자극 루틴”으로 재정렬했다. 주요 변경:

- 학습자 화면에서 검사/선별/진단/점수/위험도 표현 제거 → “오늘 루틴 / 기억 운동 / 말하기 연습 / 하루 회상 / 대화 준비” 언어로 전환(한국어/영어/일본어 동기화).
- 고령자 친화 UI: 큰 버튼/글자, 고대비, 색이 아닌 테두리/아이콘/상태 라벨/`aria-pressed`로 상태 전달, `prefers-reduced-motion` 대응.
- 음성 우선 회상: 공통 `useSpeechCapture` + `SpeechCapturePanel`(“듣고 있어요” 상태, 미지원 시 글 입력 폴백, 입력 모드 메타데이터).
- 건조한 숫자/주의 루틴을 일상 맥락(장보기, 버스 번호, 복지관 가는 길)으로 재구성.
- 보호자 화면은 raw 점수 대신 참여 흐름/대화 제안/상담 자원 안내; 상담사 화면은 비임상 활동 기록. Haru advisory는 단일 낮은 결과만으로 경고하지 않도록 보수화.
- 주간 참여 보상(비경쟁), 요일별 루틴 이름, `/kiosk` 복지관 모드 골격, localStorage 방어 코드 강화.
- 공식 인지 검사(MMSE/MoCA/CIST 등) 문항/채점/컷오프는 복제하지 않으며 Haru 자체 루틴만 사용.

상세는 `docs/mentoring-implementation-log.md`, `high_level_plan.md`, `specifie_plan.md` 참고.

## 음성 인식(로컬 GPU STT 백엔드)

모든 음성 응답은 `backend/`의 로컬 Qwen 서비스로 전사합니다.

- 전사: `Qwen/Qwen3-ASR-1.7B` 고정 revision, `cuda:0`, BF16.
- 타임스탬프: `Qwen/Qwen3-ForcedAligner-0.6B` 고정 revision.
- API: `POST http://127.0.0.1:8765/api/stt`.
- 프론트엔드: `src/features/speech/stt.ts`가 녹음 Blob을 업로드합니다.
- Qwen이 보정된 confidence를 제공하지 않으므로 JSON에는 `null`을 저장합니다.
- DC 제거, 80 Hz high-pass, bounded RMS 뒤 전체 발화 무응답만 차단합니다. 조용한 발화와 긴 쉼은 자르지 않습니다.
- 모델·revision·aligner·전처리·segment·실제 capture sample rate/channel을 JSON에 남깁니다.
- STT 장애 시에도 루틴 완료는 막지 않습니다. 동의한 음성 Blob과 실패 메타데이터를 남기고 durable outbox가 Qwen을 재시도합니다.

두 모델과 STT 서비스는 로컬 GPU 전용이며 Vercel 배포 대상이 아닙니다. 상세 계약은 `backend/README.md`를 참고하십시오.

## 개인 기억 RAG(로컬 서비스)

`rag_backend/`는 앱의 전체 `haru_kiosk_usage_record` 1.0.0 JSON을 받아 모든 선택형·순서형·음성 응답을 SQLite 근거 문서로 저장하고, `intfloat/multilingual-e5-small`로 검색합니다.

- API: `POST http://127.0.0.1:8000/api/ingest/json`.
- SPA는 canonical JSON, content hash, idempotency key를 가진 durable outbox로 재시도합니다.
- 문서는 `passage:` prefix, 검색어는 `query:` prefix를 사용합니다.
- 음성의 명시적 `derived_annotations`만 관계로 만들며 선택 오답을 개인 사실로 승격하지 않습니다.
- 원문·QA·삭제 API는 로컬 token으로 보호합니다.
- 전체 canonical JSON은 사용자·dataset·body SHA-256별 immutable snapshot으로 보존합니다.
- SQLite가 원본이고 Neo4j는 선택적 파생 미러입니다. RAG 서비스와 개인 기억 DB도 Vercel 배포 대상이 아닙니다.
- 관련성 threshold 미만 질문은 근거 없음으로 반환하고 민감 transcript는 기본 검색·자동 문항에서 제외합니다.

생성형 LLM이 임의 답을 만드는 구조가 아니라 저장된 응답과 원문 근거를 반환하는 구조입니다. 상세 계약은 `rag_backend/README.md`를 참고하십시오.

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

- `/` → `/lesson`
- `/lesson` 일일 학습 세션
- `/result` 세션 완료 결과
- `/connect/caregiver` 보호자 화면
- `/connect/counselor` 상담사 화면
- `/garden` 기억 정원
- `/family` 가족 지원 화면
- `/settings` 언어 및 데이터 관리
- `/kiosk` 복지관 태블릿/키오스크 모드(골격)

## 주요 설계

### 선택형 학습

사용자 입력은 버튼 선택 중심입니다. 고령 사용자가 부담 없이 진행할 수 있도록 각 문항은 큰 터치 영역과 명확한 피드백을 제공합니다.

### 기억 카드

개인 기억은 `localStorage`의 `memoryCards`에 저장됩니다.

- 주제 선택은 `topic`에 저장됩니다.
- 감정 선택은 `emotionTag`에 저장됩니다.
- 복습 문제는 저장된 `topic` 또는 `emotionTag`를 바탕으로 생성됩니다.
- 기존에 감정이 `topic`에 저장된 legacy 데이터도 감정 복습으로 처리합니다.

5단어 지연회상 루틴은 Haru용 단어 세트로 구성됩니다. encoding 단계에서는 단어와 범주 단서를 함께 보여주고, recall 단계에서는 사용자가 먼저 떠올린 단어, 선택 답안, 기대 답안, 맞게 선택한 개수, 계획 지연 시간, 실제 관찰 지연 시간을 `cognitiveRoutineResults` metadata로 저장합니다.

날짜·요일 감각 루틴은 오늘의 날짜와 요일을 선택형으로 확인하고, 선택한 항목과 기대 항목, 응답 시간, 일치 여부를 `orientation_practice` 활동 기록으로 저장합니다.

보호자 관찰 메모는 `localStorage`의 `caregiverObservationRecords`에 저장됩니다. 상담 전 가족이 관찰한 일상 변화 영역, 영역별 변화 정도, 자유 메모를 보관하는 용도입니다. 현재 관찰 영역은 익숙한 일상, 대화 흐름, 약속 기억, 길 찾기, 약·돈 관리, 기분·사회활동, 수면·식사, 집 안 안전의 8개 영역입니다.

`generateHaruAdvisorySummary`는 반복 루틴 참여, 지연회상 metadata, 숫자 기억, 범주 유창성, 주의 전환, 색상 집중, 날짜 감각, 그리기 telemetry, 보호자 관찰을 결합해 Haru 자체의 `steady`, `watch`, `needsConversation` 수준을 산출합니다. 결과는 보호자·상담사 화면에서 참고 신호, 영역별 요약, 다음 대화 액션으로 표시됩니다.

도형 따라 그리기 루틴은 Haru 원본 도형 모사 흐름으로 구성됩니다. `shape_copy_practice` 완료 시 획 수, 첫 터치 지연, 그리기 시간, 멈춤 횟수, 지우기 횟수, 샘플링된 터치 경로를 `cognitiveRoutineResults` metadata로 저장해 추후 활동 리포트의 원자료로 사용합니다.

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

```powershell
npm install
npm run stt:install
npm run rag:install
npm run stt:download
npm run rag:download
```

모델 weight는 각각 `backend/models/`, `rag_backend/models/`에 저장되며 Git에서 제외됩니다.

## 개발 서버

프론트엔드만 실행:

```powershell
npm run dev
```

Qwen STT, E5 RAG, Vite를 함께 실행:

```powershell
npm run dev:local
```

주소는 SPA `http://127.0.0.1:5173`, RAG `:8000`, STT `:8765`입니다. `dev:local`은 프로세스 생명주기 동안만 쓰는 RAG token을 세 서비스에 일치시켜 주입합니다.

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
- Vitest 59개 파일, 303개 테스트 통과
- STT 30개 테스트 통과, 실제 GPU/model smoke 1개는 기본 suite에서 제외
- RAG 24개 테스트 통과
- Vite production build 통과
- Playwright 화면 캡처 69개 통과. 기본 webServer 방식은 Windows에서 worker 종료 지연이 발생해, 최종 검증은 Vite preview 서버를 별도로 띄우고 `PLAYWRIGHT_BASE_URL`을 지정해 exit code 0으로 완료함
- Vercel production 배포 완료
  - Project: `hyunjun-kims-projects/haru`
  - Deployment: `dpl_9Hr1jfYSgowEYHSzk2Umd4U5av4M`
  - Stable URL: `https://saerok-memory.vercel.app`
  - Production URL 기준 Playwright 화면 캡처 69개 통과

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

기본 화면과 루틴 완료는 로컬 서비스 장애 때도 동작합니다. 다음 값은 브라우저 `localStorage`에 저장됩니다.

- `memoryGardenLang`
- `memoryCards`
- `cognitiveRoutineResults`
- `caregiverObservationRecords`
- `streakState`
- `gardenState`
- `haruAdminUsageRecord`
- `haruRagSyncOutbox` (전송 성공 후 제거)
- `haruRagDeletionOutbox` (원격 삭제가 `complete=true`일 때 제거)
- `haruSttRetryOutbox` (음성 Blob 자체가 아닌 재시도 참조만 저장)

동의한 원시 음성은 브라우저 IndexedDB에 별도 저장됩니다. 로컬 RAG가 실행 중이면 동의한 관리자 JSON snapshot은 `rag_backend/data/haru.db`에도 축적됩니다.

## 참고 문서

- `design.md`: UI/UX 및 제품 설계 상세
- `AGENTS.md`: 개발 컨벤션과 MVP 범위
- `docs/cognitive-screening-integration-plan.md`: 연구 보고서와 코드 구조를 대조한 인지 루틴 확장 판단서

## 의료 근거 기반 Haru 자체 평가 방향

Haru는 공개 논문, 공식 기관 자료, 공개 데이터셋, 보호자 관찰 흐름을 근거로 Haru 자체의 주의도·참고 위험도 평가를 설계한다.

제품 실행 또는 첫 사용 시에는 Haru 자체 참고 신호의 용도와 해석 범위를 간결히 안내한다. 앱 내부에서는 반복 루틴 기록, 회상 변화, 반응시간, 오류 패턴, 그리기 telemetry, 의미 유창성, 보호자 관찰을 조합해 사용자와 보호자/상담사에게 실질적인 참고 정보를 제공한다.

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
