# Haru local Microsoft STT gateway

The FastAPI service stays on `127.0.0.1:8765`. It decodes and conditions audio
locally, then sends a WAV copy to the MAI-Transcribe-2 Azure resource configured
in NexQ. The original recording remains in the browser's local IndexedDB. This
service is not part of the Vercel deployment.

## Credential and setup

On the NexQ Windows profile, the service reads `NexQ:azure_speech` from Windows
Credential Manager. `STT_API_KEY` overrides that value when set. The endpoint
and model default to the values used by NexQ.

```powershell
npm run stt:install
npm run stt:dev
```

The lightweight environment uses Python, FastAPI, NumPy, SciPy, PyAV, and
Requests. It does not download or load a local speech model or require a GPU.

## Audio and response contract

Browser WebM/Opus, WAV, MP3, M4A, and other PyAV-supported input is decoded to
mono float32 at 16 kHz. Haru removes DC offset, applies an 80 Hz high-pass, and
uses bounded RMS normalization. It does not trim pauses. The conditioned audio
is encoded as PCM16 WAV and sent to Microsoft's `transcriptions:transcribe`
endpoint with the `MAI-Transcribe-2` enhanced mode definition.

The gateway returns `combinedPhrases` as one transcript segment. Microsoft does
not provide a calibrated confidence in the response used here, so `confidence`
remains `null`. A silent recording is rejected locally without an API call.

```json
{
  "text": "오늘 딸과 공원을 산책했어요.",
  "language": "ko-KR",
  "durationSec": 4.2,
  "confidence": null,
  "segments": [
    { "id": 0, "start": 0.0, "end": 4.2, "text": "오늘 딸과 공원을 산책했어요." }
  ],
  "engine": "microsoft-azure-speech",
  "model": "MAI-Transcribe-2",
  "modelRevision": "2025-10-15",
  "alignerModel": null,
  "alignerRevision": null,
  "preprocessingVersion": "haru-dc-hp80-rms-v2"
}
```

## Local API

- `GET /health`
- `POST /api/stt`, multipart field `file`
- `POST /api/transcribe`, compatibility alias

Upload size defaults to 25 MB; decoded recordings over 65 seconds are rejected
without trimming. One request is active and at most two may wait. The gateway
accepts local Vite origins only by default and listens on loopback.

```powershell
Invoke-RestMethod http://127.0.0.1:8765/health
```

STT is best-effort: if Microsoft or the local service is unavailable, the voice
exercise still completes without a transcript. The Azure copy is only used for
transcription; the original audio and saved transcript remain on this device.
