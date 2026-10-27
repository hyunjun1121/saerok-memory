# Raspberry Pi SSH 원격 접속 및 무암호 자동 로그인 설정 가이드

본 문서는 Windows 개발 PC에서 Haru 오프라인 데모가 구동되는 Raspberry Pi 5(호스트명: `Ogasa`)로 SSH 원격 접속 및 디버깅을 원활하게 수행하기 위한 설정 가이드입니다.

---

## 1. 접속 기본 정보

- **대상 기기**: Raspberry Pi 5 (`Ogasa`)
- **사용자명(User)**: `dekapan`
- **SSH 기본 포트**: `22`
- **인증 방식**: SSH Key 기반 무암호(Passwordless) 로그인 (초기 비밀번호는 별도로 안전하게 보관)

---

## 2. 네트워크 환경 및 IP 확인

SSH 접속을 위해서는 **Windows PC와 Raspberry Pi가 통신 가능한 동일 네트워크(동일 서브넷)**에 있거나 라우팅이 가능해야 합니다.

### Raspberry Pi에서 현재 IP 확인 (모니터/콘솔 직접 입력)
```bash
# 할당된 IPv4 주소 확인
hostname -I

# SSH 서비스 동작 상태 확인
sudo systemctl status ssh
```

> [!IMPORTANT]
> - 현재 Windows PC의 IP 대역은 `192.168.35.x` (게이트웨이 `192.168.35.1`)입니다.
> - 만약 Raspberry Pi가 `192.168.1.154` 등 다른 서브넷에 연결되어 있다면, 상위 공유기(KT 등)와 하위 공유기(ipTIME 등)의 차이로 인해 직접 접속이 되지 않을 수 있습니다.
> - 두 장치를 **동일한 공유기(동일 Wi-Fi 또는 동일 유선 허브)**에 연결하거나, 라즈베리 파이에서 `hostname -I`로 확인된 실제 IP로 접속해야 합니다.

---

## 3. Windows PC 설정 (OpenSSH Client)

### 3.1 OpenSSH 설치 여부 확인 (PowerShell)
```powershell
ssh -V
# 출력 예: OpenSSH_for_Windows_9.5p2, LibreSSL 3.8.2 (정상)
```

### 3.2 포트 접근 테스트
```powershell
Test-NetConnection <Raspberry-Pi-IP> -Port 22
# TcpTestSucceeded : True 가 나와야 연결 가능
```

---

## 4. 비밀번호 없는 자동 로그인(SSH Key 기반) 설정

Windows PC의 SSH 공개키(`id_ed25519.pub`)를 Raspberry Pi의 `~/.ssh/authorized_keys`에 등록하면, 매번 비밀번호를 입력하지 않고 즉시 안전하게 접속할 수 있습니다.

### 4.1 Windows에서 라즈베리 파이로 공개키 전송 및 등록 (PowerShell)
```powershell
# Windows 공개키 내용 읽어서 라즈베리파이 authorized_keys에 추가
type $HOME\.ssh\id_ed25519.pub | ssh dekapan@<Raspberry-Pi-IP> "mkdir -p ~/.ssh && chmod 700 ~/.ssh && cat >> ~/.ssh/authorized_keys && chmod 600 ~/.ssh/authorized_keys"
```
*(최초 1회만 라즈베리 파이 비밀번호를 직접 입력)*

### 4.2 Windows SSH Config 단축 별칭 설정 (`~/.ssh/config`)
`C:\Users\<사용자명>\.ssh\config` 파일에 아래 내용을 추가하면, 복잡한 IP 입력 없이 `ssh ogasa` 명령 하나로 접속할 수 있습니다:

```sshconfig
Host ogasa
    HostName <Raspberry-Pi-IP>
    User dekapan
    Port 22
    IdentityFile ~/.ssh/id_ed25519
    ServerAliveInterval 60
    ServerAliveCountMax 3
```

---

## 5. 일상 디버깅 명령어 모음

### 5.1 원격 접속
```powershell
# 단축 별칭 사용 시
ssh ogasa

# 직접 지정 시
ssh dekapan@<Raspberry-Pi-IP>
```

### 5.2 주요 상태 점검 명령어 (Pi 터미널 내부)
```bash
# 기본 접속 확인
whoami      # 결과: dekapan
hostname    # 결과: Ogasa
pwd         # 결과: /home/dekapan

# Haru 데모 프로세스 및 Chromium 상태 확인
systemctl --user status haru-kiosk.service  # 서비스 등록 시
ps aux | grep -E "chromium|node"

# 시스템 자원 모니터링
htop
vcgencmd measure_temp   # Pi 5 CPU 온도 확인
free -h                 # 메모리 사용량 확인
df -h                   # 디스크 용량 확인
```

### 5.3 소스 코드 동기화 및 원격 디버깅
```powershell
# Windows에서 빌드 결과물 또는 스크립트 전송 (SCP)
scp -r ./dist dekapan@<Raspberry-Pi-IP>:/home/dekapan/haru/
```
