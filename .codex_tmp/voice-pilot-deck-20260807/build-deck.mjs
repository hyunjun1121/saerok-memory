import fs from "node:fs/promises";
import path from "node:path";
import { Presentation, PresentationFile } from "@oai/artifact-tool";

const ROOT = "C:/project/saerok-memory";
const OUT_DIR = `${ROOT}/.codex_tmp/voice-pilot-deck-20260807/rendered`;
const FINAL_PPTX = `${ROOT}/피우다프로젝트/발표자료/Haru_음성UX_사전검증_발표자료.pptx`;

const ASSETS = {
  logo: `${ROOT}/public/assets/haru/logo.png`,
  voiceScreen: `${ROOT}/피우다프로젝트/application_assets/auto_screenshots/ko/19_오늘_하루_말하기.png`,
  dropoutChart: `${ROOT}/docs/voice-pilot-sample-20x7/analysis/charts/png/06-dropoff-hotspots.png`,
  sttChart: `${ROOT}/docs/voice-pilot-sample-20x7/analysis/charts/png/05-stt-comparison.png`,
};

const W = 1280;
const H = 720;
const FONT = "Pretendard";
const COLORS = {
  white: "#FFFFFF",
  ink: "#232528",
  muted: "#68707C",
  lightMuted: "#9AA1AA",
  line: "#E7E1D8",
  warm: "#FBF7F0",
  coral: "#F05E52",
  coralDark: "#B7372E",
  coralPale: "#FFF0ED",
  green: "#4A7E50",
  greenDark: "#2F6036",
  greenPale: "#EDF6EC",
  amber: "#E6A035",
  amberPale: "#FFF6E4",
};

async function readBlob(filePath) {
  const bytes = await fs.readFile(filePath);
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
}

async function writeBlob(filePath, blob) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, new Uint8Array(await blob.arrayBuffer()));
}

function addText(slide, {
  name,
  text,
  x,
  y,
  w,
  h,
  size = 22,
  color = COLORS.ink,
  bold = false,
  align = "left",
  valign = "top",
  lineSpacing = 1.08,
  fill = "none",
  insets = { left: 0, right: 0, top: 0, bottom: 0 },
  autoFit = "shrinkText",
}) {
  const shape = slide.shapes.add({
    geometry: "textbox",
    name,
    position: { left: x, top: y, width: w, height: h },
    fill,
    line: { style: "solid", fill: "none", width: 0 },
  });
  shape.text = text;
  shape.text.style = {
    typeface: FONT,
    fontSize: size,
    bold,
    color,
    alignment: align,
    verticalAlignment: valign,
    lineSpacing,
    autoFit,
    insets,
  };
  return shape;
}

function addPanel(slide, {
  name,
  x,
  y,
  w,
  h,
  fill = COLORS.warm,
  stroke = COLORS.line,
  strokeWidth = 1,
  radius = 24,
  shadow = "shadow-none",
}) {
  return slide.shapes.add({
    geometry: "roundRect",
    name,
    position: { left: x, top: y, width: w, height: h },
    fill,
    line: { style: "solid", fill: stroke, width: strokeWidth },
    borderRadius: radius,
    shadow,
  });
}

function addRule(slide, x, y, w, color = COLORS.line, width = 1) {
  return slide.shapes.add({
    geometry: "line",
    position: { left: x, top: y, width: w, height: 0 },
    fill: "none",
    line: { style: "solid", fill: color, width },
  });
}

async function addImage(slide, { filePath, alt, x, y, w, h, fit = "contain", radius = 18 }) {
  return slide.images.add({
    blob: await readBlob(filePath),
    contentType: "image/png",
    alt,
    fit,
    position: { left: x, top: y, width: w, height: h },
    geometry: "roundRect",
    borderRadius: radius,
  });
}

