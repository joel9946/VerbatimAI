# RAG Documentation Support Copilot

An enterprise-grade Retrieval-Augmented Generation (RAG) Support Copilot that answers developer and user questions grounded in documentation knowledge bases with high confidence, telemetry logging, and quality evaluations.

---

## 🏛️ Architecture

```
                 +---------------------------+
                 |   Streamlit Frontend      |
                 | (frontend/streamlit_app)  |
                 +-------------+-------------+
                               | HTTP (POST /ask)
                               v
                 +---------------------------+
                 |      FastAPI Backend      |
                 |       (app/main.py)       |
                 +-------+-----------+-------+
                         |           |
            +------------+           +------------+
            |                                     |
            v                                     v
+-----------------------+             +-----------------------+
|    Vector Search      |             |   Answer Generation   |
|   (app/retrieve.py)   |             |   (app/generate.py)   |
| - all-MiniLM-L6-v2    |             | - Primary: Groq Cloud |
| - Qdrant Vector DB    |             | - Fallback: Ollama    |
+-----------+-----------+             +-----------+-----------+
            |                                     |
            +------------------+------------------+
                               |
                               v
                 +---------------------------+
                 |  Monitoring & Telemetry   |
                 |       (app/db.py)         |
                 | - PostgreSQL / Supabase   |
                 +---------------------------+
```

---

## 🚀 Features

- **Semantic Vector Search**: Powered by `sentence-transformers` (`all-MiniLM-L6-v2`) and Qdrant Cloud.
- **High-Speed Inference**: Low-latency generation via Groq Cloud LLM API with graceful fallback to local Ollama.
- **Hallucination Prevention**: Threshold confidence checks to politely decline out-of-domain queries.
- **Production Telemetry**: Every query, answer, source citation, similarity score, and latency logged to PostgreSQL (Supabase).
- **Interactive UI**: User-friendly Streamlit interface with latency and source attribution badges.
- **CI/CD Quality Guardrails**: Automated Ragas evaluation workflow in GitHub Actions ensuring faithfulness and answer relevancy before deployments.

---

## 🛠️ Setup & Installation

### 1. Clone & Setup Virtual Environment
```bash
git clone <repo-url>
cd "RAG.support copilot"

python -m venv .venv
# On Windows:
.venv\Scripts\activate
# On Linux/macOS:
source .venv/bin/activate

pip install -r requirements.txt
```

### 2. Configure Environment Variables
Copy `.env.example` to `.env` and fill in your API credentials:
```bash
cp .env.example .env
```

Required variables:
- `GROQ_API_KEY`: Your Groq Cloud API key.
- `GROQ_MODEL`: Model name (default: `openai/gpt-oss-20b`).
- `QDRANT_URL`: Qdrant Cloud cluster endpoint.
- `QDRANT_API_KEY`: Qdrant Cloud API key.
- `DATABASE_URL`: PostgreSQL connection string (Supabase connection pooler or direct).
- `SIMILARITY_THRESHOLD`: Retrieval cutoff threshold (default: `0.45`).

---

## 📚 Document Ingestion

Place documentation `.txt` files into `data/raw/`, then run the ingestion pipeline:
```bash
python -m app.ingest
```
This splits documents into overlapping semantic chunks, embeds them, and uploads them to the Qdrant collection.

---

## 🏃 Running the Application

### 1. Start the FastAPI Backend
```bash
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```
Endpoints:
- `POST /ask`: Answer questions using RAG.
  ```json
  { "question": "How do I install FastAPI?" }
  ```
- `GET /status`: View metrics (total queries, avg latency, avg similarity score).

### 2. Start the Streamlit Frontend
In another terminal:
```bash
streamlit run frontend/streamlit_app.py
```
Open `http://localhost:8501` in your browser.

---

## 📊 Automated Evaluation (Ragas)

Run the quality evaluation suite:
```bash
python evals/run_eval.py
```
The test suite validates faithfulness, answer relevancy, and context precision against benchmark QA pairs in `evals/test_set.json`.

---

## 🐳 Docker Deployment

Build and run using Docker:
```bash
docker build -t rag-support-copilot .
docker run -p 8000:8000 --env-file .env rag-support-copilot
```
