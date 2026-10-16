from __future__ import annotations

import os
import shutil
from pathlib import Path

from docx import Document
from docx.enum.section import WD_ORIENT
from docx.enum.table import WD_CELL_VERTICAL_ALIGNMENT, WD_TABLE_ALIGNMENT
from docx.enum.text import WD_ALIGN_PARAGRAPH, WD_BREAK
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Cm, Inches, Pt, RGBColor
from docx.table import Table
from docx.text.paragraph import Paragraph


ROOT = Path(r"C:\project\saerok-memory")
TEMPLATE = Path(r"C:\Users\mnb92\Downloads\Appendix1_Description of Information System Form.docx")
OUT = ROOT / r"피우다프로젝트\발표자료\Appendix1_Description_of_Information_System_Haru.docx"
STT_FIGURE = ROOT / r"피우다프로젝트\발표자료\Existing_STT_architecture_figure_EN.png"
ASSET_DIR = ROOT / r".codex_tmp\docx-form\ppt-assets\e5"
SLIDE_DIR = ROOT / r".codex_tmp\ppt-read"

ACCENT = "D95F4F"
ACCENT_DARK = "9E3F35"
PALE = "FFF6F1"
PALE_BLUE = "F2F6FA"
INK = "1F1F1F"
MUTED = "666666"


def set_run_font(run, size=12, bold=None, color=INK, italic=None):
    run.font.name = "Times New Roman"
    run._element.get_or_add_rPr().rFonts.set(qn("w:ascii"), "Times New Roman")
    run._element.get_or_add_rPr().rFonts.set(qn("w:hAnsi"), "Times New Roman")
    run._element.get_or_add_rPr().rFonts.set(qn("w:eastAsia"), "Times New Roman")
    run.font.size = Pt(size)
    if bold is not None:
        run.bold = bold
    if italic is not None:
        run.italic = italic
    if color:
        run.font.color.rgb = RGBColor.from_string(color)


def set_paragraph_compact(paragraph, before=0, after=3, line=1.0, alignment=None):
    fmt = paragraph.paragraph_format
    fmt.space_before = Pt(before)
    fmt.space_after = Pt(after)
    fmt.line_spacing = line
    if alignment is not None:
        paragraph.alignment = alignment


def clear_runs(paragraph):
    for run in list(paragraph.runs):
        paragraph._p.remove(run._r)


def set_paragraph_text(paragraph, text, size=12, bold=False, color=INK, after=3, alignment=None):
    clear_runs(paragraph)
    run = paragraph.add_run(text)
    set_run_font(run, size=size, bold=bold, color=color)
    set_paragraph_compact(paragraph, after=after, alignment=alignment)
    return paragraph


def append_rich(paragraph, pieces, after=3, alignment=None):
    clear_runs(paragraph)
    for text, kwargs in pieces:
        run = paragraph.add_run(text)
        set_run_font(run, **kwargs)
    set_paragraph_compact(paragraph, after=after, alignment=alignment)
    return paragraph


def insert_paragraph_after(paragraph, style="Normal"):
    new_p = OxmlElement("w:p")
    paragraph._p.addnext(new_p)
    new_para = Paragraph(new_p, paragraph._parent)
    new_para.style = style
    return new_para


def insert_page_break_after(paragraph):
    new_para = insert_paragraph_after(paragraph)
    new_para.paragraph_format.space_before = Pt(0)
    new_para.paragraph_format.space_after = Pt(0)
    new_para.add_run().add_break(WD_BREAK.PAGE)
    return new_para


def insert_table_after(paragraph, rows, cols):
    # add_table is the most reliable way to initialize Word table properties.
    table = paragraph._parent.add_table(rows=rows, cols=cols, width=Inches(6.55))
    body = paragraph._parent._element
    body.remove(table._tbl)
    paragraph._p.addnext(table._tbl)
    table.alignment = WD_TABLE_ALIGNMENT.CENTER
    table.autofit = False
    return table


def insert_paragraph_after_table(table):
    new_p = OxmlElement("w:p")
    table._tbl.addnext(new_p)
    paragraph = Paragraph(new_p, table._parent)
    paragraph.style = "Normal"
    return paragraph


