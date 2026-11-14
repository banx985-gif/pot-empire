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

  // The room you came in from (a grow room, a shop or the factory), if it has spots.
  function roomScene() {
    for (const key of ['garage', 'bizroom']) {
      const sc = PE.App.game.scene.getScene(key);
      if (sc && (sc.sys.isActive() || sc.sys.isSleeping()) && sc.room && sc.room.id) return sc;
    }
    return null;
  }
  // Every spot of that room, as text for data/room_spot_overrides.js: shared, or copied, or shown to copy by hand.
  async function copySpots() {
    const sc = roomScene();
    if (!sc) { PE.Dom.toast('Go into a room first, then open this panel.'); return; }
    const text = PE.RoomSpots.text(sc.room);
    if (PE.Native.isApp()) {
      try { await PE.Native.share(`Pot Empire spots ${sc.room.id}`, text); } catch (e) { PE.App.router.go('testerReport', { text }); }
      return;
    }
    try { await navigator.clipboard.writeText(text); PE.Dom.toast(`Spots for ${sc.room.id} copied.`); } catch (e) { PE.App.router.go('testerReport', { text }); }
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
    // Job 25: the local diary for a bug report, from Settings too (nothing is ever sent by itself: no analytics).
    sendReport: () => sendReport(),
    reportText: () => reportText(),
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
        <h4>Room spots</h4>
        ${toggle('spots', 'Move spots', 'In a room, drag a numbered spot to move it. Only on this phone, until Cowork adds them.', PE.RoomSpots.editing)}
        <button class="btn wide" data-act="copySpots">Copy spots</button>
        <button class="btn wide" data-act="resetSpots">Put this room's spots back</button>
        <h4>Art</h4>
        <button class="btn wide" data-act="artList">Every picture: real or placeholder</button>
        <h4>Problems</h4>
        <button class="btn wide go" data-act="report">Report a problem</button>
        <p class="muted">${PE.Native.isApp() ? 'Opens the phone\'s share list so you can send it.' : 'Copies the report so you can paste it.'} It has the build, phone details, recent log lines, errors and the current screen. No save data.</p>`;
    },
    actions: {
      artList() { PE.App.router.go('artList', {}); },
      flip(key) { S()[key] = !S()[key]; PE.App.saveGame(); PE.Look.apply(); },
      fast() { if (Fast.on) stopFast(); else startFast(); },
      report() { sendReport(); },
      spots() { PE.RoomSpots.editing = !PE.RoomSpots.editing; PE.Dom.toast(PE.RoomSpots.editing ? 'Close this panel and drag the numbered spots.' : 'Spots stay where you put them.'); },
      copySpots() { copySpots(); },
      resetSpots() {
        const sc = roomScene();
        if (!sc) { PE.Dom.toast('Go into a room first, then open this panel.'); return; }
        PE.RoomSpots.clear(sc.room.id);
        PE.Dom.toast(`${sc.room.id} spots put back.`);
        sc.scene.restart(sc.sys.settings.data);
      },
    },
  };

  PE.Panels.testerReport = {
    title: 'Problem report',
    render({ text }) { return `<p>Press and hold to copy this.</p><textarea class="savetext" readonly>${esc(text)}</textarea>`; },
  };

  // ---- Job 25: every picture the game knows, and whether it's Aaron's real art or still a placeholder -----------------
  // From the asset registry (npm run registry). Real art shows its picture; a placeholder or a planned one says what the
  // game shows instead. Filters: what's missing first, or everything, or one kind.
  const STATUS = { imported: 'Real', have: 'Filed, not used yet', planned: 'Not drawn yet' };
  PE.Panels.artList = {
    title: 'Art: real or placeholder',
    render(p) {
      const all = PE.Data.assetRegistry.entries;
      const show = p.show || 'missing';
      const cats = [...new Set(all.map((e) => e.category))].sort();
      const pick = all.filter((e) => (show === 'missing' ? e.status !== 'imported' || e.placeholder : show === 'all' ? true : e.category === show));
      const count = (st) => all.filter((e) => e.status === st).length;
      const head = `<p><b>${count('imported')}</b> real · <b>${count('have')}</b> filed but not used · <b>${count('planned')}</b> not drawn yet · ${all.length} in all</p>
        <div class="row-btns art-filter">${['missing', 'all', ...cats].map((c) => `<button class="btn small ${c === show ? 'go' : 'plain'}" data-act="show:${c}">${esc(c === 'missing' ? 'Missing first' : c === 'all' ? 'Everything' : c)}</button>`).join('')}</div>`;
      const rows = pick.slice(0, 400).map((e) => {
        const real = e.status === 'imported' && e.gamePath && !e.placeholder;
        const src = real ? e.gamePath.replace(/^game\//, '') : '';
        const isPic = /\.(webp|png|jpe?g)$/i.test(src);
        return `<div class="item art-row ${real ? '' : 'missing'}">${isPic ? `<img class="art-pic" loading="lazy" src="${esc(src)}" alt="">` : `<span class="art-pic none">${real ? 'snd' : '?'}</span>`}<div class="grow"><b>${esc(e.id)}</b><small>${esc(e.category)} · ${STATUS[e.status] || e.status}${e.placeholder ? ' (placeholder)' : ''}</small>${e.note ? `<small>${esc(e.note)}</small>` : ''}</div></div>`;
      }).join('');
      return head + rows + (pick.length > 400 ? `<p class="muted">... and ${pick.length - 400} more (pick one kind above).</p>` : '');
    },
    actions: { show(c) { PE.App.router.replace('artList', { show: c }); } },
  };
  if (typeof location !== 'undefined' && /[?&]artlist\b/.test(location.search)) {
    const go = () => { if (PE.App && PE.App.router && PE.App.router.current()) PE.App.router.go('artList', {}); else setTimeout(go, 500); };
    setTimeout(go, 1500);
  }
})(globalThis.PE = globalThis.PE || {});
