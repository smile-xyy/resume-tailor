#!/usr/bin/env python3
"""Render one truth-preserving tailored Markdown resume to an ATS-friendly PDF."""

from __future__ import annotations

import argparse
import hashlib
import html
import json
import re
from pathlib import Path

from pypdf import PdfReader
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.cidfonts import UnicodeCIDFont
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import HRFlowable, Paragraph, SimpleDocTemplate, Spacer


def register_resume_font(font_path: str | None) -> str:
    if font_path and Path(font_path).is_file():
        pdfmetrics.registerFont(TTFont("ResumeUnicode", font_path))
        return "ResumeUnicode"
    pdfmetrics.registerFont(UnicodeCIDFont("STSong-Light"))
    return "STSong-Light"


def plain_inline(value: str) -> str:
    text = re.sub(r"<!--.*?-->", "", value)
    text = re.sub(r"!\[([^]]*)\]\([^)]+\)", r"\1", text)
    text = re.sub(r"\[([^]]+)\]\([^)]+\)", r"\1", text)
    text = text.replace("**", "").replace("__", "").replace("`", "")
    return html.escape(text.strip())


def build_styles(font_name: str):
    styles = getSampleStyleSheet()
    return {
        "h1": ParagraphStyle(
            "ResumeH1", parent=styles["Heading1"], fontName=font_name,
            fontSize=19, leading=23, textColor=colors.HexColor("#17211f"),
            alignment=TA_CENTER, spaceAfter=8 * mm, keepWithNext=True,
        ),
        "h2": ParagraphStyle(
            "ResumeH2", parent=styles["Heading2"], fontName=font_name,
            fontSize=12.5, leading=16, textColor=colors.HexColor("#0b5e58"),
            spaceBefore=5.2 * mm, spaceAfter=1.3 * mm, keepWithNext=True,
        ),
        "h3": ParagraphStyle(
            "ResumeH3", parent=styles["Heading3"], fontName=font_name,
            fontSize=10.6, leading=14, textColor=colors.HexColor("#17211f"),
            spaceBefore=3.2 * mm, spaceAfter=1.2 * mm, keepWithNext=True,
        ),
        "body": ParagraphStyle(
            "ResumeBody", parent=styles["BodyText"], fontName=font_name,
            fontSize=9.6, leading=14.2, textColor=colors.HexColor("#26312e"),
            alignment=TA_LEFT, spaceAfter=1.6 * mm, wordWrap="CJK",
        ),
        "bullet": ParagraphStyle(
            "ResumeBullet", parent=styles["BodyText"], fontName=font_name,
            fontSize=9.4, leading=14, textColor=colors.HexColor("#26312e"),
            leftIndent=4.5 * mm, firstLineIndent=-3.2 * mm,
            bulletIndent=0, spaceAfter=1.1 * mm, wordWrap="CJK",
        ),
        "footer": ParagraphStyle(
            "ResumeFooter", parent=styles["BodyText"], fontName=font_name,
            fontSize=7.2, leading=9, textColor=colors.HexColor("#78837f"),
            alignment=TA_CENTER,
        ),
    }


def markdown_story(markdown: str, styles: dict[str, ParagraphStyle]):
    story = []
    pending_blank = False
    for raw in markdown.splitlines():
        line = raw.strip()
        if not line:
            pending_blank = True
            continue
        if line.startswith("<!--") and line.endswith("-->"):
            continue
        heading = re.match(r"^(#{1,3})\s+(.+)$", line)
        bullet = re.match(r"^[-*+]\s+(.+)$", line)
        if pending_blank and story:
            story.append(Spacer(1, 0.7 * mm))
        pending_blank = False
        if heading:
            level = len(heading.group(1))
            story.append(Paragraph(plain_inline(heading.group(2)), styles[f"h{level}"]))
            if level == 2:
                story.append(HRFlowable(
                    width="100%", thickness=0.55, color=colors.HexColor("#cbd5d1"),
                    spaceBefore=0, spaceAfter=1.4 * mm,
                ))
        elif bullet:
            story.append(Paragraph(f"•&nbsp;&nbsp;{plain_inline(bullet.group(1))}", styles["bullet"]))
        else:
            story.append(Paragraph(plain_inline(line), styles["body"]))
    return story


def validate_pdf(output_path: Path) -> tuple[int, int]:
    reader = PdfReader(str(output_path))
    if reader.is_encrypted:
        raise ValueError("PDF must not be encrypted")
    if not reader.pages:
        raise ValueError("PDF has no pages")
    extracted = "\n".join(page.extract_text() or "" for page in reader.pages)
    visible_characters = len(re.sub(r"\s+", "", extracted))
    if visible_characters < 20:
        raise ValueError("PDF text extraction is empty or incomplete")
    return len(reader.pages), visible_characters


def render(input_path: Path, output_path: Path) -> dict:
    payload = json.loads(input_path.read_text(encoding="utf-8"))
    markdown = str(payload.get("markdown") or "")
    if not markdown.strip():
        raise ValueError("resume markdown is empty")
    font_name = register_resume_font(payload.get("font_path"))
    styles = build_styles(font_name)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    candidate = str(payload.get("candidate_name") or "候选人")
    company = str(payload.get("company") or "未知公司")
    role = str(payload.get("role") or "未知岗位")
    run_id = str(payload.get("run_id") or "")
    footer_text = f"定制岗位：{company} · {role}  |  {run_id}"

    doc = SimpleDocTemplate(
        str(output_path), pagesize=A4,
        rightMargin=16 * mm, leftMargin=16 * mm,
        topMargin=15 * mm, bottomMargin=16 * mm,
        title=f"{candidate} - {company} - {role}",
        author=candidate,
        subject="岗位定制简历",
        creator="Resume Tailor",
    )

    def page_footer(canvas, document):
        canvas.saveState()
        canvas.setStrokeColor(colors.HexColor("#e0e6e3"))
        canvas.setLineWidth(0.4)
        canvas.line(16 * mm, 10.5 * mm, A4[0] - 16 * mm, 10.5 * mm)
        canvas.setFont(font_name, 7.2)
        canvas.setFillColor(colors.HexColor("#78837f"))
        canvas.drawCentredString(A4[0] / 2, 6.5 * mm, f"{footer_text}  |  第 {document.page} 页")
        canvas.restoreState()

    doc.build(markdown_story(markdown, styles), onFirstPage=page_footer, onLaterPages=page_footer)
    page_count, extracted_characters = validate_pdf(output_path)
    digest = hashlib.sha256(output_path.read_bytes()).hexdigest()
    return {
        "page_count": page_count,
        "extracted_characters": extracted_characters,
        "sha256": digest,
        "font": font_name,
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True)
    parser.add_argument("--output", required=True)
    args = parser.parse_args()
    result = render(Path(args.input), Path(args.output))
    print(json.dumps(result, ensure_ascii=False))


if __name__ == "__main__":
    main()
