# Haru 로컬 손실 복구 및 최종 재검증 실행 계획

작성 기준: 2026-06-02  
작업 루트: `C:\project\saerok-memory`  
목표: 로컬 폴더 손실 이후 현재 복구 상태를 기준으로 누락·손상·미검증 항목을 체계적으로 복구하고, Haru 앱·연구자료·보고서·배포 상태를 다시 신뢰 가능한 최종 상태로 만든다.

## 1. 범위 고정

상태: Done

이번 계획은 기존 지원서 작성용 계획을 폐기하고, 저장소 전체의 복구·재검증·재생성 작업을 지휘하는 새 마스터 계획이다.

- 삭제 대상: 기존 `피우다프로젝트/plan.md`
- 새 기준 파일: 루트 `plan.md`
- 이 계획을 기준으로 이후 모든 복구 작업을 진행한다.
- Git에 커밋된 파일, 로컬 복구본, manifest, 스크린샷, 보고서, Vercel 배포 상태를 각각 별도 근거로 확인한다.
- 추측으로 “복구 완료”라고 판단하지 않는다. 각 작업은 파일 존재, 해시, 명령 결과, 렌더링 결과, 배포 URL 확인 같은 증거가 있어야 Done으로 변경한다.

## 2. 초기 감사에서 확인된 사실

상태: Done: initial audit completed, current worktree now contains recovery changes

아래 표는 복구 작업을 시작하기 전에 실제 확인한 명령 및 결과이다. 이후 복구·재구현·문서 재생성 작업으로 현재 작업트리는 더 이상 clean 상태가 아니다.

| 항목 | 확인 결과 | 의미 |
|---|---:|---|
| `git status --short` | 출력 없음 | tracked 작업트리는 현재 clean |
| `git status -sb` | `## main...origin/main` | 현재 브랜치는 원격 `main`과 차이 없음 |
| `git ls-files -d` | 출력 없음 | Git 기준 삭제된 tracked 파일 없음 |
| `git fsck --full --no-reflogs` | 오류 출력 없음 | Git 객체 저장소 손상 징후 없음 |
| 현재 HEAD | `e680227 copy(haru): remove defensive medical disclaimers` | 복구된 커밋 기준점 |
| `node_modules` | 없음 | 의존성 재설치 필요 |
| `dist` | 없음 | 빌드 산출물 재생성 필요 |
| `.vercel` | 없음 | Vercel 프로젝트 재연결 또는 재배포 설정 확인 필요 |
| `피우다프로젝트/application_assets/final_qa` | ko/ja/en 각 23장, 총 69장 | 최종 QA 스크린샷 세트는 존재 |
| `cognitve-reference/metadata/current_file_inventory.csv` | 2,023개 과거 파일 기록 존재 | 손실 대조 기준 존재 |
| `cognitve-reference` 실제 대조 | 18개 존재, 2,005개 누락, 10개 해시 불일치 | 연구 원본 아카이브 대부분 손실 |
| `download_manifest.csv` | 106행 존재 | 재다운로드·재클론 복구 기준 존재 |
| manifest 대조 | 14개 존재, 72개 로컬 경로 누락 | 우선 복구 대상 명확 |

샘플 무결성 확인:

| 파일 | 검사 | 결과 |
|---|---|---|
| `package.json` | JSON 파싱 | 정상 |
| `README.md` | UTF-8 읽기 | 정상 |
| `AGENTS.md` | UTF-8 읽기 | 정상 |
| `피우다프로젝트/final/Haru_연구근거_구현신빙성_보고서.md` | UTF-8 읽기 | 정상 |
| `피우다프로젝트/final/final_validation_log.md` | UTF-8 읽기 | 정상 |
| `피우다프로젝트/2026_글로벌_피우다프로젝트_지원신청서_Haru.docx` | ZIP 구조 열기 | 정상 |
| `피우다프로젝트/2026_글로벌_피우다프로젝트_신청서_양식변환.hwpx` | ZIP 구조 열기 | 정상 |
| `피우다프로젝트/application_assets/final_qa/ko/01_home.png` | PNG 시그니처 | 정상 |
| `피우다프로젝트/application_assets/final_qa/ja/21_report-counselor.png` | PNG 시그니처 | 정상 |
| `피우다프로젝트/시현영상.mp4` | MP4 `ftyp` 헤더 | 정상 |

## 3. 초기 손실 항목과 현재 처리 상태

상태: Done: key recoverable losses handled, deployment link still pending

초기 파일시스템에서 확인되지 않았던 중요 항목과 현재 처리 상태:

| 항목 | 초기 상태 | 현재 처리 |
|---|---|---|
| `src/features/family/haruAdvisory.ts` | 없음 | 재구현 완료 |
| `src/features/family/haruAdvisory.test.ts` | 없음 | 재작성 완료, 3개 테스트 통과 |
| `피우다프로젝트/final/build_reports_from_md.py` | 없음 | 재작성 완료 |
| `피우다프로젝트/final/Haru_종합_연구근거_구현보고서.docx` | 없음 | 재생성 완료 |
| `피우다프로젝트/final/Haru_종합_연구근거_구현보고서.pdf` | 없음 | 재생성 및 렌더링 QA 완료 |
| `피우다프로젝트/final/Haru_큰틀_종합보고서.docx` | 없음 | 재생성 완료 |
| `피우다프로젝트/final/Haru_큰틀_종합보고서.pdf` | 없음 | 재생성 및 렌더링 QA 완료 |
| `prompt.txt` | 없음 | 이번 복구 작업에는 불필요, 필요 시 별도 작성 |
| `cognitve-reference/papers/` | 없음 | manifest 기준 복구 완료 |
| `cognitve-reference/data/` | 없음 | manifest 기준 복구 완료 |
| `cognitve-reference/code/` | 없음 | manifest 기준 복구 완료 |
| `cognitve-reference/web-pages/` | 없음 | manifest 기준 복구 완료 |
| `cognitve-reference/official-tools/` | 없음 | manifest 기준 복구 완료 |
| `.vercel/` | 없음 | 아직 미복구. Vercel 재연결 필요 |
| `node_modules/` | 없음 | `npm ci` 완료 |

## 4. 복구 원칙

상태: Active

- 복구 전 현재 상태를 기록하고, 필요하면 별도 백업을 만든다.
- Git에 없는 대용량 연구자료는 무조건 커밋하지 않는다. 단, manifest와 복구 로그는 커밋 가능 대상으로 검토한다.
- 공식 인지검사 문항, 양식, 채점표, cutoff는 앱에 복제하지 않는다.
- Haru는 자체 반복 루틴과 보호자 관찰 기반의 설명 가능한 참고 신호를 제공할 수 있다.
- 사용자 UI에서 과도하게 방어적인 문구는 피하되, 진단·치료·예방·공식검사 주장도 하지 않는다.
- 손상 가능성 있는 바이너리 파일은 ZIP 구조, 확장자 시그니처, PDF/DOCX 렌더링 등 실제 열람 가능한 방식으로 검증한다.
- 완료 판정은 “존재함”만으로 하지 않는다. 읽기 가능, 실행 가능, 렌더링 가능, 테스트 통과 여부까지 확인한다.

## 5. 의존성 그래프

상태: Done: dependency map executed except Vercel/Git finalization

```text
현재 상태 백업
  -> Git/파일 인벤토리 감사
    -> 의존성 재설치
      -> 앱 타입/린트/테스트/빌드 검증
        -> 스크린샷 재캡처
          -> 보고서 이미지 경로 검증

cognitve-reference manifest 확인
  -> 누락 연구자료 재다운로드/재클론
    -> 해시/파일 수 재검증
      -> 연구근거 문서 갱신
        -> 최종 보고서 DOCX/PDF 재생성

소스 누락 확인
  -> Haru advisory 필요성 판단
    -> advisory 엔진·테스트 재구현
      -> i18n·가족/상담사 화면 반영
        -> 앱 검증
          -> 문서 갱신

앱 검증 완료
  -> Vercel link 확인
    -> 프로덕션 배포
      -> 배포 URL 브라우저 검증
```

병렬 가능:

- 연구자료 manifest 대조와 앱 의존성 재설치는 병렬 가능
- 문서 누락 목록 작성과 앱 소스 누락 검색은 병렬 가능
- 스크린샷 무결성 확인과 보고서 소스 점검은 병렬 가능

순차 필요:

- `npm ci` 전에는 앱 테스트 불가
- 앱 빌드 전에는 최신 화면 캡처 불가
- 연구자료 복구 전에는 연구근거 보고서 최종 검증 불가
- DOCX/PDF 보고서 생성 전에는 렌더링 QA 불가
- Vercel 배포 전에는 로컬 빌드 통과 필요

## 6. 단계별 실행 계획

### Phase 0. 현재 복구본 보존

상태: Done

진입 조건:

- 현재 작업트리 위치가 `C:\project\saerok-memory`인지 확인
- Git 상태가 확인되어 있어야 함

작업:

- 현재 복구본을 별도 위치 또는 압축 파일로 백업
- 백업 대상: Git-tracked 파일, `피우다프로젝트/application_assets/final_qa`, `cognitve-reference/metadata`
- 백업 로그 생성

완료 기준:

- 백업 파일 또는 백업 폴더 경로 기록
- 백업 크기와 생성 시간 기록

완료 근거:

- 백업 파일: `C:\project\saerok-memory_recovered_snapshot_20260602_145646.zip`
- 크기: 71,054,450 bytes
- 생성 시간: 2026-06-02 14:56:54
- 제외 대상: `.git`, `node_modules`, `dist`

차단 가능성:

- 디스크 용량 부족
- 백업 대상 파일 접근 권한 문제

### Phase 1. Git 및 파일 손실 감사

상태: Done

진입 조건:

- 복구본이 보존되어야 함

작업:

