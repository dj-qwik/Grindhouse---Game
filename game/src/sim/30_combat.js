// ───────────────────────── COMBAT: melee, guns, throwables, pickups, damage (bible §7–10) ─────────────────────────
// Everything here is server-authoritative by construction: the server and every browser run this same code on
// the same input stream. Hit checks use where targets were `lag` ticks ago (the attacker's view), so what a
// player aimed at is what they hit (bounded at 15 ticks = 250 ms).
const MELEE_POOL = ['pipe', 'katana', 'cleaver', 'whip', 'baton', 'hammer'];
const LOOT = {
  common: ['pipe', 'whip', 'baton', 'nailgun', 'smg', 'molotov'],
  uncommon: ['katana', 'cleaver', 'sawoff', 'revolver', 'grenade'],
  rare: ['pipebomb', 'buzzsaw', 'hammer'],
  legendary: ['rocket'],
};
const AUTO_FIRE = { nailgun: true, smg: true };

function stepCombat(R, s) {
  if (!s.alive) return;
  const dt = DT, btn = s.btn, press = s.press;
  s.fireCd -= dt; s.bankT += dt;
  s.altT = btn & BTN.alt ? s.altT + dt : 0;
  if (s.mode === MODE.DOWN) { s.atk = null; return; }
  if ((press & BTN.throw) && s.thr && s.stagger <= 0) { doThrow(R, s); return; }
  // the trick button doubles as the Signature Slam once Adrenaline is full
  if ((press & BTN.trick) && s.adren >= 100 && s.stagger <= 0) { signature(R, s); return; }
  if ((press & BTN.attack) && (btn & BTN.alt) && s.adren >= 100 && s.stagger <= 0) { signature(R, s); return; }
  // one attack button: the gun when you have one, the melee weapon when someone is in swinging range in front
  if (!s.atk) s.slot = chooseSlot(R, s);
  if (s.slot === 1 && s.ranged) fireRanged(R, s, btn, press);
  else meleeStep(R, s, press);
}
function chooseSlot(R, s) {
  if (!s.ranged || s.ammo <= 0) return 0;
  const reach = WEAPONS[s.melee || 'bat'].reach + 0.8;
  for (const q of R.sk) {
    if (q === s || !q.alive) continue;
    const dx = q.x - s.x, dz = q.z - s.z, d = hyp(dx, dz);
    if (d < reach && Math.abs(q.y - s.y) < 1.8 && (d < 0.8 || Math.abs(angDiff(yawOf(dx, dz), s.aimYaw)) < 0.9)) return 0;
  }
  return 1;
}
const RARITY_RANK = { starter: 0, common: 1, uncommon: 2, rare: 3, legendary: 4 };
/** Would rolling over this weapon be an upgrade? (empty slot, better rarity, or the same gun = ammo refill) */
function wantsPickup(s, w, ammo) {
  const Wp = WEAPONS[w], rank = (id) => (id ? RARITY_RANK[WEAPONS[id].rarity] : -1);
  if (Wp.cls === 'melee') return !s.melee || rank(w) > rank(s.melee);
  if (Wp.cls === 'throw') return !s.thr || rank(w) > rank(s.thr);
  if (!s.ranged || s.ammo <= 0) return true;
  if (s.ranged === w) return (ammo || Wp.ammo) > s.ammo;
  return rank(w) > rank(s.ranged);
}

