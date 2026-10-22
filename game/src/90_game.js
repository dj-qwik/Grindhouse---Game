// ───────────────────────── GAME FLOW: menus, practice, countdown, play, spectate, results ─────────────────────────
let ROUND = null; // the round being drawn (practice, online follower, attract mode or a replay)
const GAME = {
  screen: 'home', mode: 'attract', phase: 'menu', me: 0, players: [], look: +(store.get('gh_look') || 0), myName: store.get('gh_name') || '',
  arena: store.get('gh_arena') || 'random', bots: +(store.get('gh_bots') || 7), diff: store.get('gh_diff') || 'hard', pmode: store.get('gh_pmode') === 'free' ? 'free' : 'dm',
  acc: 0, countT: 0, doneT: 0, inputs: [], seed: 0, key: null, myDeath: null, lastKill: null, spec: -1, specMode: 'follow', prev: new Map(),
  hist: [], shown: null, replay: null, results: null, attract: null,
};
const viewSeat = () => (GAME.spec >= 0 ? GAME.spec : GAME.me);
const nameOf = (i) => { const p = GAME.players.find((x) => x.i === i); return p ? (i === GAME.me && GAME.mode !== 'attract' && GAME.mode !== 'replay' ? (GAME.myName || 'You') : p.name) : ROUND && ROUND.sk[i] ? ROUND.sk[i].name : '?'; };
const ARENA_LIST = () => Object.values(ARENAS);
function showOverlay(html) {
  const ov = $('#ov');
  if (!html) { ov.hidden = true; ov.innerHTML = ''; return; }
  if (!ov.hidden && ov.innerHTML === html) return;
  ov.hidden = false; ov.innerHTML = html;
}

