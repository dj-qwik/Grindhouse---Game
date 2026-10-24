// ───────────────────────── WORLD: authored arena geometry (bible §12–13) ─────────────────────────
// Arenas are hand-authored from a few solid primitives on an oriented rectangle footprint:
//   box   flat top at `top`, solid from y0 up
//   slope height h0 at the near edge (local z = −d/2) rising to h1 at the far edge (kickers, banks, stairs)
//   qp    quarter pipe: circular transition from `base` at the near edge to a lip angle `ang` at the far edge
// The same data drives physics here and meshes in the renderer. Arenas may move prims in update()
// (sweepers, shutters) or remove them (prim.gone = true: collapsing roofs, splintering pier).
// Local frame of a prim with yaw θ: local z = forward (sin θ, cos θ), local x = (cos θ, −sin θ).

const ARENAS = {}; // arenas/*.js register themselves here

function mkPrim(type, o) {
  const p = Object.assign({ type, cx: 0, cz: 0, w: 2, d: 2, yaw: 0, y0: 0, top: 1, h0: 0, h1: 1, base: 0, ang: 1, mat: 'concrete', gone: false, vx: 0, vz: 0, wr: true, hz: null }, o);
  primPose(p);
  if (type === 'qp') { p.R = p.d / Math.sin(p.ang); p.lipH = p.base + p.R - Math.sqrt(p.R * p.R - p.d * p.d); }
  return p;
}
// recompute cached rotation + bounds after an arena moves/rotates a prim
function primPose(p) { p.c = Math.cos(p.yaw); p.s = Math.sin(p.yaw); p.rad = hyp(p.w, p.d) / 2; return p; }
function primTop(p) { return p.type === 'box' ? p.top : p.type === 'slope' ? Math.max(p.h0, p.h1) : p.lipH; }
let LX = 0, LZ = 0;
function toLocal(p, x, z) { const dx = x - p.cx, dz = z - p.cz; LX = dx * p.c - dz * p.s; LZ = dx * p.s + dz * p.c; }
function inFoot(p) { return LX >= -p.w / 2 && LX <= p.w / 2 && LZ >= -p.d / 2 && LZ <= p.d / 2; }
function surfL(p, lz) {
  if (p.type === 'box') return p.top;
  const u = clamp(lz + p.d / 2, 0, p.d);
  if (p.type === 'slope') return p.h0 + (p.h1 - p.h0) * (u / p.d);
  return p.base + p.R - Math.sqrt(p.R * p.R - u * u);
}
function gradL(p, lz) {
  if (p.type === 'box') return 0;
  if (p.type === 'slope') return (p.h1 - p.h0) / p.d;
  const u = clamp(lz + p.d / 2, 0, p.d * 0.999);
  return u / Math.sqrt(p.R * p.R - u * u);
}
// surface normal of prim p at local z (world space) → NX, NY, NZ
let NX = 0, NY = 1, NZ = 0;
function primNormal(p, lz) {
  const gz = gradL(p, lz);
  const hx = gz * p.s, hz = gz * p.c; // dh/dx, dh/dz
  const l = len3(hx, 1, hz); NX = -hx / l; NY = 1 / l; NZ = -hz / l;
}

