// ───────────────────────── SKATER: movement, tricks, adrenaline (bible §5) ─────────────────────────
// A hybrid kinematic controller: a 3D velocity that lives in the tangent plane of whatever the skater rides
// (flat, kicker, quarter pipe), arcade gravity, traction-limited carving, earned speed. Modes:
//   0 ground · 1 air · 2 grind · 3 wallride · 4 down (bail / heavy hit / knocked)
// stepSkater() is pure movement (no RNG, no combat) so browsers can predict their own skater with it.
const MODE = { GROUND: 0, AIR: 1, GRIND: 2, WALL: 3, DOWN: 4 };
const HIST = 16; // lag-compensation history (ticks)
const MOVE = {
  pushA: 11.5, cap: 12, boostA: 15, boostCap: 14.5, maxSpeed: 22, roll: 0.35, drag: 0.0028, brake: 9.5,
  grip: 12, slideGrip: 2.8, turnLo: 5.2, turnHi: 2.5, carveKeep: 0.93,
  pop: 6.3, popCharge: 1.7, chargeMax: 0.45, coyote: 0.1, jumpBuf: 0.12,
  airA: 3.2, airTurn: 4.5, railSnap: 0.65, railMinSpeed: 2.5, wallMin: 5, wallMax: 1.1,
};

function makeSkater(i, look, name) {
  const hx = new Array(HIST).fill(0), hy = new Array(HIST).fill(0), hz = new Array(HIST).fill(0);
  return {
    i, look, name, human: false, skill: 0.8, alive: true, hp: HP_MAX, hpPrev: HP_MAX,
    x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, yaw: 0, aimYaw: 0, aimPitch: 0, lag: 0,
    mode: MODE.GROUND, nx: 0, ny: 1, nz: 0, airT: 0, coyote: 0, jumpBuf: 0, charge: -1,
    airY0: 0, airMaxY: 0, airX0: 0, airZ0: 0, wallDone: false,
    rail: null, railK: 0, railU: 0, railDir: 1, gs: 0, railCd: 0, lastRail: null, grindT: 0,
    wallNx: 0, wallNz: 0, wallT: 0, wallCd: 0,
    trick: null, trickT: 0, trickSpin: 0, pend: 0, combo: [], hist: [], adren: 0, manual: 0, lastBank: null, bankT: -9,
    downT: 0, immune: 0, stagger: 0, flinch: 0, boostT: 0, bailT: -9,
    melee: 'bat', ranged: null, ammo: 0, thr: 'shove', slot: 0, atk: null, fireCd: 0, altT: 0, adrenBoost: false,
    kills: 0, dmg: 0, deathT: -1, deathTick: -1, killer: -1, killWeapon: null, lastBy: -1, lastByT: -1e9, lastByW: null, place: 0,
    btn: 0, press: 0, prevBtn: 0, mx: 0, my: 0, hx, hy, hz, impactCd: 0, burn: 0, burnBy: -1, zoneT: 0,
    pred: false, // prediction copies never trigger effects
  };
}

// effect helpers: never fire for prediction copies
function sk_sfx(s, name, vol) { if (!s.pred) sfx(name, s.x, s.y + 1, s.z, vol || 1); }
function sk_vfx(s, kind, a, b, c) { if (!s.pred) vfx(kind, s.x, s.y, s.z, a, b, c); }

function stickWorld(s, mx, my) { // stick relative to the aim yaw → world direction
  const sy = Math.sin(s.aimYaw), cy = Math.cos(s.aimYaw);
  return [my * sy - mx * cy, my * cy + mx * sy];
}

