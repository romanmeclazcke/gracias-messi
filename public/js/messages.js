import { score } from './music.js';

const $ = (id) => document.getElementById(id);
const MAX_REC_MS = 90_000;

const FALLBACK_CITIES = [
  ['Rosario', 'Santa Fe, Argentina', -32.9468, -60.6393],
  ['Buenos Aires', 'Argentina', -34.6037, -58.3816],
  ['Córdoba', 'Argentina', -31.4201, -64.1888],
  ['Mendoza', 'Argentina', -32.8895, -68.8458],
  ['La Plata', 'Buenos Aires, Argentina', -34.9214, -57.9545],
  ['Mar del Plata', 'Buenos Aires, Argentina', -38.0055, -57.5426],
  ['San Miguel de Tucumán', 'Tucumán, Argentina', -26.8083, -65.2176],
  ['Salta', 'Argentina', -24.7821, -65.4232],
  ['Santa Fe', 'Argentina', -31.6107, -60.6973],
  ['Neuquén', 'Argentina', -38.9516, -68.0591],
  ['Bahía Blanca', 'Buenos Aires, Argentina', -38.7183, -62.2663],
  ['Corrientes', 'Argentina', -27.4692, -58.8306],
  ['Posadas', 'Misiones, Argentina', -27.3671, -55.8961],
  ['San Juan', 'Argentina', -31.5375, -68.5364],
  ['Resistencia', 'Chaco, Argentina', -27.4606, -58.9839],
  ['Ushuaia', 'Tierra del Fuego, Argentina', -54.8019, -68.303],
  ['Bariloche', 'Río Negro, Argentina', -41.1335, -71.3103],
  ['Montevideo', 'Uruguay', -34.9011, -56.1645],
  ['Santiago', 'Chile', -33.4489, -70.6693],
  ['Barcelona', 'España', 41.3874, 2.1686],
  ['Madrid', 'España', 40.4168, -3.7038],
  ['Miami', 'Estados Unidos', 25.7617, -80.1918],
  ['Nueva York', 'Estados Unidos', 40.7128, -74.006],
  ['Ciudad de México', 'México', 19.4326, -99.1332],
  ['París', 'Francia', 48.8566, 2.3522],
  ['Roma', 'Italia', 41.9028, 12.4964],
  ['Londres', 'Reino Unido', 51.5072, -0.1276],
  ['Doha', 'Catar', 25.2854, 51.531],
  ['Calcuta', 'India', 22.5726, 88.3639],
  ['Tokio', 'Japón', 35.6762, 139.6503],
  ['Sídney', 'Australia', -33.8688, 151.2093],
].map(([name, region, lat, lng]) => ({ name, region, country: region.split(', ').pop(), lat, lng }));

const norm = (s) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const escapeHtml = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const fmtTime = (s) => (Number.isFinite(s) ? `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}` : '0:00');

export class Messages {
  constructor({ globe }) {
    this.globe = globe;
    this.all = [];
    this.city = null;
    this.blob = null;
    this.current = null;
    this.bindForm();
    this.bindCard();
  }

  async load() {
    try {
      const r = await fetch('/api/messages');
      if (!r.ok) throw new Error();
      this.all = await r.json();
    } catch {
      this.all = [];
      $('counter').textContent = 'No pudimos cargar los mensajes. Recargá la página.';
      return;
    }
    this.globe.setMessages(this.all);
    this.updateCounter();
  }

  updateCounter() {
    const n = this.all.length;
    const cities = new Set(this.all.map((m) => `${m.city}|${m.country}`)).size;
    $('counter').textContent = n
      ? `${n.toLocaleString('es-AR')} ${n === 1 ? 'mensaje' : 'mensajes'} desde ${cities.toLocaleString('es-AR')} ${cities === 1 ? 'ciudad' : 'ciudades'}. Cada luz es uno.`
      : 'Todavía no hay luces. Encendé la primera.';
  }

  /* ---------- Tarjeta ---------- */
  bindCard() {
    $('cardClose').addEventListener('click', () => this.closeCard());
    $('randomMsg').addEventListener('click', () => this.random());
  }

