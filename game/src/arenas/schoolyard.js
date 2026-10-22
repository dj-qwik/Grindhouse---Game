// ───────────────────────── 8. SCHOOLYARD SHUTDOWN ─────────────────────────
// Oversized urban school courtyard ringed by brick buildings. Three vertical routes: the asphalt yard (y 0) with
// the basketball court at its heart, the west quad terrace (y 2.5, stair sets with handrails + a wheelchair ramp),
// and the gym annex roof in the NE corner (y 5, long access ramp + a stair set down). Contest points: the court,
// the terrace planters, the gym roof and the south bench plaza (+ the east lane). Hazards: a dumpster fire (SE),
// a sparking scoreboard junction box that electrifies its bench ledge (N), basketball backboards that slam down
// on the hoops, and the FINALE: rolling bleachers (north + south) and a fence gate (east) roll out 40–52 s and
// partition the yard, shoving everyone toward the court.
ARENAS.schoolyard = {
  key: 'schoolyard', name: 'Schoolyard Shutdown', blurb: 'Stair sets, handrails, a gym roof and a court nobody leaves.',
  finale: 'Rolling bleachers and fence gates partition the yard toward the court.', variants: 4,
  look: { sky: '#A9C8E8', horizon: '#F2DEC4', fog: '#E4D6C2', sun: [-0.45, 0.82, 0.38], ground: '#6F6A66', accent: ['#FF9B36', '#36DCE8', '#FF5C69', '#B4E64A'] },
  build(v) {
    const A = mkArena({ half: 40 });
    perimeter(A, 40, 6, 'brick');
    const TER = 2.5, GYM = 5;
    // ── school building wings in the corners (line-of-sight breaks, wallrideable brick)
    A.prims.push(box(-35, 35, 10, 10, 9, { mat: 'brick' }), box(-35, -35, 10, 10, 9, { mat: 'brick' }));
    // ── basketball court: painted asphalt, sideline bleacher bank on the west, hoop posts at both ends
    A.prims.push(box(0, 0, 18, 26, 0.02, { mat: 'asphalt', wr: false }));
    A.prims.push(slope(12, v === 3 ? 5 : 0, 10, 4, 0, 1.4, { yaw: -PI / 2, mat: 'bleacher', wr: false }));
    A.prims.push(box(0, 14.6, 0.5, 0.5, 3.4, { mat: 'metal', wr: false }), box(0, -14.6, 0.5, 0.5, 3.4, { mat: 'metal', wr: false }));
    // ── west quad terrace (y 2.5)
    A.prims.push(box(-31, 0, 18, 48, TER, { mat: 'concrete' }));
    // central wheelchair ramp from the court side up onto the terrace
    const rz = v === 2 ? 8 : 0;
    A.prims.push(slope(-18, rz, 6, 8, 0, TER, { yaw: -PI / 2, mat: 'concrete', wr: false }));
    A.rails.push(mkRail([[-14, 0.9, rz + 3.2], [-22, TER + 0.9, rz + 3.2]], { kind: 'handrail' }));
    // stair sets with handrails: two off the east face, one off each end
    stairs(A, -19.5, 14, 5, 5, TER, PI / 2);
    stairs(A, -19.5, v === 2 ? -6 : -14, 5, 5, TER, PI / 2);
    stairs(A, -31, 26.5, 6, 5, TER, 0);
    stairs(A, -31, -26.5, 6, 5, TER, PI);
    // terrace planters (ledges) and benches
    for (const [px, pz] of [[-31, 10], [-31, -10]]) {
      A.prims.push(box(px, pz, 3, 3, TER + 0.8, { y0: TER, mat: 'grass', wr: false }), box(px, pz, 0.6, 0.6, TER + 4, { y0: TER, mat: 'wood', wr: false }));
      A.rails.push(mkRail([[px - 1.5, TER + 0.8, pz - 1.5], [px - 1.5, TER + 0.8, pz + 1.5]], { kind: 'ledge' }), mkRail([[px + 1.5, TER + 0.8, pz - 1.5], [px + 1.5, TER + 0.8, pz + 1.5]], { kind: 'ledge' }));
    }
    A.prims.push(box(-36, 0, 1, 8, TER + 0.5, { y0: TER, mat: 'wood', wr: false }));
    A.rails.push(mkRail([[-36, TER + 0.5, -4], [-36, TER + 0.5, 4]], { kind: 'ledge' }));
    A.rails.push(mkRail([[-26, TER + 0.6, -20], [-26, TER + 0.6, -12]], { kind: 'rail' }), mkRail([[-26, TER + 0.6, 12], [-26, TER + 0.6, 20]], { kind: 'rail' }));
    // ── gym annex (NE): roof at y 5, long access ramp from the west, stair set down to the east lane
    A.prims.push(box(30.5, 30.5, 17, 17, GYM, { mat: 'brick' }));
    A.prims.push(slope(15, 30, 8, 14, 0, GYM, { yaw: PI / 2, mat: 'concrete', wr: false }));
    stairs(A, v === 1 ? 26 : 32, 18, 6, 8, GYM, PI);
    A.prims.push(box(33, 34, 4, 3, GYM + 1.4, { y0: GYM, mat: 'metal' }), box(26, 26, 2.5, 2.5, GYM + 1.4, { y0: GYM, mat: 'metal' }));
    A.rails.push(mkRail([[23, GYM + 0.5, 37], [37, GYM + 0.5, 37]], { kind: 'rail' }));
    // ── NW: north bench ledge by the scoreboard junction box (electrified later)
    A.prims.push(box(-18, 32, 2, 2, 2.4, { mat: 'metal' }));
    A.prims.push(box(-18, 27, 8, 1, 0.5, { mat: 'concrete', wr: false }));
    A.liveRail = mkRail([[-22, 0.5, 27], [-14, 0.5, 27]], { kind: 'ledge' });
    A.rails.push(A.liveRail);
    // ── south bench plaza: benches + planters either side of the bleacher lane
    for (const sx of [-1, 1]) {
      A.prims.push(box(sx * 15, -24, 1, 7, 0.5, { mat: 'wood', wr: false }));
      A.rails.push(mkRail([[sx * 15, 0.5, -27.5], [sx * 15, 0.5, -20.5]], { kind: 'ledge' }));
      A.prims.push(box(sx * 15, -33, 3, 3, 0.8, { mat: 'grass', wr: false }), box(sx * 15, -33, 0.6, 0.6, 4, { mat: 'wood', wr: false }));
    }
    // ── north yard planters (cover between spawns)
    A.prims.push(box(0, 20, 3, 3, 0.8, { mat: 'grass', wr: false }), box(0, 20, 0.6, 0.6, 4, { mat: 'wood', wr: false }));
    // ── SE: portable classroom (roof y 3.2) with a kicker up, dumpsters
    A.prims.push(box(30, -31, 10, 6, 3.2, { mat: 'roof' }));
    A.prims.push(slope(30, -23, 4, 10, 0, 3.2, { yaw: PI, mat: 'wood', wr: false }));
    const fx = v === 3 ? -21 : 21;
    A.prims.push(box(fx, -37.5, 4, 2, 1.5, { mat: 'metal' }));
    // east lane cover: a utility shed + bench (north of the fence lane)
    A.prims.push(box(36, -18, 4, 4, 2.6, { mat: 'wood' }));
    A.prims.push(box(14, 18, 6, 1, 0.5, { mat: 'concrete', wr: false }));
    A.rails.push(mkRail([[11, 0.5, 18], [17, 0.5, 18]], { kind: 'ledge' }));
    // ── finale movers: rolling bleachers (N, S) and the east fence gate wait flush in the floor
    A.bleN = box(-2, 34, 20, 4, 0, { y0: -2.6, mat: 'bleacher', wr: false });
    A.bleS = box(0, -34, 20, 4, 0, { y0: -2.6, mat: 'bleacher', wr: false });
    A.fenE = box(36, 0, 0.4, 26, 0, { y0: -3.4, mat: 'fence', wr: false });
    A.prims.push(A.bleN, A.bleS, A.fenE);
    A.fire = { x: fx, z: -34.5, w: 5, d: 3 };
    A.elec = { x: -18, z: 30, r: 3.5 };
    A.hoops = [{ x: 0, z: 11.8 }, { x: 0, z: -11.8 }];
    A.hz = [
      { kind: 'fire', x: fx, y: 0.02, z: -34.5, w: 5, d: 3, yaw: 0, on: false, warn: 0 },
      { kind: 'electric', x: -18, y: 0.02, z: 30, r: 3.5, on: false, warn: 0, rail: A.liveRail },
      { kind: 'press', x: 0, y: 0.02, z: 11.8, w: 3, d: 3, yaw: 0, on: false, warn: 0 },
      { kind: 'press', x: 0, y: 0.02, z: -11.8, w: 3, d: 3, yaw: 0, on: false, warn: 0 },
      { kind: 'sweep', x: -2, y: 0, z: 34, w: 20, d: 4, yaw: 0, on: false, warn: 0 },
      { kind: 'sweep', x: 0, y: 0, z: -34, w: 20, d: 4, yaw: 0, on: false, warn: 0 },
      { kind: 'sweep', x: 36, y: 0, z: 0, w: 0.4, d: 26, yaw: 0, on: false, warn: 0 },
    ];
    // ── eight spawns in a ring (≥ 14 m apart), cover between neighbours
    A.spawns = [[9, 23], [24, 9], [24, -9], [8, -24], [-8, -24], [-26, -9], [-26, 9], [-8, 22]];
    A.pickups = [
      [0, 0, 0, 'center'], [-31, TER, 0, 'center'], [30, GYM, 30, 'center'], [13, 0, -18, 'center'], [20, 0, 0, 'center'],
      [-31, TER, -18, 'std'], [-31, TER, 18, 'std'], [12, 0, -14, 'std'], [-8, 0, 14, 'std'], [32, 0, -12, 'std'],
      [22, 0, -20, 'std'], [-20, 0, 22, 'std'], [30, 3.2, -31, 'std'], [-24, 0, -28, 'std'], [-25, 0, 33, 'std'],
    ];
    A.zone = [{ t: 0, x: 0, z: 0, r: 62 }, { t: 12, x: 0, z: 0, r: 48 }, { t: 28, x: 0, z: 0, r: 30 }, { t: 40, x: 0, z: 0, r: 18 }, { t: 50, x: 0, z: 0, r: 9 }, { t: 60, x: 0, z: 0, r: 5 }];
    // the halfpipe: ~4 m vert walls either side of a flat bottom, roll in from the open ends
    halfpipe(A, -9, -13, 0);
    return A;
  },
  update(R, dt) {
    const A = R.W, t = R.t, H = A.hz;
    // dumpster fire: smoulders from 12 s, alight at 15 s, spreads toward 50 s
    const fw = 3 + 3 * clamp((t - 15) / 35, 0, 1);
    A.fire.w = fw; H[0].w = fw; H[0].on = t >= 15; H[0].warn = clamp((t - 12) / 3, 0, 1);
    // scoreboard junction box: arcs every 5 s from 18 s (0.8 s), radius grows after 40 s
    const ep = t - 18, eph = ep >= 0 ? ep - Math.floor(ep / 5) * 5 : -1;
    A.elecOn = ep >= 0 && eph >= 4.2;
    A.elec.r = t >= 40 ? 5 : 3.5; H[1].r = A.elec.r;
    H[1].on = A.elecOn; H[1].warn = ep >= -2 && (ep < 0 || eph >= 3) ? 1 : 0;
    A.liveRail.live = A.elecOn;
    // backboards slam down on the hoops, alternating, every 7 s from 24 s (1.2 s warning, 0.4 s slam)
    for (let k = 0; k < 2; k++) {
      const bp = t - 24 - k * 3.5, ph = bp >= 0 ? bp - Math.floor(bp / 7) * 7 : -1;
      const on = bp >= 0 && ph >= 1.2 && ph < 1.6;
      A.hoops[k].on = on; H[2 + k].on = on; H[2 + k].warn = bp >= -1.2 && ph < 1.2 ? 1 : 0;
    }
    // FINALE: bleachers + fence rise 37–40 s (telegraphed from 34 s), then roll inward 40 → 52 s
    const up = clamp((t - 37) / 3, 0, 1), u = clamp((t - 40) / 12, 0, 1), warn = t >= 34 && t < 40 ? 1 : 0;
    const moves = [[A.bleN, 'z', 34 - u * 10, 2.6, H[4]], [A.bleS, 'z', -34 + u * 17, 2.6, H[5]], [A.fenE, 'x', 36 - u * 20, 3.4, H[6]]];
    for (const [p, ax, target, h, hd] of moves) {
      p.top = h * up; p.y0 = p.top - h; p.warn = warn;
      if (ax === 'z') { p.vz = (target - p.cz) / dt; p.cz = target; hd.z = target; }
      else { p.vx = (target - p.cx) / dt; p.cx = target; hd.x = target; }
      hd.on = up > 0.3; hd.warn = warn;
    }
  },
  after(R) {
    const A = R.W, t = R.t, late = clamp((t - 20) / 30, 0, 1);
    for (const s of R.sk) {
      if (!s.alive) continue;
      // dumpster fire (ticking)
      if (t >= 15 && s.y < 1.6 && Math.abs(s.x - A.fire.x) < A.fire.w / 2 && Math.abs(s.z - A.fire.z) < A.fire.d / 2) hazardTick(R, s, (10 + 20 * late) * DT, 'fire');
      // junction box arcs + live bench ledge
      if (A.elecOn) {
        const dx = s.x - A.elec.x, dz = s.z - A.elec.z, d = hyp(dx, dz);
        if ((d < A.elec.r && s.y < 2.5) || (s.mode === MODE.GRIND && s.rail === A.liveRail)) hazardHit(R, s, 16 + 14 * late, dx / (d || 1) * 7, dz / (d || 1) * 7, 'electric');
      }
      // backboard slams
      for (const h of A.hoops) if (h.on && s.y < 3 && Math.abs(s.x - h.x) < 1.6 && Math.abs(s.z - h.z) < 1.6) hazardHit(R, s, 24 + 16 * late, 0, -Math.sign(h.z) * 8, 'press');
      // rolling bleachers + fence gate: contact hurts and shoves you toward the court
      if (A.bleN.top > 1 && A.bleN.vz && Math.abs(s.x - A.bleN.cx) < 10.5 && Math.abs(s.z - A.bleN.cz) < 2.6 && s.y < A.bleN.top + 0.5) hazardHit(R, s, 18, 0, -10, 'sweep');
      if (A.bleS.top > 1 && A.bleS.vz && Math.abs(s.x - A.bleS.cx) < 10.5 && Math.abs(s.z - A.bleS.cz) < 2.6 && s.y < A.bleS.top + 0.5) hazardHit(R, s, 18, 0, 10, 'sweep');
      if (A.fenE.top > 1 && A.fenE.vx && Math.abs(s.z - A.fenE.cz) < 13.5 && Math.abs(s.x - A.fenE.cx) < 0.9 && s.y < A.fenE.top) hazardHit(R, s, 18, -10, 0, 'sweep');
    }
  },
};
