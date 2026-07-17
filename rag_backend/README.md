# Haru Local Memory RAG

Haru 앱이 저장하는 `haru_kiosk_usage_record` 1.0.0 JSON을 로컬에서 수집하고,
모든 응답을 검색 가능한 근거 문서로 축적하는 별도 FastAPI 서비스입니다.

이 서비스는 의료 판정 시스템이 아닙니다. 상담사 QA는 저장된 기록을 검색하고
근거를 요약할 뿐이며, 생성형 LLM은 포함하지 않습니다.

## 데이터 흐름

```text
Haru SPA canonical JSON
  -> POST /api/ingest/json
  -> SQLite immutable canonical JSON snapshot + Question/Response 업무 기록
  -> E5 passage embedding Evidence 문서
  -> 음성 응답의 명시적 annotation만 Entity/Relation 파생
  -> 선택적 Neo4j 미러
  -> E5 query embedding 검색
  -> 근거가 포함된 deterministic QA / 다음 문항 후보
```

- `single_choice`, `button_sequence`, `voice` 응답을 모두 Evidence로 저장합니다.
- 선택·순서 응답의 오답이나 정답표를 개인 사실로 승격하지 않습니다.
- Entity는 음성 응답에 이미 포함된 허용 목록의 `derived_annotations`에서만 만듭니다.
- STT confidence가 없으면 `null`과 검토 항목으로 남깁니다. 임의로 `1.0`을 넣지 않습니다.
- `demo`/`mock`/`placeholder` 등 Qwen이 아닌 engine에 기록된 숫자 confidence는
  신뢰하지 않고 `null`과 검토 항목으로 파생합니다. canonical JSON 원문은 변경하지 않습니다.
- Qwen처럼 confidence를 제공하지 않는 엔진의 명시적 음성 annotation은
  `requires_review=true` 초안 문항에만 사용합니다. 낮은 수치 confidence는 자동 출제에서 제외합니다.
- SQLite가 원본 저장소이고 Neo4j는 삭제·재구축 가능한 파생 저장소입니다.
- transcript에 건강·연락처 등 보수적 민감 패턴이 있으면 annotation 유무와 관계없이
  기본 검색·자동 문항 생성에서 제외하고 명시적 검토 대상으로 남깁니다.

## 모델

기본 임베딩 모델:

```text
model:   intfloat/multilingual-e5-small
revision: 614241f622f53c4eeff9890bdc4f31cfecc418b3
path:    models/multilingual-e5-small
```

서비스는 네트워크를 사용하지 않고 로컬 파일만 읽습니다. 모델이 없거나 로드에
실패하면 `/health`가 `ready=false`를 반환하고 수집·검색은 503으로 실패합니다.
Hash embedding으로 조용히 대체하지 않습니다.

런타임은 Hugging Face가 checkpoint 다운로드 시 기록한
`.cache/huggingface/download/config.json.metadata`의 commit revision을 설정값과
대조합니다. authoritative metadata가 없거나 revision이 다르면 모델을 로드하지 않으며
`/health`의 `checkpoint_revision`과 `error`에 상태를 표시합니다.

문서는 `passage:` prefix, 검색어는 `query:` prefix를 사용합니다. `models/`는
Git에서 제외됩니다.

명시적으로 다시 받을 때만 다음 명령을 사용합니다.

```powershell
npm run rag:download
```

## 로컬 실행

Python 3.11 이상 권장. STT 백엔드와 dependency/프로세스를 공유하지 않습니다.

```powershell
npm run rag:install
npm run rag:dev
```

`.env`의 `RAG_API_TOKEN`을 로컬 값으로 바꾸고 SPA에도 같은 값을 지정합니다.

```env
VITE_RAG_API_BASE_URL=http://127.0.0.1:8000
VITE_RAG_API_TOKEN=<RAG_API_TOKEN과 같은 값>
```

상태 확인:

```powershell
Invoke-RestMethod http://127.0.0.1:8000/health
```

## 수집 계약

SPA가 보내는 정확한 요청:

```http
POST /api/ingest/json
Content-Type: application/json
Idempotency-Key: haru-fnv1a64-<opaque hash>
X-Haru-Content-Hash: fnv1a64-<opaque hash>
Authorization: Bearer <local token>  # RAG_API_TOKEN 설정 시

{ canonical full haru_kiosk_usage_record JSON }
```

