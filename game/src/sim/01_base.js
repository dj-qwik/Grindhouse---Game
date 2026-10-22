// ───────────────────────── GRINDHOUSE: shared constants + pure helpers ─────────────────────────
// Included in the deterministic simulation AND the browser's global scope. Inside createSim() Math.random is
// a seeded stream and Math.sin/cos/atan2/atan/exp/hypot are DET_MATH (identical bits in every engine).
// Never use ** or Math.pow in simulation code. Units: metres, seconds, radians. y is up.
const DT = 1 / 60;
const TICK_HZ = 60;
const ROUND_SECONDS = 60;            // absolute gameplay cap (bible §1)
const MAX_TICKS = ROUND_SECONDS * TICK_HZ;
const WARMUP = 1.5;                  // no-damage movement warm-up after GO
const G = 22;                        // arcade gravity
const SK_R = 0.45, SK_H = 1.8;       // skater collision capsule (same for every skater)
const STEP = 0.35;                   // curb height you can roll up without an ollie
const HP_MAX = 100;
const PI = Math.PI, TAU = Math.PI * 2;

// Eight launch skaters: identical capsule + stats; looks are cosmetic only (bible §11).
const SKATERS = [
  { id: 'brick', name: 'Brick', style: 'baggy streetwear', body: '#FF5C69', trim: '#22292B', skin: '#C98B5E', hair: 'cap', deck: '#B4E64A' },
  { id: 'vex', name: 'Vex', style: 'patched racing leathers', body: '#36DCE8', trim: '#B85435', skin: '#E8C09A', hair: 'mohawk', deck: '#FF9B36' },
  { id: 'rot', name: 'Rot', style: 'old-school punk', body: '#9D75EA', trim: '#B4E64A', skin: '#F0CFAE', hair: 'spikes', deck: '#FF5C69' },
  { id: 'dash', name: 'Dash', style: 'courier utility gear', body: '#FF9B36', trim: '#22292B', skin: '#8D5A3B', hair: 'beanie', deck: '#36DCE8' },
  { id: 'ace', name: 'Ace', style: 'varsity skate gear', body: '#B4E64A', trim: '#E8DDBD', skin: '#D9A47A', hair: 'flat', deck: '#9D75EA' },
  { id: 'grease', name: 'Grease', style: 'mechanic overalls', body: '#E8DDBD', trim: '#B85435', skin: '#6E4630', hair: 'bandana', deck: '#FF9B36' },
  { id: 'crash', name: 'Crash', style: 'helmeted stunt rider', body: '#FF5C69', trim: '#E8DDBD', skin: '#E2B48C', hair: 'helmet', deck: '#36DCE8' },
  { id: 'tag', name: 'Tag', style: 'graffiti artist', body: '#22292B', trim: '#B4E64A', skin: '#B9784E', hair: 'hood', deck: '#FF5C69' },
];
const BOT_NAMES = ['Gristle', 'Nailbiter', 'Scab', 'Torque', 'Rust', 'Grit', 'Wedge', 'Splint', 'Kink', 'Bolt'];
// Practice/free-play bots: decision quality and aim. A notch below a good human. Server copy: server/match.mjs.
const BOT_SKILL = [0.55, 0.82];

