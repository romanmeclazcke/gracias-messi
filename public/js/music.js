// Pieza original generada en vivo. Si existe /audio/tema.mp3 se usa ese archivo en su lugar.
const N = (name) => {
  const m = /^([A-G])(#|b)?(\d)$/.exec(name);
  const base = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }[m[1]];
  const acc = m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0;
  const midi = (Number(m[3]) + 1) * 12 + base + acc;
  return 440 * 2 ** ((midi - 69) / 12);
};

// D – A – Bm – G | D – A – G – A
const CHORDS = [
  { bass: 'D3', arp: ['D4', 'A4', 'D5', 'F#5', 'D5', 'A4', 'F#4', 'A4'], pad: ['D4', 'F#4', 'A4'] },
  { bass: 'A2', arp: ['A3', 'E4', 'A4', 'C#5', 'A4', 'E4', 'C#4', 'E4'], pad: ['A3', 'C#4', 'E4'] },
  { bass: 'B2', arp: ['B3', 'F#4', 'B4', 'D5', 'B4', 'F#4', 'D4', 'F#4'], pad: ['B3', 'D4', 'F#4'] },
  { bass: 'G2', arp: ['G3', 'D4', 'G4', 'B4', 'G4', 'D4', 'B3', 'D4'], pad: ['G3', 'B3', 'D4'] },
  { bass: 'D3', arp: ['D4', 'A4', 'D5', 'F#5', 'D5', 'A4', 'F#4', 'A4'], pad: ['D4', 'F#4', 'A4'] },
  { bass: 'A2', arp: ['A3', 'E4', 'A4', 'C#5', 'A4', 'E4', 'C#4', 'E4'], pad: ['A3', 'C#4', 'E4'] },
  { bass: 'G2', arp: ['G3', 'D4', 'G4', 'B4', 'G4', 'D4', 'B3', 'D4'], pad: ['G3', 'B3', 'D4'] },
  { bass: 'A2', arp: ['A3', 'E4', 'A4', 'C#5', 'E5', 'C#5', 'A4', 'E4'], pad: ['A3', 'C#4', 'E4'] },
];

// [paso de corchea, nota, duración en corcheas]
const MELODY = [
  [[0, 'F#5', 2], [2, 'A5', 2], [4, 'F#5', 2], [6, 'E5', 2]],
  [[0, 'E5', 3], [3, 'C#5', 1], [4, 'E5', 2], [6, 'A5', 2]],
  [[0, 'F#5', 3], [3, 'D5', 1], [4, 'B4', 2], [6, 'D5', 2]],
  [[0, 'D5', 4], [4, 'B4', 2], [6, 'A4', 2]],
  [[0, 'F#5', 2], [2, 'A5', 2], [4, 'B5', 2], [6, 'A5', 2]],
  [[0, 'E5', 3], [3, 'F#5', 1], [4, 'E5', 2], [6, 'C#5', 2]],
  [[0, 'D5', 3], [3, 'E5', 1], [4, 'F#5', 2], [6, 'G5', 2]],
  [[0, 'A5', 4], [4, 'G5', 2], [6, 'E5', 2]],
];

const BPM = 84;
const EIGHTH = 60 / BPM / 2;