/** Advance one skater one tick. W = world, t = round time. Reads s.btn/s.press (set by the round). */
function stepSkater(s, W, t) {
  if (!s.alive) { stepCorpse(s, W); return; }
  const dt = DT, btn = s.btn, press = s.press;
  s.airT = s.mode === MODE.AIR ? s.airT + dt : 0;
  s.coyote -= dt; s.jumpBuf -= dt; s.railCd -= dt; s.wallCd -= dt; s.immune -= dt; s.stagger -= dt; s.flinch -= dt; s.boostT -= dt; s.impactCd -= dt;
  if (press & BTN.jump) s.jumpBuf = MOVE.jumpBuf;
  if (s.mode === MODE.DOWN) { stepDown(s, W, dt); return; }
  const ctl = s.stagger > 0 ? 0.35 : s.flinch > 0 ? 0.7 : 1;
  const mag = hyp(s.mx, s.my);
  const [dX, dZ] = stickWorld(s, s.mx, s.my);
  if (s.mode === MODE.GRIND) { stepGrind(s, W, dt); return; }
  if (s.mode === MODE.WALL) { stepWall(s, W, dt); return; }
  if (s.mode === MODE.GROUND) stepGround(s, W, dt, btn, mag, dX, dZ, ctl);
  else stepAir(s, W, dt, btn, press, mag, dX, dZ, ctl);
  // ollie: crouch on press, pop on release (or at full charge). Coyote time + buffered press.
  const canPop = s.mode === MODE.GROUND || (s.mode === MODE.AIR && s.coyote > 0);
  if (s.charge < 0 && s.jumpBuf > 0 && canPop && s.stagger <= 0) { s.charge = 0; s.jumpBuf = 0; }
  if (s.charge >= 0) {
    s.charge += dt;
    if (!(btn & BTN.jump) || s.charge >= MOVE.chargeMax || s.mode !== MODE.GROUND) pop(s);
  }
  if (s.y < W.killY) { s.fell = true; }
}

function pop(s) {
  const k = Math.min(1, s.charge / MOVE.chargeMax);
  s.charge = -1;
  if (s.vy < 0) s.vy = 0;
  s.vy += MOVE.pop + MOVE.popCharge * k;
  goAir(s);
  sk_sfx(s, 'pop', 0.7 + 0.3 * k);
}
function goAir(s) {
  s.vertX = 0; s.vertZ = 0;
  if (s.mode !== MODE.AIR) { s.mode = MODE.AIR; s.airT = 0; s.airY0 = s.y; s.airMaxY = s.y; s.airX0 = s.x; s.airZ0 = s.z; s.wallDone = false; }
}

