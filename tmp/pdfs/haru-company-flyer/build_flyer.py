from __future__ import annotations

import base64
import io
import mimetypes
from pathlib import Path

from PIL import Image
from fontTools import subset
from fontTools.ttLib import TTFont


ROOT = Path(r"C:\project\saerok-memory")
OUTPUT_DIR = ROOT / "피우다프로젝트" / "전단지" / "제로베이스_회사소개_전단지"
OUTPUT_HTML = OUTPUT_DIR / "Haru_회사소개_전단지_최신화면반영_편집원본.html"

FONT_TEXT = """
Haru 회사 소개 전단지 COMPANY INTRODUCTION DAILY MEMORY ROUTINE
FOR EVERYDAY MOMENTS 오늘의 기억이 내일의 대화가 되도록
Haru는 60-80대 고령 사용자를 위한 하루 5분 인지·회상 루틴입니다.
큰 글자와 쉬운 터치, 선택·말하기 중심으로 오늘을 돌아보고 기억 단서를 남깁니다.
고령 사용자 가족·보호자 복지·상담 현장 하루 매일의 루틴 はる 봄과 새로운 시작
ACTUAL PRODUCT UI 실제 최신 Haru 앱 화면 큰 글자 쉬운 선택 듣기 일상 맥락
HOW HARU WORKS Haru가 만드는 하루의 흐름 01 02 03
짧고 쉬운 루틴 날짜·주의·말하기·그리기·회상을 한 번에 하나씩 진행합니다.
개인 기억 단서 오늘의 경험을 다음 복습과 가족 대화로 자연스럽게 연결합니다.
함께 보는 흐름 참여 흐름과 대화 제안을 보호자·상담사 화면에서 확인합니다.
START WITH FIVE MINUTES 매일의 작은 참여가 다음 대화의 단서가 됩니다.
선택하고 말하고 그리며 쌓이는 Haru의 일상 기록 LIVE DEMO Haru 데모 열기
Haru는 공식 의료 도구가 아닙니다. 자체 활동 기록은 일상 지원과 대화 준비를 위한 참고 정보입니다.
| , . - ·
"""


def data_uri(path: Path) -> str:
    mime, _ = mimetypes.guess_type(path.name)
    if not mime:
        mime = "application/octet-stream"
    payload = base64.b64encode(path.read_bytes()).decode("ascii")
    return f"data:{mime};base64,{payload}"


def cropped_png_data_uri(path: Path, padding: int = 28) -> str:
    image = Image.open(path).convert("RGBA")
    alpha_box = image.getchannel("A").getbbox()
    if alpha_box:
        left, top, right, bottom = alpha_box
        left = max(0, left - padding)
        top = max(0, top - padding)
        right = min(image.width, right + padding)
        bottom = min(image.height, bottom + padding)
        image = image.crop((left, top, right, bottom))

    stream = io.BytesIO()
    image.save(stream, "PNG", optimize=True)
    payload = base64.b64encode(stream.getvalue()).decode("ascii")
    return f"data:image/png;base64,{payload}"


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
    payload = base64.b64encode(stream.getvalue()).decode("ascii")
    return f"data:font/woff2;base64,{payload}"


