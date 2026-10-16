from __future__ import annotations

from io import BytesIO
from pathlib import Path

from pypdf import PdfReader, PdfWriter
from reportlab.pdfgen import canvas


ROOT = Path(r"C:\project\saerok-memory")
OUTPUT_DIR = ROOT / "docs" / "patent" / "오가사LABs_2x2키오스크_특허출원_초안"
OUTPUT = OUTPUT_DIR / "오가사LABs_2x2키오스크_특허출원_검토본.pdf"


def add_centered_page_number(page, number: int) -> None:
    width = float(page.mediabox.width)
    height = float(page.mediabox.height)
    buffer = BytesIO()
    overlay = canvas.Canvas(buffer, pagesize=(width, height))
    overlay.setFillColorRGB(0, 0, 0)
    overlay.setFont("Helvetica", 10)
    overlay.drawCentredString(width / 2, 28, str(number))
    overlay.save()
    buffer.seek(0)
    page.merge_page(PdfReader(buffer).pages[0])


def main() -> None:
    writer = PdfWriter()

    # Form 14 was filled directly from the current official HWP template.
    application = PdfReader(str(OUTPUT_DIR / "01_특허출원서_초안.pdf"))
    writer.add_page(application.pages[0])

    for filename in (
        "02_명세서_청구범위.pdf",
        "03_요약서.pdf",
        "04_도면.pdf",
    ):
        attachment = PdfReader(str(OUTPUT_DIR / filename))
        for page_number, page in enumerate(attachment.pages, start=1):
            add_centered_page_number(page, page_number)
            writer.add_page(page)

    writer.add_metadata(
        {
            "/Title": "오가사 LABs 2×2 키오스크 특허출원 검토본",
            "/Author": "오가사 LABs",
            "/Subject": "검토용 초안 - 미제출",
            "/Creator": "Haru patent draft generator",
        }
    )
    with OUTPUT.open("wb") as file:
        writer.write(file)
    print(OUTPUT)


if __name__ == "__main__":
    main()
