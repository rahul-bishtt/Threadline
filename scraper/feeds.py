import feedparser
import requests
from typing import List, Dict, Any
from config import DEFAULT_FEEDS

# TODO:
# Fetch feed raw content with appropriate User-Agent headers.
# Parse XML elements using feedparser.
# Extract and yield a list of raw entry items containing link, title, description, pubDate.

def fetch_feed(feed_url: str) -> str:
    """
    Fetches raw XML content from the given feed URL.
    """
    headers = {"User-Agent": "NewsPulseScraper/1.0"}
    response = requests.get(feed_url, headers=headers, timeout=10)
    response.raise_for_status()
    return response.text

def parse_feed_entries(raw_xml: str) -> List[Dict[str, Any]]:
    """
    Parses the raw RSS XML content and returns entries.
    """
    parsed = feedparser.parse(raw_xml)
    return parsed.entries

def get_all_feed_articles(feed_urls: List[str] = None) -> List[Dict[str, Any]]:
    """
    Orchestrates fetching and parsing across all specified feeds.
    """
    if feed_urls is None:
        feed_urls = DEFAULT_FEEDS
        
    all_entries = []
    for url in feed_urls:
        try:
            xml_data = fetch_feed(url)
            entries = parse_feed_entries(xml_data)
            for entry in entries:
                # Store source URL for mapping origin
                entry["feed_source_url"] = url
                all_entries.append(entry)
        except Exception as e:
            print(f"Warning: Failed to fetch feed {url}: {e}")
            
    return all_entries
