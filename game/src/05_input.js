// ───────────────────────── INPUT: keyboard + mouse (pointer lock) and controllers (bible §6) ─────────────────────────
// Produces { mx, my, yaw, pitch, btn } every frame. The camera's yaw/pitch live here (instant, local); the stick is
// relative to that yaw. Everything is remappable; settings persist per browser.
// Five things to remember: steer (WASD, S brakes), ollie, attack, trick / slam, throw. Everything is remappable.
const ACTIONS = [
  ['fwd', 'Push', 'KeyW'], ['brake', 'Brake', 'KeyS'], ['left', 'Steer left', 'KeyA'], ['right', 'Steer right', 'KeyD'],
  ['jump', 'Ollie (hold to pop higher)', 'Space'], ['attack', 'Attack (auto-targets)', 'Mouse0'],
  ['trick', 'Trick in the air · Slam at full Adrenaline', 'Mouse2'], ['throw', 'Throw / shove', 'KeyE'],
  ['boost', 'Boost push (optional)', 'ShiftLeft'],
];
const SETTINGS = Object.assign({ sens: 1, invertY: false, deadzone: 0.18, vibrate: true, altToggle: false, fov: 1, quality: 'auto', vol: 0.8 }, store.json('gh_settings', {}));
const KEYMAP = Object.assign(Object.fromEntries(ACTIONS.map(([a, , k]) => [a, k])), store.json('gh_keys2', {}));
const ALT_KEYS = { brake: 'KeyC' };
function saveSettings() { store.set('gh_settings', JSON.stringify(SETTINGS)); store.set('gh_keys2', JSON.stringify(KEYMAP)); }
const INPUT = {
  down: new Set(), yaw: 0, pitch: -0.12, locked: false, wheel: 0, altLatched: false, lastPad: null, usingPad: false,
  rebinding: null, enabled: false, pressQueue: 0,
};
const keyDown = (code) => INPUT.down.has(code);
const act = (a) => keyDown(KEYMAP[a]);
addEventListener('keydown', (e) => {
  if (INPUT.rebinding) { e.preventDefault(); finishRebind(e.code); return; }
  if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
  if (INPUT.enabled && /^(Space|Tab|ArrowUp|ArrowDown|ControlLeft|ControlRight|AltLeft|KeyQ|KeyF|KeyE|KeyR|KeyW|KeyS|KeyA|KeyD)$/.test(e.code)) e.preventDefault();
  if (!INPUT.down.has(e.code)) { INPUT.down.add(e.code); markPress(e.code); }
  INPUT.usingPad = false;
});
addEventListener('keyup', (e) => INPUT.down.delete(e.code));
addEventListener('blur', () => INPUT.down.clear());
addEventListener('mousedown', (e) => {
  const code = 'Mouse' + e.button;
  if (INPUT.rebinding) { e.preventDefault(); finishRebind(code); return; }
  if (!INPUT.enabled || !INPUT.locked) return;
  INPUT.down.add(code); markPress(code); INPUT.usingPad = false;
});
addEventListener('mouseup', (e) => INPUT.down.delete('Mouse' + e.button));
addEventListener('contextmenu', (e) => { if (INPUT.enabled) e.preventDefault(); });
addEventListener('mousemove', (e) => {
  if (!INPUT.locked || !INPUT.enabled) return;
  const k = 0.0022 * SETTINGS.sens;
  INPUT.yaw -= e.movementX * k;
  INPUT.pitch = clampPitch(INPUT.pitch - e.movementY * k * (SETTINGS.invertY ? -1 : 1));
});
document.addEventListener('pointerlockchange', () => { INPUT.locked = document.pointerLockElement === $('#stage canvas'); onLockChange(); });
function clampPitch(p) { return Math.max(-1.0, Math.min(0.85, p)); }
// presses that start and end within one frame still count once
function markPress(code) {
  for (const [a, k] of Object.entries(KEYMAP)) if (k === code && BTN[a]) INPUT.pressQueue |= BTN[a];
  if (code === ALT_KEYS.brake) INPUT.pressQueue |= BTN.brake;
}
function requestLock() { const c = $('#stage canvas'); if (c && c.requestPointerLock && !INPUT.locked) { try { const p = c.requestPointerLock({ unadjustedMovement: true }); if (p && p.catch) p.catch(() => c.requestPointerLock()); } catch { c.requestPointerLock(); } } }
function releaseLock() { if (document.pointerLockElement) document.exitPointerLock(); }
function onLockChange() { const h = document.getElementById('lockHint'); if (h) h.hidden = INPUT.locked || INPUT.usingPad; }

