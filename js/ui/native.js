// The thin join to the Android app. The app's wrapper (Capacitor) puts window.Capacitor on the page; the web version has none,
// and then everything here simply does nothing, so the web game plays exactly as before.
(function (PE) {
  const cap = () => (window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform() ? window.Capacitor : null);

  const Native = {
    away: false,     // the app is in the background
    isApp: () => !!cap(),
    // The phone's share sheet. Returns a promise; a person closing the sheet without choosing counts as done.
    share(title, text) {
      const c = cap();
      if (!c) return Promise.reject(new Error('not in the app'));
      return c.nativePromise('Share', 'share', { title, text, dialogTitle: title });
    },
    init() {
      const c = cap();
      if (!c || !c.addListener) return;
      c.addListener('App', 'appStateChange', (st) => Native.setAway(!st.isActive));
      // The phone's Back button. The app's wrapper ignores Back once the game has no step left to go back to,
      // so the game handles it: step back inside the game (popstate in app.js does the rest), or, from the very top,
      // put the app away the way Home does. The game keeps its place and is saved on the way out.
      c.addListener('App', 'backButton', (e) => {
        if (e && e.canGoBack) history.back();
        else c.nativePromise('App', 'minimizeApp', {}).catch(() => {});
      });
    },
    // Sound stops when the app goes to the background, and picks up where it left off when it comes back.
    setAway(away) {
      Native.away = away;
      const S = PE.Sound;
      if (!S) return;
      if (S.ctx) { if (away) S.ctx.suspend().catch(() => {}); else S.ctx.resume().catch(() => {}); }
      S.syncMusic();
      if (PE.App && PE.App.saveGame && away) PE.App.saveGame();
    },
  };
  PE.Native = Native;
})(globalThis.PE = globalThis.PE || {});
