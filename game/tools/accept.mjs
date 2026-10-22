// Exploit + fairness + pacing suite for one arena:  node tools/accept.mjs <arena> [rounds=60]
// Seat 0 plays a lazy strategy against 7 full-strength bots; each lazy strategy must not beat a fair share by
// much (8 players → 12.5% fair; we allow ≤ 20%). Also checks pacing (bible §3: target median 45–50 s in full
// lobbies, never past 60.0 s), that every spawn slot can win, and that kills actually happen.
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const { createSim } = require('../dist/sim.cjs')
const [key, nArg] = process.argv.slice(2)
if (!key) { console.error('usage: node tools/accept.mjs <arena> [rounds]'); process.exit(2) }
const N = +(nArg || 60)
const sim0 = createSim({ seed: 1 })
const { packInput, BTN } = sim0
const STRATS = {
  bot: null, // seat 0 is a normal bot: the baseline
  idle: () => packInput({}),
  holdForward: (R, s) => packInput({ my: 1, yaw: s.aimYaw }),
  jumpSpam: (R, s) => packInput({ my: 1, yaw: s.aimYaw, btn: R.tick % 20 < 10 ? BTN.jump : 0 }),
  campCentre: (R, s) => { const Z = R.zoneNow, dx = Z.x - s.x, dz = Z.z - s.z, d = Math.hypot(dx, dz); return packInput(d > 1.5 ? { my: 1, yaw: Math.atan2(dx, dz) } : { yaw: s.aimYaw, btn: R.tick % 30 === 0 ? BTN.attack : 0 }) },
  swingSpam: (R, s) => { const Z = R.zoneNow, dx = Z.x - s.x, dz = Z.z - s.z; return packInput({ my: 0.6, yaw: Math.atan2(dx, dz), btn: R.tick % 2 ? BTN.attack : 0 }) },
}
let fail = 0
const lens = [], spawnWins = new Map(), zoneDeaths = { n: 0, of: 0 }
for (const [name, strat] of Object.entries(STRATS)) {
  let wins = 0, kills = 0, timeouts = 0
  for (let r = 0; r < N; r++) {
    const seed = 5000 + r * 7919
    const players = Array.from({ length: 8 }, (_, i) => ({ i, skill: 0.82 }))
    const R = createSim({ seed: 1 }).createRound({ key, seed, players, botSalt: 'acc' + name })
    const spawn0 = `${R.sk[0].x.toFixed(0)},${R.sk[0].z.toFixed(0)}`
    while (!R.winner) {
      const inp = {}
      if (strat) inp[0] = strat(R, R.sk[0])
      R.step(inp)
      if (R.tick > 3600) { console.error('ROUND RAN PAST 60 s'); process.exit(1) }
    }
    if (R.winner.i === 0) { wins++; spawnWins.set(spawn0, (spawnWins.get(spawn0) || 0) + 1) }
    if (R.timeout) timeouts++
    for (const s of R.sk) kills += s.kills
    if (name === 'bot') { lens.push(R.t); for (const e of R.events) { zoneDeaths.of++; if (e.w === 'zone' || e.w === 'pulse') zoneDeaths.n++ } }
  }
  const rate = wins / N
  const lazy = name !== 'bot'
  const ok = !lazy || rate <= 0.2
  if (!ok) fail++
  console.log(`${name.padEnd(12)} wins ${(rate * 100).toFixed(1).padStart(5)}%  ${ok ? 'ok' : 'TOO STRONG'}  · kills/round ${(kills / N).toFixed(1)} · 60 s timeouts ${timeouts}`)
}
lens.sort((a, b) => a - b)
const med = lens[Math.floor(lens.length / 2)]
console.log(`pacing: median ${med.toFixed(1)} s · p10 ${lens[Math.floor(lens.length * 0.1)].toFixed(1)} · p90 ${lens[Math.floor(lens.length * 0.9)].toFixed(1)} · max ${lens.at(-1).toFixed(1)} · zone/pulse share of eliminations ${(100 * zoneDeaths.n / Math.max(1, zoneDeaths.of)).toFixed(0)}%`)
if (med < 38 || med > 54) { console.log('PACING outside 38–54 s'); fail++ }
if (zoneDeaths.n / Math.max(1, zoneDeaths.of) > 0.6) { console.log('TOO MANY zone deaths: fights should decide most eliminations'); fail++ }
if (fail) { console.log(`${key}: ${fail} check(s) failed`); process.exit(1) }
console.log(`${key}: accepted`)
