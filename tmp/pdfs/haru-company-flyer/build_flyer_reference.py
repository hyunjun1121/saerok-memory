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
OUTPUT_HTML = OUTPUT_DIR / "Haru_회사소개_전단지_기준카피정합_v6_편집원본.html"

FONT_TEXT = """
OGASA Labs Haru 하루 AI 개인화 두뇌운동 키오스크
검사처럼 느껴지지 않는 하루 3분 두뇌운동
어르신의 어제 이야기가 오늘의 문항이 되는 AI 인지돌봄 솔루션
하루 3 5분 4개 물리버튼 보호자 기관 연계
왜 필요한가 인지 변화는 진단 이전부터 시작되지만 매일 가볍게 확인할 도구는 부족합니다
기존 앱과 검사는 고령자에게 조작 부담과 심리적 부담이 큽니다
복지 의료기관은 반복적 모니터링을 수행할 시간과 인력이 부족합니다
Haru의 해결 방식 초간단 사용 흐름 카드 태깅 후 바로 시작 복잡한 로그인과 메뉴 탐색이 없습니다
고령자 친화 UX 비터치 화면 2 2 물리버튼 마이크로 직관적인 사용이 가능합니다
AI 개인화 문항 어제의 발화가 오늘의 문항이 되는 회상 기반 두뇌운동을 제공합니다
리포트 연계 보호자와 기관이 참여 흐름과 변화 패턴을 자연스럽게 확인할 수 있습니다
사용 흐름 카드 태깅 질문 듣고 답하기 리포트 확인
하루 1회 약 3 5분 사회복지사 초기 안내 후 어르신 단독 사용 가능
핵심 차별점 검사 중심이 아닌 일상 루틴 점수 중심이 아닌 변화 추이 공통 문제은행이 아닌 개인화 회상 앱 중심이 아닌 기관 설치형 키오스크
적용 대상 복지관 치매안심센터 주야간보호센터 요양시설 65세 이상 어르신 한국 일본 확장형 콘텐츠
Haru는 의료적 진단 기기가 아닌 생활 기반의 일상 인지돌봄 솔루션입니다
01 02 03 · + - ~ , . ( ) × ✓
"""


def data_uri(path: Path) -> str:
    mime, _ = mimetypes.guess_type(path.name)
    if not mime:
        mime = "application/octet-stream"
    payload = base64.b64encode(path.read_bytes()).decode("ascii")
    return f"data:{mime};base64,{payload}"


def cropped_png_data_uri(path: Path, padding: int = 24) -> str:
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


