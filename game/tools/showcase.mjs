// Beauty shots of every arena (attract-mode orbit, menus hidden): node tools/showcase.mjs outPrefix [arena,...]
import { createRequire } from 'node:module'
import { server } from './serve_static.mjs'
const { chromium } = createRequire('/opt/node22/lib/node_modules/')('playwright')
const [out = '/tmp/claude-0/show', list] = process.argv.slice(2)
const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] })
const p = await b.newPage({ viewport: { width: 960, height: 540 } })
const errs = []; p.on('pageerror', (e) => errs.push(e.message))
await p.goto(`http://localhost:${server.address().port}/?offline&test`)
await p.waitForFunction(() => window.GH && GH.ROUND, null, { timeout: 60000 })
const keys = list ? list.split(',') : await p.evaluate(() => Object.keys(GH.ARENAS))
for (const k of keys) {
  await p.evaluate((k) => { GH.GAME.arena = k; GH.GAME.bots = 7; GH.startPractice(); GH.GAME.countT = 0.01; document.getElementById('ov').hidden = true }, k)
  await p.waitForFunction(() => GH.GAME.phase === 'play', null, { timeout: 60000 })
  await p.evaluate(() => { const R = GH.ROUND; for (let i = 0; i < 9 * 60; i++) R.step({}); GH.GAME.screen = 'showcase'; document.getElementById('hud').hidden = true; document.body.classList.remove('playing') })
  await p.waitForTimeout(2500)
  await p.screenshot({ path: `${out}_${k}.png`, timeout: 120000 })
}
console.log(errs.length ? 'ERRORS: ' + errs.slice(0, 5).join(' | ') : 'no errors')
await b.close(); server.close()