async function addChrome(slide, number, section) {
  await addImage(slide, {
    filePath: ASSETS.logo,
    alt: "Haru logo",
    x: 1110,
    y: 38,
    w: 104,
    h: 54,
  });
  addText(slide, {
    name: `section-${number}`,
    text: section,
    x: 70,
    y: 40,
    w: 420,
    h: 26,
    size: 18,
    color: COLORS.coralDark,
    bold: true,
    autoFit: "none",
  });
  addRule(slide, 70, 674, 1140, COLORS.line, 1);
  addText(slide, {
    name: `footer-left-${number}`,
    text: "Haru Voice UX · PRE-PILOT",
    x: 70,
    y: 684,
    w: 320,
    h: 20,
    size: 15,
    color: COLORS.lightMuted,
    autoFit: "none",
  });
  addText(slide, {
    name: `footer-caution-${number}`,
    text: "합성 시뮬레이션 · 실제 사용자/실제 음성 결과 아님",
    x: 700,
    y: 682,
    w: 430,
    h: 22,
    size: 16,
    color: COLORS.coralDark,
    bold: true,
    align: "right",
    autoFit: "none",
  });
  addText(slide, {
    name: `page-${number}`,
    text: String(number).padStart(2, "0"),
    x: 1150,
    y: 682,
    w: 60,
    h: 22,
    size: 16,
    color: COLORS.lightMuted,
    bold: true,
    align: "right",
    autoFit: "none",
  });
}

function addNotes(slide, lines) {
  slide.speakerNotes.textFrame.setText([
    "[Sources]",
    ...lines.map((line) => `- ${line}`),
    "[/Sources]",
  ]);
  slide.speakerNotes.setVisible(true);
}

async function buildSlide1(presentation) {
  const slide = presentation.slides.add();
  slide.background.fill = COLORS.white;
  await addChrome(slide, 1, "사용 흐름 사전 검증");

  addText(slide, {
    name: "s1-title",
    text: "실증 전 사용 흐름\n계측 설계",
    x: 70,
    y: 104,
    w: 720,
    h: 132,
    size: 56,
    bold: true,
    lineSpacing: 0.92,
  });
  addText(slide, {
    name: "s1-subtitle",
    text: "50~70대 현장 파일럿을 위한\n참여·이탈·재시도·STT 흐름 연결",
    x: 72,
    y: 254,
    w: 660,
    h: 82,
    size: 29,
    color: COLORS.muted,
    lineSpacing: 1.12,
  });

  addPanel(slide, {
    name: "s1-device-backdrop",
    x: 860,
    y: 102,
    w: 346,
    h: 536,
    fill: COLORS.greenPale,
    stroke: "none",
    radius: 30,
  });
  addPanel(slide, {
    name: "s1-device-frame",
    x: 897,
    y: 120,
    w: 272,
    h: 484,
    fill: COLORS.white,
    stroke: COLORS.ink,
    strokeWidth: 2,
    radius: 24,
    shadow: "shadow-md",
  });
  await addImage(slide, {
    filePath: ASSETS.voiceScreen,
    alt: "Haru voice exercise in listening state",
    x: 904,
    y: 127,
    w: 258,
    h: 470,
    fit: "cover",
    radius: 18,
  });

  const stats = [
    { value: "20", label: "샘플 프로필", color: COLORS.coral },
    { value: "140", label: "세션 기록", color: COLORS.green },
    { value: "832", label: "문항 로그", color: COLORS.coral },
    { value: "5,328", label: "상호작용 이벤트", color: COLORS.green },
  ];
  stats.forEach((stat, index) => {
    const x = 72 + index * 188;
    addText(slide, {
      name: `s1-stat-value-${index}`,
      text: stat.value,
      x,
      y: 424,
      w: 170,
      h: 56,
      size: 46,
      color: stat.color,
      bold: true,
      autoFit: "none",
    });
    addText(slide, {
      name: `s1-stat-label-${index}`,
      text: stat.label,
      x,
      y: 486,
      w: 170,
      h: 32,
      size: 20,
      color: COLORS.muted,
      bold: true,
      autoFit: "none",
    });
    if (index < stats.length - 1) {
      slide.shapes.add({
        geometry: "line",
        position: { left: x + 166, top: 432, width: 0, height: 78 },
        fill: "none",
        line: { style: "solid", fill: COLORS.line, width: 1 },
      });
    }
  });

  addPanel(slide, {
    name: "s1-proof-strip",
    x: 72,
    y: 548,
    w: 718,
    h: 76,
    fill: COLORS.warm,
    stroke: COLORS.line,
    radius: 18,
  });
  addText(slide, {
    name: "s1-proof-text",
    text: "한 문항의 탭부터 음성 전사까지, 같은 세션 안에서 추적",
    x: 98,
    y: 568,
    w: 664,
    h: 36,
    size: 24,
    color: COLORS.ink,
    bold: true,
    autoFit: "none",
  });

  addNotes(slide, [
    "C:/project/saerok-memory/docs/voice-pilot-sample-20x7/manifest.json — sample provenance, 20 profiles, 140 participant-days.",
    "C:/project/saerok-memory/docs/voice-pilot-sample-20x7/operational_export.json — 832 question attempts and 5,328 telemetry events.",
    "C:/project/saerok-memory/피우다프로젝트/application_assets/auto_screenshots/ko/19_오늘_하루_말하기.png — internal Haru product capture.",
  ]);
}

