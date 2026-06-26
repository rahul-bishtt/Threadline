from typing import List, Dict, Any, Set

# TODO:
# Query the database to check if URLs are already saved.
# Filter incoming lists of normalized items, dropping duplicates.
# Ensure in-memory deduplication occurs before making HTTP calls for text extraction.

def deduplicate_articles_in_memory(articles: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Filters out duplicate articles within the same batch by URL.
    """
    seen_urls = set()
    unique_articles = []
    
    for article in articles:
        url = article.get("url")
        if url and url not in seen_urls:
            seen_urls.add(url)
            unique_articles.append(article)
            
    return unique_articles

def filter_existing_db_articles(articles: List[Dict[str, Any]], existing_urls: Set[str]) -> List[Dict[str, Any]]:
    """
    Filters out articles that already exist in the database (URL matched).
    """
    return [a for a in articles if a.get("url") not in existing_urls]