// ───────────── screens
function homeCard() {
  const cashLive = CASH.enabled(), cashPending = CASH.pending();
  const unit = CASH.unit();
  return `<div class="card home">
    <div class="hero">
      <div class="tagline">SKATE · SLAM · SURVIVE</div>
      <div class="title">GRIND<br>HOUSE</div>
      <p style="max-width:620px;color:var(--cream)">A 2–8 player skateboard deathmatch. One life, sixty seconds, last skater standing. Grind rails and land tricks to charge your Adrenaline, scavenge weapons, and don't get caught outside the squeeze.</p>
    </div>
    <div class="modes">
      <button class="mode cash" id="goCashReal" ${cashLive || cashPending ? '' : 'disabled'}>
        <span class="k">PLAY FOR ${unit}</span>
        <span class="d">${cashLive ? 'Equal stakes into an escrow on Robinhood Chain. Winner takes 90% of the pot, paid automatically.' : cashPending ? 'Wallet loading…' : 'Real-money lobbies are not open on this server yet.'}</span>
      </button>
      <button class="mode online" id="goOnline" ${NET.enabled() ? '' : 'disabled'}><span class="k">FREE ONLINE</span><span class="d">${NET.enabled() ? 'Real players first; bots fill empty seats.' : 'Online play needs the game server.'}</span></button>
      <button class="mode practice" id="goPractice"><span class="k">PRACTICE</span><span class="d">You vs bots on any arena. Learn the lines, test the weapons.</span></button>
    </div>
    <div class="facts"><span>8 arenas</span><span>16 weapons</span><span>8 skaters</span><span>60 s hard cap</span><span>Server-decided winner</span><span>90 / 10 payout</span></div>
    <div class="row"><button class="btn ghost small" id="howto">How to play</button><button class="btn ghost small" id="openSettings">Controls &amp; settings</button>${cashLive ? `<button class="btn ghost small" id="cashWallet">Wallet</button>` : ''}</div>
  </div>`;
}
function skaterPicker() {
  return `<div style="display:grid;gap:6px"><span class="label">Skater · cosmetic only, everyone shares the same stats</span><div class="skaters">${SKATERS.map((k, i) => `<button class="sk${i === GAME.look ? ' sel' : ''}" data-look="${i}"><img src="${portrait(i)}" alt="" width="56" height="56"><span>${esc(k.name)}</span></button>`).join('')}</div></div>`;
}
function practiceCard() {
  const arenas = ARENA_LIST();
  return `<div class="card">
    <div class="row" style="justify-content:space-between"><h2>Practice</h2><span class="label">free · offline · bots</span></div>
    <div style="display:grid;gap:6px"><span class="label">Mode</span><div class="seg">${[['dm', 'Deathmatch', 'last skater standing · 60 s'], ['free', 'Free ride', 'no timer · no fighting · bots just skate']].map(([k, l, d]) => `<button class="${k === GAME.pmode ? 'sel' : ''}" data-pmode="${k}">${l}<small>${d}</small></button>`).join('')}</div></div>
    <div style="display:grid;gap:6px"><span class="label">Arena</span><div class="arenas">
      <button class="arena-pick${GAME.arena === 'random' ? ' sel' : ''}" data-arena="random"><b>RANDOM</b><small>any of the ${arenas.length}</small></button>
      ${arenas.map((a) => `<button class="arena-pick${GAME.arena === a.key ? ' sel' : ''}" data-arena="${a.key}"><b>${esc(a.name.toUpperCase())}</b><small>${esc(a.blurb || '')}</small></button>`).join('')}
    </div></div>
    <div class="cols">
      <div style="display:grid;gap:6px"><span class="label">${GAME.pmode === 'free' ? 'Other skaters' : 'Opponents'}</span><div class="seg">${[1, 3, 5, 7].map((n) => `<button class="${n === GAME.bots ? 'sel' : ''}" data-bots="${n}">${n}<small>bot${n > 1 ? 's' : ''}</small></button>`).join('')}</div></div>
      ${GAME.pmode === 'free' ? '' : `<div style="display:grid;gap:6px"><span class="label">Bot skill</span><div class="seg">${[['easy', 'Easy'], ['hard', 'Hard']].map(([k, l]) => `<button class="${k === GAME.diff ? 'sel' : ''}" data-diff="${k}">${l}</button>`).join('')}</div></div>`}
    </div>
    ${skaterPicker()}
    <div class="row"><button class="btn primary big" id="practiceGo">Drop in</button><button class="btn ghost" id="back">Back</button></div>
  </div>`;
}
function howtoCard() {
  const k = (a) => `<kbd>${esc(keyLabel(KEYMAP[a]))}</kbd>`;
  return `<div class="card">
    <h2>How to play</h2>
    <div class="cols">
      <div style="display:grid;gap:10px;align-content:start">
        <h3>The match</h3>
        <ul class="fine" style="font-size:14px;color:var(--text)">
          <li>Everyone spawns with a Scrap Pistol, a Splinter Bat and one Shove. Roll over glowing pedestals to grab better guns and gear (waves at 3, 17, 33 and 44 s).</li>
          <li>One life. The safe zone squeezes from 12 s; outside it you take escalating damage. From 50 s only the final core is safe and lethal pulses speed up.</li>
          <li>Last skater standing wins. At exactly 60 s the server ranks survivors by <b>health</b>, then <b>eliminations</b>, then <b>damage dealt</b>, then a <b>seeded tiebreak order</b> fixed before the match. If everyone left goes down on the same tick, the same ranking uses health from just before that tick.</li>
          <li>Tricks don't score points: clean landings fill your <b>Adrenaline</b>. Trick + ←→↑↓ are quick flips; trick + a diagonal are the big ones (360 Flip, Laser Flip, Hardflip, 540 McTwist) that need a charged launch off a ramp. Trick with no direction at the top of a quarter pipe is a Handplant. Near any ledge or box edge: ↑ + trick hops on and grinds it, ↓ + trick in the air handplants on it. Ride or fly at a wall and hit trick to kick off it for extra air, then chain a trick. Chain moves in one combo for up to ×2. At 50 your next melee hit lands harder; at 100 unleash a Super Slam. Repeating the same trick pays less each time.</li>
        </ul>
      </div>
      <div style="display:grid;gap:10px;align-content:start">
        <h3>Controls</h3>
        <div class="keys">
          <kbd>${esc(keyLabel(KEYMAP.fwd) + keyLabel(KEYMAP.left) + keyLabel(KEYMAP.brake) + keyLabel(KEYMAP.right))}</kbd><span>Push · steer · ${esc(keyLabel(KEYMAP.brake))} brakes</span>${k('jump')}<span>Ollie (hold up a ramp, release at the lip for a big launch)</span>
          ${k('attack')}<span>Attack: locks onto whoever's in front</span>${k('trick')}<span>Trick in the air · Super Slam when Adrenaline is full</span>
          ${k('throw')}<span>Throw / shove</span><kbd>Mouse</kbd><span>Look and steer</span>
        </div>
        <p class="fine" style="padding:0">Controller: left stick steer (pull back to brake), right stick look, A ollie, RT attack, X trick / slam, B throw.</p>
        <p class="fine" style="padding:0">Weapons are picked up automatically when you roll over an upgrade. Attack uses your gun, or your melee weapon when someone's close. Hold a direction while you trick for different flips (diagonals = big tricks). Drop onto rails to grind; hit tall walls in the air to wallride.</p>
      </div>
    </div>
    <div class="row"><button class="btn primary" id="back">Got it</button></div>
  </div>`;
}
function settingsCard() {
  return `<div class="card">
    <h2>Controls &amp; settings</h2>
    <div class="cols">
      <div style="display:grid;gap:12px;align-content:start">
        <label class="label">Look sensitivity <b id="sensV">${SETTINGS.sens.toFixed(2)}</b><input type="range" min="0.2" max="3" step="0.05" value="${SETTINGS.sens}" data-set="sens" style="width:100%"></label>
        <label class="label">Controller dead zone <b>${SETTINGS.deadzone.toFixed(2)}</b><input type="range" min="0.05" max="0.4" step="0.01" value="${SETTINGS.deadzone}" data-set="deadzone" style="width:100%"></label>
        <label class="label">Field of view <b>${Math.round(SETTINGS.fov * 100)}%</b><input type="range" min="0.85" max="1.2" step="0.01" value="${SETTINGS.fov}" data-set="fov" style="width:100%"></label>
        <label class="label">Volume <b>${Math.round(AUDIO.vol * 100)}%</b><input type="range" min="0" max="1" step="0.05" value="${AUDIO.vol}" data-set="vol" style="width:100%"></label>
        <label class="check"><input type="checkbox" data-set="invertY" ${SETTINGS.invertY ? 'checked' : ''}><span>Invert camera Y</span></label>
        <label class="check"><input type="checkbox" data-set="vibrate" ${SETTINGS.vibrate ? 'checked' : ''}><span>Controller vibration</span></label>
        <div style="display:grid;gap:6px"><span class="label">Graphics</span><div class="seg">${['auto', 'high', 'low'].map((q) => `<button class="${SETTINGS.quality === q ? 'sel' : ''}" data-quality="${q}">${q}</button>`).join('')}</div></div>
      </div>
      <div style="display:grid;gap:8px;align-content:start">
        <span class="label">Keyboard &amp; mouse · click to rebind</span>
        <div class="remap">${ACTIONS.map(([a, label]) => `<span>${esc(label)}</span><button class="btn small ${INPUT.rebinding === a ? 'waiting' : 'ghost'}" data-rebind="${a}">${INPUT.rebinding === a ? 'press a key…' : esc(keyLabel(KEYMAP[a]))}</button><span></span>`).join('')}</div>
        <button class="btn ghost small" id="resetKeys" style="justify-self:start">Reset to defaults</button>
      </div>
    </div>
    <div class="row"><button class="btn primary" id="settingsDone">Done</button></div>
  </div>`;
}
let settingsBack = 'home';
function openSettings(again) { if (!again) settingsBack = GAME.screen; GAME.screen = 'settings'; releaseLock(); showOverlay(settingsCard()); }
function goHome() {
  NET.leaveIfAny?.();
  GAME.screen = 'home'; GAME.spec = -1; hudShow(false); hudExtra(''); releaseLock(); INPUT.enabled = false;
  showOverlay(homeCard()); startAttract(); musicMode('menu');
}

