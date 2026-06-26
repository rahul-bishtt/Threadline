import argparse
import time
from feeds import get_all_feed_articles
from normalize import normalize_article
from extract import extract_full_text
from db import fetch_existing_urls, insert_article

def run_pipeline(mode: str):
    start_time = time.time()
    print(f"==================================================")
    print(f"Starting News Pulse Ingestion Pipeline")
    print(f"Mode: {mode.upper()}")
    print(f"==================================================")

    # 1. Fetch RSS feeds (already logs feed-level success/failure stats inside feeds.py)
    raw_entries = get_all_feed_articles()
    
    # 2. Setup stats counters
    articles_fetched = len(raw_entries)
    duplicates_skipped = 0
    extraction_failures = 0
    successful_inserts = 0
    
    # Track URLs processed during this execution run (in-memory deduplication)
    seen_urls = set()
    
    # Fetch existing DB URLs for incremental mode
    existing_db_urls = set()
    if mode == "incremental":
        print("Fetching existing article URLs from PostgreSQL for deduplication...")
        existing_db_urls = fetch_existing_urls()
        print(f"Found {len(existing_db_urls)} existing articles in database.")

    # 3. Process entries sequentially and save continuously
    print("\nProcessing articles sequentially...")
    for idx, entry in enumerate(raw_entries, 1):
        try:
            # A. Normalize metadata
            normalized = normalize_article(entry)
            url = normalized.get("url")
            
            if not url:
                print(f"[{idx}/{articles_fetched}] Skip: Missing URL.")
                duplicates_skipped += 1
                continue
                
            # B. In-memory duplicate check
            if url in seen_urls:
                print(f"[{idx}/{articles_fetched}] Skip: Duplicate URL in current feed batch: {url}")
                duplicates_skipped += 1
                continue
            seen_urls.add(url)

            # C. Database duplicate check (in incremental mode)
            if mode == "incremental" and url in existing_db_urls:
                print(f"[{idx}/{articles_fetched}] Skip: Already exists in database: {url}")
                duplicates_skipped += 1
                continue

            # D. Download and extract full body text (best-effort, with retries)
            print(f"[{idx}/{articles_fetched}] Processing: {normalized['title'][:60]}... ({normalized['source']})")
            body_text = extract_full_text(url, normalized["summary"])
            
            # If body_text is empty or fell back to summary, count it as extraction failure
            if not body_text or body_text == normalized["summary"]:
                extraction_failures += 1
                print(f" -> Info: Extraction failed or used RSS summary fallback.")
                
            normalized["body_text"] = body_text
            # Leave cluster_id as NULL
            normalized["cluster_id"] = None

            # E. Store immediately in PostgreSQL (continuous saving)
            article_id = insert_article(normalized, overwrite=(mode == "full"))
            
            if article_id:
                successful_inserts += 1
                action = "Reprocessed/Updated" if mode == "full" and url in existing_db_urls else "Inserted"
                print(f" -> Success: {action} into DB (ID: {article_id}).")
            else:
                # If DO NOTHING was triggered and no row returned
                duplicates_skipped += 1
                print(f" -> Info: Already in DB, no changes made.")
                
        except Exception as e:
            print(f"[{idx}/{articles_fetched}] Error: Failed to process article: {e}")
            # Do not stop the pipeline; proceed to next article

    # 4. Print metrics summary
    duration = time.time() - start_time
    print(f"\n==================================================")
    print(f"News Pulse Ingestion Pipeline Summary")
    print(f"==================================================")
    print(f"Running Mode:        {mode.upper()}")
    print(f"Articles Fetched:    {articles_fetched}")
    print(f"Duplicates Skipped:  {duplicates_skipped}")
    print(f"Extraction Failures: {extraction_failures}")
    print(f"Successful Inserts:  {successful_inserts}")
    print(f"Total Execution Time: {duration:.2f} seconds")
    print(f"==================================================")

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
