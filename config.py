"""
Configuration
--------------
Loads the Gemini API key from a .env file or environment variable.
"""

import os
from pathlib import Path

# Load .env manually (no python-dotenv required)
_env_path = Path(__file__).parent / ".env"
if _env_path.exists():
    with open(_env_path) as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, v = line.split("=", 1)
                os.environ.setdefault(k.strip(), v.strip())

GEMINI_API_KEY: str = os.environ.get("GEMINI_API_KEY", "AIzaSyCI6cSwEtJjEl60E8CySIjHdhDU04yuAOM")
GEMINI_MODEL:   str = os.environ.get("GEMINI_MODEL", "gemini-2.5-flash")

if not GEMINI_API_KEY:
    raise EnvironmentError(
        "\n\n❌  GEMINI_API_KEY is not set!\n"
        "   1. Get a free key at https://aistudio.google.com/app/apikey\n"
        "   2. Create a file called  .env  in the project root and add:\n"
        "      GEMINI_API_KEY=your_key_here\n"
    )