- `git status -sb`
- `git fsck --full --no-reflogs`
- `git ls-files -d`
- `rg --files`로 핵심 누락 파일 검색
- `cognitve-reference/metadata/current_file_inventory.csv`와 실제 파일 대조
- `download_manifest.csv`와 실제 파일 대조
- 손상 의심 파일 샘플 열람

완료 기준:

- 누락 파일 목록 생성
- 해시 불일치 목록 생성
- 재다운로드 대상 목록 생성

현재 근거:

- 초기 감사는 완료됨
- `cognitve-reference` 2,005개 누락 확인
- manifest 기준 72개 로컬 경로 누락 확인

완료 근거:

- 감사 폴더: `C:\project\saerok-memory\recovery_audit`
- inventory 누락 CSV: `recovery_audit/cognitve_reference_missing_from_inventory_20260602_145627.csv`
- inventory 해시 불일치 CSV: `recovery_audit/cognitve_reference_hash_mismatch_20260602_145627.csv`
- manifest 로컬 경로 누락 CSV: `recovery_audit/download_manifest_missing_local_paths_20260602_145627.csv`
- 요약 로그: `recovery_audit/recovery_audit_summary_20260602_145627.md`

### Phase 2. 실행환경 복구

상태: Done

진입 조건:

- Git 본체가 정상이어야 함
- `package-lock.json`이 존재해야 함

작업:

- `npm ci`
- 필요 시 `npx playwright install chromium`
- `npm run typecheck`
- `npm run lint`
- `npm run test`
- `npm run build`

완료 기준:

- 모든 명령 결과를 로그로 기록
- 실패 시 정확한 에러와 원인 후보 기록

완료 근거:

- `npm ci`: 성공. 333 packages added, 334 packages audited. npm audit에서 critical severity vulnerability 1건 보고됨. breaking change 가능성 때문에 `npm audit fix --force`는 실행하지 않음.
- `npm run typecheck`: PASS
- `npm run lint`: PASS
- 최초 `npm run test`: PASS, 25 test files / 76 tests
- Haru advisory 재구현 후 최종 `npm run test`: PASS, 26 test files / 79 tests
- 최종 `npm run build`: PASS, Vite production build 성공, `dist/` 재생성

주의:

- 초기 실행환경 복구 직후에는 25 files / 76 tests였고, 이는 advisory 손실 판단의 근거였다.
- advisory 재구현 후 최종 검증 수는 26 files / 79 tests로 회복됐다.

차단 가능성:

- npm registry 네트워크 문제
- Node 버전 불일치
- Playwright 브라우저 미설치

### Phase 3. Haru 앱 기능 복구 및 개선

상태: Done

진입 조건:

- 앱 테스트·빌드가 가능한 실행환경이어야 함

작업:

- 현재 `src/features/family`와 `/family` 화면 구현 범위 확인
- Haru advisory 엔진이 현재 코드에 없는지 재확인
- 필요한 경우 다음 기능 재구현:
  - 반복 루틴 결과, 기억 카드, 보호자 관찰을 결합한 Haru 자체 참고 신호
  - `steady`, `watch`, `needsConversation` 같은 자체 advisory level
  - 참여도, 기억, 주의, 언어, 시공간, 일상 흐름, 보호자 관찰 도메인 요약
  - 보호자/상담사 화면에 신호 근거와 다음 대화 제안 표시
  - `sleepAppetite`, `homeSafety` 등 보호자 관찰 도메인 확장
  - ko/en/ja i18n 반영
- focused test 추가

완료 기준:

- 구현 파일 존재
- 테스트 파일 존재
- UI에 raw i18n key 노출 없음
- private memory는 `shareWithFamily === true`일 때만 노출
- 공식 검사명·공식 점수·진단 표현 없음
- `npm run test`, `npm run build` 통과

완료 근거:

- 추가 파일: `src/features/family/haruAdvisory.ts`
- 추가 테스트: `src/features/family/haruAdvisory.test.ts`
- `CaregiverObservationDomain`을 8개 영역으로 확장: `sleepAppetite`, `homeSafety` 추가
- `/family` 보호자 탭에 Haru 종합 주의 신호 요약 추가
- `/family` 상담사 탭에 Haru advisory level, data completeness, 영역별 요약, 참고 신호, 다음 대화 액션 추가
- `/` 홈 화면에 Haru advisory 안내 카드 추가
- ko/en/ja i18n 키 추가
- 관련 테스트: `haruAdvisory`, `caregiverObservationStorage`, `caregiverReport`, `FamilyScreen` 18개 통과
- 전체 테스트: 26개 파일 / 79개 통과
- 빌드: PASS

차단 가능성:

- 이전 미커밋 코드 복구 불가
- 요구 기능 범위가 현재 제품 방향과 충돌

### Phase 4. 연구자료 아카이브 복구

상태: Done

진입 조건:

- `cognitve-reference/metadata/download_manifest.csv`가 읽기 가능해야 함
- 네트워크 사용 가능해야 함

작업:

- manifest의 `downloaded_pdf`, `downloaded_data`, `saved_html`, `saved_challenge_html`, `cloned`, `downloaded_metadata` 항목을 우선 복구
- 누락 경로의 상위 폴더 생성
- PDF와 데이터는 원본 URL에서 재다운로드
- GitHub 참고 코드는 재클론 또는 archive download
- 저장 웹페이지는 가능한 경우 HTML 재저장
- 다운로드 실패 항목은 실패 사유와 접근일 기록
- 복구 후 SHA-256 계산
- 새 `current_file_inventory.csv` 생성

완료 기준:

- manifest 기준 복구 성공/실패 표 작성
- 누락 파일 수와 실패 사유 기록
- PDF, CSV, HTML, Git repo 샘플 열람 검증

완료 근거:

- 복구 스크립트: `recovery_audit/restore_cognitve_reference.ps1`
- 1차 복구 로그: `recovery_audit/cognitve_reference_restore_20260602_150025.csv`
- 1차 결과: ok=41, ok_hash_changed=29, not_downloaded=20, exists_hash_mismatch=8, exists=7, error=1
- 오류 항목: `wps_stroop.html`이 기본 요청에서 HTTP 403 반환
- 재시도 결과: browser-like headers로 `wps_stroop.html` 다운로드 성공, 290,508 bytes, SHA-256 `46DB005FAB0937938005C6DA30EAAE3A69DADF80F3E0A62C32342D9F77484CA9`
- 최종 manifest 로컬 경로 누락: 0
- 복구 후 top-level 파일 수:
  - `code`: 1,947
  - `data`: 14
  - `metadata`: 17
  - `official-tools`: 6
  - `papers`: 8
  - `web-pages`: 30
  - `README.md`: 1
  - `agents.md`: 1
- 현재 인벤토리 갱신: `cognitve-reference/metadata/current_file_inventory.csv`
- 감사용 인벤토리 복사본: `recovery_audit/cognitve_reference_inventory_after_restore_20260602_151404.csv`
- 복구 요약: `recovery_audit/cognitve_reference_restore_summary_20260602_151404.md`

주의:

- 원격 웹페이지와 API 출력은 재다운로드 시점에 따라 과거 manifest 해시와 달라질 수 있다.
- `not_downloaded`로 기록된 20개 항목은 manifest상 원래 다운로드 대상이 아니므로 누락으로 보지 않는다.

차단 가능성:

- 원본 URL 만료
- 접근 제한 또는 challenge page
- GitHub repo 삭제
- 대용량 다운로드 시간 초과

### Phase 5. 스크린샷 및 시각 자료 검증

상태: Done

진입 조건:

- 앱 빌드 또는 dev server 실행 가능
- Playwright 사용 가능

작업:

- 기존 `피우다프로젝트/application_assets/final_qa` 69장 무결성 확인
- 앱 최신 구현 기준으로 `npm run capture:screens` 재실행
- ko/ja/en 각 23장 생성 확인
- 대표 화면 vision 검토:
  - 홈
  - lesson flow
  - 기억 기록
  - 인지 루틴
  - garden
  - 보호자 리포트
  - 상담사 리포트
  - 설정
- 깨진 이미지, `?`, raw i18n key, 잘림, 겹침 확인

완료 기준:

- 최종 스크린샷 경로와 개수 기록
- 대표 화면 검토 결과 기록
- 문제가 있으면 수정 후 재캡처

완료 근거:

- 최종 경로: `피우다프로젝트/application_assets/final_qa`
- ko/ja/en 각 23장, 총 69장 확인
- `npm run capture:screens` 기본 webServer 방식은 69개 테스트가 모두 통과했지만 Windows worker 종료 지연으로 exit code가 실패함
- 최종 검증은 Vite preview 서버를 별도 실행하고 `PLAYWRIGHT_BASE_URL=http://127.0.0.1:4173`를 지정해 69개 캡처를 exit code 0으로 완료
- 대표 이미지 직접 확인:
  - `ko/01_home.png`: 홈 advisory 안내 카드 표시
  - `ko/21_report-counselor.png`: 상담사 Haru 종합 주의 신호 표시
  - `ja/21_report-counselor.png`: 일본어 advisory 번역 표시
  - `ko/22_report-caregiver.png`: 보호자 8개 관찰 도메인과 advisory 요약 표시

차단 가능성:

- Playwright 브라우저 설치 실패
- dev server 실행 실패

### Phase 6. 최종 보고서 재생성

상태: Done

진입 조건:

- 연구자료 아카이브 복구 상태가 기록되어야 함
- 최종 스크린샷 세트가 있어야 함
- 보고서 Markdown 소스가 있어야 함

작업:

- 상세 보고서와 큰틀 보고서 Markdown 소스 점검
- 누락된 `build_reports_from_md.py` 또는 동등한 보고서 생성 스크립트 재작성
- DOCX 생성:
  - `피우다프로젝트/final/Haru_종합_연구근거_구현보고서.docx`
  - `피우다프로젝트/final/Haru_큰틀_종합보고서.docx`
- PDF 변환:
  - `피우다프로젝트/final/Haru_종합_연구근거_구현보고서.pdf`
  - `피우다프로젝트/final/Haru_큰틀_종합보고서.pdf`
