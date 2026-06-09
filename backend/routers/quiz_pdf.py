import json
import logging
import os
import tempfile
from typing import Optional

import pdfplumber
from fastapi import APIRouter, File, Form, HTTPException, UploadFile, status

from agents.llm_client import get_llm

router = APIRouter()
logger = logging.getLogger('engagex.quiz_pdf')

_MAX_CHARS = 3000
_MAX_PAGES = 5


def _extract_text(pdf_path: str) -> str:
    text_parts = []
    with pdfplumber.open(pdf_path) as pdf:
        for page in pdf.pages[:_MAX_PAGES]:
            page_text = page.extract_text()
            if page_text:
                text_parts.append(page_text)
    return '\n'.join(text_parts)[:_MAX_CHARS].strip()


def _build_prompt(content: str) -> str:
    return (
        'Generate 5 multiple-choice questions based on the content below.\n'
        'Return ONLY a valid JSON array. Each element must follow this exact shape:\n'
        '[{"question": "...", "options": [{"id": "a", "text": "..."}, '
        '{"id": "b", "text": "..."}, {"id": "c", "text": "..."}, '
        '{"id": "d", "text": "..."}], "correct_id": "a", "explanation": "..."}]\n\n'
        f'Content:\n{content}'
    )


@router.post('/from-pdf', status_code=status.HTTP_201_CREATED)
async def quiz_from_pdf(
    file: UploadFile = File(...),
    session_id: str = Form(...),
) -> dict:
    if not (file.filename or '').lower().endswith('.pdf'):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail='Only PDF files are accepted')

    tmp_path: Optional[str] = None
    try:
        contents = await file.read()
        with tempfile.NamedTemporaryFile(suffix='.pdf', delete=False) as tmp:
            tmp.write(contents)
            tmp_path = tmp.name

        text = _extract_text(tmp_path)
        if not text:
            raise HTTPException(
                status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail='Could not extract readable text from the PDF',
            )

        llm = get_llm(temperature=0.3, max_tokens=2048)
        response = llm.invoke(_build_prompt(text))
        raw = response.content if hasattr(response, 'content') else str(response)

        start = raw.find('[')
        end = raw.rfind(']') + 1
        if start == -1 or end == 0:
            raise ValueError('LLM response did not contain a JSON array')

        questions = json.loads(raw[start:end])
        return {'session_id': session_id, 'questions': questions}

    except HTTPException:
        raise
    except json.JSONDecodeError as exc:
        logger.error('quiz_from_pdf JSON parse error: %s', exc)
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, detail='LLM returned malformed JSON')
    except Exception as exc:
        logger.error('quiz_from_pdf error: %s', exc)
        raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc))
    finally:
        if tmp_path:
            try:
                os.unlink(tmp_path)
            except OSError:
                pass
