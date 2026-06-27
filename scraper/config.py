import os

# TODO:
# Load database connection string and options from environment variables.
# Define default values for CLI run profiles and clustering parameters.

from pathlib import Path

# Load env variables from .env if it exists
env_path = Path(__file__).parent / ".env"
if env_path.exists():
    with open(env_path, "r") as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                key, val = line.split("=", 1)
                os.environ[key.strip()] = val.strip()

# Database URL connection string
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/news_pulse")

# Default feed URLs to pull from if not overridden
DEFAULT_FEEDS = [
    "http://feeds.bbci.co.uk/news/rss.xml",
    "https://www.npr.org/rss/rss.php?id=1001",
    "https://rss.nytimes.com/services/xml/rss/nyt/HomePage.xml"
]

# Clustering parameters
CLUSTER_THRESHOLD = int(os.getenv("CLUSTER_THRESHOLD", "4"))
SIMILARITY_THRESHOLD = float(os.getenv("SIMILARITY_THRESHOLD", "0.3"))
MAX_FEATURES = int(os.getenv("MAX_FEATURES", "5000"))

# Proper Noun (PN) soft constraint parameters
PN_BOOST_FACTOR = float(os.getenv("PN_BOOST_FACTOR", "1.5"))
PN_PENALTY_FACTOR = float(os.getenv("PN_PENALTY_FACTOR", "0.4"))
PN_DISTINCTIVE_IDF_THRESHOLD = float(os.getenv("PN_DISTINCTIVE_IDF_THRESHOLD", "2.20"))
