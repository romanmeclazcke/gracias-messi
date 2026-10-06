const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const PORT = process.env.PORT || 3010;
const DATA_DIR = path.join(__dirname, 'data');
const UPLOADS = path.join(DATA_DIR, 'uploads');
const DB = path.join(DATA_DIR, 'messages.json');
const MAX_AUDIO_BYTES = 4 * 1024 * 1024;
const MAX_TEXT = 600;

fs.mkdirSync(UPLOADS, { recursive: true });
if (!fs.existsSync(DB)) fs.writeFileSync(DB, JSON.stringify(require('./seed.json'), null, 2));

let messages = JSON.parse(fs.readFileSync(DB, 'utf8'));
let writing = Promise.resolve();
const persist = () => {
  writing = writing.then(() => fs.promises.writeFile(DB, JSON.stringify(messages, null, 2)));
  return writing;
};

const AUDIO_TYPES = {
  'audio/webm': 'webm',
  'audio/ogg': 'ogg',
  'audio/mp4': 'm4a',
  'audio/mpeg': 'mp3',
  'audio/aac': 'aac',
  'audio/x-m4a': 'm4a',
};

const upload = multer({
  storage: multer.diskStorage({
    destination: UPLOADS,
    filename: (req, file, cb) => {
      const base = file.mimetype.split(';')[0];
      cb(null, `${crypto.randomUUID()}.${AUDIO_TYPES[base] || 'webm'}`);
    },
  }),
  limits: { fileSize: MAX_AUDIO_BYTES, files: 1 },
  fileFilter: (req, file, cb) => cb(null, Boolean(AUDIO_TYPES[file.mimetype.split(';')[0]])),
});

const rate = new Map();
const tooFast = (ip) => {
  const now = Date.now();
  const hits = (rate.get(ip) || []).filter((t) => now - t < 10 * 60 * 1000);
  hits.push(now);
  rate.set(ip, hits);
  return hits.length > 6;
};

const clean = (s, max) => String(s || '').replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, max);

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '20kb' }));
app.use(
  express.static(path.join(__dirname, 'public'), {
    setHeaders: (res, file) => {
      if (/\.(html|css|js|json)$/.test(file)) res.setHeader('Cache-Control', 'no-cache');
    },
  })
);
app.use('/vendor/three', express.static(path.join(__dirname, 'node_modules/three'), { maxAge: '7d' }));
app.use('/uploads', express.static(UPLOADS, { maxAge: '7d' }));

app.get('/api/media', (req, res) => {
  const has = (p) => fs.existsSync(path.join(__dirname, 'public', p));
  res.json({ music: has('audio/tema.mp3'), video: has('video/abuela.mp4') });
});

app.get('/api/messages', (req, res) => {
  res.json(messages.map(({ ip, ...m }) => m));
});

app.post('/api/messages', upload.single('audio'), (req, res) => {
  const drop = () => req.file && fs.promises.unlink(req.file.path).catch(() => {});
  if (tooFast(req.ip)) {
    drop();
    return res.status(429).json({ error: 'Demasiados mensajes seguidos. Probá de nuevo en un rato.' });
  }

  const name = clean(req.body.name, 40) || 'Anónimo';
  const city = clean(req.body.city, 80);
  const country = clean(req.body.country, 60);
  const text = clean(req.body.text, MAX_TEXT);
  const lat = Number(req.body.lat);
  const lng = Number(req.body.lng);

  if (!city || !Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    drop();
    return res.status(400).json({ error: 'Elegí tu ciudad de la lista.' });
  }
  if (!text && !req.file) {
    return res.status(400).json({ error: 'Dejá un mensaje o grabá un audio.' });
  }

  const msg = {
    id: crypto.randomUUID(),
    name,
    city,
    country,
    lat: Math.round(lat * 1e4) / 1e4,
    lng: Math.round(lng * 1e4) / 1e4,
    text,
    audio: req.file ? `/uploads/${req.file.filename}` : null,
    createdAt: new Date().toISOString(),
  };
  messages.push(msg);
  persist();
  res.status(201).json(msg);
});

app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    return res.status(400).json({ error: 'El audio es muy pesado (máximo 4 MB, unos 2 minutos).' });
  }
  console.error(err);
  res.status(500).json({ error: 'Algo falló. Probá de nuevo.' });
});

app.listen(PORT, () => console.log(`Gracias Leo -> http://localhost:${PORT}`));
