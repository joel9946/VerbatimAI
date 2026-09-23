# Dockerfile optimized for low-memory cloud deployment (Render, Hugging Face, Docker)
FROM python:3.11-slim

# Create user with UID 1000 for standard security & cloud compatibility
RUN useradd -m -u 1000 user
USER user
ENV HOME=/home/user \
    PATH=/home/user/.local/bin:$PATH \
    PYTHONUNBUFFERED=1

WORKDIR $HOME/app

# 1. Install CPU-only PyTorch first (saves over 2GB disk & prevents Out-Of-Memory on 512MB RAM)
RUN pip install --no-cache-dir torch --index-url https://download.pytorch.org/whl/cpu

# 2. Install application dependencies
COPY --chown=user:user requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# 3. Pre-cache the embedding model during build so runtime startup is instant and uses low RAM
RUN python -c "from sentence_transformers import SentenceTransformer; SentenceTransformer('all-MiniLM-L6-v2')"

# 4. Copy all project files
COPY --chown=user:user . .

EXPOSE 7860

# Run FastAPI app with uvicorn (binds to $PORT provided by host like Render/HF, fallback to 7860)
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-7860}"]

