.PHONY: install bootstrap run test docker-up clean

install:
	python -m pip install -r requirements.txt
	python -m pip install -r requirements-models.txt

bootstrap:
	python scripts/bootstrap.py

run:
	uvicorn app.main:app --reload --port 8000

test:
	python -m pytest -q

docker-up:
	docker compose up --build

clean:
	rm -f data/haru.db data/test_haru.db
