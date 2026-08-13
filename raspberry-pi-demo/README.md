# Haru Raspberry Pi 오프라인 데모

Raspberry Pi 5에서 1080×1920 세로 모니터와 2×2 물리 버튼 네 개만으로 실행하는 독립 데모입니다. 한국어와 일본어 패키지를 따로 빌드하며, 실행 중 인터넷이나 애플리케이션 백엔드를 사용하지 않습니다.

## 현재 실행 준비 상태

결론: **이 폴더가 Raspberry Pi에 실제로 전달되어 있고 아래 최초 설치를 한 번 마치면 한국어 데모를 실행할 수 있는 구조입니다.** 실행 명령은 `bash scripts/start-ko.sh`입니다.

현재 확인된 항목:

- 한국어·일본어 production build가 생성됩니다.
- 오프라인 검사에서 HTML, JavaScript, 글꼴, 효과음, 내레이션 파일과 checksum이 확인됩니다.
- STT, RAG, telemetry, 외부 API를 실행하지 않습니다.
- 화면 입력은 터치가 아니라 네 개의 키 입력만으로 7일 42문항을 끝까지 진행합니다.
- 1080×1920 세로 화면을 2배 scale로 사용해 실제 CSS 화면은 540×960 기준으로 표시됩니다.
- Raspberry Pi에서는 TTS·STT·RAG 모델을 실행하지 않으므로 Raspberry Pi 5 RAM 4GB를 목표로 만든 정적 SPA 구조입니다.

아직 남은 현장 확인:

- 실제 Raspberry Pi 5와 최종 물리 버튼 기판에서의 부팅·오디오·키 입력 smoke test는 별도로 해야 합니다.
- 자동 부팅 실행은 아직 구성하지 않았습니다. 현재는 Raspberry Pi OS Desktop 로그인 후 실행 스크립트를 수동으로 시작합니다.

> **Git 전달 주의**
> clone할 브랜치에 `raspberry-pi-demo/`를 포함한 commit이 push되어 있어야 합니다. clone 직후 아래 `test -f` 명령으로 전달 여부를 확인합니다. 다른 브랜치나 이 폴더 도입 이전 commit을 받으면 실행 파일이 없습니다.

## 포함·제외 기능

- 포함: 7일 42문항, 4버튼 선택·확정 흐름, 로컬 효과음, 사전 생성 한국어·일본어 내레이션, 마이크 음량 파형, 로컬 진행 상태.
- 제외: STT 추론·전사, RAG, 원격 API, telemetry, 계정 서버, 클라우드 동기화.
- 마이크 입력은 파형 진폭 계산에만 쓰고 녹음 파일이나 음성을 저장하지 않습니다. 마이크가 없거나 권한이 거부되면 결정적 데모 파형으로 이어집니다.
- 고품질 TTS 모델은 개발 환경에서 음원을 미리 생성할 때만 사용합니다. Raspberry Pi에서 TTS 모델을 실행하거나 다운로드하지 않습니다.

## 준비 환경

- Raspberry Pi 5, Raspberry Pi OS Desktop 64-bit
- 1080×1920 세로 방향 디스플레이
- Node.js `20.19.0` 이상 또는 `22.13.0` 이상, npm, Chromium
- 인터넷 연결은 최초 clone·`npm ci`·build에만 필요
- 키보드 입력으로 `1`, `2`, `3`, `4`를 보내는 2×2 물리 버튼 컨트롤러

Pi OS 디스플레이 설정에서 모니터를 세로 방향으로 회전한 뒤 터미널을 엽니다. 저장소와 의존성을 받을 때만 인터넷을 연결합니다.

이 앱은 Raspberry Pi GPIO를 직접 읽지 않습니다. 물리 버튼 기판이나 중간 제어 프로그램이 USB 키보드처럼 `KeyboardEvent`를 보내야 합니다. 다른 키를 보내는 장치라면 [`config/runtime.json`](config/runtime.json)의 매핑만 바꾸면 됩니다.

설치 전 확인:

```bash
uname -m
getconf LONG_BIT
node --version
npm --version
chromium --version || chromium-browser --version
```

기대값:

- `uname -m`: `aarch64` 또는 `arm64`
- `getconf LONG_BIT`: `64`
- Node.js: `v20.19.0` 이상 또는 `v22.13.0` 이상
- Chromium: 명령 하나 이상 성공

