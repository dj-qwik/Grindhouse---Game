// ───────────────────────── DECOR: set dressing, ground detail, sky (render only — never touches physics) ─────────────────────────
// Props are instanced (one draw call per prop type + its outline) and placed deterministically per arena along wall
// bases, on tall roofs and around the edges, away from spawns, pickups and live hazards so play stays readable.
const DECOR = { protos: {}, decals: {}, cloud: null, windows: null };
// merge coloured parts into one geometry (non-indexed, vertex colours) so a whole prop is one instance
function mergeParts(parts) {
  const T = THREE, pos = [], nor = [], col = [];
  for (const { g, c, m } of parts) {
    const geo = (g.index ? g.toNonIndexed() : g.clone()); if (m) geo.applyMatrix4(m); geo.computeVertexNormals();
    const cc = new T.Color(c), P = geo.attributes.position.array, N = geo.attributes.normal.array;
    for (let i = 0; i < P.length; i += 3) { pos.push(P[i], P[i + 1], P[i + 2]); nor.push(N[i], N[i + 1], N[i + 2]); col.push(cc.r, cc.g, cc.b); }
  }
  const out = new T.BufferGeometry();
  out.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); out.setAttribute('normal', new T.Float32BufferAttribute(nor, 3)); out.setAttribute('color', new T.Float32BufferAttribute(col, 3));
  return out;
}
const M4 = (x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, s = 1, sy = s, sz = s) => new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(s, sy, sz));
function buildDecor() {
  const T = THREE, P = DECOR.protos;
  P.barrel = mergeParts([{ g: new T.CylinderGeometry(0.3, 0.3, 0.88, 14), c: '#2F8FB0', m: M4(0, 0.44) }, { g: new T.TorusGeometry(0.3, 0.025, 4, 16), c: '#22292B', m: M4(0, 0.25, 0, Math.PI / 2) }, { g: new T.TorusGeometry(0.3, 0.025, 4, 16), c: '#22292B', m: M4(0, 0.63, 0, Math.PI / 2) }, { g: new T.CylinderGeometry(0.27, 0.27, 0.02, 14), c: '#B85435', m: M4(0, 0.89) }]);
  P.rbarrel = mergeParts([{ g: new T.CylinderGeometry(0.3, 0.3, 0.88, 14), c: '#B85435', m: M4(0, 0.44) }, { g: new T.TorusGeometry(0.3, 0.025, 4, 16), c: '#7a3015', m: M4(0, 0.3, 0, Math.PI / 2) }, { g: new T.TorusGeometry(0.3, 0.025, 4, 16), c: '#7a3015', m: M4(0, 0.6, 0, Math.PI / 2) }]);
  P.cone = mergeParts([{ g: new T.BoxGeometry(0.42, 0.04, 0.42), c: '#22292B', m: M4(0, 0.02) }, { g: new T.ConeGeometry(0.16, 0.6, 12), c: '#FF9B36', m: M4(0, 0.33) }, { g: new T.CylinderGeometry(0.1, 0.125, 0.09, 12), c: '#F4EEDC', m: M4(0, 0.4) }]);
  P.tires = mergeParts([0, 1, 2].map((k) => ({ g: new T.TorusGeometry(0.33, 0.13, 8, 16), c: k === 1 ? '#2a2a2a' : '#1d1d1d', m: M4(0, 0.13 + k * 0.25, 0, Math.PI / 2, 0, k * 0.2) })));
  P.trash = mergeParts([{ g: new T.SphereGeometry(0.35, 9, 7), c: '#22292B', m: M4(0, 0.28, 0, 0, 0, 0, 1, 0.8, 1) }, { g: new T.SphereGeometry(0.28, 9, 7), c: '#2c3436', m: M4(0.42, 0.22, 0.1, 0, 0, 0, 1, 0.8, 1) }, { g: new T.SphereGeometry(0.1, 6, 5), c: '#22292B', m: M4(0, 0.62) }, { g: new T.BoxGeometry(0.3, 0.25, 0.3), c: '#C9A26A', m: M4(-0.35, 0.12, 0.25, 0, 0.5) }]);
  P.crate = mergeParts([{ g: new T.BoxGeometry(0.75, 0.75, 0.75), c: '#B07A45', m: M4(0, 0.375) }, ...[-1, 1].flatMap((s) => [{ g: new T.BoxGeometry(0.78, 0.09, 0.09), c: '#6E4630', m: M4(0, 0.375 + s * 0.3, 0.34) }, { g: new T.BoxGeometry(0.09, 0.78, 0.09), c: '#6E4630', m: M4(s * 0.3, 0.375, 0.34) }, { g: new T.BoxGeometry(0.78, 0.09, 0.09), c: '#6E4630', m: M4(0, 0.375 + s * 0.3, -0.34) }])]);
  P.pallet = mergeParts([...[0, 1, 2, 3, 4].map((k) => ({ g: new T.BoxGeometry(1.1, 0.03, 0.15), c: '#C9965A', m: M4(0, 0.11, -0.45 + k * 0.225) })), ...[-1, 0, 1].map((k) => ({ g: new T.BoxGeometry(0.1, 0.09, 1.0), c: '#8A5A33', m: M4(k * 0.48, 0.045, 0) }))]);
  P.box = mergeParts([{ g: new T.BoxGeometry(0.55, 0.42, 0.42), c: '#C9A26A', m: M4(0, 0.21) }, { g: new T.BoxGeometry(0.56, 0.02, 0.08), c: '#E8DDBD', m: M4(0, 0.43) }]);
  P.pipe = mergeParts([{ g: new T.CylinderGeometry(0.07, 0.07, 1, 8), c: '#5E8F7A', m: M4(0, 0.5) }, { g: new T.CylinderGeometry(0.09, 0.09, 0.06, 8), c: '#3E6F5A', m: M4(0, 0.25) }, { g: new T.CylinderGeometry(0.09, 0.09, 0.06, 8), c: '#3E6F5A', m: M4(0, 0.75) }]);
  P.ac = mergeParts([{ g: new T.BoxGeometry(1.2, 0.8, 0.9), c: '#9AA4A8', m: M4(0, 0.4) }, { g: new T.CylinderGeometry(0.32, 0.32, 0.04, 16), c: '#22292B', m: M4(0, 0.81) }, { g: new T.BoxGeometry(0.66, 0.02, 0.06), c: '#C9D3D6', m: M4(0, 0.84) }, { g: new T.BoxGeometry(0.06, 0.02, 0.66), c: '#C9D3D6', m: M4(0, 0.84) }, { g: new T.BoxGeometry(1.22, 0.06, 0.92), c: '#6E7273', m: M4(0, 0.03) }]);
  P.lamp = mergeParts([{ g: new T.CylinderGeometry(0.07, 0.1, 6, 8), c: '#3B4245', m: M4(0, 3) }, { g: new T.BoxGeometry(0.08, 0.08, 1.2), c: '#3B4245', m: M4(0, 5.95, 0.55) }, { g: new T.BoxGeometry(0.35, 0.14, 0.5), c: '#22292B', m: M4(0, 5.88, 1.1) }, { g: new T.BoxGeometry(0.3, 0.03, 0.42), c: '#FFF1B0', m: M4(0, 5.8, 1.1) }]);
  P.hydrant = mergeParts([{ g: new T.CylinderGeometry(0.14, 0.17, 0.6, 10), c: '#FF5C69', m: M4(0, 0.3) }, { g: new T.SphereGeometry(0.15, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), c: '#FF5C69', m: M4(0, 0.6) }, { g: new T.CylinderGeometry(0.06, 0.06, 0.4, 8), c: '#E8DDBD', m: M4(0, 0.42, 0, 0, 0, Math.PI / 2) }, { g: new T.CylinderGeometry(0.2, 0.2, 0.05, 10), c: '#B03040', m: M4(0, 0.03) }]);
  P.ebox = mergeParts([{ g: new T.BoxGeometry(0.8, 1.1, 0.35), c: '#7D8B91', m: M4(0, 0.85) }, { g: new T.BoxGeometry(0.3, 0.3, 0.02), c: '#E2B13C', m: M4(0, 1.05, 0.18) }, { g: new T.BoxGeometry(0.06, 0.3, 0.06), c: '#3B4245', m: M4(-0.25, 0.15) }, { g: new T.BoxGeometry(0.06, 0.3, 0.06), c: '#3B4245', m: M4(0.25, 0.15) }]);
  P.bottles = mergeParts([[0, 0, '#5E8F2E'], [0.12, 0.05, '#8A5A33'], [-0.08, 0.1, '#5E8F2E'], [0.05, -0.12, '#36A7C9']].map(([x, z, c], k) => ({ g: new T.CylinderGeometry(0.035, 0.04, 0.24, 8), c, m: k === 3 ? M4(x, 0.04, z, 0, 0, Math.PI / 2) : M4(x, 0.12, z) })));
  P.dumpster = mergeParts([{ g: new T.BoxGeometry(1.9, 1.15, 1.1), c: '#2E7D4F', m: M4(0, 0.7) }, { g: new T.BoxGeometry(2.0, 0.08, 1.2), c: '#245F3C', m: M4(0, 1.3, 0, -0.18) }, { g: new T.BoxGeometry(1.95, 0.1, 0.06), c: '#E2B13C', m: M4(0, 0.95, 0.56) }, ...[-0.8, 0.8].map((x) => ({ g: new T.CylinderGeometry(0.08, 0.08, 0.06, 8), c: '#22292B', m: M4(x, 0.08, 0.45, Math.PI / 2) })), { g: new T.BoxGeometry(0.5, 0.25, 0.02), c: '#F4EEDC', m: M4(0.4, 0.8, 0.56) }]);
  P.barrier = mergeParts([{ g: new T.BoxGeometry(0.6, 0.25, 2.0), c: '#E8DDBD', m: M4(0, 0.125) }, { g: new T.BoxGeometry(0.32, 0.6, 2.0), c: '#E8DDBD', m: M4(0, 0.55) }, { g: new T.BoxGeometry(0.34, 0.12, 2.02), c: '#FF5C69', m: M4(0, 0.55) }]);
  P.tbarrel = mergeParts([{ g: new T.CylinderGeometry(0.3, 0.34, 0.95, 12), c: '#FF9B36', m: M4(0, 0.48) }, { g: new T.CylinderGeometry(0.315, 0.325, 0.1, 12), c: '#F4EEDC', m: M4(0, 0.4) }, { g: new T.CylinderGeometry(0.305, 0.31, 0.1, 12), c: '#F4EEDC', m: M4(0, 0.7) }, { g: new T.CylinderGeometry(0.45, 0.45, 0.06, 12), c: '#22292B', m: M4(0, 0.03) }]);
  P.cart = mergeParts([{ g: new T.BoxGeometry(0.55, 0.45, 0.85), c: '#9AA4A8', m: M4(0, 0.75) }, { g: new T.BoxGeometry(0.5, 0.02, 0.8), c: '#36DCE8', m: M4(0, 0.55) }, { g: new T.CylinderGeometry(0.02, 0.02, 0.55, 6), c: '#FF5C69', m: M4(0, 1.05, -0.48, 0, 0, Math.PI / 2) }, ...[[-0.22, -0.35], [0.22, -0.35], [-0.22, 0.35], [0.22, 0.35]].map(([x, z]) => ({ g: new T.CylinderGeometry(0.05, 0.05, 0.04, 8), c: '#22292B', m: M4(x, 0.05, z, 0, 0, Math.PI / 2) }))]);
  P.antenna = mergeParts([{ g: new T.CylinderGeometry(0.03, 0.04, 3, 6), c: '#3B4245', m: M4(0, 1.5) }, { g: new T.CylinderGeometry(0.6, 0.5, 0.08, 14), c: '#C9D3D6', m: M4(0, 2.4, 0, 0.6) }, { g: new T.BoxGeometry(0.9, 0.03, 0.03), c: '#3B4245', m: M4(0, 2.9) }]);
  // ground decals
  const D = DECOR.decals;
  D.manhole = decalTex((g, S) => { g.fillStyle = '#3a3836'; g.beginPath(); g.arc(S / 2, S / 2, S * 0.46, 0, 7); g.fill(); g.strokeStyle = '#2a2826'; g.lineWidth = 8; g.stroke(); g.strokeStyle = '#4c4a47'; g.lineWidth = 5; for (let k = 0; k < 7; k++) { g.beginPath(); g.moveTo(S * 0.1, S * (0.2 + k * 0.1)); g.lineTo(S * 0.9, S * (0.2 + k * 0.1)); g.stroke(); } g.fillStyle = '#E8DDBD'; g.font = 'bold 22px Impact'; g.textAlign = 'center'; g.fillText('SEWER', S / 2, S / 2 + 8); });
  D.drain = decalTex((g, S) => { g.fillStyle = '#2a2826'; g.fillRect(S * 0.15, S * 0.3, S * 0.7, S * 0.4); g.fillStyle = '#4a4744'; for (let k = 0; k < 9; k++) g.fillRect(S * 0.18 + k * S * 0.075, S * 0.32, S * 0.04, S * 0.36); });
  D.oil = decalTex((g, S) => { for (let k = 0; k < 6; k++) { g.fillStyle = `rgba(15,15,20,${0.18 + Math.random() * 0.2})`; g.beginPath(); g.ellipse(S / 2 + (Math.random() - 0.5) * S * 0.4, S / 2 + (Math.random() - 0.5) * S * 0.4, S * (0.1 + Math.random() * 0.2), S * (0.08 + Math.random() * 0.15), Math.random() * 3, 0, 7); g.fill(); } g.strokeStyle = 'rgba(120,80,200,.25)'; g.lineWidth = 3; g.beginPath(); g.arc(S / 2, S / 2, S * 0.2, 0, 4); g.stroke(); });
  D.skid = decalTex((g, S) => { g.strokeStyle = 'rgba(15,15,15,.45)'; g.lineCap = 'round'; for (const o of [-0.12, 0.12]) { g.lineWidth = 14; g.beginPath(); g.moveTo(S * 0.05, S * (0.5 + o)); g.bezierCurveTo(S * 0.4, S * (0.4 + o), S * 0.6, S * (0.65 + o), S * 0.95, S * (0.55 + o)); g.stroke(); } });
  D.arrow = decalTex((g, S) => { g.fillStyle = 'rgba(244,238,220,.8)'; g.beginPath(); g.moveTo(S * 0.5, S * 0.08); g.lineTo(S * 0.85, S * 0.45); g.lineTo(S * 0.62, S * 0.45); g.lineTo(S * 0.62, S * 0.92); g.lineTo(S * 0.38, S * 0.92); g.lineTo(S * 0.38, S * 0.45); g.lineTo(S * 0.15, S * 0.45); g.fill(); });
  D.stencil = decalTex((g, S) => { g.fillStyle = 'rgba(255,214,70,.8)'; g.font = '900 54px Impact'; g.textAlign = 'center'; g.fillText('NO', S / 2, S * 0.38); g.fillText('SKATING', S / 2, S * 0.62); g.fillStyle = 'rgba(255,92,105,.85)'; g.font = '900 30px Impact'; g.save(); g.translate(S / 2, S * 0.82); g.rotate(-0.1); g.fillText('(LOL)', 0, 0); g.restore(); });
  D.sticker = decalTex((g, S) => { const cols = ['#B4E64A', '#36DCE8', '#FF5C69', '#FF9B36', '#9D75EA']; for (let k = 0; k < 9; k++) { g.save(); g.translate(Math.random() * S, Math.random() * S); g.rotate(Math.random() * 6); g.fillStyle = cols[k % 5]; g.fillRect(-26, -16, 52, 32); g.fillStyle = '#22292B'; g.font = 'bold 14px Impact'; g.fillText(['GH', 'SK8', 'RIP', '666', 'WRK', 'ZAP'][k % 6], -18, 6); g.restore(); } });
  DECOR.cloud = (() => { const S = 256, cv = document.createElement('canvas'); cv.width = S; cv.height = S / 2; const g = cv.getContext('2d'); const puffs = [[0.3, 0.6, 0.18], [0.45, 0.45, 0.22], [0.62, 0.5, 0.2], [0.75, 0.62, 0.14], [0.5, 0.65, 0.2]]; g.fillStyle = '#22292B'; for (const [x, y, r] of puffs) { g.beginPath(); g.arc(x * S, y * S / 2 * 2 * 0.5 + 6, r * S + 4, 0, 7); g.fill(); } g.fillStyle = '#fff'; for (const [x, y, r] of puffs) { g.beginPath(); g.arc(x * S, y * S * 0.5, r * S, 0, 7); g.fill(); } g.fillStyle = 'rgba(160,190,220,.6)'; for (const [x, y, r] of puffs) { g.beginPath(); g.arc(x * S, y * S * 0.5 + r * S * 0.55, r * S * 0.7, 0, Math.PI); g.fill(); } const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t; })();
  DECOR.windows = (() => { const S = 256, cv = document.createElement('canvas'); cv.width = cv.height = S; const g = cv.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, S, S); for (let y = 8; y < S; y += 32) for (let x = 8; x < S; x += 24) { const lit = Math.random() < 0.25; g.fillStyle = lit ? '#FFE9A8' : 'rgba(40,50,60,.55)'; g.fillRect(x, y, 14, 20); } g.fillStyle = 'rgba(0,0,0,.15)'; for (let y = 0; y < S; y += 32) g.fillRect(0, y, S, 3); const t = new THREE.CanvasTexture(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; return t; })();
}
function decalTex(draw) { const S = 256, cv = document.createElement('canvas'); cv.width = cv.height = S; draw(cv.getContext('2d'), S); const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; }

