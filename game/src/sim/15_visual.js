// ── visual de-fighting (render-only; never used by the simulation) ─────────────────────────────────────────────
// Arena pieces are often built flush: a ramp's side in the same plane as the roof it leans on, two railings
// overlapping at a corner, a kicker's base level with the deck it sits on. Two visible faces in one plane flicker
// ("z-fighting"). visualFaces() lists every flat face of the prims; visualInsets() groups faces that share a plane
// and overlap, keeps the biggest one where it is and pulls the others in by a multiple of VIS_STEP (1.5 cm — invisible,
// but far more than the depth buffer can confuse). insetPrim() returns the shrunken copy that gets drawn.
const VIS_STEP = 0.015, VIS_EPS = 0.004;
// moving pieces: 3–12 mm, varied by index so two moving pieces that meet flush (shutter corners) still differ
const visDyn = (k) => 0.003 * (1 + ((k | 0) % 4));
function visualFaces(p, out, floorY) {
  const c = Math.cos(p.yaw), s = Math.sin(p.yaw);
  const Wp = (lx, y, lz) => [p.cx + lx * c + lz * s, y, p.cz - lx * s + lz * c];
  const Nv = (lx, ly, lz) => [lx * c + lz * s, ly, -lx * s + lz * c];
  const prof = [];
  if (p.type === 'box') prof.push([-p.d / 2, p.top], [p.d / 2, p.top]);
  else if (p.type === 'slope') prof.push([-p.d / 2, p.h0], [p.d / 2, p.h1]);
  else for (let k = 0; k <= 14; k++) { const z = -p.d / 2 + p.d * k / 14; prof.push([z, surfL(p, z)]); }
  const y0 = p.y0, hw = p.w / 2, qp = p.type === 'qp';
  const add = (key, n, poly, fixed) => { out.push({ p, key, n, d: n[0] * poly[0][0] + n[1] * poly[0][1] + n[2] * poly[0][2], poly, fixed: !!fixed }); };
  for (const sx of [-1, 1]) add(sx < 0 ? 'xm' : 'xp', Nv(sx, 0, 0), [[-p.d / 2, y0], [p.d / 2, y0], ...prof.slice().reverse()].map(([z, y]) => Wp(sx * hw, y, z)));
  const f = prof[0], b = prof[prof.length - 1];
  if (f[1] - y0 > 0.005) add('zm', Nv(0, 0, -1), [Wp(-hw, y0, -p.d / 2), Wp(hw, y0, -p.d / 2), Wp(hw, f[1], -p.d / 2), Wp(-hw, f[1], -p.d / 2)], qp);
  if (b[1] - y0 > 0.005) add('zp', Nv(0, 0, 1), [Wp(-hw, y0, p.d / 2), Wp(hw, y0, p.d / 2), Wp(hw, b[1], p.d / 2), Wp(-hw, b[1], p.d / 2)], qp);
  if (!(floorY !== null && y0 <= floorY + 0.03)) add('bot', [0, -1, 0], [Wp(-hw, y0, -p.d / 2), Wp(-hw, y0, p.d / 2), Wp(hw, y0, p.d / 2), Wp(hw, y0, -p.d / 2)]);
  if (!qp) { const dz = p.d, dy = prof[1][1] - prof[0][1], L = Math.hypot(dz, dy); add('top', Nv(0, dz / L, -dy / L), [Wp(-hw, prof[0][1], -p.d / 2), Wp(hw, prof[0][1], -p.d / 2), Wp(hw, prof[1][1], p.d / 2), Wp(-hw, prof[1][1], p.d / 2)]); }
}
function visBasis(n) { const a = Math.abs(n[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0]; let u = [n[1] * a[2] - n[2] * a[1], n[2] * a[0] - n[0] * a[2], n[0] * a[1] - n[1] * a[0]]; const l = hyp3(u); u = [u[0] / l, u[1] / l, u[2] / l]; return [u, [n[1] * u[2] - n[2] * u[1], n[2] * u[0] - n[0] * u[2], n[0] * u[1] - n[1] * u[0]]]; }
function hyp3(v) { return Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]); }
function visInPoly(x, y, P) { let c = false; for (let i = 0, j = P.length - 1; i < P.length; j = i++) { const xi = P[i][0], yi = P[i][1], xj = P[j][0], yj = P[j][1]; if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c; } return c; }
// overlap area of two coplanar faces (sampled on an adaptive grid)
function visOverlap(A, B) {
  const [u, v] = visBasis(A.n), dt = (q, w) => q[0] * w[0] + q[1] * w[1] + q[2] * w[2];
  const pa = A.poly.map((q) => [dt(q, u), dt(q, v)]), pb = B.poly.map((q) => [dt(q, u), dt(q, v)]);
  const mn = (P, k) => Math.min(...P.map((q) => q[k])), mx = (P, k) => Math.max(...P.map((q) => q[k]));
  const x0 = Math.max(mn(pa, 0), mn(pb, 0)), x1 = Math.min(mx(pa, 0), mx(pb, 0)), y0 = Math.max(mn(pa, 1), mn(pb, 1)), y1 = Math.min(mx(pa, 1), mx(pb, 1));
  if (x1 - x0 < 0.02 || y1 - y0 < 0.02) return 0;
  const st = Math.max(0.02, Math.sqrt((x1 - x0) * (y1 - y0)) / 40);
  let n = 0; for (let x = x0 + st / 2; x < x1; x += st) for (let y = y0 + st / 2; y < y1; y += st) if (visInPoly(x, y, pa) && visInPoly(x, y, pb)) n++;
  return n * st * st;
}
// coplanar overlapping face pairs among `prims` (+ the floor plane when floorY !== null)
function visualPairs(prims, floorY, half, near = VIS_EPS, opposite = false) {
  const F = []; for (const p of prims) visualFaces(p, F, floorY);
  if (floorY !== null) F.push({ p: null, key: 'floor', n: [0, 1, 0], d: floorY, poly: [[-half, floorY, -half], [-half, floorY, half], [half, floorY, half], [half, floorY, -half]], fixed: true });
  const buckets = new Map(), pairs = [];
  const nk = (n) => `${Math.round(n[0] * 200)},${Math.round(n[1] * 200)},${Math.round(n[2] * 200)}`;
  F.forEach((f, i) => { const k = nk(f.n) + '|' + Math.round(f.d / 0.05); (buckets.get(k) || buckets.set(k, []).get(k)).push(i); });
  F.forEach((A, i) => {
    // same-facing faces in one plane (and, on request, back-to-back faces of pieces that abut)
    for (const sg of opposite ? [1, -1] : [1]) {
      const base = nk(A.n.map((q) => q * sg)), db = Math.round(A.d * sg / 0.05);
      for (let o = -1; o <= 1; o++) for (const j of buckets.get(base + '|' + (db + o)) || []) {
        if (sg > 0 && j <= i) continue; const B = F[j]; if (A.p && A.p === B.p) continue;
        if (sg < 0 && j <= i) continue;
        if (sg * (A.n[0] * B.n[0] + A.n[1] * B.n[1] + A.n[2] * B.n[2]) < 0.9995 || Math.abs(A.d * sg - B.d) > near) continue;
        const a = visOverlap(A, B); if (a >= 0.004) pairs.push([A, B, a, Math.abs(A.d * sg - B.d), sg < 0]);
      }
    }
  });
  return pairs;
}
// per-prim insets { xm, xp, zm, zp, top, bot } for a world's prims (pass them all, as built: moving pieces too)
function visualInsets(W, statics) {
  // colour the "shares a plane and overlaps" graph: biggest faces first, each takes the smallest step its
  // neighbours don't use (fixed faces — the floor, curved transitions' ends — always keep step 0)
  const pairs = visualPairs(statics, W.floor ? 0 : null, W.half), adj = new Map(), ins = new Map(), step = new Map();
  for (const [A, B, , , opp] of pairs) if (!opp) { (adj.get(A) || adj.set(A, []).get(A)).push(B); (adj.get(B) || adj.set(B, []).get(B)).push(A); }
  const area = (f) => { const [u, v] = visBasis(f.n), dt = (q, w) => q[0] * w[0] + q[1] * w[1] + q[2] * w[2], P = f.poly.map((q) => [dt(q, u), dt(q, v)]); let a = 0; for (let i = 0, j = P.length - 1; i < P.length; j = i++) a += (P[j][0] + P[i][0]) * (P[j][1] - P[i][1]); return Math.abs(a) / 2; };
  const order = [...adj.keys()].sort((a, b) => (b.fixed - a.fixed) || (area(b) - area(a)));
  for (const f of order) {
    if (f.fixed || !f.p) { step.set(f, 0); continue; }
    const used = new Set(adj.get(f).filter((g) => step.has(g)).map((g) => step.get(g)));
    let k = 0; while (used.has(k)) k++;
    step.set(f, k);
    if (k) { const o = ins.get(f.p) || ins.set(f.p, { xm: 0, xp: 0, zm: 0, zp: 0, top: 0, bot: 0 }).get(f.p); o[f.key] = k * VIS_STEP; }
  }
  return ins;
}
// the copy of p that gets drawn, pulled in by `o` (or by visDyn(k) on every side for moving piece number k)
// o: this prim's insets from visualInsets (or none); k: its index when it is a moving piece (adds visDyn(k) all round)
function insetPrim(p, o, k) {
  if (k !== undefined && k !== null) {
    const e = visDyn(k), b = o || {}, qp = p.type === 'qp';
    o = { xm: (b.xm || 0) + e, xp: (b.xp || 0) + e, zm: qp ? 0 : (b.zm || 0) + e, zp: qp ? 0 : (b.zp || 0) + e, top: qp ? 0 : (b.top || 0) + e, bot: (b.bot || 0) + e };
  }
  if (!o) return p;
  const q = Object.assign({}, p), c = Math.cos(p.yaw), s = Math.sin(p.yaw);
  const w = Math.max(0.02, p.w - o.xm - o.xp), d = Math.max(0.02, p.d - o.zm - o.zp), lx = (o.xm - o.xp) / 2, lz = (o.zm - o.zp) / 2;
  if (p.type === 'slope') { const h = (z) => p.h0 + (p.h1 - p.h0) * (z + p.d / 2) / p.d; q.h0 = h(-p.d / 2 + o.zm) - o.top; q.h1 = h(p.d / 2 - o.zp) - o.top; }
  if (p.type === 'box') q.top = p.top - o.top;
  q.y0 = p.y0 + o.bot; q.w = w; if (p.type !== 'qp') q.d = d;
  q.cx = p.cx + lx * c + (p.type !== 'qp' ? lz : 0) * s; q.cz = p.cz - lx * s + (p.type !== 'qp' ? lz : 0) * c;
  return q;
}
