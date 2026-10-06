import { score } from './music.js';

// Si se agrega /video/abuela.mp4, la escena de la abuela usa ese video en lugar de la ilustración.
const SCENES = [
  {
    kind: 'center', dur: 3600, intensity: 0,
    body: 'Esta es la historia de un pibe de Rosario.',
  },
  {
    img: 'rosario.jpg', kb: 'kb-in', look: 'cool', dur: 5400,
    eyebrow: 'Rosario · 24 de junio de 1987',
    title: 'La Bajada',
    body: 'Tercer hijo de Jorge y Celia. Un barrio del sur, una pelota gastada y una abuela que no se perdía un partido.',
  },
  {
    img: 'abuela.jpg', video: '/video/abuela.mp4', kb: 'kb-out', look: 'sepia', dur: 12400, mz: 1.2,
    eyebrow: 'Club Abanderado Grandoli · principios de los 90',
    subs: [
      { at: 400, to: 2600, narr: true, text: 'Faltaba un chico para completar el equipo.' },
      { at: 2900, to: 5100, who: 'La abuela Celia', text: '¿Por qué no lo ponés al nene?' },
      { at: 5400, to: 7800, who: 'Salvador Aparicio, el técnico', text: 'Es muy chiquito, señora. Me lo van a lastimar.' },
      { at: 8100, to: 10200, who: 'La abuela Celia', text: 'Ponelo. Vas a ver cómo juega.' },
      { at: 10500, to: 12200, narr: true, text: 'Y Salvador lo puso.' },
    ],
  },
  {
    img: 'potrero.jpg', clip: 'potrero.mp4', look: 'sepia', dur: 10000,
    eyebrow: 'La primera pelota',
    body: 'La primera la dejó pasar. La segunda le cayó en la zurda y arrancó: dejó a todos en el camino. <em>Desde entonces, cada gol tiene dos dedos apuntando al cielo. Son para ella.</em>',
  },
  {
    img: 'barcelona.jpg', side: true, kb: 'kb-in', look: 'soft', dur: 6200, intensity: 0.15,
    eyebrow: 'Año 2000 · 13 años',
    title: 'Se fue chiquito',
    body: 'Un problema de crecimiento, un tratamiento que en casa no se podía pagar y un contrato firmado en una servilleta. Se fue a Barcelona. Nunca dejó de hablar como en Rosario.',
  },
  {
    img: 'avion.jpg', clip: 'sueno.mp4', mz: 1, look: 'soft', dur: 14700,
    eyebrow: 'Antes de ser Messi',
    title: 'El sueño',
  },
  {
    img: '2007.jpg', clip: '2006.mp4', look: 'soft', dur: 8500, pos: 'center 25%',
    eyebrow: '2005 · 2006',
    title: 'La celeste y blanca',
    body: 'Campeón del Mundial Sub-20, goleador y mejor jugador. Al año siguiente, con la 19 en la espalda, su primer gol en un Mundial. Diego lo gritaba en la tribuna.',
  },
  {
    img: '2008.jpg', kb: 'kb-left', look: 'soft', dur: 6500,
    eyebrow: 'Pekín 2008',
    title: 'Oro olímpico',
    body: 'Barcelona no lo quería soltar. Él insistió. Volvió con la medalla de oro colgada.',
  },
  {
    img: '2014.jpg', clip: '2014.mp4', look: 'mono', dur: 14400, intensity: 0.3,
    eyebrow: 'Maracaná · 13 de julio de 2014',
    title: 'Tan cerca',
    body: 'Mejor jugador del Mundial. La copa quedó a un gol. Después llegaron dos finales de Copa América más. Y dos derrotas más.',
  },
  {
    img: '2018.jpg', kb: 'kb-out', look: 'mono', dur: 7500, pos: 'center 20%',
    eyebrow: 'Nueva Jersey · 2016',
    title: 'Renunció. Y volvió.',
    body: '<em>“Se terminó para mí la Selección”</em>, dijo esa noche. Un país entero salió a pedirle que no se fuera. A las pocas semanas, volvió.',
  },
  {
    kind: 'center', dur: 6000, intensity: 0.5,
    eyebrow: 'Maracaná · 10 de julio de 2021',
    title: 'Por fin',
    body: 'Copa América ante Brasil, en Brasil. Cayó de rodillas y lloró. Lloramos todos.',
  },
  {
    img: '2022-tribuna.jpg', clip: '2022-mexico.mp4', mz: 1.15, look: 'soft', dur: 11000, intensity: 0.65,
    eyebrow: 'Catar 2022',
    title: '“Que la gente confíe”',
    body: 'Después de perder con Arabia Saudita pidió una sola cosa. Contra México le pegó desde afuera del área y el país volvió a respirar.',
  },
  {
    img: '2022-penal.jpg', clip: '2022-campeon.mp4', look: 'soft', dur: 9600, intensity: 1, flash: true,
    eyebrow: 'Lusail · 18 de diciembre de 2022',
    title: 'Campeones del mundo',
    body: 'Dos goles en la final más linda de la historia. La copa que le faltaba. La tercera estrella.',
  },
  {
    img: 'hinchas-230.jpg', clip: '2022-equipo.mp4', look: 'soft', dur: 6500, intensity: 0.9,
    eyebrow: '2021 · 2022 · 2024',
    title: 'Lo levantó todo',
    body: 'Copa América, Finalissima, Mundial y otra Copa América. El capitán nos devolvió todo lo que nos debíamos.',
  },
  {
    img: '2026-228.jpg', clip: '2026-baile.mp4', look: 'soft', dur: 7700, intensity: 0.6, pos: 'center 12%',
    eyebrow: 'Mundial 2026',
    title: 'El último baile',
    body: 'Su sexto Mundial. Superó los 16 goles de Klose y llevó al equipo hasta la final, otra vez.',
  },
  {
    img: '2026-228.jpg', clip: '2026-papa.mp4', look: 'soft', dur: 12700, intensity: 0.45, pos: 'center 12%',
    eyebrow: 'Nueva Jersey · 19 de julio de 2026',
    title: 'Por mi viejo',
    body: 'La final se escapó en el alargue. Con la medalla de plata colgada, habló de Jorge, su papá, el que lo acompañó desde Grandoli hasta Barcelona: <em>“Las piernas ya no me daban, pero quería llevármela por él.”</em>',
  },
  {
    img: 'hinchas-230.jpg', kind: 'center', dim: true, below: true, kb: 'kb-in', look: 'mono', dur: 11500, intensity: 0.35,
    eyebrow: 'Más allá de la pelota',
    title: 'No es solo cómo juega',
    body: 'Es el pibe que nunca se la creyó. El que perdió tres finales seguidas y volvió a intentarlo. El que abraza al rival, saluda al utilero y sigue hablando como en Rosario. <em>Humildad, pasión, sacrificio. Por eso no solo lo admiramos: lo queremos.</em>',
  },
  {
    img: '2026-egipto.jpg', kind: 'stats', full: true, kb: 'kb-in', look: 'mono', dur: 8000, intensity: 0.5, pos: 'center 18%',
    eyebrow: 'Con la celeste y blanca · 2005 — 2026',
    stats: [[207, 'partidos'], [125, 'goles'], [6, 'títulos']],
  },
  {
    kind: 'center', dur: 6500, intensity: 0.4, final: true,
    title: 'Gracias, Leo.',
    body: 'Ahora te toca a vos.',
  },
];