  showCluster(c) {
    if (!c) return this.closeCard();
    const list = [...c.list].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const first = list[0];
    $('cardCity').textContent = `${first.city}${first.country ? ` · ${first.country}` : ''} — ${list.length} ${list.length === 1 ? 'mensaje' : 'mensajes'}`;
    $('cardList').innerHTML = list
      .map(
        (m) => `<article class="msg">
          ${m.audio ? `<div class="msg__audio" data-src="${escapeHtml(m.audio)}"><button type="button" class="play" aria-label="Reproducir audio de ${escapeHtml(m.name)}"></button><div class="msg__bar"><span></span></div><span class="msg__time">0:00</span></div>` : ''}
          ${m.text ? `<p class="msg__text">${escapeHtml(m.text)}</p>` : ''}
          <p class="msg__meta">${escapeHtml(m.name)} · ${new Date(m.createdAt).toLocaleDateString('es-AR', { day: 'numeric', month: 'long' })}</p>
        </article>`
      )
      .join('');
    $('cardList').scrollTop = 0;
    $('cardList').querySelectorAll('.msg__audio').forEach((el) => {
      el.querySelector('.play').addEventListener('click', () => this.toggleAudio(el));
    });
    $('card').hidden = false;
    $('hint').style.opacity = '0';
  }

  closeCard() {
    this.stopAudio();
    $('card').hidden = true;
    this.globe.selected = null;
  }

  toggleAudio(el) {
    if (this.current?.el === el) return this.stopAudio();
    this.stopAudio();
    const audio = new Audio(el.dataset.src);
    const btn = el.querySelector('.play');
    const bar = el.querySelector('.msg__bar span');
    const time = el.querySelector('.msg__time');
    this.current = { el, audio };
    btn.classList.add('is-playing');
    score.duck(true);
    audio.addEventListener('timeupdate', () => {
      if (audio.duration && Number.isFinite(audio.duration)) bar.style.width = `${(audio.currentTime / audio.duration) * 100}%`;
      time.textContent = fmtTime(audio.currentTime);
    });
    audio.addEventListener('ended', () => this.stopAudio());
    audio.addEventListener('error', () => {
      time.textContent = 'error';
      this.stopAudio();
    });
    audio.play().catch(() => this.stopAudio());
  }

  stopAudio() {
    if (!this.current) return;
    const { el, audio } = this.current;
    audio.pause();
    el.querySelector('.play').classList.remove('is-playing');
    this.current = null;
    score.duck(false);
  }

  async random() {
    if (!this.all.length) return;
    const withAudio = this.all.filter((m) => m.audio);
    const pool = withAudio.length && Math.random() < 0.7 ? withAudio : this.all;
    const m = pool[Math.floor(Math.random() * pool.length)];
    const c = this.globe.clusters.get(`${m.lat.toFixed(1)},${m.lng.toFixed(1)}`);
    if (!c) return;
    this.closeCard();
    await this.globe.flyTo(m.lat, m.lng, 2.2, 2000);
    this.globe.select(c);
    this.showCluster(c);
    if (m.audio) {
      const el = [...$('cardList').querySelectorAll('.msg__audio')].find((x) => x.dataset.src === m.audio);
      if (el) this.toggleAudio(el);
    }
  }

  /* ---------- Formulario ---------- */
  bindForm() {
    $('openForm').addEventListener('click', () => this.openForm());
    $('formClose').addEventListener('click', () => this.closeForm());
    $('sheet').addEventListener('click', (e) => e.target === $('sheet') && this.closeForm());
    $('fText').addEventListener('input', (e) => ($('textCount').textContent = e.target.value.length));
    $('form').addEventListener('submit', (e) => {
      e.preventDefault();
      this.submit();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape') return;
      if (!$('sheet').hidden) this.closeForm();
      else if (!$('card').hidden) this.closeCard();
    });
    this.bindCity();
    this.bindRecorder();
  }

  openForm() {
    this.closeCard();
    $('sheet').hidden = false;
    $('formError').textContent = '';
    setTimeout(() => (this.city ? $('fText') : $('fName')).focus(), 350);
  }

  closeForm() {
    if (this.recorder?.state === 'recording') this.recorder.stop();
    $('sheet').hidden = true;
  }