- 이미지 캡션, alt text, 표 헤더 반복, 페이지 공백 확인
- 참고문헌 서지정보 재점검

완료 기준:

- DOCX와 PDF 존재
- DOCX zip 구조 정상
- 삽입 이미지 수와 alt text 수 일치
- PDF 렌더링 페이지에 빈 페이지 없음
- 보고서 수정검증로그 작성

완료 근거:

- 생성 스크립트: `피우다프로젝트/final/build_reports_from_md.py`
- 보고서용 크롭 자산: `피우다프로젝트/final/report_assets/`
- 상세 보고서:
  - `피우다프로젝트/final/Haru_종합_연구근거_구현보고서.md`
  - `피우다프로젝트/final/Haru_종합_연구근거_구현보고서.docx`
  - `피우다프로젝트/final/Haru_종합_연구근거_구현보고서.pdf`
  - PDF 24쪽, 빈 페이지 후보 0건
  - DOCX 이미지 4개, alt text 4개, 변경 추적 0건, 주석 0건
- 큰틀 보고서:
  - `피우다프로젝트/final/Haru_큰틀_종합보고서.md`
  - `피우다프로젝트/final/Haru_큰틀_종합보고서.docx`
  - `피우다프로젝트/final/Haru_큰틀_종합보고서.pdf`
  - PDF 8쪽, 빈 페이지 후보 0건
  - DOCX 이미지 6개, alt text 6개, 변경 추적 0건, 주석 0건
- LibreOffice 별도 임시 프로필로 PDF 변환 완료
- `pdftoppm -png -r 100` 렌더링 후 contact sheet와 대표 페이지 직접 확인
- 검증 로그: `피우다프로젝트/final/Haru_최종보고서_품질정리_검증로그.md`

차단 가능성:

- LibreOffice 미설치 또는 손상
- Python 문서 생성 의존성 누락
- 스크린샷 경로 누락

### Phase 7. 문서 동기화

상태: Done

진입 조건:

- 앱 구현과 보고서 산출물이 확정되어야 함

작업:

- `README.md` 업데이트
- `AGENTS.md` 업데이트
- `docs/cognitive-screening-integration-plan.md` 업데이트
- `cognitve-reference/agents.md` 업데이트
- `피우다프로젝트/final/research_claim_matrix.md` 업데이트
- validation log 업데이트

완료 기준:

- 문서가 실제 코드·테스트·보고서 파일과 일치
- 테스트 개수, 파일 경로, 배포 URL이 실제 결과와 일치
- “완료” 주장은 실제 명령 결과로 뒷받침됨

완료 근거:

- `README.md` 업데이트: Haru advisory, 8개 보호자 관찰 도메인, 26/79 테스트, capture 방식 반영
- `AGENTS.md` 업데이트: 복구 상태, advisory 엔진, reference archive 복구 결과, 검증 결과 반영
- `docs/cognitive-screening-integration-plan.md` 업데이트: advisory 구현 및 현재 검증 결과 반영
- `cognitve-reference/README.md` 업데이트: 2026-06-02 복구 결과 반영
- `cognitve-reference/agents.md` 업데이트: 2,023개 파일 복구, advisory 구현, 26/79 테스트 반영
- `피우다프로젝트/final/final_validation_log.md` 업데이트
- `피우다프로젝트/final/implementation_qa_report.md` 업데이트
- `피우다프로젝트/final/research_claim_matrix.md`에 Haru advisory claim matrix 추가

차단 가능성:

- 구현 상태가 아직 확정되지 않음

### Phase 8. Vercel 배포 복구

상태: Done

진입 조건:

- `npm run build` 통과
- `.vercel`이 없으면 project link 가능해야 함

작업:

- Vercel CLI 사용 가능 여부 확인
- 기존 프로젝트 연결 복구
- production deploy 실행
- 배포 URL 확인
- 브라우저로 주요 화면 확인
- 이미지 asset 404 여부 확인
- ko/ja/en 전환 확인

완료 기준:

- 최신 배포 URL 기록
- 배포 commit 또는 deployment id 기록
- 프로덕션에서 이미지 깨짐 없음
- 주요 사용자 흐름 접근 가능

완료 근거:

- Vercel CLI 확인: `vercel --version` = 54.0.0
- 로그인 계정 확인: `vercel whoami` = `hyunjun1121`
- 프로젝트 목록에서 `haru` 확인: production alias `https://saerok-memory.vercel.app`
- link 복구: `vercel link --yes --project haru --scope hyunjun-kims-projects`
- 최초 배포 실패 원인: `cognitve-reference/`와 `recovery_audit/`가 업로드 대상에 포함되어 416.2MB 업로드 시도, 100MB 제한 초과
- 조치: `.vercelignore`에 `cognitve-reference/`, `recovery_audit/`, `*.zip` 추가
- production 배포 성공:
  - deployment id: `dpl_9Hr1jfYSgowEYHSzk2Umd4U5av4M`
  - production URL: `https://haru-7i0sihp6n-hyunjun-kims-projects.vercel.app`
  - stable alias: `https://saerok-memory.vercel.app`
