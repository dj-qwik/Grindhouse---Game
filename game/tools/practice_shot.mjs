// Practice-match screenshots: node tools/practice_shot.mjs <arena|random> <outPrefix> <ms,ms,...>   (HOLD=KeyW to hold a key)
import { createRequire } from 'node:module'
import { server } from './serve_static.mjs'
const { chromium } = createRequire('/opt/node22/lib/node_modules/')('playwright')
const [key = 'spillway', out = '/tmp/claude-0/shot', times = '4000,9000'] = process.argv.slice(2)
const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] })
const p = await b.newPage({ viewport: { width: 960, height: 540 } })
const errs = []; p.on('pageerror', (e) => errs.push(e.message)); p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()) })
await p.goto(`http://localhost:${server.address().port}/?offline&test`)
await p.waitForFunction(() => window.GH && window.GH.ROUND, null, { timeout: 30000 })
await p.waitForTimeout(1500)
if (process.env.HOME_SHOT) await p.screenshot({ path: `${out}_home.png`, timeout: 120000 })
await p.evaluate((k) => { GH.GAME.arena = k; GH.GAME.bots = +(localStorage.getItem('bots') || 7); GH.startPractice() }, key)
await p.evaluate(() => { GH.GAME.countT = 0.01 })
await p.waitForFunction(() => GH.GAME.phase === 'play', null, { timeout: 60000 })
if (process.env.FF) await p.evaluate((sec) => { const R = GH.ROUND; for (let k = 0; k < sec * 60 && !R.winner; k++) R.step({}) }, +process.env.FF)
if (process.env.HOLD) await p.keyboard.down(process.env.HOLD)
let last = 0
for (const ms of times.split(',').map(Number)) { await p.waitForTimeout(ms - last); last = ms; await p.screenshot({ path: `${out}_${ms}.png`, timeout: 120000 }) }
const info = await p.evaluate(() => { const R = GH.ROUND; return { t: R.t.toFixed(1), alive: R.alive, fps: GH.GFX.fpsAvg.toFixed(0), me: R.sk[0] && { x: R.sk[0].x.toFixed(1), y: R.sk[0].y.toFixed(1), z: R.sk[0].z.toFixed(1), hp: R.sk[0].hp } } })
console.log(JSON.stringify(info))
console.log(errs.length ? 'ERRORS: ' + [...new Set(errs)].slice(0, 8).join(' | ') : 'no errors')
await b.close(); server.close()
