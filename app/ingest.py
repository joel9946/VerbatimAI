#	ingest.py
# (remove the "from http import client" line entirely — you don't need it)

import os
from qdrant_client import QdrantClient
from qdrant_client.models import VectorParams, Distance, PointStruct
from sentence_transformers import SentenceTransformer
try:
    from app import config
except ImportError:
    import config

RAW_DOCS_FOLDER = "data/raw"
CHUNK_SIZE = 800
CHUNK_OVERLAP = 100

def load_documents():
    documents = []
    if not os.path.exists(RAW_DOCS_FOLDER):
        os.makedirs(RAW_DOCS_FOLDER, exist_ok=True)
        return documents
    for filename in os.listdir(RAW_DOCS_FOLDER):
        if filename.endswith(".txt"):
            filepath = os.path.join(RAW_DOCS_FOLDER, filename)
            with open(filepath, "r", encoding="utf-8") as f:
                text = f.read()
                documents.append((filename, text))
    return documents

import re

def chunk_text(text):
    # Check if doc has numbered Q&A
    pattern = r'(?:\n|^)(?=\d+\.\s+)'
    parts = [p.strip() for p in re.split(pattern, text) if p.strip()]
    if len(parts) > 1 and re.match(r'^\d+\.\s+', parts[1]):
        header = ''
        if not re.match(r'^\d+\.\s+', parts[0]):
            header = parts[0].strip()
            qa_items = parts[1:]
        else:
            qa_items = parts
        
        chunks = []
        for item in qa_items:
            chunk = f"{header}\n\n{item}".strip() if header else item
            chunks.append(chunk)
        return chunks
    else:
        # Standard paragraph-preserving chunker
        paragraphs = text.split('\n\n')
        chunks = []
        current = []
        current_len = 0
        for p in paragraphs:
            p = p.strip()
            if not p:
                continue
            if current_len + len(p) > CHUNK_SIZE and current:
                chunks.append('\n\n'.join(current))
                current = [p]
                current_len = len(p)
            else:
                current.append(p)
                current_len += len(p)
        if current:
            chunks.append('\n\n'.join(current))
        return chunks

def main():
    print("Loading documents...")
    model = SentenceTransformer(config.EMBEDDING_MODEL_NAME)

    print("Connecting to Qdrant...")
    client = QdrantClient(url=config.QDRANT_URL, api_key=config.QDRANT_API_KEY)

    vector_size = model.get_sentence_embedding_dimension()
    if client.collection_exists(config.COLLECTION_NAME):
        client.delete_collection(config.COLLECTION_NAME)
    client.create_collection(
        collection_name=config.COLLECTION_NAME,
        vectors_config=VectorParams(size=vector_size, distance=Distance.COSINE)
    )

    documents = load_documents()
    print(f"found {len(documents)} documents.")

    points = []
    point_id = 0

    for filename, text in documents:
        chunks = chunk_text(text)
        for chunk in chunks:
            vector = model.encode(chunk).tolist()
            points.append(
                PointStruct(
                    id=point_id,
                    vector=vector,
                    payload={"source": filename, "text": chunk}
                )
            )
            point_id += 1

    # These three lines MUST be indented to stay inside main() —
    # otherwise "points" and "client" don't exist when they run.
    print(f"uploading {len(points)} chunks to Qdrant...")
    client.upsert(collection_name=config.COLLECTION_NAME, points=points)
    print("Done! your knowledge base is ready.")

if __name__ == "__main__":
    main()