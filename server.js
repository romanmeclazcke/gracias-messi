const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const store = require('./store');

const PORT = process.env.PORT || 3010;
const MAX_AUDIO_BYTES = 4 * 1024 * 1024;
const MAX_TEXT = 600;
const AUDIO_TYPES = store.AUDIO_TYPES;

const upload = multer({
  storage: multer.memoryStorage(),
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
app.set('trust proxy', 1);
app.use(express.json({ limit: '20kb' }));
app.use(
  express.static(path.join(__dirname, 'public'), {
    setHeaders: (res, file) => {
      if (/\.(html|css|js|json)$/.test(file)) res.setHeader('Cache-Control', 'no-cache');
    },
  })
);
app.use('/vendor/three', express.static(path.join(__dirname, 'node_modules/three'), { maxAge: '7d' }));
if (store.uploads) app.use('/uploads', express.static(store.uploads, { maxAge: '7d' }));

app.get('/api/media', (req, res) => {
  const has = (p) => fs.existsSync(path.join(__dirname, 'public', p));
  res.json({ music: has('audio/tema.mp3'), video: has('video/abuela.mp4') });
});

app.get('/api/messages', async (req, res, next) => {
  try {
    res.json(await store.list());
  } catch (err) {
    next(err);
  }
});

app.get('/api/audio/:id', async (req, res, next) => {
  try {
    const a = await store.audio(req.params.id);
    if (!a) return res.sendStatus(404);
    res.set({ 'Content-Type': a.type || 'audio/webm', 'Cache-Control': 'public, max-age=604800, immutable' });
    res.send(a.buffer);
  } catch (err) {
    next(err);
  }
});

app.post('/api/messages', upload.single('audio'), async (req, res, next) => {
  try {
    if (tooFast(req.ip)) {
      return res.status(429).json({ error: 'Demasiados mensajes seguidos. Probá de nuevo en un rato.' });
    }

    const name = clean(req.body.name, 40) || 'Anónimo';
    const city = clean(req.body.city, 80);
    const country = clean(req.body.country, 60);
    const text = clean(req.body.text, MAX_TEXT);
    const lat = Number(req.body.lat);
    const lng = Number(req.body.lng);

    if (!city || !Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
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
    };
    const audio = req.file ? { buffer: req.file.buffer, type: req.file.mimetype.split(';')[0] } : null;
    res.status(201).json(await store.add(msg, audio, req.ip));
  } catch (err) {
    next(err);
  }
});

app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    return res.status(400).json({ error: 'El audio es muy pesado (máximo 4 MB, unos 2 minutos).' });
  }
  console.error(err);
  res.status(500).json({ error: 'Algo falló. Probá de nuevo.' });
});

store
  .init()
  .then(() => app.listen(PORT, () => console.log(`Gracias Leo -> http://localhost:${PORT} (mensajes en ${store.kind})`)))
  .catch((err) => {
    console.error('No se pudo iniciar el almacenamiento de mensajes:', err);
    process.exit(1);
  });
