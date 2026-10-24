// ───────────────────────── GRIME & LIFE: lived-in detail (render only — never touches physics) ─────────────────────────
// Cracks, gum, mud and paint on the ground; drip stains and wheat-pasted posters on walls; wax and scuffs on the
// ledges people actually grind; weeds at wall bases; litter; and pigeons that scatter when a skater rolls by.
const GRIME = { protos: {}, tex: {}, birds: [] };
function buildGrime() {
  const T = THREE, P = GRIME.protos, X = GRIME.tex;
  const tuft = (cols, n, h) => mergeParts(Array.from({ length: n }, (_, k) => { const a = k / n * 6.28 + k, r = 0.04 + (k % 3) * 0.03; return { g: new T.ConeGeometry(0.025, h * (0.7 + (k % 4) * 0.15), 4), c: cols[k % cols.length], m: M4(Math.cos(a) * r, h * 0.4, Math.sin(a) * r, Math.sin(a) * 0.35, 0, Math.cos(a) * 0.35) }; }));
  P.weed = tuft(['#5E8F2E', '#7BA83A', '#4C7A26', '#8DB847'], 9, 0.34);
  P.grass = mergeParts([...Array.from({ length: 12 }, (_, k) => { const a = k * 2.4, r = 0.05 + (k % 4) * 0.04; return { g: new T.ConeGeometry(0.02, 0.18 + (k % 3) * 0.06, 3), c: ['#6E9A34', '#88B04A', '#5A8228'][k % 3], m: M4(Math.cos(a) * r, 0.1, Math.sin(a) * r, Math.sin(a) * 0.3, 0, Math.cos(a) * 0.3) }; }), { g: new T.SphereGeometry(0.035, 6, 4), c: '#F2D24B', m: M4(0.04, 0.26, 0) }]);
  P.can = mergeParts([{ g: new T.CylinderGeometry(0.033, 0.033, 0.12, 10), c: '#C9373F', m: M4(0, 0.033, 0, 0, 0, Math.PI / 2) }, { g: new T.CylinderGeometry(0.034, 0.034, 0.02, 10), c: '#C9D3D6', m: M4(0.055, 0.033, 0, 0, 0, Math.PI / 2) }]);
  P.can2 = mergeParts([{ g: new T.CylinderGeometry(0.033, 0.033, 0.12, 10), c: '#36A7C9', m: M4(0, 0.033, 0, 0, 0, Math.PI / 2) }, { g: new T.CylinderGeometry(0.034, 0.034, 0.02, 10), c: '#C9D3D6', m: M4(0.055, 0.033, 0, 0, 0, Math.PI / 2) }]);
  P.cup = mergeParts([{ g: new T.CylinderGeometry(0.045, 0.035, 0.13, 10), c: '#F4EEDC', m: M4(0, 0.042, 0, 0, 0, Math.PI / 2 - 0.15) }, { g: new T.CylinderGeometry(0.046, 0.042, 0.03, 10), c: '#FF5C69', m: M4(0.02, 0.044, 0, 0, 0, Math.PI / 2 - 0.15) }]);
  P.paper = mergeParts([{ g: new T.IcosahedronGeometry(0.06, 0), c: '#EDE6D2', m: M4(0, 0.045, 0, 0.3, 0.5, 0.2, 1, 0.75, 1) }]);
  P.sheet = mergeParts([{ g: new T.BoxGeometry(0.21, 0.004, 0.29), c: '#F1ECDF', m: M4(0, 0.004, 0, 0.03, 0, 0.05) }, { g: new T.BoxGeometry(0.15, 0.005, 0.02), c: '#9AA4A8', m: M4(0, 0.006, -0.08) }]);
  P.bag = mergeParts([{ g: new T.BoxGeometry(0.16, 0.025, 0.22), c: '#FF9B36', m: M4(0, 0.014, 0, 0.1, 0, 0.12) }, { g: new T.BoxGeometry(0.1, 0.027, 0.06), c: '#E2B13C', m: M4(0, 0.016, 0.03, 0.1, 0, 0.12) }]);
  P.butts = mergeParts([[0, 0], [0.05, 0.03], [-0.03, 0.05], [0.02, -0.05]].map(([x, z], k) => ({ g: new T.CylinderGeometry(0.008, 0.008, 0.045, 5), c: k % 2 ? '#E8C27A' : '#F1ECDF', m: M4(x, 0.008, z, 0, k, Math.PI / 2) })));
  P.pigeon = mergeParts([
    { g: new T.SphereGeometry(0.11, 10, 8), c: '#8C939B', m: M4(0, 0.13, 0, 0, 0, 0, 1, 0.82, 1.4) },
    { g: new T.SphereGeometry(0.07, 8, 6), c: '#6E757D', m: M4(0, 0.21, 0.12, 0, 0, 0, 1, 1, 1) },
    { g: new T.TorusGeometry(0.05, 0.018, 4, 10), c: '#5E8F7A', m: M4(0, 0.19, 0.1, Math.PI / 2.6) },
    { g: new T.ConeGeometry(0.018, 0.05, 5), c: '#E2B13C', m: M4(0, 0.215, 0.2, Math.PI / 2) },
    { g: new T.BoxGeometry(0.1, 0.02, 0.12), c: '#5A6168', m: M4(0, 0.13, -0.17, -0.3) },
    { g: new T.BoxGeometry(0.2, 0.025, 0.12), c: '#7A828A', m: M4(0, 0.17, -0.02, 0.05) }, // folded wings
    { g: new T.CylinderGeometry(0.008, 0.008, 0.07, 4), c: '#C9575E', m: M4(0.035, 0.035, 0) }, { g: new T.CylinderGeometry(0.008, 0.008, 0.07, 4), c: '#C9575E', m: M4(-0.035, 0.035, 0) },
  ]);
  // ── textures
  const R = Math.random;
  X.crack = decalTex((g, S) => { g.strokeStyle = 'rgba(30,26,22,.55)'; g.lineCap = 'round'; const br = (x, y, a, len, w, d) => { if (d > 4 || len < 6) return; const x2 = x + Math.cos(a) * len, y2 = y + Math.sin(a) * len; g.lineWidth = w; g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo((x + x2) / 2 + (R() - 0.5) * 14, (y + y2) / 2 + (R() - 0.5) * 14, x2, y2); g.stroke(); br(x2, y2, a + (R() - 0.5) * 0.9, len * 0.75, w * 0.7, d + 1); if (R() < 0.6) br(x2, y2, a + (R() < 0.5 ? 1 : -1) * (0.5 + R() * 0.6), len * 0.55, w * 0.6, d + 1); }; br(S * 0.1, S * 0.5, -0.1, 50, 4, 0); br(S * 0.1, S * 0.5, 3.1, 30, 3, 2); });
  X.gum = decalTex((g, S) => { for (let k = 0; k < 26; k++) { const x = R() * S, y = R() * S, r = 3 + R() * 7; g.fillStyle = `rgba(${40 + R() * 30},${40 + R() * 30},${45 + R() * 30},${0.45 + R() * 0.3})`; g.beginPath(); g.ellipse(x, y, r, r * (0.7 + R() * 0.3), R() * 3, 0, 7); g.fill(); } });
  X.mud = decalTex((g, S) => { for (let k = 0; k < 14; k++) { const x = S / 2 + (R() - 0.5) * S * 0.5, y = S / 2 + (R() - 0.5) * S * 0.5, r = S * (0.06 + R() * 0.14); const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, 'rgba(70,52,30,.32)'); gr.addColorStop(1, 'rgba(70,52,30,0)'); g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); } });
  X.splat = decalTex((g, S) => { const cols = ['#B4E64A', '#36DCE8', '#FF5C69', '#FF9B36', '#9D75EA', '#F4EEDC']; g.fillStyle = cols[Math.floor(R() * cols.length)]; g.globalAlpha = 0.75; g.beginPath(); g.arc(S / 2, S / 2, S * 0.16, 0, 7); g.fill(); for (let k = 0; k < 14; k++) { const a = R() * 6.28, d = S * (0.16 + R() * 0.26), r = S * (0.012 + R() * 0.04); g.beginPath(); g.arc(S / 2 + Math.cos(a) * d, S / 2 + Math.sin(a) * d, r, 0, 7); g.fill(); g.lineWidth = r; g.strokeStyle = g.fillStyle; g.beginPath(); g.moveTo(S / 2 + Math.cos(a) * S * 0.12, S / 2 + Math.sin(a) * S * 0.12); g.lineTo(S / 2 + Math.cos(a) * d, S / 2 + Math.sin(a) * d); g.stroke(); } });
  X.drip = decalTex((g, S) => { for (let k = 0; k < 18; k++) { const x = R() * S, w = 4 + R() * 14, len = S * (0.3 + R() * 0.7); const gr = g.createLinearGradient(0, 0, 0, len); gr.addColorStop(0, 'rgba(25,22,20,.6)'); gr.addColorStop(1, 'rgba(25,22,20,0)'); g.fillStyle = gr; g.fillRect(x, 0, w, len); g.beginPath(); g.arc(x + w / 2, len * 0.85, w * 0.6, 0, 7); g.fill(); } const top = g.createLinearGradient(0, 0, 0, S * 0.12); top.addColorStop(0, 'rgba(25,22,20,.35)'); top.addColorStop(1, 'rgba(25,22,20,0)'); g.fillStyle = top; g.fillRect(0, 0, S, S * 0.12); });
  X.posters = [0, 1, 2, 3].map((v) => decalTex((g, S) => {
    const pal = [['#F4EEDC', '#FF5C69', '#22292B'], ['#22292B', '#B4E64A', '#F4EEDC'], ['#E2B13C', '#22292B', '#FF5C69'], ['#36DCE8', '#22292B', '#F4EEDC']][v];
    g.fillStyle = pal[0]; g.beginPath(); g.moveTo(S * 0.08, S * 0.04); for (let k = 0; k <= 10; k++) g.lineTo(S * (0.08 + k * 0.084), S * (0.04 + (k % 2) * 0.012)); g.lineTo(S * 0.92, S * 0.96); for (let k = 10; k >= 0; k--) g.lineTo(S * (0.08 + k * 0.084), S * (0.96 - (k % 2) * 0.015)); g.closePath(); g.fill();
    g.fillStyle = pal[1]; g.font = `900 ${S * 0.16}px Impact, sans-serif`; g.textAlign = 'center'; g.fillText(['SKATE', 'SHOW', 'LIVE!', 'RIOT'][v], S / 2, S * 0.3);
    g.fillRect(S * 0.2, S * 0.38, S * 0.6, S * 0.26); g.fillStyle = pal[2]; for (let k = 0; k < 5; k++) g.fillRect(S * 0.16, S * (0.7 + k * 0.045), S * (0.4 + R() * 0.28), S * 0.018);
    g.fillStyle = 'rgba(0,0,0,.14)'; for (let k = 0; k < 40; k++) g.fillRect(R() * S, R() * S, 2 + R() * 6, 1 + R() * 3); // grime + tears
    g.fillStyle = 'rgba(255,255,255,0)'; g.globalCompositeOperation = 'destination-out'; for (let k = 0; k < 3; k++) { g.beginPath(); g.moveTo(R() * S, S * 0.96); g.lineTo(R() * S, S * (0.75 + R() * 0.15)); g.lineTo(R() * S, S * 0.96); g.fill(); } g.globalCompositeOperation = 'source-over';
  }));
  X.wax = decalTex((g, S) => { for (let k = 0; k < 30; k++) { const y = S * (0.3 + R() * 0.4), x = R() * S, len = S * (0.2 + R() * 0.6); g.strokeStyle = `rgba(20,18,16,${0.12 + R() * 0.25})`; g.lineWidth = 2 + R() * 7; g.beginPath(); g.moveTo(x, y); g.lineTo(x + len, y + (R() - 0.5) * 6); g.stroke(); } });
  for (const t of [X.wax, X.drip]) { t.wrapS = THREE.RepeatWrapping; }
}
// decal quads are batched: one merged mesh (one draw call) per texture
let GRIME_BATCH = null;
function grimeQuad(tex, op, m4, w, h, ru = 1, wall = false) {
  const key = tex.uuid + ':' + op + ':' + wall; let B = GRIME_BATCH.get(key); if (!B) { B = { tex, op, wall, pos: [], uv: [] }; GRIME_BATCH.set(key, B); }
  const T = THREE, c = [[-w / 2, -h / 2, 0, 0], [w / 2, -h / 2, ru, 0], [w / 2, h / 2, ru, 1], [-w / 2, h / 2, 0, 1]].map(([x, y, u, v]) => [new T.Vector3(x, y, 0).applyMatrix4(m4), u, v]);
  for (const k of [0, 1, 2, 0, 2, 3]) { const [p, u, v] = c[k]; B.pos.push(p.x, p.y, p.z); B.uv.push(u, v); }
}
function grimeFlat(root, tex, x, y, z, w, h, rot, op = 1, ru = 1) { grimeQuad(tex, op, new THREE.Matrix4().compose(new THREE.Vector3(x, y + 0.012, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, rot)), new THREE.Vector3(1, 1, 1)), w, h, ru); }
function grimeWall(root, tex, x, y, z, w, h, yaw, op = 1, tilt = 0) { grimeQuad(tex, op, new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, yaw, tilt)), new THREE.Vector3(1, 1, 1)), w, h, 1, true); }
function flushGrime(root) {
  const T = THREE;
  for (const B of GRIME_BATCH.values()) {
    const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(B.pos, 3)); g.setAttribute('uv', new T.Float32BufferAttribute(B.uv, 2));
    const off = B.wall ? -3 : -2, m = new T.Mesh(g, new T.MeshBasicMaterial({ map: B.tex, transparent: true, opacity: B.op, depthWrite: false, polygonOffset: true, polygonOffsetFactor: off, polygonOffsetUnits: off }));
    m.frustumCulled = false; root.add(m);
  }
  GRIME_BATCH = null;
}
function placeGrime(root, R) {
  if (!GRIME.tex.crack) buildGrime();
  GRIME_BATCH = new Map();
  const T = THREE, W = R.W, X = GRIME.tex, rnd = mulberry(W.half * 977 + W.prims.length * 13 + (W.variant || 0) * 7 + 5);
  const keep = [];
  for (const s of W.spawns) keep.push([s[0], s[1], 2.5]);
  for (const p of W.pickups) keep.push([p[0], p[2], 1.8]);
  const clear = (x, z, r = 0) => keep.every(([kx, kz, kr]) => Math.hypot(x - kx, z - kz) > kr + r);
  const inst = {}; const put = (type, x, y, z, ry = rnd() * 6.28, s = 1) => { (inst[type] || (inst[type] = [])).push(M4(x, y, z, 0, ry, 0, s)); };
  const statics = W.prims.filter((p) => p.type === 'box' && !p.gone && !(p.vx || p.vz) && p.mat !== 'gate' && p.mat !== 'fence' && p.mat !== 'glass');
  const sides = (p) => [[0, p.d / 2, p.w, 0, 1], [0, -p.d / 2, p.w, 0, -1], [p.w / 2, 0, p.d, 1, 0], [-p.w / 2, 0, p.d, -1, 0]];
  const toW = (p, lx, lz) => [p.cx + lx * Math.cos(p.yaw) + lz * Math.sin(p.yaw), p.cz - lx * Math.sin(p.yaw) + lz * Math.cos(p.yaw)];
  // ── ground: cracks, gum, mud, paint splats (more of them where people ride)
  const floorKinds = [[X.crack, 2.4, 0.9], [X.crack, 3.2, 0.8], [X.gum, 1.6, 0.85], [X.mud, 3.5, 0.9], [X.mud, 2.6, 0.8], [X.splat, 1.3, 0.85], [X.crack, 1.8, 0.8]];
  for (let k = 0; k < 140; k++) {
    const x = (rnd() - 0.5) * W.half * 1.9, z = (rnd() - 0.5) * W.half * 1.9, gy = SIM0.groundAt(W, x, z, 40);
    if (gy < -1e8 || !clear(x, z)) continue;
    const [tex, s, op] = floorKinds[k % floorKinds.length]; grimeFlat(root, tex, x, gy, z, s * (0.7 + rnd() * 0.6), s * (0.7 + rnd() * 0.6), rnd() * 6.28, op);
    if (tex === X.crack && rnd() < 0.5) put(rnd() < 0.5 ? 'weed' : 'grass', x + (rnd() - 0.5) * 0.8, gy, z + (rnd() - 0.5) * 0.8, rnd() * 6.28, 0.7 + rnd() * 0.5); // weeds in the cracks
  }
  // ── walls: drip stains from the tops, wheat-pasted posters at eye height, weeds + litter along the base
  for (const p of statics) {
    const h = p.top - Math.max(p.y0, 0);
    for (const [sx, sz, len, nx, nz] of sides(p)) {
      if (len < 1.2) continue;
      const yaw = p.yaw + Math.atan2(nx, nz); // plane faces outward
      const [ox, oz] = toW(p, sx + nx * 0.02, sz + nz * 0.02);
      const outer = SIM0.groundAt(W, ...toW(p, sx + nx * 0.5, sz + nz * 0.5), p.top + 0.1); // floor in front of this face
      if (outer < -1e8 || outer > p.top - 0.3) continue; // outside the arena, or flush against something: not a visible face
      if (h >= 2.2 && rnd() < 0.7) { // drips
        const dw = Math.min(len - 0.2, 1.5 + rnd() * 3), dh = Math.min(h - 0.1, 1.2 + rnd() * 2), u = (rnd() - 0.5) * Math.max(0, len - dw);
        const [x, z] = toW(p, sx + (nz !== 0 ? u : 0) + nx * 0.025, sz + (nx !== 0 ? u : 0) + nz * 0.025);
        grimeWall(root, X.drip, x, p.top - dh / 2 - 0.02, z, dw, dh, yaw, 0.9);
      }
      if (h >= 2.4 && len >= 2.5 && rnd() < 0.3) { // posters (1–3, overlapping, slightly crooked)
        const n = Math.min(1 + Math.floor(rnd() * 3), Math.floor((len - 0.4) / 0.85)), u0 = (rnd() - 0.5) * Math.max(0, len - n * 0.85 - 0.4);
        for (let k = 0; k < n; k++) { const u = u0 + (k - (n - 1) / 2) * 0.82; if (Math.abs(u) + 0.45 > len / 2) continue; const [x, z] = toW(p, sx + (nz !== 0 ? u : 0) + nx * (0.03 + k * 0.004), sz + (nx !== 0 ? u : 0) + nz * (0.03 + k * 0.004)); grimeWall(root, X.posters[Math.floor(rnd() * 4)], x, Math.max(p.y0, 0) + 1.55 + (rnd() - 0.5) * 0.25, z, 0.8, 1.1, yaw, 1, (rnd() - 0.5) * 0.12); }
      }
      // base: weeds every so often, litter collecting against the wall
      const steps = Math.floor(len / 1.6), base = Math.max(p.y0, 0);
      for (let k = 0; k < steps; k++) {
        const u = ((k + 0.5) / steps - 0.5) * len, [x, z] = toW(p, sx + (nz !== 0 ? u : 0) + nx * 0.18, sz + (nx !== 0 ? u : 0) + nz * 0.18);
        if (!clear(x, z)) continue;
        const gy = SIM0.groundAt(W, x, z, base + 0.3); if (gy < -1e8 || Math.abs(gy - base) > 0.25) continue;
        const r = rnd();
        if (r < 0.28) put(rnd() < 0.6 ? 'weed' : 'grass', x, gy, z, rnd() * 6.28, 0.7 + rnd() * 0.6);
        else if (r < 0.5) put(['can', 'can2', 'cup', 'paper', 'sheet', 'bag', 'butts', 'paper'][Math.floor(rnd() * 8)], x + nx * rnd() * 0.3, gy, z + nz * rnd() * 0.3);
      }
    }
  }
  // ── litter blown around the open ground
  for (let k = 0; k < 60; k++) {
    const x = (rnd() - 0.5) * W.half * 1.8, z = (rnd() - 0.5) * W.half * 1.8, gy = SIM0.groundAt(W, x, z, 40);
    if (gy < -1e8 || !clear(x, z, 0.5)) continue;
    put(['sheet', 'paper', 'can', 'cup', 'bag', 'can2', 'butts', 'sheet'][k % 8], x, gy, z);
  }
  // ── ledges people grind: dark wax and scuffs along the edge lines (low boxes and authored ledges)
  for (const r of [...(W.edges || []), ...W.rails.filter((q) => q.kind === 'ledge' || q.kind === 'coping')]) {
    for (const g of r.seg) {
      if (g.a[1] > 2.2 || g.l < 1 || Math.abs(g.uy) > 0.2 || rnd() < 0.35) continue;
      const mx = (g.a[0] + g.b[0]) / 2, mz = (g.a[2] + g.b[2]) / 2;
      grimeFlat(root, X.wax, mx, (g.a[1] + g.b[1]) / 2 - 0.004, mz, g.l * 0.95, 0.26, -Math.atan2(g.uz, g.ux), 0.85, Math.max(1, g.l / 2));
    }
  }
  flushGrime(root);
  for (const [type, list] of Object.entries(inst)) {
    const im = new T.InstancedMesh(GRIME.protos[type], toon('#ffffff', { vertexColors: true }), list.length);
    list.forEach((m, k) => im.setMatrixAt(k, m)); im.receiveShadow = true; im.castShadow = type === 'weed'; root.add(im);
  }
  // ── pigeons: small flocks pecking around open ground; they scatter when a skater gets close
  GRIME.birds = [];
  const flocks = 3 + Math.floor(rnd() * 2);
  for (let f = 0; f < flocks; f++) {
    let cx = 0, cz = 0, gy = -1e9, tries = 0;
    do { cx = (rnd() - 0.5) * W.half * 1.6; cz = (rnd() - 0.5) * W.half * 1.6; gy = SIM0.groundAt(W, cx, cz, 40); tries++; } while ((gy < -1e8 || !clear(cx, cz, 2)) && tries < 20);
    if (gy < -1e8) continue;
    const n = 3 + Math.floor(rnd() * 4);
    for (let k = 0; k < n; k++) {
      const x = cx + (rnd() - 0.5) * 2.4, z = cz + (rnd() - 0.5) * 2.4, y = SIM0.groundAt(W, x, z, gy + 0.5); if (y < -1e8) continue;
      const m = new T.Mesh(GRIME.protos.pigeon, toon('#ffffff', { vertexColors: true })); withOutline(m, 0.012);
      m.position.set(x, y, z); m.rotation.y = rnd() * 6.28; root.add(m);
      GRIME.birds.push({ m, home: new T.Vector3(x, y, z), state: 'idle', t: rnd() * 5, vx: 0, vy: 0, vz: 0, away: 0, phase: rnd() * 6 });
    }
  }
}
// per frame: peck, shuffle, and flee from skaters (flap off, vanish, come back later)
function updateGrime(R, dt) {
  for (const b of GRIME.birds) {
    const m = b.m;
    if (b.state === 'idle') {
      b.t += dt;
      const peck = Math.max(0, Math.sin(b.t * 3 + b.phase)); m.rotation.x = peck > 0.85 ? 0.45 : 0; // head down to peck
      if (Math.sin(b.t * 0.7 + b.phase) > 0.995) m.rotation.y += (Math.random() - 0.5) * 1.5; // turn
      for (const s of R.sk) {
        if (!s.alive) continue;
        if (Math.hypot(s.x - m.position.x, s.z - m.position.z) < 4.5 && Math.abs(s.y - m.position.y) < 3) {
          b.state = 'fly'; const a = Math.atan2(m.position.x - s.x, m.position.z - s.z) + (Math.random() - 0.5) * 0.8;
          b.vx = Math.sin(a) * 5; b.vz = Math.cos(a) * 5; b.vy = 4 + Math.random() * 2; m.rotation.set(-0.5, a, 0); b.away = 0;
          if (Math.random() < 0.4) playSfx('flick', m.position.x, m.position.y, m.position.z, 0.35);
          break;
        }
      }
    } else if (b.state === 'fly') {
      b.away += dt; m.position.x += b.vx * dt; m.position.y += b.vy * dt; m.position.z += b.vz * dt; b.vy = Math.max(1.5, b.vy - dt * 2);
      m.scale.y = 0.8 + Math.abs(Math.sin(b.away * 28)) * 0.4; // flapping
      if (b.away > 3.5) { b.state = 'gone'; m.visible = false; b.away = 0; }
    } else if (b.state === 'gone') {
      b.away += dt;
      if (b.away > 18 && R.sk.every((s) => !s.alive || Math.hypot(s.x - b.home.x, s.z - b.home.z) > 9)) { b.state = 'idle'; m.visible = true; m.position.copy(b.home); m.rotation.set(0, Math.random() * 6.28, 0); m.scale.set(1, 1, 1); }
    }
  }
}
