import { api, query } from '../../lib/db.js';

export default api(async () => {
  return query(`
    SELECT p.person_id AS id, p.name,
           COUNT(pi.image_id)::int AS photo_count,
           MIN(pi.image_id) AS cover_photo_id
    FROM people p
    LEFT JOIN person_images pi ON pi.person_id = p.person_id
    GROUP BY p.person_id, p.name
    ORDER BY lower(p.name), p.person_id
  `);
}, { cache: 'public, s-maxage=60, stale-while-revalidate=300' });
