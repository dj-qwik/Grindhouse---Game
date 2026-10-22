// ───────────────────────── TEXTURES: high-detail procedural surfaces + normal maps ─────────────────────────
// Every surface is drawn at 512 px on a canvas (≈160 px per metre in the arena) with a matching height layer that
// becomes a normal map, so cracks, mortar lines, plank seams, tread plate and ribs catch the toon light without
// leaving the cel-shaded look. Seeded randomness: the same arena always looks the same.
const TEX_HI = {};
function texRng(seed) { let a = seed * 9301 + 49297; return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
// draw(c, h, R, S): c = colour context (white-based, tinted by the material colour), h = height context (grey: 0.5 = flat)
function hiTexture(kind, draw, seed = 1) {
  const S = 512;
  const cc = document.createElement('canvas'), hc = document.createElement('canvas'); cc.width = cc.height = hc.width = hc.height = S;
  const c = cc.getContext('2d'), h = hc.getContext('2d'), R = texRng(seed);
  c.fillStyle = '#fff'; c.fillRect(0, 0, S, S); h.fillStyle = '#808080'; h.fillRect(0, 0, S, S);
  draw(c, h, R, S);
  const T = THREE, map = new T.CanvasTexture(cc); map.wrapS = map.wrapT = T.RepeatWrapping; map.colorSpace = T.SRGBColorSpace; map.anisotropy = 8;
  const nrm = new T.CanvasTexture(normalFrom(hc, 3.2)); nrm.wrapS = nrm.wrapT = T.RepeatWrapping; nrm.anisotropy = 8;
  TEX_HI[kind] = { map, nrm };
  return TEX_HI[kind];
}
// Sobel → tangent-space normal map (wraps at the edges so tiles stay seamless)
function normalFrom(hc, k) {
  const S = hc.width, src = hc.getContext('2d').getImageData(0, 0, S, S).data, out = document.createElement('canvas'); out.width = out.height = S;
  const og = out.getContext('2d'), od = og.createImageData(S, S), H = (x, y) => src[(((y + S) % S) * S + ((x + S) % S)) * 4] / 255;
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const dx = (H(x + 1, y - 1) + 2 * H(x + 1, y) + H(x + 1, y + 1) - H(x - 1, y - 1) - 2 * H(x - 1, y) - H(x - 1, y + 1)) * k;
    const dy = (H(x - 1, y + 1) + 2 * H(x, y + 1) + H(x + 1, y + 1) - H(x - 1, y - 1) - 2 * H(x, y - 1) - H(x + 1, y - 1)) * k;
    const l = Math.hypot(dx, dy, 1), i = (y * S + x) * 4;
    od.data[i] = (-dx / l * 0.5 + 0.5) * 255; od.data[i + 1] = (dy / l * 0.5 + 0.5) * 255; od.data[i + 2] = (1 / l * 0.5 + 0.5) * 255; od.data[i + 3] = 255;
  }
  og.putImageData(od, 0, 0); return out;
}
// helpers
function speck(g, R, S, n, col, a, s0 = 0.6, s1 = 2) { g.fillStyle = col; for (let i = 0; i < n; i++) { g.globalAlpha = a * (0.3 + R() * 0.7); const s = s0 + R() * (s1 - s0); g.fillRect(R() * S, R() * S, s, s); } g.globalAlpha = 1; }
function blotch(g, R, S, n, col, a, r0, r1) { for (let i = 0; i < n; i++) { const x = R() * S, y = R() * S, r = r0 + R() * (r1 - r0); const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, col.replace('A', a)); gr.addColorStop(1, col.replace('A', 0)); g.fillStyle = gr; g.beginPath(); g.ellipse(x, y, r, r * (0.5 + R() * 0.8), R() * 3, 0, 7); g.fill(); } }
function crack(c, h, R, x, y, len, w = 1.6) {
  c.strokeStyle = 'rgba(30,26,22,.5)'; h.strokeStyle = '#303030'; c.lineWidth = w; h.lineWidth = w + 1.2; c.lineCap = h.lineCap = 'round';
  let a = R() * 6.28;
  c.beginPath(); h.beginPath(); c.moveTo(x, y); h.moveTo(x, y);
  for (let i = 0; i < len; i++) { a += (R() - 0.5) * 1.1; x += Math.cos(a) * 9; y += Math.sin(a) * 9; c.lineTo(x, y); h.lineTo(x, y); if (R() < 0.12) crack(c, h, R, x, y, Math.floor(len / 3), w * 0.6); }
  c.stroke(); h.stroke();
}
function streaks(c, R, S, n, col, a) { for (let i = 0; i < n; i++) { const x = R() * S, w = 3 + R() * 14, len = S * (0.2 + R() * 0.7); const gr = c.createLinearGradient(0, 0, 0, len); gr.addColorStop(0, col.replace('A', a)); gr.addColorStop(1, col.replace('A', 0)); c.fillStyle = gr; c.fillRect(x, 0, w, len); } }