// ───────────────────────── weapons (data-driven balance table, bible §8) ─────────────────────────
// cls: melee | ranged | throw | special (special shares the ranged slot). Damage values are tuning targets.
// melee: reach (m), arc (rad), wind/act/rec (s), spd (max speed bonus), charge (charged-attack damage)
// ranged: rate (s between shots), range, spread (rad), pellets, near/far (falloff metres), proj (m/s, 0 = hitscan)
const WEAPONS = {
  bat:     { name: 'Splinter Bat', cls: 'melee', dmg: 18, reach: 2.1, arc: 2.1, wind: 0.1, act: 0.1, rec: 0.35, spd: 7, knock: 5, rarity: 'starter', sfx: 'whoosh', kill: 'blunt' },
  pipe:    { name: 'Steel Pipe', cls: 'melee', dmg: 25, reach: 2.2, arc: 2.0, wind: 0.14, act: 0.1, rec: 0.8, spd: 8, knock: 6, rarity: 'common', sfx: 'whoosh', kill: 'blunt' },
  katana:  { name: 'Street Katana', cls: 'melee', dmg: 32, reach: 2.0, arc: 1.2, wind: 0.12, act: 0.08, rec: 0.55, spd: 8, knock: 4, charge: 45, rarity: 'uncommon', sfx: 'slash', kill: 'blade' },
  cleaver: { name: 'Cleaver', cls: 'melee', dmg: 36, reach: 1.7, arc: 1.6, wind: 0.14, act: 0.08, rec: 0.7, spd: 9, knock: 5, rarity: 'uncommon', sfx: 'slash', kill: 'blade' },
  whip:    { name: 'Chain Whip', cls: 'melee', dmg: 17, reach: 3.4, arc: 1.4, wind: 0.16, act: 0.1, rec: 0.6, spd: 4, knock: -5, missRec: 0.45, rarity: 'common', sfx: 'chain', kill: 'blunt' },
  baton:   { name: 'Shock Baton', cls: 'melee', dmg: 15, reach: 1.6, arc: 1.8, wind: 0.08, act: 0.08, rec: 0.4, spd: 4, knock: 3, shock: true, rarity: 'common', sfx: 'zap', kill: 'blunt' },
  hammer:  { name: 'Wrecking Hammer', cls: 'melee', dmg: 55, reach: 2.4, arc: 2.2, wind: 0.3, act: 0.12, rec: 1.3, spd: 12, knock: 11, rarity: 'rare', sfx: 'heavy', kill: 'blunt' },
  nailgun: { name: 'Nailgun', cls: 'ranged', dmg: 12, ammo: 12, rate: 0.16, range: 45, spread: 0.018, rarity: 'common', sfx: 'nail', kill: 'blunt' },
  sawoff:  { name: 'Sawed-Off', cls: 'ranged', dmg: 6.5, ammo: 4, rate: 0.75, range: 16, spread: 0.13, pellets: 8, near: 3, far: 14, rarity: 'uncommon', sfx: 'shotgun', kill: 'explosion', knock: 6 },
  smg:     { name: 'Paintball SMG', cls: 'ranged', dmg: 7, ammo: 28, rate: 0.085, range: 34, spread: 0.04, rarity: 'common', sfx: 'smg', kill: 'blunt' },
  revolver:{ name: 'Scrap Revolver', cls: 'ranged', dmg: 28, ammo: 6, rate: 0.62, range: 60, spread: 0.004, rarity: 'uncommon', sfx: 'revolver', kill: 'blunt' },
  rocket:  { name: 'Rocket Skate', cls: 'special', dmg: 40, splash: 20, radius: 3.6, ammo: 2, rate: 1.0, range: 70, proj: 27, knock: 13, rarity: 'legendary', sfx: 'rocket', kill: 'explosion' },
  buzzsaw: { name: 'Buzzsaw Launcher', cls: 'special', dmg: 34, ammo: 3, rate: 0.7, range: 55, proj: 30, bounces: 1, knock: 5, rarity: 'rare', sfx: 'buzz', kill: 'blade' },
  grenade: { name: 'Grenade', cls: 'throw', dmg: 65, radius: 5, fuse: 1.6, speed: 15, knock: 12, rarity: 'uncommon', sfx: 'throw', kill: 'explosion' },
  pipebomb:{ name: 'Pipe Bomb', cls: 'throw', dmg: 80, radius: 5.5, fuse: 1.6, speed: 15, sticky: true, knock: 13, rarity: 'rare', sfx: 'throw', kill: 'explosion' },
  molotov: { name: 'Molotov', cls: 'throw', dmg: 20, radius: 3.2, burn: 8, burnT: 3, speed: 15, rarity: 'common', sfx: 'throw', kill: 'hazard' },
  shove:   { name: 'Shove', cls: 'throw', dmg: 6, reach: 2.2, arc: 1.8, knock: 11, spd: 0, rarity: 'starter', sfx: 'shove', kill: 'blunt' },
};
const WEAPON_IDS = Object.keys(WEAPONS);
const RARITY_WEIGHTS = { common: 60, uncommon: 28, rare: 10, legendary: 2 };
const RARITY_LATE = { common: 25, uncommon: 35, rare: 28, legendary: 12 }; // sudden death: "increased pickup rarity"
const PICKUP_WAVES = [ // telegraphed 1.5 s ahead; t = when they become available
  { t: 3, share: 0.7, tiers: ['std', 'center'], late: false },
  { t: 17, share: 0.6, tiers: ['center'], late: false, plus: true },
  { t: 33, share: 0.7, tiers: ['center', 'std'], late: true },
  { t: 44, share: 0.5, tiers: ['center'], late: true },
];
const TELEGRAPH = 1.5;

// Adrenaline (bible §5): clean landings bank trick rewards. Repeats decay to 25%.
const TRICKS = {
  kickflip: { name: 'Kickflip', dur: 0.45, pts: 8 },
  heelflip: { name: 'Heelflip', dur: 0.45, pts: 8 },
  shuvit: { name: 'Shuvit', dur: 0.5, pts: 10 },
  tre: { name: '360 Shuvit', dur: 0.7, pts: 10 },
};
const REPEAT_DECAY = [1, 0.65, 0.4, 0.25];

// Outside-the-zone damage per second by phase (bible §3). Arena hazards out-damage any weapon by 50 s.
function zoneDps(t) { return t < 12 ? 0 : t < 28 ? 4 : t < 40 ? 8 : t < 50 ? 16 : 30; }