def icon(name: str, color: str = "currentColor", stroke: float = 1.8) -> str:
    icons = {
        "clock": '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5v5l3.2 2"/>',
        "grid": '<rect x="4" y="4" width="6" height="6" rx="1.5"/><rect x="14" y="4" width="6" height="6" rx="1.5"/><rect x="4" y="14" width="6" height="6" rx="1.5"/><rect x="14" y="14" width="6" height="6" rx="1.5"/>',
        "users": '<path d="M8.5 12a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z"/><path d="M3.8 19c.5-3 2.1-4.5 4.7-4.5s4.2 1.5 4.7 4.5"/><path d="M16 11a2.5 2.5 0 1 0 0-5"/><path d="M15 14.7c2.9.1 4.5 1.5 5 4.3"/>',
        "alert": '<circle cx="12" cy="12" r="9"/><path d="M12 7.2v6.1"/><path d="M12 16.8h.01"/>',
        "tap": '<path d="M9.2 12.2V6.5a1.8 1.8 0 1 1 3.6 0v4.1"/><path d="M12.8 9.2a1.8 1.8 0 1 1 3.6 0v2.1"/><path d="M16.4 10.3a1.8 1.8 0 1 1 3.6 0v3.9c0 3.8-2.5 6.3-6.4 6.3h-1.1c-2.5 0-4.2-.8-5.6-2.8l-2.4-3.4a1.9 1.9 0 0 1 3-2.2l1.7 2.1"/>',
        "access": '<rect x="3.8" y="4" width="16.4" height="16" rx="3"/><path d="M8 9h3v3H8zM13 9h3v3h-3zM8 14h3v3H8zM13 14h3v3h-3z"/>',
        "memory": '<path d="M12 20c4.7-2.7 7.3-5.3 7.3-9.2A4.3 4.3 0 0 0 12 7.7a4.3 4.3 0 0 0-7.3 3.1C4.7 14.7 7.3 17.3 12 20Z"/><path d="M12 7.7V4"/><path d="M9.5 4.8 12 3l2.5 1.8"/>',
        "report": '<rect x="5" y="3.5" width="14" height="17" rx="2"/><path d="M9 3.5V2.3h6v1.2"/><path d="M8.5 16v-3M12 16V9M15.5 16v-5"/>',
        "play": '<circle cx="12" cy="12" r="9"/><path d="m10 8 6 4-6 4V8Z"/>',
        "audio": '<path d="M4 13h4l4 4V7L8 11H4v2Z"/><path d="M15 9.2c1.5 1.4 1.5 4.2 0 5.6"/><path d="M17.5 6.8c3 2.8 3 7.6 0 10.4"/>',
        "chat": '<path d="M4 5.5h16v10H9l-4 3v-3H4v-10Z"/><path d="M8 10h8"/>',
        "star": '<path d="m12 3 2.7 5.5 6 .9-4.4 4.2 1.1 6-5.4-2.9-5.4 2.9 1.1-6-4.4-4.2 6-.9L12 3Z"/>',
        "heart": '<path d="M12 20S4 15.4 4 9.4A4.4 4.4 0 0 1 12 7a4.4 4.4 0 0 1 8 2.4C20 15.4 12 20 12 20Z"/>',
        "repeat": '<path d="M20 7h-4V3"/><path d="M19 6a8 8 0 0 0-13.5 2"/><path d="M4 17h4v4"/><path d="M5 18a8 8 0 0 0 13.5-2"/>',
        "kiosk": '<rect x="5" y="3" width="14" height="17" rx="2"/><path d="M7.5 5.5h9v6h-9z"/><path d="M8 14h2v2H8zM11 14h2v2h-2zM14 14h2v2h-2zM9.5 17h2v2h-2zM12.5 17h2v2h-2z"/>',
        "brain": '<path d="M10.5 5.2A3.2 3.2 0 0 0 5 7.5a3 3 0 0 0-1 5.7A3.2 3.2 0 0 0 7.2 18c.7 0 1.4-.2 2-.6.4 1.4 1.4 2.3 2.8 2.3V4.3c-1.2 0-2 .3-2.7 1.1"/><path d="M13.5 5.2A3.2 3.2 0 0 1 19 7.5a3 3 0 0 1 1 5.7A3.2 3.2 0 0 1 16.8 18c-.7 0-1.4-.2-2-.6-.4 1.4-1.4 2.3-2.8 2.3V4.3c1.2 0 2 .3 2.7 1.1"/><path d="M8 9c1.2 0 2 .7 2 1.8M16 9c-1.2 0-2 .7-2 1.8M8.5 14c1 0 1.6-.4 2-1.2M15.5 14c-1 0-1.6-.4-2-1.2"/>',
        "building": '<path d="M4 20V8l8-4 8 4v12"/><path d="M8 10h3v3H8zM13 10h3v3h-3zM8 15h3v3H8zM13 15h3v5"/>',
        "care": '<path d="M12 20c4.7-2.7 7.3-5.3 7.3-9.2A4.3 4.3 0 0 0 12 7.7a4.3 4.3 0 0 0-7.3 3.1C4.7 14.7 7.3 17.3 12 20Z"/><path d="M9 12h6M12 9v6"/>',
        "sun": '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5 19 19M19 5l-1.5 1.5M6.5 17.5 5 19"/>',
        "home": '<path d="m3 11 9-7 9 7"/><path d="M5 10v10h14V10M10 20v-6h4v6"/>',
        "person": '<circle cx="12" cy="8" r="3"/><path d="M6 20c.7-4.2 2.7-6.3 6-6.3s5.3 2.1 6 6.3"/>',
        "globe": '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 2.4 3.8 5.4 3.8 9S14.5 18.6 12 21M12 3C9.5 5.4 8.2 8.4 8.2 12S9.5 18.6 12 21"/>',
    }
    path = icons[name]
    return (
        f'<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" '
        f'stroke="{color}" stroke-width="{stroke}" stroke-linecap="round" '
        f'stroke-linejoin="round">{path}</svg>'
    )


