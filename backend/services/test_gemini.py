import os

from dotenv import load_dotenv
from google import genai

load_dotenv(dotenv_path=".env", override=True)


def main():
    api_key = os.getenv("GEMINI_API_KEY")
    model = os.getenv("GEMINI_MODEL")

    print("Starting Gemini test...")

    if not api_key:
        print("GEMINI_API_KEY is missing.")
        return

    if not model:
        print("GEMINI_MODEL is missing.")
        return

    print(f"Using model: {model}")

    client = genai.Client(api_key=api_key)

    response = client.models.generate_content(
        model=model,
        contents="Say exactly: Gemini connection successful.",
    )

    print("Gemini response:")
    print(response.text)


if __name__ == "__main__":
    main()
