// ───────────────────────── 5. BOARDWALK BLOODBATH ─────────────────────────
// Bright seaside pier over open water (no ground: fall in the sea and you're out). Three vertical routes:
//   main deck (y 3)   — the sturdy pier head (24 × 24, never breaks) ringed by eight splinterable deck sections,
//                        a carnival arm to the north and an arcade arm to the south;
//   surf decks (y 1)  — east/west beach landings below the main deck, reached by wide ramps (or a drop / kicker),
//                        with surf-side quarter pipes on their outer edges;
//   upper (y 6)       — two carnival platforms (ramps off the pier head) and two arcade roofs (ramps off the south
//                        ring), linked east and west by roller-coaster grind rails.
// Contest points: pier-head centre, the carnival platform, both surf decks. Low wooden railings (grindable) line
// every sea edge; the only drops are the intentional main → surf steps and hopping a railing.
// Hazards: the carousel (grinder, N arm, 16 s), a runaway bumper tram sweeping the arcade alley (sweep, 14 s),
// sparking arcade neon on the roofs (electric, 18 s, alternating), and the FINALE: from 38 s the pier splinters
// section by section (warn + 'fall' 3 s ahead) — arms + surf decks, then corners, then the ring sides — until only
// the pier head is left.
ARENAS.boardwalk = {
  key: 'boardwalk', name: 'Boardwalk Bloodbath', blurb: 'Sun, surf, arcades — and a long way down.',
  finale: 'The pier splinters section by section until only the pier head stands.', variants: 4,
  look: { sky: '#7FD0F7', horizon: '#FFE9B8', fog: '#F3E2BE', sun: [0.4, 0.85, 0.3], ground: '#C9A877', water: '#1FA3C8', accent: ['#FF5C69', '#36DCE8', '#FFD23F', '#B4E64A'] },
  build(v) {
    const A = mkArena({ half: 40, floor: false, killY: -4 });
    const M = 3, B = 1.5, U = 6, AR = M + 3.2; // main deck, surf deck, carnival platforms, arcade roofs
    A.segs = [];
    let mp = 0, mr = 0;
    const begin = () => { mp = A.prims.length; mr = A.rails.length; };
    const end = (g) => { for (let k = mp; k < A.prims.length; k++) g.prims.push(A.prims[k]); for (let k = mr; k < A.rails.length; k++) g.rails.push(A.rails[k]); };
    const deck = (cx, cz, w, d, top, mat) => { const p = box(cx, cz, w, d, top, { y0: top - 0.8, mat: mat || 'plank', wr: false }); A.prims.push(p); return p; };
    const fence = (x0, z0, x1, z1, y) => {
      const dx = x1 - x0, dz = z1 - z0, l = hyp(dx, dz), yaw = Math.atan2(dx, dz);
      A.prims.push(box((x0 + x1) / 2, (z0 + z1) / 2, 0.3, l, y + 0.8, { yaw, y0: y, mat: 'wood', wr: false }));
      A.rails.push(mkRail([[x0, y + 0.8, z0], [x1, y + 0.8, z1]], { kind: 'rail' }));
    };
    const fallHz = (g, cx, cz, w, d, y) => { const h = { kind: 'fall', x: cx, y, z: cz, w, d, yaw: 0, on: false, warn: 0 }; g.hz.push(h); };
    const mkSeg = (t) => { const g = { t, prims: [], rails: [], hz: [] }; A.segs.push(g); return g; };
    const ordEW = v % 2 === 0; // which ring sides splinter first

    // ── the pier head (sturdy, never breaks)
    deck(0, 0, 24, 24, M);
    // carnival ramps up to the platforms (on the head, platforms belong to the north ring)
    const ph = v === 3 ? U + 0.5 : U;
    A.prims.push(slope(5, 11.5, 4, 7, M, ph, { yaw: 0, mat: 'wood' }), slope(-5, 11.5, 4, 7, M, ph, { yaw: 0, mat: 'wood' }));
    // ticket booths (cover) on the south half
    A.prims.push(box(4, -8, 2.5, 2.5, M + 2.4, { y0: M, mat: 'wood' }), box(-4, -8, 2.5, 2.5, M + 2.4, { y0: M, mat: 'wood' }));
    if (v === 1) A.prims.push(box(7, 3, 1.4, 3, M + 1.3, { y0: M, mat: 'crate' }), box(-7, -3, 1.4, 3, M + 1.3, { y0: M, mat: 'crate' }));
    if (v === 2) kicker(A, 0, -8, 3, 2.5, 0.8, 0, { y0: M - 0.8, h0: M, h1: M + 0.8 });

    // ── wave 1 (gone 41): north carnival arm, south arcade arm, both surf decks
    const w1 = mkSeg(41);
    begin();
    deck(0, 31, 16, 14, M);
    fence(-8, 24, -8, 38, M); fence(8, 24, 8, 38, M);
    qpWithDeck(A, 0, 35.5, 16, 3, 60, 0, 2, { base: M, mat: 'wood', deckMat: 'plank' });
    A.prims.push(box(0, 31, 1.4, 1.4, M + 3, { y0: M, mat: 'metal', wr: false })); // carousel hub
    fallHz(w1, 0, 31, 16, 14, M);
    deck(0, -31, 16, 14, M);
    fence(-8, -24, -8, -38, M); fence(8, -24, 8, -38, M); fence(-8, -38, 8, -38, M);
    const arcL = box(-5.5, -30, 5, 12, AR, { y0: M, mat: 'neon' }), arcR = box(5.5, -30, 5, 12, AR, { y0: M, mat: 'neon' });
    A.prims.push(arcL, arcR);
    const roofRails = [];
    for (const sx of [-1, 1]) for (const ex of [3, 8]) { const r = mkRail([[sx * ex, AR, -24], [sx * ex, AR, -36]], { kind: 'ledge' }); A.rails.push(r); roofRails.push(r); }
    fallHz(w1, 0, -31, 16, 14, M);
    for (const sx of [-1, 1]) {
      deck(sx * 32, 0, 16, 30, B, 'plank');
      A.prims.push(slope(sx * 28, 0, 30, 8, B, M, { yaw: -sx * PI / 2, mat: 'stairs', wr: false })); // the beach steps
      for (const sz of [-1, 1]) { // stair-side railings follow the steps down
        A.prims.push(slope(sx * 28, sz * 15, 0.3, 8, B + 0.8, M + 0.8, { yaw: -sx * PI / 2, y0: B, mat: 'wood', wr: false }));
        A.rails.push(mkRail([[sx * 24, M + 0.8, sz * 15], [sx * 32, B + 0.8, sz * 15]], { kind: 'handrail' }));
        fence(sx * 32, sz * 15, sx * 40, sz * 15, B); fence(sx * 40, sz * 10, sx * 40, sz * 15, B);
      }
      qpWithDeck(A, sx * 37.5, 0, 20, 3, 58, sx * PI / 2, 1.5, { base: B, mat: 'wood', deckMat: 'plank' });
      A.prims.push(box(sx * 33.5, -sx * 9, 1.8, 2.2, B + 2.4, { y0: B, mat: 'wood' })); // lifeguard hut (cover)
      fallHz(w1, sx * 32, 0, 16, 30, B);
    }
    end(w1);
    // the runaway bumper tram (rides the arcade alley; plunges with the arm)
    const tram = box(0, -36.5, 2.6, 2.2, M + 1.4, { y0: M, mat: 'car', wr: false });
    A.prims.push(tram); w1.prims.push(tram);
    A.tram = tram; A.roofs = [arcL, arcR]; A.roofRails = roofRails;

    // ── wave 2 (gone 46): the four corner sections
    const w2 = mkSeg(46);
    begin();
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      deck(sx * 18, sz * 18, 12, 12, M);
      fence(sx * 12, sz * 24, sx * 24, sz * 24, M); fence(sx * 24, sz * 14.6, sx * 24, sz * 24, M);
      A.prims.push(box(sx * 21, sz * 14, 3, 3, M + 2.5, { y0: M, mat: sz > 0 ? 'wood' : 'neon' })); // shack / arcade cabinet bank
      if (v !== 2) kicker(A, sx * 14.5, sz * 21, 2.5, 2.5, 0.9, sz > 0 ? PI : 0, { y0: M - 0.8, h0: M, h1: M + 0.9 });
      fallHz(w2, sx * 18, sz * 18, 12, 12, M);
    }
    end(w2);

    // ── waves 3/4 (gone 51 / 55): ring sides
    const wEW = mkSeg(ordEW ? 51 : 55), wNS = mkSeg(ordEW ? 55 : 51);
    begin();
    for (const sx of [-1, 1]) {
      deck(sx * 18, 0, 12, 24, M);
      if (sx > 0) kicker(A, sx * 20, 0, 3, 3, 1, sx * PI / 2, { y0: M - 0.8, h0: M, h1: M + 1 });
      else halfpipe(A, -18, 0, 0, { base: M }); // the halfpipe on the west ring side (goes when the ring does)
      fallHz(wEW, sx * 18, 0, 12, 24, M);
    }
    // roller-coaster rails: carnival platform → out over the east/west ring → arcade roof
    for (const sx of [-1, 1]) A.rails.push(mkRail([[sx * 8, ph, 22.5], [sx * 15, ph + 1, 15], [sx * 19, ph + 1.6, 0], [sx * 15, AR + 1, -15], [sx * 8, AR, -24.5]], { kind: 'rail' }));
    end(wEW);
    begin();
    for (const sz of [-1, 1]) {
      deck(0, sz * 18, 24, 12, M);
      fence(-12, sz * 24, -8, sz * 24, M); fence(8, sz * 24, 12, sz * 24, M);
      fallHz(wNS, 0, sz * 18, 24, 12, M);
    }
    // carnival platforms (upper level) + their ledges
    for (const sx of [-1, 1]) {
      A.prims.push(box(sx * 5, 19, 6, 8, ph, { y0: ph - 0.6, mat: 'wood', wr: false }));
      A.rails.push(mkRail([[sx * 8, ph, 15], [sx * 8, ph, 23]], { kind: 'ledge' }));
    }
    // arcade roof ramps off the south ring
    A.prims.push(slope(5.5, -20, 5, 8, M, AR, { yaw: PI, mat: 'wood', wr: false }), slope(-5.5, -20, 5, 8, M, AR, { yaw: PI, mat: 'wood', wr: false }));
    end(wNS);

    // ── hazard descriptors
    A.hz = [
      { kind: 'grinder', x: 0, y: M, z: 31, r: 3.2, on: false, warn: 0 },
      { kind: 'sweep', x: tram.cx, y: M, z: tram.cz, w: 2.6, d: 2.2, yaw: 0, on: false, warn: 0 },
      { kind: 'electric', x: -5.5, y: AR, z: -30, w: 5, d: 12, yaw: 0, on: false, warn: 0 },
      { kind: 'electric', x: 5.5, y: AR, z: -30, w: 5, d: 12, yaw: 0, on: false, warn: 0 },
    ];
    for (const g of A.segs) for (const h of g.hz) A.hz.push(h);
    A.M = M; A.AR = AR;

    // ── spawns (≥ 14 m apart, cover between)
    A.spawns.push([34, 6], [-34, -6], [19, 19], [-19, 19], [19, -19], [-19, -19], [0, 26], [0, -20]);
    A.pickups = [
      [0, M, 0, 'center'], [5, ph, 19, 'center'], [34, B, 2, 'center'], [-34, B, -2, 'center'],
      [-5, ph, 19, 'std'], [0, M, -9, 'std'], [17, M, 17, 'std'], [-17, M, 17, 'std'], [17, M, -17, 'std'], [-17, M, -17, 'std'],
      [5, M, 27, 'std'], [-5, M, 27, 'std'], [34, B, -12, 'std'], [-34, B, 12, 'std'], [20, M, -6, 'std'], [-18, M, 0, 'std'],
    ];
    A.zone = [{ t: 0, x: 0, z: 0, r: 62 }, { t: 12, x: 0, z: 0, r: 48 }, { t: 28, x: 0, z: 0, r: 30 }, { t: 40, x: 0, z: 0, r: 18 }, { t: 50, x: 0, z: 0, r: 9 }, { t: 60, x: 0, z: 0, r: 5 }];
    return A;
  },
  update(R, dt) {
    const A = R.W, t = R.t;
    // splintering pier: 3 s telegraph, then the section (and its rails) drops into the sea
    for (const g of A.segs) {
      const warn = clamp((t - (g.t - 3)) / 3, 0, 1), gone = t >= g.t;
      for (const p of g.prims) { p.warn = gone ? 0 : warn; if (gone) p.gone = true; }
      for (const r of g.rails) if (gone) r.gone = true;
      for (const h of g.hz) { h.warn = gone ? 0 : warn; h.on = warn > 0 && !gone; }
    }
    // carousel
    const gr = A.hz[0]; gr.on = t >= 16 && t < 41; gr.warn = t < 41 ? clamp((t - 13) / 3, 0, 1) : 0;
    // runaway tram: parked at the end of the alley, then sweeps it 14 → 41 s
    const tr = A.tram, hz = A.hz[1];
    let z = -36.5;
    if (t >= 14) { const L = 21, p = ((t - 14) * (t < 28 ? 6.5 : 8.5)) % (2 * L); z = p < L ? -36.5 + p : -36.5 + 2 * L - p; }
    tr.vz = tr.gone ? 0 : (z - tr.cz) / dt; tr.cz = z;
    hz.z = z; hz.on = t >= 14 && !tr.gone; hz.warn = tr.gone ? 0 : clamp((t - 11) / 3, 0, 1);
    if (t < 38) tr.warn = hz.warn < 1 ? hz.warn : 0;
    // sparking neon: the arcade roofs take turns (1.5 s crackle, then 3 s live), every 8 s from 18 s
    for (let k = 0; k < 2; k++) {
      const h = A.hz[2 + k], u = t - 18 - k * 4, ph = u >= 0 ? u % 8 : -1, alive = !A.roofs[k].gone;
      h.warn = alive && ph >= 0 && ph < 1.5 ? ph / 1.5 : 0;
      h.on = alive && ph >= 1.5 && ph < 4.5;
      A.roofRails[k * 2].live = h.on; A.roofRails[k * 2 + 1].live = h.on;
    }
  },
  after(R) {
    const A = R.W, t = R.t, M = A.M, AR = A.AR, tr = A.tram;
    const late = t >= 30;
    for (const s of R.sk) {
      if (!s.alive) continue;
      // carousel arms
      const gr = A.hz[0];
      if (gr.on && Math.abs(s.y - M) < 1.3) { const dx = s.x - gr.x, dz = s.z - gr.z, d = hyp(dx, dz); if (d < gr.r) hazardHit(R, s, late ? 26 : 18, dx / (d || 1) * 8, dz / (d || 1) * 8, 'grinder'); }
      // tram
      if (A.hz[1].on && Math.abs(s.x - tr.cx) < 1.9 && Math.abs(s.z - tr.cz) < 1.7 && s.y < M + 1.3 && s.y > M - 0.6) {
        const dir = tr.vz > 0 ? 1 : -1;
        hazardHit(R, s, late ? 26 : 18, (s.x >= tr.cx ? 1 : -1) * 4, dir * 10, 'sweep');
      }
      // neon roofs (standing on them or grinding their edges)
      for (let k = 0; k < 2; k++) {
        const h = A.hz[2 + k]; if (!h.on) continue;
        if (Math.abs(s.x - h.x) < h.w / 2 + 0.3 && Math.abs(s.z - h.z) < h.d / 2 + 0.3 && Math.abs(s.y - AR) < 0.6) hazardTick(R, s, (late ? 34 : 22) * DT, 'electric');
      }
    }
  },
};
