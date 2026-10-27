# Raspberry Pi에서 9문항 실증판 업데이트·테스트·빌드하기

기준일: 2026-10-27. 대상 문항 버전은 `jp-first-meeting-2.0`입니다. **Raspberry Pi에서 `japan-pilot` 브랜치의 루트 웹앱을 빌드하고, 같은 Pi의 Chromium으로 `http://127.0.0.1:5188/pilot`을 엽니다.**

| 구분 | 이번 일본 실증판 | 기존 Pi 전용 데모 |
| --- | --- | --- |
| 코드 위치 | 저장소 루트 | `raspberry-pi-demo/` |
| 브랜치 | `japan-pilot` | `feat/haru-sound-feedback` |
| 구성 | 선택형 4개 → 음성 5개, 총 9문항 | 7일 데모 |
| 실행 | 루트의 `npm run preview:pilot` | 기존 `scripts/start-ja.sh` 등 |
| 주소 | `http://127.0.0.1:5188/pilot` | 기존 데모의 `:4174` 등 |
| 답변 보관 | SQLite·원본 음성·체류 및 이탈 기록 | 기존 데모 안내에 따른 별도 동작 |

이번 가이드의 명령은 **루트 폴더에서** 실행합니다. 기존 Pi 데모의 설치·자동 실행 스크립트를 실행해도 새 9문항 실증판으로 바뀌지 않습니다. 새 Fish Audio TTS 제작·연결은 추후 작업이며, 이 설치에는 TTS 모델·Python·GPU·STT·RAG·외부 API 키가 필요하지 않습니다.

## 1. 업데이트 전에 할 일