// ── ground query: highest walkable surface at (x, z) with top ≤ yTop. Ramps (slope/qp) accept up to
// yTopRamp so a fast skater riding up a transition stays attached. → { y } and GP (prim or null), normal in N*.
let GP = null;
function groundAt(W, x, z, yTop, yTopRamp = yTop) {
  let best = -1e9; GP = null; NX = 0; NY = 1; NZ = 0;
  if (W.floor && Math.abs(x) <= W.half && Math.abs(z) <= W.half && 0 <= yTop && !inHole(W, x, z)) best = 0;
  let bestLz = 0;
  for (const p of W.prims) {
    if (p.gone || Math.abs(x - p.cx) > p.rad || Math.abs(z - p.cz) > p.rad) continue;
    toLocal(p, x, z);
    if (!inFoot(p)) continue;
    const s = surfL(p, LZ);
    if (s > (p.type === 'box' ? yTop : yTopRamp) || s <= best) continue;
    best = s; GP = p; bestLz = LZ;
  }
  if (GP) primNormal(GP, bestLz);
  return best;
}
function inHole(W, x, z) {
  for (const h of W.holes) { if (!h.open) continue; const dx = x - h.cx, dz = z - h.cz; if (Math.abs(dx) <= h.w / 2 && Math.abs(dz) <= h.d / 2) return true; }
  return false;
}
// point inside any solid (projectiles, line of sight)
function solidAt(W, x, y, z) {
  if (W.floor && y < 0 && y > -1.5 && Math.abs(x) <= W.half && Math.abs(z) <= W.half && !inHole(W, x, z)) return true;
  for (const p of W.prims) {
    if (p.gone || Math.abs(x - p.cx) > p.rad || Math.abs(z - p.cz) > p.rad) continue;
    toLocal(p, x, z);
    if (inFoot(p) && y >= p.y0 && y <= surfL(p, LZ)) return p;
  }
  return false;
}
// Distance along a ray to the first solid (≤ maxD). Marches 0.15 m over prims whose bounds touch the ray.
const RC = [];
let RAY_PRIM = null;
function raycast(W, ox, oy, oz, dx, dy, dz, maxD) {
  RC.length = 0; RAY_PRIM = null;
  const ex = ox + dx * maxD, ez = oz + dz * maxD, sx = ex - ox, sz = ez - oz, l2 = sx * sx + sz * sz;
  for (const p of W.prims) {
    if (p.gone) continue;
    const t = l2 < 1e-9 ? 0 : clamp(((p.cx - ox) * sx + (p.cz - oz) * sz) / l2, 0, 1);
    if (hyp(ox + sx * t - p.cx, oz + sz * t - p.cz) <= p.rad + 0.2) RC.push(p);
  }
  const step = 0.15, n = Math.ceil(maxD / step);
  for (let k = 1; k <= n; k++) {
    const d = k === n ? maxD : k * step, x = ox + dx * d, y = oy + dy * d, z = oz + dz * d;
    if (W.floor && y < 0 && Math.abs(x) <= W.half && Math.abs(z) <= W.half && !inHole(W, x, z)) return d;
    for (const p of RC) {
      if (Math.abs(x - p.cx) > p.rad || Math.abs(z - p.cz) > p.rad) continue;
      toLocal(p, x, z);
      if (inFoot(p) && y >= p.y0 && y <= surfL(p, LZ)) { RAY_PRIM = p; return d; }
    }
  }
  return maxD;
}
function lineOfSight(W, ax, ay, az, bx, by, bz) {
  const dx = bx - ax, dy = by - ay, dz = bz - az, d = len3(dx, dy, dz);
  if (d < 0.05) return true;
  return raycast(W, ax, ay, az, dx / d, dy / d, dz / d, d) >= d - 0.05;
}

