// The menus, top bar and pop-ups are ordinary web page elements laid over the canvas. Long
// scrolling lists are smooth and light this way, and text stays live UI (bible section 10).
//
// A panel is { title, sheet, live, render(params) -> html text, actions: { name(...args) } }.
//   sheet: true = slides up from the bottom over the game. false = fills the screen.
//   live:  true = redrawn each second (for timers)
// Buttons say what they do with data-act="name:arg1:arg2". Taps are read on the container, not
// the button, so a redraw while a finger is down can't lose the tap.
(function (PE) {
  const { Money } = PE;
  const $ = (id) => document.getElementById(id);
  const esc = (t) => String(t).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const money = (v) => '$' + Money.format(v);

  function duration(seconds) {
    const s = Math.max(0, Math.round(seconds));
    if (s < 60) return `${s}s`;
    if (s < 3600) return `${Math.floor(s / 60)}m ${s % 60 ? (s % 60) + 's' : ''}`.trim();
    if (s < 86400) { const m = Math.floor((s % 3600) / 60); return `${Math.floor(s / 3600)}h${m ? ' ' + m + 'm' : ''}`; }
    return `${Math.floor(s / 86400)}d ${Math.floor((s % 86400) / 3600)}h`;
  }

  // A strain picture for menus, cut from the sheet with CSS.
  function strainThumb(strainId, stage = 5, size = 64) {
    const sheet = PE.Data.strainFrames.sheets[strainId];
    const f = sheet.frames[stage];
    const k = PE.UI.SHEET_SCALE;
    const zoom = size / (Math.max(f.w, f.h) * k);
    const w = f.w * k * zoom, h = f.h * k * zoom;
    return `<span class="thumb" style="width:${size}px;height:${size}px"><span style="width:${w}px;height:${h}px;background-image:url(${PE.UI.sheetUrl(strainId)});background-size:${sheet.sheetW * k * zoom}px ${sheet.sheetH * k * zoom}px;background-position:-${f.x * k * zoom}px -${f.y * k * zoom}px"></span></span>`;
  }

  // ---- Tap handling on a container ----------------------------------------------------------
  let touching = false;
  const fingerUp = () => { touching = false; };
  window.addEventListener('pointerup', fingerUp, true);
  window.addEventListener('pointercancel', fingerUp, true);

  function attachTaps(el, handle) {
    let down = null;
    const finish = (x, y) => {
      if (!down) return;
      const d = down; down = null;
      if (Math.hypot(x - d.x, y - d.y) > 14) return;   // that was a scroll
      if (d.act) handle(d.act);
      else if (d.bare) handle('__backdrop');
    };
    el.addEventListener('pointerdown', (e) => {
      // While a finger is down nothing on screen is redrawn: a button replaced under a finger loses its tap.
      touching = true;
      const t = e.target.closest('[data-act]');
      down = t ? { act: t.dataset.act, x: e.clientX, y: e.clientY } : { act: null, x: e.clientX, y: e.clientY, bare: e.target === el };
    });
    // Fingers act on touchend, mice on pointerup. After a touch, browsers also send a pretend mouse
    // click. If this tap closes the menu, that click would land on the room underneath and tap a
    // plant. Cancelling touchend stops it, but only if done BEFORE the menu is removed, so the
    // action has to run here, after the cancel.
    el.addEventListener('pointerup', (e) => { if (e.pointerType !== 'touch') finish(e.clientX, e.clientY); });
    el.addEventListener('touchend', (e) => {
      // A text box needs the browser's own touch handling to get the keyboard up.
      if (e.target.closest && e.target.closest('input, textarea, select')) { down = null; return; }
      if (e.cancelable) e.preventDefault();
      const c = e.changedTouches[0];
      if (c) finish(c.clientX, c.clientY);
    }, { passive: false });
    el.addEventListener('pointercancel', () => { down = null; });
  }

  const Dom = {
    esc, money, duration, strainThumb, attachTaps,
    isTouching: () => touching,
    panelRoute: null,

    init() {
      attachTaps($('panel'), (act) => this.runAction(act));
      attachTaps($('modal'), (act) => this.runModal(act));
      attachTaps($('hud'), (act) => this.runBar(act));
      attachTaps($('actionbar'), (act) => this.runBar(act));
      attachTaps($('bottomnav'), (act) => this.runBar(act));
      setInterval(() => { if (!touching && this.panelRoute && this.panelDef().live) this.renderPanel(); }, 1000);
    },

    setBarsVisible(on) {
      ['hud', 'bottomnav', 'actionbar'].forEach((id) => { $(id).hidden = !on; });
      PE.Hud.refresh(true);
    },

    // ---- Panels --------------------------------------------------------------------------------
    panelDef() { return PE.Panels[this.panelRoute.name]; },
    showPanel(route) { this.panelRoute = route; this.renderPanel(true); },
    closePanel() { this.panelRoute = null; $('panel').hidden = true; $('panel').innerHTML = ''; },

    renderPanel(fresh) {
      if (!this.panelRoute) return;
      const def = this.panelDef();
      const el = $('panel');
      const oldScroll = el.querySelector('.scroll');
      const top = !fresh && oldScroll ? oldScroll.scrollTop : 0;
      const body = def.render(this.panelRoute.params || {});
      const title = typeof def.title === 'function' ? def.title(this.panelRoute.params || {}) : def.title;
      el.className = def.sheet ? 'is-sheet' : 'is-full';
      el.innerHTML = `<div class="box"><header><button data-act="__close" class="closer" aria-label="Close">✕</button><h2>${esc(title)}</h2></header><div class="scroll">${body}</div></div>`;
      el.hidden = false;
      const nowScroll = el.querySelector('.scroll');
      if (nowScroll) nowScroll.scrollTop = top;
    },

    runAction(act) {
      if (act === '__close' || act === '__backdrop') { PE.App.back(); return; }
      if (!this.panelRoute) return;
      const [name, ...args] = act.split(':');
      const def = this.panelDef();
      const fn = def.actions && def.actions[name];
      if (fn) fn(...args);
      if (this.panelRoute) this.renderPanel();
      PE.Hud.refresh(true);
    },

    // ---- Pop-ups (above everything). One at a time, others wait in line. -----------------------
    modalQueue: [],
    modalNow: null,
    modal(def) {
      this.modalQueue.push(def);
      if (!this.modalNow) this.nextModal();
    },
    nextModal() {
      const el = $('modal');
      this.modalNow = this.modalQueue.shift() || null;
      if (!this.modalNow) { el.hidden = true; el.innerHTML = ''; return; }
      const m = this.modalNow;
      const buttons = m.buttons.map((b, i) => `<button class="btn ${b.style || ''}" data-act="${i}">${esc(b.label)}</button>`).join('');
      el.innerHTML = `<div class="card ${m.cls || ''}"><h3>${esc(m.title)}</h3><div class="body">${m.html}</div><div class="row">${buttons}</div></div>`;
      el.hidden = false;
    },
    runModal(act) {
      const m = this.modalNow;
      if (!m || act === '__backdrop') return;
      const b = m.buttons[Number(act)];
      this.nextModal();
      if (b && b.onTap) b.onTap();
      if (this.panelRoute) this.renderPanel();
      PE.Hud.refresh(true);
    },
    confirm(title, html, yesLabel, onYes, opts = {}) {
      this.modal({ title, html, cls: opts.cls, buttons: [{ label: opts.noLabel || 'Cancel', style: 'plain' }, { label: yesLabel, style: 'go', onTap: onYes }] });
    },

    toast(text, kind = '') {
      const t = document.createElement('div');
      t.className = 'toast ' + kind;
      t.textContent = text;
      const box = $('toasts');
      box.appendChild(t);
      while (box.children.length > 3) box.removeChild(box.firstChild);
      setTimeout(() => t.remove(), kind === 'big' ? 3200 : 2200);
    },

    // ---- Top bar, action buttons, bottom tabs -----------------------------------------------------
    runBar(act) {
      const [name, ...args] = act.split(':');
      const fn = PE.Hud.actions[name];
      if (fn) fn(...args);
      PE.Hud.refresh(true);
    },
  };

  const NAV = [
    { id: 'empire', label: 'Empire', icon: '🏙️' },
    { id: 'grow', label: 'Grow', icon: '🌱' },
    { id: 'collection', label: 'Collection', icon: '🃏' },
    { id: 'contracts', label: 'Contracts', icon: '📜' },
    { id: 'shop', label: 'Shop', icon: '💎' },
  ];

  const Hud = {
    last: {},
    set(id, html) { if (this.last[id] !== html) { this.last[id] = html; $(id).innerHTML = html; } },

    refresh() {
      const app = PE.App;
      if ($('hud').hidden || touching) return;
      const g = app.g, st = g.state;
      const need = g.progress.xpToNext(st.player.level);
      const pct = Math.min(100, (Money.toNumber(st.player.xp) / need) * 100);
      const chest = st.player.pendingChoices.length;
      const netDot = globalThis.navigator && navigator.onLine === false ? '<span class="off" title="Offline">offline</span>' : '';
      this.set('hud', `
        <div class="hud-top">
          <button class="lvl" data-act="profile"><b>${st.player.level}</b><i style="width:${pct.toFixed(1)}%"></i></button>
          <div class="cash">${money(st.currencies.cash)}</div>
          <div class="gems">💎 ${Money.format(st.currencies.rainbowGems)}</div>
          ${netDot}
          <button class="gear" data-act="settings" aria-label="Settings">⚙️</button>
        </div>
        <div class="goal">${esc(PE.Goals.current(g))}</div>
        ${chest ? `<button class="chest" data-act="chest">🎁 Choose your reward${chest > 1 ? ` (${chest})` : ''}</button>` : ''}`);

      const route = app.router.current();
      const inRoom = route && route.name === 'garage';
      const fid = inRoom ? route.params.fid : null;
      let bar = '';
      if (inRoom && !Dom.panelRoute) {
        const ready = g.grow.readyCount(fid);
        let canHarvestAll = false, canReplant = false;
        g.grow.eachStation((f, si, s) => { if (f !== fid) return; if (g.grow.hasStationFeature(s, 'harvestAll')) canHarvestAll = true; if (g.grow.hasStationFeature(s, 'preset')) canReplant = true; });
        if (canHarvestAll && ready > 0) bar += `<button class="btn harvest" data-act="harvestAll">Harvest All (${ready})</button>`;
        let empties = 0;
        g.grow.eachStation((f, si, s) => { if (f === fid) s.pots.forEach((p, pi) => { if (!p && s.lastStrains[pi]) empties++; }); });
        if (canReplant && empties > 0) bar += `<button class="btn replant" data-act="replantAll">Replant All (${empties})</button>`;
        if (g.facilities.canBuyStation(fid)) bar += `<button class="btn buy" data-act="buyStation">+ Station ${money(g.facilities.nextStationCost(fid))}</button>`;
      }
      this.set('actionbar', bar);

      const tab = app.currentTab();
      this.set('bottomnav', NAV.map((n) => `<button data-act="nav:${n.id}" class="${tab === n.id ? 'on' : ''}"><span>${n.icon}</span>${n.label}</button>`).join(''));
    },

    actions: {
      nav(id) { PE.App.navTo(id); },
      profile() { PE.App.openPanel('profile'); },
      settings() { PE.App.openPanel('settings'); },
      chest() { PE.Hud.showChoice(); },
      harvestAll() {
        const r = PE.App.g.grow.harvestAll(PE.App.router.current().params.fid);
        if (r.length) PE.Dom.toast(`Harvested ${r.length}: +${money(r.reduce((a, b) => a + b.cash, 0))}`);
      },
      replantAll() { PE.App.g.grow.replantAll(PE.App.router.current().params.fid); },
      buyStation() {
        const r = PE.App.g.facilities.buyStation(PE.App.router.current().params.fid);
        if (!r.ok) PE.Dom.toast(r.why === 'cash' ? 'Not enough cash yet' : 'Not available yet');
      },
    },

    showChoice() {
      const g = PE.App.g;
      const c = g.state.player.pendingChoices[0];
      if (!c) return;
      const opts = g.progress.choiceOptions(c.level);
      Dom.modal({
        title: `Level ${c.level} milestone chest`,
        html: '<p>Pick one reward.</p>',
        buttons: opts.map((o) => ({ label: o.text, style: 'go', onTap: () => { g.progress.claimChoice(c.id, o.id); } })),
        cls: 'stack',
      });
    },
  };

  PE.Dom = Dom;
  PE.Hud = Hud;
  PE.Panels = {};
})(globalThis.PE = globalThis.PE || {});

// A long press on a phone must not open the browser's own menu: that would cancel the touch.
document.addEventListener('contextmenu', (e) => e.preventDefault());
