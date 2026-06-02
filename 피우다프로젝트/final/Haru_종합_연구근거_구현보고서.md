# Haru 종합 연구근거 구현보고서

본 문서는 Haru의 현재 구현체를 기준으로 인지 루틴, 보호자·상담사 리포트, Haru 자체 종합 주의 신호가 어떤 연구적 배경과 제품 설계 판단에 따라 구현되었는지 정리한다.

Haru는 공식 인지검사 문항이나 점수 체계를 복제하지 않는다. 대신 신뢰 가능한 문헌과 공개 자료에서 확인되는 인지 영역을 Haru식 짧은 일상 루틴으로 재설계하고, 반복 활동 기록과 보호자 관찰을 조합해 대화 준비에 필요한 참고 신호를 제공한다.

## Haru_연구근거_구현신빙성_보고서
# Haru 연구 근거 및 구현 신빙성 보고서 (Research-Evidence & Credibility Report)

---

## 1. 요약 (Executive Summary)

### 1.1 프로젝트 개요 및 목적
Haru(구 Memory Garden)는 고령자의 지속 가능한 일일 인지 활성화 및 기억력 유지를 돕는 모바일 우선(Mobile-first) 웹 애플리케이션입니다. 본 애플리케이션은 단순한 게임이나 훈련에 그치지 않고, 인지과학 및 뇌과학 문헌에서 입증된 검증 과제들의 메커니즘을 친근하게 재해석한 **'일일 인지 루틴'**과, 이를 가족 및 보호자가 따뜻한 의사소통 수단으로 활용하도록 돕는 **'보호자·상담사 대화 준비 리포트'**를 핵심 가치로 제시합니다.

### 1.2 Haru 자체 해석 원칙
Haru의 인지 루틴과 리포트는 반복 활동 데이터, 기억 단서, 보호자 관찰을 바탕으로 일상 속 참고 신호를 구성합니다.
- broad cognitive domains를 기반으로 자체 제작한 루틴을 사용합니다.
- 대신 사용자의 루틴 수행 과정에서 획득되는 미세 반응시간, 획 데이터(drawing telemetry), 단어 중복률 및 보호자 관찰 데이터를 조합하여, 보호자와 상담사가 일상의 인지 참여 흐름을 이해하고 다정하게 대화를 촉진할 수 있는 **'Haru 자체 참고 신호'**를 도출합니다.

---

## 2. 문제 배경 (Problem Background)

### 2.1 인구 고령화와 인지 건강
한국과 일본을 비롯한 아시아 주요 국가의 초고령화(Super-aging)는 매우 가파르게 진행되고 있습니다. 통계청 발표에 따르면 한국은 이미 65세 이상 고령 인구 비율이 20%를 넘어서는 초고령 사회에 진입하였으며, 일본 또한 인구의 약 30%가 고령층에 해당합니다. 이에 따라 인지 능력 감퇴 및 치매 환자 수는 급증하고 있으며, 인지 건강을 선제적이고 일상적으로 유지하는 도구의 필요성이 대두되고 있습니다.

### 2.2 가족 및 비공식 돌봄 제공자의 부담 (Caregiver Burden)
치매 등 인지 기능 저하가 진행되면 환자 본인뿐만 아니라 가족, 간병인 등 비공식 돌봄 제공자(Informant/Caregiver)가 겪는 정서적·사회적 부양 부담이 매우 커집니다. WHO 및 OECD 보고서는 가족 보호자의 부양 부담 경감과 일상적인 관찰의 체계화가 노년 돌봄(Elderly Care)의 질적 유지를 위해 가장 시급한 영역 중 하나임을 밝히고 있습니다. 초기 인지 변화는 병원에서의 1회성 검사보다 일상에서의 생활 패턴 변화에서 더 민감하게 관찰되는 경향이 있으나, 보호자들이 이를 정량적으로 기록하고 요약하여 다음 상담이나 대화 시 참고할 수 있는 간편한 보조 수단은 극히 드문 실정입니다.

---

## 3. 설계 원칙 (Design Principles)

Haru는 인지적으로 취약한 고령 사용자가 일상에서 느끼는 거부감을 최소화하고 참여를 격려하기 위해 다음 네 가지 접근성 및 사용자 경험(UX) 설계 원칙을 준수합니다.

1. **Click-first & Keyboard-less (터치 중심 조작)**: 자판 입력에 어려움을 겪는 고령자를 배려하여 키보드로 단어를 타이핑하는 입력을 최소화하고, 직관적인 인식 기반(Recognition-based) 카드 터치, 선 잇기, 그리기 조작을 최우선으로 제공합니다.
2. **Duolingo-like Routine (부담 없는 보상 체계)**: 병원 시험실의 엄격하고 건조한 평가 분위기를 배제하고, 매일 10분 안팎으로 끝나는 짧은 루틴을 완료하면 물방울 보상을 주고 이를 통해 기억의 정원을 가꾸는 게이미피케이션(Gamification) 방식을 도입해 지속성을 확보합니다.
3. **Autobiographical Memory Review (자전 기억 중심)**: 단순 사물 인식이나 추상적 숫자 암기를 넘어, 어르신 개인이 실제로 경험한 최근의 기쁜 일, 여행, 음식 등의 일화를 기록하고 이를 지연 복습하게 함으로써 지연 회상 연습과 자아 정체감 유지를 유기적으로 결합합니다.
4. **Caregiver Conversation Support (보호자 대화 촉진)**: 수집된 생활 및 루틴 기록은 어르신과 대화할 때 "어머니, 지난번에 영희랑 공원 산책 가셨을 때 참 행복하셨다고 기억을 저장해 두셨네요. 그때 날씨가 어땠나요?"와 같이 다정한 소통의 촉매(Conversation Cues)로 환원됩니다.

---

## 4. 참고문헌과 설계 반영 (Research & Design Mapping)

