# Haru Personal Memory Graph

노인 사용자의 일상 발화와 키오스크 응답을 시간 기반 개인 기억 그래프로 축적하고, 다음 문항 생성·전문가 QA·3D 메모리 시각화를 제공하는 실행 가능한 데모 저장소입니다.

## 포함 기능

- 제공된 7일 JSON 데이터 ingestion
- SQLite 기반 원본/업무 데이터 저장
- Neo4j 기반 사건·인물·장소·활동·음식·감정 그래프 저장
- Neo4j 없이도 동작하는 로컬 NetworkX 호환 JSON 그래프
- Hash embedding 기본 제공
- 선택적으로 Sentence Transformers 모델 다운로드 및 사용
- 3D UMAP 투영
- `3d-force-graph` 기반 Memory Galaxy
- 날짜·사용자·민감도·신뢰도 필터
- 근거 원문을 포함한 전문가용 QA
- 규칙 기반 개인화 객관식 문항 생성
- 저신뢰·민감 정보의 검토 큐
- Docker Compose
- API 및 ingestion 테스트

이 저장소는 의료 진단 시스템이 아닙니다. QA는 기록된 발화와 구조화 정보의 검색·요약만 수행합니다.

## 빠른 실행

Python 3.11 이상이 필요합니다.

```bash
cp .env.example .env
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

python scripts/bootstrap.py
uvicorn app.main:app --reload --port 8000
```

브라우저:

- 3D Memory Galaxy: http://localhost:8000
- API 문서: http://localhost:8000/docs
- 관리자 요약: http://localhost:8000/admin

`bootstrap.py`는 다음을 수행합니다.

1. SQLite 스키마 생성
2. `data/haru_7day_admin_usage_records.json` ingestion
3. 로컬 그래프 및 임베딩 생성
4. 3D 좌표 계산
5. Neo4j가 연결되어 있으면 동일 데이터 upsert

## Docker 실행

```bash
cp .env.example .env
docker compose up --build
```

- 앱: http://localhost:8000
- Neo4j Browser: http://localhost:7474
- Neo4j Bolt: bolt://localhost:7687

초기 부팅 시 API 컨테이너가 seed JSON을 자동 ingestion합니다.

## 선택 모델 다운로드

기본 모드는 외부 모델 없이 즉시 실행됩니다. 한국어 의미 임베딩 품질을 높이려면:

```bash
python scripts/download_models.py
```

그 후 `.env`:

```env
EMBEDDING_BACKEND=sentence_transformers
EMBEDDING_MODEL=intfloat/multilingual-e5-small
```

모델은 실행 시 Hugging Face에서 다운로드됩니다. 저장소에는 모델 가중치를 포함하지 않습니다.

UMAP 미설치 환경에서는 PCA로 자동 대체됩니다.

## 주요 API

```text
POST /api/ingest/seed
POST /api/ingest/json
GET  /api/users/{user_id}/timeline
GET  /api/users/{user_id}/graph
GET  /api/users/{user_id}/galaxy
POST /api/users/{user_id}/qa
POST /api/users/{user_id}/questions/generate
GET  /api/users/{user_id}/review-queue
GET  /api/users/{user_id}/evidence/{episode_id}
```

### QA 예시

```bash
curl -X POST http://localhost:8000/api/users/USR-000001/qa \
  -H 'Content-Type: application/json' \
  -d '{"question":"최근 일주일 동안 만난 사람과 함께 한 활동을 근거와 함께 알려줘"}'
```

### 개인화 문항 생성 예시

```bash
curl -X POST http://localhost:8000/api/users/USR-000001/questions/generate \
  -H 'Content-Type: application/json' \
  -d '{"target_date":"2026-07-27","count":4}'
```

## 데이터 구조

```text
User
 └─ HAS_EPISODE → Episode
      └─ DESCRIBES → Event
           ├─ OCCURRED_AT → Place
           ├─ WITH_PERSON → Person
           ├─ INVOLVED_ACTIVITY → Activity
           ├─ INVOLVED_FOOD → Food
           ├─ EXPRESSED_EMOTION → Emotion
           └─ HAS_ATTRIBUTE → Entity

Question ─ DERIVED_FROM → Episode/Event
Assertion ─ SUPPORTED_BY → Episode
```

모든 파생 데이터는 원본 `Episode`를 가리키는 provenance를 보존합니다.

## 실제 서비스 전환 시 교체 지점

- `app/services/embedding.py`
  - 기본 Hash embedding을 사내 임베딩 API 또는 Sentence Transformers로 교체
- `app/services/extraction.py`
  - 현재 JSON annotations 우선
  - 실제 STT transcript에는 승인된 LLM structured extraction 또는 NER 사용
- `app/services/qa.py`
  - 현재 deterministic evidence QA
  - 조직 승인 LLM을 연결하되 evidence 밖의 사실 생성을 금지
- `app/services/question_generator.py`
  - 승인된 템플릿과 검증 규칙을 유지한 채 LLM은 문장 표현만 담당
- `app/core/security.py`
  - 실제 인증, RBAC, 데이터 암호화, 감사 로그 연결
- `app/services/graph_store.py`
  - Neo4j Aura 또는 사내 Neo4j 클러스터 연결

## 개인정보·안전 원칙

- 원본 transcript는 파생 KG와 분리
- 사용자별 tenant 필터 강제
- 저신뢰·민감 항목은 자동 출제 금지
- 모든 QA 답변에 episode 근거와 날짜 포함
- 삭제 요청 시 SQLite·Neo4j·embedding 파생물을 함께 제거
- 실제 서비스에서는 음성 파일 암호화, 접근 통제, 보존 기간, 감사 로그 필수
- 상담인이 보는 요약은 관찰 기록이며 임상 판정이 아님