1. 참가자 진행과 녹음을 마치고 저장 오류가 없는지 확인합니다. 같은 Pi·같은 브라우저에서 ZIP 내보내기를 완료해 전송 대기 자료도 전달되도록 합니다.
2. 시작 화면 또는 아래 건강 확인 주소의 `dataDirectory`를 확인해 둡니다. `HARU_PILOT_DATA_DIR`을 따로 사용했다면 이후 실행에서도 **같은 절대 경로**를 설정합니다.
3. 수집 서버를 실행한 터미널에서 `Ctrl+C`로 종료합니다. 별도 서비스로 관리 중이면 그 서비스를 중지합니다. 참가자 진행 중에는 `git pull`, 설치, 빌드, 서버 재시작을 하지 않습니다.
4. 이미 데이터가 있으면 [8절](#8-종료백업재실행)의 방법으로 서버 종료 후 저장 폴더 전체를 백업합니다. 코드 업데이트는 참가자 데이터 이동 작업과 구분합니다.

서버가 켜져 있을 때 저장 위치를 확인하는 명령입니다.

```bash
curl --fail --silent --show-error http://127.0.0.1:5188/api/pilot-local/health
```

기본 저장 위치는 `<프로젝트>/local-data/japan-pilot/`입니다. 소스 변경 사항이 있는 폴더는 그대로 보존합니다. 이 가이드는 `git reset`, `git clean`, 기존 데이터 덮어쓰기를 사용하지 않습니다.

## 2. 이미 `japan-pilot`을 받은 Pi: 업데이트부터 실행까지

아래 블록 첫 줄의 프로젝트 경로를 **실제 clone한 루트 폴더**로 맞춥니다. 예를 들어 기존 위치가 `~/saerok-memory`라면 첫 줄만 수정합니다. 저장 위치를 따로 설정했다면 블록 실행 전에 `export HARU_PILOT_DATA_DIR='/실제/절대/저장경로'`를 지정합니다.

이 블록은 별도 Bash에서 실행하며, 잘못된 브랜치·로컬 코드 변경·명령 실패가 있으면 후속 단계로 넘어가지 않습니다. 서버 종료와 백업을 먼저 마친 상태에서 붙여 넣습니다.

```bash
export HARU_PILOT_REPO="$HOME/haru-japan-pilot"

bash <<'BASH'
set -euo pipefail
cd "$HARU_PILOT_REPO"

# 현재 Node가 24가 아니면 기존 Pi 설치의 Node 경로를 확인합니다.
if ! node -e 'process.exit(process.versions.node.split(".")[0] === "24" ? 0 : 1)' 2>/dev/null && [[ -x /opt/haru/node-current/bin/node ]]; then
  export PATH="/opt/haru/node-current/bin:$PATH"
fi

[[ "$(id -u)" -ne 0 ]] || { printf 'sudo 없이 Desktop 사용자로 실행하세요.\n' >&2; exit 1; }
[[ "$(getconf LONG_BIT)" == 64 ]] || { printf '64-bit OS가 필요합니다.\n' >&2; exit 1; }
[[ "$(uname -m)" == aarch64 || "$(uname -m)" == arm64 ]] || { printf 'ARM64 환경을 확인하세요.\n' >&2; exit 1; }
[[ "$(git branch --show-current)" == japan-pilot ]] || { printf 'japan-pilot 브랜치가 아닙니다. 가이드 3절을 확인하세요.\n' >&2; exit 1; }
[[ -z "$(git status --porcelain)" ]] || { git status --short; printf '로컬 코드 변경을 먼저 보존하세요.\n' >&2; exit 1; }
command -v curl >/dev/null
if curl --fail --silent --max-time 2 http://127.0.0.1:5188/api/pilot-local/health >/dev/null; then
  printf '먼저 수집 서버를 종료하고 백업을 마치세요.\n' >&2
  exit 1
fi

git pull --ff-only origin japan-pilot
git log -1 --oneline
test -f scripts/check-pilot-runtime.mjs
test -f .env.japan-pilot
node --version
npm --version
npm run check:pilot

npm ci --include=dev --include=optional --no-audit --no-fund
npm run test:pilot -- --maxWorkers=1 --minWorkers=1
npm run typecheck
npm run build:pilot
npm run preview:pilot
BASH
```

마지막 명령은 서버를 계속 실행하므로 터미널을 열어 둡니다. `Haru pilot: http://127.0.0.1:5188/pilot`과 실제 `Local data:` 경로가 나오면 [5절](#5-서버와-화면-확인)로 진행합니다. SSH에서 실행했다면 SSH 세션을 유지합니다.

`npm ci`는 Pi에서 직접 실행해야 합니다. Windows의 `node_modules`를 복사하면 ARM64용 의존성이 맞지 않을 수 있습니다. 테스트 워커 수는 Pi의 메모리 사용을 줄이기 위해 1로 제한했습니다. `test:pilot`은 임시 테스트 폴더를 사용하며 실증 데이터 폴더의 참가자 기록을 초기화하지 않습니다.

| 단계 | 성공 기준 |
| --- | --- |
| `check:pilot` | Node.js 24.x와 내장 SQLite가 정상이라는 메시지 |
| `npm ci` | 설치가 오류 없이 끝남. 개발·선택 의존성 포함 |
| `test:pilot` | 저장·문서·실증 UI 관련 테스트 실패 0개 |
| `typecheck` | TypeScript 오류 없이 종료 |
| `build:pilot` | Vite 빌드 성공, 루트 `dist/index.html` 생성 |
| `preview:pilot` | 포트 5188 서버와 실제 저장 폴더 표시 |

작성 시점 코드의 관련 테스트는 저장 8개·문서 1개·프론트엔드 75개, 총 84개입니다. 이후 테스트가 추가되면 숫자가 달라질 수 있으므로 **실패가 없는지** 확인합니다. 이 가이드는 저장소 전체 일일 루틴 테스트 통과를 요구하거나 대신 확인한 것으로 간주하지 않습니다.

## 3. 기존 Pi가 다른 브랜치·sparse clone을 사용 중인 경우

기존 7일 데모를 설치했다면 먼저 그 폴더에서 `git branch --show-current`를 확인합니다. `feat/haru-sound-feedback`, `_backup-20261016`, `main` 등이라면 그 브랜치에 `git pull origin japan-pilot`을 실행해 합치지 않습니다. 기존 폴더·브라우저 프로필·데이터를 남겨 두고 **새 폴더에 실증 브랜치를 clone**하는 방법을 권장합니다.

```bash
cd "$HOME"
git clone --branch japan-pilot --single-branch \
  https://github.com/hyunjun1121/saerok-memory.git haru-japan-pilot
cd "$HOME/haru-japan-pilot"
git branch --show-current
test -f package.json
test -f scripts/check-pilot-runtime.mjs
test -f src/features/pilot/pilotProtocol.ts
```

`haru-japan-pilot` 폴더가 이미 있으면 삭제하지 말고 그 폴더의 브랜치와 상태를 먼저 확인합니다. 다른 이름으로 새 clone을 만들었다면 2절의 `HARU_PILOT_REPO`도 그 경로로 맞춥니다. GitHub 인증이 필요하면 기존 Git 자격 증명 또는 SSH 키를 사용하며 토큰을 명령 URL이나 문서에 넣지 않습니다.

새 clone은 **빈 참가자 데이터로 시작**합니다. 이전 실증 데이터까지 이어서 쓰려면 기존 서버를 종료하고 저장 폴더 전체를 옮기는 [로컬 운영 가이드](japan-pilot-local-guide.md)의 이동 절차를 따릅니다. 브라우저 전송 대기는 원래 Pi의 동일 출처·프로필에서 먼저 처리합니다.

기존 7일 데모가 부팅마다 자동 실행된다면 해당 **기존 데모 폴더에서만** `bash scripts/autostart-pi.sh status`로 확인하고, 전환할 경우 `bash scripts/autostart-pi.sh disable`로 다음 부팅의 기존 자동 실행을 해제할 수 있습니다. 이 명령이 현재 실행 중인 창을 닫거나 새 실증판의 자동 실행을 설정하는 것은 아닙니다. 이번 가이드는 새 실증판을 수동으로 실행하는 절차입니다.

## 4. Pi 실행 환경 확인

대상 환경은 Raspberry Pi OS Desktop 64-bit와 ARM64 Node.js 24.x·npm 11 이상입니다. 기존 Pi 5 장비를 기준으로 준비하되, 이 문서를 작성한 개발 PC에서 실제 Pi 하드웨어를 검증한 것은 아닙니다. GUI 브라우저를 쓰므로 Desktop 환경을 준비합니다. Raspberry Pi 공식 kiosk 안내도 64-bit OS와 Chromium 실행 절차를 설명합니다. [공식 kiosk 안내](https://www.raspberrypi.com/tutorials/how-to-use-a-raspberry-pi-in-kiosk-mode/)

```bash
cat /etc/os-release
uname -m
getconf LONG_BIT
node --version
npm --version
free -h
df -h .
timedatectl status
TZ=Asia/Tokyo date '+%F %A %T %Z'
```

예상값은 `aarch64`/`arm64`, `64`, `v24.x`, npm `11` 이상입니다. Q1은 앱이 `Asia/Tokyo` 날짜를 계산하므로 OS 시간대가 달라도 동작하지만 **시스템 시각 자체가 틀리면 정답 요일도 틀립니다.** 시작 전 시각 동기화를 확인합니다.

Node 명령을 못 찾는 경우 기존 설치가 있다면 현재 터미널에서 다음을 먼저 실행합니다.

```bash
export PATH="/opt/haru/node-current/bin:$PATH"
node --version
npm --version
```

Node 24 ARM64가 없는 경우에는 문서 끝의 [부록](#부록-nodejs-24-arm64가-없는-pi)을 사용합니다. Chromium·Git·curl·일본어 글꼴 등이 없는 Desktop 장비는 필요한 패키지를 설치합니다.

```bash
sudo apt-get update
sudo apt-get install -y git curl ca-certificates chromium fonts-noto-cjk xz-utils libatomic1
```

`sudo npm ...`으로 앱을 설치·실행하지 않습니다. 참가자 녹음이 저장될 폴더는 Desktop 사용자가 쓸 수 있어야 합니다.

## 5. 서버와 화면 확인

서버 터미널은 그대로 두고, **Pi에서 새 터미널**을 열어 확인합니다.

```bash
curl --fail --silent --show-error http://127.0.0.1:5188/api/pilot-local/health
ss -ltnp 'sport = :5188'
```

건강 확인 JSON에 `ready: true`와 의도한 `dataDirectory`가 나와야 합니다. 화면만 열리고 건강 확인이 실패하면 수집 서버가 준비된 것이 아닙니다. `npm run dev`, 일반 `npm run preview`, `dist/index.html` 직접 열기는 실증 저장 서버 실행을 대신하지 않습니다.

Pi Desktop의 Chromium 주소창에 **`http://127.0.0.1:5188/pilot`**을 입력합니다. Pi의 Desktop 터미널에서는 다음으로 열 수도 있습니다.

```bash
chromium 'http://127.0.0.1:5188/pilot'
```

브라우저 실행 파일 이름이 `chromium-browser`인 OS에서는 그 이름을 사용합니다. 먼저 일반 창에서 마이크 권한·장치를 확인한 뒤 `F11`로 전체 화면을 사용합니다. SSH로 설치했더라도 브라우저는 Pi의 실제 Desktop에서 열어야 Pi에 연결한 마이크와 버튼을 테스트할 수 있습니다.

노트북에서 같은 주소를 열면 노트북 자신의 서버를 찾습니다. 이번 서버는 Pi의 loopback에만 열리며, `http://Pi의-IP:5188`로 바꾸는 방식은 이 가이드의 실행 방법이 아닙니다. 마이크 API는 보안 문맥과 권한이 필요하며 `http://127.0.0.1`·`http://localhost`는 로컬 보안 문맥으로 취급됩니다. [MDN 보안 문맥](https://developer.mozilla.org/en-US/docs/Web/Security/Defenses/Secure_Contexts)

처음에는 `担当者の準備` 화면에 참가자 1~6 버튼·번호 입력란·동의 항목·실제 저장 위치가 보여야 합니다. 7일 선택 화면이나 NFC 카드 대기가 뜨면 기존 Pi 데모를 연 것입니다. 주소와 실행 폴더를 확인합니다.

항상 같은 `127.0.0.1:5188`, 같은 브라우저 프로필을 사용합니다. `localhost`로 바꾸거나 시크릿 창·임시 프로필로 매번 열면 IndexedDB의 미전송 자료가 서로 구분됩니다.

## 6. 실제 마이크·물리 버튼 테스트: 참가자 999

테스트 번호 999는 실제 참가자에게 배정하지 않습니다. 마이크·스피커·USB 버튼을 연결하고 다음을 수행합니다. 자동 테스트의 합성 녹음은 이 현장 테스트를 대신하지 않습니다.

| 순서 | 수행할 일 | 확인할 결과 |
| --- | --- | --- |
| 1 | 999 입력, 녹음·저장 동의 확인, 시작 | 새 회차와 소개 화면. 개인화 동의는 별도 선택 |
| 2 | Q1의 오늘 요일 확인 | 일본 날짜의 정답 포함, 중복 없는 보기 4개. 진행률 `1 / 9` |
| 3 | Q2에서 다른 보기로 바꾼 뒤 확정 | 선택 변경이 가능하고 다음 문항으로 이동 |
| 4 | Q3·Q4 진행 | 도착 시각과 도착 순서 문제. Q4 뒤 Q5 고향 질문 |
| 5 | Q5에서 실제 목소리로 말하고 저장·미리 듣기 | 실제 발화가 들리고 음성이 비어 있지 않음 |
| 6 | 한 음성 문항에서 다시 녹음 | 새 녹음이 저장되고 내보내기에 이전 원본도 남음 |
| 7 | 본질문 저장 후 `次へ` | 후속 질문을 강제하지 않고 다음 문항으로 이동 |
| 8 | 다른 문항에서 `追加で聞く（担当者）` 선택 | 정해진 후속 질문이 한 번 열림. 짧은 답변일 때만 진행자가 사용 |
| 9 | 후속 질문을 건너뛰는 흐름도 확인 | 본질문 녹음은 보존되고 건너뛴 사유를 기록 |
| 10 | Q9까지 완료, 현재 회차 ZIP 내보내기 | 완료 표시와 ZIP 다운로드. ZIP의 실제 음성 재생 |
| 11 | 다음 참가자 준비 후 999로 다시 시작 | 새 회차·새 UUID로 Q1부터 시작, 이전 완료 회차 보존 |
| 12 | 두 번째 테스트 회차는 진행자 중단 후 전체 ZIP 내보내기 | 완료 회차와 중단 회차가 별도로 남음 |

Q2의 정답은 480엔(B), Q3은 오전 10시 20분(C), Q4는 스즈키(C)입니다. 테스트 진행자 확인용이며 실제 참여자에게 정답을 미리 안내하지 않습니다. Q1의 정답 버튼 위치는 회차마다 달라질 수 있습니다.

2×2 버튼은 왼쪽 위 `1/A/빨강`, 오른쪽 위 `2/B/노랑`, 왼쪽 아래 `3/C/초록`, 오른쪽 아래 `4/D/파랑`입니다. 선택형은 한 번 선택 후 같은 버튼을 다시 눌러 확정합니다. 음성은 오른쪽 `2/4`로 시작·정지·저장 후 다음 이동, 왼쪽 `1/3`으로 다시 듣기·재녹음합니다. 버튼은 숫자 1~4의 누름·뗌을 보내야 하며, 브라우저 창에 포커스가 있어야 합니다. 참가자 번호 입력란에 커서가 있으면 숫자가 입력되는 것이 정상입니다.

이 웹앱은 GPIO를 직접 읽지 않습니다. 기존 키보드형 USB 버튼을 사용합니다. 후속 질문 선택과 건너뛰기 등 진행자 조작을 위해 마우스·터치 장치도 준비합니다. 새 실증판에는 기존 Pi 데모의 NFC 로그인 흐름을 적용하지 않았습니다.

음성은 문항당 45~90초가 목표이고 녹음 한 번의 상한은 3분입니다. 이 범위를 확인하려고 불필요하게 3분씩 녹음할 필요는 없습니다. 불편하거나 기억나지 않는 문항은 건너뛸 수 있으며 가족 질문에 답변을 재촉하지 않습니다.

## 7. 저장 결과 확인

서버가 표시한 저장 폴더 아래에 다음이 생깁니다.

```text
local-data/japan-pilot/
  pilot.sqlite
  participants/999/
    attempt-001-<UUID>/session.json
    attempt-001-<UUID>/audio/...
    attempt-002-<다른 UUID>/session.json
```

회차 번호는 이전 테스트 횟수에 따라 001보다 클 수 있습니다. 미완료 녹음 조각은 `chunks/`에 남을 수 있습니다. SQLite·WAL/SHM·음성 파일은 운영자가 직접 수정하지 않습니다.

ZIP의 `sessions.json`에서 회차의 `protocolVersion: jp-first-meeting-2.0`, 실제 9문항의 `protocolSnapshot`, 동의, 선택 응답, 원본 음성 경로를 확인합니다. Q1에는 실제 일본 날짜·요일·보기·정답이, 후속 질문에는 사용 여부·사유가 남습니다. 재녹음까지 포함한 파일 수는 후속 질문 사용과 재시도에 따라 달라집니다.

ZIP에는 `attempts.csv`, `questions.csv`, `events.csv`도 포함됩니다. 두 회차의 UUID가 다르고 첫 회차의 답변과 음성이 남는지 확인합니다. 여러 버전·Q1 보기 배열이 섞이면 최상위 `questions` 대신 **각 회차의 `protocolSnapshot`과 `administeredQuestions`**를 읽습니다.

테스트 자료를 삭제할 필요가 있으면 앱에서 선택한 테스트 회차만 명시적으로 삭제합니다. 실제 참가자 기록·DB 전체·브라우저 저장소를 초기화하는 방법으로 테스트하지 않습니다. 내보낸 ZIP은 별도 보관 자료이며 앱의 회차 삭제로 지워지지 않습니다.

## 8. 종료·백업·재실행

녹음과 저장을 끝내고 ZIP을 내보낸 뒤 서버 터미널의 `Ctrl+C`로 종료합니다. 전체 백업은 **서버 종료 후** 진행합니다. 아래 블록의 프로젝트 경로와 별도 저장 경로를 실제 값에 맞춥니다.

```bash
bash <<'BASH'
set -euo pipefail
HARU_PILOT_REPO="${HARU_PILOT_REPO:-$HOME/haru-japan-pilot}"
HARU_PILOT_DATA_DIR="${HARU_PILOT_DATA_DIR:-$HARU_PILOT_REPO/local-data/japan-pilot}"
test -f "$HARU_PILOT_DATA_DIR/pilot.sqlite"
if curl --fail --silent --max-time 2 http://127.0.0.1:5188/api/pilot-local/health >/dev/null; then
  printf '먼저 수집 서버를 종료하세요.\n' >&2
  exit 1
fi
mkdir -p "$HOME/haru-pilot-backups"
HARU_BACKUP_FILE="$(mktemp "$HOME/haru-pilot-backups/japan-pilot-$(date +%Y%m%d-%H%M%S)-XXXXXX.tar.gz")"
tar -czf "$HARU_BACKUP_FILE" -C "$HARU_PILOT_DATA_DIR" .
printf '백업: %s\n' "$HARU_BACKUP_FILE"
BASH
```

이는 DB·WAL/SHM·참가자 파일을 함께 보관하는 전체 폴더 백업입니다. USB나 별도 저장장치에도 옮겨 보관합니다. 진행 중에는 화면의 ZIP 내보내기를 사용합니다. Git pull/clone으로 참가자 데이터가 전송되거나 여러 Pi의 기록이 합쳐지지 않습니다.

업데이트가 없는 다음 실행은 같은 Node·저장 경로 환경에서 루트의 **`npm run preview:pilot`**만 실행하면 됩니다. 새 코드를 pull했다면 **`npm run build:pilot` 후** 실행해야 합니다. 한 저장 폴더에는 수집 서버 하나만 연결합니다.

## 9. 자주 막히는 지점

| 증상 | 확인·조치 |
| --- | --- |
| `scripts/check-pilot-runtime.mjs`가 없음 | 루트·브랜치·sparse clone 범위 확인. 3절의 새 clone 절차 사용 |
| Git이 변경·분기 때문에 중단 | 현재 코드를 보존하고 원인 확인. 강제 reset·merge로 진행하지 않음 |
| Node 22/25 등·SQLite 오류 | Node 24 ARM64와 PATH 확인. `npm run check:pilot` 성공 후 계속 |
| `@rollup/rollup-linux-arm64-gnu` 등 모듈 오류 | Pi에서 `npm ci --include=dev --include=optional` 재실행. Windows `node_modules` 재사용 금지 |
| 테스트·빌드가 `Killed`·메모리 오류로 종료 | `free -h` 확인, 사용하지 않는 앱을 닫고 한 단계씩 실행. 테스트는 워커 1개로 유지. 실패 상태로 실증 시작하지 않음 |
| 빌드는 됐는데 12문항·7일 화면이 보임 | 실행 폴더·브랜치·5188 `/pilot` 주소 확인. 수집을 마친 뒤 최신 빌드와 브라우저 새로고침 적용 |
| 포트 5188 사용 중 | `ss -ltnp 'sport = :5188'`로 해당 서버 확인. 기존 서버를 정상 종료하며 다른 프로세스를 일괄 종료하지 않음 |
| 마이크가 안 되거나 무음 | Chromium 사이트 마이크 권한, OS 기본 입력, USB 마이크 연결 확인. 미리 듣기와 ZIP 파일 양쪽에서 확인 |
| 버튼이 안 되거나 두 번 눌림 | 창 포커스·숫자 1~4·누름/뗌 신호 확인. 길게 누르거나 입력란에 포커스가 남아 있지 않은지 확인 |
| 저장 실패·디스크 부족 | 서버 터미널·실제 저장 경로·쓰기 권한·`df -h` 확인. 녹음을 먼저 보존하고 같은 주소에서 재시도 |
| SSH를 끊었더니 화면·저장이 안 됨 | 서버 프로세스가 종료됐는지 확인. 실증 중에는 실행 터미널을 유지 |
| 일본어가 네모로 표시됨 | 일본어 글꼴 설치 후 Chromium 재실행 |
| TTS·STT·RAG가 안 켜짐 | 새 TTS는 추후 작업이고 현재 실증에는 STT/RAG 서버 실행이 필요 없음. 일본어 읽어주기가 없으면 진행자가 질문을 읽음 |

설치·업데이트에는 인터넷이 필요합니다. 수집 API는 외부 서비스를 요구하지 않지만 글꼴 CDN·브라우저 읽어주기 환경에는 네트워크가 필요할 수 있습니다. 오프라인 현장이라면 설치 후 인터넷을 끊은 상태에서 999번 진행·녹음·ZIP까지 확인합니다.

## 10. 검증 범위와 함께 볼 문서

이 문서는 저장소의 실제 실행 스크립트·Node 요구 조건·9문항 정의에 맞춰 작성했습니다. 2026-10-27 Windows 개발 PC의 Node 24.20.0에서 위 단일 워커 테스트 명령으로 84개가 통과했습니다. Bash 코드 블록 10개의 `bash -n` 구문 검사와 내부 문서 링크·npm 스크립트 이름도 확인했습니다. **실제 ARM64 Raspberry Pi의 설치·빌드·장치 테스트 완료를 뜻하지 않습니다.** Pi에서 위 자동 검사와 999번 실제 녹음 확인을 통과한 뒤 실증을 시작합니다.

- [전체 로컬 운영·데이터 이동 가이드](japan-pilot-local-guide.md)
- [일본어 한 줄·한국어 한 줄 확정 문항](japan-first-meeting-pilot-ja-ko.md)
- [9문항 버전 개발 PC 검증 기록](japan-pilot-v2-verification.md)
- [TTS 제작 계획 — 추후 작업](japan-pilot-tts-plan-ja-ko.md)

## 부록: Node.js 24 ARM64가 없는 Pi

기존 `/opt/haru/node-current`가 Node 24를 제공하면 이 부록을 생략합니다. 아래는 Node 공식 배포의 **v24.22.1 Linux ARM64**를 사용자 폴더에 설치하는 예시입니다. 공식 배포는 ARM64 archive와 체크섬 목록을 제공합니다. [Node.js 24 공식 배포](https://nodejs.org/dist/latest-v24.x/)

4절의 기본 패키지를 먼저 설치한 다음, ARM64·64-bit Pi에서 실행합니다. 다운로드한 archive는 같은 공식 버전의 SHA-256 목록으로 확인합니다.

```bash
bash <<'BASH'
set -euo pipefail
[[ "$(uname -m)" == aarch64 || "$(uname -m)" == arm64 ]]
[[ "$(getconf LONG_BIT)" == 64 ]]
HARU_NODE_VERSION=24.22.1
HARU_NODE_FOLDER="node-v${HARU_NODE_VERSION}-linux-arm64"
HARU_NODE_ARCHIVE="$HARU_NODE_FOLDER.tar.xz"
HARU_NODE_URL="https://nodejs.org/dist/v$HARU_NODE_VERSION"
HARU_NODE_DOWNLOAD="$(mktemp -d)"
cd "$HARU_NODE_DOWNLOAD"
curl --fail --location --output SHASUMS256.txt "$HARU_NODE_URL/SHASUMS256.txt"
curl --fail --location --output "$HARU_NODE_ARCHIVE" "$HARU_NODE_URL/$HARU_NODE_ARCHIVE"
awk -v file="$HARU_NODE_ARCHIVE" '$2 == file { print }' SHASUMS256.txt > selected.sha256
test -s selected.sha256
sha256sum --check selected.sha256
mkdir -p "$HOME/.local/share/haru-node"
tar -xJf "$HARU_NODE_ARCHIVE" -C "$HOME/.local/share/haru-node"
printf '설치 완료. 다음 PATH 명령을 현재 터미널에서 실행하세요.\n'
BASH

export PATH="$HOME/.local/share/haru-node/node-v24.22.1-linux-arm64/bin:$PATH"
node --version
npm --version
```

새 터미널에서도 이 PATH가 필요합니다. npm 11 이상인지 확인한 후 2절을 진행합니다. OS 기본 `node`를 삭제하거나 시스템 링크를 강제로 바꾸지 않습니다.