### 4.1 지연 회상 (Delayed Word Recall)
- **이론적 근거**: 에피소드 기억(Episodic Memory) 감퇴는 알츠하이머 등 해마형 인지 저하 초기 단계에서 포착되는 가장 대표적인 특징입니다. Dubois et al. (2002)의 **5-Word Test** 및 MDPI(2022)의 지연 회상 적응 연구는 범주 단서(Category Cue)를 학습(Encode)시키고 주의 분산 작업 후에 다시 꺼내어 보게(Cued Recall) 하는 방식이 짧은 시간 내에 해마 인지 기능을 연습시키는 데 매우 민감하게 작용한다고 증명했습니다.
- **Haru 구현**: [DelayedWordRecall.tsx](file:///C:/project/saerok-memory/src/features/lessons/exerciseTypes/DelayedWordRecall.tsx)  
  인코딩 단계에서 5단어와 이에 매핑된 범주 단서(예: '도구 - 연필')를 제시한 뒤, 레슨 말미에 자유회상(Free Recall) 및 4지선다형 재인(Recognition)을 통해 기억을 인출하게 유도합니다.

### 4.2 작업 기억 (Working Memory)
- **이론적 근거**: 숫자를 듣고 그대로 혹은 거꾸로 따라 하는 **Digit Span 검사**는 전두엽의 작업 기억 공간(Working Memory Capacity)과 정보 재배열 능력(Mental Manipulation)을 자강합니다. 특히 순방향보다 역방향(Backward) 수행 시의 최대 길이와 머뭇거림 시간이 인지적 부하(Cognitive Load) 처리를 정밀히 반영합니다.
- **Haru 구현**: [DigitSpanPractice.tsx](file:///C:/project/saerok-memory/src/features/lessons/exerciseTypes/DigitSpanPractice.tsx)  
  사용자에게 3~5자리의 무작위 숫자를 순차 제시한 후, 지정된 방향(forward, backward)으로 입력판에서 직접 터치하게 유도하여 집행 기능을 자극합니다.

### 4.3 주의 전환 및 집행 기능 (Set-shifting & Selective Attention)
- **이론적 근거**: **TMT (Trail Making Test) B** 검사는 시각 탐색 속도와 주의 전환 능력을 자극하는 대표적인 집행 기능(Executive Function) 척도입니다. 디지털화된 TMT는 터치의 정확도뿐 아니라 노드 간 이동 시 나타나는 방황(Graphomotor Hesitation)을 시계열로 포착하는 데 유용합니다. **Stroop 효과**는 글자의 의미에 의한 자동적 반응을 억제하고 물리적 색상(Inhibitory Control)을 인출하도록 유도합니다.
- **Haru 구현**: [TrailSwitchingPractice.tsx](file:///C:/project/saerok-memory/src/features/lessons/exerciseTypes/TrailSwitchingPractice.tsx) 및 [StroopTouchPractice.tsx](file:///C:/project/saerok-memory/src/features/lessons/exerciseTypes/StroopTouchPractice.tsx)  
  숫자와 기호를 번갈아 이어나가는 TMT-lite를 모바일 터치 노드 연결 방식으로 구현하고, 색상-의미 불일치 Stroop 카드를 구성해 선택적 주의 집중을 지원합니다.

### 4.4 시공간 기능 및 디지털 운동 마커 (Visuospatial & Telemetry)
- **이론적 근거**: 시계 그리기 검사(CDT) 등은 시공간 구성 능력을 확인하기 위해 임상에서 활용됩니다. 최근 디지털 펜 및 터치 궤적(Graphomotor Telemetry) 연구(dCDT PMC5619209 등)는 완성된 시계 그림뿐만 아니라 드로잉에 첫 획을 긋기까지 걸린 지연(Latency), 획을 긋는 속도, 획 간의 공중 멈춤 횟수(Hesitation)가 경도 인지 감퇴군의 초기 운동 미세 특성을 파악하는 디지털 바이오마커로 가치 있음을 증명했습니다.
- **Haru 구현**: [ShapeCopyPractice.tsx](file:///C:/project/saerok-memory/src/features/lessons/exerciseTypes/ShapeCopyPractice.tsx)  
  그림 그리기 캔버스를 통해 단순 모사 도형을 그리게 하고, 획 수(strokeCount), 첫 터치 지연시간(firstTouchLatencyMs), 망설임 발생 수(hesitationCount), 지우개 사용 수, 궤적 좌표 경로(sampledPath)를 원천 데이터로 기록합니다.

### 4.5 언어 유창성 (Verbal Fluency)
- **이론적 근거**: 1분간 특정 범주에 해당하는 단어를 생각나는 대로 열거하는 **Semantic Verbal Fluency** 과제는 대뇌 의미 네트워크(Semantic Network)의 통합성을 보여줍니다. 이는 고령화 및 알츠하이머 초기 인지 저하 시 정답의 개수가 감소하고 동일 단어를 반복적으로 나열(Repetition)하거나 범주를 벗어나는 빈도가 높아지는 징후를 보입니다.
- **Haru 구현**: [VerbalFluencyPractice.tsx](file:///C:/project/saerok-memory/src/features/lessons/exerciseTypes/VerbalFluencyPractice.tsx)  
  고령자가 접근하기 쉬운 '동물' 등의 범주에 맞춰 30초 내에 단어를 연상 추가하게 하며, 중복어(repetitionCount)와 고유어(uniqueCount)를 기계적으로 분리 집계하여 기록합니다.

### 4.6 정보제공자 기반 생활 관찰 (Informant Observation)
- **이론적 근거**: 인지 변화가 시작된 고령자는 자신의 결함을 부정하거나 깨닫지 못하는 안소소그노시아(Anosognosia) 성향을 띠는 경우가 흔하므로, 가까운 비공식 보호자가 체감하는 생활 기능(IADL)의 종단적 변화를 수집하는 **AD8**이나 **GPCOG Informant** 척도가 단일 1회성 검사보다 초기 징후 감지에 훨씬 우수하고 신뢰성 높다는 것이 입증되어 있습니다.
- **Haru 구현**: [FamilyScreen.tsx](file:///C:/project/saerok-memory/src/app/family/FamilyScreen.tsx) 및 [caregiverObservationStorage.ts](file:///C:/project/saerok-memory/src/features/family/caregiverObservationStorage.ts)  
  보호자 전용 탭에서 일상 루틴 변화, 약속 챙기기 변화 등 6개 기능 영역에 대한 종단 변화 데이터를 '큰 변화 없음 / 가끔 달라 보임 / 자주 달라 보임 / 잘 모르겠음'과 같이 구조화된 척도로 정기 수집합니다.

---

## 5. 구현 근거 (Implementation Reference Ledger)

Haru 애플리케이션의 핵심 로직과 연구 근거는 아래 파일들과 정확하게 매핑됩니다.

```text
src/
  app/
    family/
      FamilyScreen.tsx            <-- 보호자 생활 관찰 입력창, 상담사 탭 리포트 UI 총괄
  features/
    lessons/
      exerciseTypes/
        DelayedWordRecall.tsx     <-- 5단어 학습(Encode) 및 지연 회상/재인(Recall)
        DigitSpanPractice.tsx     <-- 순/역방향 작업기억 숫자 폭 연습
        VerbalFluencyPractice.tsx <-- 30초 타이머 기반 범주 언어 유창성
        TrailSwitchingPractice.tsx <-- 숫자-요일 기호 번갈아 누르기 (TMT-lite)
        StroopTouchPractice.tsx   <-- 글자색 불일치 억제 및 주의력 집중 루틴
        OrientationPractice.tsx   <-- 날짜/요일 감각 가벼운 지남력 확인
        ShapeCopyPractice.tsx     <-- 도형 캔버스 드로잉 & 그리기 telemetry 수집
        PersonalMemoryRecall.tsx  <-- 자전 기억 카드 구축 (이야기, 감정, 인물 태그)
    family/
      caregiverReport.ts          <-- 보호자 관찰 & 인지 루틴 이력 기반 리포트 생성 로직
      caregiverObservationStorage.ts <-- 보호자 관찰 척도 수집 및 로컬 스토리지 연동
      conversationCues.ts         <-- 공유기억 기반 대화 유도 키워드 연산
    memory/
      memoryScheduler.ts          <-- 망각 곡선과 dueAt을 고려한 개인 기억 복습 스케줄러
```

---

## 6. 신빙성의 한계 (Implementation Limitations)

1. **검증 계획**: Haru의 7대 인지 루틴 및 반응시간 수치, 그리기 telemetry 등은 인지 영역별 학술 연구를 참조하여 기획 및 구현되었습니다. 향후 사용자성 평가, 전문가 자문, 파일럿 데이터를 통해 Haru 자체 참고 신호의 타당도(Validity)와 신뢰도(Reliability)를 단계적으로 검증합니다.
2. **모바일 웹 브라우저 환경 제어**: 디바이스 스펙, 브라우저 엔진 속도, 캔버스 렌더링 프레임율, Speech API 미지원 등에 따라 반응 속도(Ms)와 궤적 좌표 정확도에 기술적 오차가 발생할 수 있습니다.
3. **독립적 로컬 구동**: 현재 Haru는 개인정보 보호와 가벼운 데모 구동을 위해 브라우저의 `localStorage` 단독으로 동작합니다. 따라서 장치 분실 혹은 캐시 삭제 시 데이터가 소실되는 보존성의 한계가 있습니다.

---

## 7. 향후 검증 계획 (Future Validation Plan)

### 7.1 전문가 자문위원회 구성
- 노인의학, 인지신경심리학 및 노년 정보학(Gerontechnology) 분야의 국내외 교수진 및 임상 의사들로 전문가 자문단을 구성하여, Haru 인지 루틴의 단어 난이도 세트 및 주의도 산출 가중치 알고리즘의 타당성을 주기적으로 심의받을 계획입니다.

### 7.2 리빙랩 및 파일럿 사용자 평가
- 복지관, 데이케어센터 혹은 시니어 소모임과의 협력을 통해 실제 고령자(65세 이상) 30~50명을 대상으로 4주간 앱을 사용하도록 하는 파일럿 테스트(Pilot Study)를 수행합니다. 
- 사용자 사용성 평가(SUS), 보호자의 대화 유용성 만족도 설문, 루틴 중도 포기율(Drop-out Rate) 분석을 병행하여 UI/UX를 개선할 예정입니다.

### 7.3 익명화된 누적 데이터 분석
- 향후 완전한 백엔드 보안 연동이 구축될 시, 사용자가 수동 및 자발적으로 동의한 범위에 한해 익명화된 종단 터치 속도, 주의 전환 시간, 그리기 망설임 횟수 추이 데이터를 집계합니다. 이를 임상 진단군 데이터와 비교 분석하여 Haru 자체 주의도 모델의 민감도(Sensitivity)를 통계적으로 추적하고 고도화해 나갈 것입니다.

---

## 8. 참고문헌 (References)

1. **SAGE (Self-Administered Gerocognitive Exam)**: Scharre, D. W., et al. (2010). "Self-administered gerocognitive examination (SAGE): a brief cognitive assessment instrument for mild cognitive impairment and early dementia." *Alzheimer Disease & Associated Disorders*, 24(1), 64-71.
2. **5-Word Test**: Dubois, B., et al. (2002). "The Five-Word Test: a simple and sensitive test of verbal episodic memory." *Neurology*, 58(7), A375-A376.
3. **GPCOG (General Practitioner Assessment of Cognition)**: Brodaty, H., et al. (2002). "The GPCOG: a new screening test for cognitive impairment." *Journal of the American Geriatrics Society*, 50(12), 2001-2007.
4. **Digital CDT (dCDT) Review**: Souillard-Mandar, W., et al. (2016). "Learning classification models of cognitive impairment from digital clock drawings." *Artificial Intelligence in Medicine*, 68, 45-55.
5. **Set-Shifting & TMT-B**: Tombaugh, T. N. (2004). "Trail Making Test A and B: Normative data stratified by age and education." *Archives of Clinical Neuropsychology*, 19(2), 203-214.
6. **Semantic Verbal Fluency**: Henry, J. D., & Crawford, J. R. (2004). "A meta-analytic review of verbal fluency performance in patients with traumatic brain injury." *Neuropsychology*, 18(4), 621-628.
7. **Informant-based Screening (AD8)**: Galvin, J. E., et al. (2005). "The AD8: a brief informant interview to detect dementia." *Neurology*, 65(4), 559-564.
8. **W3C Web Accessibility Initiative (WAI)**: "Accessibility concerns for older users." *W3C Web Accessibility Guidelines*.
9. **국가법령정보센터 개인정보 보호법**: "제3조(개인정보 보호 원칙) 및 제15조(개인정보의 수집·이용)." 대한민국 법률.


## research_claim_matrix
# Haru 연구 근거 및 주장 매트릭스 (Research Claim Matrix)

본 매트릭스는 Haru에 구현된 인지 및 기억 루틴, 보호자 관찰 기능이 어떤 연구 문헌 및 참고자료를 토대로 기획·설계되었는지 밝히고, 임상적 오인을 방지하기 위해 서비스 내부 및 외부 홍보 시 사용할 수 있는 '안전한 주장'과 절대 사용해서는 안 되는 '금지된 주장'을 명확히 규정합니다.

---

## 1. 전반 스크리너 및 프레임워크 영역

| 구분 | 상세 내용 |
| :--- | :--- |
| **연구/근거 영역** | 다영역 인지 선별(Brief Multi-domain Screener) 및 자가시행(Self-administered) 타당성 |
| **사용할 수 있는 근거 자료** | - **SAGE (Self-Administered Gerocognitive Exam)**: Scharre et al. (2010, 2021) 연구에 따르면, 자가시행 인지 평가는 종이 및 태블릿 환경 모두에서 높은 타당성을 지니며 인지 변화를 추적하는 데 효과적입니다.<br>- **GPCOG (General Practitioner Assessment of Cognition)**: Brodaty et al. (2002) 연구에 의하면 환자 직접 평가와 보호자 인터뷰를 결합하는 것이 일차의료 환경에서 매우 높은 효율성을 보입니다.<br>- **DACI (Digital Assessment of Cognitive Impairment)**: 2025년 최신 연구들은 모바일 기반의 짧은 다과업 배터리가 사용자 순응도를 높이면서도 종단 관찰에 유리하다고 보고합니다. |
| **Haru 구현 반영** | - **통합 루틴 흐름**: 단일 영역이 아닌 지연 회상, 작업 기억, 주의 전환, 언어 유창성, 시공간 그리기, 지남력 등 다영역 루틴을 10분 내외로 유기적으로 연결.<br>- **사용자-보호자 결합**: 학습자 본인의 인지 루틴 완료도와 보호자의 주기적 일상 관찰 설문을 `/family` 화면에서 결합하여 다중 신호로 요약함. |
| **안전한 주장 (Allowed)** | "Haru는 인지과학적 다영역 평가 설계를 참고하여 고령자가 매일 스스로 주의집중, 작업기억, 날짜 감각 등을 연습할 수 있도록 돕는 일상 인지 루틴 앱입니다." |
| **금지된 주장 (Forbidden)** | "Haru는 MMSE나 MoCA, SAGE 검사를 앱으로 그대로 구현하여 병원에 가지 않고도 치매 여부를 판정할 수 있는 의료 등급의 자가진단 스크리닝 프로그램입니다." |

---

## 2. 지연 회상 (Delayed Word Recall)

| 구분 | 상세 내용 |
| :--- | :--- |
| **연구/근거 영역** | 해마형 Episodic Memory (일화기억) 및 Cued Recall (단서 회상) 효과 |
| **사용할 수 있는 근거 자료** | - **5-Word Test (Dubois et al., 2002; MDPI 2022 적응 연구)**: 5단어 지연 회상 검사는 인지적 인코딩 단계에서 범주 단서(Category Cue)를 함께 학습시키고, 일정 시간 지연 후 자유회상(Free Recall) 및 단서회상/재인(Cued Recall/Recognition)을 순차적으로 평가하여 해마 기능 저하의 약한 신호를 포착합니다. Dubois 연구에서는 특정 컷오프(예: TWS ≤15)가 치매 감별에 매우 높은 특이도를 보인다고 증명했습니다. |
| **Haru 구현 반영** | - **`delayed_word_recall` 루틴**: 레슨 초기에 5가지 한국어/일본어/영어 단어를 각 범주 단서(예: 교통수단 - 버스, 과일 - 사과)와 함께 제시(Encode).<br>- 레슨 중간에 다른 주의집중 과제(Digit Span, Stroop 등)를 배치하여 자연스러운 시간 지연 유도.<br>- 레슨 후반부에 단어 직접 입력(자유회상) 후, 4지선다형 선택지 내에서 올바른 단어를 재인하게 함(Cued Recall). 단어 정답 개수와 실제 소요 지연시간(Observed Delay Ms)을 로컬 스토리지에 세부 메타데이터로 저장. |
| **안전한 주장 (Allowed)** | "범주 단서를 활용한 5단어 기억 및 회상 방식을 참고하여, 사용자가 일상적인 사물의 이름과 범주를 머릿속에 기억하고 일정 시간 후에 다시 떠올려 보는 기억력 연습 활동을 제공합니다." |
| **금지된 주장 (Forbidden)** | "Haru의 지연 회상 결과는 임상 5단어 검사(5-Word Test)의 절단점 점수 체계를 완벽히 적용하여 사용자의 뇌 해마 위축이나 알츠하이머병 발병 가능성을 정확히 예측합니다." |

---

## 3. 작업 기억 및 주의력 (Digit Span & Stroop Focus)

| 구분 | 상세 내용 |
| :--- | :--- |
| **연구/근거 영역** | 작업기억(Working Memory), 단기 기억 범위(Short-term Memory Span) 및 선택적 주의력(Selective Attention) |
| **사용할 수 있는 근거 자료** | - **Digit Span (WAIS-IV 등)**: 숫자를 순방향(Forward)으로 따라 부르는 것은 단순 주의력과 단기 기억을 측정하고, 역방향(Backward)으로 뒤집어 누르는 것은 작업기억의 정보 조작(Mental Manipulation) 및 집행 능력을 요구합니다. 초기 인지 변화군에서는 역방향 성능이 유의하게 저하되는 패턴이 있습니다.<br>- **Stroop Color-Word Test**: 글자의 의미적 간섭을 억제하고 글자색(Ink Color)에만 집중하도록 유도하는 것은 전두엽 집행 기능 중 억제 제어(Inhibitory Control) 능력을 반영합니다. |
| **Haru 구현 반영** | - **`digit_span_practice`**: 무작위 숫자 시퀀스를 화면에 보여준 뒤, 순방향 혹은 역방향으로 가상 키패드를 눌러 입력하도록 함. 최대 span 범위와 오클릭/지우기 횟수 등을 기록.<br>- **`stroop_touch_practice`**: 화면에 무작위 색상 단어를 표시하되 글자색과 의미가 불일치하게 제어(예: 빨간색으로 적힌 '파랑'). 사용자는 아래 버튼에서 글자의 뜻이 아닌 '글자색'을 터치해야 함. 반응 시간(Latency)과 정답률을 metadata로 저장. |
| **안전한 주장 (Allowed)** | "가벼운 숫자 거꾸로 누르기 및 색상 집중 터치 게임을 통해 일상에서 흐려지기 쉬운 작업기억력과 선택적 주의집중력을 자극하는 두뇌 연습을 지원합니다." |
| **금지된 주장 (Forbidden)** | "Digit Span 및 Stroop 검사의 반응 간섭 점수를 분석하여 전두엽 기능 장애나 경도인지장애(MCI)를 모바일로 진단하고 인지 억제 능력을 개선/치료합니다." |

---

## 4. 주의 전환 및 집행 기능 (Trail Switching / TMT-lite)

| 구분 | 상세 내용 |
| :--- | :--- |
| **연구/근거 영역** | 세트 전환(Set-Shifting), 시각 탐색 속도(Visual Search) 및 집행 기능(Executive Function) |
| **사용할 수 있는 근거 자료** | - **TMT (Trail Making Test) A/B**: 숫자를 순서대로 잇는 TMT-A는 시각 탐색과 처리 속도를, 숫자와 문자를 번갈아 잇는 TMT-B(예: 1-A-2-B)는 인지적 유연성과 세트 전환 능력을 측정합니다. 노화 및 인지 저하 시 TMT-B 수행 시간(Elapsed Time)과 오류율이 눈에 띄게 증가합니다. |
| **Haru 구현 반영** | - **`trail_switching_practice`**: 모바일 터치 환경에 최적화하여 6~8개의 노드(숫자 노드와 한국어/영어/일본어 요일/알파벳 등 문자 노드)를 화면에 비정형 배치.<br>- 사용자가 '숫자 → 문자 → 숫자 → 문자' 순서로 번갈아 터치하게 유도(TMT-lite).<br>- 오클릭 시 즉시 피드백을 주며, 전체 소요 시간(Elapsed Ms)과 오클릭 횟수(Error Count)를 메타데이터로 기록. |
| **안전한 주장 (Allowed)** | "숫자와 요일/글자를 번갈아 찾아 터치하는 순발력 훈련을 제공하며, 이를 통해 두 가지 이상의 규칙을 유연하게 교대하여 사용하는 뇌의 주의 전환 기능을 지원합니다." |
| **금지된 주장 (Forbidden)** | "TMT-B의 표준 규준 데이터를 사용하여 사용자의 주의 전환 처리 능력을 공식 백분위 등급으로 매겨 인지 감퇴 수준을 분류합니다." |

---

## 5. 시공간 및 미세 조작 (Shape Copy Practice / dCDT-lite)

| 구분 | 상세 내용 |
| :--- | :--- |
| **연구/근거 영역** | 시공간 구성 능력(Visuoconstructive Ability) 및 디지털 운동학 피처(Graphomotor/Drawing Telemetry) |
| **사용할 수 있는 근거 자료** | - **CDT (Clock Drawing Test) 및 도형 모사 검사**: 시각적 협응과 구성력을 측정하며, 특히 디지털로 구현된 시계 그리기 검사(dCDT)에 관한 연구들(dCDT Review PMC5619209 등)은 단순히 완성된 그림의 점수뿐만 아니라 첫 터치 지연(First Touch Latency), 획 수(Stroke Count), 펜/손가락이 허공에 멈춘 망설임 횟수(Hesitation Count)와 같은 미세 운동 telemetry가 조기 저하군을 민감하게 변별하는 바이오마커가 된다고 설명합니다. |
| **Haru 구현 반영** | - **`shape_copy_practice`**: 사용자가 화면 상단의 단순 도형(삼각형, 집 모양, 별표 등)을 캔버스 영역에 손가락으로 모사하여 그림.<br>- 캔버스 컴포넌트는 사용자의 드로잉 이벤트를 실시간 캡처하여 획 수(strokeCount), 샘플링된 터치 좌표 경로(sampledPath), 첫 터치 대기 시간(firstTouchLatencyMs), 드로잉 중 멈춤(hesitationCount), 지우개 사용(clearCount) 등 dCDT-lite 스타일의 원천 원격 측정 데이터(telemetry)를 저장함. |
| **안전한 주장 (Allowed)** | "화면의 도형을 손가락으로 직접 따라 그리는 활동을 제공하고, 획 수나 그리기 지속 시간과 같은 활동 기록을 보존하여 시지각 기능과 눈과 손의 협응력을 연습하게 돕습니다." |
| **금지된 주장 (Forbidden)** | "시계그리기 검사의 자동 채점 알고리즘을 모방해 사용자의 그림 형태를 점수화하고 뇌졸중이나 뇌 손상, 알츠하이머성 공간 감각 이상을 감지합니다." |

---

## 6. 언어 유창성 (Verbal Fluency)

| 구분 | 상세 내용 |
| :--- | :--- |
| **연구/근거 영역** | 의미 유창성(Semantic Verbal Fluency) 및 어휘 탐색 능력(Lexical Access) |
| **사용할 수 있는 근거 자료** | - **Semantic Fluency Test**: 1분 등 제한 시간 내에 특정 범주(예: 동물, 과일)의 단어를 가능한 한 많이 말하게 하는 검사입니다. 의미 정보가 저장된 장기 기억 망(Semantic Network)의 통합성과 이를 인출하는 제어 능력을 반영하며, 교육/언어 편향이 큰 음운 유창성(Phonemic Fluency)에 비해 조기 인지 진단적 변별력이 우수하다고 다수의 문헌(Cochrane, 한국 DND 연구 등)이 지지합니다. |
| **Haru 구현 반영** | - **`verbal_fluency_practice`**: "동물" 등 고령자에게 친숙한 범주를 임무로 부여.<br>- 30초의 제한 시간 동안 생각나는 단어를 추가하도록 유도하며, 고유한 단어 수(Unique Count)와 동일 단어 입력(Repetition Count)을 실시간으로 확인하여 원천 활동 정보로 기록. |
| **안전한 주장 (Allowed)** | "주어진 주제(예: 동물)에 어울리는 단어들을 제한 시간 동안 머릿속에서 신속하게 끄집어내는 브레인스토밍 연습을 통해 언어 순발력과 어휘 연상 능력을 훈련합니다." |
| **금지된 주장 (Forbidden)** | "단어 산출 개수가 연령별 임상 기준치 이하인 경우 언어장애나 실어증, 초기 치매군으로 규정하고 어휘력 저하 원인을 진단합니다." |

---

## 7. 날짜 지남력 (Orientation)

| 구분 | 상세 내용 |
| :--- | :--- |
| **연구/근거 영역** | 지남력(Orientation) - 시간 인지 |
| **사용할 수 있는 근거 자료** | - **MMSE / MoCA / GPCOG의 지남력 항목**: 시간, 날짜, 요일, 계절, 장소를 인지하는 것은 뇌의 전반적인 인지 기본 상태를 파악하는 가장 빠르고 보편적인 문항입니다. 경도인지장애 및 초기 치매 진행 시 날짜나 요일 착오가 가장 빈번히 일어납니다. |
| **Haru 구현 반영** | - **`orientation_practice`**: 사용자가 오늘 날짜와 요일을 화면에 제시된 다지선다 카드 형태에서 가볍게 터치하여 확인.<br>- 실제 날짜(Target Date)와 사용자가 고른 옵션의 매칭 여부, 선택 반응속도(Response Ms)를 기록. 개인정보 보호와 불필요한 장치 권한 획득을 최소화하기 위해 '장소 지남력(GPS 위치 정보 요구)'은 MVP 범위에서 보류함. |
| **안전한 주장 (Allowed)** | "하루를 시작하며 가볍게 오늘의 날짜와 요일을 선택하고 돌아봄으로써, 시간 흐름에 대한 자각과 일상 지남력을 건강하게 유지하도록 돕는 인지 감각 루틴입니다." |
| **금지된 주장 (Forbidden)** | "날짜 선택에 실패했을 때 이를 지남력 상실 증상이나 중증 치매 징후로 단정하여 보호자에게 발병 경고를 보냅니다." |

---

## 8. Supporter Reports & Privacy (보호자 관찰 및 기억 공유)

| 구분 | 상세 내용 |
| :--- | :--- |
| **연구/근거 영역** | 정보제공자 기반 관찰(Informant Observation), 가족 지지(Caregiver Support) 및 프라이버시(Privacy by Default) |
| **사용할 수 있는 근거 자료** | - **Informant-based Screening (AD8, GPCOG Informant 등)**: 환자 스스로는 인지 저하를 인지하지 못하는 안소소그노시아(Anosognosia) 현상이 흔하므로, 가까운 가족이나 보호자의 객관적인 일상 기능 변화 관찰(AD8/GPCOG)이 환자 테스트보다 조기 징후 발견에 있어 훨씬 민감하고 정확할 수 있습니다.<br>- **회상 요법 및 대화 촉진**: 공유된 긍정적 자전 기억은 우울감을 낮추고 치매 고령자와 가족 간의 원활한 의사소통 및 정서적 유대를 보완합니다. |
| **Haru 구현 반영** | - **보호자 탭**: 일상 기능 변화(시간 약속, 가계부/약 챙기기, 대화 방식 등)에 대한 주기적 체크를 할 수 있는 '보호자 관찰 메모' 제공.<br>- **상담사 탭**: 보호자 관찰 내용과 인지 루틴 참여율 추이를 요약하고, 사용자가 명시적으로 공유를 허락한 기억(`shareWithFamily === true`)에 기반하여 '가족 대화 주제(Conversation Cues)'와 '상담 질문 소재'를 자동 생성해 줌.<br>- **철저한 프라이버시**: 로컬 스토리지 단독 활용으로 백엔드 유출을 방어하고, 개인 기억 카드는 디폴트로 비공개 처리됨. |
| **안전한 주장 (Allowed)** | "보호자의 간단한 생활 관찰과 사용자가 공유한 소중한 일상 추억을 바탕으로, 보호자와 상담사가 어르신과 나눌 수 있는 따뜻한 대화 소재와 활동 요약을 제공해 줍니다." |
| **금지된 주장 (Forbidden)** | "보호자 설문 결과 점수를 치매 보호자용 척도 점수로 전환하고, 개인 동의 없이 작성된 추억 이야기를 원격 서버에 전송하여 분석 및 모니터링합니다." |

---

## 9. Haru 자체 종합 주의 신호 (Advisory Signal)

| 구분 | 상세 내용 |
| :--- | :--- |
| **연구/근거 영역** | 다영역 인지 루틴, 종단 활동 기록, 정보제공자 관찰, 디지털 행동 metadata의 결합 |
| **사용할 수 있는 근거 자료** | - GPCOG와 AD8처럼 사용자 수행 정보와 보호자 관찰 정보를 함께 보는 흐름은 일상 변화 이해에 유용한 참고 구조를 제공함.<br>- 지연회상, 작업기억, 언어 유창성, 주의 전환, 색상 집중, 지남력, 그리기 telemetry는 각각 기억, 주의, 언어, 시공간, 일상 흐름을 구성하는 넓은 인지 영역을 반영함.<br>- `cognitve-reference`의 논문 PDF, 공식 페이지, NCPT/Zenodo 데이터, 참고 GitHub 저장소는 공식 검사 복제가 아니라 Haru식 원본 루틴과 metadata 설계의 참고 근거로만 사용함. |
| **Haru 구현 반영** | - **`src/features/family/haruAdvisory.ts`**: 반복 루틴 참여 변화, 지연 단어 회상 metadata, 숫자 기억, 범주 유창성, 주의 전환, 색상 집중, 날짜 감각, 그리기 telemetry, 공유 허용 기억 카드, 보호자 관찰 8개 영역을 결합함.<br>- 출력은 공식 점수나 병명 대신 `steady`, `watch`, `needsConversation` 수준, 영역별 요약, 참고한 신호, 다음 대화 액션으로 구성됨.<br>- `/family`의 보호자 탭에는 요약 신호를, 상담사 탭에는 신호 근거와 다음 대화 액션을 표시함.<br>- 테스트: `haruAdvisory.test.ts`에서 신호 결합, data completeness, 금지 표현 미포함을 검증함. |
| **안전한 주장 (Allowed)** | "Haru는 반복 활동 기록과 보호자 관찰을 함께 살펴 Haru 자체의 종합 주의 신호를 만들고, 보호자와 상담사가 다음 대화를 준비할 수 있도록 참고 신호와 액션을 제공합니다." |
| **금지된 주장 (Forbidden)** | "Haru advisory level은 공식 MMSE/MoCA/CIST 점수나 임상 진단 등급이며, 치매·경도인지장애 여부를 판정하거나 질병 위험도를 의학적으로 예측합니다." |


## implementation_qa_report
# Haru 애플리케이션 종합 구현 QA 결과 보고서 (Implementation QA Report)

본 보고서는 Haru 프로젝트의 현재 구현 완성도를 전체 기능별 렌더링, E2E 시나리오 테스트, 고령 사용자 접근성, 3개 국어(한국어, 일본어, 영어) 다국어 지원, 그리고 시각 자산 로딩 무결성 관점에서 종합적으로 검증한 결과를 다룹니다.

---

## 1. 종합 검증 요약

| 검증 분야 | 결과 | 확인된 주요 증거 | 비고 |
| :--- | :---: | :--- | :--- |
| **정적 분석 및 빌드** | **PASS** | `npm run typecheck` 및 `npm run lint` 오류 없이 완료 | 개발자 도구 및 린터 기준 충족 |
| **유닛 및 컴포넌트 테스트** | **PASS** | 26개 테스트 파일, 총 79개 테스트 케이스 100% 통과 | 핵심 도메인 로직 및 Haru advisory 신호 검증 |
| **자동 E2E 화면 캡처** | **PASS** | `final_qa` 폴더에 3개 언어(ko, ja, en)별 23장씩 총 69장의 깨끗한 최종 스크린샷 캡처 완료 | 레이아웃 깨짐, raw i18n key, `??` 노출 없음 |
| **고령자 접근성 (A11y)** | **PASS** | 최소 44px 이상의 터치 영역, 명확한 라벨링, click-first 설계 확인 | W3C 고령자 접근성 권고안 반영 |
| **개인정보 및 해석 안전성** | **PASS** | 디폴트 비공개 기억 공유 정책 및 Haru 자체 참고 신호 중심 표현 확인 | 일상 인지 루틴 보조 도구로 확립 |

---

## 2. 화면 및 기능별 QA 테스트 세부 내역

### 2.1 메인 홈 화면 (`/`)
- **수행 항목**: Haru 브랜드 로고 및 Mascot 말풍선 렌더링, 오늘 루틴 시작 단추 동작, 홈 화면 Haru advisory 안내 카드 검사.
- **결과**: **PASS**
- **특이사항**: 한국어 모드에서 `logo_ko.png`, 일본어 모드에서 `logo_ja_kanji.png` 혹은 `logo_ja_hiragana.png`가 로케일에 따라 동적으로 노출되는 것이 확인됨.
- **스크린샷**: `01_home.png`

### 2.2 인지 및 기억 레슨 흐름 (`/lesson`)
각 인지 과제 컴포넌트가 unsupported fallback 없이 안전하게 작동하고 메타데이터가 저장되는지 검증함.

1. **지연 회상 인코딩 (`delayed_word_recall` - Encode)**
   - **결과**: **PASS** (자체 개발한 5개 한국어/일본어/영어 단어 세트 및 범주 단서 연계 렌더링 확인)
   - **스크린샷**: `02_lesson-delayed-word-encode.png`
2. **다지선다 어휘 매칭 (`multiple_choice_meaning`)**
   - **결과**: **PASS**
   - **스크린샷**: `03_lesson-meaning-choice.png`
3. **상황 적합 단어 매칭 (`situation_match`)**
   - **결과**: **PASS**
   - **스크린샷**: `04_lesson-situation-match.png`
4. **주의 집중 패턴 매칭 (`attention_pattern`)**
   - **결과**: **PASS**
   - **스크린샷**: `05_lesson-attention-pattern.png`
5. **날짜/요일 지남력 활동 (`orientation_practice`)**
   - **결과**: **PASS** (오늘의 날짜/요일에 대한 선택형 UI 확인. "날짜 감각 루틴 참여 기록"으로 정상 저장)
   - **스크린샷**: `06_lesson-orientation.png`
6. **작업기억 숫자 폭 연습 (`digit_span_practice`)**
   - **결과**: **PASS** (가상 키패드를 이용한 순방향/역방향 동작 확인)
   - **스크린샷**: `07_lesson-digit-span.png`
7. **범주 어휘 유창성 연습 (`verbal_fluency_practice`)**
   - **결과**: **PASS** (동물 범주 단어 입력 및 30초 타이머 동작, 중복 단어 및 서로 다른 단어 개수 자동 연산 확인)
   - **스크린샷**: `08_lesson-verbal-fluency.png`
8. **주의 전환 선 잇기 (`trail_switching_practice` - TMT-lite)**
   - **결과**: **PASS** (숫자와 한글/일어 요일 기호를 번갈아 터치하는 TMT-lite 정상 동작, 오클릭 카운트 정상 기록)
   - **스크린샷**: `09_lesson-trail-switching.png`
9. **카드 짝 맞추기 (`pair_matching`)**
   - **결과**: **PASS**
   - **스크린샷**: `10_lesson-pair-matching.png`
10. **문장 순서 배열 (`sequence_order`)**
    - **결과**: **PASS**
    - **스크린샷**: `11_lesson-sequence-order.png`
11. **음성 청취 및 단어 선택 (`audio_choice`)**
    - **결과**: **PASS**
    - **스크린샷**: `12_lesson-audio-choice.png`
12. **그림/시각 단어 매칭 (`picture_choice`)**
    - **결과**: **PASS**
    - **스크린샷**: `13_lesson-picture-choice.png`
13. **도형 복사 그리기 (`shape_copy_practice` - dCDT-lite)**
    - **결과**: **PASS** (캔버스 영역 그리기 이벤트 수집, 첫 터치 지연시간, 획 수, hesitationCount 등 그리기 telemetry 저장 확인)
    - **스크린샷**: `14_lesson-shape-copy.png`
14. **문장 듣고 따라 말하기 (`speech_repeat_practice`)**
    - **결과**: **PASS** (브라우저 Web Speech API 예외 대응 방어 코드 적용 완료, 음성 인식 미지원 시 텍스트 입력 Fallback 활성화 확인)
    - **스크린샷**: `15_lesson-speech-repeat.png`
15. **지연 회상 아웃풋 (`delayed_word_recall` - Recall/Recognition)**
    - **결과**: **PASS** (자유회상 입력을 먼저 받고, 이후 선택형 재인 문제를 연동 제공하는 2단계 회상 흐름 작동 검증)
    - **스크린샷**: `16_lesson-delayed-word-recall.png`
16. **개인 기억 구축 (`personal_memory_recall` - Story & Emotion)**
    - **결과**: **PASS** (이야기 입력 및 감정 태그 지정 완료 후 `shareWithFamily` 디폴트 `false` 설정 확인)
    - **스크린샷**: `17_lesson-memory-story.png`, `18_lesson-memory-emotion.png`

### 2.3 학습 완료 결과 및 정원 화면 (`/result`, `/garden`)
- **수행 항목**: 획득한 물방울 수 계산, 연속 학습일수 반영 및 물방울을 통한 기억의 잎사귀 성장 시각화 점검.
- **결과**: **PASS**
- **스크린샷**: `19_result.png`, `20_garden.png`

### 2.4 보호자 및 상담사 대화 준비 리포트 (`/family`)
- **수행 항목**: '보호자' 및 '상담사' 관점의 탭 분할 작동 검사.
- **보호자 탭**: 익숙한 일상, 대화 흐름, 약속 기억, 길 찾기, 약·돈 관리, 기분·사회활동, 수면·식사, 집 안 안전의 8대 생활 관찰 도메인에 대한 주기적 체크 입력 및 메모 저장 기능 확인.
- **상담사 탭**: 사용자의 30일 누적 활동 수준 요약, 보호자 관찰 메모 내역 연동, 공유 동의된 기억 단서에 기초한 대화 촉진 소재(Conversation Cues) 제공 확인. Haru 자체 종합 주의 신호, 영역별 참고 신호, 다음 대화 액션이 대화 준비 자료 중심으로 표현됨을 확인.
- **결과**: **PASS**
- **스크린샷**: `21_report-counselor.png` (상담사 탭), `22_report-caregiver.png` (보호자 탭)

### 2.5 설정 화면 (`/settings`)
- **수행 항목**: 로컬 다국어 설정(ko/ja/en) 전환에 따른 UI 즉각 변경, 개인 기억 및 루틴 수행 이력 등의 로컬 스토리지 데이터 완전 삭제 동작 점검.
- **결과**: **PASS**
- **스크린샷**: `23_settings.png`

---

## 3. 고령자 접근성 및 국제화 점검

1. **터치 목표 크기**: 주요 조작용 단추(`Button3D` 등) 및 탭 선택지, 리포트 도메인 선택창의 높이를 모두 최소 `44px` 이상(대부분 `48px`~`56px`)으로 제작하여 오작동 위험을 방지함.
2. **시각적 가독성**: `index.html`에서 브라우저 배율 변화에 유연하게 대처할 수 있는 반응형 폰트 크기를 유지하고, 대비가 낮은 연한 회색 배경 상의 흰색 글자 배치를 지양함.
3. **i18n 누락 테스트**: 69장의 자동 캡처 파일 전체를 검사하여 `??`, `family.advisory`, `family.observation`, `family.report`, `family.cues`, `exercise.`처럼 번역 파일이 깨지거나 키 이름이 유출되는 문제를 발견하지 못함. 일본어 설정(`ja`) 전환 시 한국어 텍스트가 유출되지 않는 점도 대표 화면에서 재차 검증됨.

---

## 4. 리스크 요약 및 향후 개선안

> [!WARNING]
> 1. **브라우저 Web Speech API 편차 리스크**: 모바일 iOS Safari 및 일부 Android WebView에서 Speech Recognition 권한 취득 실패 혹은 음성 처리 실패율이 데스크톱 환경보다 상대적으로 높습니다. 현재 적용된 텍스트 직접 입력 Fallback 처리가 모바일 화면에서 명확히 사용자에게 인지되도록 도움말 영역 디자인을 미세 보완할 필요가 있습니다.
> 2. **종단 리포트 시각화 보강의 필요성**: 현재 상담사용 리포트는 단순한 수치 및 대화 준비 텍스트 요약 수준입니다. 포스트 MVP 로드맵에 따라 그리기 궤적의 멈춤 시간(hesitation) 및 주의 전환 반응 속도를 그래프로 렌더링하는 시각화 라이브러리(예: Chart.js 등)의 안전한 도입이 중기 과제로 권장됩니다.


## final_validation_log
# Haru 최종 구현 검증 로그 (Final Validation Log)

최종 검증 일시: 2026-06-02 15:48 KST  
검증 환경: Windows 11 (PowerShell)  
작업 디렉터리: `C:\project\saerok-memory`

---

## 1. 정적 검사 및 빌드 검증

### 1.1 TypeScript 타입 검사 (`npm run typecheck`)
- **실행 명령**: `tsc -b`
- **결과**: **SUCCESS** (오류 없이 정상 통과)
- **출력 로그**:
  ```text
  > haru@0.0.0 typecheck
  > tsc -b
  ```

### 1.2 ESLint 코드 린트 (`npm run lint`)
- **실행 명령**: `eslint .`
- **결과**: **SUCCESS** (경고 및 에러 없음)
- **출력 로그**:
  ```text
  > haru@0.0.0 lint
  > eslint .
  ```

### 1.3 Vite 프로덕션 빌드 (`npm run build`)
- **실행 명령**: `tsc -b && vite build`
- **결과**: **SUCCESS** (9.27초 소요, 번들 정상 생성)
- **출력 파일 구성**:
  - `dist/index.html` (0.62 kB)
  - `dist/assets/index-DFj59n2q.css` (35.79 kB)
  - `dist/assets/index-DBZnKkVl.js` (310.01 kB)
  - 기타 비동기 청크 파일들 정상 분할 렌더링 완료.

---

## 2. 테스트 스위트 실행 검증 (`npm run test`)

- **실행 엔진**: Vitest v3.2.4
- **결과**: **SUCCESS** (26개 테스트 파일, 79개 테스트 케이스 전체 통과)
- **비차단 로그**: React Router v7 Future Flag 안내, `act(...)` 테스트 경고, malformed localStorage 입력을 무시하는 테스트의 의도된 parse 로그가 출력됨. 테스트 실패나 런타임 중단은 발생하지 않았으며, 별도 개선 후보로 관리함.
- **부문별 통과 테스트**:
  - `PairMatching.test.tsx` (2 passed)
  - `MultipleChoiceMeaning.test.tsx` (2 passed)
  - `SpeechRepeatPractice.test.tsx` (1 passed)
  - `SituationMatch.test.tsx` (2 passed)
  - `ShapeCopyPractice.test.tsx` (1 passed)
  - `StroopTouchPractice.test.tsx` (2 passed)
  - `VerbalFluencyPractice.test.tsx` (2 passed)
  - `PersonalMemoryRecall.test.tsx` (5 passed)
  - `OrientationPractice.test.tsx` (2 passed)
  - `TrailSwitchingPractice.test.tsx` (2 passed)
  - `AttentionPattern.test.tsx` (2 passed)
  - `DelayedWordRecall.test.tsx` (2 passed)
  - `App.test.tsx` (2 passed)
  - `FamilyScreen.test.tsx` (5 passed)
  - `haruAdvisory.test.ts` (3 passed)
  - `ExerciseRenderer.test.tsx` (2 passed)
  - `caregiverReport.test.ts` (6 passed)
  - `caregiverObservationStorage.test.ts` (4 passed)
  - `memoryReviewGenerator.test.ts` (8 passed)
  - `conversationCues.test.ts` (4 passed)
  - `memoryScheduler.test.ts` (7 passed)
  - `rewards.test.ts` (2 passed)
  - `memoryCardStorage.test.ts` (2 passed)
  - `cognitiveRoutineStorage.test.ts` (2 passed)
  - `gardenProgress.test.ts` (3 passed)
  - `streaks.test.ts` (4 passed)

---

## 3. Playwright E2E 스크린샷 자동 검증 (`npm run capture:screens`)

- **실행 명령**: Vite preview 서버를 별도 실행한 뒤 `PLAYWRIGHT_BASE_URL=http://127.0.0.1:4173` 및 `SCREENSHOT_OUTPUT_DIR=피우다프로젝트/application_assets/final_qa`를 지정하여 `npm run capture:screens` 실행
- **결과**: **SUCCESS** (69개 시나리오 100% 통과, exit code 0)
- **산출 경로**: 
  - 깨끗한 최종본 경로: `피우다프로젝트/application_assets/final_qa/` (3개 국어별 23장씩 총 69장)
  - E2E 구동 중 텍스트 단락 내부 `??`, `family.report`, `family.cues`, `family.observation`, `family.advisory`, `exercise.` 등의 raw i18n key 누락 여부 기계적 유효성 체크 통과.
  - 기본 Playwright webServer 자동 기동 방식은 Windows에서 worker 종료 지연이 발생했으나, 별도 Vite preview 서버와 `PLAYWRIGHT_BASE_URL` 지정 방식으로 동일 69개 캡처를 exit code 0으로 재검증함.

---

## 4. 라이브 호스팅 배포 상태

- **검증 당시 Vercel Production 고유 URL**: [https://haru-mjha4zepu-hyunjun-kims-projects.vercel.app](https://haru-mjha4zepu-hyunjun-kims-projects.vercel.app)
- **안정 Production Alias URL**: [https://saerok-memory.vercel.app](https://saerok-memory.vercel.app)
- **배포 상태**: 이 로그의 2026-06-02 갱신 시점에는 로컬 검증만 수행함. `.vercel` 로컬 연결 폴더가 손실되어 배포 재연결 및 최신 production 반영은 별도 단계에서 수행해야 함.

---

## 5. 결론 및 보증

Haru 인지 루틴, 보호자·상담사 리포트, Haru 자체 종합 주의 신호의 로컬 검증 결과, 핵심 로직, E2E 화면 자산, 다국어 리소스, 린터 및 테스트 명령어 세트가 통과함을 확인합니다. 테스트 실행 중 남는 React Router 안내 로그, 일부 `act(...)` 경고, malformed localStorage 방어 테스트의 parse 로그는 비차단 항목입니다.