function stepGround(s, W, dt, btn, mag, dX, dZ, ctl) {
  // keep the velocity in the tangent plane of the surface (redirect, don't scrub: transitions conserve speed)
  const vl = len3(s.vx, s.vy, s.vz), vn = s.vx * s.nx + s.vy * s.ny + s.vz * s.nz;
  s.vx -= vn * s.nx; s.vy -= vn * s.ny; s.vz -= vn * s.nz;
  const vl2 = len3(s.vx, s.vy, s.vz); if (vl2 > 1e-6 && vn < 0) { const k = vl / vl2; s.vx *= k; s.vy *= k; s.vz *= k; }
  let sp = hyp(s.vx, s.vz);
  let fx = Math.sin(s.yaw), fz = Math.cos(s.yaw);
  // rolling backwards (back down a ramp): revert to face the way you're going
  if (sp > 1.2 && s.vx * fx + s.vz * fz < -0.25 * sp) { s.yaw = angWrap(s.yaw + PI); fx = -fx; fz = -fz; }
  const braking = !!(btn & BTN.brake);
  let pushing = false;
  if (mag > 0.2) {
    const target = yawOf(dX, dZ), diff = angDiff(target, s.yaw);
    if (Math.abs(diff) > 2.4 && sp > 4) { /* hairpin at speed: you can't, you scrub instead */ s.scrub = true; }
    else {
      const rate = (MOVE.turnLo - (MOVE.turnLo - MOVE.turnHi) * Math.min(1, sp / MOVE.cap)) * (braking ? 1.6 : 1) * ctl;
      const turn = clamp(diff, -rate * dt, rate * dt);
      s.yaw = angWrap(s.yaw + turn);
      // carve: the board carries most of its speed through the turn
      const a = turn * MOVE.carveKeep, c = Math.cos(a), sn = Math.sin(a), vx = s.vx, vz = s.vz;
      s.vx = vx * c + vz * sn; s.vz = -vx * sn + vz * c;
      fx = Math.sin(s.yaw); fz = Math.cos(s.yaw);
      pushing = Math.cos(diff) > 0.35;
    }
  } else s.scrub = false;
  // push: diminishing returns near the flat-ground cap; boost push is quicker but leaves you exposed
  if (pushing && s.charge < 0 && s.manual <= 0) {
    const boost = !!(btn & BTN.boost), cap = boost ? MOVE.boostCap : MOVE.cap;
    const along = s.vx * fx + s.vz * fz;
    const a = (boost ? MOVE.boostA : MOVE.pushA) * Math.max(0, 1 - Math.max(0, along) / cap) * ctl;
    s.vx += fx * a * dt; s.vz += fz * a * dt;
    if (boost) s.boostT = 0.35;
  }
  // manual: trick + back on the ground — balance, combo kept alive, speed retention
  if ((btn & BTN.trick) && s.my < -0.5 && sp > 3 && s.manual < 2.5 && s.atk == null) s.manual += dt;
  else if (s.manual > 0) { if (s.manual >= 0.5) { s.pend += Math.floor(s.manual * 4); bank(s); } s.manual = 0; }
  // friction, drag, brake / powerslide
  sp = hyp(s.vx, s.vz);
  let dec = MOVE.roll * (s.manual > 0 ? 0.3 : 1) + MOVE.drag * sp * sp;
  if (braking || s.scrub) dec += MOVE.brake * (0.6 + 0.4 * Math.min(1, 4 / Math.max(1, sp)));
  if (sp > 1e-4) { const k = Math.max(0, sp - dec * dt) / sp; s.vx *= k; s.vz *= k; s.vy *= k; }
  // lateral grip (powerslide grips less: you skid)
  const rx = Math.cos(s.yaw), rz = -Math.sin(s.yaw), lat = s.vx * rx + s.vz * rz;
  const g = 1 - DM.exp(-(braking ? MOVE.slideGrip : MOVE.grip) * dt);
  s.vx -= rx * lat * g; s.vz -= rz * lat * g;
  // gravity along the surface (slopes speed you up / slow you down)
  s.vx += G * s.ny * s.nx * dt; s.vy += (-G + G * s.ny * s.ny) * dt; s.vz += G * s.ny * s.nz * dt;
  capSpeed(s);
  // move, then follow the surface or leave it
  const ox = s.x, oy = s.y, oz = s.z;
  s.x += s.vx * dt; s.z += s.vz * dt; s.y += s.vy * dt;
  const step = hyp(s.x - ox, s.z - oz);
  const gy = groundAt(W, s.x, s.z, s.y + STEP, s.y + STEP + 0.6 + step * 2);
  const drop = s.y - gy, stick = step * 1.1 + 0.06, was = s.onPrim;
  if (gy > -1e8 && (drop <= 0.02 || (s.vy <= 1 && drop <= stick))) { s.y = gy; s.nx = NX; s.ny = NY; s.nz = NZ; s.onPrim = GP; }
  else {
    // off a lip. Off a steep quarter pipe without popping you go straight up and come back in ("vert air");
    // hold jump at the lip to keep your outward speed and transfer.
    let vert = false;
    if (was && was.type === 'qp' && was.ang > 0.9 && s.charge < 0 && s.vy > 1) {
      const a = s.vx * was.s + s.vz * was.c; s.vx -= was.s * (a + 0.7); s.vz -= was.c * (a + 0.7); vert = true;
    }
    // ramp impulse (bible §5): transitions and kickers throw you a little higher than pure physics would
    if (was && was.type !== 'box' && s.vy > 1) s.vy += was.type === 'qp' ? 2.5 : 1.0;
    goAir(s); s.coyote = MOVE.coyote; s.onPrim = null;
    if (vert) { s.vertX = was.s; s.vertZ = was.c; }
  }
  if (s.mode === MODE.GROUND && GP && (GP.vx || GP.vz)) { s.x += GP.vx * dt; s.z += GP.vz * dt; } // conveyors / moving decks
  // climbing a transition: the deck behind its lip is the ramp's continuation, not a wall
  s.stepX = s.mode === MODE.GROUND && s.onPrim && s.onPrim.type !== 'box' && s.vy > 0 ? clamp(s.vy * 0.12, 0, 0.6) : 0;
  collideSkater(W, s);
  s.stepX = 0;
  if (CN_V > 12.5 && s.immune <= 0 && s.y - oy < 0.5) bail(s, 'slam');
}

