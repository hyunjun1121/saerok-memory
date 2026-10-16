from __future__ import annotations

import base64
import io
import mimetypes
from pathlib import Path

from PIL import Image
from fontTools import subset
from fontTools.ttLib import TTFont


ROOT = Path(r"C:\project\saerok-memory")
REFERENCE = Path(r"C:\Users\mnb92\Downloads\전단지_좋은예시.png")
HERO = (
    ROOT
    / "피우다프로젝트"
    / "일본인멘토_피드백"
    / "오가사_Haru_추출이미지"
    / "개발계획서_04_한국어_어르신_탁상형기기사용_p05.jpg"
)
QR_CODE = Path(r"C:\Users\mnb92\Downloads\haru qr-code (1).png")
OUTPUT_DIR = ROOT / "피우다프로젝트" / "전단지" / "제로베이스_회사소개_전단지"
OUTPUT_HTML = OUTPUT_DIR / "Haru_회사소개_전단지_대표자행하단이동_v13_편집원본.html"
SOURCE_HTML = OUTPUT_DIR / "Haru_회사소개_전단지_필요성카피정리_v12_편집원본.html"


VISIBLE_TEXT = """
OGASA Labs Haru 하루 AI 개인화 두뇌운동 키오스크
검사처럼 느껴지지 않는 하루 3분 두뇌운동
어르신의 ‘어제 이야기’가 ‘오늘의 문항’이 되는 AI 인지돌봄 솔루션
하루 3~5분 4개 물리버튼 보호자·기관 연계
왜 필요한가 일상 변화 확인 도구 부족
고령자 조작·심리 부담
반복 관찰 시간·인력 부족
Haru의 해결 방식 초간단 사용 흐름 카드 태깅 후 바로 시작 복잡한 로그인과 메뉴 탐색이 없습니다
고령자 친화 UX 비터치 화면 2×2 물리버튼 마이크로 직관적인 사용이 가능합니다
AI 개인화 문항 어제의 발화가 오늘의 문항이 되는 회상 기반 두뇌운동을 제공합니다
리포트 연계 보호자와 기관이 참여 흐름과 변화 패턴을 자연스럽게 확인할 수 있습니다
사용 흐름 1 카드 태깅 2 질문 듣고 답하기 3 리포트 확인
하루 1회 약 3~5분 사회복지사 초기 안내 후 어르신 단독 사용 가능
핵심 차별점 검사 중심이 아닌 일상 루틴 점수 중심이 아닌 변화 추이
공통 문제은행이 아닌 개인화 회상 앱 중심이 아닌 기관 설치형 키오스크
적용 대상 복지관 치매안심센터 주야간보호센터 요양시설 65세 이상 어르신 한국·일본 확장형 콘텐츠
Haru는 의료적 진단 기기가 아닌 생활 기반의 일상 인지돌봄 솔루션입니다
Haru 바로 시작하기 QR 코드를 스캔하세요
대표자 김현준 010-9417-1845 hyunjun1121@kaist.ac.kr linkedin.com/in/hyunjun1121
"""


ICON_BOXES: dict[str, tuple[int, int, int, int]] = {
    # Hero badges.
    "badge_clock": (56, 446, 108, 500),
    "badge_buttons": (242, 447, 295, 501),
    "badge_people": (445, 446, 503, 502),
    # Section headers.
    "heading_alert": (37, 554, 82, 603),
    "heading_bulb": (351, 553, 397, 603),
    "heading_repeat": (37, 894, 83, 941),
    "heading_star": (47, 1200, 97, 1249),
    "heading_people": (514, 1200, 569, 1250),
    # Four solution illustrations. Text excluded.
    "solution_tag": (367, 620, 481, 713),
    "solution_buttons": (542, 620, 642, 713),
    "solution_brain": (716, 620, 814, 713),
    "solution_report": (890, 619, 973, 714),
    # Three flow illustrations. Numbers and labels excluded.
    "flow_tag": (104, 1003, 271, 1131),
    "flow_listen": (436, 1002, 625, 1128),
    "flow_report": (806, 1003, 903, 1130),
    # Target pictograms. Pill borders and labels excluded.
    "target_center": (520, 1266, 565, 1317),
    "target_memory": (678, 1266, 724, 1317),
    "target_daycare": (837, 1263, 890, 1318),
    "target_carehome": (519, 1332, 566, 1382),
    "target_senior": (680, 1333, 718, 1382),
    "target_global": (837, 1332, 887, 1382),
    # Footer icon.
    "footer_heart": (170, 1417, 223, 1464),
}


