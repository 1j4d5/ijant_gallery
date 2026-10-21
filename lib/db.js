import pg from 'pg';

const { Pool } = pg;

export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

let pool = null;

function getPool() {
  const url = (process.env.NEON_DB_URL || '').trim();
  if (!url) return null;
  if (!pool) {
    // Small pool: each serverless instance handles few concurrent requests.
    pool = new Pool({
      connectionString: url,
      max: 3,
      idleTimeoutMillis: 10_000,
      connectionTimeoutMillis: 10_000,
    });
    // Neon closes idle serverless connections; don't crash on that.
    pool.on('error', (e) => console.warn('pg pool error:', e.message));
  }
  return pool;
}

export async function query(text, params = []) {
  const p = getPool();
  if (!p) throw new HttpError(503, 'Database unavailable');
  try {
    return (await p.query(text, params)).rows;
  } catch (err) {
    if (err instanceof HttpError) throw err;
    // One retry covers a connection that Neon dropped while idle.
    console.warn('query failed, retrying once:', err.message);
    return (await p.query(text, params)).rows;
  }
}

// image_id -> object_key (warm-instance cache only)
export const imageKeyCache = new Map();

export const IJUS = {
  token: () => (process.env.IJUS_TOKEN || '').trim(),
  base: () => (process.env.IJUS_BASE_URL || 'https://pink.ijadium.com/bucket').replace(/\/+$/, ''),
  bucket: () => (process.env.IJUS_BUCKET_NAME || 'ijantdata').trim(),
};

// Wraps a handler: JSON errors, optional CDN caching for GET.
export function api(fn, { cache } = {}) {
  return async (req, res) => {
    try {
      const data = await fn(req, res);
      if (res.writableEnded || res.headersSent) return;
      if (cache) res.setHeader('Cache-Control', cache);
      res.status(200).json({ ok: true, data });
    } catch (err) {
      if (res.headersSent) return res.end();
      const status = err.status || 500;
      if (status >= 500) console.error(err);
      res.setHeader('Cache-Control', 'no-store');
      res.status(status).json({ ok: false, error: err.status ? err.message : 'Internal error' });
    }
  };
}
