// ───────────────────────── SKATERS: procedural cel-shaded characters, boards and weapons ─────────────────────────
// Eight looks (bible §11), one shared rig: capsule limbs placed by two-bone IK every frame from the simulation state,
// so pushes, crouches, flips, grinds, wallrides, swings, aims and wipeouts all read at a glance. Outlines carry the
// silhouette at gameplay distance; colour blocking and head shape tell skaters apart.
const RIG = { l1: 0.46, l2: 0.46, a1: 0.3, a2: 0.28 };
const V3 = () => new THREE.Vector3();
const _v = [V3(), V3(), V3(), V3(), V3(), V3()], _up = new THREE.Vector3(0, 1, 0), _q = new THREE.Quaternion();
function limbBetween(mesh, a, b) {
  const d = _v[5].subVectors(b, a), L = d.length();
  mesh.position.copy(a).addScaledVector(d, 0.5);
  mesh.scale.set(1, Math.max(0.01, L), 1);
  if (L > 1e-5) mesh.quaternion.setFromUnitVectors(_up, d.multiplyScalar(1 / L));
}
// two-bone IK: knee/elbow K from root A to end E, bending toward `bend`
function ik(A, E, l1, l2, bend, K) {
  const d = _v[4].subVectors(E, A); let L = d.length();
  if (L > l1 + l2 - 1e-3) { d.multiplyScalar((l1 + l2 - 1e-3) / L); E.copy(A).add(d); L = l1 + l2 - 1e-3; }
  const dir = d.clone().normalize();
  const ca = Math.max(-1, Math.min(1, (l1 * l1 + L * L - l2 * l2) / (2 * l1 * L))), sa = Math.sqrt(1 - ca * ca);
  const perp = bend.clone().addScaledVector(dir, -bend.dot(dir)); if (perp.lengthSq() < 1e-6) perp.set(1, 0, 0); perp.normalize();
  K.copy(A).addScaledVector(dir, l1 * ca).addScaledVector(perp, l1 * sa);
}
function capsuleUnit(r) { const g = new THREE.CylinderGeometry(r, r * 0.9, 1, 8, 1); return g; }

