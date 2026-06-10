const pptxgen = require('pptxgenjs');
const sizeOf = require('image-size');
const fs = require('fs');
const path = require('path');

const FONT_FACE = 'Jalnan 2 TTF';
const assetsDir = path.join('C:/project/saerok-memory/피우다프로젝트/application_assets/mobile_scene_capture_all_language/ko');
const outputDir = path.join(__dirname, '..', 'output');
const outPath = path.join(outputDir, 'app_screen_slides.pptx');
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

const pptx = new pptxgen();
pptx.defineLayout({ name: 'LAYOUT_WIDE', width: 13.333, height: 7.5 });
pptx.layout = 'LAYOUT_WIDE';
pptx.author = 'OpenAI';
pptx.subject = 'App screen explanation slides';
pptx.title = 'App Screen Design Slides';
pptx.company = 'OpenAI';
pptx.lang = 'ko-KR';
pptx.theme = {
  headFontFace: FONT_FACE,
  bodyFontFace: FONT_FACE,
  lang: 'ko-KR'
};

const C = {
  primary: 'ff385c',
  ink: '222222',
  body: '3f3f3f',
  muted: '6a6a6a',
  hairline: 'dddddd',
  soft: 'f7f7f7',
  card: 'ffffff'
};

const FONT = {
  slideNum: 10,
  eyebrow: 12,
  title: 27,
  lead: 16,
  chip: 10.2,
  sectionTitle: 13,
  sectionTitleSmall: 12,
  bullet: 10.8,
  note: 10.2,
  evidenceTitle: 10.5,
  evidenceBody: 9.4
};

const LAYOUT = {
  slideWidth: 13.333,
  slideHeight: 7.5,
  imageBox: { x: 0.45, y: 0.34, w: 3.12, h: 6.78 },
  contentBox: { x: 3.65, y: 0.34, w: 9.51, h: 6.78 },
  rightPadding: 0.08
};

const FONT_FILES = ['Jalnan2TTF.ttf', 'Jalnan2.otf'];
const availableFontFile = FONT_FILES.map((name) => path.join(__dirname, '..', 'fonts', name)).find((p) => fs.existsSync(p));
if (!availableFontFile) {
  console.warn('WARNING: 여기어때잘난체 폰트 파일을 찾지 못했습니다. 기본 폰트 폴백을 사용합니다.');
}

const evidenceByIdx = {
  1: '근거축: 고령자 초기 진입 부담을 낮추기 위해 승인 동작 중심으로 과제를 시작하는 방식은 SAGE(Scharre et al., 2010/2021)의 자기관리형 다영역 루틴 운영에서 영감을 받았습니다.',
  2: '근거축: 홈의 동선 분리와 큰 우선순위 표시, 접근성 중심 구성은 W3C WAI Older Adults 접근성 가이드 원칙을 반영했습니다.',
  3: '근거축: 범주 단서 기반 지연회상은 Dubois et al. (2002) 5-Word Test의 인코딩-지연-재인 구조를 Haru화한 형태입니다(진단 점수화는 별도 수행 안함).',
  4: '근거축: 의미적 선택은 semantic fluency 계열의 범주 단서 전략에서 착안해 언어 반응의 전환 비용을 완화하도록 구성했습니다.',
  5: '근거축: 상황 이해형 판단은 GPCOG(Brodaty et al., 2002) 정보제공자 맥락의 접근을 루틴형으로 경량 적용했습니다.',
  6: '근거축: 저부하 수열-패턴 과제는 Digit Span/주의조절의 기본 원리를 참고해 반응 패턴을 장기 지표로 누적합니다.',
  7: '근거축: 날짜·요일 선택은 GPCOG/Brodaty(2002), MMSE/MoCA의 시간 지남력 항목 발췌를 루틴 점검용으로 축소 적용한 구성입니다.',
  8: '근거축: 작업기억 순/역방향 숫자 처리 과제는 작업기억(작업공간 + 조작) 동선을 관찰하는 안전한 경량 과제 흐름입니다.',
  9: '근거축: 범주형 말하기/입력 과제는 Henry & Crawford(2004) semantic fluency의 인출 동선을 브레인스토밍 형태로 경량화한 흐름입니다.',
  10: '근거축: 규칙 전환 기반 선택 과제는 TMT 계열의 집행기능 요구를 TMT-lite 난이도로 가벼운 형태로 재구성했습니다.',
  11: '근거축: 연상·연결 과제는 연계 기억 자극을 반복 노출하고 일상 전환 추적을 위한 간접 신호를 모으는 방식으로 설계했습니다.',
  12: '근거축: 순서 정렬은 일상 수행을 지원하는 계획성·시퀀싱 연습으로, 정답보다 처리를 연속 추적합니다.',
  13: '근거축: 청각 선택 과제는 멀티모달 전환을 통해 문해 의존도를 낮추고 반응 지속 패턴을 기록하는 보조 과제입니다.',
  14: '근거축: 비언어 그림 선택은 시각 판단 경로로 진입장벽을 낮추고 접근성을 높이기 위한 보조 과제 설계입니다.',
  15: '근거축: 도형 따라 그리기 과제는 dCDT류의 추적형 관측 원리를 반영해 점수화 대신 획수·정지 시간·경로를 정성 신호로 누적합니다.',
  16: '근거축: 음성 반복은 발화 연습 중심의 완화형 루틴으로, 음성 인식 실패 시 텍스트 fallback를 함께 운용해 접근성을 보장합니다.',
  17: '근거축: 지연회상 검증은 encode-delay-recognition 흐름을 통해 회상 흔적을 추적하고 임상 점수 대신 패턴을 누적 분석합니다.',
  18: '근거축: 개인 기억 수집은 회상 소재를 보호자 대화로 연결하기 위한 일상 맥락형 기록이며, 공유 동의 분리 저장 원칙을 따릅니다.',
  19: '근거축: 감정 라벨은 정서 맥락을 확보해 대화 연계를 돕는 메타 데이터로만 사용되며, 의학적 판정 근거로 쓰지 않습니다.',
  20: '근거축: 세션 요약은 정답률보다 완료 경험과 참여 연속성을 중심으로 동기 지속 신호를 제공합니다.',
  21: '근거축: 정원형 보상은 매일 참여를 시각적으로 지속화하는 동기부여 요소로, 의료 성적 지표와 분리해 운영됩니다.',
  22: '근거축: 상담사 보고는 수행 이력·공유 기억·보호자 관찰 데이터를 합쳐 대화 설계를 지원하는 트렌드 신호를 제공합니다.',
  23: '근거축: 보호자 보고는 AD8 (Galvin et al., 2005)와 GPCOG의 정보공유 철학을 참고해 일상 변화 요약만 공유 범위 내로 제시합니다.',
  24: '근거축: 데이터 삭제 및 공유 제어는 W3C WAI 접근성/개인정보보호 원칙 기반으로 사용자의 동의와 제어권을 우선 보장합니다.'
};

