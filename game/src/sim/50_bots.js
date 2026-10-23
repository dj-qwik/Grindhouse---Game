// ───────────────────────── BOTS: practice opponents and empty free-play seats ─────────────────────────
// Bots run inside the simulation on their own seeded stream, so they replay identically everywhere. They play
// the same game as humans (same inputs, same rules): scavenge, keep inside the zone, fight, trick for Adrenaline.
// Skill (0.55–0.82) sets aim error, reaction time and how often they trick. Cash matches never contain bots.
function botInput(R, s) {
  if (R.free) return freeRideBot(R, s);
  const B = s.bot || (s.bot = { tgt: -1, think: 0, stuck: 0, unstuck: 0, wander: RNG() * TAU, pick: -1, aimErr: 0, hold: 0, jump: 0, trickDir: 0, fireT: 0, los: false, lastSwing: 0, retreat: 0, side: 1, cruise: null, brawl: RNG() < 0.5 });
  const t = R.t, Z = zoneAt(R.arena, t + 4); // plan for where the zone is going
  let btn = 0, mx = 0, my = 0;
  B.think -= DT;
  if (B.think <= 0) {
    B.think = 0.2 + (1 - s.skill) * 0.45;
    let best = -1, bs = 1e9;
    for (const q of R.sk) {
      if (q === s || !q.alive) continue;
      const d = len3(q.x - s.x, q.y - s.y, q.z - s.z) + q.hp * 0.06 + (q.i === B.tgt ? -3 : 0);
      if (d < bs) { bs = d; best = q.i; }
    }
    B.tgt = best;
    B.aimErr = (RNG() - 0.5) * ((1 - s.skill) * 0.5 + 0.06);
    // a skater carving at speed is hard to hit from a moving board, even for good shots
    if (best >= 0) { const q = R.sk[best]; B.aimErr += (RNG() - 0.5) * Math.min(0.36, hyp(q.vx, q.vz) * 0.022 + hyp(s.vx, s.vz) * 0.012 + (s.mode === MODE.AIR ? 0.08 : 0)); }
    // scavenge when under-armed and a pickup is nearer than the fight
    B.pick = -1;
    const tq = best >= 0 ? R.sk[best] : null, td = tq ? hyp(tq.x - s.x, tq.z - s.z) : 99;
    if (!s.ranged || s.melee === 'bat' || (s.thr === 'shove' && RNG() < 0.3)) {
      let pd = 22;
      for (const p of R.picks) {
        if (t < p.t0 - 0.6 || !wantsPickup(s, p.w, p.ammo)) continue;
        const d = hyp(p.x - s.x, p.z - s.z) + Math.abs(p.y - s.y) * 2;
        if (d < pd && (d < td * 0.9 || !s.ranged) && hyp(p.x - Z.x, p.z - Z.z) < Z.r * 0.95) { pd = d; B.pick = p.id; }
      }
    }
    B.los = tq ? lineOfSight(R.W, s.x, s.y + 1.3, s.z, tq.x, tq.y + 1.1, tq.z) : false;
  }
  const tq = B.tgt >= 0 && R.sk[B.tgt].alive ? R.sk[B.tgt] : null;
  const pick = B.pick >= 0 ? R.picks.find((p) => p.id === B.pick) : null;
  // ── where to go
  let gx = Z.x + Math.sin(B.wander) * Math.min(10, Z.r * 0.4), gz = Z.z + Math.cos(B.wander) * Math.min(10, Z.r * 0.4);
  const zd = hyp(s.x - Z.x, s.z - Z.z), outside = t > 8 && zd > Z.r * 0.75;
  const chaseOk = (x, z) => t < 8 || hyp(x - Z.x, z - Z.z) < Z.r * 0.85;
  let td = 99;
  if (tq) td = hyp(tq.x - s.x, tq.z - s.z);
  // match phases (bible §3): scramble for gear first, fights spread out, everyone converges late
  const engageR = t < 15 ? 0 : t < 32 ? 6 : t < 44 ? 13 : 99;
  if (B.retreat > 0) B.retreat -= DT;
  if (outside) { gx = Z.x; gz = Z.z; }
  else if (pick && chaseOk(pick.x, pick.z)) { gx = pick.x; gz = pick.z; }
  else if (tq && B.retreat > 0) { // a skate-style pass: carve away after a swing, then come back around
    const ang = yawOf(s.x - tq.x, s.z - tq.z) + B.side * 0.9;
    gx = tq.x + Math.sin(ang) * 11; gz = tq.z + Math.cos(ang) * 11;
  }
  else if (tq && td > engageR && !(s.ranged && td < WEAPONS[s.ranged].range * 0.6)) { // nobody close: skate lines, trick, hunt gear
    if (!B.cruise || hyp(B.cruise[0] - s.x, B.cruise[1] - s.z) < 4) { const a = RNG() * TAU, r = RNG() * Z.r * 0.6; B.cruise = [Z.x + Math.sin(a) * r, Z.z + Math.cos(a) * r]; }
    gx = B.cruise[0]; gz = B.cruise[1];
  }
  else if (tq && chaseOk(tq.x, tq.z)) {
    if (s.ranged && s.ammo > 0 && B.los && td < WEAPONS[s.ranged].range * 0.6 && !(B.brawl && td < 9)) { // hold a firing distance (brawlers close in), circle a little
      const ang = yawOf(s.x - tq.x, s.z - tq.z) + 0.5, keep = s.ranged === 'sawoff' ? 5 : 10;
      gx = tq.x + Math.sin(ang) * keep; gz = tq.z + Math.cos(ang) * keep;
    } else { gx = tq.x + tq.vx * 0.3; gz = tq.z + tq.vz * 0.3; }
  }
  if (B.unstuck > 0) { B.unstuck -= DT; gx = s.x + Math.sin(B.wander) * 10; gz = s.z + Math.cos(B.wander) * 10; }
  // keep out of live hazards and fire (people see them telegraphed; bots should too)
  let rx = 0, rz = 0;
  const avoid = (x, z, r) => { const dx = s.x - x, dz = s.z - z, d = hyp(dx, dz); if (d < r + 2.5) { const k = (r + 2.5 - d) / (r + 2.5); rx += (d > 0.01 ? dx / d : 1) * k; rz += (d > 0.01 ? dz / d : 0) * k; } };
  for (const h of R.W.hz || []) {
    if (!(h.on || (h.warn || 0) > 0.4) || h.kind === 'water' || h.kind === 'sweep') continue;
    avoid(h.x || 0, h.z || 0, h.r || Math.max(h.w || 2, h.d || 2) / 2);
  }
  for (const f of R.fires) avoid(f.x, f.z, f.r);
  if (rx || rz) { gx = s.x + rx * 12; gz = s.z + rz * 12; }
  const mdx = gx - s.x, mdz = gz - s.z, md = hyp(mdx, mdz);
  // ── aim: at the target (with a lead and some error) when close, else where we're going
  let aimYaw = md > 0.1 ? yawOf(mdx, mdz) : s.yaw, pitch = 0;
  if (tq && td < 32) {
    const lead = s.ranged && WEAPONS[s.ranged].proj ? td / WEAPONS[s.ranged].proj : 0.08;
    const ax = tq.x + tq.vx * lead - s.x, az = tq.z + tq.vz * lead - s.z;
    aimYaw = yawOf(ax, az) + B.aimErr;
    pitch = Math.atan2(tq.y + tq.vy * lead - s.y - 0.2, Math.max(1, hyp(ax, az))) + B.aimErr * 0.5;
  }
  // ── stick relative to the aim yaw
  if (md > 0.8) {
    const ux = mdx / md, uz = mdz / md, sy = Math.sin(aimYaw), cy = Math.cos(aimYaw);
    my = ux * sy + uz * cy; mx = -(ux * cy) + uz * sy;
    const sp = hyp(s.vx, s.vz);
    if (md < 3 && sp > 6) btn |= BTN.brake;
    if (md > 18 && s.skill > 0.65 && s.mode === MODE.GROUND && (!tq || td > 12)) btn |= BTN.boost;
  }
  // stuck against something: hop and pick a new heading
  const sp = hyp(s.vx, s.vz);
  if (s.mode === MODE.GROUND && md > 2 && sp < 1.2) { B.stuck += DT; if (B.stuck > 0.6) { B.stuck = 0; B.unstuck = 0.7; B.wander = RNG() * TAU; B.jump = 8; } }
  else B.stuck = 0;
  // ── ollies and tricks (Adrenaline)
  if (B.jump > 0) { B.jump--; btn |= BTN.jump; }
  else if (s.mode === MODE.GROUND && sp > 7 && RNG() < 0.006 + s.skill * 0.006) B.jump = 3 + Math.floor(RNG() * 12);
  // trick only when there's air to finish it (estimated time to land)
  const below = s.mode === MODE.AIR ? groundAt(R.W, s.x, s.z, s.y + 0.1) : s.y, h = Math.max(0, s.y - below);
  const tLand = (s.vy + Math.sqrt(Math.max(0, s.vy * s.vy + 2 * AIR_G * h))) / AIR_G;
  if (s.mode === MODE.AIR && !s.trick && !s.plant && s.airT > 0.04 && tLand > 0.62 + (1 - s.skill) * 0.25 && RNG() < s.skill * 0.2) {
    btn |= BTN.trick; B.trickDir = pickTrickDir(tLand);
  }
  if (s.mode === MODE.AIR && !s.trick && !s.plant && s.lipP && s.y > s.lipP.lipH && s.vy < 2 && RNG() < 0.08 * s.skill) { btn |= BTN.trick; B.trickDir = -1; }
  if ((s.btn & BTN.trick) && s.mode === MODE.AIR) { const d = TRICK_DIRS[B.trickDir] || [0, 0]; mx = d[0]; my = d[1]; }
  // ── pick up
  // ── fight
  // early on bots scramble for gear and only fight back; from 12 s they pick fights inside their engage radius
  const provoked = tq && s.lastBy === tq.i && t - s.lastByT < 2.5;
  const hostile = tq && (provoked || (t >= 15 && td <= engageR + 3) || (t >= 44));
  if (tq && t > WARMUP && hostile) {
    const dy = Math.abs(tq.y - s.y), facing = Math.abs(angDiff(yawOf(tq.x - s.x, tq.z - s.z), aimYaw)) < 0.5;
    const wantRanged = s.ranged && s.ammo > 0 && B.los && td > (B.brawl ? 4.5 : 2.4) && td < Math.min(WEAPONS[s.ranged].range * 0.8, s.ranged === 'revolver' ? 26 : 18);
    if (s.adren >= 100 && td < 3.8 && dy < 2 && !(s.prevBtn & BTN.trick)) btn |= BTN.trick;
    else if (s.slot === 1 && s.ranged && wantRanged && facing) {
      B.fireT -= DT;
      const auto = AUTO_FIRE[s.ranged];
      if (auto ? B.fireT < 0.45 : !(s.prevBtn & BTN.attack) && RNG() < 0.05 + s.skill * 0.1) btn |= BTN.attack;
      if (B.fireT < 0) B.fireT = 0.9 + RNG() * 0.6;
    } else if (td < (B.swingAt || 2) && dy < 1.8 && facing && !s.atk && !(s.prevBtn & BTN.attack) && B.retreat <= 0) {
      // timing a swing from a moving board is hard: bots commit at a slightly random distance and often whiff
      btn |= BTN.attack; B.retreat = 0.8 + RNG() * 1.0 - s.skill * 0.3; B.side = RNG() < 0.5 ? -1 : 1;
      B.swingAt = WEAPONS[s.melee || 'bat'].reach + 0.3 + (RNG() - 0.35) * (2.6 - s.skill * 1.4);
    }
    if (s.thr && !(s.prevBtn & BTN.throw)) {
      if (s.thr === 'shove' ? td < 2 && RNG() < 0.03 : td > 6 && td < 15 && B.los && RNG() < 0.02 + s.skill * 0.02) { btn |= BTN.throw; pitch = s.thr === 'shove' ? pitch : clamp((td - 8) * 0.03, -0.2, 0.35); }
    }
  }
  ({ mx, my, btn } = botGrind(R, s, B, mx, my, btn));
  return { mx, my, yaw: aimYaw, pitch, btn, lag: 0 };
}

