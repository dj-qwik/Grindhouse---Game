// ───────────────────────── SCENE: skaters, pickups, projectiles + the chase camera (bible §5) ─────────────────────────
const RARITY_COL = { common: '#E8DDBD', uncommon: '#B4E64A', rare: '#36DCE8', legendary: '#FF9B36', starter: '#E8DDBD' };
const CAMR = { yaw: 0, pitch: -0.12, pos: null, look: null, dist: 4, fov: 72, target: -1, mode: 'follow', orbit: 0, cine: null };
const RIGS = new Map();
function clearScene() { for (const r of RIGS.values()) { GFX.scene.remove(r.root); if (r.blob) GFX.scene.remove(r.blob); } RIGS.clear(); }
// view(s) → { x, y, z, yaw, aimYaw, aimPitch } (interpolated / predicted pose)
function syncDynamic(R, dt, view) {
  const T = THREE, B = GFX.built;
  for (const s of R.sk) {
    let r = RIGS.get(s.i);
    if (!r || r.look !== s.look) { if (r) { GFX.scene.remove(r.root); if (r.blob) GFX.scene.remove(r.blob); } r = makeSkaterRig(s.look); RIGS.set(s.i, r); GFX.scene.add(r.root); }
    const v = view(s);
    poseRig(r, v.s || s, dt, v);
    r.root.visible = s.alive || s.y > -30;
    // grind sparks, boost dust, burning
    if (s.alive && s.mode === MODE.GRIND && Math.random() < 0.9) fxSpark(v.x, v.y + 0.05, v.z, s.rail && s.rail.live ? 0x7ff6ff : 0xffc46b);
    if (s.alive && s.boostT > 0 && s.mode === MODE.GROUND && Math.random() < 0.4) fxBurst(v.x, v.y, v.z, 'dust', 1);
    if (s.alive && s.burn > 0 && Math.random() < 0.6) fxFlame(v.x + R3(0.3), v.y + 0.5 + Math.random(), v.z + R3(0.3));
    if (s.alive && s.adren >= 100 && Math.random() < 0.25) part(v.x + R3(0.4), v.y + 0.4 + Math.random() * 1.4, v.z + R3(0.4), { vy: 1.5, life: 0.5, s0: 0.15, s1: 0.02, col: 0xb4e64a, add: true, tex: GFX.tex.spark });
  }
  // pickups: pedestal + rarity beam + floating weapon; telegraphed as a ghost beam before they unlock
  const seen = new Set();
  for (const p of R.picks) {
    seen.add(p.id);
    let o = B.picks.get(p.id);
    if (!o) {
      o = new T.Group(); const col = RARITY_COL[p.rarity] || '#E8DDBD';
      const ped = new T.Mesh(new T.CylinderGeometry(0.55, 0.7, 0.16, 16), toon('#22292B')); ped.position.y = 0.08; o.add(ped);
      const rim = new T.Mesh(new T.TorusGeometry(0.6, 0.05, 6, 24), new T.MeshBasicMaterial({ color: col })); rim.rotation.x = Math.PI / 2; rim.position.y = 0.17; o.add(rim);
      const beam = new T.Mesh(new T.CylinderGeometry(0.12, 0.45, 7, 10, 1, true), new T.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.28, depthWrite: false, blending: T.AdditiveBlending, side: T.DoubleSide }));
      beam.position.y = 3.5; o.add(beam);
      const w = weaponMesh(p.w, 1.5); w.position.y = 1.0; o.add(w);
      o.userData = { beam, w, rim };
      o.position.set(p.x, p.y, p.z); GFX.arena.add(o); B.picks.set(p.id, o);
    }
    const ready = R.t >= p.t0, ud = o.userData;
    ud.w.visible = ready; ud.w.rotation.y += dt * 1.6; ud.w.position.y = 1.0 + Math.sin(GFX.clock * 3 + p.id) * 0.08;
    ud.beam.material.opacity = ready ? 0.28 : 0.1 + 0.15 * (Math.sin(GFX.clock * 12) * 0.5 + 0.5);
    ud.rim.scale.setScalar(ready ? 1 : 0.6 + 0.4 * ((GFX.clock * 2) % 1));
  }
  for (const [id, o] of B.picks) if (!seen.has(id)) { GFX.arena.remove(o); B.picks.delete(id); }
  // projectiles
  const live = new Set();
  for (const p of R.proj) {
    live.add(p.id);
    let o = B.proj.get(p.id);
    if (!o) { o = weaponMesh(p.k === 'rocket' ? 'rocket' : p.k === 'buzzsaw' ? 'buzzsaw' : p.k, p.k === 'rocket' ? 0.7 : 1.4); GFX.arena.add(o); B.proj.set(p.id, o); }
    o.position.set(p.x, p.y, p.z);
    if (p.k === 'rocket' || p.k === 'buzzsaw') { o.lookAt(p.x + p.vx, p.y + p.vy, p.z + p.vz); if (p.k === 'rocket') part(p.x, p.y, p.z, { life: 0.5, s0: 0.3, s1: 0.9, col: Math.random() < 0.5 ? 0xff9b36 : 0x8a8478, add: false }); }
    else { o.rotation.x += dt * 9; o.rotation.z += dt * 5; if (p.k === 'molotov') fxFlame(p.x, p.y + 0.15, p.z); if (p.k === 'grenade' || p.k === 'pipebomb') { const w = WEAPONS[p.k]; if (w.fuse - p.t < 0.6 && Math.floor(p.t * 12) % 2) fxSpark(p.x, p.y + 0.1, p.z, 0xff5c69); } }
  }
  for (const [id, o] of B.proj) if (!live.has(id)) { GFX.arena.remove(o); B.proj.delete(id); }
  // the hidden deuce: a cel-shaded swirl with a stink cloud and buzzing flies
  if (!B.poops) B.poops = new Map();
  const left = new Set();
  for (const p of R.poops) {
    left.add(p.id);
    let o = B.poops.get(p.id);
    if (!o) { o = poopMesh(); o.position.set(p.x, p.y, p.z); o.rotation.y = p.id * 1.7; GFX.arena.add(o); B.poops.set(p.id, o); o.userData.born = GFX.clock; }
    const age = GFX.clock - o.userData.born, life = Math.max(0, 1 - (R.t - p.t) / 5), k = Math.min(1, age * 6) * (0.15 + 0.85 * life);
    o.scale.setScalar(k * (1 + Math.sin(GFX.clock * 3 + p.id) * 0.02));
    o.userData.flies.forEach((f, j) => { const a = GFX.clock * (3 + j) + j * 2.1; f.position.set(Math.cos(a) * (0.3 + j * 0.06), 0.45 + Math.sin(a * 1.7) * 0.12, Math.sin(a * 1.3) * (0.3 + j * 0.05)); });
    if (Math.random() < 0.06) part(p.x + R3(0.15), p.y + 0.35, p.z + R3(0.15), { vy: 0.45, vx: R3(0.1), vz: R3(0.1), life: 1.6, s0: 0.15, s1: 0.55, col: 0x9fbf3a });
  }
  for (const [id, o] of B.poops) if (!left.has(id)) { GFX.arena.remove(o); B.poops.delete(id); }
  // molotov fire zones
  for (const f of R.fires) for (let k = 0; k < 2; k++) { const a = Math.random() * 6.28, d = Math.sqrt(Math.random()) * f.r; fxFlame(f.x + Math.cos(a) * d, f.y + 0.1, f.z + Math.sin(a) * d); }
}

