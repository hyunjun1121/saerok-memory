# Kokoro-82M 일본어 voice 비교 보고서

## 결론

- 공식 모델: `hexgrad/Kokoro-82M` v1.0, 82M parameters.
- 고정 Hugging Face revision: `f3ff3571791e39611d31c381e3a41a3af07b4987`.
- 모델 파일 SHA256: `496dba118d1a58f5f3db2efc88dbdc216e0483fc89fe6e47ee1f2c53f18ad1e4`.
- 공식 inference library: `kokoro==0.9.4`; 확인한 GitHub commit: `dfb907a02bba8152ca444717ca5d78747ccb4bec`.
- 모델 카드와 Python package license: Apache-2.0.
- 공식 inventory: 8개 언어, 9개 `lang_code` variant, 54 voices. 미국·영국 영어가 별도 variant라 section은 9개다.
- 비교 문장: `春子さん、今日の気分はいかがですか。`
- 모델 기본 속도 `speed=1.0`, 일본어 G2P `lang_code='j'`.
- 최종 산출물: 일본어 native 5개 전부 + 실험 cross-language voice embedding 5개, 총 WAV 10개와 OGG 10개.
- 실제 청취 도구는 사용할 수 없었다. 오디오 입력 시도 결과가 `audio content omitted because you do not support audio input`이어서 아래 평가는 공식 metadata와 신호/codec 검증만 근거로 한다. 자연스러움 최종 순위는 일본인 청취 평가가 필요하다.

## 공식 출처와 license

| 항목 | 값 |
| --- | --- |
| Hugging Face 모델 | <https://huggingface.co/hexgrad/Kokoro-82M> |
| 고정 model revision | `f3ff3571791e39611d31c381e3a41a3af07b4987` |
| 고정 model card | <https://huggingface.co/hexgrad/Kokoro-82M/blob/f3ff3571791e39611d31c381e3a41a3af07b4987/README.md> |
| 고정 VOICES.md | <https://huggingface.co/hexgrad/Kokoro-82M/blob/f3ff3571791e39611d31c381e3a41a3af07b4987/VOICES.md> |
| 공식 GitHub | <https://github.com/hexgrad/kokoro> |
| 확인한 GitHub commit | `dfb907a02bba8152ca444717ca5d78747ccb4bec` |
| GitHub license | <https://github.com/hexgrad/kokoro/blob/dfb907a02bba8152ca444717ca5d78747ccb4bec/LICENSE> |
| 모델/package license | Apache-2.0 |

모델 카드에는 Kokoro v1.0 weights가 Apache license라고 명시돼 있다. 공식 `VOICES.md`는 일본어 voice 중 `jf_gongitsune`, `jf_nezumi`, `jf_tebukuro`, `jm_kumo`의 Koniwa 기반 CC BY source를 별도 표시한다. 이 보고서는 license 확인 기록이며 법률 의견은 아니다.

검토한 공식 원문 사본은 `sources/`에 저장했다. 각 파일은 위 revision 또는 commit에서 직접 받았다.

## 공식 voice inventory

공식 model card의 `8 & 54`는 8개 언어와 54 voices를 뜻한다. 공식 `VOICES.md`는 미국 영어와 영국 영어를 별도 `lang_code`로 나눠 총 9개 variant를 표시한다.

| 언어 / `lang_code` | 수 | 공식 voice names |
| --- | ---: | --- |
| American English / `a` | 20 | `af_heart`, `af_alloy`, `af_aoede`, `af_bella`, `af_jessica`, `af_kore`, `af_nicole`, `af_nova`, `af_river`, `af_sarah`, `af_sky`, `am_adam`, `am_echo`, `am_eric`, `am_fenrir`, `am_liam`, `am_michael`, `am_onyx`, `am_puck`, `am_santa` |
| British English / `b` | 8 | `bf_alice`, `bf_emma`, `bf_isabella`, `bf_lily`, `bm_daniel`, `bm_fable`, `bm_george`, `bm_lewis` |
| Japanese / `j` | 5 | `jf_alpha`, `jf_gongitsune`, `jf_nezumi`, `jf_tebukuro`, `jm_kumo` |
| Mandarin Chinese / `z` | 8 | `zf_xiaobei`, `zf_xiaoni`, `zf_xiaoxiao`, `zf_xiaoyi`, `zm_yunjian`, `zm_yunxi`, `zm_yunxia`, `zm_yunyang` |
| Spanish / `e` | 3 | `ef_dora`, `em_alex`, `em_santa` |
| French / `f` | 1 | `ff_siwis` |
| Hindi / `h` | 4 | `hf_alpha`, `hf_beta`, `hm_omega`, `hm_psi` |
| Italian / `i` | 2 | `if_sara`, `im_nicola` |
| Brazilian Portuguese / `p` | 3 | `pf_dora`, `pm_alex`, `pm_santa` |
| **합계** | **54** | |

