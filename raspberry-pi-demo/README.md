# Haru Raspberry Pi 오프라인 데모

Raspberry Pi 5에서 1080×1920 세로 모니터, USB NFC 카드 리더기, 2×2 물리 버튼 네 개로 실행하는 독립 데모입니다. 한국어와 일본어 패키지를 따로 빌드하며, 실행 중 인터넷이나 애플리케이션 백엔드를 사용하지 않습니다.

## 현재 실행 준비 상태

결론: **빈 Raspberry Pi 5에 Raspberry Pi OS Desktop 64-bit를 기록한 뒤, 이 저장소를 지정 브랜치로 clone하고 `provision-pi.sh`를 실행하면 앱·Node·Chromium·자동 시작까지 설정할 수 있습니다.** OS 이미지 기록 자체와 최종 디스플레이 방향·오디오 장치 선택은 하드웨어별 1회 작업입니다.

현재 확인된 항목:

- 한국어·일본어 production build가 생성됩니다.
- 오프라인 검사에서 HTML, JavaScript, 글꼴, 효과음, 내레이션 파일과 checksum이 확인됩니다.
- STT, RAG, telemetry, 외부 API를 실행하지 않습니다.
- 화면 입력은 NFC 카드 인증 뒤 네 개의 키 입력만으로 7일 42문항을 끝까지 진행합니다.
- 1080×1920 세로 화면을 2배 scale로 사용해 실제 CSS 화면은 540×960 기준으로 표시됩니다.
- Raspberry Pi에서는 TTS·STT·RAG 모델을 실행하지 않으므로 Raspberry Pi 5 RAM 4GB 이상을 대상으로 만든 정적 SPA 구조입니다.
- 공식 Node.js 24.19.0 ARM64 archive를 SHA-256 검증한 뒤 `/opt/haru`에 설치합니다.
- Raspberry Pi OS Trixie의 Labwc/Wayland, Desktop 자동 로그인, 화면 꺼짐 방지, Haru 자동 시작을 스크립트로 구성할 수 있습니다.
- `doctor-pi.sh`가 OS·Node·Chromium·빌드·화면·오디오·HID 입력 상태를 점검합니다.

아직 남은 현장 확인:

- 실제 Raspberry Pi 5와 최종 모니터·스피커·마이크·버튼 기판에서 아래 현장 수용 테스트를 해야 합니다. Windows/Playwright 검증은 이 물리 검증을 대신하지 않습니다.

> **Git 전달 주의**
> clone할 브랜치에 `raspberry-pi-demo/`를 포함한 commit이 push되어 있어야 합니다. clone 직후 아래 `test -f` 명령으로 전달 여부를 확인합니다. 다른 브랜치나 이 폴더 도입 이전 commit을 받으면 실행 파일이 없습니다.

## 포함·제외 기능

- 포함: 7일 42문항, 4버튼 선택·확정 흐름, 로컬 효과음, 사전 생성 한국어·일본어 내레이션, 마이크 음량 파형, 로컬 진행 상태.
- 제외: STT 추론·전사, RAG, 원격 API, telemetry, 계정 서버, 클라우드 동기화.
- 마이크 입력은 파형 진폭 계산에만 쓰고 녹음 파일이나 음성을 저장하지 않습니다. 마이크가 없거나 권한이 거부되면 결정적 데모 파형으로 이어집니다.
- 고품질 TTS 모델은 개발 환경에서 음원을 미리 생성할 때만 사용합니다. Raspberry Pi에서 TTS 모델을 실행하거나 다운로드하지 않습니다.

## NFC 로그인 대기 화면

앱을 열면 기존 활동 시작 화면보다 먼저 `로그인 대기` 화면(일본어 build는 `ログイン待ち`)이 표시됩니다. 이 화면에서 USB NFC 리더기에 이용자 카드를 대면, 리더기가 키보드처럼 숫자 `5`를 한 번 보내고 활동 시작 화면으로 넘어갑니다. 카드 인증 전에는 숫자 `1`~`4`를 눌러도 활동이 시작되지 않습니다.

