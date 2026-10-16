from pathlib import Path

from lxml import etree


SECTION = Path(r"C:\project\saerok-memory\.tmp\patent_form_unpacked_20260817\Contents\section0.xml")


def local_name(element: etree._Element) -> str:
    return etree.QName(element.tag).localname


def text_of(element: etree._Element) -> str:
    chunks = []
    for node in element.iter():
        if local_name(node) == "t" and node.text:
            chunks.append(node.text)
    return "".join(chunks).replace("\n", " ").strip()


tree = etree.parse(str(SECTION))
root = tree.getroot()
sec = next((node for node in root.iter() if local_name(node) == "sec"), None)
if sec is None:
    raise RuntimeError("No sec element found")

children = list(sec)
print(f"direct_children={len(children)}")
for index, child in enumerate(children):
    name = local_name(child)
    text = text_of(child)
    break_page = child.get("pageBreak") or child.get("page-break")
    style = child.get("paraPrIDRef")
    if name == "p":
        table_count = sum(1 for node in child.iter() if local_name(node) == "tbl")
        if text or table_count or break_page:
            print(
                f"[{index:03}] {name} style={style} pageBreak={break_page} "
                f"tables={table_count} text={text[:180]!r}"
            )
    else:
        print(f"[{index:03}] {name} text={text[:180]!r}")

print("--- tables ---")
for table_index, table in enumerate(node for node in sec.iter() if local_name(node) == "tbl"):
    rows = [node for node in table if local_name(node) == "tr"]
    print(f"table[{table_index}] rows={len(rows)} text={text_of(table)[:500]!r}")

    if table_index == 0:
        for row_index, row in enumerate(rows):
            cells = [node for node in row if local_name(node) == "tc"]
            print(f"  row[{row_index}] cells={len(cells)}")
            for cell_index, cell in enumerate(cells):
                paragraphs = [node for node in cell.iter() if local_name(node) == "p"]
                print(
                    f"    cell[{cell_index}] paragraphs={len(paragraphs)} "
                    f"text={text_of(cell)[:220]!r}"
                )
                for paragraph_index, paragraph in enumerate(paragraphs):
                    paragraph_text = text_of(paragraph)
                    if paragraph_text:
                        print(
                            f"      p[{paragraph_index:03}] paraPr={paragraph.get('paraPrIDRef')} "
                            f"text={paragraph_text[:220]!r}"
                        )