function makeSkaterRig(look) {
  const T = THREE, L = SKATERS[look % SKATERS.length], root = new T.Group();
  const body = toon('#ffffff', { map: clothTex(look, 'top') }), trim = toon('#ffffff', { map: clothTex(look, 'legs') }), skin = toon(L.skin), shoe = toon('#ffffff', { map: clothTex(look, 'shoe') }), dark = toon('#22292B');
  const ol = (m, w = 0.028) => { withOutline(m, w); m.castShadow = true; return m; };
  // board
  const board = new T.Group(); root.add(board);
  const deck = ol(new T.Mesh(new T.BoxGeometry(0.25, 0.04, 0.82), [dark, dark, toon('#22292B'), toon(L.deck, { map: GFX.tex['deck' + (look % 3)] }), dark, dark]), 0.02);
  deck.position.y = 0.11; board.add(deck);
  for (const z of [-0.43, 0.43]) { const tail = ol(new T.Mesh(new T.BoxGeometry(0.25, 0.04, 0.14), dark), 0.02); tail.position.set(0, 0.135, z); tail.rotation.x = z > 0 ? -0.35 : 0.35; board.add(tail); }
  const wheelM = toon('#F4EEDC'), truckM = toon('#9AA4A8');
  for (const z of [-0.28, 0.28]) {
    const tr = new T.Mesh(new T.BoxGeometry(0.2, 0.035, 0.05), truckM); tr.position.set(0, 0.07, z); board.add(tr);
    for (const x of [-0.11, 0.11]) { const w = ol(new T.Mesh(new T.CylinderGeometry(0.045, 0.045, 0.04, 10), wheelM), 0.015); w.rotation.z = Math.PI / 2; w.position.set(x, 0.045, z); board.add(w); }
  }
  // body parts (unit-length limbs scaled each frame)
  const mk = (geo, mat, w) => { const m = ol(new T.Mesh(geo, mat), w); root.add(m); return m; };
  const thighL = mk(capsuleUnit(0.085), L.style.includes('overalls') ? body : trim), thighR = mk(capsuleUnit(0.085), L.style.includes('overalls') ? body : trim);
  const shinL = mk(capsuleUnit(0.07), trim), shinR = mk(capsuleUnit(0.07), trim);
  const footL = mk(new T.BoxGeometry(0.12, 0.08, 0.27), shoe, 0.02), footR = mk(new T.BoxGeometry(0.12, 0.08, 0.27), shoe, 0.02);
  const torso = mk(new T.CapsuleGeometry(0.19, 0.36, 4, 10), body, 0.03);
  const pads = L.style.includes('stunt') || L.style.includes('leathers');
  const uaL = mk(capsuleUnit(0.06), body), uaR = mk(capsuleUnit(0.06), body), faL = mk(capsuleUnit(0.05), pads ? trim : skin), faR = mk(capsuleUnit(0.05), pads ? trim : skin);
  const handL = mk(new T.SphereGeometry(0.06, 8, 6), L.style.includes('courier') ? dark : skin, 0.015), handR = mk(new T.SphereGeometry(0.06, 8, 6), L.style.includes('courier') ? dark : skin, 0.015);
  const head = new T.Group(); root.add(head);
  const skull = ol(new T.Mesh(L.hair === 'helmet' ? new T.SphereGeometry(0.16, 14, 10) : new T.BoxGeometry(0.26, 0.28, 0.25), skin), 0.025); head.add(skull);
  // face: two eyes + a mouth line (expressions read in close-ups)
  const eyeM = toon('#22292B');
  const eyes = [-0.06, 0.06].map((z) => { const e = new T.Mesh(new T.BoxGeometry(0.02, 0.05, 0.035), eyeM); e.position.set(0.13, 0.02, z); head.add(e); return e; });
  const mouth = new T.Mesh(new T.BoxGeometry(0.02, 0.02, 0.09), eyeM); mouth.position.set(0.13, -0.07, 0); head.add(mouth);
  addHair(head, L, ol);
  // brows + nose: expressions read in close-ups
  const brows = [-0.065, 0.065].map((z) => { const b = new T.Mesh(new T.BoxGeometry(0.02, 0.018, 0.06), eyeM); b.position.set(0.135, 0.065, z); head.add(b); return b; });
  const nose = new T.Mesh(new T.BoxGeometry(0.05, 0.05, 0.04), skin); nose.position.set(0.145, -0.02, 0); head.add(nose);
  // knee pads for the stunt rider / racer / courier, a backpack for the courier
  const kneePads = [];
  if (/stunt|leathers|courier/.test(L.style)) for (let k = 0; k < 2; k++) { const pd = ol(new T.Mesh(new T.SphereGeometry(0.085, 8, 6), toon('#22292B')), 0.015); pd.scale.set(1, 1.2, 1); root.add(pd); kneePads.push(pd); }
  let pack = null;
  if (/courier/.test(L.style)) { pack = ol(new T.Mesh(new T.BoxGeometry(0.2, 0.34, 0.3), toon('#FF9B36')), 0.02); root.add(pack); }
  // the hidden deuce: bare cheeks + trousers bunched at the knees (shown only mid-squat)
  const butt = new T.Group(); root.add(butt); butt.visible = false;
  for (const z of [-0.075, 0.075]) { const ch = ol(new T.Mesh(new T.SphereGeometry(0.105, 10, 8), skin), 0.02); ch.position.z = z; butt.add(ch); }
  const bunch = [0, 1].map(() => { const b = ol(new T.Mesh(new T.TorusGeometry(0.085, 0.045, 6, 12), trim), 0.015); b.visible = false; root.add(b); return b; });
  // weapon slot in the right hand
  const hold = new T.Group(); root.add(hold);
  const r = { root, board, deck, parts: { thighL, thighR, shinL, shinR, footL, footR, torso, uaL, uaR, faL, faR, handL, handR }, head, hold, eyes, mouth, look, brows, pads: kneePads, pack, butt, bunch, skinM: skin, legM: L.style.includes('overalls') ? body : trim,
    weapon: null, weaponId: null, phase: Math.random() * 6, crouch: 0, land: 0, lean: 0, lastYaw: 0, flip: 0, recoil: 0, swing: 0, throwT: 0, hitT: 0, lastHp: 100, lastAmmo: 0, tumble: 0, boardOff: null, alive: true, shade: 1 };
  return r;
}
function addHair(head, L, ol) {
  const T = THREE, hair = toon(L.trim), dark = toon('#22292B');
  const add = (g, m, x, y, z, rx = 0, rz = 0) => { const o = ol(new T.Mesh(g, m), 0.02); o.position.set(x, y, z); o.rotation.x = rx; o.rotation.z = rz; head.add(o); return o; };
  switch (L.hair) {
    case 'cap': add(new T.CylinderGeometry(0.15, 0.15, 0.08, 14), toon(L.body), 0, 0.15, 0); add(new T.BoxGeometry(0.16, 0.02, 0.2), toon(L.body), 0.14, 0.12, 0); break;
    case 'mohawk': for (let k = 0; k < 5; k++) add(new T.ConeGeometry(0.035, 0.18, 4), toon(L.deck), -0.05 + k * 0.035, 0.2, 0, 0, -0.2); break;
    case 'spikes': for (let k = 0; k < 7; k++) { const a = k / 7 * Math.PI * 2; add(new T.ConeGeometry(0.03, 0.16, 4), toon(L.trim), Math.cos(a) * 0.08, 0.18, Math.sin(a) * 0.08, Math.sin(a) * 0.5, -Math.cos(a) * 0.5); } break;
    case 'beanie': add(new T.SphereGeometry(0.15, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), toon(L.body), 0, 0.08, 0); add(new T.SphereGeometry(0.04, 6, 6), toon(L.trim), 0, 0.24, 0); break;
    case 'flat': add(new T.BoxGeometry(0.27, 0.06, 0.26), dark, 0, 0.16, 0); break;
    case 'bandana': add(new T.BoxGeometry(0.27, 0.08, 0.26), toon(L.trim), 0, 0.13, 0); add(new T.BoxGeometry(0.06, 0.04, 0.12), toon(L.trim), -0.16, 0.08, 0, 0, 0.6); break;
    case 'helmet': add(new T.SphereGeometry(0.19, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.55), toon(L.body), 0, 0.02, 0); add(new T.BoxGeometry(0.04, 0.09, 0.3), toon('#36DCE8', { transparent: true, opacity: 0.7 }), 0.16, 0.02, 0); add(new T.BoxGeometry(0.3, 0.03, 0.04), toon(L.trim), 0, 0.18, 0); break;
    case 'hood': add(new T.SphereGeometry(0.18, 14, 10, Math.PI * 0.6, Math.PI * 1.8), toon(L.body), -0.02, 0.03, 0); break;
  }
}

