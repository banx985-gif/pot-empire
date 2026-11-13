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
    // Job 18: a phone or tablet (anything with a touch screen, or any screen taller than it is wide) uses the whole
    // screen, edge to edge: backgrounds and rooms cover it and the bars pin to its edges. Only a wide PC window keeps
    // the centred portrait box.
    const touch = (window.matchMedia && window.matchMedia('(pointer: coarse)').matches) || (navigator.maxTouchPoints || 0) > 0;
    const cssW = vw <= vh || touch ? vw : Math.min(vw, Math.round(vh * 0.62));
    document.documentElement.style.setProperty('--game-w', cssW + 'px');
    return { dpr, cssW, cssH: vh, W: Math.round(cssW * dpr), H: Math.round(vh * dpr) };
  }

  function start() {
    const problems = PE.DataCheck.checkData(PE.Data);
    if (problems.length) throw new Error('Game data problem: ' + problems.join('; '));

    const clock = PE.Clock.createClock();
    const saves = PE.Save.createSaveSystem({
      storage: getStorage(), clock, balanceVersion: PE.Data.balance.tableVersion,
      trial: (state) => PE.Game.tryOut(state, clock, PE.Data),
    });
    // A save that fails is written in the log, however it was called.
    const realSave = saves.save;
    saves.save = (state) => { const r = realSave(state); if (r.otherCopy) tellOtherCopy(); else if (!r.ok && !r.held && !saves.isBlocked()) PE.Log.error('save', r.error); return r; };
    // The game was opened again somewhere else on this phone. This copy has stopped saving, so it has to be reopened to carry on.
    let told = false;
    function tellOtherCopy() {
      if (told || !PE.Dom || !PE.Dom.modal) return;
      told = true;
      PE.Log.add('info', 'another copy of the game took over the save');
      PE.Dom.modal({ title: 'Open somewhere else', html: '<p>The game was opened in another tab or window, and that copy is saving now. Tap below to carry on here instead.</p>', buttons: [{ label: 'Play here', style: 'go', onTap: () => location.reload() }] });
    }
    window.addEventListener('storage', (e) => { if (e.key === saves.KEYS.owner && saves.ownedByOther()) tellOtherCopy(); });

    const loaded = saves.load();
    let notice = null;
    if (loaded.problems && loaded.problems.length) PE.Log.error('load', loaded.problems.join('; '));
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
      saves,
      // Job 24: "calm" = Reduced motion or Low power: fewer moving things. Every effect asks this one question.
      calm: () => !!(app.state.settings.reducedMotion || app.state.settings.lowPower),
    };
    PE.App = app;
    PE.Dom.init();
    PE.HelperUI.init();
    PE.ChestReveal.init();
    PE.Look.init();
    PE.Settings.init();
    PE.AgeGate.init();
    PE.Tutorial.init();
    PE.Intro.init();
    PE.EdgeArrows.init();
    PE.GrowTools.init();
    PE.Juice.init();

    PE.Native.init();
    PE.Notify.init();
    PE.Tips.init();

    // A picture or sound the game's loader couldn't fetch goes in the log.
    const baseNext = Phaser.Loader.LoaderPlugin.prototype.nextFile;
    Phaser.Loader.LoaderPlugin.prototype.nextFile = function (file, success) {
      if (!success) PE.Log.error('failed to load', file && (file.url || file.key));
      return baseNext.call(this, file, success);
    };

    const fromFile = location.protocol === 'file:';
    // Job 18: WebGL 2 when the phone has it, so every picture gets smooth in-between sizes (js/ui/smooth.js).
    const gl2 = fromFile ? null : PE.Smooth.context();
    const game = new Phaser.Game({
      // A page opened straight from a file on the PC can't use the graphics-card mode with its art.
      type: fromFile ? Phaser.CANVAS : gl2 ? Phaser.WEBGL : Phaser.AUTO,
      canvas: gl2 ? gl2.canvas : undefined,
      context: gl2 ? gl2.gl : undefined,
      // Smooth, not pixel art: shrunk pictures blend, nothing snaps to whole pixels.
      render: { antialias: true, pixelArt: false, roundPixels: false, mipmapFilter: 'LINEAR_MIPMAP_LINEAR' },
      parent: 'game',
      backgroundColor: '#1d0f33',
      banner: false,
      disableContextMenu: true,
      scale: { mode: Phaser.Scale.NONE, width: size.W, height: size.H, zoom: 1 / size.dpr },
      loader: fromFile ? { imageLoadType: 'HTMLImageElement' } : undefined,
      // limit only switches on Phaser's frame-skipping step; the real limit is set below (idle speed).
      fps: { target: 60, min: 20, limit: 60 },
      audio: { noAudio: true },
      // Menus sit over the canvas. Phaser must only hear touches that really land on the canvas.
      input: { windowEvents: false },
    });
    app.game = game;
    PE.Smooth.attach(game);

    // ---- Speed: full frame rate while a finger is on the screen or something was just tapped, and a
    // calmer rate when nobody has touched it for a few seconds. Growing, timers and animations still
    // move at the right speed (Phaser passes on the time that passed), just with fewer pictures.
    const IDLE_FPS = 30, IDLE_AFTER_MS = 4000;
    let lastInput = performance.now();
    // Low power (job 24): 30 a second all the time, not just when idle.
    const busy = () => { lastInput = performance.now(); if (game.loop) game.loop._limitRate = app.state.settings.lowPower ? 1000 / IDLE_FPS - 2 : 0; };
    ['pointerdown', 'pointermove', 'wheel', 'keydown'].forEach((t) => window.addEventListener(t, busy, { capture: true, passive: true }));
    game.events.once('ready', () => { game.loop._limitRate = 0; });
    setInterval(() => {
      if (game.loop && (app.state.settings.lowPower || performance.now() - lastInput > IDLE_AFTER_MS)) game.loop._limitRate = 1000 / IDLE_FPS - 2;
    }, 500);
    app.wakeFrames = busy;

    // ---- Which screen is showing ------------------------------------------------------------------
    let sceneNow = null;   // { key, fid } of the scene under any panels
    function showScene(route) {
      const same = sceneNow && sceneNow.key === route.name && sceneNow.fid === route.params.fid && sceneNow.district === route.params.district
        && (game.scene.isActive(route.name) || game.scene.isSleeping(route.name));
      if (same) {
        if (game.scene.isSleeping(route.name)) game.scene.wake(route.name);
      } else {
        // A scene asleep behind a full-screen menu has to be stopped too.
        if (sceneNow && game.scene.isSleeping(sceneNow.key)) game.scene.stop(sceneNow.key);
        game.scene.getScenes(true).forEach((s) => game.scene.stop(s.scene.key));
        game.scene.start(route.name, route.params);
        sceneNow = { key: route.name, fid: route.params.fid, district: route.params.district };
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
      } else {
        showScene(route);
        // First open of the day: the calendar comes up once, if today's reward is waiting. Skippable.
        if (route.name !== 'title' && !route.params.test && !g.tutorial.active() && g.calendar.shouldShow()) {
          g.calendar.markShown();
          setTimeout(() => { if (!PE.Dom.panelRoute) router.go('calendar', { auto: true }); }, 0);
        }
      }
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
      } else if (row.mode === 'Retail' || row.mode === 'Factory') {
        // Both shops and the factory are rooms you walk into. (An outdoor grow would get its own room here too.)
        const top = router.current();
        if (top.name === 'bizroom') router.replace('bizroom', params); else router.go('bizroom', params);
      } else if (row.mode === 'Logistics') {
        // Job 20: the depot is a yard you walk into too (js/ui/depot_yard.js).
        const top = router.current();
        if (top.name === 'depot') router.replace('depot', params); else router.go('depot', params);
      } else if (PE.Panels.business) {
        app.openPanel('business', params);
      }
    };
    app.currentTab = () => {
      const top = router.current();
      if (!top) return null;
      if (top.name === 'garage') return 'grow';
      return ({ bizroom: 'empire', depot: 'empire', empire: 'empire', collection: 'collection', contracts: 'contracts', shop: 'shop' })[top.name] || null;
    };
    app.navTo = (id) => {
      if (id === 'grow') { app.goToRoom(app.state.ui.lastRoom || 'F01'); return; }
      popPanels();
      if (id === 'empire') {
        // The map is a screen, not a menu. Coming back to it steps back, so Back keeps working
        // and the history can't pile up.
        const top = router.current();
        if (top.name === 'empire') return;
        const under = router.below();
        if (under && under.name === 'empire') { router.back(); return; }
      }
      router.go(id);
    };

    game.events.once('ready', () => {
      Object.entries(PE.Screens).forEach(([key, screen]) => game.scene.add(key, screen, false));
      router.go('title');
      if (PE.Loading) PE.Loading.done();
      PE.Offline.showIfPending();
      saves.save(app.state);
    });

    let hudSoon = false;
    // ---- Game events -> messages ---------------------------------------------------------------------
    g.on((type, e) => {
      if (type === 'harvest' && e.strainId) app.lastHarvestStrain = e.strainId;
      if (type === 'levelUp') {
        PE.Dom.toast(`Level ${e.level}!${e.rewards.length ? ' ' + e.rewards[0] : ''}`, 'big', 'RWD-06');
      } else if (type === 'celebrate') {
        PE.Celebrate.add(e);
      } else if (type === 'chestOpened') {
        PE.ChestReveal.add(e);
      } else if (type === 'rivalBeaten') {
        PE.Story.show(e.id);
      } else if (type === 'helperSay') {
        PE.HelperUI.add(e);
      } else if (type === 'masteryReward') {
        PE.Dom.toast(`${g.grow.strainStats(e.strainId).name} Mastery ${e.level}: ${e.text}`, 'big', 'QLT-06');
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

    // Job 18: in a phone's browser, the first tap asks for full screen so the address bar hides, the way an app fills
    // the screen. The app itself is full screen already. If the browser says no, the game carries on as it is.
    const goFull = () => {
      window.removeEventListener('pointerup', goFull, true);
      const el = document.documentElement;
      const touch = (window.matchMedia && window.matchMedia('(pointer: coarse)').matches) || (navigator.maxTouchPoints || 0) > 0;
      if (!touch || PE.Native.isApp() || document.fullscreenElement || !el.requestFullscreen) return;
      try { const r = el.requestFullscreen({ navigationUI: 'hide' }); if (r && r.catch) r.catch(() => {}); } catch (e) { /* refused: carry on */ }
    };
    window.addEventListener('pointerup', goFull, true);

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
  // The Android app carries all its files with it, so it doesn't need one.
  if ('serviceWorker' in navigator && location.protocol.startsWith('http') && !PE.Native.isApp()) {
    window.addEventListener('load', () => { navigator.serviceWorker.register('sw.js').catch(() => {}); });
  }
})(globalThis.PE = globalThis.PE || {});
