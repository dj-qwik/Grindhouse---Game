// Quick bot-only rounds: node tools/sim_smoke.mjs <arena> [rounds] [players]
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const { createSim } = require('../dist/sim.cjs')
const [key = 'spillway', n = '3', np = '8'] = process.argv.slice(2)
const lens = []
for (let r = 0; r < +n; r++) {
  const sim = createSim({ seed: 1 })
  const seed = 1000 + r
  const players = Array.from({ length: +np }, (_, i) => ({ i, skill: 0.55 + (i % 4) * 0.08 }))
  const R = sim.createRound({ key, seed, players, botSalt: 'x' })
  let w = null, t0 = performance.now()
  while (!w) w = R.step({})
  const ms = performance.now() - t0
  lens.push(R.t)
  const st = R.standings()
  console.log(`round ${r}: ${R.t.toFixed(2)}s${R.timeout ? ' (timeout)' : ''} winner seat ${w.i} hp ${Math.ceil(w.hp)} · sim ${(ms / R.tick * 1000).toFixed(0)}µs/tick · kills ${st.map((s) => s.kills).join(',')} · events ${R.events.map((e) => `${e.v}<${e.by}:${e.w}@${(e.tick / 60).toFixed(1)}`).join(' ')}`)
}
lens.sort((a, b) => a - b)
console.log('median length', lens[Math.floor(lens.length / 2)].toFixed(1), 's')
