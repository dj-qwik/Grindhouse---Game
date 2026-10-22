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
    window.GH = { GAME, get ROUND() { return ROUND; }, startPractice, NET, CASH, SETTINGS, INPUT, goHome, cycleSpec, startReplay, GFX, ARENAS, rigLineup };
  } catch (e) {
    console.error(e);
    document.body.dataset.err = 'Grindhouse could not start: ' + e.message + ' (WebGL needed)';
  }
})();
