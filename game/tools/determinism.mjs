// Determinism: a server-style recorded round must replay bit-identically from (inputs + random draws) alone,
// and from (seed + inputs) alone (what co-signers do), on every arena.  node tools/determinism.mjs [rounds per arena]
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const { createSim, createFollower } = require('../dist/sim.cjs')
const n = +(process.argv[2] || 2)
const keys = Object.keys(createSim({}).ARENAS)
let bad = 0
for (const key of keys) for (let r = 0; r < n; r++) {
  const seed = 77 + r * 13, players = Array.from({ length: 8 }, (_, i) => ({ i, skill: 0.6 + (i % 3) * 0.1 }))
  // 1) server: record draws, bots fill seats; keep every tick's applied inputs
  const rec = []
  const S = createSim({ seed: 1 }).createRound({ key, seed, players, botSalt: 'det' }, { record: rec })
  const init = rec.splice(0), frames = [], hashes = []
  while (!S.winner) { const inp = {}; S.step(inp); frames.push([S.sk.map((s) => inp[s.i]), rec.splice(0)]); if (S.tick % 60 === 0) hashes.push([S.tick, S.hash()]) }
  const endHash = S.hash(), winner = S.winner.i
  // 2) browser-style follower fed only the server's draws
  const F = createFollower({ createSim, onDesync: (why) => { console.log(key, 'DESYNC', why); bad++ } })
  F.round({ key, players: players.map(({ i }) => ({ i })), init })
  for (const [k, h] of hashes) F.checkpoint(k, h)
  F.addFrames(1, frames); F.step(Infinity)
  const okF = F.R.hash() === endHash && F.R.winner && F.R.winner.i === winner
  // 3) co-signer style: seed + inputs only
  const C = createSim({ seed: 0 }).createRound({ key, seed, players: players.map(({ i }) => ({ i, skill: 0.5 })) })
  for (const [row] of frames) { const inp = {}; C.sk.forEach((s, j) => { inp[s.i] = row[j] }); C.step(inp) }
  const okC = C.hash() === endHash && C.winner && C.winner.i === winner
  if (!okF || !okC) bad++
  console.log(`${key} #${r}: ${S.t.toFixed(1)}s winner ${winner} · follower ${okF ? 'ok' : 'MISMATCH'} · replay ${okC ? 'ok' : 'MISMATCH'}`)
}
if (bad) { console.error(bad + ' determinism failure(s)'); process.exit(1) }
console.log('determinism ok')
