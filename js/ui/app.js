// Starts the game: checks the data, loads the save, opens the Phaser canvas, connects the router.
(function (PE) {
  const STORAGE_FALLBACK = () => {
    // Private browsing can block storage. The game still runs, it just won't remember anything.
    const mem = new Map();
    return {
      getItem: (k) => (mem.has(k) ? mem.get(k) : null),
      setItem: (k, v) => { mem.set(k, String(v)); },
      removeItem: (k) => { mem.delete(k); },
    };
  };

  function getStorage() {
    try {
      const probe = 'potEmpire.probe';
      window.localStorage.setItem(probe, '1');
      window.localStorage.removeItem(probe);
      return window.localStorage;
    } catch (e) {
      return STORAGE_FALLBACK();
    }
  }

  function screenSize() {
    // Phone first. On a wide PC window, keep the portrait shape and centre it.
    const vw = window.innerWidth, vh = window.innerHeight;
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    const cssW = Math.min(vw, Math.round(vh * 0.62));
    return { dpr, cssW, cssH: vh, W: Math.round(cssW * dpr), H: Math.round(vh * dpr) };
  }

  function start() {
    const problems = PE.DataCheck.checkData(PE.Data);
    if (problems.length) throw new Error('Game data problem: ' + problems.join('; '));

    const clock = PE.Clock.createClock();
    const saves = PE.Save.createSaveSystem({
      storage: getStorage(), clock, balanceVersion: PE.Data.balance.tableVersion,
    });
    const loaded = saves.load();
    let notice = null;
    if (loaded.source === 'too-new') notice = 'This phone has a save from a newer build. Close the game fully and reopen it to update. Nothing is being saved until then.';
    else if (loaded.recovered) notice = 'Your latest save was damaged, so an earlier copy was restored.';
    else if (loaded.lostSave) notice = 'Your save was damaged and could not be restored, so this is a new game. The damaged copy has been kept.';

    const size = screenSize();
    const router = PE.Router.createRouter(Object.keys(PE.Screens));
    const app = {
      dpr: size.dpr, router, state: loaded.state, saveNotice: notice, loadResult: loaded,
      saveGame: () => saves.save(app.state),
    };
    PE.App = app;

    const fromFile = location.protocol === 'file:';
    const game = new Phaser.Game({
      // A page opened straight from a file on the PC can't use the graphics-card mode with its art.
      type: fromFile ? Phaser.CANVAS : Phaser.AUTO,
      parent: 'game',
      backgroundColor: '#1d0f33',
      banner: false,
      disableContextMenu: true,
      scale: { mode: Phaser.Scale.NONE, width: size.W, height: size.H, zoom: 1 / size.dpr },
      loader: fromFile ? { imageLoadType: 'HTMLImageElement' } : undefined,
    });
    app.game = game;

    // The phone's own Back button and the on-screen Back do the same thing. Each new screen adds a
    // browser history step; going back removes one, which fires popstate, which moves the router.
    let useHistory = true;
    router.onChange((route, reason) => {
      game.scene.getScenes(true).forEach((s) => game.scene.stop(s.scene.key));
      game.scene.start(route.name, route.params);
      if (reason === 'go' && router.depth() > 1 && useHistory) {
        try { history.pushState({ depth: router.depth() }, ''); } catch (e) { useHistory = false; }
      }
      saves.save(app.state);
    });
    window.addEventListener('popstate', () => { router.back(); });
    app.back = () => {
      if (router.depth() <= 1) return;
      if (useHistory) history.back(); else router.back();
    };

    game.events.once('ready', () => {
      Object.entries(PE.Screens).forEach(([key, screen]) => game.scene.add(key, screen, false));
      router.go('title');
    });

    // Save when the phone hides the game: this is the last sure moment before it may be closed.
    document.addEventListener('visibilitychange', () => { if (document.hidden) saves.save(app.state); });
    window.addEventListener('pagehide', () => saves.save(app.state));

    // Rotating or resizing: redraw the current screen at the new size.
    let timer = null;
    window.addEventListener('resize', () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        const next = screenSize();
        app.dpr = next.dpr;
        game.scale.setZoom(1 / next.dpr);
        game.scale.resize(next.W, next.H);
        game.scene.getScenes(true).forEach((s) => s.scene.restart());
      }, 150);
    });
  }

  function showFatal(message) {
    const box = document.getElementById('fatal');
    if (!box) return;
    box.hidden = false;
    box.textContent = 'Something went wrong:\n' + message;
  }
  window.addEventListener('error', (e) => showFatal(e.message || 'unknown error'));
  window.addEventListener('unhandledrejection', (e) => showFatal(String(e.reason)));

  try { start(); } catch (e) { showFatal(e.message); throw e; }

  // Service worker: makes the installed game work offline. Only over http(s), so opening
  // index.html straight from a file on the PC keeps working.
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    window.addEventListener('load', () => { navigator.serviceWorker.register('sw.js').catch(() => {}); });
  }
})(globalThis.PE = globalThis.PE || {});
