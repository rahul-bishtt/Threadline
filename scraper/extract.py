import requests
import trafilatura
from typing import Optional

# TODO:
# Download HTML content from article URL.
# Execute trafilatura text extraction on raw HTML.
# Log connection/extraction errors and fall back gracefully to the RSS summary.

def extract_full_text(url: str, fallback_text: str = "") -> str:
    """
    Downloads article HTML and parses main body text.
    Falls back to RSS summary if scraping fails or resolves to empty strings.
    """
    if not url:
        return fallback_text

    try:
        headers = {"User-Agent": "NewsPulseScraper/1.0"}
        response = requests.get(url, headers=headers, timeout=10)
        
        # If response is not 200 OK, fallback immediately without crashing
        if response.status_code != 200:
            return fallback_text
            
        extracted = trafilatura.extract(response.text)
        if extracted:
            return extracted.strip()
            
    except Exception as e:
        print(f"Warning: Full-text extraction failed for {url}: {e}")
        
    return fallback_text
