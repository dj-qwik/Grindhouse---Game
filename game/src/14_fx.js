// ───────────────────────── FX: comic-book impact, splatter, sparks, smoke (bible §10) ─────────────────────────
// Pooled sprites and decals within the performance budget (80 particle bursts, 30 transient decals, 16 projectiles).
// The simulation calls the FXHOOK functions (sfx, vfx, announce, shake, hitMark, pickupFx, killFeed); they only
// draw and play sounds, never feed back into play.
const PFX = { pool: [], live: [], tracers: [], shake: 0, flash: 0 };
function initFx() {
  const T = THREE;
  for (let k = 0; k < 420; k++) {
    const m = new T.Sprite(new T.SpriteMaterial({ map: GFX.tex.smoke, color: 0xffffff, transparent: true, depthWrite: false }));
    m.visible = false; GFX.scene.add(m); PFX.pool.push({ m, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, t: 0, life: 1, s0: 0.3, s1: 0.6, g: 0, drag: 0, fade: true, col: 0xffffff });
  }
  for (let k = 0; k < 40; k++) {
    const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute([0, 0, 0, 0, 0, 1], 3));
    const l = new T.Line(g, new T.LineBasicMaterial({ color: 0xfff1b0, transparent: true })); l.visible = false; l.frustumCulled = false; GFX.scene.add(l);
    PFX.tracers.push({ l, t: 0, life: 0.08 });
  }
  // visible bullets: a hot core + additive glow streak that flies from the muzzle to the hit at ~85 m/s
  PFX.slugs = [];
  // comic tracer: bright core, dark inverted-hull outline (reads on light concrete), soft additive glow
  const coreG = new T.CylinderGeometry(0.07, 0.07, 1, 8, 1, false), shellG = new T.CylinderGeometry(0.11, 0.11, 1.06, 8, 1, false), glowG = new T.CylinderGeometry(0.24, 0.1, 1, 10, 1, true);
  for (let k = 0; k < 90; k++) {
    const g = new T.Group(), core = new T.Mesh(coreG, new T.MeshBasicMaterial({ color: 0xfff6c8 }));
    const shell = new T.Mesh(shellG, new T.MeshBasicMaterial({ color: 0x22292b, side: T.BackSide }));
    const glow = new T.Mesh(glowG, new T.MeshBasicMaterial({ color: 0xffd27a, transparent: true, opacity: 0.4, depthWrite: false, blending: T.AdditiveBlending }));
    g.add(glow, shell, core); g.visible = false; for (const m of [g, core, shell, glow]) m.frustumCulled = false; GFX.scene.add(g);
    PFX.slugs.push({ g, core, glow, t: 0, dur: 0.1, a: new T.Vector3(), b: new T.Vector3(), len: 1.4, hit: false });
  }
}
function part(x, y, z, o = {}) {
  let p = PFX.pool.find((q) => !q.m.visible); if (!p) { p = PFX.live.shift(); if (!p) return; }
  Object.assign(p, { x, y, z, vx: o.vx || 0, vy: o.vy || 0, vz: o.vz || 0, t: 0, life: o.life || 0.6, s0: o.s0 ?? 0.3, s1: o.s1 ?? 0.6, g: o.g || 0, drag: o.drag || 0, fade: o.fade !== false });
  p.m.material.map = o.tex || GFX.tex.smoke; p.m.material.color.set(o.col ?? 0xffffff); p.m.material.opacity = 1; p.m.material.blending = o.add ? THREE.AdditiveBlending : THREE.NormalBlending;
  p.m.visible = true; p.m.position.set(x, y, z); p.m.scale.setScalar(p.s0); p.m.material.rotation = Math.random() * 6;
  PFX.live.push(p);
}
function stepFx(dt) {
  for (let k = PFX.live.length - 1; k >= 0; k--) {
    const p = PFX.live[k]; p.t += dt;
    if (p.t >= p.life) { p.m.visible = false; PFX.live.splice(k, 1); continue; }
    const u = p.t / p.life, dr = Math.exp(-p.drag * dt);
    p.vx *= dr; p.vz *= dr; p.vy = p.vy * dr - p.g * dt;
    p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
    if (p.g > 0 && p.y < 0.02 && GFX.built && GFX.built.R.W.floor) { p.y = 0.02; p.vy = 0; p.vx *= 0.5; p.vz *= 0.5; }
    p.m.position.set(p.x, p.y, p.z); p.m.scale.setScalar(p.s0 + (p.s1 - p.s0) * u);
    if (p.fade) p.m.material.opacity = 1 - u * u;
  }
  for (const sl of PFX.slugs) if (sl.g.visible) {
    sl.t += dt; const u = Math.min(1, sl.t / sl.dur), dist = sl.a.distanceTo(sl.b);
    const head = u * dist, tail = Math.max(0, head - sl.len), mid = (head + tail) / 2, L = Math.max(0.05, head - tail);
    const dir = _fxv.subVectors(sl.b, sl.a).normalize();
    sl.g.position.copy(sl.a).addScaledVector(dir, mid); sl.g.scale.set(1, L, 1); sl.g.quaternion.setFromUnitVectors(_fxUp, dir);
    if (u >= 1) { sl.g.visible = false; for (let k = 0; k < (sl.hit ? 5 : 3); k++) fxSpark(sl.b.x, sl.b.y, sl.b.z, sl.hit ? 0xff9b8a : 0xffe2a8); part(sl.b.x, sl.b.y, sl.b.z, { life: 0.12, s0: 0.35, s1: 0.1, col: 0xfff1b0, add: true, tex: GFX.tex.spark }); }
  }
  for (const tr of PFX.tracers) if (tr.l.visible) { tr.t += dt; tr.l.material.opacity = 1 - tr.t / tr.life; if (tr.t >= tr.life) tr.l.visible = false; }
  PFX.shake *= Math.exp(-dt * 9); PFX.flash *= Math.exp(-dt * 10);
}
const R3 = (a) => (Math.random() - 0.5) * 2 * a;
function fxBurst(x, y, z, kind, n = 12, extra) {
  for (let k = 0; k < n; k++) {
    if (kind === 'blood') part(x, y, z, { vx: R3(4) + (extra?.dx || 0) * 5, vy: Math.random() * 5 + 1, vz: R3(4) + (extra?.dz || 0) * 5, g: 18, life: 0.45 + Math.random() * 0.3, s0: 0.2, s1: 0.08, col: k % 3 ? 0xe0102c : 0x9c0a1e, tex: GFX.tex.smoke });
    else if (kind === 'debris') part(x + R3(2), y, z + R3(2), { vx: R3(5), vy: Math.random() * 6, vz: R3(5), g: 18, life: 1, s0: 0.3, s1: 0.2, col: k % 2 ? 0x8a7a60 : 0x5e5040, fade: false, tex: GFX.tex.spark });
    else if (kind === 'dust') part(x + R3(0.3), y + 0.05, z + R3(0.3), { vx: R3(1.2), vy: Math.random() * 0.8, vz: R3(1.2), life: 0.5, s0: 0.2, s1: 0.8, col: 0xd8ccb0 });
  }
}
function fxSpark(x, y, z, col = 0xffd27a) { part(x, y, z, { vx: R3(3), vy: Math.random() * 3, vz: R3(3), g: 12, life: 0.25, s0: 0.12, s1: 0.04, col, add: true, tex: GFX.tex.spark }); }
function fxFlame(x, y, z) { part(x, y, z, { vy: 1.6 + Math.random(), vx: R3(0.3), vz: R3(0.3), life: 0.6, s0: 0.5, s1: 0.1, col: Math.random() < 0.5 ? 0xff7a1a : 0xffc23a, add: true }); }
function decal(x, z, size, col = 0xd1102a, rot = Math.random() * 6) {
  if (!GFX.decals) return;
  const d = GFX.decals[GFX.decalI++ % GFX.decals.length];
  const gy = GFX.built ? SIM0.groundAt(GFX.built.R.W, x, z, 50) : 0;
  if (gy < -1e8) return;
  d.position.set(x, gy + 0.03, z); d.scale.set(size, size, 1); d.rotation.z = rot; d.material.color.set(col); d.visible = true;
}
const _fxv = new THREE.Vector3(), _fxUp = new THREE.Vector3(0, 1, 0), _fxWhite = new THREE.Color(0xffffff);
function tracer(ax, ay, az, bx, by, bz, col, hit) {
  const sl = PFX.slugs && (PFX.slugs.find((q) => !q.g.visible) || PFX.slugs[0]);
  if (sl) {
    sl.a.set(ax, ay, az); sl.b.set(bx, by, bz); sl.t = 0; sl.hit = !!hit;
    const d = sl.a.distanceTo(sl.b); sl.dur = Math.max(0.045, Math.min(0.35, d / 85)); sl.len = Math.min(2.6, 0.9 + d * 0.07);
    sl.glow.material.color.set(col); sl.core.material.color.set(col).lerp(_fxWhite, 0.55); sl.g.visible = true;
  }
  const tr = PFX.tracers.find((q) => !q.l.visible) || PFX.tracers[0];
  const a = tr.l.geometry.attributes.position.array; a[0] = ax; a[1] = ay; a[2] = az; a[3] = bx; a[4] = by; a[5] = bz; tr.l.geometry.attributes.position.needsUpdate = true;
  tr.l.material.color.set(col); tr.t = 0; tr.l.visible = true;
}
const TRACER_COL = { pistol: 0xffd27a, nailgun: 0x9fd8ff, smg: 0xb4e64a, revolver: 0xffb347, sawoff: 0xff8a4a };

