// ───────────────────────── BOTS: practice opponents and empty free-play seats ─────────────────────────
// Bots run inside the simulation on their own seeded stream, so they replay identically everywhere. They play
// the same game as humans (same inputs, same rules): scavenge, keep inside the zone, fight, trick for Adrenaline.
// Skill (0.55–0.82) sets aim error, reaction time and how often they trick. Cash matches never contain bots.
function botInput(R, s) {
  const B = s.bot || (s.bot = { tgt: -1, think: 0, stuck: 0, unstuck: 0, wander: RNG() * TAU, pick: -1, aimErr: 0, hold: 0, jump: 0, trickDir: 0, fireT: 0, los: false, lastSwing: 0 });
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
    // scavenge when under-armed and a pickup is nearer than the fight
    B.pick = -1;
    const tq = best >= 0 ? R.sk[best] : null, td = tq ? hyp(tq.x - s.x, tq.z - s.z) : 99;
    if (!s.ranged || s.melee === 'bat' || (s.thr === 'shove' && RNG() < 0.3)) {
      let pd = 22;
      for (const p of R.picks) {
        if (t < p.t0 - 0.6) continue;
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
  if (outside) { gx = Z.x; gz = Z.z; }
  else if (pick && chaseOk(pick.x, pick.z)) { gx = pick.x; gz = pick.z; }
  else if (tq && chaseOk(tq.x, tq.z)) {
    if (s.ranged && B.los && td < WEAPONS[s.ranged].range * 0.6) { // hold a firing distance, circle a little
      const ang = yawOf(s.x - tq.x, s.z - tq.z) + 0.5, keep = s.ranged === 'sawoff' ? 5 : 10;
      gx = tq.x + Math.sin(ang) * keep; gz = tq.z + Math.cos(ang) * keep;
    } else { gx = tq.x + tq.vx * 0.3; gz = tq.z + tq.vz * 0.3; }
  }
  if (B.unstuck > 0) { B.unstuck -= DT; gx = s.x + Math.sin(B.wander) * 10; gz = s.z + Math.cos(B.wander) * 10; }
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
  const tLand = (s.vy + Math.sqrt(Math.max(0, s.vy * s.vy + 2 * G * h))) / G;
  if (s.mode === MODE.AIR && !s.trick && s.airT > 0.04 && tLand > 0.62 + (1 - s.skill) * 0.25 && RNG() < s.skill * 0.2) {
    btn |= BTN.trick; B.trickDir = tLand > 0.85 ? Math.floor(RNG() * 4) : Math.floor(RNG() * 2);
  }
  if ((s.btn & BTN.trick) && s.mode === MODE.AIR) { mx = B.trickDir === 0 ? -1 : B.trickDir === 1 ? 1 : 0; my = B.trickDir === 2 ? -1 : B.trickDir === 3 ? 1 : my; }
  // ── pick up
  if (pick && hyp(pick.x - s.x, pick.z - s.z) < 1.6 && t >= pick.t0 && !(s.prevBtn & BTN.use)) btn |= BTN.use;
  // ── fight
  if (tq && t > WARMUP) {
    const dy = Math.abs(tq.y - s.y), facing = Math.abs(angDiff(yawOf(tq.x - s.x, tq.z - s.z), aimYaw)) < 0.5;
    const wantRanged = s.ranged && B.los && td > 2.6 && td < WEAPONS[s.ranged].range * 0.8;
    if (wantRanged && s.slot === 0 && !(s.prevBtn & BTN.swap)) btn |= BTN.swap;
    else if (!wantRanged && s.slot === 1 && td < 3 && !(s.prevBtn & BTN.swap)) btn |= BTN.swap;
    if (s.adren >= 100 && td < 3.8 && dy < 2 && !(s.prevBtn & BTN.attack)) btn |= BTN.alt | BTN.attack;
    else if (s.slot === 1 && s.ranged && wantRanged && facing) {
      B.fireT -= DT;
      const auto = AUTO_FIRE[s.ranged];
      if (auto ? B.fireT < 0.45 : !(s.prevBtn & BTN.attack) && RNG() < 0.05 + s.skill * 0.1) btn |= BTN.attack;
      if (B.fireT < 0) B.fireT = 0.9 + RNG() * 0.6;
    } else if (td < WEAPONS[s.melee || 'bat'].reach + 0.7 && dy < 1.8 && facing && !s.atk && !(s.prevBtn & BTN.attack) && RNG() < 0.06 + s.skill * 0.12) btn |= BTN.attack;
    if (s.thr && !(s.prevBtn & BTN.throw)) {
      if (s.thr === 'shove' ? td < 2 && RNG() < 0.03 : td > 6 && td < 15 && B.los && RNG() < 0.02 + s.skill * 0.02) { btn |= BTN.throw; pitch = s.thr === 'shove' ? pitch : clamp((td - 8) * 0.03, -0.2, 0.35); }
    }
  }
  return { mx, my, yaw: aimYaw, pitch, btn, lag: 0 };
}
