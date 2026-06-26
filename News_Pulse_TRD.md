# Technical Requirements Document: News Pulse

**Topic-Clustered News Timeline**
Version 1.0 | Companion to PRD v1.0

---

## 1. Purpose & Scope

This TRD defines *how* News Pulse will be built: stack choices, repo layout, data schemas, algorithms, API contracts, and deployment topology. It assumes the PRD's functional requirements as given and focuses on implementation-level decisions an engineer needs to start coding without re-deriving design choices mid-build.

---

## 2. Tech Stack

| Layer | Choice | Notes |
|---|---|---|
| Ingestion/Clustering | Python 3.11+ | `feedparser`, `requests`, `trafilatura` (or `newspaper3k`/`BeautifulSoup`), `scikit-learn` (only if TF-IDF route), `python-dateutil` |
| Database | PostgreSQL (via hosted free tier, e.g. Neon/Supabase/Railway) | Relational fit for articles↔clusters; SQLite acceptable for local dev fallback |
| Backend | Node.js 20+, Express | `pg` (or `prisma`/`knex`), `dotenv`, `cors`, `child_process` (to invoke Python) |
| Frontend | Next.js 14+ (App Router), React | `recharts` or `visx` for timeline; Tailwind CSS for styling |
| Deployment | Vercel (frontend), Render or Railway (backend + pipeline), Neon/Supabase (DB) | All free-tier compatible |
| Scheduling (optional) | GitHub Actions cron, or Render Cron Job | Calls the Node `/ingest/trigger` endpoint or invokes the Python script directly |

**Why Postgres over Mongo/SQLite:** articles belong to clusters in a clean 1-to-many relationship, and the timeline endpoint needs time-range aggregation (`MIN`/`MAX` over published_at grouped by cluster) — straightforward in SQL, fine in Mongo too, but Postgres keeps both pipeline and API on the same well-understood query model. (Document Mongo or SQLite instead in README if you choose otherwise — functionally equivalent for this scale.)

---

## 3. Repository Structure

```
news-pulse/
├── scraper/                     # Python ingestion + clustering
│   ├── main.py                  # entrypoint: run(), supports --full / --incremental
│   ├── feeds.py                 # feed source config + fetch/parse
│   ├── normalize.py             # schema normalization, date parsing
│   ├── extract.py               # full-article body extraction
│   ├── dedupe.py                # URL/content-hash based dedupe
│   ├── cluster.py                # clustering logic (keyword or TF-IDF)
│   ├── db.py                    # DB read/write layer
│   ├── config.py                # env var loading
│   ├── requirements.txt
│   └── tests/
├── backend/                     # Node/Express API
│   ├── src/
│   │   ├── server.js
│   │   ├── routes/
│   │   │   ├── clusters.js
│   │   │   ├── timeline.js
│   │   │   └── ingest.js
│   │   ├── db/
│   │   │   ├── pool.js
│   │   │   └── queries.js
│   │   ├── jobs/
│   │   │   └── jobStore.js      # in-memory or DB-backed job status tracking
│   │   └── middleware/
│   │       ├── errorHandler.js
│   │       └── validate.js
│   ├── package.json
│   └── .env.example
├── frontend/                    # Next.js app
│   ├── app/
│   │   ├── page.tsx             # timeline view
│   │   └── api/                 # (if any server actions/proxies needed)
│   ├── components/
│   │   ├── Timeline.tsx
│   │   ├── ClusterDetail.tsx
│   │   ├── SourceFilter.tsx
│   │   └── RefreshButton.tsx
│   ├── lib/api.ts                # fetch wrappers for backend
│   ├── package.json
│   └── .env.example
├── README.md
└── .github/workflows/ingest-cron.yml   # optional scheduled ingestion
```

---

## 4. Database Schema

```sql
CREATE TABLE clusters (
  id            SERIAL PRIMARY KEY,
  label         TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE articles (
  id            SERIAL PRIMARY KEY,
  source        TEXT NOT NULL,
  title         TEXT NOT NULL,
  summary       TEXT,
  body_text     TEXT,
  url           TEXT NOT NULL UNIQUE,
  published_at  TIMESTAMPTZ,
  fetched_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  cluster_id    INTEGER REFERENCES clusters(id) ON DELETE SET NULL
);

CREATE INDEX idx_articles_cluster_id ON articles(cluster_id);
CREATE INDEX idx_articles_published_at ON articles(published_at);
```

