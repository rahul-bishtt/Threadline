import time
import requests
import trafilatura

def extract_full_text(url: str, fallback_text: str = "") -> str:
    """
    Downloads article HTML and parses main body text.
    Implements up to 3 retries with exponential backoff (1s, 2s, 4s) for network errors.
    Falls back to the provided fallback text if scraping fails or returns empty.
    
    Args:
        url (str): The article web page URL.
        fallback_text (str): String fallback (typically RSS summary) to use if download/extraction fails.
        
    Returns:
        str: Extracted main body text, or fallback_text.
    """
    if not url:
        return fallback_text

    headers = {"User-Agent": "NewsPulseScraper/1.0"}
    max_retries = 3
    delay = 1.0
    html_content = None

    for attempt in range(1, max_retries + 1):
        try:
            response = requests.get(url, headers=headers, timeout=10)
            if response.status_code == 200:
                html_content = response.text
                break
            else:
                print(f"Warning: Attempt {attempt} returned HTTP {response.status_code} for {url}")
                if attempt == max_retries:
                    print(f"Error: Failed to fetch page {url} after {max_retries} attempts.")
                    return fallback_text
        except Exception as e:
            if attempt == max_retries:
                print(f"Warning: Attempt {attempt} connection failed for {url}: {e}. Retries exhausted.")
                return fallback_text
            print(f"Warning: Attempt {attempt} connection failed for {url}: {e}. Retrying in {delay}s...")
            time.sleep(delay)
            delay *= 2.0

    if not html_content:
        return fallback_text

    try:
        extracted = trafilatura.extract(html_content)
        if extracted:
            return extracted.strip()
    except Exception as e:
        print(f"Warning: Trafilatura failed to parse HTML for {url}: {e}")

    return fallback_text
