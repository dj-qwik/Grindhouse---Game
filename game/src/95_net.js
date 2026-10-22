// ───────────────────────── ONLINE PLAY ─────────────────────────
// The server runs every online match (60 Hz, authoritative). This browser sends only its sequenced inputs and replays
// the server's stream (inputs + random draws per tick) with the same deterministic simulation, so what you see is
// exactly what the server decided. Your own skater is predicted from your recent inputs; hits are resolved on the
// server against where targets were when you aimed (bounded lag compensation, 250 ms).
const NET = (() => {
  const N = {
    ws: null, status: 'off', token: store.get('gh_token'), rtt: 0, F: null, lobby: null, end: null, lastP: -1, sentAt: 0,
    backoff: 0, wanted: false, queueSize: 8, err: '', nonce: null, introUntil: 0, roundMsg: null,
  };
  const enabled = () => typeof ONLINE !== 'undefined' && ONLINE && location.protocol.startsWith('http');
  const send = (o) => { if (N.ws && N.ws.readyState === 1) N.ws.send(JSON.stringify(o)); };
  const hello = () => send({ t: 'hello', name: GAME.myName, look: GAME.look, token: N.token });
  function connect() {
    if (N.ws && N.ws.readyState <= 1) return;
    N.status = 'connecting';
    const ws = new WebSocket((location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host + '/ws');
    N.ws = ws;
    ws.onopen = () => { N.backoff = 0; hello(); };
    ws.onmessage = (e) => { let m; try { m = JSON.parse(e.data); } catch { return; } try { on(m); } catch (err) { console.error('net', m.t, err); } };
    ws.onclose = () => { if (N.ws !== ws) return; N.status = 'off'; if (N.wanted) setTimeout(connect, Math.min(5000, 300 * 2 ** N.backoff++)); };
  }
  const waiters = [];
  function on(m) {
    for (let k = waiters.length - 1; k >= 0; k--) if (waiters[k].types.includes(m.t)) waiters.splice(k, 1)[0].res(m);
    if (m.nonce) N.nonce = m.nonce;
    switch (m.t) {
      case 'cashLobby': return CASH.onLobby(m);
      case 'authOk': case 'authFail': return;
      case 'welcome':
        N.token = m.token; store.set('gh_token', m.token); N.status = 'online';
        if (N.queueing) { send({ t: 'queue', mode: 'free', size: N.queueSize }); N.queueing = false; }
        return;
      case 'pong': N.rtt = N.rtt ? N.rtt * 0.7 + (performance.now() - m.c) * 0.3 : performance.now() - m.c; return;
      case 'error':
        if (GAME.screen === 'cashSetup' || GAME.screen === 'cashLobby') { CASH.state.err = m.msg; CASH.state.busy = ''; CASH.refresh(); return; }
        N.err = m.msg; if (GAME.screen === 'onlineSetup') showOverlay(setupCard()); return;
      case 'lobby': N.lobby = m; N.lobbyAt = performance.now(); GAME.screen = 'onlineLobby'; showOverlay(lobbyCard()); return;
      case 'left': return;
      case 'match': return startOnline(m);
      case 'round': return round(m);
      case 'count': if (GAME.mode === 'online' && GAME.phase === 'intro') { GAME.phase = 'count'; GAME.countT = m.ms / 1000; } return;
      case 'tk': if (N.F && N.F.R) N.F.addFrames(m.k, m.f); return;
      case 'h': if (N.F) N.F.checkpoint(m.k, m.h); return;
      case 'end': if (N.F) N.F.ended(m); N.end = m; return; // results show when playback reaches the finish
      case 'presence': { if (m.i !== GAME.me) pushFeed(`<b>${esc(nameOf(m.i))}</b> <span class="w">${m.on ? 'reconnected' : 'lost connection'}</span>`, false); return; }
      case 'sync': return resync(m);
      case 'closed': if (m.reason !== 'finished' && GAME.mode === 'online' && GAME.screen !== 'results') { N.wanted = false; goHome(); } return;
    }
  }
  function startOnline(m) {
    if (m.mode === 'cash') CASH.onMatch(m); else CASH.state.match = null;
    GAME.me = m.you; N.end = null;
    GAME.players = m.seats.map((s) => ({ i: s.i, name: s.name, look: s.look, bot: s.bot }));
    N.F = createFollower({ createSim, fx: FX_ENV, me: m.you, onDesync: (why) => { console.warn('desync', why); send({ t: 'resync' }); } });
  }
  function round(m) {
    if (!N.F) return;
    N.end = null; N.roundMsg = m;
    const R = N.F.round(m);
    bindRound(R, GAME.players.length ? GAME.players : m.players, 'online', GAME.me);
    GAME.replaySrc = { kind: 'online', key: m.key, players: m.players, init: m.init, frames: N.F.frames };
    beginCountdown((m.introMs + (m.countMs || 3000)) / 1000);
    GAME.phase = 'intro';
  }
  function resync(m) {
    if (!N.F || GAME.me !== m.match.you) startOnline(m.match);
    if (m.lobby) { N.lobby = m.lobby; GAME.screen = 'onlineLobby'; showOverlay(lobbyCard()); return; }
    if (!m.round) return;
    const R = N.F.sync(m);
    if (!R) return;
    N.roundMsg = m.round;
    bindRound(R, GAME.players, 'online', GAME.me);
    GAME.replaySrc = { kind: 'online', key: m.round.key, players: m.round.players, init: m.round.init, frames: N.F.frames };
    if (m.state === 'intro' || m.state === 'count') { beginCountdown(m.msLeft / 1000 + (m.state === 'intro' ? 3 : 0)); GAME.phase = m.state === 'intro' ? 'intro' : 'count'; }
    else { GAME.screen = 'match'; showOverlay(''); hudShow(true); INPUT.enabled = true; GAME.phase = 'play'; hudExtra(lockHint()); musicMode('match'); musicStart(); }
    if (m.end) N.end = { w: m.end.w, standings: m.end.standings };
  }
  // ── own-skater prediction (display only)
  const hist = []; // { t, p }
  function predicted() {
    const R = N.F && N.F.R, me = R && R.sk[GAME.me];
    if (!me || !me.alive || GAME.phase !== 'play') { GAME.shown = null; return null; }
    const lagMs = N.rtt + N.F.buffered * (1000 / 60) + 12;
    const L = Math.max(0, Math.min(18, Math.round(lagMs / (1000 / 60))));
    const now = performance.now(), list = [];
    for (let j = L; j >= 1; j--) { const at = now - j * (1000 / 60); let p = SIM0.IDLE_INPUT; for (const h of hist) { if (h.t <= at) p = h.p; else break; } list.push(p); }
    const b = R.predict(GAME.me, list); if (!b) return null;
    if (!GAME.shown || Math.hypot(GAME.shown.x - b.x, GAME.shown.z - b.z) > 4) GAME.shown = { x: b.x, y: b.y, z: b.z };
    else { GAME.shown.x += (b.x - GAME.shown.x) * 0.5; GAME.shown.y += (b.y - GAME.shown.y) * 0.6; GAME.shown.z += (b.z - GAME.shown.z) * 0.5; }
    N.pred = b;
    return b;
  }
  // ── every animation frame while online
  let pingT = 0;
  function frame(dt, inp) {
    if ((pingT += dt) > 1.5) { pingT = 0; send({ t: 'ping', c: performance.now() }); }
    const R = N.F && N.F.R;
    if (!R) return;
    const live = GAME.phase === 'intro' || GAME.phase === 'count' || GAME.phase === 'play';
    // aim from the predicted body so shots converge on the crosshair
    let p = SIM0.IDLE_INPUT;
    if (live && R.sk[GAME.me] && R.sk[GAME.me].alive) {
      const body = N.pred || R.sk[GAME.me], aim = aimFrom(R, body);
      const lag = Math.max(0, Math.min(15, Math.round(N.rtt / (1000 / 60) + N.F.buffered + 1)));
      const st = stickFor(inp, aim.yaw);
      p = SIM0.packInput({ mx: st.mx, my: st.my, yaw: aim.yaw, pitch: aim.pitch, btn: inp.btn | heldMask(), lag });
    }
    // send on change (presses go out immediately), at most once per tick otherwise
    const now = performance.now(), btnNew = inp.btn & ~(heldMask());
    if (p !== N.lastP && N.ws && N.ws.readyState === 1 && (btnNew || now - N.sentAt > 15)) { N.lastP = p; N.sentAt = now; send({ t: 'in', p }); }
    hist.push({ t: now, p }); while (hist.length > 2 && hist[1].t < now - 600) hist.shift();
    if (GAME.phase === 'intro' || GAME.phase === 'count') {
      const before = Math.ceil(GAME.countT); GAME.countT -= dt; const n = Math.ceil(GAME.countT);
      if (GAME.phase === 'count' && n !== before && n > 0 && n <= 3) playSfx('tick');
      const el = $('#cdn'); if (el) el.textContent = GAME.phase === 'count' && GAME.countT > 0 && n <= 3 ? String(n) : '';
    }
    if (GAME.phase !== 'done' && (N.F.next > 0 || N.F.buffered > 0)) {
      const n = N.F.pace(dt * 1000);
      for (let k = 0; k < n; k++) {
        if (GAME.phase !== 'play') { GAME.phase = 'play'; hudExtra(lockHint()); banner('GO'); }
        snapPrev(); GAME.acc = 0;
        N.F.step(1);
        if (R.winner) { finish(); break; }
      }
      GAME.acc = Math.min(DT, N.F.acc * DT);
    } else if (GAME.phase === 'done') { GAME.acc += dt * 0.35; while (GAME.acc >= DT) { GAME.acc -= DT; snapPrev(); R.coast(); } doneFrame(dt); }
    const ns = $('#netstat'); if (ns) ns.textContent = N.ws && N.ws.readyState === 1 ? `${Math.round(N.rtt)} ms · buffer ${N.F.buffered}` : 'reconnecting…';
  }
  function finish() {
    roundOver();
    // the server's word is final (it ran the same simulation)
    if (N.end && N.end.standings) GAME.results.standings = N.end.standings;
    if (N.end && N.end.w != null) GAME.results.w = N.end.w;
  }
  // ── screens
  function setupCard() {
    return `<div class="card">
      <div class="row" style="justify-content:space-between"><h2>Free online</h2><span class="label">no stakes · one round · last skater standing</span></div>
      <div class="cols">
        <div style="display:grid;gap:12px;align-content:start">
          <label style="display:grid;gap:6px"><span class="label">Your name</span><input id="netName" class="field" maxlength="14" autocomplete="nickname" placeholder="Skater" value="${esc(GAME.myName)}"></label>
          <div style="display:grid;gap:6px"><span class="label">Lobby size</span><div class="seg">${[2, 4, 6, 8].map((s) => `<button class="${s === N.queueSize ? 'sel' : ''}" data-netsize="${s}">${s}<small>seats</small></button>`).join('')}</div></div>
          ${N.err ? `<p style="color:var(--coral)">${esc(N.err)}</p>` : ''}
        </div>
        <div style="display:grid;gap:12px;align-content:start">
          <div class="receipt"><div class="r"><span>Entry</span><b>Free</b></div><div class="r"><span>Matchmaking</span><b>Real players first</b></div><div class="r"><span>Empty seats</span><b>Bots after 15 s</b></div></div>
          <button class="btn primary big" id="netFind">Find a match</button>
          <button class="btn ghost small" id="back" style="justify-self:start">Back</button>
        </div>
      </div>
      ${skaterPicker()}
    </div>`;
  }
  function lobbyCard() {
    const L = N.lobby; if (!L) return '';
    const left = L.fillInMs == null ? null : Math.max(0, Math.ceil((L.fillInMs - (performance.now() - N.lobbyAt)) / 1000));
    const seats = Array.from({ length: L.size }, (_, i) => {
      const s = L.seats[i];
      return s ? `<div class="seat on${s.i === L.you ? ' you' : ''}"><img src="${portrait(s.look ?? s.i)}" alt=""><span class="nm">${esc(s.i === L.you ? (GAME.myName || 'You') : s.name)}</span><span class="label" style="color:var(--lime)">Ready</span></div>`
        : `<div class="seat"><div class="ghost">?</div><span class="nm" style="color:var(--dim)">Open seat</span></div>`;
    }).join('');
    return `<div class="card"><div class="row" style="justify-content:space-between"><h2>Finding skaters…</h2><span class="label">${L.size} seats · free</span></div>
      <div class="seats">${seats}</div>
      <div class="row"><button class="btn ghost" id="netLeave">Leave</button><span class="label" id="netFill">${L.seats.length} / ${L.size} joined${left != null ? ` · bots fill empty seats in ${left}s` : ''}</span></div></div>`;
  }
  setInterval(() => { if (GAME.screen === 'onlineLobby' && N.lobby) { const el = document.getElementById('netFill'); if (el) { const L = N.lobby, left = L.fillInMs == null ? null : Math.max(0, Math.ceil((L.fillInMs - (performance.now() - N.lobbyAt)) / 1000)); el.textContent = `${L.seats.length} / ${L.size} joined${left != null ? ` · bots fill empty seats in ${left}s` : ''}`; } } }, 250);
  $('#ov').addEventListener('click', (e) => {
    const t = e.target.closest('button'); if (!t) return;
    if (t.id === 'goOnline') { N.err = ''; GAME.screen = 'onlineSetup'; showOverlay(setupCard()); setTimeout(() => $('#netName')?.focus(), 50); }
    else if (t.dataset.netsize) { N.queueSize = +t.dataset.netsize; showOverlay(setupCard()); }
    else if (t.dataset.look && GAME.screen === 'onlineSetup') showOverlay(setupCard());
    else if (t.id === 'netFind') {
      GAME.myName = ($('#netName')?.value || '').trim().slice(0, 14) || 'Skater'; store.set('gh_name', GAME.myName);
      N.wanted = true; N.err = '';
      if (N.ws && N.ws.readyState === 1) { hello(); send({ t: 'queue', mode: 'free', size: N.queueSize }); }
      else { N.queueing = true; connect(); }
      t.disabled = true; t.textContent = 'Connecting…';
    }
    else if (t.id === 'netLeave' || (t.id === 'home' && GAME.mode === 'online')) { send({ t: 'leave' }); N.wanted = false; N.F = null; goHome(); }
    else if (t.id === 'again' && GAME.mode === 'online') {
      send({ t: 'leave' }); N.F = null;
      if (CASH.isCashMatch()) { goHome(); CASH.openSetup(); }
      else { GAME.screen = 'onlineSetup'; showOverlay(setupCard()); }
    }
  });
  // reload mid-match? pick the seat back up
  if (enabled() && N.token) { N.wanted = true; connect(); }
  function connectAsync() {
    return new Promise((res, rej) => {
      if (N.ws && N.ws.readyState === 1 && N.status === 'online') return res();
      N.wanted = true; connect();
      const t0 = Date.now(), iv = setInterval(() => {
        if (N.status === 'online' && N.ws && N.ws.readyState === 1) { clearInterval(iv); res(); }
        else if (Date.now() - t0 > 15000) { clearInterval(iv); rej(new Error('Could not reach the game server.')); }
      }, 100);
    });
  }
  function request(msg, types) {
    return new Promise((res, rej) => { const w = { types, res }; waiters.push(w); send(msg); setTimeout(() => { const i = waiters.indexOf(w); if (i >= 0) { waiters.splice(i, 1); rej(new Error('The server did not answer.')); } }, 20000); });
  }
  function leaveIfAny() { if (GAME.mode === 'online' && N.F) { send({ t: 'leave' }); N.F = null; } }
  return { enabled, frame, predicted, send, connectAsync, request, leaveIfAny, hello, get state() { return N; } };
})();
