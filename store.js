const path = require('path');
const fs = require('fs');
const seed = require('./seed.json');

const EXT = { 'audio/webm': 'webm', 'audio/ogg': 'ogg', 'audio/mp4': 'm4a', 'audio/mpeg': 'mp3', 'audio/aac': 'aac', 'audio/x-m4a': 'm4a' };

function pgStore(url) {
  const { Pool } = require('pg');
  const pool = new Pool({
    connectionString: url,
    ssl: /render\.com|sslmode=require/.test(url) ? { rejectUnauthorized: false } : false,
    max: 5,
  });
  const toMsg = (r) => ({
    id: r.id,
    name: r.name,
    city: r.city,
    country: r.country,
    lat: r.lat,
    lng: r.lng,
    text: r.text,
    audio: r.has_audio ? `/api/audio/${r.id}` : null,
    createdAt: r.created_at.toISOString(),
  });

  return {
    kind: 'postgres',
    async init() {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS messages (
          id         TEXT PRIMARY KEY,
          name       TEXT NOT NULL,
          city       TEXT NOT NULL,
          country    TEXT NOT NULL DEFAULT '',
          lat        DOUBLE PRECISION NOT NULL,
          lng        DOUBLE PRECISION NOT NULL,
          text       TEXT NOT NULL DEFAULT '',
          audio      BYTEA,
          audio_type TEXT,
          ip         TEXT,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )`);
      const { rows } = await pool.query('SELECT count(*)::int AS n FROM messages');
      if (rows[0].n === 0) {
        for (const m of seed) {
          await pool.query(
            'INSERT INTO messages (id, name, city, country, lat, lng, text, created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)',
            [m.id, m.name, m.city, m.country, m.lat, m.lng, m.text, m.createdAt]
          );
        }
      }
    },
    async list() {
      const { rows } = await pool.query(
        'SELECT id, name, city, country, lat, lng, text, audio IS NOT NULL AS has_audio, created_at FROM messages ORDER BY created_at'
      );
      return rows.map(toMsg);
    },
    async add(msg, audio, ip) {
      const { rows } = await pool.query(
        `INSERT INTO messages (id, name, city, country, lat, lng, text, audio, audio_type, ip)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
         RETURNING id, name, city, country, lat, lng, text, audio IS NOT NULL AS has_audio, created_at`,
        [msg.id, msg.name, msg.city, msg.country, msg.lat, msg.lng, msg.text, audio?.buffer || null, audio?.type || null, ip]
      );
      return toMsg(rows[0]);
    },
    async audio(id) {
      const { rows } = await pool.query('SELECT audio, audio_type FROM messages WHERE id = $1 AND audio IS NOT NULL', [id]);
      return rows[0] ? { buffer: rows[0].audio, type: rows[0].audio_type } : null;
    },
  };
}

function fileStore(dir) {
  const uploads = path.join(dir, 'uploads');
  const db = path.join(dir, 'messages.json');
  let messages = [];
  let writing = Promise.resolve();
  const persist = () => (writing = writing.then(() => fs.promises.writeFile(db, JSON.stringify(messages, null, 2))));

  return {
    kind: 'archivo',
    uploads,
    async init() {
      fs.mkdirSync(uploads, { recursive: true });
      if (!fs.existsSync(db)) fs.writeFileSync(db, JSON.stringify(seed, null, 2));
      messages = JSON.parse(fs.readFileSync(db, 'utf8'));
    },
    async list() {
      return messages.map(({ ip, ...m }) => m);
    },
    async add(msg, audio, ip) {
      msg = { ...msg, createdAt: new Date().toISOString() };
      if (audio) {
        const file = `${msg.id}.${EXT[audio.type] || 'webm'}`;
        await fs.promises.writeFile(path.join(uploads, file), audio.buffer);
        msg = { ...msg, audio: `/uploads/${file}` };
      } else {
        msg = { ...msg, audio: null };
      }
      messages.push({ ...msg, ip });
      persist();
      return msg;
    },
    async audio() {
      return null;
    },
  };
}

module.exports = process.env.DATABASE_URL ? pgStore(process.env.DATABASE_URL) : fileStore(path.join(__dirname, 'data'));
module.exports.AUDIO_TYPES = EXT;
