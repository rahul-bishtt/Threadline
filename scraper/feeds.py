import feedparser
import requests
import time
from typing import List, Dict, Any
from config import DEFAULT_FEEDS

def fetch_feed_with_retry(feed_url: str) -> str:
    """
    Fetches raw XML content from the given feed URL.
    Implements up to 3 retries with exponential backoff (1s, 2s, 4s).
    
    Args:
        feed_url (str): The RSS feed URL to fetch.
        
    Returns:
        str: Raw XML response content text.
        
    Errors:
        requests.RequestException: If all retry attempts fail.
    """
    headers = {"User-Agent": "NewsPulseScraper/1.0"}
    max_retries = 3
    delay = 1.0

    for attempt in range(1, max_retries + 1):
        try:
            response = requests.get(feed_url, headers=headers, timeout=10)
            response.raise_for_status()
            return response.text
        except Exception as e:
            if attempt == max_retries:
                print(f"Error: Final attempt ({attempt}) failed for feed {feed_url}: {e}")
                raise e
            print(f"Warning: Attempt {attempt} failed for feed {feed_url}: {e}. Retrying in {delay}s...")
            time.sleep(delay)
            delay *= 2.0

def parse_feed_entries(raw_xml: str) -> List[Dict[str, Any]]:
    """
    Parses the raw RSS XML content and returns parsed entries.
    
    Args:
        raw_xml (str): The raw RSS XML string.
        
    Returns:
        List[Dict[str, Any]]: List of parsed feed entry items.
    """
    parsed = feedparser.parse(raw_xml)
    return parsed.entries

def get_all_feed_articles(feed_urls: List[str] = None) -> List[Dict[str, Any]]:
    """
    Orchestrates fetching and parsing across all specified feeds.
    Gracefully handles individual feed failures and logs processing statistics.
    
    Args:
        feed_urls (List[str], optional): Custom list of RSS feed URLs. Defaults to config list.
        
    Returns:
        List[Dict[str, Any]]: Aggregated list of all raw article entries.
    """
    if feed_urls is None:
        feed_urls = DEFAULT_FEEDS
        
    all_entries = []
    success_count = 0
    failure_count = 0

    print(f"Starting feed fetching for {len(feed_urls)} sources...")

    for url in feed_urls:
        try:
            print(f"Fetching feed: {url}")
            xml_data = fetch_feed_with_retry(url)
            entries = parse_feed_entries(xml_data)
            success_count += 1
            print(f"Successfully processed feed {url}. Found {len(entries)} entries.")
            for entry in entries:
                entry["feed_source_url"] = url
                all_entries.append(entry)
        except Exception as e:
            failure_count += 1
            print(f"Error: Skipping feed {url} due to repeated failures: {e}")
            
    print(f"Feed Ingestion Summary: {success_count} succeeded, {failure_count} failed.")
    return all_entries
