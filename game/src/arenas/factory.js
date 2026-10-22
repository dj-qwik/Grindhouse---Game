// ───────────────────────── 7. FACTORY FLOOR ─────────────────────────
// Working metal shop. Three vertical routes: the shop floor (y 0) with two conveyor lanes, the mid machine
// decks (funboxes, y 1.4), and the mezzanine catwalks (y 4) along the north/south walls joined by a gantry
// (y 4) that crosses the floor over the final core. Contest points: under the gantry, on the gantry, and the
// two press stations beside the conveyors. Hazards: conveyor belts (carry you), press hammers over the belts
// (telegraphed slams), live grinder rails (spark phases after 20 s), molten channels in front of the wall
// quarter pipes. FINALE: from 45 s the belts reverse and run faster while the presses cycle faster (40 s+).
ARENAS.factory = {
  key: 'factory', name: 'Factory Floor', blurb: 'Conveyors, press hammers, live rails and molten metal.',
  finale: 'Conveyor lanes reverse and the presses accelerate.', variants: 4,
  look: { sky: '#2A1E1A', horizon: '#C2521C', fog: '#5A3220', sun: [0.4, 0.85, -0.3], ground: '#5C5650', accent: ['#FF7A1A', '#FFC23A', '#36DCE8', '#FF3D3D'] },
  build(v) {
    const A = mkArena({ half: 40 });
    perimeter(A, 40, 5, 'brick');
    const CW = 4, GY = 4, LX = 14;
    // mezzanine catwalks along the north + south walls, ramps at both ends
    for (const sz of [1, -1]) {
      A.prims.push(box(0, sz * 30, 40, 8, CW, { mat: 'metal' }));
      A.prims.push(slope(25, sz * 30, 8, 10, 0, CW, { yaw: -PI / 2, mat: 'metal', wr: false }));
      A.prims.push(slope(-25, sz * 30, 8, 10, 0, CW, { yaw: PI / 2, mat: 'metal', wr: false }));
      A.rails.push(mkRail([[-19, CW, sz * 26.1], [19, CW, sz * 26.1]], { kind: 'ledge' }));
    }
    // the gantry: crosses the floor north–south over the core (roll under it), resting on two machine housings
    A.prims.push(box(0, 0, 6, 52, GY, { y0: GY - 0.6, mat: 'metal', wr: false }));
    A.prims.push(box(0, 17, 5, 3, GY - 0.6, { mat: 'press' }), box(0, -17, 5, 3, GY - 0.6, { mat: 'press' }));
    A.rails.push(mkRail([[-3, GY, -24], [-3, GY, 24]], { kind: 'ledge' }), mkRail([[3, GY, -24], [3, GY, 24]], { kind: 'ledge' }));
    // conveyor lanes (top 0.3: roll straight on) with a press station over each
    const flip = v === 1 ? -1 : 1;
    A.belts = [box(LX, 0, 4, 24, 0.3, { mat: 'conveyor', wr: false }), box(-LX, 0, 4, 24, 0.3, { mat: 'conveyor', wr: false })];
    A.beltDir = [flip, -flip];
    A.prims.push(...A.belts);
    const pz = v === 2 ? 4 : 6;
    A.presses = [];
    for (const [px, pzz] of [[LX, pz], [LX, -pz], [-LX, pz], [-LX, -pz]]) {
      const ham = box(px, pzz, 3, 3, 4.4, { y0: 3.2, mat: 'press', wr: false });
      A.prims.push(ham);
      // frame columns (cover beside the lane)
      A.prims.push(box(px + 2.6, pzz, 0.6, 0.6, 4.6, { mat: 'metal', wr: false }), box(px - 2.6, pzz, 0.6, 0.6, 4.6, { mat: 'metal', wr: false }));
      A.presses.push({ x: px, z: pzz, ham, off: A.presses.length * 0.25 });
    }
    // live grinder rails flanking the core
    A.grails = [mkRail([[-9, 0.6, 7], [9, 0.6, 7]], { kind: 'rail' }), mkRail([[-9, 0.6, -7], [9, 0.6, -7]], { kind: 'rail' })];
    A.rails.push(...A.grails);
    // wall quarter pipes (east/west) with molten channels in front of them
    qpWithDeck(A, 36, 0, 18, 3, 60, PI / 2, 2.5, { mat: 'metal' });
    qpWithDeck(A, -36, 0, 18, 3, 60, -PI / 2, 2.5, { mat: 'metal' });
    A.molten = [{ x: 32.6, z: 0, w: 3, d: 18 }, { x: -32.6, z: 0, w: 3, d: 18 }];
    // mid machine decks (funboxes) and machinery cover between spawns
    const fz = v === 3 ? -14 : 14;
    funbox(A, 24, fz, 4, 5, 1.4, 0, 2.5, { mat: 'metal' });
    funbox(A, -24, -fz, 4, 5, 1.4, PI, 2.5, { mat: 'metal' });
    A.prims.push(box(15.7, 15.7, 3, 3, 2.6, { mat: 'crate' }), box(-15.7, -15.7, 3, 3, 2.6, { mat: 'crate' }));
    A.prims.push(box(15.7, -15.7, 3, 3, 2.6, { mat: 'container' }), box(-15.7, 15.7, 3, 3, 2.6, { mat: 'container' }));
    A.prims.push(box(22, 0, 2.4, 4, 2.4, { mat: 'metal' }), box(-22, 0, 2.4, 4, 2.4, { mat: 'metal' }));
    if (v === 2) { kicker(A, 7, -14, 3, 3, 1.0, 0); kicker(A, -7, 14, 3, 3, 1.0, PI); }
    // hazard descriptors (mutated in place)
    A.hz = [];
    for (const p of A.presses) { p.hz = { kind: 'press', x: p.x, y: 0.3, z: p.z, w: 3, d: 3, yaw: 0, on: false, warn: 0 }; A.hz.push(p.hz); }
    A.railHz = A.grails.map((r) => ({ kind: 'electric', rail: r, x: 0, y: 0.6, z: r.pts[0][2], w: 18, d: 0.4, yaw: 0, on: false, warn: 0 }));
    A.hz.push(...A.railHz);
    for (const m of A.molten) A.hz.push({ kind: 'molten', x: m.x, y: 0.02, z: m.z, w: m.w, d: m.d, yaw: 0, on: true, warn: 0 });
    // eight spawns in a ring, facing the centre
    for (let k = 0; k < 8; k++) { const a = (k + 0.5) * TAU / 8; A.spawns.push([Math.sin(a) * 23, Math.cos(a) * 23]); }
    A.pickups = [
      [0, GY, 0, 'center'], [7, 0, 0, 'center'], [-7, 0, 0, 'center'], [0, 0, 10, 'center'], [0, 0, -10, 'center'],
      [10, CW, 30, 'std'], [-10, CW, 30, 'std'], [10, CW, -30, 'std'], [-10, CW, -30, 'std'],
      [24, 1.4, fz, 'std'], [-24, 1.4, -fz, 'std'], [28, 0, -18, 'std'], [-28, 0, 18, 'std'], [0, GY, 22, 'std'], [0, GY, -22, 'std'],
    ];
    const zz = v === 3 ? -2 : v === 2 ? 2 : 0;
    A.zone = [{ t: 0, x: 0, z: 0, r: 62 }, { t: 12, x: 0, z: 0, r: 48 }, { t: 28, x: 0, z: zz, r: 30 }, { t: 40, x: 0, z: zz, r: 18 }, { t: 50, x: 0, z: zz, r: 9 }, { t: 60, x: 0, z: zz, r: 5 }];
    return A;
  },
  update(R, dt) {
    const A = R.W, t = R.t;
    // belts: 2.5 m/s, reverse + 4.5 m/s from 45 s (warned 42–45 s)
    const fin = t >= 45, sp = fin ? 4.5 : 2.5;
    for (let k = 0; k < 2; k++) { const b = A.belts[k]; b.vx = 0; b.vz = A.beltDir[k] * (fin ? -sp : sp); b.warn = t >= 42 && t < 45 ? 1 : 0; }
    // presses: from 14 s, period 5 s → 3 s (40 s) → 2.2 s (50 s); 0.8 s telegraph, 0.35 s slam
    const P = t < 40 ? 5 : t < 50 ? 3 : 2.2;
    for (const p of A.presses) {
      const h = p.ham, hz = p.hz;
      let u = -1;
      if (t >= 14) { u = (t - 14 + p.off * P) % P; }
      const slam = u >= 0 && u < 0.35, warn = u >= P - 0.8 ? (u - (P - 0.8)) / 0.8 : 0;
      p.slam = slam;
      const drop = slam ? 1 : u >= 0.35 && u < 1 ? 1 - (u - 0.35) / 0.65 : 0;
      h.y0 = 3.2 - 1.1 * drop; h.top = h.y0 + 1.2; h.warn = warn;
      hz.on = slam; hz.warn = warn;
    }
    // grinder rails: spark phases from 20 s — live 3 s of every 8 s (1 s warning), always live from 50 s
    const ru = t >= 20 ? (t - 20) % 8 : -1;
    const live = t >= 50 || (ru >= 5), rw = t >= 50 ? 1 : ru >= 4 && ru < 5 ? 1 : 0;
    for (let k = 0; k < A.grails.length; k++) { A.grails[k].live = live; A.railHz[k].on = live; A.railHz[k].warn = rw; }
  },
  after(R) {
    const A = R.W, t = R.t;
    const pDmg = t < 28 ? 35 : t < 50 ? 55 : 80;
    const mDps = t < 28 ? 15 : t < 50 ? 40 : 100, rDps = t < 50 ? 30 : 60;
    for (const s of R.sk) {
      if (!s.alive) continue;
      // press slams
      if (s.y < 1.6) for (const p of A.presses) {
        if (!p.slam) continue;
        const dx = s.x - p.x, dz = s.z - p.z;
        if (Math.abs(dx) < 1.9 && Math.abs(dz) < 1.9) hazardHit(R, s, pDmg, dx >= 0 ? 8 : -8, dz * 2, 'press');
      }
      // molten channels
      if (s.y < 0.4) for (const m of A.molten) if (Math.abs(s.x - m.x) < m.w / 2 && Math.abs(s.z - m.z) < m.d / 2) hazardTick(R, s, mDps * DT, 'molten');
      // live grinder rails
      if (s.mode === MODE.GRIND && s.rail && s.rail.live && A.grails.includes(s.rail)) hazardTick(R, s, rDps * DT, 'electric');
    }
  },
};