// ── melee: an arc swept over the active window; one hit per target per swing
function meleeStep(R, s, press) {
  if (!s.atk) {
    if (!(press & BTN.attack) || s.fireCd > 0 || s.stagger > 0) return;
    const w = s.melee || 'bat';
    s.atk = { w, t: 0, hit: [], charged: s.altT >= 0.6, missed: true };
    s.manual = 0;
    sk_sfx(s, WEAPONS[w].sfx, 0.8);
  }
  const A = s.atk, Wp = WEAPONS[A.w];
  A.t += DT;
  if (A.t >= Wp.wind && A.t < Wp.wind + Wp.act) meleeHits(R, s, A, Wp);
  const total = Wp.wind + Wp.act + Wp.rec + (A.missed && Wp.missRec ? Wp.missRec : 0);
  if (A.t >= total) s.atk = null;
}
function meleeHits(R, s, A, Wp) {
  const ox = s.x, oy = s.y + 1.1, oz = s.z, reach = Wp.reach * (A.charged ? 1.1 : 1);
  for (const q of R.sk) {
    if (q === s || !q.alive || A.hit.includes(q.i)) continue;
    lagPos(q, R.tick, s.lag);
    const tx = LGX, ty = LGY + 1.0, tz = LGZ, dx = tx - ox, dz = tz - oz, dh = hyp(dx, dz);
    if (dh > reach + SK_R || Math.abs(ty - oy) > 1.9) continue;
    if (dh > 0.6 && Math.abs(angDiff(yawOf(dx, dz), s.aimYaw)) > Wp.arc / 2) continue;
    if (!lineOfSight(R.W, ox, oy, oz, tx, ty, tz)) continue;
    A.hit.push(q.i); A.missed = false;
    let dmg = (A.charged ? (Wp.charge || Wp.dmg * 1.35) : Wp.dmg) + Math.min(Wp.spd, hyp(s.vx, s.vz) * 0.55);
    let knock = Wp.knock * (A.charged ? 1.5 : 1);
    if (s.adren >= 50) { dmg *= 1.2; knock *= 1.3; s.adren -= 25; s.adrenBoost = true; }
    const nx = dh > 1e-4 ? dx / dh : Math.sin(s.aimYaw), nz = dh > 1e-4 ? dz / dh : Math.cos(s.aimYaw);
    if (Wp.shock && (q.trick || q.charge >= 0 || q.mode === MODE.GRIND)) { q.trick = null; q.charge = -1; bail(q, 'shock'); }
    damage(R, q, dmg, s, A.w, nx, nz, knock);
  }
}

// ── guns: hitscan (nailgun, SMG, revolver, sawed-off pellets) and projectiles (rocket, buzzsaw)
function fireRanged(R, s, btn, press) {
  const w = s.ranged, Wp = WEAPONS[w];
  const want = AUTO_FIRE[w] ? btn & BTN.attack : press & BTN.attack;
  if (!want || s.fireCd > 0 || s.stagger > 0 || s.ammo <= 0) return;
  s.fireCd = Wp.rate; s.ammo--; s.manual = 0;
  const aim = btn & BTN.alt ? 0.5 : 1, air = s.mode === MODE.AIR ? 1.3 : 1;
  const ox = s.x + Math.sin(s.aimYaw) * 0.35, oy = s.y + 1.35, oz = s.z + Math.cos(s.aimYaw) * 0.35;
  sk_sfx(s, Wp.sfx, 1);
  if (Wp.proj) {
    const cp = Math.cos(s.aimPitch);
    const dx = Math.sin(s.aimYaw) * cp, dy = Math.sin(s.aimPitch), dz = Math.cos(s.aimYaw) * cp;
    R.proj.push({ k: w, o: s.i, x: ox, y: oy, z: oz, vx: dx * Wp.proj, vy: dy * Wp.proj, vz: dz * Wp.proj, t: 0, b: Wp.bounces || 0, lag: s.lag, id: R.nextId++ });
    if (w === 'rocket') { s.vx -= dx * 2.5; s.vz -= dz * 2.5; } // a little kick
  } else {
    const n = Wp.pellets || 1;
    for (let k = 0; k < n; k++) {
      const sp = Wp.spread * aim * air;
      const yaw = s.aimYaw + (RNG() - 0.5) * 2 * sp, pitch = s.aimPitch + (RNG() - 0.5) * 2 * sp * 0.6;
      const cp = Math.cos(pitch), dx = Math.sin(yaw) * cp, dy = Math.sin(pitch), dz = Math.cos(yaw) * cp;
      hitscan(R, s, w, Wp, ox, oy, oz, dx, dy, dz);
    }
  }
  if (s.ammo <= 0) { s.ranged = null; s.slot = 0; s.fireCd = Math.max(s.fireCd, 0.25); }
}
function hitscan(R, s, w, Wp, ox, oy, oz, dx, dy, dz) {
  const wd = raycast(R.W, ox, oy, oz, dx, dy, dz, Wp.range);
  let best = null, bd = wd;
  for (const q of R.sk) {
    if (q === s || !q.alive) continue;
    lagPos(q, R.tick, s.lag);
    const r = segSegDist(ox, oy, oz, ox + dx * wd, oy + dy * wd, oz + dz * wd, LGX, LGY + 0.35, LGZ, LGX, LGY + 1.55, LGZ);
    if (r.d < 0.5 && r.s * wd < bd) { bd = r.s * wd; best = q; }
  }
  if (!s.pred) vfx('tracer', ox, oy, oz, ox + dx * bd, oy + dy * bd, oz + dz * bd, w, best ? 1 : 0);
  if (!best) { if (bd < Wp.range && !s.pred) vfx('spark', ox + dx * bd, oy + dy * bd, oz + dz * bd); return; }
  let dmg = Wp.dmg;
  if (Wp.far) dmg *= 1 - clamp((bd - Wp.near) / (Wp.far - Wp.near), 0, 1) * 0.85;
  damage(R, best, dmg, s, w, dx, dz, (Wp.knock || 1.2) / (Wp.pellets || 1));
}

