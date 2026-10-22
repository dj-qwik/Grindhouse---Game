// End-to-end network test: starts the real server, connects headless players over real WebSockets with simulated
// latency + jitter, plays full matches, and checks that every client's replay agrees with the server exactly
// (winner + state fingerprint), including a player who drops mid-match and reconnects.
//   node tools/nettest.mjs [matches=2] [size=4] [--lat 60] [--jitter 40] [--humans N] [--no-reconnect]
import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
const here = path.dirname(fileURLToPath(import.meta.url))
const require = createRequire(import.meta.url)
const args = process.argv.slice(2)
const num = (f, d) => (args.includes(f) ? +args[args.indexOf(f) + 1] : d)
const MATCHES = +(args.find((a) => /^\d+$/.test(a)) || 2)
const SIZE = +(args.filter((a) => /^\d+$/.test(a))[1] || 4)
const LAT = num('--lat', 60), JIT = num('--jitter', 40), HUMANS = num('--humans', SIZE)
process.env.PORT = String(20000 + ((Math.random() * 20000) | 0))
const { createSim, createFollower } = require(path.join(here, '..', 'dist', 'sim.cjs'))
const sim0 = createSim({})
const { default: WebSocket } = await import('ws')
await import(path.join(here, '..', 'server', 'index.mjs'))
const URL_ = `ws://127.0.0.1:${process.env.PORT}/ws`

const results = { healed: [], rounds: 0, agree: 0, desyncs: [], done: 0, reconnects: 0, maxBuffer: 0 }
function player(name) {
  const P = { name, token: null, me: -1, ws: null, F: null, done: false, sentP: -1 }
  const q = [] // deliver after a simulated one-way delay, strictly in order (TCP never reorders)
  const deliver = (fn) => { const at = Math.max(q.length ? q.at(-1).at : 0, Date.now() + LAT / 2 + Math.random() * JIT); q.push({ at, fn }) }
  P.pump = setInterval(() => { const now = Date.now(); while (q.length && q[0].at <= now) q.shift().fn() }, 2)
  const send = (o) => { const s = JSON.stringify(o); deliver(() => { if (P.ws && P.ws.readyState === 1) P.ws.send(s) }) }
  function connect() {
    P.ws = new WebSocket(URL_)
    P.ws.on('open', () => send({ t: 'hello', name, token: P.token, look: Math.floor(Math.random() * 8) }))
    P.ws.on('message', (d) => { const m = JSON.parse(d); deliver(() => onMsg(m)) })
  }
  const follower = (me) => createFollower({ createSim, me, onDesync: (why) => { results.healed.push(`${name} ${why}`); send({ t: 'resync' }) } })
  function onMsg(m) {
    if (m.t === 'welcome') { P.token = m.token; if (P.me < 0) send({ t: 'queue', mode: 'free', size: SIZE }) }
    else if (m.t === 'match') { P.me = m.you; P.F = follower(P.me) }
    else if (m.t === 'round') P.F.round(m)
    else if (m.t === 'tk') P.F.addFrames(m.k, m.f)
    else if (m.t === 'h') P.F.checkpoint(m.k, m.h)
    else if (m.t === 'end') P.F.ended(m)
    else if (m.t === 'sync') { if (!P.F) P.F = follower(m.match.you); P.me = m.match.you; P.F.sync(m); results.reconnects++ }
    else if (m.t === 'closed') P.done = true
  }
  // play: 60 Hz follower loop + a wandering stick, mouse yaw, ollies, swings, pickups, throws
  let last = Date.now(), mx = 0, my = 1, yaw = Math.random() * 6.28, btn = 0
  P.loop = setInterval(() => {
    const now = Date.now(), F = P.F
    if (F && F.R) {
      F.step(F.pace(now - last))
      results.maxBuffer = Math.max(results.maxBuffer, F.buffered)
      if (F.end && F.next >= F.frames.length && !P.checked) {
        P.checked = true; results.rounds++; P.done = true
        const ok = !F.desync && F.R.winner && F.R.winner.i === F.end.w && F.R.hash() === F.end.h
        if (ok) results.agree++; else results.desyncs.push(`${name}: local winner ${F.R.winner?.i} server ${F.end.w}`)
      }
    }
    last = now
    if (Math.random() < 0.03) { mx = Math.random() < 0.3 ? 0 : Math.random() * 2 - 1; my = Math.random() < 0.15 ? 0 : 1 }
    yaw += (Math.random() - 0.5) * 0.2
    const r = Math.random()
    btn = r < 0.02 ? sim0.BTN.jump : r < 0.04 ? sim0.BTN.attack : r < 0.05 ? sim0.BTN.use : r < 0.052 ? sim0.BTN.throw : r < 0.06 ? sim0.BTN.trick : btn & sim0.BTN.attack ? 0 : 0
    const p = sim0.packInput({ mx, my, yaw, pitch: 0, btn, lag: Math.round(LAT / 16) })
    if (p !== P.sentP) { P.sentP = p; send({ t: 'in', p }) }
  }, 16)
  P.drop = () => { P.ws.terminate(); setTimeout(connect, 1200) }
  connect()
  return P
}

for (let m = 0; m < MATCHES; m++) {
  const ps = Array.from({ length: HUMANS }, (_, i) => player(`T${m}_${i}`))
  if (!args.includes('--no-reconnect') && m === 0 && ps[1]) setTimeout(() => ps[1].drop(), 30000) // mid-match drop + rejoin
  const t0 = Date.now()
  await new Promise((res) => { const iv = setInterval(() => { if (ps.every((p) => p.done) || Date.now() - t0 > 180e3) { clearInterval(iv); res() } }, 200) })
  ps.forEach((p) => { clearInterval(p.loop); clearInterval(p.pump); p.ws.close() })
  results.done += ps.every((p) => p.checked) ? 1 : 0
  console.log(`match ${m + 1}: finished in ${((Date.now() - t0) / 1000).toFixed(0)} s`)
}
const pass = !results.desyncs.length && results.agree === results.rounds && results.done === MATCHES
console.log(`${pass ? 'PASS' : 'FAIL'} network: ${results.agree}/${results.rounds} clients matched the server exactly · ${results.reconnects} reconnect sync(s) · latency ${LAT}±${JIT} ms · max buffer ${results.maxBuffer} ticks`)
if (results.desyncs.length) console.log(results.desyncs.slice(0, 10).join('\n'))
if (results.healed.length) console.log(`self-healed desyncs: ${results.healed.length}\n` + results.healed.slice(0, 8).join('\n'))
process.exit(pass ? 0 : 1)