// ── the chase camera: velocity-aware damping, dynamic FOV 68–82, shoulder shift while aiming,
// occlusion pull-in, never below the ground (bible §5)
function updateCamera(R, dt, tv, opts = {}) {
  const T = THREE, cam = GFX.cam;
  if (!CAMR.pos) { CAMR.pos = new T.Vector3(tv.x, tv.y + 3, tv.z - 5); CAMR.look = new T.Vector3(tv.x, tv.y + 1.4, tv.z); }
  const sp = Math.hypot(tv.vx || 0, tv.vz || 0), aiming = !!opts.aim;
  const yaw = opts.yaw ?? CAMR.yaw, pitch = opts.pitch ?? CAMR.pitch;
  let dist = aiming ? 2.7 : 3.4 + Math.min(1, sp / 14) * 1.0;
  if (opts.dist) dist = opts.dist;
  const fov = (aiming ? 64 : 68 + Math.min(1, sp / 16) * 14) * (SETTINGS.fov || 1);
  CAMR.fov += (fov - CAMR.fov) * Math.min(1, dt * 5);
  const tgt = new T.Vector3(tv.x, tv.y + 1.4, tv.z);
  const cp = Math.cos(pitch), fx = Math.sin(yaw) * cp, fy = Math.sin(pitch), fz = Math.cos(yaw) * cp;
  const rx = -Math.cos(yaw), rz = Math.sin(yaw), sh = aiming ? 0.6 : 0.25;
  const pivot = new T.Vector3(tgt.x + rx * sh, tgt.y + (aiming ? 0.1 : 0), tgt.z + rz * sh);
  // Smooth the point we orbit (follows the skater) and the boom length, but apply the look angles exactly:
  // the camera swings around the pivot on a rigid arm, so turning never lags behind and then snaps.
  const k = 1 - Math.exp(-dt * (opts.snap ? 60 : 18 + sp * 0.8));
  if (!CAMR.piv || CAMR.piv.distanceTo(pivot) > 6) CAMR.piv = pivot.clone(); else CAMR.piv.lerp(pivot, k);
  const P = CAMR.piv;
  // occlusion: pull the camera in front of whatever is between it and the skater (in at once, back out gently)
  // Five rays (centre + a ring the size of the lens) so a wall at a grazing angle can't slip between the
  // camera and the skater and get clipped by the near plane.
  let d = dist;
  if (R && R.W) {
    const ux = -fy * Math.sin(yaw), uy = cp, uz = -fy * Math.cos(yaw), o = 0.32; // camera up vector
    for (const [a, b] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const ex = P.x - fx * dist + (rx * a + ux * b) * o, ey = P.y - fy * dist + uy * b * o, ez = P.z - fz * dist + (rz * a + uz * b) * o;
      const vx = ex - P.x, vy = ey - P.y, vz = ez - P.z, L = Math.hypot(vx, vy, vz);
      const hit = SIM0.raycast(R.W, P.x, P.y, P.z, vx / L, vy / L, vz / L, L);
      d = Math.min(d, (hit - 0.3) * dist / L);
    }
    d = Math.max(0.35, d);
  }
  CAMR.d = CAMR.d == null || d < CAMR.d ? d : CAMR.d + (d - CAMR.d) * Math.min(1, dt * 4);
  const want = new T.Vector3(P.x - fx * CAMR.d, P.y - fy * CAMR.d, P.z - fz * CAMR.d);
  if (R && R.W) {
    // never outside the arena's boundary walls (you'd see the back of the set)
    if (R.W.floor) { const lim = R.W.half - 0.35; want.x = Math.max(-lim, Math.min(lim, want.x)); want.z = Math.max(-lim, Math.min(lim, want.z)); }
    // squeezed in close (back to a wall): rise up and look down over the skater instead of staring at their back
    const hd = Math.hypot(want.x - P.x, want.z - P.z); if (hd < 1.6) { const head = SIM0.raycast(R.W, P.x, P.y, P.z, 0, 1, 0, 2.5); want.y = Math.max(want.y, Math.min(P.y + (1.6 - hd) * 1.1, P.y + head - 0.3)); }
    const gy = SIM0.groundAt(R.W, want.x, want.z, want.y + 0.5); if (gy > -1e8 && want.y < gy + 0.35) want.y = gy + 0.35;
  }
  CAMR.pos.copy(want);
  cam.position.copy(CAMR.pos);
  const sk = PFX.shake * 0.25; cam.position.x += R3(sk); cam.position.y += R3(sk); cam.position.z += R3(sk);
  // when the camera had to rise (squeezed against a wall), tip it down so the skater stays in frame
  const lift = Math.max(0, CAMR.pos.y - (P.y - fy * CAMR.d)), tipK = Math.min(1, lift / 1.6);
  cam.lookAt(P.x + fx * 10 * (1 - tipK * 0.85), P.y + fy * 10 * (1 - tipK) - tipK * 1.2, P.z + fz * 10 * (1 - tipK * 0.85));
  cam.fov = CAMR.fov; cam.updateProjectionMatrix();
  // sun follows the action so shadows stay crisp near the camera
  const sd = GFX.sunDir || new T.Vector3(0.5, 0.8, 0.3);
  GFX.sun.position.set(tv.x + sd.x * 80, tv.y + sd.y * 80, tv.z + sd.z * 80); GFX.sun.target.position.set(tv.x, tv.y, tv.z); GFX.sun.target.updateMatrixWorld();
  if (GFX.sky) GFX.sky.position.copy(cam.position); if (GFX.skyDeco) GFX.skyDeco.position.copy(cam.position);
  AUDIO.listener.x = cam.position.x; AUDIO.listener.y = cam.position.y; AUDIO.listener.z = cam.position.z; AUDIO.listener.yaw = yaw;
  CAMR.yaw = yaw; CAMR.pitch = pitch;
}
// free orbit around a point (menus, spectating, results)
function orbitCamera(R, dt, x, y, z, radius = 9, height = 4, speed = 0.15) {
  CAMR.orbit += dt * speed;
  const T = THREE, cam = GFX.cam, a = CAMR.orbit;
  const want = new T.Vector3(x + Math.sin(a) * radius, y + height, z + Math.cos(a) * radius);
  if (!CAMR.pos) CAMR.pos = want.clone();
  CAMR.pos.lerp(want, 1 - Math.exp(-dt * 3));
  cam.position.copy(CAMR.pos); cam.lookAt(x, y + 1, z);
  cam.fov = 60; cam.updateProjectionMatrix();
  const sd = GFX.sunDir || new T.Vector3(0.5, 0.8, 0.3);
  GFX.sun.position.set(x + sd.x * 80, y + sd.y * 80, z + sd.z * 80); GFX.sun.target.position.set(x, y, z); GFX.sun.target.updateMatrixWorld();
  if (GFX.sky) GFX.sky.position.copy(cam.position); if (GFX.skyDeco) GFX.skyDeco.position.copy(cam.position);
  AUDIO.listener.x = cam.position.x; AUDIO.listener.y = cam.position.y; AUDIO.listener.z = cam.position.z; AUDIO.listener.yaw = a + Math.PI;
}
// soft auto-target: attacks lock onto the best enemy roughly in front of the camera (within ~40° and weapon
// range, in sight); otherwise they go straight ahead. No crosshair, no aiming while you skate and trick.
function aimFrom(R, me) {
  const camYaw = INPUT.yaw, ranged = me.ranged && me.ammo > 0, Wp = ranged ? WEAPONS[me.ranged] : WEAPONS[me.melee || 'bat'];
  const range = ranged ? Math.min(Wp.range, 38) : 9;
  let best = null, bs = 1e9;
  for (const s of R.sk) {
    if (!s.alive || s.i === me.i) continue;
    const dx = s.x - me.x, dz = s.z - me.z, d = Math.hypot(dx, dz);
    if (d > range || Math.abs(s.y - me.y) > 6) continue;
    const ang = Math.abs(angWrap(Math.atan2(dx, dz) - camYaw));
    if (ang > (d < 3 ? 1.2 : 0.7)) continue;
    const score = ang * 9 + d * 0.15;
    if (score >= bs) continue;
    if (!SIM0.raycast || SIM0.raycast(R.W, me.x, me.y + 1.3, me.z, dx / (d || 1), (s.y - me.y) / (d || 1), dz / (d || 1), d) < d - 0.3) continue;
    bs = score; best = s;
  }
  GAME.lock = best ? best.i : -1;
  if (!best) return { yaw: camYaw, pitch: 0 };
  const lead = ranged && Wp.proj ? Math.hypot(best.x - me.x, best.z - me.z) / Wp.proj : 0;
  const tx = best.x + best.vx * lead - me.x, ty = best.y + 1.0 + best.vy * lead - (me.y + 1.35), tz = best.z + best.vz * lead - me.z, h = Math.hypot(tx, tz);
  return { yaw: Math.atan2(tx, tz), pitch: Math.max(-1, Math.min(1, Math.atan2(ty, Math.max(0.5, h)))) };
}
// lock-on marker: a ring at the target's feet and a chevron over its head
function syncLock(R, view) {
  const T = THREE;
  if (!GFX.lockMark) {
    const g = new T.Group();
    const ring = new T.Mesh(new T.RingGeometry(0.75, 0.95, 32), new T.MeshBasicMaterial({ color: '#FF5C69', transparent: true, opacity: 0.85, depthWrite: false, side: T.DoubleSide }));
    ring.rotation.x = -Math.PI / 2; ring.position.y = 0.06; g.add(ring);
    const chev = new T.Mesh(new T.ConeGeometry(0.16, 0.3, 3), new T.MeshBasicMaterial({ color: '#FF5C69' })); chev.rotation.x = Math.PI; chev.position.y = 2.45; g.add(chev);
    g.userData = { ring, chev }; GFX.lockMark = g; GFX.scene.add(g);
  }
  const g = GFX.lockMark, i = GAME.lock;
  const on = i >= 0 && GAME.screen === 'match' && GAME.phase === 'play' && R.sk[i] && R.sk[i].alive;
  g.visible = !!on; if (!on) return;
  const v = view(R.sk[i]); g.position.set(v.x, v.y, v.z);
  g.userData.ring.rotation.z += 0.04; g.userData.chev.position.y = 2.45 + Math.sin(GFX.clock * 6) * 0.08;
}
// The simulation reads the stick relative to the aim yaw; re-express the camera-relative stick in that frame so
// locking onto someone never changes which way you steer.
function stickFor(inp, aimYaw) {
  const C = INPUT.yaw, wx = inp.my * Math.sin(C) - inp.mx * Math.cos(C), wz = inp.my * Math.cos(C) + inp.mx * Math.sin(C);
  return { mx: -wx * Math.cos(aimYaw) + wz * Math.sin(aimYaw), my: wx * Math.sin(aimYaw) + wz * Math.cos(aimYaw) };
}

