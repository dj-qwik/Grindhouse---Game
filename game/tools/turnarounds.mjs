// Finds dead-end pockets (lanes that end at a wall, leaving only the way you came) and plans a small quarter pipe at
// each so you can ride up it and come back around. Writes src/sim/12_turnarounds.js (pure data, deterministic).
//   node tools/turnarounds.mjs        (rebuild dist first: node build.mjs)
import { createRequire } from 'node:module'
import fs from 'node:fs'
const require = createRequire(import.meta.url)
const { createSim } = require('../dist/sim.cjs')
const S = createSim({ seed: 1 })
const out = {}, DBG = process.env.DBG, ONLY = process.env.ONLY
const QD = 1.7, QANG = 58 // quarter pipe depth (m) and lip angle
// areas to leave alone: [x0, x1, z0, z1] (moving hazards' paths, corners that already loop round)
const KEEP_CLEAR = { boardwalk: [[-2.2, 2.2, -38.5, -14], [-8.5, -5, -38.5, -34.5], [5, 8.5, -38.5, -34.5]] }
for (const key of Object.keys(S.ARENAS)) {
  if (ONLY && key !== ONLY) continue
  const A = S.ARENAS[key]; out[key] = {}
  for (let v = 0; v < (A.variants || 1); v++) {
    const W = A.build(v), H = W.half
    const top = (x, z) => S.groundAt(W, x, z, 200)
    const reach = (x, z, a, max = 7) => { let h = top(x, z); const dx = Math.sin(a) * 0.25, dz = Math.cos(a) * 0.25; for (let d = 0.25; d <= max; d += 0.25) { x += dx; z += dz; if (Math.abs(x) > H - 0.2 || Math.abs(z) > H - 0.2) return d; const h2 = top(x, z); if (h2 < -1e8 || h2 > h + 0.6) return d; h = Math.max(h2, h - 3) } return max }
    const N = 16, pockets = []
    for (let x = -H + 1; x <= H - 1; x += 0.5) for (let z = -H + 1; z <= H - 1; z += 0.5) {
      const h = top(x, z); if (h < -1e8) continue
      const open = []; for (let k = 0; k < N; k++) open.push(reach(x, z, k / N * 6.28) >= 7)
      const idx = open.map((o, k) => o ? k : -1).filter((k) => k >= 0)
      if (!idx.length || idx.length > 3) continue
      let span = 0; for (const a of idx) for (const b of idx) span = Math.max(span, Math.min(Math.abs(a - b), N - Math.abs(a - b)))
      if (span > 3) continue
      // mean open direction
      let sx = 0, sz = 0; for (const k of idx) { sx += Math.sin(k / N * 6.28); sz += Math.cos(k / N * 6.28) }
      const ao = Math.atan2(sx, sz), ab = ao + Math.PI
      if (reach(x, z, ab) > 2.5) continue
      pockets.push({ x, z, h, ab })
    }
    // cluster pockets, keep the ones made of several cells
    const cl = []
    for (const p of pockets) { const c = cl.find((q) => Math.hypot(q.x - p.x, q.z - p.z) < 3 && Math.abs(q.h - p.h) < 0.6); if (c) { c.pts.push(p) ; c.x = c.pts.reduce((s, q) => s + q.x, 0) / c.pts.length; c.z = c.pts.reduce((s, q) => s + q.z, 0) / c.pts.length } else cl.push({ x: p.x, z: p.z, h: p.h, pts: [p] }) }
    const plans = []
    for (const c of cl.filter((q) => q.pts.length >= 2)) {
      // back direction: the shortest way to the closing wall from the cluster centre (search around the pockets' mean)
      let sx = 0, sz = 0; for (const p of c.pts) { sx += Math.sin(p.ab); sz += Math.cos(p.ab) } let ab = Math.atan2(sx, sz)
      // snap to the dominant wall normal: try nearby angles, pick the one with the shortest reach
      let best = ab, bd = 99; for (let da = -0.6; da <= 0.6; da += 0.05) { const d = reach(c.x, c.z, ab + da); if (d < bd) { bd = d; best = ab + da } } ab = best
      const fx = Math.sin(ab), fz = Math.cos(ab), rx = Math.cos(ab), rz = -Math.sin(ab)
      // walk to the wall, then measure the lane width there
      const wx = c.x + fx * (bd - 0.25), wz = c.z + fz * (bd - 0.25)
      const L = reach(wx - fx * QD / 2, wz - fz * QD / 2, ab + Math.PI / 2, 4), Rr = reach(wx - fx * QD / 2, wz - fz * QD / 2, ab - Math.PI / 2, 4)
      const w = Math.min(7, L + Rr - 0.3); if (DBG) console.log('  cluster', c.x.toFixed(1), c.z.toFixed(1), 'n', c.pts.length, 'bd', bd, 'L', L, 'R', Rr); if (w < 1.1) continue
      const lat = (L - Rr) / 2
      const fits = (cx, cz, w) => { const h = top(cx, cz); for (let u = -0.5; u <= 0.5; u += 0.1) for (let t = -0.5; t <= 0.5; t += 0.125) { const x = cx + rx * u * w + fx * t * QD, z = cz + rz * u * w + fz * t * QD, g = top(x, z); if (g < -1e8 || Math.abs(g - h) > 0.08) return false } return true }
      let ok = false, why = 'no fit', cx = 0, cz = 0, ww = w
      // pull back from the wall and narrow down until the ramp sits on clear, flat floor
      for (let back = 0.15; back <= 1.2 && !ok; back += 0.15) for (ww = w; ww >= 1.1 && !ok; ww -= 0.3) {
        cx = wx - fx * (QD / 2 + back) + rx * lat; cz = wz - fz * (QD / 2 + back) + rz * lat
        if (fits(cx, cz, ww)) ok = true
      }
      if (ok) ww += 0.3
      const h = top(cx, cz)
      if (ok) { for (const s of W.spawns) if (Math.hypot(s[0] - cx, s[1] - cz) < 1.5 + ww / 2) { ok = false; why = 'spawn' }
        for (const p of W.pickups) if (Math.hypot(p[0] - cx, p[2] - cz) < 1.0 + ww / 2) { ok = false; why = 'pickup' }
        for (const q of plans) if (Math.hypot(q[0] - cx, q[1] - cz) < 3) { ok = false; why = 'overlap' }
        for (const [x0, x1, z0, z1] of KEEP_CLEAR[key] || []) if (cx + ww / 2 + 1 > x0 && cx - ww / 2 - 1 < x1 && cz + 1.5 > z0 && cz - 1.5 < z1) { ok = false; why = 'keep clear' } }
      if (!ok) { if (DBG) console.log('   rejected', why, 'at', cx.toFixed(1), cz.toFixed(1), 'w', ww); continue }
      plans.push([+cx.toFixed(2), +cz.toFixed(2), +ww.toFixed(2), +ab.toFixed(3), +h.toFixed(3)])
    }
    out[key][v] = plans
    console.log(key, 'v' + v, plans.length, 'turnarounds', plans.map((p) => `(${p[0]},${p[1]} w${p[2]})`).join(' '))
  }
}
const src = `// GENERATED by tools/turnarounds.mjs — do not edit by hand.
// Small quarter pipes at the ends of dead-end lanes so you can ride up and come back around instead of stopping.
// [cx, cz, width, yaw (rises toward the wall), floor height] per arena variant.
const TURNAROUNDS = ${JSON.stringify(out)};
const TA_D = ${QD}, TA_ANG = ${QANG};
function addTurnarounds(W, key) {
  const list = (TURNAROUNDS[key] || {})[W.variant || 0] || [];
  for (const [cx, cz, w, yaw, h] of list) W.prims.push(qp(cx, cz, w, TA_D, TA_ANG, { yaw, base: h, y0: Math.max(0, h - 0.3), mat: 'concrete', wr: false, turn: true }));
}
`
fs.writeFileSync(new URL('../src/sim/12_turnarounds.js', import.meta.url), src)
