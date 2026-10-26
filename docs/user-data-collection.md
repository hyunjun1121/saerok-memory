# Haru 사용자 데이터 수집 사양

## 일본 로컬 실증 `/pilot` 별도 사양 (2026-10-26)

이 절은 `japan-pilot` 브랜치의 첫 만남 실증에 적용합니다. 아래의 일일 루틴·Supabase 데이터 수집 사양과 분리됩니다. 실행·백업·이동은 [로컬 운영 가이드](japan-pilot-local-guide.md), 고정 문항은 [일·한 문항 문서](japan-first-meeting-pilot-ja-ko.md)를 따릅니다.

- 범위: 참가자 번호 1~99999, UUID 회차, 문항 정의 스냅샷, 동의 시각·범위, 선택·변경·확정, 본질문·후속 질문별 원본 녹음, 중간 녹음과 재녹음, 체류·포커스·이탈 체크포인트·기기 환경.
- 시작할 때마다 새 회차로 Q1부터 수집합니다. 동일 번호의 이전 회차는 보존하고, 강제 종료 시 정확한 종료 시각을 추정하지 않습니다.
- 매 회차 녹음·로컬 저장 동의가 필요하며 미래 개인화 동의는 별도·기본 해제입니다. 기존 일일 루틴 동의를 실증 동의로 대신하지 않습니다.
- 저장: 로컬 Node.js 내장 SQLite `local-data/japan-pilot/pilot.sqlite`, `participants/` 원본·조각 파일, 브라우저 IndexedDB 전송 대기 `haruJapanPilotDelivery`. 이전 브라우저 회차 `haruJapanPilot`은 호환·내보내기를 위해 구분합니다.
- `/api/pilot-local/`은 같은 PC·같은 출처로만 접근합니다. 일일 루틴 telemetry·Supabase·STT·RAG 전송을 실행하지 않으며, 자동 전사·관계 추정·프로필 생성도 하지 않습니다.
- 내보내기: `sessions.json`, `attempts.csv`, `questions.csv`, `events.csv`, 원본 음성 ZIP. 삭제는 선택 회차 하나에만 적용되며 이미 내보낸 ZIP·백업은 진행자가 따로 관리합니다.
- Git에는 코드·고정 안내 자산·문서만 포함합니다. Git clone은 참가자 데이터를 복제하거나 여러 PC의 기록을 동기화하지 않습니다. 전체 데이터 이동은 서버 종료 후 저장 폴더 전체 복사로 진행합니다.
- 새 Fish Audio 음원은 고정 안내 대본의 제작 계획 단계입니다. 참가자 음성을 Fish로 보내는 기능이 아닙니다. [장면별 대본](japan-pilot-tts-plan-ja-ko.md)과 현재 브라우저 읽어주기 동작을 구분합니다.

## 기존 일일 루틴 데이터 수집

기준일: 2026-08-06. 구현 기준 파일은 `src/features/analytics/`,
`src/features/profile/haruDataApi.ts`, `api/`,
`supabase/migrations/202608060001_haru_data_plane.sql`이다.

## 원칙

- 한국 배포와 일본 배포는 각각 일치하는 `VITE_HARU_MARKET`과 서버 전용
  `HARU_MARKET`, 별도 Supabase 프로젝트, 함수 지역, 비밀키, 음성 버킷을
  사용한다. 클라이언트가 보낸 시장·locale 값은 서버가 신뢰하지 않고 배포
  설정으로 다시 결정한다.
- 연결 전에는 브라우저 로컬 자료만 사용한다. 상담사가 발급한 8자리 코드로
  연결한 뒤 HttpOnly 기기 쿠키를 받은 경우에만 서버 전송이 가능하다.
- 사용 흐름 이벤트에는 이름, 연락처, 주소, 자유서술, 문항 원문, 선택지 문구,
  전사문, 음성, 좌표를 넣지 않는다. 정해진 ID·상태·횟수·시간만 허용한다.
- 사용 흐름 수집, 장기 활동 저장, 음성 녹음, STT 처리, 전사 저장, 음성 저장,
  개인화, 가족 공유를 각각 독립 선택으로 관리한다.