def main() -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    font = subset_font_data_uri(Path(r"C:\Windows\Fonts\PretendardVariable.ttf"), FONT_TEXT)
    hero = data_uri(
        ROOT
        / "피우다프로젝트"
        / "일본인멘토_피드백"
        / "오가사_Haru_추출이미지"
        / "개발계획서_04_한국어_어르신_탁상형기기사용_p05.jpg"
    )
    html = f"""<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Haru 회사 소개 전단지 - 기준 카피 정합 v6</title>
  <style>
    @font-face {{
      font-family: "Pretendard Embedded";
      src: url("{font}") format("woff2");
      font-style: normal;
      font-weight: 100 900;
      font-display: block;
    }}

    :root {{
      --ink: #271f1b;
      --muted: #655f5a;
      --coral: #e86137;
      --coral-deep: #cf4e29;
      --coral-soft: #fff4ef;
      --green: #5f8d4f;
      --green-deep: #3f7133;
      --green-soft: #f4f9f1;
      --blue: #4579b7;
      --blue-soft: #f1f6fc;
      --yellow: #eca72c;
      --purple: #72558f;
      --line: #e7ded7;
      --line-strong: #d9cec5;
      --warm: #fffaf5;
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
      border: 0.22mm solid #dedede;
    }}

    .hero {{
      position: absolute;
      inset: 0 0 auto 0;
      height: 106.5mm;
      overflow: hidden;
      background: #fff;
    }}

    .hero-photo {{
      position: absolute;
      left: 58mm;
      top: 0;
      width: 152mm;
      height: 106.5mm;
      display: block;
      object-fit: cover;
      object-position: 50% 52%;
    }}

    .hero-wash {{
      position: absolute;
      inset: 0;
      background:
        linear-gradient(90deg, #fff 0%, rgba(255,255,255,1) 36%, rgba(255,255,255,.96) 45%, rgba(255,255,255,.76) 54%, rgba(255,255,255,.24) 65%, rgba(255,255,255,0) 76%);
    }}

    .screen-card {{
      position: absolute;
      right: 13.5mm;
      top: 27mm;
      width: 31.5mm;
      height: 55.5mm;
      padding: 1.1mm;
      border-radius: 3.1mm;
      border: .35mm solid rgba(218, 222, 217, .95);
      background: #fff;
      box-shadow: 0 2.2mm 6mm rgba(39,31,27,.2);
    }}

    .screen-card img {{
      width: 100%;
      height: 100%;
      display: block;
      object-fit: contain;
      border-radius: 2.2mm;
      filter: saturate(.96) contrast(.98);
    }}

    .actual-label {{
      position: absolute;
      right: 10.5mm;
      top: 85.5mm;
      display: inline-flex;
      align-items: center;
      gap: 1.6mm;
      height: 7mm;
      padding: 0 2.6mm;
      border-radius: 999px;
      background: rgba(255,255,255,.94);
      border: 0.3mm solid rgba(95,141,79,.35);
      box-shadow: 0 1.2mm 3mm rgba(45,38,32,.12);
      color: var(--green-deep);
      font-size: 6.4pt;
      line-height: 1;
      font-weight: 800;
      letter-spacing: -.01em;
    }}

    .actual-label::before {{
      content: "";
      width: 1.7mm;
      height: 1.7mm;
      border-radius: 50%;
      background: #58bd2f;
    }}

    .hero-copy {{
      position: absolute;
      left: 10.5mm;
      top: 8.8mm;
      width: 102mm;
      z-index: 5;
    }}

    .brand-row {{
      display: flex;
      align-items: center;
      height: 8.5mm;
    }}

    .brand-logo {{
      width: 24mm;
      height: 8mm;
      object-fit: contain;
      object-position: left center;
    }}

    .brand-wordmark {{
      margin: 0;
      color: var(--coral-deep);
      font-size: 10.8pt;
      line-height: 1;
      letter-spacing: -.015em;
      font-weight: 780;
    }}

    .brand-rule {{
      width: 0.3mm;
      height: 4.6mm;
      background: #d9d3ce;
    }}

    .brand-meta {{
      margin: 0;
      color: #867d76;
      font-size: 7.8pt;
      line-height: 1.15;
      letter-spacing: .12em;
      font-weight: 760;
    }}

    .hero-title {{
      margin: 5mm 0 0;
      padding-bottom: 1mm;
      font-size: 51pt;
      line-height: 1.06;
      letter-spacing: -.055em;
      font-weight: 880;
      color: #241b17;
    }}

    .hero-title span {{
      font-size: 31pt;
      letter-spacing: -.045em;
      font-weight: 820;
    }}

    .hero-subtitle {{
      margin: 2.2mm 0 0;
      font-size: 18.2pt;
      line-height: 1.18;
      letter-spacing: -.035em;
      font-weight: 820;
      color: #312723;
    }}

    .accent-line {{
      width: 7mm;
      height: .65mm;
      margin-top: 4.2mm;
      border-radius: 999px;
      background: var(--coral);
    }}

    .hero-promise {{
      margin: 3.1mm 0 0;
      color: var(--coral-deep);
      font-size: 14.5pt;
      line-height: 1.2;
      letter-spacing: -.028em;
      font-weight: 840;
    }}

    .hero-body {{
      margin: 2.3mm 0 0;
      color: #514943;
      font-size: 10.8pt;
      line-height: 1.48;
      letter-spacing: -.018em;
      font-weight: 540;
    }}

    .hero-chips {{
      position: absolute;
      left: 10.5mm;
      top: 88.3mm;
      z-index: 8;
      display: flex;
      gap: 2.4mm;
    }}

    .hero-chip {{
      display: flex;
      align-items: center;
      gap: 2.2mm;
      min-width: 38mm;
      height: 10.8mm;
      padding: 0 3.1mm 0 2.4mm;
      border-radius: 3.4mm;
      background: rgba(255,255,255,.96);
      border: .34mm solid var(--chip-color);
      box-shadow: 0 1.1mm 3mm rgba(48,38,32,.08);
      color: #302722;
      font-size: 10.4pt;
      line-height: 1;
      letter-spacing: -.018em;
      font-weight: 770;
      white-space: nowrap;
    }}

    .hero-chip:nth-child(2) {{ min-width: 46mm; }}
    .hero-chip:nth-child(3) {{ min-width: 48mm; }}

    .hero-chip .icon {{
      width: 6.4mm;
      height: 6.4mm;
      flex: 0 0 auto;
      color: var(--chip-color);
    }}

    .main-block {{
      position: absolute;
      left: 8.5mm;
      right: 8.5mm;
      top: 111mm;
      height: 64mm;
      display: grid;
      grid-template-columns: 59mm 1px 1fr;
      column-gap: 5mm;
    }}

    .section-heading {{
      display: flex;
      align-items: center;
      gap: 2.4mm;
      margin: 0;
      font-size: 17pt;
      line-height: 1;
      letter-spacing: -.035em;
      font-weight: 840;
      color: #2b211c;
    }}

    .section-heading .heading-icon {{
      width: 7.2mm;
      height: 7.2mm;
      color: var(--heading-color);
      flex: 0 0 auto;
    }}

    .why {{ padding-right: 1.5mm; }}

    .why-list {{
      list-style: none;
      margin: 5.5mm 0 0;
      padding: 0;
      display: grid;
      gap: 3.4mm;
    }}

    .why-list li {{
      position: relative;
      padding-left: 4.2mm;
      color: #514943;
      font-size: 9.2pt;
      line-height: 1.47;
      letter-spacing: -.018em;
      font-weight: 540;
    }}

    .why-list li::before {{
      content: "";
      position: absolute;
      left: .2mm;
      top: 2.1mm;
      width: 1.5mm;
      height: 1.5mm;
      border-radius: 50%;
      background: var(--coral);
    }}

    .main-divider {{
      width: 1px;
      height: 57mm;
      margin-top: 5mm;
      background: #e3ddd8;
    }}

    .solutions {{ min-width: 0; }}

    .solution-grid {{
      margin-top: 4.5mm;
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 2.7mm;
    }}

    .solution-card {{
      height: 51.5mm;
      padding: 3.8mm 2.3mm 3mm;
      border: .3mm solid var(--line);
      border-radius: 3.3mm;
      background: #fff;
      text-align: center;
    }}

    .solution-icon {{
      width: 12.8mm;
      height: 12.8mm;
      margin: 0 auto;
      padding: 2.7mm;
      border-radius: 4mm;
      background: var(--card-tint);
      color: var(--card-color);
    }}

    .solution-card h3 {{
      margin: 2.9mm 0 0;
      color: #332a25;
      font-size: 10.5pt;
      line-height: 1.2;
      letter-spacing: -.025em;
      font-weight: 810;
    }}

    .solution-card p {{
      margin: 1.9mm 0 0;
      color: #665e58;
      font-size: 8.25pt;
      line-height: 1.44;
      letter-spacing: -.035em;
      font-weight: 520;
    }}

    .flow-section {{
      position: absolute;
      left: 8.5mm;
      right: 8.5mm;
      top: 179mm;
      height: 50mm;
    }}

    .flow-panel {{
      position: absolute;
      left: 0;
      right: 0;
      top: 8mm;
      height: 42.5mm;
      border: .34mm solid var(--line-strong);
      border-radius: 4mm;
      background: #fff;
      overflow: hidden;
    }}

    .flow-grid {{
      position: absolute;
      left: 5mm;
      right: 5mm;
      top: 3.3mm;
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 9mm;
    }}

    .flow-step {{
      position: relative;
      display: grid;
      grid-template-columns: 9mm 1fr;
      grid-template-rows: 8.5mm 17mm;
      align-items: start;
      column-gap: 2.8mm;
      min-height: 25.5mm;
    }}

    .flow-num {{
      display: grid;
      place-items: center;
      width: 8mm;
      height: 8mm;
      border-radius: 50%;
      background: var(--step-color);
      color: #fff;
      font-size: 11pt;
      line-height: 1;
      font-weight: 850;
      grid-column: 1;
      grid-row: 1;
    }}

    .flow-info {{
      display: flex;
      align-items: center;
      gap: 2.8mm;
    }}

    .flow-icon {{
      width: 15mm;
      height: 15mm;
      color: var(--step-color);
      flex: 0 0 auto;
      grid-column: 1 / 3;
      grid-row: 2;
      justify-self: center;
    }}

    .flow-step h3 {{
      margin: 0;
      color: #312824;
      font-size: 11.2pt;
      line-height: 1.25;
      letter-spacing: -.025em;
      font-weight: 800;
      grid-column: 2;
      grid-row: 1;
      align-self: center;
      white-space: nowrap;
    }}

    .flow-arrow {{
      position: absolute;
      top: 17mm;
      width: 11mm;
      height: 1.5mm;
      background: #b8aaa0;
    }}

    .flow-arrow::after {{
      content: "";
      position: absolute;
      right: -1.5mm;
      top: -1.4mm;
      border-left: 2.2mm solid #b8aaa0;
      border-top: 2.2mm solid transparent;
      border-bottom: 2.2mm solid transparent;
    }}

    .arrow-one {{ left: 60mm; }}
    .arrow-two {{ left: 124mm; }}

    .flow-note {{
      position: absolute;
      left: 0;
      right: 0;
      bottom: 2.8mm;
      margin: 0;
      color: #625a54;
      text-align: center;
      font-size: 8.8pt;
      line-height: 1.3;
      letter-spacing: -.015em;
      font-weight: 540;
    }}

    .bottom-grid {{
      position: absolute;
      left: 8.5mm;
      right: 8.5mm;
      top: 235.3mm;
      height: 39.5mm;
      display: grid;
      grid-template-columns: 91mm 1fr;
      gap: 3.5mm;
    }}

    .bottom-card {{
      height: 39.5mm;
      padding: 4.5mm 4mm 3.5mm;
      border: .34mm solid var(--card-border);
      border-radius: 3.8mm;
      background: var(--card-bg);
    }}

    .mini-heading {{
      display: flex;
      align-items: center;
      gap: 2.1mm;
      margin: 0;
      color: #312823;
      font-size: 14.2pt;
      line-height: 1;
      letter-spacing: -.03em;
      font-weight: 830;
    }}

    .mini-heading .icon {{
      width: 7mm;
      height: 7mm;
      color: var(--heading-color);
    }}

    .difference-list {{
      margin: 4.7mm 0 0;
      position: relative;
      display: grid;
      grid-template-columns: 1fr 1fr;
      column-gap: 5mm;
      row-gap: 3.8mm;
    }}

    .difference-list::before {{
      content: "";
      position: absolute;
      left: 50%;
      top: 0;
      bottom: 0;
      border-left: .28mm dashed #d8cec6;
    }}

    .difference-item {{
      display: flex;
      align-items: flex-start;
      gap: 1.6mm;
      color: #514943;
      font-size: 8.7pt;
      line-height: 1.3;
      letter-spacing: -.016em;
      font-weight: 570;
    }}

    .check {{
      display: grid;
      place-items: center;
      width: 3.7mm;
      height: 3.7mm;
      margin-top: .1mm;
      border-radius: 50%;
      background: var(--green);
      color: #fff;
      font-size: 6.4pt;
      line-height: 1;
      font-weight: 900;
      flex: 0 0 auto;
    }}

    .target-grid {{
      margin-top: 4mm;
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 2.1mm;
    }}

    .target-pill {{
      display: flex;
      align-items: center;
      justify-content: flex-start;
      gap: .9mm;
      min-height: 8.2mm;
      padding: .5mm .9mm;
      border: .3mm solid var(--pill-color);
      border-radius: 2.7mm;
      background: var(--pill-bg);
      color: #4b443f;
      text-align: left;
      font-size: 8.25pt;
      line-height: 1.15;
      letter-spacing: -.02em;
      font-weight: 700;
    }}

    .target-pill .pill-icon {{
      width: 4.2mm;
      height: 4.2mm;
      flex: 0 0 auto;
      color: var(--pill-color);
    }}

    .target-pill > span:last-child {{ white-space: nowrap; }}

    .footer-strip {{
      position: absolute;
      left: 8.5mm;
      right: 8.5mm;
      top: 279.3mm;
      height: 11.5mm;
      display: grid;
      grid-template-columns: 8mm 1fr;
      align-items: center;
      column-gap: 2.4mm;
      padding: 1.4mm 3mm;
      border: .35mm solid rgba(232,97,55,.62);
      border-radius: 4mm;
      background: #fffaf6;
    }}

    .footer-heart {{
      width: 7mm;
      height: 7mm;
      color: var(--coral);
    }}

    .footer-text {{
      margin: 0;
      color: #514943;
      font-size: 9.5pt;
      line-height: 1.2;
      letter-spacing: -.016em;
      font-weight: 550;
    }}

    .footer-text strong {{
      color: #302722;
      font-weight: 810;
    }}

  </style>
</head>
<body>
  <main class="page" data-document-role="page" data-label="Haru 회사 소개 전단지 - 기준 카피 정합 v6">
    <section class="hero" aria-label="Haru 소개">
      <img class="hero-photo" src="{hero}" alt="고령 사용자가 탁상형 Haru 콘셉트 기기를 사용하는 장면">
      <div class="hero-wash" aria-hidden="true"></div>

      <div class="hero-copy">
        <div class="brand-row">
          <p class="brand-wordmark">OGASA Labs</p>
        </div>
        <h1 class="hero-title">Haru<span>(하루)</span></h1>
        <p class="hero-subtitle">AI 개인화 두뇌운동 키오스크</p>
        <div class="accent-line" aria-hidden="true"></div>
        <p class="hero-promise">검사처럼 느껴지지 않는 하루 3분 두뇌운동</p>
        <p class="hero-body">
          어르신의 ‘어제 이야기’가 ‘오늘의 문항’이 되는<br>
          AI 인지돌봄 솔루션
        </p>
      </div>

      <div class="hero-chips" aria-label="Haru 핵심 특징">
        <div class="hero-chip" style="--chip-color: #e86137;">
          <span class="icon">{icon('clock')}</span><span>하루 3~5분</span>
        </div>
        <div class="hero-chip" style="--chip-color: #5f8d4f;">
          <span class="icon">{icon('grid')}</span><span>4개 물리버튼</span>
        </div>
        <div class="hero-chip" style="--chip-color: #4579b7;">
          <span class="icon">{icon('users')}</span><span>보호자·기관 연계</span>
        </div>
      </div>
    </section>

    <section class="main-block" aria-label="Haru 필요성과 해결 방식">
      <article class="why">
        <h2 class="section-heading" style="--heading-color: #e86137;">
          <span class="heading-icon">{icon('alert')}</span>
          <span>왜 필요한가</span>
        </h2>
        <ul class="why-list">
          <li>인지 변화는 진단 이전부터 시작되지만,<br>매일 가볍게 확인할 도구는 부족합니다.</li>
          <li>기존 앱과 검사는 고령자에게 조작 부담과<br>심리적 부담이 큽니다.</li>
          <li>복지·의료기관은 반복적 모니터링을 수행할<br>시간과 인력이 부족합니다.</li>
        </ul>
      </article>

      <div class="main-divider" aria-hidden="true"></div>

      <article class="solutions">
        <h2 class="section-heading" style="--heading-color: #5f8d4f;">
          <span class="heading-icon">{icon('memory')}</span>
          <span>Haru의 해결 방식</span>
        </h2>
        <div class="solution-grid">
          <section class="solution-card" style="--card-color: #e86137; --card-tint: #fff2ed;">
            <div class="solution-icon">{icon('tap')}</div>
            <h3>초간단 사용 흐름</h3>
            <p>카드 태깅 후<br>바로 시작.<br>복잡한 로그인과 메뉴<br>탐색이 없습니다.</p>
          </section>
          <section class="solution-card" style="--card-color: #5f8d4f; --card-tint: #f1f7ee;">
            <div class="solution-icon">{icon('access')}</div>
            <h3>고령자 친화 UX</h3>
            <p>비터치 화면, 2×2<br>물리버튼, 마이크로<br>직관적인 사용이<br>가능합니다.</p>
          </section>
          <section class="solution-card" style="--card-color: #ca5b4d; --card-tint: #fff2ef;">
            <div class="solution-icon">{icon('brain')}</div>
            <h3>AI 개인화 문항</h3>
            <p>어제의 발화가 오늘의<br>문항이 되는 회상 기반<br>두뇌운동을<br>제공합니다.</p>
          </section>
          <section class="solution-card" style="--card-color: #4579b7; --card-tint: #eff5fb;">
            <div class="solution-icon">{icon('report')}</div>
            <h3>리포트 연계</h3>
            <p>보호자와 기관이 참여<br>흐름과 변화 패턴을<br>자연스럽게 확인할 수<br>있습니다.</p>
          </section>
        </div>
      </article>
    </section>

    <section class="flow-section" aria-label="Haru 사용 흐름">
      <h2 class="section-heading" style="--heading-color: #e86137;">
        <span class="heading-icon">{icon('repeat')}</span>
        <span>사용 흐름</span>
      </h2>
      <div class="flow-panel">
        <div class="flow-grid">
          <article class="flow-step" style="--step-color: #e86137;">
            <span class="flow-num">1</span>
            <h3>카드 태깅</h3>
            <span class="flow-icon">{icon('kiosk')}</span>
          </article>
          <article class="flow-step" style="--step-color: #5f8d4f;">
            <span class="flow-num">2</span>
            <h3>질문 듣고 답하기</h3>
            <span class="flow-icon">{icon('audio')}</span>
          </article>
          <article class="flow-step" style="--step-color: #4579b7;">
            <span class="flow-num">3</span>
            <h3>리포트 확인</h3>
            <span class="flow-icon">{icon('report')}</span>
          </article>
        </div>
        <span class="flow-arrow arrow-one" aria-hidden="true"></span>
        <span class="flow-arrow arrow-two" aria-hidden="true"></span>
        <p class="flow-note">하루 1회, 약 3~5분. 사회복지사 초기 안내 후 어르신 단독 사용 가능</p>
      </div>
    </section>

    <section class="bottom-grid" aria-label="핵심 차별점과 활용 대상">
      <article class="bottom-card" style="--card-border: #d9d8c7; --card-bg: #fffef9;">
        <h2 class="mini-heading" style="--heading-color: #5f8d4f;">
          <span class="icon">{icon('star')}</span><span>핵심 차별점</span>
        </h2>
        <div class="difference-list">
          <div class="difference-item"><span class="check">✓</span><span>검사 중심이 아닌 일상 루틴</span></div>
          <div class="difference-item"><span class="check">✓</span><span>공통 문제은행이 아닌<br>개인화 회상</span></div>
          <div class="difference-item"><span class="check">✓</span><span>점수 중심이 아닌 변화 추이</span></div>
          <div class="difference-item"><span class="check">✓</span><span>앱 중심이 아닌<br>기관 설치형 키오스크</span></div>
        </div>
      </article>

      <article class="bottom-card" style="--card-border: #cfdcee; --card-bg: #fbfdff;">
        <h2 class="mini-heading" style="--heading-color: #4579b7;">
          <span class="icon">{icon('users')}</span><span>적용 대상</span>
        </h2>
        <div class="target-grid">
          <div class="target-pill" style="--pill-color:#e86137; --pill-bg:#fff7f2;"><span class="pill-icon">{icon('building')}</span><span>복지관</span></div>
          <div class="target-pill" style="--pill-color:#5f8d4f; --pill-bg:#f6faf4;"><span class="pill-icon">{icon('care')}</span><span>치매안심센터</span></div>
          <div class="target-pill" style="--pill-color:#eca72c; --pill-bg:#fffaf0;"><span class="pill-icon">{icon('sun')}</span><span>주야간보호센터</span></div>
          <div class="target-pill" style="--pill-color:#4579b7; --pill-bg:#f4f8fc;"><span class="pill-icon">{icon('home')}</span><span>요양시설</span></div>
          <div class="target-pill" style="--pill-color:#72558f; --pill-bg:#faf7fc;"><span class="pill-icon">{icon('person')}</span><span>65세 이상 어르신</span></div>
          <div class="target-pill" style="--pill-color:#4579b7; --pill-bg:#f3f9f8;"><span class="pill-icon">{icon('globe')}</span><span>한국·일본<br>확장형 콘텐츠</span></div>
        </div>
      </article>
    </section>

    <footer class="footer-strip">
      <span class="footer-heart">{icon('heart')}</span>
      <p class="footer-text"><strong>Haru는 의료적 진단 기기가 아닌,</strong> 생활 기반의 일상 인지돌봄 솔루션입니다.</p>
    </footer>
  </main>
</body>
</html>
"""

    OUTPUT_HTML.write_text(html, encoding="utf-8")
    print(OUTPUT_HTML)


if __name__ == "__main__":
    main()
