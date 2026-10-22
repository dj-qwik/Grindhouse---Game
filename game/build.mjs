#!/usr/bin/env node
// Build Grindhouse (no dependencies; Node ≥ 22).
//   dist/sim.cjs          deterministic simulation only (server, co-signers, tests): createSim(env), createFollower()
//   dist-web/index.html   the page the game server serves (Three.js client + menus + wallet hooks)
//   dist-web/game.js      browser bundle: simulation + renderer + UI
//   dist-web/vendor/      Three.js (MIT), vendored so the game never depends on a CDN at runtime
// Simulation code (src/sim/*, src/arenas/*) is wrapped in createSim(): inside it Math.random becomes a seeded RNG
// and Math.sin/cos/atan2/atan/exp/hypot become DET_MATH, so every JS engine computes identical physics.
// Effects/sounds the simulation triggers are injected through env.fx (no-ops on the server).
//   options: --only key1,key2 (bundle only these arenas)
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { fileURLToPath } from 'node:url'

const ROOT = path.dirname(fileURLToPath(import.meta.url))
const S = path.join(ROOT, 'src')
// Arena order here is display order only; stage ids live in packages/shared/src/replay.ts (append-only).
let ARENA_FILES = ['spillway', 'rooftop', 'mall', 'junkyard', 'boardwalk', 'overpass', 'factory', 'schoolyard']
ARENA_FILES = ARENA_FILES.filter((k) => fs.existsSync(path.join(S, 'arenas', k + '.js')))
const FX_NAMES = ['sfx', 'vfx', 'announce', 'shake', 'hitMark', 'pickupFx', 'killFeed']
const SIM_FILES = ['01_base.js', '10_world.js', '20_skater.js', '30_combat.js', '50_bots.js']
const args = process.argv.slice(2)
if (args.includes('--only')) { const keep = args[args.indexOf('--only') + 1].split(','); ARENA_FILES = ARENA_FILES.filter((k) => keep.includes(k)) }

const rd = (...p) => fs.readFileSync(path.join(S, ...p), 'utf8')
const detTransform = (js) => js.replaceAll('Math.random()', 'RNG()').replace(/\bMath\.(sin|cos|atan2|atan|exp|hypot)\(/g, 'DM.$1(')
for (const f of [...SIM_FILES.map((f) => ['sim', f]), ['sim', '90_round.js'], ...ARENA_FILES.map((k) => ['arenas', k + '.js'])]) {
  const src = rd(...f)
  if (/\*\*|Math\.pow\b/.test(src.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, ''))) throw new Error(`${f.join('/')}: ** and Math.pow are not deterministic across engines; multiply instead`)
}

const det = rd('sim', '00_det.js'), base = rd('sim', '01_base.js'), follow = rd('sim', '99_follow.js')
const body = [
  ...SIM_FILES.map((f) => `// ═════ sim/${f} ═════\n` + detTransform(rd('sim', f))),
  ...ARENA_FILES.map((k) => `// ═════ arenas/${k}.js ═════\n` + detTransform(rd('arenas', k + '.js'))),
  '// ═════ sim/90_round.js ═════\n' + detTransform(rd('sim', '90_round.js')),
]
const createSimSrc = `// ═════════════════ createSim(env) — one isolated, deterministic simulation instance ═════════════════
// env = { seed, fx: { sfx, vfx, … } }. Create a fresh instance per round so no state leaks between rounds.
function createSim(env = {}) {
  const FX = env.fx || {}, NOOP = () => {};
${FX_NAMES.map((n) => `  const ${n} = FX.${n} || NOOP;`).join('\n')}
  const DM = DET_MATH;
  let RNG = makeRng(env.seed == null ? 1 : env.seed);
${body.join('\n')}
  return { ARENAS, createRound, packInput, unpackInput, validInput, IDLE_INPUT, WEAPONS, SKATERS, TRICKS, MODE, BTN, DT, MAX_TICKS, WARMUP,
    makeSkater, stepSkater, groundAt, zoneAt, primTop, surfL, raycast, botInput, LOOT,
    reseed(s) { RNG = makeRng(s); }, random: () => RNG() };
}
`
fs.mkdirSync(path.join(ROOT, 'dist'), { recursive: true })
const sim = `'use strict';\n${det}\n${createSimSrc}\n${follow}\nif (typeof module === 'object' && module.exports) module.exports = { createSim, createFollower, DET_MATH, makeRng, hashNums, shuffleWith };\n`
fs.writeFileSync(path.join(ROOT, 'dist', 'sim.cjs'), sim)