NFC 리더기는 별도 NFC SDK나 네트워크 연결이 필요 없는 **USB 키보드 웨지 모드**로 설정합니다.

- 카드 인식 결과: 숫자 `5` 한 번(`Shift`, `Ctrl`, `Alt`, `Enter` 같은 접두·접미 키 없음)
- 리더기 포커스: Chromium kiosk 창이 활성 창이어야 함
- 인증 범위: 브라우저를 새로 열거나 `/lesson` 경로에 다시 진입할 때마다 다시 인증
- 음성 안내: 카드 대기 문구가 자동 재생되며, 브라우저 autoplay가 막혀도 인증과 활동 진행은 계속 가능

## 빈 Raspberry Pi 준비

필수 하드웨어:

- Raspberry Pi 5, RAM 4GB 이상
- 공식 권장 수준의 안정적인 전원. USB 마이크와 버튼 인코더를 함께 쓰면 Raspberry Pi 5용 27W 전원 사용 권장
- 32GB 이상 microSD 또는 SSD/NVMe. 운영 여유를 위해 64GB 권장
- 1080×1920 세로 디스플레이, HDMI 또는 USB 오디오 출력, 필요 시 USB 마이크
- 키보드 입력 `1`, `2`, `3`, `4`의 press/release를 보내는 2×2 USB HID 버튼 컨트롤러
- 숫자 `5` 한 번을 출력하는 USB NFC 카드 리더기(키보드 웨지 모드, HID keyboard class)

다른 PC의 Raspberry Pi Imager에서 다음을 설정합니다.

1. OS: **Raspberry Pi OS (64-bit)** 기본 Desktop판. Lite판은 GUI가 없어 지원하지 않습니다.
2. 사용자 이름·강한 비밀번호, 시간대 `Asia/Seoul`, Wi-Fi 국가와 네트워크를 지정합니다.
3. 유지보수가 필요하면 SSH를 켜되 공개키 로그인을 권장합니다.
4. Pi에 이미지를 넣고 Desktop까지 최초 부팅합니다.

현재 설치 기준은 Debian Trixie 기반 Raspberry Pi OS입니다. 설치 스크립트가 다른 배포판, 32-bit userland, Pi 5가 아닌 보드, RAM 4GB 미만, 여유 공간 4GiB 미만을 fail-closed로 중단합니다.

이 앱은 Raspberry Pi GPIO를 직접 읽지 않습니다. 물리 버튼 기판이나 중간 제어 프로그램이 USB 키보드처럼 `KeyboardEvent`를 보내야 합니다. raw GPIO 버튼이면 이 저장소에 포함되지 않은 GPIO→Linux HID/uinput 계층이 추가로 필요합니다. 다른 키를 보내는 장치라면 [`config/runtime.json`](config/runtime.json)의 매핑만 바꿉니다.

OS 설치 직후 확인:

```bash
cat /etc/os-release
uname -m
getconf LONG_BIT
cat /proc/device-tree/model; echo
```

기대값:

- OS codename: `trixie`
- 보드: `Raspberry Pi 5 ...`
- `uname -m`: `aarch64` 또는 `arm64`
- `getconf LONG_BIT`: `64`

Node/npm/Chromium은 이 시점에 없어도 됩니다. 아래 프로비저닝 스크립트가 설치합니다.

## Raspberry Pi로 전달

### 방법 A: Git clone

이 방법은 `raspberry-pi-demo/`가 원격 브랜치에 commit·push된 뒤에만 가능합니다.

Desktop 터미널에서 최소 clone 도구를 설치합니다.

```bash
sudo apt update
sudo apt install -y ca-certificates git
```

원격 기본 브랜치 `main`에는 이 Pi 폴더가 없으므로 **반드시** 아래 feature branch를 지정합니다. sparse clone은 다른 대형 작업 자료를 내려받지 않습니다.

```bash
cd "$HOME"
git clone --depth 1 --filter=blob:none --sparse \
  --branch feat/haru-sound-feedback \
  https://github.com/hyunjun1121/saerok-memory.git
cd saerok-memory
git sparse-checkout set raspberry-pi-demo
cd raspberry-pi-demo
test -f package.json && test -f scripts/bootstrap-pi.sh
```