공식 문서는 non-English 지원이 약한 G2P나 적은 training data 때문에 제한될 수 있고, 10–20 tokens보다 짧은 발화에서 품질이 낮아질 수 있다고 경고한다.

### 일본어 native 5개

| Voice | 성별 | 공식 overall grade | 공식 voice SHA256 prefix | 비고 |
| --- | --- | --- | --- | --- |
| `jf_alpha` | 여성 | C+ | `1bf4c9dc` | 일본어 H hours |
| `jf_gongitsune` | 여성 | C | `1b171917` | Koniwa CC BY source 표시 |
| `jf_nezumi` | 여성 | C- | `d83f007a` | Koniwa CC BY source 표시 |
| `jf_tebukuro` | 여성 | C | `0d691790` | Koniwa CC BY source 표시 |
| `jm_kumo` | 남성 | C- | `98340afd` | Koniwa CC BY source 표시 |

## 10개 후보 선정

1. 일본어 native 5개를 전부 포함했다. 일본어 자연스러움 검토의 기준군이다.
2. 추가 5개는 공식 overall grade, 여성·남성 다양성, 동일 일본어 phoneme 생성 성공, 공통 음량/codec 규격 통과를 기준으로 골랐다.
3. `af_heart` A, `af_bella` A-, `bf_emma` B-, `am_puck` C+, `am_michael` C+를 선정했다.
4. `am_fenrir`는 공통 후처리 후 `-18.61 LUFS`로 허용 하한 `-18 LUFS`를 벗어나 탈락했다.
5. `bm_fable`은 공통 후처리 후 decoded true peak `+0.19 dBTP`로 허용 상한 `-0.4 dBTP`를 벗어나 탈락했다.

중요: 공식 README는 `lang_code`와 voice language가 일치해야 한다고 안내한다. 추가 5개는 일본어 pipeline이 만든 동일 일본어 phonemes에 영어 voice embedding을 결합한 비공식 cross-language 실험이다. 생성은 성공했지만 공식 일본어 지원 voice로 분류하거나 native 품질을 전제하면 안 된다.

## 생성과 후처리

### 환경

- Windows, Python 3.11.15.
- `kokoro==0.9.4`, `misaki==0.9.4`, `pyopenjtalk==0.4.1`, UniDic `3.1.0+2021-08-31`, `soundfile==0.14.0`.
- FFmpeg/ffprobe 9.0.
- model, voice packs, venv, package cache, Hugging Face cache 모두 이 폴더 내부. `.gitignore`로 `.venv/`, `cache/`, `model/`, `.work/` 제외.
- 모델과 후보 12개 voice pack은 HF revision을 고정해 다운로드했고, 그중 최종 10개를 선정했다. 모델 전체 SHA256과 공식 voice SHA256 prefix를 생성 전에 검증했다.

### 명령

Windows 긴 build path 문제를 피하려고 같은 폴더를 `K:`에 매핑했다. 실제 파일은 모두 이 폴더 내부다.

