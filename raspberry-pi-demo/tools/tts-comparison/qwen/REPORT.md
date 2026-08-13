# Qwen3-TTS official preset comparison

## Scope

- Prompt: 春子さん、今日の気分はいかがですか。
- Synthesis language: Japanese
- Model: Qwen/Qwen3-TTS-12Hz-1.7B-CustomVoice
- Pinned revision: 0c0e3051f131929182e2c023b9537f8b1c68adfe
- License: Apache-2.0
- GPU used: NVIDIA GeForce RTX 3090
- Generation seed: 20260811, reset before each voice
- Style instruction: empty, so preset identity remains comparison variable

Official sources inspected:

- [Model card at pinned revision](https://huggingface.co/Qwen/Qwen3-TTS-12Hz-1.7B-CustomVoice/blob/0c0e3051f131929182e2c023b9537f8b1c68adfe/README.md)
- [Files at pinned revision](https://huggingface.co/Qwen/Qwen3-TTS-12Hz-1.7B-CustomVoice/tree/0c0e3051f131929182e2c023b9537f8b1c68adfe)
- [Official Qwen3-TTS repository](https://github.com/QwenLM/Qwen3-TTS)
- [Official repository license](https://github.com/QwenLM/Qwen3-TTS/blob/main/LICENSE)

Pinned model card declares nine preset voices and apache-2.0. Finite inventory
contains fewer than ten voices, so this run generated all nine.

## Complete official voice inventory

Descriptions below paraphrase pinned official model card.

| Voice | Native language/context | Official character, paraphrased | Generated |
|---|---|---|---|
| Vivian | Chinese | Bright young woman with slight edge | Yes |
| Serena | Chinese | Warm, gentle young woman | Yes |
| Uncle_Fu | Chinese | Mature man with low, mellow tone | Yes |
| Dylan | Chinese, Beijing dialect | Young Beijing man with clear, natural tone | Yes |
| Eric | Chinese, Sichuan dialect | Energetic Chengdu man with mild huskiness | Yes |
| Ryan | English | Energetic man with strong rhythm | Yes |
| Aiden | English, American | Sunny man with clear midrange | Yes |
| Ono_Anna | Japanese | Light, nimble, playful woman | Yes |
| Sohee | Korean | Warm woman with expressive emotion | Yes |

Official card recommends each speaker's native language for best quality. This
comparison intentionally asks every preset to speak same Japanese prompt.
Cross-language pronunciation and loudness behavior remain part of comparison,
not evidence of native-language quality.

## Output and processing

Each voice has:

- model-native mono 24 kHz PCM-16 WAV;
- production-parity Ogg Opus made from that 24 kHz source;
- one JSON record under verification/;
- SHA-256, ffprobe metadata, EBU R128 loudness, and true-peak result.

Exact production encoding filter:

~~~text
ffmpeg -y -hide_banner -loglevel error -i INPUT.wav -af loudnorm=I=-16.0:TP=-1.0:LRA=7 -ac 1 -ar 24000 -c:a libopus -b:a 48k -vbr on -compression_level 10 OUTPUT.ogg
~~~

No voice-specific gain, limiter, compressor, cloned voice, or reference
recording was applied. ffprobe reports Opus decode clock as 48 kHz for every
OGG; source WAV and encoder input are mono 24 kHz. Both values are recorded as
sampleRateHz 48000 and sourceSampleRateHz 24000.

## Generated samples

| Voice | OGG path | Duration | LUFS | dBTP | WAV SHA-256 | OGG SHA-256 |
|---|---|---:|---:|---:|---|---|
| Vivian | audio/01-vivian.ogg | 3606 ms | -15.6 | -1.1 | 52d49ef98609b30e13357895870ada3a359e9222c7125f0252101552f7566f9d | 0036a848e5b88675901f42bd2ed4606037ee68f44dbc857417a8b26feee158a1 |
| Serena | audio/02-serena.ogg | 2886 ms | -16.9 | -1.3 | 8550a6c15fe323c226dea862fdb3d364294492a083e644fa53346cf7036d5988 | 7fa4d581c24a3bf15f3787a0ec0139743f0b5a67d172463127cd407cd0b12b40 |
| Uncle_Fu | audio/03-uncle-fu.ogg | 2646 ms | -17.1 | -1.1 | 7331e5e2bb28c7132e4d36d4c48007e353bbd35655f5b3556b00a8ea08e30b04 | 9796d06b0442f2947e068ec28f54dfc63aa68b310ee02366ba39040cc0c6ee7d |
| Dylan | audio/04-dylan.ogg | 2726 ms | -21.2 | -1.8 | 21bdc1e0f36c322d4e273310366ed1deb433b860854a6740fca46944bd555aa9 | 3bdc996616c8d8e121e2cc14099b3a4ee7d078f45fe36f620207e0c6fc1ef09b |
| Eric | audio/05-eric.ogg | 2566 ms | -19.1 | -1.3 | 1fe68e4c8468f865f26604b8c7a52b34ffb903c8d6cd2e7bf059373881fc5dcb | 2482d94d8e8bb1503add9b4f98e04b8d7561a70c23f766a49a407afb6e5b5f80 |
| Ryan | audio/06-ryan.ogg | 2486 ms | -18.4 | -1.2 | d6926c729337c17fdd920979246a9d39831edffecd0701d10d79d1de6179235d | da4e887419ffe5705cb571ef5240cf9116825ca080ba7e9454934879677d22a5 |
| Aiden | audio/07-aiden.ogg | 2566 ms | -16.3 | -0.9 | 64cac4a291757eb75dbf05fe0644b42a19780bcb57c161cb1e4db2ed94c8f53e | 436fb1fd5a4c839fdd8ad2bd3cac87786bfb4f228ea5248d9c66d3ce9ac40ac2 |
| Ono_Anna | audio/08-ono-anna.ogg | 3206 ms | -15.8 | -0.9 | fd148592a4fe48058c3cdca68bb3053f6b6621b372dc676295a32375d0b51f18 | 6fd05720cb20499a7dcb1d1c234cecc127c9dd587402f1cf476a17621ad262f0 |
| Sohee | audio/09-sohee.ogg | 3306 ms | -15.9 | -0.8 | 888febc0dcd8e4b7ca943e484792ac8c1b907296e592ffc0a69487e007974717 | d7e6687c55d07e2527e297c76fd05fd231a44ed2f96a3d4df6f963d78c3f7326 |

### Short-clip normalization exceptions

Dylan, Eric, and Ryan remain below comparison's -18 to -14 LUFS short-clip
observation band after exact production loudnorm filter. Source WAV files
contain finite PCM samples, have positive duration, and show no format failure.
High-crest, short cross-language delivery makes -1 dBTP constraint bind before
integrated loudness reaches -16 LUFS. Preserving preset voice was preferred over
voice-specific compression. Exact exception text is also in method.json.

## Commands

Generation, using existing environment and local pinned snapshot:

~~~powershell
$env:HF_HUB_OFFLINE='1'
$env:TRANSFORMERS_OFFLINE='1'
& 'raspberry-pi-demo\tools\tts\.venv\Scripts\python.exe' 'raspberry-pi-demo\tools\tts-comparison\qwen\generate_comparison.py'
~~~

Independent probe and hash pattern:

~~~powershell
ffprobe -v error -select_streams a:0 -show_entries stream=codec_name,sample_rate,channels:format=duration,size -of json 'qwen\audio\01-vivian.ogg'
Get-FileHash -Algorithm SHA256 'qwen\audio\01-vivian.ogg'
ffmpeg -hide_banner -nostats -i 'qwen\audio\01-vivian.ogg' -filter_complex 'ebur128=peak=true' -f null NUL
~~~

## Verification result and limitation

- Generation completed for 9/9 runtime-reported speakers.
- Independent SHA-256 recomputation matched all 9 OGG method entries.
- ffprobe confirmed all 9 WAV files as mono PCM-16 at 24 kHz.
- ffprobe confirmed all 9 OGG files as mono Opus with positive duration.
- EBU R128 measurement and true peak are stored per voice.
- 18 audio files and 9 per-voice verification JSON files are present.

No auditory playback/perceptual-review capability was available to this agent.
Validation here is technical only. Before field-demo voice selection, conduct
native Japanese listening review for pronunciation, natural phrasing,
elder-listener clarity, name rendering (春子さん), and comfortable level.
