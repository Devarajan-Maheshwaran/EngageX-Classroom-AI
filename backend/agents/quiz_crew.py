import os
import json
import re
import logging
from services.supabase_service import SupabaseService

logger = logging.getLogger('engagex.quiz_crew')
_svc = SupabaseService()

GROQ_MODEL = os.getenv('GROQ_MODEL', 'llama3-8b-8192')
GROQ_API_KEY = os.getenv('GROQ_API_KEY', '')


def _get_llm():
    from langchain_groq import ChatGroq
    return ChatGroq(model=GROQ_MODEL, api_key=GROQ_API_KEY, temperature=0.3, max_tokens=400)


def run_quiz_crew(topic: str, session_context: str = '') -> dict:
    if not GROQ_API_KEY:
        return _deterministic_quiz(topic)

    try:
        from crewai import Agent, Task, Crew, Process
    except Exception as exc:
        logger.warning(f'CrewAI unavailable: {exc}')
        return _deterministic_quiz(topic)

    llm = _get_llm()

    quiz_designer = Agent(
        role='Quiz Designer',
        goal='Generate a clear, pedagogically sound multiple-choice question with exactly 4 options.',
        backstory=(
            'You are an expert educational content creator specialised in formative assessment. '
            'You create unambiguous questions that test conceptual understanding, not trivia.'
        ),
        llm=llm,
        verbose=False,
        allow_delegation=False,
    )

    answer_validator = Agent(
        role='Answer Validator',
        goal='Verify the quiz question is factually correct and the correct_id points to the right answer.',
        backstory=(
            'You are a subject matter expert who reviews quiz content before it reaches students. '
            'You check for ambiguity, fact errors, and ensure the explanation is clear and accurate.'
        ),
        llm=llm,
        verbose=False,
        allow_delegation=False,
    )

    design_task = Task(
        description=(
            f'Generate a multiple-choice quiz question about: "{topic}".\n'
            f'Session context (recent student confusion signals): {session_context or "none"}\n'
            'Output ONLY a JSON object with these exact keys:\n'
            '  question: string\n'
            '  options: array of {id: "a"|"b"|"c"|"d", text: string}\n'
            '  correct_id: "a"|"b"|"c"|"d"\n'
            '  explanation: string (1-2 sentences why correct_id is right)\n'
            'No preamble. No markdown. Pure JSON only.'
        ),
        expected_output='A valid JSON object with keys: question, options, correct_id, explanation.',
        agent=quiz_designer,
    )

    validate_task = Task(
        description=(
            'You will receive a quiz JSON from the previous task.\n'
            'Verify:\n'
            '  1. The correct_id actually points to the right answer.\n'
            '  2. The question and options are unambiguous.\n'
            '  3. The explanation is accurate.\n'
            'Fix any errors. Add a "difficulty" field: "easy", "medium", or "hard".\n'
            'Output ONLY the corrected JSON object. No preamble. Pure JSON only.'
        ),
        expected_output='A validated JSON object with keys: question, options, correct_id, explanation, difficulty.',
        agent=answer_validator,
        context=[design_task],
    )

    crew = Crew(
        agents=[quiz_designer, answer_validator],
        tasks=[design_task, validate_task],
        process=Process.sequential,
        verbose=False,
    )

    try:
        result = crew.kickoff()
        raw = result.raw if hasattr(result, 'raw') else str(result)
        match = re.search(r'\{.*\}', raw, re.DOTALL)
        if match:
            return json.loads(match.group())
    except Exception as exc:
        logger.warning(f'quiz_crew kickoff failed: {exc}')

    return _deterministic_quiz(topic)


def run_quiz_analysis(quiz_id: str) -> dict:
    quiz = _svc.get_quiz(quiz_id)
    responses = _svc.get_quiz_responses(quiz_id)
    total = len(responses)
    correct = sum(1 for response in responses if response.get('is_correct') is True)
    accuracy = round(correct / total * 100, 1) if total else 0

    if not GROQ_API_KEY:
        return _deterministic_analysis(quiz, accuracy, total, correct)

    llm = _get_llm()
    prompt = (
        f'Quiz question: {quiz.get("question")}\n'
        f'Accuracy: {accuracy}% ({correct}/{total} correct)\n'
        'Return JSON: {summary, misconception (or null), suggestion}'
    )

    try:
        resp = llm.invoke(prompt)
        raw = resp.content if hasattr(resp, 'content') else str(resp)
        match = re.search(r'\{.*\}', raw, re.DOTALL)
        if match:
            insights = json.loads(match.group())
            _svc.save_quiz_insights(quiz_id, insights)
            return insights
    except Exception as exc:
        logger.warning(f'quiz_analysis failed: {exc}')

    return _deterministic_analysis(quiz, accuracy, total, correct)


def _deterministic_quiz(topic: str) -> dict:
    return {
        'question': f'Which of the following best describes {topic}?',
        'options': [
            {'id': 'a', 'text': 'Option A - definition 1'},
            {'id': 'b', 'text': 'Option B - definition 2'},
            {'id': 'c', 'text': 'Option C - definition 3'},
            {'id': 'd', 'text': 'Option D - definition 4'},
        ],
        'correct_id': 'a',
        'explanation': 'This is a placeholder quiz. Set GROQ_API_KEY to enable AI-generated quizzes.',
        'difficulty': 'medium',
    }


def _deterministic_analysis(quiz, accuracy, total, correct) -> dict:
    return {
        'summary': f'{accuracy}% of students answered correctly ({correct}/{total}).',
        'misconception': None,
        'suggestion': 'Review this topic with a worked example.' if accuracy < 70 else 'Proceed to the next topic.',
    }
