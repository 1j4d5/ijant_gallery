import { api, query, imageKeyCache } from '../lib/db.js';

const num = (v) => (v === null || v === undefined ? null : Number(v));

export default api(async () => {
  const [rows, boxRows, peopleRows] = await Promise.all([
    query('SELECT image_id AS id, original_name, object_key FROM images ORDER BY image_id'),
    query(`
      SELECT fb.image_id, fb.x1, fb.y1, fb.x2, fb.y2, p.name
      FROM face_boxes fb
      JOIN people p ON p.person_id = fb.person_id
      ORDER BY fb.image_id
    `),
    // people per image + cover photo and the face box inside that cover photo
    query(`
      SELECT pi.image_id, p.person_id AS id, p.name,
             cov.cover_photo_id,
             fb.x1 AS face_x1, fb.y1 AS face_y1,
             fb.x2 AS face_x2, fb.y2 AS face_y2
      FROM person_images pi
      JOIN people p ON p.person_id = pi.person_id
      JOIN (
        SELECT person_id, MIN(image_id) AS cover_photo_id
        FROM person_images
        GROUP BY person_id
      ) cov ON cov.person_id = p.person_id
      LEFT JOIN face_boxes fb
        ON fb.person_id = p.person_id
       AND fb.image_id = cov.cover_photo_id
      ORDER BY pi.image_id, p.name
    `),
  ]);

  for (const r of rows) if (r.object_key) imageKeyCache.set(r.id, r.object_key);

  const boxes = new Map();
  for (const b of boxRows) {
    if (!boxes.has(b.image_id)) boxes.set(b.image_id, []);
    boxes.get(b.image_id).push({ x1: Number(b.x1), y1: Number(b.y1), x2: Number(b.x2), y2: Number(b.y2), name: b.name });
  }

  const people = new Map();
  for (const r of peopleRows) {
    if (!people.has(r.image_id)) people.set(r.image_id, []);
    people.get(r.image_id).push({
      id: r.id, name: r.name, cover_photo_id: r.cover_photo_id,
      face_x1: num(r.face_x1), face_y1: num(r.face_y1),
      face_x2: num(r.face_x2), face_y2: num(r.face_y2),
    });
  }

  return rows.map((r) => ({
    id: r.id,
    original_name: r.original_name || '',
    faces: boxes.get(r.id) || [],
    people: people.get(r.id) || [],
  }));
}, { cache: 'public, s-maxage=60, stale-while-revalidate=300' });