// ── skater vs solids: push a capsule (radius SK_R, height SK_H) out of prim sides it can't roll up.
// Returns the strongest contact: CN_X/CN_Z (world normal), CN_P (prim), CN_V (speed into the wall).
let CN_X = 0, CN_Z = 0, CN_P = null, CN_V = 0;
function collideSkater(W, s) {
  CN_P = null; CN_V = 0;
  for (let pass = 0; pass < 2; pass++) for (const p of W.prims) {
    if (p.gone || Math.abs(s.x - p.cx) > p.rad + SK_R || Math.abs(s.z - p.cz) > p.rad + SK_R) continue;
    const step = STEP + (s.stepX || 0);
    if (p.y0 >= s.y + SK_H || primTop(p) <= s.y + step) continue;
    toLocal(p, s.x, s.z);
    const hw = p.w / 2, hd = p.d / 2, qx = clamp(LX, -hw, hw), qz = clamp(LZ, -hd, hd);
    const sh = surfL(p, qz);
    if (sh <= s.y + step) continue; // can roll onto it (or we're above it)
    let ex = LX - qx, ez = LZ - qz, d = hyp(ex, ez), push;
    if (d >= SK_R) continue;
    if (d > 1e-6) { ex /= d; ez /= d; push = SK_R - d; }
    else { // centre inside the footprint: leave through the nearest side
      const m = [hw - LX, LX + hw, hd - LZ, LZ + hd]; let k = 0; for (let j = 1; j < 4; j++) if (m[j] < m[k]) k = j;
      ex = k === 0 ? 1 : k === 1 ? -1 : 0; ez = k === 2 ? 1 : k === 3 ? -1 : 0; push = m[k] + SK_R;
      // a ramp's own surface under us is ground, not wall (handled by groundAt) — only push if clearly inside
      if (p.type !== 'box' && sh - s.y < 0.9) continue;
    }
    const nx = ex * p.c + ez * p.s, nz = -ex * p.s + ez * p.c; // local → world
    s.x += nx * push; s.z += nz * push;
    const vn = s.vx * nx + s.vz * nz;
    if (vn < 0) {
      if (-vn > CN_V) { CN_V = -vn; CN_X = nx; CN_Z = nz; CN_P = p; }
      s.vx -= vn * nx; s.vz -= vn * nz;
      s.vx += p.vx * 0.5; s.vz += p.vz * 0.5; // moving walls shove
    }
    if (!CN_P) { CN_X = nx; CN_Z = nz; CN_P = p; }
  }
  // head bump under platforms
  if (s.vy > 0) for (const p of W.prims) {
    if (p.gone || p.y0 <= s.y + 0.5 || p.y0 > s.y + SK_H) continue;
    if (Math.abs(s.x - p.cx) > p.rad || Math.abs(s.z - p.cz) > p.rad) continue;
    toLocal(p, s.x, s.z); if (inFoot(p)) { s.vy = 0; s.y = Math.min(s.y, p.y0 - SK_H); }
  }
  // arena bounds (an invisible fence just past the authored walls)
  const lim = W.floor ? W.half - SK_R : W.half + 4; // walled arenas: never past the floor, even off a big launch
  if (s.x > lim) { s.x = lim; s.vx = Math.min(0, s.vx); } if (s.x < -lim) { s.x = -lim; s.vx = Math.max(0, s.vx); }
  if (s.z > lim) { s.z = lim; s.vz = Math.min(0, s.vz); } if (s.z < -lim) { s.z = -lim; s.vz = Math.max(0, s.vz); }
}

// ── rails (grind splines, ledges, copings): polylines of [x, y, z]
function mkRail(pts, o = {}) {
  const r = Object.assign({ pts, kind: 'rail', live: false, gone: false }, o);
  r.seg = []; for (let k = 0; k + 1 < pts.length; k++) { const a = pts[k], b = pts[k + 1]; const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2], l = len3(dx, dy, dz); r.seg.push({ a, b, l, ux: dx / l, uy: dy / l, uz: dz / l }); }
  return r;
}
function railPoint(r, k, u) { const g = r.seg[k]; return [g.a[0] + g.ux * u, g.a[1] + g.uy * u, g.a[2] + g.uz * u]; }

