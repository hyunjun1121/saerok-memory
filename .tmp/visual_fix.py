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


if __name__ == "__main__":
    set_indices(2, {25: "매일의 일기가 필요한데, ", 26: "아직 수기에 머물러 있습니다"})
    set_indices(3, {8: "치매환자 일기 · 보호자 안부 · 가정 보급 · 의료 상담"})
    set_indices(
        4,
        {
            44: "네 개 버튼으로 혼자 끝까지 수행",
            46: "일기 · 안부 · 의료 연결",
            50: "개인 기억 · 인지 문항",
        },
    )
    set_indices(5, {3: "전용 기기", 4: " ", 15: "전용 디바이스"})
    set_indices(6, {2: "친화적 설계"})
    set_indices(7, {57: "매일 42개 일기 문항"})
    set_indices(8, {4: "음성 기록 · 전자 일기 · 보호자 리포트", 11: "일기로 남김", 15: "개인화 문항"})
    set_indices(
        9,
        {
            18: "버튼 기반 친화 인터페이스",
            35: "결과는 가정 보급과",
            36: "글로벌 진출의 근거입니다.",
            38: "국내 실증과 글로벌 준비",
            39: "를 마쳤습니다",
        },
    )
    set_indices(10, {24: "왜 가정 보급이 가능한가", 35: "충청권 가정 보급 시작"})
    set_indices(11, {20: "개인화", 21: "CIST·MMSE 문항 강화", 23: "보호자 리포트 확인"})
    print("visual overflow fixes applied")