// ── browser bundle
const client = fs.readdirSync(S).filter((f) => f.endsWith('.js') && /^\d\d/.test(f)).sort()
const envFx = FX_NAMES.map((n) => `${n}: (...a) => FXHOOK.${n}(...a)`).join(', ')
const js = ["'use strict';", det,
  '// browser global scope: real randomness + native maths (visuals); the simulation scope rebinds both',
  'const DM = Math;\nconst RNG = Math.random;',
  "const ONLINE = !!(typeof window !== 'undefined' && window.GH_ONLINE); // set by the server-hosted page",
  '// ═════ sim/01_base.js (global copy) ═════\n' + base, createSimSrc, follow,
  `const FXHOOK = { ${FX_NAMES.map((n) => `${n}() {}`).join(', ')} }; // the client installs real effects`,
  `const FX_ENV = { ${envFx} };`,
  'const SIM0 = createSim({ fx: FX_ENV, seed: 1 }); // menus, attract mode, previews',
  'const { ARENAS, MODE, LOOT } = SIM0;',
  ...client.map((f) => `// ═════ ${f} ═════\n` + rd(f)),
].join('\n')
const webDir = path.join(ROOT, 'dist-web')
fs.mkdirSync(path.join(webDir, 'vendor'), { recursive: true })
const hash = (s) => crypto.createHash('sha256').update(s).digest('base64url').slice(0, 8)
const gameName = `game-${hash(js)}.js`
for (const f of fs.readdirSync(webDir)) if (/^game-.*\.js$/.test(f)) fs.rmSync(path.join(webDir, f))
fs.writeFileSync(path.join(webDir, gameName), js)
for (const f of fs.readdirSync(path.join(ROOT, 'vendor'))) fs.copyFileSync(path.join(ROOT, 'vendor', f), path.join(webDir, 'vendor', f))
const head = rd('head.html')
fs.writeFileSync(path.join(webDir, 'index.html'), `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>Grindhouse · Skate. Slam. Survive.</title>
<meta name="description" content="Grindhouse: a 2–8 player skateboard deathmatch. One life, sixty seconds, last skater standing.">
<meta name="theme-color" content="#22292B">
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Crect width='64' height='64' rx='14' fill='%2322292B'/%3E%3Cpath d='M12 40h40l-4 6H16z' fill='%23B4E64A'/%3E%3Ccircle cx='20' cy='50' r='4' fill='%23FF5C69'/%3E%3Ccircle cx='44' cy='50' r='4' fill='%23FF5C69'/%3E%3Cpath d='M22 18l20 4-6 14-12-2z' fill='%2336DCE8'/%3E%3C/svg%3E">
<script type="importmap">{ "imports": { "three": "/vendor/three.module.min.js" } }</script>
${head}
<script>window.GH_ONLINE = location.protocol.startsWith('http') && !/[?&]offline\\b/.test(location.search); window.GH_GAME = '${gameName}';</script>
<script type="module">
  import * as THREE from 'three';
  window.THREE = THREE;
  const s = document.createElement('script'); s.src = '/' + window.GH_GAME; s.onerror = () => { document.body.dataset.err = 'game failed to load'; }; document.body.appendChild(s);
</script>
<script type="module" src="/wallet/wallet.js" onerror="window.HSWalletError='The wallet bundle is missing (build the wallet bridge).'"></script>
</body>
</html>
`)
console.log(`built: dist/sim.cjs · dist-web/${gameName} (${(js.length / 1024).toFixed(0)} KB) · arenas: ${ARENA_FILES.join(', ')}`)
