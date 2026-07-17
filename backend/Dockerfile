# Haru Qwen3-ASR GPU service. Model weights are mounted read-only at /models.
# Build: docker build -t haru-stt ./backend
# Run:   docker run --gpus all -p 127.0.0.1:8765:8765 -v <host-model-dir>:/models:ro haru-stt
FROM nvidia/cuda:12.8.1-cudnn-runtime-ubuntu22.04

ENV DEBIAN_FRONTEND=noninteractive \
    PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    HF_HUB_OFFLINE=1 \
    TRANSFORMERS_OFFLINE=1

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        python3 python3-pip ffmpeg sox libsndfile1 ca-certificates \
    && rm -rf /var/lib/apt/lists/* \
    && ln -sf /usr/bin/python3 /usr/bin/python

WORKDIR /app

COPY requirements.txt .
RUN python -m pip install --upgrade pip && python -m pip install -r requirements.txt

COPY app ./app
COPY scripts ./scripts
COPY conftest.py pytest.ini ./

RUN useradd --create-home --uid 1000 haru
USER 1000

ENV STT_HOST=0.0.0.0 \
    STT_PORT=8765 \
    STT_DEVICE=cuda:0 \
    STT_DTYPE=bfloat16 \
    STT_MODEL_PATH=/models/Qwen3-ASR-1.7B \
    STT_ALIGNER_PATH=/models/Qwen3-ForcedAligner-0.6B

EXPOSE 8765
CMD ["python", "-m", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8765", "--workers", "1"]