// ───────────── attract mode: a bot match plays behind the menus
function startAttract() {
  const keys = Object.keys(ARENAS), key = keys[Math.floor(Math.random() * keys.length)];
  const sim = createSim({ fx: FX_ENV, seed: 1 });
  const players = Array.from({ length: 8 }, (_, i) => ({ i, look: i, name: SKATERS[i].name, skill: 0.7 }));
  bindRound(sim.createRound({ key, seed: (Math.random() * 1e9) | 0, players, botSalt: 'attract' }), players, 'attract', -1);
  GAME.phase = 'play'; GAME.acc = 0;
}

// ───────────── bind a round to the view (practice, online, attract, replay)
function bindRound(R, players, mode, me) {
  ROUND = R; GAME.players = players; GAME.mode = mode; GAME.me = me; GAME.spec = -1; GAME.myDeath = null; GAME.lastKill = null;
  GAME.prev = new Map(); GAME.hist = []; GAME.shown = null; CAMR.pos = null; CAMR.piv = null; CAMR.d = null; CAMR.spec = null; CAMR.orbit = Math.random() * 6;
  clearScene(); buildArena(R);
  for (const s of R.sk) GAME.prev.set(s.i, { x: s.x, y: s.y, z: s.z, yaw: s.yaw });
  if (me >= 0) { INPUT.yaw = R.sk[me].yaw; INPUT.pitch = -0.12; }
  HUD.cache = {}; HUD.lastBank = null; $('#hFeed').innerHTML = '';
}
function snapPrev() { if (!ROUND) return; for (const s of ROUND.sk) { const p = GAME.prev.get(s.i); if (p) { p.x = s.x; p.y = s.y; p.z = s.z; p.yaw = s.yaw; } } }

