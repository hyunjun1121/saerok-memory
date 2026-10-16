# -*- coding: utf-8 -*-
from pathlib import Path
from PIL import Image
import zipfile
import re
from collections import defaultdict

src = Path(r"C:\Users\mnb92\Downloads\치매링고-new로고2-Photoroom.png")
img = Image.open(src)
print("file:", src)
print("size:", img.size, "mode:", img.mode)
print("info keys:", list(img.info.keys()))
print("bytes:", src.stat().st_size)

if img.mode in ("RGBA", "LA"):
    a = img.getchannel("A")
    extrema = a.getextrema()
    print("alpha extrema:", extrema)
    bbox = a.point(lambda p: 255 if p > 8 else 0).getbbox()
    print("opaque bbox:", bbox)
    if bbox:
        w = bbox[2] - bbox[0]
        h = bbox[3] - bbox[1]
        print(f"opaque size: {w}x{h} aspect={w/h:.4f}")
    # sample corners
    px = img.load()
    w, h = img.size
    for name, pt in {
        "tl": (0, 0),
        "tr": (w - 1, 0),
        "bl": (0, h - 1),
        "br": (w - 1, h - 1),
        "c": (w // 2, h // 2),
    }.items():
        print(f"  pixel {name} {pt}: {px[pt]}")
else:
    print("NO ALPHA — corners:", img.getpixel((0, 0)), img.getpixel((img.size[0] - 1, 0)))

# current embedded logo
pptx = Path(r"C:\project\saerok-memory\피우다프로젝트\발표자료\결선발표\최종발표자료.pptx")
with zipfile.ZipFile(pptx) as z:
    data = z.read("ppt/media/image3.png")
Path(r"C:\project\saerok-memory\.tmp\current_image3.png").write_bytes(data)
cur = Image.open(Path(r"C:\project\saerok-memory\.tmp\current_image3.png"))
print("\ncurrent image3:", cur.size, cur.mode, "bytes", len(data))
if cur.mode == "RGBA":
    print("current alpha extrema:", cur.getchannel("A").getextrema())
    print("current opaque bbox:", cur.getchannel("A").point(lambda p: 255 if p > 8 else 0).getbbox())

# all pic frames that reference image3
unpacked = Path(r"C:\project\saerok-memory\.tmp\final-pptx-unpacked")
print("\n=== logo frames ===")
for slide in sorted((unpacked / "ppt" / "slides").glob("slide*.xml"), key=lambda p: int(re.search(r"\d+", p.name).group())):
    rels = slide.parent / "_rels" / (slide.name + ".rels")
    rel_xml = rels.read_text(encoding="utf-8")
    rids = re.findall(r'Id="(rId\d+)"[^>]*Target="../media/image3.png"', rel_xml)
    if not rids:
        rids = re.findall(r'Target="../media/image3.png"[^>]*Id="(rId\d+)"', rel_xml)
    # also Target before Id
    if not rids:
        for m in re.finditer(r"<Relationship ([^>]+)>", rel_xml):
            attrs = m.group(1)
            if "image3.png" in attrs:
                rid = re.search(r'Id="(rId\d+)"', attrs)
                if rid:
                    rids.append(rid.group(1))
    xml = slide.read_text(encoding="utf-8")
    for rid in rids:
        # find blip r:embed and nearby xfrm
        for m in re.finditer(rf'r:embed="{rid}"', xml):
            window = xml[max(0, m.start() - 2500) : m.end() + 400]
            off = re.search(r'<a:off x="(-?\d+)" y="(-?\d+)"', window)
            ext = re.search(r'<a:ext cx="(\d+)" cy="(\d+)"', window)
            if off and ext:
                x, y = int(off.group(1)), int(off.group(2))
                cx, cy = int(ext.group(1)), int(ext.group(2))
                print(
                    f"{slide.name} {rid}: x={x/914400:.3f}\" y={y/914400:.3f}\" "
                    f"w={cx/914400:.3f}\" h={cy/914400:.3f}\"  {cx}x{cy}  ratio={cx/cy:.3f}"
                )