- `vercel inspect`: status `Ready`
- `curl.exe -I https://saerok-memory.vercel.app`: HTTP 200 OK
- Production URL 기준 `npm run capture:screens`: 69개 화면 통과
- 대표 production 캡처 직접 확인:
  - `ko/01_home.png`
  - `ko/21_report-counselor.png`
  - `ja/21_report-counselor.png`
  - `ko/22_report-caregiver.png`

차단 가능성:

- Vercel 인증 만료
- 프로젝트 연결 정보 손실
- 빌드 환경 차이

### Phase 9. Git 정리 및 백업

상태: Future task: needs explicit commit/push decision

진입 조건:

- 복구·검증 결과가 확정되어야 함

작업:

- `git status --short` 확인
- 커밋 대상과 제외 대상 분리
- 대용량 연구자료는 Git 커밋 제외 여부 결정
- 필요한 경우 `.gitignore` 보강
- 복구 보고서와 manifest는 커밋 후보로 검토
- commit/push 수행 여부는 사용자 승인 후 결정
- 별도 외부 백업 위치 제안

완료 기준:

- 변경 파일 목록 기록
- 커밋된 항목과 제외 항목 명확화
- 원격 push 여부 기록

차단 가능성:

- 대용량 파일 정책 미정
- 사용자 승인 필요

## 7. 상세 작업 체크리스트

| ID | 작업 | 상태 | 다음 액션 |
|---|---|---|---|
| R-001 | 기존 `피우다프로젝트/plan.md` 삭제 | Done | Git status에서 삭제 상태 확인 |
| R-002 | 루트 `plan.md` 생성 | Done | 새 루트 계획 파일 작성 및 갱신 |
| R-003 | 현재 복구본 백업 | Done | 백업 파일 `C:\project\saerok-memory_recovered_snapshot_20260602_145646.zip` 보존 |
| R-004 | Git 객체 및 tracked 파일 감사 | Done | 결과를 복구 로그에 기록 |
| R-005 | 핵심 샘플 파일 무결성 점검 | Done | 더 넓은 범위로 확장 |
| R-006 | `cognitve-reference` inventory 대조 | Done | `recovery_audit/cognitve_reference_missing_from_inventory_20260602_145627.csv` 생성 |
| R-007 | `download_manifest.csv` 대조 | Done | `recovery_audit/download_manifest_missing_local_paths_20260602_145627.csv` 생성 |
| R-008 | `npm ci` | Done | critical audit 1건은 별도 검토 필요 |
| R-009 | typecheck/lint/test/build | Done | 최종 typecheck/lint/test/build 모두 PASS, test는 26파일/79개 |
| R-010 | Haru advisory 엔진 누락 여부 최종 확인 | Done | 현재 HEAD에는 없었고 재구현 필요로 확정 |
| R-011 | advisory 엔진 재구현 | Done | `src/features/family/haruAdvisory.ts` 추가 |
| R-012 | advisory 테스트 재작성 | Done | `src/features/family/haruAdvisory.test.ts` 3개 테스트 추가 |
| R-013 | `cognitve-reference` PDF 재다운로드 | Done | manifest 기준 PDF/공식도구 파일 복구 |
| R-014 | `cognitve-reference` 데이터 재다운로드 | Done | Zenodo NCPT 데이터 복구 |
| R-015 | `cognitve-reference` 코드 재클론 | Done | 참고 GitHub repo 13개 재클론 |
| R-016 | `cognitve-reference` 웹페이지 재저장 | Done | saved_html/saved_challenge_html 복구, 403 항목 재시도 성공 |
| R-017 | 연구자료 새 해시 inventory 생성 | Done | `cognitve-reference/metadata/current_file_inventory.csv` 갱신 |
| R-018 | 최종 스크린샷 재캡처 | Done | `final_qa` ko/ja/en 각 23장, 총 69장 갱신 |
| R-019 | 보고서 생성 스크립트 재작성 | Done | `build_reports_from_md.py` 작성 |
| R-020 | 상세 보고서 재생성 | Done | DOCX/PDF 생성 및 렌더링 QA 완료 |
| R-021 | 큰틀 보고서 재생성 | Done | DOCX/PDF 생성 및 렌더링 QA 완료 |
| R-022 | README/AGENTS/docs 동기화 | Done | 실제 결과 반영 |
| R-023 | Vercel 재연결 | Done | `hyunjun-kims-projects/haru` link 복구 |
| R-024 | Vercel 재배포 | Done | `dpl_9Hr1jfYSgowEYHSzk2Umd4U5av4M`, stable alias `https://saerok-memory.vercel.app` |
| R-025 | 최종 Git 정리 | Future task | 사용자 승인 후 commit/push |

## 8. 손상 파일 점검 계획

상태: Done for sampled critical files; keep as future checklist for any newly restored files

텍스트:

