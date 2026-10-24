// ───────────────────────── BOOT ─────────────────────────
(function boot() {
  try {
    initRender(); initFx(); installFxHooks();
    if (/[?&]test\b/.test(location.search)) { SETTINGS.quality = 'low'; GFX.r.setPixelRatio(0.6); resize(); GFX.test = true; }
    setMuted(AUDIO.muted);
    $('#loading').remove();
    // reconnecting to a running online match takes over from the menus automatically (NET resync)
    goHome();
    requestAnimationFrame(frame);
    // debug/test hooks (used by tools/*.mjs browser checks)
    window.GH = { GAME, get ROUND() { return ROUND; }, startPractice, NET, CASH, SETTINGS, INPUT, goHome, cycleSpec, startReplay, GFX, ARENAS, rigLineup, PFX, GRIME, shotAt: (px, py, pz, tx, ty, tz, w = 960, h = 540) => { const c = new THREE.PerspectiveCamera(60, w / h, 0.1, 500); c.position.set(px, py, pz); c.lookAt(tx, ty, tz); const rt = new THREE.WebGLRenderTarget(w, h); GFX.r.setRenderTarget(rt); GFX.r.render(GFX.scene, c); GFX.r.setRenderTarget(null); const b = new Uint8Array(w * h * 4); GFX.r.readRenderTargetPixels(rt, 0, 0, w, h, b); const cv = document.createElement('canvas'); cv.width = w; cv.height = h; const g = cv.getContext('2d'), id = g.createImageData(w, h); for (let y = 0; y < h; y++) id.data.set(b.subarray((h - 1 - y) * w * 4, (h - y) * w * 4), y * w * 4); g.putImageData(id, 0, 0); return cv.toDataURL('image/png'); }, fxTracer: (slow, ...a) => { const before = new Set(PFX.slugs.filter((q) => q.g.visible)); tracer(...a); if (slow) PFX.slugs.forEach((q) => { if (q.g.visible && !before.has(q)) q.dur *= slow; }); }, audioState: () => ({ sfx: Object.keys(SFXB).length, files: Object.values(SFXB).reduce((n, l) => n + l.filter(Boolean).length, 0), music: !!(ST.el && !ST.el.paused), src: ST.el && ST.el.src, t: ST.el && ST.el.currentTime, failed: ST.failed, ctx: actx && actx.state }) };
  } catch (e) {
    console.error(e);
    document.body.dataset.err = 'Grindhouse could not start: ' + e.message + ' (WebGL needed)';
  }
})();
