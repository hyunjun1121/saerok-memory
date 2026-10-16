from pathlib import Path
from xml.etree import ElementTree as ET

root = Path(r"C:\project\saerok-memory\.tmp\final-pptx-unpacked")
NS = "{http://schemas.openxmlformats.org/drawingml/2006/main}"


def extract_text(xml_path: Path) -> str:
    tree = ET.parse(xml_path)
    chunks = []
    for t in tree.findall(f".//{NS}t"):
        if t.text:
            chunks.append(t.text)
        if t.tail and t.tail.strip():
            chunks.append(t.tail)
    return "\n".join(chunks)


# presentation order from sldIdLst is already known: slide1..slide20
for i in range(1, 21):
    slide = root / "ppt" / "slides" / f"slide{i}.xml"
    notes = root / "ppt" / "notesSlides" / f"notesSlide{i}.xml"
    print("=" * 80)
    print(f"SLIDE {i}")
    print("-" * 80)
    print(extract_text(slide))
    if notes.exists():
        print()
        print(f"[NOTES {i}]")
        print(extract_text(notes))
    print()