- `Get-Content -Raw -Encoding UTF8`
- 깨진 문자, 중간 NULL, 예상치 못한 truncation 확인

JSON:

- `ConvertFrom-Json`
- package 및 manifest류 파싱 확인

DOCX/HWPX:

- ZIP으로 열리는지 확인
- 내부 `word/document.xml` 또는 HWPX section 파일 존재 확인
- 가능하면 LibreOffice headless로 PDF 변환

PDF:

- `pdfinfo` 또는 LibreOffice/Poppler로 페이지 수 확인
- `pdftoppm` 렌더링
- 빈 페이지 비율 검사

PNG:

- PNG signature 확인
- 필요 시 이미지 열람

MP4:

- `ftyp` header 확인
- 가능하면 `ffprobe` 또는 frame 추출

CSV:

- `Import-Csv`
- 행 수와 컬럼 수 확인

Git repo:

- `.git` 존재 여부
- `git -C <path> status`
- remote URL 확인

## 9. 연구자료 복구 세부 전략

상태: Done for manifest-listed recoverable items; keep as reference strategy

우선순위:

1. `papers/`: 보고서와 제품 근거에 직접 쓰이는 PDF
2. `official-tools/`: 공식 도구는 참고용으로만 보존, 앱 구현에 직접 복제 금지
3. `data/`: NCPT/Zenodo 공개 데이터셋
4. `web-pages/`: 저장된 공식·상업·fallback 페이지
5. `code/`: 참고 GitHub repo

manifest 상태별 처리:

| status | 처리 |
|---|---|
| `downloaded_pdf` | 원 URL에서 PDF 재다운로드, 해시 계산 |
| `downloaded_data` | 원 URL에서 CSV/데이터 재다운로드, 행 수 확인 |
| `saved_html` | URL HTML 저장, 저장일 기록 |
| `saved_challenge_html` | challenge page로 표시하고 접근 제한 기록 |
| `cloned` | GitHub repo 재클론, commit hash 기록 |
| `downloaded_metadata` | API/메타데이터 재다운로드 |
| `not_downloaded` | 파일 없음이 정상일 수 있음. 이유 유지 |
| `generated` | 로컬에서 재생성 |
| `copied` | 원본 파일에서 재복사 |

복구 후 산출물:

- `cognitve-reference/metadata/recovery_manifest_YYYYMMDD.csv`
- `cognitve-reference/metadata/current_file_inventory.csv`
- `cognitve-reference/metadata/recovery_log.md`

## 10. Haru 기능 복구 판단 기준

상태: Done

초기 감사에서 현재 Git HEAD에는 Haru cognitive routines와 caregiver report가 포함되어 있었지만, 최근 로컬에서 추가했던 Haru advisory 엔진은 확인되지 않았다. 이후 Haru advisory 엔진과 테스트를 재구현하고, 보호자·상담사 화면 및 i18n에 반영했다.

복구 판단을 위해 읽어야 할 파일:

- `src/app/family/FamilyScreen.tsx`
- `src/features/family/caregiverReport.ts`
- `src/features/family/caregiverObservationStorage.ts`
- `src/features/family/demoReportData.ts`
- `src/features/memory/*`
- `src/features/cognitive/*`
- `src/locales/ko.json`
- `src/locales/en.json`
- `src/locales/ja.json`
- `README.md`
- `AGENTS.md`
- `docs/cognitive-screening-integration-plan.md`

복구해야 할 가능성이 있는 기능:

- Haru 자체 advisory summary generator
- caregiver observation domain 확장
- 상담사/보호자 화면의 종합 참고 신호 카드
- i18n key
- E2E raw-key 검증
- Vitest unit tests

금지:

- 공식 MMSE/MoCA/CIST/K-MMSE 등 이름을 결과 UI에 쓰기
- 공식 점수·cutoff·진단 등급 표시
- 단일 세션 결과로 질병 레이블 생성
- private memory를 보호자 화면에 노출

허용:

- Haru 자체 장기 관찰 참고 신호
- 반복 루틴 기반 주의 필요 수준
- 보호자·상담사용 대화 준비 정보
- 전문가 상담 권고

## 11. 보고서 재생성 기준

상태: Done

필요 산출물:

- `피우다프로젝트/final/Haru_종합_연구근거_구현보고서.md`
- `피우다프로젝트/final/Haru_종합_연구근거_구현보고서.docx`
- `피우다프로젝트/final/Haru_종합_연구근거_구현보고서.pdf`
- `피우다프로젝트/final/Haru_큰틀_종합보고서.md`
- `피우다프로젝트/final/Haru_큰틀_종합보고서.docx`
- `피우다프로젝트/final/Haru_큰틀_종합보고서.pdf`
- `피우다프로젝트/final/Haru_최종보고서_품질정리_검증로그.md`

현재 확인:

- 상세/큰틀 최종 Markdown, DOCX, PDF가 모두 존재한다.
- DOCX 구조 검증, PDF 변환, PNG 렌더링, 빈 페이지 후보 검사, 대표 페이지 시각 검토를 완료했다.
- 전용 검증 로그는 `피우다프로젝트/final/Haru_최종보고서_품질정리_검증로그.md`에 기록했다.