- 사용자 화면 결과는 Haru 활동 기록과 지원 신호다. 한 번의 세션으로 질환을
  단정하지 않는다.

## 수집 항목

| 영역 | 저장 가능한 값 | 수집 시점 | 저장 위치 |
| --- | --- | --- | --- |
| 앱 진입 | 신규/재방문, 온라인 상태, 앱·콘텐츠 버전 | 앱 시작 | telemetry |
| 화면 흐름 | route ID, 최초/이동 방식, 표시·숨김, 온라인·오프라인 | route/브라우저 상태 변경 | telemetry |
| 초기 설정 | 단계 ID, 표시/완료/이탈, 언어·큰 글자·입력 방식 코드 | onboarding 조작 | telemetry + 로컬 profile |
| 일반 설정 | 자동 시작, 효과음 상태 코드 | 설정 변경 | telemetry + 로컬 profile |
| 동의 | 8개 동의의 전체 snapshot, revision, 변경 시각 | 연결 직후 및 변경 | consent receipt + 로컬 consent |
| 루틴 세션 | 시작/일시정지/복귀/종료 관찰/완료, 진행률, 마지막 문항 instance, active/wall 시간 | 루틴 생명주기 | routine session + telemetry |
| 이탈·복귀 | pagehide/reload/close/route 이동, 마지막 문항, 이후 복귀 여부 | 비정상 종료 관찰·재진입 | session + telemetry |
| 문항 노출 | question ID/type/domain/order/difficulty/content version/hash | 문항 표시 | telemetry |
| 반응 시간 | 첫 조작까지, 확인까지, active/wall, 피드백 체류 시간 | 첫 조작·확인·다음 문항 | question attempt + telemetry |
| 선택 행동 | option ID, 선택/해제, 변경 횟수, 최종 ID 배열 | 선택 및 확인 | question attempt + telemetry |
| 순서 행동 | item ID, 추가 순서, 최종 sequence | 순서 문항 조작 | question attempt + telemetry |
| 결과 흐름 | 맞음/다름/비채점, 유효성, 재시도·도움 횟수, 건너뜀 사유 | 확인·피드백 | question attempt + telemetry |
| 음성 UI | 권한 상태, 녹음 시작/완료/실패, 길이, STT 상태·지연, 무음 여부, UI variant, waveform mode, 안내 문구·STT pipeline version, 유한 outcome reason | 음성 문항 노출·녹음 | telemetry(내용 없음) |
| 전사·음성 | 전사문, STT 모델 metadata, 선택적 음성 object | 각 보관 동의가 켜진 음성 응답 | 로컬 admin/STT 저장소; 별도 민감 경로 |
| 그리기 | 시작/지우기/완료, stroke/point/pause/erase 횟수, 시간 | 그리기 문항 | 로컬 routine + telemetry |
| 인지 활동 metadata | 회상 선택, 숫자 길이, 단어 수·반복 수, trail 오류·시간, 색상 반응, 날짜 선택 | 해당 활동 완료 | 로컬 cognitive record 및 question attempt의 제한 필드 |
| 기억 자료 | 주제, 감정·사람·장소 tag, story cue, 사용자가 허용한 전사, 공유 여부, 복습 상태 | 기억 문항·복습 | 로컬 memory card; 개인화 허용 시 로컬 RAG |
| 보호자 입력 | 관찰 영역 코드, 선택 상태, 작성 시각, 공유 여부 | 보호자 제출 | 로컬 observation; telemetry에는 영역 수만 저장 |
| 리포트 | report/section ID, caregiver/counselor 역할 | 리포트 열람 | telemetry |
| 연결·공유 | 역할, pairing 상태, 공유 범위·허용 여부 | 코드·공유 변경 | access telemetry |
| 보상 | reward ID/type | 활동 완료 | 로컬 보상 + telemetry |
| 품질 | render latency, 네트워크/HTTP 상태 코드, retry 횟수, 복구 가능 오류 코드 | 실행·동기화 | telemetry |
| 권리 행사 | export/delete 범위, 삭제 request ID·처리 상태 | 내보내기·삭제 | access audit + deletion job |

