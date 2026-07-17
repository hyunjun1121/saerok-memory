# specifie_plan/ — 섹션별 실행 워크플로

> **AXIS (절대 축)**: 본 폴더의 모든 파일은 두 축 문서에 고정된다.
> - `../high_level_plan.md` — 전략·우선순위·수용기준 (HL-1 ~ HL-10)
> - `../specifie_plan.md` — 항목별 현재 구현·파일/경로·수정 방향 (SP-1 ~ SP-10)
>
> 이 폴더의 파일들은 위 두 축을 **"실행 가능한 단계(step)"로 풀어놓은 것**이다. 새 범위를 추가하지 않는다. 범위 박스(키오스크·복지관 대시보드·일본·임상)는 HL-10/SP-10에서 **이번 app 구현 제외**로 고정한다.

## 파일 목록

| 파일 | 대응 | 우선순위 | 선행 SP | 한 줄 |
|---|---|---|---|---|
| [SP-01-motivation-copy.md](SP-01-motivation-copy.md) | HL-1 / SP-1 | P1 | — | Result 뇌활성화 동기부여 카피 + copySafety 확장 |
| [SP-02-color-contrast.md](SP-02-color-contrast.md) | HL-2 / SP-2 | **P0** | — | 흰 글씨 on 녹/청 FAIL → cream+ink+amber (FOUNDATION, 가장 먼저) |
| [SP-03-text-selection-touch.md](SP-03-text-selection-touch.md) | HL-3 / SP-3 | **P0** | SP-02 | 큰 글자 하한선 + ChoiceCard 선택 강화 + MascotBubble praising |
| [SP-04-interaction-feedback.md](SP-04-interaction-feedback.md) | HL-4 / SP-4 | **P0** | SP-02 | Button3D tap + FeedbackTray success 집중화 + 각 exercise 피드백 |
| [SP-05-voice-listening.md](SP-05-voice-listening.md) | HL-5 / SP-5 | P1 | — | 실시간 파형 + 발화 cap + MediaRecorder 폴백 + 발음 신호 |
| [SP-06-content-weekday.md](SP-06-content-weekday.md) | HL-6 / SP-6 | **P0** | — | 일상 콘텐츠 재작성 + 사자성어 제거 + sessionBuilder 요일 연결 |
| [SP-07-autostart-single-cta.md](SP-07-autostart-single-cta.md) | HL-7 / SP-7 | **P0** | — | 런치 자동시작 + Home 단일 CTA + 짧은 온보딩 (사용자 1순위) |
| [SP-08-rewards-mascot.md](SP-08-rewards-mascot.md) | HL-8 / SP-8 | P1 | SP-02, SP-03 | 주간 보상 카탈로그 렌더 + 자랑 카드 + Result 마스코트 칭찬 |
| [SP-09-family-info.md](SP-09-family-info.md) | HL-9 / SP-9 | P1 | — | 보호자 탭 분리 + advisory 보수화 + 치매안심센터 자원 |
| [SP-10-out-of-scope.md](SP-10-out-of-scope.md) | HL-10 / SP-10 | P2 | — | 범위 박스(키오스크/복지관/일본/임상) — 미터치, 별도 과제 |

## 추천 수행 순서 (의존성 기반)

```
SP-02 (FOUNDATION: 색/토큰)  ← 모든 UI 변경의 기반, 가장 먼저
  ├─ SP-07 (런치 자동시작 + 단일 CTA)        ← 사용자 1순위, 진입 경로
  ├─ SP-04 (Button3D tap + FeedbackTray success)  ← Button3D 한 번에
  ├─ SP-06 (콘텐츠 재작성 + 요일 연결)        ← 데이터/로직
  └─ SP-03 (글자/선택/터치 + MascotBubble praising)
       └─ SP-05 (음성 파형/cap/폴백)
       └─ SP-01 (동기부여 카피 + copySafety)
       └─ SP-08 (주간 보상 + 자랑 카드 + Result 칭찬)  ← SP-03 praising 필요
            └─ SP-09 (보호자 분리 + advisory 보수화)
                 └─ SP-10 (범위 박스 — 별도 과제)
```

병렬 가능 그룹: SP-07·SP-06·(SP-02 이후)SP-03/SP-04 는 서로 다른 파일 중심이나 **공유 파일**(Button3D, ResultScreen, HomeScreen)이 있으니 같은 파일은 동시 수정 금지 — 순차 적용.

## 각 파일의 공통 구조

1. **0. 목표** (2~3문장)
2. **1. 현재 구현** (소스 재확인, file:line + 현재 코드 인용 + 멘토 갭)
3. **2. 전제 / 선행 SP**
4. **3. 작업 워크플로** — Step N 단위, 각각: 행동 / 파일:라인 / **FROM** / **TO** / verify 명령 / checkpoint(commit)
5. **4. 단계별 테스트** (typecheck·lint·test·build + 섹션 전용 단정)
6. **5. 수용 기준** (high_level_plan HL-x에서)
7. **6. 범위 펜스** (HL-10 미터치 목록)
8. **7. 추가 발견(보류)** — 소스 확인 중 발견한 추가 필요사항. **step화 금지**, 별도 SP/axis 승인 후.
9. **8. 롤백 메모**

## 검증

매 step: `npm run typecheck && npm run lint && npm test && npm run build`.
전체: `../specifie_plan.md` 부록 B + 각 파일 "4. 단계별 테스트".