function imageSizingContain(imagePath, x, y, w, h) {
  const dimensions = sizeOf(imagePath);
  const imageRatio = dimensions.width / dimensions.height;
  const boxRatio = w / h;

  let finalW = w;
  let finalH = h;
  let finalX = x;
  let finalY = y;

  if (imageRatio > boxRatio) {
    finalH = w / imageRatio;
    finalY = y + (h - finalH) / 2;
  } else {
    finalW = h * imageRatio;
    finalX = x + (w - finalW) / 2;
  }

  return { x: finalX, y: finalY, w: finalW, h: finalH };
}

function addSlideNumber(slide, idx) {
  slide.addText(String(idx).padStart(2, '0'), {
    x: 12.15,
    y: 6.93,
    w: 0.55,
    h: 0.22,
    fontFace: FONT_FACE,
    fontSize: FONT.slideNum,
    color: C.muted,
    bold: true,
    margin: 0,
    align: 'right',
    breakLine: false,
    fit: 'shrink'
  });
}

function addBullets(slide, items, x, y, w) {
  const rowH = 0.40;
  items.forEach((text, i) => {
    const yy = y + i * rowH;
    slide.addShape(pptx.ShapeType.ellipse, {
      x,
      y: yy + (rowH - 0.10) / 2,
      w: 0.10,
      h: 0.10,
      fill: { color: C.primary },
      line: { color: C.primary, transparency: 100 }
    });
    slide.addText(text, {
      x: x + 0.22,
      y: yy,
      w: w - 0.22,
      h: rowH,
      fontFace: FONT_FACE,
      fontSize: FONT.bullet,
      color: C.body,
      margin: 0,
      breakLine: true,
      valign: 'middle',
      align: 'left',
      fit: 'shrink'
    });
  });
}

