from datetime import datetime
from dateutil import parser
from typing import Dict, Any

# TODO:
# Map feed-specific metadata properties (e.g. description vs. summary) to normalized fields.
# Extract article origin sources based on feed domains or metadata tags.
# Robustly parse publication date tags, falling back to current UTC timestamp on failure.

def normalize_source_name(feed_url: str) -> str:
    """
    Derives clean publisher names from feed URL strings.
    """
    if "bbc" in feed_url:
        return "BBC"
    elif "npr" in feed_url:
        return "NPR"
    elif "nytimes" in feed_url:
        return "NYTimes"
    return "Unknown"

def normalize_article(raw_entry: Dict[str, Any]) -> Dict[str, Any]:
    """
    Normalizes a single RSS feed entry dictionary into internal target layout.
    """
    title = raw_entry.get("title", "").strip()
    summary = raw_entry.get("summary", raw_entry.get("description", "")).strip()
    url = raw_entry.get("link", "").strip()
    
    # Extract source name
    feed_url = raw_entry.get("feed_source_url", "")
    source = normalize_source_name(feed_url)
    
    # Handle published date mapping
    published_at = None
    pub_date_str = raw_entry.get("published", raw_entry.get("pubDate", None))
    
    if pub_date_str:
        try:
            published_at = parser.parse(str(pub_date_str))
        except (ValueError, TypeError) as e:
            print(f"Warning: Failed to parse date string '{pub_date_str}': {e}")
            published_at = datetime.utcnow()
    else:
        published_at = datetime.utcnow()

    return {
        "source": source,
        "title": title,
        "summary": summary,
        "url": url,
        "published_at": published_at,
        "fetched_at": datetime.utcnow()
    }
