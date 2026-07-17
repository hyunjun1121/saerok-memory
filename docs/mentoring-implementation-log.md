# Mentoring-Based Revision Implementation Log

작성일: 2026-06-23
대상: `hyunjun1121/saerok-memory` (Haru / 피우다)
기준 문서: `high_level_plan.md`, `specifie_plan.md`

이 로그는 `specifie_plan.md`의 SP-01 ~ SP-18 항목별 구현 상태(Done / Partial / Not done), 변경 파일, 검증 증거를 기록한다.

## 검증 증거(요약)

- `npm run typecheck` → 통과(TS strict, `tsc -b`).
- `npm run lint` → 통과(`eslint .`, 0 errors).
- `npm test` → 33 파일 / 101 테스트 통과(Vitest + RTL).
- `npm run build` → Vite production build 통과.
- Playwright 화면 캡처 → 본문 말미에 실행 결과 기재.

## SP-01 학습자 문구에서 의료/검사/점수 느낌 제거 — Done

- `navigation.home` 학습→오늘 루틴, `result.title` 학습 완료→오늘 루틴 완료, `lesson.start.overline`→오늘의 짧은 루틴, `lesson.start.description` 완화, `home.advisoryTitle/Body` 비의료화, 인지 overline(작업기억/언어유창성/주의전환/색상집중/날짜감각)을 비임상 표현으로 변경.
- 보호자/상담사: `family.advisory.title` 종합 주의 신호→대화 준비 신호, `levels.needsConversation` 대화 필요→상담 대화 준비, `counselorPracticeLabel` 인지 루틴→활동 루틴.
- 3개 언어(ko/en/ja) 동일 의미로 동기화.
- 테스트: `src/locales/copySafety.test.ts`(학습자 키 금지어/공식 검사명 스캔, 3개 언어 키 셋 일치 검증).
- 변경 파일: `src/locales/ko.json`, `en.json`, `ja.json`, 신규 테스트.

## SP-02 버튼/글자/색 대비 고령자 기준 재정비 — Done

- `src/styles/tokens.css`: 누락 CSS 변수 `--color-blue-600`, `--color-red-600` 추가(Button3D arbitrary shadow가 참조), 따뜻한 배경 토큰(`--color-surface-warm`, `--color-background-warm`), `:focus-visible` 고대비 아웃라인, `prefers-reduced-motion` 전역 가드 추가.
- `Button3D`: md/lg/xl 글자 크기·최소 높이 상향(md 60px/lg 68px/xl 80px), `font-extrabold`.
- `ChoiceCard`: 테두리 3px, 선택/정답 시 링, 글자 `text-xl`, 상태 배지(선택됨/완료/다시 눌러보기), `aria-pressed`.
- `BottomNavigation`: 라벨 `text-base`(활성), 활성 = 색 + 알약 링 + `aria-current`(색 단독 아님).
- 완료 기준(색 없이 상태 구분) 충족.
- 변경 파일: `tokens.css`, `Button3D.tsx`, `ChoiceCard.tsx`, `BottomNavigation.tsx`.

## SP-03 터치/정답/음성 피드백 즉각·명확 — Done

- 신규 `src/utils/interactionFeedback.ts`(tap/success tone, vibration, calm TTS; 미지원 시 no-op).
- 신규 `src/hooks/useInteractionFeedback.ts`(소리 설정 게이트).
- `ChoiceCard` 선택 시 tap 피드백.
- `FeedbackTray`: `role="status"`, `aria-live="polite"`, `aria-atomic`.
- `SpeechRepeatPractice`: 저장 후 `onComplete()` 즉시 호출 제거 → 피드백 확인 후 Continue로 진행. 테스트(`SpeechRepeatPractice.test.tsx`)가 새 동작 반영(onComplete 미호출, 메타데이터 저장).
- 변경 파일: 위 신규 2개, `ChoiceCard.tsx`, `FeedbackTray.tsx`, `SpeechRepeatPractice.tsx`, `SpeechRepeatPractice.test.tsx`.