마지막 `test`가 실패하면 원격 브랜치에 아직 이 폴더가 없는 상태입니다. 실행을 계속하지 말고 원격 반영 여부부터 확인합니다.

### 복붙용 전체 명령

아래 블록은 Raspberry Pi OS Desktop 64-bit를 처음 준비한 뒤, 이 저장소를 받고 한국어 kiosk를 자동 시작하는 순서입니다. 저장소가 비공개이면 HTTPS clone 시 GitHub 자격 증명 또는 Personal Access Token을 입력하거나, 저장된 SSH 키가 있으면 clone URL을 `git@github.com:hyunjun1121/saerok-memory.git`로 바꿉니다.

```bash
sudo apt-get update
sudo apt-get install -y ca-certificates git

cd "$HOME"
git clone --depth 1 --filter=blob:none --sparse \
  --branch feat/haru-sound-feedback \
  https://github.com/hyunjun1121/saerok-memory.git
cd saerok-memory
git sparse-checkout set raspberry-pi-demo
cd raspberry-pi-demo

test -f package.json && test -f scripts/provision-pi.sh || {
  echo "raspberry-pi-demo가 clone되지 않았습니다. 브랜치와 원격 반영 상태를 확인하세요." >&2
  exit 1
}

# 한국어 kiosk: Node.js·Chromium·오디오 도구 설치, 양쪽 build, 자동 시작 설정
bash scripts/provision-pi.sh --enable-autostart --market ko
```

일본어 kiosk로 자동 시작하려면 마지막 줄만 다음으로 바꿉니다.

```bash
bash scripts/provision-pi.sh --enable-autostart --market ja
```

`provision-pi.sh`는 일반 Desktop 사용자로 실행합니다. `sudo bash scripts/provision-pi.sh`로 실행하지 마세요. 이 스크립트가 필요한 OS 패키지 설치 단계에서만 `sudo`를 호출합니다. 기본값으로 OS `full-upgrade`도 실행하므로 현장 운영 중인 Pi에서 미루려면 다음처럼 명시합니다.

```bash
bash scripts/provision-pi.sh --enable-autostart --market ko --skip-full-upgrade
```

프로비저닝이 끝나면 화면 방향·오디오·HID 입력을 설정하고 진단합니다.

```bash
bash scripts/display-pi.sh list
# 출력된 실제 HDMI 이름과 장착 방향으로 아래 값을 바꿉니다.
bash scripts/display-pi.sh set HDMI-A-1 90

wpctl status
# 필요하면 실제 장치 ID로 기본 출력·마이크를 지정합니다.
wpctl set-default <출력_SINK_ID>
wpctl set-default <마이크_SOURCE_ID>
wpctl set-mute @DEFAULT_SINK@ 0
wpctl set-volume @DEFAULT_SINK@ 80%

bash scripts/doctor-pi.sh --kiosk --audio --buttons --nfc
sudo reboot
```

진단 명령은 마지막에 버튼 1·2·3·4와 NFC 카드의 `5` 입력을 직접 기다립니다. 실제 장치를 연결한 뒤 실행하세요.

### 이미 clone한 Pi에서 업데이트·재빌드

```bash
cd "$HOME/saerok-memory"
git switch feat/haru-sound-feedback
git pull --ff-only origin feat/haru-sound-feedback
cd raspberry-pi-demo

# Node.js·Chromium·ARM64 의존성·양쪽 정적 build·오프라인 감사를 다시 실행
bash scripts/bootstrap-pi.sh
```

작업 중인 파일이 있으면 `git pull --ff-only`가 중단될 수 있습니다. 기존 파일을 덮어쓰지 말고 변경 내용을 먼저 백업하거나 커밋한 뒤 다시 실행합니다.

### 방법 B: 폴더를 Raspberry Pi에 직접 복사