export class Film {
  constructor(root, { onDone }) {
    this.root = root;
    this.stage = root.querySelector('#stage');
    this.progress = root.querySelector('#progress');
    this.onDone = onDone;
    this.timers = [];
    this.total = SCENES.reduce((a, s) => a + s.dur, 0);
    root.querySelector('#skip').addEventListener('click', () => this.finish());
    this.videoReady = fetch('/api/media')
      .then((r) => r.json())
      .then((m) => m.video)
      .catch(() => false);
    SCENES.forEach((s) => s.img && (new Image().src = `/img/${s.img}`));
    SCENES.forEach((s) => s.clip && fetch(`/video/${s.clip}`).catch(() => {}));
  }

  async play() {
    this.hasVideo = await this.videoReady;
    this.root.hidden = false;
    this.root.classList.remove('is-ending');
    this.stage.innerHTML = '';
    this.index = -1;
    this.elapsed = 0;
    this.done = false;
    this.nextScene();
  }

  later(fn, ms) {
    this.timers.push(setTimeout(fn, ms));
  }

  nextScene() {
    if (this.done) return;
    this.index++;
    const s = SCENES[this.index];
    if (!s) return this.finish();

    const prev = this.stage.querySelector('.scene.is-in');
    if (prev) {
      prev.classList.remove('is-in');
      prev.classList.add('is-out');
      setTimeout(() => prev.remove(), 1800);
    }

    const el = this.build(s);
    this.stage.appendChild(el);
    requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('is-in')));

    if (typeof s.intensity === 'number') score.setIntensity(s.intensity);
    if (s.flash) {
      const f = document.createElement('div');
      f.className = 'flash';
      el.appendChild(f);
      this.later(() => f.classList.add('go'), 250);
    }
    if (s.subs && !el.querySelector('video')) {
      const subs = el.querySelectorAll('.sub');
      s.subs.forEach((sub, i) => {
        this.later(() => subs[i].classList.add('on'), sub.at);
        this.later(() => subs[i].classList.remove('on'), sub.to);
      });
    }
    if (s.stats) {
      el.querySelectorAll('.stat__n').forEach((n) => this.later(() => this.count(n), 900));
    }
    if (s.final) this.later(() => this.root.classList.add('is-ending'), s.dur - 2200);
    this.later(() => el.classList.add('is-leaving'), s.dur - 700);

    this.progress.style.width = `${((this.elapsed + s.dur) / this.total) * 100}%`;
    this.elapsed += s.dur;
    this.later(() => this.nextScene(), s.dur);
  }

  build(s) {
    const el = document.createElement('div');
    el.className = `scene ${s.kb || ''} ${s.look ? `scene--${s.look}` : ''} ${s.kind === 'center' || s.kind === 'stats' ? 'scene--center' : ''} ${s.below ? 'scene--below' : ''} ${s.full ? 'scene--full' : ''} ${s.side ? 'scene--side' : ''}`;
    el.style.setProperty('--dur', `${s.dur + 2000}ms`);
    if (s.mz) el.style.setProperty('--mz', s.mz);
    if (s.pos) el.style.setProperty('--pos', s.pos);

    let media = '';
    if (s.video && this.hasVideo) {
      media = `<div class="scene__media"><video src="${s.video}" data-voice autoplay playsinline></video></div><div class="scene__shade"></div>`;
    } else if (s.clip) {
      const blur = s.img ? `<div class="scene__blur" style="background-image:url('/img/${s.img}')"></div>` : '';
      media = `${blur}<div class="scene__media scene__media--clip"><video src="/video/${s.clip}" muted autoplay playsinline loop preload="auto"></video></div><div class="scene__shade"></div>`;
    } else if (s.img) {
      const bg = `background-image:url('/img/${s.img}')`;
      media = `<div class="scene__blur" style="${bg}"></div><div class="scene__media" style="${bg};background-position:${s.pos || 'center'}"></div><div class="scene__shade"></div>`;
    }
    if (s.kind === 'stats' || s.dim) media = media.replace('scene__shade', 'scene__shade" style="background:rgba(6,10,17,.72)');

    let i = 0;
    const r = () => `class="reveal" style="--i:${i++}"`;
    let text = '';
    if (s.eyebrow) text += `<p ${r()}><span class="label-cap scene__eyebrow">${s.eyebrow}</span></p>`;
    if (s.title) text += `<h2 class="scene__title reveal" style="--i:${i++}">${s.title}</h2>`;
    if (s.body) text += `<p class="scene__body reveal" style="--i:${i++}${s.kind === 'center' ? ';margin:0 auto;font-style:italic' : ''}">${s.body}</p>`;
    if (s.stats) {
      text += `<div class="stats">${s.stats
        .map(([n, l]) => `<div class="stat reveal" style="--i:${i++}"><span class="stat__n" data-n="${n}">0</span><span class="label-cap stat__l">${l}</span></div>`)
        .join('')}</div>`;
    }

    let subs = '';
    if (s.subs && !(s.video && this.hasVideo)) {
      subs = `<div class="subs">${s.subs
        .map((x) => `<p class="sub ${x.narr ? 'sub--narr' : ''}">${x.who ? `<span class="label-cap sub__who">${x.who}</span>` : ''}${x.narr ? x.text : `—${x.text}`}</p>`)
        .join('')}</div>`;
    }
    const textBlock = s.subs
      ? `<div class="scene__text scene__text--top">${text}</div>`
      : `<div class="scene__text">${text}</div>`;

    el.innerHTML = `${media}${textBlock}${subs}`;
    const clip = el.querySelector('.scene__media--clip video');
    if (clip) {
      clip.muted = true;
      clip.play().catch(() => {});
    }
    const v = el.querySelector('video[data-voice]');
    if (v) {
      score.duck(true);
      v.addEventListener('ended', () => score.duck(false));
    }
    return el;
  }

  count(el) {
    const target = Number(el.dataset.n);
    const t0 = performance.now();
    const dur = 2200;
    const tick = (now) => {
      const k = Math.min(1, (now - t0) / dur);
      el.textContent = Math.round(target * (1 - (1 - k) ** 4));
      if (k < 1 && !this.done) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  finish() {
    if (this.done) return;
    this.done = true;
    this.timers.forEach(clearTimeout);
    this.timers = [];
    score.duck(false);
    score.setIntensity(0.1);
    this.stage.querySelectorAll('video').forEach((v) => v.pause());
    this.root.classList.add('is-ending');
    this.root.style.transition = 'opacity 1.4s cubic-bezier(.65,0,.35,1)';
    this.root.style.opacity = '0';
    this.onDone?.();
    setTimeout(() => {
      this.root.hidden = true;
      this.root.style.opacity = '';
      this.stage.innerHTML = '';
    }, 1500);
  }
}
