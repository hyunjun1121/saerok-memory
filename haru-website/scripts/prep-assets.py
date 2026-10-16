"""Prepare public/assets for the Haru marketing website.

Copies team-owned brand assets from the repository into haru-website/public/assets,
resizing photos and converting formats as needed. Safe to re-run.

Run from anywhere: paths are anchored to the repository root.
"""

import io
import shutil
import sys
import zipfile
from pathlib import Path

from PIL import Image, ImageOps

sys.stdout.reconfigure(encoding="utf-8")

REPO = Path(r"C:\project\saerok-memory")
DEST = REPO / "haru-website" / "public" / "assets"

MOCKUP = REPO / "피우다프로젝트" / "발표자료" / "목업"
ELDER = REPO / "피우다프로젝트" / "일본인멘토_피드백" / "오가사_Haru_추출이미지"
APP_2X2 = REPO / "피우다프로젝트" / "application_assets" / "current_2x2_large_text_worktree_2026-07-29" / "ko"
APP_SHOTS = REPO / "피우다프로젝트" / "application_assets" / "auto_screenshots" / "ko"
FLYER = REPO / "피우다프로젝트" / "전단지"
PI_HARU = REPO / "raspberry-pi-demo" / "public" / "assets" / "haru"
ROOT_HARU = REPO / "public" / "assets" / "haru"
BUDDY = ROOT_HARU / "buddy"
ELEMENTS = REPO / "elements"
LOGO_SRC = ROOT_HARU / "logo.png"  # 꽃 엠블럼 + Haru 워드마크 (투명 배경, 2400x1223)
AWARDS_PPTX = REPO / "피우다프로젝트" / "발표자료" / "E5_KAIST_지원서_보편교육연구소.pptx"


