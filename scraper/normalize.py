from datetime import datetime, timezone
from dateutil import parser
from urllib.parse import urlparse
from typing import Dict, Any

def normalize_source_name(feed_url: str) -> str:
    """
    Derives clean publisher names from feed URL strings.
    If the URL matches a known provider (BBC, NPR, NYTimes), returns the clean label.
    Otherwise, extracts the domain name.
    
    Args:
        feed_url (str): The origin feed URL.
        
    Returns:
        str: Clean source publisher name.
    """
    if not feed_url:
        return "Unknown"
        
    feed_url_lower = feed_url.lower()
    if "bbc" in feed_url_lower:
        return "BBC"
    elif "npr" in feed_url_lower:
        return "NPR"
    elif "nytimes" in feed_url_lower:
        return "NYTimes"
        
    # Extract domain name fallback
    try:
        parsed = urlparse(feed_url)
        netloc = parsed.netloc or ""
        if netloc.startswith("www."):
            netloc = netloc[4:]
        # Split by dots and keep domain name (e.g. rss.cnn.com -> cnn)
        parts = netloc.split(".")
        if len(parts) >= 2:
            return parts[-2].capitalize()
        return netloc or "Unknown"
    except Exception:
        return "Unknown"

def normalize_article(raw_entry: Dict[str, Any]) -> Dict[str, Any]:
    """
    Normalizes a single RSS feed entry dictionary into internal target layout.
    Ensures dates are timezone-aware UTC datetimes.
    
    Args:
        raw_entry (Dict[str, Any]): Raw dict parsed from feedparser.
        
    Returns:
        Dict[str, Any]: Standardized article dict: source, title, summary, url, published_at, fetched_at.
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
            # Ensure it is timezone-aware
            if published_at.tzinfo is None:
                published_at = published_at.replace(tzinfo=timezone.utc)
            else:
                # Convert to UTC timezone
                published_at = published_at.astimezone(timezone.utc)
        except (ValueError, TypeError) as e:
            print(f"Warning: Failed to parse date string '{pub_date_str}': {e}. Using current UTC time.")
            published_at = datetime.now(timezone.utc)
    else:
        published_at = datetime.now(timezone.utc)

    return {
        "source": source,
        "title": title,
        "summary": summary,
        "url": url,
        "published_at": published_at,
        "fetched_at": datetime.now(timezone.utc)
    }