현재 작업 폴더를 USB 저장장치, `scp`, 로컬 네트워크 공유 등으로 Raspberry Pi에 전달해도 됩니다. 다만 개발 PC의 `tools/` 아래에는 Raspberry Pi 실행에 필요 없는 TTS 모델·가상환경·생성 cache가 수십 GB 존재할 수 있으므로 작업 폴더 전체를 무작정 복사하지 않습니다. `node_modules/`, `dist/`, `runtime/`, `.venv/`, model cache와 `.work/`도 전달 대상에서 제외합니다. 가장 안전한 전달 방식은 이 폴더가 commit·push된 뒤 Git으로 받는 것입니다.

Windows에서 만들어진 `node_modules/`와 `dist/`를 그대로 신뢰하지 말고, Raspberry Pi에서 반드시 `bootstrap-pi.sh`를 실행해 ARM64 의존성과 build를 다시 만듭니다.

예시 경로:

```bash
cd ~/saerok-memory/raspberry-pi-demo
test -f package.json && test -f scripts/bootstrap-pi.sh
```

## 새 Pi 전체 프로비저닝

한국어 kiosk를 재부팅 후 자동 실행하도록 완전히 설정합니다.

```bash
cd "$HOME/saerok-memory/raspberry-pi-demo"
bash scripts/provision-pi.sh --enable-autostart --market ko
```

이 명령은 다음을 순서대로 수행합니다.

1. Pi 5, ARM64, 64-bit, Trixie Desktop, RAM, 디스크, 일반 사용자 실행을 검사합니다.
2. `apt update`, `apt full-upgrade`, Git·Chromium·오디오·디스플레이·HID 진단 패키지를 설치합니다.
3. 공식 Node.js `v24.19.0` Linux ARM64 archive와 공식 `SHASUMS256.txt`를 HTTPS로 받고 SHA-256 `01443c1e…86fdc`를 검증합니다.
4. Node를 `/opt/haru/node-v24.19.0-linux-arm64`에 설치하고 전용 symlink/PATH를 만듭니다. 다른 `/usr/local/bin` 파일은 덮어쓰지 않습니다.
5. lockfile의 dev·optional ARM64 패키지를 포함해 `npm ci` 후 한국어·일본어 build와 오프라인 감사를 실행합니다.
6. Labwc/Wayland, Desktop 자동 로그인, 화면 blanking 해제, 한국어 Haru 자동 시작을 설정합니다.

`--enable-autostart`는 비밀번호 입력 없는 Desktop 로그인 상태를 만듭니다. 전용 kiosk를 물리적으로 보호하고 노출된 USB 포트를 통제해야 합니다. 자동 로그인이 필요 없으면 해당 옵션을 빼고 수동 시작을 사용합니다. OS 전체 업그레이드를 명시적으로 미루는 경우에만 `--skip-full-upgrade`를 추가합니다.

이미 설치된 Pi에서 앱 build만 다시 만들 때는 아래 명령을 사용합니다.

```bash
bash scripts/bootstrap-pi.sh
```

`bootstrap-pi.sh`는 설치기가 아니라 검증·의존성·build 단계입니다.

- Raspberry Pi 하드웨어와 Raspberry Pi OS 계열
- ARM64 커널·64-bit userland
- Node.js `>=24.19.0 <25`, npm, Chromium
- `config/runtime.json` 형식
- 한국어·일본어 정적 빌드의 로컬 자산과 외부 통신 참조 부재

두 스크립트는 같은 명령을 다시 실행해도 중복 Haru autostart block을 만들지 않습니다. 기존 Labwc autostart 내용은 보존하고 Haru marker block만 교체합니다. 설치 로그는 `~/.local/state/haru/provision.log`, 자동 실행 로그는 `runtime/autostart-ko.log`입니다.

개별 빌드 명령:

```bash
npm ci --include=dev --include=optional --ignore-scripts=false --no-audit --no-fund
npm run build:ko
npm run build:ja
npm run check:offline
```

수동 `npm ci`도 dev·optional package 생략 설정이 없어야 합니다. 권장 명령은 `npm ci --include=dev --include=optional --ignore-scripts=false --no-audit --no-fund`입니다. `build:ko`는 `VITE_HARU_MARKET=kr`, `HARU_OUT_DIR=dist/ko`, `build:ja`는 `jp`, `dist/ja`를 사용합니다.

