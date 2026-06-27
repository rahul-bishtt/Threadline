import re
import math
from collections import Counter, defaultdict
from typing import List, Dict, Any, Set
from nltk.stem import PorterStemmer
from config import CLUSTER_THRESHOLD, PN_BOOST_FACTOR, PN_PENALTY_FACTOR, PN_DISTINCTIVE_IDF_THRESHOLD
from db import (
    transaction,
    get_existing_clusters,
    get_all_articles,
    get_unclustered_articles,
    clear_all_article_assignments,
    delete_all_clusters,
    insert_cluster,
    update_cluster,
    assign_cluster
)

# Instantiate global stemmer
stemmer = PorterStemmer()

# Comprehensive list of standard English stopwords + media boilerplate + common generic words + contraction roots
STOPWORDS = {
    "a", "about", "above", "after", "again", "against", "all", "am", "an", "and", "any", "are", "aren't", "as", "at",
    "be", "because", "been", "before", "being", "below", "between", "both", "but", "by", "can", "can't", "cannot",
    "could", "couldn't", "did", "didn't", "do", "does", "doesn't", "doing", "don't", "down", "during", "each", "few",
    "for", "from", "further", "had", "hadn't", "has", "hasn't", "have", "haven't", "having", "he", "he'd", "he'll",
    "he's", "her", "here", "here's", "hers", "herself", "him", "himself", "his", "how", "how's", "i", "i'd", "i'll",
    "i'm", "i've", "if", "in", "into", "is", "isn't", "it", "it's", "its", "itself", "let's", "me", "more", "most",
    "mustn't", "my", "myself", "no", "nor", "not", "of", "off", "on", "once", "only", "or", "other", "ought", "our",
    "ours", "ourselves", "out", "over", "own", "same", "shan't", "she", "she'd", "she'll", "she's", "should",
    "shouldn't", "so", "some", "such", "than", "that", "that's", "the", "their", "theirs", "them", "themselves",
    "then", "there", "there's", "these", "they", "they'd", "they'll", "they're", "they've", "this", "those",
    "through", "to", "too", "under", "until", "up", "very", "was", "wasn't", "we", "we'd", "we'll", "we're", "we've",
    "were", "weren't", "what", "what's", "when", "when's", "where", "where's", "which", "while", "who", "who's",
    "whom", "why", "why's", "with", "won't", "would", "wouldn't", "you", "you'd", "you'll", "you're", "you've",
    "your", "yours", "yourself", "yourselves", "will", "shall", "says", "said", "new", "one", "two", "also",
    "first", "last", "like", "us", "uk", "u", "s", "pm", "today", "yesterday", "world", "news", "people", "year",
    "years", "could", "would", "many", "three", "four", "five", "june", "july", "august", "september",
    "bbc", "npr", "nytimes", "published", "get", "related", "homepage", "collection", "image", "caption",
    "copyright", "external", "link", "share", "read", "more", "click", "page", "content", "media", "video",
    "audio", "play", "original", "report", "reporting", "source", "newsletter", "subscribe", "email",
    "advertising", "advertisement", "support", "app", "download", "follow", "twitter", "facebook", "instagram",
    "youtube", "story", "stories", "time", "date", "day", "days", "week", "weeks", "month", "months", "mr",
    "mrs", "dr", "pm", "am", "ad", "ads", "website", "online", "view", "watch",
    # Additional common generic verbs, adverbs, and adjectives to filter
    "another", "now", "told", "back", "go", "goes", "going", "take", "takes", "taking", "make", "makes", "making",
    "made", "come", "comes", "came", "gets", "getting", "got", "put", "puts", "putting", "look", "looks", "looking",
    "want", "wants", "wanted", "give", "gives", "giving", "gave", "find", "finds", "found", "say", "saying",
    "think", "thinks", "thought", "tell", "tells", "ask", "asks", "asked", "show", "shows", "showed", "call",
    "calls", "called", "keep", "keeps", "kept", "start", "starts", "started", "run", "runs", "running", "write",
    "writes", "wrote", "set", "sets", "use", "uses", "used", "using", "work", "works", "worked", "part", "parts",
    "life", "old", "good", "best", "great", "high", "low", "big", "small", "little", "long", "short", "own",
    "end", "ends", "ended", "begin", "begins", "began", "still", "even", "well", "way", "much", "many", "never",
    "always", "something", "anything", "nothing", "everything", "someone", "anyone", "everyone", "noone",
    "become", "becomes", "became", "seemed", "seems", "seem", "told", "tell", "another", "try", "tries", "tried",
    "put", "need", "needs", "needed", "may", "might", "must",
    # News site navigation keywords to prevent cross-site matching
    "sport", "business", "innovation", "culture", "travel", "earth", "live", "weather", "home", "worklife",
    "future", "opinion", "arts", "television", "politics", "local", "national", "international", "section",
    "topics", "header", "footer", "navigation", "menu", "search", "sign", "register", "top", "just", "place",
    "point", "points", "thing", "things", "front", "left", "right", "side", "sides", "category", "categories",
    # Contraction root fragments
    "don", "doesn", "didn", "haven", "hasn", "isn", "aren", "wasn", "weren", "won", "wouldn", "couldn", "shouldn",
    # Day and month names
    "monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday",
    "january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december",
    # Other highly common non-topic nouns/adverbs/prepositions
    "know", "knows", "knew", "known", "ago", "last", "next", "past", "since", "during", "before", "after", "while", "until",
    "close", "closer", "far", "away", "often", "here", "there", "every", "each", "both", "either", "neither", "some",
    "including", "across", "among", "added", "along", "without", "within", "together", "throughout", "whose", "whom",
    "whoever", "whichever", "family", "staff", "senior",
    # New requested stopwords to expand
    "latest", "reported", "expected", "early", "around", "really", "several", "according", "breaking", "live",
    "update", "updates", "should", "company", "article", "reports"
}

