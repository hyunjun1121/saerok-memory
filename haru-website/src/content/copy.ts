/**
 * Haru 마케팅 웹사이트 전체 카피 (한국어).
 * 모든 문구는 2026년 8~9월 발표자료 및 팀 승인 전단지 v13에서 인용·요약했다.
 * 컴포넌트에는 문자열을 하드코딩하지 않고 이 모듈만 수정한다.
 * 사실성 경계(피우다프로젝트/발표자료/AGENTS.md)는 copySafety.test.ts가 검증한다.
 */

export const DEMO_URL = "https://haru-raspberry-pi.vercel.app";

export const siteCopy = {
  meta: {
    company: "오가사 · OGASA Labs",
    productName: "Haru",
    productNameKo: "하루",
    demoUrl: DEMO_URL,
  },

  header: {
    nav: [
      { href: "#problem", label: "문제" },
      { href: "#how", label: "작동 방식" },
      { href: "#product", label: "제품" },
      { href: "#tech", label: "기술" },
      { href: "#validation", label: "검증" },
      { href: "#business", label: "비즈니스" },
      { href: "#team", label: "팀" },
      { href: "#awards", label: "수상" },
    ],
    demoCta: "데모 체험",
    contactCta: "기관 문의",
  },

  hero: {
    eyebrow: "기관 설치형 키오스크 · 오가사 OGASA Labs",
    titleLine1: "검사처럼 느껴지지 않는",
    titleLine2: "하루 3분 AI 개인화 두뇌운동 키오스크",
    sub: "어르신이 어제 말한 이야기가 오늘의 문항이 됩니다. Haru(하루)는 노인 · 가족 · 복지 · 의료를 잇는 일상 기록을 남깁니다.",
    nameNote: "Haru는 한국어 ‘하루’와 일본어 ‘春(봄)’의 뜻을 담았습니다.",
    badges: ["하루 3~5분 · 1일 1회", "네 개 물리버튼", "보호자 · 기관 연계"],
    trust: "2026 글로벌 피우다프로젝트 왕중왕전 1등(과학기술정보통신부 장관상) · 한 · 일 양국 실증 준비",
    primaryCta: "데모 체험하기",
    secondaryCta: "기관 문의하기",
    visualCaption: "Haru 키오스크 실물 목업 · 2×2 물리버튼과 큰 세로 화면",
    visualSrc: "/assets/product/kiosk-angle-1600.jpg",
    visualAlt: "Haru 키오스크 실물 목업 사진 — 세로 화면과 2×2 물리버튼",
    screenCardSrc: "/assets/screens/ko/d1-q2.png",
    screenCardAlt: "Haru 한국어 화면 예시 — 네 자리 중 보이는 자리를 골라 같은 버튼으로 확정합니다",
  },

  problem: {
    eyebrow: "WHY HARU",
    title: "변화는 진단 이전에 시작되는데, 매일을 남기는 수단이 없습니다.",
    sub: "초고령사회에서 가족 · 어르신 · 기관 사이의 일상 기록이 비어 있습니다.",
    actors: [
      {
        title: "가족 · 보호자",
        body: "매일의 안부와 변화를 확인할 도구가 없습니다. 아이는 학습 앱으로 챙기지만, 부모님 안부는 가끔의 전화뿐입니다.",
      },
      {
        title: "어르신",
        body: "검사 낙인과 작은 화면이 기록을 막습니다. 글자를 키워도 보이지 않고, 전화만 되는 기기를 쓰십니다.",
      },
      {
        title: "복지 · 의료기관",
        body: "매일 살펴볼 인력과 기록 수단이 없습니다. 수기 관찰과 반복 문답에 기대어 데이터가 남지 않습니다.",
      },
    ],
    stats: [
      { value: "20.3%", label: "한국 65세 이상 인구 비중 · 2025", source: "출처 · 국가데이터처 2025 고령자 통계" },
      { value: "약 101만 명", label: "한국 65세 이상 추정 치매 인구 · 2026 전망", source: "출처 · 보건복지부 2023 치매역학조사" },
      { value: "29.4%", label: "일본 65세 이상 인구 비중 · 2025", source: "출처 · 일본 총무성 통계국 2025" },
    ],
  },

  solution: {
    eyebrow: "SOLUTION",
    title: "하루 3~5분 루틴이 네 주체를 잇습니다",
    sub: "어르신 활동 · 보호자 안부 · 복지관 운영 · 의료 · 상담 준비가 하나의 기록에서 시작됩니다.",
    axes: [
      {
        title: "어르신",
        body: "큰 글씨 · 네 개 버튼 · 음성 안내. 검사가 아닌 일상 활동으로 매일 참여합니다.",
      },
      {
        title: "보호자",
        body: "점수가 아닌 안부와 대화의 단서를 전합니다. 오늘 남긴 이야기로 통화를 시작합니다.",
      },
      {
        title: "복지관",
        body: "기관 단말 한 대로 여러 어르신이 순환하며, 반복 활동 운영과 참여를 확인합니다.",
      },
      {
        title: "의료 · 상담",
        body: "진료 전 참고할 수 있는 변화 기록. 동의된 관찰 기록 요약만 전달합니다.",
      },
    ],
    loopTitle: "하나의 닫힌 순환",
    loop: ["선택 · 말하기", "활동 기록", "관련 기억 검색", "다음 문항", "안부 리포트"],
    rulesTitle: "네 버튼, 하나의 규칙",
    rules: [
      "음성 안내를 듣습니다",
      "보이는 자리의 버튼을 누릅니다",
      "화면에서 선택을 확인합니다",
      "같은 버튼을 한 번 더 눌러 확정합니다",
    ],
    rulesNote: "잘못 눌러도 되돌릴 수 있습니다. 화면 문항의 위치가 곧 버튼의 위치입니다. 특허 출원 진행 · KCI 논문 작성 중.",
  },

  product: {
    eyebrow: "PRODUCT",
    title: "7일 × 하루 6개 = 42개의 일상 활동",
    sub: "MMSE · CIST가 다루는 검증 인지 영역에서 착안해, 일상 문항으로 다시 설계한 Haru 자체 활동입니다.",
    hardwareTitle: "기관에 설치하는 키오스크",
    hardwarePhotos: {
      main: { src: "/assets/product/kiosk-front-1600.jpg", alt: "Haru 키오스크 정면 사진" },
      thumbs: [
        { src: "/assets/product/kiosk-side-1600.jpg", alt: "Haru 키오스크 측면 사진" },
        { src: "/assets/product/render-design-1448.png", alt: "Haru 키오스크 설계 렌더링" },
      ],
    },
    elder: { src: "/assets/product/elder-using-1200.jpg", alt: "탁상형 Haru 기기를 사용하는 어르신" },
    hardwareBullets: [
      "2×2 물리버튼 — 화면 문항 위치 = 버튼 위치, 같은 버튼 재입력으로 확정",
      "NFC 카드 태깅으로 시작하는 가명 로그인",
      "큰 세로 화면 · 고대비 큰 글씨 · 음성 안내",
      "전원과 Wi-Fi만 있으면 설치 · 공사 불필요",
    ],
    hardwareCaption: "실물 목업(좌) · 설계 렌더링(우) — 시제품 제작용 도면 기준",
    domainsTitle: "7개 인지 영역",
    domains: ["지남력", "기억력", "주의 · 계산", "언어", "시공간", "감정"],
    domainsNote: "우울에 PHQ-9가 있듯, 인지에는 MMSE · CIST의 검증 영역 체계가 있습니다. Haru는 이 영역을 일상 문항으로 변환합니다.",
    screensTitle: "Haru 실제 화면 — 한국어 · 2×2 대형 텍스트 UI",
    screens: [
      { src: "/assets/screens/ko/d1-q1.png", alt: "1일차 활동 화면 — 네 자리 중 보이는 자리를 고른다", caption: "1일차 · 네 자리 선택" },
      { src: "/assets/screens/ko/lesson-start.png", alt: "활동 시작 화면 — 오늘도 함께 시작해요", caption: "활동 시작 화면" },
      { src: "/assets/screens/ko/mood-speak.png", alt: "말하기 활동 화면 — 편하게 말씀해 주세요", caption: "말하기 활동 화면" },
      { src: "/assets/screens/ko/session-result.png", alt: "세션 결과 화면 — 오늘의 완료 현황", caption: "세션 결과 화면" },
      { src: "/assets/screens/ko/caregiver-app.png", alt: "보호자 화면 예시 — 안부 리포트", caption: "보호자 화면" },
    ],
    elderCaption: "하루 1회, 약 3~5분. 사회복지사 초기 안내 후 어르신 단독 사용을 목표로 합니다.",
  },

  personalization: {
    eyebrow: "AI PERSONALIZATION",
    title: "개인화는 추측이 아니라, 기록을 다시 찾는 과정입니다",
    sub: "과거 응답을 저장하고 검색해, 다음 문항의 근거로 다시 사용합니다.",
    chatTitle: "어제의 이야기가 내일의 문항이 됩니다",
    chatMascotSrc: "/assets/mascot/buddy-encourage-512.png",
    chatMascotAlt: "Haru 마스코트 거북이 부기",
    chatDayLabel: "1일차 · 말하기 활동",
    chatUser: "어제 딸이랑 외식했어요.",
    chatNextLabel: "다음 문항 · 근거 기반 생성",
    chatHaru: "지난번에 따님과 외식하셨다고 했는데, 그때 무엇을 드셨는지 기억나시나요?",
    chatNote: "과거의 이야기 → 관련 기억 검색 → 근거 있는 다음 질문. 42개 고정 활동과 함께, 근거가 있을 때 만들어지는 개인화 문항 구조입니다.",
    voiceTitle: "음성 인식",
    voiceBody: "음성 인식은 다시 시도할 수 있고, 인식 실패가 활동 완료를 막지 않습니다. 듣는 상태는 붉은 표시와 파형으로 확인할 수 있습니다.",
    privacyTitle: "개인정보 설계",
    privacyBody: "NFC 가명 ID · 역할별 열람 범위 · 철회와 삭제 절차를 설계했고, 개인정보 이용 동의서를 한국어 · 일본어로 제작했습니다.",
  },

  validation: {
    eyebrow: "VALIDATION & TRUST",
    title: "형성평가에서 시작해, 독립 실증을 준비합니다",
    sub: "65세 이상 20명 베타테스트(형성평가 · 사전 검증) 결과를 제품에 반영했습니다. 독립 대상자 연구는 IRB 심의 신청 후 진행합니다.",
    beforeAfterTitle: "베타테스트가 바꾼 것",
    beforeAfter: [
      { before: "작은 스마트폰 화면", after: "큰 세로 화면 키오스크" },
      { before: "터치 · 메뉴 이동 부담", after: "네 개 물리 버튼" },
      { before: "듣는 상태가 불명확", after: "붉은 듣기 상태 · 반응 파형" },
      { before: "인식 실패가 활동을 막음", after: "재시도 · 실패 비차단 구조" },
    ],
    beforeAfterNote: "65세 이상 20명 베타테스트 · 형성평가(사전 검증) — 독립 대상자 연구 · 효과 검증 결과가 아닙니다.",
    readinessTitle: "실증 준비",
    readiness: [
      { label: "IRB 심의 신청", note: "승인 후 실행 예정" },
      { label: "특허 출원 진행", note: "2×2 버튼 기반 노인 친화 인터페이스" },
      { label: "KCI 논문 작성 중", note: "고령자 UX · 인지 활동 근거 정리" },
      { label: "개인정보 이용 동의서 한 · 일 제작", note: "역할별 열람 범위 · 철회 · 삭제 설계" },
    ],
    roadmapTitle: "실증 로드맵",
    roadmap: [
      { date: "2026.08", title: "마무리 개발", body: "키오스크 · 음성 · 리포트 완성, 특허 출원 · IRB 심의 신청" },
      { date: "2026.09", title: "실증 준비", body: "승인 후 참여자 모집 · 협력 기관 설치 · 일본어 문항 조정" },
      { date: "2026.10~11", title: "한 · 일 양국 실증", body: "오사카 ATC 에이지리스센터 ‘미라이존’ 어르신 20명 체험 · 국내 한국재가노인복지협회 회원시설 · 마포구 치매안심센터 협력 진행 중" },
      { date: "2026.12", title: "최종 시제품 · 초기 공급", body: "실증 결과 반영 · 시제품 10대 완성 · 협의 중인 10개 기관 초기 공급" },
      { date: "2027", title: "국가 예산 · 일본 진출", body: "치매안심센터 · 지자체 B2G 제안, 홋카이도대 엑셀러레이팅 참여" },
    ],
  },

  business: {
    eyebrow: "BUSINESS",
    title: "기관이 바로 도입할 수 있는 B2B · B2G 모델",
    sub: "설치형 키오스크 + 운영 리포트 구독. 하드웨어 · 앱 · 음성 · 기억 구조를 전 과정 직접 개발해 설치 단가를 낮췄습니다.",
    targetsTitle: "초기 고객",
    targets: ["요양병원", "요양원 · 요양시설", "주야간보호센터", "복지관", "치매안심센터"],
    market: [
      { value: "3.9만 곳", label: "한 · 일 핵심 설치 기관 (SAM)" },
      { value: "500곳", label: "3년 내 설치 목표 (SAM의 약 1.3%)" },
    ],
    missionTitle: "사회적기업 운영",
    missionBody: "이익 극대화가 아닌 접근성 우선. 복지관 · 지자체 예산과 연계하고, 돌봄 인력이 부족한 현장에 우선 배치하며, 충청권 지역과 함께 운영합니다.",
    partnersTitle: "자문 · 협력",
    partners: [
      { src: "/assets/partners/snu.png", alt: "서울대학교" },
      { src: "/assets/partners/kaist.png", alt: "KAIST" },
      { src: "/assets/partners/hokkaido.png", alt: "홋카이도대학" },
      { src: "/assets/partners/bundangcha.svg", alt: "분당차병원" },
      { src: "/assets/partners/kma.png", alt: "육군사관학교" },
      { src: "/assets/partners/armyhq.png", alt: "육군본부" },
    ],
    partnersCaption: "분당차병원 정신건강의학과 자문협력 · 육군사관학교 연구센터 협력연구 진행 중 · 복지관 10곳 이상 접촉 · 운영 협의 추진",
    partnersNote: "로고는 팀원 소속 학교 및 자문 · 협력 기관입니다.",
  },

  team: {
    eyebrow: "TEAM",
    title: "AI · 의료 · 일본 현지, 세 역할의 결합",
    sub: "기획 → 구현 → 의료 · 사용성 검토 → 실증 → 일본 현지 확장을 외주 없이 팀 내부에서 연결합니다.",
    members: [
      {
        name: "김현준",
        role: "팀장 · AI 총괄 · 개발",
        org: "KAIST 전산학부 · KAIST AI 연구원",
        note: "AI 논문 17편 · 인용 734회",
        photo: "/assets/team/member-kimhyunjun-512.jpg",
      },
      {
        name: "나현우",
        role: "일본 현지 · 제품 설계",
        org: "홋카이도대 기계공학 석 · 박사과정",
        note: "일본 현지 10년 · 기구 설계",
        photo: "/assets/team/member-nahyunwoo-512.jpg",
      },
      {
        name: "이재우",
        role: "의공학 · IRB",
        org: "서울대 기계공학 · 차의과학대 의학전문대학원 4학년",
        note: "의학연구 참여 · IRB 심의 경험",
        photo: "/assets/team/member-leejaewoo-512.jpg",
      },
    ],
  },

  awards: {
    eyebrow: "AWARDS",
    title: "각자의 수상에서 출발해, 한 팀이 되었습니다",
    sub: "국방기술 창업경진대회에서 각자 수상한 세 사람이, 한 팀이 되어 Haru를 키워 왔습니다.",
    items: [
      {
        title: "국방기술 창업경진대회",
        result: "금상 · 은상 · 동상",
        body: "세 사람이 서로 다른 아이템으로 나란히 수상하며 팀의 출발점이 되었습니다.",
        src: "/assets/awards/award-defense-1200.jpg",
        alt: "제9회 국방과학기술 대제전 창업경진대회 시상식에서 상장을 든 팀원들",
      },
      {
        title: "글로벌 피우다 충청권",
        result: "최우수상",
        body: "Haru로 첫 도전. “같이 하면 더 멀리 가겠다” — 이 자리에서 한 팀이 되기로 했습니다.",
        src: "/assets/awards/award-chungcheong-1200.jpg",
        alt: "2026 글로벌 피우다 프로젝트 충청권 최우수상 시상식 사진",
      },
      {
        title: "글로벌 피우다 왕중왕전",
        result: "최우수상(1등) · 과학기술정보통신부 장관상",
        body: "충청권 1위에서 왕중왕전 장관상까지, 어르신 두뇌운동 키오스크 Haru의 방향을 검증받았습니다.",
        src: "/assets/awards/award-wangjungwang-1200.jpg",
        alt: "2026 글로벌 피우다 프로젝트 왕중왕전 최우수상 시상식 사진",
      },
      {
        title: "한화생명 WE CARE MEMORY+",
        result: "아이디어 부문 최우수상",
        body: "보험 · 돌봄 업계에서도 Haru의 아이디어를 인정받았습니다.",
        src: "/assets/awards/award-hanwha-1200.jpg",
        alt: "한화생명 WE CARE MEMORY+ 아이디어택트 최우수상 시상식 사진",
      },
    ],
    now: "현재 · 2026 E5 KAIST 참가 — 한 · 일 양국 실증을 준비하고 있습니다.",
  },

  cta: {
    eyebrow: "TRY HARU",
    mascotSrc: "/assets/mascot/bugi-3d-512.png",
    mascotAlt: "Haru 마스코트 3D 거북이 부기",
    title: "네 개의 버튼으로, 매일의 기록을 다음 대화로 잇겠습니다.",
    sub: "기관 데모 · 실증 참여 · 도입 상담을 환영합니다.",
    primaryCta: "데모 체험하기",
    secondaryCta: "기관 문의하기",
    contactRep: "대표자 김현준",
    contactEmail: "hyunjun1121@kaist.ac.kr",
    contactPhone: "010-9417-1845",
    contactLinkedin: "linkedin.com/in/hyunjun1121",
    contactLinkedinUrl: "https://www.linkedin.com/in/hyunjun1121",
  },

  footer: {
    disclaimer: "Haru의 기록은 일상 지원을 위한 참고 정보이며 의료적 판단을 대신하지 않습니다.",
    disclaimerSecondary: "Haru는 의료적 진단 기기가 아닌, 생활 기반의 일상 인지돌봄 솔루션입니다.",
    company: "오가사 · OGASA Labs",
    demoLabel: "데모",
    backToTop: "맨 위로",
    copyright: "© 2026 OGASA Labs",
    sourcesNote: "외부 통계 출처 · 국가데이터처 2025 고령자 통계 · 보건복지부 2023 치매역학조사 · 일본 총무성 통계국 2025",
  },
} as const;

export type SiteCopy = typeof siteCopy;
