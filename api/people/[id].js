import { api, query, imageKeyCache, HttpError } from '../../lib/db.js';

export default api(async (req) => {
  const pid = parseInt(req.query.id, 10);
  if (!Number.isInteger(pid)) throw new HttpError(404, 'Person not found');

  const [person] = await query('SELECT person_id AS id, name FROM people WHERE person_id = $1', [pid]);
  if (!person) throw new HttpError(404, 'Person not found');

  const [imageRows, boxRows] = await Promise.all([
    query(`
      SELECT i.image_id AS id, i.original_name, i.object_key
      FROM images i
      JOIN person_images pi ON pi.image_id = i.image_id
      WHERE pi.person_id = $1
      ORDER BY i.image_id
    `, [pid]),
    query(`
      SELECT image_id, x1, y1, x2, y2, quality, det_conf
      FROM face_boxes
      WHERE person_id = $1
      ORDER BY id
    `, [pid]),
  ]);

  for (const r of imageRows) if (r.object_key) imageKeyCache.set(r.id, r.object_key);

  const byImage = new Map();
  for (const b of boxRows) {
    if (!byImage.has(b.image_id)) byImage.set(b.image_id, []);
    byImage.get(b.image_id).push({
      x1: Number(b.x1), y1: Number(b.y1), x2: Number(b.x2), y2: Number(b.y2),
      quality: Number(b.quality) || 0,
      det_conf: Number(b.det_conf) || 0,
    });
  }

  return {
    id: person.id,
    name: person.name,
    photos: imageRows.map((r) => ({
      id: r.id,
      original_name: r.original_name || '',
      faces: byImage.get(r.id) || [],
    })),
  };
}, { cache: 'public, s-maxage=60, stale-while-revalidate=300' });