async function buildSlide2(presentation) {
  const slide = presentation.slides.add();
  slide.background.fill = COLORS.white;
  await addChrome(slide, 2, "문제 가설");

  addText(slide, {
    name: "s2-title",
    text: "샘플 흐름의 말하기 구간 이탈 집중",
    x: 70,
    y: 96,
    w: 1020,
    h: 68,
    size: 50,
    bold: true,
    autoFit: "none",
  });
  addText(slide, {
    name: "s2-subtitle",
    text: "실제 파일럿 우선 계측 지점과 원인 코드 설계",
    x: 72,
    y: 166,
    w: 940,
    h: 40,
    size: 24,
    color: COLORS.muted,
    autoFit: "none",
  });

  addPanel(slide, {
    name: "s2-chart-frame",
    x: 68,
    y: 224,
    w: 726,
    h: 424,
    fill: COLORS.white,
    stroke: COLORS.line,
    radius: 22,
    shadow: "shadow-sm",
  });
  await addImage(slide, {
    filePath: ASSETS.dropoutChart,
    alt: "Sample voice question dropout hotspot chart",
    x: 82,
    y: 236,
    w: 698,
    h: 400,
    fit: "contain",
    radius: 14,
  });

  addText(slide, {
    name: "s2-big-rate",
    text: "10.0%",
    x: 842,
    y: 240,
    w: 330,
    h: 82,
    size: 64,
    color: COLORS.coral,
    bold: true,
    autoFit: "none",
  });
  addText(slide, {
    name: "s2-big-rate-label",
    text: "음성 문항 이탈\n14 / 140",
    x: 846,
    y: 326,
    w: 310,
    h: 68,
    size: 24,
    color: COLORS.ink,
    bold: true,
  });
  addRule(slide, 844, 418, 334, COLORS.line, 1);
  addText(slide, {
    name: "s2-hotspot-rate",
    text: "20.0%",
    x: 844,
    y: 442,
    w: 240,
    h: 58,
    size: 46,
    color: COLORS.coralDark,
    bold: true,
    autoFit: "none",
  });
  addText(slide, {
    name: "s2-hotspot-label",
    text: "D1_Q5 · D4_Q5\n각 4 / 20",
    x: 846,
    y: 506,
    w: 300,
    h: 62,
    size: 22,
    color: COLORS.muted,
    bold: true,
  });
  addText(slide, {
    name: "s2-takeaway",
    text: "정확도만이 아니라\n말하기 전후 전체를 측정",
    x: 844,
    y: 584,
    w: 330,
    h: 62,
    size: 24,
    color: COLORS.greenDark,
    bold: true,
  });

  addNotes(slide, [
    "C:/project/saerok-memory/docs/voice-pilot-sample-20x7/analysis/metrics.json — voiceOperational and dropoutHotspots sample metrics.",
    "C:/project/saerok-memory/docs/voice-pilot-sample-20x7/analysis/charts/png/06-dropoff-hotspots.png — generated sample chart.",
    "C:/project/saerok-memory/src/features/analytics/syntheticVoicePilot.ts — outcomes assigned from fixed TARGETS; not observed user behavior.",
  ]);
}

