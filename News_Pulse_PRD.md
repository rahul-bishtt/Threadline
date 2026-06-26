# Product Requirements Document: News Pulse

**Topic-Clustered News Timeline**
Version 1.0 | Internship Take-Home Project

---

## 1. Overview

### 1.1 Problem Statement
News consumers face two related problems: (1) the same story is reported redundantly across dozens of outlets, making it hard to see what's actually happening at a glance, and (2) there's no easy way to see *when* a topic was active in the news cycle — when it started, peaked, and faded.

### 1.2 Product Summary
News Pulse is a small end-to-end system that:
1. Ingests live articles from multiple public RSS feeds
2. Groups related articles into topic clusters using text similarity
3. Visualizes those clusters on a timeline, showing when each topic was active and how big it got

### 1.3 Goals
- Demonstrate a working, re-runnable data pipeline that handles real-world feed messiness
- Produce topic clusters that are coherent and explainable
- Serve cluster/timeline data through a clean REST API
- Render an intuitive, polished timeline UI — not a list with dates
- Deploy the full stack live for review

### 1.4 Non-Goals (Out of Scope for v1)
- Perfect deduplication of the same real-world story across outlets (cross-source merging is a stretch goal, not required)
- Real-time/streaming ingestion (polling/manual trigger is sufficient)
- User accounts, auth, personalization, or saved preferences
- Mobile-native app (responsive web is enough)
- Production-grade scale (this is a small reviewable demo, not a high-traffic system)

---

## 2. Users & Use Cases

**Primary user:** a reviewer/evaluator (and, conceptually, a news-curious reader) who wants to:
- See what topics have been in the news recently and for how long
- Drill into a topic to see the actual articles backing it
- Filter by source to compare coverage
- Trigger a fresh ingestion run and watch the data update

**Core user story:**
> "As a user, I want to see news topics laid out on a timeline so I can quickly tell what's been happening and explore the articles behind each story."

---

## 3. System Architecture

```
┌─────────────┐      ┌──────────────────┐      ┌───────────────┐      ┌─────────────┐
│  RSS Feeds   │ ───▶ │ Python Pipeline   │ ───▶ │   Database    │ ◀──▶ │  Node API   │
│ (BBC/NPR/...)│      │ (scrape→extract→  │      │ (Postgres/    │      │ (Express)   │
└─────────────┘      │  cluster→store)   │      │  Mongo/SQLite)│      └──────┬──────┘
                      └──────────────────┘      └───────────────┘             │
                              ▲                                                ▼
                              │  triggered via subprocess/job              ┌──────────────┐
                              └──────────────────────────────────────────  │  Next.js UI  │
                                     POST /ingest/trigger                  └──────────────┘
```

| Layer | Responsibility |
|---|---|
| Python | Pull feeds, normalize schema, extract full article text, dedupe, cluster into topics, write to DB |
| Database | Persist articles + clusters; shared source of truth |
| Node.js API | Read clusters/articles/timeline data; trigger and report on pipeline jobs |
| Next.js Frontend | Timeline visualization, cluster detail, source filter, refresh control |

---

## 4. Functional Requirements

### 4.1 Ingestion & Normalization (Python)
| ID | Requirement |
|---|---|
| F1.1 | Pull articles from ≥3 distinct public RSS feeds |
| F1.2 | Normalize each feed's fields (title, summary/description, link, published date, source) into one consistent internal schema, regardless of source-specific tag differences |
| F1.3 | Handle missing/malformed `pubDate` fields gracefully (fallback value or skip with logging, not a crash) |
| F1.4 | For each article, fetch the full article page and extract main body text (newspaper3k / trafilatura / BeautifulSoup); on extraction failure, fall back to the RSS summary and continue the run |
| F1.5 | Detect and skip articles already stored (dedupe by URL or a content hash) on repeated runs |
| F1.6 | Pipeline must be safely re-runnable — incremental runs should only process new articles, not reprocess the entire feed history |

### 4.2 Topic Clustering (Python)
| ID | Requirement |
|---|---|
| F2.1 | Group articles into topic clusters using either keyword-overlap or TF-IDF + similarity/clustering (one approach, chosen and justified in README) |
| F2.2 | Each cluster has: a unique ID, a generated label, its member articles, and is queryable by time range |
| F2.3 | Clustering thresholds/parameters must be configurable (not magic numbers buried in logic) and documented |
| F2.4 | New articles from incremental runs are assigned to existing clusters where they fit, or form new clusters otherwise |

### 4.3 Backend API (Node.js)
| Endpoint | Method | Purpose | Key response fields |
|---|---|---|---|
| `/clusters` | GET | List all clusters | `id, label, articleCount, startTime, endTime` |
| `/clusters/:id` | GET | Full cluster detail | `id, label, articles[] (sorted by publishedAt)` |
| `/timeline` | GET | Chart-ready cluster data | `id, label, startTime, endTime, articleCount, intensity` |
| `/ingest/trigger` | POST | Kick off scrape+cluster job | `jobId, status` |
| `/ingest/status/:jobId` | GET | Poll job status | `jobId, status (pending/running/done/failed), error?` |

