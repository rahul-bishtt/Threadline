import re
from typing import List, Dict, Any
# Try imports of scikit-learn for TF-IDF option
try:
    from sklearn.feature_extraction.text import TfidfVectorizer
    from sklearn.metrics.pairwise import cosine_similarity
except ImportError:
    TfidfVectorizer = None
    cosine_similarity = None

# TODO:
# Tokenize and clean text body/titles by stripping stopwords.
# Implement either Keyword Overlap comparison or TF-IDF cosine-similarity calculations.
# Run agglomerative/threshold-based clustering logic.
# Group documents and generate cluster labels from high-frequency/weight keywords.

def clean_tokens(text: str) -> List[str]:
    """
    Cleans and tokenizes raw strings.
    """
    words = re.findall(r"[a-z0-9]+", text.lower())
    return [w for w in words if len(w) > 2]

def cluster_articles(articles: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Groups articles into clusters. Returns a modified list where articles
    are assigned to existing or new clusters.
    """
    # Scaffolding returns articles unchanged, ready for clustering logic integration
    for article in articles:
        if "cluster_id" not in article:
            article["cluster_id"] = None
    return articles
