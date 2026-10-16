from __future__ import annotations

import copy
import re
import shutil
import subprocess
import sys
import tempfile
import zipfile
from pathlib import Path

from lxml import etree
from PIL import Image


ROOT = Path(__file__).resolve().parents[2]
WORK = ROOT / ".tmp" / "patent_application_20260817"
OUTPUT = ROOT / "docs" / "patent" / "오가사LABs_2x2키오스크_특허출원_초안"
SKILL = Path(r"C:\Users\mnb92\.codex\skills\hwpx-skill")
SCRIPTS = SKILL / "scripts"
ASSETS = SKILL / "assets"

sys.path.insert(0, str(SCRIPTS))
from hwpx_helpers import (  # noqa: E402
    NS_DECL,
    add_images_to_hwpx,
    extract_secpr_and_colpr,
    make_first_para,
    make_image_para,
    make_page_break,
    make_text_para,
    reset_id,
    update_content_hpf,
)


HP_NS = "http://www.hancom.co.kr/hwpml/2011/paragraph"
OFFICIAL_APPLICATION = WORK.parent / "official_form14_20260514.hwpx"
STAMP_IMAGE = ROOT / "피우다프로젝트" / "발표자료" / "추가자료" / "도장.png"


def build_text_documents() -> list[Path]:
    documents = []
    for source_name, output_name, title in (
        ("02_명세서_청구범위.md", "02_명세서_청구범위.hwpx", "명세서 및 청구범위"),
        ("03_요약서.md", "03_요약서.hwpx", "요약서"),
    ):
        destination = OUTPUT / output_name
        subprocess.run(
            [
                sys.executable,
                str(SCRIPTS / "md2hwpx.py"),
                str(WORK / source_name),
                "--output",
                str(destination),
                "--template",
                "report",
                "--title",
                title,
                "--creator",
                "오가사 LABs",
            ],
            check=True,
            cwd=ROOT,
        )
        documents.append(destination)
    return documents