def tokenize(text: str) -> Set[str]:
    """
    Cleans, lowercases, tokenizes, and stems raw strings using PorterStemmer,
    removing standard English stopwords.
    Returns a set of unique stemmed keywords of length > 2.
    """
    if not text:
        return set()
    words = re.findall(r"[a-z]+", text.lower())
    result = set()
    for w in words:
        if w in STOPWORDS:
            continue
        stemmed = stemmer.stem(w)
        if stemmed not in STOPWORDS and len(stemmed) > 2:
            result.add(stemmed)
    return result

def compute_idf(articles: List[Dict[str, Any]]) -> Dict[str, float]:
    """
    Computes Inverse Document Frequency (IDF) dynamically across a collection of articles.
    """
    total_docs = len(articles)
    if total_docs == 0:
        return {}
    
    doc_counts = Counter()
    for art in articles:
        state = get_article_matching_tokens(art)
        doc_counts.update(state["tokens"])
        
    idf = {}
    for word, count in doc_counts.items():
        # Classic smooth IDF formula: log((total_docs + 1) / (count + 0.5))
        idf[word] = math.log((total_docs + 1) / (count + 0.5))
    return idf

def get_article_matching_tokens(art: Dict[str, Any]) -> Dict[str, Any]:
    """
    Retrieves and caches tokenized representations of the article's title, summary,
    and body proper nouns.
    """
    if "_matching_state" not in art:
        title = art.get("title", "") or ""
        summary = art.get("summary", "") or ""
        body = art.get("body_text", "") or ""
        
        def extract_field_tokens(text: str) -> Set[str]:
            if not text:
                return set()
            words = re.findall(r"[a-zA-Z0-9]+", text)
            t_set = set()
            for w in words:
                wl = w.lower()
                if wl in STOPWORDS:
                    continue
                stemmed = stemmer.stem(wl)
                if stemmed not in STOPWORDS and len(stemmed) > 2:
                    t_set.add(stemmed)
                if w and w[0].isupper() and len(w) >= 4:
                    prefix = wl[:5]
                    if prefix not in STOPWORDS:
                        t_set.add(f"PN_{prefix}")
            return t_set
            
        title_tokens = extract_field_tokens(title)
        summary_tokens = extract_field_tokens(summary)
        
        # Extract proper nouns from body text to augment matching
        body_pn_tokens = set()
        body_words = re.findall(r"[a-zA-Z0-9]+", body)
        for w in body_words:
            if w and w[0].isupper() and len(w) >= 4:
                prefix = w.lower()[:5]
                if prefix not in STOPWORDS:
                    body_pn_tokens.add(f"PN_{prefix}")
                    
        tokens = title_tokens | summary_tokens | body_pn_tokens
        
        art["_matching_state"] = {
            "tokens": tokens,
            "title_tokens": title_tokens,
            "summary_tokens": summary_tokens
        }
    return art["_matching_state"]

