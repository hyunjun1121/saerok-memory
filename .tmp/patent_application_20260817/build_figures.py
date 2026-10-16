from __future__ import annotations

from pathlib import Path
from typing import Iterable

from PIL import Image, ImageDraw, ImageFont


ROOT = Path(r"C:\project\saerok-memory")
OUT = ROOT / ".tmp" / "patent_application_20260817" / "figures"
FONT_PATH = ROOT / "raspberry-pi-demo" / "public" / "assets" / "fonts" / "NotoSansKR-Variable.ttf"
WIDTH = 1800
HEIGHT = 2400
BLACK = "#000000"
WHITE = "#ffffff"


def font(size: int, *, bold: bool = False) -> ImageFont.FreeTypeFont:
    variation = "Bold" if bold else "Regular"
    loaded = ImageFont.truetype(str(FONT_PATH), size=size)
    try:
        loaded.set_variation_by_name(variation)
    except OSError:
        pass
    return loaded


TITLE = font(62, bold=True)
HEADING = font(43, bold=True)
BODY = font(35)
SMALL = font(29)
BADGE = font(48, bold=True)


def new_canvas(number: int) -> tuple[Image.Image, ImageDraw.ImageDraw]:
    image = Image.new("RGB", (WIDTH, HEIGHT), WHITE)
    draw = ImageDraw.Draw(image)
    # Figure number is supplied by the official 【도 n】 identifier outside
    # the image. Keeping it out of the drawing avoids redundant characters.
    _ = number
    return image, draw