// ───────────── practice
function startPractice() {
  const keys = Object.keys(ARENAS);
  const key = GAME.arena === 'random' || !ARENAS[GAME.arena] ? keys[Math.floor(Math.random() * keys.length)] : GAME.arena;
  const seed = (Math.random() * 4294967295) >>> 0, n = GAME.bots + 1;
  const looks = [GAME.look, ...[0, 1, 2, 3, 4, 5, 6, 7].filter((l) => l !== GAME.look)];
  const players = Array.from({ length: n }, (_, i) => ({ i, look: looks[i], name: i === 0 ? (GAME.myName || 'You') : BOT_NAMES[(i + seed) % BOT_NAMES.length], human: i === 0,
    skill: GAME.diff === 'easy' ? 0.5 + Math.random() * 0.12 : 0.72 + Math.random() * 0.1 }));
  const sim = createSim({ fx: FX_ENV, seed: 1 });
  const free = GAME.pmode === 'free';
  const R = sim.createRound({ key, seed, players, botSalt: 'practice', free });
  bindRound(R, players, 'practice', 0);
  GAME.key = key; GAME.seed = seed; GAME.inputs = []; GAME.replaySrc = free ? null : { kind: 'practice', key, seed, players, inputs: GAME.inputs };
  if (free) GAME.inputs = { push() {} }; // nothing to replay in free ride; don't keep an ever-growing log
  beginCountdown(GAME.seenHow ? 4 : 6); GAME.seenHow = true;
}
function beginCountdown(sec) {
  GAME.screen = 'match'; GAME.phase = 'count'; GAME.countT = sec; GAME.acc = 0; GAME.results = null;
  showOverlay(''); hudShow(true); INPUT.enabled = true; requestLock();
  const A = ROUND.def;
  hudExtra(howToCard() + `<div class="prestart" id="pre"><div class="a">${esc(A.name.toUpperCase())}</div><div class="b">${esc(A.finale || '')}</div></div>
    <div class="countdown" id="cdn"></div>${lockHint()}`);
  musicMode('match'); musicStart();
}
// the pre-match sign: what to do, and how Adrenaline works (shown over the countdown)
function howToCard() {
  const K = (a) => `<kbd>${esc(keyLabel(KEYMAP[a]))}</kbd>`, free = ROUND && ROUND.free;
  return `<div class="howpop" id="howpop">
    <b class="t">${free ? 'JUST SKATE.' : 'SKATE OR DIE.'}</b>
    ${free ? '<p class="s">No clock. No guns. Find the halfpipe and get hella air.</p>' : '<p class="s">Wreck everyone. Don\'t get wrecked. Last one rolling wins.</p>'}
    <div class="hr"><span class="ic">⚡</span><p><b>Land tricks</b> to charge <b class="ad">ADRENALINE</b><br><small>${K('trick')} + any direction mid-air · kick off walls · grind any ledge · chain 'em</small></p></div>
    ${free ? '' : `<div class="hr"><span class="ic">½</span><p><b>Half full:</b> your next melee hit lands extra hard</p></div>`}
    <div class="hr"><span class="ic">💥</span><p><b>Full:</b> hit ${K('trick')} for a <b class="ad">SUPER SLAM</b>${free ? ' · bowl everyone over' : ''}</p></div>
  </div>`;
}
const lockHint = () => (INPUT.usingPad ? '' : `<div class="lockhint" id="lockHint" ${INPUT.locked ? 'hidden' : ''}>Click to use the mouse</div>`);

