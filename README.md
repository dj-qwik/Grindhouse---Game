# GRINDHOUSE — Skate · Slam · Survive

A browser-based 3D skateboard deathmatch. 2–8 skaters, one life, a 60-second hard cap, last skater standing.
Equal ETH entry stakes go into an escrow on **Robinhood Chain** (mainnet `4663`); the winner is paid **90%** of the
pot and the house **10%**, automatically, as soon as the result is final. Sign-in is Google or email through
**Privy** (each player gets their own game wallet). Multiplayer runs on **Render**.

Built on the Hot Shots stack (deterministic simulation + server-authoritative netcode + replay-verified escrow
settlement). Design source: *GRINDHOUSE Complete Build Bible v1.0*.

## Running it live (Render, mainnet)

The root `render.yaml` is a Render Blueprint. Every push to `main` redeploys.

1. Render → **New → Blueprint** → this repo, branch `main`. It creates `grindhouse-game` (web service, Standard
   plan) and `grindhouse-db` (paid Postgres — real-money records must not expire). Render generates every secret;
   nobody ever sees a private key.
2. In `grindhouse-game` → **Environment**, set:
   - **`OWNER_ADDRESS`** — your wallet. It receives the 10% house fee, is the escrow's guardian (pause/veto), and
     becomes the escrow admin after you accept the 2-day handover (`acceptDefaultAdminTransfer()` from that wallet).
   - `PRIVY_APP_ID` is already pinned in `render.yaml` (`cmviy007f00ta0hl5eoig0bbl`, public).
3. Privy dashboard: use a **Production** app → Configuration → App settings → Domains → add the Render URL (or your
   custom domain) to **Allowed origins** → Login methods: **Google** and **Email** on (blank Google client ID/secret
   is fine) → Embedded wallets on.
4. Open **`/status`** on the deployed site. Send about **0.005 ETH on Robinhood Chain** to the server wallet it
   shows (it pays gas for opening lobbies and paying out — fractions of a cent each). The server then deploys the
   Grindhouse escrow itself, registers its two result co-signers, and opens real-money lobbies.
5. After the first boot, copy the escrow address and deploy block from `/status` into `ESCROW_ADDRESS` /
   `ESCROW_DEPLOY_BLOCK` in `render.yaml` (commented out there) so a database loss can never redeploy it.

### What "lean mainnet launch" means (read this)
`CHAIN_ID=4663` + `ALLOW_RAW_KEYS_ON_MAINNET=i-understand`: the operator and both co-signer keys are derived from
Render-generated secrets and the co-signers run as child processes of the game server. **Whoever controls the Render
account controls the results of matches in progress.** Players' own wallets are never reachable (stakes sit in the
escrow contract; refunds and claims don't depend on the server). Turn on 2FA for Render and GitHub. Hardening path:
- Deploy the escrow with a **Safe multisig as admin** (`contracts/script/Deploy.s.sol` enforces this on 4663) and
  pin `ESCROW_ADDRESS`.
- Move keys to **KMS/HSM** (`services/settlement/src/keys.ts` → `kmsAccount`).
- Run the co-signers on **independent infrastructure** (`COSIGNER_URLS`).
- Get the escrow **independently audited** and get **legal advice on paid-entry skill contests** where you operate
  (some places treat them as gambling; you may need geofencing and eligibility checks). Confirm with Privy that this
  use fits their acceptable-use policy.

## The game (what's built)

