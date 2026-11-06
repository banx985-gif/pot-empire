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
  // A piece of interface art (art/ui, listed in UI_ART.md). Not lazy-loaded: once a small icon has been fetched,
  // a redraw shows it again in the same instant, so a menu that refreshes each second never flickers.
  const icon = (id, size = 20, cls = '') => `<img class="ico ${cls}" src="assets/ui/${id}.webp" width="${size}" height="${size}" alt="" draggable="false">`;
  const RARITY_ICON = { Common: 'RAR-01', Uncommon: 'RAR-02', Rare: 'RAR-03', Epic: 'RAR-04', Legendary: 'RAR-05', Mythic: 'RAR-06' };
  const rarityIcon = (r, size = 14) => (RARITY_ICON[r] ? icon(RARITY_ICON[r], size, 'r-ico') : '');
  const qualityIcon = (grade, size = 18) => icon('QLT-0' + (Number(grade) + 1), size, 'q-ico');
  // What each kind of place looks like in a list.
  const MODE_ICON = { Grow: 'NAV-02', Retail: 'BIZ-01', Factory: 'BIZ-02', Research: 'BIZ-04', Logistics: 'BIZ-03', Prestige: 'GOL-04' };
  const modeIcon = (mode, size = 30) => icon(MODE_ICON[mode], size);

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
  // A finger tap arrives as pointerdown, pointerup, then touchend, and the game acts on touchend. So for
  // fingers "a finger is down" only ends at touchend: if it ended at pointerup, a menu's once-a-second
  // redraw could slip in before touchend, replace the button, and the tap would be lost (the cause of
  // the two taps that failed in job 002; tools/browser_lost_tap.js shows it).
  // If the thing under the finger is removed while it's down (a pop-up closing by itself), that touchend never reaches
  // the page, so nothing would say the finger had gone, and the top bar and menus would stop redrawing until the next
  // touch. So a finger's pointerup also ends it, a moment later, well after any real touchend.
  let touching = false;
  let touchSeq = 0;
  window.addEventListener('pointerdown', () => { touchSeq += 1; }, true);
  window.addEventListener('pointerup', (e) => {
    if (e.pointerType !== 'touch') { touching = false; return; }
    const seq = touchSeq;
    setTimeout(() => { if (seq === touchSeq) touching = false; }, 350);
  }, true);
  window.addEventListener('pointercancel', () => { touching = false; }, true);
  window.addEventListener('touchend', (e) => { if (!e.touches || !e.touches.length) setTimeout(() => { touching = false; }, 0); }, true);
  window.addEventListener('touchcancel', () => { touching = false; }, true);

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
    // Heard on the whole window, not just this menu: if the button under the finger was replaced anyway,
    // its touchend would go to a button no longer on the page and never reach the menu.
    window.addEventListener('touchend', (e) => {
      if (!down) return;   // this tap didn't start here
      // A text box needs the browser's own touch handling to get the keyboard up.
      if (e.target.closest && e.target.closest('input, textarea, select, label')) { down = null; return; }
      if (e.cancelable) e.preventDefault();
      const c = e.changedTouches[0];
      if (c) finish(c.clientX, c.clientY);
    }, { passive: false });
    el.addEventListener('pointercancel', () => { down = null; });
  }

  const Dom = {
    esc, money, duration, strainThumb, attachTaps, icon, rarityIcon, qualityIcon, modeIcon,
    isTouching: () => touching,
    panelRoute: null,

    init() {
      attachTaps($('panel'), (act) => this.runAction(act));
      attachTaps($('modal'), (act) => this.runModal(act));
      attachTaps($('hud'), (act) => this.runBar(act));
      attachTaps($('actionbar'), (act) => this.runBar(act));
      attachTaps($('bottomnav'), (act) => this.runBar(act));
      setInterval(() => this.liveTick(), 1000);
    },

    // The once-a-second redraw of menus with timers. Never while a finger is on the screen.
    liveTick() {
      if (!touching && this.panelRoute && this.panelDef().live) this.renderPanel();
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
      el.className = `${def.sheet ? 'is-sheet' : 'is-full'}${fresh ? ' enter' : ''}`;
      el.innerHTML = `<div class="box"><header><button data-act="__close" class="closer ${def.sheet ? "" : "back"}" aria-label="${def.sheet ? "Close" : "Back"}">${icon(def.sheet ? "SYS-04" : "SYS-03", 30)}</button><h2>${esc(title)}</h2></header><div class="scroll">${body}</div></div>`;
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
      const buttons = m.buttons.map((b, i) => `<button class="btn ${b.style || ''}" data-act="${i}">${b.icon ? icon(b.icon, 22) : ''}${esc(b.label)}</button>`).join('');
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

    toast(text, kind = '', iconId = null) {
      const t = document.createElement('div');
      t.className = 'toast ' + kind;
      t.textContent = text;
      if (iconId) t.insertAdjacentHTML('afterbegin', icon(iconId, 24));
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
    { id: 'empire', label: 'Empire', icon: 'NAV-01' },
    { id: 'grow', label: 'Grow', icon: 'NAV-02' },
    { id: 'collection', label: 'Collection', icon: 'NAV-03' },
    { id: 'contracts', label: 'Contracts', icon: 'NAV-04' },
    { id: 'shop', label: 'Shop', icon: 'NAV-05' },
  ];

  const Hud = {
    last: {},
    set(id, html) {
      if (this.last[id] === html) return;
      this.last[id] = html;
      $(id).innerHTML = html;
      // The bar was rebuilt, so the number needs putting straight back.
      if (id === 'hud') { const c = PE.Juice.Counter; const el = $('cash-num'); if (el && c.shown !== null) el.textContent = c.text(c.shown); }
    },

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
          <div class="cash">${icon('CUR-01', 28)}<span id="cash-num"></span></div>
          <div class="gems">${icon('CUR-02', 24)}${Money.format(st.currencies.rainbowGems)}</div>
          ${netDot}
          <button class="gear" data-act="settings" aria-label="Settings">${icon('SYS-01', 34)}</button>
        </div>
        <div class="goal">${esc(PE.Goals.current(g))}</div>
        ${chest ? `<button class="chest" data-act="chest">${icon('RWD-01', 26)}Choose your reward${chest > 1 ? ` (${chest})` : ''}</button>` : ''}`);
      PE.Juice.Counter.sync();

      const route = app.router.current();
      const inRoom = route && route.name === 'garage';
      const fid = inRoom ? route.params.fid : null;
      let bar = '';
      if (inRoom && !Dom.panelRoute) {
        const ready = g.grow.readyCount(fid);
        let canHarvestAll = false, canReplant = false;
        g.grow.eachStation((f, si, s) => { if (f !== fid) return; if (g.grow.hasStationFeature(s, 'harvestAll')) canHarvestAll = true; if (g.grow.hasStationFeature(s, 'preset')) canReplant = true; });
        if (canHarvestAll && ready > 0) bar += `<button class="btn harvest" data-act="harvestAll">${icon('ACT-03', 24)}Harvest All (${ready})</button>`;
        let empties = 0;
        g.grow.eachStation((f, si, s) => { if (f === fid) s.pots.forEach((p, pi) => { if (!p && s.lastStrains[pi]) empties++; }); });
        if (canReplant && empties > 0) bar += `<button class="btn replant" data-act="replantAll">${icon('ACT-06', 24)}Replant All (${empties})</button>`;
        if (g.facilities.rows.filter((r) => g.facilities.isOwned(r.id)).length > 1) bar += `<button class="btn rooms" data-act="rooms">${icon('BIZ-06', 24)}Rooms</button>`;
        if (g.facilities.canBuyStation(fid)) bar += `<button class="btn buy" data-act="buyStation">+ Station ${money(g.facilities.nextStationCost(fid))}</button>`;
      }
      if (route && route.name === 'empire' && !Dom.panelRoute && PE.MapBar) bar = PE.MapBar.html();
      if (route && route.name === 'bizroom' && !Dom.panelRoute) bar = `<button class="btn go" data-act="manage">${icon('BIZ-06', 24)}Manage</button>`;
      this.set('actionbar', bar);
      if (PE.GrowTools) PE.GrowTools.sync();

      const tab = app.currentTab();
      this.set('bottomnav', NAV.map((n) => `<button data-act="nav:${n.id}" class="${tab === n.id ? 'on' : ''}"><span>${icon(n.icon, 32)}</span>${n.label}</button>`).join(''));
    },

    actions: {
      nav(id) { PE.App.navTo(id); },
      profile() { PE.App.openPanel('profile'); },
      settings() { PE.App.openPanel('settings'); },
      chest() { PE.Hud.showChoice(); },
      harvestAll() {
        const r = PE.App.g.grow.harvestAll(PE.App.router.current().params.fid);
        if (r.length) PE.Dom.toast(`Harvested ${r.length}: +${money(r.reduce((a, b) => a + b.cash, 0))}`, '', 'ACT-03');
      },
      replantAll() { PE.App.g.grow.replantAll(PE.App.router.current().params.fid); },
      manage() { PE.App.openPanel('business', { fid: PE.App.router.current().params.fid }); },
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

  // A character portrait (manager, rival or VIP). Hides itself if it can't load.
  Dom.portrait = (id, name, cls = '') => `<img class="portrait ${cls}" src="assets/characters/${id}.webp" alt="${esc(name)}" loading="lazy" draggable="false" onerror="this.style.visibility='hidden'">`;

  // The faces of whoever works somewhere: used on station, shop, factory and depot manager rows.
  Dom.managerFaces = (ids) => (ids.length ? `<span class="face-row">${ids.map((id) => { const m = PE.App.g.collections.item(id); return Dom.portrait(id, m.name, `small r-bg-${m.rarity}`).replace('loading="lazy" ', ''); }).join('')}</span>` : '');

  // A small picture of a hydro model built from its real pieces, for the model upgrade preview.
  Dom.hydroPreview = (m) => {
    const A = PE.Data.hydroAnchors[m], [fw, fh] = PE.Data.hydroArt[`M${m}-FRAME`];
    const pct = (x, y) => `left:${(x / fw) * 100}%;top:${(y / fh) * 100}%`;
    const url = (part) => `assets/hydro/M${m}/HY-M${m}-${part}.webp`;
    const [[x0, y0], [x1, y1]] = A.holes;
    const pots = [2, 3].map((k) => `<img class="hy-pot" style="${pct(x0 + ((x1 - x0) * k) / 6, y0 + ((y1 - y0) * k) / 6)}" src="${url('POT-1')}" alt="">`).join('');
    return `<div class="hy-preview" style="aspect-ratio:${fw}/${fh}"><img class="hy-frame" src="${url('FRAME')}" alt="">${pots}
      <img class="hy-light" style="${pct(A.hangX, A.railY - 6)}" src="${url('LGT-1')}" alt="">
      <img class="hy-badge" style="${pct(A.badge[0], A.badge[1])}" src="${url('BADGE')}" alt=""></div>`;
  };

  // A strain's neon logo, always on its dark backing (they're neon linework drawn for dark).
  Dom.logo = (strainId, size = 30) => `<span class="logo-badge" style="width:${size}px;height:${size}px"><img src="assets/logos/${strainId}.webp" alt="" draggable="false" loading="lazy"></span>`;
  // A strain's graffiti name badge for the profile. Six aren't drawn yet: those show the logo instead.
  Dom.avatarDrawn = (strainId) => PE.Data.uiArt.avatarsDrawn.includes(strainId);
  Dom.avatarPic = (strainId, size = 44) => (Dom.avatarDrawn(strainId)
    ? `<span class="logo-badge" style="width:${size}px;height:${size}px"><img src="assets/avatars/${strainId}.webp" alt="" draggable="false" loading="lazy"></span>`
    : Dom.logo(strainId, size));

  PE.Dom = Dom;
  PE.Hud = Hud;
  PE.Panels = {};
})(globalThis.PE = globalThis.PE || {});

// A long press on a phone must not open the browser's own menu: that would cancel the touch.
document.addEventListener('contextmenu', (e) => e.preventDefault());
