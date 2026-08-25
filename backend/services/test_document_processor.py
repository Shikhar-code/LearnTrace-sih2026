from services.document_processor import process_pdf


NCERT_MATH_CLASS_10_URL = (
    "https://www.ncert.nic.in/textbook/pdf/jemh1ps.pdf"
)


if __name__ == "__main__":
    print("Downloading and processing NCERT Class 10 Mathematics PDF...")

    chunks = process_pdf(NCERT_MATH_CLASS_10_URL)

    print(f"Total chunks extracted: {len(chunks)}")

    if chunks:
        print("\nFirst chunk:")
        print(chunks[0]["content"][:1000])