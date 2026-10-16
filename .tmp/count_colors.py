from pathlib import Path
import re
from collections import Counter

root = Path(r"C:\project\saerok-memory\.tmp\final-pptx-unpacked")
c = Counter()
for p in root.rglob("*.xml"):
    t = p.read_text(encoding="utf-8")
    for m in re.findall(r'srgbClr val="([0-9A-Fa-f]{6})"', t):
        c[m.upper()] += 1
for k, v in c.most_common(50):
    print(k, v)