`active` 시간은 화면이 보이고 focus가 있으며 최근 조작 후 30초 안인 구간만
합산한다. `wall` 시간은 실제 경과 시간이다. 따라서 멈춰 둔 화면 때문에 문항
시간이 부풀어 오르는 문제를 분리해 볼 수 있다.

현재 음성 화면은 `assist_v2`와 `reactive_red`를 문항 노출 시점부터 기록한다.
`baseline_v1`과 `none`은 비교 실험용 코드다. `sttPipelineVersion`은 노출·시작
단계에서는 프런트엔드 pipeline bundle 식별자이며, 완료 이벤트에서는 서버가
반환한 `preprocessingVersion`(`haru-dc-hp80-rms-v2` 등)을 우선 기록한다.
이 값들은 정해진 코드와 상태뿐이다. 전사문, 음성, 문항 원문, 원시 오류 문구는
telemetry에 넣지 않는다.

## 동의 게이트

- `usageAnalytics=false`: telemetry outbox를 비우고 새 telemetry를 만들지 않는다.
- `longitudinalUsageStorage=false`: 활동·문항 서버 저장을 중단하고 로컬 장기 활동,
  memory, RAG 자료 삭제 절차를 실행한다.
- `voiceRecording=false`: 마이크 녹음을 시작하지 않는다.
- `sttProcessing=false`: STT 작업을 만들지 않고 대기 중 작업을 취소한다.
- `transcriptStorage=false`: 보관된 전사와 파생 annotation을 지운다.
- `audioStorage=false`: 보관된 음성 object를 지운다. 전사 동의는 별개다.
- `personalizedQuestionUse=false`: RAG 전송 대기열을 비우고 사용자 RAG 삭제를
  예약한다. 다시 켤 때는 명시적 재등록이 필요하다.
- `familySharing=false`: 저장된 기억·관찰 내용을 보호자/상담사 리포트 입력에서
  제외한다.

RAG payload에는 음성 object key를 넣지 않는다. 전사 보관 동의가 없으면 음성
문항 record 자체를 RAG payload에서 제외한다. 장기 저장과 개인화가 모두 켜진
경우에만 RAG ingest가 가능하다.

## 전송과 복구

1. 허용 목록 검사를 통과한 telemetry를 market별 IndexedDB outbox에 저장한다.
2. 최대 50건·64 KiB batch로 같은 origin의 `/api/telemetry/v1/batches`에 보낸다.
3. 성공 ID만 제거한다. 일시 오류는 지수 backoff로 재시도한다. 미전송 항목은
   최대 10,000건, 30일까지만 유지한다.
4. 세션과 문항 attempt는 별도 typed endpoint로 보낸다. 자유서술과 media는 이
   endpoint가 거부한다.
5. event ID와 삭제 request ID로 중복 요청을 안전하게 처리한다.

## 열람·삭제

- 내보내기는 기기 로컬 자료와 연결된 서버 자료를 각각 JSON 파일로 저장한다.
- 전체 삭제는 먼저 서버 request ID를 보존하고 로컬 자료를 지운다. 설정 화면이
  서버 상태를 다시 확인하며, 서버가 `completed`를 반환한 뒤에만 연결 정보를
  제거한다.
- 서버 worker는 due/stale job을 claim하고 private voice object를 먼저 지운 뒤,
  확인된 path와 DB record를 transaction으로 마무리한다. 실패는 재시도되고 write
  fence가 유지된다.

## 운영 전 남은 정책

- 서버 row의 기간별 자동 보존·파기 기간은 아직 migration에 고정하지 않았다.
  국가별 법무·연구 운영 결정을 받은 뒤 category별 보존 기간과 purge job을 추가한다.
- production Supabase migration, bucket, secrets, cron은 실제 국가별 계정에서 아직
  적용·검증하지 않았다.
- Supabase deletion worker는 Supabase DB와 configured voice bucket까지만 완료를
  증명한다. 외부 RAG를 production data plane에 연결하려면 participant-scoped RAG
  inventory와 삭제 receipt를 추가한 뒤에만 통합 삭제 완료로 취급한다.
