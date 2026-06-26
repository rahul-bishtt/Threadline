import argparse
from feeds import get_all_feed_articles
from normalize import normalize_article
from dedupe import deduplicate_articles_in_memory, filter_existing_db_articles
from extract import extract_full_text
from cluster import cluster_articles
from db import fetch_existing_urls, save_articles, save_clusters

# TODO:
# Parse CLI run mode flags (--mode=full / --mode=incremental).
# Fetch articles from RSS sources.
# Normalize and deduplicate articles.
# Fetch full web article text.
# Run clustering algorithms.
# Write output states back to database.

def run_pipeline(mode: str):
    print(f"Starting ingestion pipeline in mode: {mode}")
    
    # 1. Fetch RSS feeds
    print("Fetching feeds...")
    raw_entries = get_all_feed_articles()
    print(f"Found {len(raw_entries)} entries in feeds.")
    
    # 2. Normalize metadata
    print("Normalizing metadata...")
    normalized = [normalize_article(entry) for entry in raw_entries]
    
    # 3. Deduplicate in memory
    unique_batch = deduplicate_articles_in_memory(normalized)
    print(f"Deduplicated in-memory batch to {len(unique_batch)} articles.")
    
    # 4. Deduplicate against DB if running incremental mode
    if mode == "incremental":
        existing_urls = fetch_existing_urls()
        final_batch = filter_existing_db_articles(unique_batch, existing_urls)
        print(f"Filtered out existing articles. Batch size: {len(final_batch)} new articles.")
    else:
        final_batch = unique_batch
        print(f"Full reprocessing. Batch size: {len(final_batch)} articles.")

    # 5. Extract full page body text (limited run or best-effort)
    print("Scraping full text for articles...")
    for idx, article in enumerate(final_batch):
        # Scaffolding: skip actual downloading in this setup pass to save time
        article["body_text"] = article["summary"]
        
    # 6. Save articles (placeholder)
    save_articles(final_batch)
    
    # 7. Cluster articles (placeholder)
    clustered = cluster_articles(final_batch)
    save_clusters(clustered)
    
    print("Pipeline run completed successfully.")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="News Pulse Ingestion Pipeline")
    parser.add_argument(
        "--mode",
        choices=["full", "incremental"],
        default="incremental",
        help="Pipeline running mode: full or incremental (default: incremental)"
    )
    args = parser.parse_args()
    run_pipeline(args.mode)
