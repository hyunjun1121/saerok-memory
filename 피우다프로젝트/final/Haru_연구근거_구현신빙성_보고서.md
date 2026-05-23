# Haru 연구 근거 및 구현 신빙성 보고서 (Research-Evidence & Credibility Report)

---

## 1. 요약 (Executive Summary)

### 1.1 프로젝트 개요 및 목적
Haru(구 Memory Garden)는 고령자의 지속 가능한 일일 인지 활성화 및 기억력 유지를 돕는 모바일 우선(Mobile-first) 웹 애플리케이션입니다. 본 애플리케이션은 단순한 게임이나 훈련에 그치지 않고, 인지과학 및 뇌과학 문헌에서 입증된 검증 과제들의 메커니즘을 친근하게 재해석한 **'일일 인지 루틴'**과, 이를 가족 및 보호자가 따뜻한 의사소통 수단으로 활용하도록 돕는 **'보호자·상담사 대화 준비 리포트'**를 핵심 가치로 제시합니다.

### 1.2 비진단 원칙 (Non-diagnostic Principle)
Haru는 의료 기기가 아니며, 치매나 경도인지장애(MCI)의 의학적 스크리닝, 진단, 예방, 또는 치료를 목적으로 하지 않습니다. 
- 임상적 신뢰도가 완전히 입증되지 않은 단일성 점수(Total Score) 산출을 배제합니다.
- 공식 임상 평가 도구(MMSE, MoCA, K-MMSE, CIST 등)의 자극어, 이미지 자극, 문항 양식 및 30점 만점 기준의 절단점(Cut-off) 체계를 복제하지 않고, broad cognitive domains를 기반으로 자체 제작한 루틴을 사용합니다.
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
4. **Caregiver Conversation Support (보호자 대화 촉진)**: 수집된 생활 및 루틴 기록은 어르신의 상태를 감시하는 도구가 아니라, 어르신과 대화할 때 "어머니, 지난번에 영희랑 공원 산책 가셨을 때 참 행복하셨다고 기억을 저장해 두셨네요. 그때 날씨가 어땠나요?"와 같이 다정한 소통의 촉매(Conversation Cues)로 환원됩니다.

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

1. **임상적 타당성 미입증**: Haru의 7대 인지 루틴 및 반응시간 수치, 그리기 telemetry 등은 인지 영역별 학술 연구를 참조하여 기획 및 구현되었으나, 이 앱 자체가 치매 진단이나 인지 선별로서 임상 시험(Clinical Trial)을 거쳐 타당도(Validity) 및 신뢰도(Reliability)를 검증받은 것은 아닙니다.
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