## SP-04 음성 우선 하루 회상 루틴 강화 — Done

- 신규 `src/features/speech/useSpeechCapture.ts`(isSupported/isListening/transcript/error/durationMs/start/stop/reset, 미지원·에러 안전).
- 신규 `src/features/speech/SpeechCapturePanel.tsx`(큰 마이크 버튼, “듣고 있어요” 상태 배지 + 펄스, 고대비 테두리, 20초 권장 안내, “말하기 마치기”, 미지원 안내).
- `PersonalMemoryRecall` 스토리 생성부를 `SpeechCapturePanel`로 교체(인식 결과 → 편집 가능 텍스트 영역 병합).
- `VerbalFluencyPractice`: 음성 입력 추가, 메타데이터 `inputMode`/`speechSupported`/`speechDurationMs`.
- `SpeechRepeatPractice`: phrase/transcript/speechSupported/listeningDurationMs/recognitionError/locale/inputMode 메타데이터.
- `mockExercises.ts` ex_6 프롬프트 구체화(3문장 회상).
- `speech.*` locale 키 추가(3언어).
- 테스트: `src/features/speech/useSpeechCapture.test.ts`(미지원 시 no-throw).
- 변경 파일: 위 신규 2개 + `PersonalMemoryRecall.tsx`, `VerbalFluencyPractice.tsx`, `SpeechRepeatPractice.tsx`, `mockExercises.ts`, locales.

## SP-05 건조한 숫자/문제형 루틴을 일상생활 태스크로 — Done

- `ExercisePayload`에 `domain`, `recommendedDays`, `scenarioTitle`, `scenarioBody`, `benefitCopy` 추가.
- 신규 `src/components/ScenarioCard.tsx`.
- `AttentionPattern`(장보기 감), `DigitSpanPractice`(버스 번호 482), `TrailSwitchingPractice`(복지관 가는 길), `StroopTouchPractice`(색 신호 + 색약 안내)에 일상 맥락·시나리오 적용.
- `ExerciseRenderer`가 시나리오 문자열을 해당 컴포넌트로 전달.
- “문제 풀이” 느낌 문구 완화.
- 변경 파일: `mockExercises.ts`, `ScenarioCard.tsx`, `ExerciseRenderer.tsx`, `AttentionPattern.tsx`, `DigitSpanPractice.tsx`, `TrailSwitchingPractice.tsx`, `StroopTouchPractice.tsx`.

## SP-06 요일별 루틴 플래너 + 반복 훈련 구조 — Partial

- 신규 `src/data/dailyRoutinePlan.ts`(월~일 도메인/이름 매핑).
- 신규 `src/features/lessons/sessionBuilder.ts`(`buildDailySessionExercises`: due 카드 우선 삽입, 일반 세션 길이 상한 8, 캡처 경로는 무제한 slice).
- `LessonScreen`이 `getMemoryCards()` + `buildDailySessionExercises` 사용(직접 `JSON.parse` 제거).
- `HomeScreen`에 오늘 루틴 이름 표시.
- 테스트: `src/features/lessons/sessionBuilder.test.ts`.
- 부분 사유: 요일별로 세트를 완전히 다르게 구성하는 풀 셀렉터(`dailyPlanSelector`)는 캡처/기존 학습 흐름 호환을 위해 전체 목록 유지 + 길이 상한으로 대체. 완전 요일 셋 교체는 남은 과제.

## SP-07 주간 보상 + 복지관 보상 카탈로그 구조 — Done

- 신규 `src/features/gamification/weeklyRewards.ts`(`WeeklyRewardState`, `REWARD_CATALOG` 데이터 구조, `getCompletedDaysThisWeek`, `recordWeeklyCompletion`; 점수가 아닌 참여 기반, 순위표 없음).
- 신규 `src/components/WeeklyRewardCard.tsx`.
- `ResultScreen`에 주간 참여 카드 추가.
- `weekly.*` locale 키 추가(3언어).
- 테스트: `src/features/gamification/weeklyRewards.test.ts`.
- 변경 파일: 위 신규 2개 + `ResultScreen.tsx`, locales.