두 hash header는 bounded opaque token입니다. 서버는 자체 SHA-256 body digest를
별도로 저장합니다. 같은 사용자·dataset·idempotency key로 다른 body를 보내면
409를 반환합니다. canonical body는 사용자·dataset·SHA-256별 immutable snapshot으로
저장되어 보호된 snapshot API에서 그대로 복원할 수 있습니다. 같은 body를 다른
receipt로 보내도 snapshot을 중복 저장하지 않습니다. 같은 body 재전송은
`idempotent_replay=true`로 응답하면서 미완료 projection/Neo4j 파생 작업을 재시도합니다.

`dataset.period`와 각 `session_date`는 ISO 날짜여야 하며 session은 period 안에 있어야
합니다. 부분 또는 reset snapshot은 이전 완료 응답·질문·evidence를 지우지 않습니다.
명시적 `DELETE /api/users/{user_id}`만 사용자 기록을 파괴합니다.

`RAG_API_TOKEN`이 비어 있을 때 로컬 ingest만 토큰 없이 허용합니다. transcript,
raw evidence, QA, 다음 문항, 삭제 API는 token 미설정 상태에서도 열리지 않습니다.

## 주요 API

```text
GET    /health
POST   /api/ingest/json
POST   /api/ingest/seed
GET    /api/users/{user_id}/timeline
GET    /api/users/{user_id}/graph
GET    /api/users/{user_id}/galaxy
GET    /api/users/{user_id}/evidence/{episode_id}
GET    /api/users/{user_id}/review-queue
GET    /api/users/{user_id}/snapshots
GET    /api/users/{user_id}/snapshots/{snapshot_id}
POST   /api/users/{user_id}/qa
POST   /api/users/{user_id}/questions/generate
DELETE /api/users/{user_id}
```

Evidence/QA/삭제 계열 API에는 다음 중 하나가 필수입니다.

```http
Authorization: Bearer <RAG_API_TOKEN>
X-Haru-Local-Token: <RAG_API_TOKEN>
```

삭제는 SQLite의 질문, evidence, embedding, entity link, projection, review queue,
canonical snapshot, idempotency receipt를 한 transaction에서 제거하고 Neo4j 삭제를
시도합니다. `complete=false`이면 같은 DELETE를 재호출해야 합니다. SQLite 사용자가
이미 없어도 Neo4j 삭제를 다시 시도하며, 호출자는 `complete=true` 전까지 로컬 삭제
tombstone을 유지해야 합니다.

QA는 `QA_MIN_SIMILARITY`(기본 `0.78`) 이상인 evidence만 근거로 사용합니다. 관련 근거가
없으면 답을 추측하지 않고 `no_answer=true`를 반환합니다.

## Neo4j

기본값은 비활성화입니다. 사용할 때 `.env`에서 연결 정보를 설정하거나 Docker
Compose를 사용합니다.

```powershell
docker compose up --build
```

Neo4j 실패는 SQLite 수집을 되돌리지 않습니다. `/health`와 ingest 응답의
`neo4j_ready`/`neo4j_synced`를 확인하십시오.

## 테스트

테스트는 실제 모델 대신 주입된 deterministic fake encoder를 사용합니다.

```powershell
.\.venv\Scripts\python.exe -m pytest -q
```

검증 범위:

- 세 응답 유형 전체 evidence 저장
- E5 query/passage prefix 분리와 무음 fallback 금지
- idempotent replay와 key 충돌
- immutable canonical snapshot 원문 복원과 중복 방지
- partial/reset 재수집의 이전 evidence 보존과 미완료 파생 작업 재시도
- 누락/0 confidence 보존
- 재수집 update와 stale entity link 제거
- ISO period/session/target date 422 검증
- 민감 transcript 기본 제외와 무관 질문 no-answer threshold
- 사용자·주차 복합 ID 충돌 방지
- token 보호와 exact CORS origin
- SQLite/Neo4j 반복 삭제 완료 상태

## 경계

- Qwen STT는 `127.0.0.1:8765`, 이 서비스는 `127.0.0.1:8000`의 별도 프로세스입니다.
- 두 서비스 모두 로컬 데이터/GPU 서비스이며 Vercel 배포 대상이 아닙니다.
- 보호자 화면에는 transcript/raw evidence를 직접 전달하지 않습니다.
- 운영 전 사용자 인증, 역할 권한, 암호화, 감사 로그, retention 및 Neo4j 재시도
  outbox가 추가로 필요합니다.