// a stacked toon swirl (three tori and a tip) with outlines, plus a couple of flies
let POOP_PARTS = null;
function poopMesh() {
  const T = THREE;
  if (!POOP_PARTS) POOP_PARTS = { mat: toon('#6B4423'), hi: toon('#8A5A2E'), ol: new T.MeshBasicMaterial({ color: 0x22292b, side: T.BackSide }), fly: new T.MeshBasicMaterial({ color: 0x111111 }) };
  const M = POOP_PARTS, g = new T.Group();
  const add = (geo, m, y, sc) => { const a = new T.Mesh(geo, m); a.position.y = y; const o = new T.Mesh(geo, M.ol); o.scale.setScalar(sc); a.add(o); g.add(a); return a; };
  const r1 = add(new T.TorusGeometry(0.17, 0.085, 8, 16), M.mat, 0.08, 1.12); r1.rotation.x = Math.PI / 2;
  const r2 = add(new T.TorusGeometry(0.115, 0.075, 8, 14), M.hi, 0.2, 1.13); r2.rotation.x = Math.PI / 2; r2.position.x = 0.02;
  const r3 = add(new T.TorusGeometry(0.06, 0.06, 8, 12), M.mat, 0.3, 1.15); r3.rotation.x = Math.PI / 2;
  const tip = add(new T.ConeGeometry(0.06, 0.13, 10), M.hi, 0.39, 1.15); tip.rotation.z = 0.35;
  const flies = [];
  for (let j = 0; j < 3; j++) { const f = new T.Mesh(new T.SphereGeometry(0.022, 5, 4), M.fly); g.add(f); flies.push(f); }
  g.userData.flies = flies;
  return g;
}