def split_emblem(img: Image.Image) -> Image.Image:
    """와이드 로고에서 알파 갭을 찾아 좌측 엠블럼(꽃 마크)만 정사각 크롭으로 반환한다."""
    alpha = img.getchannel("A")
    width, height = img.size
    threshold = 8
    gap_start = None
    gap_end = None
    run = 0
    for x in range(width // 4, width):  # 엠블럼은 전체 폭의 앞쪽 4분의 1 안에 있다
        col = alpha.crop((x, 0, x + 1, height))
        if col.getbbox() is None:
            run += 1
            if run >= 20 and gap_start is None:
                gap_start = x - run + 1
        else:
            if gap_start is not None and run >= 20:
                gap_end = x
                break
            run = 0
    if gap_start is None:
        raise SystemExit("로고에서 엠블럼-워드마크 갭을 찾지 못했다")
    emblem = img.crop((0, 0, gap_start, height))
    bbox = emblem.getchannel("A").getbbox()
    emblem = emblem.crop(bbox)
    side = max(emblem.size)
    square = Image.new("RGBA", (side, side), (0, 0, 0, 0))
    square.paste(emblem, ((side - emblem.width) // 2, (side - emblem.height) // 2))
    return square


def resize_png(src: Path, dst: Path, width: int) -> None:
    img = Image.open(src)
    if img.width > width:
        height = round(img.height * width / img.width)
        img = img.resize((width, height), Image.LANCZOS)
    dst.parent.mkdir(parents=True, exist_ok=True)
    img.save(dst, optimize=True)
    print(f"png  {dst.name:34s} <- {src.name} ({img.width}x{img.height})")


def save_jpeg(src: Path, dst: Path, width: int, quality: int = 82) -> None:
    # 스마트폰 사진은 EXIF 방향 태그를 실제 픽셀에 반영한 뒤 저장한다.
    img = ImageOps.exif_transpose(Image.open(src)).convert("RGB")
    if img.width > width:
        height = round(img.height * width / img.width)
        img = img.resize((width, height), Image.LANCZOS)
    dst.parent.mkdir(parents=True, exist_ok=True)
    img.save(dst, quality=quality, optimize=True, progressive=True)
    print(f"jpg  {dst.name:34s} <- {src.name} ({img.width}x{img.height})")


def copy_file(src: Path, dst: Path) -> None:
    dst.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(src, dst)
    print(f"copy {dst.name}")


def jfif_to_png(src: Path, dst: Path) -> None:
    img = Image.open(src).convert("RGBA")
    dst.parent.mkdir(parents=True, exist_ok=True)
    img.save(dst, optimize=True)
    print(f"jfif->png {dst.name} ({img.width}x{img.height})")


def center_crop(img: Image.Image, ratio: float) -> Image.Image:
    w, h = img.size
    if w / h > ratio:
        new_w = round(h * ratio)
        left = (w - new_w) // 2
        return img.crop((left, 0, left + new_w, h))
    new_h = round(w / ratio)
    top = (h - new_h) // 2
    return img.crop((0, top, w, top + new_h))


def build_og_image() -> None:
    """Center-crop the kiosk front photo to 1200x630 and overlay the color logo."""
    photo = ImageOps.exif_transpose(Image.open(MOCKUP / "실물_정면.jpeg")).convert("RGB")
    og = center_crop(photo, 1200 / 630).resize((1200, 630), Image.LANCZOS)

    scrim = Image.new("RGBA", (1200, 630), (40, 27, 21, 90))
    og = Image.alpha_composite(og.convert("RGBA"), scrim)

    logo = Image.open(LOGO_SRC).convert("RGBA")
    logo_w = 420
    logo = logo.resize((logo_w, round(logo.height * logo_w / logo.width)), Image.LANCZOS)
    og.alpha_composite(logo, (48, 630 - logo.height - 48))

    dst = DEST / "og" / "og-image-1200x630.jpg"
    dst.parent.mkdir(parents=True, exist_ok=True)
    og.convert("RGB").save(dst, quality=85, optimize=True, progressive=True)
    print(f"og   {dst.name}")


def build_awards() -> None:
    """E5 지원서 17번 슬라이드의 팀 수상 사진 4장을 추출해 저장한다.

    media 이름은 슬라이드 17의 상장 사진 내용 기준으로 매핑했다.
    (image18 국방기술 · image21 피우다 충청권 · image20 왕중왕전 · image19 한화생명)
    """
    with zipfile.ZipFile(AWARDS_PPTX) as z:
        for media, dst_name in (
            ("image18.jpeg", "award-defense-1200.jpg"),
            ("image21.jpeg", "award-chungcheong-1200.jpg"),
            ("image20.jpeg", "award-wangjungwang-1200.jpg"),
            ("image19.jpeg", "award-hanwha-1200.jpg"),
        ):
            img = ImageOps.exif_transpose(Image.open(io.BytesIO(z.read(f"ppt/media/{media}")))).convert("RGB")
            if img.width > 1200:
                height = round(img.height * 1200 / img.width)
                img = img.resize((1200, height), Image.LANCZOS)
            dst = DEST / "awards" / dst_name
            dst.parent.mkdir(parents=True, exist_ok=True)
            img.save(dst, quality=85, optimize=True, progressive=True)
            print(f"jpg  {dst.name:34s} <- E5 pptx {media} ({img.width}x{img.height})")


def build_team_photos() -> None:
    """E5 지원서 팀원 소개 슬라이드(19~21)의 프로필 사진을 추출해 저장한다."""
    with zipfile.ZipFile(AWARDS_PPTX) as z:
        for media, dst_name in (
            ("image28.jpeg", "member-kimhyunjun-512.jpg"),  # slide 20 김현준
            ("image27.jpeg", "member-nahyunwoo-512.jpg"),   # slide 19 나현우
            ("image29.jpeg", "member-leejaewoo-512.jpg"),   # slide 21 이재우
        ):
            img = ImageOps.exif_transpose(Image.open(io.BytesIO(z.read(f"ppt/media/{media}")))).convert("RGB")
            if img.width > 512:
                height = round(img.height * 512 / img.width)
                img = img.resize((512, height), Image.LANCZOS)
            dst = DEST / "team" / dst_name
            dst.parent.mkdir(parents=True, exist_ok=True)
            img.save(dst, quality=85, optimize=True, progressive=True)
            print(f"jpg  {dst.name:34s} <- E5 pptx {media} ({img.width}x{img.height})")


def main() -> None:
    missing: list[Path] = []

    def check(path: Path) -> Path:
        if not path.exists():
            missing.append(path)
        return path

    # Logos — 새 브랜드 로고(꽃 엠블럼 + Haru 워드마크)
    if LOGO_SRC.exists():
        logo = Image.open(LOGO_SRC)
        resize_png(LOGO_SRC, DEST / "logo" / "haru-logo-512.png", 512)
        resize_png(LOGO_SRC, DEST / "logo" / "haru-logo-256.png", 256)
        emblem = split_emblem(logo)
        dst = DEST / "logo" / "haru-emblem-256.png"
        dst.parent.mkdir(parents=True, exist_ok=True)
        emblem.resize((256, 256), Image.LANCZOS).save(dst, optimize=True)
        print(f"png  {dst.name} (emblem crop)")
    else:
        missing.append(LOGO_SRC)
    logo_ko = check(ROOT_HARU / "logo_ko.png")
    if logo_ko.exists():
        resize_png(logo_ko, DEST / "logo" / "logo-ko-640.png", 640)

    # Mascots
    for pose, name in (("wave_1", "buddy-wave-512"), ("cheer_1", "buddy-cheer-512"), ("encourage_1", "buddy-encourage-512")):
        src = check(BUDDY / f"{pose}.png")
        if src.exists():
            resize_png(src, DEST / "mascot" / f"{name}.png", 512)
    bugi = check(ELEMENTS / "청년부기_3D-Photoroom.png")
    if bugi.exists():
        resize_png(bugi, DEST / "mascot" / "bugi-3d-512.png", 512)

    # Kiosk photos
    for src_name, dst_name in (
        ("실물_사선.jpeg", "kiosk-angle-1600.jpg"),
        ("실물_정면.jpeg", "kiosk-front-1600.jpg"),
        ("실물_측면.jpeg", "kiosk-side-1600.jpg"),
    ):
        src = check(MOCKUP / src_name)
        if src.exists():
            save_jpeg(src, DEST / "product" / dst_name, 1600)
    render = check(MOCKUP / "설계_렌더링1.png")
    if render.exists():
        copy_file(render, DEST / "product" / "render-design-1448.png")
    elder = check(ELDER / "개발계획서_04_한국어_어르신_탁상형기기사용_p05.jpg")
    if elder.exists():
        save_jpeg(elder, DEST / "product" / "elder-using-1200.jpg", 1200)

    # Korean app screens (2x2 large-text Day 1 set)
    for src_name, dst_name in (
        ("26_D1_Q1.png", "d1-q1.png"),
        ("27_D1_Q2.png", "d1-q2.png"),
        ("29_D1_Q4.png", "d1-q4.png"),
        ("31_D1_Q6.png", "d1-q6.png"),
    ):
        src = check(APP_2X2 / src_name)
        if src.exists():
            copy_file(src, DEST / "screens" / "ko" / dst_name)
    # Korean app screens (auto screenshots)
    for src_name, dst_name in (
        ("01_레슨_시작화면.png", "lesson-start.png"),
        ("25_요즘_기분_말하기.png", "mood-speak.png"),
        ("26_세션_결과.png", "session-result.png"),
        ("27_결과_보호자연결.png", "result-caregiver.png"),
        ("28_결과_상담사연결.png", "result-counselor.png"),
        ("29_보호자_앱.png", "caregiver-app.png"),
        ("30_상담사_앱.png", "counselor-app.png"),
    ):
        src = check(APP_SHOTS / src_name)
        if src.exists():
            copy_file(src, DEST / "screens" / "ko" / dst_name)

    # Partner logos (grayscale applied in CSS)
    for src_name, dst_name in (
        ("서울대.png", "snu.png"),
        ("홋카이도대학교.png", "hokkaido.png"),
        ("육사.png", "kma.png"),
        ("육군본부.png", "armyhq.png"),
        ("분당차병원.svg", "bundangcha.svg"),
    ):
        src = check(FLYER / src_name)
        if src.exists():
            copy_file(src, DEST / "partners" / dst_name)
    kaist = check(FLYER / "카이스트.jfif")
    if kaist.exists():
        jfif_to_png(kaist, DEST / "partners" / "kaist.png")

    # Award photos (E5 지원서 17번 슬라이드)
    if AWARDS_PPTX.exists():
        build_awards()
        build_team_photos()
    else:
        missing.append(AWARDS_PPTX)

    # OG image
    front = check(MOCKUP / "실물_정면.jpeg")
    if front.exists() and LOGO_SRC.exists():
        build_og_image()

    if missing:
        print("\nMISSING SOURCES:")
        for path in missing:
            print(f"  {path}")
        sys.exit(1)
    print("\nAll assets prepared.")


if __name__ == "__main__":
    main()