한국어만 빠르게 준비할 때는 다음 명령만 사용해도 됩니다. `build:ko` 자체가 해당 build의 오프라인 검사를 포함합니다.

```bash
npm ci --include=dev --include=optional --ignore-scripts=false --no-audit --no-fund
npm run build:ko
```

## 디스플레이·오디오·버튼 최종 설정

프로비저닝 직후 Desktop 터미널에서 출력 이름을 확인합니다.

```bash
bash scripts/display-pi.sh list
```

가로 해상도 `1920×1080` 모니터를 세로로 세운 경우 실제 장착 방향에 맞춰 `90` 또는 `270`을 한 번 선택합니다. `HDMI-A-1`은 위 명령에 나온 실제 출력 이름으로 바꿉니다.

```bash
bash scripts/display-pi.sh set HDMI-A-1 90
```

패널 자체가 `1080×1920` 세로 모드로 인식되면 회전값 대신 `normal`을 저장합니다.

명령은 먼저 `wlr-randr --dryrun`으로 검증한 뒤 현재 화면에 적용하고, 사용자 전용 `~/.config/haru/display.conf`에 저장합니다. Haru 자동 실행 wrapper가 Chromium보다 먼저 이 설정을 적용합니다. Raspberry Pi OS 화면 scale은 `1.0`, Chromium device scale factor는 [`config/runtime.json`](config/runtime.json)의 `2`를 유지합니다. 목표 browser viewport는 CSS 540×960, 물리 framebuffer는 1080×1920입니다. 방향 저장을 지우려면 `bash scripts/display-pi.sh clear`를 실행합니다.

오디오 출력·마이크 입력을 확인하고 기본 장치를 고릅니다.

```bash
wpctl status
wpctl set-default <출력_SINK_ID>
wpctl set-default <마이크_SOURCE_ID>
wpctl set-mute @DEFAULT_SINK@ 0
wpctl set-volume @DEFAULT_SINK@ 80%
```

Pi 5에는 내장 3.5mm 아날로그 출력이 없습니다. HDMI 오디오 또는 USB 오디오 장치를 사용합니다. 실제 마이크가 없어도 활동은 fallback 파형으로 끝낼 수 있지만, 실제 음성 반응을 시연하려면 USB 마이크를 선택해야 합니다.

전체 진단과 사람이 듣고 누르는 진단을 차례로 실행합니다.

```bash
bash scripts/doctor-pi.sh --kiosk
bash scripts/doctor-pi.sh --kiosk --audio --buttons --nfc
```

첫 명령은 core software뿐 아니라 자동 시작·blanking 해제·Wayland·저장된 디스플레이 설정 실패도 non-zero로 종료합니다. 두 번째 명령은 짧은 로컬 효과음을 재생하고 1·2·3·4 입력과 NFC 리더기의 `5` 입력을 대기합니다. 이 검사를 통과한 뒤 재부팅합니다.

`doctor --buttons --nfc`는 터미널에 들어오는 문자만 확인합니다. 실제 버튼이 press/release를 모두 내보내는지는 `sudo evtest`에서 버튼 장치를 골라 `KEY_1`~`KEY_4` 각각 `value 1`(누름)과 `value 0`(뗌)이 한 쌍인지 확인합니다. `value 2` 반복이나 stuck key가 있으면 인코더 firmware를 먼저 고칩니다. NFC 리더기는 별도 카드 없이 텍스트 편집기에 `5`가 정확히 한 번 입력되는지 먼저 확인합니다.

실제 마이크 경로까지 확인할 때는 Desktop 사용자 세션에서 짧게 녹음·재생합니다. 이 파일은 앱 데이터가 아닌 관리자 장치 점검용 임시 파일이며 확인 직후 지웁니다.

```bash
pw-record "$HOME/haru-mic-test.wav"
# 3초 정도 말한 뒤 Ctrl+C
pw-play "$HOME/haru-mic-test.wav"
rm -- "$HOME/haru-mic-test.wav"
```