// ── weapons (one builder for hand, pickup pedestal and HUD previews)
const WEAPON_COLOR = { bat: '#C9965A', pipe: '#9AA4A8', katana: '#E8EEF0', cleaver: '#D5DDE0', whip: '#8E9AA0', baton: '#22292B', hammer: '#B85435', nailgun: '#FF9B36', sawoff: '#6E4630', smg: '#B4E64A', revolver: '#7D8B91', pistol: '#5E6A70', rocket: '#FF5C69', buzzsaw: '#36DCE8', grenade: '#5E8F2E', pipebomb: '#9AA4A8', molotov: '#B4E64A' };
function weaponMesh(id, scale = 1) {
  const T = THREE, g = new T.Group(), c = toon(WEAPON_COLOR[id] || '#ccc'), dark = toon('#22292B'), ol = (m) => withOutline(m, 0.015);
  const box = (w, h, d, m, x = 0, y = 0, z = 0) => { const o = ol(new T.Mesh(new T.BoxGeometry(w, h, d), m)); o.position.set(x, y, z); g.add(o); return o; };
  const cyl = (r1, r2, l, m, x = 0, y = 0, z = 0, ax = 'z') => { const o = ol(new T.Mesh(new T.CylinderGeometry(r1, r2, l, 10), m)); o.position.set(x, y, z); if (ax === 'z') o.rotation.x = Math.PI / 2; g.add(o); return o; };
  // hand holds the origin; "forward" (blade / barrel) is +z
  switch (id) {
    case 'bat': cyl(0.025, 0.05, 0.85, c, 0, 0, 0.35); for (let k = 0; k < 4; k++) { const n = cyl(0.008, 0.008, 0.12, toon('#C9D3D6'), Math.cos(k) * 0.05, Math.sin(k) * 0.05, 0.55 + k * 0.05, 'y'); n.rotation.z = k; } break;
    case 'pipe': cyl(0.03, 0.03, 0.9, c, 0, 0, 0.35); cyl(0.045, 0.045, 0.08, toon('#7D8B91'), 0, 0, 0.78); break;
    case 'katana': box(0.012, 0.05, 0.85, c, 0, 0, 0.5); box(0.12, 0.02, 0.03, toon('#FF9B36'), 0, 0, 0.06); box(0.03, 0.03, 0.2, dark, 0, 0, -0.05); break;
    case 'cleaver': box(0.015, 0.16, 0.3, c, 0, 0.05, 0.3); box(0.035, 0.035, 0.18, dark, 0, 0, 0.05); break;
    case 'whip': for (let k = 0; k < 9; k++) { const t = ol(new T.Mesh(new T.TorusGeometry(0.03, 0.009, 4, 8), c)); t.position.set(0, -k * 0.02, 0.1 + k * 0.08); t.rotation.y = k % 2 ? Math.PI / 2 : 0; g.add(t); } box(0.03, 0.03, 0.12, dark, 0, 0, 0); break;
    case 'baton': cyl(0.025, 0.025, 0.6, dark, 0, 0, 0.25); { const tip = cyl(0.035, 0.035, 0.08, toon('#36DCE8', { emissive: new T.Color('#1b8fb0') }), 0, 0, 0.56); tip.userData.glow = true; } break;
    case 'hammer': cyl(0.025, 0.025, 1.0, toon('#8A5A33'), 0, 0, 0.4); box(0.16, 0.16, 0.34, c, 0, 0, 0.9).rotation.y = Math.PI / 2; break;
    case 'nailgun': box(0.08, 0.14, 0.28, c, 0, 0.05, 0.1); box(0.05, 0.05, 0.2, dark, 0, 0.08, 0.3); box(0.04, 0.12, 0.04, dark, 0, -0.05, 0.02); break;
    case 'sawoff': cyl(0.025, 0.025, 0.42, dark, -0.025, 0.04, 0.3); cyl(0.025, 0.025, 0.42, dark, 0.025, 0.04, 0.3); box(0.06, 0.1, 0.26, c, 0, 0, -0.02); break;
    case 'smg': box(0.07, 0.12, 0.34, c, 0, 0.04, 0.14); box(0.05, 0.2, 0.06, toon('#FF5C69'), 0, -0.08, 0.1); cyl(0.02, 0.02, 0.18, dark, 0, 0.06, 0.38); box(0.12, 0.05, 0.08, toon('#36DCE8'), 0, 0.12, 0.12); break;
    case 'pistol': cyl(0.02, 0.02, 0.2, c, 0, 0.05, 0.16); box(0.05, 0.07, 0.16, c, 0, 0.05, 0.06); box(0.04, 0.12, 0.05, dark, 0, -0.04, 0); break;
    case 'revolver': cyl(0.018, 0.018, 0.26, c, 0, 0.05, 0.22); cyl(0.045, 0.045, 0.07, c, 0, 0.04, 0.08); box(0.04, 0.12, 0.05, toon('#6E4630'), 0, -0.04, 0); break;
    case 'rocket': cyl(0.08, 0.08, 0.9, c, 0, 0.08, 0.15); box(0.24, 0.02, 0.36, toon('#22292B'), 0, 0.16, -0.1); cyl(0.09, 0.06, 0.12, dark, 0, 0.08, 0.62); break;
    case 'buzzsaw': box(0.12, 0.14, 0.4, c, 0, 0.05, 0.12); { const d = ol(new T.Mesh(new T.CylinderGeometry(0.16, 0.16, 0.02, 14), toon('#E8EEF0'))); d.position.set(0, 0.16, 0.18); g.add(d); g.userData.saw = d; } break;
    case 'grenade': { const s = ol(new T.Mesh(new T.SphereGeometry(0.07, 10, 8), c)); g.add(s); box(0.03, 0.04, 0.03, dark, 0, 0.08, 0); break; }
    case 'pipebomb': cyl(0.045, 0.045, 0.25, c, 0, 0, 0.05); cyl(0.055, 0.055, 0.04, dark, 0, 0, 0.18); cyl(0.055, 0.055, 0.04, dark, 0, 0, -0.08); break;
    case 'molotov': cyl(0.05, 0.05, 0.16, toon('#B4E64A', { transparent: true, opacity: 0.8 }), 0, 0, 0, 'y'); cyl(0.02, 0.02, 0.1, toon('#B4E64A'), 0, 0.12, 0, 'y'); box(0.04, 0.08, 0.04, toon('#E8DDBD'), 0, 0.2, 0); break;
    default: break;
  }
  g.scale.setScalar(scale);
  return g;
}

