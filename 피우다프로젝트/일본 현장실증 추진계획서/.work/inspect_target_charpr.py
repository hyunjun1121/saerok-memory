import json
import re
import sys
import zipfile
import xml.etree.ElementTree as ET

NS = {"h": "http://www.hancom.co.kr/hwpml/2011/paragraph"}
HH = "{http://www.hancom.co.kr/hwpml/2011/head}"


def text(element):
    return "".join(element.itertext())


def inspect(doc_path, cells_path, titles):
    cells = json.load(open(cells_path, encoding="utf-8"))
    with zipfile.ZipFile(doc_path) as archive:
        section = ET.fromstring(archive.read("Contents/section0.xml"))
        header = ET.fromstring(archive.read("Contents/header.xml"))
    tables = section.findall(".//h:tbl", NS)
    wanted = {(item["table"], item["row"], item["col"]) for item in cells}
    ids = set()
    for table_idx, table in enumerate(tables):
        for row in table.findall("h:tr", NS):
            for cell in row.findall("h:tc", NS):
                address = cell.find("h:cellAddr", NS)
                if address is None:
                    continue
                key = (table_idx, int(address.get("rowAddr")), int(address.get("colAddr")))
                if key not in wanted:
                    continue
                for run in cell.findall(".//h:run", NS):
                    if text(run).strip():
                        ids.add(run.get("charPrIDRef"))
    if titles:
        for paragraph in section.findall(".//h:p", NS):
            if any(title in text(paragraph) for title in titles):
                for run in paragraph.findall(".//h:run", NS):
                    if text(run).strip():
                        ids.add(run.get("charPrIDRef"))
    print(doc_path)
    violations = []
    for char in header.findall(".//" + HH + "charPr"):
        if char.get("id") in ids:
            raw = ET.tostring(char, encoding="unicode")
            print(char.get("id"), re.sub(r"\s+", " ", raw))
            if char.get("textColor") != "#000000" or HH + "italic" in {node.tag for node in char.iter()}:
                violations.append(char.get("id"))
    if violations:
        raise SystemExit(f"FAIL: non-black or italic target charPr IDs: {violations}")
    print(f"PASS: {len(ids)} target styles are black and non-italic")


inspect(sys.argv[1], sys.argv[2], sys.argv[3:])