def set_cell_shading(cell, fill):
    tc_pr = cell._tc.get_or_add_tcPr()
    shd = tc_pr.find(qn("w:shd"))
    if shd is None:
        shd = OxmlElement("w:shd")
        tc_pr.append(shd)
    shd.set(qn("w:fill"), fill)


def set_cell_border(cell, color=ACCENT, size="10", val="single"):
    tc = cell._tc
    tc_pr = tc.get_or_add_tcPr()
    borders = tc_pr.first_child_found_in("w:tcBorders")
    if borders is None:
        borders = OxmlElement("w:tcBorders")
        tc_pr.append(borders)
    for edge in ("top", "left", "bottom", "right", "insideH", "insideV"):
        tag = "w:" + edge
        element = borders.find(qn(tag))
        if element is None:
            element = OxmlElement(tag)
            borders.append(element)
        element.set(qn("w:val"), val)
        element.set(qn("w:sz"), size)
        element.set(qn("w:space"), "0")
        element.set(qn("w:color"), color)


def set_cell_margins(cell, top=100, start=140, bottom=100, end=140):
    tc = cell._tc
    tc_pr = tc.get_or_add_tcPr()
    tc_mar = tc_pr.first_child_found_in("w:tcMar")
    if tc_mar is None:
        tc_mar = OxmlElement("w:tcMar")
        tc_pr.append(tc_mar)
    for m, v in (("top", top), ("start", start), ("bottom", bottom), ("end", end)):
        node = tc_mar.find(qn("w:" + m))
        if node is None:
            node = OxmlElement("w:" + m)
            tc_mar.append(node)
        node.set(qn("w:w"), str(v))
        node.set(qn("w:type"), "dxa")


def set_table_width(table, widths_in):
    table.autofit = False
    tbl_pr = table._tbl.tblPr
    tbl_w = tbl_pr.first_child_found_in("w:tblW")
    if tbl_w is None:
        tbl_w = OxmlElement("w:tblW")
        tbl_pr.insert(0, tbl_w)
    total = int(round(sum(widths_in) * 1440))
    tbl_w.set(qn("w:w"), str(total))
    tbl_w.set(qn("w:type"), "dxa")
    grid = table._tbl.tblGrid
    for child in list(grid):
        grid.remove(child)
    for w in widths_in:
        col = OxmlElement("w:gridCol")
        col.set(qn("w:w"), str(int(round(w * 1440))))
        grid.append(col)
    for row in table.rows:
        for idx, cell in enumerate(row.cells):
            cell.width = Inches(widths_in[idx])
            tc_pr = cell._tc.get_or_add_tcPr()
            tc_w = tc_pr.first_child_found_in("w:tcW")
            if tc_w is None:
                tc_w = OxmlElement("w:tcW")
                tc_pr.append(tc_w)
            tc_w.set(qn("w:w"), str(int(round(widths_in[idx] * 1440))))
            tc_w.set(qn("w:type"), "dxa")


def remove_table_borders(table):
    for row in table.rows:
        for cell in row.cells:
            set_cell_border(cell, color="FFFFFF", size="0", val="nil")


def add_caption(cell, text):
    p = cell.add_paragraph()
    set_paragraph_text(p, text, size=10, color=MUTED, after=0, alignment=WD_ALIGN_PARAGRAPH.CENTER)
    return p


def add_image_to_cell(cell, path, width_in, alt_text):
    p = cell.paragraphs[0]
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p.paragraph_format.space_before = Pt(0)
    p.paragraph_format.space_after = Pt(2)
    run = p.add_run()
    run.add_picture(str(path), width=Inches(width_in))
    # Add a descriptive alt text to the drawing's docPr.
    drawing = p._p.xpath(".//wp:docPr")
    if drawing:
        drawing[0].set("descr", alt_text)
        drawing[0].set("title", alt_text)


