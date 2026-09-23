#retrive.py
#this file job is to users question find the most relevant chunks of documention from qdrant

from qdrant_client import QdrantClient # the client for talking to Qdrant
from sentence_transformers import SentenceTransformer # the model for creating embeddings
try:
    from app import config
except ImportError:
    import config   

__model = None # global variable to hold the embedding model
__client = None # global variable to hold the Qdrant client

def get_model():
    global __model
    if __model is None:
        __model = SentenceTransformer(config.EMBEDDING_MODEL_NAME)
    return __model

def get__client():
    """
    Connect to Qdrant if the client is not already connected, and return it.
    """
    global __client
    if __client is None:
        __client = QdrantClient(url=config.QDRANT_URL, api_key=config.QDRANT_API_KEY) # connect to Qdrant using the URL and API key from the config file
    return __client # return the Qdrant client

def retrieve_chunks(query: str, top_k: int = 5):
    """
    Retrieve the top_k most relevant chunks of documentation from Qdrant for the given query.
    """
    model = get_model()
    client = get__client()
    query_vector = model.encode(query).tolist()
    results = client.search(
        collection_name = config.COLLECTION_NAME,
        query_vector = query_vector,
        limit = top_k
    )    
    
    chunks = []
    for result in results:
        chunks.append({
            "text": result.payload["text"],
            "source": result.payload["source"],
            "score": result.score
        })
    return chunks

def has_enough_confidence(chunks):
    if not chunks:
        return False
    best_score = chunks[0]["score"]
    return best_score >= config.SIMILARITY_THRESHOLD
		
