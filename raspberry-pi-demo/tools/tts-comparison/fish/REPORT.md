# Fish Audio S2 Pro 일본어 reference-free 비교 보고서

## 범위와 결론

- 비교 문장: `春子さん、今日の気分はいかがですか。`
- 공식 source: `fishaudio/fish-speech` 2.0.0, commit `e5e292632cb11e7a27b2b7487f58f612bc101e13`.
- 공식 model: `fishaudio/s2-pro`, Hugging Face revision `1de9996b6be38b745688de084d87a5633f714e4e`.
- model card 기준 S2 Pro는 4B slow-AR와 400M fast-AR를 사용하며 일본어를 Tier 1 언어로 표시한다.
- Fish Speech에는 비교 가능한 유한 preset voice catalog가 없다. 공식 inference 문서는 reference를 생략하면 model이 voice timbre를 무작위 선택한다고 설명하고, model card는 free-form 표현 제어를 지원한다고 설명한다. 따라서 voice inventory는 `open-ended`로 기록했다.
- 외부 reference audio는 출처 동의와 voice 사용권을 확인할 수 없어 사용하지 않았다. 사람 음성을 복제하지 않은 reference-free sample만 생성했다.

## 확인한 공식 근거

- [Fish Speech repository, pinned source revision](https://github.com/fishaudio/fish-speech/tree/e5e292632cb11e7a27b2b7487f58f612bc101e13)
- [공식 inference 문서, pinned source revision](https://github.com/fishaudio/fish-speech/blob/e5e292632cb11e7a27b2b7487f58f612bc101e13/docs/en/inference.md)
- [S2 Pro model card, pinned model revision](https://huggingface.co/fishaudio/s2-pro/blob/1de9996b6be38b745688de084d87a5633f714e4e/README.md)
- [Fish Audio Research License, pinned source revision](https://github.com/fishaudio/fish-speech/blob/e5e292632cb11e7a27b2b7487f58f612bc101e13/LICENSE)

공식 inference 문서는 inference에 24 GB 이상 VRAM GPU를 권장한다. reference VQ token 생성 단계는 random timbre를 원하면 생략할 수 있다고 명시한다. 공식 model card는 80개 이상 언어, 일본어 Tier 1 지원, 15,000개 이상 common control tags와 free-form textual control을 설명한다. 이것은 고정 speaker 15,000개를 뜻하지 않으며, 유한 voice 목록의 근거로 사용하지 않았다.

## License와 배포 제한

Source와 model weight는 Fish Audio Research License 적용 대상이다. 연구·비상업 용도는 license 조건 안에서 허용되지만, **Haru 같은 상업 제품에서 사용하려면 Fish Audio와 별도 서면 commercial license가 필요하다.** 생성 sample도 평가 목적으로만 포함했다. 요구 attribution은 `NOTICE.txt`에 보존했다. 이 문서는 법률 의견이 아니다.

## 재현 환경과 모델 준비

- Windows host + WSL2 Ubuntu 24.04.
- Python 3.12.3, PyTorch 2.8.0+cu129, CUDA runtime 12.9, cuDNN 91002.
- GPU: NVIDIA GeForce RTX 3090, 24 GiB class, BF16 지원.
- preflight: CUDA와 BF16 지원을 확인했다. 측정 총 VRAM은 25,769,279,488 bytes, 실행 직전 free VRAM은 24,436,015,104 bytes였다.
- model snapshot: 13 files, 11,011,629,649 bytes. Download 후 pinned revision에서 누락 file 0개를 확인했다.
- source, venv, package/model cache, model weight, native pool과 rejected pool은 모두 `fish/` 아래에 격리하고 `.gitignore`로 제외했다.

준비 명령 형태:

```bash
git clone https://github.com/fishaudio/fish-speech.git source
git -C source checkout e5e292632cb11e7a27b2b7487f58f612bc101e13
HF_HOME=cache/huggingface hf download fishaudio/s2-pro \
  --revision 1de9996b6be38b745688de084d87a5633f714e4e \
  --local-dir models/s2-pro
uv sync --extra cu129 --no-install-package pyaudio
```

`pyaudio`는 microphone capture용 system PortAudio header가 없어 build에 실패했다. 이번 offline batch inference는 microphone을 사용하지 않으므로 공식 dependency resolution에서 해당 package만 제외했다.

## Reference-free pool 생성

Seed `4201..4220` 20개를 동일 설정으로 생성했다. 각 seed 전에 Python `random`, NumPy, PyTorch CPU/CUDA generator를 설정하고 cuDNN benchmark를 끄며 deterministic algorithm 요청을 `warn_only`로 적용했다. 이 설정은 실행환경 안에서 표본 재현성을 높이지만, 다른 CUDA/PyTorch/model build 사이 bit-identical 결과를 보장한다는 뜻은 아니다.

Model load를 포함한 authoritative 20개 생성 시간은 856.741초였다. Seed별 생성 시간은 31.37–40.50초 범위였다.

공통 생성 설정:

- `max_new_tokens=256` (0 이하 거부)
- `temperature=1.0`, `top_p=0.9`, `top_k=30`
- `bfloat16`, compile 비활성
- `prompt_text=None`, `prompt_tokens=None`, reference audio 없음
- model native output: mono 44.1 kHz PCM-24 WAV

```bash
HF_HOME=cache/huggingface ./venv/bin/python generate_reference_free.py
```

Old test pool은 `max_new_tokens=0`의 unbounded 의미를 뒤늦게 확인해 최종 비교에서 제외했다. 파일은 삭제하지 않고 `.work/archive-20260811T142400Z/native-max-new-tokens-0/`에 보존했다. 최종 pool은 20개 모두 `max_new_tokens=256`으로 다시 생성했으며, postprocess 전에 exact seed set, prompt, token bound, source/model revision, metadata/summary/native path 1:1 일치를 fail-closed 검증한다.

## 공통 후처리와 기술 선별

각 native WAV를 mono 24 kHz PCM-24 intermediate WAV로 변환한 뒤, Haru production과 같은 단일 filter만 사용했다.

```bash
ffmpeg -i INPUT_24K_MONO.wav \
  -af 'loudnorm=I=-16:TP=-1:LRA=7' \
  -ac 1 -ar 24000 \
  -c:a libopus -b:a 48k -vbr on -compression_level 10 OUTPUT.ogg
```

수동 gain, limiter, 별도 compressor, 2-pass loudnorm을 추가하지 않았다. Source/encoder input은 24 kHz이고, RFC 7845 Opus stream decode clock은 ffprobe에서 48 kHz로 표시된다.

20개 모두 동일 처리한 뒤 다음 gate를 통과한 후보 중 technical score 상위 10개를 골랐다.

- duration 2–8초; 10초 초과는 반드시 탈락
- decoded PCM finite, voiced frame 존재, clip sample 없음
- mono Opus/Ogg, ffprobe stream clock 48 kHz
- EBU R128 integrated loudness -18..-14 LUFS
- decoded Opus true peak -0.4 dBTP 이하
- score: 긴 silence, silence ratio, 불안정한 envelope, 목표 길이 4초와 차이를 낮게 평가

Score는 음성 자연스러움이나 일본어 정확성을 평가하지 않는다. 탈락 10개 OGG/WAV는 삭제하지 않고 `.work/rejected/`에 보존했다. 최종 `audio/`에는 선택 10개 OGG/WAV만 둔다.

## 기술 검증 결과

20개 모두 후처리했다. 17개가 gate를 통과했고, technical score가 낮은 순서로 10개를 선택했다. `4201`(-18.7 LUFS), `4215`(-18.9 LUFS), `4216`(-20.9 LUFS)은 공통 loudness 하한 -18 LUFS를 벗어나 탈락했다. 나머지 미선정 7개는 gate를 통과했지만 technical score 순위 밖이었다.

| 순위 | Seed | OGG duration | EBU R128 LUFS | decoded TP | Silence ratio | Max silence | Envelope CV | Technical score |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | 4210 | 2932 ms | -16.0 | -2.0 dBTP | 0.169492 | 300 ms | 0.730067 | 4.622054 |
| 2 | 4219 | 2839 ms | -15.8 | -1.7 dBTP | 0.192982 | 300 ms | 0.853470 | 5.127010 |
| 3 | 4217 | 3106 ms | -15.9 | -0.8 dBTP | 0.196721 | 400 ms | 0.880844 | 5.552398 |
| 4 | 4204 | 3206 ms | -15.3 | -1.6 dBTP | 0.187500 | 400 ms | 0.957462 | 5.588424 |
| 5 | 4207 | 3306 ms | -16.2 | -0.9 dBTP | 0.166667 | 450 ms | 0.986088 | 5.612346 |
| 6 | 4209 | 3306 ms | -17.8 | -0.9 dBTP | 0.230769 | 450 ms | 0.811851 | 5.904892 |
| 7 | 4208 | 2886 ms | -18.0 | -1.3 dBTP | 0.224138 | 450 ms | 0.980363 | 6.280606 |
| 8 | 4202 | 3306 ms | -16.6 | -0.8 dBTP | 0.227273 | 500 ms | 0.977521 | 6.401272 |
| 9 | 4212 | 3206 ms | -15.0 | -1.0 dBTP | 0.253968 | 600 ms | 0.865272 | 6.868724 |
| 10 | 4220 | 3106 ms | -14.8 | -2.4 dBTP | 0.258065 | 550 ms | 0.976314 | 6.956778 |

최종 10개 전부 finite decoded signal, clip sample 0, mono Opus/Ogg, source 24 kHz, ffprobe Opus clock 48 kHz, duration 2.839–3.306초, -18..-14 LUFS, true peak -0.4 dBTP 이하를 만족했다. `method.json` SHA-256과 실제 OGG hash를 독립 재계산하고 공통 comparison validator로 다시 확인했다.

## 설치·실행 중 확인한 실패

1. 첫 WSL 호출에서 Windows shell 변수 quoting이 잘못돼 `cd: /source: No such file or directory`가 발생했다. absolute WSL path로 고쳤다.
2. non-login WSL 환경에서 `env: ‘uv’: No such file or directory`가 발생했다. 설치된 uv absolute path/venv command로 고쳤다.
3. 첫 dependency sync는 `fatal error: portaudio.h: No such file or directory`로 `pyaudio` build에 실패했다. batch inference에 불필요한 `pyaudio`만 제외했다.
4. 첫 Hugging Face download 호출은 `--local-dir`와 `--cache-dir`을 동시에 써 실패했다. `HF_HOME`과 `--local-dir` 조합으로 다시 실행했다.

## 청취 검토 제한

이 agent 환경에서는 실제 audio playback 청취 평가를 수행하지 못했다. 일본어 발음 정확성, `春子さん` 이름 발음, 질문 억양, timbre 자연스러움, 60–70대 청취 명료도와 선호도를 평가했다는 주장을 하지 않는다. 최종 제품 voice 결정 전 일본인, 가능하면 고령 사용자 대상 blind listening test가 필요하다.

Fish S2 Pro 자체는 24 GB급 GPU를 권장하므로 Raspberry Pi 5에서 local inference하는 구성에 적합하지 않다. 이 폴더의 audio는 workstation에서 만든 비교·평가 asset이며 Pi offline demo runtime에 model weight나 inference server를 포함하지 않는다.