async function buildSlide3(presentation) {
  const slide = presentation.slides.add();
  slide.background.fill = COLORS.white;
  await addChrome(slide, 3, "제품 개선안");

  addText(slide, {
    name: "s3-title",
    text: "사용자 발화 부담을 낮추는 음성 경험",
    x: 70,
    y: 96,
    w: 1040,
    h: 68,
    size: 50,
    bold: true,
    autoFit: "none",
  });
  addText(slide, {
    name: "s3-subtitle",
    text: "말하기 부담과 입력 불확실성을 줄이는 세 가지 개입",
    x: 72,
    y: 166,
    w: 900,
    h: 40,
    size: 24,
    color: COLORS.muted,
    autoFit: "none",
  });

  addPanel(slide, {
    name: "s3-device-frame",
    x: 82,
    y: 224,
    w: 274,
    h: 424,
    fill: COLORS.white,
    stroke: COLORS.ink,
    strokeWidth: 2,
    radius: 24,
    shadow: "shadow-md",
  });
  await addImage(slide, {
    filePath: ASSETS.voiceScreen,
    alt: "Haru voice screen with active listening state",
    x: 89,
    y: 231,
    w: 260,
    h: 410,
    fit: "cover",
    radius: 18,
  });

  const items = [
    {
      n: "01",
      title: "보이는 입력 반응",
      body: "빨간 듣기 상태와 움직이는 파형으로\n마이크가 반응하는 순간을 바로 확인",
      color: COLORS.coral,
    },
    {
      n: "02",
      title: "부담을 낮춘 안내",
      body: "“또박또박 말하려 애쓰지 않아도 됩니다.\n평소처럼 편하게 말씀하세요.”",
      color: COLORS.green,
    },
    {
      n: "03",
      title: "같은 Qwen, 더 나은 입력",
      body: "DC 제거 · 80 Hz high-pass · bounded RMS로\n입력 품질을 보정하는 비교 구성",
      color: COLORS.amber,
    },
  ];
  items.forEach((item, index) => {
    const y = 232 + index * 136;
    addText(slide, {
      name: `s3-item-number-${index}`,
      text: item.n,
      x: 420,
      y,
      w: 74,
      h: 48,
      size: 34,
      color: item.color,
      bold: true,
      autoFit: "none",
    });
    addText(slide, {
      name: `s3-item-title-${index}`,
      text: item.title,
      x: 510,
      y,
      w: 620,
      h: 42,
      size: 30,
      color: COLORS.ink,
      bold: true,
      autoFit: "none",
    });
    addText(slide, {
      name: `s3-item-body-${index}`,
      text: item.body,
      x: 510,
      y: y + 50,
      w: 650,
      h: 70,
      size: 22,
      color: COLORS.muted,
      lineSpacing: 1.12,
    });
    if (index < items.length - 1) addRule(slide, 420, y + 122, 742, COLORS.line, 1);
  });

  addNotes(slide, [
    "C:/project/saerok-memory/피우다프로젝트/application_assets/auto_screenshots/ko/19_오늘_하루_말하기.png — internal Haru product capture.",
    "C:/project/saerok-memory/docs/voice-pilot-sample-20x7/analysis/findings.md — intervention description and exact user guidance.",
    "C:/project/saerok-memory/README.md — Qwen model and haru-dc-hp80-rms-v2 preprocessing description.",
  ]);
}