def compute_pairwise_similarity(art1: Dict[str, Any], art2: Dict[str, Any], idf: Dict[str, float]) -> float:
    """
    Computes Weighted Overlap Coefficient similarity score between two articles,
    normalized by maximum document length to prevent short-article false merges.
    """
    state1 = get_article_matching_tokens(art1)
    state2 = get_article_matching_tokens(art2)
    
    overlap = state1["tokens"] & state2["tokens"]
    if not overlap:
        return 0.0
        
    weights = {"title": 3.0, "summary": 1.5, "body": 0.5}
    
    overlap_sum = 0.0
    for w in overlap:
        idf_val = idf.get(w, 1.0)
        
        # Determine weight for art1
        w1 = weights["body"]
        if w in state1["title_tokens"]:
            w1 = weights["title"]
        elif w in state1["summary_tokens"]:
            w1 = weights["summary"]
            
        # Determine weight for art2
        w2 = weights["body"]
        if w in state2["title_tokens"]:
            w2 = weights["title"]
        elif w in state2["summary_tokens"]:
            w2 = weights["summary"]
            
        overlap_sum += ((w1 + w2) / 2.0) * idf_val
        
    if overlap_sum == 0.0:
        return 0.0
        
    sum1 = 0.0
    for w in (state1["title_tokens"] | state1["summary_tokens"]):
        idf_val = idf.get(w, 1.0)
        w1 = weights["summary"]
        if w in state1["title_tokens"]:
            w1 = weights["title"]
        sum1 += w1 * idf_val
        
    sum2 = 0.0
    for w in (state2["title_tokens"] | state2["summary_tokens"]):
        idf_val = idf.get(w, 1.0)
        w2 = weights["summary"]
        if w in state2["title_tokens"]:
            w2 = weights["title"]
        sum2 += w2 * idf_val
        
    max_sum = max(sum1, sum2)
    if max_sum == 0.0:
        return 0.0
        
    # Scale to fit CLUSTER_THRESHOLD scale (0 - 10)
    score = (overlap_sum / max_sum) * 80.0

    # Proper Noun Soft Co-Occurrence Constraint
    pn1 = {w for w in state1["tokens"] if w.startswith("PN_")}
    pn2 = {w for w in state2["tokens"] if w.startswith("PN_")}
    
    distinctive_pn1 = {w for w in pn1 if idf.get(w, 4.0) >= PN_DISTINCTIVE_IDF_THRESHOLD}
    distinctive_pn2 = {w for w in pn2 if idf.get(w, 4.0) >= PN_DISTINCTIVE_IDF_THRESHOLD}
    
    shared_distinctive = distinctive_pn1 & distinctive_pn2
    if shared_distinctive:
        score *= PN_BOOST_FACTOR
    else:
        score *= PN_PENALTY_FACTOR

    return score