function stepAir(s, W, dt, btn, press, mag, dX, dZ, ctl) {
  const oy = s.y;
  s.vy -= G * dt;
  if (mag > 0.2) { // capped air control + spin toward the stick
    const sp = hyp(s.vx, s.vz), along = (s.vx * dX + s.vz * dZ) / mag;
    let ax = dX / mag * MOVE.airA * dt * ctl, az = dZ / mag * MOVE.airA * dt * ctl;
    if (s.vertX || s.vertZ) { const o = ax * s.vertX + az * s.vertZ; if (o > 0) { ax -= o * s.vertX; az -= o * s.vertZ; } } // vert air: stay over the ramp
    if (along < 6) { s.vx += ax; s.vz += az; }
    const nsp = hyp(s.vx, s.vz); if (nsp > sp && nsp > 1e-4) { const k = Math.max(sp, 6) / nsp; if (k < 1) { s.vx *= k; s.vz *= k; } }
    const diff = angDiff(yawOf(dX, dZ), s.yaw); s.yaw = angWrap(s.yaw + clamp(diff, -MOVE.airTurn * dt, MOVE.airTurn * dt));
  }
  capSpeed(s);
  // tricks: trick + direction in the air. One at a time; land before it finishes and you bail.
  if ((press & BTN.trick) && !s.trick && s.airT > 0.05) {
    s.trick = s.mx < -0.5 ? 'kickflip' : s.mx > 0.5 ? 'heelflip' : s.my < -0.5 ? 'shuvit' : s.my > 0.5 ? 'tre' : 'kickflip';
    s.trickT = 0; sk_sfx(s, 'flick', 0.6);
  }
  if (s.trick) {
    s.trickT += dt;
    const T = TRICKS[s.trick];
    if (s.trickT >= T.dur) { s.combo.push(s.trick); s.pend += T.pts * decayOf(s, s.trick); s.hist.push(s.trick); if (s.hist.length > 6) s.hist.shift(); s.trick = null; s.trickT = 0; sk_sfx(s, 'catch', 0.6); }
  }
  s.x += s.vx * dt; s.y += s.vy * dt; s.z += s.vz * dt;
  if (s.y > s.airMaxY) s.airMaxY = s.y;
  collideSkater(W, s);
  // wallride: airborne contact with a tall wall while moving along it
  if (CN_P && CN_P.wr && CN_P.type === 'box' && s.wallCd <= 0 && !(btn & BTN.brake) && primTop(CN_P) - Math.max(CN_P.y0, 0) >= 2 && s.y < primTop(CN_P) - 0.9) {
    const par = Math.abs(s.vx * -CN_Z + s.vz * CN_X);
    const below = groundAt(W, s.x, s.z, s.y + 0.1);
    if (par >= MOVE.wallMin && s.y > below + 0.6) {
      s.mode = MODE.WALL; s.wallNx = CN_X; s.wallNz = CN_Z; s.wallT = 0; s.trick = null; s.vy = Math.max(s.vy, 1.2);
      s.yaw = yawOf(s.vx, s.vz); sk_sfx(s, 'wall', 0.7); return;
    }
  }
  // rails: snap when you drop onto one moving roughly along it
  if (s.vy < 2) { const r = findRail(s, W); if (r) return; }
  // landing
  const gy = groundAt(W, s.x, s.z, Math.max(oy, s.y) + 0.05, Math.max(oy, s.y) + 0.05);
  if (gy > -1e8 && gy >= s.y) land(s, gy);
}

