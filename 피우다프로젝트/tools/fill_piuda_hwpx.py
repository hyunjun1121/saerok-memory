import os
import re
import shutil
import zipfile
from html import escape
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SOURCE_HWPX = ROOT / "2026_글로벌_피우다프로젝트_신청서_양식변환.hwpx"
TXT = ROOT / "지원서_양식.txt"
OUTPUT = ROOT / "2026_글로벌_피우다프로젝트_지원신청서_작성본.hwpx"


def parse_application(text: str):
    matches = list(re.finditer(r"^##\s+(\d+)\.\s*(.+)$", text, re.M))
    sections = {}
    for i, match in enumerate(matches):
        number = int(match.group(1))
        title = match.group(2).strip()
        start = match.end()
        end = matches[i + 1].start() if i + 1 < len(matches) else len(text)
        body = text[start:end].strip()
        lines = [
            line.rstrip()
            for line in body.splitlines()
            if line.strip() != "---"
        ]
        body = "\n".join(lines).strip()
        sections[number] = {"title": title, "body": body}
    return sections


def paragraphs(text: str, max_len: int = 420):
    blocks = []
    current = []
    for line in text.splitlines():
        if not line.strip():
            if current:
                blocks.append(" ".join(current).strip())
                current = []
            continue
        stripped = line.strip()
        if stripped.startswith("- "):
            if current:
                blocks.append(" ".join(current).strip())
                current = []
            blocks.append(stripped)
        else:
            current.append(stripped)
    if current:
        blocks.append(" ".join(current).strip())

    result = []
    for block in blocks:
        while len(block) > max_len:
            cut = block.rfind(" ", 0, max_len)
            if cut < max_len // 2:
                cut = max_len
            result.append(block[:cut].strip())
            block = block[cut:].strip()
        if block:
            result.append(block)
    return result or [""]


def text_nodes(xml: str):
    return re.findall(r"<hp:t>(.*?)</hp:t>", xml, re.S)


def cell_text(cell_xml: str):
    chunks = []
    for raw in text_nodes(cell_xml):
        clean = re.sub(r"<[^>]+>", "", raw)
        chunks.append(clean)
    return "".join(chunks).strip()


def make_para(text: str, para_pr: str = "28", char_pr: str = "35"):
    return (
        f'<hp:p id="2147483648" paraPrIDRef="{para_pr}" styleIDRef="0" '
        'pageBreak="0" columnBreak="0" merged="0">'
        f'<hp:run charPrIDRef="{char_pr}"><hp:t>{escape(text, quote=False)}</hp:t></hp:run>'
        '<hp:linesegarray>'
        '<hp:lineseg textpos="0" vertpos="0" vertsize="1000" textheight="1000" '
        'baseline="850" spacing="600" horzpos="500" horzsize="37116" flags="393216"/>'
        '</hp:linesegarray></hp:p>'
    )


def replace_sublist(cell_xml: str, content: str, para_pr: str = "28", char_pr: str = "35"):
    body = "".join(make_para(p, para_pr, char_pr) for p in paragraphs(content))
    return re.sub(
        r"(<hp:subList\b[^>]*>).*?(</hp:subList>)",
        lambda m: m.group(1) + body + m.group(2),
        cell_xml,
        count=1,
        flags=re.S,
    )


def inflate_cell_height(cell_xml: str, content: str):
    line_count = max(1, len(paragraphs(content)))
    height = max(3458, min(65000, 1700 * line_count + 2400))
    return re.sub(r'height="\d+"', f'height="{height}"', cell_xml)


def update_row(row_xml: str, label: str, content: str):
    cells = re.findall(r"<hp:tc\b.*?</hp:tc>", row_xml, re.S)
    if len(cells) < 2:
        return row_xml, False
    label_text = cell_text(cells[0]).replace(" ", "")
    normalized_label = label.replace(" ", "")
    if normalized_label not in label_text:
        return row_xml, False

    new_cell = replace_sublist(cells[1], content)
    new_cell = inflate_cell_height(new_cell, content)
    new_label = inflate_cell_height(cells[0], content)
    updated = row_xml.replace(cells[0], new_label, 1).replace(cells[1], new_cell, 1)
    return updated, True