// ── pose a rig from a skater's simulation state (+ prediction) once per frame
const AIM_IDS = { pistol: 1, nailgun: 1, sawoff: 1, smg: 1, revolver: 1, rocket: 1, buzzsaw: 1 };
function poseRig(r, s, dt, view) {
  const T = THREE, P = r.parts, root = r.root;
  root.position.set(view.x, view.y, view.z);
  const yaw = view.yaw;
  const yawRate = angWrap(yaw - r.lastYaw) / Math.max(dt, 1e-3); r.lastYaw = yaw;
  // deuce choreography (sim phases): stop → step off and face away → pants down, squat → drop → stand, pants up → remount
  const DT0 = s.deuce ? s.deuce.t : -1, sm = (u) => { u = Math.max(0, Math.min(1, u)); return u * u * (3 - 2 * u); };
  const dw = DT0 < 0 ? 0 : DT0 < 2.5 ? sm((DT0 - 0.45) / 0.3) : 1 - sm((DT0 - 2.75) / 0.35);
  const sq = DT0 < 0 ? 0 : DT0 < 2.5 ? sm((DT0 - 0.8) / 0.35) : 1 - sm((DT0 - 2.5) / 0.3);
  const pantsDown = DT0 > 0.92 && DT0 < 2.62, pulling = (DT0 > 0.72 && DT0 < 1.05) || (DT0 > 2.42 && DT0 < 2.78);
  root.rotation.set(0, yaw - dw * Math.PI / 2, 0);
  const sp = Math.hypot(s.vx, s.vz), air = s.mode === MODE.AIR, down = s.mode === MODE.DOWN || !s.alive;
  // timers
  if (s.hp < r.lastHp - 0.5) r.hitT = 0.3; r.lastHp = s.hp;
  if (s.ranged && s.ammo < r.lastAmmo) r.recoil = 1; r.lastAmmo = s.ammo;
  r.hitT = Math.max(0, r.hitT - dt); r.recoil = Math.max(0, r.recoil - dt * 7);
  if (r.wasAir && !air && s.mode === MODE.GROUND) r.land = 1; r.wasAir = air;
  r.land = Math.max(0, r.land - dt * 4);
  const target = s.charge >= 0 ? 0.35 + Math.min(1, s.charge / 0.45) * 0.45 : air ? 0.45 : s.mode === MODE.GRIND ? 0.45 : r.land * 0.6 + Math.min(0.25, sp * 0.015);
  r.crouch += (target - r.crouch) * Math.min(1, dt * 14);
  r.lean += (Math.max(-0.35, Math.min(0.35, -yawRate * 0.06 * Math.min(1, sp / 6))) - r.lean) * Math.min(1, dt * 8);
  // board transform: tricks, manual, wallride, tumble
  const B = r.board; B.position.set(0, 0, 0); B.rotation.set(0, 0, 0);
  let feetLift = 0;
  if (s.trick && air) {
    const dur = TRICKS[s.trick].dur, u = Math.min(1, s.trickT / dur), e = u * u * (3 - 2 * u);
    B.position.y = 0.25 + Math.sin(u * Math.PI) * 0.25; feetLift = 0.25 + Math.sin(u * Math.PI) * 0.2;
    if (s.trick === 'kickflip') B.rotation.z = e * Math.PI * 2; else if (s.trick === 'heelflip') B.rotation.z = -e * Math.PI * 2;
    else if (s.trick === 'shuvit') B.rotation.y = e * Math.PI; else B.rotation.y = e * Math.PI * 2;
  } else if (air) { B.position.y = 0.2; feetLift = 0.2; B.rotation.x = Math.max(-0.4, Math.min(0.4, -s.vy * 0.03)); }
  if (s.manual > 0) { B.rotation.x = -0.32; B.position.y = 0.06; }
  if (s.mode === MODE.WALL) { const side = Math.sign(-Math.cos(yaw) * s.wallNx + Math.sin(yaw) * s.wallNz) || 1; root.rotateZ(side * 1.15); }
  if (s.mode === MODE.GROUND && s.onPrim && s.ny < 0.99) { // tilt with the ramp
    const nx = s.nx, nz = s.nz, f = Math.sin(yaw) * nx + Math.cos(yaw) * nz, sd = Math.cos(yaw) * nx - Math.sin(yaw) * nz;
    root.rotateX(Math.asin(Math.max(-1, Math.min(1, f)))); root.rotateZ(-Math.asin(Math.max(-1, Math.min(1, sd))));
  }
  if (dw > 0) { B.rotation.y = dw * Math.PI / 2; B.position.set(0.05 * dw, 0, 0.5 * dw); }
  if (down) {
    r.tumble = Math.min(1, r.tumble + dt * 3.2);
    root.rotateX(-r.tumble * Math.PI / 2 * (s.alive ? 0.9 : 1)); root.position.y += 0.15 * (1 - r.tumble) + (s.alive ? 0.12 : 0.15);
    B.position.set(0.5 * r.tumble, -0.1, 0.7 * r.tumble); B.rotation.set(r.tumble * 1.2, r.tumble * 0.7, r.tumble * 2.2);
  } else r.tumble = Math.max(0, r.tumble - dt * 4);
  // legs: hips over the board, feet on it (back foot pushes on the ground when accelerating)
  const c = r.crouch, hip = _v[0].set(0.02 + r.lean * 0.4, 0.98 - c * 0.38 + (air ? 0.05 : 0), 0);
  const front = V3().set(0, 0.17 + feetLift + B.position.y * 0.6, 0.23), back = V3().set(0, 0.17 + feetLift + B.position.y * 0.6, -0.23);
  const pushing = s.mode === MODE.GROUND && s.my > 0.3 && sp < 11.5 && s.manual <= 0 && s.charge < 0 && !down;
  if (pushing) { r.phase += dt * (5 + sp * 0.4); const ph = r.phase % (Math.PI * 2), k = Math.sin(ph); back.set(-0.22, Math.max(0.02, 0.12 + k * 0.12), -0.15 - Math.cos(ph) * 0.35); }
  if (s.manual > 0) { front.y += 0.1; }
  if (dw > 0 || sq > 0) { // feet planted on the ground, shoulder-width; hips sink and push back into the squat
    front.lerp(V3().set(0.06, 0.05, 0.19), dw); back.lerp(V3().set(0.06, 0.05, -0.19), dw);
    hip.y = 0.98 - (0.98 - hip.y) * (1 - dw) - 0.47 * sq - 0.12 * dw * (1 - sq); hip.x -= 0.2 * sq;
  }
  const hipL = V3().copy(hip).add(V3().set(0, 0, 0.11)), hipR = V3().copy(hip).add(V3().set(0, 0, -0.11));
  const bend = V3().set(1, 0.2, 0), kL = V3(), kR = V3();
  ik(hipL, front, RIG.l1, RIG.l2, bend, kL); ik(hipR, back, RIG.l1, RIG.l2, bend, kR);
  limbBetween(P.thighL, hipL, kL); limbBetween(P.shinL, kL, front); limbBetween(P.thighR, hipR, kR); limbBetween(P.shinR, kR, back);
  P.footL.position.copy(front).add(V3().set(0.03, -0.03, 0)); P.footR.position.copy(back).add(V3().set(0.03, -0.03, 0));
  P.footL.rotation.set(0, Math.PI / 2 - 0.2, 0); P.footR.rotation.set(0, Math.PI / 2 + 0.2, 0);
  // torso + head: twist toward the aim (bible §11: independent upper-body aiming)
  const twist = dw > 0 ? 0 : Math.max(-1.5, Math.min(1.5, angWrap(view.aimYaw - (yaw + Math.PI / 2))));
  const chest = V3().copy(hip).add(V3().set(0.06 + r.lean * 0.5 + (s.manual > 0 ? -0.15 : 0) + 0.24 * sq, 0.52 - c * 0.08 - 0.07 * sq, 0));
  P.torso.position.copy(hip).lerp(chest, 0.5).add(V3().set(0, 0.04, 0)); P.torso.rotation.set(0, twist * 0.6, -0.12 - c * 0.3 + r.lean * 0.6 - (r.hitT > 0 ? 0.3 : 0) - 0.45 * sq);
  r.head.position.copy(chest).add(V3().set(0.02, 0.27, 0)); r.head.rotation.set(0, twist * 0.95 + Math.PI / 2 - Math.PI / 2, -view.aimPitch * 0.5);
  r.head.rotation.y = twist; // face local +x then twist
  // expression: squint when hit or charged, wide when airborne
  const eyeSq = r.hitT > 0 ? 0.3 : s.adren >= 100 ? 0.5 : 1; r.eyes.forEach((e) => { e.scale.y = eyeSq; }); r.mouth.scale.z = air ? 0.6 : 1; r.mouth.scale.y = r.hitT > 0 || air ? 2.5 : 1;
  // arms + weapon
  const aimDir = V3().set(Math.sin(view.aimYaw - yaw) * Math.cos(view.aimPitch), Math.sin(view.aimPitch), Math.cos(view.aimYaw - yaw) * Math.cos(view.aimPitch));
  const sh = V3().copy(chest).add(V3().set(0, 0.16, 0));
  const tw = V3().set(Math.cos(twist), 0, -Math.sin(twist)); // body's facing in root space after twist
  const side = V3().set(Math.sin(twist), 0, Math.cos(twist));
  const shL = V3().copy(sh).addScaledVector(side, 0.2), shR = V3().copy(sh).addScaledVector(side, -0.2);
  let hR, hL;
  const wid = s.alive && !(ROUND && ROUND.free) ? (s.slot === 1 && s.ranged ? s.ranged : s.melee || 'bat') : null;
  const ranged = wid && AIM_IDS[wid];
  if (ranged) {
    hR = V3().copy(sh).addScaledVector(aimDir, 0.48 - r.recoil * 0.12).addScaledVector(side, -0.05);
    hL = V3().copy(hR).addScaledVector(aimDir, 0.16).addScaledVector(side, 0.08);
  } else if (s.atk) {
    const Wp = WEAPONS[s.atk.w] || WEAPONS.bat, t = s.atk.t;
    const u = t < Wp.wind ? -(t / Wp.wind) : t < Wp.wind + Wp.act ? -1 + 2.2 * (t - Wp.wind) / Wp.act : 1.2 - Math.min(1.2, (t - Wp.wind - Wp.act) / Math.max(0.05, Wp.rec) * 1.2);
    const ang = u * 1.6;
    const dir = V3().copy(aimDir).applyAxisAngle(_up, ang);
    hR = V3().copy(sh).addScaledVector(dir, 0.5).add(V3().set(0, 0.1 - Math.abs(u) * 0.15, 0));
    hL = V3().copy(shL).add(V3().set(0.1, -0.25, 0));
  } else {
    const idle = Math.sin(GFX.clock * 2 + r.phase) * 0.03;
    hR = V3().copy(shR).addScaledVector(tw, 0.18).add(V3().set(0, -0.35 + idle, 0));
    hL = V3().copy(shL).addScaledVector(tw, 0.1).add(V3().set(0, -0.4 - idle + (air ? 0.25 : 0) + (s.mode === MODE.GRIND ? 0.3 : 0), 0)).addScaledVector(side, air || s.mode === MODE.GRIND ? 0.25 : 0);
    if (air || s.mode === MODE.GRIND) hR.addScaledVector(side, -0.25).y += 0.25;
  }
  if (s.adren >= 100 && s.alive && !ranged && !s.atk) hR.y += 0.1;
  if (dw > 0) { // hands: at the waistband while the trousers go down / up, otherwise braced on the knees
    const wL = V3().copy(hip).add(V3().set(-0.02, 0.06, 0.2)), wR = V3().copy(hip).add(V3().set(-0.02, 0.06, -0.2));
    if (pulling) { const k = DT0 < 1.5 ? sm((DT0 - 0.72) / 0.33) : 1 - sm((DT0 - 2.42) / 0.36); wL.y -= 0.32 * k; wR.y -= 0.32 * k; wL.x += 0.05 * k; wR.x += 0.05 * k; hL = wL; hR = wR; }
    else if (sq > 0.3) { hL.lerp(V3().copy(kL).add(V3().set(0.07, 0.06, 0)), sq); hR.lerp(V3().copy(kR).add(V3().set(0.07, 0.06, 0)), sq); }
    else { hL.lerp(wL, dw); hR.lerp(wR, dw); }
  }
  const eL = V3(), eR = V3();
  ik(shL, hL, RIG.a1, RIG.a2, V3().set(-0.3, -1, 0), eL); ik(shR, hR, RIG.a1, RIG.a2, V3().set(-0.3, -1, 0), eR);
  limbBetween(P.uaL, shL, eL); limbBetween(P.faL, eL, hL); limbBetween(P.uaR, shR, eR); limbBetween(P.faR, eR, hR);
  P.handL.position.copy(hL); P.handR.position.copy(hR);
  // weapon mesh in the right hand, pointing along the forearm (melee) or the aim (guns)
  if (wid !== r.weaponId) {
    if (r.weapon) r.hold.remove(r.weapon);
    r.weapon = wid ? weaponMesh(wid) : null; r.weaponId = wid; if (r.weapon) r.hold.add(r.weapon);
  }
  if (r.weapon) {
    r.hold.position.copy(hR);
    const fwd = ranged ? aimDir.clone() : V3().subVectors(hR, eR).normalize();
    r.hold.quaternion.setFromUnitVectors(V3().set(0, 0, 1), fwd);
    if (r.weapon.userData.saw) r.weapon.userData.saw.rotation.y += dt * 20;
  }
  r.hold.visible = s.alive && dw === 0;
  // trousers down: skin thighs, bare cheeks out back, cloth bunched around the knees
  const pm = pantsDown ? r.skinM : r.legM; if (P.thighL.material !== pm) { P.thighL.material = pm; P.thighR.material = pm; }
  r.butt.visible = pantsDown; r.bunch.forEach((b) => { b.visible = pantsDown; });
  if (pantsDown) {
    r.butt.position.copy(hip).add(V3().set(-0.1, -0.02, 0)); r.butt.rotation.set(0, 0, -0.45 * sq);
    r.bunch[0].position.copy(kL).add(V3().set(0.0, 0.02, 0)); r.bunch[1].position.copy(kR).add(V3().set(0.0, 0.02, 0));
    r.bunch[0].rotation.set(Math.PI / 2, 0, 0.6); r.bunch[1].rotation.set(Math.PI / 2, 0, 0.6);
    if (DT0 > 1.0 && DT0 < 1.6) r.mouth.scale.y = 2.2; // strain
  }
  // pads ride on the knees; the backpack sits on the back of the chest; brows angry when attacking
  if (r.pads.length) { r.pads[0].position.copy(kL).add(V3().set(0.07, 0, 0)); r.pads[1].position.copy(kR).add(V3().set(0.07, 0, 0)); }
  if (r.pack) { r.pack.position.copy(chest).add(V3().set(-0.22 * Math.cos(twist * 0.6), -0.12, 0.22 * Math.sin(twist * 0.6))); r.pack.rotation.set(0, twist * 0.6, -0.12 - c * 0.3); }
  const mad = s.atk || r.hitT > 0 ? 0.35 : 0; r.brows[0].rotation.x = mad; r.brows[1].rotation.x = -mad;
  // contact shadow
  if (!r.blob) { r.blob = new THREE.Mesh(new THREE.CircleGeometry(0.55, 20), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.35, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 })); r.blob.rotation.x = -Math.PI / 2; GFX.scene.add(r.blob); }
  const W = ROUND && ROUND.W, gy = W ? SIM0.groundAt(W, view.x, view.z, view.y + 0.3) : view.y;
  const hgt = gy > -1e8 ? view.y - gy : 99; r.blob.visible = hgt < 6 && (s.alive || hgt < 1);
  if (r.blob.visible) { r.blob.position.set(view.x, gy + 0.025, view.z); const k = Math.max(0.35, 1 - hgt * 0.15); r.blob.scale.setScalar(k); r.blob.material.opacity = 0.38 * k; }
}