def center_text(
    draw: ImageDraw.ImageDraw,
    box: tuple[int, int, int, int],
    lines: str | Iterable[str],
    *,
    use_font: ImageFont.FreeTypeFont = BODY,
    spacing: int = 16,
) -> None:
    if isinstance(lines, str):
        lines = lines.split("\n")
    text = "\n".join(lines)
    x1, y1, x2, y2 = box
    draw.multiline_text(
        ((x1 + x2) // 2, (y1 + y2) // 2),
        text,
        font=use_font,
        fill=BLACK,
        anchor="mm",
        align="center",
        spacing=spacing,
    )


def box(
    draw: ImageDraw.ImageDraw,
    bounds: tuple[int, int, int, int],
    label: str,
    *,
    radius: int = 22,
    width: int = 5,
    use_font: ImageFont.FreeTypeFont = BODY,
) -> None:
    draw.rounded_rectangle(bounds, radius=radius, outline=BLACK, fill=WHITE, width=width)
    center_text(draw, bounds, label, use_font=use_font)


def arrow(
    draw: ImageDraw.ImageDraw,
    start: tuple[int, int],
    end: tuple[int, int],
    *,
    width: int = 6,
) -> None:
    draw.line([start, end], fill=BLACK, width=width)
    x1, y1 = start
    x2, y2 = end
    dx, dy = x2 - x1, y2 - y1
    length = max((dx * dx + dy * dy) ** 0.5, 1)
    ux, uy = dx / length, dy / length
    px, py = -uy, ux
    size = 28
    base_x, base_y = x2 - ux * size, y2 - uy * size
    points = [
        (x2, y2),
        (base_x + px * size * 0.55, base_y + py * size * 0.55),
        (base_x - px * size * 0.55, base_y - py * size * 0.55),
    ]
    draw.polygon(points, fill=BLACK)


def decision(
    draw: ImageDraw.ImageDraw,
    center: tuple[int, int],
    size: tuple[int, int],
    label: str,
) -> tuple[int, int, int, int]:
    cx, cy = center
    w, h = size
    points = [(cx, cy - h // 2), (cx + w // 2, cy), (cx, cy + h // 2), (cx - w // 2, cy)]
    draw.line(points + [points[0]], fill=BLACK, width=5, joint="curve")
    bounds = (cx - w // 2, cy - h // 2, cx + w // 2, cy + h // 2)
    center_text(draw, bounds, label, use_font=SMALL)
    return bounds


def grid_2x2(
    draw: ImageDraw.ImageDraw,
    origin: tuple[int, int],
    size: tuple[int, int],
    labels: list[str],
    *,
    heading: str,
) -> tuple[int, int, int, int]:
    x, y = origin
    w, h = size
    draw.text((x + w // 2, y - 56), heading, font=HEADING, fill=BLACK, anchor="mm")
    gap = 20
    cell_w = (w - gap) // 2
    cell_h = (h - gap) // 2
    for index, label in enumerate(labels):
        row, col = divmod(index, 2)
        x1 = x + col * (cell_w + gap)
        y1 = y + row * (cell_h + gap)
        box(draw, (x1, y1, x1 + cell_w, y1 + cell_h), label, use_font=BODY)
    return (x, y, x + w, y + h)


def save(image: Image.Image, number: int) -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    image.save(OUT / f"figure_{number}.png", dpi=(300, 300), optimize=True)


def figure_1() -> None:
    image, draw = new_canvas(1)
    box(draw, (110, 420, 510, 900), "물리 입력부\n(120)\n\nA  B\nC  D", use_font=HEADING)
    box(draw, (700, 280, 1100, 560), "설정 검증부\n(180)", use_font=HEADING)
    box(draw, (700, 760, 1100, 1040), "입력 정규화부\n(130)", use_font=HEADING)
    box(draw, (700, 1240, 1100, 1540), "상태 제어부\n(140)", use_font=HEADING)
    box(draw, (1280, 300, 1690, 600), "표시부\n(110)", use_font=HEADING)
    box(draw, (1280, 760, 1690, 1060), "음성 출력부\n(150)", use_font=HEADING)
    box(draw, (110, 1300, 510, 1580), "마이크 입력부\n(160)\n(선택)", use_font=HEADING)
    box(draw, (700, 1820, 1100, 2120), "로컬 저장부\n(170)", use_font=HEADING)
    arrow(draw, (510, 660), (700, 900))
    arrow(draw, (900, 560), (900, 760))
    arrow(draw, (900, 1040), (900, 1240))
    arrow(draw, (1100, 1350), (1280, 450))
    arrow(draw, (1100, 1400), (1280, 900))
    arrow(draw, (510, 1440), (700, 1400))
    arrow(draw, (900, 1540), (900, 1820))
    arrow(draw, (1100, 1970), (1280, 520))
    draw.text((900, 2260), "키오스크 인터페이스 시스템(100)", font=HEADING, fill=BLACK, anchor="mm")
    save(image, 1)


def figure_2() -> None:
    image, draw = new_canvas(2)
    physical = grid_2x2(
        draw,
        (100, 430),
        (460, 620),
        ["A\n좌상", "B\n우상", "C\n좌하", "D\n우하"],
        heading="물리 입력 스위치(121A-D)",
    )
    options = grid_2x2(
        draw,
        (670, 430),
        (460, 620),
        ["선택 A\n(111A)", "선택 B\n(111B)", "선택 C\n(111C)", "선택 D\n(111D)"],
        heading="화면 선택 영역",
    )
    guide = grid_2x2(
        draw,
        (1240, 430),
        (460, 620),
        ["기능 A\n(112A)", "기능 B\n(112B)", "기능 C\n(112C)", "기능 D\n(112D)"],
        heading="현재 기능 안내 영역",
    )
    for y in (580, 900):
        arrow(draw, (physical[2] + 20, y), (options[0] - 20, y))
        arrow(draw, (options[2] + 20, y), (guide[0] - 20, y))
    box(draw, (180, 1380, 820, 1900), "네 자리 선택 상태\n\n첫 입력: 보류 선택\n동일 버튼 후속 입력: 확정\n다른 버튼 입력: 선택 교체", use_font=HEADING)
    box(draw, (980, 1380, 1620, 1900), "열 단위 동작 상태\n\n좌측 열 A/C: 가역 계열\n우측 열 B/D: 진행 계열\n단계에 따라 세부 기능 변경", use_font=HEADING)
    arrow(draw, (820, 1640), (980, 1640))
    arrow(draw, (980, 1740), (820, 1740))
    draw.text((900, 2090), "상호작용 상태에 따라 양방향 전환", font=HEADING, fill=BLACK, anchor="mm")
    save(image, 2)


def figure_3() -> None:
    image, draw = new_canvas(3)
    box(draw, (660, 220, 1140, 370), "키다운 입력 수신", use_font=HEADING)
    arrow(draw, (900, 370), (900, 470))
    decision(draw, (900, 610), (520, 250), "설정 유효 및\n슬롯 매핑 가능?")
    arrow(draw, (640, 610), (320, 610))
    box(draw, (80, 500, 320, 720), "입력 비활성화\n오류 표시", use_font=BODY)
    draw.text((480, 560), "아니오", font=SMALL, fill=BLACK, anchor="mm")
    arrow(draw, (900, 735), (900, 840))
    draw.text((970, 785), "예", font=SMALL, fill=BLACK, anchor="lm")
    decision(draw, (900, 990), (620, 260), "반복·조합키·편집 입력·\n동시 입력인가?")
    arrow(draw, (1210, 990), (1510, 990))
    box(draw, (1510, 880, 1730, 1100), "입력 폐기", use_font=HEADING)
    draw.text((1360, 940), "예", font=SMALL, fill=BLACK, anchor="mm")
    arrow(draw, (900, 1120), (900, 1220))
    draw.text((970, 1170), "아니오", font=SMALL, fill=BLACK, anchor="lm")
    decision(draw, (900, 1360), (540, 240), "디바운스 시간\n충족?")
    arrow(draw, (1170, 1360), (1510, 1360))
    box(draw, (1510, 1250, 1730, 1470), "입력 폐기", use_font=HEADING)
    draw.text((1350, 1310), "아니오", font=SMALL, fill=BLACK, anchor="mm")
    arrow(draw, (900, 1480), (900, 1580))
    draw.text((970, 1530), "예", font=SMALL, fill=BLACK, anchor="lm")
    box(draw, (600, 1580, 1200, 1770), "유효 슬롯 입력을\n상태 제어부(140)에 전달", use_font=HEADING)
    arrow(draw, (900, 1770), (900, 1870))
    box(draw, (600, 1870, 1200, 2060), "대응 키업 확인 후\n눌림 래치 해제", use_font=HEADING)
    arrow(draw, (900, 2060), (900, 2160))
    box(draw, (620, 2160, 1180, 2300), "후속 입력 수용", use_font=HEADING)
    save(image, 3)


def figure_4() -> None:
    image, draw = new_canvas(4)
    draw.text((450, 250), "선택 상태", font=HEADING, fill=BLACK, anchor="mm")
    box(draw, (120, 370, 780, 600), "선택 없음", use_font=HEADING)
    arrow(draw, (450, 600), (450, 760))
    box(draw, (120, 760, 780, 1050), "슬롯 X 보류 선택\n시각·음성 피드백", use_font=HEADING)
    arrow(draw, (450, 1050), (450, 1240))
    box(draw, (120, 1240, 780, 1510), "버튼 해제 후\n동일 슬롯 X 재입력", use_font=HEADING)
    arrow(draw, (450, 1510), (450, 1690))
    box(draw, (120, 1690, 780, 1930), "선택 확정 및\n피드백 상태 전이", use_font=HEADING)
    arrow(draw, (780, 900), (930, 900))
    box(draw, (930, 760, 1680, 1050), "다른 슬롯 Y 입력\n슬롯 X 실행 없이 Y로 교체", use_font=HEADING)
    arrow(draw, (1305, 1050), (1305, 1240))
    box(draw, (930, 1240, 1680, 1510), "슬롯 Y 보류 선택", use_font=HEADING)
    arrow(draw, (930, 1375), (780, 1375))
    draw.text((1305, 350), "순서 입력 상태", font=HEADING, fill=BLACK, anchor="mm")
    box(draw, (930, 420, 1680, 650), "각 단계에 동일한\n보류·확정 문법 적용", use_font=HEADING)
    box(draw, (930, 1690, 1680, 1930), "소정 개수 확정 후\n좌열=초기화 / 우열=제출", use_font=HEADING)
    arrow(draw, (1305, 1510), (1305, 1690))
    draw.text((900, 2190), "이미 확정된 슬롯의 중복 입력은 배제", font=HEADING, fill=BLACK, anchor="mm")
    save(image, 4)


def figure_5() -> None:
    image, draw = new_canvas(5)
    x_positions = [120, 650, 1110, 1680]
    y = 310
    headers = ["상태", "좌측 열 A/C", "우측 열 B/D"]
    widths = [470, 620, 620]
    x = 60
    for header, width in zip(headers, widths):
        box(draw, (x, y, x + width, y + 170), header, use_font=HEADING)
        x += width + 20

    rows = [
        ("시작", "안내 다시 듣기", "활동 시작"),
        ("순서 검토", "처음부터 다시", "순서 제출"),
        ("음성 준비", "안내 다시 듣기", "입력 시작"),
        ("음성 입력", "취소", "입력 종료"),
        ("음성 검토", "다시 입력", "응답 확정"),
        ("문항 피드백", "같은 문항 재시도", "다음 문항"),
        ("하루 완료", "완료 안내 재생", "메뉴 복귀"),
    ]
    row_y = 510
    for state, left, right in rows:
        x = 60
        for text, width in zip((state, left, right), widths):
            box(draw, (x, row_y, x + width, row_y + 220), text, use_font=BODY)
            x += width + 20
        row_y += 245
    box(draw, (120, 2220, 1680, 2340), "좌측 열: 가역 의미 유지   |   우측 열: 진행 의미 유지", use_font=HEADING)
    save(image, 5)


def figure_6() -> None:
    image, draw = new_canvas(6)
    box(draw, (590, 220, 1210, 390), "오프라인 애플리케이션 시작", use_font=HEADING)
    arrow(draw, (900, 390), (900, 500))
    box(draw, (590, 500, 1210, 690), "로컬 진행 기록 검증", use_font=HEADING)
    arrow(draw, (900, 690), (900, 810))
    decision(draw, (900, 940), (570, 250), "미완료 문항 존재?")
    arrow(draw, (615, 940), (310, 940))
    box(draw, (70, 820, 310, 1060), "새 루틴\n시작", use_font=HEADING)
    arrow(draw, (900, 1065), (900, 1180))
    box(draw, (550, 1180, 1250, 1380), "최초 미완료 문항부터 재개", use_font=HEADING)
    arrow(draw, (900, 1380), (900, 1500))
    box(draw, (550, 1500, 1250, 1700), "유효 입력 확정 후\n응답·시간·완료시각 저장", use_font=HEADING)
    arrow(draw, (900, 1700), (900, 1820))
    box(draw, (550, 1820, 1250, 2020), "피드백 및 다음 상태 진행", use_font=HEADING)
    box(draw, (70, 1320, 420, 1660), "저장 오류\n\n진행은 유지\n저장만 생략", use_font=BODY)
    arrow(draw, (420, 1490), (550, 1600))
    box(draw, (1380, 1180, 1730, 1560), "마이크 불가\n\n대체 파형 표시\n상태 전이 유지", use_font=BODY)
    arrow(draw, (1380, 1370), (1250, 1600))
    box(draw, (300, 2180, 1500, 2320), "외부 네트워크·원격 API 없이 로컬 자원으로 동작", use_font=HEADING)
    save(image, 6)


def contact_sheet() -> None:
    thumbs = []
    for number in range(1, 7):
        image = Image.open(OUT / f"figure_{number}.png").convert("RGB")
        image.thumbnail((450, 600))
        thumbs.append(image.copy())
    sheet = Image.new("RGB", (1350, 1200), WHITE)
    for index, thumb in enumerate(thumbs):
        x = (index % 3) * 450
        y = (index // 3) * 600
        sheet.paste(thumb, (x, y))
    sheet.save(OUT / "contact_sheet.png", dpi=(150, 150), optimize=True)


if __name__ == "__main__":
    figure_1()
    figure_2()
    figure_3()
    figure_4()
    figure_5()
    figure_6()
    contact_sheet()