**Cross-cutting requirements:**
- Input validation on all params (e.g., invalid cluster ID → 400, not-found → 404, unexpected failure → 500)
- All config (DB connection string, ports, secrets) via environment variables — none hardcoded or committed
- `/timeline` response shape must be chart-library-ready (explicit start/end timestamps and a size metric), not a raw dump of clusters

### 4.4 Frontend (Next.js / React)
| ID | Requirement |
|---|---|
| F4.1 | Timeline view: each cluster rendered as a block/marker spanning its earliest→latest article time, plotted along a shared time axis |
| F4.2 | Clicking a cluster opens a detail view listing its articles (headline, source, published time, link to original) |
| F4.3 | Source filter: toggle individual news sources on/off, timeline updates accordingly |
| F4.4 | "Refresh data" button: calls `POST /ingest/trigger`, polls `/ingest/status/:jobId`, updates timeline on completion, with visible loading/progress state |
| F4.5 | Empty/loading/error states are handled (no blank screen or unhandled crash) |

### 4.5 Deployment
| ID | Requirement |
|---|---|
| F5.1 | Frontend deployed to a public URL (Vercel/Netlify) |
| F5.2 | Backend API deployed to a public URL (Render/Railway/Fly.io) |
| F5.3 | Database hosted (Supabase/Neon/Atlas/Railway Postgres) |
| F5.4 | Pipeline runnable on-demand via API trigger and/or on a schedule (cron/scheduled job) |
| F5.5 | All secrets/config set via the hosting platform's env var settings, not committed to git |

---

## 5. Data Model (conceptual)

**Article**
```
id, source, title, summary, body_text, url (unique),
published_at, fetched_at, cluster_id
```

**Cluster**
```
id, label, created_at, updated_at,
derived: article_count, start_time (min published_at), end_time (max published_at)
```

---

## 6. Non-Functional Requirements
- **Resilience:** a single bad feed or unparseable article must not abort the whole pipeline run
- **Idempotency:** re-running ingestion must not create duplicate articles or duplicate cluster bloat
- **Observability:** basic logging of pipeline runs (articles fetched, skipped, errors) sufficient to debug in the video walkthrough
- **Performance:** timeline endpoint should return promptly for a reasonable article volume (hundreds, not millions, of articles) — no specific SLA required for a demo
- **Cold start tolerance:** free-tier hosting cold starts are acceptable

---

## 7. Success Criteria / Definition of Done
- [ ] Pipeline pulls from 3+ real feeds and produces normalized, deduplicated articles with full body text where extraction succeeds
- [ ] Clusters are coherent (a human can look at a cluster and agree the articles belong together) and the approach is clearly explained
- [ ] All 5 API endpoints work with correct status codes and validation
- [ ] Timeline UI visually communicates "this topic was active during this window" — not just a sorted list
- [ ] Source filtering and cluster drill-down work
- [ ] Refresh button triggers a real pipeline run and the UI updates on completion
- [ ] Full system is live and reviewable cold, with documented env-var setup
- [ ] README covers approach, thresholds, sources, limitations, and architecture
- [ ] 2–3 min video covers: live demo, clustering explanation, one hard problem + fix, one future improvement

---

## 8. Stretch Goals (Optional)
- Auto-refresh: frontend polls `/timeline` periodically without manual action
- Visual cluster sizing: bigger clusters render as bigger/bolder markers
- Cross-source story merging: recognizing the same real-world event across outlets as one logical story even while clusters remain separate

---

## 9. Open Assumptions to Resolve (document in README, don't block on them)
- Which 3+ feeds will be used
- Keyword-overlap vs. TF-IDF approach, and chosen thresholds
- Database choice
- Definition of "duplicate" (exact URL match vs. content hash)
- How clusters evolve across incremental pipeline runs (merge into existing vs. always re-cluster from scratch)

---

## 10. Risks
| Risk | Mitigation |
|---|---|
| Article extraction fails frequently on certain sites (paywalls, JS-rendered pages) | Fall back to RSS summary text; log and continue |
| Clustering produces incoherent or overly broad groups | Start with conservative thresholds; tune based on manual inspection; document the limitation rather than over-engineering |
| Free-tier hosting cold starts/timeouts during demo | Mention in README; trigger a warm-up request before recording video |
| 3-day time limit vs. scope | Prioritize core required items over stretch goals; keep clustering approach simple (Option A) if time is tight |

---

*This PRD is a planning document for the take-home assessment and is not provided by Xponentium — it translates their assessment brief into a structured spec to guide implementation.*
