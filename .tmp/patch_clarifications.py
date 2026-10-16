# -*- coding: utf-8 -*-
"""Apply clarification patches only. Do not re-run the full rewrite."""
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


# Cover: official device name as title; diary stays in subtitle/bullets
set_indices(
    1,
    {
        1: "치매환자 친화적",
        3: "매일의 기억을 남기는 전자 일기",
        5: "2×2 버튼과 음성 인식의",
        6: " 전용 기기",
    },
)

# Problem: MSE = Mental Status Examination, not MMSE
set_indices(
    2,
    {
        3: "치매 인구 증가 · 매일 정신상태검사(MSE) 수기 · 디지털 공백",
        21: "매일 같은 MSE를",
        22: "수기로 적는다",
    },
)

# Readiness: global expansion, not Japan-only
set_indices(
    9,
    {
        35: "결과는 가정 보급과 글로벌 진출의",
        38: "국내 실증 · 글로벌 진출",
    },
)

# Roadmap: 2027 = B2C + global; column 03 = global prep
set_indices(
    11,
    {
        30: "B2C 보급 · 글로벌",
        33: "국내 결과 기반 글로벌 진출",
        39: "B2C 보급 · 글로벌",
        55: "글로벌 준비",
        62: "다국어 ",
        63: "동의서 · 해외 보급 검토",
        64: "국내 실증 결과 반영",
        65: "글로벌 진출 채널 검토",
    },
)

# Team: keep 류다훈 as-is; restore 나현우 overseas experience as global, not Japan market
set_indices(
    12,
    {
        3: "AI 연구 · 의학 · 기계설계 · 글로벌",
        64: "해외 체류 ",
        65: "10",
        66: "년차",
        67: "글로벌 ",
        68: "현지화",
        69: " 경험",
    },
)

# Consent appendix: Korea + overseas (Japanese form as global-ready evidence)
set_indices(
    19,
    {
        3: "국내·해외에서 쓸 개인정보 동의서 제작 완료",
        5: "해외",
    },
)

print("clarification patches applied")