def build_application() -> Path:
    """Fill the current official Form 14 HWPX while preserving its typography."""
    destination = OUTPUT / "01_특허출원서_초안.hwpx"
    shutil.copyfile(OFFICIAL_APPLICATION, destination)
    temporary = destination.with_suffix(".hwpx.application_tmp")

    with zipfile.ZipFile(destination, "r") as source, zipfile.ZipFile(
        temporary, "w", zipfile.ZIP_DEFLATED
    ) as target:
        for item in source.infolist():
            data = source.read(item.filename)
            if item.filename == "Contents/header.xml":
                text = data.decode("utf-8")
                text = re.sub(
                    r'(<hh:charPr\b[^>]*\btextColor=")[^"]+("[^>]*>)',
                    r"\g<1>#000000\g<2>",
                    text,
                )
                data = text.encode("utf-8")
            elif item.filename == "Contents/section0.xml":
                parser = etree.XMLParser(remove_blank_text=False)
                root = etree.fromstring(data, parser)
                paragraphs = root.xpath(".//hp:p", namespaces={"hp": HP_NS})

                def text_nodes(index: int):
                    return paragraphs[index].xpath(".//hp:t", namespaces={"hp": HP_NS})

                def remove_line_layout(index: int) -> None:
                    for line_cache in paragraphs[index].xpath(
                        "./hp:linesegarray", namespaces={"hp": HP_NS}
                    ):
                        paragraphs[index].remove(line_cache)

                def append(index: int, value: str) -> None:
                    nodes = text_nodes(index)
                    nodes[-1].text = (nodes[-1].text or "") + value
                    remove_line_layout(index)

                def add_stamp(index: int) -> None:
                    reset_id(2100000000)
                    fragment = etree.fromstring(
                        (
                            f"<root {NS_DECL}>"
                            + make_image_para(
                                "applicant_stamp", width=5386, height=5386, parapr="41"
                            )
                            + "</root>"
                        ).encode("utf-8")
                    )
                    picture = fragment.xpath(".//hp:pic", namespaces={"hp": HP_NS})[0]
                    picture.set("zOrder", "2")
                    picture.set("textWrap", "IN_FRONT_OF_TEXT")
                    position = picture.xpath("./hp:pos", namespaces={"hp": HP_NS})[0]
                    position.attrib.update(
                        {
                            "treatAsChar": "0",
                            "affectLSpacing": "0",
                            "flowWithText": "0",
                            "allowOverlap": "1",
                            "holdAnchorAndSO": "0",
                            "vertRelTo": "PAGE",
                            "horzRelTo": "PAGE",
                            "vertAlign": "TOP",
                            "horzAlign": "LEFT",
                            "vertOffset": "55200",
                            "horzOffset": "31400",
                        }
                    )
                    run = etree.Element(f"{{{HP_NS}}}run", charPrIDRef="19")
                    run.append(picture)
                    etree.SubElement(run, f"{{{HP_NS}}}t")
                    paragraphs[index].append(run)
                    remove_line_layout(index)

                def add_english_title_continuation(index: int) -> None:
                    paragraph = paragraphs[index]
                    nodes = paragraph.xpath(".//hp:t", namespaces={"hp": HP_NS})
                    suffix = " AND METHOD"
                    if not (nodes[-1].text or "").endswith(suffix):
                        raise ValueError("English title suffix not found")
                    nodes[-1].text = (nodes[-1].text or "")[: -len(suffix)]
                    continuation = copy.deepcopy(paragraph)
                    continuation.set("id", "2100000100")
                    continuation_nodes = continuation.xpath(
                        ".//hp:t", namespaces={"hp": HP_NS}
                    )
                    for node in continuation_nodes:
                        node.text = ""
                    continuation_nodes[-1].text = "                     AND METHOD"
                    for line_cache in continuation.xpath(
                        "./hp:linesegarray", namespaces={"hp": HP_NS}
                    ):
                        continuation.remove(line_cache)
                    parent = paragraph.getparent()
                    parent.insert(parent.index(paragraph) + 1, continuation)
                    remove_line_layout(index)

                nodes = text_nodes(5)
                nodes[0].text = (nodes[0].text or "").replace("□ 특허출원", "☒ 특허출원")
                remove_line_layout(5)
                append(7, " 검토용 초안·미제출")
                append(9, " 오가사 LABs [법적 명칭 확인]")
                append(10, " [확인 필요]")
                append(15, " 상태전환·이중확인형 2×2 버튼 키오스크 시스템 및 방법")
                append(
                    16,
                    " STATE-SWITCHED DUAL-CONFIRMATION 2×2 BUTTON KIOSK SYSTEM AND METHOD",
                )
                append(18, " 김현준 [실제 공동발명자 확인]")
                append(19, " [확인 필요]")
                nodes = text_nodes(20)
                nodes[0].text = (nodes[0].text or "").replace("□ 국어", "☒ 국어")
                remove_line_layout(20)
                nodes = text_nodes(34)
                nodes[0].text = (nodes[0].text or "").replace(
                    "출원인(대리인)", "출원인(대리인) 오가사 LABs 대표 김현준"
                )
                add_stamp(34)
                add_english_title_continuation(16)
                data = etree.tostring(root, xml_declaration=True, encoding="UTF-8")

            if item.filename == "mimetype":
                target.writestr(item, data, compress_type=zipfile.ZIP_STORED)
            else:
                target.writestr(item, data)
    shutil.move(temporary, destination)
    add_images_to_hwpx(
        destination,
        [
            {
                "file": "applicant_stamp.png",
                "id": "applicant_stamp",
                "src_path": str(STAMP_IMAGE),
            }
        ],
    )
    update_content_hpf(
        destination,
        [{"file": "applicant_stamp.png", "id": "applicant_stamp"}],
    )
    return destination


def update_content_hpf_for_tiff(hwpx_path: Path, images: list[dict[str, str]]) -> None:
    temporary = hwpx_path.with_suffix(".hwpx.hpf_tmp")
    with zipfile.ZipFile(hwpx_path, "r") as source, zipfile.ZipFile(
        temporary, "w", zipfile.ZIP_DEFLATED
    ) as target:
        for item in source.infolist():
            data = source.read(item.filename)
            if item.filename == "Contents/content.hpf":
                text = data.decode("utf-8")
                manifest_items = "".join(
                    f'<opf:item id="{image["id"]}" href="BinData/{image["file"]}" '
                    'media-type="image/tiff" isEmbeded="1"/>'
                    for image in images
                )
                text = text.replace("</opf:manifest>", manifest_items + "</opf:manifest>")
                data = text.encode("utf-8")
            if item.filename == "mimetype":
                target.writestr(item, data, compress_type=zipfile.ZIP_STORED)
            else:
                target.writestr(item, data)
    shutil.move(temporary, hwpx_path)


