// The hidden Tester panel: tap the build number in Settings 7 times. Speed numbers, three switches, and a way to send a report.
(function (PE) {
  const { esc } = PE.Dom;
  const S = () => PE.App.state.settings;

  let taps = 0, lastTap = 0;
  const FAST_FACTOR = 10;
  const Fast = { on: false, timer: null };

  // The pictures loaded into the graphics card right now, worked out from their sizes (4 bytes a pixel, plus a third for the smaller copies some keep).
  function pictureMB() {
    const game = PE.App.game;
    if (!game || !game.textures) return { mb: 0, count: 0 };
    let bytes = 0, count = 0;
    for (const key of Object.keys(game.textures.list)) {
      if (key === '__DEFAULT' || key === '__MISSING' || key === '__NORMAL' || key === '__WHITE') continue;
      const t = game.textures.list[key];
      for (const s of t.source) { bytes += (s.width || 0) * (s.height || 0) * 4; count++; }
    }
    return { mb: bytes / 1048576, count };
  }

  function facts() {
    const game = PE.App.game;
    const m = performance.memory;
    const route = PE.App.router.current();
    const pics = pictureMB();
    return {
      build: PE.BUILD.startsWith('__') ? 'dev' : PE.BUILD,
      where: PE.Native.isApp() ? 'Android app' : 'web',
      fps: game && game.loop ? Math.round(game.loop.actualFps) : 0,
      memory: m ? `${Math.round(m.usedJSHeapSize / 1048576)} MB used of ${Math.round(m.jsHeapSizeLimit / 1048576)} MB` : 'this phone doesn\'t report it',
      pictures: `${pics.mb.toFixed(0)} MB in ${pics.count} pictures`,
      screen: `${window.innerWidth} x ${window.innerHeight} at ${window.devicePixelRatio || 1}x (${window.screen.width} x ${window.screen.height})`,
      route: route ? `${route.name} ${JSON.stringify(route.params || {})}` : 'none',
    };
  }

  // Fast time. Growing runs 10x faster, for testing only. From the moment it's on nothing is saved, and switching it off
  // restarts from the save made just before, so none of it can reach normal play. Closing the app does the same.
  function startFast() {
    PE.App.saves.save(PE.App.state);
    PE.App.saves.setHold(true);
    Fast.on = true;
    PE.Dom.toast('Fast time on. Nothing is being saved.');
    document.documentElement.classList.add('fast-time');
    const g = PE.App.g;
    Fast.timer = setInterval(() => {
      const skip = (FAST_FACTOR - 1) * 1000;
      g.grow.eachStation((fid, si, st) => st.pots.forEach((p) => {
        if (!p) return;
        p.plantedMs -= skip;
        p.readyMs -= skip;
      }));
    }, 1000);
  }
  function stopFast() {
    PE.Dom.modal({
      title: 'Leave Fast time?',
      html: '<p>The game restarts from your save just before Fast time. Everything since then is forgotten.</p>',
      buttons: [{ label: 'Restart', style: 'go', onTap: () => location.reload() }, { label: 'Stay', style: 'plain' }],
    });
  }

  function reportText() {
    const f = facts();
    const nav = navigator;
    const errors = PE.Log.errors();
    return [
      'Pot Empire Tycoon problem report',
      `Made: ${new Date().toISOString()}`,
      `Build: ${f.build} (${f.where})`,
      `Phone: ${nav.userAgent}`,
      `Screen: ${f.screen}`,
      `Speed: ${f.fps} fps`,
      `Memory: ${f.memory}`,
      `Pictures: ${f.pictures}`,
      `Showing: ${f.route}`,
      `Save version: ${PE.SaveSchema.CURRENT_VERSION}, level ${PE.App.state.player.level}`,
      `Fast time: ${Fast.on ? 'on' : 'off'}`,
      '',
      `Errors (${errors.length}):`,
      ...(errors.length ? errors : ['none']),
      '',
      'Last log lines:',
      ...PE.Log.lines(),
    ].join('\n');
  }

  async function sendReport() {
    const text = reportText();
    try { window.localStorage.setItem('potEmpire.lastReport', text); } catch (e) { /* no room: it still gets sent */ }
    if (PE.Native.isApp()) {
      try { await PE.Native.share('Pot Empire problem report', text); } catch (e) { PE.Log.error('share', e); PE.App.router.go('testerReport', { text }); }
      return;
    }
    try {
      await navigator.clipboard.writeText(text);
      PE.Dom.toast('Report copied. Paste it wherever you like.');
    } catch (e) {
      // No clipboard allowed: show it, so it can be copied by hand.
      PE.App.router.go('testerReport', { text });
    }
  }

  PE.Tester = {
    // A tap on the build number in Settings.
    tapVersion() {
      const now = Date.now();
      taps = now - lastTap > 2500 ? 1 : taps + 1;
      lastTap = now;
      if (taps >= 7) { taps = 0; PE.App.router.go('tester', {}); return; }
      if (taps >= 3) PE.Dom.toast(`${7 - taps} more ${7 - taps === 1 ? 'tap' : 'taps'} for the Tester panel`);
    },
    fastOn: () => Fast.on,
    pictureMB,
    facts,
    reportText,
    sendReport,
  };

  const row = (name, value) => `<div class="item"><div class="grow"><b>${esc(name)}</b><small>${esc(value)}</small></div></div>`;
  const toggle = (act, title, text, on) => `<div class="item"><div class="grow"><b>${title}</b><small>${text}</small></div>
    <button class="btn small ${on ? 'go' : 'cant'}" data-act="${act}" aria-pressed="${!!on}">${on ? 'On' : 'Off'}</button></div>`;

  PE.Panels.tester = {
    title: 'Tester',
    live: true,
    render() {
      const f = facts();
      return `<h4>This phone</h4>
        ${row('Pictures per second', String(f.fps))}
        ${row('Memory used', f.memory)}
        ${row('Pictures loaded', f.pictures)}
        ${row('Screen size', f.screen)}
        ${row('Build', `${f.build} (${f.where})`)}
        ${row('Errors caught', String(PE.Log.errors().length))}
        <h4>Switches</h4>
        ${toggle('flip:showFps', 'Speed counter', 'Pictures per second in the corner', S().showFps)}
        ${toggle('flip:reducedMotion', 'Reduced motion', 'Fewer moving effects', S().reducedMotion)}
        ${toggle('fast', `Fast time (${FAST_FACTOR}x growth)`, 'For testing only. Nothing is saved while it\'s on, and switching it off goes back to your save.', Fast.on)}
        <h4>Problems</h4>
        <button class="btn wide go" data-act="report">Report a problem</button>
        <p class="muted">${PE.Native.isApp() ? 'Opens the phone\'s share list so you can send it.' : 'Copies the report so you can paste it.'} It has the build, phone details, recent log lines, errors and the current screen. No save data.</p>`;
    },
    actions: {
      flip(key) { S()[key] = !S()[key]; PE.App.saveGame(); PE.Look.apply(); },
      fast() { if (Fast.on) stopFast(); else startFast(); },
      report() { sendReport(); },
    },
  };

  PE.Panels.testerReport = {
    title: 'Problem report',
    render({ text }) { return `<p>Press and hold to copy this.</p><textarea class="savetext" readonly>${esc(text)}</textarea>`; },
  };
})(globalThis.PE = globalThis.PE || {});