function land(s, gy) {
  s.y = gy; s.nx = NX; s.ny = NY; s.nz = NZ; s.onPrim = GP;
  const vn = s.vx * s.nx + s.vy * s.ny + s.vz * s.nz;
  if (vn < 0) { s.vx -= vn * s.nx; s.vy -= vn * s.ny; s.vz -= vn * s.nz; }
  const air = s.airT;
  s.mode = MODE.GROUND; s.airT = 0;
  if (s.trick && s.trickT < TRICKS[s.trick].dur * 0.85) { bail(s, 'trick'); return; }
  if (s.trick) { s.pend += TRICKS[s.trick].pts * decayOf(s, s.trick); s.hist.push(s.trick); if (s.hist.length > 6) s.hist.shift(); s.trick = null; }
  // sideways landing scrubs speed
  const sp = hyp(s.vx, s.vz);
  if (sp > 2) {
    const c = (s.vx * Math.sin(s.yaw) + s.vz * Math.cos(s.yaw)) / sp;
    if (c < -0.6) s.yaw = angWrap(s.yaw + PI); else if (Math.abs(c) < 0.5) { s.vx *= 0.7; s.vz *= 0.7; }
  }
  if (air >= 1.0 && (s.airMaxY - s.airY0 >= 1.8 || hyp(s.x - s.airX0, s.z - s.airZ0) >= 7)) { s.pend += 15 * decayOf(s, 'transfer'); s.hist.push('transfer'); if (s.hist.length > 6) s.hist.shift(); s.combo.push('transfer'); }
  if (s.wallDone) { s.pend += 12 * decayOf(s, 'wallride'); s.hist.push('wallride'); if (s.hist.length > 6) s.hist.shift(); s.combo.push('wallride'); s.wallDone = false; }
  bank(s);
  if (air > 0.35) { sk_sfx(s, 'land', Math.min(1, air)); sk_vfx(s, 'land', air); }
}
function decayOf(s, id) { let n = 0; for (const h of s.hist) if (h === id) n++; return REPEAT_DECAY[Math.min(n, REPEAT_DECAY.length - 1)]; }
function bank(s) {
  if (s.pend > 0) { const before = s.adren; s.adren = Math.min(100, s.adren + Math.round(s.pend)); s.lastBank = { pts: Math.round(s.pend), tricks: s.combo.slice(0, 6) }; s.bankT = 0; if (before < 100 && s.adren >= 100) sk_sfx(s, 'charged', 1); }
  s.pend = 0; s.combo.length = 0;
}
function breakCombo(s) { s.pend = 0; s.combo.length = 0; s.manual = 0; }
function bail(s, why) {
  breakCombo(s); s.trick = null; s.charge = -1;
  s.mode = MODE.DOWN; s.downT = why === 'trick' ? 1.0 : why === 'slam' ? 0.9 : 0.8; s.bailT = 0; s.why = why;
  s.rail = null; s.atk = null;
  sk_sfx(s, 'bail', 1); sk_vfx(s, 'bail');
}
function stepDown(s, W, dt) {
  s.downT -= dt; s.bailT += dt;
  // sliding / tumbling: heavy friction on the ground, gravity in the air
  const gy = groundAt(W, s.x, s.z, s.y + STEP, s.y + STEP + 0.5);
  if (s.y > gy + 0.02) { s.vy -= G * dt; } else { s.y = gy; s.vy = Math.max(0, s.vy); const sp = hyp(s.vx, s.vz); if (sp > 1e-4) { const k = Math.max(0, sp - 9 * dt) / sp; s.vx *= k; s.vz *= k; } }
  s.x += s.vx * dt; s.y += s.vy * dt; s.z += s.vz * dt;
  if (s.y < gy) s.y = gy;
  collideSkater(W, s);
  if (s.y < W.killY) s.fell = true;
  if (s.downT <= 0) { s.immune = 0.55; s.mode = s.y > gy + 0.05 ? MODE.AIR : MODE.GROUND; if (s.mode === MODE.AIR) goAir(s); s.nx = 0; s.ny = 1; s.nz = 0; }
}
function stepCorpse(s, W) {
  const dt = DT, gy = groundAt(W, s.x, s.z, s.y + 0.5);
  if (s.y > gy + 0.02 || gy < -1e8) s.vy -= G * dt; else { s.y = gy; s.vy = 0; const sp = hyp(s.vx, s.vz); if (sp > 1e-4) { const k = Math.max(0, sp - 12 * dt) / sp; s.vx *= k; s.vz *= k; } }
  s.x += s.vx * dt; s.y += s.vy * dt; s.z += s.vz * dt;
  if (s.y < -40) { s.y = -40; s.vy = 0; }
}
function capSpeed(s) {
  const v = len3(s.vx, s.vy, s.vz);
  if (v > MOVE.maxSpeed) { const k = MOVE.maxSpeed / v; s.vx *= k; s.vy *= k; s.vz *= k; }
}

