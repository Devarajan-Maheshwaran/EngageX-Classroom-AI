"""
pdf_service.py — Phase 14

Generates a per-student PDF report using ReportLab.

Layout:
  Page 1  — Header (EngageX logo text, session info, student name)
           — Metrics table (avg/peak/min engagement, participation, quiz accuracy, alerts)
           — Engagement timeline table (last 30 data points)
  Page 2  — Quiz results table
           — Key behaviors
           — AI narrative + recommendations

Returns bytes (PDF in memory) for streaming.
"""

import io
import logging
from datetime import datetime
from agents.report_crew import StudentReportData

logger = logging.getLogger('engagex.pdf')

try:
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.styles    import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib.units     import cm
    from reportlab.lib           import colors
    from reportlab.platypus      import (
        SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable
    )
    REPORTLAB_AVAILABLE = True
except ImportError:
    REPORTLAB_AVAILABLE = False
    logger.warning('reportlab not installed — PDF generation unavailable')


def _score_color(score: float | None):
    if score is None:
        return colors.grey
    if score >= 65:
        return colors.HexColor('#22c55e')   # green
    if score >= 40:
        return colors.HexColor('#f59e0b')   # amber
    return colors.HexColor('#ef4444')       # red


def generate_pdf(report: StudentReportData, session_title: str = 'EngageX Session') -> bytes:
    if not REPORTLAB_AVAILABLE:
        raise RuntimeError('reportlab is not installed. Run: pip install reportlab')

    buf    = io.BytesIO()
    doc    = SimpleDocTemplate(
        buf, pagesize=A4,
        leftMargin=2*cm, rightMargin=2*cm,
        topMargin=2*cm,  bottomMargin=2*cm,
    )
    styles = getSampleStyleSheet()
    W      = A4[0] - 4*cm

    # Custom styles
    title_style = ParagraphStyle('Title2', parent=styles['Title'],  fontSize=18, spaceAfter=4)
    h2_style    = ParagraphStyle('H2',     parent=styles['Heading2'], fontSize=12, spaceAfter=4, spaceBefore=12)
    body_style  = ParagraphStyle('Body2',  parent=styles['Normal'],  fontSize=10, leading=14)
    small_style = ParagraphStyle('Small',  parent=styles['Normal'],  fontSize=8,  leading=12, textColor=colors.grey)

    story = []

    # ── Header ──────────────────────────────────────────────────────────────
    story.append(Paragraph('EngageX', title_style))
    story.append(Paragraph(f'Student Engagement Report — {session_title}', styles['Heading3']))
    story.append(Paragraph(
        f'Generated: {datetime.utcnow().strftime("%Y-%m-%d %H:%M UTC")}',
        small_style,
    ))
    story.append(Spacer(1, 0.3*cm))
    story.append(HRFlowable(width=W, thickness=1, color=colors.HexColor('#e5e7eb')))
    story.append(Spacer(1, 0.4*cm))

    story.append(Paragraph(report.student_name or report.student_id[:12], styles['Heading1']))
    story.append(Paragraph(f'Student ID: {report.student_id}', small_style))
    story.append(Spacer(1, 0.5*cm))

    # ── Metrics table ────────────────────────────────────────────────────────
    story.append(Paragraph('Session Metrics', h2_style))

    def fmt(v, suffix=''):
        return f'{v}{suffix}' if v is not None else '—'

    metrics_data = [
        ['Metric', 'Value'],
        ['Average engagement',    fmt(report.avg_engagement,    '/100')],
        ['Peak engagement',       fmt(report.peak_engagement,   '/100')],
        ['Min engagement',        fmt(report.min_engagement,    '/100')],
        ['Participation rate',    fmt(round((report.participation_rate or 0)*100), '%')],
        ['Quiz accuracy',         fmt(report.quiz_accuracy,     '%') if report.quiz_accuracy is not None else '—'],
        ['Quiz attempts',         str(report.quiz_attempts)],
        ['Alerts (watch)',        str(report.alerts_watch)],
        ['Alerts (intervene)',    str(report.alerts_intervene)],
        ['Dominant signal',       report.dominant_signal],
    ]
    mt = Table(metrics_data, colWidths=[W*0.55, W*0.45])
    mt.setStyle(TableStyle([
        ('BACKGROUND',  (0,0), (-1,0), colors.HexColor('#6366f1')),
        ('TEXTCOLOR',   (0,0), (-1,0), colors.white),
        ('FONTNAME',    (0,0), (-1,0), 'Helvetica-Bold'),
        ('FONTSIZE',    (0,0), (-1,-1), 10),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, colors.HexColor('#f9fafb')]),
        ('GRID',        (0,0), (-1,-1), 0.5, colors.HexColor('#e5e7eb')),
        ('LEFTPADDING',  (0,0), (-1,-1), 8),
        ('RIGHTPADDING', (0,0), (-1,-1), 8),
        ('TOPPADDING',   (0,0), (-1,-1), 5),
        ('BOTTOMPADDING',(0,0), (-1,-1), 5),
    ]))
    story.append(mt)
    story.append(Spacer(1, 0.5*cm))

    # ── Timeline table ───────────────────────────────────────────────────────
    if report.timeline:
        story.append(Paragraph('Engagement Timeline (last 30 points)', h2_style))
        tl_data = [['#', 'Time', 'Score']]
        for i, pt in enumerate(report.timeline, 1):
            raw_t  = str(pt.get('t', ''))[:19].replace('T', ' ')
            score  = pt.get('score', 0)
            tl_data.append([str(i), raw_t, f'{score:.1f}'])
        tl = Table(tl_data, colWidths=[W*0.08, W*0.60, W*0.32])
        tl.setStyle(TableStyle([
            ('BACKGROUND',  (0,0), (-1,0), colors.HexColor('#f3f4f6')),
            ('FONTNAME',    (0,0), (-1,0), 'Helvetica-Bold'),
            ('FONTSIZE',    (0,0), (-1,-1), 8),
            ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, colors.HexColor('#fafafa')]),
            ('GRID',        (0,0), (-1,-1), 0.3, colors.HexColor('#e5e7eb')),
            ('LEFTPADDING',  (0,0), (-1,-1), 6),
            ('TOPPADDING',   (0,0), (-1,-1), 3),
            ('BOTTOMPADDING',(0,0), (-1,-1), 3),
        ]))
        story.append(tl)
        story.append(Spacer(1, 0.5*cm))

    # ── Quiz table ───────────────────────────────────────────────────────────
    if report.quiz_rows:
        story.append(Paragraph('Quiz Results', h2_style))
        qdata = [['Question', 'Answer', 'Correct?']]
        for qr in report.quiz_rows:
            correct_str = (
                '✓' if qr['is_correct'] is True
                else '✗' if qr['is_correct'] is False
                else '—'
            )
            qdata.append([qr['question'], str(qr['answer']), correct_str])
        qt = Table(qdata, colWidths=[W*0.60, W*0.25, W*0.15])
        qt.setStyle(TableStyle([
            ('BACKGROUND',  (0,0), (-1,0), colors.HexColor('#6366f1')),
            ('TEXTCOLOR',   (0,0), (-1,0), colors.white),
            ('FONTNAME',    (0,0), (-1,0), 'Helvetica-Bold'),
            ('FONTSIZE',    (0,0), (-1,-1), 9),
            ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, colors.HexColor('#f9fafb')]),
            ('GRID',        (0,0), (-1,-1), 0.5, colors.HexColor('#e5e7eb')),
            ('LEFTPADDING',  (0,0), (-1,-1), 6),
            ('TOPPADDING',   (0,0), (-1,-1), 4),
            ('BOTTOMPADDING',(0,0), (-1,-1), 4),
        ]))
        story.append(qt)
        story.append(Spacer(1, 0.5*cm))

    # ── Key behaviors ────────────────────────────────────────────────────────
    if report.key_behaviors:
        story.append(Paragraph('Key Behaviors', h2_style))
        for b in report.key_behaviors:
            story.append(Paragraph(f'• {b}', body_style))
        story.append(Spacer(1, 0.4*cm))

    # ── Narrative ────────────────────────────────────────────────────────────
    story.append(Paragraph('AI Summary', h2_style))
    story.append(HRFlowable(width=W, thickness=0.5, color=colors.HexColor('#c7d2fe')))
    story.append(Spacer(1, 0.2*cm))
    story.append(Paragraph(report.narrative, body_style))
    story.append(Spacer(1, 0.4*cm))

    # ── Recommendations ──────────────────────────────────────────────────────
    if report.recommendations:
        story.append(Paragraph('Recommendations', h2_style))
        for i, rec in enumerate(report.recommendations, 1):
            story.append(Paragraph(f'{i}. {rec}', body_style))

    story.append(Spacer(1, 0.5*cm))
    story.append(HRFlowable(width=W, thickness=0.5, color=colors.HexColor('#e5e7eb')))
    story.append(Paragraph('Generated by EngageX v2 — Agentic AI Classroom System', small_style))

    doc.build(story)
    return buf.getvalue()
