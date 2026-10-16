# Template distillation contract

Reference: `C:\Users\mnb92\Downloads\Appendix1_Description of Information System Form.docx`

- SHA-256: `17FC25F1E0DC817700895066D8DAB18F9515B48FFD362FB617FCCEE70E00EFA5`
- Rendered reference: `C:\project\saerok-memory\.codex_tmp\docx-form\template-manual\page-1.png`
- Reference page count: 1
- Sections: 1, portrait, A4
- Reference evidence: `template-style-evidence.json`, `section_audit.py`, `style_lint.py`, `images_audit.py`

## Page system

- Page size: 8.27 x 11.69 in (A4), portrait.
- Margins: 0.79 in (2 cm) on all sides; gutter instruction is 1 cm but no gutter is encoded in the section.
- Header: 0.20 in distance; footer: 0.69 in distance. Header is not linked to previous; footer is linked to previous.
- One header part (`word/header1.xml`) contains the retained `word/media/image1.png` logo, 1.44 x 0.52 in. Preserve it.
- No footer part, tables, content controls, comments, or fields were found.

## Typography and paragraph roles

- Main body is Times New Roman, 12 pt (24 half-points) with the template's simple paragraph rhythm.
- Title paragraph uses the `Title` style but has direct Times New Roman formatting and is left aligned in the rendered template.
- Metadata uses the `Plain Text` style with a double horizontal paragraph border. Preserve this paragraph treatment for Application No., Title, University/Institution, and Department/Faculty.
- Section headings are `Normal` paragraphs with numbering definition `numId=2`, rendered as automatic Roman numerals I–VIII. Preserve these heading paragraphs and insert content after them.
- Remove the four instruction paragraphs before Application No. as explicitly requested by the template.

## Content flow and slot map

1. Retain title `Appendix1. Description of Information System`.
2. Remove template instruction paragraphs 1–4.
3. Preserve and fill metadata slots:
   - Application No.: retain committee placeholder.
   - Title of Information System: replace instruction text with the English Haru title.
   - University / Institution: fill with the team's English institution name.
   - Department / Faculty: fill with the Haru development team.
4. Preserve the eight numbered section heading paragraphs: Preface; Innovation Description; System Functions; System Features; System Development Tools and Techniques; System Users; System Environment; Conclusion.
5. Add concise English prose, figure captions, bordered technical-specification callouts, and team-owned presentation images after the corresponding headings.

## Package preservation and fidelity gates

- Work on a copy; never overwrite the retained reference.
- Preserve the header logo, section geometry, A4 page setup, metadata paragraph borders, heading numbering, styles, and untouched package parts.
- Final document must be no more than five pages, Times New Roman 12 pt body, portrait A4.
- Render every final page to PNG and inspect at full size. Check images, captions, callout borders, page breaks, table widths, clipping, and heading numbering.