// ── throwables (F): grenade, pipe bomb, molotov; everyone starts with one Shove
function doThrow(R, s) {
  const w = s.thr, Wp = WEAPONS[w];
  s.thr = null; s.fireCd = Math.max(s.fireCd, 0.35);
  if (w === 'shove') { // instant short-range shove
    sk_sfx(s, 'shove', 0.8);
    const fake = { w, t: 0, hit: [], charged: false, missed: true };
    meleeHits(R, s, fake, Wp);
    return;
  }
  const pitch = s.aimPitch + 0.28, cp = Math.cos(pitch);
  const dx = Math.sin(s.aimYaw) * cp, dy = Math.sin(pitch), dz = Math.cos(s.aimYaw) * cp;
  R.proj.push({ k: w, o: s.i, x: s.x + dx * 0.5, y: s.y + 1.5, z: s.z + dz * 0.5, vx: dx * Wp.speed + s.vx * 0.5, vy: dy * Wp.speed + Math.max(0, s.vy) * 0.3, vz: dz * Wp.speed + s.vz * 0.5, t: 0, b: 0, stuck: false, lag: s.lag, id: R.nextId++ });
  sk_sfx(s, 'throw', 0.8);
}

function stepProjectiles(R) {
  const W = R.W;
  for (let k = R.proj.length - 1; k >= 0; k--) {
    const p = R.proj[k], Wp = WEAPONS[p.k], owner = R.sk[p.o];
    p.t += DT;
    let dead = false;
    if (Wp.fuse && p.t >= Wp.fuse) { explode(R, p, Wp); dead = true; }
    else if (p.t > 6 || p.y < W.killY - 4) dead = true;
    else if (!p.stuck) {
      const grav = Wp.cls === 'throw' ? G * 0.75 : 0;
      for (let sub = 0; sub < 2 && !dead; sub++) {
        const h = DT / 2;
        p.vy -= grav * h;
        const nx = p.x + p.vx * h, ny = p.y + p.vy * h, nz = p.z + p.vz * h;
        // skaters (not the thrower for the first 0.15 s)
        if (!Wp.sticky) for (const q of R.sk) {
          if (!q.alive || (q.i === p.o && p.t < 0.15)) continue;
          const r = segSegDist(p.x, p.y, p.z, nx, ny, nz, q.x, q.y + 0.35, q.z, q.x, q.y + 1.55, q.z);
          if (r.d > 0.55) continue;
          if (p.k === 'molotov') { p.x = nx; p.y = ny; p.z = nz; shatter(R, p, Wp); dead = true; break; }
          if (p.k === 'grenade') { p.vx *= -0.3; p.vz *= -0.3; break; }
          damage(R, q, Wp.dmg, owner, p.k, p.vx / (hyp(p.vx, p.vz) || 1), p.vz / (hyp(p.vx, p.vz) || 1), Wp.knock);
          if (Wp.splash) explode(R, p, Wp, q);
          vfx('impact', nx, ny, nz, p.k);
          dead = true; break;
        }
        if (dead) break;
        if (solidAt(W, nx, ny, nz) || (W.floor && ny < 0 && !inHole(W, nx, nz) && Math.abs(nx) <= W.half && Math.abs(nz) <= W.half)) {
          if (p.k === 'rocket') { explode(R, p, Wp); dead = true; break; }
          if (p.k === 'molotov') { shatter(R, p, Wp); dead = true; break; }
          if (Wp.sticky) { p.stuck = true; p.vx = p.vy = p.vz = 0; vfx('stick', p.x, p.y, p.z); break; }
          // bounce: find which axis we came through
          const hx = !!solidAt(W, nx, p.y, p.z), hy = !!solidAt(W, p.x, ny, p.z) || (W.floor && ny < 0), hz = !!solidAt(W, p.x, p.y, nz);
          if (p.k === 'buzzsaw') {
            if (p.b <= 0) { vfx('spark', nx, ny, nz); dead = true; break; }
            p.b--; if (hx) p.vx = -p.vx; if (hz) p.vz = -p.vz; if (hy) p.vy = -p.vy; if (!hx && !hz && !hy) { p.vx = -p.vx; p.vz = -p.vz; }
            sfx('ricochet', nx, ny, nz, 0.8); break;
          }
          const damp = 0.45;
          if (hx) p.vx = -p.vx * damp; if (hz) p.vz = -p.vz * damp; if (hy) { p.vy = -p.vy * damp; p.vx *= 0.8; p.vz *= 0.8; }
          if (!hx && !hy && !hz) { p.vx = -p.vx * damp; p.vy = -p.vy * damp; p.vz = -p.vz * damp; }
          if (Math.abs(p.vy) > 2) sfx('clank', p.x, p.y, p.z, 0.5);
          break;
        }
        p.x = nx; p.y = ny; p.z = nz;
      }
    }
    if (dead) R.proj.splice(k, 1);
  }
  // fire zones (molotov): standing in it sets you burning (8/s for 3 s)
  for (let k = R.fires.length - 1; k >= 0; k--) {
    const f = R.fires[k]; f.t += DT;
    if (f.t >= f.dur) { R.fires.splice(k, 1); continue; }
    for (const q of R.sk) if (q.alive && hyp(q.x - f.x, q.z - f.z) < f.r && Math.abs(q.y - f.y) < 1.6) { q.burn = WEAPONS.molotov.burnT; q.burnBy = f.o; }
  }
}
function shatter(R, p, Wp) {
  R.fires.push({ x: p.x, y: Math.max(p.y - 0.3, groundAt(R.W, p.x, p.z, p.y + 0.5)), z: p.z, r: Wp.radius, t: 0, dur: Wp.burnT + 0.5, o: p.o, id: R.nextId++ });
  explode(R, p, Wp);
}
function explode(R, p, Wp, direct = null) {
  const owner = R.sk[p.o], r = Wp.radius || 3, base = Wp.splash || Wp.dmg;
  vfx('explode', p.x, p.y, p.z, r, p.k);
  sfx(p.k === 'molotov' ? 'glass' : 'boom', p.x, p.y, p.z, 1);
  shake(p.k === 'molotov' ? 0.3 : 0.9, p.x, p.y, p.z);
  for (const q of R.sk) {
    if (!q.alive || q === direct) continue;
    const dx = q.x - p.x, dy = q.y + 1 - p.y, dz = q.z - p.z, d = len3(dx, dy, dz);
    if (d >= r) continue;
    if (!lineOfSight(R.W, p.x, p.y + 0.3, p.z, q.x, q.y + 1, q.z)) continue;
    let dmg = base * (1 - d / r);
    if (q.i === p.o) dmg *= 0.5;
    const dh = hyp(dx, dz) || 1;
    damage(R, q, dmg, owner, p.k, dx / dh, dz / dh, (Wp.knock || 6) * (1 - d / r));
  }
}