def update_special_row(row_xml: str, label_predicate, content: str):
    cells = re.findall(r"<hp:tc\b.*?</hp:tc>", row_xml, re.S)
    if len(cells) < 2:
        return row_xml, False
    label_text = cell_text(cells[0]).replace(" ", "")
    if not label_predicate(label_text):
        return row_xml, False
    new_cell = replace_sublist(cells[1], content)
    new_cell = inflate_cell_height(new_cell, content)
    new_label = inflate_cell_height(cells[0], content)
    updated = row_xml.replace(cells[0], new_label, 1).replace(cells[1], new_cell, 1)
    return updated, True


def update_section(section_xml: str, sections):
    title_lines = [line.strip() for line in sections[1]["body"].splitlines() if line.strip()]
    product_name = title_lines[0]
    intro = " ".join(title_lines[1:]).strip()
    topic_lines = [line.strip() for line in sections[2]["body"].splitlines() if line.strip()]
    topic = topic_lines[0]

    replacements = {
        sections[1]["title"]: product_name,
        sections[2]["title"]: topic,
        sections[3]["title"]: sections[3]["body"],
        sections[4]["title"]: sections[4]["body"],
        sections[5]["title"]: sections[5]["body"],
        sections[7]["title"]: sections[7]["body"],
    }

    rows = re.findall(r"<hp:tr\b.*?</hp:tr>", section_xml, re.S)
    changed = 0
    for row in rows:
        new_row = row
        for label, content in replacements.items():
            candidate, did = update_row(new_row, label, content)
            if did:
                new_row = candidate
                changed += 1
                break
        if new_row == row:
            candidate, did = update_special_row(
                new_row,
                lambda t: "개발물소개" in t,
                intro,
            )
            if did:
                new_row = candidate
                changed += 1
        if new_row == row:
            candidate, did = update_special_row(
                new_row,
                lambda t: "개발주제관련" in t and "팀및팀원역량" in t,
                sections[6]["body"],
            )
            if did:
                new_row = candidate
                changed += 1
        if new_row != row:
            section_xml = section_xml.replace(row, new_row, 1)

    return section_xml, changed


def copy_with_updated_section(src: Path, dst: Path, section1: str):
    tmp = dst.with_suffix(dst.suffix + ".tmp")
    with zipfile.ZipFile(src, "r") as zin:
        with zipfile.ZipFile(tmp, "w", zipfile.ZIP_DEFLATED) as zout:
            for item in zin.infolist():
                data = zin.read(item.filename)
                if item.filename == "Contents/section1.xml":
                    data = section1.encode("utf-8")
                if item.filename == "mimetype":
                    zout.writestr(item, data, compress_type=zipfile.ZIP_STORED)
                else:
                    zout.writestr(item, data)
    os.replace(tmp, dst)


def main():
    sections = parse_application(TXT.read_text(encoding="utf-8"))
    if set(sections) != {1, 2, 3, 4, 5, 6, 7}:
        raise RuntimeError(f"Unexpected sections: {sorted(sections)}")

    shutil.copy2(SOURCE_HWPX, OUTPUT)
    with zipfile.ZipFile(SOURCE_HWPX, "r") as zf:
        section1 = zf.read("Contents/section1.xml").decode("utf-8")
    updated, changed = update_section(section1, sections)
    if changed < 8:
        raise RuntimeError(f"Only {changed} rows updated; expected at least 8")
    copy_with_updated_section(SOURCE_HWPX, OUTPUT, updated)
    print(f"created={OUTPUT}")
    print(f"updated_rows={changed}")


if __name__ == "__main__":
    main()