// ── what the simulation calls
const FEED = [];
function installFxHooks() {
  FXHOOK.sfx = (name, x, y, z, vol) => playSfx(name, x, y, z, vol);
  FXHOOK.vfx = (kind, x, y, z, a, b, c, d, e) => {
    if (!GFX.built) return;
    switch (kind) {
      case 'tracer': { // e = hit flag (arg 8)
        const col = TRACER_COL[d] || 0xffd27a;
        tracer(x, y, z, a, b, c, col, e);
        part(x, y, z, { life: 0.07, s0: 0.95, s1: 0.3, col: 0xfff1b0, add: true, tex: GFX.tex.spark }); // muzzle flash
        part(x, y, z, { life: 0.1, s0: 0.5, s1: 0.9, col, add: true, tex: GFX.tex.spark });
        break;
      }
      case 'spark': for (let k = 0; k < 5; k++) fxSpark(x, y, z); break;
      case 'impact': for (let k = 0; k < 8; k++) fxSpark(x, y, z); break;
      case 'land': fxBurst(x, y, z, 'dust', a > 0.8 ? 10 : 5); break;
      case 'bail': fxBurst(x, y, z, 'dust', 10); for (let k = 0; k < 6; k++) fxSpark(x, y + 0.2, z, 0xffffff); break;
      case 'explode': {
        const r = a || 3, molotov = b === 'molotov';
        part(x, y, z, { life: 0.25, s0: r * 0.6, s1: r * 2.2, col: molotov ? 0xff7a1a : 0xfff1b0, add: true });
        for (let k = 0; k < (molotov ? 14 : 22); k++) part(x + R3(r * 0.3), y + R3(0.3), z + R3(r * 0.3), { vx: R3(r * 2), vy: Math.random() * r * 2, vz: R3(r * 2), drag: 3, life: 0.5 + Math.random() * 0.6, s0: 0.6, s1: r * 0.9, col: k % 3 ? 0xff8c2a : 0x4a4440, add: k % 3 !== 0 });
        for (let k = 0; k < 14; k++) part(x, y, z, { vx: R3(12), vy: Math.random() * 10, vz: R3(12), g: 20, life: 0.8, s0: 0.15, s1: 0.1, col: 0x3b3430, tex: GFX.tex.spark, fade: false });
        decal(x, z, r * 1.6, molotov ? 0x5a2a10 : 0x2a2522);
        PFX.flash = Math.max(PFX.flash, 0.35);
        break;
      }
      case 'stick': fxSpark(x, y, z, 0xff5c69); break;
      case 'signature': for (let k = 0; k < 36; k++) { const a2 = k / 36 * Math.PI * 2; part(x, y + 0.3, z, { vx: Math.cos(a2) * 14, vz: Math.sin(a2) * 14, vy: 1, drag: 4, life: 0.5, s0: 0.5, s1: 1.4, col: 0xb4e64a, add: true }); } decal(x, z, 7, 0x6a8a20); break;
      case 'stink': // the drop: a fart, a wet thud, brown flecks and a green cloud
        playSfx('fart', x, y + 0.6, z, 1);
        for (let k = 0; k < 6; k++) part(x + R3(0.15), y + 0.15, z + R3(0.15), { vx: R3(1.5), vy: Math.random() * 2.5, vz: R3(1.5), g: 14, life: 0.4, s0: 0.12, s1: 0.06, col: k % 2 ? 0x6b4423 : 0x4a2e14, fade: false });
        for (let k = 0; k < 10; k++) part(x + R3(0.4), y + 0.3 + Math.random() * 0.6, z + R3(0.4), { vy: 0.5 + Math.random() * 0.6, vx: R3(0.4), vz: R3(0.4), life: 1.4 + Math.random(), s0: 0.3, s1: 1.1, col: k % 2 ? 0x9fbf3a : 0x7a9a2a });
        break;
      case 'slip':
        for (let k = 0; k < 12; k++) part(x + R3(0.2), y + 0.1, z + R3(0.2), { vx: R3(4), vy: Math.random() * 3, vz: R3(4), g: 16, life: 0.5, s0: 0.14, s1: 0.06, col: k % 2 ? 0x6b4423 : 0x4a2e14, fade: false });
        decal(x, z, 1.1, 0x5a3a1a);
        for (let k = 0; k < 5; k++) part(x + R3(0.3), y + 0.4, z + R3(0.3), { vy: 0.7, life: 1, s0: 0.3, s1: 0.9, col: 0x9fbf3a });
        break;
      case 'pulse': for (let k = 0; k < 40; k++) { const a2 = k / 40 * Math.PI * 2; part(x + Math.cos(a2) * a, 0.5, z + Math.sin(a2) * a, { vy: 3, life: 0.6, s0: 1.2, s1: 2.4, col: 0xff5c69, add: true }); } break;
    }
  };
  FXHOOK.announce = (text) => banner(text);
  FXHOOK.shake = (amt, x, y, z) => { const L = AUDIO.listener, d = Math.hypot(x - L.x, z - L.z); PFX.shake = Math.max(PFX.shake, amt * Math.max(0, 1 - d / 30)); if (d < 12) rumble(amt * 0.8, 160); };
  FXHOOK.hitMark = (by, victim, amt, wid) => onHit(by, victim, amt, wid);
  FXHOOK.pickupFx = (i, w) => { if (i === viewSeat()) { trickPop(WEAPONS[w].name.toUpperCase(), 'picked up'); } };
  FXHOOK.killFeed = (v, by, w, kind) => onKill(v, by, w, kind);
  FXHOOK.deuceFx = (i) => { const me = viewSeat(); pushFeed(`<b>${esc(nameOf(i))}</b> <span class="w">Droppin a DEUCE!!!</span>`, i === me); if (i === me) { playSfx('kill', null, null, null, 0.8); rumble(0.5, 300); } };
  FXHOOK.slipFx = (v, owner) => { const me = viewSeat(); pushFeed(`<b>${esc(nameOf(v))}</b> <span class="w">slipped in</span> <b>${esc(nameOf(owner))}</b>'s mess`, v === me || owner === me); if (v === me) { trickPop('EWWW!', 'you slipped'); rumble(0.6, 400); } };
}
// blood on hits; choreography on eliminations
function onHit(by, victim, amt, wid) {
  const R = ROUND; if (!R) return;
  const q = R.sk[victim], s = by >= 0 ? R.sk[by] : null;
  const dx = s ? q.x - s.x : 0, dz = s ? q.z - s.z : 0, d = Math.hypot(dx, dz) || 1;
  if (amt >= 2) { fxBurst(q.x, q.y + 1.1, q.z, 'blood', Math.min(18, 3 + amt / 3), { dx: dx / d, dz: dz / d }); if (amt >= 15) decal(q.x + dx / d * 0.8, q.z + dz / d * 0.8, 0.8 + amt / 40); }
  if (amt >= 2) playSfx(WEAPONS[wid] && WEAPONS[wid].cls === 'melee' ? 'splat' : 'hurt', q.x, q.y + 1, q.z, Math.min(1, amt / 30 + 0.3));
  const me = viewSeat();
  if (by === me && by !== victim && amt >= 1) { hitmarker(amt); playSfx('hit', null, null, null, 0.7); }
  if (victim === me && amt >= 1) { damageDir(s); if (amt >= 2) { PFX.shake = Math.max(PFX.shake, Math.min(0.6, amt / 50)); rumble(Math.min(1, amt / 40), 120); } }
}
function onKill(v, by, w, kind) {
  const R = ROUND; if (!R) return;
  const q = R.sk[v], me = viewSeat();
  // victim: splatter by kill type (stylized, theatrical against pale concrete)
  const n = kind === 'explosion' ? 30 : kind === 'blade' ? 24 : 18;
  fxBurst(q.x, q.y + 1, q.z, 'blood', n);
  decal(q.x, q.z, kind === 'explosion' ? 3.6 : 2.6);
  if (kind === 'blade') decal(q.x + Math.random() - 0.5, q.z + Math.random() - 0.5, 1.4, 0xb00c22);
  if (kind === 'rail' || kind === 'hazard') for (let k = 0; k < 16; k++) fxSpark(q.x, q.y + 1, q.z);
  playSfx('splat', q.x, q.y + 1, q.z, 1);
  const kname = by >= 0 ? R.sk[by].name : null, wname = w === 'fell' ? 'the drop' : WEAPONS[w] ? WEAPONS[w].name : w === 'signature' ? 'Super Slam' : HAZ_NAMES[w] || 'the arena';
  pushFeed(by >= 0 ? `<b>${esc(nameOf(by))}</b> <span class="w">${esc(wname)}</span> <b>${esc(nameOf(v))}</b>` : `<b>${esc(nameOf(v))}</b> <span class="w">${esc(wname)}</span>`, by === me || v === me);
  if (by === me && v !== me) { playSfx('kill', null, null, null, 1); pip(v, kind); rumble(0.8, 200); }
  if (v === me) GAME.myDeath = { by, w: wname, kind, at: performance.now(), slowmo: 1.2 };
  GAME.lastKill = { v, by, tick: R.tick, kind };
}
const HAZ_NAMES = { zone: 'the squeeze', pulse: 'a finale pulse', grinder: 'the drain grinder', gate: 'a sluice gate', hazard: 'the arena', molotov: 'the fire', fall: 'the drop' };
function pushFeed(html, mine) {
  const el = $('#hFeed'); if (!el) return;
  const d = document.createElement('div'); d.className = 'k' + (mine ? ' me' : ''); d.innerHTML = html; el.prepend(d);
  while (el.children.length > 5) el.lastChild.remove();
  setTimeout(() => d.remove(), 6500);
}
// HUD bits the hooks use
function banner(text) { const b = $('#banner'); if (!b) return; b.textContent = text; b.classList.remove('on'); void b.offsetWidth; b.classList.add('on'); if (GAME.phase === 'play' || text === 'WINNER') say(); }
function trickPop(main, sub) { const t = $('#trick'); if (!t) return; t.innerHTML = `${esc(main)}<small>${esc(sub || '')}</small>`; t.classList.remove('on'); void t.offsetWidth; t.classList.add('on'); }
function hitmarker(amt) { const h = $('#hitmark'); if (!h) return; h.classList.remove('on'); void h.offsetWidth; h.classList.add('on'); h.style.transform = `scale(${1 + Math.min(1, amt / 40)})`; }
const DMG_IND = [];
function damageDir(src) {
  const box = $('#dmgdir'); if (!box || !src) return;
  const me = ROUND && ROUND.sk[viewSeat()]; if (!me) return;
  const ang = Math.atan2(src.x - me.x, src.z - me.z), rel = angWrap(ang - CAMR.yaw);
  let i = DMG_IND.find((d) => !d.on); if (!i) { const el = document.createElement('i'); box.appendChild(el); i = { el, on: false }; DMG_IND.push(i); }
  i.on = true; i.el.style.transform = `rotate(${-rel}rad)`; i.el.style.opacity = 1;
  setTimeout(() => { i.el.style.opacity = 0; setTimeout(() => { i.on = false; }, 600); }, 250);
}
// attacker's finishing vignette: a picture-in-picture panel at the screen edge, controls stay live (bible §10)
const PIP = { until: 0, v: -1, kind: '' };
function pip(v, kind) { PIP.until = performance.now() + 600; PIP.v = v; PIP.kind = kind; const p = $('#pip'); if (p) { p.classList.add('on'); $('#pipTxt').textContent = { blade: 'SLICED', explosion: 'KABOOM', rail: 'RAILED', hazard: 'WRECKED', fell: 'GONE', blunt: 'WRECKED' }[kind] || 'WRECKED'; } }
function renderPip() {
  const p = $('#pip'); if (!p) return;
  if (performance.now() > PIP.until || !ROUND) { if (p.classList.contains('on')) p.classList.remove('on'); return; }
  const q = ROUND.sk[PIP.v], rect = p.getBoundingClientRect(), r = GFX.r;
  const c2 = GFX.cam2, t = (performance.now() - (PIP.until - 600)) / 600;
  c2.position.set(q.x + Math.cos(t * 2) * 3.2, q.y + 1.6, q.z + Math.sin(t * 2) * 3.2); c2.lookAt(q.x, q.y + 0.6, q.z);
  c2.aspect = rect.width / rect.height; c2.updateProjectionMatrix();
  const H = GFX.h;
  r.setScissorTest(true); r.setScissor(rect.left, H - rect.bottom, rect.width, rect.height); r.setViewport(rect.left, H - rect.bottom, rect.width, rect.height);
  r.render(GFX.scene, c2);
  r.setScissorTest(false); r.setViewport(0, 0, GFX.w, GFX.h);
}
