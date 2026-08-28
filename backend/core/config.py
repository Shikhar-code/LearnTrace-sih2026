import os
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")
AI_TUTOR_URL = os.getenv("AI_TUTOR_URL", "http://localhost:8001")

if not DATABASE_URL:
    raise ValueError("DATABASE_URL is not set in the .env file")