// ── signature attack: full Adrenaline + alt + attack. A slam that clears space.
function signature(R, s) {
  s.adren = 0; s.atk = null; s.fireCd = 0.6;
  if (s.mode === MODE.GROUND) { s.vy = 5; goAir(s); }
  sk_sfx(s, 'signature', 1); sk_vfx(s, 'signature');
  if (!s.pred) shake(1, s.x, s.y, s.z);
  for (const q of R.sk) {
    if (q === s || !q.alive) continue;
    const dx = q.x - s.x, dz = q.z - s.z, d = hyp(dx, dz);
    if (d > 4.5 || Math.abs(q.y - s.y) > 2.5 || !lineOfSight(R.W, s.x, s.y + 1, s.z, q.x, q.y + 1, q.z)) continue;
    damage(R, q, 35, s, 'signature', dx / (d || 1), dz / (d || 1), 12);
  }
}

// ── damage: the one place health changes
function damage(R, q, amt, src, wid, dx, dz, knock) {
  if (!q.alive || amt <= 0 || R.t < WARMUP) return 0;
  if (q.boostT > 0) amt *= 1.25; // sprint-pushing exposes you
  q.hp -= amt; q.lastDmgKind = wid;
  if (src && src !== q) { src.dmg += amt; q.lastBy = src.i; q.lastByT = R.t; q.lastByW = wid; }
  breakCombo(q);
  if (!knock && amt < 2) { if (q.hp <= 0 && !R.dying.includes(q)) R.dying.push(q); return amt; } // ticking damage: no reaction
  if (amt >= 30 && q.immune <= 0) {
    if (q.mode !== MODE.DOWN) { q.trick = null; q.charge = -1; q.rail = null; q.atk = null; q.mode = MODE.DOWN; q.downT = 0.75; q.bailT = 0; q.why = 'hit'; }
  } else if (amt >= 15) {
    q.stagger = 0.35; q.charge = -1; q.trick = null;
    if (q.atk && q.atk.t < WEAPONS[q.atk.w].wind) q.atk = null;
    if (q.mode === MODE.GRIND) { q.rail = null; q.mode = MODE.AIR; q.lastRail = null; q.railCd = 0.3; }
  } else q.flinch = 0.15;
  if (knock) {
    q.vx += dx * knock; q.vz += dz * knock; q.vy += Math.abs(knock) * 0.22;
    const sp = hyp(q.vx, q.vz); if (sp > 16) { q.vx *= 16 / sp; q.vz *= 16 / sp; }
    if (q.mode === MODE.WALL) q.mode = MODE.AIR;
  }
  hitMark(src ? src.i : -1, q.i, amt, wid);
  if (q.hp <= 0 && !R.dying.includes(q)) R.dying.push(q);
  return amt;
}
// hazards (crushers, sweepers, electrified rails…): impact damage with a cooldown so contacts don't stack
function hazardHit(R, s, amt, kx, kz, kind) {
  if (!s.alive || s.impactCd > 0 || R.t < WARMUP) return;
  s.impactCd = 0.5;
  // no attacker: an environment kill is credited to whoever hit you last (within 6 s), see eliminate()
  const k = hyp(kx, kz);
  damage(R, s, amt, null, kind || 'hazard', k > 0 ? kx / k : 0, k > 0 ? kz / k : 0, k);
  s.hazKind = kind || 'hazard';
}

