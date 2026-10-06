import { score } from './music.js';
import { Film } from './film.js';
import { Globe } from './globe.js';
import { Messages } from './messages.js';

const $ = (id) => document.getElementById(id);

const tip = document.createElement('div');
tip.className = 'label-cap';
tip.style.cssText =
  'position:fixed;z-index:15;pointer-events:none;padding:7px 12px;border-radius:999px;background:rgba(9,14,22,.88);border:1px solid rgba(244,248,252,.12);color:#f5f8fc;font-size:10px;letter-spacing:.2em;opacity:0;transition:opacity .25s;transform:translate(-50%,-150%)';
document.body.appendChild(tip);

let messages;
const globe = new Globe($('globe'), {
  onSelect: (c) => messages?.showCluster(c),
  onHover: (hit) => {
    if (!hit) return (tip.style.opacity = '0');
    const n = hit.c.list.length;
    tip.textContent = `${hit.c.list[0].city} · ${n} ${n === 1 ? 'mensaje' : 'mensajes'}`;
    tip.style.left = `${hit.sx}px`;
    tip.style.top = `${hit.sy}px`;
    tip.style.opacity = '1';
  },
});
messages = new Messages({ globe });

const globeReady = globe.init().then(() => messages.load());

let worldShown = false;
async function showWorld() {
  const world = $('world');
  world.hidden = false;
  world.classList.add('is-entering');
  $('mute').classList.add('is-world');
  await globeReady;
  globe.start();
  globe.intro();
  if (!worldShown) {
    worldShown = true;
    localStorage.setItem('gl-seen', '1');
  }
  setTimeout(() => world.classList.remove('is-entering'), 4000);
}

const film = new Film($('film'), {
  onDone: () => {
    updateRotate();
    screen.orientation?.unlock?.();
    setTimeout(showWorld, 700);
  },
});

const isPhone = matchMedia('(pointer: coarse) and (max-width: 950px), (pointer: coarse) and (max-height: 500px)');
const portrait = matchMedia('(orientation: portrait)');
let verticalOk = false;
function updateRotate() {
  const ask = film.running && isPhone.matches && portrait.matches && !verticalOk;
  $('rotate').hidden = !ask;
  if (ask) film.pause();
  else film.resume();
}
portrait.addEventListener('change', updateRotate);
$('rotateSkip').addEventListener('click', () => {
  verticalOk = true;
  updateRotate();
});

async function goLandscape() {
  if (!isPhone.matches) return;
  try {
    await document.documentElement.requestFullscreen?.({ navigationUI: 'hide' });
    await screen.orientation?.lock?.('landscape');
  } catch {}
}

$('gate').addEventListener(
  'click',
  () => {
    const gate = $('gate');
    gate.classList.add('gate--exit');
    goLandscape();
    score.start();
    $('mute').hidden = false;
    setTimeout(() => {
      gate.hidden = true;
      if (location.hash === '#mundo') showWorld();
      else film.play().then(updateRotate);
    }, 1100);
  },
  { once: true }
);

$('replay').addEventListener('click', () => {
  messages.closeCard();
  globe.stop();
  $('world').hidden = true;
  $('mute').classList.remove('is-world');
  film.play().then(updateRotate);
});

$('mute').addEventListener('click', () => {
  const m = !score.muted;
  score.setMuted(m);
  $('mute').setAttribute('aria-pressed', String(m));
  $('mute').textContent = m ? 'sonido off' : 'sonido on';
});

document.addEventListener('visibilitychange', () => {
  if (score.held) return;
  if (score.track) {
    if (document.hidden) score.track.pause();
    else score.track.play().catch(() => {});
  }
  if (!score.ctx) return;
  if (document.hidden) score.ctx.suspend();
  else score.ctx.resume();
});