// ───────────── per-frame
function frame(now) {
  const dt = Math.min(0.1, (now - (frame.last || now)) / 1000); frame.last = now;
  const inp = sampleInput(dt);
  try {
    if (GAME.mode === 'online') NET.frame(dt, inp);
    else if (GAME.mode === 'practice') practiceFrame(dt, inp);
    else if (GAME.mode === 'attract') attractFrame(dt);
    else if (GAME.mode === 'replay') replayFrame(dt);
    if (ROUND) {
      syncArena(ROUND, ROUND.t, dt);
      const view = viewFn();
      syncDynamic(ROUND, dt, view); syncLock(ROUND, view);
      cameraFrame(dt, view);
      if (GAME.screen === 'match') { updateHud(ROUND, dt); deathFrame(); }
      const me = ROUND.sk[viewSeat()];
      if (me && GAME.screen === 'match') rollUpdate(Math.hypot(me.vx, me.vz), me.mode === MODE.GROUND, me.mode === MODE.GRIND);
      else rollUpdate(0, false, false);
    }
    stepFx(dt);
    GFX.r.render(GFX.scene, GFX.cam);
    renderPip();
    perf(dt);
  } catch (e) { console.error(e); document.body.dataset.err = 'error: ' + e.message; }
  requestAnimationFrame(frame);
}
function perf(dt) {
  if (GFX.test) return;
  GFX.fpsAvg = GFX.fpsAvg * 0.97 + (1 / Math.max(dt, 1e-3)) * 0.03;
  const q = SETTINGS.quality;
  const want = q === 'low' ? 1 : q === 'high' ? Math.min(devicePixelRatio || 1, 2) : GFX.fpsAvg < 42 ? 0.75 : GFX.fpsAvg > 56 ? Math.min(devicePixelRatio || 1, 1.5) : null;
  if (want && Math.abs(GFX.r.getPixelRatio() - want) > 0.05 && performance.now() - (perf.at || 0) > 3000) { perf.at = performance.now(); GFX.r.setPixelRatio(want); resize(); GFX.r.shadowMap.enabled = want >= 0.9; }
}
// interpolation between ticks (+ own-skater prediction online)
function viewFn() {
  const R = ROUND, a = Math.min(1, GAME.acc / DT), pred = GAME.mode === 'online' && GAME.phase === 'play' ? NET.predicted() : null;
  return (s) => {
    if (pred && s.i === GAME.me && s.alive) return { x: GAME.shown.x, y: GAME.shown.y, z: GAME.shown.z, yaw: pred.yaw, aimYaw: pred.aimYaw, aimPitch: pred.aimPitch, vx: pred.vx, vz: pred.vz, s: pred };
    const p = GAME.prev.get(s.i) || s, k = R.winner || GAME.phase !== 'play' ? 1 : a;
    const yaw = p.yaw + angWrap(s.yaw - p.yaw) * k;
    const mine = s.i === GAME.me && GAME.mode === 'practice';
    return { x: p.x + (s.x - p.x) * k, y: p.y + (s.y - p.y) * k, z: p.z + (s.z - p.z) * k, yaw, aimYaw: mine ? s.aimYaw : s.aimYaw, aimPitch: s.aimPitch, vx: s.vx, vz: s.vz };
  };
}
function cameraFrame(dt, view) {
  const R = ROUND;
  if (GAME.mode === 'attract' || GAME.screen !== 'match') {
    const Z = R.zoneNow || SIM0.zoneAt(R.W, R.t), alive = R.sk.filter((s) => s.alive);
    const f = GAME.results && GAME.results.w >= 0 ? R.sk[GAME.results.w] : alive[Math.floor(GAME.attractFocus || 0) % Math.max(1, alive.length)];
    if (GAME.results && f) { const v = view(f); orbitCamera(R, dt, v.x, v.y, v.z, 5.5, 2.2, 0.35); }
    else orbitCamera(R, dt, Z.x, 0, Z.z, Math.min(30, Z.r * 0.6 + 12), 9 + Math.min(10, Z.r * 0.1), 0.06);
    return;
  }
  if (GAME.mode === 'replay' && GAME.replay) { const c = GAME.replay.cam; const v = view(R.sk[c]); updateCamera(R, dt, v, { yaw: CAMR.yaw + dt * 0.4, pitch: -0.25, dist: 5 }); return; }
  const tgt = R.sk[viewSeat()];
  if (!tgt) return;
  const v = view(tgt);
  if (GAME.spec >= 0) { // spectating: follow behind, or free orbit with the mouse
    if (GAME.specMode === 'orbit') updateCamera(R, dt, v, { yaw: INPUT.yaw, pitch: INPUT.pitch, dist: 7 });
    else { // calm chase: follow where they're travelling (not which way the board is spinning), slowly, from higher up
      const sp = Math.hypot(tgt.vx, tgt.vz);
      if (CAMR.spec == null || CAMR.specT !== tgt.i) { CAMR.spec = sp > 1 ? Math.atan2(tgt.vx, tgt.vz) : tgt.yaw; CAMR.specT = tgt.i; }
      if (sp > 3 && tgt.mode !== MODE.AIR && tgt.mode !== MODE.DOWN) { const dy = angWrap(Math.atan2(tgt.vx, tgt.vz) - CAMR.spec); CAMR.spec += Math.max(-0.9 * dt, Math.min(0.9 * dt, dy * Math.min(1, dt * 0.8))); }
      updateCamera(R, dt, v, { yaw: CAMR.spec, pitch: -0.34, dist: 6 });
    }
    return;
  }
  const dead = !tgt.alive, md = GAME.myDeath;
  if (dead && md) { // victim's beat: a short push-in on your own wreck, then spectate
    const t = (performance.now() - md.at) / 1000;
    updateCamera(R, dt, v, { yaw: INPUT.yaw + Math.min(t, 2) * 0.12, pitch: -0.45, dist: 3 + Math.min(t, 2) * 1.2 });
    return;
  }
  autoFollow(dt, tgt);
  updateCamera(R, dt, v, { yaw: INPUT.yaw, pitch: INPUT.pitch });
}

