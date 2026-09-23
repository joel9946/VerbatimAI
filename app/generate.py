

from groq import Groq
import requests
try:
    from app import config
except ImportError:
    import config

__groq_client = Groq(api_key = config.GROQ_API_KEY)

def build_prompt(question: str,chunks : list)  -> str:
    """
    Build a prompt for the Groq API based on the question and chunks of text.

    Args:
        question (str): The question to be answered.
        chunks (list): A list of text chunks to provide context.

    Returns:
        str: The constructed prompt.
    """
    context_text = "\n\n".join(
        [f"[source:{c['source']}]\n{c['text']}" for c in chunks]
        
    )
    prompt = f"""You	are	a	documentation	assistant.	Answer	the	user's	question
using	ONLY	the	information	in	the	CONTEXT	below.	If	the	answer	is	not
contained	in	the	context,	say	"I	don't	have	enough	information	to	answer
that."	Do	not	make	up	information	that	isn't	in	the	context.
CONTEXT:
{context_text}
QUESTION:
{question}
ANSWER	(mention	which	source	you	used):"""
    return prompt

def call_groq(prompt: str) -> str:
    """sends the prompt to groq cloud LLM and returns its text answer"""
    response = __groq_client.chat.completions.create(
        model=config.GROQ_MODEL,
        messages=[{"role": "user", "content": prompt}],
        temperature=0.1,
        max_tokens=500,
    )
    return response.choices[0].message.content

def call_ollama_fallback(prompt: str) -> str:
    """
    If Groq fails (network issue, rate limit, etc.), we fall back
    to a local Ollama model instead of crashing the whole app.
    """
    try:
        response = requests.post(
            "http://localhost:11434/api/generate",
            json={
                "model": "llama3.2",
                "prompt": prompt,
                "stream": False,
            },
            timeout=8,
        )
        if response.status_code == 200:
            return response.json().get("response", "")
    except Exception as e:
        print(f"Ollama fallback error: {e}")
    return "I apologize, but both the primary and fallback language models are currently unreachable. Please try again shortly."

def	generate_answer(question:	str,	chunks:	list)	->	str:
    """
    Generate an answer to the question using the provided chunks of text.

    Args:
        question (str): The question to be answered.
        chunks (list): A list of text chunks to provide context.

    Returns:
        str: The generated answer.
    """
    prompt = build_prompt(question, chunks)
    try:
        return call_groq(prompt)
    except Exception as e:
        print(f"Groq API call failed: {e}. Falling back to Ollama.")
        return call_ollama_fallback(prompt)