// ── portraits for lobby seats (rendered once per look)
const PORTRAITS = {};
function portrait(look) {
  look = look % SKATERS.length;
  if (PORTRAITS[look]) return PORTRAITS[look];
  if (!GFX.r) return '';
  const T = THREE, sc = new T.Scene(), cam = new T.PerspectiveCamera(32, 1, 0.1, 20);
  sc.add(new T.HemisphereLight(0xffffff, 0x887766, 2.2)); const dl = new T.DirectionalLight(0xffffff, 1.6); dl.position.set(2, 3, 2); sc.add(dl);
  const rig = makeSkaterRig(look); sc.add(rig.root);
  const fake = { alive: true, hp: 100, mode: 0, vx: 0, vz: 0, vy: 0, charge: -1, my: 0, manual: 0, adren: 0, slot: 0, melee: 'bat', ranged: null, ammo: 0, trick: null, atk: null, onPrim: null, nx: 0, ny: 1, nz: 0 };
  poseRig(rig, fake, 0.016, { x: 0, y: 0, z: 0, yaw: 0.35, aimYaw: Math.PI / 2 + 0.35, aimPitch: 0 });
  cam.position.set(1.7, 1.5, 0.35); cam.lookAt(0, 1.22, 0);
  const rt = new T.WebGLRenderTarget(128, 128); GFX.r.setRenderTarget(rt); GFX.r.setClearColor(new T.Color(SKATERS[look].trim), 1); GFX.r.render(sc, cam); GFX.r.setRenderTarget(null);
  const px = new Uint8Array(128 * 128 * 4); GFX.r.readRenderTargetPixels(rt, 0, 0, 128, 128, px);
  const cv = document.createElement('canvas'); cv.width = cv.height = 128; const g = cv.getContext('2d'), id = g.createImageData(128, 128);
  for (let y = 0; y < 128; y++) id.data.set(px.subarray((127 - y) * 512, (128 - y) * 512), y * 512);
  g.putImageData(id, 0, 0); rt.dispose();
  return (PORTRAITS[look] = cv.toDataURL());
}

