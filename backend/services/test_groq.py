import os

from dotenv import load_dotenv
from groq import Groq

load_dotenv(dotenv_path=".env", override=True)


def main():
    api_key = os.getenv("GROQ_API_KEY")
    model = os.getenv("GROQ_MODEL")

    print("Starting Groq test...")

    if not api_key:
        print("GROQ_API_KEY is missing.")
        return

    if not model:
        print("GROQ_MODEL is missing.")
        return

    print(f"Using model: {model}")

    client = Groq(api_key=api_key)

    response = client.chat.completions.create(
        model=model,
        messages=[
            {
                "role": "system",
                "content": "You are a helpful educational assistant.",
            },
            {
                "role": "user",
                "content": "Say exactly: Groq fallback connection successful.",
            },
        ],
    )

    print("Groq response:")
    print(response.choices[0].message.content)


if __name__ == "__main__":
    main()
