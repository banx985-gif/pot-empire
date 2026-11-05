// Starts the game: checks the data, loads the save, opens the Phaser canvas, connects everything.
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
    // Sharpness is capped at 2x: a 3x phone would have to draw more than twice the pixels for very
    // little visible gain, and a mid-range phone can't keep up.
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const cssW = Math.min(vw, Math.round(vh * 0.62));
    document.documentElement.style.setProperty('--game-w', cssW + 'px');
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

    const g = PE.Game.createGame({ state: loaded.state, clock, data: PE.Data });
    g.offline.settle();

    const size = screenSize();
    const allRoutes = [...Object.keys(PE.Screens), ...Object.keys(PE.Panels).filter((k) => typeof PE.Panels[k] === 'object')];
    const router = PE.Router.createRouter(allRoutes);
    const isPanel = (name) => !PE.Screens[name];
    const app = {
      dpr: size.dpr, router, g, state: loaded.state, saveNotice: notice, loadResult: loaded,
      saveGame: () => saves.save(app.state),
    };
    PE.App = app;
    PE.Dom.init();
    PE.HelperUI.init();

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
      fps: { target: 60, min: 20 },
      audio: { noAudio: true },
      // Menus sit over the canvas. Phaser must only hear touches that really land on the canvas.
      input: { windowEvents: false },
    });
    app.game = game;

    // ---- Which screen is showing ------------------------------------------------------------------
    let sceneNow = null;   // { key, fid } of the scene under any panels
    function showScene(route) {
      const same = sceneNow && sceneNow.key === route.name && sceneNow.fid === route.params.fid
        && (game.scene.isActive(route.name) || game.scene.isSleeping(route.name));
      if (same) {
        if (game.scene.isSleeping(route.name)) game.scene.wake(route.name);
      } else {
        // A scene asleep behind a full-screen menu has to be stopped too.
        if (sceneNow && game.scene.isSleeping(sceneNow.key)) game.scene.stop(sceneNow.key);
        game.scene.getScenes(true).forEach((s) => game.scene.stop(s.scene.key));
        game.scene.start(route.name, route.params);
        sceneNow = { key: route.name, fid: route.params.fid };
      }
      PE.Dom.closePanel();
      PE.Dom.setBarsVisible(route.name !== 'title');
    }

    // The phone's own Back button: we keep one extra browser history step while inside the game.
    // Pressing Back removes it, which fires popstate, which moves the router and puts the step back.
    let guard = false;
    function syncGuard() {
      if (router.depth() > 1 && !guard) {
        try { history.pushState({ pot: 1 }, ''); guard = true; } catch (e) { /* no history: on-screen Back still works */ }
      }
    }
    router.onChange((route) => {
      if (isPanel(route.name)) {
        PE.Dom.showPanel(route);
        // Nothing can be seen behind a full-screen menu, so stop drawing the room: saves battery.
        // The rules keep running, they don't depend on the drawing.
        if (!PE.Panels[route.name].sheet && sceneNow && game.scene.isActive(sceneNow.key)) game.scene.sleep(sceneNow.key);
        else if (PE.Panels[route.name].sheet && sceneNow && game.scene.isSleeping(sceneNow.key)) game.scene.wake(sceneNow.key);
      } else showScene(route);
      syncGuard();
      saves.save(app.state);
      PE.Hud.refresh();
    });
    window.addEventListener('popstate', () => {
      guard = false;
      if (PE.Dom.modalNow) { syncGuard(); return; }   // a pop-up must be answered with its own buttons
      router.back();
      syncGuard();
    });
    app.back = () => {
      if (router.depth() <= 1) return;
      router.back();
      if (router.depth() <= 1 && guard) { guard = false; history.back(); }
    };

    app.openPanel = (name, params = {}) => {
      const top = router.current();
      if (top && isPanel(top.name) && !PE.Panels[top.name].sheet) router.replace(name, params);
      else router.go(name, params);
    };
    // Back to the nearest scene, closing any panels on the way. No browser steps are involved.
    function popPanels() { while (router.current() && isPanel(router.current().name)) router.back(); }

    app.goToRoom = (fid) => {
      popPanels();
      const row = g.facilities.row(fid);
      const params = { fid };
      if (row.mode === 'Grow') {
        app.state.ui.lastRoom = fid;
        const top = router.current();
        if (top.name === 'garage') router.replace('garage', params); else router.go('garage', params);
      } else if (PE.Panels.business) {
        app.openPanel('business', params);
      }
    };
    app.currentTab = () => {
      const top = router.current();
      if (!top) return null;
      if (top.name === 'garage') return 'grow';
      return ({ empire: 'empire', collection: 'collection', contracts: 'contracts', shop: 'shop' })[top.name] || null;
    };
    app.navTo = (id) => {
      if (id === 'grow') { app.goToRoom(app.state.ui.lastRoom || 'F01'); return; }
      popPanels();
      router.go(id);
    };

    game.events.once('ready', () => {
      Object.entries(PE.Screens).forEach(([key, screen]) => game.scene.add(key, screen, false));
      router.go('title');
      PE.Offline.showIfPending();
      saves.save(app.state);
    });

    let hudSoon = false;
    // ---- Game events -> messages ---------------------------------------------------------------------
    g.on((type, e) => {
      if (type === 'levelUp') {
        PE.Dom.toast(`Level ${e.level}!${e.rewards.length ? ' ' + e.rewards[0] : ''}`, 'big');
      } else if (type === 'celebrate') {
        PE.Celebrate.add(e);
      } else if (type === 'helperSay') {
        PE.HelperUI.add(e);
      } else if (type === 'masteryReward') {
        PE.Dom.toast(`${g.grow.strainStats(e.strainId).name} Mastery ${e.level}: ${e.text}`, 'big');
      } else if (type === 'offlineReady') {
        if (app.game) PE.Offline.showIfPending();
      } else if (type === 'changed' || type === 'harvest') {
        dirty = true;
        if (!hudSoon) { hudSoon = true; setTimeout(() => { hudSoon = false; PE.Hud.refresh(); }, 50); }
      }
    });

    // ---- Heartbeat: rules tick, top bar, saving --------------------------------------------------------
    let dirty = false;
    let lastSave = Date.now();
    setInterval(() => {
      g.tick();
      PE.Hud.refresh();
      if (dirty && Date.now() - lastSave > 5000 || Date.now() - lastSave > 30000) {
        saves.save(app.state);
        lastSave = Date.now();
        dirty = false;
      }
    }, 1000);

    // Save when the phone hides the game: this is the last sure moment before it may be closed.
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) { g.tick(); saves.save(app.state); }
      else { g.tick(); saves.save(app.state); PE.Hud.refresh(); }
    });
    window.addEventListener('pagehide', () => { saves.save(app.state); });

    // Rotating or resizing: redraw the current screen at the new size.
    let timer = null;
    window.addEventListener('resize', () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        const next = screenSize();
        app.dpr = next.dpr;
        game.scale.setZoom(1 / next.dpr);
        game.scale.resize(next.W, next.H);
        app.cameraMemory = {};
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
