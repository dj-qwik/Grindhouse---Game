// Static + reachability checks for one arena:  node tools/map_check.mjs <arena>
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const { createSim } = require('../dist/sim.cjs')
const key = process.argv[2]
const sim = createSim({ seed: 1 })
const A = sim.ARENAS[key]
if (!A) { console.error('unknown arena', key); process.exit(2) }
let fail = 0
const bad = (m) => { console.log('  ✗ ' + m); fail++ }
for (let v = 0; v < (A.variants || 1); v++) {
  const W = A.build(v)
  console.log(`variant ${v}: ${W.prims.length} prims, ${W.rails.length} rails, half ${W.half}, floor ${W.floor}`)
  const sp = W.spawns
  if (sp.length !== 8) bad(`${sp.length} spawns (need 8)`)
  let minSep = 1e9
  for (let a = 0; a < sp.length; a++) for (let b = a + 1; b < sp.length; b++) minSep = Math.min(minSep, Math.hypot(sp[a][0] - sp[b][0], sp[a][1] - sp[b][1]))
  if (minSep < 14) bad(`spawns only ${minSep.toFixed(1)} m apart (need ≥ 14)`)
  for (const s of sp) { const g = sim.groundAt(W, s[0], s[1], 50); if (g < -1e8) bad(`spawn ${s} has no ground`) }
  const pk = W.pickups, nc = pk.filter((p) => p[3] === 'center').length
  if (pk.length < 12 || pk.length > 18) bad(`${pk.length} pickup anchors (need 12–18)`)
  if (nc < 4) bad(`${nc} 'center' anchors (need ≥ 4)`)
  for (const p of pk) { const g = sim.groundAt(W, p[0], p[2], p[1] + 0.5); if (Math.abs(g - p[1]) > 0.35) bad(`pickup ${p.slice(0, 3)} y ${p[1]} but ground is ${g.toFixed(2)}`) }
  if (!W.zone.length || W.zone[0].t !== 0 || W.zone.at(-1).t < 60) bad('zone keyframes must run t 0 → 60')
  for (const z of W.zone) { const g = sim.groundAt(W, z.x, z.z, 50); if (g < -1e8) bad(`zone centre ${z.x},${z.z} @${z.t}s has no ground`) }
  if (!Array.isArray(W.hz)) console.log('  (no A.hz hazard descriptors)')
}
// reachability: a lone skater rides from every spawn toward the final zone centre (hop when stuck)
const { packInput, BTN } = sim
let reached = 0
for (let k = 0; k < 8; k++) {
  const R = createSim({ seed: 1 }).createRound({ key, seed: 11 + k, players: Array.from({ length: 8 }, (_, i) => ({ i })) })
  const me = R.sk[k], Zf = R.W.zone.at(-1)
  let stuck = 0, hop = 0, best = 1e9
  for (let t = 0; t < 20 * 60; t++) {
    const dx = Zf.x - me.x, dz = Zf.z - me.z, d = Math.hypot(dx, dz)
    best = Math.min(best, d)
    if (d < 3) break
    const sp = Math.hypot(me.vx, me.vz)
    if (sp < 1 && me.mode === 0) { if (++stuck > 30) { hop = 10; stuck = 0 } } else stuck = 0
    const inp = {}; for (const s of R.sk) inp[s.i] = packInput({}); inp[k] = packInput({ my: 1, yaw: Math.atan2(dx, dz) + (hop > 0 ? 0.7 : 0), btn: hop-- > 0 ? BTN.jump : 0 })
    R.step(inp); if (!me.alive) break
  }
  if (best < 3) reached++; else console.log(`  spawn ${k} (${me.x.toFixed(0)},${me.z.toFixed(0)}) got within ${best.toFixed(1)} m of the final core by riding straight`)
}
console.log(`reachability: ${reached}/8 spawns reach the final core by riding straight (bots need most of these)`)
if (reached < 6) bad('final core hard to reach by riding')
console.log(fail ? `${key}: ${fail} problem(s)` : `${key}: map checks ok`)
process.exit(fail ? 1 : 0)
