// Skate-move regression test (no browser): each move is set up on The Spillway and must actually happen.
//   node tools/moves_test.mjs
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const { createSim } = require('../dist/sim.cjs')
const sim = createSim({ seed: 1 })
const { packInput, BTN, MODE } = sim
let fail = 0
const ok = (cond, label, extra = '') => { console.log(`${cond ? '✓' : '✗'} ${label}${extra ? ' · ' + extra : ''}`); if (!cond) fail++ }
function setup(x, z, yaw, speed, v = 0) {
  const R = createSim({ seed: 1 }).createRound({ key: 'spillway', seed: 4242, players: Array.from({ length: 2 }, (_, i) => ({ i })) })
  // keep the round from deciding itself while we test: move the other skater far away and freeze it
  const me = R.sk[0], o = R.sk[1]
  o.x = -30; o.z = -30; o.y = 2.5
  me.x = x; me.z = z; me.y = sim.groundAt(R.W, x, z, 50); me.yaw = yaw; me.vx = Math.sin(yaw) * speed; me.vz = Math.cos(yaw) * speed; me.vy = 0; me.mode = MODE.GROUND
  return R
}
const run = (R, ticks, fn) => { for (let k = 0; k < ticks; k++) { const inp = { 1: packInput({}) }; inp[0] = fn(k, R.sk[0]); R.step(inp); } }

// 1) push builds speed toward the flat cap, with diminishing returns
{ const R = setup(-5, -25, 0, 0); run(R, 120, (k, s) => packInput({ my: 1, yaw: 0 })); const sp = Math.hypot(R.sk[0].vx, R.sk[0].vz); ok(sp > 8 && sp <= 12.6, 'pushing for 2 s reaches cruising speed', sp.toFixed(1) + ' m/s') }
// 2) ollie + kickflip off flat ground at speed, clean landing banks Adrenaline
{
  const R = setup(-4, -28, 0, 10); let air = 0
  run(R, 70, (k, s) => { if (s.mode === MODE.AIR) air++; return packInput({ my: 1, yaw: 0, btn: k < 26 ? BTN.jump : k === 30 ? BTN.trick : 0 }) })
  ok(air > 20, 'charged ollie leaves the ground', `${air} ticks airborne`)
  ok(R.sk[0].adren >= 8 && R.sk[0].mode !== MODE.DOWN, 'kickflip landed clean → +Adrenaline', `adren ${R.sk[0].adren}`)
}
// 3) trick that can't finish → bail
{
  const R = setup(-4, -28, 0, 10); let bailed = false
  run(R, 60, (k, s) => { if (s.mode === MODE.DOWN) bailed = true; return packInput({ my: 1, yaw: 0, btn: k === 0 ? BTN.jump : k === 5 ? BTN.trick : 0, my2: 0 }) })
  ok(bailed || R.sk[0].trick === null, 'a trick started off a tiny hop bails or never starts', `mode ${R.sk[0].mode}`)
}
// 4) grind: hop onto the deck rail (x = 20, y 3.1, z 10..24) moving along it
{
  const R = setup(20, 8, 0, 9); const s = R.sk[0]; s.y = 3.3; s.vy = 1; s.mode = MODE.AIR
  let ground = false; run(R, 40, (k, sk) => { if (sk.mode === MODE.GRIND) ground = true; return packInput({ yaw: 0 }) })
  ok(ground, 'dropping onto a rail while moving along it starts a grind')
}
// 5) quarter pipe: ride into the end QP without popping → vert air and back into the ramp
{
  const R = setup(5, 18, 0, 12); let maxY = 0, cameBack = false
  let flew = false; run(R, 200, (k, s) => { maxY = Math.max(maxY, s.y); if (s.mode === MODE.AIR) flew = true; if (maxY > 3 && s.z < 31 && s.mode === MODE.GROUND) cameBack = true; return packInput({ my: flew ? 0 : 1, yaw: 0 }) })
  ok(maxY > 3, 'quarter pipe launches you above the lip', `peak ${maxY.toFixed(1)} m`)
  ok(cameBack, 'vert air comes back down into the ramp')
}
// 6) wallride: airborne along the east perimeter wall above the deck (inner face x = 40, top 4.5)
{
  const R = setup(39.3, -10, 0, 10); const s = R.sk[0]; s.y = 3.4; s.vy = 2; s.vx = 2; s.mode = MODE.AIR
  let rode = false; run(R, 60, (k, sk) => { if (sk.mode === MODE.WALL) rode = true; return packInput({ yaw: 0 }) })
  ok(rode, 'hitting a tall wall in the air while moving along it starts a wallride')
}
// 7) melee: a bat swing at someone in front lands, warm-up protects for 1.5 s
{
  const R = setup(0, -20, 0, 0); const me = R.sk[0], o = R.sk[1]
  o.x = 0; o.z = -18.6; o.y = me.y; o.vx = o.vz = 0
  run(R, 100, () => packInput({ yaw: 0 })) // let the 1.5 s warm-up pass, standing still
  o.x = 0; o.z = me.z + 1.4; o.y = me.y
  const hp0 = o.hp
  run(R, 40, (k) => packInput({ yaw: 0, btn: k === 2 ? BTN.attack : 0 }))
  ok(o.hp < hp0 - 10, 'a bat swing hits the skater in front', `${hp0} → ${o.hp.toFixed(1)}`)
}
if (fail) { console.log(`${fail} move check(s) failed`); process.exit(1) }
console.log('moves ok')
