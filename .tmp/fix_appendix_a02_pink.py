# -*- coding: utf-8 -*-
"""Appendix A02 (slide14): replace blush-pink highlight boxes with soft sky."""
from pathlib import Path

SLIDE = Path(r"C:\project\saerok-memory\.tmp\final-pptx-unpacked\ppt\slides\slide14.xml")
xml = SLIDE.read_text(encoding="utf-8")
pink_count = xml.count('srgbClr val="F6C7CF"')
xml = xml.replace('srgbClr val="F6C7CF"', 'srgbClr val="E8F4FF"')

# Generated-question inner card: unique geometry + ivory fill + blue stroke.
old_q = """          <p:cNvPr id="65" name="Rounded Rectangle 64"/>
          <p:cNvSpPr/>
          <p:nvPr/>
        </p:nvSpPr>
        <p:spPr>
          <a:xfrm>
            <a:off x="9198864" y="2578608"/>
            <a:ext cx="1984248" cy="1993392"/>
          </a:xfrm>
          <a:prstGeom prst="roundRect">
            <a:avLst>
              <a:gd name="adj" fmla="val 16667"/>
            </a:avLst>
          </a:prstGeom>
          <a:solidFill>
            <a:srgbClr val="F7F5F2"/>
          </a:solidFill>"""
new_q = old_q.replace('srgbClr val="F7F5F2"', 'srgbClr val="E8F4FF"')
if old_q not in xml:
    raise SystemExit("question card block not found")
xml = xml.replace(old_q, new_q, 1)

SLIDE.write_text(xml, encoding="utf-8")
print(f"F6C7CF → E8F4FF: {pink_count}")
print("question card fill → E8F4FF: 1")
print("remaining F6C7CF:", xml.count("F6C7CF"))
