import psycopg2
from psycopg2.extras import RealDictCursor
from typing import List, Dict, Any, Set
from config import DATABASE_URL

# TODO:
# Setup cursor connections to Postgres using psycopg2.
# Query saved urls to perform deduplication checks.
# Bulk insert articles into the articles table.
# Update cluster mappings and create cluster labels.

def get_db_connection():
    """
    Establishes and returns a connection to the Postgres database.
    """
    return psycopg2.connect(DATABASE_URL)

def fetch_existing_urls() -> Set[str]:
    """
    Retrieves all unique article URLs currently stored in the database.
    """
    urls = set()
    try:
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT url FROM articles;")
                rows = cur.fetchall()
                for row in rows:
                    urls.add(row[0])
    except Exception as e:
        print(f"Warning: Failed to fetch existing URLs from database: {e}")
    return urls

def save_articles(articles: List[Dict[str, Any]]):
    """
    Inserts news articles into the database.
    """
    # Placeholder for database bulk insert
    print(f"Placeholder: Saving {len(articles)} articles to database.")
    pass

def save_clusters(clusters: List[Dict[str, Any]]):
    """
    Creates clusters and updates cluster associations on articles.
    """
    # Placeholder for database cluster insertions and updates
    print(f"Placeholder: Saving {len(clusters)} clusters to database.")
    pass