async function buildSlide4(presentation) {
  const slide = presentation.slides.add();
  slide.background.fill = COLORS.white;
  await addChrome(slide, 4, "판정 기준");

  addText(slide, {
    name: "s4-title",
    text: "실제 파일럿을 위한 샘플 A/B 판정 기준",
    x: 70,
    y: 96,
    w: 1040,
    h: 68,
    size: 50,
    bold: true,
    autoFit: "none",
  });
  addText(slide, {
    name: "s4-subtitle",
    text: "사전 설정 패턴 · 측정된 제품 효과 아님",
    x: 72,
    y: 166,
    w: 820,
    h: 40,
    size: 24,
    color: COLORS.coralDark,
    bold: true,
    autoFit: "none",
  });

  addPanel(slide, {
    name: "s4-chart-frame",
    x: 68,
    y: 226,
    w: 720,
    h: 420,
    fill: COLORS.white,
    stroke: COLORS.line,
    radius: 22,
    shadow: "shadow-sm",
  });
  await addImage(slide, {
    filePath: ASSETS.sttChart,
    alt: "Sample STT usability comparison chart",
    x: 82,
    y: 238,
    w: 692,
    h: 396,
    fit: "contain",
    radius: 14,
  });

  addText(slide, {
    name: "s4-primary-delta",
    text: "+12.9%p",
    x: 838,
    y: 232,
    w: 340,
    h: 82,
    size: 62,
    color: COLORS.green,
    bold: true,
    autoFit: "none",
  });
  addText(slide, {
    name: "s4-primary-label",
    text: "사용 가능 전사율\n78.6% → 91.4%",
    x: 842,
    y: 318,
    w: 320,
    h: 70,
    size: 24,
    color: COLORS.ink,
    bold: true,
  });
  addRule(slide, 840, 410, 330, COLORS.line, 1);

  const lines = [
    ["no-speech", "11.4% → 4.3%", "−7.1%p"],
    ["재시도", "21.4% → 7.1%", "−14.3%p"],
    ["중앙 지연", "5.5초 → 3.2초", "−2.3초"],
  ];
  lines.forEach((line, index) => {
    const y = 432 + index * 65;
    addText(slide, {
      name: `s4-metric-name-${index}`,
      text: line[0],
      x: 842,
      y,
      w: 100,
      h: 28,
      size: 19,
      color: COLORS.muted,
      bold: true,
      autoFit: "none",
    });
    addText(slide, {
      name: `s4-metric-value-${index}`,
      text: line[1],
      x: 938,
      y,
      w: 178,
      h: 28,
      size: 19,
      color: COLORS.ink,
      bold: true,
      align: "right",
      autoFit: "none",
    });
    addText(slide, {
      name: `s4-metric-delta-${index}`,
      text: line[2],
      x: 1122,
      y,
      w: 96,
      h: 28,
      size: 18,
      color: COLORS.greenDark,
      bold: true,
      align: "right",
      autoFit: "none",
    });
  });

  addNotes(slide, [
    "C:/project/saerok-memory/docs/voice-pilot-sample-20x7/analysis/metrics.json — generated baseline/assist rates and p50 latency.",
    "C:/project/saerok-memory/docs/voice-pilot-sample-20x7/analysis/charts/png/05-stt-comparison.png — generated sample comparison chart.",
    "C:/project/saerok-memory/docs/voice-pilot-sample-20x7/analysis/methodology.md — no significance test or confidence interval; actual matched-input decode remains future work.",
    "C:/project/saerok-memory/src/features/analytics/syntheticVoicePilot.ts — fixed target counts generate these scenario differences.",
  ]);
}

