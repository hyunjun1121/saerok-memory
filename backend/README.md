# Haru Qwen3-ASR service

Local RTX 3090 service that converts every consented Haru voice response into
Korean text. It uses the official `qwen-asr` transformers backend and a separate
Qwen forced aligner. This backend is local-GPU only and must not be deployed to
Vercel.

## Pinned models

| Role | Model | Revision | Local size |
|---|---|---|---:|
| transcription | `Qwen/Qwen3-ASR-1.7B` | `7278e1e70fe206f11671096ffdd38061171dd6e5` | ~4.70 GB |
| timestamps | `Qwen/Qwen3-ForcedAligner-0.6B` | `c7cbfc2048c462b0d63a45797104fc9db3ad62b7` | ~1.84 GB |

Both checkpoints are Apache-2.0. Weights stay under ignored
`backend/models/`; the service loads local paths and never downloads weights at
startup.

Download once from repo root:

```powershell
npm run stt:download
```

Expected files include `config.json` in each directory. Missing or incomplete
directories keep `/health` at `ready:false` and `/api/stt` returns 503.

## Audio and inference contract

Browser WebM/Opus, WAV, MP3, M4A, and other PyAV inputs are decoded to mono
float32 at 16 kHz. The backend then applies:

1. DC offset removal.
2. First-order 80 Hz high-pass filtering.
3. Conservative RMS normalization with bounded gain and a 0.98 peak guard.

No VAD trimming occurs, so slow speech and long pauses keep their original
timing. Qwen receives `(numpy_audio, 16000)`, forced to canonical language
`Korean`. The forced aligner returns Korean word/token timestamps.

Qwen3-ASR does not expose a calibrated confidence. The API therefore returns
`confidence: null`; callers must not substitute `1.0` or a fabricated value.

Example response:

```json
{
  "text": "오늘 딸과 공원을 산책했어요.",
  "language": "ko-KR",
  "durationSec": 4.2,
  "confidence": null,
  "segments": [
    { "id": 0, "start": 0.12, "end": 0.45, "text": "오늘" }
  ],
  "engine": "qwen3-asr",
  "model": "Qwen/Qwen3-ASR-1.7B",
  "modelRevision": "7278e1e70fe206f11671096ffdd38061171dd6e5",
  "alignerModel": "Qwen/Qwen3-ForcedAligner-0.6B",
  "alignerRevision": "c7cbfc2048c462b0d63a45797104fc9db3ad62b7",
  "preprocessingVersion": "haru-dc-hp80-rms-v1"
}
```

## Install and run

Python 3.11 and an NVIDIA driver compatible with CUDA 12.8 are expected. The
requirements pin `torch==2.7.1+cu128`; the PyTorch extra index prevents a CPU
wheel from silently replacing the GPU runtime.

```powershell
npm run stt:install
npm run stt:dev
```

Defaults auto-select `cuda:0` and `bfloat16` on an RTX 3090. CPU fallback uses
float32 for development but is not the intended runtime. Keep one Uvicorn
worker: loading more workers duplicates both checkpoints in VRAM.

Check readiness and inference:

```powershell
Invoke-RestMethod http://127.0.0.1:8765/health
curl.exe -F "file=@story.webm" http://127.0.0.1:8765/api/stt
```

Endpoints:

- `GET /health`
- `POST /api/stt`, multipart field `file`
- `POST /api/transcribe`, compatibility alias

Upload size defaults to 25 MB and is enforced while reading the request.

## Docker

Weights are excluded from the build context and mounted read-only:

```powershell
docker build -t haru-stt ./backend
docker run --gpus all --rm -p 8765:8765 `
  -e STT_CORS_ORIGINS=http://127.0.0.1:5173 `
  -v "${PWD}/backend/models:/models:ro" haru-stt
```

## Tests

No model or GPU is required for the default suite:

```powershell
npm run stt:test
```

After both checkpoints are present, enable the real inference smoke test:

```powershell
$env:STT_RUN_GPU="1"
npm run stt:test
```

The smoke test validates loading and response shape. A representative,
consented elderly Korean audio set is still required for accuracy and latency
benchmarking.

## Frontend wiring and failure behavior

The SPA posts recorded blobs through
`src/features/speech/stt.ts`. Set its local endpoint in repo-root `.env`:

```dotenv
VITE_STT_API_BASE_URL=http://127.0.0.1:8765
```

STT remains best-effort: unavailable model, network error, or timeout must not
block routine completion. Only consented transcripts and audio may be retained.

## Exposure safety

Defaults assume a trusted local machine/LAN. Before wider exposure:

- Replace `STT_CORS_ORIGINS=*` with exact origins.
- Keep the service behind authentication or an authenticated reverse proxy.
- Do not publish port 8765 directly to the internet.
- Preserve audio/transcript consent, revocation, and deletion propagation.
- Never deploy this GPU service as part of the Vercel frontend.

Official references:

- https://github.com/QwenLM/Qwen3-ASR
- https://huggingface.co/Qwen/Qwen3-ASR-1.7B
- https://huggingface.co/Qwen/Qwen3-ForcedAligner-0.6B