// ───────────────────────── arena authoring kit (used by arenas/*.js) ─────────────────────────
// box(cx, cz, w, d, top, {yaw, y0, mat, wr})        slope(cx, cz, w, d, h0, h1, {yaw, y0})
// qp(cx, cz, w, d, angDeg, {yaw, base})              — rises toward local +z (facing yaw) to a lip
// kicker(cx, cz, w, len, h, yaw)                     — short launch ramp
// funbox(cx, cz, w, len, h, yaw, rampLen)            — ramp up · deck · ramp down (+ ledge rails)
// stairs(cx, cz, w, len, h, yaw)                     — stair set (a slope you ollie down) + handrail
// perimeter(W, half, h)                              — four boundary walls
function box(cx, cz, w, d, top, o = {}) { return mkPrim('box', { cx, cz, w, d, top, ...o }); }
function slope(cx, cz, w, d, h0, h1, o = {}) { return mkPrim('slope', { cx, cz, w, d, h0, h1, ...o }); }
function qp(cx, cz, w, d, angDeg, o = {}) { return mkPrim('qp', { cx, cz, w, d, ang: angDeg * PI / 180, ...o }); }
function offs(cx, cz, yaw, lx, lz) { const c = Math.cos(yaw), s = Math.sin(yaw); return [cx + lx * c + lz * s, cz - lx * s + lz * c]; }
function kicker(A, cx, cz, w, len, h, yaw, o = {}) { if (o.h1 == null) h *= 1.3; /* taller launch ramps */ const p = slope(cx, cz, w, len, 0, h, { yaw, mat: 'wood', ...o }); A.prims.push(p); return p; }
function funbox(A, cx, cz, w, len, h, yaw, rampLen = 3, o = {}) {
  const [ax, az] = offs(cx, cz, yaw, 0, -(len / 2 + rampLen / 2)), [bx, bz] = offs(cx, cz, yaw, 0, len / 2 + rampLen / 2);
  A.prims.push(slope(ax, az, w, rampLen, 0, h, { yaw, mat: 'wood', ...o }), box(cx, cz, w, len, h, { yaw, mat: o.mat || 'concrete', wr: false }), slope(bx, bz, w, rampLen, h, 0, { yaw, mat: 'wood', ...o }));
  for (const side of [-1, 1]) { const [p0x, p0z] = offs(cx, cz, yaw, side * w / 2, -len / 2), [p1x, p1z] = offs(cx, cz, yaw, side * w / 2, len / 2); A.rails.push(mkRail([[p0x, h, p0z], [p1x, h, p1z]], { kind: 'ledge' })); }
}
function stairs(A, cx, cz, w, len, h, yaw, rail = true) {
  A.prims.push(slope(cx, cz, w, len, h, 0, { yaw, mat: 'stairs', wr: false }));
  if (rail) { const [p0x, p0z] = offs(cx, cz, yaw, w / 2 - 0.3, -len / 2), [p1x, p1z] = offs(cx, cz, yaw, w / 2 - 0.3, len / 2); A.rails.push(mkRail([[p0x, h + 0.9, p0z], [p1x, 0.9, p1z]], { kind: 'handrail' })); }
}
function qpWithDeck(A, cx, cz, w, d, angDeg, yaw, deck = 2.5, o = {}) {
  const q = qp(cx, cz, w, d, angDeg, { yaw, mat: o.mat || 'concrete', base: o.base || 0 });
  const [dx, dz] = offs(cx, cz, yaw, 0, d / 2 + deck / 2);
  A.prims.push(q, box(dx, dz, w, deck, q.lipH, { yaw, mat: o.deckMat || 'concrete', y0: o.base || 0 }));
  const [l0x, l0z] = offs(cx, cz, yaw, -w / 2, d / 2 + 0.05), [l1x, l1z] = offs(cx, cz, yaw, w / 2, d / 2 + 0.05);
  A.rails.push(mkRail([[l0x, q.lipH, l0z], [l1x, q.lipH, l1z]], { kind: 'coping' }));
  return q;
}
// halfpipe(cx, cz, yaw, {base, w, flat}) — two ~4 m vert quarter pipes facing each other over a flat bottom, with
// decks and copings. Open at both ends (you roll in from the sides along the flat). Footprint ≈ (2·(d+deck)+flat) × w.
const HP = { d: 3.6, ang: 84, deck: 2.4, flat: 4, w: 7 }; // lip ≈ 3.2 m
function halfpipeLen(o = {}) { return 2 * (HP.d + HP.deck) + (o.flat ?? HP.flat); }
function halfpipe(A, cx, cz, yaw, o = {}) {
  const w = o.w ?? HP.w, flat = o.flat ?? HP.flat, base = o.base || 0, off = flat / 2 + HP.d / 2, y0 = base > 0 ? base - 0.6 : 0;
  for (const side of [1, -1]) {
    const fy = side > 0 ? yaw : yaw + PI, [qx, qz] = offs(cx, cz, yaw, 0, side * off), [dx, dz] = offs(cx, cz, yaw, 0, side * (off + HP.d / 2 + HP.deck / 2));
    const q = qp(qx, qz, w, HP.d, HP.ang, { yaw: fy, base, y0, mat: 'wood', wr: false });
    const dk = box(dx, dz, w, HP.deck, q.lipH, { yaw: fy, y0, mat: 'metal', wr: false });
    if (o.addPrim) { o.addPrim(q); o.addPrim(dk); } else A.prims.push(q, dk);
    const [l0x, l0z] = offs(qx, qz, fy, -w / 2, HP.d / 2 + 0.05), [l1x, l1z] = offs(qx, qz, fy, w / 2, HP.d / 2 + 0.05);
    const rl = mkRail([[l0x, q.lipH, l0z], [l1x, q.lipH, l1z]], { kind: 'coping' });
    if (o.addRail) o.addRail(rl); else A.rails.push(rl);
  }
  A.halfpipe = { x: cx, z: cz, yaw, w, len: halfpipeLen(o), base };
}
function perimeter(A, half, h = 4, mat = 'wall') {
  const t = 1.2;
  A.prims.push(box(0, half + t / 2, half * 2 + t * 2, t, h, { mat }), box(0, -half - t / 2, half * 2 + t * 2, t, h, { mat }),
    box(half + t / 2, 0, t, half * 2, h, { mat }), box(-half - t / 2, 0, t, half * 2, h, { mat }));
}
// a fresh arena object every round (prims are mutated by hazards)
function mkArena(o) { return Object.assign({ prims: [], rails: [], holes: [], floor: true, half: 40, killY: -8, spawns: [], pickups: [], zone: [], hazards: [] }, o); }

