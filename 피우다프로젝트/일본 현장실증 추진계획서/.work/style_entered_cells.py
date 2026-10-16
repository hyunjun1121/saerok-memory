"""Make only specified table-cell text black and non-italic in an HWPX form.

This uses the HWPX skill's scanner, style-cloning, and ZIP patching helpers.
It never rewrites text nodes or changes unlisted template cells.
"""

from __future__ import annotations

import argparse
import io
import json
import re
import sys
import zipfile
from pathlib import Path


def load_fill_module(skill_scripts: str):
    sys.path.insert(0, skill_scripts)
    import fill_hwpx  # type: ignore

    return fill_hwpx


def direct_text_runs(fill, xml: str, container):
    """Return non-empty text runs in a cell or paragraph, excluding nested tables."""
    registry = fill.Registry(xml)
    result = []
    for run in fill.descendants(container, ("run", "r")):
        if fill.under_tbl_within(run, container):
            continue
        value = "".join(node.text for node in fill.own_tnodes(run, registry)).strip()
        if value:
            result.append(run)
    return result


def parent_paragraph(run):
    node = run
    while node is not None and node.name != "p":
        node = node.parent
    return node


def black_upright_mutation(fill):
    def mutate(open_tag: str, inner: str):
        open_tag = fill._set_open_attr(open_tag, "textColor", "#000000")
        inner = re.sub(r"<hh:italic\b[^>]*/\s*>", "", inner)
        inner = re.sub(r"<hh:italic\b[^>]*>.*?</hh:italic\s*>", "", inner, flags=re.DOTALL)
        return open_tag, inner

    return mutate


def style_document(input_path: str, output_path: str, cells_path: str, titles: list[str], skill_scripts: str):
    fill = load_fill_module(skill_scripts)
    cells = json.loads(Path(cells_path).read_text(encoding="utf-8"))
    by_table = {}
    for item in cells:
        by_table.setdefault(int(item["table"]), set()).add((int(item["row"]), int(item["col"])))

    buf, names, xmls, header_xml = fill._load_doc(input_path)
    if header_xml is None:
        raise ValueError("header.xml was not found")
    header_name = fill._header_name(buf)
    if header_name is None:
        raise ValueError("header.xml entry was not found")

    changed_sections = {}
    all_target_runs = 0
    all_target_cells = 0
    changed_runs = 0
    style_ids = {}

    for section_name in names:
        xml = xmls[section_name]
        root = fill.scan_xml(xml)
        tables = list(fill.descendants(root, "tbl"))
        target_runs = {}
        target_paragraphs = {}

        for table_idx, addresses in by_table.items():
            if table_idx >= len(tables):
                raise ValueError(f"table {table_idx} is outside the document")
            table = tables[table_idx]
            for row, col in addresses:
                cell = fill._find_cell(xml, table, row, col)
                if cell is None:
                    raise ValueError(f"cell table={table_idx}, row={row}, col={col} was not found")
                all_target_cells += 1
                for run in direct_text_runs(fill, xml, cell):
                    target_runs[run.start] = run
                    paragraph = parent_paragraph(run)
                    if paragraph is not None:
                        target_paragraphs[paragraph.start] = paragraph

        if titles:
            registry = fill.Registry(xml)
            for paragraph in fill.descendants(root, "p"):
                full = "".join(node.text for node in fill.own_tnodes(paragraph, registry))
                if any(title in full for title in titles):
                    for run in direct_text_runs(fill, xml, paragraph):
                        target_runs[run.start] = run
                        target_paragraphs[paragraph.start] = paragraph

        if not target_runs:
            continue
        all_target_runs += len(target_runs)
        splices = []
        for start, run in target_runs.items():
            segment = xml[run.start : run.open_end]
            match = re.search(r'charPrIDRef="(\d+)"', segment)
            if match is None:
                raise ValueError(f"run at offset {start} has no charPrIDRef")
            base_id = match.group(1)
            if base_id not in style_ids:
                style_ids[base_id], header_xml = fill._add_cloned(
                    header_xml,
                    "charProperties",
                    "charPr",
                    base_id,
                    black_upright_mutation(fill),
                )
            new_id = style_ids[base_id]
            splices.append(
                (
                    run.start + match.start(),
                    run.start + match.end(),
                    f'charPrIDRef="{new_id}"',
                )
            )
            changed_runs += 1

        for paragraph in target_paragraphs.values():
            fill._strip_para_linesegs(xml, paragraph, splices)
        changed_sections[section_name] = fill.apply_splices(xml, splices)

    if all_target_cells != len({(item["table"], item["row"], item["col"]) for item in cells}):
        raise ValueError("not every requested cell was visited")
    if all_target_runs == 0:
        raise ValueError("no entered text runs were found")

    changed_sections[header_name] = header_xml
    fill._write_doc(buf, output_path, changed_sections)

    # Re-open the result and prove that each new style is black and upright.
    for new_id in style_ids.values():
        open_tag, inner = fill._elem_by_id(header_xml, "charPr", new_id)
        if open_tag is None or 'textColor="#000000"' not in open_tag:
            raise ValueError(f"new charPr {new_id} is not black")
        if re.search(r"<hh:italic\b", inner or ""):
            raise ValueError(f"new charPr {new_id} is still italic")

    return {
        "input": input_path,
        "output": output_path,
        "target_cells": all_target_cells,
        "target_text_runs": all_target_runs,
        "changed_runs": changed_runs,
        "style_map": style_ids,
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("input")
    parser.add_argument("output")
    parser.add_argument("--cells", required=True)
    parser.add_argument("--title", action="append", default=[])
    parser.add_argument(
        "--skill-scripts",
        default=r"C:\Users\mnb92\.codex\skills\hwpx-skill\scripts",
    )
    args = parser.parse_args()
    report = style_document(args.input, args.output, args.cells, args.title, args.skill_scripts)
    print(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
