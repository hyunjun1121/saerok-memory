#!/usr/bin/env sh
set -e
python scripts/bootstrap.py
exec uvicorn app.main:app --host 0.0.0.0 --port 8000
