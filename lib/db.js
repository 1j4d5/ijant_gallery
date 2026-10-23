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
  let url = (process.env.NEON_DB_URL || '').trim();
  if (!url) return null;
  url = url.replace(/^['"]|['"]$/g, '');
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

// object_key -> {w,h} (ORIGINAL pixel size, EXIF-oriented) from the Ijus info API.
// Face boxes are stored in these coordinates, so the UI must scale by these, not by
// the size of whichever variant (lorez/original) the browser happened to load.
let dimsCache = { at: 0, map: new Map() };
export async function getDims() {
  if (Date.now() - dimsCache.at < 5 * 60_000 && dimsCache.map.size) return dimsCache.map;
  try {
    const r = await fetch(`${IJUS.base()}/buckets/${IJUS.bucket()}/info`, {
      headers: { Authorization: `Bearer ${IJUS.token()}` },
      signal: AbortSignal.timeout(20_000),
    });
    if (!r.ok) throw new Error(`info ${r.status}`);
    const j = await r.json();
    const map = new Map();
    for (const f of j.files || []) if (f.is_image && f.width && f.height) map.set(f.name, { w: f.width, h: f.height });
    dimsCache = { at: Date.now(), map };
  } catch (e) {
    console.warn('dims unavailable:', e.message); // UI falls back to naturalWidth/Height
  }
  return dimsCache.map;
}