Node.js가 없거나 위 버전보다 낮으면 Raspberry Pi OS ARM64용 Node.js를 먼저 설치합니다. 설치 방식은 운영 환경에서 승인한 패키지 소스나 Node 버전 관리 도구를 사용합니다. `eslint@10.3.0`과 `jsdom@29.1.1`이 이 최소 버전을 요구합니다. 현재 bootstrap의 사전 검사는 Node의 major version만 확인하므로 `node --version`을 사람이 먼저 확인해야 합니다.

## Raspberry Pi로 전달

### 방법 A: Git clone

이 방법은 `raspberry-pi-demo/`가 원격 브랜치에 commit·push된 뒤에만 가능합니다.

```bash
git clone --branch feat/haru-sound-feedback --single-branch https://github.com/hyunjun1121/saerok-memory.git
cd saerok-memory/raspberry-pi-demo
test -f package.json && test -f scripts/bootstrap-pi.sh
```

마지막 `test`가 실패하면 원격 브랜치에 아직 이 폴더가 없는 상태입니다. 실행을 계속하지 말고 원격 반영 여부부터 확인합니다.

### 방법 B: 폴더를 Raspberry Pi에 직접 복사

현재 작업 폴더를 USB 저장장치, `scp`, 로컬 네트워크 공유 등으로 Raspberry Pi에 전달해도 됩니다. 다만 개발 PC의 `tools/` 아래에는 Raspberry Pi 실행에 필요 없는 TTS 모델·가상환경·생성 cache가 수십 GB 존재할 수 있으므로 작업 폴더 전체를 무작정 복사하지 않습니다. `node_modules/`, `dist/`, `runtime/`, `.venv/`, model cache와 `.work/`도 전달 대상에서 제외합니다. 가장 안전한 전달 방식은 이 폴더가 commit·push된 뒤 Git으로 받는 것입니다.

Windows에서 만들어진 `node_modules/`와 `dist/`를 그대로 신뢰하지 말고, Raspberry Pi에서 반드시 `bootstrap-pi.sh`를 실행해 ARM64 의존성과 build를 다시 만듭니다.

예시 경로:

```bash
cd ~/saerok-memory/raspberry-pi-demo
test -f package.json && test -f scripts/bootstrap-pi.sh
```

## 최초 설치와 빌드

Chromium이 없다면 먼저 설치합니다.

```bash
sudo apt update
sudo apt install -y chromium
```

폴더 안에서 bootstrap을 실행합니다.

```bash
bash scripts/bootstrap-pi.sh
```

`bootstrap-pi.sh`는 다음 항목을 확인한 뒤 lockfile 기반 설치와 두 시장 빌드를 실행합니다.

- Raspberry Pi 하드웨어와 Raspberry Pi OS 계열
- ARM64 커널·64-bit userland
- Node.js 요구 버전, npm, Chromium
- `config/runtime.json` 형식
- 한국어·일본어 정적 빌드의 로컬 자산과 외부 통신 참조 부재

성공 시 마지막에 `Bootstrap complete for Raspberry Pi ...`와 한국어·일본어 실행 명령이 표시됩니다. 중간에 실패하면 해당 오류를 해결한 뒤 같은 명령을 다시 실행해도 됩니다. `npm ci`가 lockfile 기준으로 의존성을 다시 맞춥니다.

개별 빌드 명령:

```bash
npm ci
npm run build:ko
npm run build:ja
npm run check:offline
```

`build:ko`는 `VITE_HARU_MARKET=kr`, `HARU_OUT_DIR=dist/ko`를 사용합니다. `build:ja`는 각각 `jp`, `dist/ja`를 사용합니다. Node가 Vite를 직접 실행하므로 Windows 개발 PC와 Linux ARM64에서 같은 명령을 사용합니다.

한국어만 빠르게 준비할 때는 다음 명령만 사용해도 됩니다. `build:ko` 자체가 해당 build의 오프라인 검사를 포함합니다.

```bash
npm ci
npm run build:ko
```

## 실행

한국어:

```bash
cd ~/saerok-memory/raspberry-pi-demo
bash scripts/start-ko.sh
```

일본어:

```bash
cd ~/saerok-memory/raspberry-pi-demo
bash scripts/start-ja.sh
```

실행 스크립트는 다음 작업만 수행합니다.

1. 수정 가능한 runtime config를 선택한 빌드에 동기화합니다.
2. 정적 파일 서버를 `127.0.0.1:4173`에만 엽니다.
3. 고정 사용자 프로필로 Chromium kiosk를 1080×1920, device scale factor 2로 실행합니다.
4. 실제 마이크 권한을 자동 허용합니다. 가짜 미디어 장치는 사용하지 않습니다.
5. Chromium 종료 시 정적 서버도 종료합니다.

