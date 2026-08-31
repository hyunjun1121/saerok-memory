# Architecture

## Trust boundary

Haru SPA는 canonical 전체 JSON snapshot을 local outbox에 저장한 뒤 idempotent ingest
API로 보냅니다. SQLite commit 성공 여부는 Neo4j 상태와 분리됩니다. Transcript와
raw payload를 반환하는 endpoint는 local bearer token으로 보호합니다.

## Source of truth

SQLite tables:

- `users`: 사용자 profile 및 consent snapshot
- `canonical_snapshots`: user + dataset + server body SHA-256별 immutable 전체 JSON
- `questions`: user + dataset + session + external question ID 복합 범위의 원본 기록
- `episodes`: 모든 완료 응답의 검색 가능한 evidence 문서와 embedding
- `entities`, `event_entities`: 음성 explicit annotation에서만 파생된 관계
- `review_items`: missing/low confidence, missing transcript, sensitive 검토 항목
- `projections`: 시각화 전용 좌표
- `ingestion_receipts`: idempotency key, opaque content hash, server SHA-256 digest

Neo4j는 사용자별 SQLite snapshot에서 교체 가능한 derived mirror입니다.

## Retrieval

1. 검색어를 E5 `query:` prefix로 embedding
2. 사용자, 기간, 민감도 및 embedding revision 필터
3. evidence cosine similarity 계산
4. configurable minimum similarity 미만 evidence 제거
5. 상위 evidence의 explicit entity/relation 확장
6. 날짜, 원문, response type, nullable confidence와 함께 반환

저장 evidence는 E5 `passage:` prefix를 사용합니다. 모델 ID/revision은 각 row에
기록되며 다른 revision의 vector는 현재 검색에서 제외됩니다.

## Idempotent longitudinal ingestion

- 서버 id는 user/dataset/session/question/response 식별자의 SHA-256 기반 합성 ID입니다.
- canonical body는 user/dataset/body SHA-256별 immutable snapshot으로 보존됩니다.
- 같은 idempotency key + 같은 body는 저장 결과를 재사용합니다.
- 같은 key + 다른 body는 409입니다.
- replay는 미완료 projection과 Neo4j mirror를 다시 시도합니다.
- 새 snapshot은 포함된 question/evidence만 upsert합니다. 누락된 과거 기록은 삭제하지
  않으며, reset/partial 응답이 기존 완료 응답을 덮어쓰지 않습니다.
- 수정된 voice evidence의 entity link만 새 annotation에 맞게 교체하고 실제 orphan
  entity만 정리합니다.
- choice/sequence는 evidence지만 entity source가 아닙니다.
- dataset period, session date, question target date는 ISO 날짜로 검증됩니다.
- 사용자 데이터 파괴는 명시적 DELETE에만 허용됩니다.

## Market and locale isolation

- `haru_kiosk_usage_record` 2.0.0은 `dataset`과 `user`에 동일한 `market`과
  `ui_locale`/`locale`을 요구합니다.
- 허용 context는 `kr`/`ko-KR`, `jp`/`ja-JP`입니다. 1.0.0 legacy record만
  `kr`/`ko-KR` 기본값을 사용합니다.
- 사용자 최초 ingest context는 profile에 고정됩니다. 같은 `user_id`를 다른 시장으로
  ingest하거나 다른 시장 context로 QA·문항 생성을 요청하면 409로 거부합니다.
- 일본 시장의 evidence label, QA copy, recall template, filler는 일본어로 생성합니다.
  자동 문항 후보에서 한글, 원화 표기, 알려진 한국 demo 항목을 제외합니다.
- 서비스는 계속 local token 보호를 받는 로컬 프로세스이며 Vercel 배포 대상이 아닙니다.

## Deletion

`DELETE /api/users/{user_id}`:

1. SQLite derived row, source row, immutable snapshot을 한 transaction에서 삭제
2. Neo4j 사용자 subgraph 삭제 시도
3. 응답의 `complete` 확인

Neo4j 삭제가 실패하면 SQLite 사용자가 이미 사라진 다음 DELETE에서도 Neo4j 삭제를
다시 시도합니다. 호출자는 `complete=true`까지 삭제 tombstone을 유지해야 합니다.

SPA 쪽 audio와 outbox 삭제는 별도 계층이므로 호출자가 함께 완료해야 합니다.

## Remaining production work

- OIDC 및 server-derived subject, counselor/caregiver RBAC
- SQLite에서 PostgreSQL 및 row-level tenant isolation으로 전환
- encryption at rest, immutable audit log, retention job
- Neo4j durable outbox와 재시도/재구축 운영 도구
- schema migration 도구
- model migration/re-embedding command
- consent revocation end-to-end 확인 및 audio object 삭제 연동
