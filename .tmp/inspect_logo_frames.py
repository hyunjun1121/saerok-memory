# -*- coding: utf-8 -*-
from pathlib import Path
import re
from xml.etree import ElementTree as ET

NS = {
    "a": "http://schemas.openxmlformats.org/drawingml/2006/main",
    "p": "http://schemas.openxmlformats.org/presentationml/2006/main",
    "r": "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
}
unpacked = Path(r"C:\project\saerok-memory\.tmp\final-pptx-unpacked")
slides_dir = unpacked / "ppt" / "slides"

def rid_to_target(rels_path):
    xml = rels_path.read_text(encoding="utf-8")
    out = {}
    for m in re.finditer(r'<Relationship([^>]+)/?>', xml):
        attrs = m.group(1)
        rid = re.search(r'Id="([^"]+)"', attrs)
        tgt = re.search(r'Target="([^"]+)"', attrs)
        if rid and tgt:
            out[rid.group(1)] = tgt.group(1)
    return out

for slide in sorted(slides_dir.glob("slide*.xml"), key=lambda p: int(re.search(r"\d+", p.name).group())):
    rels = slide.parent / "_rels" / (slide.name + ".rels")
    mapping = rid_to_target(rels)
    tree = ET.parse(slide)
    for pic in tree.findall(".//p:pic", NS):
        blip = pic.find(".//a:blip", NS)
        if blip is None:
            continue
        rid = blip.get("{http://schemas.openxmlformats.org/officeDocument/2006/relationships}embed")
        target = mapping.get(rid, "?")
        nv = pic.find(".//p:cNvPr", NS)
        name = nv.get("name") if nv is not None else ""
        off = pic.find(".//a:off", NS)
        ext = pic.find(".//a:ext", NS)
        x = int(off.get("x") or 0) if off is not None else 0
        y = int(off.get("y") or 0) if off is not None else 0
        cx = int(ext.get("cx") or 0) if ext is not None else 0
        cy = int(ext.get("cy") or 0) if ext is not None else 0
        if "image3" in target:
            print(
                f"{slide.name:12} {name:16} {target:22} {rid:6} "
                f"x={x/914400:6.3f}\" y={y/914400:6.3f}\" "
                f"w={cx/914400:6.3f}\" h={cy/914400:6.3f}\"  {cx}x{cy} r={cx/max(cy,1):.3f}"
            )