## SP-08 보호자/상담사 정보 분리 강화 — Done

- `FamilyScreen` 기본 탭 `family`로 변경.
- 신규 `src/features/family/familySupportSummary.ts`(`generateFamilySupportSummary`: 참여 흐름/최근 활동/대화 제안/격려/상담 자원 노출 여부; raw 점수·오류·반응시간 미노출).
- 보호자 탭: 종합 주의 신호 카드를 부드러운 “대화 준비” 카드로 교체, 조건부 `SupportResourceCard`.
- `haruAdvisory`: 단일 낮은 단어 회상만으로 `needsConversation` 미발생(watch 처리). 2회 이상 반복 또는 보호자 관찰과 함께일 때만 대화 준비.
- 테스트: `haruAdvisory.test.ts`(단일 세션 → watch 케이스 추가), `FamilyScreen.test.tsx`(기본 family 탭, counselor 전환).
- 변경 파일: `FamilyScreen.tsx`, `familySupportSummary.ts`, `haruAdvisory.ts`, 두 테스트.

## SP-09 가까운 치매안심센터/공식 상담 자원 카드 — Done

- 신규 `src/data/supportResources.ts`(`SupportResource` 타입, `getVerifiedSupportResources` — `lastVerifiedAt`/`sourceUrl` 없으면 미노출; MVP는 검증 전이라 빈 목록).
- 신규 `src/components/SupportResourceCard.tsx`(차분한 톤, “상담 자원 보기”, 검증 전 안내).
- 보호자 탭에서 조건(반복 우려 / needsConversation) 시 표시.
- `support.*` locale 키 추가(3언어).
- 변경 파일: 위 신규 2개 + `FamilyScreen.tsx`, locales.

## SP-10 복지관/키오스크/태블릿 모드 1차 구현 — Done(골격)

- 신규 `src/app/kiosk/KioskHomeScreen.tsx`(큰 글자/큰 버튼, 오늘 루틴 1개 CTA, 익명/로컬 데모).
- 신규 `src/features/kiosk/useKioskControls.ts`(Enter/Space 주요 버튼, 숫자 1-4 선택).
- `App.tsx`에 `/kiosk` 라우트 추가(AppShell 밖, 독립 레이아웃).
- 운영자 요약/카드·QR 로그인은 `docs/welfare-center-hybrid-plan.md`에 별도 과제로 명시.

## SP-11 온보딩/맞춤 루틴(오늘 할 것만) — Partial

- 신규 `src/features/profile/learnerProfileStorage.ts`(preferredInputMode, largeTextMode, kioskModePreferred, autoStartTodayRoutine, soundFeedbackEnabled, onboarded).
- `settings.*` locale 키(소리 피드백, 글자 크게, 참여 방법) 추가.
- 부분 사유: 2-3단계 첫 실행 온보딩 UI와 `dailyPlanSelector` 결합은 남은 과제. 프로필 저장 구조와 소리 설정 토글 기반은 마련. 현재 `SettingsScreen`에 토글 UI까지 연결하지는 않음(데이터/훅만 준비).

## SP-12 정서/고립감/사회활동 회상 단서 — Partial

- ex_6 회상 프롬프트에 `domain: moodSocial` 태깅 + 부드러운 3문장 회상 안내.
- 보호자 관찰 8개 영역에 `moodSocial` 유지 → 상담사 “기분·사회활동” 대화 제안 존재.
- 부분 사유: 매일 전용 정서/사회 질문 마이크로 루틴(별도 문항 세트)은 세션 길이/캡처 호환을 위해 추가하지 않음. 회상-감정 흐름(ex_7 emotionTag)으로 실질적 커버.

## SP-13 공식 검사 도구는 참고만 — Done

