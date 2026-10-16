# -*- coding: utf-8 -*-
from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(r"C:\project\saerok-memory\.tmp\final-pptx-unpacked")
T_RE = re.compile(r"<a:t(?:\s[^>]*)?>([^<]*)</a:t>")

COLOR_MAP = {
    "F57265": "1F6B72",  # coral -> teal
    "2A2018": "1B2D3A",  # brown text -> navy charcoal
    "F5ECD8": "E8EEF2",  # cream cards -> cool gray
    "FBF5E9": "F4F7FA",  # cream bg -> cool off-white
    "6C5D4C": "4A5C6A",  # muted brown -> slate
    "9C8B77": "6B7C8A",  # light brown labels
    "E0D4C1": "C5D0D8",  # beige rules
    "EAF3E4": "DCECEA",  # mint chips
    "C8410E": "1A5F68",  # rust quote -> deep teal
    "5E9A6A": "2A7A6F",  # green
    "F4A81D": "C4A35A",  # mustard -> gold
    "FBE0D3": "D9E6EA",
    "FEE7E0": "D9E6EA",
    "6E5D49": "4A5C6A",
    "E7DBC2": "D5DEE5",
    "FBE6B4": "E8E4D4",
    "FFFCF6": "F4F7FA",
    "D8C7A6": "C5D0D8",
    "F7E3D6": "D9E6EA",
    "F3ECDE": "E8EEF2",
    "FFF7F2": "F4F7FA",
    "C2B4A0": "B7C3CC",
}


def xml_escape(text: str) -> str:
    return (
        text.replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace('"', "&quot;")
    )


def rewrite_haru_text(display: str) -> str:
    if "haru-korea.vercel.app" in display.lower() or "haru-raspberry" in display.lower():
        return display
    # longer phrases first
    pairs = [
        ("Haru by 보편교육연구소", "치매링고 · 보편교육연구소"),
        ("왜 Haru가 더 나은가", "왜 치매링고가 더 나은가"),
        ("제공하는 것은 Haru뿐", "제공하는 것은 치매링고뿐"),
        ("Haru 개인화 문항", "치매링고 개인화 문항"),
        ("Haru 활동 문항", "치매링고 활동 문항"),
        ("Haru는", "치매링고는"),
        ("Haru ", "치매링고 "),
        ("Haru", "치매링고"),
    ]
    out = display
    for a, b in pairs:
        out = out.replace(a, b)
    return out


def patch_text_nodes(raw: str) -> tuple[str, int]:
    n = 0

    def sub(m: re.Match) -> str:
        nonlocal n
        inner = m.group(1)
        display = (
            inner.replace("&amp;", "&")
            .replace("&lt;", "<")
            .replace("&gt;", ">")
            .replace("&quot;", '"')
        )
        updated = rewrite_haru_text(display)
        if updated == display:
            return m.group(0)
        n += 1
        return m.group(0)[: m.start(1) - m.start(0)] + xml_escape(updated) + "</a:t>"

    return T_RE.sub(sub, raw), n


def patch_colors(raw: str) -> tuple[str, int]:
    n = 0
    for old, new in COLOR_MAP.items():
        pat = re.compile(re.escape(old), re.IGNORECASE)

        def repl(_m, new=new, old=old):
            nonlocal n
            n += 1
            return new

        raw, k = pat.subn(repl, raw)
        n += 0  # already counted in subn via side effect... wait
    # recount properly
    return raw, n


def patch_colors_simple(raw: str) -> tuple[str, int]:
    total = 0
    for old, new in COLOR_MAP.items():
        raw, k = re.subn(old, new, raw, flags=re.IGNORECASE)
        total += k
    return raw, total


if __name__ == "__main__":
    text_hits = color_hits = files = 0
    for p in ROOT.rglob("*.xml"):
        raw = p.read_text(encoding="utf-8")
        raw2, tn = patch_text_nodes(raw)
        raw3, cn = patch_colors_simple(raw2)
        if tn or cn:
            p.write_text(raw3, encoding="utf-8")
            files += 1
            text_hits += tn
            color_hits += cn
            print(f"{p.relative_to(ROOT)}: text {tn}, color {cn}")
    print(f"files {files}, text {text_hits}, color {color_hits}")