```bash
sudo reboot
```

재부팅 후 Desktop 자동 로그인→Labwc→Haru가 한 번만 열려야 합니다. 화면 방향은 저장값이어야 하고 10분 이상 방치해도 꺼지지 않아야 합니다.

## 실행

`--enable-autostart`로 설치했다면 평상시 수동 실행이 필요 없습니다. 상태 확인·전환:

```bash
bash scripts/autostart-pi.sh status
bash scripts/autostart-pi.sh enable ko
bash scripts/autostart-pi.sh disable
```

자동 시작을 끈 뒤 Desktop 로그인도 수동으로 돌리려면 Desktop 터미널에서 다음을 실행합니다.

```bash
sudo raspi-config nonint do_boot_behaviour B3
sudo raspi-config nonint do_blanking 0
```

`B3`는 Desktop 수동 로그인, `do_blanking 0`은 화면 blanking 활성화입니다.

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

## NFC와 네 개 버튼 사용법

기본 물리 배치:

```text
A: 왼쪽 위   B: 오른쪽 위
C: 왼쪽 아래 D: 오른쪽 아래
```

화면 상태별 동작:

| 화면 상태 | 왼쪽 버튼 A/C | 오른쪽 버튼 B/D | 네 자리 버튼 A/B/C/D |
|---|---|---|---|
| 로그인 대기 | - | - | NFC 카드 → `5` 입력 |
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

NFC 리더기의 인증 입력은 앱 버튼 매핑과 별개로 고정되어 있습니다.

| 장치 | `key` | `code` | 사용 시점 |
|---|---:|---|---|
| USB NFC 리더기 | `5` | `Digit5` | 로그인 대기 화면에서만 인증 |

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

프로비저닝과 장치 선택을 끝낸 뒤 다음 순서로 확인합니다.

1. `bash scripts/doctor-pi.sh --kiosk --audio --buttons --nfc`가 software·kiosk 오류 없이 끝나는지 확인.
2. `sudo reboot` 후 키보드 조작 없이 Desktop 자동 로그인과 Haru 한 개 창이 열리는지 확인.
3. 로그인 대기 화면에서 NFC 카드를 대고 리더기가 `5`를 한 번 보내는지, 카드 대기 TTS가 들리는지 확인.
4. 인증 전에는 `1`~`4`가 아무 동작을 하지 않고, 인증 뒤 기존 활동 시작 화면이 표시되는지 확인.
5. 화면 진입 즉시 TTS가 한 번 들리고 화면이 물리 1080×1920, browser CSS 540×960으로 표시되는지 확인.
6. 시작 화면에서 A/C 안내 재생, B/D 활동 시작을 확인.
7. 4지선다에서 A, B, C, D를 각각 누르고 해당 자리 선택·TTS를 확인. 같은 버튼을 다시 눌러 확정합니다.
8. 말하기 문항에서 실제 마이크가 말소리에 반응하는지 확인. 마이크를 제거하거나 권한을 막아도 fallback 파형으로 끝낼 수 있어야 합니다.
9. 순서 문항과 하루 완료 화면까지 물리 버튼만으로 진행합니다.
10. Chromium을 닫았다가 `bash scripts/start-ko.sh`로 다시 열어 NFC 인증부터 진행 상태가 이어지는지 확인합니다.
11. 네트워크를 끄고 다시 재부팅합니다. 자동 시작, NFC 로그인, 첫 TTS, 1일차 완주가 모두 그대로 동작해야 합니다.
12. 10분 이상 방치해 화면이 꺼지지 않는지 확인하고, `vcgencmd get_throttled`가 `throttled=0x0`인지 확인합니다.

새 1일차를 강제로 확인할 때만 아래 주소를 사용합니다.

```text
http://127.0.0.1:4173/#/lesson?day=1&restart=1
```

`restart=1`은 해당 날짜의 기존 응답을 지우므로 평상시 이어하기 주소로 사용하면 안 됩니다.

## 개발 PC 검증

