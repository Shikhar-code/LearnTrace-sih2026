import io
from typing import List

import requests
from pypdf import PdfReader


def download_pdf(url: str) -> bytes:
    response = requests.get(url, timeout=60)
    response.raise_for_status()

    content_type = response.headers.get("content-type", "").lower()

    if "pdf" not in content_type and not url.lower().endswith(".pdf"):
        raise ValueError("The provided URL does not appear to be a PDF.")

    return response.content


def extract_text_from_pdf(pdf_bytes: bytes) -> List[dict]:
    """
    Extract PDF text using pypdf first.

    If pypdf cannot decode a trusted PDF stream, fall back to
    PyMuPDF instead of disabling pypdf's safety limits.
    """

    try:
        pdf_file = io.BytesIO(pdf_bytes)
        reader = PdfReader(pdf_file)

        pages = []

        for page_number, page in enumerate(reader.pages, start=1):
            text = page.extract_text() or ""
            text = text.strip()

            if text:
                pages.append(
                    {
                        "page_number": page_number,
                        "text": text,
                    }
                )

        if pages:
            return pages

    except Exception as pypdf_error:
        print(
            "pypdf extraction failed. "
            f"Trying PyMuPDF fallback: {pypdf_error}"
        )

    # Fallback parser
    try:
        import fitz

        document = fitz.open(
            stream=pdf_bytes,
            filetype="pdf",
        )

        pages = []

        for page_number, page in enumerate(document, start=1):
            text = page.get_text("text") or ""
            text = text.strip()

            if text:
                pages.append(
                    {
                        "page_number": page_number,
                        "text": text,
                    }
                )

        document.close()

        if pages:
            return pages

        raise ValueError(
            "No extractable text was found using pypdf or PyMuPDF."
        )

    except Exception as fallback_error:
        raise ValueError(
            "PDF extraction failed with both parsers. "
            f"PyMuPDF error: {fallback_error}"
        )


def split_into_chunks(
    pages: List[dict],
    chunk_size: int = 1500,
) -> List[dict]:
    chunks = []
    chunk_index = 0

    for page in pages:
        text = page["text"]

        start = 0

        while start < len(text):
            chunk_text = text[start:start + chunk_size].strip()

            if chunk_text:
                chunks.append(
                    {
                        "chunk_index": chunk_index,
                        "page_number": page["page_number"],
                        "content": chunk_text,
                    }
                )

                chunk_index += 1

            start += chunk_size

    return chunks


def process_pdf(url: str) -> List[dict]:
    pdf_bytes = download_pdf(url)

    pages = extract_text_from_pdf(pdf_bytes)

    chunks = split_into_chunks(pages)

    return chunks