def build_drawings() -> Path:
    OUTPUT.mkdir(parents=True, exist_ok=True)
    template = ASSETS / "report-template.hwpx"
    secpr, colpr = extract_secpr_and_colpr(template)
    reset_id(2000000000)

    parts = [make_first_para(secpr, colpr, charpr="0", parapr="0")]
    images: list[dict[str, str]] = []
    tiff_directory = WORK / "figures" / "tiff"
    tiff_directory.mkdir(parents=True, exist_ok=True)
    for index in range(1, 7):
        source = WORK / "figures" / f"figure_{index}.png"
        with Image.open(source) as im:
            width_px, height_px = im.size
            tiff_source = tiff_directory / f"figure_{index}.tif"
            im.convert("1").save(
                tiff_source,
                format="TIFF",
                compression="group4",
                dpi=(300, 300),
            )
        # Fits title paragraphs plus a portrait figure on one official A4 page.
        width = 41000
        height = round(width * height_px / width_px)
        item_id = f"patent_figure_{index}"
        filename = f"patent_figure_{index}.tif"

        if index == 1:
            parts.append(make_text_para("【도면】", charpr="8", parapr="0"))
        else:
            parts.append(make_page_break(charpr="0", parapr="0"))
        parts.append(make_text_para(f"【도 {index}】", charpr="8", parapr="0"))
        parts.append(make_image_para(item_id, width=width, height=height, parapr="19"))
        images.append({"file": filename, "id": item_id, "src_path": str(tiff_source)})

    section_xml = (
        "<?xml version='1.0' encoding='UTF-8'?>\n"
        f"<hs:sec {NS_DECL}>\n"
        + "\n".join(parts)
        + "\n</hs:sec>\n"
    )

    destination = OUTPUT / "04_도면.hwpx"
    with tempfile.TemporaryDirectory() as temp_dir:
        section_path = Path(temp_dir) / "section0.xml"
        section_path.write_text(section_xml, encoding="utf-8")
        subprocess.run(
            [
                sys.executable,
                str(SCRIPTS / "build_hwpx.py"),
                "--template",
                "report",
                "--section",
                str(section_path),
                "--title",
                "도면",
                "--creator",
                "오가사 LABs",
                "--output",
                str(destination),
            ],
            check=True,
            cwd=ROOT,
        )
    add_images_to_hwpx(destination, images)
    update_content_hpf_for_tiff(destination, images)
    return destination


def officialize_hwpx(path: Path) -> None:
    """Apply restrained current-specification typography to an HWPX package."""
    temp_path = path.with_suffix(path.suffix + ".official_tmp")
    with zipfile.ZipFile(path, "r") as source, zipfile.ZipFile(
        temp_path, "w", zipfile.ZIP_DEFLATED
    ) as target:
        for item in source.infolist():
            data = source.read(item.filename)
            if item.filename == "Contents/header.xml":
                text = data.decode("utf-8")
                text = re.sub(r'face="Text"', 'face="함초롬바탕"', text)
                text = re.sub(
                    r'(<hh:charPr\b[^>]*\bheight=")[^"]+("[^>]*>)',
                    r"\g<1>1200\g<2>",
                    text,
                )
                text = re.sub(
                    r'(<hh:charPr\b[^>]*\btextColor=")[^"]+("[^>]*>)',
                    r"\g<1>#000000\g<2>",
                    text,
                )
                text = re.sub(
                    r'(<hh:lineSpacing\b[^>]*\bvalue=")[^"]+("[^>]*>)',
                    r"\g<1>280\g<2>",
                    text,
                )
                data = text.encode("utf-8")
            elif item.filename.startswith("Contents/section") and item.filename.endswith(
                ".xml"
            ):
                text = data.decode("utf-8")
                text = re.sub(
                    r'<hp:margin\s+header="[^"]+"\s+footer="[^"]+"\s+gutter="[^"]+"\s+'
                    r'left="[^"]+"\s+right="[^"]+"\s+top="[^"]+"\s+bottom="[^"]+"\s*/>',
                    '<hp:margin header="0" footer="0" gutter="0" left="7087" '
                    'right="5669" top="11339" bottom="5669"/>',
                    text,
                )
                text = text.replace('paraPrIDRef="27"', 'paraPrIDRef="0"')
                text = re.sub(
                    r'(<hp:pagePr\b[^>]*\bwidth=")[^"]+("\s+height=")[^"]+',
                    r"\g<1>59528\g<2>84188",
                    text,
                )
                data = text.encode("utf-8")

            if item.filename == "mimetype":
                target.writestr(item, data, compress_type=zipfile.ZIP_STORED)
            else:
                target.writestr(item, data)
    shutil.move(temp_path, path)


def main() -> None:
    application = build_application()
    text_documents = build_text_documents()
    drawings = build_drawings()
    for document in [*text_documents, drawings]:
        officialize_hwpx(document)
    for document in [application, *text_documents, drawings]:
        subprocess.run(
            [sys.executable, str(SCRIPTS / "fix_namespaces.py"), str(document)],
            check=True,
            cwd=ROOT,
        )
        subprocess.run(
            [sys.executable, str(SCRIPTS / "validate.py"), str(document)],
            check=True,
            cwd=ROOT,
        )


if __name__ == "__main__":
    main()