```bash
npm run test:runtime
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

- `Vite is not installed`: 이 폴더에서 `npm ci --include=dev --include=optional --ignore-scripts=false --no-audit --no-fund` 실행.
- clone 후 `raspberry-pi-demo`가 없음: 아직 원격 브랜치에 commit·push되지 않은 상태. maintainer에게 원격 반영 요청.
- Node engine 오류: `source scripts/haru-env.sh` 후 `node --version`이 `v24.19.0` 이상, major 24인지 확인. 아니면 `bash scripts/provision-pi.sh` 재실행.
- `Chromium not found`: `sudo apt install chromium` 실행. 배포판이 `chromium-browser` 이름을 쓰는 경우도 자동 감지합니다.
- 서버 시작 실패: `runtime/server-ko.log`, `runtime/server-ja.log`, `runtime/autostart-ko.log` 확인.
- 로그인 대기 화면에서 넘어가지 않음: Chromium 창을 활성화한 뒤 텍스트 편집기에 NFC 카드를 대어 숫자 `5`만 한 번 입력되는지 확인. `Enter`가 함께 입력되거나 숫자 `5`가 아닌 값이 나오는 리더기는 키보드 웨지 설정을 수정.
- 버튼을 눌러도 반응 없음: 텍스트 편집기에서 물리 버튼이 실제로 `1`, `2`, `3`, `4`를 입력하는지 먼저 확인. 다른 키면 `config/runtime.json` 수정 후 재시작.
- 마이크 파형 없음: `wpctl status`에서 기본 source를 확인. 문항 진행은 fallback 파형으로 유지됩니다.
- 화면 방향·크기가 다름: Desktop 터미널에서 `bash scripts/display-pi.sh list`, 이어서 올바른 출력에 `set ... 90|270`. OS scale 1.0과 runtime 1080×1920을 확인.
- 장시간 시연 중 화면이 꺼짐: `~/.config/labwc/autostart`에 `swayidle`이 다시 들어갔는지 확인하고 `bash scripts/provision-pi.sh --enable-autostart --skip-full-upgrade` 재실행.
- 재부팅 후 자동 시작되지 않음: `bash scripts/autostart-pi.sh status`와 `runtime/autostart-ko.log` 확인. 상태가 disabled면 `bash scripts/autostart-pi.sh enable ko` 실행.
- `Haru ko is already running`: 중복 실행 잠금이 정상 작동한 상태. 기존 Chromium을 사용합니다.
- 포트 충돌: 앱 종료 후 남은 `server.mjs` 프로세스를 확인하거나 runtime config 포트를 다른 loopback 포트로 변경.

## 설치 판단에 사용한 공식 자료

- [Raspberry Pi OS 공식 문서](https://www.raspberrypi.com/documentation/computers/os.html): 현재 Trixie, Desktop/Chromium, `apt full-upgrade`.
- [Raspberry Pi 시작 문서](https://www.raspberrypi.com/documentation/computers/getting-started.html): OS image 준비와 Desktop 저장장치 32GB 최소 권장.
- [Raspberry Pi 공식 kiosk 안내](https://www.raspberrypi.com/tutorials/how-to-use-a-raspberry-pi-in-kiosk-mode/): 64-bit OS, Labwc `~/.config/labwc/autostart`, background `&`, 물리 보안.
- [Raspberry Pi Trixie raspi-config 원본](https://raw.githubusercontent.com/RPi-Distro/raspi-config/trixie/raspi-config): `W2` Labwc, `B4` Desktop autologin, blanking 동작.
- [Node.js 공식 release 상태](https://nodejs.org/en/about/previous-releases): Node 24 LTS, Node 20 EOL.
- [Node.js v24.19.0 공식 checksum](https://nodejs.org/download/release/v24.19.0/SHASUMS256.txt): Linux ARM64 archive SHA-256 검증.
- [Debian Trixie wlr-randr manpage](https://manpages.debian.org/trixie/wlr-randr/wlr-randr.1.en.html): output·transform·dry-run 옵션.

이 자료는 설치 환경 판단 근거입니다. 실제 Pi 5 cold boot와 최종 USB 장치 수용 테스트 결과는 아직 이 저장소만으로 증명할 수 없습니다.