// printed clothing per skater (original designs): hoodie logos, racing stripes, plaid, reflective tape, varsity
// numbers, overalls, stunt stars, paint splatter; trousers with knee rips or stripes; sneakers with colour panels
const CLOTH = {};
function clothTex(look, part) {
  const key = look + part; if (CLOTH[key]) return CLOTH[key];
  const L = SKATERS[look % SKATERS.length], S = 256, cv = document.createElement('canvas'); cv.width = cv.height = S; const g = cv.getContext('2d');
  const r = mulberry(look * 31 + part.length);
  const fill = (c) => { g.fillStyle = c; g.fillRect(0, 0, S, S); };
  const speck = (n, c, a) => { g.fillStyle = c; for (let i = 0; i < n; i++) { g.globalAlpha = a * r(); g.fillRect(r() * S, r() * S, 2, 2); } g.globalAlpha = 1; };
  if (part === 'top') {
    fill(L.body);
    switch (L.id) {
      case 'brick': g.fillStyle = L.trim; g.font = '900 64px Impact'; g.textAlign = 'center'; g.fillText('WRK', S * 0.25, S * 0.62); g.fillRect(0, S * 0.9, S, S * 0.1); break; // hoodie logo + cuff
      case 'vex': g.fillStyle = L.trim; for (const x of [0.18, 0.28, 0.68, 0.78]) g.fillRect(S * x, 0, S * 0.05, S); g.fillStyle = '#F4EEDC'; g.beginPath(); g.arc(S * 0.25, S * 0.4, 22, 0, 7); g.fill(); g.fillStyle = '#22292B'; g.font = '900 28px Impact'; g.textAlign = 'center'; g.fillText('7', S * 0.25, S * 0.45); break;
      case 'rot': g.strokeStyle = 'rgba(0,0,0,.35)'; g.lineWidth = 6; for (let k = 0; k < S; k += 28) { g.beginPath(); g.moveTo(k, 0); g.lineTo(k, S); g.moveTo(0, k); g.lineTo(S, k); g.stroke(); } g.strokeStyle = L.trim; g.lineWidth = 2; for (let k = 14; k < S; k += 28) { g.beginPath(); g.moveTo(k, 0); g.lineTo(k, S); g.moveTo(0, k); g.lineTo(S, k); g.stroke(); } for (let k = 0; k < 6; k++) { g.fillStyle = '#C9D3D6'; g.beginPath(); g.arc(r() * S, r() * S, 5, 0, 7); g.fill(); } break; // plaid + studs
      case 'dash': g.fillStyle = '#C9D3D6'; g.fillRect(0, S * 0.35, S, 14); g.fillRect(0, S * 0.6, S, 14); g.fillStyle = L.trim; g.fillRect(S * 0.15, S * 0.45, 40, 30); g.fillRect(S * 0.6, S * 0.45, 40, 30); break; // reflective tape + pockets
      case 'ace': g.fillStyle = L.trim; g.fillRect(0, 0, S * 0.15, S); g.fillRect(S * 0.85, 0, S * 0.15, S); g.fillStyle = '#22292B'; g.font = '900 90px Impact'; g.textAlign = 'center'; g.fillText('8', S * 0.3, S * 0.65); g.fillStyle = '#F4EEDC'; g.fillText('8', S * 0.3 - 4, S * 0.65 - 4); break; // varsity
      case 'grease': g.fillStyle = L.trim; g.fillRect(S * 0.1, 0, S * 0.12, S); g.fillRect(S * 0.6, 0, S * 0.12, S); g.fillStyle = 'rgba(30,25,20,.35)'; for (let k = 0; k < 12; k++) { g.beginPath(); g.arc(r() * S, r() * S, 6 + r() * 14, 0, 7); g.fill(); } g.fillStyle = '#C9D3D6'; g.fillRect(S * 0.12, S * 0.2, 12, 12); g.fillRect(S * 0.62, S * 0.2, 12, 12); break; // overalls straps + grease
      case 'crash': g.fillStyle = L.trim; for (let k = 0; k < 7; k++) { g.save(); g.translate(r() * S, r() * S); g.beginPath(); for (let j = 0; j < 10; j++) { const a = j * Math.PI / 5, rr = j % 2 ? 7 : 16; g.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); } g.fill(); g.restore(); } g.fillStyle = '#22292B'; g.fillRect(0, S * 0.48, S, 10); break; // stunt stars
      case 'tag': for (const c of ['#B4E64A', '#FF5C69', '#36DCE8', '#FF9B36']) { g.fillStyle = c; for (let k = 0; k < 10; k++) { const x = r() * S, y = r() * S; g.beginPath(); g.arc(x, y, 3 + r() * 10, 0, 7); g.fill(); g.fillRect(x - 1, y, 3, 10 + r() * 20); } } break; // paint splatter
    }
    speck(500, '#000', 0.08);
  } else if (part === 'legs') {
    fill(L.trim);
    if (/streetwear|graffiti|punk/.test(L.style)) { g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(S * 0.2, S * 0.45, S * 0.25, S * 0.1); g.fillStyle = L.skin; g.fillRect(S * 0.24, S * 0.48, S * 0.17, S * 0.04); } // knee rip
    else { g.fillStyle = L.body; g.fillRect(S * 0.42, 0, S * 0.08, S); } // side stripe
    speck(400, '#000', 0.1);
  } else { // shoe
    fill('#E8DDBD'); g.fillStyle = L.body; g.fillRect(0, S * 0.35, S, S * 0.25); g.fillStyle = '#22292B'; g.fillRect(0, S * 0.85, S, S * 0.15); g.fillStyle = L.deck; g.beginPath(); g.arc(S * 0.5, S * 0.45, 22, 0, 7); g.fill();
  }
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return (CLOTH[key] = t);
}
