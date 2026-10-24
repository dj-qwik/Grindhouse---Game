// ───────────────────────── 3. MALL MASSACRE ─────────────────────────
// Abandoned open-air shopping centre. Three vertical routes: the ground concourse (y 0, with the fountain bowl in
// the middle), the east/west food-court terraces (y 2.2, ramps + end ramps) and the north/south upper walkways
// (y 4, reached by four escalators; you can roll underneath them, railings are grind rails).
// Contest points: the fountain bowl (centre), both walkway midpoints, both terraces. Kiosks + walkway pillars break
// sight lines. Hazards: sparking escalators (electric, from 16 s), broken fountain jets (from 14 s), a runaway
// floor sweeper lapping the inner concourse (from 18 s). FINALE: security shutters rise (37–40 s) and roll in from
// the storefronts (40 → 52 s), closing the outer concourse and the terraces and shoving riders inward.
ARENAS.mall = {
  key: 'mall', name: 'Mall Massacre', blurb: 'Dead shopping centre: escalators, a fountain bowl and a runaway sweeper.',
  finale: 'Security shutters roll in from the storefronts and close the outer concourse.', variants: 4,
  look: { sky: '#F2B07E', horizon: '#F8DCAE', fog: '#E9C9A2', sun: [-0.45, 0.75, 0.5], ground: '#C7BBA9', water: '#4FB6CB', accent: ['#FF4FA0', '#36DCE8', '#FFD23F', '#9D75EA'] },
  build(v) {
    const A = mkArena({ half: 40 });
    perimeter(A, 40, 6, 'brick');
    const WK = 4, TER = 2.2, fl = v === 1 || v === 3 ? -1 : 1; // fl mirrors the escalator layout
    // ── upper walkways (north/south), roll underneath; pillars; railings to grind
    for (const sg of [1, -1]) {
      A.prims.push(box(0, sg * 29, 48, 8, WK, { y0: WK - 0.6, mat: 'tile', wr: false }));
      for (const px of [-18, -6, 6, 18]) for (const pz of [26, 32]) A.prims.push(box(px, sg * pz, 0.8, 0.8, WK - 0.6, { mat: 'concrete', wr: false }));
      A.rails.push(mkRail([[-12, WK + 0.9, sg * 25.3], [12, WK + 0.9, sg * 25.3]], { kind: 'rail' }));
      A.rails.push(mkRail([[-20, WK + 0.9, sg * 32.7], [20, WK + 0.9, sg * 32.7]], { kind: 'rail' }));
    }
    // ── escalators (metal slopes 0 → 4 m): one inner per walkway, one at a walkway end
    A.escal = [
      slope(16 * fl, 22, 4, 6, 0, WK, { yaw: 0, mat: 'metal', wr: false }),
      slope(-16 * fl, -22, 4, 6, 0, WK, { yaw: PI, mat: 'metal', wr: false }),
      slope(28 * fl, 29, 4, 8, 0, WK, { yaw: -PI / 2 * fl, mat: 'metal', wr: false }),
      slope(-28 * fl, -29, 4, 8, 0, WK, { yaw: PI / 2 * fl, mat: 'metal', wr: false }),
    ];
    A.prims.push(...A.escal);
    // ── food-court terraces (east/west), front ramp + end ramps down to the north/south concourse
    for (const sg of [1, -1]) {
      A.prims.push(box(sg * 30, 0, 12, 24, TER, { mat: 'tile' }));
      A.prims.push(slope(sg * 22, 0, 6, 4, 0, TER, { yaw: sg * PI / 2, mat: 'concrete', wr: false }));
      A.prims.push(slope(sg * 30, 14, 6, 4, TER, 0, { yaw: 0, mat: 'concrete', wr: false }), slope(sg * 30, -14, 6, 4, 0, TER, { yaw: 0, mat: 'concrete', wr: false }));
      A.prims.push(box(sg * 30, 0, 3, 3, TER + 2.6, { y0: TER, mat: 'neon' })); // food kiosk (cover between terrace spawns)
      A.rails.push(mkRail([[sg * 25, TER, -11], [sg * 25, TER, -4]], { kind: 'ledge' }), mkRail([[sg * 25, TER, 4], [sg * 25, TER, 11]], { kind: 'ledge' }));
    }
    // ── fountain bowl: four inward-facing quarter pipes, decks, and outer ramps to drop in; open diagonal mouths
    for (let k = 0; k < 4; k++) {
      const yaw = k * PI / 2, [qx, qz] = offs(0, 0, yaw, 0, 8), [dx, dz] = offs(0, 0, yaw, 0, 10.5), [rx, rz] = offs(0, 0, yaw, 0, 13);
      const q = qp(qx, qz, 10, 3, 60, { yaw, mat: 'tile' });
      A.prims.push(q, box(dx, dz, 10, 2, q.lipH, { yaw, mat: 'tile', wr: false }), slope(rx, rz, 10, 3, q.lipH, 0, { yaw, mat: 'tile', wr: false }));
      const [l0x, l0z] = offs(0, 0, yaw, -5, 9.55), [l1x, l1z] = offs(0, 0, yaw, 5, 9.55);
      A.rails.push(mkRail([[l0x, q.lipH, l0z], [l1x, q.lipH, l1z]], { kind: 'coping' }));
    }
    // ── kiosks / planters (cover)
    const kx = v === 3 ? 14 : 15;
    for (const [sx, sz] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) A.prims.push(box(sx * kx, sz * kx, 3.5, 3.5, 2.8, { yaw: v === 3 ? PI / 4 : 0, mat: 'neon' }));
    A.prims.push(box(0, 20, 3, 2, 2.6, { mat: 'crate' }), box(0, -20, 3, 2, 2.6, { mat: 'crate' }));
    A.prims.push(box(-32, 20, 5, 2, 1.0, { mat: 'grass', wr: false }), box(32, -20, 5, 2, 1.0, { mat: 'grass', wr: false }));
    if (v === 2) { kicker(A, -30, 30, 3, 3, 1.1, 0); kicker(A, 30, -30, 3, 3, 1.1, PI); }
    // ── runaway floor sweeper (parked until 18 s), laps the inner concourse
    A.sweeper = box(-18.5, 17.5, 2.4, 1.6, 1.3, { yaw: PI / 2, mat: 'metal', wr: false });
    A.sweepDir = v === 2 || v === 3 ? -1 : 1; A.sweepP = 0;
    A.prims.push(A.sweeper);
    // ── security shutters wait below the floor in front of the storefronts
    A.shut = [
      box(0, 39.4, 80, 1.2, 0, { y0: -3.4, mat: 'gate', wr: false }), box(0, -39.4, 80, 1.2, 0, { y0: -3.4, mat: 'gate', wr: false }),
      box(39.4, 0, 1.2, 80, 0, { y0: -3.4, mat: 'gate', wr: false }), box(-39.4, 0, 1.2, 80, 0, { y0: -3.4, mat: 'gate', wr: false }),
    ];
    A.prims.push(...A.shut);
    A.jets = [[3.5, 3.5], [-3.5, -3.5], [-3.5, 3.5], [3.5, -3.5]];
    A.hz = [{ kind: 'water', x: 0, y: 0.02, z: 0, w: 5, d: 5, yaw: 0, on: true, warn: 0 }];
    for (const [jx, jz] of A.jets) A.hz.push({ kind: 'pulse', x: jx, y: 0, z: jz, r: 1.4, on: false, warn: 0 });
    for (const e of A.escal) A.hz.push({ kind: 'electric', x: e.cx, y: WK / 2, z: e.cz, w: e.w, d: e.d, yaw: e.yaw, on: false, warn: 0 });
    A.hz.push({ kind: 'sweep', x: A.sweeper.cx, y: 0, z: A.sweeper.cz, on: false, warn: 0 });
    // ── spawns: two in front of each walkway (kiosk between), two on each terrace (food kiosk between)
    A.spawns.push([8, 20], [-8, 20], [8, -20], [-8, -20], [30, 7.5], [30, -7.5], [-30, 7.5], [-30, -7.5]);
    A.pickups = [
      [0, 0, 4.6, 'center'], [0, 0, -4.6, 'center'], [0, WK, 29, 'center'], [0, WK, -29, 'center'], [33, TER, 0, 'center'], [-33, TER, 0, 'center'],
      [16, 0, 0, 'std'], [-16, 0, 0, 'std'], [12, 0, 29, 'std'], [-12, 0, -29, 'std'],
      [32, 0, 23, 'std'], [-32, 0, -23, 'std'], [-35, 0, 35, 'std'], [35, 0, -35, 'std'],
    ];
    A.zone = [{ t: 0, x: 0, z: 0, r: 62 }, { t: 12, x: 0, z: 0, r: 48 }, { t: 28, x: 0, z: 0, r: 30 }, { t: 40, x: 0, z: 0, r: 18 }, { t: 50, x: 0, z: 0, r: 9 }, { t: 60, x: 0, z: 0, r: 5 }];
    // the halfpipe: ~4 m vert walls either side of a flat bottom, roll in from the open ends
    { const n0 = A.prims.length, r0 = A.rails.length; halfpipe(A, 7, 36, PI / 2, { w: 6.2 }); A.hpPrims = A.prims.slice(n0); A.hpRails = A.rails.slice(r0); }
    return A;
  },
  update(R, dt) {
    if (R.t >= 36 && R.W.hpPrims && !R.W.hpPrims[0].gone) { for (const p of R.W.hpPrims) p.gone = true; for (const r of R.W.hpRails) r.gone = true; for (const p of R.W.prims) if (p.turn && Math.max(Math.abs(p.cx), Math.abs(p.cz)) > 20) p.gone = true; } // security folds the halfpipe (and the outer turnaround ramps) away before the shutters roll
    const A = R.W, t = R.t;
    // fountain jets: alternate diagonal pairs; warn, then erupt
    const jp = t < 40 ? 5 : 3.5, jw = t < 40 ? 1.5 : 1, jt = t - 14, ph = jt - Math.floor(jt / jp) * jp, pair = Math.floor(jt / jp) % 2;
    for (let k = 0; k < 4; k++) {
      const h = A.hz[1 + k], mine = jt >= 0 && (k >> 1) === pair;
      h.warn = mine && ph < jw ? 1 : 0; h.on = mine && ph >= jw && ph < jw + 1;
    }
    // escalators: one (later two) sparks at a time, telegraphed for 2 s
    const ep = t < 40 ? 8 : 6, et = t - 16, eph = et - Math.floor(et / ep) * ep, ecyc = Math.floor(et / ep);
    for (let k = 0; k < 4; k++) {
      const h = A.hz[5 + k], mine = et >= 0 && (k === ecyc % 4 || (t >= 40 && k === (ecyc + 2) % 4));
      h.warn = mine && eph < 2 ? 1 : 0; h.on = mine && eph >= 2 && eph < 6;
      A.escal[k].warn = h.warn;
    }
    // runaway sweeper: laps the rectangle |x| 18.5, |z| 17.5 from 18 s, speeding up
    const sw = A.sweeper, hs = A.hz[9], X = 18.5, Z = 17.5, L = 4 * (X + Z);
    sw.warn = t >= 15 && t < 18 ? 1 : 0; hs.warn = sw.warn; hs.on = t >= 18;
    if (t >= 18) {
      const sp = 5 + clamp((t - 18) / 22, 0, 1) * 3.5;
      A.sweepP += sp * dt;
      let p = A.sweepDir > 0 ? A.sweepP : -A.sweepP; p = p - Math.floor(p / L) * L;
      let x, z, yaw;
      if (p < 2 * X) { x = -X + p; z = Z; yaw = PI / 2; }
      else if (p < 2 * X + 2 * Z) { x = X; z = Z - (p - 2 * X); yaw = PI; }
      else if (p < 4 * X + 2 * Z) { x = X - (p - 2 * X - 2 * Z); z = -Z; yaw = -PI / 2; }
      else { x = -X; z = -Z + (p - 4 * X - 2 * Z); yaw = 0; }
      if (A.sweepDir < 0) yaw += PI;
      sw.vx = (x - sw.cx) / dt; sw.vz = (z - sw.cz) / dt; sw.cx = x; sw.cz = z; sw.yaw = yaw; primPose(sw);
      hs.x = x; hs.z = z;
    }
    // security shutters: rise 37–40 s (telegraphed from 34 s), roll in 40 → 52 s from the storefronts to ±21
    const up = clamp((t - 37) / 3, 0, 1), u = clamp((t - 40) / 12, 0, 1), T = 39.4 - u * 18.4;
    for (let k = 0; k < 4; k++) {
      const g = A.shut[k], sg = k % 2 === 0 ? 1 : -1;
      g.warn = t >= 34 && t < 40 ? 1 : 0; g.top = 3.4 * up; g.y0 = g.top - 3.4;
      if (k < 2) { g.vz = (sg * T - g.cz) / dt; g.cz = sg * T; g.w = 2 * T + 1.2; }
      else { g.vx = (sg * T - g.cx) / dt; g.cx = sg * T; g.d = 2 * T + 1.2; }
      primPose(g);
    }
  },
  after(R, dt) {
    const A = R.W, t = R.t, late = t >= 45;
    for (const s of R.sk) {
      if (!s.alive) continue;
      // fountain water drags
      if (s.mode === MODE.GROUND && s.y < 0.2 && Math.abs(s.x) < 2.5 && Math.abs(s.z) < 2.5) { s.vx *= 0.985; s.vz *= 0.985; }
      // jets
      for (let k = 0; k < 4; k++) {
        if (!A.hz[1 + k].on || s.y > 2.5) continue;
        const dx = s.x - A.jets[k][0], dz = s.z - A.jets[k][1], d = hyp(dx, dz);
        if (d < 1.4) hazardHit(R, s, t < 40 ? 12 : 24, dx / (d || 1) * 9, dz / (d || 1) * 9, 'jet');
      }
      // sparking escalators: anyone riding on a live one
      if (s.mode === MODE.GROUND || s.mode === MODE.DOWN) for (let k = 0; k < 4; k++) {
        if (!A.hz[5 + k].on) continue;
        const e = A.escal[k];
        toLocal(e, s.x, s.z);
        if (inFoot(e) && Math.abs(s.y - surfL(e, LZ)) < 0.4 && s.y > 0.15) hazardTick(R, s, (late ? 45 : 26) * dt, 'electric');
      }
      // sweeper contact
      const sw = A.sweeper;
      if (t >= 18 && s.y < 1.5) {
        toLocal(sw, s.x, s.z);
        if (Math.abs(LX) < sw.w / 2 + SK_R + 0.15 && Math.abs(LZ) < sw.d / 2 + SK_R + 0.15) {
          const fx = Math.sin(sw.yaw), fz = Math.cos(sw.yaw), side = LX >= 0 ? 1 : -1;
          hazardHit(R, s, late ? 30 : 18, fx * 7 + sw.c * side * 6, fz * 7 - sw.s * side * 6, 'sweeper');
        }
      }
      // shutters: contact while rolling hurts and shoves you inward
      if (t >= 40) for (let k = 0; k < 4; k++) {
        const g = A.shut[k], sg = k % 2 === 0 ? 1 : -1;
        if (g.top < 1 || s.y > g.top) continue;
        const along = k < 2 ? s.z - g.cz : s.x - g.cx, across = k < 2 ? s.x : s.z;
        if (Math.abs(along) < 1.3 && Math.abs(across) < (k < 2 ? g.w : g.d) / 2) hazardHit(R, s, 16, k < 2 ? 0 : -sg * 10, k < 2 ? -sg * 10 : 0, 'gate');
      }
    }
  },
};
