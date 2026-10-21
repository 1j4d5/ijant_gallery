import { Readable } from 'node:stream';
import { query, imageKeyCache, IJUS } from '../../lib/db.js';

const IMMUTABLE = 'public, max-age=31536000, s-maxage=31536000, immutable';

function fail(res, status, msg) {
  res.setHeader('Cache-Control', 'no-store');
  res.status(status).json({ ok: false, error: msg });
}

export default async function handler(req, res) {
  const id = parseInt(req.query.id, 10);
  if (!Number.isInteger(id)) return fail(res, 404, 'Photo not found');

  let key = imageKeyCache.get(id);
  if (!key) {
    try {
      const rows = await query('SELECT object_key FROM images WHERE image_id = $1', [id]);
      if (rows[0]) {
        key = rows[0].object_key;
        imageKeyCache.set(id, key);
      }
    } catch (e) {
      console.error(e);
      return fail(res, 503, 'Database unavailable');
    }
  }
  if (!key) return fail(res, 404, 'Photo not found');

  try {
    const upstream = await fetch(`${IJUS.base()}/buckets/${IJUS.bucket()}/files/${key}`, {
      headers: { Authorization: `Bearer ${IJUS.token()}` },
      signal: AbortSignal.timeout(30_000),
    });
    if (!upstream.ok || !upstream.body) {
      console.error(`IJUS ${upstream.status} for ${key}`);
      return fail(res, 502, 'Could not fetch image from IJUS.');
    }

    res.status(200);
    res.setHeader('Content-Type', upstream.headers.get('content-type') || 'image/jpeg');
    const len = upstream.headers.get('content-length');
    if (len) res.setHeader('Content-Length', len);
    // Vercel's CDN caches this at the edge, replacing the old on-disk photo cache.
    res.setHeader('Cache-Control', IMMUTABLE);

    const stream = Readable.fromWeb(upstream.body);
    stream.on('error', (e) => { console.error(e); res.destroy(e); });
    stream.pipe(res);
  } catch (e) {
    console.error(`Could not fetch image ${key} from IJUS:`, e);
    if (!res.headersSent) return fail(res, 502, 'Could not fetch image from IJUS.');
    res.destroy();
  }
}
