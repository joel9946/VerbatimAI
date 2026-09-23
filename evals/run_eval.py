# run_eval.py
# Automatically checks how good our RAG system is using the Ragas library
# Evaluates faithfulness, answer relevancy, and context precision using Groq & HuggingFace

import json
import sys
import os
import math
import argparse
from datasets import Dataset
from ragas import evaluate
from ragas.metrics import faithfulness, answer_relevancy, context_precision
from ragas.llms import LangchainLLMWrapper
from ragas.embeddings.base import BaseRagasEmbeddings
from ragas.run_config import RunConfig
from langchain_groq import ChatGroq
from sentence_transformers import SentenceTransformer

# Ensure parent directory is on sys.path
sys.path.append(os.path.join(os.path.dirname(__file__), ".."))
from app import retrieve, generate, config

FAITHFULNESS_THRESHOLD = 0.70

class SentenceTransformerEmbeddings(BaseRagasEmbeddings):
    """Embeddings wrapper for Ragas using local sentence-transformers without OpenAI."""
    def __init__(self, model_name=config.EMBEDDING_MODEL_NAME):
        self.model = SentenceTransformer(model_name)

    def embed_documents(self, texts):
        return self.model.encode(texts).tolist()

    def embed_query(self, text):
        return self.model.encode([text])[0].tolist()

def get_eval_components():
    """Initializes Groq-backed LLM and local embeddings for Ragas evaluation."""
    eval_llm = LangchainLLMWrapper(
        ChatGroq(
            model_name=config.GROQ_MODEL,
            api_key=config.GROQ_API_KEY,
            temperature=0.0,
            max_retries=5,
        )
    )
    eval_embeddings = SentenceTransformerEmbeddings(config.EMBEDDING_MODEL_NAME)
    return eval_llm, eval_embeddings

def run(limit=None):
    test_set_path = os.path.join(os.path.dirname(__file__), "test_set.json")
    with open(test_set_path, "r", encoding="utf-8") as f:
        test_cases = json.load(f)

    if limit and limit > 0:
        test_cases = test_cases[:limit]

    print(f"Running evaluation on {len(test_cases)} test cases...")

    questions, answers, contexts, ground_truths = [], [], [], []
    for i, case in enumerate(test_cases, 1):
        print(f"[{i}/{len(test_cases)}] Retrieving & generating for: {case['question']}")
        chunks = retrieve.retrieve_chunks(case["question"], top_k=3)
        answer = generate.generate_answer(case["question"], chunks)
        questions.append(case["question"])
        answers.append(answer)
        contexts.append([c["text"] for c in chunks])
        ground_truths.append(case["ground_truth"])

    dataset = Dataset.from_dict({
        "question": questions,
        "answer": answers,
        "contexts": contexts,
        "ground_truth": ground_truths,
    })

    eval_llm, eval_embeddings = get_eval_components()
    metrics = [faithfulness, answer_relevancy, context_precision]
    for m in metrics:
        m.llm = eval_llm
        if hasattr(m, "embeddings"):
            m.embeddings = eval_embeddings

    # Groq API strictly enforces n <= 1 completions per request
    answer_relevancy.strictness = 1

    print("\nComputing Ragas metrics (faithfulness, answer_relevancy, context_precision)...")
    run_config = RunConfig(
        timeout=180,
        max_workers=2,
        max_retries=10,
        max_wait=60,
    )
    results = evaluate(
        dataset,
        metrics=metrics,
        llm=eval_llm,
        embeddings=eval_embeddings,
        run_config=run_config,
        raise_exceptions=False,
    )
    print("\n=== RAGAS EVALUATION RESULTS ===")
    print(results)

    faithfulness_score = results.get("faithfulness", 0.0)
    if math.isnan(faithfulness_score) or faithfulness_score < FAITHFULNESS_THRESHOLD:
        print(f"\nFAILED: faithfulness {faithfulness_score} is below threshold {FAITHFULNESS_THRESHOLD}")
        sys.exit(1)
    else:
        print(f"\nPASSED quality checks! Faithfulness {faithfulness_score:.4f} >= {FAITHFULNESS_THRESHOLD}")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Run Ragas Quality Evaluation Suite")
    parser.add_argument("--limit", type=int, default=5, help="Number of test cases to evaluate (default: 5)")
    args = parser.parse_args()
    run(limit=args.limit)