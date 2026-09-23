#config.py
#this files job is to read and contain the API keys and other sensitive information. It is not to be shared publicly.
#read from a hidden file caled .env and store the values in variables for use in the application.

import os    # "os" is apython built in tool kit for reading environmental variables and file paths
from dotenv import load_dotenv  # "dotenv" is a third party library for reading environmental variables from a .env file


load_dotenv()  # run that function to load the environmental variables from the .env file into the application

#os.getenv("NAME", "default") looks up a variable called name in the environment and returns its value. If it is not found, it returns the default value provided.
#the second argument is only used if the variable is missing

GROQ_API_KEY = os.getenv("GROQ_API_KEY", "") 
GROQ_MODEL = os.getenv("GROQ_MODEL", "openai/gpt-oss-20b")
QDRANT_URL = os.getenv("QDRANT_URL", "")
QDRANT_API_KEY = os.getenv("QDRANT_API_KEY", "")
DATABASE_URL = os.getenv("DATABASE_URL", "")
EMBEDDING_MODEL_NAME = os.getenv("EMBEDDING_MODEL_NAME", "all-MiniLM-L6-v2")  # the name of the embedding model to use for generating embeddings   
COLLECTION_NAME = os.getenv("COLLECTION_NAME", "docs_knowledge-base")  # the name of the collection to use for storing embeddings
SIMILARITY_THRESHOLD = float(os.getenv("SIMILARITY_THRESHOLD", "0.45"))  # the threshold for similarity between the query and the documents in the collection