def add_figure_gallery(anchor, items, captions):
    table = insert_table_after(anchor, 1, len(items))
    widths = [6.55 / len(items)] * len(items)
    set_table_width(table, widths)
    for idx, (path, width_in, alt) in enumerate(items):
        cell = table.cell(0, idx)
        cell.vertical_alignment = WD_CELL_VERTICAL_ALIGNMENT.CENTER
        set_cell_margins(cell, top=70, start=70, bottom=50, end=70)
        set_cell_border(cell, color="D9D9D9", size="8")
        set_cell_shading(cell, "FFFFFF")
        add_image_to_cell(cell, path, width_in, alt)
        add_caption(cell, captions[idx])
    return insert_paragraph_after_table(table)


def add_body_after(anchor, text, before=0, after=3, color=INK):
    p = insert_paragraph_after(anchor)
    set_paragraph_text(p, text, size=12, color=color, after=after)
    p.paragraph_format.space_before = Pt(before)
    return p


def add_lead_after(anchor, lead, body, after=3):
    p = insert_paragraph_after(anchor)
    append_rich(
        p,
        [(lead, {"size": 12, "bold": True, "color": ACCENT_DARK}), (body, {"size": 12, "color": INK})],
        after=after,
    )
    return p


def add_callout_after(anchor, title, body, fill=PALE, border=ACCENT, title_size=11.5, body_size=10.8):
    table = insert_table_after(anchor, 1, 1)
    set_table_width(table, [6.55])
    cell = table.cell(0, 0)
    cell.vertical_alignment = WD_CELL_VERTICAL_ALIGNMENT.CENTER
    set_cell_margins(cell, top=120, start=150, bottom=120, end=150)
    set_cell_border(cell, color=border, size="12")
    set_cell_shading(cell, fill)
    p = cell.paragraphs[0]
    append_rich(p, [(title, {"size": title_size, "bold": True, "color": ACCENT_DARK})], after=2)
    p2 = cell.add_paragraph()
    set_paragraph_text(p2, body, size=body_size, color=INK, after=0)
    return insert_paragraph_after_table(table)


def add_pipeline_table_after(anchor, steps, fill=PALE_BLUE):
    cols = len(steps) * 2 - 1
    table = insert_table_after(anchor, 1, cols)
    widths = []
    for idx in range(cols):
        widths.append(0.36 if idx % 2 else 6.55 / (len(steps) + (len(steps) - 1) * 0.22))
    # Normalize to the usable width while keeping arrows narrow.
    arrow_total = 0.34 * (len(steps) - 1)
    step_w = (6.55 - arrow_total) / len(steps)
    widths = [step_w if idx % 2 == 0 else 0.34 for idx in range(cols)]
    set_table_width(table, widths)
    for idx, step in enumerate(steps):
        cell = table.cell(0, idx * 2)
        set_cell_margins(cell, top=100, start=70, bottom=100, end=70)
        set_cell_border(cell, color="B7C8D7", size="8")
        set_cell_shading(cell, fill)
        p = cell.paragraphs[0]
        set_paragraph_text(p, step, size=11, bold=True, color=INK, after=0, alignment=WD_ALIGN_PARAGRAPH.CENTER)
        if idx < len(steps) - 1:
            arrow = table.cell(0, idx * 2 + 1)
            set_cell_margins(arrow, top=40, start=20, bottom=40, end=20)
            set_cell_border(arrow, color="FFFFFF", size="0", val="nil")
            set_cell_shading(arrow, "FFFFFF")
            p_arrow = arrow.paragraphs[0]
            set_paragraph_text(p_arrow, "→", size=14, bold=True, color=ACCENT_DARK, after=0, alignment=WD_ALIGN_PARAGRAPH.CENTER)
    return insert_paragraph_after_table(table)