// ── pickups
function spawnWave(R, wave) {
  const A = R.arena, anchors = A.pickups.filter((a) => wave.tiers.includes(a[3] || 'std'));
  const n = Math.max(1, Math.round(anchors.length * wave.share));
  const order = shuffleWith(RNG, anchors.map((_, k) => k));
  let made = 0;
  for (const k of order) {
    if (made >= n) break;
    const a = anchors[k];
    if (R.picks.some((p) => hyp(p.x - a[0], p.z - a[2]) < 1)) continue;
    if (R.sk.some((s) => s.alive && hyp(s.x - a[0], s.z - a[2]) < 4)) continue; // never on top of someone
    const weights = wave.late ? RARITY_LATE : wave.plus ? { common: 35, uncommon: 40, rare: 20, legendary: 5 } : RARITY_WEIGHTS;
    let roll = RNG() * 100, tier = 'common';
    for (const t of ['common', 'uncommon', 'rare', 'legendary']) { roll -= weights[t]; if (roll < 0) { tier = t; break; } }
    const pool = LOOT[tier], w = pool[Math.floor(RNG() * pool.length)];
    R.picks.push({ id: R.nextId++, w, x: a[0], y: a[1], z: a[2], t0: wave.t, ammo: WEAPONS[w].ammo || 0, rarity: tier });
    made++;
  }
  announceWave(wave);
}
function announceWave(wave) { if (wave.t > 10) announce(wave.late ? 'POWER WEAPONS' : 'NEW DROPS'); }
function dropPickup(R, w, x, y, z, ammo) {
  if (!w || w === 'bat' || w === 'shove' || y < R.W.killY + 1) return;
  const gy = groundAt(R.W, x, z, y + 1);
  R.picks.push({ id: R.nextId++, w, x, y: gy > -1e8 ? gy : y, z, t0: R.t + 0.3, ammo: ammo || 0, rarity: WEAPONS[w].rarity, dropped: true });
}
// Pickups are automatic: roll over a weapon and you take it if it's an upgrade (bible §9 contested pedestals).
function stepPickups(R) {
  const n = R.sk.length, start = R.tick % n;
  for (let j = 0; j < n; j++) {
    const s = R.sk[(start + j) % n];
    if (!s.alive || s.mode === MODE.DOWN) continue;
    let best = null, bd = 1.6;
    for (const p of R.picks) {
      if (R.t < p.t0) continue;
      const d = hyp(p.x - s.x, p.z - s.z);
      if (d < bd && Math.abs(p.y - s.y) < 2.2 && wantsPickup(s, p.w, p.ammo)) { bd = d; best = p; }
    }
    if (best) takePickup(R, s, best);
  }
}
function takePickup(R, s, p) {
  R.picks.splice(R.picks.indexOf(p), 1);
  const Wp = WEAPONS[p.w];
  if (Wp.cls === 'melee') { if (s.melee && s.melee !== 'bat') dropPickup(R, s.melee, s.x, s.y, s.z, 0); s.melee = p.w; s.slot = 0; }
  else if (Wp.cls === 'throw') { if (s.thr && s.thr !== 'shove') dropPickup(R, s.thr, s.x, s.y, s.z, 0); s.thr = p.w; }
  else if (s.ranged === p.w) s.ammo = Math.max(s.ammo, p.ammo || Wp.ammo);
  else { if (s.ranged && s.ammo > 0) dropPickup(R, s.ranged, s.x, s.y, s.z, s.ammo); s.ranged = p.w; s.ammo = p.ammo || Wp.ammo; s.slot = 1; }
  s.atk = null; s.fireCd = Math.max(s.fireCd, 0.25);
  sk_sfx(s, 'pickup', 1);
  pickupFx(s.i, p.w);
}

