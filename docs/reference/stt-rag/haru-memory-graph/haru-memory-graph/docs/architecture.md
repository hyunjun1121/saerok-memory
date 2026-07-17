# Architecture

## Source of truth

SQLite는 데모의 업무 데이터 source of truth입니다. 실제 운영에서는 PostgreSQL로 교체합니다.

Neo4j는 검색·관계 탐색·시각화를 위한 파생 저장소입니다. 원본 JSON 또는 업무 DB에서 재생성할 수 있습니다.

## Retrieval

1. 질문 임베딩 생성
2. 사용자·기간 필터 적용
3. episode cosine similarity 계산
4. 상위 episode의 entity/relation 확장
5. 원문, 날짜, 신뢰도와 함께 반환

현재 QA는 외부 LLM 없이 deterministic하게 동작합니다. LLM을 붙일 경우 evidence 목록만 context로 제공하고, 근거가 없는 내용은 답하지 않도록 구성해야 합니다.

## 3D visualization

- episode embedding
- UMAP 3차원 projection
- `3d-force-graph` 렌더링
- semantic similarity edge
- 노드 클릭 시 원문 evidence
- projection 좌표는 검색 로직과 분리

## Production hardening checklist

- PostgreSQL, row-level tenant isolation
- OIDC/SAML, RBAC
- 음성 object storage encryption
- PHI/PII classification
- retention/deletion workflow
- immutable audit log
- LLM prompt/model version logging
- human review workflow
- automated regression dataset
- consent revocation propagation
