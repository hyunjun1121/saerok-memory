# Fish Audio S2 Pro 한국어 reference-free 비교 보고서

**Built with Fish Audio**

## 범위와 결론

- 비교 문장: `영자 어르신, 오늘 기분은 어떠세요?`
- 공식 source: `fishaudio/fish-speech` 2.0.0, commit `e5e292632cb11e7a27b2b7487f58f612bc101e13`.
- 공식 model: `fishaudio/s2-pro`, Hugging Face revision `1de9996b6be38b745688de084d87a5633f714e4e`.
- 공식 model card는 한국어를 Tier 2 지원 언어로 표시한다.
- Fish Speech에는 비교 가능한 유한 preset voice catalog가 없다. 공식 inference 문서는 reference를 생략하면 model이 voice timbre를 무작위 선택한다고 설명한다. 따라서 voice inventory는 `open-ended`로 기록했다.
- 외부 reference audio는 사용하지 않았다. 사람 음성을 복제하지 않은 reference-free sample만 생성했다.

## 확인한 공식 근거

- [Fish Speech repository, pinned source revision](https://github.com/fishaudio/fish-speech/tree/e5e292632cb11e7a27b2b7487f58f612bc101e13)
- [공식 inference 문서, pinned source revision](https://github.com/fishaudio/fish-speech/blob/e5e292632cb11e7a27b2b7487f58f612bc101e13/docs/en/inference.md)
- [S2 Pro model card, pinned model revision](https://huggingface.co/fishaudio/s2-pro/blob/1de9996b6be38b745688de084d87a5633f714e4e/README.md)
- [Fish Audio Research License, pinned source revision](https://github.com/fishaudio/fish-speech/blob/e5e292632cb11e7a27b2b7487f58f612bc101e13/LICENSE)

공식 inference 문서는 24 GB 이상 VRAM GPU를 권장한다. 공식 model card는 80개 이상 언어를 지원하며 한국어를 Tier 2로 분류한다. 이것은 고정 speaker 수를 뜻하지 않으며, 유한 voice 목록의 근거로 사용하지 않았다.

## License와 배포 제한

Source와 model weight는 Fish Audio Research License 적용 대상이다. 연구·비상업 평가 용도는 license 조건 안에서 허용되지만, **Haru 같은 상업 제품에서 사용하려면 Fish Audio와 별도 서면 commercial license가 필요하다.** 생성 sample은 평가 목적으로만 포함했다.

- 전체 Agreement 사본: `LICENSE`
- 요구 attribution notice: `NOTICE.txt`
- 요구 표시: 이 문서 상단의 **Built with Fish Audio**

이 문서는 법률 의견이 아니다.

## 재현 환경과 공유 자산

- Windows host + WSL2 Ubuntu 24.04.
- Python 3.12.3, PyTorch 2.8.0+cu129, CUDA runtime 12.9, cuDNN 91002.
- GPU: NVIDIA GeForce RTX 3090, BF16 지원.
- preflight 측정: 총 VRAM 25,769,279,488 bytes, free VRAM 24,436,015,104 bytes.
- 공유 model snapshot: 13 files, 11,011,629,649 bytes.
- 한국어 폴더는 기존 일본어 비교의 pinned source, venv, package/model cache와 model weight를 읽기 전용으로 재사용했다. 한국어 native/output/work 파일은 모두 `ko/fish/` 아래에 격리했다.
- 실행 전에 source HEAD, clean worktree, Hugging Face metadata 13개의 revision 일치를 fail-closed 확인했다.

실행 명령:

```bash
cd /mnt/c/project/saerok-memory/raspberry-pi-demo/tools/tts-comparison/ko/fish
HF_HOME=../../fish/cache/huggingface \
  ../../fish/venv/bin/python generate_reference_free.py
../../fish/venv/bin/python postprocess_audio.py
```

## Reference-free pool 생성

Seed `5201..5220` 20개를 동일 설정으로 생성했다. 각 seed 전에 Python `random`, NumPy, PyTorch CPU/CUDA seed를 설정하고 cuDNN benchmark를 끄며 deterministic algorithm 요청을 `warn_only`로 적용했다. 이 설정은 같은 실행환경 안의 재현성을 높이지만, 다른 CUDA/PyTorch/model build 사이 bit-identical 결과를 보장하지 않는다.

Model load를 포함한 생성 시간은 953.023초였다. Seed별 생성 시간은 27.975–47.637초였다.

공통 생성 설정:

- `max_new_tokens=256`; 0 이하는 거부
- `temperature=1.0`, `top_p=0.9`, `top_k=30`
- `bfloat16`, compile 비활성
- `iterative_prompt=true`, `chunk_length=300`
- `prompt_text=None`, `prompt_tokens=None`, reference audio 없음
- model native output: mono 44.1 kHz PCM-24 WAV

20개 metadata에는 정확한 한국어 문장, seed, token bound, native path, native SHA-256, sample rate/frame count를 기록했다. 후처리 전에 exact seed set, 문장, token bound, source/model revision, summary/metadata, native path/hash 일치를 다시 검증했다.

## 공통 후처리와 기술 선별

각 native WAV를 mono 24 kHz PCM-24 intermediate WAV로 변환한 뒤, Haru production과 같은 단일 filter를 사용했다.

```bash
ffmpeg -i INPUT_24K_MONO.wav \
  -af 'loudnorm=I=-16:TP=-1:LRA=7' \
  -ac 1 -ar 24000 \
  -c:a libopus -b:a 48k -vbr on -compression_level 10 OUTPUT.ogg
```

수동 gain, limiter, 별도 compressor, 2-pass loudnorm, speed 변경을 추가하지 않았다. Encoder input은 24 kHz이고, Opus stream decode clock은 ffprobe에서 48 kHz로 표시된다.

20개 모두 동일 처리한 뒤 다음 gate를 통과한 후보 중 technical score가 낮은 10개를 골랐다.

- duration 2–8초
- decoded PCM finite, voiced frame 존재, clip sample 없음
- mono Opus/Ogg, ffprobe stream clock 48 kHz
- EBU R128 integrated loudness -18..-14 LUFS
- decoded Opus true peak -0.4 dBTP 이하
- score: 긴 silence, silence ratio, 불안정한 envelope, 목표 길이 4초와 차이를 낮게 평가

Score는 음성 자연스러움, 한국어 정확성, 고령 사용자 선호도를 평가하지 않는다. 미선정 10개 OGG/WAV는 삭제하지 않고 `.work/rejected/`에 보존했다. 최종 `audio/`에는 선택 10개 OGG/WAV만 둔다.

## 기술 검증 결과

20개 모두 기술 gate를 통과했다. Technical score가 낮은 순서로 10개를 선택했다.

| 순위 | Seed | OGG duration | EBU R128 LUFS | decoded TP | Silence ratio | Max silence | Envelope CV | Technical score |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | 5207 | 2561 ms | -16.1 | -5.1 dBTP | 0.115385 | 200 ms | 0.556860 | 3.427320 |
| 2 | 5208 | 2932 ms | -16.0 | -9.2 dBTP | 0.152542 | 250 ms | 0.400403 | 3.593226 |
| 3 | 5220 | 2932 ms | -16.0 | -5.1 dBTP | 0.135593 | 250 ms | 0.489426 | 3.601782 |
| 4 | 5213 | 2561 ms | -16.0 | -4.0 dBTP | 0.134615 | 250 ms | 0.543173 | 3.792246 |
| 5 | 5212 | 2607 ms | -16.1 | -3.9 dBTP | 0.169811 | 250 ms | 0.610483 | 4.267326 |
| 6 | 5219 | 3106 ms | -15.8 | -3.9 dBTP | 0.177419 | 300 ms | 0.542894 | 4.283478 |
| 7 | 5217 | 2886 ms | -16.1 | -5.6 dBTP | 0.172414 | 350 ms | 0.551160 | 4.504960 |
| 8 | 5214 | 2839 ms | -16.0 | -3.0 dBTP | 0.192982 | 350 ms | 0.710426 | 5.040922 |
| 9 | 5203 | 3206 ms | -15.7 | -4.6 dBTP | 0.222222 | 450 ms | 0.540264 | 5.301248 |
| 10 | 5202 | 2793 ms | -16.1 | -2.1 dBTP | 0.196429 | 450 ms | 0.631487 | 5.329014 |

최종 10개 전부 finite decoded signal, clip sample 0, mono Opus/Ogg, source 24 kHz, ffprobe Opus clock 48 kHz, duration 2.561–3.206초, -18..-14 LUFS, true peak -0.4 dBTP 이하를 만족했다. `method.json`은 실제 postprocess metadata와 같은 seed·path·hash·duration·codec·측정값을 기록한다.

## TDD와 보존 정책

- 한국어 문장, seed 20개, 양의 token bound, metadata collision, native hash, runtime source/model revision, EBU parser를 단위 테스트한다.
- 첫 RED는 helper 미구현 상태의 `ModuleNotFoundError: comparison_utils`로 확인했다.
- 구현 후 단위 테스트 12개가 통과했다.
- Generator는 기존 native WAV를 덮어쓰지 않는다. Postprocess 재실행 시 기존 audio, rejected, candidate, metadata를 timestamp archive로 이동한 뒤 새 결과를 만든다.

## 청취 검토 제한

이 agent 환경에서는 실제 audio playback 청취 평가를 수행하지 못했다. 한국어 발음 정확성, `영자 어르신` 호칭, 질문 억양, timbre 자연스러움, 50–70대 또는 고령 사용자 청취 명료도와 선호도를 평가했다는 주장을 하지 않는다. 최종 voice 결정 전 한국어 사용자, 가능하면 고령 사용자 대상 blind listening test가 필요하다.

Fish S2 Pro는 24 GB급 GPU를 권장하므로 Raspberry Pi 5 local inference 구성에 적합하지 않다. 이 폴더의 audio는 workstation에서 만든 비교·평가 asset이며 Pi offline demo runtime에 model weight나 inference server를 포함하지 않는다.
