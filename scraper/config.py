import os

# TODO:
# Load database connection string and options from environment variables.
# Define default values for CLI run profiles and clustering parameters.

# Database URL connection string
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/news_pulse")

# Default feed URLs to pull from if not overridden
DEFAULT_FEEDS = [
    "http://feeds.bbci.co.uk/news/rss.xml",
    "https://www.npr.org/rss/rss.php?id=1001",
    "https://rss.nytimes.com/services/xml/rss/nyt/HomePage.xml"
]

# Clustering parameters
SIMILARITY_THRESHOLD = float(os.getenv("SIMILARITY_THRESHOLD", "0.3"))
MAX_FEATURES = int(os.getenv("MAX_FEATURES", "5000"))