// ── the arena squeeze (bible §3): zone keyframes per arena, escalating damage outside, finale pulses
function zoneAt(A, t) {
  const Z = A.zone; if (!Z.length) return { x: 0, z: 0, r: 1e9 };
  if (t <= Z[0].t) return Z[0];
  for (let k = 0; k + 1 < Z.length; k++) {
    const a = Z[k], b = Z[k + 1];
    if (t <= b.t) { const u = (t - a.t) / (b.t - a.t); return { x: lerp(a.x, b.x, u), z: lerp(a.z, b.z, u), r: lerp(a.r, b.r, u) }; }
  }
  return Z[Z.length - 1];
}
function stepZone(R) {
  const Z = zoneAt(R.arena, R.t); R.zoneNow = Z;
  const dps = zoneDps(R.t);
  for (const s of R.sk) {
    if (!s.alive) continue;
    if (s.burn > 0) { s.burn -= DT; const by = R.sk[s.burnBy]; damage(R, s, WEAPONS.molotov.burn * DT, by && by !== s ? by : null, 'molotov', 0, 0, 0); }
    const out = hyp(s.x - Z.x, s.z - Z.z) > Z.r;
    s.zoneT = out ? s.zoneT + DT : 0;
    if (out && dps > 0) hazardTick(R, s, dps * DT, 'zone');
  }
  // 50–60 s: lethal pulses accelerate; only the final core is safe
  if (R.t >= 50) {
    const every = Math.max(0.55, 2 - (R.t - 50) * 0.15);
    if (R.t - R.lastPulse >= every) {
      R.lastPulse = R.t; vfx('pulse', Z.x, 0, Z.z, Z.r); sfx('pulse', Z.x, 1, Z.z, 1);
      for (const s of R.sk) if (s.alive && hyp(s.x - Z.x, s.z - Z.z) > Z.r * 0.6) hazardTick(R, s, 12, 'pulse');
    }
  }
}
// continuous hazard damage (no cooldown, no knockback); keeps the last attacker's credit
function hazardTick(R, s, amt, kind) {
  if (R.t < WARMUP || !s.alive) return;
  damage(R, s, amt, null, kind, 0, 0, 0);
  s.hazKind = kind;
}
