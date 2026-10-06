import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const DEG = Math.PI / 180;
const R = 1;
const HOME = { lat: -30, lng: -62 };

export const toVec = (lat, lng, r = R) => {
  const phi = (90 - lat) * DEG;
  const theta = (lng + 180) * DEG;
  return new THREE.Vector3(-r * Math.sin(phi) * Math.cos(theta), r * Math.cos(phi), r * Math.sin(phi) * Math.sin(theta));
};

const glowTexture = (() => {
  let tex;
  return () => {
    if (tex) return tex;
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const g = c.getContext('2d');
    const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    grd.addColorStop(0, 'rgba(255,255,255,1)');
    grd.addColorStop(0.12, 'rgba(214,236,255,0.95)');
    grd.addColorStop(0.35, 'rgba(117,170,219,0.38)');
    grd.addColorStop(1, 'rgba(117,170,219,0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, 128, 128);
    tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  };
})();

const ringTexture = () => {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  g.strokeStyle = 'rgba(200,228,255,1)';
  g.lineWidth = 3;
  g.beginPath();
  g.arc(64, 64, 58, 0, Math.PI * 2);
  g.stroke();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
};

export class Globe {
  constructor(canvas, { onSelect, onHover }) {
    this.canvas = canvas;
    this.onSelect = onSelect;
    this.onHover = onHover;
    this.clusters = new Map();
    this.ripples = [];
    this.clock = new THREE.Clock();
    this.running = false;
  }

  async init() {
    const renderer = (this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, alpha: true }));
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(42, 1, 0.1, 200);
    this.camera.position.copy(toVec(HOME.lat, HOME.lng, 9));

    const controls = (this.controls = new OrbitControls(this.camera, this.canvas));
    controls.enableDamping = true;
    controls.dampingFactor = 0.06;
    controls.enablePan = false;
    controls.rotateSpeed = 0.45;
    controls.zoomSpeed = 0.6;
    controls.minDistance = 1.45;
    controls.maxDistance = 5.5;
    controls.autoRotate = true;
    controls.autoRotateSpeed = 0.28;
    controls.addEventListener('start', () => this.pauseAuto());

    this.world = new THREE.Group();
    this.scene.add(this.world);

    this.addSphere();
    this.addStars();
    const rings = await fetch('/data/borders.json').then((r) => r.json());
    this.addLand(rings);
    this.addBorders(rings);

    this.lights = new THREE.Group();
    this.world.add(this.lights);
    this.ringTex = ringTexture();

    this.resize();
    window.addEventListener('resize', () => this.resize());
    this.bindPointer();
  }

  addSphere() {
    const sphere = new THREE.Mesh(
      new THREE.SphereGeometry(R * 0.995, 96, 96),
      new THREE.MeshBasicMaterial({ color: 0x0a1019 })
    );
    this.world.add(sphere);
    this.sphere = sphere;

    const atmo = new THREE.Mesh(
      new THREE.SphereGeometry(R * 1.12, 64, 64),
      new THREE.ShaderMaterial({
        transparent: true,
        side: THREE.BackSide,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        uniforms: { color: { value: new THREE.Color(0x75aadb) } },
        vertexShader: `varying vec3 vN;
          void main(){ vN = normalize(normalMatrix * normal); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }`,
        fragmentShader: `uniform vec3 color; varying vec3 vN;
          void main(){ float a = pow(smoothstep(0.0, 0.46, -vN.z), 2.2); gl_FragColor = vec4(color, a * 0.4); }`,
      })
    );
    this.scene.add(atmo);
  }

  addStars() {
    const n = 1600;
    const pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const v = new THREE.Vector3().randomDirection().multiplyScalar(40 + Math.random() * 40);
      pos.set([v.x, v.y, v.z], i * 3);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.stars = new THREE.Points(
      g,
      new THREE.PointsMaterial({ color: 0xdde7f1, size: 0.09, sizeAttenuation: true, transparent: true, opacity: 0.45, depthWrite: false })
    );
    this.scene.add(this.stars);
  }

  addLand(rings) {
    const W = 2048;
    const H = 1024;
    const c = document.createElement('canvas');
    c.width = W;
    c.height = H;
    const g = c.getContext('2d', { willReadFrequently: true });
    const draw = (color, onlyArg) => {
      g.fillStyle = color;
      for (const [arg, ring] of rings) {
        if (onlyArg && !arg) continue;
        g.beginPath();
        ring.forEach(([lng, lat], i) => {
          const x = ((lng + 180) / 360) * W;
          const y = ((90 - lat) / 180) * H;
          i ? g.lineTo(x, y) : g.moveTo(x, y);
        });
        g.closePath();
        g.fill();
      }
    };
    draw('rgb(255,0,0)', false);
    g.globalCompositeOperation = 'lighter';
    draw('rgb(0,255,0)', true);
    const px = g.getImageData(0, 0, W, H).data;

    const N = 90000;
    const golden = Math.PI * (3 - Math.sqrt(5));
    const pos = [];
    const col = [];
    const land = new THREE.Color(0xdde7f1);
    const arg = new THREE.Color(0x9fd0ff);
    for (let i = 0; i < N; i++) {
      const y = 1 - (2 * (i + 0.5)) / N;
      const lat = Math.asin(y) / DEG;
      let lng = ((golden * i) / DEG) % 360;
      lng = lng > 180 ? lng - 360 : lng;
      const x = Math.min(W - 1, Math.floor(((lng + 180) / 360) * W));
      const yy = Math.min(H - 1, Math.floor(((90 - lat) / 180) * H));
      const o = (yy * W + x) * 4;
      if (px[o] < 128) continue;
      const v = toVec(lat, lng, R * 1.001);
      pos.push(v.x, v.y, v.z);
      const isArg = px[o + 1] > 128;
      const cc = isArg ? arg : land;
      const k = isArg ? 1 : 0.55 + Math.random() * 0.25;
      col.push(cc.r * k, cc.g * k, cc.b * k);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    const mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: { size: { value: 2.2 }, pr: { value: this.renderer.getPixelRatio() } },
      vertexShader: `attribute vec3 color; varying vec3 vC; varying float vF; uniform float size; uniform float pr;
        void main(){
          vC = color;
          vec4 mv = modelViewMatrix * vec4(position,1.);
          vec3 n = normalize(normalMatrix * position);
          vF = smoothstep(-0.05, 0.35, dot(n, normalize(-mv.xyz)));
          gl_PointSize = size * pr * (3.2 / -mv.z);
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: `varying vec3 vC; varying float vF;
        void main(){
          vec2 d = gl_PointCoord - .5; float r = length(d);
          if (r > .5) discard;
          gl_FragColor = vec4(vC, (1. - smoothstep(.3,.5,r)) * vF * .9);
        }`,
    });
    this.landMat = mat;
    this.world.add(new THREE.Points(geo, mat));
  }

  addBorders(rings) {
    const all = [];
    const argPts = [];
    for (const [arg, ring] of rings) {
      const target = arg ? argPts : all;
      for (let i = 0; i < ring.length - 1; i++) {
        const a = toVec(ring[i][1], ring[i][0], R * 1.002);
        const b = toVec(ring[i + 1][1], ring[i + 1][0], R * 1.002);
        target.push(a.x, a.y, a.z, b.x, b.y, b.z);
      }
    }
    const mk = (arr, color, opacity) => {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(arr, 3));
      return new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color, transparent: true, opacity, depthWrite: false }));
    };
    this.world.add(mk(all, 0xdde7f1, 0.09));
    this.world.add(mk(argPts, 0x9fd0ff, 0.55));
  }

  setMessages(messages) {
    const groups = new Map();
    for (const m of messages) {
      const key = `${m.lat.toFixed(1)},${m.lng.toFixed(1)}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(m);
    }
    for (const [key, list] of groups) {
      const existing = this.clusters.get(key);
      if (existing) {
        existing.list = list;
        this.sizeCluster(existing);
      } else {
        this.addCluster(key, list);
      }
    }
  }

  addCluster(key, list) {
    const { lat, lng } = list[0];
    const pos = toVec(lat, lng, R * 1.012);
    const sprite = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: glowTexture(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })
    );
    sprite.position.copy(pos);
    this.lights.add(sprite);

    const beamGeo = new THREE.BufferGeometry().setFromPoints([toVec(lat, lng, R), toVec(lat, lng, R * 1.06)]);
    beamGeo.setAttribute('color', new THREE.Float32BufferAttribute([0.8, 0.9, 1, 0, 0, 0], 3));
    const beam = new THREE.Line(
      beamGeo,
      new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false })
    );
    this.lights.add(beam);

    const cluster = { key, list, pos, sprite, beam, lat, lng, phase: Math.random() * Math.PI * 2 };
    this.sizeCluster(cluster);
    this.clusters.set(key, cluster);
    return cluster;
  }

  sizeCluster(c) {
    const n = c.list.length;
    c.base = 0.045 + Math.min(0.07, Math.log2(n + 1) * 0.018);
    const h = 1.03 + Math.min(0.12, n * 0.012);
    const p = c.beam.geometry.attributes.position;
    const top = toVec(c.lat, c.lng, R * h);
    p.setXYZ(1, top.x, top.y, top.z);
    p.needsUpdate = true;
  }

  ripple(lat, lng) {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1),
      new THREE.MeshBasicMaterial({ map: this.ringTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide })
    );
    const p = toVec(lat, lng, R * 1.004);
    m.position.copy(p);
    m.lookAt(p.clone().multiplyScalar(2));
    this.lights.add(m);
    this.ripples.push({ m, t0: this.clock.elapsedTime });
  }

  flyTo(lat, lng, dist = 2.3, ms = 2200) {
    this.pauseAuto(12000);
    if (window.innerWidth < 768) dist += 0.9;
    const from = this.camera.position.clone();
    const fromLen = from.length();
    const to = toVec(lat, lng, 1).normalize();
    const t0 = performance.now();
    return new Promise((resolve) => {
      const step = (now) => {
        const k = Math.min(1, (now - t0) / ms);
        const e = k < 0.5 ? 4 * k * k * k : 1 - (-2 * k + 2) ** 3 / 2;
        const dir = from.clone().normalize().lerp(to, e).normalize();
        const len = fromLen + (dist - fromLen) * e;
        this.camera.position.copy(dir.multiplyScalar(len));
        this.camera.lookAt(0, 0, 0);
        if (k < 1) requestAnimationFrame(step);
        else resolve();
      };
      requestAnimationFrame(step);
    });
  }

  intro() {
    this.camera.position.copy(toVec(HOME.lat + 12, HOME.lng - 70, 9));
    return this.flyTo(HOME.lat, HOME.lng, window.innerWidth < 768 ? 4.6 : 3.0, 4200);
  }

  pauseAuto(ms = 9000) {
    this.controls.autoRotate = false;
    clearTimeout(this.autoTimer);
    this.autoTimer = setTimeout(() => (this.controls.autoRotate = true), ms);
  }

  bindPointer() {
    let down = null;
    const pick = (e) => {
      const rect = this.canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const camDir = this.camera.position.clone().normalize();
      let best = null;
      let bestD = e.pointerType === 'touch' ? 34 : 22;
      for (const c of this.clusters.values()) {
        if (c.pos.clone().normalize().dot(camDir) < 0.15) continue;
        const p = c.pos.clone().project(this.camera);
        const sx = ((p.x + 1) / 2) * rect.width;
        const sy = ((1 - p.y) / 2) * rect.height;
        const d = Math.hypot(sx - mx, sy - my);
        if (d < bestD) {
          bestD = d;
          best = { c, sx: sx + rect.left, sy: sy + rect.top };
        }
      }
      return best;
    };
    this.canvas.addEventListener('pointerdown', (e) => (down = { x: e.clientX, y: e.clientY }));
    this.canvas.addEventListener('pointerup', (e) => {
      if (!down || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 6) return;
      const hit = pick(e);
      this.onSelect?.(hit ? hit.c : null);
      if (hit) this.select(hit.c);
    });
    this.canvas.addEventListener('pointermove', (e) => {
      if (e.pointerType === 'touch') return;
      const hit = pick(e);
      this.hovered = hit?.c || null;
      this.canvas.style.cursor = hit ? 'pointer' : 'grab';
      this.onHover?.(hit);
    });
    this.canvas.addEventListener('pointerleave', () => {
      this.hovered = null;
      this.onHover?.(null);
    });
  }

  select(c) {
    this.selected = c;
    this.ripple(c.lat, c.lng);
    this.pauseAuto(15000);
  }

  resize() {
    const w = this.canvas.clientWidth || window.innerWidth;
    const h = this.canvas.clientHeight || window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    if (w >= 1024) this.camera.setViewOffset(w, h, -w * 0.12, 0, w, h);
    else this.camera.clearViewOffset();
    this.camera.updateProjectionMatrix();
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.resize();
    const loop = () => {
      if (!this.running) return;
      this.raf = requestAnimationFrame(loop);
      const t = this.clock.getElapsedTime();
      this.controls.update();
      const dist = this.camera.position.length();
      const zoomK = Math.min(1, Math.max(0.45, (dist - 1.2) / 2));
      for (const c of this.clusters.values()) {
        const active = c === this.selected || c === this.hovered;
        const s = c.base * zoomK * (1 + 0.18 * Math.sin(t * 1.6 + c.phase)) * (active ? 1.7 : 1);
        c.sprite.scale.set(s, s, 1);
      }
      for (let i = this.ripples.length - 1; i >= 0; i--) {
        const r = this.ripples[i];
        const k = (t - r.t0) / 2.2;
        if (k >= 1) {
          this.lights.remove(r.m);
          r.m.geometry.dispose();
          r.m.material.dispose();
          this.ripples.splice(i, 1);
          continue;
        }
        const s = 0.02 + k * 0.22;
        r.m.scale.set(s, s, s);
        r.m.material.opacity = (1 - k) * 0.9;
      }
      this.stars.rotation.y = t * 0.004;
      this.renderer.render(this.scene, this.camera);
    };
    loop();
  }

  stop() {
    this.running = false;
    cancelAnimationFrame(this.raf);
  }
}