function placeDecor(root, R) {
  const T = THREE, W = R.W, rnd = mulberry(W.half * 131 + W.prims.length * 7 + (W.variant || 0));
  const keep = []; // spots to keep clear: spawns, pickups, hazards
  for (const s of W.spawns) keep.push([s[0], s[1], 3.5]);
  for (const p of W.pickups) keep.push([p[0], p[2], 2.2]);
  for (const h of W.hz || []) keep.push([h.x || 0, h.z || 0, (h.r || Math.max(h.w || 2, h.d || 2) / 2) + 1.5]);
  const clear = (x, z) => keep.every(([kx, kz, r]) => Math.hypot(x - kx, z - kz) > r);
  const inst = {}; // type → [Matrix4]
  const put = (type, x, y, z, ry = rnd() * 6.28, s = 1, sy = s) => { (inst[type] || (inst[type] = [])).push(M4(x, y, z, 0, ry, 0, s, sy, s)); };
  const solidHere = (x, y, z) => SIM0.raycast(W, x, y + 1.5, z, 0, -1, 0, 1.2) < 1.15; // something solid just under head height
  // along the base of tall static walls
  const statics = W.prims.filter((p) => p.type === 'box' && !p.gone && p.top - p.y0 >= 1.4 && !(p.vx || p.vz) && p.mat !== 'gate' && p.mat !== 'fence');
  const ground = ['barrel', 'rbarrel', 'cone', 'cone', 'tires', 'trash', 'trash', 'crate', 'pallet', 'box', 'box', 'bottles', 'hydrant', 'ebox', 'dumpster', 'dumpster', 'barrier', 'tbarrel', 'tbarrel', 'cart'];
  for (const p of statics) {
    const c = Math.cos(p.yaw), sn = Math.sin(p.yaw);
    for (const [sx, sz, len, nx, nz] of [[0, p.d / 2, p.w, 0, 1], [0, -p.d / 2, p.w, 0, -1], [p.w / 2, 0, p.d, 1, 0], [-p.w / 2, 0, p.d, -1, 0]]) {
      const steps = Math.floor(len / 3.2);
      for (let k = 0; k < steps; k++) {
        if (rnd() > 0.5) continue;
        const off = 0.75, u = (k + 0.5) / steps - 0.5, lx = sx + (nz !== 0 ? u * len : 0) + nx * off, lz = sz + (nx !== 0 ? u * len : 0) + nz * off;
        const x = p.cx + lx * c + lz * sn, z = p.cz - lx * sn + lz * c;
        if (Math.abs(x) > W.half + 0.5 || Math.abs(z) > W.half + 0.5 || !clear(x, z)) continue;
        const gy = SIM0.groundAt(W, x, z, p.y0 + 0.4); if (gy < -1e8 || Math.abs(gy - p.y0) > 0.3) continue;
        if (solidHere(x, gy, z)) continue;
        const wall = p.top - p.y0 >= 2.5;
        if (wall && rnd() < 0.3) { put('pipe', x - nx * 0.42, gy, z - nz * 0.42, 0, 1, p.top - gy); continue; }
        const type = ground[Math.floor(rnd() * ground.length)];
        const facing = Math.atan2(nx * c + nz * sn, -nx * sn + nz * c); // lie along the wall
        put(type, x, gy, z, type === 'dumpster' ? facing : type === 'barrier' ? facing + Math.PI / 2 : rnd() * 6.28);
        if ((type === 'box' || type === 'crate') && rnd() < 0.4) put(type, x + (rnd() - 0.5) * 0.3, gy + (type === 'box' ? 0.42 : 0.75), z + (rnd() - 0.5) * 0.3, rnd() * 6.28, 0.85);
      }
    }
    // roofs: AC units and antennas on big, tall, unreachable-looking tops (only where nobody needs to ride)
    if (p.w * p.d > 30 && p.top >= 3 && rnd() < 0.5) { const lx = (rnd() - 0.5) * p.w * 0.6, lz = (rnd() - 0.5) * p.d * 0.6, x = p.cx + lx * c + lz * sn, z = p.cz - lx * sn + lz * c; if (clear(x, z) && SIM0.groundAt(W, x, z, p.top + 0.2) >= p.top - 0.01 && W.pickups.every((q) => Math.hypot(q[0] - x, q[2] - z) > 4)) put(rnd() < 0.7 ? 'ac' : 'antenna', x, p.top, z, p.yaw); }
  }
  // lamp posts just inside the perimeter corners and mid-sides
  for (const [x, z] of [[1, 1], [-1, 1], [1, -1], [-1, -1], [0, 1], [0, -1], [1, 0], [-1, 0]]) {
    const px = x * (W.half - 1.2), pz = z * (W.half - 1.2), gy = SIM0.groundAt(W, px, pz, 30);
    if (gy > -1e8 && clear(px, pz) && !solidHere(px, gy, pz)) put('lamp', px, gy, pz, Math.atan2(-px, -pz));
  }
  for (const [type, list] of Object.entries(inst)) {
    const geo = DECOR.protos[type], mat = toon('#ffffff', { vertexColors: true }), im = new T.InstancedMesh(geo, mat, list.length);
    list.forEach((m, k) => im.setMatrixAt(k, m)); im.castShadow = true; im.receiveShadow = true;
    const ol = new T.InstancedMesh(geo, outlineMat(type === 'lamp' || type === 'pipe' ? 0.02 : 0.03), list.length); list.forEach((m, k) => ol.setMatrixAt(k, m));
    root.add(im, ol);
  }
  // ground decals: manholes, drains, oil, skid marks, painted arrows, stencils, sticker bombs on walls
  const D = DECOR.decals, flat = (tex, x, y, z, s, rot, op = 1) => { const m = new T.Mesh(new T.PlaneGeometry(s, s), new T.MeshBasicMaterial({ map: tex, transparent: true, opacity: op, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 })); m.rotation.set(-Math.PI / 2, 0, rot); m.position.set(x, y + 0.015, z); root.add(m); };
  const kinds = [['manhole', 1.3, 1], ['drain', 1.2, 1], ['oil', 2.6, 1], ['oil', 2, 1], ['skid', 4, 0.9], ['skid', 3.5, 0.9], ['arrow', 2.2, 0.85], ['stencil', 3, 0.9]];
  for (let k = 0; k < 26; k++) {
    const x = (rnd() - 0.5) * W.half * 1.8, z = (rnd() - 0.5) * W.half * 1.8, gy = SIM0.groundAt(W, x, z, 30);
    if (gy < -1e8 || !clear(x, z)) continue;
    const [kind, s, op] = kinds[k % kinds.length]; flat(D[kind], x, gy, z, s * (0.8 + rnd() * 0.4), rnd() * 6.28, op);
  }
  // glossy puddles that catch the sun (floors only)
  if (W.floor) for (let k = 0; k < 7; k++) {
    const x = (rnd() - 0.5) * W.half * 1.6, z = (rnd() - 0.5) * W.half * 1.6, gy = SIM0.groundAt(W, x, z, 1);
    if (gy !== 0 || !clear(x, z)) continue;
    const m = new T.Mesh(new T.CircleGeometry(1, 24), new T.MeshPhongMaterial({ color: new T.Color(R.def.look?.sky || '#8FD3F4').multiplyScalar(0.8), specular: 0xffffff, shininess: 160, transparent: true, opacity: 0.55, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3 }));
    m.rotation.x = -Math.PI / 2; m.scale.set(1.2 + rnd() * 1.6, 0.6 + rnd() * 0.9, 1); m.rotation.z = rnd() * 3; m.position.set(x, 0.02, z); root.add(m);
  }
  // sticker bombs on tall walls
  for (const p of statics) { if (rnd() > 0.25 || p.w < 2 || p.top - p.y0 < 2) continue; const m = new T.Mesh(new T.PlaneGeometry(1.4, 1.4), new T.MeshBasicMaterial({ map: D.sticker, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3 })); const c = Math.cos(p.yaw), sn = Math.sin(p.yaw), lx = (rnd() - 0.5) * (p.w - 1.5), lz = p.d / 2 + 0.02; m.position.set(p.cx + lx * c + lz * sn, p.y0 + 1.1 + rnd() * 0.6, p.cz - lx * sn + lz * c); m.rotation.y = p.yaw; root.add(m); }
}
// toon clouds + sun disc around the sky dome (they follow the camera with the dome)
function addSky(root, look) {
  const T = THREE, rnd = mulberry(7), g = new T.Group();
  for (let k = 0; k < 16; k++) {
    const a = rnd() * Math.PI * 2, d = 230 + rnd() * 120, s = 40 + rnd() * 50;
    const sp = new T.Sprite(new T.SpriteMaterial({ map: DECOR.cloud, transparent: true, depthWrite: false, fog: false, opacity: 0.92 }));
    sp.position.set(Math.cos(a) * d, 60 + rnd() * 70, Math.sin(a) * d); sp.scale.set(s, s / 2, 1); g.add(sp);
  }
  const sd = look.sun || [0.5, 0.8, 0.3], sun = new T.Sprite(new T.SpriteMaterial({ color: '#FFF4C8', transparent: true, depthWrite: false, fog: false, map: GFX.tex.smoke }));
  const v = new T.Vector3(...sd).normalize().multiplyScalar(330); sun.position.copy(v); sun.scale.set(70, 70, 1); g.add(sun);
  root.add(g); GFX.skyDeco = g;
}

