from pathlib import Path
import re

root = Path(r"C:\project\saerok-memory\.tmp\final-pptx-unpacked\ppt")
ns_r = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"

for rels in sorted((root / "slides" / "_rels").glob("slide*.xml.rels")):
    text = rels.read_text(encoding="utf-8")
    rids = re.findall(
        r'Id="(rId\d+)"[^>]*Target="\.\./media/image3\.png"|Target="\.\./media/image3\.png"[^>]*Id="(rId\d+)"',
        text,
    )
    ids = [a or b for a, b in rids]
    if not ids:
        # simpler
        for m in re.finditer(r'Id="(rId\d+)" Type="[^"]+/image" Target="\.\./media/image3\.png"', text):
            ids.append(m.group(1))
    if not ids:
        continue
    slide = root / "slides" / rels.name.replace(".rels", "")
    raw = slide.read_text(encoding="utf-8")
    print("====", slide.name, "rIds", ids)
    for rid in ids:
        # find blip embed then nearby xfrm
        idx = raw.find(f'r:embed="{rid}"')
        if idx < 0:
            print("  missing embed", rid)
            continue
        # search backwards for pic start and forwards for xfrm
        chunk = raw[max(0, idx - 800) : idx + 900]
        off = re.search(r'<a:off x="(\d+)" y="(\d+)"/>', chunk)
        ext = re.search(r'<a:ext cx="(\d+)" cy="(\d+)"/>', chunk)
        name = re.search(r'name="([^"]+)"', chunk)
        if off and ext:
            x, y, cx, cy = map(int, (*off.groups(), *ext.groups()))
            print(f"  {name.group(1) if name else '?'} x={x} y={y} cx={cx} cy={cy}  {cx/914400:.2f}\" x {cy/914400:.2f}\"")
        else:
            print("  xfrm not found near", rid)
