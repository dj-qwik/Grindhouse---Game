// Browser end-to-end of free online play against the real server: queue → lobby → bots fill → countdown →
// match (own-skater prediction, inputs) → results card. node tools/online_browser.mjs [outPrefix]
import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
const here = path.dirname(fileURLToPath(import.meta.url))
const { chromium } = createRequire('/opt/node22/lib/node_modules/')('playwright')
const out = process.argv[2] || '/tmp/claude-0/online'
process.env.PORT = String(21000 + ((Math.random() * 9000) | 0))
await import(path.join(here, '..', 'server', 'index.mjs'))
const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] })
const p = await b.newPage({ viewport: { width: 960, height: 540 } })
const errs = []; p.on('pageerror', (e) => errs.push(e.message)); p.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errs.push(m.text()) })
await p.goto(`http://127.0.0.1:${process.env.PORT}/?test`)
await p.waitForFunction(() => window.GH && GH.ROUND, null, { timeout: 30000 })
await p.click('#goOnline'); await p.fill('#netName', 'Tester'); await p.click('[data-netsize="2"]'); await p.click('#netFind')
await p.waitForFunction(() => GH.GAME.mode === 'online' && GH.GAME.phase === 'play', null, { timeout: 90000 })
console.log('match started on', await p.evaluate(() => GH.ROUND.key))
await p.keyboard.down('KeyW')
await p.waitForTimeout(6000)
await p.screenshot({ path: `${out}_play.png`, timeout: 120000 })
const st = await p.evaluate(() => ({ alive: GH.ROUND.sk[GH.GAME.me].alive, hp: GH.ROUND.sk[GH.GAME.me].hp, mode: GH.ROUND.sk[GH.GAME.me].mode, my: GH.ROUND.sk[GH.GAME.me].my, lastP: GH.NET.state.lastP, x: GH.ROUND.sk[GH.GAME.me].x.toFixed(1), z: GH.ROUND.sk[GH.GAME.me].z.toFixed(1), t: GH.ROUND.t.toFixed(1), buf: GH.NET.state.F.buffered, rtt: Math.round(GH.NET.state.rtt), me: GH.GAME.me, sp: Math.hypot(GH.ROUND.sk[GH.GAME.me].vx, GH.ROUND.sk[GH.GAME.me].vz).toFixed(1), desync: GH.NET.state.F.desync }))
console.log('during play', JSON.stringify(st))
await p.keyboard.up('KeyW')
await p.waitForFunction(() => GH.GAME.screen === 'results', null, { timeout: 150000 })
await p.waitForTimeout(800)
await p.screenshot({ path: `${out}_results.png`, timeout: 120000 })
const res = await p.evaluate(() => ({ w: GH.GAME.results.w, n: GH.GAME.results.standings.length, desync: GH.NET.state.F.desync }))
console.log('results', JSON.stringify(res))
console.log(errs.length ? 'ERRORS: ' + [...new Set(errs)].slice(0, 8).join(' | ') : 'no errors')
await b.close(); process.exit(errs.length || res.desync ? 1 : 0)
