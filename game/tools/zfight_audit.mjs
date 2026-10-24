// Z-fighting audit: every arena, every variant, several moments of the round. Lists visible faces that share a
// plane and overlap (flicker), both in the raw geometry and — the number that matters — after the render's
// visual insets (src/sim/15_visual.js) are applied.   node tools/zfight_audit.mjs [arena,arena] [--raw]
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const S = require('../dist/sim.cjs').createSim({ seed: 1 })
const NEAR = 0.0025 // anything closer than this is too close for the depth buffer at range
const keys = (process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : Object.keys(S.ARENAS).join(',')).split(','), RAW = process.argv.includes('--raw')
const snap = (p) => [p.cx, p.cz, p.top, p.y0, p.w, p.d, p.yaw, p.h0, p.h1, p.gone].join()
const label = (p) => p ? `${p.type}/${p.mat} @(${p.cx.toFixed(2)},${p.cz.toFixed(2)}) w${p.w.toFixed(2)} d${p.d.toFixed(2)} y${p.y0.toFixed(2)}-${S.primTop(p).toFixed(2)}` : 'FLOOR'
let total = 0
for (const key of keys) {
  const A = S.ARENAS[key], seen = new Map()
  for (let v = 0; v < (A.variants || 1); v++) {
    let seed = 0; for (; seed < 300; seed++) if (S.createRound({ key, seed, players: [{ i: 0 }] }).W.variant === v) break
    // which prims ever move (same idea as the renderer's dry run)
    const R0 = S.createRound({ key, seed, players: [{ i: 0 }, { i: 1 }] }), s0 = R0.W.prims.map(snap), dyn = new Set()
    for (let k = 0; k < 3660 && !R0.winner; k++) { R0.step({ 0: S.packInput({}), 1: S.packInput({}) }); if (k % 6 === 0) R0.W.prims.forEach((p, i) => { if (snap(p) !== s0[i]) dyn.add(i) }) }
    const R = S.createRound({ key, seed, players: [{ i: 0 }, { i: 1 }] }), W = R.W
    const statics = W.prims.filter((p, i) => !dyn.has(i)), ins = RAW ? new Map() : S.visualInsets(W, W.prims)
    for (const tc of [0, 15, 30, 36.5, 39, 41, 46, 52, 59.5]) {
      while (R.t < tc && !R.winner) R.step({ 0: S.packInput({}), 1: S.packInput({}) })
      const drawn = W.prims.map((p, i) => {
        if (p.gone) return null
        if (dyn.has(i)) { if (!RAW && p.type === 'box' && (p.top - p.y0 < 0.03 || ((p.mat === 'gate' || W.floor) && p.top <= 0.02)) && !(p.warn > 0)) return null; return RAW ? p : S.insetPrim(p, ins.get(p), i) }
        return RAW ? p : S.insetPrim(p, ins.get(p))
      }).filter(Boolean)
      for (const [Fa, Fb, a, gap] of S.visualPairs(drawn, W.floor ? 0 : null, W.half, NEAR)) {
        const k = [label(Fa.p), label(Fb.p), Fa.key, Fb.key].join(' | ')
        if (!seen.has(k)) seen.set(k, { a, gap, v, t: R.t, txt: `${label(Fa.p)} [${Fa.key}]  ×  ${label(Fb.p)} [${Fb.key}]` })
      }
    }
  }
  const list = [...seen.values()].sort((a, b) => b.a - a.a); total += list.length
  console.log(`${key}: ${list.length} flush overlaps${RAW ? ' (raw geometry)' : ' (as drawn)'}`)
  for (const h of list.slice(0, 40)) console.log(`  v${h.v} t${h.t.toFixed(0)} gap ${h.gap.toFixed(4)} area ${h.a.toFixed(2)}  ${h.txt}`)
}
process.exitCode = total ? 1 : 0