// ── free ride: no fighting at all. Bots pick a ramp, quarter pipe or open spot, skate at it, ollie and trick
// off whatever they launch from, and occasionally just cruise around.
function freeRideBot(R, s) {
  const W = R.W, B = s.bot || (s.bot = { goal: null, think: 0, stuck: 0, unstuck: 0, wander: RNG() * TAU, jump: 0, trickDir: 0, chill: 0 });
  let btn = 0, mx = 0, my = 0;
  const sp = hyp(s.vx, s.vz);
  B.think -= DT;
  const reached = B.goal && hyp(B.goal[0] - s.x, B.goal[1] - s.z) < 2.5;
  if (!B.goal || reached || B.think <= 0) {
    B.think = 3.5 + RNG() * 3;
    const ramps = W.prims.filter((p) => !p.gone && (p.type === 'slope' || p.type === 'qp'));
    if (ramps.length && RNG() < 0.7) {
      const p = ramps[Math.floor(RNG() * ramps.length)];
      // approach up the ramp: aim through it along its rising direction so we launch off the lip
      const fy = p.type === 'qp' ? p.yaw : (p.h1 >= p.h0 ? p.yaw : p.yaw + PI);
      const fx = DM.sin(fy || 0), fz = DM.cos(fy || 0);
      B.goal = [p.cx + fx * (p.d || 4) * 0.8, p.cz + fz * (p.d || 4) * 0.8];
    } else { const a = RNG() * TAU, r = RNG() * W.half * 0.7; B.goal = [DM.sin(a) * r, DM.cos(a) * r]; }
    // only ride at somewhere that has something to land on (rooftops / the pier have open air between them)
    if (!W.floor && groundAt(W, B.goal[0], B.goal[1], 60) < W.killY + 1.5) B.goal = null;
    B.chill = RNG() < 0.15 ? 1 + RNG() * 2 : 0; // sometimes just roll along for a bit
  }
  if (!B.goal) { B.think = 0; B.goal = [s.x + DM.sin(s.yaw) * 4, s.z + DM.cos(s.yaw) * 4]; }
  let gx = B.goal[0], gz = B.goal[1];
  if (B.unstuck > 0) { B.unstuck -= DT; gx = s.x + DM.sin(B.wander) * 10; gz = s.z + DM.cos(B.wander) * 10; }
  const mdx = gx - s.x, mdz = gz - s.z, md = hyp(mdx, mdz);
  const aimYaw = md > 0.1 ? yawOf(mdx, mdz) : s.yaw;
  if (B.chill > 0) { B.chill -= DT; my = sp < 7.5 ? 1 : 0; }
  else if (md > 0.8) {
    const ux = mdx / md, uz = mdz / md, sy = DM.sin(aimYaw), cy = DM.cos(aimYaw);
    my = ux * sy + uz * cy; mx = -(ux * cy) + uz * sy;
    if (md > 14 && s.mode === MODE.GROUND && s.skill > 0.6) btn |= BTN.boost;
  }
  if (s.mode !== MODE.AIR && sp < 2 && B.chill <= 0) { B.stuck += DT; if (B.stuck > 0.45) { B.stuck = 0; B.unstuck = 0.8; B.wander = RNG() * TAU; B.jump = 8; B.goal = null; } }
  else B.stuck = 0;
  // ollies on the flat, and a charged pop as they hit a ramp
  if (B.jump > 0) { B.jump--; btn |= BTN.jump; }
  else if (s.mode === MODE.GROUND && sp > 6 && RNG() < 0.012) B.jump = 3 + Math.floor(RNG() * 14);
  else if (s.mode === MODE.GROUND && s.onPrim && s.onPrim.type === 'slope' && s.ny < 0.97 && sp > 6 && RNG() < 0.08) B.jump = 40; // carry a charge up the ramp, pop at the lip
  // tricks whenever there's air to land them
  const below = s.mode === MODE.AIR ? groundAt(W, s.x, s.z, s.y + 0.1) : s.y, h = Math.max(0, s.y - below);
  const tLand = (s.vy + Math.sqrt(Math.max(0, s.vy * s.vy + 2 * AIR_G * h))) / AIR_G;
  if (s.mode === MODE.AIR && !s.trick && !s.plant && s.airT > 0.04 && tLand > 0.6 && RNG() < 0.25) { btn |= BTN.trick; B.trickDir = pickTrickDir(tLand); }
  if (s.mode === MODE.AIR && !s.trick && !s.plant && s.lipP && s.y > s.lipP.lipH && s.vy < 2 && RNG() < 0.15) { btn |= BTN.trick; B.trickDir = -1; } // handplant
  if ((s.btn & BTN.trick) && s.mode === MODE.AIR) { const d = TRICK_DIRS[B.trickDir] || [0, 0]; mx = d[0]; my = d[1]; }
  ({ mx, my, btn } = botGrind(R, s, B, mx, my, btn, 0.7));
  return { mx, my, yaw: aimYaw, pitch: 0, btn, lag: 0 };
}