function practiceFrame(dt, inp) {
  const R = ROUND;
  if (GAME.phase === 'count') {
    const before = Math.ceil(GAME.countT); GAME.countT -= dt;
    const n = Math.ceil(GAME.countT);
    if (n !== before && n > 0) playSfx('tick');
    const el = $('#cdn'); if (el) el.textContent = GAME.countT > 0 ? String(n) : '';
    if (GAME.countT <= 0) { GAME.phase = 'play'; hudExtra(lockHint()); banner('GO'); }
    return;
  }
  if (GAME.phase === 'play') {
    // fixed 60 Hz steps; at most a few per frame
    const me = R.sk[GAME.me];
    // slow-motion beat when you go down (visual only, practice); the match clock never pauses for others online
    const slow = GAME.myDeath && performance.now() - GAME.myDeath.at < 700 ? 0.3 : 1;
    GAME.acc += dt * slow;
    GAME.pend = (GAME.pend || 0) | inp.btn; // presses wait for the next tick (high refresh rates draw several frames per tick)
    let n = 0;
    while (GAME.acc >= DT && n++ < 6) {
      GAME.acc -= DT;
      snapPrev();
      const aim = me.alive ? aimFrom(R, me) : { yaw: INPUT.yaw, pitch: 0 };
      const btn = GAME.pend | heldMask() | (INPUT.padHeld || 0); GAME.pend = 0;
      const st = stickFor(inp, aim.yaw);
      const p = SIM0.packInput({ mx: st.mx, my: st.my, yaw: aim.yaw, pitch: aim.pitch, btn, lag: 0 });
      const inputs = { [GAME.me]: p };
      GAME.inputs.push(p);
      R.step(inputs);
      if (R.winner) { roundOver(); break; }
    }
    if (n > 6) GAME.acc = 0;
    return;
  }
  if (GAME.phase === 'done') { GAME.acc += dt * 0.35; while (GAME.acc >= DT) { GAME.acc -= DT; snapPrev(); R.coast(); } doneFrame(dt); }
}
// buttons that are physically held stay down across catch-up ticks (presses only count once)
function heldMask() { let m = keyDown('KeyP') ? BTN.deuce : 0; for (const a of ['boost', 'brake', 'jump', 'trick', 'attack', 'throw']) if (act(a)) m |= BTN[a]; if (keyDown(ALT_KEYS.brake)) m |= BTN.brake; return m; }
function attractFrame(dt) {
  const R = ROUND; GAME.acc += dt; GAME.attractFocus = (GAME.attractFocus || 0) + dt * 0.12;
  let n = 0; while (GAME.acc >= DT && n++ < 4) { GAME.acc -= DT; snapPrev(); R.step({}); if (R.winner) { if (!GAME.attractEnd) GAME.attractEnd = performance.now(); break; } }
  if (GAME.attractEnd && performance.now() - GAME.attractEnd > 3500) { GAME.attractEnd = 0; startAttract(); }
}
function roundOver() {
  GAME.phase = 'done'; GAME.doneT = 0; GAME.acc = 0; releaseLock(); INPUT.enabled = false;
  const R = ROUND, w = R.winner;
  GAME.results = { w: w ? w.i : -1, standings: R.standings(), t: R.t, timeout: !!R.timeout, key: R.key };
  musicMode('menu');
  hudExtra('');
}
function doneFrame(dt) {
  GAME.doneT += dt;
  if (GAME.doneT > 2.2 && !GAME.results.shown) { GAME.results.shown = true; hudShow(false); GAME.screen = 'results'; showOverlay(resultsCard()); }
}
function resultsCard() {
  const r = GAME.results, R = ROUND, w = r.w >= 0 ? R.sk[r.w] : null, mine = r.w === GAME.me && GAME.mode !== 'attract';
  const cash = GAME.mode === 'online' && CASH.isCashMatch();
  const rows = r.standings.map((s) => `<div class="pl${s.place === 1 ? ' first' : ''}${s.i === GAME.me ? ' me' : ''}"><span class="n">${s.place}</span><span><b>${esc(nameOf(s.i))}</b>${s.place > 1 && s.w ? ` <small style="color:var(--dim)">· ${esc(s.w === 'fell' ? 'fell' : WEAPONS[s.w] ? WEAPONS[s.w].name : HAZ_NAMES[s.w] || s.w)}${s.by >= 0 ? ' by ' + esc(nameOf(s.by)) : ''}</small>` : ''}</span><span>${s.kills} KO</span><span>${s.dmg} dmg</span><span>${s.place === 1 ? s.hp + ' hp' : (s.deathT >= 0 ? s.deathT.toFixed(1) + 's' : '')}</span></div>`).join('');
  return `<div class="card">
    <div class="winner">
      ${w ? `<img src="${portrait(w.look)}" alt="" width="96" height="96" style="border-radius:50%;border:4px solid var(--ink);box-shadow:5px 5px 0 var(--lime)">` : ''}
      <div class="crown">${mine ? 'YOU WIN' : w ? esc(nameOf(w.i).toUpperCase()) + ' WINS' : 'NO WINNER'}</div>
      <span class="label">${esc(ARENAS[r.key].name)} · ${r.t.toFixed(1)} s${r.timeout ? ' · decided at 60 s by the tiebreak (health › kills › damage › seed)' : ''}</span>
    </div>
    ${cash ? CASH.championExtra(w) : ''}
    <div class="standings">${rows}</div>
    <div class="row">
      ${GAME.mode === 'online' ? `<button class="btn primary big" id="again">${cash ? 'Rematch' : 'Play again'}</button>` : `<button class="btn primary big" id="rematch">Rematch</button>`}
      ${GAME.lastKill && GAME.replaySrc ? '<button class="btn cyan" id="watchReplay">Final elimination replay</button>' : ''}
      <button class="btn ghost" id="home">Home</button>
    </div>
  </div>`;
}

