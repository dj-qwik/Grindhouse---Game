# Grindhouse arena guide

Every arena is one file, `game/src/arenas/<key>.js`, that registers `ARENAS.<key>`. It is **simulation code**: it
runs identically on the server, in every browser and in the result co-signers, so it must be deterministic.
`game/src/arenas/spillway.js` is the reference implementation — read it first.

## Rules of the deterministic sandbox
- Never use `**` or `Math.pow` (multiply instead). `Math.sin/cos/atan2/exp/hypot` are fine (rewritten to fdlibm).
- Never use `Math.random()` except through the round's stream (it is rewritten to `RNG()`); prefer no randomness
  in arenas at all except choosing a `variant` (done for you: `build(v)` receives it).
- No `Date`, no `performance`, no DOM, no `window`. Pure data + arithmetic.
- Sort only with total comparators.

## The contract
```js
ARENAS.key = {
  key, name, blurb, finale,      // UI text (finale = one line describing the late-match squeeze)
  variants: 3..5,                // build(v) gets v in [0, variants): route toggles, prop shifts, gate offsets
  look: { sky, horizon, fog, sun: [x, y, z], ground, water?, accent: [...] },  // renderer palette (hex strings)
  build(v) { const A = mkArena({ half: 40 }); …; return A },   // fresh every round
  init(R)?,                      // optional, after spawn
  update(R, dt)?,                // BEFORE skaters move: move prims (sweepers, shutters), open holes, set warnings
  after(R, dt)?,                 // AFTER skaters move + combat: apply hazard damage with hazardHit / hazardTick
}
```
`R` = the round: `R.t` (seconds since GO, 0..60), `R.tick`, `R.sk` (skaters: x, y, z, vx, vy, vz, alive, mode…),
`R.W` (= the arena object you built), `R.zoneNow` ({x, z, r}).

## Geometry kit (game/src/sim/10_world.js)
Units are metres; y is up. Every primitive is an oriented rectangle footprint (centre `cx, cz`, size `w` along local
x, `d` along local z, `yaw`) that is solid from `y0` up to its surface. Local z points along `(sin yaw, cos yaw)`.
- `box(cx, cz, w, d, top, {yaw, y0, mat, wr})` flat top. `y0 > 0` makes a platform you can roll under (needs
  ≥ 1.8 m clearance). Box sides ≥ 2 m tall are wallrideable unless `wr: false`.
- `slope(cx, cz, w, d, h0, h1, {yaw, y0, mat})` height h0 at the near edge (local −z) to h1 at the far edge.
  Banks, kickers, stairs, escalators. Keep slopes ≤ ~40°.
- `qp(cx, cz, w, d, angDeg, {yaw, base})` quarter pipe rising toward local +z to a lip angle (55–65°).
- Helpers: `kicker(A, cx, cz, w, len, h, yaw)`, `funbox(A, cx, cz, w, len, h, yaw, rampLen)`,
  `stairs(A, cx, cz, w, len, h, yaw)` (+ handrail), `qpWithDeck(A, cx, cz, w, d, ang, yaw, deck)` (+ coping rail),
  `perimeter(A, half, h)`, `offs(cx, cz, yaw, lx, lz)` (local → world point), `mkRail([[x,y,z],…], {kind})`.
- `A.floor = false` removes the ground plane (rooftops, pier): then only prims are walkable and falling below
  `A.killY` eliminates. `A.holes.push({ cx, cz, w, d, open: false })` = a patch of floor you can open later.
- Rails: `A.rails.push(mkRail(pts, { kind: 'rail'|'ledge'|'handrail'|'coping' }))`. Grinding snaps when a skater
  drops onto one moving roughly along it. `rail.live = true` electrifies it (apply damage in `after`).
- Materials (`mat`, renderer only): concrete, wall, wood, metal, container, crate, gate, stairs, brick, roof,
  asphalt, sand, scrap, car, tile, fence, neon, bleacher, conveyor, press, glass, grass, water, plank.

## Layout requirements (bible §12)
- 65–90 m across (`half` 33–45); most cross-map traversals 6–9 s at ~10 m/s.
- **Three distinct vertical routes**, **four reliable weapon contest points** (`'center'` pickup tier),
  **multiple line-of-sight breaks**, a **central conflict zone**, and **≥ 2 viable escape transitions** (ramps,
  banks, stairs, kickers between levels) that stay open until 40 s.
- **8 spawns** (`A.spawns.push([x, z])` or `[x, z, yaw]`), at least 14 m apart, no immediate unobstructed firing
  lanes between neighbours (put cover between them). Spawns must be on solid, flat-ish ground.
- **12–18 pickup anchors**: `A.pickups.push([x, y, z, 'center'|'std'])` with y = the surface height there. At least
  4 `'center'` anchors. Never on top of a hazard or inside a prim.
- **Zone keyframes** `A.zone = [{t, x, z, r}, …]` from t 0 (r covering the whole map) to t 60 (r ≈ 5, the final
  core) on solid, reachable ground that is NOT a permanent hazard. Typical: r 62 → 48 (12 s) → 30 (28 s) → 18
  (40 s) → 9 (50 s) → 5 (60 s).
- **4 hazard types** and a **finale** (bible §12 lists each map's). Telegraph every hazard: set `warn` (0..1) on
  prims that are about to move/collapse, and describe live hazard areas in `A.hz` (see below) so the renderer
  can draw them. Hazards should start mild (12–28 s) and be lethal by 50 s. Hazard damage goes through
  `hazardHit(R, s, dmg, kx, kz, kind)` (impact with knockback, 0.5 s per-skater cooldown) or
  `hazardTick(R, s, dmgThisTick, kind)` (continuous). Environment kills credit whoever hit the victim last.
- Don't let hazards or contraction trap players in an unwinnable spot before 40 s.

## Hazard descriptors for the renderer: `A.hz`
An array the arena keeps up to date (same objects every tick, mutate in place):
`{ kind, x, y, z, r?, w?, d?, yaw?, on: bool, warn: 0..1 }` with kind one of
`grinder` (spinning blades, r), `fire` / `molten` (area, w×d), `press` (crusher pad, w×d; `on` while slamming),
`electric` (area or with `rail`), `magnet` (point + r), `water` (w×d), `sweep` (moving wall: point at its prim),
`fall` (an area about to give way, w×d), `pulse`. Moving/collapsing prims are drawn from the prims themselves
(`prim.gone`, `prim.warn`, updated `cx/cz/top`).

## Testing (from game/)
```
node build.mjs                         # must print your arena in the list
node tools/sim_smoke.mjs <key> 6       # quick look: lengths, kills, how people die
node tools/determinism.mjs 2           # server ↔ browser ↔ co-signer replay must match
node tools/accept.mjs <key> 60         # lazy strategies ≤ 20%, pacing median 38–54 s, < 60% zone deaths
node tools/map_check.mjs <key>         # spawns/pickups/zone on solid ground, separation, reachability report
```
Bots navigate in straight lines with hop-when-stuck, so make sure the main routes are rideable without precise
ollies (ramps up to each level), and that the zone centre is reachable from everywhere by riding.