def get_representative_keywords(member_articles: List[Dict[str, Any]], limit: int = 20, idf: Dict[str, float] = None) -> List[str]:
    """
    Computes the top N representative keywords across all member articles of a cluster.
    Ranks by TF-IDF if `idf` is provided, otherwise falls back to frequency.
    """
    counter = Counter()
    for art in member_articles:
        combined = f"{art.get('title', '')} {art.get('summary', '')} {art.get('body_text', '')}"
        counter.update(tokenize(combined))
    
    if idf:
        # Rank by total TF-IDF score for each word: frequency in cluster * idf weight
        word_scores = {w: count * idf.get(w, 1.0) for w, count in counter.items()}
        sorted_words = sorted(word_scores.keys(), key=lambda w: (-word_scores[w], w))
        return sorted_words[:limit]
    else:
        return [item[0] for item in counter.most_common(limit)]

def generate_cluster_label(member_articles: List[Dict[str, Any]], idf: Dict[str, float] = None) -> str:
    """
    Generates a human-readable title-cased label from cased, weighted candidate phrases
    ranging from 1 to 4 words, prioritizing proper nouns and named entities.
    """
    if not member_articles:
        return "General News"
        
    candidates = defaultdict(lambda: {
        "score": 0.0,
        "cased_counter": Counter(),
        "length": 0
    })
    
    # Common news acronyms to preserve or uppercase
    ACRONYMS = {
        "ai", "wwdc", "fifa", "nasa", "covid", "us", "uk", "eu", "ceo", "gop",
        "cpu", "gpu", "ny", "nyc", "fbi", "cia", "un", "imf", "who", "fda",
        "sec", "ftc", "dns", "ip"
    }

    # Specific casing mappings for entities with mixed case
    CASING_MAP = {
        "openai": "OpenAI",
        "youtube": "YouTube",
        "facebook": "Facebook",
        "twitter": "Twitter",
        "netflix": "Netflix",
        "google": "Google",
        "apple": "Apple",
        "wimbledon": "Wimbledon",
    }

    has_titles = any(art.get("title") for art in member_articles)
    
    for art in member_articles:
        if has_titles:
            texts = [(art.get("title", "") or "", 5.0)]
        else:
            texts = [
                (art.get("summary", "") or "", 2.0),
                (art.get("body_text", "") or "", 1.0)
            ]
            
        for text, field_weight in texts:
            if not text:
                continue
                
            # Split into sentences to avoid phrases crossing sentence boundaries
            sentences = re.split(r"[.!?\n]+", text)
            for sen in sentences:
                # Strip possessive 's or 'S (supporting straight and curly quotes) to prevent trailing "S" in labels
                sen_cleaned = re.sub(r"['’]\s*[sS]\b", "", sen)
                # Match words: letters and digits
                words = re.findall(r"[a-zA-Z0-9]+", sen_cleaned)
                if not words:
                    continue
                    
                # Generate phrases of length 1, 2, 3, 4
                for n in (1, 2, 3, 4):
                    for i in range(len(words) - n + 1):
                        phrase_words = words[i : i + n]
                        
                        # Boundary constraint: first and last word cannot be stopwords
                        first_word = phrase_words[0].lower()
                        last_word = phrase_words[-1].lower()
                        if first_word in STOPWORDS or last_word in STOPWORDS:
                            continue
                            
                        # Word validity validation
                        valid = True
                        for w in phrase_words:
                            wl = w.lower()
                            # STOPWORDS inside multi-word phrases are allowed (e.g. "Conflict in Iran")
                            if wl in STOPWORDS:
                                continue
                            if len(w) <= 2:
                                if not (w.isdigit() and len(w) >= 3) and wl not in ACRONYMS:
                                    valid = False
                                    break
                                    
                        if not valid:
                            continue
                            
                        # Proper noun validation: must have at least one capitalized word in phrase
                        capitalized_count = sum(1 for w in phrase_words if w and w[0].isupper())
                        if capitalized_count == 0:
                            continue
                            
                        # Build normalized and cased representations
                        norm_words = [w.lower() for w in phrase_words]
                        norm_phrase = " ".join(norm_words)
                        cased_phrase = " ".join(phrase_words)
                        
                        # Calculate scores: proper noun density bonus
                        proper_noun_ratio = capitalized_count / len(phrase_words)
                        proper_noun_multiplier = 1.0 + (proper_noun_ratio * 2.0)
                        
                        # IDF weight of phrase keywords
                        idf_score = 1.0
                        if idf:
                            idf_score = sum(idf.get(w, 1.0) for w in norm_words if w not in STOPWORDS)
                        
                        match_score = field_weight * proper_noun_multiplier * idf_score
                        
                        candidates[norm_phrase]["score"] += match_score
                        candidates[norm_phrase]["cased_counter"][cased_phrase] += 1
                        candidates[norm_phrase]["length"] = n

    if not candidates:
        return "General News"
        
    valid_candidates = []
    for norm_phrase, info in candidates.items():
        score = info["score"]
        # Apply length multipliers
        n = info["length"]
        if n == 2:
            score *= 1.3
        elif n == 3:
            score *= 1.5
        elif n == 4:
            score *= 1.2
        elif n == 1:
            score *= 0.7
            
        valid_candidates.append({
            "norm_phrase": norm_phrase,
            "score": score,
            "cased_counter": info["cased_counter"],
            "length": n
        })
        
    if not valid_candidates:
        return "General News"
        
    # Sort deterministically: highest score first, then alphabetical on norm_phrase
    valid_candidates.sort(key=lambda x: (-x["score"], x["norm_phrase"]))
    
    best_candidate = valid_candidates[0]
    
    # Choose cased version deterministically: highest frequency, then alphabetical
    best_cased_tuple = sorted(
        best_candidate["cased_counter"].items(),
        key=lambda x: (-x[1], x[0])
    )[0]
    best_cased = best_cased_tuple[0]
    
    # Apply acronym and title formatting to each word in the label
    words_formatted = []
    for w in best_cased.split():
        wl = w.lower()
        if wl in CASING_MAP:
            words_formatted.append(CASING_MAP[wl])
        elif wl in ACRONYMS:
            words_formatted.append(w.upper())
        elif w.isupper() and len(w) > 1:
            words_formatted.append(w)
        else:
            words_formatted.append(w.capitalize())
            
    return " ".join(words_formatted)