// ───────────────────────── input: one integer per skater per tick ─────────────────────────
// low 31 bits: stick x (5) · stick y (5) · aim yaw (11) · aim pitch (6) · view lag (4)
// high bits (× 2^31): buttons. Total < 2^40, an exact JSON number. The stick is relative to the aim yaw.
const BTN = { boost: 1, brake: 2, jump: 4, trick: 8, attack: 16, alt: 32, use: 64, swap: 128, throw: 256 };
const BTN_MASK = 511;
const P31 = 2147483648;
const INPUT_LIMIT = P31 * 512;
function packInput(inp) {
  const q = (v) => clamp(Math.round((v || 0) * 15), -15, 15) + 16;
  let yaw = (inp.yaw || 0) % TAU; if (yaw < 0) yaw += TAU;
  const y11 = Math.round(yaw / TAU * 2048) & 2047;
  const p6 = clamp(Math.round((inp.pitch || 0) / 1.05 * 32) + 32, 0, 63);
  const lag = clamp(inp.lag | 0, 0, 15);
  const low = q(inp.mx) | (q(inp.my) << 5) | (y11 << 10) | (p6 << 21) | (lag << 27);
  return low + ((inp.btn | 0) & BTN_MASK) * P31;
}
// Untrusted browsers send these: everything is clamped and the stick capped at full strength.
function unpackInput(p) {
  if (!(p >= 0) || p >= INPUT_LIMIT || p !== Math.floor(p)) p = IDLE_INPUT;
  const low = p % P31, btn = Math.floor(p / P31) & BTN_MASK;
  let mx = clamp((low & 31) - 16, -15, 15) / 15, my = clamp(((low >> 5) & 31) - 16, -15, 15) / 15;
  const m = mx * mx + my * my;
  if (m > 1) { const k = 1 / Math.sqrt(m); mx *= k; my *= k; }
  return { mx, my, yaw: ((low >> 10) & 2047) / 2048 * TAU, pitch: (((low >> 21) & 63) - 32) / 32 * 1.05, lag: (low >> 27) & 15, btn };
}
const IDLE_INPUT = 16 | (16 << 5) | (32 << 21);
const validInput = (p) => typeof p === 'number' && p >= 0 && p < INPUT_LIMIT && p === Math.floor(p);

// ───────────────────────── maths ─────────────────────────
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, k) => a + (b - a) * k;
const hyp = (x, y) => Math.sqrt(x * x + y * y);
const len3 = (x, y, z) => Math.sqrt(x * x + y * y + z * z);
function angWrap(a) { while (a > PI) a -= TAU; while (a < -PI) a += TAU; return a; }
function angDiff(a, b) { return angWrap(a - b); }
const fwdX = (yaw) => Math.sin(yaw), fwdZ = (yaw) => Math.cos(yaw);
const yawOf = (x, z) => Math.atan2(x, z);
const rnd = (a, b) => a + RNG() * (b - a);
// closest point on segment ab to p (3D); returns param t
function segT(px, py, pz, ax, ay, az, bx, by, bz) {
  const dx = bx - ax, dy = by - ay, dz = bz - az, l2 = dx * dx + dy * dy + dz * dz;
  return l2 < 1e-9 ? 0 : clamp(((px - ax) * dx + (py - ay) * dy + (pz - az) * dz) / l2, 0, 1);
}
// shortest distance between segments p1q1 and p2q2 (3D) — ray vs capsule tests
function segSegDist(p1x, p1y, p1z, q1x, q1y, q1z, p2x, p2y, p2z, q2x, q2y, q2z) {
  const d1x = q1x - p1x, d1y = q1y - p1y, d1z = q1z - p1z, d2x = q2x - p2x, d2y = q2y - p2y, d2z = q2z - p2z;
  const rx = p1x - p2x, ry = p1y - p2y, rz = p1z - p2z;
  const a = d1x * d1x + d1y * d1y + d1z * d1z, e = d2x * d2x + d2y * d2y + d2z * d2z, f = d2x * rx + d2y * ry + d2z * rz;
  let s, t;
  if (a <= 1e-9 && e <= 1e-9) { s = 0; t = 0; }
  else if (a <= 1e-9) { s = 0; t = clamp(f / e, 0, 1); }
  else {
    const c = d1x * rx + d1y * ry + d1z * rz;
    if (e <= 1e-9) { t = 0; s = clamp(-c / a, 0, 1); }
    else {
      const b = d1x * d2x + d1y * d2y + d1z * d2z, den = a * e - b * b;
      s = den > 1e-12 ? clamp((b * f - c * e) / den, 0, 1) : 0;
      t = (b * s + f) / e;
      if (t < 0) { t = 0; s = clamp(-c / a, 0, 1); } else if (t > 1) { t = 1; s = clamp((b - c) / a, 0, 1); }
    }
  }
  const cx = p1x + d1x * s - (p2x + d2x * t), cy = p1y + d1y * s - (p2y + d2y * t), cz = p1z + d1z * s - (p2z + d2z * t);
  return { d: Math.sqrt(cx * cx + cy * cy + cz * cz), s };
}
// colour helpers (pure, used by renderers)
function hexA(hex, a) { const n = parseInt(hex.slice(1), 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`; }
