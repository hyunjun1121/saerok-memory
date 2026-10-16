# -*- coding: utf-8 -*-
from pathlib import Path
from xml.etree import ElementTree as ET

p = Path(r"C:\project\saerok-memory\.tmp\final-pptx-unpacked\ppt\slides\slide14.xml")
NS = {
    "a": "http://schemas.openxmlformats.org/drawingml/2006/main",
    "p": "http://schemas.openxmlformats.org/presentationml/2006/main",
}
tree = ET.parse(p)
print("ALL SHAPES")
for i, sp in enumerate(tree.findall(".//p:sp", NS)):
    fills = [el.get("val") for el in sp.findall(".//a:solidFill/a:srgbClr", NS)]
    lines = []
    for ln in sp.findall(".//a:ln", NS):
        lines += [el.get("val") for el in ln.findall(".//a:srgbClr", NS)]
    texts = [t.text or "" for t in sp.findall(".//a:t", NS)]
    nv = sp.find(".//p:cNvPr", NS)
    name = nv.get("name", "") if nv is not None else ""
    xf = sp.find(".//a:off", NS)
    ext = sp.find(".//a:ext", NS)
    pos = ""
    if xf is not None and ext is not None:
        pos = f"x={int(xf.get('x',0))/914400:.2f}\" y={int(xf.get('y',0))/914400:.2f}\" w={int(ext.get('cx',0))/914400:.2f}\" h={int(ext.get('cy',0))/914400:.2f}\""
    joined = " | ".join(texts)[:90]
    print(f"[{i:02d}] {name:24s} fill={fills} ln={lines}")
    print(f"     {pos}")
    if joined:
        print(f"     {joined}")