검증 기준:

- DOCX가 ZIP으로 정상 열림
- PDF로 변환 가능
- 삽입 이미지 누락 없음
- 캡션과 이미지가 분리되지 않음
- alt text 존재
- 빈 페이지 없음
- 한국어 문장 자연성 확인
- 지나치게 방어적인 “의료검사가 아니다”식 표현은 제거하고, 대신 해석 경계를 문서 맥락에 맞게 설명

## 12. 배포 복구 기준

상태: Done

현재 확인:

- `.vercel` link 복구됨
- Git 원격은 `https://github.com/hyunjun1121/saerok-memory.git`

해야 할 일:

- Vercel CLI 존재 확인
- 기존 Vercel 프로젝트와 link
- `npm run build`
- production deploy
- 배포 URL 접속 확인
- 이미지 asset 정상 로드 확인
- `/`, `/lesson`, `/garden`, `/family`, `/settings` 확인

완료 기준:

- 최신 deployment id 또는 URL 기록
- 브라우저 검증 결과 기록
- raw i18n key 없음
- 이미지 404 없음

완료 근거:

- 최신 deployment id: `dpl_9Hr1jfYSgowEYHSzk2Umd4U5av4M`
- stable alias: `https://saerok-memory.vercel.app`
- production Playwright 캡처 69개 통과

## 13. 사용자 확인 필요 항목

상태: Blocked: needs user input when reached

다음 항목은 실제 처리 단계에서 사용자 판단이 필요할 수 있다.

- 대용량 `cognitve-reference` 원본 자료를 Git에 절대 넣지 않고 로컬/외부 백업으로만 둘지 여부
- 복구된 논문 PDF와 데이터셋을 어느 위치에 장기 보관할지
- Vercel 인증이 필요한 경우 로그인 또는 토큰 제공 방식
- 보고서 DOCX/PDF를 Git에 포함할지, 별도 보관할지
- 기존 지원서 DOCX/HWP 계열 파일을 복구 작업 범위에 포함할지
- Haru advisory 기능을 현재 Git 상태에 다시 구현할지, 보고서/문서만 복구할지

진행 원칙:

- 명확한 사용자 판단이 필요한 시점까지는 가능한 기술 복구를 먼저 진행한다.
- 위험한 덮어쓰기, 대용량 커밋, 배포 프로젝트 변경은 사용자 승인 없이 하지 않는다.

## 14. 위험 등록부

| 위험 | 심각도 | 가능성 | 완화 |
|---|---|---:|---|
| 미커밋 코드 영구 손실 | 높음 | 높음 | 이전 대화 기록, 문서, Git HEAD 기반 재구현 |
| 연구자료 원 URL 만료 | 높음 | 중간 | manifest 실패 로그 기록, 대체 공개 출처 검색 |
| PDF/DOCX 파일 손상 | 중간 | 중간 | ZIP/PDF 렌더링 검증 |
| npm 의존성 설치 실패 | 중간 | 중간 | Node/npm 버전 확인, lockfile 기준 `npm ci` |
| Vercel link 손실 | 중간 | 높음 | CLI 재인증/재연결 |
| 대용량 자료 Git 오염 | 높음 | 중간 | `.gitignore` 확인, commit 전 status 검토 |
| 의료적 과장 표현 재유입 | 높음 | 중간 | 문서와 UI grep, 금지 표현 목록 검증 |
| 일본어/영어 i18n 누락 | 중간 | 중간 | locale key 대조, Playwright 캡처 |
| 이미지 깨짐 또는 `?` 표시 | 중간 | 중간 | 캡처와 브라우저 검증 |
| 복구 작업 중 기존 파일 덮어쓰기 | 높음 | 낮음 | 백업 후 진행, apply_patch 중심 편집 |

## 15. 최종 완료 조건

상태: Partially achieved

이 계획의 최종 완료는 아래 조건을 모두 만족해야 한다.

- 루트 `plan.md`가 현재 복구 계획과 실제 진행 상태를 정확히 반영
- Git 본체 검증 완료
- `npm ci` 후 typecheck/lint/test/build 통과
- 필요한 Haru 기능 누락분 재구현 또는 “불필요”로 근거 기록
- `cognitve-reference` manifest 기반 복구 완료 또는 실패 사유 기록
- 최종 스크린샷 세트 재검증
- 상세/큰틀 보고서 DOCX/PDF 재생성 및 렌더링 QA 완료
- README/AGENTS/docs/final 문서가 실제 구현·검증 결과와 일치
- 남은 조건: Git 커밋/푸시 또는 별도 백업 정책 확정

## 16. 다음 즉시 실행 작업

상태: Ready for next command

1. 커밋 대상과 제외 대상을 분리한다.
2. 대용량 `cognitve-reference` 복구 자료와 내부 렌더링 QA PNG를 Git에 포함할지 제외할지 결정한다.
3. 사용자 승인 후 commit/push를 수행한다.
