import psycopg2
from psycopg2.extras import RealDictCursor
import contextlib
from typing import List, Dict, Any, Set, Generator
from config import DATABASE_URL
"""
PostgreSQL Scraper Database Access Module.
"""

def connect() -> psycopg2.extensions.connection:
    """
    Establishes and returns a connection to the PostgreSQL database.

    Returns:
        psycopg2.extensions.connection: The database connection object.

    Errors:
        psycopg2.OperationalError: If connection to database fails.
    """
    return psycopg2.connect(DATABASE_URL)

@contextlib.contextmanager
def transaction(conn: psycopg2.extensions.connection) -> Generator[psycopg2.extensions.cursor, None, None]:
    """
    A context manager to execute database queries within a transaction block.
    Automatically handles COMMIT on success and ROLLBACK on exception.

    Args:
        conn (psycopg2.extensions.connection): Connection object.

    Yields:
        psycopg2.extensions.cursor: Database cursor with RealDictCursor factory.

    Errors:
        psycopg2.Error: If transaction initialization or commit/rollback fails.
    """
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    try:
        yield cursor
        conn.commit()
    except Exception as e:
        conn.rollback()
        print(f"Scraper Transaction failed, rolling back: {e}")
        raise e
    finally:
        cursor.close()

def article_exists(url: str, cursor: psycopg2.extensions.cursor = None) -> bool:
    """
    Checks if an article with the specified URL already exists in the database.

    Args:
        url (str): The unique URL to check.
        cursor (psycopg2.extensions.cursor, optional): Active transaction cursor.

    Returns:
        bool: True if the article exists, False otherwise.

    Errors:
        psycopg2.Error: On query execution errors.
    """
    sql = "SELECT 1 FROM articles WHERE url = %s;"
    
    if cursor:
        cursor.execute(sql, (url,))
        return cursor.fetchone() is not None

    with connect() as conn:
        with conn.cursor() as cur:
            cur.execute(sql, (url,))
            return cur.fetchone() is not None

def insert_article(article: Dict[str, Any], cursor: psycopg2.extensions.cursor = None) -> int:
    """
    Inserts a single news article record into the database.

    Args:
        article (dict): Containing keys 'source', 'title', 'summary', 'body_text', 'url', 'published_at', 'cluster_id'.
        cursor (psycopg2.extensions.cursor, optional): Active transaction cursor.

    Returns:
        int: The primary key ID of the inserted article.

    Errors:
        psycopg2.IntegrityError: If the URL is not unique or cluster_id reference constraint fails.
        psycopg2.Error: On query execution errors.
    """
    sql = """
        INSERT INTO articles (source, title, summary, body_text, url, published_at, cluster_id)
        VALUES (%s, %s, %s, %s, %s, %s, %s)
        RETURNING id;
    """
    params = (
        article.get("source"),
        article.get("title"),
        article.get("summary"),
        article.get("body_text"),
        article.get("url"),
        article.get("published_at"),
        article.get("cluster_id")
    )

    if cursor:
        cursor.execute(sql, params)
        return cursor.fetchone()["id"]

    with connect() as conn:
        with transaction(conn) as cur:
            cur.execute(sql, params)
            return cur.fetchone()["id"]

def insert_cluster(label: str, cursor: psycopg2.extensions.cursor = None) -> int:
    """
    Inserts a new cluster record and returns its generated ID.

    Args:
        label (str): The cluster label name.
        cursor (psycopg2.extensions.cursor, optional): Active transaction cursor.

    Returns:
        int: The primary key ID of the inserted cluster.

    Errors:
        psycopg2.Error: On insertion or connection failure.
    """
    sql = "INSERT INTO clusters (label) VALUES (%s) RETURNING id;"
    
    if cursor:
        cursor.execute(sql, (label,))
        return cursor.fetchone()["id"]

    with connect() as conn:
        with transaction(conn) as cur:
            cur.execute(sql, (label,))
            return cur.fetchone()["id"]

def assign_cluster(article_url: str, cluster_id: int, cursor: psycopg2.extensions.cursor = None) -> bool:
    """
    Assigns an article (identified by URL) to a cluster ID.

    Args:
        article_url (str): The unique URL of the article.
        cluster_id (int): The target cluster ID.
        cursor (psycopg2.extensions.cursor, optional): Active transaction cursor.

    Returns:
        bool: True if an article was updated, False if no article matched the URL.

    Errors:
        psycopg2.Error: On database execution or constraint failures.
    """
    sql = "UPDATE articles SET cluster_id = %s WHERE url = %s RETURNING id;"
    
    if cursor:
        cursor.execute(sql, (cluster_id, article_url))
        return cursor.fetchone() is not None

    with connect() as conn:
        with transaction(conn) as cur:
            cur.execute(sql, (cluster_id, article_url))
            return cur.fetchone() is not None

def get_existing_clusters(cursor: psycopg2.extensions.cursor = None) -> List[Dict[str, Any]]:
    """
    Retrieves all cluster records currently stored in the database.

    Args:
        cursor (psycopg2.extensions.cursor, optional): Active transaction cursor.

    Returns:
        List[Dict[str, Any]]: List of dictionary items representing clusters (id and label).

    Errors:
        psycopg2.Error: On database select query failure.
    """
    sql = "SELECT id, label FROM clusters ORDER BY id;"
    
    if cursor:
        cursor.execute(sql)
        return list(cursor.fetchall())

    with connect() as conn:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(sql)
            return list(cur.fetchall())


# --- Backward Compatible API for main.py Scaffolding ---

def get_db_connection() -> psycopg2.extensions.connection:
    """
    Alias of connect() for compatibility with scaffolded entrypoints.
    """
    return connect()

def fetch_existing_urls() -> Set[str]:
    """
    Retrieves all unique article URLs currently stored in the database.
    """
    urls = set()
    try:
        with connect() as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT url FROM articles;")
                rows = cur.fetchall()
                for row in rows:
                    urls.add(row[0])
    except Exception as e:
        print(f"Warning: Failed to fetch existing URLs from database: {e}")
    return urls

def save_articles(articles: List[Dict[str, Any]]) -> None:
    """
    Helper function to save list of articles.
    """
    print(f"Database: Inserting batch of {len(articles)} articles.")
    for art in articles:
        try:
            if not article_exists(art["url"]):
                insert_article(art)
        except Exception as e:
            print(f"Warning: Failed to insert article {art['url']}: {e}")

def save_clusters(clusters: List[Dict[str, Any]]) -> None:
    """
    Helper function to insert/associate clusters (scaffold placeholder logic).
    """
    print(f"Database: Saving {len(clusters)} clusters.")
    # In scaffolding phase, just insert a dummy cluster to database
    for c in clusters:
        try:
            insert_cluster(c["label"])
        except Exception as e:
            print(f"Warning: Failed to insert cluster {c['label']}: {e}")