// trick stick directions: ← → ↓ ↑, then the diagonals ↖ ↗ ↙ ↘ (the big ones, only with plenty of air)
const TRICK_DIRS = [[-1, 0], [1, 0], [0, -1], [0, 1], [-0.75, 0.75], [0.75, 0.75], [-0.75, -0.75], [0.75, -0.75]];
function pickTrickDir(tLand) { return tLand > 1.15 && RNG() < 0.7 ? 4 + Math.floor(RNG() * 4) : tLand > 0.85 ? Math.floor(RNG() * 4) : Math.floor(RNG() * 2); }

// grinding is never automatic: bots hold ↑ + trick like players do — sometimes as they ollie onto a ledge,
// sometimes as they come down near a rail (decided once per jump)
function botGrind(R, s, B, mx, my, btn, keen = 0.45) {
  if (s.mode === MODE.GRIND) { // ride it for a bit, then pop off
    if (!B.gMax) { B.gMax = 0.5 + RNG() * 1.8; B.gT = 0; }
    B.gT += DT; B.gAir = false;
    return { mx, my, btn: B.gT > B.gMax ? btn | BTN.jump : btn & ~BTN.jump };
  }
  B.gMax = 0;
  if (s.adren >= 100 || s.plant) { B.gAir = false; return { mx, my, btn }; }
  if (s.mode === MODE.AIR) {
    if (!B.gAir) { B.gAir = true; B.gPlan = RNG() < keen; }
    if (B.gPlan && !s.trick && edgeNear(s, R.W, 2.0, -1.4, 1.7)) return { mx: 0, my: 1, btn: btn | BTN.trick };
  } else {
    B.gAir = false;
    if (s.mode === MODE.GROUND && hyp(s.vx, s.vz) > 5 && RNG() < keen * 0.04) {
      const e = edgeNear(s, R.W, 1.5, -0.3, 1.5);
      if (e) { const g = e[0].seg[e[1]], uh = hyp(g.ux, g.uz), sp = hyp(s.vx, s.vz); if (uh > 0.2 && Math.abs(s.vx * g.ux + s.vz * g.uz) / (uh * sp) > 0.7) return { mx: 0, my: 1, btn: btn | BTN.trick }; }
    }
  }
  return { mx, my, btn };
}