// ── grinding
function findRail(s, W) {
  const vh = hyp(s.vx, s.vz);
  if (vh < MOVE.railMinSpeed) return null;
  for (const r of W.rails) {
    if (r.gone || (r === s.lastRail && s.railCd > 0)) continue;
    for (let k = 0; k < r.seg.length; k++) {
      const g = r.seg[k], a = g.a, b = g.b;
      const t = segT(s.x, s.y, s.z, a[0], a[1], a[2], b[0], b[1], b[2]);
      const cx = a[0] + (b[0] - a[0]) * t, cy = a[1] + (b[1] - a[1]) * t, cz = a[2] + (b[2] - a[2]) * t;
      if (hyp(s.x - cx, s.z - cz) > MOVE.railSnap) continue;
      const dy = s.y - cy; if (dy < -0.45 || dy > 0.55) continue;
      const uh = hyp(g.ux, g.uz); if (uh < 0.2) continue;
      const along = (s.vx * g.ux + s.vz * g.uz) / (uh * vh);
      if (Math.abs(along) < 0.55) continue;
      s.mode = MODE.GRIND; s.rail = r; s.railK = k; s.railU = t * g.l; s.railDir = along > 0 ? 1 : -1;
      s.gs = Math.abs(s.vx * g.ux + s.vy * g.uy + s.vz * g.uz) * 0.95 + 0.6; s.grindT = 0; s.trick = null; s.charge = -1;
      s.x = cx; s.y = cy; s.z = cz;
      sk_sfx(s, r.live ? 'zap' : 'grind', 0.8); return r;
    }
  }
  return null;
}
function stepGrind(s, W, dt) {
  const r = s.rail;
  if (!r || r.gone) { s.rail = null; goAir(s); return; }
  let g = r.seg[s.railK];
  s.grindT += dt; s.pend += 3 * dt; // grind tick +3/s, banked on a clean landing
  s.gs += -G * g.uy * s.railDir * dt - 0.7 * dt;
  s.gs = Math.min(s.gs, MOVE.maxSpeed);
  const leave = (pop) => {
    s.vx = g.ux * s.railDir * s.gs; s.vy = g.uy * s.railDir * s.gs + (pop ? MOVE.pop : 1.2); s.vz = g.uz * s.railDir * s.gs;
    if (pop) { const [sx, sz] = stickWorld(s, s.mx, 0); s.vx += sx * 2.5; s.vz += sz * 2.5; sk_sfx(s, 'pop', 0.8); }
    s.lastRail = r; s.railCd = 0.3; s.rail = null; s.mode = MODE.AIR; s.airT = 0; s.airY0 = s.y; s.airMaxY = s.y; s.airX0 = s.x; s.airZ0 = s.z; s.wallDone = false;
    s.y += 0.05;
  };
  if (s.press & BTN.jump) { leave(true); return; }
  if (s.gs < 1.2) { leave(false); return; }
  s.railU += s.railDir * s.gs * dt;
  while (s.railU > g.l || s.railU < 0) {
    const over = s.railU > g.l ? s.railU - g.l : -s.railU, nk = s.railK + s.railDir;
    if (nk < 0 || nk >= r.seg.length) { s.railU = clamp(s.railU, 0, g.l); const p = railPoint(r, s.railK, s.railU); s.x = p[0]; s.y = p[1]; s.z = p[2]; leave(false); return; }
    s.railK = nk; g = r.seg[nk]; s.railU = s.railDir > 0 ? over : g.l - over;
  }
  const p = railPoint(r, s.railK, s.railU);
  s.x = p[0]; s.y = p[1]; s.z = p[2];
  s.vx = g.ux * s.railDir * s.gs; s.vy = g.uy * s.railDir * s.gs; s.vz = g.uz * s.railDir * s.gs;
  s.yaw = yawOf(g.ux * s.railDir, g.uz * s.railDir);
}