**Notes:**
- `url` UNIQUE constraint is the primary dedupe mechanism (`INSERT ... ON CONFLICT (url) DO NOTHING`)
- `cluster_id` nullable to allow a staging state (article fetched, not yet clustered)
- Timeline-relevant aggregates (`start_time`, `end_time`, `article_count`) are computed at query time, not stored, to avoid drift:

```sql
SELECT c.id, c.label,
       COUNT(a.id)        AS article_count,
       MIN(a.published_at) AS start_time,
       MAX(a.published_at) AS end_time
FROM clusters c
JOIN articles a ON a.cluster_id = c.id
GROUP BY c.id, c.label
ORDER BY start_time DESC;
```

---

## 5. Ingestion Pipeline — Implementation Detail

### 5.1 Flow
```
fetch feeds → parse + normalize → dedupe against DB by url →
fetch full article body (best-effort) → persist articles →
run clustering over unclustered + recently-touched articles →
update cluster assignments → done
```

### 5.2 Normalization target schema (internal, pre-DB)
```python
{
  "source": str,
  "title": str,
  "summary": str,
  "url": str,
  "published_at": datetime | None,  # parsed via dateutil.parser, fallback: fetched_at
}
```

### 5.3 Full-text extraction
- Primary: `trafilatura.extract(downloaded_html)`
- On exception or empty result: log warning, store `summary` as `body_text` fallback, continue loop (never raise out of the per-article try block)

### 5.4 Dedupe strategy
- DB-level: `UNIQUE(url)` constraint + upsert-or-skip
- Within a single run: dedupe in-memory by URL before insert attempts, to reduce redundant HTTP calls

### 5.5 Clustering — Option A (Keyword Overlap), reference implementation
```python
STOPWORDS = set(...)  # standard English stopword list

def tokenize(text: str) -> set[str]:
    words = re.findall(r"[a-z]+", text.lower())
    return {w for w in words if w not in STOPWORDS and len(w) > 2}

def overlap_score(a_tokens: set[str], b_tokens: set[str]) -> int:
    return len(a_tokens & b_tokens)

THRESHOLD = 4  # shared meaningful words to consider same topic

# For each new article: compare against existing cluster "centroid" token sets
# (e.g. union or most-frequent tokens of member articles).
# If max overlap_score >= THRESHOLD -> assign to that cluster, else create new cluster.
# Cluster label = top 3 most frequent tokens across member articles.
```

### 5.6 Clustering — Option B (TF-IDF), reference implementation
```python
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

vectorizer = TfidfVectorizer(stop_words="english", max_features=5000)
matrix = vectorizer.fit_transform([a.title + " " + a.summary for a in articles])
sim = cosine_similarity(matrix)
# Threshold-based grouping (e.g. sim >= 0.3) or AgglomerativeClustering with
# distance_threshold, or DBSCAN with metric="cosine".
# Label = top TF-IDF terms per cluster centroid, or highest-weighted article title.
```

### 5.7 Incremental re-clustering policy
On each run: new articles are compared only against existing cluster centroids first (cheap); only unmatched articles trigger new-cluster creation or a full re-cluster pass. A full re-cluster of all articles is acceptable for this assessment's data volume (hundreds of articles) if simpler to implement — document the choice and its cost in README.

### 5.8 CLI Interface
```
python main.py --mode=full         # ignore existing dedupe state, reprocess
python main.py --mode=incremental  # default; skip already-seen URLs
```

---

## 6. Backend API — Detailed Contract

### `GET /clusters`
**200 OK**
```json
[
  {
    "id": 12,
    "label": "senate election bill",
    "articleCount": 7,
    "startTime": "2026-06-20T08:00:00Z",
    "endTime": "2026-06-25T14:32:00Z"
  }
]
```

### `GET /clusters/:id`
**200 OK**
```json
{
  "id": 12,
  "label": "senate election bill",
  "articles": [
    {
      "id": 451,
      "source": "BBC",
      "title": "Senate advances election bill",
      "url": "https://...",
      "publishedAt": "2026-06-20T08:00:00Z"
    }
  ]
}
```
**404** if cluster ID does not exist → `{ "error": "Cluster not found" }`
**400** if `:id` is not a valid integer → `{ "error": "Invalid cluster id" }`

### `GET /timeline`
**200 OK**
```json
[
  {
    "id": 12,
    "label": "senate election bill",
    "startTime": "2026-06-20T08:00:00Z",
    "endTime": "2026-06-25T14:32:00Z",
    "articleCount": 7,
    "intensity": 0.78
  }
]
```
`intensity` = normalized article count (e.g. `count / max(count across all clusters)`), used for marker sizing.

