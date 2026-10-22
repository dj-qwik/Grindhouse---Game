// ───────────────────────── HUD (bible §14): clock, health, weapon/ammo, Adrenaline ring, minimap, kill feed ─────────────────────────
const HUD = { cache: {}, lastBank: null, heartT: 0, mm: null };
const setText = (id, v) => { if (HUD.cache[id] === v) return; HUD.cache[id] = v; const el = document.getElementById(id); if (el) el.textContent = v; };
const setHtml = (id, v) => { if (HUD.cache[id] === v) return; HUD.cache[id] = v; const el = document.getElementById(id); if (el) el.innerHTML = v; };
function hudShow(on) { $('#hud').hidden = !on; document.body.classList.toggle('playing', on); }
function phaseLabel(t) { return t < WARMUP ? 'WARM-UP' : t < 12 ? 'SCRAMBLE' : t < 28 ? 'SQUEEZE' : t < 40 ? 'CONVERGE' : t < 50 ? 'SUDDEN DEATH' : 'FINAL CORE'; }
function updateHud(R, dt) {
  const me = R.sk[viewSeat()], mine = R.sk[GAME.me], t = R.t;
  const left = Math.max(0, Math.ceil(60 - t - 1e-9));
  setText('hTime', GAME.phase === 'count' ? '60' : String(left));
  const tc = $('#hTime'); if (tc) tc.classList.toggle('hot', left <= 10 && GAME.phase === 'play');
  setText('hPhase', GAME.phase === 'count' ? 'GET READY' : R.winner ? 'FINISHED' : phaseLabel(t));
  setText('hAlive', String(R.alive));
  if (!me) return;
  setText('hName', me.i === GAME.me ? (GAME.myName || 'You') : 'Watching · ' + nameOf(me.i));
  const hp = Math.max(0, me.hp), hpT = Math.ceil(hp);
  const bar = $('#hHp'); if (bar && HUD.cache.hp !== hpT) { HUD.cache.hp = hpT; bar.style.transform = `scaleX(${hp / 100})`; $('#hLag').style.transform = `scaleX(${hp / 100})`; $('#hBar').classList.toggle('low', hp < 30); setText('hHpT', String(hpT)); }
  // Adrenaline ring around the crosshair: 50 = boosted melee hit, 100 = signature ready
  const a = Math.max(0, Math.min(100, me.adren)), ring = $('#adrRing');
  if (ring && HUD.cache.ad !== a) { HUD.cache.ad = a; ring.setAttribute('stroke-dasharray', `${(a / 100) * 169.6} 170`); ring.setAttribute('stroke', a >= 100 ? '#FF9B36' : a >= 50 ? '#B4E64A' : '#E8DDBD'); }
  // weapon slots
  const sl = [
    ['melee', me.melee ? WEAPONS[me.melee].name : '—', me.slot === 0, ''],
    ['ranged', me.ranged ? WEAPONS[me.ranged].name : 'empty', me.slot === 1, me.ranged ? String(me.ammo) : ''],
    ['throw', me.thr ? WEAPONS[me.thr].name : 'empty', false, me.thr ? 'F' : ''],
  ];
  setHtml('hSlots', sl.map(([k, n, on, extra]) => `<div class="slot${on ? ' on' : ''}"><small>${k}</small><b>${esc(n)}</b>${extra ? `<span class="ammo">${esc(extra)}</span>` : ''}</div>`).join(''));
  // contextual hint: nearest pickup, signature ready, controls
  let hint = '';
  if (me.alive) {
    let best = null, bd = 2.2; for (const p of R.picks) { if (t < p.t0) continue; const d = Math.hypot(p.x - me.x, p.z - me.z); if (d < bd && Math.abs(p.y - me.y) < 2.2) { bd = d; best = p; } }
    if (best) hint = `${keyLabel(KEYMAP.use)} · pick up ${WEAPONS[best.w].name}`;
    else if (me.adren >= 100) hint = `${keyLabel(KEYMAP.alt)} + ${keyLabel(KEYMAP.attack)} · SIGNATURE SLAM ready`;
    else if (t < 6) hint = `${keyLabel(KEYMAP.jump)} ollie · ${keyLabel(KEYMAP.trick)}+dir trick · ${keyLabel(KEYMAP.attack)} attack · ${keyLabel(KEYMAP.use)} pick up · ${keyLabel(KEYMAP.throw)} shove/throw`;
    else if (me.adren >= 50) hint = 'Adrenaline 50+: your next melee hit lands harder';
  }
  setText('hHint', hint || ' ');
  $('#hHint').style.visibility = hint ? 'visible' : 'hidden';
  // trick banking popups
  if (mine && mine.lastBank && mine.lastBank !== HUD.lastBank) {
    HUD.lastBank = mine.lastBank;
    if (mine.i === viewSeat() && mine.lastBank.pts > 0) trickPop(`+${mine.lastBank.pts} ADRENALINE`, mine.lastBank.tricks.map((k) => (TRICKS[k] ? TRICKS[k].name : k)).join(' · '));
  }
  // low health heartbeat + vignette; zone warning
  $('#vig').style.opacity = me.alive && hp < 35 ? String(0.35 + (35 - hp) / 60 + Math.sin(performance.now() / 160) * 0.1) : '0';
  if (me.alive && hp < 30 && me.i === GAME.me) { HUD.heartT -= dt; if (HUD.heartT <= 0) { HUD.heartT = 0.75; playSfx('heartbeat', null, null, null, 0.8); } }
  const Z = R.zoneNow || SIM0.zoneAt(R.W, t), out = me.alive && Math.hypot(me.x - Z.x, me.z - Z.z) > Z.r && t > 12;
  $('#zw').style.opacity = out ? '1' : '0'; $('#zt').style.opacity = out ? '1' : '0';
  drawMinimap(R, me);
}
function drawMinimap(R, me) {
  const cv = $('#minimap'); if (!cv) return;
  const g = cv.getContext('2d'), S = cv.width, half = R.W.half + 4, k = S / 2 / half * 0.92;
  const yaw = CAMR.yaw;
  g.clearRect(0, 0, S, S);
  g.save(); g.translate(S / 2, S / 2);
  g.beginPath(); g.arc(0, 0, S / 2 - 2, 0, 7); g.clip();
  // rotate so the camera's forward points up
  g.rotate(yaw + Math.PI);
  const X = (x) => -(x - me.x) * k, Y = (z) => (z - me.z) * k;
  // map: prims as flat shapes, brighter when higher
  for (const p of R.W.prims) {
    if (p.gone) continue;
    const top = SIM0.primTop(p); if (top < 0.3 && p.type === 'box') continue;
    g.save(); g.translate(X(p.cx), Y(p.cz)); g.rotate(p.yaw);
    g.fillStyle = p.warn ? '#FF5C69' : `rgba(232,221,189,${Math.min(0.85, 0.18 + top * 0.08)})`;
    g.fillRect(p.w / 2 * k, -p.d / 2 * k, -p.w * k, p.d * k); g.restore();
  }
  // zone
  const Z = R.zoneNow || SIM0.zoneAt(R.W, R.t);
  g.strokeStyle = '#FF5C69'; g.lineWidth = 4; g.beginPath(); g.arc(X(Z.x), Y(Z.z), Z.r * k, 0, 7); g.stroke();
  const Zn = SIM0.zoneAt(R.W, R.t + 8); g.setLineDash([6, 6]); g.lineWidth = 2; g.strokeStyle = '#FFFFFF88'; g.beginPath(); g.arc(X(Zn.x), Y(Zn.z), Zn.r * k, 0, 7); g.stroke(); g.setLineDash([]);
  // pickups (ready ones)
  for (const p of R.picks) { if (R.t < p.t0) continue; g.fillStyle = RARITY_COL[p.rarity] || '#fff'; g.beginPath(); g.arc(X(p.x), Y(p.z), 3, 0, 7); g.fill(); }
  // threat pings: enemies close by, attacking, or recently shooting
  for (const s of R.sk) {
    if (!s.alive || s.i === me.i) continue;
    const d = Math.hypot(s.x - me.x, s.z - me.z);
    const loud = s.atk || s.fireCd > (s.ranged ? WEAPONS[s.ranged].rate - 0.4 : 9);
    if (d > 26 && !loud && GAME.mode !== 'spectate') continue;
    g.fillStyle = loud ? '#FF5C69' : '#FF9B36'; g.beginPath(); g.arc(X(s.x), Y(s.z), loud ? 6 : 4.5, 0, 7); g.fill();
  }
  g.restore();
  // you: arrow pointing up (camera forward)
  g.save(); g.translate(S / 2, S / 2); g.fillStyle = '#B4E64A'; g.strokeStyle = '#22292B'; g.lineWidth = 3;
  g.beginPath(); g.moveTo(0, -11); g.lineTo(8, 9); g.lineTo(0, 4); g.lineTo(-8, 9); g.closePath(); g.stroke(); g.fill(); g.restore();
}
// death / spectate overlay
function hudExtra(html) { setHtml('hudExtra', html); }