// big wall murals: original bubble-letter pieces with fills, 3D drop, highlights, drips and a mascot eyeball
const MURAL_WORDS = ['GRIND', 'WRECK', 'SLAM', 'RIOT', 'GNARLY', 'BAIL', 'SHRED', 'HOUSE', 'KICK', 'RUSH'];
function muralTex(seed) {
  const r = mulberry(seed * 977 + 13), W = 1024, H = 512, cv = document.createElement('canvas'); cv.width = W; cv.height = H; const g = cv.getContext('2d');
  const pal = [['#B4E64A', '#36DCE8', '#22292B'], ['#FF5C69', '#FF9B36', '#22292B'], ['#9D75EA', '#36DCE8', '#22292B'], ['#FF9B36', '#E2B13C', '#22292B'], ['#36DCE8', '#B4E64A', '#22292B']][seed % 5];
  // backdrop blob + stars + spray haze
  g.fillStyle = pal[1]; g.globalAlpha = 0.85; g.beginPath(); for (let k = 0; k <= 24; k++) { const a = k / 24 * Math.PI * 2, rr = 0.42 + r() * 0.06; g.lineTo(W / 2 + Math.cos(a) * W * rr, H / 2 + Math.sin(a) * H * (rr + 0.02)); } g.fill(); g.globalAlpha = 1;
  for (let k = 0; k < 40; k++) { g.fillStyle = `rgba(255,255,255,${0.05 + r() * 0.1})`; g.beginPath(); g.arc(r() * W, r() * H, 10 + r() * 40, 0, 7); g.fill(); }
  const word = MURAL_WORDS[seed % MURAL_WORDS.length];
  g.save(); g.translate(W / 2, H / 2 + 20); g.rotate((r() - 0.5) * 0.16);
  g.font = `900 ${Math.floor(W / (word.length * 0.6))}px Impact, 'Arial Black', sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round';
  for (let k = 14; k > 0; k -= 2) { g.fillStyle = pal[2]; g.fillText(word, k, k); } // 3D drop
  g.lineWidth = 26; g.strokeStyle = pal[2]; g.strokeText(word, 0, 0);
  const gr = g.createLinearGradient(0, -90, 0, 90); gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.25, pal[0]); gr.addColorStop(1, pal[1]); g.fillStyle = gr; g.fillText(word, 0, 0);
  g.lineWidth = 5; g.strokeStyle = 'rgba(255,255,255,.75)'; g.strokeText(word, -4, -5);
  g.restore();
  // drips
  g.fillStyle = pal[0]; for (let k = 0; k < 14; k++) { const x = W * 0.15 + r() * W * 0.7, y = H * 0.62 + r() * 30, l = 20 + r() * 80; g.fillRect(x, y, 6, l); g.beginPath(); g.arc(x + 3, y + l, 5, 0, 7); g.fill(); }
  // mascot eyeball with a bandage
  const ex = W * (r() < 0.5 ? 0.12 : 0.88), ey = H * 0.25; g.fillStyle = '#22292B'; g.beginPath(); g.arc(ex, ey, 62, 0, 7); g.fill(); g.fillStyle = '#F4EEDC'; g.beginPath(); g.arc(ex, ey, 54, 0, 7); g.fill(); g.fillStyle = pal[0]; g.beginPath(); g.arc(ex + 10, ey + 6, 24, 0, 7); g.fill(); g.fillStyle = '#22292B'; g.beginPath(); g.arc(ex + 14, ey + 8, 11, 0, 7); g.fill(); g.fillStyle = '#FF5C69'; g.save(); g.translate(ex - 20, ey - 40); g.rotate(-0.5); g.fillRect(-30, -8, 60, 16); g.restore();
  for (let k = 0; k < 6; k++) { g.save(); g.translate(r() * W, r() * H); g.fillStyle = pal[2]; g.beginPath(); for (let j = 0; j < 10; j++) { const a = j * Math.PI / 5, rr = j % 2 ? 7 : 18; g.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); } g.fill(); g.restore(); }
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}
function addMurals(root, W) {
  const T = THREE, rnd = mulberry(W.half * 71 + W.prims.length * 3);
  const walls = [];
  for (const p of W.prims) {
    if (p.type !== 'box' || p.gone || p.vx || p.vz || p.mat === 'gate' || p.mat === 'glass' || p.mat === 'fence' || p.mat === 'container') continue;
    const h = p.top - p.y0; if (h < 2.2) continue;
    for (const [len, side] of [[p.w, 0], [p.w, 1], [p.d, 2], [p.d, 3]]) if (len >= 7) walls.push({ p, len, side, h });
  }
  walls.sort((a, b) => b.len * b.h - a.len * a.h);
  let n = 0;
  for (const w of walls) {
    if (n >= 5) break; if (rnd() < 0.35) continue;
    const { p, len, side, h } = w, mw = Math.min(len * 0.8, 11), mh = Math.min(h * 0.85, mw / 2);
    const m = new T.Mesh(new T.PlaneGeometry(mw, mh), new T.MeshBasicMaterial({ map: muralTex(n + W.prims.length), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3 }));
    const alongX = side < 2, lx = alongX ? (rnd() - 0.5) * (len - mw) * 0.6 : (side === 2 ? 1 : -1) * (p.w / 2 + 0.03), lz = alongX ? (side === 0 ? 1 : -1) * (p.d / 2 + 0.03) : (rnd() - 0.5) * (len - mw) * 0.6;
    // only paint faces that look inward (toward the arena centre), where players see them
    const c = Math.cos(p.yaw), sn = Math.sin(p.yaw), wx = p.cx + lx * c + lz * sn, wz = p.cz - lx * sn + lz * c;
    const nxw = alongX ? (side === 0 ? sn : -sn) : (side === 2 ? c : -c), nzw = alongX ? (side === 0 ? c : -c) : (side === 2 ? -sn : sn);
    if (nxw * -wx + nzw * -wz < 0) continue;
    m.position.set(wx, p.y0 + Math.min(h, mh + 0.4) / 2 + 0.25, wz);
    m.rotation.y = p.yaw + (alongX ? (side === 0 ? 0 : Math.PI) : (side === 2 ? Math.PI / 2 : -Math.PI / 2));
    root.add(m); n++;
  }
}
// painted skate ledges: low boxes get a coloured top trim (classic skatepark curb paint)
function addLedgeTrim(root, W, dyn) {
  const T = THREE, cols = ['#E2B13C', '#FF5C69', '#36DCE8', '#B4E64A'], parts = [];
  W.prims.forEach((p, i) => {
    if (dyn.has(i) || p.type !== 'box' || p.top - p.y0 > 1.3 || p.top < 0.25 || p.w * p.d > 60) return;
    const col = cols[i % cols.length];
    for (const [lx, lz, w, d] of [[0, p.d / 2, p.w + 0.04, 0.14], [0, -p.d / 2, p.w + 0.04, 0.14], [p.w / 2, 0, 0.14, p.d + 0.04], [-p.w / 2, 0, 0.14, p.d + 0.04]])
      parts.push({ g: new T.BoxGeometry(w, 0.07, d), c: col, m: new T.Matrix4().compose(new T.Vector3(p.cx + lx * Math.cos(p.yaw) + lz * Math.sin(p.yaw), p.top + 0.02, p.cz - lx * Math.sin(p.yaw) + lz * Math.cos(p.yaw)), new T.Quaternion().setFromAxisAngle(new T.Vector3(0, 1, 0), p.yaw), new T.Vector3(1, 1, 1)) });
  });
  if (!parts.length) return;
  const m = new T.Mesh(mergeParts(parts), toon('#ffffff', { vertexColors: true })); m.receiveShadow = true; root.add(m);
}
