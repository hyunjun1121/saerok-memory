from __future__ import annotations

from pathlib import Path

from build_flyer_reference import (
    cropped_png_data_uri,
    data_uri,
    icon,
    subset_font_data_uri,
)


ROOT = Path(r"C:\project\saerok-memory")
OUTPUT_DIR = ROOT / "피우다프로젝트" / "전단지" / "제로베이스_회사소개_전단지"
OUTPUT_HTML = OUTPUT_DIR / "Haru_회사소개_전단지_대형타이포_재배치_v4_편집원본.html"

FONT_TEXT = """
Haru 하루 회사 소개 COMPANY PROFILE
동의 기반 맞춤 기억 인지 루틴 오늘의 기억이 내일의 대화가 됩니다
큰 글자와 쉬운 선택으로 오늘을 돌아보고 기억 단서를 남깁니다
보호자 상담사는 참여 흐름과 대화 제안을 확인합니다
약 5분 큰 글자 큰 선택 3개 언어 탁상형 사용 콘셉트
Haru가 만드는 변화 바로 시작하는 하루 앱을 열면 한 화면 한 활동으로 바로 시작합니다
기억을 대화로 오늘 경험을 기억 단서로 남기고 다음 회상과 대화에 연결합니다
함께 보는 참여 흐름 보호자 상담사는 참여 기록과 대화 제안을 확인합니다
한눈에 보는 사용 흐름 오늘 루틴 시작 큰 선택으로 활동 참여 흐름과 대화 제안 확인
설계 원칙 한 화면 한 가지 활동 허용한 기억만 선택 공유 개인 기억 기본 비공개 점수보다 반복 참여
활용 대상 60 80대 사용자 가족 보호자 복지관 돌봄 현장 상담사 돌봄 실무자 한국어 일본어 영어 지원
Haru는 의료기기나 공식 인지검사가 아닙니다 질환을 진단 예측 예방하지 않으며 일상 루틴과 대화 준비를 돕는 비임상 지원 도구입니다
LIVE DEMO 데모 열기 01 02 03 · + - ~ , . ( )
"""


