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
    window.GH = { GAME, get ROUND() { return ROUND; }, startPractice, NET, CASH, SETTINGS, INPUT, goHome, cycleSpec, startReplay, GFX, ARENAS, rigLineup, PFX, fxTracer: (slow, ...a) => { const before = new Set(PFX.slugs.filter((q) => q.g.visible)); tracer(...a); if (slow) PFX.slugs.forEach((q) => { if (q.g.visible && !before.has(q)) q.dur *= slow; }); }, audioState: () => ({ sfx: Object.keys(SFXB).length, files: Object.values(SFXB).reduce((n, l) => n + l.filter(Boolean).length, 0), music: !!(ST.el && !ST.el.paused), src: ST.el && ST.el.src, t: ST.el && ST.el.currentTime, failed: ST.failed, ctx: actx && actx.state }) };
  } catch (e) {
    console.error(e);
    document.body.dataset.err = 'Grindhouse could not start: ' + e.message + ' (WebGL needed)';
  }
})();
