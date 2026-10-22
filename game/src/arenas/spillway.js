// ───────────────────────── 1. THE SPILLWAY ─────────────────────────
// Sunlit flood channel. Three vertical routes: the channel floor (y 0, shallow water down the middle), the two
// side decks (y 2.5, reached by the banks), and the bridge (y 4.8, reached by deck ramps or a bank transfer).
// Contest points: under the bridge, on the bridge, both deck plazas. Centre drainage grinder chews anyone who
// lingers under the bridge after 12 s. FINALE: sluice gates sweep the channel lanes in from both ends (40–52 s).
ARENAS.spillway = {
  key: 'spillway', name: 'The Spillway', blurb: 'Flood channel, half-pipes and a hungry drain.',
  finale: 'Sluice gates sweep the outer lanes toward the centre.', variants: 4,
  look: { sky: '#8FD3F4', horizon: '#F6E7C1', fog: '#E9DDBE', sun: [0.55, 0.8, 0.35], ground: '#B7B0A0', water: '#36A7C9', accent: ['#B4E64A', '#36DCE8', '#FF5C69', '#FF9B36'] },
  build(v) {
    const A = mkArena({ half: 40 });
    perimeter(A, 40, 4.5);
    const DECK = 2.5, BR = 4.8;
    // banks + decks
    A.prims.push(slope(10, 0, 76, 4, 0, DECK, { yaw: PI / 2, mat: 'concrete', wr: false }), slope(-10, 0, 76, 4, 0, DECK, { yaw: -PI / 2, mat: 'concrete', wr: false }));
    A.prims.push(box(26, 0, 28, 80, DECK, { mat: 'concrete' }), box(-26, 0, 28, 80, DECK, { mat: 'concrete' }));
    // channel-end quarter pipes (with copings to grind)
    qpWithDeck(A, 0, 33.5, 16, 4, 62, 0, 2.5);
    qpWithDeck(A, 0, -33.5, 16, 4, 62, PI, 2.5);
    // the bridge (you can roll underneath), its pillars and deck ramps
    const bz = v === 1 ? 6 : v === 2 ? -6 : 0;
    A.prims.push(box(0, bz, 24, 6, BR, { y0: BR - 0.6, mat: 'metal', wr: false }));
    A.prims.push(box(-5, bz, 1.2, 1.2, BR - 0.6, { mat: 'concrete' }), box(5, bz, 1.2, 1.2, BR - 0.6, { mat: 'concrete' }));
    A.prims.push(slope(15, bz, 6, 6, DECK, BR, { yaw: -PI / 2, y0: DECK, mat: 'metal' }), slope(-15, bz, 6, 6, DECK, BR, { yaw: PI / 2, y0: DECK, mat: 'metal' }));
    A.rails.push(mkRail([[-12, BR, bz - 3], [12, BR, bz - 3]], { kind: 'ledge' }), mkRail([[-12, BR, bz + 3], [12, BR, bz + 3]], { kind: 'ledge' }));
    // channel kickers to transfer up the banks / onto the bridge
    kicker(A, -4, 17, 3, 3, 1.1, PI);
    kicker(A, 4, -17, 3, 3, 1.1, 0);
    if (v === 3) { kicker(A, 4, 17, 3, 3, 1.1, PI); kicker(A, -4, -17, 3, 3, 1.1, 0); }
    // deck plazas: funboxes, ledges, a flat rail, containers for cover
    funbox(A, 26, -16, 4, 6, 1.0, 0, 2.5);
    funbox(A, -26, 16, 4, 6, 1.0, PI, 2.5);
    A.rails.push(mkRail([[20, DECK + 0.6, 10], [20, DECK + 0.6, 24]], { kind: 'rail' }), mkRail([[-20, DECK + 0.6, -10], [-20, DECK + 0.6, -24]], { kind: 'rail' }));
    A.prims.push(box(33, 18, 6, 2.6, DECK + 2.7, { y0: DECK, mat: 'container' }), box(-33, -18, 6, 2.6, DECK + 2.7, { y0: DECK, mat: 'container' }));
    A.prims.push(box(33, -30, 2.6, 6, DECK + 2.7, { y0: DECK, mat: 'container' }), box(-33, 30, 2.6, 6, DECK + 2.7, { y0: DECK, mat: 'container' }));
    A.prims.push(box(18, 33, 3, 3, DECK + 1.4, { y0: DECK, mat: 'crate' }), box(-18, -33, 3, 3, DECK + 1.4, { y0: DECK, mat: 'crate' }));
    // sluice gates wait flush in the floor in front of the end quarter pipes
    A.gates = [box(0, 30.6, 24, 1.2, 0, { y0: -3.2, mat: 'gate', wr: false }), box(0, -30.6, 24, 1.2, 0, { y0: -3.2, mat: 'gate', wr: false })];
    A.prims.push(...A.gates);
    A.grinder = { x: 0, z: bz, r: 2.3 };
    A.water = { x0: -2.5, x1: 2.5 };
    A.hz = [{ kind: 'grinder', x: 0, y: 0, z: bz, r: 2.3, on: false, warn: 0 }, { kind: 'water', x: 0, y: 0.02, z: 0, w: 5, d: 60, yaw: 0, on: true, warn: 0 }];
    // eight spawns in a ring (≥14 m apart), facing the centre
    for (let k = 0; k < 8; k++) { const a = (k + 0.5) * TAU / 8; A.spawns.push([Math.sin(a) * 23, Math.cos(a) * 23]); }
    A.pickups = [
      [0, 0, bz + 8, 'center'], [0, 0, bz - 8, 'center'], [0, BR, bz, 'center'], [26, DECK, 0, 'center'], [-26, DECK, 0, 'center'],
      [26, DECK, -26, 'std'], [26, DECK, 26, 'std'], [-26, DECK, -26, 'std'], [-26, DECK, 26, 'std'],
      [0, 0, -24, 'std'], [0, 0, 24, 'std'], [36, DECK, 0, 'std'], [-36, DECK, 0, 'std'], [16, DECK, -36, 'std'], [-16, DECK, 36, 'std'],
    ];
    A.zone = [{ t: 0, x: 0, z: 0, r: 62 }, { t: 12, x: 0, z: 0, r: 48 }, { t: 28, x: 0, z: bz * 0.5, r: 30 }, { t: 40, x: 0, z: bz * 0.5, r: 18 }, { t: 50, x: 0, z: bz * 0.5, r: 9 }, { t: 60, x: 0, z: bz * 0.5, r: 5 }];
    return A;
  },
  update(R, dt) {
    const A = R.W, t = R.t;
    A.hz[0].on = t >= 12; A.hz[0].warn = clamp((t - 9) / 3, 0, 1);
    for (const g of A.gates) g.warn = t >= 34 && t < 40 ? 1 : 0;
    // sluice gates: rise 37–40 s (telegraphed), then sweep 40 → 52 s from the ends to ±15
    const up = clamp((t - 37) / 3, 0, 1), u = clamp((t - 40) / 12, 0, 1), target = 30.6 - u * 15.6;
    for (const [g, sg] of [[A.gates[0], 1], [A.gates[1], -1]]) {
      g.top = 3.2 * up; g.y0 = g.top - 3.2;
      g.vz = (sg * target - g.cz) / dt; g.cz = sg * target;
    }
  },
  after(R) {
    const A = R.W, t = R.t, g = A.grinder;
    for (const s of R.sk) {
      if (!s.alive) continue;
      // shallow water drags
      if (s.mode === MODE.GROUND && s.y < 0.2 && s.x > A.water.x0 && s.x < A.water.x1) { s.vx *= 0.996; s.vz *= 0.996; }
      // the drain grinder (live after 12 s)
      if (t >= 12 && s.y < 1.2) { const dx = s.x - g.x, dz = s.z - g.z, d = hyp(dx, dz); if (d < g.r) hazardHit(R, s, 22, dx / (d || 1) * 9, dz / (d || 1) * 9, 'grinder'); }
      // gates: contact hurts and shoves you inward
      for (const gt of A.gates) if (gt.vz && gt.top > 1 && Math.abs(s.x) < 12.5 && Math.abs(s.z - gt.cz) < 1.3 && s.y < 3.2) hazardHit(R, s, 18, 0, -Math.sign(gt.cz) * 10, 'gate');
    }
  },
};