정적 서버는 파일 제공용이며 STT·RAG·데이터 처리 백엔드가 아닙니다. 브라우저의 외부 DNS와 background network 기능도 실행 인자에서 차단합니다.

종료하려면 외부 관리자 키보드에서 `Alt+F4`로 Chromium을 닫습니다. Chromium이 닫히면 실행 스크립트가 로컬 정적 서버도 종료합니다.

## 네 개 버튼 사용법

기본 물리 배치:

```text
A: 왼쪽 위   B: 오른쪽 위
C: 왼쪽 아래 D: 오른쪽 아래
```

화면 상태별 동작:

| 화면 상태 | 왼쪽 버튼 A/C | 오른쪽 버튼 B/D | 네 자리 버튼 A/B/C/D |
|---|---|---|---|
| 시작 화면 | 안내 다시 듣기 | 활동 시작 | - |
| 4지선다 | - | - | 해당 자리 선택, 같은 버튼을 한 번 더 눌러 확정 |
| 순서 문항 입력 | - | - | 해당 자리 선택, 같은 버튼을 한 번 더 눌러 순서 확정 |
| 순서 3개 확인 | 처음부터 다시 | 순서 제출 | - |
| 말하기 전 | 안내 다시 듣기 | 말하기 시작 | - |
| 말하는 중 | 취소 | 말하기 끝 | - |
| 말하기 확인 | 다시 말하기 | 응답 확정 | - |
| 문항 피드백 | 같은 문항 다시 | 다음 문항 | - |
| 하루 완료 | 완료 안내 다시 듣기 | 메뉴로 이동 | - |

길게 누르기, 더블 클릭, 여러 버튼 동시 누르기는 사용하지 않습니다. 한 번 누른 뒤 손을 떼고 다음 입력을 합니다. 기본 접점 튐 방지 시간은 200ms입니다.

## 물리 버튼 매핑 변경

빌드 없이 [`config/runtime.json`](config/runtime.json)을 수정한 뒤 앱을 다시 시작합니다. 시작할 때 이 파일이 `dist/ko` 또는 `dist/ja`로 복사됩니다. `dist` 안의 복사본을 직접 수정하면 다음 실행 때 덮어씌워집니다.

기본 위치와 `KeyboardEvent` 값:

| 물리 위치 | 화면 표식 | `key` | `code` |
|---|---:|---:|---|
| 왼쪽 위 | A | `1` | `Digit1` |
| 오른쪽 위 | B | `2` | `Digit2` |
| 왼쪽 아래 | C | `3` | `Digit3` |
| 오른쪽 아래 | D | `4` | `Digit4` |

버튼 컨트롤러가 다른 키를 전송하면 각 binding의 `key`, `code`를 수정합니다. 네 위치 사이에 같은 `key` 또는 `code`를 중복 지정할 수 없습니다. `input.debounceMs`는 접점 튐 방지 시간이며 기본값은 200ms입니다.

설정 검증:

```bash
node scripts/runtime-config.mjs validate
```

서버 포트, 세로 해상도, scale factor, 시작 route, Chromium 프로필 위치, 마이크 fallback도 같은 파일에서 바꿀 수 있습니다. 서버 host는 보안을 위해 `127.0.0.1`로 고정됩니다.

## 진행 상태 초기화와 복구

먼저 Haru Chromium을 닫고 실행합니다.

```bash
bash scripts/reset-demo.sh
```

초기화 스크립트는 데이터를 삭제하지 않습니다. `runtime/chromium-profile`을 다음 형식의 복구 가능한 폴더로 이동합니다.

```text
runtime/backups/chromium-profile-YYYYMMDDTHHMMSSZ
```

복구하려면 Haru를 종료한 상태에서 현재 `runtime/chromium-profile`을 별도로 옮기고 원하는 백업 폴더를 그 위치로 되돌립니다.

현장 시연 전에 완전히 새 상태가 필요하면 Chromium을 닫은 뒤 `reset-demo.sh`를 실행하고 다시 시작합니다. 평소에는 초기화하지 않아야 중단 지점부터 이어집니다.

한국어와 일본어 실행은 같은 Chromium profile을 사용합니다. 언어를 바꿔 별도 시연할 때 이전 진행 상태를 섞고 싶지 않다면 먼저 `reset-demo.sh`를 실행합니다.

## 최초 현장 smoke test

인터넷을 끈 상태에서 다음 순서로 확인합니다.

