// ───────────────────────── constants + money (same rules as the escrow contract) ─────────────────────────
const WEI = 10n ** 18n;
const TIERS = ['0.001', '0.005', '0.01', '0.05'];
const SIZES = [2, 3, 4, 5, 6, 7, 8];
function parseEth(s) { const [a, b = ''] = String(s).split('.'); return BigInt(a || '0') * WEI + BigInt((b + '0'.repeat(18)).slice(0, 18)); }
function fmtEth(w) { const neg = w < 0n; if (neg) w = -w; const whole = w / WEI; const frac = (w % WEI).toString().padStart(18, '0').replace(/0+$/, ''); return (neg ? '-' : '') + whole + (frac ? '.' + frac : ''); }
// the escrow pays the house ⌊pot/10⌋ and the winner the rest (rounding dust goes to the winner)
function splitPot(stake, n) { const pot = stake * BigInt(n); const house = pot / 10n; return { pot, house, champ: pot - house }; }
const store = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch {} },
  json(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } },
};
const $ = (s) => document.querySelector(s);
function esc(s) { return String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

// ───────────────────────── AUDIO: synthesized SFX + a procedural breakbeat score ─────────────────────────
// Everything is generated with Web Audio (no files). Starts on the first click/key (browser rule).
let actx = null, master = null, sfxBus = null, musicBus = null, noiseBuf = null, distCurve = null;
const AUDIO = { muted: store.get('gh_muted') === '1', vol: +(store.get('gh_vol') || 0.8), music: null, listener: { x: 0, y: 0, z: 0, yaw: 0 } };
function audioInit() {
  if (actx) { if (actx.state === 'suspended') actx.resume(); return; }
  try {
    actx = new (window.AudioContext || window.webkitAudioContext)();
    master = actx.createGain(); master.gain.value = AUDIO.muted ? 0 : AUDIO.vol;
    const comp = actx.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4;
    master.connect(comp); comp.connect(actx.destination);
    sfxBus = actx.createGain(); sfxBus.gain.value = 0.9; sfxBus.connect(master);
    musicBus = actx.createGain(); musicBus.gain.value = 0.42; musicBus.connect(master);
    noiseBuf = actx.createBuffer(1, actx.sampleRate * 2, actx.sampleRate);
    const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    distCurve = new Float32Array(1024); for (let i = 0; i < 1024; i++) { const x = i / 512 - 1; distCurve[i] = Math.tanh(x * 3.2); }
  } catch { actx = null; }
}
function setMuted(m) { AUDIO.muted = m; store.set('gh_muted', m ? '1' : '0'); if (master) master.gain.value = m ? 0 : AUDIO.vol; const b = $('#mute'); if (b) b.textContent = m ? '🔇' : '🔊'; }
addEventListener('pointerdown', audioInit, { capture: true }); addEventListener('keydown', audioInit, { capture: true });

// positional gain/pan from the listener (camera) — cheap and plenty for an arena
function spatial(x, y, z) {
  if (x == null) return { g: 1, p: 0 };
  const L = AUDIO.listener, dx = x - L.x, dz = z - L.z, d = Math.hypot(dx, y - L.y, dz);
  const g = 1 / (1 + d * d / 260);
  const right = -Math.cos(L.yaw) * dx + Math.sin(L.yaw) * dz; // listener right vector (−cos, sin)
  return { g, p: Math.max(-0.85, Math.min(0.85, right / (Math.abs(right) + 6))) };
}
function out(gain, pan) {
  const g = actx.createGain(); g.gain.value = gain;
  if (pan && actx.createStereoPanner) { const p = actx.createStereoPanner(); p.pan.value = pan; g.connect(p); p.connect(sfxBus); }
  else g.connect(sfxBus);
  return g;
}
function osc(type, f0, f1, dur, vol, dest, t = 0) {
  const o = actx.createOscillator(), g = actx.createGain(), now = actx.currentTime + t;
  o.type = type; o.frequency.setValueAtTime(f0, now); if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), now + dur);
  g.gain.setValueAtTime(0.0001, now); g.gain.exponentialRampToValueAtTime(vol, now + 0.006); g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
  o.connect(g); g.connect(dest); o.start(now); o.stop(now + dur + 0.02);
}
function noise(dur, vol, dest, { type = 'bandpass', f0 = 1200, f1 = f0, q = 1, t = 0, attack = 0.004 } = {}) {
  const s = actx.createBufferSource(), f = actx.createBiquadFilter(), g = actx.createGain(), now = actx.currentTime + t;
  s.buffer = noiseBuf; s.loop = true; s.playbackRate.value = 0.8 + Math.random() * 0.4;
  f.type = type; f.Q.value = q; f.frequency.setValueAtTime(f0, now); if (f1 !== f0) f.frequency.exponentialRampToValueAtTime(Math.max(30, f1), now + dur);
  g.gain.setValueAtTime(0.0001, now); g.gain.exponentialRampToValueAtTime(vol, now + attack); g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
  s.connect(f); f.connect(g); g.connect(dest); s.start(now, Math.random()); s.stop(now + dur + 0.02);
}
function dirt(dest, amt = 1) { const w = actx.createWaveShaper(); w.curve = distCurve; const g = actx.createGain(); g.gain.value = amt; w.connect(g); g.connect(dest); return w; }
// named sounds (the simulation calls sfx(name, x, y, z, vol))
const SOUNDS = {
  pop: (d, v) => { osc('square', 220, 90, 0.07, 0.25 * v, d); noise(0.05, 0.3 * v, d, { f0: 3000, q: 2 }); },
  land: (d, v) => { osc('sine', 120, 50, 0.16, 0.5 * v, d); noise(0.12, 0.25 * v, d, { type: 'lowpass', f0: 900 }); },
  flick: (d, v) => noise(0.12, 0.18 * v, d, { f0: 2500, f1: 900, q: 3 }),
  catch: (d, v) => { osc('square', 300, 160, 0.05, 0.18 * v, d); noise(0.04, 0.2 * v, d, { f0: 2400 }); },
  grind: (d, v) => { noise(0.22, 0.25 * v, d, { f0: 3800, q: 6 }); osc('sawtooth', 1900, 1700, 0.2, 0.03 * v, d); },
  wall: (d, v) => noise(0.25, 0.22 * v, d, { f0: 600, f1: 1400, q: 2 }),
  bail: (d, v) => { osc('triangle', 180, 40, 0.35, 0.45 * v, d); noise(0.4, 0.4 * v, d, { type: 'lowpass', f0: 1600, f1: 300 }); osc('square', 800, 300, 0.1, 0.08 * v, d, 0.05); },
  charged: (d, v) => { osc('sawtooth', 200, 900, 0.45, 0.14 * v, d); osc('square', 400, 1800, 0.45, 0.06 * v, d); },
  whoosh: (d, v) => noise(0.18, 0.3 * v, d, { f0: 500, f1: 2400, q: 1.5 }),
  slash: (d, v) => { noise(0.14, 0.32 * v, d, { f0: 5000, f1: 1500, q: 4 }); osc('sawtooth', 2400, 1200, 0.06, 0.05 * v, d); },
  heavy: (d, v) => noise(0.35, 0.4 * v, d, { f0: 300, f1: 1100, q: 1 }),
  chain: (d, v) => { for (let k = 0; k < 4; k++) osc('square', 2600 + k * 300, 2000, 0.04, 0.06 * v, d, k * 0.035); },
  zap: (d, v) => { const w = dirt(d, 0.3 * v); osc('sawtooth', 90, 60, 0.25, 0.6, w); noise(0.25, 0.25 * v, d, { f0: 4000, q: 0.7 }); },
  shove: (d, v) => { noise(0.1, 0.35 * v, d, { type: 'lowpass', f0: 800 }); osc('sine', 140, 70, 0.12, 0.3 * v, d); },
  nail: (d, v) => { osc('square', 1400, 500, 0.04, 0.14 * v, d); noise(0.05, 0.22 * v, d, { f0: 3500, q: 2 }); },
  smg: (d, v) => { noise(0.05, 0.32 * v, d, { f0: 1800, q: 1 }); osc('square', 260, 120, 0.04, 0.12 * v, d); },
  revolver: (d, v) => { noise(0.3, 0.6 * v, d, { type: 'lowpass', f0: 4000, f1: 400 }); osc('sine', 150, 50, 0.25, 0.5 * v, d); },
  shotgun: (d, v) => { const w = dirt(d, 0.5 * v); noise(0.4, 0.9, w, { type: 'lowpass', f0: 3000, f1: 200 }); osc('sine', 110, 40, 0.35, 0.6 * v, d); },
  rocket: (d, v) => { noise(0.6, 0.4 * v, d, { f0: 400, f1: 1500, q: 0.8 }); osc('sawtooth', 70, 140, 0.5, 0.12 * v, d); },
  buzz: (d, v) => { osc('sawtooth', 900, 1400, 0.35, 0.12 * v, d); osc('square', 450, 700, 0.35, 0.06 * v, d); },
  throw: (d, v) => noise(0.16, 0.22 * v, d, { f0: 700, f1: 1800 }),
  boom: (d, v) => { const w = dirt(d, 0.7 * v); osc('sine', 90, 28, 0.9, 1, w); noise(1.1, 0.9 * v, d, { type: 'lowpass', f0: 2600, f1: 120 }); },
  glass: (d, v) => { for (let k = 0; k < 6; k++) osc('triangle', 2500 + Math.random() * 3000, 1800, 0.12, 0.08 * v, d, k * 0.02); noise(0.8, 0.3 * v, d, { f0: 900, f1: 300 }); },
  ricochet: (d, v) => osc('sine', 3200, 900, 0.18, 0.12 * v, d),
  clank: (d, v) => { osc('triangle', 900, 700, 0.08, 0.14 * v, d); osc('square', 1700, 1500, 0.05, 0.05 * v, d); },
  pickup: (d, v) => { osc('square', 520, 520, 0.06, 0.12 * v, d); osc('square', 780, 780, 0.1, 0.12 * v, d, 0.06); },
  swap: (d, v) => osc('square', 900, 1200, 0.04, 0.07 * v, d),
  signature: (d, v) => { const w = dirt(d, 0.8 * v); osc('sine', 60, 24, 1.1, 1, w); noise(0.9, 0.7 * v, d, { type: 'lowpass', f0: 1800, f1: 100 }); osc('sawtooth', 300, 80, 0.5, 0.15 * v, d); },
  pulse: (d, v) => { osc('sine', 70, 40, 0.6, 0.6 * v, d); osc('sawtooth', 140, 70, 0.4, 0.1 * v, d); },
  hit: (d, v) => { osc('square', 1500, 1100, 0.05, 0.12 * v, d); },
  hurt: (d, v) => { osc('sawtooth', 160, 80, 0.15, 0.2 * v, d); noise(0.12, 0.3 * v, d, { type: 'lowpass', f0: 1200 }); },
  splat: (d, v) => { noise(0.3, 0.5 * v, d, { type: 'lowpass', f0: 900, f1: 200 }); osc('sine', 90, 40, 0.25, 0.4 * v, d); },
  kill: (d, v) => { osc('square', 300, 300, 0.07, 0.14 * v, d); osc('square', 450, 450, 0.07, 0.14 * v, d, 0.07); osc('square', 600, 600, 0.12, 0.14 * v, d, 0.14); },
  heartbeat: (d, v) => { osc('sine', 62, 40, 0.14, 0.7 * v, d); osc('sine', 58, 38, 0.14, 0.5 * v, d, 0.18); },
  tick: (d, v) => osc('square', 1200, 1200, 0.05, 0.12 * v, d),
  go: (d, v) => { osc('sawtooth', 300, 600, 0.35, 0.2 * v, d); osc('square', 600, 1200, 0.35, 0.1 * v, d); },
  ui: (d, v) => osc('triangle', 700, 900, 0.05, 0.1 * v, d),
};
function playSfx(name, x, y, z, vol = 1) {
  if (!actx || AUDIO.muted) return;
  const fn = SOUNDS[name]; if (!fn) return;
  const sp = spatial(x, y, z); if (sp.g < 0.02) return;
  try { fn(out(sp.g, sp.p), vol); } catch {}
}
// rolling wheels + grind loop for the camera's skater (surface + speed driven)
const ROLL = { src: null, f: null, g: null, gs: null, gg: null };
function rollUpdate(speed, grounded, grinding) {
  if (!actx || AUDIO.muted) return;
  if (!ROLL.src) {
    ROLL.src = actx.createBufferSource(); ROLL.src.buffer = noiseBuf; ROLL.src.loop = true;
    ROLL.f = actx.createBiquadFilter(); ROLL.f.type = 'lowpass'; ROLL.f.frequency.value = 400;
    ROLL.g = actx.createGain(); ROLL.g.gain.value = 0;
    ROLL.src.connect(ROLL.f); ROLL.f.connect(ROLL.g); ROLL.g.connect(sfxBus);
    ROLL.gs = actx.createBiquadFilter(); ROLL.gs.type = 'bandpass'; ROLL.gs.frequency.value = 3600; ROLL.gs.Q.value = 7;
    ROLL.gg = actx.createGain(); ROLL.gg.gain.value = 0; ROLL.src.connect(ROLL.gs); ROLL.gs.connect(ROLL.gg); ROLL.gg.connect(sfxBus);
    ROLL.src.start();
  }
  const now = actx.currentTime;
  ROLL.g.gain.setTargetAtTime(grounded ? Math.min(0.16, speed * 0.013) : 0, now, 0.05);
  ROLL.f.frequency.setTargetAtTime(250 + speed * 70, now, 0.05);
  ROLL.gg.gain.setTargetAtTime(grinding ? 0.12 : 0, now, 0.03);
}
// ── music: 160 BPM breakbeat + dirty bass; a second percussion layer after 30 s (bible §15)
const MUSIC = { on: false, step: 0, next: 0, bpm: 160, layer: 0, intensity: 0, menu: true, timer: null, root: 0 };
const BASS = [0, 0, 3, 0, 5, 0, 3, 7, 0, 0, 3, 0, 10, 7, 5, 3];
const KICK = [1, 0, 0, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0, 0, 0], SNARE = [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 1];
function musicStart() {
  if (!actx || MUSIC.on) return; MUSIC.on = true; MUSIC.next = actx.currentTime + 0.05;
  MUSIC.timer = setInterval(musicTick, 25);
}
function musicStop() { MUSIC.on = false; clearInterval(MUSIC.timer); }
function musicTick() {
  if (!actx || !MUSIC.on) return;
  const spb = 60 / MUSIC.bpm / 4;
  while (MUSIC.next < actx.currentTime + 0.12) {
    const k = MUSIC.step % 16, t = MUSIC.next - actx.currentTime, d = musicBus, m = MUSIC.menu;
    if (KICK[k] || (MUSIC.layer && k === 11)) { osc('sine', 150, 42, 0.22, m ? 0.5 : 0.85, d, t); }
    if (SNARE[k] && !m) { noise(0.16, 0.5, d, { f0: 1800, q: 0.8, t }); osc('triangle', 220, 160, 0.08, 0.2, d, t); }
    if (k % 2 === 0 || MUSIC.layer) noise(0.035, (k % 4 === 2 ? 0.16 : 0.08) * (m ? 0.6 : 1), d, { type: 'highpass', f0: 8000, t });
    if (MUSIC.layer && (k === 3 || k === 7 || k === 14)) osc('sine', 260 - k * 6, 120, 0.12, 0.3, d, t);
    if (k % 2 === 0 && !m) {
      const n = BASS[(k + (MUSIC.step >> 6 & 1) * 2) % 16] + MUSIC.root, f = 55 * Math.pow(2, n / 12);
      const w = dirt(d, 0.22); osc('sawtooth', f, f, spb * 1.7, 0.9, w, t);
    }
    if (m && k % 4 === 0) { const n = BASS[k] + MUSIC.root; osc('triangle', 110 * Math.pow(2, n / 12), 110 * Math.pow(2, n / 12), spb * 3, 0.12, d, t); }
    MUSIC.next += spb; MUSIC.step++;
  }
}
function musicMode(mode) { MUSIC.menu = mode === 'menu'; MUSIC.layer = mode === 'late' ? 1 : 0; MUSIC.bpm = mode === 'menu' ? 120 : mode === 'late' ? 172 : 160; }
// announcer: a short stinger + the line, read by the browser's voice (restrained, bible §15)
let lastSay = 0;
function say(text) {
  playSfx('go', null, null, null, 0.7);
  if (performance.now() - lastSay < 900) return; lastSay = performance.now();
  try {
    if (!('speechSynthesis' in window) || AUDIO.muted) return;
    const u = new SpeechSynthesisUtterance(text.toLowerCase()); u.rate = 1.15; u.pitch = 0.55; u.volume = 0.9 * AUDIO.vol;
    speechSynthesis.cancel(); speechSynthesis.speak(u);
  } catch {}
}
