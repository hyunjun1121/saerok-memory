# -*- coding: utf-8 -*-
from __future__ import annotations

import re
from pathlib import Path

SLIDES = Path(r"C:\project\saerok-memory\.tmp\final-pptx-unpacked\ppt\slides")
T_RE = re.compile(r"<a:t(?:\s[^>]*)?>([^<]*)</a:t>")


def xml_escape(text: str) -> str:
    return (
        text.replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace('"', "&quot;")
    )


def set_indices(slide_no: int, mapping: dict[int, str]) -> None:
    path = SLIDES / f"slide{slide_no}.xml"
    raw = path.read_text(encoding="utf-8")
    matches = list(T_RE.finditer(raw))
    missing = [i for i in mapping if i >= len(matches)]
    if missing:
        raise SystemExit(f"slide{slide_no}: missing indices {missing} (have {len(matches)})")
    for idx in sorted(mapping, reverse=True):
        m = matches[idx]
        raw = raw[: m.start(1)] + xml_escape(mapping[idx]) + raw[m.end(1) :]
    path.write_text(raw, encoding="utf-8")
    print(f"slide{slide_no}: {len(mapping)} replacements")


def replace_all_in_slide(slide_no: int, old: str, new: str) -> int:
    path = SLIDES / f"slide{slide_no}.xml"
    raw = path.read_text(encoding="utf-8")
    count = 0

    def sub_t(m: re.Match) -> str:
        nonlocal count
        inner = m.group(1)
        display = (
            inner.replace("&amp;", "&")
            .replace("&lt;", "<")
            .replace("&gt;", ">")
            .replace("&quot;", '"')
        )
        if old not in display:
            return m.group(0)
        count += 1
        updated = display.replace(old, new)
        return m.group(0)[: m.start(1) - m.start(0)] + xml_escape(updated) + "</a:t>"

    raw2 = T_RE.sub(sub_t, raw)
    if count:
        path.write_text(raw2, encoding="utf-8")
    return count


if __name__ == "__main__":
    # Cover: company + contest + demo URL
    set_indices(
        1,
        {
            11: "보편교육연구소",
            12: "2026 WE CARE MEMORY+ 치매 예방·완화 솔루션 ",
            13: "엑셀러레이팅 아이디어(시범사업 포함)",
            14: "",
            15: "",
            16: "",
            17: "",
            18: "haru-korea.vercel.app",
        },
    )

    # Problem slide: match application 2026 100만 전망
    set_indices(2, {30: "약 100만 명"})

    # Business: activity region from application is 서울·경기
    set_indices(10, {35: "서울·경기 가정 보급 시작"})

    # Team: KIST, 황규빈 bio, subtitle
    set_indices(
        12,
        {
            3: "AI · 의료실증 · 기구설계 · 사업전략",
            7: "KIST",
            8: " ",
            9: "AI 연구원",
            11: "총괄 · 대표",
            31: "의료실증",
            32: "",
            48: "황규빈",
            49: "Oxford Energy Systems",
            50: "IEA Energy Analyst",
            51: "사업전략 · 대외협력",
            52: "시장·사업성 분석",
            53: "국내외 파트너십",
            54: "",
            55: "국제협력 · 확산전략",
            56: "산업 전략자문",
            61: "기구설계 ",
        },
    )

    # Footer rebrand on every slide
    total = 0
    for i in range(1, 21):
        n = replace_all_in_slide(i, "OGASA Labs", "보편교육연구소")
        n += replace_all_in_slide(i, " OGASA ", " 보편교육연구소 ")
        n += replace_all_in_slide(i, "오가사", "보편교육연구소")
        if n:
            print(f"slide{i}: {n} brand replacements")
            total += n
    # leftover Labs run after OGASA was replaced as a whole phrase already;
    # split OGASA/Labs slides: Labs may remain
    for i in (8, 13):
        n = replace_all_in_slide(i, "Labs", "")
        if n:
            print(f"slide{i}: cleared leftover Labs ({n})")
            total += n
    print(f"done, brand hits ~{total}")
