# Qwen3-TTS 한국어 preset 비교

## 범위

- 문장: `영자 어르신, 오늘 기분은 어떠세요?`
- 모델: `Qwen/Qwen3-TTS-12Hz-1.7B-CustomVoice`
- 고정 revision: `0c0e3051f131929182e2c023b9537f8b1c68adfe`
- 언어 인자: `Korean`
- seed: `20260811`
- 음색: 공식 preset 9개 전부

공식 모델 카드는 CustomVoice가 한국어를 지원하고, 9개 speaker 모두 모델 지원 언어를 말할 수 있다고 설명한다. 최상의 품질에는 각 speaker 원어 사용을 권장한다. 따라서 같은 한국어 문장으로 9개를 모두 생성하되, `Sohee`가 유일한 한국어 원어 preset임을 비교 화면에 표시한다.

## 생성 결과

| 음색 | 원어 음색 | 길이 | EBU R128 | True peak |
| --- | --- | ---: | ---: | ---: |
| Vivian | 중국어 | 3.306초 | -15.6 LUFS | -0.9 dBTP |
| Serena | 중국어 | 3.306초 | -15.2 LUFS | -0.9 dBTP |
| Uncle_Fu | 중국어 | 5.606초 | -14.8 LUFS | -0.8 dBTP |
| Dylan | 중국어·베이징 방언 | 2.806초 | -18.7 LUFS | -1.1 dBTP |
| Eric | 중국어·쓰촨 방언 | 5.006초 | -16.4 LUFS | -3.9 dBTP |
| Ryan | 영어 | 3.606초 | -15.4 LUFS | -1.0 dBTP |
| Aiden | 영어 | 2.406초 | -16.2 LUFS | -1.2 dBTP |
| Ono_Anna | 일본어 | 3.306초 | -16.0 LUFS | -1.5 dBTP |
| Sohee | 한국어 | 3.906초 | -16.3 LUFS | -0.9 dBTP |

원본 WAV는 mono PCM 24 kHz다. 배포용 파일은 단일 `loudnorm=I=-16:TP=-1:LRA=7` 처리 후 mono Opus/Ogg 48 kbps VBR로 만들었다. Opus stream은 48 kHz decode clock으로 표시된다. Dylan은 peak ceiling을 유지한 단일 처리 결과 -18.7 LUFS로 측정되어 metadata에 예외 이유를 남겼다. 수동 gain이나 추가 압축은 적용하지 않았다.

## 한계

포맷·hash·음량만 기술 검증했다. 한국어 발음, 자연스러움, 고령자 선호는 사람이 직접 듣고 평가해야 한다. 특히 Sohee 외 8개는 원어 음색이 한국어가 아니다.

## 라이선스

모델 카드 표기: Apache-2.0. 출처: <https://huggingface.co/Qwen/Qwen3-TTS-12Hz-1.7B-CustomVoice>