// ── auto camera: when you're not looking around yourself, the camera eases back behind your skater
// (following where you're travelling, not which way the board spins in the air), and the pitch settles to default.
const AUTOCAM = { rev: 0, w: 0 };
function autoFollow(dt, s) {
  const idle = (performance.now() - (INPUT.lookAt || 0)) / 1000;
  if (idle < 0.9 || !s || !s.alive) { AUTOCAM.w = 0; return; }
  AUTOCAM.w = Math.min(1, AUTOCAM.w + dt * 0.8); // ease in after you let go of the camera
  const sp = Math.hypot(s.vx, s.vz), grounded = s.mode === MODE.GROUND || s.mode === MODE.GRIND;
  if (grounded && sp > 2.5 && !s.deuce) {
    const head = Math.atan2(s.vx, s.vz), diff = angWrap(head - INPUT.yaw);
    // a full turnaround (halfpipe walls, a U-turn) only gets followed once you've kept going that way for a moment
    if (Math.abs(diff) > 2.2) AUTOCAM.rev += dt; else AUTOCAM.rev = 0;
    if (Math.abs(diff) <= 2.2 || AUTOCAM.rev > 1.1) {
      const rate = Math.min(2.4, 0.6 + sp * 0.12) * AUTOCAM.w;
      INPUT.yaw += Math.max(-rate * dt, Math.min(rate * dt, diff * Math.min(1, dt * 2.2)));
    }
  }
  INPUT.pitch += (-0.14 - INPUT.pitch) * Math.min(1, dt * 1.2 * AUTOCAM.w);
}