// ───────────── death + spectating
function deathFrame() {
  const R = ROUND, me = R.sk[GAME.me];
  if (!me || me.alive || GAME.phase !== 'play' || GAME.mode === 'attract' || GAME.mode === 'replay') return;
  const md = GAME.myDeath || { by: me.killer, w: me.killWeapon, at: performance.now() - 2000 };
  const t = (performance.now() - md.at) / 1000;
  if (t > 2 && GAME.spec < 0) { const alive = R.sk.filter((s) => s.alive); GAME.spec = (alive.find((s) => s.i === md.by) || alive[0] || me).i; }
  const left = R.alive;
  const html = `<div class="death"><div class="big">ELIMINATED</div><div class="by">${md.by >= 0 ? `by <b>${esc(nameOf(md.by))}</b> · ${esc(md.w || '')}` : `${esc(md.w || 'the arena')}`} · ${left} remaining</div></div>
    ${GAME.spec >= 0 ? `<div class="spec"><button class="btn small" id="specPrev">◀</button><span>Watching ${esc(nameOf(GAME.spec))}</span><button class="btn small" id="specNext">▶</button><button class="btn small ghost" id="specMode">${GAME.specMode === 'follow' ? 'Free orbit' : 'Follow'}</button>${GAME.mode === 'practice' ? '<button class="btn small hot" id="quitMatch">Leave</button>' : ''}</div>` : ''}`;
  hudExtra(html);
  if (GAME.spec >= 0 && !R.sk[GAME.spec].alive) cycleSpec(1);
}
function cycleSpec(d) {
  const alive = ROUND.sk.filter((s) => s.alive); if (!alive.length) return;
  const k = alive.findIndex((s) => s.i === GAME.spec);
  GAME.spec = alive[(k + d + alive.length) % alive.length].i;
}

// ───────────── final elimination replay (re-simulated from the recorded inputs, slowed down)
function startReplay() {
  const src = GAME.replaySrc, lk = GAME.lastKill; if (!src || !lk) return;
  const quiet = { on: true };
  const fx = Object.fromEntries(Object.keys(FX_ENV).map((k) => [k, (...a) => { if (!quiet.on) FX_ENV[k](...a); }]));
  const sim = createSim({ fx, seed: 1 });
  let R;
  if (src.kind === 'practice') R = sim.createRound({ key: src.key, seed: src.seed, players: src.players, botSalt: 'practice' });
  else { let qi = 0, q = src.init.slice(); R = sim.createRound({ key: src.key, seed: 0, players: src.players }, { feed: () => q[qi++] }); src._q = (d) => { q = d; qi = 0; }; }
  const from = Math.max(0, lk.tick - 150), until = lk.tick + 75;
  const stepAt = (k) => {
    if (src.kind === 'practice') { const inputs = { [0]: src.inputs[k] }; R.step(inputs); }
    else { const [row, draws] = src.frames[k]; src._q(draws); const inputs = {}; R.sk.forEach((s, j) => { inputs[s.i] = row[j]; }); R.step(inputs); }
  };
  for (let k = 0; k < from; k++) stepAt(k);
  quiet.on = false;
  const keepPlayers = GAME.players, keepMe = GAME.me, keepRound = ROUND, keepMode = GAME.mode;
  bindRound(R, keepPlayers, 'replay', keepMe);
  GAME.replay = { k: from, until, stepAt, cam: lk.by >= 0 ? lk.by : lk.v, back: { R: keepRound, mode: keepMode } };
  GAME.screen = 'match'; showOverlay(''); hudShow(false); hudExtra('');
  hudShow(true); $('#hud').querySelectorAll('.hbottom,#minimap,.hclock,.hsurv,#cross').forEach((e) => { e.style.visibility = 'hidden'; });
  hudExtra('<div class="prestart"><div class="a">FINAL ELIMINATION</div><div class="b">replay · half speed</div></div>');
}
function replayFrame(dt) {
  const P = GAME.replay; if (!P) return;
  GAME.acc += dt * 0.5;
  while (GAME.acc >= DT) {
    GAME.acc -= DT; snapPrev();
    if (P.k >= P.until || ROUND.winner && P.k > P.until - 30) { endReplay(); return; }
    P.stepAt(P.k++);
  }
}
function endReplay() {
  const P = GAME.replay; GAME.replay = null;
  $('#hud').querySelectorAll('.hbottom,#minimap,.hclock,.hsurv,#cross').forEach((e) => { e.style.visibility = ''; });
  bindRound(P.back.R, GAME.players, P.back.mode, GAME.me);
  GAME.phase = 'done'; GAME.screen = 'results'; hudShow(false); showOverlay(resultsCard());
}