def file_data_uri(path: Path) -> str:
    mime, _ = mimetypes.guess_type(path.name)
    payload = base64.b64encode(path.read_bytes()).decode("ascii")
    return f"data:{mime or 'application/octet-stream'};base64,{payload}"


def subset_font_data_uri(path: Path, text: str) -> str:
    options = subset.Options()
    options.flavor = "woff2"
    options.hinting = False
    options.layout_features = ["*"]
    font = TTFont(path)
    subsetter = subset.Subsetter(options=options)
    subsetter.populate(text=text)
    subsetter.subset(font)
    font.flavor = "woff2"
    stream = io.BytesIO()
    font.save(stream)
    return "data:font/woff2;base64," + base64.b64encode(stream.getvalue()).decode("ascii")


def crop_data_uri(
    source: Image.Image,
    box: tuple[int, int, int, int],
    *,
    transparent_background: bool = False,
    scale: int = 4,
) -> str:
    crop = source.crop(box).convert("RGBA")
    if transparent_background:
        # The reference is a PNG screenshot. Remove only the locally sampled flat
        # background, retaining anti-aliased colored/gray icon pixels.
        samples = [
            crop.getpixel((1, 1))[:3],
            crop.getpixel((crop.width - 2, 1))[:3],
            crop.getpixel((1, crop.height - 2))[:3],
            crop.getpixel((crop.width - 2, crop.height - 2))[:3],
        ]
        bg = tuple(sorted(channel)[len(samples) // 2] for channel in zip(*samples))
        pixels = []
        for red, green, blue, _ in crop.getdata():
            distance = ((red - bg[0]) ** 2 + (green - bg[1]) ** 2 + (blue - bg[2]) ** 2) ** 0.5
            if distance <= 14:
                alpha = 0
            elif distance < 32:
                alpha = round(255 * (distance - 14) / 18)
            else:
                alpha = 255
            pixels.append((red, green, blue, alpha))
        crop.putdata(pixels)
    if scale > 1:
        crop = crop.resize((crop.width * scale, crop.height * scale), Image.Resampling.LANCZOS)
    stream = io.BytesIO()
    crop.save(stream, "PNG", optimize=True)
    return "data:image/png;base64," + base64.b64encode(stream.getvalue()).decode("ascii")


def main() -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    if not REFERENCE.exists() or not QR_CODE.exists():
        if not SOURCE_HTML.exists():
            missing = [str(path) for path in (REFERENCE, QR_CODE, SOURCE_HTML) if not path.exists()]
            raise FileNotFoundError(f"Required source assets are missing: {missing}")

        html = SOURCE_HTML.read_text(encoding="utf-8")
        replacements = {
            "<title>Haru 회사 소개 전단지 - 필요성 카피 정리 v12</title>":
                "<title>Haru 회사 소개 전단지 - 대표자 행 하단 이동 v13</title>",
            'data-label="Haru 회사 소개 전단지 - 필요성 카피 정리 v12"':
                'data-label="Haru 회사 소개 전단지 - 대표자 행 하단 이동 v13"',
            ".contact-item { display: flex; align-items: center; white-space: nowrap; }":
                ".contact-item { display: flex; align-items: center; white-space: nowrap; transform: translateY(.8mm); }",
        }
        for old, new in replacements.items():
            count = html.count(old)
            if count != 1:
                raise ValueError(f"Expected exactly one source match, found {count}: {old[:80]}")
            html = html.replace(old, new)
        OUTPUT_HTML.write_text(html, encoding="utf-8")
        print(OUTPUT_HTML)
        return

    reference = Image.open(REFERENCE).convert("RGBA")
    icons = {
        name: crop_data_uri(
            reference,
            box,
            transparent_background=name.startswith("target_")
            or name.startswith("heading_")
            or name == "footer_heart",
        )
        for name, box in ICON_BOXES.items()
    }
    hero = file_data_uri(HERO)
    qr_code = file_data_uri(QR_CODE)
    font = subset_font_data_uri(Path(r"C:\Windows\Fonts\PretendardVariable.ttf"), VISIBLE_TEXT)

    html = f'''<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Haru 회사 소개 전단지 - 대표자 행 하단 이동 v13</title>
  <style>
    @font-face {{
      font-family: "Pretendard Embedded";
      src: url("{font}") format("woff2");
      font-weight: 100 900;
      font-style: normal;
      font-display: block;
    }}

    :root {{
      --ink: #281b15;
      --body: #413a36;
      --orange: #e95b17;
      --green: #55763e;
      --blue: #3e70b3;
      --purple: #745198;
      --gold: #f0a208;
      --warm-line: #decfc4;
      --arrow: #b6a99f;
    }}

    @page {{ size: 210mm 297mm; margin: 0; }}
    * {{ box-sizing: border-box; }}
    html, body {{ width: 210mm; height: 297mm; margin: 0; background: #fff; }}
    body {{
      font-family: "Pretendard Embedded", "Pretendard", "Noto Sans KR", sans-serif;
      color: var(--ink);
      -webkit-font-smoothing: antialiased;
      text-rendering: geometricPrecision;
    }}
    p, h1, h2, h3 {{ margin: 0; }}
    img {{ display: block; }}

    .page {{
      position: relative;
      width: 210mm;
      height: 297mm;
      overflow: hidden;
      background: #fff;
      border: 0;
    }}

    /* Hero: same proportions and copy hierarchy as supplied reference. */
    .hero {{ position: absolute; inset: 0 0 auto 0; height: 106.2mm; overflow: hidden; background: #fff; }}
    .hero-photo {{
      position: absolute;
      left: auto;
      right: 0;
      top: 0;
      width: 153mm;
      height: 106.2mm;
      object-fit: cover;
      object-position: 50% 50%;
    }}
    .hero-fade {{
      position: absolute;
      inset: 0;
      background: linear-gradient(90deg,
        #fff 0%, #fff 31%, rgba(255,255,255,.99) 38%,
        rgba(255,255,255,.91) 42%, rgba(255,255,255,.52) 48%,
        rgba(255,255,255,.12) 55%, rgba(255,255,255,0) 62%);
    }}
    .hero-copy {{ position: absolute; left: 10.1mm; top: 10.6mm; width: 94mm; z-index: 2; }}
    .brand {{ color: #df4e08; font-size: 10.5pt; line-height: 1; font-weight: 720; letter-spacing: -.015em; }}
    .hero-title {{
      position: absolute;
      left: 0;
      top: 7.5mm;
      width: 98mm;
      height: 24mm;
      color: #281b15;
      font-size: 62pt;
      line-height: 1.05;
      font-weight: 860;
      letter-spacing: -.04em;
      white-space: nowrap;
    }}
    .hero-title span {{ font-size: 35pt; font-weight: 820; letter-spacing: -.035em; }}
    .hero-subtitle {{ position: absolute; left: 0; top: 32.2mm; font-size: 17.5pt; line-height: 1.08; font-weight: 820; letter-spacing: -.037em; }}
    .hero-rule {{ position: absolute; left: 0; top: 42.5mm; width: 7mm; height: .55mm; background: var(--orange); }}
    .hero-promise {{ position: absolute; left: 0; top: 49.4mm; color: #e5530d; font-size: 15.3pt; line-height: 1.08; font-weight: 830; letter-spacing: -.02em; white-space: nowrap; }}
    .hero-body {{ position: absolute; left: 0; top: 59.1mm; color: #352f2c; font-size: 11.5pt; line-height: 1.5; font-weight: 500; letter-spacing: -.02em; }}
    .hero-badges {{ position: absolute; left: 9.8mm; top: 86.9mm; display: flex; gap: 2mm; z-index: 3; }}
    .hero-badge {{
      height: 14mm;
      display: flex;
      align-items: center;
      padding: 0 2.4mm 0 1.7mm;
      border: .24mm solid var(--badge-color);
      border-radius: 2.8mm;
      background: rgba(255,255,255,.96);
      color: #2e2723;
      font-size: 10.2pt;
      line-height: 1;
      font-weight: 750;
      letter-spacing: -.025em;
      white-space: nowrap;
    }}
    .hero-badge:nth-child(1) {{ width: 35.4mm; }}
    .hero-badge:nth-child(2) {{ width: 38.4mm; }}
    .hero-badge:nth-child(3) {{ width: 42mm; color: #315f9e; }}
    .hero-badge img {{ width: 9.2mm; height: 9.2mm; margin-right: 1.5mm; object-fit: contain; }}

    .main {{ position: absolute; left: 8.2mm; top: 109.5mm; width: 193.4mm; height: 61mm; }}
    .heading {{ display: flex; align-items: center; color: #2a201a; font-size: 17.2pt; line-height: 1; font-weight: 820; letter-spacing: -.035em; }}
    .heading img {{ width: 8.3mm; height: 8.3mm; object-fit: contain; margin-right: 2mm; }}
    .why {{ position: absolute; left: 0; top: 0; width: 56.6mm; height: 61mm; }}
    .why-copy {{ position: absolute; left: 10.3mm; top: 10.5mm; width: 44.3mm; height: 50.3mm; display: grid; grid-template-rows: repeat(3, 1fr); }}
    .why-copy p {{
      display: flex;
      align-items: center;
      color: #403935;
      font-size: 11pt;
      line-height: 1.15;
      font-weight: 650;
      letter-spacing: -.04em;
      white-space: nowrap;
    }}
    .main-divider {{ position: absolute; left: 55.8mm; top: 4mm; width: .22mm; height: 56.2mm; background: #e2dedb; }}
    .solutions {{ position: absolute; left: 60.4mm; top: 0; width: 133mm; height: 61mm; }}
    .solution-grid {{ position: absolute; left: 0; right: 0; top: 10.5mm; display: grid; grid-template-columns: repeat(4, 1fr); gap: 2mm; }}
    .solution-card {{ position: relative; height: 50.3mm; border: .24mm solid #e2d5cc; border-radius: 2.7mm; background: #fff; overflow: hidden; }}
    .solution-art {{ position: absolute; top: 1.6mm; left: 2mm; right: 2mm; height: 18.3mm; display: flex; align-items: center; justify-content: center; }}
    .solution-art img {{ width: 100%; height: 100%; object-fit: contain; }}
    .solution-card h3 {{ position: absolute; left: 1.5mm; right: 1.5mm; top: 21.4mm; color: #302721; text-align: center; font-size: 10.8pt; line-height: 1.1; font-weight: 800; letter-spacing: -.035em; white-space: nowrap; }}
    .solution-card p {{ position: absolute; left: 2.5mm; right: 1.5mm; top: 29mm; color: #4c4540; text-align: left; font-size: 8.6pt; line-height: 1.5; font-weight: 500; letter-spacing: -.03em; }}

    .flow {{ position: absolute; left: 8.3mm; top: 173.8mm; width: 193.4mm; height: 54mm; }}
    .flow-panel {{ position: absolute; left: 0; top: 8.7mm; width: 193.4mm; height: 45.1mm; border: .25mm solid #d9ccc2; border-radius: 3.7mm; background: #fff; overflow: hidden; }}
    .flow-num {{ position: absolute; top: 3mm; width: 8.5mm; height: 8.5mm; display: grid; place-items: center; border-radius: 50%; color: #fff; background: var(--step-color); font-size: 13.1pt; line-height: 1; font-weight: 820; }}
    .flow-title {{ position: absolute; top: 3.7mm; color: #2f2722; font-size: 11.5pt; line-height: 1.2; font-weight: 800; letter-spacing: -.025em; white-space: nowrap; }}
    .flow-art {{ position: absolute; object-fit: contain; }}
    .num1 {{ left: 3.8mm; --step-color: var(--orange); }} .title1 {{ left: 15.3mm; }}
    .num2 {{ left: 76.2mm; --step-color: var(--green); }} .title2 {{ left: 88.6mm; }}
    .num3 {{ left: 141.5mm; --step-color: var(--blue); }} .title3 {{ left: 154.3mm; }}
    .art1 {{ left: 13.8mm; top: 12mm; width: 33.3mm; height: 25.5mm; }}
    .art2 {{ left: 78.4mm; top: 11.7mm; width: 37.7mm; height: 25.2mm; }}
    .art3 {{ left: 152.3mm; top: 11.8mm; width: 19.3mm; height: 25.3mm; }}
    .flow-arrow {{ position: absolute; top: 18.4mm; width: 12.2mm; height: 1.2mm; background: var(--arrow); }}
    .flow-arrow::after {{ content: ""; position: absolute; right: -1.8mm; top: -1.7mm; border-left: 2.6mm solid var(--arrow); border-top: 1.8mm solid transparent; border-bottom: 1.8mm solid transparent; }}
    .arrow1 {{ left: 54.4mm; }} .arrow2 {{ left: 125.2mm; width: 15.2mm; }}
    .flow-note {{ position: absolute; left: 0; right: 0; bottom: 4.5mm; color: #403934; text-align: center; font-size: 9.4pt; line-height: 1; font-weight: 500; letter-spacing: -.02em; }}

    .bottom {{ position: absolute; left: 8mm; top: 230.8mm; width: 157mm; height: 40.2mm; display: grid; grid-template-columns: 77mm 78mm; gap: 2mm; }}
    .bottom-card {{ position: relative; height: 40.2mm; border: .25mm solid var(--card-border); border-radius: 3mm; background: #fff; overflow: hidden; }}
    .mini-heading {{ position: absolute; left: 2.2mm; top: 2.5mm; display: flex; align-items: center; font-size: 13.1pt; line-height: 1; font-weight: 820; letter-spacing: -.03em; }}
    .mini-heading img {{ width: 8.4mm; height: 8.4mm; margin-right: 1mm; object-fit: contain; }}
    .difference-divider {{ position: absolute; left: 38.5mm; top: 10.8mm; height: 24.8mm; border-left: .25mm dashed #cfc5bd; }}
    .difference-item {{ position: absolute; width: 34mm; display: flex; align-items: flex-start; color: #413a36; font-size: 8.6pt; line-height: 1.26; font-weight: 500; letter-spacing: -.025em; }}
    .check {{ width: 3.45mm; height: 3.45mm; margin-right: 1.15mm; border-radius: 50%; background: var(--green); color: #fff; display: grid; place-items: center; flex: 0 0 auto; font-size: 6.2pt; line-height: 1; font-weight: 900; }}
    .diff1 {{ left: 2.3mm; top: 14.7mm; }} .diff2 {{ left: 2.3mm; top: 25.8mm; }}
    .diff3 {{ left: 41.3mm; top: 13.2mm; width: 33.2mm; }} .diff4 {{ left: 41.3mm; top: 25.0mm; width: 33.2mm; }}
    .targets {{ --card-border: #c7d8ef; }}
    .target-grid {{ position: absolute; left: 1.8mm; top: 11.3mm; display: grid; grid-template-columns: 36.4mm 36.4mm; grid-template-rows: repeat(3, 8.35mm); gap: .85mm 1.3mm; }}
    .target-pill {{ display: flex; align-items: center; min-width: 0; height: 8.35mm; padding: 0 .6mm; border: .25mm solid var(--pill-color); border-radius: 2.2mm; background: var(--pill-bg); color: #433c37; font-size: 8.1pt; line-height: 1.05; font-weight: 650; letter-spacing: -.035em; white-space: nowrap; }}
    .target-pill img {{ width: 5.2mm; height: 5.2mm; margin-right: .45mm; object-fit: contain; flex: 0 0 auto; }}
    .target-pill.tight img {{ width: 4.9mm; height: 4.9mm; margin-right: .35mm; }}
    .target-pill.wrap span {{ white-space: normal; line-height: 1.02; }}

    .qr-card {{ position: absolute; left: 167mm; top: 230.8mm; width: 34.8mm; height: 52.8mm; border: .25mm solid #ef9b60; border-radius: 3mm; background: #fffaf5; overflow: hidden; text-align: center; }}
    .qr-heading {{ position: absolute; left: 1mm; right: 1mm; top: 2.5mm; color: var(--orange); font-size: 10.2pt; line-height: 1; font-weight: 800; letter-spacing: -.025em; white-space: nowrap; }}
    .qr-wrap {{ position: absolute; left: 1.4mm; top: 8.7mm; width: 32mm; height: 32mm; padding: 2mm; display: block; background: #fff; }}
    .qr-wrap img {{ width: 28mm; height: 28mm; object-fit: contain; image-rendering: pixelated; }}
    .qr-caption {{ position: absolute; left: 1mm; right: 1mm; top: 44mm; color: #403934; font-size: 8.4pt; line-height: 1; font-weight: 650; letter-spacing: -.02em; white-space: nowrap; }}

    .footer {{ position: absolute; left: 8mm; top: 273.6mm; width: 157mm; height: 10.6mm; display: flex; align-items: center; justify-content: center; border: .25mm solid #ef9b60; border-radius: 3.5mm; background: #fff9f2; }}
    .footer img {{ width: 9.5mm; height: 9.5mm; object-fit: contain; margin-right: 2.4mm; }}
    .footer p {{ color: #312923; font-size: 9.6pt; line-height: 1; font-weight: 570; letter-spacing: -.03em; white-space: nowrap; }}
    .footer strong {{ font-weight: 790; }}
    .contact {{ position: absolute; left: 8mm; top: 284.8mm; width: 193.8mm; height: 5mm; display: flex; align-items: center; justify-content: center; border-top: .25mm solid #ddd5cf; color: #433b36; font-size: 8.8pt; line-height: 1; font-style: normal; font-weight: 620; letter-spacing: -.025em; white-space: nowrap; }}
    .contact-item {{ display: flex; align-items: center; white-space: nowrap; transform: translateY(.8mm); }}
    .contact-item + .contact-item::before {{ content: ""; width: .22mm; height: 3mm; margin: 0 2.4mm; background: #d7cec7; }}
    .contact-owner {{ color: var(--orange); font-weight: 800; }}
    .contact a {{ color: inherit; text-decoration: none; }}
  </style>
</head>
<body>
  <main class="page" data-document-role="page" data-label="Haru 회사 소개 전단지 - 대표자 행 하단 이동 v13">
    <section class="hero" aria-label="Haru 소개">
      <img class="hero-photo" src="{hero}" alt="어르신이 Haru 탁상형 기기를 사용하는 장면">
      <div class="hero-fade" aria-hidden="true"></div>
      <div class="hero-copy">
        <p class="brand">OGASA Labs</p>
        <h1 class="hero-title">Haru<span>(하루)</span></h1>
        <p class="hero-subtitle">AI 개인화 두뇌운동 키오스크</p>
        <div class="hero-rule" aria-hidden="true"></div>
        <p class="hero-promise">검사처럼 느껴지지 않는 하루 3분 두뇌운동</p>
        <p class="hero-body">어르신의 ‘어제 이야기’가 ‘오늘의 문항’이 되는<br>AI 인지돌봄 솔루션</p>
      </div>
      <div class="hero-badges" aria-label="핵심 특징">
        <div class="hero-badge" style="--badge-color:#e95b17"><img src="{icons['badge_clock']}" alt=""><span>하루 3~5분</span></div>
        <div class="hero-badge" style="--badge-color:#6d9a59"><img src="{icons['badge_buttons']}" alt=""><span>4개 물리버튼</span></div>
        <div class="hero-badge" style="--badge-color:#4a7fbd"><img src="{icons['badge_people']}" alt=""><span>보호자·기관 연계</span></div>
      </div>
    </section>

    <section class="main" aria-label="필요성과 해결 방식">
      <article class="why">
        <h2 class="heading"><img src="{icons['heading_alert']}" alt=""><span>왜 필요한가</span></h2>
        <div class="why-copy">
          <p>일상 변화 확인 도구 부족</p>
          <p>고령자 조작·심리 부담</p>
          <p>반복 관찰 시간·인력 부족</p>
        </div>
      </article>
      <div class="main-divider" aria-hidden="true"></div>
      <article class="solutions">
        <h2 class="heading"><img src="{icons['heading_bulb']}" alt=""><span>Haru의 해결 방식</span></h2>
        <div class="solution-grid">
          <section class="solution-card">
            <div class="solution-art"><img src="{icons['solution_tag']}" alt="카드를 태깅하는 손"></div>
            <h3>초간단 사용 흐름</h3>
            <p>카드 태깅 후 바로 시작.<br>복잡한 로그인과 메뉴<br>탐색이 없습니다.</p>
          </section>
          <section class="solution-card">
            <div class="solution-art"><img src="{icons['solution_buttons']}" alt="4색 물리버튼"></div>
            <h3>고령자 친화 UX</h3>
            <p>비터치 화면, 2×2<br>물리버튼, 마이크로<br>직관적인 사용이<br>가능합니다.</p>
          </section>
          <section class="solution-card">
            <div class="solution-art"><img src="{icons['solution_brain']}" alt="회로 형태의 뇌"></div>
            <h3>AI 개인화 문항</h3>
            <p>어제의 발화가 오늘의<br>문항이 되는 회상 기반<br>두뇌운동을 제공합니다.</p>
          </section>
          <section class="solution-card">
            <div class="solution-art"><img src="{icons['solution_report']}" alt="막대그래프 리포트"></div>
            <h3>리포트 연계</h3>
            <p>보호자와 기관이 참여<br>흐름과 변화 패턴을<br>자연스럽게 확인할 수<br>있습니다.</p>
          </section>
        </div>
      </article>
    </section>

    <section class="flow" aria-label="사용 흐름">
      <h2 class="heading"><img src="{icons['heading_repeat']}" alt=""><span>사용 흐름</span></h2>
      <div class="flow-panel">
        <span class="flow-num num1">1</span><h3 class="flow-title title1">카드 태깅</h3>
        <span class="flow-num num2">2</span><h3 class="flow-title title2">질문 듣고 답하기</h3>
        <span class="flow-num num3">3</span><h3 class="flow-title title3">리포트 확인</h3>
        <img class="flow-art art1" src="{icons['flow_tag']}" alt="기기에 카드를 태깅하는 모습">
        <img class="flow-art art2" src="{icons['flow_listen']}" alt="질문을 듣고 답하는 어르신">
        <img class="flow-art art3" src="{icons['flow_report']}" alt="리포트 확인">
        <span class="flow-arrow arrow1" aria-hidden="true"></span><span class="flow-arrow arrow2" aria-hidden="true"></span>
        <p class="flow-note">하루 1회, 약 3~5분. 사회복지사 초기 안내 후 어르신 단독 사용 가능</p>
      </div>
    </section>

    <section class="bottom" aria-label="핵심 차별점과 적용 대상">
      <article class="bottom-card differences" style="--card-border:#d6d3c1">
        <h2 class="mini-heading"><img src="{icons['heading_star']}" alt=""><span>핵심 차별점</span></h2>
        <div class="difference-divider" aria-hidden="true"></div>
        <div class="difference-item diff1"><span class="check">✓</span><span>검사 중심이 아닌<br>일상 루틴</span></div>
        <div class="difference-item diff2"><span class="check">✓</span><span>점수 중심이 아닌<br>변화 추이</span></div>
        <div class="difference-item diff3"><span class="check">✓</span><span>공통 문제은행이 아닌<br>개인화 회상</span></div>
        <div class="difference-item diff4"><span class="check">✓</span><span>앱 중심이 아닌<br>기관 설치형 키오스크</span></div>
      </article>
      <article class="bottom-card targets">
        <h2 class="mini-heading"><img src="{icons['heading_people']}" alt=""><span>적용 대상</span></h2>
        <div class="target-grid">
          <div class="target-pill" style="--pill-color:#ed7440;--pill-bg:#fff8f3"><img src="{icons['target_center']}" alt=""><span>복지관</span></div>
          <div class="target-pill" style="--pill-color:#8aa36e;--pill-bg:#fafcf7"><img src="{icons['target_memory']}" alt=""><span>치매안심센터</span></div>
          <div class="target-pill tight" style="--pill-color:#efb43a;--pill-bg:#fffaf0"><img src="{icons['target_daycare']}" alt=""><span>주야간보호센터</span></div>
          <div class="target-pill" style="--pill-color:#7299c7;--pill-bg:#f7faff"><img src="{icons['target_carehome']}" alt=""><span>요양시설</span></div>
          <div class="target-pill tight" style="--pill-color:#9276ab;--pill-bg:#fcf9fe"><img src="{icons['target_senior']}" alt=""><span>65세 이상 어르신</span></div>
          <div class="target-pill wrap" style="--pill-color:#6f98cd;--pill-bg:#f7fbff"><img src="{icons['target_global']}" alt=""><span>한국·일본<br>확장형 콘텐츠</span></div>
        </div>
      </article>
    </section>

    <aside class="qr-card" aria-label="Haru 바로 시작하기">
      <h2 class="qr-heading">Haru 바로 시작하기</h2>
      <a class="qr-wrap" href="https://haru-korea.vercel.app/lesson" aria-label="Haru 시작 화면 열기">
        <img src="{qr_code}" alt="Haru 시작 화면 QR 코드">
      </a>
      <p class="qr-caption">QR 코드를 스캔하세요</p>
    </aside>

    <footer class="footer">
      <img src="{icons['footer_heart']}" alt="">
      <p><strong>Haru는 의료적 진단 기기가 아닌,</strong> 생활 기반의 일상 인지돌봄 솔루션입니다.</p>
    </footer>

    <address class="contact" aria-label="대표자 연락처">
      <span class="contact-item contact-owner">대표자 김현준</span>
      <span class="contact-item"><a href="https://www.linkedin.com/in/hyunjun1121/">linkedin.com/in/hyunjun1121</a></span>
      <span class="contact-item"><a href="tel:+821094171845">010-9417-1845</a></span>
      <span class="contact-item"><a href="mailto:hyunjun1121@kaist.ac.kr">hyunjun1121@kaist.ac.kr</a></span>
    </address>
  </main>
</body>
</html>'''
    OUTPUT_HTML.write_text(html, encoding="utf-8")
    print(OUTPUT_HTML)


if __name__ == "__main__":
    main()
