#	main.py
#	This	is	the	FRONT	DOOR	of	our	backend.	It's	a	FastAPI	app
#	that	exposes	a	"/ask"	endpoint,	tying	together	retrieve.py,
#	generate.py,	and	db.py	into	one	working	pipeline.

import os
import time
import mimetypes

# Fix Windows registry MIME type corruption for CSS and JS
mimetypes.init()
mimetypes.add_type("text/css", ".css")
mimetypes.add_type("application/javascript", ".js")
mimetypes.add_type("text/javascript", ".js")

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel
from app import retrieve, generate, db

app = FastAPI(title="Verbatim AI API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

frontend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "frontend"))

@app.get("/")
def serve_index():
    index_path = os.path.join(frontend_dir, "index.html")
    if os.path.exists(index_path):
        return FileResponse(index_path, media_type="text/html")
    return {"message": "Verbatim AI Backend Active"}

@app.get("/style.css")
def serve_css():
    css_path = os.path.join(frontend_dir, "style.css")
    if os.path.exists(css_path):
        return FileResponse(css_path, media_type="text/css")
    return ""

@app.get("/app.js")
def serve_js():
    js_path = os.path.join(frontend_dir, "app.js")
    if os.path.exists(js_path):
        return FileResponse(js_path, media_type="application/javascript")
    return ""



db.init_db()  # Initialize the database when the app starts

class AskRequest(BaseModel):
    question: str   

@app.post("/ask")
def ask(request: AskRequest):
    start_time = time.time()
    chunks = retrieve.retrieve_chunks(request.question, top_k=5)
    if not retrieve.has_enough_confidence(chunks):
        answer = "I don't have enough information to answer that."
        top_source = None
        top_score = 0.0
    else:
        answer = generate.generate_answer(request.question, chunks)
        top_source = chunks[0]['source']
        top_score = chunks[0]['score']
    latency_ms = int((time.time() - start_time) * 1000)
    db.log_interaction(request.question, answer, top_source, top_score, latency_ms)
    return {"answer": answer, "top_source": top_source, "top_score": top_score, "latency_ms": latency_ms}

@app.get("/status")
def status():
    conn = db.get_connection()
    if not conn:
        return {"status": "database_not_connected", "total_questions": 0, "avg_latency_ms": None, "avg_score": None}
    try:
        cur = conn.cursor()
        cur.execute("SELECT COUNT(*), AVG(latency_ms), AVG(top_score) FROM logs;")
        total, avg_latency, avg_score = cur.fetchone() # type: ignore
        cur.close()
        return {"total_questions": total, "avg_latency_ms": avg_latency, "avg_score": avg_score}
    except Exception as e:
        return {"status": "error", "message": str(e)}
    finally:
        conn.close()

@app.get("/history")
def history(limit: int = 50):
    return db.get_history(limit=limit)

frontend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "frontend"))
if os.path.exists(frontend_dir):
    app.mount("/", StaticFiles(directory=frontend_dir, html=True), name="frontend")

