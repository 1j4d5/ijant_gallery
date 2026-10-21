import { api, query } from '../lib/db.js';

export default api(async () => {
  const [[p], [i], [f]] = await Promise.all([
    query('SELECT COUNT(*)::int AS n FROM people'),
    query('SELECT COUNT(*)::int AS n FROM images'),
    query('SELECT COUNT(*)::int AS n FROM face_boxes'),
  ]);
  return { people: p.n, images: i.n, face_boxes: f.n };
}, { cache: 'public, s-maxage=60, stale-while-revalidate=300' });