// ── controllers (standard mapping)
function readPad() {
  const pads = navigator.getGamepads ? navigator.getGamepads() : [];
  for (const p of pads) if (p && p.connected && p.mapping === 'standard') return p;
  for (const p of pads) if (p && p.connected) return p;
  return null;
}
function dz(v) { const d = SETTINGS.deadzone; return Math.abs(v) < d ? 0 : (v - Math.sign(v) * d) / (1 - d); }
let padPrev = 0;
function rumble(strength = 0.5, ms = 120) {
  if (!SETTINGS.vibrate || !INPUT.usingPad) return;
  const p = readPad(); const a = p && p.vibrationActuator;
  try { if (a && a.playEffect) a.playEffect('dual-rumble', { duration: ms, strongMagnitude: strength, weakMagnitude: strength * 0.6 }); } catch {}
}

/** Sample this frame's input. dt: seconds since the last frame. */
function sampleInput(dt) {
  let mx = 0, my = 0, btn = 0;
  if (act('fwd')) my += 1; if (act('left')) mx -= 1; if (act('right')) mx += 1;
  const has = (a) => act(a) || (a === 'brake' && keyDown(ALT_KEYS.brake));
  for (const a of ['boost', 'brake', 'jump', 'trick', 'attack', 'throw']) if (has(a)) btn |= BTN[a];
  if (btn & BTN.brake && !my && !mx) { /* brake in place */ }
  const pad = readPad(); INPUT.padHeld = 0;
  if (pad) {
    const ax = pad.axes, b = (i) => pad.buttons[i] && (pad.buttons[i].pressed || pad.buttons[i].value > 0.4);
    const lx = dz(ax[0] || 0), ly = dz(ax[1] || 0), rx = dz(ax[2] || 0), ry = dz(ax[3] || 0);
    let pb = 0;
    // A ollie · X trick/slam · RT or RB attack · B throw · LT brake (or pull the stick back)
    if (b(0)) pb |= BTN.jump; if (b(2) || b(3)) pb |= BTN.trick; if (b(5) || b(7)) pb |= BTN.attack; if (b(1)) pb |= BTN.throw;
    if (b(6) || ly > 0.6) pb |= BTN.brake; if (b(4)) pb |= BTN.boost;
    const any = Math.abs(lx) + Math.abs(ly) + Math.abs(rx) + Math.abs(ry) > 0 || pb;
    if (any) {
      INPUT.usingPad = true;
      mx += lx; my += Math.max(0, -ly);
      const s = 2.6 * SETTINGS.sens * dt;
      INPUT.yaw -= rx * s * 1.25; INPUT.pitch = clampPitch(INPUT.pitch - ry * s * 0.8 * (SETTINGS.invertY ? -1 : 1));
      const newly = pb & ~padPrev; INPUT.pressQueue |= newly; btn |= pb;
    }
    padPrev = pb; INPUT.padHeld = pb;
  }
  const m = Math.hypot(mx, my); if (m > 1) { mx /= m; my /= m; }
  btn |= INPUT.pressQueue; INPUT.pressQueue = 0;
  return { mx, my, yaw: INPUT.yaw, pitch: INPUT.pitch, btn };
}

// ── remapping UI helpers (settings card)
function startRebind(action) { INPUT.rebinding = action; }
function finishRebind(code) {
  const a = INPUT.rebinding; INPUT.rebinding = null;
  if (code !== 'Escape') { for (const [k, v] of Object.entries(KEYMAP)) if (v === code && k !== a) KEYMAP[k] = KEYMAP[a]; KEYMAP[a] = code; saveSettings(); }
  if (typeof openSettings === 'function') openSettings(true);
}
function keyLabel(code) {
  if (!code) return '—';
  if (code.startsWith('Mouse')) return ['LMB', 'MMB', 'RMB', 'Mouse 4', 'Mouse 5'][+code.slice(5)] || code;
  return code.replace(/^Key/, '').replace(/^Digit/, '').replace('Left', ' L').replace('Right', ' R').replace('Control', 'Ctrl').replace('Space', 'Space');
}
