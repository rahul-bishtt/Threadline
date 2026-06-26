-- Database schema definition for News Pulse
-- TODO:
-- Execute this script during initialization to create clusters and articles tables.
-- Handle table creation sequence ensuring correct foreign key reference bindings.

CREATE TABLE IF NOT EXISTS clusters (
  id            SERIAL PRIMARY KEY,
  label         TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS articles (
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

CREATE INDEX IF NOT EXISTS idx_articles_cluster_id ON articles(cluster_id);
CREATE INDEX IF NOT EXISTS idx_articles_published_at ON articles(published_at);
