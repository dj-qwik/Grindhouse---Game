// ───────────────────────── 6. NEON OVERPASS ─────────────────────────
// Elevated highway interchange at night. Three vertical routes: the street (y 0, rideable under both decks),
// the toll shoulders east and west (y 2.5, reached by banks), and the two highway decks (y 5.5, north and south)
// reached by four on-ramps that drop into the interchange plaza plus a shoulder → deck transfer on each side.
// A maintenance catwalk (with grind rails) spans the plaza between the decks.
// Contest points: the interchange plaza (final core), the intact deck centre, under the decks, both shoulders.
// Hazards: burning wrecks (fire, 14 s+) and sparking downed power lines (electric pulses, 20 s+) in the back
// streets behind the decks; a deck span collapses at 30 s (telegraphed 25–30 s); FINALE: traffic sweeper
// barriers sweep the street lanes and both decks toward the interchange centre (40–52 s).
ARENAS.overpass = {
  key: 'overpass', name: 'Neon Overpass', blurb: 'Highway interchange, painted ramps and burning wrecks.',
  finale: 'Traffic sweeper barriers drive everyone into the interchange.', variants: 4,
  look: { sky: '#120B2E', horizon: '#3B1C5A', fog: '#2A1840', sun: [-0.4, 0.75, 0.5], ground: '#3A3A44', accent: ['#FF2E88', '#2EF2FF', '#FFD23F', '#9B5CFF'] },
  build(v) {
    const A = mkArena({ half: 40 });
    perimeter(A, 40, 7, 'wall');
    const DK = 5.5, DY0 = 4.5, MID = 2.5;
    const gapN = v < 2;                       // which deck loses its centre span at 30 s
    const cw = v % 2 === 0 ? 12 : -12;        // catwalk side
    const decks = [24, -24];
    A.deckZ = decks;
    // ── highway decks: three spans each (the centre span of one deck collapses), pillars underneath
    A.gapPrims = [];
    for (const dz of decks) {
      const isGap = (dz > 0) === gapN;
      const w = box(-18, dz, 24, 10, DK, { y0: DY0, mat: 'asphalt', wr: false });
      const m = box(0, dz, 12, 10, DK, { y0: DY0, mat: 'asphalt', wr: false });
      const e = box(18, dz, 24, 10, DK, { y0: DY0, mat: 'asphalt', wr: false });
      A.prims.push(w, m, e);
      for (const px of [-24, -12, 12, 24]) A.prims.push(box(px, dz, 1.2, 1.2, DY0, { mat: 'concrete', wr: false }));
      // deck edge ledges (concrete parapets as grind ledges)
      const ez = dz + (dz > 0 ? 5 : -5);
      A.rails.push(mkRail([[-29, DK, ez], [29, DK, ez]], { kind: 'ledge' }));
      // neon billboards on the outer edge
      for (const bx of [-20, 20]) A.prims.push(box(bx, ez + (dz > 0 ? 0.3 : -0.3), 8, 0.6, DK + 4, { y0: DK, mat: 'neon', wr: false }));
      // jackknifed truck mid-deck (cover between deck spawns)
      const truck = box(-3, dz, 3, 6, DK + 2.6, { y0: DK, yaw: 0.35, mat: 'car' });
      A.prims.push(truck);
      if (isGap) { A.gapPrims.push(m, truck); A.gapZ = dz; }
    }
    // ── on-ramps: from the inner deck edge down into the plaza (painted ramps)
    A.prims.push(slope(-16, 13, 6, 12, 0, DK, { yaw: 0, mat: 'asphalt', wr: false }), slope(16, 13, 6, 12, 0, DK, { yaw: 0, mat: 'asphalt', wr: false }));
    A.prims.push(slope(-16, -13, 6, 12, 0, DK, { yaw: PI, mat: 'asphalt', wr: false }), slope(16, -13, 6, 12, 0, DK, { yaw: PI, mat: 'asphalt', wr: false }));
    // ── toll shoulders east/west (mid level), banks up from the plaza, transfer slope up to a deck
    A.prims.push(box(31.5, 0, 11, 20, MID, { mat: 'concrete' }), box(-31.5, 0, 11, 20, MID, { mat: 'concrete' }));
    A.prims.push(slope(23, 0, 20, 6, 0, MID, { yaw: PI / 2, mat: 'concrete', wr: false }), slope(-23, 0, 20, 6, 0, MID, { yaw: -PI / 2, mat: 'concrete', wr: false }));
    A.prims.push(slope(28, 14.5, 4, 9, MID, DK, { yaw: 0, mat: 'asphalt', wr: false }), slope(-28, -14.5, 4, 9, MID, DK, { yaw: PI, mat: 'asphalt', wr: false }));
    A.rails.push(mkRail([[26.2, MID + 0.5, -8], [26.2, MID + 0.5, 8]], { kind: 'rail' }), mkRail([[-26.2, MID + 0.5, 8], [-26.2, MID + 0.5, -8]], { kind: 'rail' }));
    // shoulder wrecks (cover from the plaza)
    A.prims.push(box(29, -3, 2, 4.4, MID + 1.5, { y0: MID, mat: 'car' }), box(-29, 3, 2, 4.4, MID + 1.5, { y0: MID, mat: 'car' }));
    // ── maintenance catwalk between the decks (rails both sides)
    A.prims.push(box(cw, 0, 1.6, 38, DK, { y0: DK - 0.4, mat: 'metal', wr: false }));
    A.rails.push(mkRail([[cw - 0.8, DK + 0.9, -19], [cw - 0.8, DK + 0.9, 19]], { kind: 'rail' }), mkRail([[cw + 0.8, DK + 0.9, -19], [cw + 0.8, DK + 0.9, 19]], { kind: 'rail' }));
    // ── interchange plaza: overturned cars (cover + kickers), buses, jersey barriers
    for (const sg of [1, -1]) {
      A.prims.push(box(-9 * sg, 3 * sg, 4.4, 2, 1.5, { mat: 'car' }));
      A.prims.push(slope(-9 * sg, 5.5 * sg, 4, 3, 1.2, 0, { yaw: sg > 0 ? 0 : PI, mat: 'car', wr: false }));
      const bx = v === 2 ? 3 : 4.5;
      A.prims.push(box(-bx * sg, 13 * sg, 3, 9, 3, { mat: 'car' }));
      A.prims.push(box(14 * sg, 3 * sg, 0.6, 6, 0.85, { mat: 'concrete', wr: false }));
      A.rails.push(mkRail([[14 * sg, 0.85, 3 * sg - 3], [14 * sg, 0.85, 3 * sg + 3]], { kind: 'ledge' }));
    }
    if (v === 3) { kicker(A, 0, 9, 3, 3, 1.1, PI); kicker(A, 0, -9, 3, 3, 1.1, 0); }
    // neon posts in the back streets
    for (const [px, pz] of [[-34, 34], [34, -34], [34, 34], [-34, -34]]) A.prims.push(box(px, pz, 1, 1, 8, { mat: 'neon', wr: false }));
    // ── back-street hazards: burning wrecks and downed power lines
    A.fires = [{ x: -18, z: 34 }, { x: 18, z: -34 }];
    for (const f of A.fires) A.prims.push(box(f.x, f.z, 4.4, 2, 1.5, { yaw: 0.2, mat: 'car' }));
    A.lines = [{ x0: 6, x1: 22, z: 34 }, { x0: -22, x1: -6, z: -34 }];
    A.lineRails = A.lines.map((l) => mkRail([[l.x0, 0.35, l.z], [l.x1, 0.35, l.z]], { kind: 'rail', live: false }));
    A.rails.push(...A.lineRails);
    // ── traffic sweepers: street (span every lane, slide under the decks) and deck sweepers
    A.sweep = [
      { p: box(38.5, 0, 1.2, 78, 0, { y0: -4, mat: 'gate', wr: false }), x0: 38.5, x1: 14, y: 0, h: 4, sg: 1, z: 0, d: 78 },
      { p: box(-38.5, 0, 1.2, 78, 0, { y0: -4, mat: 'gate', wr: false }), x0: -38.5, x1: -14, y: 0, h: 4, sg: -1, z: 0, d: 78 },
    ];
    for (const dz of decks) for (const sg of [1, -1]) A.sweep.push({ p: box(29 * sg, dz, 1.2, 10, DK, { y0: DK, mat: 'gate', wr: false }), x0: 29 * sg, x1: 7 * sg, y: DK, h: 2, sg, z: dz, d: 10 });
    for (const s of A.sweep) A.prims.push(s.p);
    // ── renderer hazard descriptors
    A.hz = [];
    for (const f of A.fires) { f.hz = { kind: 'fire', x: f.x, y: 0, z: f.z, w: 7, d: 5, yaw: 0.2, on: false, warn: 0 }; A.hz.push(f.hz); }
    A.lines.forEach((l, k) => { l.hz = { kind: 'electric', x: (l.x0 + l.x1) / 2, y: 0, z: l.z, w: l.x1 - l.x0, d: 1.6, yaw: 0, on: false, warn: 0, rail: A.lineRails[k] }; A.hz.push(l.hz); });
    A.gapHz = { kind: 'fall', x: 0, y: DK, z: A.gapZ, w: 12, d: 10, yaw: 0, on: false, warn: 0 }; A.hz.push(A.gapHz);
    for (const s of A.sweep) { s.hz = { kind: 'sweep', prim: s.p, x: s.p.cx, y: s.y, z: s.z, w: 1.2, d: s.d, yaw: 0, on: false, warn: 0 }; A.hz.push(s.hz); }
    // ── spawns: four on the decks, one per shoulder, two in the plaza (cover between all neighbours)
    for (const [x, z] of [[-18, 24], [18, 24], [-18, -24], [18, -24], [32, 0], [-32, 0], [-12, 10], [12, -10]]) A.spawns.push([x, z, Math.atan2(-x, -z)]);
    const dA = gapN ? -24 : 24, dB = -dA;
    A.pickups = [
      [0, 0, 7, 'center'], [0, 0, -7, 'center'], [-8, 0, -2, 'center'], [8, 0, 2, 'center'], [5, DK, dA, 'center'], [10, DK, dB, 'center'],
      [33, MID, 6, 'std'], [-33, MID, -6, 'std'], [0, 0, 34, 'std'], [0, 0, -34, 'std'], [-6, 0, 24, 'std'], [6, 0, -24, 'std'],
      [-26, DK, 24, 'std'], [26, DK, -24, 'std'], [-24, 0, -15, 'std'], [24, 0, 15, 'std'],
    ];
    A.zone = [{ t: 0, x: 0, z: 0, r: 62 }, { t: 12, x: 0, z: 0, r: 48 }, { t: 28, x: 0, z: 0, r: 30 }, { t: 40, x: 0, z: 0, r: 18 }, { t: 50, x: 0, z: 0, r: 9 }, { t: 60, x: 0, z: 0, r: 5 }];
    return A;
  },
  update(R, dt) {
    const A = R.W, t = R.t;
    for (const f of A.fires) { f.hz.on = t >= 14; f.hz.warn = clamp((t - 10) / 4, 0, 1); }
    // power lines pulse: 2.2 s live in every 4 s from 20 s (always live from 48 s), 0.8 s warning sparks
    const ph = t >= 20 ? (t - 20) % 4 : -1;
    const live = t >= 48 || (ph >= 0 && ph < 2.2);
    for (let k = 0; k < A.lines.length; k++) {
      const h = A.lines[k].hz;
      h.on = live; h.warn = live ? 1 : t >= 17 && t < 20 ? (t - 17) / 3 : ph >= 3.2 ? (ph - 3.2) / 0.8 : 0;
      A.lineRails[k].live = live;
    }
    // deck span collapse: warn 25–30 s, gone at 30 s
    const gw = clamp((t - 25) / 5, 0, 1);
    for (const p of A.gapPrims) { p.warn = t < 30 ? gw : 0; if (t >= 30 && !p.gone) p.gone = true; }
    A.gapHz.warn = t < 30 ? gw : 0; A.gapHz.on = t >= 30;
    // sweepers: rise 37–40 s (telegraphed 34–40), then sweep 40 → 52 s inward
    const up = clamp((t - 37) / 3, 0, 1), u = clamp((t - 40) / 12, 0, 1);
    for (const s of A.sweep) {
      const g = s.p, tx = s.x0 + (s.x1 - s.x0) * u;
      g.warn = t >= 34 && t < 40 ? 1 : 0;
      if (s.y > 0) { g.y0 = s.y; g.top = s.y + s.h * up; } // deck sweepers rise out of the deck
      else { g.top = s.h * up; g.y0 = g.top - s.h; }      // street sweepers rise out of the road
      g.vx = (tx - g.cx) / dt; g.cx = tx;
      s.hz.x = g.cx; s.hz.on = t >= 40 && u < 1; s.hz.warn = g.warn;
    }
  },
  after(R) {
    const A = R.W, t = R.t;
    const late = t >= 40;
    for (const s of R.sk) {
      if (!s.alive) continue;
      // burning wrecks
      if (t >= 14 && s.y < 2) for (const f of A.fires) if (Math.abs(s.x - f.x) < 3.5 && Math.abs(s.z - f.z) < 2.5) hazardTick(R, s, (late ? 18 : 10) * DT, 'fire');
      // downed power lines (and grinding the live cable)
      for (let k = 0; k < A.lines.length; k++) {
        const l = A.lines[k];
        if (!l.hz.on) continue;
        if ((s.y < 1.2 && s.x > l.x0 - 0.5 && s.x < l.x1 + 0.5 && Math.abs(s.z - l.z) < 0.8) || s.rail === A.lineRails[k]) hazardHit(R, s, late ? 24 : 15, 0, (s.z > l.z ? 1 : -1) * 8, 'electric');
      }
      // deck collapse: anyone on the span when it drops takes a hit
      if (t >= 30 && t < 30 + DT * 1.5 && s.y > 4.8 && Math.abs(s.x) < 6 && Math.abs(s.z - A.gapZ) < 5) hazardHit(R, s, 15, 0, 0, 'fall');
      // traffic sweepers: contact hurts and shoves inward
      if (t >= 40 && t < 52.5) for (const sw of A.sweep) {
        const g = sw.p;
        if (Math.abs(s.x - g.cx) < 1.4 && Math.abs(s.z - sw.z) < sw.d / 2 && s.y >= g.y0 - 1 && s.y < g.top) hazardHit(R, s, 18, -sw.sg * 10, 0, 'gate');
      }
    }
  },
};
