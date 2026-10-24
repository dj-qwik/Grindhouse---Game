// Finds skaters stuck inside geometry (feet 0.3 m inside a solid for 0.5 s) across bot matches:  node tools/stuck_check.mjs [arena,arena]
import { createRequire } from 'node:module'
import fs from 'node:fs'
const require = createRequire(import.meta.url)
// expose solidAt by evaluating the bundle with an extra export
let src = fs.readFileSync(new URL('../dist/sim.cjs', import.meta.url), 'utf8').replace('return { ARENAS, createRound,', 'return { solidAt, ARENAS, createRound,')
const m = { exports: {} }; new Function('module', 'exports', 'require', src)(m, m.exports, require)
const { createSim } = m.exports
for (const key of (process.argv[2] || 'spillway,rooftop,mall,junkyard,boardwalk,overpass,factory,schoolyard').split(',')) {
  const found = []
  for (let g = 0; g < 15; g++) {
    const S = createSim({ seed: 1 }), R = S.createRound({ key, seed: 300 + g, players: Array.from({ length: 8 }, (_, i) => ({ i, skill: 0.75 })) })
    const inT = new Array(8).fill(0)
    while (!R.step({})) R.sk.forEach((s, j) => {
      if (!s.alive) return
      const p = S.solidAt(R.W, s.x, s.y + 0.3, s.z)
      if (p) { inT[j]++; if (inT[j] === 30) found.push(`g${g} t${R.t.toFixed(1)} sk${j} (${s.x.toFixed(1)},${s.y.toFixed(2)},${s.z.toFixed(1)}) mode${s.mode} in ${p.type}/${p.mat} c(${p.cx.toFixed(1)},${p.cz.toFixed(1)}) y0 ${p.y0} top ${S.primTop(p).toFixed(2)} gone ${p.gone}`) } else inT[j] = 0
    })
  }
  console.log(key, found.length); for (const f of found.slice(0, 6)) console.log('  ', f)
}
