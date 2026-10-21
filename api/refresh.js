import { api, query, imageKeyCache, HttpError } from '../lib/db.js';

export default api(async (req) => {
  if (req.method !== 'POST') throw new HttpError(405, 'Use POST');
  imageKeyCache.clear();
  const [[p], [i]] = await Promise.all([
    query('SELECT COUNT(*)::int AS n FROM people'),
    query('SELECT COUNT(*)::int AS n FROM images'),
  ]);
  return { people: p.n, images: i.n, db: 'neon' };
});
