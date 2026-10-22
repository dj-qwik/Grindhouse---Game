// ───────────────────────── ROUND: the one step function the server and every browser run ─────────────────────────
// A Grindhouse match is ONE round (bible §1, §20): last skater standing, decided by 60.0 s at the latest.
// It is fully determined by (arena key, seed, roster, inputs per tick). The server runs it to decide the winner;
// browsers run the identical code on the server's input stream to draw it; co-signers replay it before paying.
/**
 * cfg: { key, seed, players: [{ i, name, look?, human?, skill? }], botSalt? }
 * rng (anti-peeking): the seed never leaves the server. Server: { record: [] } logs every random draw (uint32);
 *  browsers: { feed: () => uint32 } replays them as they arrive. Omit both offline (local seeded stream).
 */
function createRound(cfg, rng = {}) {
  const src = makeRng(cfg.seed ?? 0);
  if (rng.feed) RNG = () => rng.feed() / 4294967296;
  else if (rng.record) { const log = rng.record; RNG = () => { const v = src(); log.push(v * 4294967296); return v; }; }
  else RNG = src;
  const botRng = makeRng('bots:' + (cfg.seed ?? 0) + ':' + (cfg.botSalt ?? ''));
  const A = ARENAS[cfg.key];
  if (!A) throw new Error('unknown arena ' + cfg.key);
  const variant = Math.floor(RNG() * (A.variants || 1));
  const W = A.build(variant);
  W.variant = variant;
  const sk = cfg.players.map((p) => Object.assign(makeSkater(p.i, p.look ?? (p.i % SKATERS.length), p.name || SKATERS[(p.look ?? p.i) % SKATERS.length].name), {
    human: !!p.human, skill: p.skill ?? 0.8,
  }));
  // spawns: a circular spread, shuffled; everyone faces the centre
  const spots = shuffleWith(RNG, W.spawns.map((_, k) => k));
  sk.forEach((s, k) => {
    const sp = W.spawns[spots[k % spots.length]];
    s.x = sp[0]; s.z = sp[1]; s.y = groundAt(W, s.x, s.z, 50); if (s.y < -1e8) s.y = 0;
    s.yaw = sp[2] ?? yawOf(-s.x, -s.z); s.aimYaw = s.yaw;
    for (let j = 0; j < HIST; j++) { s.hx[j] = s.x; s.hy[j] = s.y; s.hz[j] = s.z; }
  });
  const tieOrder = shuffleWith(RNG, sk.map((s) => s.i)); // the published last-resort tiebreak
  const tieRank = new Map(tieOrder.map((i, k) => [i, k]));
  const R = {
    key: cfg.key, def: A, arena: W, W, sk, tick: 0, t: 0, proj: [], fires: [], picks: [], nextId: 1, dying: [],
    events: [], poops: [], free: !!cfg.free, wave: 0, lastPulse: -9, winner: null, firstBlood: false, said: {}, zoneNow: zoneAt(W, 0), tieOrder, variant, done: false,
    get alive() { let n = 0; for (const s of sk) if (s.alive) n++; return n; },
  };
  if (A.init) A.init(R);
  if (R.free) R.zoneNow = { x: 0, z: 0, r: 999 }; // free ride: no squeeze, no clock, no damage, no pickups
  // free ride on arenas without a ground floor (rooftops, the pier): open air and water are walled off, invisibly.
  // Nobody can roll, ollie or get pushed off the edge of a structure.
  let probeY = 0;
  const solidBelow = (x, z) => groundAt(W, x, z, probeY) > W.killY + 1.5;
  const keepOnMap = (s) => {
    probeY = Math.max(s.y, s.fy0) + 1.2;
    if (!solidBelow(s.x, s.z)) {
      if (solidBelow(s.x, s.fz0)) { s.z = s.fz0; s.vz = -s.vz * 0.2; }
      else if (solidBelow(s.fx0, s.z)) { s.x = s.fx0; s.vx = -s.vx * 0.2; }
      else { s.x = s.fx0; s.z = s.fz0; s.vx = -s.vx * 0.2; s.vz = -s.vz * 0.2; }
    }
    // never sink into the edge of a deck or ramp you're coming down onto (or were just pushed back over)
    if (s.mode === MODE.AIR && s.vy <= 0) { const g = groundAt(W, s.x, s.z, Math.max(s.y, s.fy0) + 0.3); if (g > s.y - 0.02 && g - s.y < 1.2) land(s, g); }
  };

  // …and if anything still slips through (a plank end, a shove), an invisible net puts you back where you last rode
  const netCatch = (s) => {
    if (s.mode === MODE.GROUND && R.tick % 20 === 0) { s.safe = s.safe1 || [s.x, s.y, s.z]; s.safe1 = [s.x, s.y, s.z]; }
    if (!s.safe || s.mode === MODE.GROUND || s.y > s.safe[1] - 1.2) return;
    probeY = s.y + 0.1; if (solidBelow(s.x, s.z)) return;
    s.x = s.safe[0]; s.y = s.safe[1]; s.z = s.safe[2]; s.vx = 0; s.vy = 0; s.vz = 0; s.mode = MODE.GROUND; s.trick = null; s.rail = null; s.fell = false;
    R.netCatches = (R.netCatches || 0) + 1; s.netTick = R.tick; if (R.netLog) R.netLog.push(`${s.x.toFixed(0)},${s.z.toFixed(0)}@${s.safe[1].toFixed(1)}`);
  };
  const respawn = (s) => { // last-resort safety net // free ride: falling off the map just drops you back in at a spawn point
    const sp = W.spawns[Math.floor(RNG() * W.spawns.length)];
    s.x = sp[0]; s.z = sp[1]; s.y = groundAt(W, s.x, s.z, 50); if (s.y < -1e8) s.y = 0;
    s.vx = 0; s.vy = 0; s.vz = 0; s.fell = false; s.mode = MODE.GROUND; s.hp = 100; s.deuce = null; s.slipT = 0; s.trick = null; s.rail = null;
    s.yaw = sp[2] ?? yawOf(-s.x, -s.z);
  };
  const rank = (a, b) => (b.hpPrev - a.hpPrev) || (b.kills - a.kills) || (b.dmg - a.dmg) || (tieRank.get(a.i) - tieRank.get(b.i));
  const rankLive = (a, b) => (b.hp - a.hp) || (b.kills - a.kills) || (b.dmg - a.dmg) || (tieRank.get(a.i) - tieRank.get(b.i));

  function eliminate(s, place) {
    s.alive = false; s.place = place; s.deathT = R.t; s.deathTick = R.tick; s.hp = Math.min(s.hp, 0);
    const credit = R.t - s.lastByT < 6 && s.lastBy >= 0 && s.lastBy !== s.i ? s.lastBy : -1;
    s.killer = credit; s.killWeapon = s.fell ? 'fell' : s.lastDmgKind || 'hazard';
    if (credit >= 0) sk[credit].kills++;
    const W2 = WEAPONS[s.killWeapon];
    const kind = s.fell ? 'fell' : W2 ? W2.kill : s.killWeapon === 'signature' ? 'blunt' : s.killWeapon === 'rail' ? 'rail' : 'hazard';
    s.killKind = kind;
    dropPickup(R, s.ranged, s.x, s.y, s.z, s.ammo); dropPickup(R, s.melee, s.x + 0.6, s.y, s.z, 0);
    s.ranged = null; s.melee = null; s.thr = null; s.atk = null; s.rail = null; s.mode = MODE.DOWN;
    R.events.push({ k: 'elim', tick: R.tick, v: s.i, by: credit, w: s.killWeapon, kind });
    killFeed(s.i, credit, s.killWeapon, kind);
    if (!R.firstBlood) { R.firstBlood = true; announce('FIRST BLOOD'); }
  }

  return Object.assign(R, {
    /** inputs: { [seat]: packedNumber }. Missing seats are played by bots (their own RNG stream) and written
     *  back into `inputs`, so the server can broadcast exactly what it applied. */
    step(inputs) {
      if (R.winner) return R.winner;
      R.tick++; R.t = R.tick / TICK_HZ;
      for (const s of sk) {
        s.hpPrev = s.hp;
        let p = s.alive ? inputs[s.i] : IDLE_INPUT;
        if (p == null) {
          const keep = RNG; RNG = botRng;
          try { p = packInput(botInput(R, s)); } finally { RNG = keep; }
          inputs[s.i] = p;
        } else if (!validInput(p)) p = IDLE_INPUT;
        if (!s.alive) inputs[s.i] = p;
        const u = unpackInput(p);
        s.mx = u.mx; s.my = u.my; s.aimYaw = u.yaw; s.aimPitch = u.pitch; s.lag = u.lag;
        s.btn = s.alive ? u.btn : 0;
        if (R.free) s.btn &= ~(BTN.attack | BTN.throw);
        s.press = s.btn & ~s.prevBtn;
      }
      if (R.free) { // free ride: just skating (and the occasional deuce)
        for (const s of sk) { s.fx0 = s.x; s.fz0 = s.z; s.fy0 = s.y; s.fm0 = s.mode; }
        for (const s of sk) stepSkater(s, W, R.t);
        separateSkaters(sk);
        for (const s of sk) { keepOnMap(s); netCatch(s); } // open air, water and pits are walled off
        for (const s of sk) if ((s.press & BTN.trick) && s.adren >= 100 && s.mode !== MODE.DOWN) signature(R, s); // Super Slam: bowls everyone over, no damage sticks
        stepDeuces(R);
        for (const s of sk) { if (s.fell) { R.respawns = (R.respawns || 0) + 1; s.lastRespawn = R.tick; respawn(s); } s.hp = 100; s.prevBtn = s.btn; recordHist(s, R.tick); }
        return null;
      }
      // pickup waves (telegraphed ahead) and the announcer's beats
      while (R.wave < PICKUP_WAVES.length && R.t >= PICKUP_WAVES[R.wave].t - TELEGRAPH) spawnWave(R, PICKUP_WAVES[R.wave++]);
      for (const [at, line] of [[40, 'SUDDEN DEATH'], [50, 'FINAL CORE']]) if (R.t >= at && !R.said[line]) { R.said[line] = 1; announce(line); }
      if (A.update) A.update(R, DT);
      for (const s of sk) stepSkater(s, W, R.t);
      separateSkaters(sk);
      for (const s of sk) stepCombat(R, s);
      stepProjectiles(R);
      stepPickups(R);
      stepDeuces(R);
      if (A.after) A.after(R, DT);
      stepZone(R);
      for (const s of sk) {
        if (s.alive && s.fell && !R.dying.includes(s)) { s.hazKind = 'fell'; R.dying.push(s); }
        s.prevBtn = s.btn; recordHist(s, R.tick);
      }
      // simultaneous eliminations: everyone who dropped this tick goes out together, best-ranked last
      if (R.dying.length) {
        const dying = R.dying.filter((s) => s.alive).sort(rank); R.dying = [];
        const left = R.alive - dying.length;
        if (left <= 0) { // nobody survives this tick: the best of them (health before the tick, kills, damage, seed) wins
          const w = dying[0];
          dying.slice(1).forEach((s, k) => eliminate(s, 2 + k));
          w.place = 1; R.winner = w; w.hp = Math.max(w.hp, 0);
        } else dying.forEach((s, k) => eliminate(s, left + 1 + k));
        const n = R.alive;
        if (n === 4 && sk.length > 4 && !R.said.f4) { R.said.f4 = 1; announce('FINAL FOUR'); }
      }
      if (!R.winner) {
        const live = sk.filter((s) => s.alive);
        if (live.length === 1) { R.winner = live[0]; live[0].place = 1; }
        else if (R.tick >= MAX_TICKS) { // 60.0 s: the server ranks survivors by health → eliminations → damage → seeded order
          live.sort(rankLive); live.forEach((s, k) => { s.place = k + 1; });
          R.winner = live[0]; R.timeout = true;
        }
      }
      if (R.winner) { R.done = true; announce('WINNER'); }
      return R.winner;
    },
    /** After the result: bodies settle and the winner rolls on (visual only; the round is already decided). */
    coast() {
      const keep = RNG; RNG = makeRng('coast');
      try { for (const s of sk) { s.btn = 0; s.press = 0; s.mx = 0; s.my = 0; if (s.alive) stepSkater(s, W, R.t); else stepCorpse(s, W); } } finally { RNG = keep; }
    },
    /** Browser-side prediction: a copy of skater `i` moved through `inputs` (packed, oldest first) with movement
     *  only — no combat, no effects, no RNG. Display only; the confirmed simulation stays authoritative. */
    predict(i, inputs) {
      const s = sk[i]; if (!s || !s.alive) return null;
      const c = Object.assign({}, s, { pred: true, combo: s.combo.slice(), hist: s.hist.slice(), atk: s.atk ? { ...s.atk, hit: s.atk.hit.slice() } : null, deuce: s.deuce ? { ...s.deuce } : null, plant: s.plant ? { ...s.plant } : null });
      let t = R.t;
      for (const p of inputs) {
        const u = unpackInput(p);
        c.mx = u.mx; c.my = u.my; c.aimYaw = u.yaw; c.aimPitch = u.pitch; c.btn = u.btn; c.press = u.btn & ~c.prevBtn;
        t += DT; stepSkater(c, W, t); c.prevBtn = c.btn;
      }
      return c;
    },
    /** Exact fingerprint of the simulation state (positions, velocities, health, weapons, projectiles). */
    hash() {
      const n = [R.t, R.proj.length, R.picks.length, R.fires.length, R.poops.length];
      for (const s of sk) n.push(s.x, s.y, s.z, s.vx, s.vy, s.vz, s.yaw, s.hp, s.alive ? 1 : 0, s.mode, s.adren, s.ammo, s.kills, s.dmg, s.slot, s.ranged ? s.ranged.length : 0, s.melee ? s.melee.length : 0);
      for (const p of R.proj) n.push(p.x, p.y, p.z);
      for (const p of W.prims) if (p.vx || p.vz || p.gone) n.push(p.cx, p.cz, p.gone ? 1 : 0);
      return hashNums(n);
    },
    /** Final standings for the results screen and evidence. */
    standings() {
      return sk.map((s) => ({ i: s.i, place: s.place, kills: s.kills, dmg: Math.round(s.dmg), hp: Math.max(0, Math.ceil(s.hp)), deathT: s.deathT, by: s.killer, w: s.killWeapon })).sort((a, b) => a.place - b.place);
    },
  });
}