def add_role_table_after(anchor):
    rows = [
        ("Older adult", "Taps an NFC card, completes six activities, and answers by voice or button."),
        ("Welfare-center staff", "Registers consent and the pseudonymous card ID, then checks participation."),
        ("Caregiver", "Views consented check-in and conversation cues, not a clinical score."),
        ("Counselor / clinician", "Reviews summarized observations to prepare a professional conversation."),
    ]
    table = insert_table_after(anchor, len(rows) + 1, 2)
    set_table_width(table, [1.75, 4.80])
    headers = ["User", "Primary use"]
    for idx, text in enumerate(headers):
        cell = table.cell(0, idx)
        set_cell_margins(cell, top=90, start=110, bottom=90, end=110)
        set_cell_border(cell, color=ACCENT, size="10")
        set_cell_shading(cell, PALE)
        set_paragraph_text(cell.paragraphs[0], text, size=12, bold=True, color=ACCENT_DARK, after=0)
    for ridx, (role, detail) in enumerate(rows, start=1):
        for cidx, value in enumerate((role, detail)):
            cell = table.cell(ridx, cidx)
            set_cell_margins(cell, top=85, start=110, bottom=85, end=110)
            set_cell_border(cell, color="CFCFCF", size="8")
            set_cell_shading(cell, "FFFFFF")
            set_paragraph_text(cell.paragraphs[0], value, size=11, bold=(cidx == 0), color=INK, after=0)
    return insert_paragraph_after_table(table)


def add_environment_table_after(anchor):
    rows = [
        ("Hardware", "Raspberry Pi, portrait display, four 2×2 buttons, NFC reader, microphone, speaker, and enclosure."),
        ("Client software", "A large-text kiosk web client for one-person, click-first operation; Korean and Japanese are supported."),
        ("Data path", "The card supplies a pseudonymous ID. Responses, transcripts, and consent-scoped summaries stay separate from names."),
        ("Operating site", "Staff register cards and participants; the older adult starts by tapping the card at the installed kiosk."),
    ]
    table = insert_table_after(anchor, len(rows) + 1, 2)
    set_table_width(table, [1.45, 5.10])
    for idx, text in enumerate(("Layer", "Description")):
        cell = table.cell(0, idx)
        set_cell_margins(cell, top=90, start=110, bottom=90, end=110)
        set_cell_border(cell, color=ACCENT, size="10")
        set_cell_shading(cell, PALE)
        set_paragraph_text(cell.paragraphs[0], text, size=12, bold=True, color=ACCENT_DARK, after=0)
    for ridx, (layer, detail) in enumerate(rows, start=1):
        for cidx, value in enumerate((layer, detail)):
            cell = table.cell(ridx, cidx)
            set_cell_margins(cell, top=85, start=110, bottom=85, end=110)
            set_cell_border(cell, color="CFCFCF", size="8")
            set_cell_shading(cell, "FFFFFF")
            set_paragraph_text(cell.paragraphs[0], value, size=11, bold=(cidx == 0), color=INK, after=0)
    return insert_paragraph_after_table(table)


def find_paragraph(doc, text):
    for paragraph in doc.paragraphs:
        if paragraph.text.strip() == text:
            return paragraph
    raise ValueError(f"Paragraph not found: {text}")


def remove_paragraph(paragraph):
    paragraph._element.getparent().remove(paragraph._element)


def configure_styles(doc):
    for name in ("Normal", "Plain Text"):
        style = doc.styles[name]
        style.font.name = "Times New Roman"
        style._element.get_or_add_rPr().rFonts.set(qn("w:ascii"), "Times New Roman")
        style._element.get_or_add_rPr().rFonts.set(qn("w:hAnsi"), "Times New Roman")
        style._element.get_or_add_rPr().rFonts.set(qn("w:eastAsia"), "Times New Roman")
        style.font.size = Pt(12)
    for section in doc.sections:
        section.orientation = WD_ORIENT.PORTRAIT
        section.page_width = Cm(21.0)
        section.page_height = Cm(29.7)
        section.top_margin = Cm(2.0)
        section.bottom_margin = Cm(2.0)
        section.left_margin = Cm(2.0)
        section.right_margin = Cm(2.0)


