// ───────────────────────── 2. ROOFTOP RIOT ─────────────────────────
// Nine warehouse roofs in a 3×3 grid split by 3 m alleys (no ground: fall in and you're out). Three vertical
// routes: the low east/west roofs (y 6), the mid core + corner roofs (y 8) and the high north/south roofs (y 10)
// with billboard catwalks above them (y 12.5). Full-width plank ramps bridge every inner alley (escape transitions
// between levels); by variant a diagonal plank also links two corners straight to the core. Low parapets (grindable
// ledges) line the outer drop. Contest points: the core (two anchors), both catwalks, both low-roof plazas.
// Hazards: HVAC fan grinders (low roofs), steam vents (high roofs) + the core exhaust grate (until 50 s),
// sparking billboard catwalks with a live ledge.
// FINALE: from 38 s the peripheral roofs collapse one numbered section at a time (corners → outer strips →
// inner wings); the central core roof never falls.
ARENAS.rooftop = {
  key: 'rooftop', name: 'Rooftop Riot', blurb: 'Warehouse roofs, fan grinders and a very long drop.',
  finale: 'Peripheral roofs collapse in numbered sections until only the central roof stands.', variants: 4,
  look: { sky: '#2E2A5A', horizon: '#F49A5E', fog: '#5B4A72', sun: [-0.45, 0.6, 0.5], ground: '#2A2633', accent: ['#FF3D7F', '#3DF2FF', '#FFD23D', '#9BFF3D'] },
  build(v) {
    const A = mkArena({ half: 38 });
    A.floor = false; A.killY = -6;
    const CORE = 8, LOW = 6, HIGH = 10, MID = 8, CAT = 12.5, PH = 0.9, PO = 1.2;
    const planksNE = v === 0 || v === 2; // planks on NE/SW corners, else NW/SE
    A.secs = []; A.fans = []; A.vents = []; A.cats = []; A.live = [];
    let cur = null;
    const P = (...ps) => { for (const p of ps) { A.prims.push(p); if (cur) cur.prims.push(p); } };
    const RL = (r) => { A.rails.push(r); if (cur) cur.rails.push(r); return r; };
    const sec = (id, x0, x1, z0, z1, top) => { cur = { id, prims: [], rails: [], x0: Math.min(x0, x1), x1: Math.max(x0, x1), z0: Math.min(z0, z1), z1: Math.max(z0, z1), top, t: 99, n: 0, hz: null }; A.secs.push(cur); return cur; };
    // parapet along an axis-aligned line (fixed coordinate `c`, from a0 to a1 along `axis`), with openings
    const par = (axis, c, a0, a1, top, h, open = []) => {
      let lo = Math.min(a0, a1); const hi = Math.max(a0, a1);
      const cuts = open.map((o) => [Math.min(o[0], o[1]), Math.max(o[0], o[1])]).sort((p, q) => p[0] - q[0] || p[1] - q[1]);
      const segs = [];
      for (const [o0, o1] of cuts) { if (o0 > lo) segs.push([lo, Math.min(o0, hi)]); lo = Math.max(lo, o1); }
      if (lo < hi) segs.push([lo, hi]);
      for (const [p0, p1] of segs) {
        if (p1 - p0 < 0.4) continue;
        const m = (p0 + p1) / 2, L = p1 - p0;
        if (axis === 'x') { P(box(m, c, L, 0.5, top + h, { y0: top, mat: 'brick', wr: false })); RL(mkRail([[p0, top + h, c], [p1, top + h, c]], { kind: 'ledge' })); }
        else { P(box(c, m, 0.5, L, top + h, { y0: top, mat: 'brick', wr: false })); RL(mkRail([[c, top + h, p0], [c, top + h, p1]], { kind: 'ledge' })); }
      }
    };
    // one half of the map; s = -1 emits the 180° image (E→W, N→S, NE→SW, NW→SE)
    const half = (s) => {
      const Y = s > 0 ? 0 : PI, nm = s > 0 ? ['Ei', 'Eo', 'Ni', 'No', 'NE', 'NW'] : ['Wi', 'Wo', 'Si', 'So', 'SW', 'SE'];
      const X = (x) => x * s;
      const ax = (axis, c, a0, a1, top, h, open = []) => par(axis, c * s, a0 * s, a1 * s, top, h, open.map((o) => [o[0] * s, o[1] * s]));
      const plankHere = planksNE; // NE + its SW image when true, else NW + its SE image
      // ── east inner wing (low roof): spawn plaza, HVAC hop, fan grinder; full-width plank ramp up to the core
      sec(nm[0], X(15), X(28), X(-12), X(12), LOW);
      P(box(X(21.5), 0, 13, 24, LOW, { mat: 'roof', wr: false }));
      P(slope(X(16), 0, 24, 8, LOW, CORE, { yaw: -PI / 2 + Y, y0: LOW - 1, mat: 'plank', wr: false }));
      P(box(X(21.5), 0, 2, 4, LOW + 1.5, { y0: LOW, mat: 'metal', wr: false }), slope(X(24.25), 0, 4, 3.5, LOW, LOW + 1.5, { yaw: -PI / 2 + Y, y0: LOW - 0.5, mat: 'metal', wr: false }));
      A.fans.push({ x: X(26), z: X(6), y: LOW, r: 1.7, sec: cur });
      RL(mkRail([[X(19), LOW + 0.6, X(-9)], [X(26), LOW + 0.6, X(-9)]], { kind: 'rail' }));
      // ── east outer strip (low roof)
      sec(nm[1], X(28), X(38), X(-12), X(12), LOW);
      P(box(X(33), 0, 10, 24, LOW, { mat: 'roof', wr: false }));
      halfpipe(A, X(33), 0, 0, { base: LOW, addPrim: (p) => P(p), addRail: (r) => RL(r) }); // the halfpipe (collapses with the strip)
      ax('z', 37.75, -12, 12, LOW, PO);
      // ── north inner wing (high roof): full-width ramp down to the core, HVAC hop, billboard catwalk, steam vents
      sec(nm[2], X(-12), X(12), X(15), X(28), HIGH);
      P(box(0, X(21.5), 24, 13, HIGH, { mat: 'roof', wr: false }));
      P(slope(0, X(11), 24, 8, CORE, HIGH, { yaw: Y, y0: CORE - 1, mat: 'plank', wr: false }));
      P(box(0, X(19), 3, 2, HIGH + 1.5, { y0: HIGH, mat: 'metal', wr: false }), slope(0, X(21.75), 3, 3.5, HIGH + 1.5, HIGH, { yaw: Y, y0: HIGH - 0.5, mat: 'metal', wr: false }));
      P(box(0, X(25.5), 10, 3, CAT, { y0: CAT - 0.5, mat: 'metal', wr: false }));
      P(slope(X(8), X(25.5), 3, 6, HIGH, CAT, { yaw: -PI / 2 + Y, y0: HIGH, mat: 'metal', wr: false }), slope(X(-8), X(25.5), 3, 6, HIGH, CAT, { yaw: PI / 2 + Y, y0: HIGH, mat: 'metal', wr: false }));
      P(box(0, X(27.4), 14, 0.6, CAT + 5.5, { y0: CAT + 0.4, mat: 'neon', wr: false }), box(X(6.5), X(27.4), 0.5, 0.5, CAT + 0.4, { y0: HIGH, mat: 'metal' }), box(X(-6.5), X(27.4), 0.5, 0.5, CAT + 0.4, { y0: HIGH, mat: 'metal' }));
      A.live.push(RL(mkRail([[X(-5), CAT, X(24.05)], [X(5), CAT, X(24.05)]], { kind: 'ledge' })));
      A.cats.push({ x: 0, z: X(25.5), w: 10, d: 3, y: CAT, kz: -s, sec: cur });
      A.vents.push({ x: X(5.5), z: X(17.5), w: 2.5, d: 2.5, y: HIGH, sec: cur }, { x: X(-5.5), z: X(17.5), w: 2.5, d: 2.5, y: HIGH, sec: cur });
      // ── north outer strip (high roof)
      sec(nm[3], X(-12), X(12), X(28), X(38), HIGH);
      P(box(0, X(33), 24, 10, HIGH, { mat: 'roof', wr: false }));
      P(box(X(-5), X(32), 5, 2, HIGH + 1.4, { y0: HIGH, mat: 'metal', wr: false }), slope(X(-5), X(34.75), 5, 3.5, HIGH + 1.4, HIGH, { yaw: Y, y0: HIGH - 0.5, mat: 'metal', wr: false }));
      ax('x', 37.75, -12, 12, HIGH, PO);
      // ── corners (mid roofs): ramps down to the low wing and up to the high wing, a diagonal billboard,
      //    and (by variant) a plank straight across the alley crossing to the core corner
      for (const cs of [1, -1]) { // cs = 1: NE (east side), -1: NW
        const isPlank = cs > 0 ? plankHere : !plankHere;
        sec(nm[cs > 0 ? 4 : 5], X(15 * cs), X(38 * cs), X(15), X(38), MID);
        P(box(X(26.5 * cs), X(26.5), 23, 23, MID, { mat: 'roof', wr: false }));
        P(slope(X(26.5 * cs), X(13.5), 23, 8, LOW, MID, { yaw: Y, y0: LOW - 1, mat: 'plank', wr: false }));
        P(slope(X(13.5 * cs), X(26.5), 23, 8, MID, HIGH, { yaw: -cs * PI / 2 + Y, y0: MID - 1, mat: 'plank', wr: false }));
        P(box(X(29 * cs), X(29), 7, 0.6, MID + 5, { yaw: cs * PI / 4 + Y, y0: MID, mat: 'neon' }));
        if (isPlank) P(box(X(13.5 * cs), X(13.5), 3, 8, MID, { yaw: cs * PI / 4 + Y, y0: MID - 0.4, mat: 'plank', wr: false }));
        RL(mkRail([[X(22 * cs), MID + 0.6, X(30)], [X(30 * cs), MID + 0.6, X(22)]], { kind: 'rail' }));
        ax('x', 37.75, 15 * cs, 38 * cs, MID, PO);
        ax('z', 37.75 * cs, 15, 38, MID, PO);
      }
      cur = null;
    };
    half(1); half(-1);
    // ── the core: solid, never collapses. Parapet ledges with openings at the four bridges and the plank corners
    P(box(0, 0, 24, 24, CORE, { mat: 'roof', wr: false }));
    const pk = planksNE ? 1 : -1; // corner sign: NE/SW planks → (x, z) same sign
    // core cover: two HVAC stacks on the diagonal without planks
    P(box(-8 * pk, 4, 2.5, 2.5, CORE + 1.6, { y0: CORE, mat: 'metal' }), box(8 * pk, -4, 2.5, 2.5, CORE + 1.6, { y0: CORE, mat: 'metal' }));
    // core exhaust: a big vent grate in the middle of the core, blasting on a cycle until the final core (50 s)
    A.core = { x: 0, z: 0, w: 6, d: 6, y: CORE, hz: { kind: 'fire', x: 0, y: CORE, z: 0, w: 6, d: 6, yaw: 0, on: false, warn: 0 } };
    // ── numbered collapse order: corners → outer strips → inner wings (variants rotate the order)
    const order = v < 2 ? ['NE', 'SW', 'NW', 'SE', 'Eo', 'Wo', 'No', 'So', 'Ei', 'Wi', 'Ni', 'Si'] : ['NW', 'SE', 'NE', 'SW', 'No', 'So', 'Eo', 'Wo', 'Ni', 'Si', 'Ei', 'Wi'];
    order.forEach((id, k) => { const c = A.secs.find((q) => q.id === id); c.n = k + 1; c.t = 38 + k * 1.5; });
    A.secs.sort((p, q) => p.n - q.n);
    // ── hazard descriptors (mutated in place every tick)
    A.hz = [A.core.hz];
    for (const f of A.fans) { f.hz = { kind: 'grinder', x: f.x, y: f.y, z: f.z, r: f.r, on: false, warn: 0 }; A.hz.push(f.hz); }
    for (const q of A.vents) { q.hz = { kind: 'fire', x: q.x, y: q.y, z: q.z, w: q.w, d: q.d, yaw: 0, on: false, warn: 0 }; A.hz.push(q.hz); }
    for (const c of A.cats) { c.hz = { kind: 'electric', x: c.x, y: c.y, z: c.z, w: c.w, d: c.d, yaw: 0, on: false, warn: 0 }; A.hz.push(c.hz); }
    for (const c of A.secs) { c.hz = { kind: 'fall', x: (c.x0 + c.x1) / 2, y: c.top, z: (c.z0 + c.z1) / 2, w: c.x1 - c.x0, d: c.z1 - c.z0, yaw: 0, on: false, warn: 0, n: c.n }; A.hz.push(c.hz); }
    // ── spawns: on the perimeter ring (outer strips + corners), billboards and HVAC units between neighbours
    A.spawns.push([33, 10.5], [-33, -10.5], [4, -34], [-4, 34], [29, 29], [-29, -29], [29, -29], [-29, 29]);
    A.pickups = [
      [-4, CORE, 4, 'center'], [4, CORE, -4, 'center'], [0, CAT, 25.5, 'center'], [0, CAT, -25.5, 'center'], [25.5, LOW, 0, 'center'], [-25.5, LOW, 0, 'center'],
      [22, MID, 22, 'std'], [-22, MID, 22, 'std'], [22, MID, -22, 'std'], [-22, MID, -22, 'std'],
      [33, LOW, 0, 'std'], [-33, LOW, 0, 'std'], [0, HIGH, 33, 'std'], [0, HIGH, -33, 'std'],
    ];
    A.zone = [{ t: 0, x: 0, z: 0, r: 56 }, { t: 12, x: 0, z: 0, r: 46 }, { t: 28, x: 0, z: 0, r: 30 }, { t: 40, x: 0, z: 0, r: 18 }, { t: 50, x: 0, z: 0, r: 9 }, { t: 60, x: 0, z: 0, r: 5 }];
    return A;
  },
  update(R) {
    const A = R.W, t = R.t;
    // collapse: 3 s telegraph, then the section (and its rails) is gone
    for (const c of A.secs) {
      const w = t >= c.t ? 0 : clamp((t - (c.t - 3)) / 3, 0, 1), gone = t >= c.t;
      for (const p of c.prims) { p.warn = w; p.gone = gone; }
      if (gone) for (const r of c.rails) r.gone = true;
      c.hz.warn = w; c.hz.on = w > 0 && !gone;
    }
    for (const f of A.fans) { f.hz.warn = clamp((t - 11) / 3, 0, 1); f.hz.on = t >= 14 && t < f.sec.t; if (t >= f.sec.t) f.hz.warn = 0; }
    // steam vents: from 16 s, 4 s cycle — 1 s hiss (warn), then 1.4 s blast; blasts lengthen after 40 s
    for (const q of A.vents) {
      const ph = t >= 16 ? (t - 16) % 4 : -1, len = t >= 40 ? 2 : 1.4, alive = t < q.sec.t;
      q.hz.on = alive && ph >= 4 - len; q.hz.warn = alive && ph >= 3 - len ? 1 : 0;
    }
    { const h = A.core.hz, ph = t >= 14 ? (t - 14) % 3.5 : -1, live = t < 50; h.on = live && ph >= 2; h.warn = live && ph >= 1 ? 1 : 0; }
    // billboard electrics: from 20 s the catwalk ledge is live; the catwalk sparks every 5 s
    for (const r of A.live) r.live = t >= 20 && !r.gone;
    for (const c of A.cats) {
      const ph = t >= 20 ? (t - 20) % 5 : -1, alive = t < c.sec.t;
      c.hz.on = alive && ph >= 3.8; c.hz.warn = alive && ph >= 2.8 ? 1 : 0;
    }
  },
  after(R, dt) {
    const A = R.W;
    for (const s of R.sk) {
      if (!s.alive) continue;
      for (const f of A.fans) {
        if (!f.hz.on || s.y > f.y + 1.2 || s.y < f.y - 0.5) continue;
        const dx = s.x - f.x, dz = s.z - f.z, d = hyp(dx, dz);
        if (d < f.r) hazardHit(R, s, 20, dx / (d || 1) * 9, dz / (d || 1) * 9, 'grinder');
      }
      for (const q of A.vents) {
        if (q.hz.on && s.y < q.y + 2.2 && s.y > q.y - 0.5 && Math.abs(s.x - q.x) < q.w / 2 + 0.3 && Math.abs(s.z - q.z) < q.d / 2 + 0.3) hazardTick(R, s, 30 * dt, 'steam');
      }
      for (const c of A.cats) {
        if (c.hz.on && s.y > c.y - 0.3 && s.y < c.y + 1.5 && Math.abs(s.x - c.x) < c.w / 2 && Math.abs(s.z - c.z) < c.d / 2) hazardHit(R, s, 16, 0, c.kz * 7, 'electric');
      }
      { const c = A.core; if (c.hz.on && s.y < c.y + 2.2 && s.y > c.y - 0.5 && Math.abs(s.x - c.x) < c.w / 2 + 0.3 && Math.abs(s.z - c.z) < c.d / 2 + 0.3) hazardTick(R, s, 26 * dt, 'steam'); }
      if (s.mode === MODE.GRIND && s.rail && s.rail.live) hazardTick(R, s, 35 * dt, 'electric');
    }
  },
};