### `POST /ingest/trigger`
**202 Accepted**
```json
{ "jobId": "a1b2c3", "status": "pending" }
```
Spawns the Python pipeline via `child_process.spawn`, tracked in an in-memory (or DB-backed, if surviving restarts matters) job table: `{ jobId, status, startedAt, finishedAt, error }`.

### `GET /ingest/status/:jobId`
**200 OK**
```json
{ "jobId": "a1b2c3", "status": "running" }
```
`status ∈ {pending, running, done, failed}`. **404** if jobId unknown.

### Error handling middleware
Centralized Express error handler returns:
```json
{ "error": "<message>" }
```
with appropriate status (400 validation, 404 not found, 500 unhandled). Validation via a lightweight middleware (manual checks or `zod`/`joi`) on route params/body before hitting the DB.

### Environment variables (`backend/.env`)
```
DATABASE_URL=postgres://...
PORT=4000
PYTHON_EXECUTABLE=python3
SCRAPER_PATH=../scraper/main.py
NODE_ENV=production
```

---

## 7. Frontend — Implementation Notes

### 7.1 Timeline component
- X-axis: time (use `recharts`' `ScatterChart` with custom shapes for variable-width bars, or a custom SVG/`visx` `<Bar>` per cluster spanning `startTime`→`endTime`)
- Marker width derived from `(endTime - startTime)`; marker height/boldness derived from `intensity`
- Tooltip on hover: label + article count + date range

### 7.2 Data flow
```
page.tsx (Server Component, initial fetch of /timeline + /clusters)
   └─ Timeline.tsx (Client Component: handles click, hover, filter state)
        ├─ ClusterDetail.tsx (fetches /clusters/:id on click)
        ├─ SourceFilter.tsx (client-side filter on already-fetched data)
        └─ RefreshButton.tsx (POST /ingest/trigger → poll /ingest/status/:jobId every 2s → refetch /timeline on "done")
```

### 7.3 Source filter implementation
Filtering happens client-side against the already-fetched `/clusters/:id` article list (simplest), or as a query param (`/clusters/:id?sources=BBC,NPR`) if filtering should reduce payload size. For this scale, client-side filtering is sufficient — document the choice.

### 7.4 Environment variables (`frontend/.env.local`)
```
NEXT_PUBLIC_API_BASE_URL=https://news-pulse-api.onrender.com
```

---

## 8. Deployment Topology

| Component | Platform | Trigger |
|---|---|---|
| Frontend | Vercel | Git push to `main` |
| Backend API | Render/Railway Web Service | Git push to `main`; long-running process |
| Python pipeline | Invoked by backend via `child_process`, OR Render Cron Job hitting `/ingest/trigger` on schedule | On-demand (UI button) + optional schedule |
| Database | Neon/Supabase/Railway Postgres | N/A (managed) |

**Cold start handling:** Render/Railway free tiers may sleep; document expected delay on first load in README and optionally ping the backend on frontend mount to pre-warm it.

---

## 9. Testing Approach (lightweight, appropriate for 3-day scope)
- **Python:** unit tests for `normalize.py` (date parsing edge cases), `dedupe.py`, and at least one test asserting clustering groups two clearly-related sample headlines and separates two clearly-unrelated ones
- **Backend:** manual + a few integration tests (e.g. `supertest`) hitting each endpoint against a seeded test DB; explicit test for 400/404 paths
- **Frontend:** manual QA across the required interactions (click cluster, filter source, refresh flow); automated testing optional given time constraints

---

## 10. Logging & Observability
- Python: structured print/log per run — feeds fetched, articles found, articles skipped (with reason), extraction failures, clusters created/updated, total runtime
- Backend: request logging (method, path, status, latency) via simple middleware (`morgan` or custom)
- Sufficient to narrate "what happened" during the video walkthrough without re-running everything live

---

## 11. Security & Config Hygiene
- No secrets committed; `.env.example` files checked in, real `.env` gitignored
- CORS restricted to the deployed frontend origin in production
- Basic rate-limit/guard on `/ingest/trigger` optional but recommended (avoid accidental repeated triggers hammering RSS sources)

---

*This TRD operationalizes the PRD's requirements into concrete schemas, contracts, and folder structure. Deviations (e.g. Mongo instead of Postgres, TF-IDF instead of keyword-overlap) are expected and fine — note them in the README as the assessment instructs.*
