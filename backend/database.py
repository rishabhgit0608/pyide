import os
import certifi
from pymongo import AsyncMongoClient
from dotenv import load_dotenv

load_dotenv()

MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017")
DB_NAME = os.getenv("DB_NAME", "pyide")

client = AsyncMongoClient(MONGO_URI, tlsCAFile=certifi.where())
db = client[DB_NAME]


def get_db():
    return db
