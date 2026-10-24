// ───────────────────────── RENDER: Three.js, cel-shaded, dirty-bright (bible §11) ─────────────────────────
// Toon materials with a 3-tone ramp, ink contour lines on hard edges, inverted-hull outlines on characters and
// props, hard directional sun with shadows, saturated accents over warm cement. Arena meshes are built from the
// same primitive data the physics uses, so what you see is what you collide with.
const GFX = { r: null, scene: null, cam: null, sun: null, hemi: null, ramp: null, tex: {}, nrm: {}, mats: {}, arena: null, built: null, w: 1, h: 1, quality: 1, clock: 0, fpsAvg: 60 };
const INK = 0x22292b;
const MAT_COLORS = {
  concrete: '#B7B0A0', wall: '#A39B88', wood: '#B07A45', plank: '#A8743F', metal: '#7D8B91', container: '#B85435', crate: '#9A6A3A',
  gate: '#E2B13C', stairs: '#ADA593', brick: '#A5513A', roof: '#6E7273', asphalt: '#45494C', sand: '#D9C38E', scrap: '#7A5A44',
  car: '#C9473E', tile: '#D8D2C2', fence: '#8E9AA0', neon: '#2B2140', bleacher: '#3E6FB0', conveyor: '#33393B', press: '#E2B13C',
  glass: '#9ED7E8', grass: '#6DA544', water: '#36A7C9',
};
const TEX_OF = { concrete: 'concrete', wall: 'wall', stairs: 'stairs', wood: 'wood', plank: 'wood', crate: 'wood', metal: 'tread', press: 'hazard', gate: 'hazard', roof: 'roof',
  container: 'ribs', brick: 'brick', asphalt: 'asphalt', sand: 'speckle', scrap: 'rust', car: 'rust', tile: 'tile', conveyor: 'belt', bleacher: 'ribs', grass: 'speckle', fence: 'fence', neon: 'neon' };

