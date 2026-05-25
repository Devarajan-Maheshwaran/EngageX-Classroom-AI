import io
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from reportlab.lib import colors

def generate_pdf(report_data, session_title: str) -> bytes:
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=letter)
    styles = getSampleStyleSheet()
    elements = []

    # Title
    title_style = styles['Heading1']
    elements.append(Paragraph(f"EngageX Session Report: {session_title}", title_style))
    elements.append(Spacer(1, 12))

    # Student Info
    elements.append(Paragraph(f"Student: {report_data.student_name} (ID: {report_data.student_id})", styles['Heading2']))
    elements.append(Spacer(1, 12))

    # Narrative
    elements.append(Paragraph("Narrative Summary", styles['Heading3']))
    elements.append(Paragraph(report_data.narrative, styles['Normal']))
    elements.append(Spacer(1, 12))

    # Stats Table
    data = [
        ['Metric', 'Value'],
        ['Average Engagement', f"{report_data.avg_engagement or 'N/A'}/100"],
        ['Participation Rate', f"{round((report_data.participation_rate or 0) * 100, 2)}%"],
        ['Quiz Accuracy', f"{report_data.quiz_accuracy or 'N/A'}%"],
        ['Alerts (Watch / Intervene)', f"{report_data.alerts_watch} / {report_data.alerts_intervene}"],
        ['Dominant Signal', str(report_data.dominant_signal)],
    ]
    t = Table(data, colWidths=[200, 200])
    t.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.grey),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
        ('BACKGROUND', (0, 1), (-1, -1), colors.beige),
        ('GRID', (0, 0), (-1, -1), 1, colors.black),
    ]))
    elements.append(t)
    elements.append(Spacer(1, 20))

    # Recommendations
    if report_data.recommendations:
        elements.append(Paragraph("Recommendations", styles['Heading3']))
        for rec in report_data.recommendations:
            elements.append(Paragraph(f"• {rec}", styles['Normal']))
            elements.append(Spacer(1, 6))

    doc.build(elements)
    pdf_bytes = buffer.getvalue()
    buffer.close()
    return pdf_bytes