function makeSlide({ idx, img, eyebrow, title, lead, chips, bullets, note, evidence }) {
  const slide = pptx.addSlide();
  slide.background = { color: 'FFFFFF' };

  const rightX = LAYOUT.contentBox.x + LAYOUT.rightPadding;
  const rightW = LAYOUT.contentBox.w - (LAYOUT.rightPadding * 2);
  const bulletYStart = 4.06;
  const bulletRowH = 0.34;
  const bulletBottomY = bulletYStart + (bullets.length * bulletRowH);

  slide.addImage({
    path: img,
    ...imageSizingContain(img, LAYOUT.imageBox.x + 0.14, LAYOUT.imageBox.y + 0.14, LAYOUT.imageBox.w - 0.28, LAYOUT.imageBox.h - 0.28)
  });

  slide.addText(eyebrow, {
    x: rightX,
    y: 0.56,
    w: rightW,
    h: 0.52,
    fontFace: FONT_FACE,
    fontSize: FONT.eyebrow,
    bold: true,
    color: C.primary,
    margin: 0,
    breakLine: true,
    fit: 'shrink'
  });

  slide.addText(title, {
    x: rightX,
    y: 1.05,
    w: rightW,
    h: 1.18,
    fontFace: FONT_FACE,
    fontSize: FONT.title,
    bold: true,
    color: C.ink,
    margin: 0,
    breakLine: true,
    fit: 'shrink'
  });

  slide.addText(lead, {
    x: rightX + 0.02,
    y: 2.27,
    w: rightW - 0.02,
    h: 0.88,
    fontFace: FONT_FACE,
    fontSize: FONT.lead,
    color: C.body,
    breakLine: true,
    fit: 'shrink',
    margin: 0
  });

  let chipX = rightX;
  chips.forEach((chip) => {
    slide.addShape(pptx.ShapeType.roundRect, {
      x: chipX,
      y: 3.04,
      w: chip.w,
      h: 0.38,
      rectRadius: 0.18,
      fill: { color: chip.fill },
      line: { color: chip.line, transparency: 20, width: 1 }
    });
    slide.addText(chip.text, {
      x: chipX + 0.12,
      y: 3.10,
      w: chip.w - 0.24,
      h: 0.16,
      fontFace: FONT_FACE,
      fontSize: FONT.chip,
      bold: true,
      color: chip.color,
      margin: 0,
      align: 'center',
      breakLine: false,
      fit: 'shrink'
    });
    chipX += chip.w + 0.16;
  });

  slide.addText('화면 역할', {
    x: rightX,
    y: 3.74,
    w: 1.3,
    h: 0.28,
    fontFace: FONT_FACE,
    fontSize: FONT.sectionTitle,
    bold: true,
    color: C.ink,
    margin: 0,
    breakLine: false,
    fit: 'shrink'
  });

  addBullets(slide, bullets, rightX, bulletYStart, rightW);

  const designTitleY = bulletBottomY + 0.10;
  const designTextY = designTitleY + 0.22;
  const designTextHeight = 0.45;
  const evidenceTitleY = designTextY + 0.26;
  const evidenceTextY = evidenceTitleY + 0.20;
  const evidenceTextHeight = 0.82;

  slide.addText('디자인 포인트', {
    x: rightX,
    y: designTitleY,
    w: 1.3,
    h: 0.28,
    fontFace: FONT_FACE,
    fontSize: FONT.sectionTitleSmall,
    bold: true,
    color: C.ink,
    margin: 0,
    breakLine: false,
    fit: 'shrink'
  });

  slide.addText(note, {
    x: rightX,
    y: designTextY,
    w: rightW,
    h: designTextHeight,
    fontFace: FONT_FACE,
    fontSize: FONT.note,
    color: C.body,
    margin: 0,
    breakLine: true,
    fit: 'shrink',
    align: 'left',
    valign: 'top'
  });

  slide.addText('의학·인지과학 근거', {
    x: rightX,
    y: evidenceTitleY,
    w: rightW,
    h: 0.24,
    fontFace: FONT_FACE,
    fontSize: FONT.evidenceTitle,
    bold: true,
    color: C.ink,
    margin: 0,
    breakLine: false,
    fit: 'shrink'
  });

  slide.addText(evidence, {
    x: rightX,
    y: evidenceTextY,
    w: rightW,
    h: evidenceTextHeight,
    fontFace: FONT_FACE,
    fontSize: FONT.evidenceBody,
    color: C.muted,
    margin: 0,
    breakLine: true,
    align: 'left',
    valign: 'top',
    fit: 'shrink'
  });

  addSlideNumber(slide, idx);
}