```powershell
subst K: C:\project\saerok-memory\raspberry-pi-demo\tools\tts-comparison\kokoro
$env:UV_CACHE_DIR='K:\cache\uv'
$env:TEMP='K:\cache\tmp'
$env:TMP='K:\cache\tmp'
uv venv --python C:\Users\mnb92\AppData\Roaming\uv\python\cpython-3.11.15-windows-x86_64-none\python.exe K:\.venv
uv pip install --python K:\.venv\Scripts\python.exe 'kokoro==0.9.4' 'misaki[ja]>=0.9.4' 'soundfile>=0.12,<1'
K:\.venv\Scripts\python.exe -m unidic download

$env:HF_HOME='K:\cache\huggingface'
$env:HF_HUB_CACHE='K:\cache\huggingface\hub'
$env:HF_XET_CACHE='K:\cache\huggingface\xet'
$env:TORCH_HOME='K:\cache\torch'
$env:XDG_CACHE_HOME='K:\cache'
K:\.venv\Scripts\python.exe K:\generate_samples.py
K:\.venv\Scripts\python.exe K:\normalize_samples.py
```

생성 source:

- 동일 문장: `春子さん、今日の気分はいかがですか。`
- `lang_code='j'`, model default `speed=1.0`.
- 확인된 phonemes: `haɾɯko saɴ kʲoː no kʲibɯɴ βa ikaɡa desɨ ka`.
- WAV: mono, PCM 16-bit, 24 kHz.

공통 production 후처리:

```powershell
ffmpeg -i input.wav `
  -af 'loudnorm=I=-16:TP=-1:LRA=7' `
  -ar 24000 -ac 1 `
  -c:a libopus -b:a 48k -vbr on -compression_level 10 `
  output.ogg
```

단일 `loudnorm`만 사용했다. 수동 gain, limiter, 추가 compressor는 쓰지 않았다. WAV source는 24 kHz지만 Opus stream clock은 48 kHz다.

## 결과

| Voice | 구분 | 성별 | OGG duration | EBU R128 LUFS | decoded TP | 결과 |
| --- | --- | --- | ---: | ---: | ---: | --- |
| `jf_alpha` | 일본어 native | 여성 | 3306 ms | -15.0 | -1.12 dBTP | 통과 |
| `jf_gongitsune` | 일본어 native | 여성 | 3706 ms | -15.2 | -1.05 dBTP | 통과 |
| `jf_nezumi` | 일본어 native | 여성 | 3506 ms | -15.1 | -0.88 dBTP | 통과 |
| `jf_tebukuro` | 일본어 native | 여성 | 3306 ms | -15.3 | -0.87 dBTP | 통과 |
| `jm_kumo` | 일본어 native | 남성 | 3206 ms | -16.7 | -0.84 dBTP | 통과 |
| `af_heart` | cross-language 실험 | 여성 | 3106 ms | -15.5 | -0.73 dBTP | 통과 |
| `af_bella` | cross-language 실험 | 여성 | 3206 ms | -15.2 | -0.86 dBTP | 통과 |
| `am_puck` | cross-language 실험 | 남성 | 3006 ms | -15.8 | -0.89 dBTP | 통과 |
| `am_michael` | cross-language 실험 | 남성 | 3306 ms | -16.6 | -1.01 dBTP | 통과 |
| `bf_emma` | cross-language 실험 | 여성 | 3406 ms | -15.9 | -0.82 dBTP | 통과 |

검증 규격:

- OGG files 정확히 10개.
- codec `opus`, container `ogg`, mono 1 channel, stream sample rate 48,000 Hz.
- source WAV 24,000 Hz.
- EBU R128 integrated loudness 허용 범위 -18..-14 LUFS.
- decoded true peak 상한 -0.4 dBTP. normalization target은 -1 dBTP이며 Opus codec overshoot를 decoded 값으로 별도 기록했다.
- 모든 file SHA256, duration, codec metadata는 `method.json`에 기록했다.

## 청취 평가 필요 항목

이 환경에서는 실제 오디오 청취가 불가능했다. 다음 항목은 일본인, 가능하면 60대 이상 청취자가 blind test로 확인해야 한다.

1. `春子さん`을 자연스러운 `はるこさん`으로 듣는지.
2. `今日の気分`과 문장 끝 `いかがですか`의 명료도.
3. 질문 억양의 자연스러움과 과한 감정 여부.
4. 모델 기본 속도가 노인에게 충분히 여유로운지.
5. cross-language 5개에서 외국어 accent, 모음 왜곡, 불안정한 pitch가 들리는지.

일본어 production 후보 선정은 native 5개를 우선 비교하고, cross-language 5개는 탐색군으로만 다루는 것이 안전하다.