1. `bash scripts/start-ko.sh` 실행.
2. 시작 화면에서 A/C를 눌러 안내가 다시 재생되는지 확인.
3. B/D를 눌러 1일차 첫 문항으로 들어가는지 확인.
4. 4지선다에서 A, B, C, D를 각각 한 번 눌러 선택 상태와 해당 TTS를 확인.
5. 선택한 버튼을 한 번 더 눌러 확정하고, 피드백에서 B/D로 다음 문항 이동.
6. 말하기 문항에서 오른쪽 버튼으로 시작·종료하고 파형이 움직이는지 확인. 마이크가 없어도 fallback 파형으로 완료 가능해야 함.
7. 순서 문항과 하루 완료 화면까지 네 버튼만으로 진행.
8. Chromium을 닫고 다시 실행해 진행 상태가 유지되는지 확인.

새 1일차를 강제로 확인할 때만 아래 주소를 사용합니다.

```text
http://127.0.0.1:4173/#/lesson?day=1&restart=1
```

`restart=1`은 해당 날짜의 기존 응답을 지우므로 평상시 이어하기 주소로 사용하면 안 됩니다.

## 개발 PC 검증

```bash
node --test scripts/runtime.test.mjs
npm run typecheck
npm test
npm run lint
npm run build
npm run check:offline
```

## 오프라인 데이터와 음원 권리

- 응답, 문항 소요 시간, 완료 상태는 전용 Chromium profile의 브라우저 저장소에만 남습니다.
- 말하기 음성은 저장하거나 전사하지 않습니다. 마이크 값은 실시간 파형 진폭 계산에만 사용합니다.
- Qwen 기반 사전 생성 음원 provenance는 `public/assets/audio/narration/model-source.json`과 `LICENSE.txt`에 기록되어 있습니다.
- 1일차 일부 음원은 Fish Audio 브라우저 export입니다. 다운로드 MP3에 model id, revision, license가 내장되어 있지 않아 이를 임의로 단정하지 않았습니다. 재배포나 상업 공개 전 적용되는 Fish Audio 약관을 별도로 확인해야 합니다.
- 음원 생성·비교 자료 attribution: **Built with Fish Audio**. Fish Audio Research License가 적용되는 자료에는 `tools/tts-comparison/**/fish/LICENSE`와 `NOTICE.txt`를 함께 제공합니다. 상업적 사용 권한은 이 연구용 라이선스에 포함되지 않습니다.

브라우저만 확인할 때:

```bash
npm run preview:ko
# 새 1일차 확인: http://127.0.0.1:4173/#/lesson?day=1&restart=1
# 중단 지점 이어하기: http://127.0.0.1:4173/#/lesson
```

```bash
npm run preview:ja
# 1日目を最初から確認: http://127.0.0.1:4174/#/lesson?day=1&restart=1
# 中断地点から再開: http://127.0.0.1:4174/#/lesson
```

## 문제 해결

- `Vite is not installed`: 이 폴더에서 `npm ci` 실행.
- clone 후 `raspberry-pi-demo`가 없음: 아직 원격 브랜치에 commit·push되지 않은 상태. maintainer에게 원격 반영 요청.
- `Node.js 20+ missing` 또는 `npm ci`의 engine 오류: `v20.19.0` 이상 또는 `v22.13.0` 이상 설치 후 `node --version` 확인.
- `Chromium not found`: `sudo apt install chromium` 실행. 배포판이 `chromium-browser` 이름을 쓰는 경우도 자동 감지합니다.
- 서버 시작 실패: `runtime/server-ko.log` 또는 `runtime/server-ja.log` 확인.
- 버튼을 눌러도 반응 없음: 텍스트 편집기에서 물리 버튼이 실제로 `1`, `2`, `3`, `4`를 입력하는지 먼저 확인. 다른 키면 `config/runtime.json` 수정 후 재시작.
- 마이크 파형 없음: Pi OS 오디오 입력 장치와 Chromium 권한 확인. 문항 진행은 fallback 파형으로 유지됩니다.
- 화면 방향·크기가 다름: Pi OS 디스플레이를 세로로 회전하고 `config/runtime.json`의 1080×1920 값을 확인.
- 장시간 시연 중 화면이 꺼짐: Raspberry Pi OS의 화면 꺼짐·절전 설정을 운영자가 비활성화. 현재 스크립트는 OS 절전 설정을 바꾸지 않음.
- 재부팅 후 자동 시작되지 않음: 정상. 자동 시작 설정은 아직 없으므로 Desktop 로그인 후 `bash scripts/start-ko.sh`를 다시 실행.
- 포트 충돌: 앱 종료 후 남은 `server.mjs` 프로세스를 확인하거나 runtime config 포트를 다른 loopback 포트로 변경.