const slideData = [
  {
    idx: 1,
    file: '01_레슨_시작화면.png',
    eyebrow: '레슨 시작 단계 · DAILY ROUTINE ONSET',
    title: '짧은 의도를 전달하고 과제 시작 동의를 유도하는 안내 화면',
    lead: '일일 루틴의 시작점에서 오늘의 인지 루틴 흐름을 한 번에 보여주어 진입 부담을 줄입니다.',
    chips: [
      { text: '과제 소개', w: 1.18, fill: 'FFF1F3', line: 'FFD1DA', color: C.primary },
      { text: '단일 클릭 진입', w: 1.42, fill: C.soft, line: C.hairline, color: C.ink },
      { text: '인지 워밍업', w: 1.11, fill: C.soft, line: C.hairline, color: C.ink }
    ],
    bullets: [
      '세션 시작 시 안내를 최소 3문장 이하로 축소',
      '시작 동작이 하나라 사용자가 다음 액션을 쉽게 예측',
      '개인 부담을 낮추기 위해 결과 압박 문구를 배제',
      '다음 장면으로의 이동만으로 학습 단계 전환을 단순화'
    ],
    note: '디자인 방향: 첫 화면은 “무엇을 할지”보다 “지금 할 수 있다”에 초점을 둔 안전한 진입 구조로 설계.'
  },
  {
    idx: 2,
    file: '02_메인_홈화면.png',
    eyebrow: '메인 허브 · LEARNING HUB',
    title: '메뉴 진입, 오늘 미션, 보상 현황을 통합한 시작면',
    lead: '매일 짧게 반복할 수 있도록 홈 화면에서 핵심 동선을 하나의 시각 경로로 정리합니다.',
    chips: [
      { text: '다중 진입점', w: 1.30, fill: 'FFF1F3', line: 'FFD1DA', color: C.primary },
      { text: '진행률 확인', w: 1.25, fill: C.soft, line: C.hairline, color: C.ink },
      { text: '접근성 우선', w: 1.32, fill: C.soft, line: C.hairline, color: C.ink }
    ],
    bullets: [
      '학습 시작 버튼과 보조 메뉴를 분리해 오동작 방지',
      '오늘 세션 진입 상태를 한 번에 파악할 수 있게 구성',
      '큰 타이포와 고대비 버튼으로 노인 사용자 가독성 보완',
      '다음 액션의 우선순위를 시각적으로 계층화'
    ],
    note: '디자인 방향: 홈은 기능 과부하를 피하고, 매일 루틴 실행률을 높이는 “일상 진입점”으로 동작.'
  },
  {
    idx: 3,
    file: '03_지연회상_단어_암기.png',
    eyebrow: '지연 회상 인코딩 · DELAYED VERBAL ENCODING',
    title: '5개 단어를 주제 단서 기반으로 암기·저장하는 단계',
    lead: '단어 집합을 카테고리 단서와 함께 제시해 즉시 암기 압박을 낮추고 지연 회상을 유도합니다.',
    chips: [
      { text: '지연 기억', w: 1.20, fill: 'FFF1F3', line: 'FFD1DA', color: C.primary },
      { text: '범주 단서', w: 1.14, fill: C.soft, line: C.hairline, color: C.ink },
      { text: 'MMSE 대체', w: 1.18, fill: C.soft, line: 'FFD1DA', color: C.primary }
    ],
    bullets: [
      '공식 검사 문항 복제 없이 자체 루틴으로 동작 구성',
      '카테고리 단서를 통해 학습자 부담을 제어',
      '오답보다 반응 패턴을 중심으로 데이터 축적',
      '후속 회상에서 성과를 연결해 장기 추적이 가능'
    ],
    note: '근거 방향: 장기 기억보다는 지연 회상 메타데이터(암기-회상 간 경과) 중심의 지원 신호를 생성.'
  },
  {
    idx: 4,
    file: '04_의미_선택.png',
    eyebrow: '의미 매핑 선택 · SEMANTIC ASSOCIATION',
    title: '의미 단서를 연결해 회상 부하를 낮추는 분기 선택',
    lead: '유사 단어를 일괄 비교하기보다 의미 기반 선택을 제공해 언어 반응의 안정성을 높입니다.',
    chips: [
      { text: '의미 인지', w: 1.08, fill: 'FFF1F3', line: 'FFD1DA', color: C.primary },
      { text: '선택형 반응', w: 1.32, fill: C.soft, line: C.hairline, color: C.ink },
      { text: '오입력 완화', w: 1.15, fill: C.soft, line: C.hairline, color: C.ink }
    ],
    bullets: [
      '복잡한 입력보다 카드 선택으로 실행 동선을 단축',
      '의미 단서가 있어 회상 부하를 단계적으로 완화',
      '잘못된 반응도 “학습 신호”로 저장해 대화 안내에 활용',
      '실제 성능보다 수행 과정의 일관성을 우선 반영'
    ],
    note: '근거 방향: 의미적 연상은 언어 기반 자극 처리 안정성에 기여한다는 근거를 일상 과제 수준으로 적용.'
  },
  {
    idx: 5,
    file: '05_상황_매칭.png',
    eyebrow: '상황 매칭 · CONTEXTUAL RECOGNITION',
    title: '일상적 상황과 기억 조각을 연결해 인지적 스위칭을 지원',
    lead: '단일 정답형에서 벗어나 “상황 이해 → 판단 → 선택”의 흐름으로 구성했습니다.',
    chips: [
      { text: '맥락 판단', w: 1.18, fill: 'FFF1F3', line: 'FFD1DA', color: C.primary },
      { text: '분류 훈련', w: 1.12, fill: C.soft, line: C.hairline, color: C.ink },
      { text: '낮은 난도', w: 1.10, fill: C.soft, line: C.hairline, color: C.ink }
    ],
    bullets: [
      '환경 단서를 제공해 선택 과정을 예측 가능하게 설계',
      '상황별 반응을 모아 보호자 대화 주제 후보로 전환',
      '혼동되는 항목은 중복 설명 없이 한 번에 정리',
      '과도한 점수 개념 없이 일상 실행 적합성 중심으로 누적'
    ],
    note: '디자인 방향: 기억 회상보다 “상황 이해도”의 연속된 흔적을 쌓아 상담 맥락을 보강.'
  },
  {
    idx: 6,
    file: '06_주의집중_숫자_패턴.png',
    eyebrow: '주의·집중 연속성 · ATTENTION PATTERN',
    title: '단순 숫자 연산 패턴으로 집중 유지 능력을 점진적으로 점검',
    lead: '짧고 명확한 규칙(감산/증가) 기반으로 집중 흔적을 수집해 피로를 낮춥니다.',
    chips: [
      { text: '주의 전환', w: 1.18, fill: 'FFF1F3', line: 'FFD1DA', color: C.primary },
      { text: '순차 처리', w: 1.16, fill: C.soft, line: C.hairline, color: C.ink },
      { text: '반응 속도', w: 1.10, fill: C.soft, line: C.hairline, color: C.ink }
    ],
    bullets: [
      '매우 단순한 수열 규칙으로 고령 사용자 적합성 유지',
      '정답 수보다 반응 시간과 선택 안정성을 추적',
      '오답 패턴은 경보가 아니라 지원 제안으로 변환',
      '의사결정 지표는 세션 단위가 아닌 누적 추세로 활용'
    ],
    note: '근거 방향: 지속적인 주의 집중 연습은 인지 리허설과 일상 주의 회복 훈련으로 분류.'
  },
  {
    idx: 7,
    file: '07_일상일정_인증.png',
    eyebrow: '시간 지남력 점검 · DAILY ORIENTATION',
    title: '오늘의 날짜·요일을 선택형으로 점검하는 입문 단계',
    lead: '시간 감각 과제는 공식 진단이 아니라 매일 루틴의 시간 지남력 점검 용도로 구성됩니다.',
    chips: [
      { text: '오리엔테이션', w: 1.25, fill: 'FFF1F3', line: 'FFD1DA', color: C.primary },
      { text: '선택형 UI', w: 1.20, fill: C.soft, line: C.hairline, color: C.ink },
      { text: '오탐 감소', w: 1.14, fill: C.soft, line: C.hairline, color: C.ink }
    ],
    bullets: [
      '정답 공개보다 먼저 현재 확인 항목을 명확히 제시',
      '모든 후보를 카드로 제시해 탐색 부담 완화',
      '버튼 비활성 조건으로 오입력 유입을 차단',
      '루틴 참여율 분석의 안정적인 시작 지표로 사용'
    ],
    note: '근거 방향: 시간-지남력 과제는 단일 지표가 아닌 경향 분석용 신호로만 활용.'
  },
  {
    idx: 8,
    file: '08_작업기억_숫자기억.png',
    eyebrow: '작업기억 점검 · WORKING MEMORY',
    title: '숫자 기억을 통한 순차 보존력 연습',
    lead: '짧은 길이의 수열을 순방향/역순으로 처리해 작업기억의 기본 동선을 관찰합니다.',
    chips: [
      { text: '작업기억', w: 1.10, fill: 'FFF1F3', line: 'FFD1DA', color: C.primary },
      { text: '전/역방향', w: 1.20, fill: C.soft, line: C.hairline, color: C.ink },
      { text: '안정형 난이도', w: 1.30, fill: C.soft, line: C.hairline, color: C.ink }
    ],
    bullets: [
      '짧은 스팬부터 시작해 실패 불안을 줄임',
      '입력 방식은 말하기/타이핑을 동등하게 처리',
      '반응 횟수와 힌트 사용량을 함께 수집',
      '의학적 판정이 아닌 일상적 루틴 신호로 유지'
    ],
    note: '근거 방향: 작업기억 피드백은 MMSE/표준 점수로 치환하지 않고, 개인 패턴 로그로 저장.'
  },
  {
    idx: 9,
    file: '09_단어_연상_연습.png',
    eyebrow: '언어 유창성 연습 · VERBAL FLUENCY',
    title: '범주 기반으로 빠른 연상 반응을 도와주는 과제',
    lead: '짧은 시간 제약 내에서 말하거나 입력해 어휘 접근 동선을 관찰합니다.',
    chips: [
      { text: '범주 생성', w: 0.98, fill: 'FFF1F3', line: 'FFD1DA', color: C.primary },
      { text: '30초 타이머', w: 1.20, fill: C.soft, line: C.hairline, color: C.ink },
      { text: '언어 회상', w: 1.02, fill: C.soft, line: C.hairline, color: C.ink }
    ],
    bullets: [
      '범주 힌트를 먼저 제시해 불필요한 불안을 줄임',
      '시간 제한은 과제 몰입을 위한 장치로만 사용',
      '중복 응답/무반응 등은 실패가 아니라 관측 변수로 처리',
      '결과는 음성 연습, 대화 유도 항목에 반영'
    ],
    note: '근거 방향: 언어 유창성 과제는 진단 도구가 아니라 대화 자극성 유지 및 정서표현 보조용으로 운용.'
  },
  {
    idx: 10,
    file: '10_주의전환_선_잇기.png',
    eyebrow: '주의 전환 연습 · SET-SHIFTING',
    title: '연결고리 그리기를 통해 규칙 전환 적응성을 연습',
    lead: '선 연결형 과제는 규칙에 충실한 선택과 전환 반응을 요구해 주의 조절을 점검합니다.',
    chips: [
      { text: '주의 전환', w: 1.14, fill: 'FFF1F3', line: 'FFD1DA', color: C.primary },
      { text: '규칙 추적', w: 1.14, fill: C.soft, line: C.hairline, color: C.ink },
      { text: '오류 허용', w: 1.00, fill: C.soft, line: C.hairline, color: C.ink }
    ],
    bullets: [
      '복잡한 도형 대신 단순한 경로 규칙으로 진입',
      '경로 실패는 즉시 중단 대신 가이드 재제시로 완화',
      '연결 횟수·재시도 횟수로 진행 패턴 기록',
      '집중 저하 징후는 다음 과제 추천 강도로 반영'
    ],
    note: '근거 방향: 집행 기능은 TMT-lite 난이도로 완화해 공식 TMT와 구분해 설명.'
  },
  {
    idx: 11,
    file: '11_단어쌍_매칭.png',
    eyebrow: '연결 기억 연습 · ASSOCIATIVE LINKING',
    title: '단어쌍 매칭으로 연상-연결 기억 동선을 점검',
    lead: '쌍 관계를 빠르게 학습하고 회상하는 방식은 단기 연상 연습 목적의 보조 과제입니다.',
    chips: [
      { text: '연결 기억', w: 1.18, fill: 'FFF1F3', line: 'FFD1DA', color: C.primary },
      { text: '매칭 과제', w: 1.20, fill: C.soft, line: C.hairline, color: C.ink },
      { text: '저부담', w: 0.84, fill: C.soft, line: C.hairline, color: C.ink }
    ],
    bullets: [
      '명료한 짝짓기 규칙으로 학습자 혼란 최소화',
      '시각적 단서와 언어 단서를 병행해 접근성 확보',
      '완성/미완성 모두 관찰 가능한 결과로 저장',
      '개인 회상 과제와 직접 연결되는 대화 힌트로 변환'
    ],
    note: '근거 방향: 연상과 짝맞추기 패턴은 기억 연결 강도 추정의 기초 신호로 사용.'
  },
  {
    idx: 12,
    file: '12_순서_기억_정렬.png',
    eyebrow: '순서 기억 정렬 · SEQUENTIAL ORDER',
    title: '항목의 순서를 정렬해 계획·정렬 인지의 연습 효과 확보',
    lead: '일상 동작 정렬을 모사한 과제로, 계획성 있게 배열하는 과정을 연습합니다.',
    chips: [
      { text: '순차 처리', w: 1.12, fill: 'FFF1F3', line: 'FFD1DA', color: C.primary },
      { text: '규칙 준수', w: 1.18, fill: C.soft, line: C.hairline, color: C.ink },
      { text: '완료 신호', w: 1.05, fill: C.soft, line: C.hairline, color: C.ink }
    ],
    bullets: [
      '단계의 시작/중간/끝을 명시해 정렬 혼선을 줄임',
      '오답일 때 즉시 정답 제시 대신 다음 단계 가이드',
      '반복 횟수와 마지막 완료 시간을 누적 기록',
      '일상 계획지원 메시지로 쉽게 연결'
    ],
    note: '근거 방향: 순차기억은 일상 수행의 예측 가능성 확보에 기여하는 루틴형 지표로 활용.'
  },
  {
    idx: 13,
    file: '13_듣기_선택.png',
    eyebrow: '청각 인식 과제 · AUDITORY ATTENTION',
    title: '소리로 제시된 항목을 선택해 청각-인지 전환을 점검',
    lead: '입력 부담을 줄이고 청각 기반 반응을 확보하는 보조 과제 단계입니다.',
    chips: [
      { text: '청각 주의', w: 1.18, fill: 'FFF1F3', line: 'FFD1DA', color: C.primary },
      { text: '선택형 반응', w: 1.25, fill: C.soft, line: C.hairline, color: C.ink },
      { text: '멀티모달', w: 1.00, fill: C.soft, line: C.hairline, color: C.ink }
    ],
    bullets: [
      '시각 입력이 어려운 상황에서 대체 경로 제공',
      '오디오 재생 상태를 기준으로 응답 흐름 동기화',
      '오답은 반복 노출보다 리듬 조절로 보정',
      '기기별 오디오 환경은 장애물 대신 로그로만 반영'
    ],
    note: '근거 방향: 말단 진단 대신 청각 반응 시간과 정확도를 루틴 지속성 판단에 사용.'
  },
  {
    idx: 14,
    file: '14_그림_선택.png',
    eyebrow: '시각 판단 과제 · VISUAL SELECTION',
    title: '그림을 보고 정답을 고르는 비언어 선택형 활동',
    lead: '시각 자극을 이용한 반응 연습으로 비언어적 인지 경로를 보완합니다.',
    chips: [
      { text: '비언어 반응', w: 1.18, fill: 'FFF1F3', line: 'FFD1DA', color: C.primary },
      { text: '패턴 매칭', w: 1.12, fill: C.soft, line: C.hairline, color: C.ink },
      { text: '저입력', w: 0.84, fill: C.soft, line: C.hairline, color: C.ink }
    ],
    bullets: [
      '이미지 비교를 통해 반응 선택을 단순화',
      '텍스트 의존도를 낮추어 학습 부담 완화',
      '클릭 오류는 즉시 보정 가능한 선택 구조 사용',
      '가벼운 시각 판단 기록이 대화 추천 후보로 유입'
    ],
    note: '근거 방향: 비언어 과제는 문해 장벽이 큰 사용자군의 접근성을 높이는 보완 기능.'
  },
  {
    idx: 15,
    file: '15_도형_그리기.png',
    eyebrow: '도형 그리기 · VISUOSPATIAL PRACTICE',
    title: '간단한 모양을 따라 그리고 스탬프 흔적을 기록',
    lead: '드로잉 과제는 정밀도보다 규칙 유지와 경향성 파악이 핵심입니다.',
    chips: [
      { text: '시지각', w: 0.84, fill: 'FFF1F3', line: 'FFD1DA', color: C.primary },
      { text: '그림 추적', w: 1.05, fill: C.soft, line: C.hairline, color: C.ink },
      { text: '메트릭 수집', w: 1.06, fill: C.soft, line: C.hairline, color: C.ink }
    ],
    bullets: [
      '획 수/정지 시간/리트라이 같은 메타를 구조화',
      '정답 강요 없이 수행 과정을 기록',
      '평균 성능 비교보다 개인 패턴 추적을 우선',
      '전문가 상담 시 변화 추세를 해석 참고 신호로 전달'
    ],
    note: '근거 방향: 정교한 임상 채점이 아닌, dCDT류 원리에 기반한 자기 관측형 기록입니다.'
  },
  {
    idx: 16,
    file: '16_음성_반복.png',
    eyebrow: '음성 반복 · SPEECH-ORAL ROUTINE',
    title: '짧은 음성 반복으로 발음·발화 흐름을 유지',
    lead: '문장 반복 연습을 통해 구두 반응의 이완성과 표현 의지를 지원합니다.',
    chips: [
      { text: '언어 생산', w: 1.10, fill: 'FFF1F3', line: 'FFD1DA', color: C.primary },
      { text: '음성 입력', w: 1.10, fill: C.soft, line: C.hairline, color: C.ink },
      { text: 'fallback', w: 0.95, fill: 'FFF1F3', line: 'FFD1DA', color: C.primary }
    ],
    bullets: [
      '브라우저 API 상태에 따라 텍스트 fallback 병행',
      '발화 실패 시 보상 메시지 없이 가볍게 재시도',
      '음성 인식 성공률만으로 해석하지 않음',
      '안정적인 대화 준비 데이터를 장기 누적'
    ],
    note: '근거 방향: 음성 모듈은 보조 루틴으로 두고, 의료적 발성 판정은 수행하지 않습니다.'
  },
  {
    idx: 17,
    file: '17_지연회상_단어_회상.png',
    eyebrow: '지연 회상 검증 · DELAYED RECALL CHECK',
    title: '직전 암기 단서를 기준으로 회상 정확도와 맥락 반응을 확인',
    lead: '암기와 시간이 지난 뒤 다시 묻는 단계에서 회상 양상을 추적해 다음 과제를 조정합니다.',
    chips: [
      { text: '회상 검증', w: 1.20, fill: 'FFF1F3', line: 'FFD1DA', color: C.primary },
      { text: '선택형', w: 0.95, fill: C.soft, line: C.hairline, color: C.ink },
      { text: '시간 경과', w: 1.00, fill: C.soft, line: C.hairline, color: C.ink }
    ],
    bullets: [
      '단답형 채점이 아닌 회상 경향(보류/회상/혼동) 기록',
      '단서 기반 재회상은 과부하 없이 수행 가능',
      '회상 실패를 위험 신호로만 고정하지 않음',
      '일관되게 낮을 경우 보호자 공유 메시지 권장'
    ],
    note: '근거 방향: 표준 기억력 검사와 달리 결과는 Haru 내부 지원 신호로만 사용.'
  },
  {
    idx: 18,
    file: '18_개인기억_이야기.png',
    eyebrow: '개인 기억 수집 · PERSONAL MEMORY CAPTURE',
    title: '구체적 사건을 기록해 장기 대화 재료를 축적',
    lead: '기능의 핵심은 추상 질문이 아니라 사용자가 실제로 기억한 사건의 단서를 구조화하는 것입니다.',
    chips: [
      { text: '자기기록', w: 0.95, fill: 'FFF1F3', line: 'FFD1DA', color: C.primary },
      { text: '감정 태그', w: 1.06, fill: C.soft, line: C.hairline, color: C.ink },
      { text: '공유 제어', w: 1.08, fill: C.soft, line: C.hairline, color: C.ink }
    ],
    bullets: [
      '실제 사건·장소·사람을 입력해 의미 있는 기록 생성',
      '요약 텍스트는 회상 과제 재활용 기반 자료로 분류',
      '개인정보와 공유 플래그를 분리하여 저장',
      '보호자 화면은 동의 기반 데이터만 노출'
    ],
    note: '근거 방향: 보호자 지원을 위한 맥락형 기억 재사용 데이터를 확보하는 핵심 단계.'
  },
  {
    idx: 19,
    file: '19_개인기억_감정_선택.png',
    eyebrow: '감정 라벨링 · AFFECT TAGGING',
    title: '기억과 감정을 함께 기록해 후속 대화를 부드럽게 연결',
    lead: '기억 내용에 감정 라벨을 붙여 상담 대화 품질과 복기 지속성을 높입니다.',
    chips: [
      { text: '정서 매핑', w: 1.12, fill: 'FFF1F3', line: 'FFD1DA', color: C.primary },
      { text: '관찰 지원', w: 1.10, fill: C.soft, line: C.hairline, color: C.ink },
      { text: '안전한 저장', w: 1.12, fill: C.soft, line: C.hairline, color: C.ink }
    ],
    bullets: [
      '감정을 단일 레이블로 정리해 인지 과제와 결합',
      '개별 감정 선택은 다음 루틴의 동기 부여로 연계',
      '감정 메타는 상담용 주제 제안 생성에 사용',
      '개인 민감 정보는 비공개 기본값으로 관리'
    ],
    note: '근거 방향: 정서 라벨은 진단 목적이 아닌 상호작용 연속성 확보를 위한 메타 데이터.'
  },
  {
    idx: 20,
    file: '20_세션_결과.png',
    eyebrow: '세션 요약 · DAILY SESSION SUMMARY',
    title: '하루 세션 수행 결과를 간결하게 정리해 정서적 동기 부여 제공',
    lead: '실패/정답 수보다 수행 흐름, 완료율, 다음 추천 순서에 초점을 둡니다.',
    chips: [
      { text: '성과 요약', w: 1.05, fill: 'FFF1F3', line: 'FFD1DA', color: C.primary },
      { text: '다음 추천', w: 1.06, fill: C.soft, line: C.hairline, color: C.ink },
      { text: '성장 신호', w: 1.00, fill: C.soft, line: C.hairline, color: C.ink }
    ],
    bullets: [
      '단일 세션 지표를 일간 축적으로 누적',
      '완료 경험 자체를 강화해 재방문 동기 부여',
      '결과 문구는 알림성보다 진정성 우선',
      '위험 신호는 대안 제안으로만 표현'
    ],
    note: '근거 방향: 진단 라벨 없이도 루틴 지속률과 대화 준비성을 추적 가능.'
  },
  {
    idx: 21,
    file: '21_기억_정원.png',
    eyebrow: '기억 정원 보상 · MEMORY GARDEN',
    title: '실행 이력을 시각적으로 기록하는 정원형 보상 인터페이스',
    lead: '결과를 게임 점수로 환원하지 않고 “회복된 일상 루틴’의 흔적”로 시각화합니다.',
    chips: [
      { text: '습관 강화', w: 1.12, fill: 'FFF1F3', line: 'FFD1DA', color: C.primary },
      { text: '성취 시각화', w: 1.18, fill: C.soft, line: C.hairline, color: C.ink },
      { text: '경쟁 배제', w: 1.00, fill: C.soft, line: C.hairline, color: C.ink }
    ],
    bullets: [
      '매일의 참여 행위를 식물 성장으로 직관 변환',
      '실패 패널티보다 참여 지속성에 보상 신호 집중',
      '과도한 비교 문구 없이 개인 기준으로만 진행',
      '보상은 다음 루틴 유도 장치로만 활용'
    ],
    note: '근거 방향: 정서 안정·동기부여를 목표로 한 행동 설계 요소로, 의료 성적 지표와 분리.'
  },
  {
    idx: 22,
    file: '22_상담사_보고서.png',
    eyebrow: '상담사 보고서 · COUNSELOR REPORT',
    title: '세션 메타를 기반으로 상담 대화 준비안을 제공하는 화면',
    lead: '의학 진단이 아닌 지속 관찰 정보로, 상담사가 다음 대면 대화를 설계하도록 돕습니다.',
    chips: [
      { text: '참여 패턴', w: 1.15, fill: 'FFF1F3', line: 'FFD1DA', color: C.primary },
      { text: '지원 신호', w: 1.12, fill: C.soft, line: C.hairline, color: C.ink },
      { text: '보호자 연동', w: 1.16, fill: C.soft, line: C.hairline, color: C.ink }
    ],
    bullets: [
      '개인 동의된 정보만 보호 기준에 맞춰 노출',
      '완료율·회의/회상 데이터로 대화 주제 우선순위 제안',
      '경고 표현은 예방·수치화보다 조기 상의 항목 중심',
      '전문가 조언 연계 버튼으로 액션 연결'
    ],
    note: '근거 방향: 상담 보조 보고서는 임상 진단 레이블 없이, 루틴 트렌드 중심으로 작성.'
  },
  {
    idx: 23,
    file: '23_보호자_보고서.png',
    eyebrow: '보호자 보고서 · CAREGIVER DASHBOARD',
    title: '보호자가 일상에서 확인할 수 있도록 요약한 공유형 화면',
    lead: '개인정보 보호를 유지하면서 가족 대화에 즉시 쓸 수 있는 핵심만 제공합니다.',
    chips: [
      { text: '공유 요약', w: 1.10, fill: 'FFF1F3', line: 'FFD1DA', color: C.primary },
      { text: '일상 지표', w: 1.08, fill: C.soft, line: C.hairline, color: C.ink },
      { text: '안전 규칙', w: 1.04, fill: C.soft, line: C.hairline, color: C.ink }
    ],
    bullets: [
      '완료 과제, 미완료 항목, 남은 과제를 한 화면에 정렬',
      '공개 범위가 설정된 기억만 보호자 보기에 노출',
      '과도한 경고 대신 대화권장 문구로 전환',
      '장기 추세를 가족 회의 안건으로 변환'
    ],
    note: '근거 방향: 보호자 화면은 의학 점수 대신 돌봄 우선순위를 돕는 운영 신호 중심.'
  },
  {
    idx: 24,
    file: '24_설정_삭제_영역.png',
    eyebrow: '데이터 관리 · DATA SAFETY',
    title: '데이터 삭제 및 환경설정에서 개인 제어권을 보장',
    lead: '로컬 저장 데이터의 삭제, 초기화, 언어 전환 등을 한 화면에서 관리합니다.',
    chips: [
      { text: '동의 기반', w: 1.07, fill: 'FFF1F3', line: 'FFD1DA', color: C.primary },
      { text: '삭제 안내', w: 1.05, fill: C.soft, line: C.hairline, color: C.ink },
      { text: '언어 전환', w: 1.03, fill: C.soft, line: C.hairline, color: C.ink }
    ],
    bullets: [
      '공유 플래그와 데이터 범위를 명시적으로 분리',
      '일회성 삭제 동작을 명확한 안내 문구로 보완',
      '언어 변경이 루틴 진행성에 영향 주지 않도록 설계',
      '민감 데이터 처리 원칙을 사용자 동작으로 표현'
    ],
    note: '근거 방향: 프라이버시는 Haru 신뢰의 핵심이며, 데이터 관리 기능은 증거적 지원의 전제 조건.'
  }
];

slideData.forEach((item) => {
  makeSlide({
    idx: item.idx,
    img: path.join(assetsDir, item.file),
    eyebrow: item.eyebrow,
    title: item.title,
    lead: item.lead,
    chips: item.chips,
    bullets: item.bullets,
    note: item.note,
    evidence: evidenceByIdx[item.idx] || '근거축: 로컬 자산과 사용자 실험 흐름 기반으로 구성.'
  });
});

pptx.writeFile({ fileName: outPath });