def refresh_cluster_metadata(cluster_id: int, label: str, cursor: Any, idf: Dict[str, float] = None) -> None:
    """
    Recomputes and saves a cluster's representative keywords and human-readable label
    based on the current set of assigned articles.
    
    Args:
        cluster_id (int): Target cluster ID.
        label (str): Current label name.
        cursor (Any): Active database transaction cursor.
        idf (Dict[str, float], optional): Global IDF weights.
    """
    # Fetch all articles in this cluster
    cursor.execute(
        "SELECT title, summary, body_text FROM articles WHERE cluster_id = %s;",
        (cluster_id,)
    )
    rows = cursor.fetchall()
    
    if not rows:
        return

    articles_list = [dict(row) for row in rows]
    
    # 1. Recompute label
    new_label = generate_cluster_label(articles_list, idf=idf)
    
    # 2. Recompute representative keywords (top 20)
    new_keywords = get_representative_keywords(articles_list, limit=20, idf=idf)
    
    # 3. Update database
    update_cluster(cluster_id, new_label, new_keywords, cursor=cursor)

def print_clustering_report(cursor: Any) -> None:
    """
    Prints a detailed post-clustering quality metrics report.
    """
    cursor.execute("SELECT COUNT(*) FROM articles;")
    row1 = cursor.fetchone()
    total_articles = row1["count"] if hasattr(row1, "get") and "count" in row1 else list(row1.values())[0] if hasattr(row1, "values") else row1[0]
    
    cursor.execute("SELECT COUNT(*) FROM clusters;")
    row2 = cursor.fetchone()
    total_clusters = row2["count"] if hasattr(row2, "get") and "count" in row2 else list(row2.values())[0] if hasattr(row2, "values") else row2[0]
    
    if total_clusters == 0:
        print("\n=== CLUSTERING REPORT ===")
        print("No clusters in database.")
        print("=========================")
        return
        
    cursor.execute("""
        SELECT cluster_id, COUNT(*) as size 
        FROM articles 
        WHERE cluster_id IS NOT NULL 
        GROUP BY cluster_id;
    """)
    sizes = [row.get("size") if hasattr(row, "get") else row[1] for row in cursor.fetchall()]
    
    avg_size = total_articles / total_clusters if total_clusters > 0 else 0.0
    largest = max(sizes) if sizes else 0
    singletons = sum(1 for s in sizes if s == 1)
    
    print("\n==========================================")
    print("         CLUSTERING ENGINE REPORT")
    print("==========================================")
    print(f"Total Articles:       {total_articles}")
    print(f"Total Clusters:       {total_clusters}")
    print(f"Average Cluster Size: {avg_size:.2f}")
    print(f"Largest Cluster Size: {largest}")
    print(f"Singleton Clusters:   {singletons}")
    print("==========================================")