| Area | Status |
|---|---|
| Skating | Push / boost push / carve / brake-powerslide, variable ollie with coyote time + buffer, kickflip, heelflip, shuvit, 360 shuvit, grinds (rails, ledges, handrails, copings), manuals, wallrides, quarter-pipe vert air and transfers, bails. Adrenaline 0–100 from clean landings with repeat decay; 50 = boosted melee hit, 100 = Signature Slam. |
| Combat | All 16 weapons from the balance table (§8) as data in `game/src/sim/01_base.js`: swept-arc melee with capped speed bonus and charged attacks, hitscan guns with falloff, rockets/buzzsaws (ricochet), grenades, sticky pipe bombs, molotov fire zones, the starter Shove. Damage bands → flinch / stagger / knockdown, 0.55 s stun immunity, hazard impact cooldowns, kill attribution (environment kills credit the last attacker). |
| Pickups | 12–18 anchors per arena, seeded weighted waves at 3 / 17 / 33 / 44 s, telegraphed 1.5 s ahead, proximity + interact, contested, two-slot carry + throwable, drops on elimination. |
| Arenas | 8 authored maps with 3 vertical routes, ≥4 contest points, hazards and a finale each, 4 layout variants each: The Spillway, Rooftop Riot, Mall Massacre, Junkyard Jam, Boardwalk Bloodbath, Neon Overpass, Factory Floor, Schoolyard Shutdown. |
| Match | Zone squeeze from 12 s, escalating damage, accelerating finale pulses 50–60 s. Last survivor wins; at 60.0 s the server ranks survivors by health → eliminations → damage → seeded order (published in the UI). Simultaneous deaths use health from just before that tick. |
| Client | Three.js cel shading (3-tone ramp, ink contours, outlines), procedural skaters (8 looks), weapons, graffiti, blood splatter decals, sparks, explosions, chase camera (3.4–4.4 m, FOV 68–82, shoulder aim, occlusion), crosshair convergence, HUD (clock, health, ammo, Adrenaline ring, minimap threat pings, kill feed, damage direction, low-health heartbeat), victim slow-mo + attacker picture-in-picture finisher, spectator (follow / free orbit), results with final-elimination replay, synthesized SFX + 160 BPM breakbeat score, remappable keyboard/mouse and controller. |
| Online | Server-authoritative 60 Hz simulation, 30 Hz input frames, client prediction of your own skater, 250 ms lag-compensated hits, reconnect with full resync, desync self-repair, free play with bot fill, practice vs bots. |
| Money | Privy Google/email sign-in with embedded game wallets, Add ETH / Cash out / Export key, stake tiers 0.001 / 0.005 / 0.01 / 0.05 ETH, lobbies of up to 8 that start at 8 or 60 s after the 2nd deposit, escrow lock, evidence publication, two co-signers replay the whole match before signing, instant 90/10 payout in the result transaction, refunds for lobbies that never start. |

Deliberate differences from the bible, and why:
- **Rounding dust goes to the winner**, not the house (`house = ⌊pot/10⌋`). That's what the audited escrow does; the
  house never takes more than 10%, and `winner + house = pot` exactly.
- **Netcode is deterministic lockstep with prediction** rather than snapshot/delta: every browser runs the same
  simulation on the server's input stream. It's cheaper (8 inputs per tick instead of world snapshots), gives
  bit-exact replays for the co-signers, and still predicts your own skater and lag-compensates hits.
- **Art is procedural** (built in code, toon-shaded). It reads clearly and runs fast; a 3D artist's rigged models
  can replace `game/src/12_skaters.js` later without touching gameplay.

## Controls
WASD steer/push (relative to the camera) · Shift boost push · Ctrl or C brake/powerslide · Space ollie (hold to
charge) · Q + direction trick (Q + S on the ground = manual) · Left mouse attack/fire · Right mouse aim / charge
melee (+ attack at 100 Adrenaline = Signature Slam) · E pick up · R / wheel / 1–2 swap · F shove/throw.
Controller: left stick, right stick, RT push/boost, LT brake, A ollie, X trick, RB attack, LB aim, Y pick up,
B throw, D-pad swap. Everything is remappable in Settings.

## Layout
```
game/src/sim/        deterministic simulation (runs on the server, in every browser and in the co-signers)
game/src/arenas/     one file per arena (see game/ARENA_GUIDE.md)
game/src/*.js        browser client: renderer, skaters, FX, HUD, flow, online, real-money UI
game/server/         authoritative game server (matches, lobbies, cash flow, status page)
game/tools/          determinism, network, exploit/fairness/pacing, map checks, cash end-to-end, screenshots
contracts/           escrow (Foundry): 90/10 instant payout, refunds, co-signed results
packages/shared/     chain config, payout math, single-round match rules, evidence + replay verification
services/settlement/ escrow client, indexer, co-signer, settlement worker
apps/web/            Privy wallet bridge (built to /wallet/wallet.js)
```

## Tests (CI runs all of these on every push)
```
npm run build                                  # game + wallet bridge
node game/tools/determinism.mjs 2              # server ↔ browser follower ↔ co-signer replay, every arena
node game/tools/nettest.mjs 1 4                # real server + WebSocket clients with latency, drop + reconnect
node game/tools/accept.mjs <arena> 60          # lazy-strategy exploits, pacing (median 38–54 s), zone-death share
node game/tools/map_check.mjs <arena>          # spawns, pickups, zone, reachability, every variant
node game/tools/cash_e2e.mjs [--mainnet]       # anvil: deploy → deposit → fill window → match → co-sign → 90/10 payout
node game/tools/practice_shot.mjs <arena> out 3000   # headless screenshots of a practice match
npm test                                       # shared + settlement suites; cd contracts && forge test
```

## Trust assumptions (say these out loud to players and auditors)
- The **admin** can rotate result signers and change the treasury. Put it behind a Safe and a timelock.
- The **guardian** can pause or abort (refund) but can never take funds. With instant payout there is no veto window:
  the co-signers' full replay of the match is the protection.
- **Co-signers** collectively decide the winner. In the lean launch they run beside the server.
- Players pay gas for their own deposit; the house pays gas for lobby creation, locking, results and refunds. Gas is
  never taken from the pot.
