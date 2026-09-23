# Dockerfile configured for local Docker and Hugging Face Spaces
FROM python:3.11-slim

# Create user with UID 1000 for Hugging Face Spaces compatibility
RUN useradd -m -u 1000 user
USER user
ENV HOME=/home/user \
    PATH=/home/user/.local/bin:$PATH

WORKDIR $HOME/app

# Install Python requirements
COPY --chown=user:user requirements.txt .
RUN pip install --no-cache-dir --upgrade -r requirements.txt

# Copy all project files
COPY --chown=user:user . .

# Hugging Face Spaces requires listening on port 7860
EXPOSE 7860

# Run FastAPI app with uvicorn (binds to $PORT provided by host like Render/HF, fallback to 7860)
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-7860}"]