def run_incremental_clustering(conn: Any) -> Dict[str, Any]:
    """
    Clusters unclustered articles incrementally.
    Compares articles to active clusters based on their member articles.
    Assigns matches to existing clusters or spawns new ones.
    
    Args:
        conn (Any): PostgreSQL connection object.
        
    Returns:
        Dict[str, Any]: Summary metrics of the run.
    """
    metrics = {
        "total_clustered": 0,
        "existing_reused": 0,
        "new_created": 0,
        "decisions": []
    }

    with transaction(conn) as cur:
        # Fetch all articles to build global IDF once
        all_articles = get_all_articles(cur)
        idf = compute_idf(all_articles)

        # 1. Fetch unclustered articles
        unclustered = get_unclustered_articles(cur)
        if not unclustered:
            print_clustering_report(cur)
            return metrics

        # 2. Fetch existing clusters with their member articles
        active_clusters = get_existing_clusters(cur)
        clusters_state = []
        for c in active_clusters:
            cur.execute("SELECT title, summary, body_text FROM articles WHERE cluster_id = %s;", (c["id"],))
            members = [dict(row) for row in cur.fetchall()]
            clusters_state.append({
                "id": c["id"],
                "label": c["label"],
                "articles": members
            })

        for art in unclustered:
            best_match = None
            max_score = -1.0
            
            # Compare overlap against existing active clusters using average linkage
            for c_state in clusters_state:
                if not c_state["articles"]:
                    continue
                # Calculate average pairwise similarity
                total_sim = sum(compute_pairwise_similarity(art, member, idf) for member in c_state["articles"])
                avg_sim = total_sim / len(c_state["articles"])
                
                if avg_sim > max_score:
                    max_score = avg_sim
                    best_match = c_state
            
            # If average similarity score matches threshold, assign
            if max_score >= CLUSTER_THRESHOLD and best_match:
                cluster_id = best_match["id"]
                assign_cluster(art["url"], cluster_id, cur)
                
                # Recompute representative keywords and label
                refresh_cluster_metadata(cluster_id, best_match["label"], cur, idf=idf)
                
                # Retrieve updated label/keywords and add this article to our in-memory cache
                cur.execute("SELECT label FROM clusters WHERE id = %s;", (cluster_id,))
                updated_row = cur.fetchone()
                best_match["label"] = updated_row["label"] if isinstance(updated_row, dict) else updated_row[0]
                best_match["articles"].append(art)

                metrics["total_clustered"] += 1
                metrics["existing_reused"] += 1
                metrics["decisions"].append({
                    "title": art["title"],
                    "cluster_label": best_match["label"],
                    "overlap": round(max_score, 2),
                    "decision": "Existing Cluster"
                })
            else:
                # Create a new cluster
                label_candidates = [{"title": art["title"], "summary": art["summary"], "body_text": art["body_text"]}]
                new_label = generate_cluster_label(label_candidates, idf=idf)
                new_keywords = get_representative_keywords(label_candidates, limit=20, idf=idf)
                
                new_id = insert_cluster(new_label, new_keywords, cur)
                assign_cluster(art["url"], new_id, cur)
                
                # Add to in-memory active list for subsequent articles in the batch
                clusters_state.append({
                    "id": new_id,
                    "label": new_label,
                    "articles": [art]
                })

                metrics["total_clustered"] += 1
                metrics["new_created"] += 1
                metrics["decisions"].append({
                    "title": art["title"],
                    "cluster_label": new_label,
                    "overlap": round(max_score, 2),
                    "decision": "New Cluster"
                })

        print_clustering_report(cur)
    return metrics

