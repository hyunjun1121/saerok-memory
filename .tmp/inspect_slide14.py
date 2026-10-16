# -*- coding: utf-8 -*-
from pathlib import Path
from collections import Counter
import re
from xml.etree import ElementTree as ET

p = Path(r"C:\project\saerok-memory\.tmp\final-pptx-unpacked\ppt\slides\slide14.xml")
xml = p.read_text(encoding="utf-8")
print("COLOR COUNTS")
for c, n in Counter(x.upper() for x in re.findall(r'srgbClr val="([0-9A-Fa-f]+)"', xml)).most_common():
    print(f"  #{c}  x{n}")

# Find F6C7CF (blush) fill contexts
print("\n=== F6C7CF fill contexts ===")
for m in re.finditer(r'srgbClr val="F6C7CF"', xml):
    start = max(0, m.start() - 800)
    chunk = xml[start:m.end() + 200]
    # extract nearby text
    texts = re.findall(r"<a:t[^>]*>([^<]*)</a:t>", chunk)
    print(" texts nearby:", texts[-8:])
    print(" ---")

NS = {
    "a": "http://schemas.openxmlformats.org/drawingml/2006/main",
    "p": "http://schemas.openxmlformats.org/presentationml/2006/main",
}
tree = ET.parse(p)
print("\n=== shapes with fill + first text ===")
for i, sp in enumerate(tree.findall(".//p:sp", NS)):
    fills = [el.get("val") for el in sp.findall(".//a:srgbClr", NS)]
    texts = [t.text or "" for t in sp.findall(".//a:t", NS)]
    name = ""
    nv = sp.find(".//p:cNvPr", NS)
    if nv is not None:
        name = nv.get("name", "")
    xf = sp.find(".//a:off", NS)
    ext = sp.find(".//a:ext", NS)
    pos = ""
    if xf is not None and ext is not None:
        pos = f"x={xf.get('x')} y={xf.get('y')} w={ext.get('cx')} h={ext.get('cy')}"
    joined = " | ".join(texts)[:80]
    if "F6C7CF" in fills or "FF" in "".join(fills or []) or any(c and c.upper().startswith(("C4","D9","E8","FF","F6","C8","B5")) for c in fills):
        print(f"[{i}] {name} fills={fills} {pos}")
        print(f"    {joined}")
