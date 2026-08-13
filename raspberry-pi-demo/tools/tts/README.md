# Haru offline narration pipeline

Qwen3-TTS runs only on a development workstation. Raspberry Pi receives the
generated Ogg Opus files and `public/assets/audio/narration/manifest.json`; it
does not install Python, PyTorch, model weights, or a TTS server.

## Voices and source

- Model: `Qwen/Qwen3-TTS-12Hz-1.7B-CustomVoice`
- Pinned revision: `0c0e3051f131929182e2c023b9537f8b1c68adfe`
- Korean: native `Sohee` voice
- Japanese: native `Ono_Anna` voice
- License: Apache-2.0
- Official source: <https://huggingface.co/Qwen/Qwen3-TTS-12Hz-1.7B-CustomVoice>
- Official code: <https://github.com/QwenLM/Qwen3-TTS>

Generated audio is normalized to -16 LUFS / -1 dBTP, converted to mono 24 kHz
Ogg Opus, and addressed locally by a content hash. Do not add cloned voices or
third-party reference recordings.

## Generate on Windows with an NVIDIA GPU

```powershell
node tools/tts/build-source-manifest.mjs
python -m venv --system-site-packages tools/tts/.venv
tools/tts/.venv/Scripts/python -m pip install -r tools/tts/requirements-windows-cu126.txt
tools/tts/.venv/Scripts/python tools/tts/generate.py --batch-size 2
node tools/tts/validate-output.mjs
```

Use `--dry-run`, `--locale ko`, `--id guide.welcome`, or `--limit 1` for a
bounded check. Cache and intermediate WAV data stay in ignored directories.
For a short utterance that fails listening review, regenerate it alone with
`--overwrite --batch-size 1 --max-new-tokens 48 --id <stable-id>`, then rerun
the full command without `--overwrite` to rebuild the complete manifest.

Any text or question change requires rebuilding `narration-source.json` and
regenerating affected assets. Listen to Korean/Japanese dates, weekdays,
numbers, and names before a field demo.