def run_full_clustering(conn: Any) -> Dict[str, Any]:
    """
    Wipes existing clusters and re-clusters all database articles from scratch.
    
    Args:
        conn (Any): PostgreSQL connection object.
        
    Returns:
        Dict[str, Any]: Summary metrics of the run.
    """
    metrics = {
        "total_clustered": 0,
        "existing_reused": 0,  # Always 0 for full run
        "new_created": 0,
        "decisions": []
    }

    with transaction(conn) as cur:
        # 1. Wipe clusters and reset article assignments
        clear_all_article_assignments(cur)
        delete_all_clusters(cur)

        # 2. Fetch all articles to cluster
        articles = get_all_articles(cur)
        if not articles:
            print_clustering_report(cur)
            return metrics

        # Compute global IDF once for the run
        idf = compute_idf(articles)

        # In-memory structures to build cluster groups
        # Format: {"label": str, "articles": list}
        in_memory_clusters = []

        for art in articles:
            best_match = None
            max_score = -1.0
            
            for c in in_memory_clusters:
                # Calculate average pairwise similarity
                total_sim = sum(compute_pairwise_similarity(art, member, idf) for member in c["articles"])
                avg_sim = total_sim / len(c["articles"])
                
                if avg_sim > max_score:
                    max_score = avg_sim
                    best_match = c
            
            if max_score >= CLUSTER_THRESHOLD and best_match:
                best_match["articles"].append(art)
                
                metrics["total_clustered"] += 1
                metrics["decisions"].append({
                    "title": art["title"],
                    "cluster_label": best_match["label"], # Placeholder
                    "overlap": round(max_score, 2),
                    "decision": "Existing Cluster"
                })
            else:
                new_c = {
                    "label": "", # Generated dynamically after grouping
                    "articles": [art]
                }
                in_memory_clusters.append(new_c)
                
                metrics["total_clustered"] += 1
                metrics["new_created"] += 1
                metrics["decisions"].append({
                    "title": art["title"],
                    "cluster_label": "", # Generated later
                    "overlap": round(max_score, 2),
                    "decision": "New Cluster"
                })

        # 3. Persist final clusters and assign IDs
        for c in in_memory_clusters:
            # Generate correct label based on final group members
            c["label"] = generate_cluster_label(c["articles"], idf=idf)
            
            # Generate representative keywords for SQL insertion
            new_keywords = get_representative_keywords(c["articles"], limit=20, idf=idf)
            
            # Save to PostgreSQL
            cluster_id = insert_cluster(c["label"], new_keywords, cur)
            
            # Update assignments for all member articles
            for art in c["articles"]:
                assign_cluster(art["url"], cluster_id, cur)
                
            # Back-fill label in metrics logging
            for dec in metrics["decisions"]:
                if dec["title"] in [a["title"] for a in c["articles"]]:
                    dec["cluster_label"] = c["label"]

        print_clustering_report(cur)
    return metrics
