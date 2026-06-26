# News Pulse

News Pulse is an end-to-end web application that ingests articles from multiple public RSS feeds, clusters them into cohesive news topics based on text similarity, and visualizes them on an interactive timeline.

## Project Overview

News Pulse helps readers overcome news redundancy and grasp the progression of stories over time. It has three core components:
1. **Python Scraper**: Fetches feeds, extracts body text, dedupes, and clusters articles.
2. **Node/Express Backend API**: Exposes endpoints to retrieve clusters, timelines, and trigger ingestion runs.
3. **Next.js Frontend**: Plottable interactive timeline and drill-down interfaces.

---

## Tech Stack

* **Frontend**: Next.js 14+ (App Router), React, TypeScript, TailwindCSS, Recharts, Axios.
* **Backend**: Node.js, Express, dotenv, cors, pg (PostgreSQL driver), nodemon.
* **Scraper**: Python 3.11+, feedparser, requests, trafilatura, python-dateutil, scikit-learn, psycopg2-binary.
* **Database**: PostgreSQL (e.g. Supabase, Neon, or local database).

---

## Folder Structure

```text
news-pulse/
├── .github/workflows/           # GitHub Actions workflows
│   └── ingest-cron.yml          # Scheduled ingestion trigger
├── .vscode/                     # VS Code workspace settings
│   ├── settings.json
│   └── extensions.json
├── backend/                     # Node/Express API
│   ├── src/
│   │   ├── db/                  # DB connection and queries
│   │   │   ├── pool.js
│   │   │   ├── queries.js
│   │   │   └── schema.sql       # Database DDL schema
│   │   ├── jobs/                # Background job states
│   │   │   └── jobStore.js
│   │   ├── middleware/          # Express middlewares
│   │   │   ├── errorHandler.js
│   │   │   └── validate.js
│   │   ├── routes/              # API endpoints
│   │   │   ├── clusters.js
│   │   │   ├── ingest.js
│   │   │   └── timeline.js
│   │   └── server.js            # Express server entrypoint
│   ├── scripts/
│   │   └── init-db.js           # Database initialization script
│   ├── .env.example
│   ├── package.json
│   ├── .eslintrc.json
│   └── .prettierrc
├── frontend/                    # Next.js Application
│   ├── app/                     # App router pages
│   │   └── page.tsx
│   ├── components/              # Interactive UI components
│   │   ├── Timeline.tsx
│   │   ├── ClusterDetail.tsx
│   │   ├── SourceFilter.tsx
│   │   └── RefreshButton.tsx
│   ├── lib/
│   │   └── api.ts               # Axios-based fetch wrappers
│   ├── .env.example
│   ├── package.json
│   ├── tsconfig.json
│   ├── tailwind.config.ts
│   └── postcss.config.js
├── scraper/                     # Python ingestion & clustering
│   ├── main.py                  # Scraper execution pipeline entrypoint
│   ├── feeds.py                 # RSS fetching and parsing
│   ├── normalize.py             # RSS field normalization
│   ├── extract.py               # Article body web extractor
│   ├── dedupe.py                # Duplicate detection helper
│   ├── cluster.py               # Tokenization and clustering algorithms
│   ├── db.py                    # DB queries & commits
│   ├── config.py                # Environment configurations
│   ├── requirements.txt
│   └── tests/                   # Folder for scraper unit tests
├── .gitignore
├── .env.example
├── PROJECT_STATUS.md            # High level checklist status tracker
└── README.md
```

---

## Setup Instructions

### Prerequisites
* Node.js (v20+)
* npm or yarn
* Python (3.11+)
* PostgreSQL instance

### 1. Database Setup
1. Create a PostgreSQL database.
2. In the `backend` directory, create a `.env` file from `.env.example` and set `DATABASE_URL`.
3. Run the initialization script to create tables:
   ```bash
   cd backend
   npm run db:init
   ```

### 2. Backend Setup
1. Install dependencies:
   ```bash
   cd backend
   npm install
   ```
2. Start in development:
   ```bash
   npm run dev
   ```

### 3. Scraper Setup
1. Create a Python virtual environment:
   ```bash
   cd scraper
   python -m venv .venv
   ```
2. Activate the virtual environment:
   - Windows: `.venv\Scripts\activate`
   - macOS/Linux: `source .venv/bin/activate`
3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

### 4. Frontend Setup
1. Install dependencies:
   ```bash
   cd frontend
   npm install
   ```
2. Start in development:
   ```bash
   npm run dev
   ```

---

## Running the Components

### Backend
Start the Express server on configured `PORT` (defaults to 4000):
```bash
cd backend
npm run dev
```

### Python Scraper
Run scraper from CLI manually:
* Full run:
  ```bash
  cd scraper
  python main.py --mode=full
  ```
* Incremental run:
  ```bash
  cd scraper
  python main.py --mode=incremental
  ```

### Frontend
Start Next.js dev server:
```bash
cd frontend
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) to view the timeline.
