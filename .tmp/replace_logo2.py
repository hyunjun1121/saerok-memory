# -*- coding: utf-8 -*-
"""Create a new PPTX with the Photoroom 치매링고 logo replacing image3.png."""
from __future__ import annotations

import shutil
import zipfile
from pathlib import Path

from PIL import Image

SRC_PPTX = Path(r"C:\project\saerok-memory\피우다프로젝트\발표자료\결선발표\최종발표자료.pptx")
DST_PPTX = Path(r"C:\project\saerok-memory\피우다프로젝트\발표자료\결선발표\최종발표자료_로고2.pptx")
LOGO_SRC = Path(r"C:\Users\mnb92\Downloads\치매링고-new로고2-Photoroom.png")
LOGO_OUT = Path(r"C:\project\saerok-memory\.tmp\logo2_square.png")
ZIP_NAME = "ppt/media/image3.png"


def prepare_logo() -> Path:
    im = Image.open(LOGO_SRC).convert("RGBA")
    pixels = im.load()
    w, h = im.size
    # Photoroom leaves 1–2 alpha fringe; drop it so cream slides stay clean.
    for y in range(h):
        for x in range(w):
            r, g, b, a = pixels[x, y]
            if a < 12:
                pixels[x, y] = (r, g, b, 0)
    bbox = im.getbbox()
    if bbox is None:
        raise SystemExit("logo is fully transparent")
    pad = 16
    l, t, r, b = bbox
    l = max(0, l - pad)
    t = max(0, t - pad)
    r = min(im.width, r + pad)
    b = min(im.height, b + pad)
    cropped = im.crop((l, t, r, b))
    side = max(cropped.width, cropped.height)
    canvas = Image.new("RGBA", (side, side), (0, 0, 0, 0))
    canvas.paste(
        cropped,
        ((side - cropped.width) // 2, (side - cropped.height) // 2),
        cropped,
    )
    canvas.save(LOGO_OUT, "PNG")
    print(f"logo {im.size} bbox={bbox} -> square {canvas.size}  {LOGO_OUT.stat().st_size} bytes")
    return LOGO_OUT


def pack_new_pptx(logo_path: Path) -> None:
    if DST_PPTX.exists():
        DST_PPTX.unlink()
    logo_bytes = logo_path.read_bytes()
    replaced = 0
    with zipfile.ZipFile(SRC_PPTX, "r") as zin, zipfile.ZipFile(
        DST_PPTX, "w", compression=zipfile.ZIP_DEFLATED
    ) as zout:
        for item in zin.infolist():
            data = zin.read(item.filename)
            if item.filename.replace("\\", "/") == ZIP_NAME:
                data = logo_bytes
                replaced += 1
            # Keep original zip metadata except size/CRC (ZipInfo is rewritten on write)
            zout.writestr(item, data)
    if replaced != 1:
        raise SystemExit(f"expected to replace image3.png once, got {replaced}")
    print(f"wrote {DST_PPTX}  {DST_PPTX.stat().st_size} bytes  replaced={replaced}")


if __name__ == "__main__":
    if not SRC_PPTX.exists():
        raise SystemExit(f"missing {SRC_PPTX}")
    if not LOGO_SRC.exists():
        raise SystemExit(f"missing {LOGO_SRC}")
    pack_new_pptx(prepare_logo())