// ── wallriding: gravity peels you off; jump to pop away (bankable +12)
function stepWall(s, W, dt) {
  s.wallT += dt;
  s.vy -= G * (0.22 + 0.78 * Math.min(1, s.wallT / MOVE.wallMax)) * dt;
  const vn = s.vx * s.wallNx + s.vz * s.wallNz; s.vx -= vn * s.wallNx; s.vz -= vn * s.wallNz; // stay flush
  const sp = hyp(s.vx, s.vz); if (sp > 1e-4) { const k = Math.max(0, sp - 1.0 * dt) / sp; s.vx *= k; s.vz *= k; }
  const peel = (pop) => {
    s.vx += s.wallNx * (pop ? 4.5 : 1.5); s.vz += s.wallNz * (pop ? 4.5 : 1.5);
    if (pop) { s.vy = Math.max(s.vy, 0) + 6.2; s.wallDone = true; sk_sfx(s, 'pop', 0.8); }
    s.mode = MODE.AIR; s.wallCd = 0.35; s.airMaxY = Math.max(s.airMaxY, s.y);
  };
  if (s.press & BTN.jump) { peel(true); return; }
  if (s.wallT > MOVE.wallMax || sp < 3) { peel(false); return; }
  const oy = s.y;
  s.x += (s.vx - s.wallNx * 0.6) * dt; s.y += s.vy * dt; s.z += (s.vz - s.wallNz * 0.6) * dt;
  collideSkater(W, s);
  if (!CN_P) { s.mode = MODE.AIR; s.wallCd = 0.35; return; }
  const gy = groundAt(W, s.x, s.z, Math.max(oy, s.y) + 0.05);
  if (gy > -1e8 && gy >= s.y) land(s, gy);
}

// skater vs skater: capsules push apart (combat is weapons, bodies just jostle)
function separateSkaters(list) {
  for (let a = 0; a < list.length; a++) for (let b = a + 1; b < list.length; b++) {
    const p = list[a], q = list[b];
    if (!p.alive || !q.alive || Math.abs(p.y - q.y) > SK_H) continue;
    const dx = q.x - p.x, dz = q.z - p.z, d = hyp(dx, dz), min = SK_R * 2;
    if (d >= min || d < 1e-5) continue;
    const nx = dx / d, nz = dz / d, push = (min - d) / 2;
    p.x -= nx * push; p.z -= nz * push; q.x += nx * push; q.z += nz * push;
    const rel = (q.vx - p.vx) * nx + (q.vz - p.vz) * nz;
    if (rel < 0) { p.vx += nx * rel * 0.5; p.vz += nz * rel * 0.5; q.vx -= nx * rel * 0.5; q.vz -= nz * rel * 0.5; }
  }
}
// lag-compensation history: where each skater was `lag` ticks ago
function recordHist(s, tick) { const k = tick % HIST; s.hx[k] = s.x; s.hy[k] = s.y; s.hz[k] = s.z; }
let LGX = 0, LGY = 0, LGZ = 0;
function lagPos(s, tick, lag) {
  if (lag <= 0 || tick - lag < 1) { LGX = s.x; LGY = s.y; LGZ = s.z; return; }
  const k = (tick - lag) % HIST; LGX = s.hx[k]; LGY = s.hy[k]; LGZ = s.hz[k];
}
