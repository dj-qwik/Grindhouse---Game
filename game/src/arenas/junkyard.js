// ───────────────────────── 4. JUNKYARD JAM ─────────────────────────
// Scrapyard ringed by stacked shipping containers. Three vertical routes: the yard floor (y 0) with crushed-car
// funboxes and bent-pipe rails around a central clearing, the container rows (y 2.6, reached by scrap ramps
// from the yard or the back alleys) and the top containers (y 5.2, reached by scrap ramps on the rows).
// Contest points: the clearing, both car funboxes, both top containers. Hazards: the magnet crane (swinging
// over the north yard, pulls skaters in, the hanging steel hurts), the car crusher press (south bay, telegraphed
// slam), oil fires (side lanes) and sparking live pipe rails. FINALE (40 s+): the crane's jib runs out, the
// magnet pull grows and loose steel slabs slide in along the diagonals toward the final circle.
ARENAS.junkyard = {
  key: 'junkyard', name: 'Junkyard Jam', blurb: 'Scrap ramps, crushed cars and a crane with a grudge.',
  finale: 'The magnet crane drags loose steel in toward the final circle.', variants: 4,
  look: { sky: '#E9B872', horizon: '#F3D9A4', fog: '#D9B98A', sun: [-0.45, 0.75, 0.4], ground: '#8A7A66', accent: ['#FFB627', '#FF5C39', '#4FD1C5', '#C6F432'] },
  build(v) {
    const A = mkArena({ half: 40 });
    perimeter(A, 40, 4.5, 'fence');
    const T1 = 2.6, T2 = 5.2, flip = v === 1 ? -1 : 1;
    // ── container rows (east + west), their top containers and scrap ramps
    for (const sx of [-1, 1]) {
      const x = sx * 30;
      A.prims.push(box(x, 0, 6, 40, T1, { mat: 'container' }));
      A.prims.push(box(x, 0, 6, 10, T2, { y0: T1, mat: 'container' }));
      // tier 1 → tier 2 ramps (from both ends of the top container)
      A.prims.push(slope(x, 8, 6, 6, T1, T2, { yaw: PI, y0: T1, mat: 'scrap' }), slope(x, -8, 6, 6, T1, T2, { yaw: 0, y0: T1, mat: 'scrap' }));
      // yard → tier 1 ramps on the inner face, and from the back alley
      A.prims.push(slope(sx * 24.5, 14, 4, 5, 0, T1, { yaw: sx * PI / 2, mat: 'scrap' }), slope(sx * 24.5, -14, 4, 5, 0, T1, { yaw: sx * PI / 2, mat: 'scrap' }));
      A.prims.push(slope(sx * 35.5, sx * 17, 4, 5, 0, T1, { yaw: -sx * PI / 2, mat: 'scrap' }));
      // bent-pipe rail along the row's inner edge and a ledge on the top container
      A.rails.push(mkRail([[sx * 27.1, T1 + 0.5, -19], [sx * 27.1, T1 + 0.7, -12], [sx * 27.1, T1 + 0.5, -6]], { kind: 'rail' }));
      A.rails.push(mkRail([[sx * 27.1, T1 + 0.5, 6], [sx * 27.1, T1 + 0.7, 12], [sx * 27.1, T1 + 0.5, 19]], { kind: 'rail' }));
      A.rails.push(mkRail([[sx * 27, T2, -5], [sx * 27, T2, 5]], { kind: 'ledge' }));
      // crushed-car funbox in front of each row (cover + contest point)
      funbox(A, sx * 14, 0, 4, 4, 1.0, PI / 2, 2.5, { mat: 'car' });
      // car stack between the east/west spawn pairs
      A.prims.push(box(sx * 21, 0, 2.2, 4, 1.8, { mat: 'car', wr: false }));
    }
    // diagonal container stacks (cover between spawn neighbours, flank the finale lanes)
    for (const [dx, dz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
      const off = v === 3 ? 18 : 16.5;
      A.prims.push(box(dx * off, dz * off, 6, 2.6, T1, { yaw: PI / 4 * dx * dz, mat: 'container' }));
    }
    // north: the crane tower; south: the crusher bay with car piles either side
    A.prims.push(box(0, 34, 3, 3, 9, { mat: 'metal' }));
    A.prims.push(box(-6, -27 * flip, 3, 4.5, 1.6, { mat: 'car', wr: false }), box(6, -27 * flip, 3, 4.5, 1.6, { mat: 'car', wr: false }));
    A.press = box(0, -27 * flip, 5, 5, 5.2, { y0: 4.2, mat: 'press', wr: false });
    A.prims.push(A.press);
    // car pile kickers on the north/south lanes
    kicker(A, -9, 12, 3, 3, 1.0, PI, { mat: 'car' });
    kicker(A, 9, -12, 3, 3, 1.0, 0, { mat: 'car' });
    if (v === 2) { kicker(A, 9, 12, 3, 3, 1.0, PI, { mat: 'car' }); kicker(A, -9, -12, 3, 3, 1.0, 0, { mat: 'car' }); }
    // bent pipes around the clearing (these spark when live)
    A.pipes = [
      mkRail([[-6, 0.6, -9], [0, 0.9, -10.5], [6, 0.6, -9]], { kind: 'rail' }),
      mkRail([[-6, 0.6, 9], [0, 0.9, 10.5], [6, 0.6, 9]], { kind: 'rail' }),
    ];
    A.rails.push(...A.pipes);
    // loose steel slabs wait sunk in the floor on the diagonals
    A.steel = [];
    for (const [dx, dz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
      const p = box(dx * 12, dz * 12, 2.4, 2.4, 0, { y0: -1.8, mat: 'scrap', wr: false });
      p.dx = dx; p.dz = dz; A.steel.push(p); A.prims.push(p);
    }
    // hazards
    A.fires = [{ x: 17 * flip, z: -28, w: 4, d: 4 }, { x: -17 * flip, z: 28, w: 4, d: 4 }];
    A.crane = { px: 0, pz: 34, jib: 21, x: 0, z: 13, y: 3 };
    A.hz = [
      { kind: 'magnet', x: 0, y: 3, z: 13, r: 9, on: false, warn: 0 },
      { kind: 'press', x: 0, y: 0, z: -27 * flip, w: 5, d: 5, yaw: 0, on: false, warn: 0 },
      ...A.fires.map((f) => ({ kind: 'fire', x: f.x, y: 0.02, z: f.z, w: f.w, d: f.d, yaw: 0, on: false, warn: 0 })),
      ...A.pipes.map((r) => ({ kind: 'electric', rail: r, x: 0, y: 0.8, z: r.pts[1][2], on: false, warn: 0 })),
    ];
    // eight spawns in a ring, facing the centre
    for (let k = 0; k < 8; k++) { const a = (k + 0.5) * TAU / 8; A.spawns.push([Math.sin(a) * 23, Math.cos(a) * 23]); }
    A.pickups = [
      [7, 0, 0, 'center'], [-7, 0, 0, 'center'], [0, 0, -6, 'center'],
      [14, 1.0, 0, 'center'], [-14, 1.0, 0, 'center'], [30, T2, 0, 'center'], [-30, T2, 0, 'center'],
      [30, T1, 15, 'std'], [-30, T1, -15, 'std'], [30, T1, -15, 'std'], [-30, T1, 15, 'std'],
      [0, 0, 26, 'std'], [0, 0, -19 * flip, 'std'], [36.5, 0, 0, 'std'], [-36.5, 0, 0, 'std'],
    ];
    const zx = v === 2 ? 2 : v === 1 ? -2 : 0;
    A.zone = [{ t: 0, x: 0, z: 0, r: 62 }, { t: 12, x: 0, z: 0, r: 48 }, { t: 28, x: zx * 0.5, z: 0, r: 30 }, { t: 40, x: zx, z: 0, r: 18 }, { t: 50, x: zx, z: 0, r: 9 }, { t: 60, x: zx, z: 0, r: 5 }];
    // the halfpipe: ~4 m vert walls either side of a flat bottom, roll in from the open ends
    halfpipe(A, -3, -35, PI / 2);
    return A;
  },
  update(R, dt) {
    const A = R.W, t = R.t;
    // ── magnet crane: the jib swings back and forth; from 40 s it runs out toward the final circle
    const C = A.crane, ext = clamp((t - 40) / 8, 0, 1);
    const jib = C.jib + ext * 4, a = PI + 0.85 * Math.sin(t * 0.55);
    C.x = Math.sin(a) * jib + C.px; C.z = Math.cos(a) * jib + C.pz;
    const mh = A.hz[0]; mh.x = C.x; mh.z = C.z; mh.on = t >= 12; mh.warn = clamp((t - 9) / 3, 0, 1); mh.r = 9 + ext * 3;
    // ── crusher press: 6 s cycle from 14 s (raised · warn 1.5 s · slam · rise)
    const P = A.press, ph = A.hz[1];
    let drop = 0, warn = 0, slam = false;
    if (t >= 14) {
      const per = t >= 40 ? 4.5 : 6, c = (t - 14) % per, w0 = per - 2.5;
      if (c >= w0 && c < w0 + 1.5) { warn = 1; drop = 0.15 * (c - w0) / 1.5; }
      else if (c >= w0 + 1.5 && c < w0 + 1.8) { drop = 0.15 + 0.85 * (c - w0 - 1.5) / 0.3; slam = true; }
      else if (c >= w0 + 1.8 && c < w0 + 2.1) { drop = 1; slam = true; }
      else if (c >= w0 + 2.1) drop = 1 - (c - w0 - 2.1) / 0.4;
    } else if (t >= 12.5) warn = 1;
    P.y0 = 4.2 * (1 - drop); P.top = P.y0 + 1.0; P.warn = warn;
    ph.on = slam; ph.warn = warn;
    // ── oil fires: flare 4 s, smoulder 3 s from 16 s; permanent from 45 s
    for (let k = 0; k < A.fires.length; k++) {
      const h = A.hz[2 + k], c = (t - 16 + k * 3.5) % 7;
      h.on = t >= 16 && (c < 4 || t >= 45); h.warn = t >= 13 && !h.on && (t < 16 || c > 5.5) ? 1 : 0;
    }
    // ── live pipes: alternate 5 s sparks from 20 s (warned 1.5 s ahead)
    for (let k = 0; k < A.pipes.length; k++) {
      const r = A.pipes[k], h = A.hz[4 + k], c = (t - 20 + k * 5) % 10;
      r.live = t >= 20 && c < 5; h.on = r.live; h.warn = !r.live && t >= 18.5 && (c > 8.5 || t < 20) ? 1 : 0;
    }
    // ── finale steel: rises 37–40 s, slides in along the diagonals 40 → 52 s
    const up = clamp((t - 37) / 3, 0, 1), u = clamp((t - 40) / 12, 0, 1), d = 12 - u * 7.2;
    for (const p of A.steel) {
      p.warn = t >= 34 && t < 40 ? 1 : 0;
      p.top = 1.8 * up; p.y0 = p.top - 1.8;
      const nx = p.dx * d + R.zoneNow.x * u, nz = p.dz * d;
      p.vx = (nx - p.cx) / dt; p.vz = (nz - p.cz) / dt; p.cx = nx; p.cz = nz;
    }
  },
  after(R, dt) {
    const A = R.W, t = R.t, C = A.crane, P = A.press;
    const late = t >= 40, pull = t < 12 ? 0 : late ? 4 + (t - 40) * 0.25 : 2, pr = A.hz[0].r;
    for (const s of R.sk) {
      if (!s.alive) continue;
      // magnet: pulls toward the hanging steel; contact with it hurts
      const mx = C.x - s.x, mz = C.z - s.z, md = hyp(mx, mz);
      if (pull > 0 && md < pr && md > 0.3 && s.mode !== MODE.DOWN && s.mode !== MODE.GRIND) {
        const k = pull * (1 - md / pr) * dt / md; s.vx += mx * k; s.vz += mz * k;
      }
      if (t >= 12 && md < 2.2 && s.y < 4) hazardHit(R, s, late ? 30 : 18, -mx / (md || 1) * 9, -mz / (md || 1) * 9, 'magnet');
      // crusher press slam
      if (A.hz[1].on && P.y0 < 1.5 && Math.abs(s.x - P.cx) < 2.9 && Math.abs(s.z - P.cz) < 2.9 && s.y < 2) {
        hazardHit(R, s, late ? 50 : 30, Math.sign(s.x - P.cx || 1) * 10, 0, 'press');
      }
      // oil fires
      for (let k = 0; k < A.fires.length; k++) {
        const f = A.fires[k];
        if (A.hz[2 + k].on && s.y < 1 && Math.abs(s.x - f.x) < f.w / 2 + 0.3 && Math.abs(s.z - f.z) < f.d / 2 + 0.3) hazardTick(R, s, (t >= 45 ? 25 : 12) * dt, 'fire');
      }
      // live pipes zap grinders
      if (s.mode === MODE.GRIND && s.rail && s.rail.live) hazardHit(R, s, late ? 25 : 15, 0, 0, 'electric');
      // loose steel: contact hurts and shoves toward the middle
      for (const p of A.steel) {
        if (p.top < 1 || (!p.vx && !p.vz)) continue;
        if (Math.abs(s.x - p.cx) < 1.7 && Math.abs(s.z - p.cz) < 1.7 && s.y < p.top + 0.3) hazardHit(R, s, 16, -p.dx * 7, -p.dz * 7, 'scrap');
      }
    }
  },
};