def main() -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    font = subset_font_data_uri(Path(r"C:\Windows\Fonts\PretendardVariable.ttf"), FONT_TEXT)
    logo = cropped_png_data_uri(ROOT / "public" / "assets" / "haru" / "logo.png", 40)
    sequence_screen = data_uri(
        ROOT
        / "피우다프로젝트"
        / "application_assets"
        / "current_2x2_large_text_worktree_2026-07-29"
        / "ko"
        / "31_D1_Q6.png"
    )
    daily_screen = data_uri(
        ROOT
        / "피우다프로젝트"
        / "application_assets"
        / "current_2x2_large_text_worktree_2026-07-29"
        / "ko"
        / "29_D1_Q4.png"
    )
    qr = data_uri(
        ROOT
        / "피우다프로젝트"
        / "일본인멘토_피드백"
        / "오가사_Haru_추출이미지"
        / "발표자료_03_Haru_접속_QR코드.png"
    )

    html = f"""<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Haru 회사 소개 전단지</title>
  <style>
    @font-face {{
      font-family: "Pretendard Embedded";
      src: url("{font}") format("woff2");
      font-style: normal;
      font-weight: 100 900;
      font-display: block;
    }}

    :root {{
      --ink: #25312b;
      --muted: #66716b;
      --green: #34731f;
      --green-bright: #58bd2f;
      --green-soft: #eef7e9;
      --coral: #c9574f;
      --coral-soft: #fff0ed;
      --teal: #557f7d;
      --amber: #f2b54a;
      --line: #dfe7df;
      --cream: #fffaf0;
    }}

    @page {{ size: 210mm 297mm; margin: 0; }}

    * {{ box-sizing: border-box; }}

    html,
    body {{
      width: 210mm;
      height: 297mm;
      margin: 0;
      padding: 0;
      background: #ffffff;
    }}

    body {{
      font-family: "Pretendard Embedded", "Pretendard", "Noto Sans KR", sans-serif;
      color: var(--ink);
      -webkit-font-smoothing: antialiased;
      text-rendering: geometricPrecision;
    }}

    .page {{
      position: relative;
      width: 210mm;
      height: 297mm;
      overflow: hidden;
      background: #ffffff;
    }}

    .top-rule {{
      position: absolute;
      inset: 0 0 auto 0;
      height: 2.2mm;
      background: linear-gradient(90deg, var(--green) 0 55%, var(--coral) 55% 78%, var(--amber) 78% 100%);
    }}

    .brandbar {{
      position: absolute;
      left: 16mm;
      right: 16mm;
      top: 10.5mm;
      height: 16mm;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }}

    .brand-logo {{
      width: 39mm;
      height: 15.5mm;
      object-fit: contain;
      object-position: left center;
    }}

    .edition {{
      text-align: right;
      font-size: 7pt;
      line-height: 1.3;
      letter-spacing: 0.12em;
      font-weight: 760;
      color: var(--green);
    }}

    .edition span {{
      color: var(--muted);
      font-size: 6.4pt;
      letter-spacing: 0.09em;
      font-weight: 600;
    }}

    .hero-copy {{
      position: absolute;
      left: 16mm;
      top: 37mm;
      width: 89mm;
    }}

    .eyebrow {{
      margin: 0 0 4.4mm;
      display: inline-flex;
      align-items: center;
      gap: 2.4mm;
      font-size: 7.3pt;
      line-height: 1;
      letter-spacing: 0.11em;
      color: var(--green);
      font-weight: 780;
    }}

    .eyebrow::before {{
      content: "";
      width: 8mm;
      height: 1.2mm;
      border-radius: 999px;
      background: var(--green-bright);
    }}

    h1 {{
      margin: 0;
      font-size: 34.5pt;
      line-height: 1.08;
      letter-spacing: -0.055em;
      font-weight: 860;
      color: var(--ink);
    }}

    h1 em {{
      color: var(--green);
      font-style: normal;
    }}

    .intro {{
      margin: 7mm 0 0;
      font-size: 10.2pt;
      line-height: 1.58;
      letter-spacing: -0.018em;
      font-weight: 530;
      color: #48534d;
    }}

    .audiences {{
      margin-top: 6.2mm;
      display: flex;
      flex-wrap: wrap;
      gap: 2.1mm;
    }}

    .audience {{
      display: inline-flex;
      align-items: center;
      min-height: 7.4mm;
      padding: 0 3.2mm;
      border: 0.35mm solid var(--line);
      border-radius: 999px;
      background: #ffffff;
      color: #4b5750;
      font-size: 7.7pt;
      line-height: 1;
      font-weight: 690;
    }}

    .brand-meaning {{
      margin: 5.2mm 0 0;
      font-size: 7.4pt;
      line-height: 1.4;
      color: #7b837f;
      letter-spacing: -0.01em;
      font-weight: 560;
    }}

    .hero-visual {{
      position: absolute;
      left: 112mm;
      top: 36mm;
      width: 82mm;
      height: 132mm;
    }}

    .hero-visual::before {{
      content: "";
      position: absolute;
      left: 4mm;
      right: 0;
      top: 7mm;
      height: 114mm;
      border-radius: 11mm 11mm 3mm 11mm;
      background: linear-gradient(145deg, #f6faef 0%, #edf6e8 58%, #fff6e8 100%);
      border: 0.35mm solid #e5eee0;
    }}

    .hero-visual::after {{
      content: "";
      position: absolute;
      right: -4mm;
      top: 49mm;
      width: 29mm;
      height: 29mm;
      border-radius: 50%;
      background: var(--coral-soft);
    }}

    .latest-badge {{
      position: absolute;
      right: 2mm;
      top: 0;
      z-index: 5;
      padding: 2mm 3.2mm;
      border-radius: 999px;
      background: #ffffff;
      border: 0.35mm solid #dfe8dc;
      box-shadow: 0 1mm 2.4mm rgba(37, 49, 43, 0.07);
      color: var(--green);
      font-size: 6.5pt;
      line-height: 1;
      letter-spacing: 0.06em;
      font-weight: 800;
    }}

    .phone {{
      position: absolute;
      padding: 2.1mm 1.8mm 1.7mm;
      border: 0.45mm solid #d3ddd4;
      border-radius: 6.2mm;
      background: #ffffff;
      box-shadow: 0 3mm 7mm rgba(37, 49, 43, 0.18);
      transform-origin: center;
    }}

    .phone-primary {{
      left: 0;
      top: 13mm;
      z-index: 2;
      width: 47mm;
      height: 81.5mm;
      transform: rotate(-1.7deg);
    }}

    .phone-secondary {{
      right: 0.5mm;
      top: 49mm;
      z-index: 3;
      width: 42mm;
      height: 72.8mm;
      transform: rotate(1.8deg);
    }}

    .phone::before {{
      content: "";
      position: absolute;
      left: 50%;
      top: 0.9mm;
      width: 9mm;
      height: 1.1mm;
      transform: translateX(-50%);
      border-radius: 999px;
      background: #cbd5cc;
      z-index: 2;
    }}

    .phone img {{
      display: block;
      width: 100%;
      height: 100%;
      object-fit: contain;
      border-radius: 4.3mm;
      background: var(--cream);
    }}

    .screen-caption {{
      position: absolute;
      left: 4mm;
      right: 0;
      bottom: 0;
      z-index: 5;
      margin: 0;
      text-align: center;
      font-size: 7pt;
      line-height: 1.3;
      color: #647069;
      font-weight: 650;
      letter-spacing: -0.015em;
    }}

    .flow {{
      position: absolute;
      left: 16mm;
      right: 16mm;
      top: 177mm;
      height: 54mm;
    }}

    .section-kicker {{
      margin: 0;
      color: var(--coral);
      font-size: 7.2pt;
      line-height: 1;
      letter-spacing: 0.12em;
      font-weight: 800;
    }}

    .section-title {{
      margin: 2.2mm 0 0;
      font-size: 16.5pt;
      line-height: 1.2;
      letter-spacing: -0.035em;
      font-weight: 820;
    }}

    .flow-grid {{
      margin-top: 5.6mm;
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 8mm;
    }}

    .flow-item {{
      position: relative;
      min-height: 30mm;
      padding-top: 3.8mm;
      border-top: 1.15mm solid var(--item-color);
    }}

    .flow-number {{
      margin: 0 0 2.5mm;
      color: var(--item-color);
      font-size: 7.1pt;
      line-height: 1;
      letter-spacing: 0.08em;
      font-weight: 840;
    }}

    .flow-item h3 {{
      margin: 0;
      font-size: 11.5pt;
      line-height: 1.25;
      letter-spacing: -0.025em;
      font-weight: 790;
      color: var(--ink);
    }}

    .flow-item p {{
      margin: 2.2mm 0 0;
      font-size: 8.7pt;
      line-height: 1.48;
      letter-spacing: -0.012em;
      font-weight: 520;
      color: #647069;
    }}

    .cta {{
      position: absolute;
      left: 16mm;
      right: 16mm;
      top: 239mm;
      height: 40.5mm;
      border-radius: 6mm;
      background: var(--green-soft);
      overflow: hidden;
    }}

    .cta::before {{
      content: "";
      position: absolute;
      left: -15mm;
      bottom: -22mm;
      width: 53mm;
      height: 53mm;
      border-radius: 50%;
      border: 8mm solid rgba(88, 189, 47, 0.08);
    }}

    .cta-copy {{
      position: absolute;
      left: 8mm;
      top: 7.2mm;
      width: 121mm;
    }}

    .cta-label {{
      margin: 0 0 2.7mm;
      color: var(--green);
      font-size: 7.2pt;
      line-height: 1;
      letter-spacing: 0.11em;
      font-weight: 820;
    }}

    .cta h2 {{
      margin: 0;
      font-size: 17.5pt;
      line-height: 1.22;
      letter-spacing: -0.04em;
      font-weight: 830;
      color: var(--ink);
    }}

    .cta-desc {{
      margin: 2.6mm 0 0;
      color: #5d6a62;
      font-size: 8.2pt;
      line-height: 1.35;
      font-weight: 540;
      letter-spacing: -0.01em;
    }}

    .qr-block {{
      position: absolute;
      right: 6mm;
      top: 4.2mm;
      width: 33mm;
      text-align: center;
    }}

    .qr-label {{
      margin: 0 0 1.5mm;
      color: var(--green);
      font-size: 6.7pt;
      line-height: 1;
      letter-spacing: 0.13em;
      font-weight: 840;
    }}

    .qr {{
      display: block;
      width: 26mm;
      height: 26mm;
      margin: 0 auto;
      border: 1.2mm solid #ffffff;
      background: #ffffff;
      image-rendering: pixelated;
      box-shadow: 0 1mm 2.4mm rgba(37, 49, 43, 0.12);
    }}

    .qr-title {{
      margin: 1.4mm 0 0;
      color: var(--ink);
      font-size: 6.9pt;
      line-height: 1.15;
      font-weight: 760;
    }}

    .footer {{
      position: absolute;
      left: 16mm;
      right: 16mm;
      bottom: 6mm;
      padding-top: 3mm;
      border-top: 0.35mm solid var(--line);
      color: #6e7972;
      font-size: 8pt;
      line-height: 1.35;
      letter-spacing: -0.01em;
      font-weight: 510;
    }}
  </style>
</head>
<body>
  <main class="page" data-document-role="page" data-label="Haru 회사 소개 전단지">
    <div class="top-rule" aria-hidden="true"></div>

    <header class="brandbar">
      <img class="brand-logo" src="{logo}" alt="Haru">
      <div class="edition">
        COMPANY INTRODUCTION<br>
        <span>DAILY MEMORY ROUTINE</span>
      </div>
    </header>

    <section class="hero-copy" aria-label="Haru 소개">
      <p class="eyebrow">FOR EVERYDAY MOMENTS</p>
      <h1>오늘의 기억이<br><em>내일의 대화</em>가<br>되도록</h1>
      <p class="intro">
        Haru는 60-80대 고령 사용자를 위한<br>
        하루 5분 인지·회상 루틴입니다.<br>
        큰 글자와 쉬운 터치, 선택·말하기 중심으로<br>
        오늘을 돌아보고 기억 단서를 남깁니다.
      </p>
      <div class="audiences" aria-label="주요 사용자">
        <span class="audience">고령 사용자</span>
        <span class="audience">가족·보호자</span>
        <span class="audience">복지·상담 현장</span>
      </div>
      <p class="brand-meaning">하루 · 매일의 루틴 &nbsp;&nbsp;|&nbsp;&nbsp; はる · 봄과 새로운 시작</p>
    </section>

    <section class="hero-visual" aria-label="Haru 최신 실제 앱 화면">
      <div class="latest-badge">ACTUAL PRODUCT UI</div>
      <div class="phone phone-primary">
        <img src="{sequence_screen}" alt="단어를 듣고 순서대로 고르는 Haru 최신 화면">
      </div>
      <div class="phone phone-secondary">
        <img src="{daily_screen}" alt="일상 계산을 큰 선택지로 푸는 Haru 최신 화면">
      </div>
      <p class="screen-caption">실제 최신 화면 · 듣기 · 큰 선택 · 일상 맥락</p>
    </section>

    <section class="flow" aria-label="Haru 핵심 가치">
      <p class="section-kicker">HOW HARU WORKS</p>
      <h2 class="section-title">Haru가 만드는 하루의 흐름</h2>
      <div class="flow-grid">
        <article class="flow-item" style="--item-color: #34731f;">
          <p class="flow-number">01</p>
          <h3>짧고 쉬운 루틴</h3>
          <p>날짜·주의·말하기·그리기·회상을 한 번에 하나씩 진행합니다.</p>
        </article>
        <article class="flow-item" style="--item-color: #c9574f;">
          <p class="flow-number">02</p>
          <h3>개인 기억 단서</h3>
          <p>오늘의 경험을 다음 복습과 가족 대화로 자연스럽게 연결합니다.</p>
        </article>
        <article class="flow-item" style="--item-color: #557f7d;">
          <p class="flow-number">03</p>
          <h3>함께 보는 흐름</h3>
          <p>참여 흐름과 대화 제안을 보호자·상담사 화면에서 확인합니다.</p>
        </article>
      </div>
    </section>

    <section class="cta" aria-label="Haru 데모">
      <div class="cta-copy">
        <p class="cta-label">START WITH FIVE MINUTES</p>
        <h2>매일의 작은 참여가<br>다음 대화의 단서가 됩니다.</h2>
        <p class="cta-desc">선택하고 · 말하고 · 그리며 쌓이는 Haru의 일상 기록</p>
      </div>
      <div class="qr-block">
        <p class="qr-label">LIVE DEMO</p>
        <a href="https://saerok-memory.vercel.app/lesson" aria-label="Haru 데모 열기">
          <img class="qr" src="{qr}" alt="Haru 데모 QR 코드">
        </a>
        <p class="qr-title">Haru 데모 열기</p>
      </div>
    </section>

    <footer class="footer">
      Haru는 공식 의료 도구가 아닙니다. 자체 활동 기록은 일상 지원과 대화 준비를 위한 참고 정보입니다.
    </footer>
  </main>
</body>
</html>
"""

    OUTPUT_HTML.write_text(html, encoding="utf-8")
    print(OUTPUT_HTML)


if __name__ == "__main__":
    main()
