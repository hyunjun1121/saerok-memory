# -*- coding: utf-8 -*-
from __future__ import annotations

import re
import shutil
from pathlib import Path
from PIL import Image

UNPACKED = Path(r"C:\project\saerok-memory\.tmp\final-pptx-unpacked")
LOGO_SRC = Path(r"C:\Users\mnb92\Downloads\치매링고-new로고.png")
EMU = 914400

# Official 치매링고 palette
# 1 메모리 블루 #2F80ED  Main
# 2 딥 네이비   #0D2F6E  Main
# 3 페이스 아이보리 #F7F5F2
# 4 블러시 핑크 #F6C7CF  Accent
# 5 리프 그린   #34C759  Sub
# 6 프레시 틸   #00B39A  Sub
# 7 하트 옐로우 #FFC83D  Accent
# 8 소프트 스카이 #E8F4FF Accent

COLOR_MAP = {
    # current theme (teal rebrand) -> official
    "1F6B72": "2F80ED",  # accent teal -> memory blue
    "1A5F68": "00B39A",  # deep teal -> fresh teal
    "1B2D3A": "0D2F6E",  # charcoal -> deep navy
    "4A5C6A": "0D2F6E",  # slate body -> deep navy
    "6B7C8A": "2F80ED",  # muted labels -> memory blue
    "F4F7FA": "F7F5F2",  # cool bg -> ivory
    "E8EEF2": "E8F4FF",  # cool cards -> soft sky
    "C5D0D8": "B5D4F8",  # rules
    "DCECEA": "D8F6E3",  # mint chips -> leaf tint
    "2A7A6F": "34C759",  # green -> leaf green
    "C4A35A": "FFC83D",  # gold -> heart yellow
    "D9E6EA": "F6C7CF",  # leftover pinkish -> blush
    "E8E4D4": "E8F4FF",
    "B7C3CC": "B5D4F8",
    # any remaining original cream/coral if present
    "F57265": "2F80ED",
    "2A2018": "0D2F6E",
    "F5ECD8": "E8F4FF",
    "FBF5E9": "F7F5F2",
    "6C5D4C": "0D2F6E",
    "9C8B77": "2F80ED",
    "E0D4C1": "B5D4F8",
    "C8410E": "00B39A",
    "5E9A6A": "34C759",
    "F4A81D": "FFC83D",
}


def install_logo() -> None:
    im = Image.open(LOGO_SRC).convert("RGBA")
    bbox = im.getbbox()
    pad = 16
    l, t, r, b = bbox
    l = max(0, l - pad)
    t = max(0, t - pad)
    r = min(im.width, r + pad)
    b = min(im.height, b + pad)
    cropped = im.crop((l, t, r, b))
    # square canvas
    side = max(cropped.width, cropped.height)
    canvas = Image.new("RGBA", (side, side), (0, 0, 0, 0))
    canvas.paste(cropped, ((side - cropped.width) // 2, (side - cropped.height) // 2), cropped)
    dest = UNPACKED / "ppt" / "media" / "image3.png"
    canvas.save(dest, "PNG")
    print(f"logo saved {dest} {canvas.size} mode={canvas.mode}")


def resize_logo_frames() -> None:
    root = UNPACKED / "ppt"
    # cover: square using original height, keep top-left
    cover = root / "slides" / "slide1.xml"
    raw = cover.read_text(encoding="utf-8")
    old = '<a:off x="664882" y="273571"/>\n            <a:ext cx="3884033" cy="1979778"/>'
    # 2.05" square so it sits above the title
    side = 1874520
    new = f'<a:off x="664882" y="220000"/>\n            <a:ext cx="{side}" cy="{side}"/>'
    if old not in raw:
        raise SystemExit("cover logo xfrm not found")
    cover.write_text(raw.replace(old, new, 1), encoding="utf-8")
    print("cover logo frame -> square")

    # content slides: square, keep right edge
    old_off = '<a:off x="10664921" y="365760"/>'
    old_ext = '<a:ext cx="932688" cy="475488"/>'
    # 0.90" square, right-aligned to previous right edge 11597609
    cy = 822960
    right = 10664921 + 932688
    x = right - cy
    y = 250000
    n = 0
    for slide in (root / "slides").glob("slide*.xml"):
        if slide.name == "slide1.xml":
            continue
        raw = slide.read_text(encoding="utf-8")
        if old_off in raw and old_ext in raw:
            raw = raw.replace(old_off, f'<a:off x="{x}" y="{y}"/>', 1)
            raw = raw.replace(old_ext, f'<a:ext cx="{cy}" cy="{cy}"/>', 1)
            slide.write_text(raw, encoding="utf-8")
            n += 1
    print(f"content logo frames updated: {n}")


def remap_colors() -> None:
    pat = re.compile(r'(srgbClr val=")([0-9A-Fa-f]{6})(")')
    files = 0
    hits = 0

    def sub(m: re.Match) -> str:
        nonlocal hits
        old = m.group(2).upper()
        new = COLOR_MAP.get(old)
        if not new:
            return m.group(0)
        hits += 1
        return f"{m.group(1)}{new}{m.group(3)}"

    for p in UNPACKED.rglob("*.xml"):
        raw = p.read_text(encoding="utf-8")
        raw2, n = pat.subn(sub, raw)
        # subn counts all srgb even unchanged because we increment only on map
        if raw2 != raw:
            p.write_text(raw2, encoding="utf-8")
            files += 1
    print(f"color remap files={files} replacements={hits}")


if __name__ == "__main__":
    install_logo()
    resize_logo_frames()
    remap_colors()
    print("done")