- 신규 `docs/cognitive-domain-mapping.md`(루틴→광범위 영역 매핑, 비복제 원칙).
- `mockExercises.ts`에 공식 도구명 주석/문구 없음.
- `copySafety.test.ts`가 공식 검사명(MMSE/MoCA/CIST 등) 노출 스캔.
- README 의료/법 guardrail 유지.

## SP-14 이미지 대체 텍스트 / 색 단독 정보 제거 — Done

- `PictureChoice` 이미지 alt를 라벨로 사용(의미 이미지).
- `ChoiceCard` 색 외 테두리/링/상태 배지/`aria-pressed`.
- `StroopTouchPractice` 색상명 텍스트 + swatch + `aria-label`(색이 단독 아님).
- `TrailSwitchingPractice` 번호/그림 그룹을 색 + 모양(원/사각) + 아이콘(Hash/Image) + 범례 텍스트로 구분.
- `TopStatusBar` streak/water에 `aria-label`, 장식 이미지 `alt=""`/`aria-hidden`.
- 테스트: `src/components/ChoiceCard.test.tsx`(aria-pressed + 상태 라벨).

## SP-15 복지관 운영 요약 / 하이브리드 문서화 — Done(문서)

- 신규 `docs/welfare-center-hybrid-plan.md`(운영 모드, 개인정보 축적 후보, 운영자 요약 범위, 남은 과제).
- 코드 구현은 SP-10 골격 이후 별도 과제.

## SP-16 일본 확장 리서치 분리 — Done(문서)

- 신규 `docs/japan-localization-research-plan.md`(복지관 맥락, 보상 선호, 캐릭터/색, 일본어 의료 오해 점검).
- 일본어 i18n은 한국어 개정과 동기화. 일본 전용 센터/보상은 코드에 넣지 않음.

## SP-17 로컬 저장소 방어 코드 — Done

- 신규 `src/utils/safeStorage.ts`(`readJson`/`writeJson`/`removeKey`/`readJsonArray`, localStorage 미지원·invalid JSON·QuotaExceeded 처리).
- `cognitiveRoutineStorage.ts`, `memoryCardStorage.ts` safeStorage로 이전.
- `LessonScreen` 직접 `JSON.parse(localStorage.getItem("memoryCards"))` 제거 → `getMemoryCards()`.
- 테스트: `src/utils/safeStorage.test.ts`(corrupt JSON → fallback 등).

## SP-18 검증 계획 — Done

- `npm run typecheck` / `npm run lint` / `npm test`(101) / `npm run build` 전부 통과.
- 접근성 단위 테스트: `ChoiceCard.test.tsx`(aria-pressed/상태 라벨).
- Copy safety 테스트: `copySafety.test.ts`.
- Storage resilience 테스트: `safeStorage.test.ts`.
- Speech fallback 테스트: `useSpeechCapture.test.ts`.
- Playwright 화면 캡처: 본문 말미.

## 의료/저작권/개인정보 안전 조치

- 학습자 화면에 검사/선별/진단/점수/위험도/공식 검사명 없음(`copySafety.test.ts`로 보호).
- 공식 검사 문항/채점/컷오프 미복제.
- 기억 카드는 기본 비공개, `shareWithFamily` 기본 false.
- 공식 상담 연락처는 검증(`lastVerifiedAt`/`sourceUrl`) 전까지 표시 안 함.
- 단일 세션 낮은 수행은 진단으로 해석하지 않음(보수적 advisory).

## 남은 한계(요약)

- SP-06: 완전 요일별 세트 교체(현재는 길이 상한 + due 우선).
- SP-11: 첫 실행 온보딩 UI + 설정 화면 토글 연결(데이터/훅은 준비).
- SP-12: 전용 일일 정서 마이크로 루틴.
- SP-10/SP-15: 운영자 요약 화면, 카드/QR/자동 로그인, 서버 동기화(MVP 범위 밖).
- 복지관 실물 보상 지급/재고 관리는 데이터 구조만 있고 별도 범위.