function initRender() {
  const T = THREE;
  const r = new T.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  r.setPixelRatio(Math.min(devicePixelRatio || 1, SETTINGS.quality === 'high' ? 2 : SETTINGS.quality === 'low' ? 1 : 1.5)); // start at the auto target: no resize on the first frame
  r.shadowMap.enabled = true; r.shadowMap.type = T.PCFSoftShadowMap;
  r.outputColorSpace = T.SRGBColorSpace;
  r.toneMapping = T.NoToneMapping;
  $('#stage').appendChild(r.domElement);
  GFX.r = r;
  GFX.scene = new T.Scene();
  GFX.cam = new T.PerspectiveCamera(74, 1, 0.08, 600);
  GFX.cam2 = new T.PerspectiveCamera(55, 300 / 180, 0.1, 200); // picture-in-picture finishing vignette
  GFX.hemi = new T.HemisphereLight(0xcfe8ff, 0x9a8a70, 1.5); GFX.scene.add(GFX.hemi);
  GFX.sun = new T.DirectionalLight(0xfff1d6, 2.4); GFX.sun.castShadow = true;
  GFX.sun.shadow.mapSize.set(2048, 2048); const sc = GFX.sun.shadow.camera; sc.left = sc.bottom = -45; sc.right = sc.top = 45; sc.near = 1; sc.far = 220;
  GFX.sun.shadow.bias = -0.0006; GFX.sun.shadow.normalBias = 0.02;
  GFX.scene.add(GFX.sun, GFX.sun.target);
  // the toon ramp: three hard tones
  const ramp = new Uint8Array([128, 196, 255, 255]);
  GFX.ramp = new T.DataTexture(ramp, 4, 1, T.RedFormat); GFX.ramp.minFilter = GFX.ramp.magFilter = T.NearestFilter; GFX.ramp.needsUpdate = true;
  for (const k of ['concrete', 'stairs', 'wood', 'tread', 'hazard', 'ribs', 'brick', 'asphalt', 'speckle', 'rust', 'tile', 'belt', 'fence', 'neon', 'blood', 'water', 'graffiti0', 'graffiti1', 'graffiti2', 'graffiti3', 'graffiti4', 'graffiti5', 'smoke', 'spark', 'deck0', 'deck1', 'deck2']) GFX.tex[k] = makeTex(k);
  buildHiTextures(); buildMacro(); buildDecor();
  addEventListener('resize', resize); resize();
}
function resize() {
  const w = innerWidth, h = innerHeight; GFX.w = w; GFX.h = h;
  GFX.r.setSize(w, h, false); GFX.cam.aspect = w / h; GFX.cam.updateProjectionMatrix();
}
function toon(color, opts = {}) {
  const key = color + JSON.stringify(opts, (k, v) => (v && v.isTexture ? v.uuid : v));
  if (GFX.mats[key]) return GFX.mats[key];
  const m = new THREE.MeshToonMaterial({ color: new THREE.Color(color), gradientMap: GFX.ramp, ...opts });
  return (GFX.mats[key] = m);
}
// inverted hull outline: a back-face copy pushed out along normals
const OUTLINE = {};
function outlineMat(w = 0.03, color = INK) {
  const k = w + ':' + color; if (OUTLINE[k]) return OUTLINE[k];
  const m = new THREE.MeshBasicMaterial({ color, side: THREE.BackSide });
  m.onBeforeCompile = (sh) => { sh.vertexShader = sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>\n transformed += normal * ${w.toFixed(4)};`); };
  return (OUTLINE[k] = m);
}
function withOutline(mesh, w = 0.03) {
  const o = new THREE.Mesh(mesh.geometry, outlineMat(w)); o.castShadow = false; o.receiveShadow = false; o.renderOrder = -1;
  mesh.add(o); return mesh;
}

// ───────────── procedural textures (canvas): original graphic language, grime not noise soup
function makeTex(kind) {
  const T = THREE, S = kind.startsWith('graffiti') ? 256 : kind === 'blood' ? 128 : 128;
  const c = document.createElement('canvas'); c.width = c.height = S; const g = c.getContext('2d');
  const R = (a, b) => a + Math.random() * (b - a);
  const speck = (n, col, a, s0 = 0.5, s1 = 1.6) => { g.fillStyle = col; for (let i = 0; i < n; i++) { g.globalAlpha = R(a * 0.4, a); g.fillRect(R(0, S), R(0, S), R(s0, s1), R(s0, s1)); } g.globalAlpha = 1; };
  const base = (col) => { g.fillStyle = col; g.fillRect(0, 0, S, S); };
  switch (kind) {
    case 'concrete': base('#ffffff'); speck(900, '#000', 0.09); speck(300, '#fff', 0.2);
      g.strokeStyle = 'rgba(0,0,0,.18)'; g.lineWidth = 1; for (let k = 0; k < 3; k++) { g.beginPath(); let x = R(0, S), y = R(0, S); g.moveTo(x, y); for (let j = 0; j < 6; j++) { x += R(-14, 14); y += R(-14, 14); g.lineTo(x, y); } g.stroke(); }
      g.fillStyle = 'rgba(60,40,20,.07)'; for (let k = 0; k < 4; k++) { g.beginPath(); g.ellipse(R(0, S), R(0, S), R(8, 30), R(4, 14), R(0, 3), 0, 7); g.fill(); }
      g.strokeStyle = 'rgba(0,0,0,.22)'; g.lineWidth = 2; g.strokeRect(0, 0, S, S); break;
    case 'stairs': base('#fff'); speck(500, '#000', 0.08); for (let k = 0; k < 4; k++) { g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(0, k * S / 4, S, 4); g.fillStyle = 'rgba(255,255,255,.4)'; g.fillRect(0, k * S / 4 + 4, S, 2); } break;
    case 'wood': base('#fff'); for (let k = 0; k < 6; k++) { g.fillStyle = `rgba(0,0,0,${R(0.02, 0.1)})`; g.fillRect(0, k * S / 6, S, S / 6); g.fillStyle = 'rgba(40,20,0,.35)'; g.fillRect(0, k * S / 6, S, 2); for (let j = 0; j < 5; j++) { g.fillStyle = 'rgba(60,30,0,.12)'; g.fillRect(R(0, S), k * S / 6 + R(3, S / 6 - 3), R(10, 50), 1); } g.fillStyle = 'rgba(30,20,10,.6)'; g.fillRect(R(0, S), k * S / 6 + 4, 3, 3); } break;
    case 'tread': base('#fff'); speck(300, '#000', 0.08); g.strokeStyle = 'rgba(0,0,0,.22)'; g.lineWidth = 3; for (let x = 0; x < S; x += 16) for (let y = 0; y < S; y += 16) { g.beginPath(); g.moveTo(x + 3, y + 3 + ((x / 16) % 2) * 8); g.lineTo(x + 11, y + 9 + ((x / 16) % 2) * 8 - 6); g.stroke(); } break;
    case 'hazard': base('#fff'); g.fillStyle = '#22292B'; for (let k = -S; k < S * 2; k += 32) { g.beginPath(); g.moveTo(k, 0); g.lineTo(k + 16, 0); g.lineTo(k + 16 - S, S); g.lineTo(k - S, S); g.fill(); } speck(400, '#000', 0.15); break;
    case 'ribs': base('#fff'); for (let x = 0; x < S; x += 16) { g.fillStyle = 'rgba(0,0,0,.22)'; g.fillRect(x, 0, 4, S); g.fillStyle = 'rgba(255,255,255,.35)'; g.fillRect(x + 5, 0, 2, S); }
      g.fillStyle = 'rgba(120,50,20,.35)'; for (let k = 0; k < 7; k++) { g.beginPath(); g.ellipse(R(0, S), R(0, S), R(4, 18), R(6, 26), 0, 0, 7); g.fill(); } break;
    case 'brick': base('#fff'); g.fillStyle = 'rgba(0,0,0,.28)'; for (let y = 0; y < S; y += 16) { g.fillRect(0, y, S, 3); for (let x = (y / 16) % 2 ? 16 : 0; x < S; x += 32) g.fillRect(x, y, 3, 16); } speck(500, '#000', 0.12); break;
    case 'asphalt': base('#fff'); speck(1400, '#000', 0.25, 0.5, 2); speck(500, '#fff', 0.35, 0.5, 1.5); break;
    case 'speckle': base('#fff'); speck(1200, '#000', 0.12, 0.5, 2.5); break;
    case 'rust': base('#fff'); speck(300, '#000', 0.06); for (let k = 0; k < 10; k++) { g.fillStyle = 'rgba(110,70,40,.12)'; g.fillRect(R(0, S), 0, R(2, 8), R(S * 0.3, S)); } break; // weathered paint (low-detail fallback)
    case 'tile': base('#fff'); g.strokeStyle = 'rgba(0,0,0,.22)'; g.lineWidth = 2; for (let k = 0; k <= S; k += 32) { g.beginPath(); g.moveTo(k, 0); g.lineTo(k, S); g.moveTo(0, k); g.lineTo(S, k); g.stroke(); } speck(300, '#000', 0.08); break;
    case 'belt': base('#fff'); g.fillStyle = 'rgba(0,0,0,.45)'; for (let y = 0; y < S; y += 16) g.fillRect(0, y, S, 6); g.fillStyle = '#FF9B36'; g.fillRect(0, 0, 6, S); g.fillRect(S - 6, 0, 6, S); break;
    case 'fence': g.clearRect(0, 0, S, S); g.strokeStyle = '#fff'; g.lineWidth = 3; for (let k = -S; k < S * 2; k += 16) { g.beginPath(); g.moveTo(k, 0); g.lineTo(k + S, S); g.moveTo(k + S, 0); g.lineTo(k, S); g.stroke(); } break;
    case 'neon': base('#fff'); g.fillStyle = 'rgba(0,0,0,.6)'; g.fillRect(0, 0, S, S); ['#FF5C69', '#36DCE8', '#B4E64A'].forEach((c2, k) => { g.fillStyle = c2; g.fillRect(0, 20 + k * 36, S, 7); }); break;
    case 'blood': g.clearRect(0, 0, S, S); g.fillStyle = '#fff'; g.beginPath(); g.arc(S / 2, S / 2, S * 0.22, 0, 7); g.fill();
      for (let k = 0; k < 14; k++) { const a = R(0, 7), d = R(S * 0.2, S * 0.45), r2 = R(3, 10); g.beginPath(); g.arc(S / 2 + Math.cos(a) * d, S / 2 + Math.sin(a) * d, r2, 0, 7); g.fill(); g.lineWidth = r2 * 0.8; g.strokeStyle = '#fff'; g.beginPath(); g.moveTo(S / 2, S / 2); g.lineTo(S / 2 + Math.cos(a) * d * 0.9, S / 2 + Math.sin(a) * d * 0.9); g.stroke(); } break;
    case 'water': base('#fff'); g.strokeStyle = 'rgba(255,255,255,.9)'; g.lineWidth = 2; for (let k = 0; k < 18; k++) { const x = R(0, S), y = R(0, S); g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + 8, y - 4, x + 16, y); g.stroke(); } g.globalCompositeOperation = 'destination-over'; g.fillStyle = '#9fdcef'; g.fillRect(0, 0, S, S); break;
    case 'smoke': { const gr = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.6, 'rgba(255,255,255,.6)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.beginPath(); g.arc(S / 2, S / 2, S / 2, 0, 7); g.fill(); break; }
    case 'spark': { g.clearRect(0, 0, S, S); g.fillStyle = '#fff'; g.beginPath(); for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4, r2 = k % 2 ? S * 0.16 : S * 0.5; g.lineTo(S / 2 + Math.cos(a) * r2, S / 2 + Math.sin(a) * r2); } g.fill(); break; }
    default:
      if (kind.startsWith('graffiti')) { drawTag(g, S, +kind.slice(-1)); break; }
      if (kind.startsWith('deck')) { base('#fff'); const cols = ['#FF5C69', '#36DCE8', '#B4E64A', '#FF9B36', '#9D75EA']; for (let k = 0; k < 5; k++) { g.fillStyle = cols[(k + +kind.slice(-1)) % 5]; g.beginPath(); g.arc(R(0, S), R(0, S), R(10, 40), 0, 7); g.fill(); } g.fillStyle = '#22292B'; g.font = 'bold 40px Impact'; g.fillText('GH', 20, 80); break; }
      base('#fff');
  }
  const t = new T.CanvasTexture(c); t.wrapS = t.wrapT = T.RepeatWrapping; t.colorSpace = T.SRGBColorSpace; t.anisotropy = 4;
  return t;
}
// original tag shapes: chunky blob letters with outlines, drips and stars
function drawTag(g, S, seed) {
  const cols = [['#B4E64A', '#22292B'], ['#FF5C69', '#E8DDBD'], ['#36DCE8', '#22292B'], ['#FF9B36', '#22292B'], ['#9D75EA', '#E8DDBD'], ['#E8DDBD', '#FF5C69']][seed % 6];
  const words = ['GRIND', 'SLAM', 'RIOT', 'SK8', 'WRECK', 'RUST', 'GNAR', 'HOUSE', 'ZAP', 'DROP'];
  g.clearRect(0, 0, S, S);
  g.save(); g.translate(S / 2, S / 2); g.rotate((seed % 3 - 1) * 0.12);
  const w = words[(seed * 7 + 3) % words.length];
  g.font = `900 ${Math.floor(S / (w.length * 0.62))}px Impact, 'Arial Black', sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.lineJoin = 'round'; g.lineWidth = 16; g.strokeStyle = cols[1]; g.strokeText(w, 0, 0);
  g.fillStyle = cols[0]; g.fillText(w, 0, 0);
  g.fillStyle = cols[0]; for (let k = 0; k < 5; k++) { const x = (k - 2) * S / 7 + (seed % 5) * 3; g.fillRect(x, S * 0.12, 4, S * (0.06 + ((seed + k) % 4) * 0.04)); }
  g.fillStyle = cols[1]; g.beginPath(); for (let k = 0; k < 10; k++) { const a = k * Math.PI / 5, r = k % 2 ? 8 : 20; g.lineTo(S * 0.36 + Math.cos(a) * r, -S * 0.26 + Math.sin(a) * r); } g.fill();
  g.restore();
}

// ───────────── arena meshes from primitives
// A closed solid extruded across local x from a profile [(z, y)] along local z, solid down to y0.
function prismGeo(p) {
  const prof = [];
  if (p.type === 'box') prof.push([-p.d / 2, p.top], [p.d / 2, p.top]);
  else if (p.type === 'slope') prof.push([-p.d / 2, p.h0], [p.d / 2, p.h1]);
  else { const n = 14; for (let k = 0; k <= n; k++) { const z = -p.d / 2 + p.d * k / n; prof.push([z, surfLocal(p, z)]); } }
  const y0 = p.y0, hw = p.w / 2, S = 4.2, pos = [], uv = [], col = [];
  // grime: walls darken toward their base (dirt, splash-back) and slightly under their top edge (rain drip)
  const top = Math.max(...prof.map((q) => q[1]));
  const shade = (v, side) => { if (!side) return 1; const u = Math.max(0, Math.min(1, (v[1] - y0) / 1.6)), e = Math.max(0, Math.min(1, (top - v[1]) / 0.35)); return (0.58 + 0.42 * u) * (0.86 + 0.14 * e); };
  let SIDE = false;
  const tri = (a, b, c, ua, ub, uc) => { pos.push(...a, ...b, ...c); uv.push(...ua, ...ub, ...uc); for (const v of [a, b, c]) { const k = shade(v, SIDE); col.push(k, k, k); } };
  const quad = (a, b, c, d, ua, ub, uc, ud) => { tri(a, b, c, ua, ub, uc); tri(a, c, d, ua, uc, ud); };
  let s = 0;
  for (let k = 0; k + 1 < prof.length; k++) { // top surface
    const [z0, h0] = prof[k], [z1, h1] = prof[k + 1], ds = Math.hypot(z1 - z0, h1 - h0);
    SIDE = false; quad([-hw, h0, z0], [hw, h0, z0], [hw, h1, z1], [-hw, h1, z1], [-hw / S, s / S], [hw / S, s / S], [hw / S, (s + ds) / S], [-hw / S, (s + ds) / S]);
    s += ds; SIDE = true;
    for (const x of [-hw, hw]) quad([x, y0, z0], [x, y0, z1], [x, h1, z1], [x, h0, z0], [z0 / S, y0 / S], [z1 / S, y0 / S], [z1 / S, h1 / S], [z0 / S, h0 / S]);
  }
  const f = prof[0], b = prof[prof.length - 1];
  SIDE = true;
  if (f[1] > y0 + 1e-3) quad([-hw, y0, f[0]], [hw, y0, f[0]], [hw, f[1], f[0]], [-hw, f[1], f[0]], [-hw / S, y0 / S], [hw / S, y0 / S], [hw / S, f[1] / S], [-hw / S, f[1] / S]);
  if (b[1] > y0 + 1e-3) quad([-hw, y0, b[0]], [-hw, b[1], b[0]], [hw, b[1], b[0]], [hw, y0, b[0]], [-hw / S, y0 / S], [-hw / S, b[1] / S], [hw / S, b[1] / S], [hw / S, y0 / S]);
  SIDE = false;
  if (y0 > 0.05) quad([-hw, y0, f[0]], [-hw, y0, b[0]], [hw, y0, b[0]], [hw, y0, f[0]], [0, 0], [0, 1], [1, 1], [1, 0]);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.computeVertexNormals();
  return g;
}
// Softened blocks: the same prism, but every edge gets a small 3-step bevel (≈5–8 cm) so nothing reads as a raw
// cube. Built as an ExtrudeGeometry of the inset cross-section; the collision shape is unchanged (visual only).
const ROUND_UV = {
  generateTopUV(g, v, a, b, c) { const S = 4.2; return [a, b, c].map((i) => new THREE.Vector2(v[i * 3] / S, v[i * 3 + 1] / S)); },
  generateSideWallUV(g, v, a, b, c, d) {
    const S = 4.2, horiz = Math.abs(v[a * 3] - v[b * 3]) + Math.abs(v[c * 3] - v[d * 3]) > Math.abs(v[a * 3 + 1] - v[b * 3 + 1]) + Math.abs(v[c * 3 + 1] - v[d * 3 + 1]);
    return [a, b, c, d].map((i) => new THREE.Vector2(v[i * 3 + 2] / S, (horiz ? v[i * 3] : v[i * 3 + 1]) / S));
  },
};
function roundGeo(p) {
  const T = THREE, y0 = p.y0, prof = [];
  if (p.type === 'box') prof.push([-p.d / 2, p.top], [p.d / 2, p.top]);
  else if (p.type === 'slope') prof.push([-p.d / 2, p.h0], [p.d / 2, p.h1]);
  else { const n = 14; for (let k = 0; k <= n; k++) { const z = -p.d / 2 + p.d * k / n; prof.push([z, surfLocal(p, z)]); } }
  const lo = Math.min(...prof.map((q) => q[1])), hi = Math.max(...prof.map((q) => q[1]));
  const r = Math.min(0.07, 0.18 * Math.min(p.w, p.d, Math.max(0.05, hi - y0)));
  if (r < 0.015 || p.mat === 'fence' || p.mat === 'glass') return prismGeo(p);
  // inset cross-section in (u = -z, v = y), counter-clockwise; tops come down by r, ends and base come in by r
  const zf = -p.d / 2 + r, zb = p.d / 2 - r, base = y0 + r, pts = [];
  pts.push([zf, base], [zb, base]);
  for (let k = prof.length - 1; k >= 0; k--) { const z = Math.max(zf, Math.min(zb, prof[k][0])), y = Math.max(base + 0.005, prof[k][1] - r); pts.push([z, y]); }
  const shape = new T.Shape(); pts.forEach(([z, y], k) => (k ? shape.lineTo(-z, y) : shape.moveTo(-z, y)));
  const depth = Math.max(0.01, p.w - 2 * r);
  const g = new T.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelThickness: r, bevelSize: r, bevelSegments: 3, curveSegments: 2, UVGenerator: ROUND_UV });
  g.translate(0, 0, -depth / 2); g.rotateY(Math.PI / 2);
  const ng = g.index ? g.toNonIndexed() : g; if (ng !== g) g.dispose();
  ng.computeVertexNormals();
  // grime: walls darken toward their base and just under their top edge (same as the sharp version)
  const P = ng.attributes.position, N = ng.attributes.normal, col = new Float32Array(P.count * 3);
  for (let i = 0; i < P.count; i++) {
    const y = P.getY(i), side = Math.abs(N.getY(i)) < 0.7;
    const k = side ? (0.58 + 0.42 * Math.max(0, Math.min(1, (y - y0) / 1.6))) * (0.86 + 0.14 * Math.max(0, Math.min(1, (hi - y) / 0.35))) : 1;
    col[i * 3] = col[i * 3 + 1] = col[i * 3 + 2] = k;
  }
  ng.setAttribute('color', new T.BufferAttribute(col, 3));
  return ng;
}
// outline hull: a copy of the geometry with fully smoothed normals (so the inked shell has no cracks at bevels)
function hullGeo(g) {
  const T = THREE, P = g.attributes.position, acc = new Map(), key = (i) => `${Math.round(P.getX(i) * 500)},${Math.round(P.getY(i) * 500)},${Math.round(P.getZ(i) * 500)}`;
  const N = g.attributes.normal;
  for (let i = 0; i < P.count; i++) { const k = key(i), a = acc.get(k) || [0, 0, 0]; a[0] += N.getX(i); a[1] += N.getY(i); a[2] += N.getZ(i); acc.set(k, a); }
  const n = new Float32Array(P.count * 3);
  for (let i = 0; i < P.count; i++) { const a = acc.get(key(i)), l = Math.hypot(a[0], a[1], a[2]) || 1; n[i * 3] = a[0] / l; n[i * 3 + 1] = a[1] / l; n[i * 3 + 2] = a[2] / l; }
  const h = new T.BufferGeometry(); h.setAttribute('position', P); h.setAttribute('normal', new T.BufferAttribute(n, 3)); return h;
}
function surfLocal(p, lz) { const u = Math.max(0, Math.min(p.d, lz + p.d / 2)); if (p.type === 'slope') return p.h0 + (p.h1 - p.h0) * u / p.d; if (p.type === 'box') return p.top; return p.base + p.R - Math.sqrt(p.R * p.R - u * u); }
function matFor(p, look, idx) {
  let col = MAT_COLORS[p.mat] || MAT_COLORS.concrete;
  if (p.mat === 'container' || p.mat === 'car' || p.mat === 'bleacher') col = [col, '#2F8FB0', '#5E8F2E', '#D9822B', '#7356B8'][idx % 5];
  if (p.mat === 'concrete' && look && look.ground) col = look.ground;
  // per-surface variation so big concrete areas don't read as one flat colour
  if (['concrete', 'wall', 'stairs', 'brick', 'wood', 'plank', 'roof', 'asphalt'].includes(p.mat)) { const v = idx % 3; col = '#' + new THREE.Color(col).offsetHSL(v === 1 ? 0.012 : v === 2 ? -0.01 : 0, v === 2 ? 0.05 : 0, v === 1 ? -0.035 : v === 2 ? 0.03 : 0).getHexString(); }
  // DoubleSide: every face of a block draws whichever way it was wound (no see-through walls)
  const tk = TEX_OF[p.mat], opts = { vertexColors: true, aoMap: GFX.macro, aoMapIntensity: 0.75, side: THREE.DoubleSide };
  if (tk) { opts.map = GFX.tex[tk]; if (GFX.nrm[tk]) { opts.normalMap = GFX.nrm[tk]; opts.normalScale = new THREE.Vector2(0.9, 0.9); } }
  if (p.mat === 'glass') { opts.transparent = true; opts.opacity = 0.35; }
  if (p.mat === 'fence') { opts.transparent = true; opts.alphaTest = 0.4; opts.side = THREE.DoubleSide; }
  if (p.mat === 'neon') { opts.emissive = new THREE.Color('#1a1030'); }
  return toon(col, opts);
}
const PRIM_EDGE = new Map();
function buildArena(R) {
  const T = THREE, W = R.W, look = R.def.look || {};
  if (GFX.arena) { GFX.scene.remove(GFX.arena); GFX.arena.traverse((o) => { if (o.geometry && !o.userData.shared) o.geometry.dispose(); }); }
  const root = new T.Group(); GFX.arena = root; GFX.scene.add(root);
  GFX.built = { R, prims: [], rails: [], hz: new Map(), picks: new Map(), proj: new Map(), fires: new Map(), graffiti: [] };
  // sky dome + fog
  const sky = new T.Mesh(new T.SphereGeometry(400, 24, 12), new T.ShaderMaterial({
    side: T.BackSide, depthWrite: false, fog: false,
    uniforms: { top: { value: new T.Color(look.sky || '#8FD3F4') }, hor: { value: new T.Color(look.horizon || '#F6E7C1') } },
    vertexShader: 'varying vec3 vp; void main(){ vp = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: 'uniform vec3 top; uniform vec3 hor; varying vec3 vp; void main(){ float h = clamp(vp.y*1.6+0.08,0.0,1.0); gl_FragColor = vec4(mix(hor, top, pow(h,0.7)),1.0); }',
  }));
  root.add(sky); GFX.sky = sky;
  GFX.scene.fog = new T.Fog(new T.Color(look.fog || '#E9DDBE'), 60, 210);
  const sd = look.sun || [0.5, 0.8, 0.3]; GFX.sunDir = new T.Vector3(sd[0], sd[1], sd[2]).normalize();
  GFX.hemi.color.set('#EEF3FF'); GFX.hemi.groundColor.set(look.ground || '#9a8a70');
  // ground: the arena floor, an outer apron to the horizon, or water / a long drop
  const half = W.half;
  if (W.floor) {
    const fl = new T.Mesh(new T.PlaneGeometry(half * 2, half * 2), toon(look.ground || '#B7B0A0', { map: GFX.tex.concrete, normalMap: GFX.nrm.concrete, normalScale: new T.Vector2(0.8, 0.8), aoMap: GFX.macro, aoMapIntensity: 0.75 }));
    fl.geometry.attributes.uv.array.forEach((v, k, a) => { a[k] = v * half * 2 / 4.2; });
    fl.rotation.x = -Math.PI / 2; fl.receiveShadow = true; root.add(fl);
    addFloorMarks(root, W, look);
  }
  const apron = new T.Mesh(new T.PlaneGeometry(900, 900), toon(look.water && !W.floor ? look.water : '#8C8574', look.water && !W.floor ? { map: GFX.tex.water } : { map: GFX.tex.asphalt, normalMap: GFX.nrm.asphalt }));
  apron.geometry.attributes.uv.array.forEach((v, k, a) => { a[k] = v * 120; });
  apron.rotation.x = -Math.PI / 2; apron.position.y = W.floor ? -0.05 : look.water ? W.killY + 2.5 : W.killY - 14; apron.receiveShadow = true; root.add(apron); GFX.apron = apron;
  addSkyline(root, W, look);
  // Which prims/rails ever change? Dry-run the arena's hazard timeline on a scratch copy (same build + variant)
  // so everything static can be merged into a few draw calls; moving/collapsing pieces stay separate.
  const dyn = dynamicParts(R);
  // primitives
  const groups = new Map(); // material → { pos: [], uv: [], edges: [] }
  W.prims.forEach((p, k) => {
    const mat = matFor(p, look, k);
    if (!dyn.prims.has(k)) {
      const g = roundGeo(p), m4 = new T.Matrix4().compose(new T.Vector3(p.cx, 0, p.cz), new T.Quaternion().setFromAxisAngle(new T.Vector3(0, 1, 0), p.yaw), new T.Vector3(1, 1, 1));
      g.applyMatrix4(m4);
      let G = groups.get(mat); if (!G) { G = { pos: [], uv: [], col: [], nrm: [] }; groups.set(mat, G); }
      G.pos.push(...g.attributes.position.array); G.uv.push(...g.attributes.uv.array); G.col.push(...g.attributes.color.array); G.nrm.push(...g.attributes.normal.array); g.dispose();
      return;
    }
    const g = roundGeo(p);
    const m = new T.Mesh(g, mat); m.castShadow = true; m.receiveShadow = true;
    m.position.set(p.cx, 0, p.cz); m.rotation.y = p.yaw;
    const edges = new T.Mesh(hullGeo(g), outlineMat(0.035)); edges.renderOrder = -1;
    m.add(edges);
    root.add(m);
    GFX.built.prims.push({ p, m, edges, top: p.top, y0: p.y0, w: p.w, d: p.d, h0: p.h0, h1: p.h1, gone: false, warnMat: null, baseMat: m.material });
  });
  const allLines = [];
  for (const [mat, G] of groups) {
    const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(G.pos, 3)); g.setAttribute('uv', new T.Float32BufferAttribute(G.uv, 2)); g.setAttribute('color', new T.Float32BufferAttribute(G.col, 3)); g.setAttribute('normal', new T.Float32BufferAttribute(G.nrm, 3));
    const m = new T.Mesh(g, mat); m.castShadow = true; m.receiveShadow = true; root.add(m);
    const hull = new T.Mesh(hullGeo(g), outlineMat(0.035)); hull.renderOrder = -1; root.add(hull); // inked silhouette
    const eg = new T.EdgesGeometry(g, 24); G.lines = eg.attributes.position.array; eg.dispose(); allLines.push(G.lines); // ink along the softened edges
  }
  { let n = 0; for (const a of allLines) n += a.length; const buf = new Float32Array(n); let o = 0; for (const a of allLines) { buf.set(a, o); o += a.length; }
    if (n) { const eg = new T.BufferGeometry(); eg.setAttribute('position', new T.BufferAttribute(buf, 3)); root.add(new T.LineSegments(eg, new T.LineBasicMaterial({ color: INK, transparent: true, opacity: 0.55 }))); } }
  // rails: static ones merged into one mesh + one outline; live/collapsing ones stay separate
  const railStatic = { pos: [], norm: [] };
  const addCyl = (into, a, b, rad, seg) => {
    const d = b.clone().sub(a), L = d.length(); if (L < 1e-4) return;
    const g = new T.CylinderGeometry(rad, rad, L, seg, 1, true);
    g.applyMatrix4(new T.Matrix4().compose(a.clone().add(b).multiplyScalar(0.5), new T.Quaternion().setFromUnitVectors(new T.Vector3(0, 1, 0), d.normalize()), new T.Vector3(1, 1, 1)));
    const ng = g.toNonIndexed(); into.pos.push(...ng.attributes.position.array); into.norm.push(...ng.attributes.normal.array); g.dispose(); ng.dispose();
  };
  W.rails.forEach((r, ri) => {
    const rad = r.kind === 'coping' ? 0.06 : r.kind === 'ledge' ? 0.035 : 0.05;
    const into = dyn.rails.has(ri) ? { pos: [], norm: [] } : railStatic;
    for (const sg of r.seg) {
      const a = new T.Vector3(...sg.a), b = new T.Vector3(...sg.b);
      addCyl(into, a, b, rad, 8);
      if (r.kind === 'rail' || r.kind === 'handrail') { // posts
        const n = Math.max(1, Math.floor(sg.l / 2.5));
        for (let k = 0; k <= n; k++) {
          const p = a.clone().lerp(b, k / n), gy = SIM0.groundAt(W, p.x, p.z, p.y - 0.05);
          const h = p.y - (gy > -1e8 ? gy : p.y - 1); if (h <= 0.05) continue;
          addCyl(into, new T.Vector3(p.x, p.y - h, p.z), p, 0.04, 6);
        }
      }
    }
    if (into !== railStatic) { const grp = railMesh(into); root.add(grp); GFX.built.rails.push({ r, grp, mat: grp.userData.mat }); }
  });
  if (railStatic.pos.length) root.add(railMesh(railStatic));
  addGraffiti(root, W);
  placeDecor(root, R); addSky(root, look); addMurals(root, W); addLedgeTrim(root, W, dyn.prims); placeGrime(root, R);
  // zone wall
  const zw = new T.Mesh(new T.CylinderGeometry(1, 1, 60, 64, 1, true), new T.ShaderMaterial({
    transparent: true, depthWrite: false, side: T.DoubleSide,
    uniforms: { t: { value: 0 }, col: { value: new T.Color('#FF5C69') } },
    vertexShader: 'varying vec2 vu; varying float vy; varying float vd; void main(){ vu = uv; vy = position.y; vec4 mv = modelViewMatrix * vec4(position,1.0); vd = -mv.z; gl_Position = projectionMatrix * mv; }',
    fragmentShader: 'uniform float t; uniform vec3 col; varying vec2 vu; varying float vy; varying float vd; void main(){ float s = step(0.5, fract(vu.x*90.0 + vy*0.15 - t*0.6)); float fade = clamp(1.0 - (vy+30.0)/18.0, 0.0, 1.0) * smoothstep(1.5, 16.0, vd); gl_FragColor = vec4(col, (0.07 + 0.17*s) * fade); }',
  }));
  zw.position.y = 30; zw.renderOrder = 5; root.add(zw); GFX.zoneWall = zw;
  // decals pool (blood, scorch)
  GFX.decals = []; GFX.decalI = 0;
  for (let k = 0; k < 30; k++) {
    const d = new T.Mesh(new T.PlaneGeometry(1, 1), new T.MeshBasicMaterial({ map: GFX.tex.blood, color: 0xd1102a, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4 }));
    d.rotation.x = -Math.PI / 2; d.visible = false; d.userData.shared = true; root.add(d); GFX.decals.push(d);
  }
}
function railMesh(d) {
  const T = THREE, g = new T.BufferGeometry();
  g.setAttribute('position', new T.Float32BufferAttribute(d.pos, 3)); g.setAttribute('normal', new T.Float32BufferAttribute(d.norm, 3));
  const mat = toon('#C9D3D6'), m = new T.Mesh(g, mat); m.castShadow = true;
  const o = new T.Mesh(g, outlineMat(0.018)); m.add(o);
  const grp = new T.Group(); grp.add(m); grp.userData.mat = mat; return grp;
}
// dry-run an arena's update() over the whole match on a scratch copy to find the parts that ever change
function dynamicParts(R) {
  const A = R.def, W2 = A.build(R.W.variant || 0), prims = new Set(), rails = new Set();
  W2.variant = R.W.variant || 0; if (SIM0.addTurnarounds) SIM0.addTurnarounds(W2, R.key);
  const snapP = (p) => [p.cx, p.cz, p.top, p.y0, p.w, p.d, p.yaw, p.h0, p.h1, p.gone, p.warn || 0, p.vx, p.vz].join(),
    snapR = (r) => [r.gone, r.live].join();
  const p0 = W2.prims.map(snapP), r0 = W2.rails.map(snapR);
  const fake = { W: W2, arena: W2, t: 0, tick: 0, sk: [], picks: [], proj: [], fires: [], dying: [], zoneNow: { x: 0, z: 0, r: 99 }, def: A, alive: 0 };
  const keep = { ...FXHOOK }; for (const k of Object.keys(FXHOOK)) FXHOOK[k] = () => {}; // silent dry run
  try {
    if (A.init) A.init(fake);
    for (let k = 1; k <= 3600; k += 6) {
      fake.tick = k; fake.t = k / 60; fake.zoneNow = SIM0.zoneAt(W2, fake.t);
      if (A.update) A.update(fake, 1 / 60); if (A.after) A.after(fake, 1 / 60);
      W2.prims.forEach((p, i) => { if (!prims.has(i) && snapP(p) !== p0[i]) prims.add(i); });
      W2.rails.forEach((r, i) => { if (!rails.has(i) && snapR(r) !== r0[i]) rails.add(i); });
    }
  } catch (e) { console.warn('dynamicParts', e); W2.prims.forEach((_, i) => prims.add(i)); W2.rails.forEach((_, i) => rails.add(i)); }
  finally { Object.assign(FXHOOK, keep); }
  if (W2.prims.length !== R.W.prims.length) { R.W.prims.forEach((_, i) => prims.add(i)); }
  return { prims, rails };
}
function addFloorMarks(root, W, look) {
  // painted lines / court markings / drains for readability
  const T = THREE, mat = new T.MeshBasicMaterial({ color: '#E8DDBD', transparent: true, opacity: 0.55, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
  for (let k = 0; k < 6; k++) {
    const m = new T.Mesh(new T.PlaneGeometry(0.25, 6 + k * 2), mat); m.rotation.x = -Math.PI / 2; m.rotation.z = k * 1.1;
    m.position.set(Math.sin(k * 2.1) * W.half * 0.6, 0.01, Math.cos(k * 1.7) * W.half * 0.6); root.add(m);
  }
  const ring = new T.Mesh(new T.RingGeometry(5.6, 6, 48), mat); ring.rotation.x = -Math.PI / 2; ring.position.y = 0.012; root.add(ring);
}
function addSkyline(root, W, look) {
  const T = THREE, rnd = mulberry(W.prims.length * 97 + W.half);
  const g = new T.BoxGeometry(1, 1, 1);
  const cols = ['#9C9484', '#8A8F8C', '#B0A48C', '#7E8A93', '#A88C72'];
  const wt = DECOR.windows.clone(); wt.repeat.set(2, 4); wt.needsUpdate = true;
  const n = 70, inst = new T.InstancedMesh(g, toon('#ffffff', { map: wt }), n), m4 = new T.Matrix4(), q = new T.Quaternion(), c = new T.Color();
  for (let k = 0; k < n; k++) {
    const a = rnd() * Math.PI * 2, d = W.half + 30 + rnd() * 110, w = 8 + rnd() * 18, h = 10 + rnd() * (W.floor ? 45 : 25), y = W.floor ? h / 2 - 1 : W.killY - 14 + h / 2 + (look.water ? -40 : 0);
    m4.compose(new T.Vector3(Math.cos(a) * d, y, Math.sin(a) * d), q.setFromAxisAngle(new T.Vector3(0, 1, 0), rnd() * 3), new T.Vector3(w, h, w * (0.6 + rnd())));
    inst.setMatrixAt(k, m4); inst.setColorAt(k, c.set(cols[k % 5]));
  }
  root.add(inst);
}
function addGraffiti(root, W) {
  // stick tags on tall box faces (deterministic per arena so it looks authored)
  const T = THREE, rnd = mulberry(W.half * 31 + W.prims.length);
  let n = 0;
  for (const p of W.prims) {
    if (p.type !== 'box' || p.top - p.y0 < 1.6 || n > 22 || rnd() < 0.35 || p.mat === 'gate' || p.mat === 'glass' || p.mat === 'fence') continue;
    const side = Math.floor(rnd() * 4), alongX = side < 2, len = alongX ? p.w : p.d;
    if (len < 2.2) continue;
    const s = Math.min(len * 0.8, (p.top - p.y0) * 1.2, 5);
    const m = new T.Mesh(new T.PlaneGeometry(s, s), new T.MeshBasicMaterial({ map: GFX.tex['graffiti' + (n % 6)], transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3 }));
    const lx = alongX ? (rnd() - 0.5) * (p.w - s) * 0.8 : (side === 2 ? 1 : -1) * (p.w / 2 + 0.02);
    const lz = alongX ? (side === 0 ? 1 : -1) * (p.d / 2 + 0.02) : (rnd() - 0.5) * (p.d - s) * 0.8;
    const c = Math.cos(p.yaw), sn = Math.sin(p.yaw);
    m.position.set(p.cx + lx * c + lz * sn, p.y0 + Math.min(p.top - p.y0, s) / 2 + 0.2, p.cz - lx * sn + lz * c);
    m.rotation.y = p.yaw + (alongX ? (side === 0 ? 0 : Math.PI) : (side === 2 ? Math.PI / 2 : -Math.PI / 2));
    root.add(m); n++;
  }
}
function mulberry(a) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

// per-frame: moving / collapsing / warning prims, live rails, hazards, zone
const WARN_MAT = {};
function syncArena(R, t, dt) {
  const B = GFX.built; if (!B || B.R !== R) return;
  GFX.clock += dt;
  updateGrime(R, dt);
  for (const e of B.prims) {
    const p = e.p;
    if (p.gone) { if (!e.gone) { e.gone = true; e.m.visible = false; fxBurst(p.cx, primTop(p), p.cz, 'debris', 24, p.mat); } continue; }
    if (e.gone) { e.gone = false; e.m.visible = true; }
    if (p.top !== e.top || p.y0 !== e.y0 || p.w !== e.w || p.d !== e.d || p.h0 !== e.h0 || p.h1 !== e.h1) { e.m.geometry.dispose(); e.m.geometry = roundGeo(p); e.edges.geometry.dispose(); e.edges.geometry = hullGeo(e.m.geometry); e.top = p.top; e.y0 = p.y0; e.w = p.w; e.d = p.d; e.h0 = p.h0; e.h1 = p.h1; }
    e.m.position.x = p.cx; e.m.position.z = p.cz; e.m.rotation.y = p.yaw;
    const w = p.warn || 0;
    if (w > 0) {
      const on = Math.floor(GFX.clock * (6 + w * 6)) % 2 === 0;
      if (on) { e.m.material = WARN_MAT[p.mat] || (WARN_MAT[p.mat] = toon('#FF5C69', { emissive: new THREE.Color('#551018'), side: THREE.DoubleSide })); } else e.m.material = e.baseMat;
    } else if (e.m.material !== e.baseMat) e.m.material = e.baseMat;
  }
  for (const e of B.rails) {
    e.grp.visible = !e.r.gone;
    if (e.r.live || e.wasLive) { const f = e.r.live && Math.random() < 0.5; e.wasLive = e.r.live; const m0 = e.grp.children[0]; if (m0) m0.material = f ? (WARN_MAT.live || (WARN_MAT.live = toon('#36DCE8', { emissive: new THREE.Color('#1b8fb0') }))) : e.mat; }
    if (e.r.live) { if (Math.random() < 0.3 && e.r.seg.length) { const s = e.r.seg[Math.floor(Math.random() * e.r.seg.length)], u = Math.random(); fxSpark(s.a[0] + (s.b[0] - s.a[0]) * u, s.a[1] + (s.b[1] - s.a[1]) * u, s.a[2] + (s.b[2] - s.a[2]) * u, 0x7ff6ff); } }
  }
  syncHazards(R, B, dt);
  // zone
  const Z = R.zoneNow || SIM0.zoneAt(R.W, R.t);
  GFX.zoneWall.scale.set(Z.r, 1, Z.r); GFX.zoneWall.position.x = Z.x; GFX.zoneWall.position.z = Z.z; GFX.zoneWall.material.uniforms.t.value = GFX.clock;
  GFX.zoneWall.visible = R.t > 0.5 && Z.r < 70;
}
function syncHazards(R, B, dt) {
  const T = THREE, list = R.W.hz || [];
  for (const h of list) {
    let o = B.hz.get(h);
    if (!o) {
      o = new T.Group(); o.userData.kind = h.kind;
      if (h.kind === 'grinder') {
        const blade = new T.Mesh(new T.CylinderGeometry(h.r || 2, h.r || 2, 0.25, 12), toon('#C9D3D6', { map: GFX.tex.hazard })); withOutline(blade, 0.04);
        for (let k = 0; k < 6; k++) { const tooth = new T.Mesh(new T.ConeGeometry(0.25, 0.7, 4), toon('#E8DDBD')); tooth.rotation.z = -Math.PI / 2; tooth.position.set(Math.cos(k * 1.047) * (h.r || 2), 0, Math.sin(k * 1.047) * (h.r || 2)); tooth.rotation.y = -k * 1.047; blade.add(tooth); }
        o.add(blade); o.userData.spin = blade;
        const pit = new T.Mesh(new T.CircleGeometry((h.r || 2) + 0.4, 24), new T.MeshBasicMaterial({ color: '#111' })); pit.rotation.x = -Math.PI / 2; pit.position.y = -0.1; o.add(pit);
      } else if (h.kind === 'fire' || h.kind === 'molten') {
        const pl = new T.Mesh(h.r ? new T.CircleGeometry(h.r, 24) : new T.PlaneGeometry(h.w || 2, h.d || 2), new T.MeshBasicMaterial({ color: h.kind === 'molten' ? '#FF7A1A' : '#FF9B36', transparent: true, opacity: 0.85, depthWrite: false }));
        pl.rotation.x = -Math.PI / 2; pl.position.y = 0.04; o.add(pl); o.userData.glow = pl;
      } else if (h.kind === 'water') {
        const pl = new T.Mesh(new T.PlaneGeometry(h.w || 4, h.d || 4), new T.MeshBasicMaterial({ color: '#36A7C9', transparent: true, opacity: 0.55, map: GFX.tex.water, depthWrite: false }));
        pl.material.map = GFX.tex.water.clone(); pl.material.map.repeat.set((h.w || 4) / 6, (h.d || 4) / 6); pl.material.map.needsUpdate = true; pl.rotation.x = -Math.PI / 2; pl.position.y = 0.05; o.add(pl); o.userData.water = pl;
      } else if (h.kind === 'press') {
        const pad = new T.Mesh(new T.PlaneGeometry(h.w || 3, h.d || 3), toon('#E2B13C', { map: GFX.tex.hazard })); pad.rotation.x = -Math.PI / 2; pad.position.y = 0.03; o.add(pad);
        const ram = new T.Mesh(new T.BoxGeometry((h.w || 3) * 0.95, 1.4, (h.d || 3) * 0.95), toon('#5E6669', { map: GFX.tex.tread })); withOutline(ram, 0.05); ram.castShadow = true; o.add(ram); o.userData.ram = ram;
        const col = new T.Mesh(new T.BoxGeometry(0.6, 12, 0.6), toon('#3B4245')); col.position.y = 12; o.add(col); o.userData.col = col;
      } else if (h.kind === 'magnet') {
        const mg = new T.Mesh(new T.CylinderGeometry(1.6, 1.6, 0.5, 20), toon('#C9473E')); withOutline(mg, 0.05); o.add(mg); o.userData.mag = mg;
        const cable = new T.Mesh(new T.CylinderGeometry(0.06, 0.06, 20, 6), toon('#22292B')); cable.position.y = 10; o.add(cable);
      } else if (h.kind === 'electric') {
        const pl = new T.Mesh(h.r ? new T.CircleGeometry(h.r, 20) : new T.PlaneGeometry(h.w || 2, h.d || 2), new T.MeshBasicMaterial({ color: '#36DCE8', transparent: true, opacity: 0.3, depthWrite: false })); pl.rotation.x = -Math.PI / 2; pl.position.y = 0.05; o.add(pl); o.userData.glow = pl;
      } else if (h.kind === 'pulse') {
        const pl = new T.Mesh(new T.RingGeometry((h.r || 1.4) * 0.6, h.r || 1.4, 24), new T.MeshBasicMaterial({ color: '#36DCE8', transparent: true, opacity: 0.4, depthWrite: false, side: T.DoubleSide })); pl.rotation.x = -Math.PI / 2; pl.position.y = 0.06; o.add(pl); o.userData.glow = pl; o.userData.jet = true;
      } else if (h.kind === 'fall') {
        const pl = new T.Mesh(new T.PlaneGeometry(h.w || 4, h.d || 4), new T.MeshBasicMaterial({ map: GFX.tex.hazard, color: '#FF5C69', transparent: true, opacity: 0.6, depthWrite: false })); pl.rotation.x = -Math.PI / 2; pl.position.y = 0.06; o.add(pl); o.userData.glow = pl;
      }
      GFX.arena.add(o); B.hz.set(h, o);
    }
    o.position.set(h.x || 0, h.y || 0, h.z || 0); o.rotation.y = h.yaw || 0;
    const warn = h.warn || 0, on = !!h.on;
    if (o.userData.spin) { o.userData.spin.rotation.y += dt * (on ? 14 : warn * 4); }
    if (o.userData.glow) { o.userData.glow.material.opacity = (on ? 0.7 : 0.15 + warn * 0.5) * (0.8 + Math.sin(GFX.clock * 20) * 0.2); o.visible = on || warn > 0 || h.kind === 'fire' || h.kind === 'molten'; if ((h.kind === 'fire' || h.kind === 'molten') && on && Math.random() < 0.5) fxFlame((h.x || 0) + (Math.random() - 0.5) * (h.w || h.r * 1.6 || 2), (h.y || 0) + 0.1, (h.z || 0) + (Math.random() - 0.5) * (h.d || h.r * 1.6 || 2)); if (h.kind === 'electric' && on && Math.random() < 0.4) fxSpark((h.x || 0) + (Math.random() - 0.5) * (h.w || 2), (h.y || 0) + 0.2, (h.z || 0) + (Math.random() - 0.5) * (h.d || 2), 0x7ff6ff); }
    if (o.userData.jet && on && Math.random() < 0.7) part((h.x || 0) + R3(0.4), (h.y || 0) + 0.2, (h.z || 0) + R3(0.4), { vy: 9 + Math.random() * 3, vx: R3(1), vz: R3(1), g: 14, life: 0.9, s0: 0.35, s1: 0.7, col: 0xbfefff });
    if (o.userData.water) o.userData.water.material.map.offset.y += dt * 0.08;
    if (o.userData.ram) { const y = on ? 0.75 : 3.2 + (1 - warn) * 1.5 - warn * 0.8 + Math.sin(GFX.clock * 40) * warn * 0.05; o.userData.ram.position.y += (y - o.userData.ram.position.y) * Math.min(1, dt * (on ? 40 : 6)); o.userData.col.position.y = o.userData.ram.position.y + 6.7; }
    if (o.userData.mag) o.userData.mag.rotation.y += dt * (on ? 3 : 0.5);
  }
}
