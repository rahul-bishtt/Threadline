const { pool } = require('./pool');

/**
 * Helper to determine whether to use a transaction client or the global connection pool.
 * 
 * @param {object} [client] - Optional client from pool checkout (used in transactions).
 * @returns {object} DB executor (either the client or the pool).
 */
const getExecutor = (client) => client || pool;

/**
 * Creates a new article in the database.
 * 
 * @async
 * @function createArticle
 * @param {object} article - The article details.
 * @param {string} article.source - The publisher/source name (e.g., 'BBC').
 * @param {string} article.title - The headline/title of the article.
 * @param {string} [article.summary] - Snippet or short description.
 * @param {string} [article.body_text] - Full parsed body text.
 * @param {string} article.url - Unique address of the article.
 * @param {Date|string} [article.published_at] - Publication ISO timestamp.
 * @param {number} [article.cluster_id] - Foreign key ID of the parent cluster.
 * @param {object} [client] - Optional transaction client.
 * @returns {Promise<object>} The newly created article record.
 * @throws {Error} If the URL violates the UNIQUE constraint, or if database connection fails.
 */
async function createArticle(article, client) {
  const executor = getExecutor(client);
  const sql = `
    INSERT INTO articles (source, title, summary, body_text, url, published_at, cluster_id)
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    RETURNING id, source, title, summary, body_text, url, published_at, fetched_at, cluster_id
  `;
  const values = [
    article.source,
    article.title,
    article.summary || null,
    article.body_text || null,
    article.url,
    article.published_at || null,
    article.cluster_id || null
  ];

  try {
    const res = await executor.query(sql, values);
    return res.rows[0];
  } catch (error) {
    console.error('Error in createArticle query:', error.message);
    throw error;
  }
}

/**
 * Retrieves an article record by its unique URL.
 * 
 * @async
 * @function getArticleByUrl
 * @param {string} url - The exact URL of the article.
 * @param {object} [client] - Optional transaction client.
 * @returns {Promise<object|null>} The article record if found, or null.
 * @throws {Error} If database connection or query execution fails.
 */
async function getArticleByUrl(url, client) {
  const executor = getExecutor(client);
  const sql = `
    SELECT id, source, title, summary, body_text, url, published_at, fetched_at, cluster_id
    FROM articles
    WHERE url = $1
  `;
  try {
    const res = await executor.query(sql, [url]);
    return res.rows[0] || null;
  } catch (error) {
    console.error('Error in getArticleByUrl query:', error.message);
    throw error;
  }
}

/**
 * Creates a new cluster topic label.
 * 
 * @async
 * @function createCluster
 * @param {string} label - The descriptive title/label for the cluster.
 * @param {object} [client] - Optional transaction client.
 * @returns {Promise<object>} The newly created cluster record (containing id, label, created_at, updated_at).
 * @throws {Error} If database connection or insert fails.
 */
async function createCluster(label, client) {
  const executor = getExecutor(client);
  const sql = `
    INSERT INTO clusters (label)
    VALUES ($1)
    RETURNING id, label, created_at, updated_at
  `;
  try {
    const res = await executor.query(sql, [label]);
    return res.rows[0];
  } catch (error) {
    console.error('Error in createCluster query:', error.message);
    throw error;
  }
}

/**
 * Assigns an article to a specific cluster.
 * 
 * @async
 * @function assignArticleToCluster
 * @param {number} articleId - The ID of the article to update.
 * @param {number|null} clusterId - The target cluster ID, or null to unassign.
 * @param {object} [client] - Optional transaction client.
 * @returns {Promise<object|null>} The updated article record, or null if the article does not exist.
 * @throws {Error} If foreign key reference check fails or database connection drops.
 */
async function assignArticleToCluster(articleId, clusterId, client) {
  const executor = getExecutor(client);
  const sql = `
    UPDATE articles
    SET cluster_id = $1
    WHERE id = $2
    RETURNING id, source, title, summary, body_text, url, published_at, fetched_at, cluster_id
  `;
  try {
    const res = await executor.query(sql, [clusterId, articleId]);
    return res.rows[0] || null;
  } catch (error) {
    console.error('Error in assignArticleToCluster query:', error.message);
    throw error;
  }
}

/**
 * Retrieves a cluster by its ID alongside aggregate statistics (article count, timeline range).
 * 
 * @async
 * @function getCluster
 * @param {number} id - The cluster ID.
 * @param {object} [client] - Optional transaction client.
 * @returns {Promise<object|null>} Cluster object with aggregates, or null if not found.
 * @throws {Error} If database query fails.
 */
async function getCluster(id, client) {
  const executor = getExecutor(client);
  const sql = `
    SELECT c.id, c.label, c.created_at, c.updated_at,
           COUNT(a.id)::int AS article_count,
           MIN(a.published_at) AS start_time,
           MAX(a.published_at) AS end_time
    FROM clusters c
    LEFT JOIN articles a ON c.id = a.cluster_id
    WHERE c.id = $1
    GROUP BY c.id, c.label, c.created_at, c.updated_at
  `;
  try {
    const res = await executor.query(sql, [id]);
    return res.rows[0] || null;
  } catch (error) {
    console.error('Error in getCluster query:', error.message);
    throw error;
  }
}

/**
 * Retrieves all clusters alongside aggregate statistics, sorted by timeline start_time descending.
 * 
 * @async
 * @function getAllClusters
 * @param {object} [client] - Optional transaction client.
 * @returns {Promise<Array<object>>} List of all cluster aggregate items.
 * @throws {Error} If database query fails.
 */
async function getAllClusters(client) {
  const executor = getExecutor(client);
  const sql = `
    SELECT c.id, c.label, c.created_at, c.updated_at,
           COUNT(a.id)::int AS article_count,
           MIN(a.published_at) AS start_time,
           MAX(a.published_at) AS end_time
    FROM clusters c
    LEFT JOIN articles a ON c.id = a.cluster_id
    GROUP BY c.id, c.label, c.created_at, c.updated_at
    ORDER BY start_time DESC NULLS LAST, c.id DESC
  `;
  try {
    const res = await executor.query(sql);
    return res.rows;
  } catch (error) {
    console.error('Error in getAllClusters query:', error.message);
    throw error;
  }
}

/**
 * Retrieves all articles belonging to a specific cluster, ordered by publication date descending.
 * 
 * @async
 * @function getArticlesByClusterId
 * @param {number} clusterId - The parent cluster ID.
 * @param {object} [client] - Optional transaction client.
 * @returns {Promise<Array<object>>} List of articles belonging to the cluster.
 * @throws {Error} If database query fails.
 */
async function getArticlesByClusterId(clusterId, client) {
  const executor = getExecutor(client);
  const sql = `
    SELECT id, source, title, summary, body_text, url, published_at, fetched_at, cluster_id
    FROM articles
    WHERE cluster_id = $1
    ORDER BY published_at DESC, id DESC
  `;
  try {
    const res = await executor.query(sql, [clusterId]);
    return res.rows;
  } catch (error) {
    console.error('Error in getArticlesByClusterId query:', error.message);
    throw error;
  }
}

module.exports = {
  createArticle,
  getArticleByUrl,
  createCluster,
  assignArticleToCluster,
  getCluster,
  getAllClusters,
  getArticlesByClusterId,
};