def main():
    OUT.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(TEMPLATE, OUT)
    doc = Document(OUT)
    configure_styles(doc)

    # Remove only the four submission instructions; the title, metadata rows,
    # section numbering, and retained header logo stay template-derived.
    instruction_prefixes = (
        "The Description must not exceed",
        "Margins:",
        "Please do not alter",
        "Description must contain",
    )
    for paragraph in list(doc.paragraphs):
        if paragraph.text.strip().startswith(instruction_prefixes):
            remove_paragraph(paragraph)

    # Remove the two trailing blank template paragraphs.
    for paragraph in list(doc.paragraphs):
        if not paragraph.text.strip() and paragraph._p.getparent() is not None:
            # Keep the intentional spacer immediately before the first section.
            if paragraph is not doc.paragraphs[-1] and paragraph is not doc.paragraphs[-2]:
                continue
            remove_paragraph(paragraph)

    # Fill metadata while preserving the template's paragraph borders.
    app_p = find_paragraph(doc, "Application No.: (To be filled in by Contest Committee)")
    append_rich(
        app_p,
        [("Application No.: ", {"size": 12, "color": INK}), ("(To be filled in by Contest Committee)", {"size": 12, "color": "FF0000"})],
        after=0,
    )
    title_p = next(p for p in doc.paragraphs if p.text.startswith("Title of Information System:"))
    append_rich(
        title_p,
        [
            ("Title of Information System: ", {"size": 12, "color": INK}),
            ("Haru: A Daily Cognitive Routine Kiosk with Speech Recognition and Memory-Grounded Personalization", {"size": 12, "color": INK}),
        ],
        after=0,
    )
    inst_p = find_paragraph(doc, "University / Institution:")
    set_paragraph_text(inst_p, "University / Institution: Institute for Universal Education", size=12, after=0)
    dept_p = find_paragraph(doc, "Department / Faculty:")
    set_paragraph_text(dept_p, "Department / Faculty: Haru Development Team", size=12, after=0)

    # Keep automatic Roman-numbered section headings from the form.
    headings = {name: find_paragraph(doc, name) for name in (
        "Preface",
        "Innovation Description",
        "System Functions",
        "System Features",
        "System Development Tools and Techniques",
        "System Users",
        "System Environment",
        "Conclusion",
    )}
    for p in headings.values():
        p.paragraph_format.keep_with_next = True
        for run in p.runs:
            set_run_font(run, size=12, bold=False, color=INK)

    # I. Preface
    cursor = headings["Preface"]
    cursor = add_body_after(
        cursor,
        "Haru is an institution-installed daily cognitive routine for adults aged 65 and above. It addresses the gap between occasional phone calls and repeated care observation: older adults may struggle with small smartphone screens, while institutions cannot collect the same structured record every day. Haru offers a calm three-to-five-minute routine that supports conversation and professional follow-up; it is not a diagnostic device.",
        after=3,
    )

    # II. Innovation Description
    cursor = headings["Innovation Description"]
    cursor = add_body_after(
        cursor,
        "Haru combines an accessible 2×2 physical-button kiosk, speech-to-text recording, and memory-grounded question personalization. Its innovation is a closed loop: an easy daily interaction becomes a structured personal record and then a relevant next-day question.",
        after=3,
    )
    cursor = add_pipeline_table_after(cursor, ["Accessible routine", "Voice / button record", "Related memory retrieval", "Next-day prompt", "Support report"])
    cursor = add_body_after(
        cursor,
        "Screen positions and button positions correspond. The first press selects an answer and the same button pressed again confirms it, so participants do not need to memorize button labels or learn a separate cancel flow.",
        after=2,
    )
    cursor = add_figure_gallery(
        cursor,
        [
            (ASSET_DIR / "image6.png", 1.28, "Front view of the Haru physical kiosk prototype"),
            (ASSET_DIR / "image9.jpeg", 0.94, "Hand interaction with the four-button prototype"),
        ],
        ["Physical prototype", "Button interaction"],
    )
    cursor = add_body_after(cursor, "Figure 1. Team prototype photographs reproduced from the E5 presentation materials.", color=MUTED, after=0)
    # Natural pagination keeps the description within the five-page form limit.

    # III. System Functions
    cursor = headings["System Functions"]
    cursor = add_lead_after(cursor, "Participant access. ", "An NFC tap opens the routine with a pseudonymous card ID; the device does not display the participant's name.")
    cursor = add_lead_after(cursor, "Routine and speech. ", "Six short activities run once per day across a 42-activity, seven-day structure. Voice prompts and recordings are transcribed by STT; a retry path keeps recognition failure from blocking completion.")
    cursor = add_lead_after(cursor, "Personalized prompt. ", "Past responses are stored with dates and extracted cues. Related memories are retrieved to ground a follow-up question instead of selecting one at random.")
    cursor = add_lead_after(cursor, "Role-based report. ", "Participants see their routine result; caregivers see consented conversation cues; welfare staff manage registration and participation; counselors or clinicians review summarized observations.")
    cursor = add_figure_gallery(
        cursor,
        [(ASSET_DIR / "image7.png", 4.35, "Sequence of Haru routine, voice, result, and report screens")],
        ["Routine-to-report screen sequence"],
    )
    cursor = add_body_after(cursor, "Figure 2. User-facing screens reproduced from the E5 presentation materials.", color=MUTED, after=0)

    # IV. System Features
    cursor = headings["System Features"]
    cursor = add_lead_after(cursor, "Accessibility and recovery. ", "Large type, high contrast, four large touch targets, spoken guidance, and spatially matched buttons reduce visual and menu burden. Separate selection and confirmation make mistakes recoverable; speech can be retried without cancelling the session.")
    cursor = add_lead_after(cursor, "Grounded personalization. ", "Each generated prompt is constrained by a retrieved personal-memory record with a date and topic, so the source of the prompt can be explained rather than hidden behind a random question.")
    cursor = add_lead_after(cursor, "Privacy and safety. ", "Names stay with the registering institution. The kiosk uses a pseudonymous ID, consent scopes, role-based access, and deletion or withdrawal procedures. Reports describe supportive changes, not a diagnosis or clinical score.")
    cursor = add_lead_after(cursor, "Validation readiness. ", "A formative 20-person beta test drove the kiosk redesign. A separate IRB study will test independent target-age participants in Korea and Japan.")
    # Natural pagination keeps the description within the five-page form limit.

    # V. System Development Tools and Techniques
    cursor = headings["System Development Tools and Techniques"]
    cursor = add_body_after(
        cursor,
        "The system uses a browser kiosk client and a speech-and-memory pipeline. The client presents the routine and records events; the services return structured evidence for reports and future prompts.",
        after=2,
    )
    cursor = add_pipeline_table_after(cursor, ["Audio + consent", "DPO-adapted STT", "Structured memory", "Vector retrieval", "Grounded question"])
    cursor = add_body_after(
        cursor,
        "Speech recognition adaptation. The prototype starts from the open-source Qwen/Qwen3-ASR-1.7B checkpoint. Consent-scoped recordings from the 20-person formative beta test form the Haru speech-adaptation corpus. Each utterance is converted to 16 kHz mono, segmented around speech, and de-identified; the research team verifies a reference transcript while retaining the original audio and annotation version.",
        after=2,
    )
    cursor = add_body_after(
        cursor,
        "Direct Preference Optimization (DPO). For the same audio x, the research-team-verified transcript y+ is the preferred response and the unedited base-model transcript y− is the rejected response. We optimize the ASR policy against a frozen reference policy: L_DPO = −log σ(β[(log πθ(y+|x) − log πref(y+|x)) − (log πθ(y−|x) − log πref(y−|x))]). This increases preference for faithful wording and decreases omissions, insertions, and unsupported words without training a separate reward model. Speaker-disjoint validation is required to prevent participant leakage. FLEURS context: Qwen3-ASR versus Whisper large-v3 CER was 2.96% versus 3.01% for Korean and 5.28% versus 5.56% for Japanese; these are benchmark references, not clinical validation of Haru.",
        after=2,
    )
    cursor = add_figure_gallery(
        cursor,
        [(STT_FIGURE, 4.35, "English STT architecture figure for Korean senior speech")],
        ["English STT architecture figure"],
    )
    cursor = add_callout_after(
        cursor,
        "Technical figure specification — STT fine-tuning and DPO (update the architecture figure)",
        "Keep the microphone, waveform, four-quadrant architecture, and timeline. Add a left-to-right training inset: 20-speaker consented beta audio → 16 kHz preprocessing → base Qwen/Qwen3-ASR-1.7B candidate (y−) alongside the research-team-verified transcript (y+) → DPO policy update with a frozen reference policy → speaker-disjoint evaluation. Label the pair (x, y+, y−), show the DPO loss above, and report CER/WER, omission/insertion/substitution counts, latency, and transcript acceptability. Keep the Korean/Japanese FLEURS values as external benchmark context.",
    )
    cursor = add_callout_after(
        cursor,
        "Technical figure specification — RAG personalization (extend the existing conceptual flow)",
        "Extend story record → memory store → related-memory search → new question with two explicit open-source model blocks. Qwen/Qwen3-8B extracts a strict JSON record from each consented transcript: date, people, place, event, object, emotion, cue, sensitivity, sourceTranscript, and consentScope. BAAI/bge-m3 creates a multilingual embedding; a participant-scoped FAISS/vector index stores the embedding with a pseudonymous user ID and source-record ID. At generation time, filter by consent and participant, retrieve top-k records, and pass only those records plus a short template to Qwen/Qwen3-8B. Write the question with source-memory IDs and a model/version stamp. Add: “I ate out with my daughter yesterday” → “What did you have when you ate out with your daughter?” Keep personal data and generated text in separate colors.",
        fill="F4F8FC",
        border="7A9BB8",
    )
    # The concrete example is included in the RAG figure specification box.

    # VI. System Users
    cursor = headings["System Users"]
    cursor = add_body_after(cursor, "The system separates the learner-facing experience from the support-facing views. Access is scoped to the role and to the consent recorded by the registering institution.", after=3)
    cursor = add_role_table_after(cursor)
    cursor = add_body_after(cursor, "The 20-person beta test is formative usability evidence. The IRB study will test independent participants, consent, speech performance, completion burden, and report usefulness.", color=MUTED, after=0)

    # VII. System Environment
    cursor = headings["System Environment"]
    cursor = add_environment_table_after(cursor)
    cursor = add_figure_gallery(
        cursor,
        [(ASSET_DIR / "image33.png", 2.25, "Prototype enclosure drawing used for fabrication")],
        ["Prototype fabrication drawing"],
    )
    cursor = add_body_after(cursor, "Figure 3. Prototype fabrication drawing reproduced from the E5 presentation materials.", color=MUTED, after=0)
    # Natural pagination keeps the description within the five-page form limit.

    # VIII. Conclusion
    cursor = headings["Conclusion"]
    cursor = add_body_after(
        cursor,
        "Haru closes a practical care loop: a low-friction physical interaction makes daily participation possible; STT turns spoken answers into searchable records; RAG uses those records to create relevant next-day prompts; and consent-scoped summaries give families and care professionals material for a conversation. The prototype, NFC flow, bilingual interface, report path, and formative usability changes are implemented.",
        after=4,
    )
    cursor = add_body_after(
        cursor,
        "The next step is field validation, not a clinical claim: the team will complete the IRB process, run the Korea and Japan studies, measure independent completion, time, speech-recognition success, repeat-use intention, and report usefulness, and then refine the product. Any final technical figure should be checked against the running data pipeline, especially the exact embedding/index implementation and the verified status of the selected ASR model.",
        after=4,
    )
    cursor = add_callout_after(
        cursor,
        "Submission note",
        "All photographs, screenshots, diagrams, and prototype drawings in this description are team-owned assets reproduced from the supplied Haru presentation materials. The system is presented as a supportive routine and observation aid, not as a substitute for professional diagnosis.",
        fill="F7F7F7",
        border="A0A0A0",
    )

    # Make every remaining normal paragraph explicitly Times New Roman 12 pt.
    for paragraph in doc.paragraphs:
        for run in paragraph.runs:
            if run.text:
                if run.font.size is None:
                    set_run_font(run, size=12, color=INK)
                else:
                    run.font.name = "Times New Roman"
                    run._element.get_or_add_rPr().rFonts.set(qn("w:ascii"), "Times New Roman")
                    run._element.get_or_add_rPr().rFonts.set(qn("w:hAnsi"), "Times New Roman")
                    run._element.get_or_add_rPr().rFonts.set(qn("w:eastAsia"), "Times New Roman")

    doc.save(OUT)
    print(OUT)


if __name__ == "__main__":
    main()