// ── grindable edges: the top edges of (almost) every box become invisible grind lines (W.edges). An edge is
// skipped when an authored rail already runs there, when a surface continues flush past it (it's not an edge),
// and it switches off while its box is gone or has moved (collapsing roofs, press hammers, sweepers).
function addEdges(W) {
  W.edges = [];
  const near = (x, y, z) => { for (const r of W.rails) for (const g of r.seg) { const t = segT(x, y, z, g.a[0], g.a[1], g.a[2], g.b[0], g.b[1], g.b[2]); const cx = g.a[0] + (g.b[0] - g.a[0]) * t, cy = g.a[1] + (g.b[1] - g.a[1]) * t, cz = g.a[2] + (g.b[2] - g.a[2]) * t; if (hyp(x - cx, z - cz) < 0.6 && Math.abs(y - cy) < 0.6) return true; } return false; };
  // an edge point is buried when some other surface sits above it there (stacked decks, a ramp over a box…)
  const buried = (x, z, y) => groundAt(W, x, z, 200) > y + 0.08;
  // the uncovered stretches of a straight edge a→b (y0→y1), each at least 1 m long
  // a real edge drops away steeply: 0.3 m out the surface must be ≥ 0.5 m lower (steeper than ~60°) or gone.
  // Gentle bank tops, ramp transitions and flush neighbours are corners you can't physically grind.
  const drops = (x, z, y, nx, nz) => groundAt(W, x + nx * 0.3, z + nz * 0.3, y + 0.1) < y - 0.5;
  const openRuns = (a, b, y0, y1, nx = 0, nz = 0) => {
    const L = hyp(b[0] - a[0], b[1] - a[1]), n = Math.max(2, Math.ceil(L / 0.4)), runs = []; let st = -1;
    for (let i = 0; i <= n; i++) {
      const u = i / n, x = a[0] + (b[0] - a[0]) * u, z = a[1] + (b[1] - a[1]) * u, y = y0 + (y1 - y0) * u, open = !buried(x, z, y) && (!nx && !nz || drops(x, z, y, nx, nz));
      if (open && st < 0) st = u; if ((!open || i === n) && st >= 0) { const e = open ? u : (i - 1) / n; if ((e - st) * L >= 1) runs.push([st, e]); st = -1; }
    }
    return runs;
  };
  const tag = (r, p) => { r.prim = p; r.px = p.cx; r.pz = p.cz; r.ptop = p.top; return r; };
  for (const p of W.prims) {
    if (p.gone || p.hz || p.w < 0.5 || p.d < 0.5) continue;
    if (p.type === 'box') {
      const top = p.top, h = top - Math.max(p.y0, 0);
      if (h < 0.3 || top > 9) continue;
      const hw = p.w / 2 - 0.04, hd = p.d / 2 - 0.04;
      const C = [[-hw, -hd], [hw, -hd], [hw, hd], [-hw, hd]].map(([lx, lz]) => offs(p.cx, p.cz, p.yaw, lx, lz));
      const ok = [];
      for (let k = 0; k < 4; k++) {
        const a = C[k], b = C[(k + 1) % 4], mx = (a[0] + b[0]) / 2, mz = (a[1] + b[1]) / 2;
        let nx = mx - p.cx, nz = mz - p.cz; const nl = hyp(nx, nz) || 1; nx /= nl; nz /= nl;
        // outward normal of this side (perpendicular to it, away from the box)
        let ex = b[1] - a[1], ez = -(b[0] - a[0]); const el = hyp(ex, ez) || 1; ex /= el; ez /= el; if (ex * nx + ez * nz < 0) { ex = -ex; ez = -ez; }
        const edge = !near(mx, top, mz);
        const runs = edge ? openRuns(a, b, top, top, ex, ez) : [];
        const whole = runs.length === 1 && runs[0][0] === 0 && runs[0][1] === 1;
        ok.push(whole);
        if (edge && !whole) for (const [u0, u1] of runs) { // partly covered: just the open stretches, unchained
          const P = (u) => [a[0] + (b[0] - a[0]) * u, top, a[1] + (b[1] - a[1]) * u];
          W.edges.push(tag(mkRail([P(u0), P(u1)], { kind: 'edge' }), p));
        }
      }
      // chain neighbouring edges so a grind carries round the corners (all four → a closed loop round the box)
      if (ok.every(Boolean)) { W.edges.push(tag(mkRail([...C, C[0]].map((c) => [c[0], top, c[1]]), { kind: 'edge', closed: true }), p)); continue; }
      const start = ok.findIndex((v, k) => !v); // begin each chain right after a missing edge
      let run = [];
      for (let n = 1; n <= 4; n++) {
        const k = (start + n) % 4;
        if (ok[k]) { if (!run.length) run.push(C[k]); run.push(C[(k + 1) % 4]); }
        if (!ok[k] || n === 4) { if (run.length >= 2) W.edges.push(tag(mkRail(run.map((c) => [c[0], top, c[1]]), { kind: 'edge' }), p)); run = []; }
      }
    } else if (p.type === 'slope') {
      // ramp sides: the sloped side edges of kickers / funbox ramps / stair sets
      const hi = Math.max(p.h0, p.h1); if (hi < 0.5 || hi > 9 || p.d < 1.5 || Math.abs(p.h1 - p.h0) / p.d > 0.6) continue; // no grinding 45° lines
      for (const sx of [-1, 1]) {
        const lx = sx * (p.w / 2 - 0.04), a = offs(p.cx, p.cz, p.yaw, lx, -p.d / 2 + 0.05), b = offs(p.cx, p.cz, p.yaw, lx, p.d / 2 - 0.05);
        const [ox, oz] = offs(p.cx, p.cz, p.yaw, lx + sx * 0.4, 0); const midH = (p.h0 + p.h1) / 2;
        if (groundAt(W, ox, oz, midH + 0.1) > midH - 0.2 || near(...offs(p.cx, p.cz, p.yaw, lx, 0).flatMap((v, k) => k ? [midH, v] : [v]))) continue;
        const [sxw, szw] = [sx * p.c, -sx * p.s]; // the side's outward direction in world space
        for (const [u0, u1] of openRuns(a, b, p.h0, p.h1, sxw, szw)) {
          const P = (u) => [a[0] + (b[0] - a[0]) * u, p.h0 + (p.h1 - p.h0) * u + 0.02, a[1] + (b[1] - a[1]) * u];
          W.edges.push(tag(mkRail([P(u0), P(u1)], { kind: 'edge' }), p));
        }
      }
    }
  }
}
function railOff(r) { return r.gone || (r.prim && (r.prim.gone || r.prim.cx !== r.px || r.prim.cz !== r.pz || r.prim.top !== r.ptop)); }