class Score {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.ducked = false;
    this.level = 0.85;
    this.intensity = 0;
    this.track = null;
  }

  async start() {
    if (await this.tryTrack()) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = (this.ctx = new AC());

    this.master = ctx.createGain();
    this.master.gain.value = 0;
    this.master.connect(ctx.destination);

    this.tone = ctx.createBiquadFilter();
    this.tone.type = 'lowpass';
    this.tone.frequency.value = 5200;
    this.tone.connect(this.master);

    this.reverb = ctx.createConvolver();
    this.reverb.buffer = this.impulse(2.6);
    const wet = ctx.createGain();
    wet.gain.value = 0.35;
    this.reverb.connect(wet).connect(this.tone);

    this.dry = ctx.createGain();
    this.dry.gain.value = 0.7;
    this.dry.connect(this.tone);

    this.step = 0;
    this.next = ctx.currentTime + 0.15;
    this.timer = setInterval(() => this.schedule(), 25);
    this.fade(0.85, 3);
  }

  async tryTrack() {
    try {
      const media = await fetch('/api/media').then((r) => r.json());
      if (!media.music) return false;
    } catch {
      return false;
    }
    const a = (this.track = new Audio('/audio/tema.mp3'));
    a.loop = true;
    a.volume = 0;
    await a.play().catch(() => {});
    this.fade(0.85, 3);
    return true;
  }

  impulse(seconds) {
    const rate = this.ctx.sampleRate;
    const len = rate * seconds;
    const buf = this.ctx.createBuffer(2, len, rate);
    for (let c = 0; c < 2; c++) {
      const d = buf.getChannelData(c);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 2.6;
    }
    return buf;
  }

  send(node, amount = 1) {
    const g = this.ctx.createGain();
    g.gain.value = amount;
    node.connect(g);
    g.connect(this.dry);
    g.connect(this.reverb);
  }

  piano(freq, t, dur, vel) {
    const ctx = this.ctx;
    const out = ctx.createGain();
    out.gain.setValueAtTime(0, t);
    out.gain.linearRampToValueAtTime(vel, t + 0.008);
    out.gain.exponentialRampToValueAtTime(vel * 0.35, t + 0.4);
    out.gain.exponentialRampToValueAtTime(0.0001, t + Math.max(dur, 0.6) + 2.2);
    const partials = [[1, 1, 'sine'], [2, 0.32, 'sine'], [3, 0.1, 'sine'], [1, 0.12, 'triangle']];
    for (const [mult, amp, type] of partials) {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = type;
      o.frequency.value = freq * mult;
      o.detune.value = (Math.random() - 0.5) * 5;
      g.gain.value = amp;
      o.connect(g).connect(out);
      o.start(t);
      o.stop(t + Math.max(dur, 0.6) + 2.4);
    }
    this.send(out);
  }

  pad(freqs, t, dur, level) {
    const ctx = this.ctx;
    const out = ctx.createGain();
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 1800 + this.intensity * 1600;
    out.gain.setValueAtTime(0, t);
    out.gain.linearRampToValueAtTime(level, t + dur * 0.4);
    out.gain.linearRampToValueAtTime(0, t + dur + 1.2);
    for (const f of freqs) {
      for (const d of [-7, 7]) {
        const o = ctx.createOscillator();
        o.type = 'triangle';
        o.frequency.value = f;
        o.detune.value = d;
        o.connect(lp);
        o.start(t);
        o.stop(t + dur + 1.4);
      }
    }
    lp.connect(out);
    this.send(out, 0.8);
  }

  schedule() {
    const ctx = this.ctx;
    while (this.next < ctx.currentTime + 0.25) {
      const bar = Math.floor(this.step / 8);
      const inBar = this.step % 8;
      const ci = bar % CHORDS.length;
      const chord = CHORDS[ci];
      const t = this.next;
      const human = (Math.random() - 0.5) * 0.012;

      if (inBar === 0) {
        this.piano(N(chord.bass), t, EIGHTH * 8, 0.16);
        this.pad(chord.pad.map(N), t, EIGHTH * 8, 0.03 + this.intensity * 0.03);
      }
      const accent = inBar === 0 ? 1 : inBar === 4 ? 0.85 : 0.65;
      this.piano(N(chord.arp[inBar]), t + human, EIGHTH, 0.07 * accent * (0.8 + this.intensity * 0.4));

      if (bar >= 2) {
        for (const [s, note, len] of MELODY[ci]) {
          if (s === inBar) {
            this.piano(N(note), t + human, EIGHTH * len, 0.11 + this.intensity * 0.04);
            if (this.intensity > 0.6) this.piano(N(note) * 2, t + human, EIGHTH * len, 0.035);
          }
        }
      }
      this.next += EIGHTH;
      this.step++;
    }
  }

  setIntensity(v) {
    this.intensity = v;
    if (this.ctx) this.tone.frequency.setTargetAtTime(4800 + v * 3000, this.ctx.currentTime, 1.5);
  }

  fade(level, seconds = 2, keep = true) {
    if (keep) this.level = level;
    const target = this.muted ? 0 : level;
    if (this.track) {
      const a = this.track;
      const from = a.volume;
      const t0 = performance.now();
      const tick = () => {
        const k = Math.min(1, (performance.now() - t0) / (seconds * 1000));
        a.volume = from + (target - from) * k;
        if (k < 1) requestAnimationFrame(tick);
      };
      tick();
      return;
    }
    if (!this.ctx) return;
    const g = this.master.gain;
    g.cancelScheduledValues(this.ctx.currentTime);
    g.setValueAtTime(g.value, this.ctx.currentTime);
    g.linearRampToValueAtTime(target, this.ctx.currentTime + seconds);
  }

  duck(on) {
    this.ducked = on;
    this.fade(on ? this.level * 0.15 : this.level, 0.6, false);
  }

  setMuted(m) {
    this.muted = m;
    this.fade(this.ducked ? this.level * 0.15 : this.level, 0.5, false);
  }
}

export const score = new Score();