const HI_DRAW = {
  concrete: (c, h, R, S) => { // poured slab: warm/cool mottling, aggregate, one saw-cut joint per slab, repairs, cracks, tyre marks
    blotch(c, R, S, 10, 'rgba(150,120,80,A)', 0.14, 60, 160); blotch(c, R, S, 8, 'rgba(90,110,130,A)', 0.1, 60, 150);
    speck(c, R, S, 6000, '#000', 0.13); speck(c, R, S, 2000, '#fff', 0.28); speck(h, R, S, 3000, '#666', 0.5);
    blotch(c, R, S, 6, 'rgba(70,55,35,A)', 0.14, 20, 60); blotch(c, R, S, 3, 'rgba(20,20,25,A)', 0.2, 15, 40);
    c.fillStyle = 'rgba(25,22,20,.5)'; c.fillRect(0, 0, 4, S); c.fillRect(0, 0, S, 4); h.fillStyle = '#1a1a1a'; h.fillRect(0, 0, 5, S); h.fillRect(0, 0, S, 5);
    for (let i = 0; i < 1; i++) { const x = R() * S * 0.7, y = R() * S * 0.7, w = 60 + R() * 90, hh = 40 + R() * 70; c.fillStyle = 'rgba(120,110,95,.12)'; c.fillRect(x, y, w, hh); c.strokeStyle = 'rgba(40,35,30,.35)'; c.lineWidth = 2; c.strokeRect(x, y, w, hh); h.strokeStyle = '#555'; h.lineWidth = 2; h.strokeRect(x, y, w, hh); }
    for (let i = 0; i < 3; i++) crack(c, h, R, R() * S, R() * S, 10 + R() * 14);
    c.strokeStyle = 'rgba(20,18,18,.14)'; c.lineWidth = 8; for (let i = 0; i < 3; i++) { c.beginPath(); const y = R() * S; c.moveTo(0, y); c.bezierCurveTo(S * 0.3, y + R() * 140 - 70, S * 0.7, y + R() * 140 - 70, S, y + R() * 60 - 30); c.stroke(); }
    c.strokeStyle = 'rgba(30,30,30,.25)'; c.lineWidth = 3; for (let i = 0; i < 4; i++) { const x = R() * S, y = R() * S; c.beginPath(); c.arc(x, y, 30 + R() * 50, R() * 3, R() * 3 + 1.4); c.stroke(); } // wheel scuffs
  },
  wall: (c, h, R, S) => { // cast-in-place wall: form panels, tie holes, rain streaks, grime at the base
    speck(c, R, S, 3500, '#000', 0.1); speck(h, R, S, 2000, '#707070', 0.4);
    c.fillStyle = 'rgba(0,0,0,.18)'; h.fillStyle = '#383838';
    for (let x = 0; x <= S; x += S / 2) { c.fillRect(x - 1, 0, 3, S); h.fillRect(x - 2, 0, 4, S); }
    for (let y = 0; y <= S; y += S / 2) { c.fillRect(0, y - 1, S, 3); h.fillRect(0, y - 2, S, 4); }
    for (let x = S / 8; x < S; x += S / 4) for (let y = S / 8; y < S; y += S / 4) { c.fillStyle = 'rgba(30,25,20,.5)'; c.beginPath(); c.arc(x, y, 5, 0, 7); c.fill(); h.fillStyle = '#202020'; h.beginPath(); h.arc(x, y, 6, 0, 7); h.fill(); }
    streaks(c, R, S, 18, 'rgba(60,50,40,A)', 0.22);
    for (let i = 0; i < 2; i++) crack(c, h, R, R() * S, R() * S, 8 + R() * 8);
  },
  stairs: (c, h, R, S) => { speck(c, R, S, 3000, '#000', 0.1); for (let k = 0; k < 4; k++) { const y = k * S / 4; c.fillStyle = 'rgba(0,0,0,.35)'; c.fillRect(0, y, S, 10); c.fillStyle = 'rgba(255,214,70,.75)'; c.fillRect(0, y + 10, S, 7); h.fillStyle = '#202020'; h.fillRect(0, y, S, 10); h.fillStyle = '#c0c0c0'; h.fillRect(0, y + 10, S, 8); } blotch(c, R, S, 8, 'rgba(50,40,30,A)', 0.15, 15, 40); },
  wood: (c, h, R, S) => { // deck planks: grain, knots, nail heads, worn edges
    const n = 8, pw = S / n;
    for (let k = 0; k < n; k++) {
      const y = k * pw, tone = 0.85 + R() * 0.3;
      c.fillStyle = `rgba(${Math.floor(120 * tone)},${Math.floor(80 * tone)},${Math.floor(40 * tone)},.25)`; c.fillRect(0, y, S, pw);
      for (let j = 0; j < 26; j++) { c.strokeStyle = `rgba(70,40,15,${0.08 + R() * 0.12})`; c.lineWidth = 1 + R() * 1.5; c.beginPath(); const yy = y + R() * pw; c.moveTo(0, yy); c.bezierCurveTo(S * 0.3, yy + R() * 6 - 3, S * 0.6, yy + R() * 6 - 3, S, yy + R() * 4 - 2); c.stroke(); }
      if (R() < 0.7) { const kx = R() * S, ky = y + pw * (0.3 + R() * 0.4); c.fillStyle = 'rgba(60,30,10,.55)'; c.beginPath(); c.ellipse(kx, ky, 9, 5, 0, 0, 7); c.fill(); h.fillStyle = '#606060'; h.beginPath(); h.ellipse(kx, ky, 9, 5, 0, 0, 7); h.fill(); }
      c.fillStyle = 'rgba(30,15,5,.75)'; c.fillRect(0, y, S, 3); h.fillStyle = '#101010'; h.fillRect(0, y - 1, S, 5);
      const seam = R() * S; c.fillRect(seam, y, 3, pw); h.fillRect(seam - 1, y, 5, pw);
      for (const nx of [seam - 14, seam + 14]) for (const ny of [y + 10, y + pw - 10]) { c.fillStyle = 'rgba(40,40,45,.8)'; c.beginPath(); c.arc(nx, ny, 3, 0, 7); c.fill(); h.fillStyle = '#d0d0d0'; h.beginPath(); h.arc(nx, ny, 3, 0, 7); h.fill(); }
    }
    speck(c, R, S, 1500, '#000', 0.08);
  },
  tread: (c, h, R, S) => { // diamond tread plate, scuffed
    speck(c, R, S, 2500, '#000', 0.1);
    for (let x = 0; x < S; x += 32) for (let y = 0; y < S; y += 32) for (const [ox, oy, a] of [[8, 8, 0.6], [24, 24, -0.6]]) {
      c.save(); c.translate(x + ox, y + oy); c.rotate(a); c.fillStyle = 'rgba(255,255,255,.35)'; c.fillRect(-9, -2.5, 18, 5); c.fillStyle = 'rgba(0,0,0,.3)'; c.fillRect(-9, 2.5, 18, 2); c.restore();
      h.save(); h.translate(x + ox, y + oy); h.rotate(a); h.fillStyle = '#e0e0e0'; h.fillRect(-9, -3, 18, 6); h.restore();
    }
    blotch(c, R, S, 6, 'rgba(120,60,20,A)', 0.25, 20, 60); blotch(c, R, S, 4, 'rgba(10,10,10,A)', 0.2, 20, 50);
  },
  hazard: (c, h, R, S) => { c.fillStyle = '#22292B'; for (let k = -S; k < S * 2; k += 64) { c.beginPath(); c.moveTo(k, 0); c.lineTo(k + 32, 0); c.lineTo(k + 32 - S, S); c.lineTo(k - S, S); c.fill(); } speck(c, R, S, 2500, '#000', 0.15); speck(c, R, S, 800, '#fff', 0.25); blotch(c, R, S, 6, 'rgba(60,40,20,A)', 0.3, 15, 50); for (let i = 0; i < 40; i++) { c.fillStyle = 'rgba(180,170,150,.6)'; c.fillRect(R() * S, R() * S, 2 + R() * 10, 1 + R() * 3); } },
  ribs: (c, h, R, S) => { // shipping container corrugation, rust bloom, stencil
    for (let x = 0; x < S; x += 32) { const g = c.createLinearGradient(x, 0, x + 32, 0); g.addColorStop(0, 'rgba(0,0,0,.28)'); g.addColorStop(0.35, 'rgba(255,255,255,.3)'); g.addColorStop(0.7, 'rgba(0,0,0,.05)'); g.addColorStop(1, 'rgba(0,0,0,.3)'); c.fillStyle = g; c.fillRect(x, 0, 32, S); const gh = h.createLinearGradient(x, 0, x + 32, 0); gh.addColorStop(0, '#404040'); gh.addColorStop(0.5, '#c0c0c0'); gh.addColorStop(1, '#404040'); h.fillStyle = gh; h.fillRect(x, 0, 32, S); }
    blotch(c, R, S, 10, 'rgba(140,60,20,A)', 0.45, 8, 40); streaks(c, R, S, 12, 'rgba(120,55,20,A)', 0.3);
    c.font = '900 46px Impact, sans-serif'; c.fillStyle = 'rgba(255,255,255,.55)'; c.fillText('GHSU ' + Math.floor(100000 + R() * 899999), 40, 120); c.font = '900 22px Impact, sans-serif'; c.fillText('MAX GROSS 30,480 KG', 40, 150);
  },
  brick: (c, h, R, S) => {
    const bw = 64, bh = 24;
    for (let y = 0; y < S; y += bh) for (let x = ((y / bh) % 2) * (bw / 2) - bw; x < S; x += bw) {
      const t = 0.8 + R() * 0.4; c.fillStyle = `rgba(${Math.floor(170 * t)},${Math.floor(70 * t)},${Math.floor(45 * t)},.35)`; c.fillRect(x + 2, y + 2, bw - 4, bh - 4);
      h.fillStyle = `rgb(${150 + R() * 40 | 0},${150 + R() * 40 | 0},${150 + R() * 40 | 0})`; h.fillRect(x + 3, y + 3, bw - 6, bh - 6);
      if (R() < 0.15) { c.fillStyle = 'rgba(40,20,10,.3)'; c.fillRect(x + 4 + R() * 30, y + 4, 10, 6); }
    }
    c.globalCompositeOperation = 'destination-over'; c.fillStyle = '#d9d0c0'; c.fillRect(0, 0, S, S); c.globalCompositeOperation = 'source-over';
    speck(c, R, S, 3000, '#000', 0.12); streaks(c, R, S, 10, 'rgba(30,30,30,A)', 0.18);
  },
  asphalt: (c, h, R, S) => { speck(c, R, S, 9000, '#000', 0.3, 0.6, 2.4); speck(c, R, S, 3000, '#fff', 0.35); speck(h, R, S, 5000, '#5a5a5a', 0.6); blotch(c, R, S, 5, 'rgba(10,10,15,A)', 0.25, 20, 60); for (let i = 0; i < 3; i++) crack(c, h, R, R() * S, R() * S, 14); c.strokeStyle = 'rgba(15,15,15,.35)'; c.lineWidth = 5; for (let i = 0; i < 2; i++) { c.beginPath(); c.moveTo(R() * S, 0); c.lineTo(R() * S, S); c.stroke(); } },
  speckle: (c, h, R, S) => { speck(c, R, S, 7000, '#000', 0.14, 0.6, 3); speck(h, R, S, 5000, '#505050', 0.5, 0.6, 3); speck(c, R, S, 2000, '#fff', 0.2); blotch(c, R, S, 8, 'rgba(0,0,0,A)', 0.08, 20, 70); },
  rust: (c, h, R, S) => { speck(c, R, S, 3000, '#000', 0.12); blotch(c, R, S, 22, 'rgba(150,60,20,A)', 0.5, 8, 45); blotch(c, R, S, 12, 'rgba(40,30,25,A)', 0.3, 8, 30); speck(h, R, S, 4000, '#606060', 0.6, 1, 4); for (let i = 0; i < 8; i++) { c.strokeStyle = 'rgba(30,30,30,.4)'; c.lineWidth = 2; const x = R() * S, y = R() * S; c.beginPath(); c.moveTo(x, y); c.lineTo(x + R() * 80 - 40, y + R() * 80 - 40); c.stroke(); } },
  tile: (c, h, R, S) => { const n = 8, t = S / n; for (let x = 0; x < n; x++) for (let y = 0; y < n; y++) { const k = 0.9 + R() * 0.15; c.fillStyle = `rgba(0,0,0,${0.05 * k})`; c.fillRect(x * t + 2, y * t + 2, t - 4, t - 4); if (R() < 0.08) crack(c, h, R, x * t + t / 2, y * t + t / 2, 3, 1); } c.fillStyle = 'rgba(60,55,50,.6)'; h.fillStyle = '#303030'; for (let k = 0; k <= n; k++) { c.fillRect(k * t - 1, 0, 3, S); c.fillRect(0, k * t - 1, S, 3); h.fillRect(k * t - 2, 0, 4, S); h.fillRect(0, k * t - 2, S, 4); } blotch(c, R, S, 6, 'rgba(60,50,30,A)', 0.1, 20, 60); },
  belt: (c, h, R, S) => { c.fillStyle = 'rgba(0,0,0,.55)'; c.fillRect(0, 0, S, S); for (let y = 0; y < S; y += 32) { c.fillStyle = 'rgba(255,255,255,.12)'; c.fillRect(0, y, S, 12); h.fillStyle = '#d0d0d0'; h.fillRect(0, y, S, 12); } c.fillStyle = '#FF9B36'; c.fillRect(0, 0, 18, S); c.fillRect(S - 18, 0, 18, S); for (let y = 8; y < S; y += 64) { c.fillStyle = '#22292B'; c.beginPath(); c.moveTo(4, y); c.lineTo(14, y + 12); c.lineTo(4, y + 24); c.fill(); } },
  neon: (c, h, R, S) => { c.fillStyle = 'rgba(0,0,0,.6)'; c.fillRect(0, 0, S, S); ['#FF5C69', '#36DCE8', '#B4E64A', '#FF9B36'].forEach((col, k) => { c.shadowColor = col; c.shadowBlur = 18; c.strokeStyle = col; c.lineWidth = 7; c.beginPath(); c.moveTo(30, 60 + k * 110); c.lineTo(S - 30, 60 + k * 110 + (k % 2 ? 20 : -20)); c.stroke(); }); c.shadowBlur = 0; c.font = '900 64px Impact'; c.fillStyle = '#B4E64A'; c.fillText('OPEN 24', 120, 300); },
  roof: (c, h, R, S) => { // tar paper roof: seams, gravel, patched squares
    speck(c, R, S, 8000, '#000', 0.22, 0.6, 2.5); speck(c, R, S, 2000, '#fff', 0.25); speck(h, R, S, 6000, '#4a4a4a', 0.6);
    for (let y = 0; y < S; y += S / 4) { c.fillStyle = 'rgba(0,0,0,.4)'; c.fillRect(0, y, S, 4); h.fillStyle = '#c0c0c0'; h.fillRect(0, y, S, 8); }
    for (let i = 0; i < 4; i++) { c.fillStyle = 'rgba(30,30,30,.35)'; const x = R() * S, y = R() * S; c.fillRect(x, y, 40 + R() * 60, 30 + R() * 40); }
    blotch(c, R, S, 4, 'rgba(60,90,110,A)', 0.15, 30, 70);
  },
  fence: (c, h, R, S) => { c.clearRect(0, 0, S, S); c.strokeStyle = '#fff'; c.lineWidth = 4; for (let k = -S; k < S * 2; k += 32) { c.beginPath(); c.moveTo(k, 0); c.lineTo(k + S, S); c.moveTo(k + S, 0); c.lineTo(k, S); c.stroke(); } h.fillStyle = '#808080'; },
};
const HI_SEED = { concrete: 3, wall: 5, stairs: 7, wood: 11, tread: 13, hazard: 17, ribs: 19, brick: 23, asphalt: 29, speckle: 31, rust: 37, tile: 41, belt: 43, neon: 47, roof: 53, fence: 59 };
function buildHiTextures() { for (const [k, fn] of Object.entries(HI_DRAW)) { const t = hiTexture(k, fn, HI_SEED[k] || 1); GFX.tex[k] = t.map; GFX.nrm[k] = k === 'fence' || k === 'neon' ? null : t.nrm; } }

// macro variation: a big soft dirt/sun-bleach map repeated only every ~45 m (applied through the AO slot, which has
// its own UV transform), so large surfaces stop looking tiled
function buildMacro() {
  const S = 512, cv = document.createElement('canvas'); cv.width = cv.height = S; const g = cv.getContext('2d'), R = texRng(99);
  g.fillStyle = '#ffffff'; g.fillRect(0, 0, S, S);
  blotch(g, R, S, 40, 'rgba(110,100,90,A)', 0.35, 30, 120);
  blotch(g, R, S, 18, 'rgba(255,255,255,A)', 0.5, 40, 140);
  blotch(g, R, S, 24, 'rgba(60,55,50,A)', 0.25, 10, 50);
  const t = new THREE.CanvasTexture(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(0.07, 0.07); GFX.macro = t;
}
