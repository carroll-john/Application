#!/usr/bin/env python3
"""Generate Maya Patel's uploadable Australian academic record for the UC demo."""

from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import (
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "output" / "pdf" / "Maya-Patel-Academic-Record.pdf"

INK = colors.HexColor("#16213A")
TEAL = colors.HexColor("#007A78")
BLUE = colors.HexColor("#24558F")
MUTED = colors.HexColor("#52647A")
LINE = colors.HexColor("#BDCAD8")
PALE = colors.HexColor("#EDF3F7")
WHITE = colors.white


def paragraph(text: str, style: ParagraphStyle) -> Paragraph:
    return Paragraph(text, style)


def section_heading(text: str, styles: dict[str, ParagraphStyle]) -> list:
    return [
        Spacer(1, 3.2 * mm),
        paragraph(text, styles["section"]),
        Spacer(1, 1.2 * mm),
    ]


def draw_footer(canvas, doc) -> None:
    canvas.saveState()
    width, _ = A4
    canvas.setStrokeColor(LINE)
    canvas.setLineWidth(0.6)
    canvas.line(doc.leftMargin, 16 * mm, width - doc.rightMargin, 16 * mm)
    canvas.setFillColor(MUTED)
    canvas.setFont("Helvetica", 7.5)
    canvas.drawRightString(width - doc.rightMargin, 11.5 * mm, f"Page {doc.page}")
    canvas.restoreState()


def build() -> Path:
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)

    sample = getSampleStyleSheet()
    styles = {
        "title": ParagraphStyle(
            "UniversityTitle",
            parent=sample["Title"],
            fontName="Times-Bold",
            fontSize=24,
            leading=27,
            textColor=INK,
            spaceAfter=2,
        ),
        "subtitle": ParagraphStyle(
            "Subtitle",
            parent=sample["Normal"],
            fontName="Helvetica-Bold",
            fontSize=10.5,
            leading=13,
            textColor=TEAL,
        ),
        "section": ParagraphStyle(
            "Section",
            parent=sample["Heading2"],
            fontName="Helvetica-Bold",
            fontSize=10.5,
            leading=13,
            textColor=BLUE,
            spaceAfter=0,
        ),
        "label": ParagraphStyle(
            "Label",
            parent=sample["Normal"],
            fontName="Helvetica",
            fontSize=7.8,
            leading=10,
            textColor=MUTED,
        ),
        "value": ParagraphStyle(
            "Value",
            parent=sample["Normal"],
            fontName="Helvetica",
            fontSize=9.4,
            leading=12,
            textColor=INK,
        ),
        "table_header": ParagraphStyle(
            "TableHeader",
            parent=sample["Normal"],
            fontName="Helvetica-Bold",
            fontSize=7.4,
            leading=9,
            textColor=WHITE,
        ),
        "table_body": ParagraphStyle(
            "TableBody",
            parent=sample["Normal"],
            fontName="Helvetica",
            fontSize=7.1,
            leading=9,
            textColor=MUTED,
        ),
        "note": ParagraphStyle(
            "Note",
            parent=sample["Normal"],
            fontName="Helvetica",
            fontSize=7,
            leading=9,
            textColor=MUTED,
        ),
        "end": ParagraphStyle(
            "End",
            parent=sample["Normal"],
            fontName="Helvetica-Bold",
            fontSize=9.2,
            leading=12,
            alignment=TA_CENTER,
            textColor=INK,
        ),
    }

    doc = SimpleDocTemplate(
        str(OUTPUT),
        pagesize=A4,
        leftMargin=17 * mm,
        rightMargin=17 * mm,
        topMargin=17 * mm,
        bottomMargin=23 * mm,
        title="Maya Patel - Transcript of Academic Record",
        author="RMIT University",
        subject="Academic record",
    )

    story = [
        paragraph("RMIT UNIVERSITY", styles["title"]),
        paragraph("Transcript of Academic Record", styles["subtitle"]),
    ]

    story.extend(section_heading("STUDENT DETAILS", styles))
    details = [
        [
            paragraph("Student name", styles["label"]),
            paragraph("Maya Patel", styles["value"]),
            paragraph("Student number", styles["label"]),
            paragraph("2024-1173", styles["value"]),
        ],
        [
            paragraph("Date issued", styles["label"]),
            paragraph("5 September 2025", styles["value"]),
            paragraph("Document reference", styles["label"]),
            paragraph("RMIT-2025-0001", styles["value"]),
        ],
        [
            paragraph("Academic area", styles["label"]),
            paragraph("College of Business and Law", styles["value"]),
            paragraph("Country of study", styles["label"]),
            paragraph("Australia", styles["value"]),
        ],
    ]
    details_table = Table(details, colWidths=[28 * mm, 62 * mm, 32 * mm, 54 * mm])
    details_table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), PALE),
                ("GRID", (0, 0), (-1, -1), 0.45, LINE),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("LEFTPADDING", (0, 0), (-1, -1), 5),
                ("RIGHTPADDING", (0, 0), (-1, -1), 5),
                ("TOPPADDING", (0, 0), (-1, -1), 6),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
            ]
        )
    )
    story.append(details_table)

    story.extend(section_heading("PROGRAM SUMMARY", styles))
    summary = [
        [
            paragraph("Program", styles["label"]),
            paragraph("Bachelor of Business (Management)", styles["value"]),
            paragraph("Status", styles["label"]),
            paragraph("Discontinued - no award conferred", styles["value"]),
        ],
        [
            paragraph("Commenced", styles["label"]),
            paragraph("26 February 2024", styles["value"]),
            paragraph("Discontinued", styles["label"]),
            paragraph("29 August 2025", styles["value"]),
        ],
        [
            paragraph("Course WAM", styles["label"]),
            paragraph("70.857", styles["value"]),
            paragraph("Credit points passed", styles["label"]),
            paragraph("84 of 288", styles["value"]),
        ],
    ]
    summary_table = Table(summary, colWidths=[29 * mm, 61 * mm, 34 * mm, 52 * mm])
    summary_table.setStyle(
        TableStyle(
            [
                ("GRID", (0, 0), (-1, -1), 0.45, LINE),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("LEFTPADDING", (0, 0), (-1, -1), 5),
                ("RIGHTPADDING", (0, 0), (-1, -1), 5),
                ("TOPPADDING", (0, 0), (-1, -1), 6),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
            ]
        )
    )
    story.append(summary_table)

    story.extend(section_heading("ACADEMIC RECORD", styles))
    rows = [
        ["Study period", "Code", "Subject title", "Credit", "Mark", "Grade"],
        ["S1 2024", "BUS101", "Business Foundations", "12", "71", "Credit"],
        ["S1 2024", "MGT102", "Organisational Behaviour", "12", "68", "Credit"],
        ["S2 2024", "LRN201", "Learning and Development at Work", "12", "74", "Distinction"],
        ["S2 2024", "PRJ202", "Project Management Fundamentals", "12", "69", "Credit"],
        ["S1 2025", "EDU301", "Educational Leadership and Change", "12", "77", "Distinction"],
        ["S1 2025", "ANA205", "Business Analytics for Decision Making", "12", "65", "Credit"],
        ["S2 2025", "COM208", "Digital Communication Strategy", "12", "72", "Credit"],
        ["S2 2025", "FIN210", "Financial Decision Making", "12", "", "Withdrawn"],
    ]
    record_data = []
    for row_index, row in enumerate(rows):
        style = styles["table_header"] if row_index == 0 else styles["table_body"]
        record_data.append([paragraph(cell or " ", style) for cell in row])

    record_table = Table(
        record_data,
        colWidths=[21 * mm, 17 * mm, 88 * mm, 14 * mm, 13 * mm, 23 * mm],
        repeatRows=1,
    )
    record_style = [
        ("BACKGROUND", (0, 0), (-1, 0), INK),
        ("GRID", (0, 0), (-1, -1), 0.4, LINE),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("LEFTPADDING", (0, 0), (-1, -1), 4),
        ("RIGHTPADDING", (0, 0), (-1, -1), 4),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ]
    for row_index in range(2, len(record_data), 2):
        record_style.append(("BACKGROUND", (0, row_index), (-1, row_index), PALE))
    record_table.setStyle(TableStyle(record_style))
    story.append(record_table)
    story.extend(
        [
            Spacer(1, 3.8 * mm),
            paragraph(
                "Result guide: Distinction 75-84; Credit 65-74; Pass 50-64; "
                "Fail below 50; Withdrawn is not counted in WAM. Course "
                "requirements were not completed and no qualification was awarded.",
                styles["note"],
            ),
            Spacer(1, 3 * mm),
            Table([[""]], colWidths=[176 * mm], rowHeights=[0.2 * mm], style=[("BACKGROUND", (0, 0), (-1, -1), LINE)]),
            Spacer(1, 2.5 * mm),
            paragraph("END OF ACADEMIC RECORD", styles["end"]),
        ]
    )

    doc.build(story, onFirstPage=draw_footer, onLaterPages=draw_footer)
    return OUTPUT


if __name__ == "__main__":
    print(build())
