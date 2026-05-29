import os
from langchain_groq import ChatGroq

GROQ_MODEL = os.getenv('GROQ_MODEL', 'llama3-8b-8192')
GROQ_API_KEY = os.getenv('GROQ_API_KEY', '')

def get_llm(temperature=0.2, max_tokens=1024):
    if not GROQ_API_KEY:
        raise ValueError("GROQ_API_KEY is not set.")
    return ChatGroq(
        model=GROQ_MODEL,
        api_key=GROQ_API_KEY,
        temperature=temperature,
        max_tokens=max_tokens
    )