def main() -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    font = subset_font_data_uri(Path(r"C:\Windows\Fonts\PretendardVariable.ttf"), FONT_TEXT)
    logo = cropped_png_data_uri(ROOT / "public" / "assets" / "haru" / "logo.png", 36)
    hero = data_uri(
        ROOT
        / "피우다프로젝트"
        / "일본인멘토_피드백"
        / "오가사_Haru_추출이미지"
        / "개발계획서_04_한국어_어르신_탁상형기기사용_p05.jpg"
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
  <title>Haru 회사 소개 전단지 - 대형 타이포 재배치 v4</title>
  <style>
    @font-face {{
      font-family: "Pretendard Embedded";
      src: url("{font}") format("woff2");
      font-style: normal;
      font-weight: 100 900;
      font-display: block;
    }}

    :root {{
      --ink: #241d19;
      --body: #514943;
      --muted: #746b64;
      --coral: #e85f36;
      --coral-deep: #ca4926;
      --coral-soft: #fff4ef;
      --green: #5f8d4f;
      --green-deep: #3f7133;
      --green-soft: #f3f8f0;
      --blue: #467cba;
      --blue-deep: #315f96;
      --blue-soft: #f1f6fc;
      --line: #e8dfd8;
      --line-strong: #d9cec5;
      --warm: #fffaf6;
      --white: #ffffff;
    }}

    @page {{ size: 210mm 297mm; margin: 0; }}
    * {{ box-sizing: border-box; }}

    html,
    body {{
      width: 210mm;
      height: 297mm;
      margin: 0;
      padding: 0;
      background: var(--white);
    }}

    body {{
      font-family: "Pretendard Embedded", "Pretendard", "Noto Sans KR", sans-serif;
      color: var(--ink);
      -webkit-font-smoothing: antialiased;
      text-rendering: geometricPrecision;
    }}

    svg {{ display: block; width: 100%; height: 100%; }}

    .page {{
      position: relative;
      width: 210mm;
      height: 297mm;
      overflow: hidden;
      background: #fff;
      border: 0;
    }}

    .hero {{
      position: absolute;
      inset: 0 0 auto 0;
      height: 100mm;
      overflow: hidden;
      background: #fff;
    }}

    .hero-photo {{
      position: absolute;
      left: 76mm;
      top: 0;
      width: 134mm;
      height: 100mm;
      object-fit: cover;
      object-position: 50% 50%;
      display: block;
    }}

    .hero-fade {{
      position: absolute;
      left: 48mm;
      top: 0;
      width: 74mm;
      height: 100mm;
      background: linear-gradient(90deg, #fff 0%, rgba(255,255,255,.99) 39%, rgba(255,255,255,.92) 59%, rgba(255,255,255,.46) 78%, rgba(255,255,255,0) 100%);
      pointer-events: none;
    }}

    .hero-bottom-rule {{
      position: absolute;
      left: 0;
      right: 0;
      bottom: 0;
      height: .45mm;
      background: linear-gradient(90deg, var(--coral) 0 32%, #f0cbbd 32% 58%, rgba(240,203,189,0) 88%);
    }}

    .hero-copy {{
      position: absolute;
      left: 12mm;
      top: 8.5mm;
      width: 95mm;
      z-index: 3;
    }}

    .brand-row {{
      display: flex;
      align-items: center;
      gap: 3mm;
      height: 9mm;
    }}

    .brand-logo {{
      width: 25.5mm;
      height: 8.7mm;
      object-fit: contain;
      object-position: left center;
    }}

    .brand-rule {{
      width: .28mm;
      height: 4.4mm;
      background: #d9d1cb;
    }}

    .brand-meta {{
      margin: 0;
      color: #81776f;
      font-size: 8.5pt;
      line-height: 1;
      letter-spacing: .09em;
      font-weight: 500;
    }}

    .hero-title {{
      margin: 4.2mm 0 0;
      padding-bottom: 1.5mm;
      font-size: 44pt;
      line-height: 1;
      letter-spacing: -.035em;
      font-weight: 800;
      color: #211915;
    }}

    .hero-title span {{
      margin-left: 1.6mm;
      font-size: 29pt;
      letter-spacing: -.025em;
      font-weight: 800;
    }}

    .hero-subtitle {{
      margin: 2mm 0 0;
      color: #312722;
      font-size: 17pt;
      line-height: 1.2;
      letter-spacing: -.035em;
      font-weight: 800;
    }}

    .accent-line {{
      width: 7.5mm;
      height: .7mm;
      margin-top: 3.8mm;
      border-radius: 999px;
      background: var(--coral);
    }}

    .hero-promise {{
      margin: 2.8mm 0 0;
      color: var(--coral-deep);
      font-size: 16pt;
      line-height: 1.22;
      letter-spacing: -.02em;
      font-weight: 800;
    }}

    .hero-body {{
      width: 90mm;
      margin: 2.4mm 0 0;
      color: var(--body);
      font-size: 10.8pt;
      line-height: 1.42;
      letter-spacing: -.01em;
      font-weight: 400;
    }}

    .fact-row {{
      position: absolute;
      left: 12mm;
      top: 85.5mm;
      z-index: 4;
      display: inline-flex;
      align-items: center;
      height: 11mm;
      padding: 0 3mm;
      border: .3mm solid rgba(232,95,54,.42);
      border-radius: 3.1mm;
      background: rgba(255,255,255,.96);
      box-shadow: 0 1mm 3mm rgba(57,42,33,.08);
    }}

    .fact {{
      display: flex;
      align-items: center;
      gap: 1.5mm;
      padding: 0 3mm;
      color: #3c332e;
      font-size: 10pt;
      line-height: 1;
      letter-spacing: -.018em;
      font-weight: 700;
      white-space: nowrap;
    }}

    .fact:first-child {{ padding-left: 0; }}
    .fact:last-child {{ padding-right: 0; }}

    .fact + .fact {{ border-left: .26mm solid #ddd4cd; }}

    .fact .icon {{
      width: 5.4mm;
      height: 5.4mm;
      color: var(--fact-color);
    }}

    .photo-label {{
      position: absolute;
      right: 8.5mm;
      bottom: 3.2mm;
      z-index: 3;
      display: inline-flex;
      align-items: center;
      gap: 1.4mm;
      min-height: 7.4mm;
      padding: 0 2.5mm;
      border-radius: 999px;
      background: rgba(255,255,255,.94);
      border: .26mm solid rgba(255,255,255,.8);
      box-shadow: 0 .9mm 2.6mm rgba(38,30,25,.17);
      color: #5b514b;
      font-size: 9.2pt;
      line-height: 1;
      letter-spacing: -.01em;
      font-weight: 700;
    }}

    .photo-label::before {{
      content: "";
      width: 1.6mm;
      height: 1.6mm;
      border-radius: 50%;
      background: var(--coral);
    }}

    .section {{
      position: absolute;
      left: 12mm;
      right: 12mm;
    }}

    .section-heading {{
      display: flex;
      align-items: center;
      gap: 2.3mm;
      margin: 0;
      color: #2b211d;
      font-size: 17pt;
      line-height: 1;
      letter-spacing: -.035em;
      font-weight: 800;
    }}

    .section-heading .heading-icon {{
      width: 7.5mm;
      height: 7.5mm;
      color: var(--heading-color);
      flex: 0 0 auto;
    }}

    .value-section {{ top: 105mm; height: 64mm; }}

    .value-grid {{
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 6mm;
      margin-top: 4.5mm;
    }}

    .value-card {{
      position: relative;
      height: 51.5mm;
      padding: 5mm 4.6mm 4.5mm;
      border: .32mm solid var(--line);
      border-top: .85mm solid var(--card-color);
      border-radius: 3.5mm;
      background: #fff;
    }}

    .value-card-top {{
      display: flex;
      align-items: center;
      gap: 2.8mm;
    }}

    .value-icon {{
      width: 11.5mm;
      height: 11.5mm;
      padding: 2.3mm;
      border-radius: 3mm;
      background: var(--card-tint);
      color: var(--card-color);
      flex: 0 0 auto;
    }}

    .value-kicker {{
      margin: 0 0 1mm;
      color: var(--card-color);
      font-size: 7pt;
      line-height: 1;
      letter-spacing: .08em;
      font-weight: 820;
    }}

    .value-card h3 {{
      margin: 0;
      color: #302621;
      font-size: 13.5pt;
      line-height: 1.2;
      letter-spacing: -.028em;
      font-weight: 800;
    }}

    .value-card p {{
      margin: 4mm 0 0;
      color: var(--body);
      font-size: 10.5pt;
      line-height: 1.4;
      letter-spacing: -.01em;
      font-weight: 400;
    }}

    .flow-section {{ top: 174mm; height: 43mm; }}

    .flow-panel {{
      position: relative;
      height: 32mm;
      margin-top: 4.3mm;
      border: .3mm solid #e3d8d0;
      border-radius: 4mm;
      background: #fffaf6;
      overflow: hidden;
    }}

    .flow-grid {{
      position: absolute;
      inset: 0;
      display: grid;
      grid-template-columns: repeat(3, 1fr);
    }}

    .flow-step {{
      position: relative;
      display: grid;
      grid-template-columns: 9.5mm 7mm 1fr;
      align-items: center;
      gap: 2.4mm;
      padding: 4.8mm 5.2mm;
    }}

    .flow-step + .flow-step {{ border-left: .26mm solid #e0d6cf; }}

    .flow-num {{
      display: grid;
      place-items: center;
      width: 9.5mm;
      height: 9.5mm;
      border-radius: 50%;
      background: var(--step-color);
      color: #fff;
      font-size: 12pt;
      line-height: 1;
      font-weight: 800;
    }}

    .flow-icon {{
      width: 7mm;
      height: 7mm;
      color: var(--step-color);
      flex: 0 0 auto;
    }}

    .flow-copy .flow-label {{
      display: flex;
      align-items: center;
      gap: 1.7mm;
      color: var(--step-color);
      font-size: 7.8pt;
      line-height: 1;
      letter-spacing: .07em;
      font-weight: 820;
    }}

    .flow-label .icon {{ width: 4.3mm; height: 4.3mm; }}

    .flow-step h3 {{
      margin: 0;
      color: #312722;
      font-size: 12.2pt;
      line-height: 1.24;
      letter-spacing: -.024em;
      font-weight: 800;
    }}

    .bottom-section {{
      top: 222mm;
      height: 42mm;
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 4mm;
    }}

    .info-card {{
      height: 42mm;
      padding: 4.2mm 4.8mm 4mm;
      border: .3mm solid var(--card-border);
      border-radius: 3.7mm;
      background: var(--card-bg);
    }}

    .mini-heading {{
      display: flex;
      align-items: center;
      gap: 2.1mm;
      margin: 0;
      color: #302722;
      font-size: 14pt;
      line-height: 1;
      letter-spacing: -.03em;
      font-weight: 800;
    }}

    .mini-heading .icon {{
      width: 7.1mm;
      height: 7.1mm;
      color: var(--heading-color);
    }}

    .principle-grid {{
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 3.2mm 4mm;
      margin-top: 4.6mm;
    }}

    .principle {{
      display: flex;
      align-items: center;
      gap: 1.8mm;
      color: var(--body);
      font-size: 10.2pt;
      line-height: 1.26;
      letter-spacing: -.016em;
      font-weight: 500;
    }}

    .check {{
      display: grid;
      place-items: center;
      width: 4mm;
      height: 4mm;
      border-radius: 50%;
      background: var(--green);
      color: #fff;
      font-size: 6.8pt;
      line-height: 1;
      font-weight: 900;
      flex: 0 0 auto;
    }}

    .audience-grid {{
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 2.6mm;
      margin-top: 4.5mm;
    }}

    .audience-pill {{
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 8.3mm;
      padding: 0 2mm;
      border: .28mm solid var(--pill-color);
      border-radius: 2.6mm;
      background: #fff;
      color: #4a423d;
      text-align: center;
      font-size: 10pt;
      line-height: 1.18;
      letter-spacing: -.018em;
      font-weight: 700;
    }}

    .language-note {{
      margin: 2.5mm 0 0;
      color: var(--blue-deep);
      font-size: 8.9pt;
      line-height: 1;
      letter-spacing: -.01em;
      font-weight: 730;
      text-align: right;
    }}

    .footer-strip {{
      position: absolute;
      left: 12mm;
      right: 12mm;
      top: 269mm;
      height: 22mm;
      display: grid;
      grid-template-columns: 8mm 1fr 17mm;
      align-items: center;
      gap: 2.6mm;
      padding: 2mm 2.3mm 2mm 3mm;
      border: .35mm solid rgba(232,95,54,.58);
      border-radius: 4mm;
      background: var(--warm);
    }}

    .footer-heart {{
      width: 7.5mm;
      height: 7.5mm;
      color: var(--coral);
    }}

    .footer-text {{
      margin: 0;
      color: var(--body);
      font-size: 9.2pt;
      line-height: 1.35;
      letter-spacing: -.01em;
      font-weight: 400;
    }}

    .footer-text strong {{
      color: #312621;
      font-weight: 800;
    }}

    .footer-qr {{
      display: grid;
      justify-items: center;
      gap: .7mm;
      color: var(--coral-deep);
      text-decoration: none;
    }}

    .footer-qr img {{
      display: block;
      width: 14mm;
      height: 14mm;
      background: #fff;
      border: .5mm solid #fff;
      image-rendering: pixelated;
    }}

    .footer-qr span {{
      font-size: 8.2pt;
      line-height: 1;
      letter-spacing: .08em;
      font-weight: 700;
    }}
  </style>
</head>
<body>
  <main class="page" data-document-role="page" data-label="Haru 회사 소개 전단지 - 대형 타이포 재배치 v4">
    <section class="hero" aria-label="Haru 소개">
      <img class="hero-photo" src="{hero}" alt="고령 사용자가 탁상형 Haru 기기를 사용하는 장면">
      <div class="hero-fade" aria-hidden="true"></div>
      <div class="hero-bottom-rule" aria-hidden="true"></div>

      <div class="hero-copy">
        <div class="brand-row">
          <img class="brand-logo" src="{logo}" alt="Haru">
          <span class="brand-rule" aria-hidden="true"></span>
          <p class="brand-meta">COMPANY PROFILE</p>
        </div>
        <h1 class="hero-title">Haru<span>(하루)</span></h1>
        <p class="hero-subtitle">동의 기반 맞춤 기억·인지 루틴</p>
        <div class="accent-line" aria-hidden="true"></div>
        <p class="hero-promise">오늘의 기억이,<br>내일의 대화가 됩니다</p>
        <p class="hero-body">큰 글자와 쉬운 선택으로 기억 단서를 남기고,<br>보호자·상담사는 참여 흐름을 확인합니다.</p>
      </div>

      <div class="fact-row" aria-label="Haru 핵심 특징">
        <div class="fact" style="--fact-color: var(--coral);"><span class="icon">{icon('clock')}</span><span>약 5분</span></div>
        <div class="fact" style="--fact-color: var(--green);"><span class="icon">{icon('grid')}</span><span>큰 글자·큰 선택</span></div>
        <div class="fact" style="--fact-color: var(--blue);"><span class="icon">{icon('chat')}</span><span>한국어·일본어·영어</span></div>
      </div>

      <div class="photo-label">탁상형 사용 콘셉트</div>
    </section>

    <section class="section value-section" aria-label="Haru 핵심 가치">
      <h2 class="section-heading" style="--heading-color: var(--coral);">
        <span class="heading-icon">{icon('memory')}</span><span>Haru가 만드는 변화</span>
      </h2>
      <div class="value-grid">
        <article class="value-card" style="--card-color: var(--coral); --card-tint: var(--coral-soft);">
          <div class="value-card-top">
            <span class="value-icon">{icon('tap')}</span>
            <h3>바로 시작하는 하루</h3>
          </div>
          <p>앱을 열면 한 화면·한 활동으로<br>바로 시작합니다.</p>
        </article>
        <article class="value-card" style="--card-color: var(--green); --card-tint: var(--green-soft);">
          <div class="value-card-top">
            <span class="value-icon">{icon('memory')}</span>
            <h3>기억을 대화로</h3>
          </div>
          <p>오늘 경험을 기억 단서로 남겨<br>다음 회상과 대화로 잇습니다.</p>
        </article>
        <article class="value-card" style="--card-color: var(--blue); --card-tint: var(--blue-soft);">
          <div class="value-card-top">
            <span class="value-icon">{icon('users')}</span>
            <h3>함께 보는 흐름</h3>
          </div>
          <p>보호자·상담사는 참여 흐름과<br>대화 제안을 확인합니다.</p>
        </article>
      </div>
    </section>

    <section class="section flow-section" aria-label="Haru 사용 흐름">
      <h2 class="section-heading" style="--heading-color: var(--green);">
        <span class="heading-icon">{icon('play')}</span><span>사용 흐름</span>
      </h2>
      <div class="flow-panel">
        <div class="flow-grid">
          <article class="flow-step" style="--step-color: var(--coral);">
            <span class="flow-num">1</span>
            <span class="flow-icon">{icon('play')}</span><h3>오늘 루틴 시작</h3>
          </article>
          <article class="flow-step" style="--step-color: var(--green);">
            <span class="flow-num">2</span>
            <span class="flow-icon">{icon('audio')}</span><h3>큰 선택으로 참여</h3>
          </article>
          <article class="flow-step" style="--step-color: var(--blue);">
            <span class="flow-num">3</span>
            <span class="flow-icon">{icon('chat')}</span><h3>참여 흐름 확인</h3>
          </article>
        </div>
      </div>
    </section>

    <section class="section bottom-section" aria-label="설계 원칙과 활용 대상">
      <article class="info-card" style="--card-border: #d8d8c7; --card-bg: #fffef9;">
        <h2 class="mini-heading" style="--heading-color: var(--green);"><span class="icon">{icon('star')}</span><span>설계 원칙</span></h2>
        <div class="principle-grid">
          <div class="principle"><span class="check">✓</span><span>한 화면·한 활동</span></div>
          <div class="principle"><span class="check">✓</span><span>허용한 기억만 공유</span></div>
          <div class="principle"><span class="check">✓</span><span>개인 기억 기본 비공개</span></div>
          <div class="principle"><span class="check">✓</span><span>반복 참여 흐름 중심</span></div>
        </div>
      </article>

      <article class="info-card" style="--card-border: #cedced; --card-bg: #fbfdff;">
        <h2 class="mini-heading" style="--heading-color: var(--blue);"><span class="icon">{icon('users')}</span><span>활용 대상</span></h2>
        <div class="audience-grid">
          <div class="audience-pill" style="--pill-color:#ee9f7e;">60~80대 사용자</div>
          <div class="audience-pill" style="--pill-color:#9cba90;">가족·보호자</div>
          <div class="audience-pill" style="--pill-color:#e7bb62;">복지관·돌봄 현장</div>
          <div class="audience-pill" style="--pill-color:#8aaed5;">상담사·돌봄 실무자</div>
        </div>
      </article>
    </section>

    <footer class="footer-strip">
      <span class="footer-heart">{icon('heart')}</span>
      <p class="footer-text"><strong>Haru는 의료기기나 공식 인지검사가 아닙니다.</strong><br>질환을 진단·예측·예방하지 않으며, 일상 루틴과 대화를 돕는 비임상 도구입니다.</p>
      <a class="footer-qr" href="https://saerok-memory.vercel.app/lesson" aria-label="Haru 데모 열기"><img src="{qr}" alt="Haru 데모 QR 코드"><span>데모 보기</span></a>
    </footer>
  </main>
</body>
</html>
"""

    OUTPUT_HTML.write_text(html, encoding="utf-8")
    print(OUTPUT_HTML)


if __name__ == "__main__":
    main()