  bindCity() {
    const input = $('fCity');
    const list = $('cityList');
    let timer;
    let reqId = 0;
    let options = [];
    let active = -1;

    const render = () => {
      if (!options.length) {
        list.innerHTML = '<li class="city-list__empty">No encontramos esa ciudad. Probá con otra cercana.</li>';
      } else {
        list.innerHTML = options
          .map((o, i) => `<li role="option" data-i="${i}" aria-selected="${i === active}">${escapeHtml(o.name)}<small>${escapeHtml(o.region)}</small></li>`)
          .join('');
      }
      list.hidden = false;
      input.setAttribute('aria-expanded', 'true');
    };
    const close = () => {
      list.hidden = true;
      input.setAttribute('aria-expanded', 'false');
    };
    const choose = (o) => {
      this.city = o;
      input.value = `${o.name}, ${o.country}`;
      input.classList.add('is-ok');
      $('cityHint').textContent = `Tu luz se va a encender en ${o.name}.`;
      $('cityHint').classList.remove('is-err');
      close();
    };

    input.addEventListener('input', () => {
      this.city = null;
      input.classList.remove('is-ok');
      $('cityHint').textContent = 'Escribí y elegí de la lista.';
      clearTimeout(timer);
      const q = input.value.trim();
      if (q.length < 2) return close();
      timer = setTimeout(async () => {
        const id = ++reqId;
        const local = FALLBACK_CITIES.filter((c) => norm(c.name).startsWith(norm(q)));
        let remote = [];
        try {
          const r = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=7&language=es&format=json`);
          const d = await r.json();
          remote = (d.results || []).map((x) => ({
            name: x.name,
            region: [x.admin1, x.country].filter(Boolean).join(', '),
            country: x.country || '',
            lat: x.latitude,
            lng: x.longitude,
          }));
        } catch {
          remote = [];
        }
        if (id !== reqId) return;
        options = remote.length ? remote : local;
        active = options.length ? 0 : -1;
        render();
      }, 260);
    });

    input.addEventListener('keydown', (e) => {
      if (list.hidden || !options.length) return;
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        active = (active + (e.key === 'ArrowDown' ? 1 : -1) + options.length) % options.length;
        render();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (options[active]) choose(options[active]);
      } else if (e.key === 'Escape') {
        e.stopPropagation();
        close();
      }
    });
    list.addEventListener('pointerdown', (e) => {
      const li = e.target.closest('li[data-i]');
      if (!li) return;
      e.preventDefault();
      choose(options[Number(li.dataset.i)]);
    });
    input.addEventListener('blur', () => setTimeout(close, 150));
  }

  bindRecorder() {
    const rec = $('rec');
    const btn = $('recBtn');
    const status = $('recStatus');
    const preview = $('recPreview');
    const discard = $('recDiscard');
    const canvas = $('recWave');
    const g = canvas.getContext('2d');

    const drawIdle = () => {
      g.clearRect(0, 0, canvas.width, canvas.height);
      g.fillStyle = 'rgba(244,248,252,0.15)';
      for (let x = 0; x < canvas.width; x += 6) g.fillRect(x, canvas.height / 2 - 1, 3, 2);
    };
    drawIdle();

    const reset = () => {
      this.blob = null;
      preview.hidden = true;
      preview.removeAttribute('src');
      discard.hidden = true;
      status.textContent = 'Tocá para grabar (hasta 90 segundos)';
      drawIdle();
    };
    discard.addEventListener('click', reset);

    btn.addEventListener('click', async () => {
      if (this.recorder?.state === 'recording') return this.recorder.stop();
      if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
        status.textContent = 'Tu navegador no permite grabar audio. Escribí tu mensaje.';
        return;
      }
      let stream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
      } catch {
        status.textContent = 'Necesitamos permiso para usar el micrófono.';
        return;
      }
      reset();
      const type = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/ogg;codecs=opus', 'audio/webm'].find((t) => MediaRecorder.isTypeSupported(t));
      const mr = (this.recorder = new MediaRecorder(stream, type ? { mimeType: type, audioBitsPerSecond: 48000 } : undefined));
      const chunks = [];
      mr.ondataavailable = (e) => e.data.size && chunks.push(e.data);

      const actx = new (window.AudioContext || window.webkitAudioContext)();
      const analyser = actx.createAnalyser();
      analyser.fftSize = 256;
      actx.createMediaStreamSource(stream).connect(analyser);
      const data = new Uint8Array(analyser.frequencyBinCount);
      const bars = [];
      const t0 = performance.now();
      let raf;
      const draw = () => {
        analyser.getByteTimeDomainData(data);
        let peak = 0;
        for (const v of data) peak = Math.max(peak, Math.abs(v - 128));
        bars.push(peak / 128);
        const max = Math.floor(canvas.width / 6);
        if (bars.length > max) bars.shift();
        g.clearRect(0, 0, canvas.width, canvas.height);
        g.fillStyle = '#75aadb';
        bars.forEach((b, i) => {
          const h = Math.max(2, b * canvas.height * 1.6);
          g.fillRect(i * 6, (canvas.height - h) / 2, 3, h);
        });
        const s = (performance.now() - t0) / 1000;
        status.textContent = `Grabando… ${fmtTime(s)} / 1:30 — tocá para terminar`;
        if (s * 1000 >= MAX_REC_MS) mr.stop();
        raf = requestAnimationFrame(draw);
      };

      mr.onstop = () => {
        cancelAnimationFrame(raf);
        stream.getTracks().forEach((t) => t.stop());
        actx.close();
        rec.classList.remove('is-recording');
        score.duck(false);
        const blob = new Blob(chunks, { type: mr.mimeType || 'audio/webm' });
        if (blob.size < 2000) {
          status.textContent = 'La grabación quedó vacía. Probá de nuevo.';
          return;
        }
        this.blob = blob;
        preview.src = URL.createObjectURL(blob);
        preview.hidden = false;
        discard.hidden = false;
        status.textContent = `Audio listo · ${fmtTime((performance.now() - t0) / 1000)}`;
      };

      score.duck(true);
      rec.classList.add('is-recording');
      mr.start(250);
      draw();
    });
    this.resetRecorder = reset;
  }

  async submit() {
    const err = $('formError');
    err.textContent = '';
    if (this.recorder?.state === 'recording') {
      err.textContent = 'Terminá la grabación antes de enviar.';
      return;
    }
    if (!this.city) {
      err.textContent = 'Elegí tu ciudad de la lista.';
      $('cityHint').classList.add('is-err');
      $('fCity').focus();
      return;
    }
    const text = $('fText').value.trim();
    if (!text && !this.blob) {
      err.textContent = 'Escribile algo o grabale un audio.';
      $('fText').focus();
      return;
    }

    const fd = new FormData();
    fd.append('name', $('fName').value.trim());
    fd.append('city', this.city.name);
    fd.append('country', this.city.country);
    fd.append('lat', this.city.lat);
    fd.append('lng', this.city.lng);
    fd.append('text', text);
    if (this.blob) {
      const ext = this.blob.type.includes('mp4') ? 'm4a' : this.blob.type.includes('ogg') ? 'ogg' : 'webm';
      fd.append('audio', this.blob, `mensaje.${ext}`);
    }

    const btn = $('submitBtn');
    btn.disabled = true;
    btn.textContent = 'Encendiendo…';
    try {
      const r = await fetch('/api/messages', { method: 'POST', body: fd });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || 'No se pudo enviar. Probá de nuevo.');
      this.all.push(d);
      this.closeForm();
      $('fText').value = '';
      $('textCount').textContent = '0';
      this.resetRecorder();
      this.updateCounter();
      await this.globe.flyTo(d.lat, d.lng, 2.1, 2400);
      this.globe.setMessages(this.all);
      const c = this.globe.clusters.get(`${d.lat.toFixed(1)},${d.lng.toFixed(1)}`);
      this.globe.ripple(d.lat, d.lng);
      setTimeout(() => this.globe.ripple(d.lat, d.lng), 500);
      this.toast(`Tu luz ya brilla en ${d.city}`);
      if (c) setTimeout(() => {
        this.globe.select(c);
        this.showCluster(c);
      }, 900);
    } catch (e) {
      err.textContent = e.message;
    } finally {
      btn.disabled = false;
      btn.textContent = 'Encender mi luz';
    }
  }

  toast(msg) {
    const t = $('toast');
    t.textContent = msg;
    t.classList.add('on');
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => t.classList.remove('on'), 3800);
  }
}