async function buildSlide5(presentation) {
  const slide = presentation.slides.add();
  slide.background.fill = COLORS.white;
  await addChrome(slide, 5, "다음 검증");

  addText(slide, {
    name: "s5-title",
    text: "50~70대 실제 파일럿을 통한\n가정 검증",
    x: 70,
    y: 100,
    w: 760,
    h: 126,
    size: 54,
    bold: true,
    lineSpacing: 0.94,
  });
  addText(slide, {
    name: "s5-subtitle",
    text: "효과 주장보다 우선하는 이탈 지점·원인 확인",
    x: 72,
    y: 246,
    w: 760,
    h: 40,
    size: 27,
    color: COLORS.greenDark,
    bold: true,
    autoFit: "none",
  });

  addPanel(slide, {
    name: "s5-plan-panel",
    x: 70,
    y: 318,
    w: 1140,
    h: 252,
    fill: COLORS.warm,
    stroke: COLORS.line,
    radius: 26,
  });
  const steps = [
    ["01", "동의받은 자연 발화", "지인·가족 50~70대\n7일 사용 흐름"],
    ["02", "동일 음성 이중 디코딩", "baseline / assist를\n같은 입력으로 비교"],
    ["03", "조건을 가린 사람 검토", "사용 가능 전사와\n의미 단서 보존 확인"],
    ["04", "실패 원인까지 연결", "권한 거부 · no-speech\nSTT 실패 · 취소 · 사용 소감"],
  ];
  steps.forEach((step, index) => {
    const x = 98 + index * 278;
    addText(slide, {
      name: `s5-step-number-${index}`,
      text: step[0],
      x,
      y: 350,
      w: 62,
      h: 42,
      size: 28,
      color: index % 2 === 0 ? COLORS.coral : COLORS.green,
      bold: true,
      autoFit: "none",
    });
    addText(slide, {
      name: `s5-step-title-${index}`,
      text: step[1],
      x,
      y: 406,
      w: 240,
      h: 38,
      size: 24,
      color: COLORS.ink,
      bold: true,
      autoFit: "none",
    });
    addText(slide, {
      name: `s5-step-body-${index}`,
      text: step[2],
      x,
      y: 456,
      w: 240,
      h: 72,
      size: 19,
      color: COLORS.muted,
      lineSpacing: 1.14,
    });
    if (index < steps.length - 1) {
      slide.shapes.add({
        geometry: "line",
        position: { left: x + 250, top: 350, width: 0, height: 172 },
        fill: "none",
        line: { style: "solid", fill: COLORS.line, width: 1 },
      });
    }
  });

  addText(slide, {
    name: "s5-closing",
    text: "샘플 데이터는 답이 아니라, 실제 테스트를 빠르게 만드는 리허설입니다.",
    x: 90,
    y: 602,
    w: 1090,
    h: 42,
    size: 27,
    color: COLORS.coralDark,
    bold: true,
    align: "center",
    autoFit: "none",
  });

  addNotes(slide, [
    "C:/project/saerok-memory/docs/voice-pilot-sample-20x7/analysis/methodology.md — matched-input comparison, blind human review, and error annotation requirements.",
    "C:/project/saerok-memory/AGENTS.md — privacy, consent, non-clinical framing, and family-sharing guardrails.",
    "C:/project/saerok-memory/design.md — granular consent and older-adult interaction principles.",
  ]);
}

async function main() {
  await fs.mkdir(OUT_DIR, { recursive: true });
  await fs.mkdir(path.dirname(FINAL_PPTX), { recursive: true });

  const presentation = Presentation.create({ slideSize: { width: W, height: H } });
  await buildSlide1(presentation);
  await buildSlide2(presentation);
  await buildSlide3(presentation);
  await buildSlide4(presentation);
  await buildSlide5(presentation);

  for (const [index, slide] of presentation.slides.items.entries()) {
    const stem = `slide-${String(index + 1).padStart(2, "0")}`;
    await writeBlob(`${OUT_DIR}/${stem}.png`, await presentation.export({ slide, format: "png", scale: 1.5 }));
    const layout = await slide.export({ format: "layout" });
    await fs.writeFile(`${OUT_DIR}/${stem}.layout.json`, await layout.text(), "utf8");
  }
  await writeBlob(`${OUT_DIR}/montage.webp`, await presentation.export({ format: "webp", montage: true, scale: 1 }));

  const pptx = await PresentationFile.exportPptx(presentation);
  await pptx.save(FINAL_PPTX);
  console.log(FINAL_PPTX);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