// ───────────── clicks
$('#ov').addEventListener('click', (e) => {
  const t = e.target.closest('button'); if (!t) return;
  playSfx('ui');
  if (t.id === 'goPractice') { GAME.screen = 'practice'; showOverlay(practiceCard()); }
  else if (t.dataset.arena) { GAME.arena = t.dataset.arena; store.set('gh_arena', GAME.arena); showOverlay(practiceCard()); }
  else if (t.dataset.bots) { GAME.bots = +t.dataset.bots; store.set('gh_bots', GAME.bots); showOverlay(practiceCard()); }
  else if (t.dataset.pmode) { GAME.pmode = t.dataset.pmode; store.set('gh_pmode', GAME.pmode); showOverlay(practiceCard()); }
  else if (t.dataset.diff) { GAME.diff = t.dataset.diff; store.set('gh_diff', GAME.diff); showOverlay(practiceCard()); }
  else if (t.dataset.look) { GAME.look = +t.dataset.look; store.set('gh_look', GAME.look); showOverlay(GAME.screen === 'practice' ? practiceCard() : $('#ov').innerHTML.replace(/class="sk sel"/g, 'class="sk"').replace(`class="sk" data-look="${GAME.look}"`, `class="sk sel" data-look="${GAME.look}"`)); }
  else if (t.id === 'practiceGo') startPractice();
  else if (t.id === 'rematch') startPractice();
  else if (t.id === 'watchReplay') startReplay();
  else if (t.id === 'howto') { GAME.screen = 'howto'; showOverlay(howtoCard()); }
  else if (t.id === 'openSettings') openSettings();
  else if (t.id === 'settingsDone') { if (settingsBack === 'home') goHome(); else { GAME.screen = settingsBack; showOverlay(''); } }
  else if (t.dataset.rebind) { startRebind(t.dataset.rebind); showOverlay(settingsCard()); }
  else if (t.id === 'resetKeys') { for (const [a, , k] of ACTIONS) KEYMAP[a] = k; saveSettings(); showOverlay(settingsCard()); }
  else if (t.dataset.quality) { SETTINGS.quality = t.dataset.quality; saveSettings(); perf.at = 0; showOverlay(settingsCard()); }
  else if (t.id === 'back' || (t.id === 'home' && GAME.mode !== 'online')) goHome();
});
$('#ov').addEventListener('input', (e) => {
  const k = e.target.dataset && e.target.dataset.set; if (!k) return;
  if (e.target.type === 'checkbox') SETTINGS[k] = e.target.checked; else SETTINGS[k] = +e.target.value;
  if (k === 'vol') { AUDIO.vol = SETTINGS.vol; store.set('gh_vol', AUDIO.vol); if (master && !AUDIO.muted) master.gain.value = AUDIO.vol; }
  saveSettings();
  const lab = e.target.closest('label'); if (lab && e.target.type === 'range') { const b = lab.querySelector('b'); if (b) b.textContent = k === 'fov' || k === 'vol' ? Math.round(+e.target.value * 100) + '%' : (+e.target.value).toFixed(2); }
});
$('#hud').addEventListener('click', (e) => {
  const t = e.target.closest('button,#lockHint'); if (!t) return;
  if (t.id === 'lockHint') requestLock();
  else if (t.id === 'specPrev') cycleSpec(-1); else if (t.id === 'specNext') cycleSpec(1);
  else if (t.id === 'specMode') { GAME.specMode = GAME.specMode === 'follow' ? 'orbit' : 'follow'; }
  else if (t.id === 'quitMatch') goHome();
});
$('#stage').addEventListener('click', () => { if (GAME.screen === 'match' && INPUT.enabled && !INPUT.locked) requestLock(); });
addEventListener('keydown', (e) => {
  if (e.code === 'Escape' && GAME.screen === 'match' && GAME.mode === 'practice' && GAME.phase === 'play') { /* pointer lock releases by itself; show the leave option */ hudExtra(lockHint() + '<div class="spec" style="bottom:50%"><span>Paused input</span><button class="btn small hot" id="quitMatch">' + (ROUND && ROUND.free ? 'Leave free ride' : 'Leave practice') + '</button></div>'); }
  if (GAME.spec >= 0 && (e.code === 'ArrowRight' || e.code === 'KeyD')) cycleSpec(1);
  if (GAME.spec >= 0 && (e.code === 'ArrowLeft' || e.code === 'KeyA')) cycleSpec(-1);
});
addEventListener('mousedown', (e) => { if (GAME.spec >= 0 && GAME.screen === 'match' && INPUT.locked) cycleSpec(e.button === 2 ? -1 : 1); });
$('#settingsBtn').addEventListener('click', () => openSettings());
$('#mute').addEventListener('click', () => { audioInit(); setMuted(!AUDIO.muted); });
