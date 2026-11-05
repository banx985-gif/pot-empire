// How the first-time guide looks: everything dimmed except a hole over the right button, a bouncing arrow,
// and a helper with a speech bubble. The rules are in js/logic/tutorial.js and the words in data/tutorial.js.
//
// The dim is four pieces around the hole. They catch stray taps, and the hole lets a tap straight through to
// whatever's underneath, so the player really does press the real button.
// Also here: the one-time hints, and the 18+ check at first start.
(function (PE) {
  const { esc, icon } = PE.Dom;
  const $ = (id) => document.getElementById(id);
  const names = () => Object.fromEntries(PE.Data.helpers.map((h) => [h.id, h.name]));

  // A box on the page (CSS points) for the thing the arrow points at, or null if it isn't there right now.
  const domBox = (selector) => {
    const el = document.querySelector(selector);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return r.width ? { x: r.left, y: r.top, w: r.width, h: r.height, el } : null;
  };
  const garage = () => { const s = PE.App.game.scene.getScene('garage'); return s && s.scene.isActive() && s.ready ? s : null; };
  const uiRect = () => $('ui').getBoundingClientRect();
  const around = (x, y, w, h) => { const u = uiRect(); return { x: x - w / 2 - u.left, y: y - h / 2 - u.top, w, h }; };
  const relative = (b) => { if (!b) return null; const u = uiRect(); return { ...b, x: b.x - u.left, y: b.y - u.top }; };
  const potBox = (si, pi) => { const s = garage(); if (!s || pi < 0) return null; s.showStation(si); const p = s.potPagePoint(si, pi); return around(p.x, p.y - 20, 96, 110); };
  const ripePot = () => {
    const s = garage();
    if (!s) return null;
    const g = PE.App.g;
    for (let si = 0; si < g.facilities.ownedStationCount('F01'); si++) {
      const pi = g.grow.stationOf('F01', si).pots.findIndex((p) => p && g.now() >= p.readyMs);
      if (pi >= 0) return potBox(si, pi);
    }
    return null;
  };
  const scrolled = (selector) => { const el = document.querySelector(selector); if (el && el.scrollIntoViewIfNeeded) el.scrollIntoViewIfNeeded(); return relative(domBox(selector)); };
  const POINT = {
    firstEmptyPot: () => potBox(0, PE.App.g.tutorial.emptyPot(0)),
    secondEmptyPot: () => potBox(1, PE.App.g.tutorial.emptyPot(1)),
    ripePot,
    firstBench: () => { const s = garage(); if (!s) return null; const p = s.benchPagePoint(0); return around(p.x, p.y, 170, 74); },
    firstStrain: () => relative(domBox('#panel [data-act^="plant:"]')),
    cash: () => relative(domBox('.cash')),
    upgradeLight: () => scrolled('#panel [data-act="up:lights"]'),
    closePanel: () => relative(domBox('#panel [data-act="__close"]')),
    navEmpire: () => relative(domBox('[data-act="nav:empire"]')),
  };

  const Tutorial = {
    shownStep: null,
    box: null,
    init() {
      const g = PE.App.g;
      g.tutorial.setView(() => { const c = PE.App.router.current(); return c ? c.name : null; }, () => (PE.App.router.current() || { params: {} }).params);
      PE.Dom.attachTaps($('tutor'), (act) => {
        if (act === 'next') g.tutorial.next();
        else if (act === 'skip') g.tutorial.skip();
        else if (act === 'speed') g.tutorial.speedUp();
        else return;
        PE.App.saveGame();
        Tutorial.draw(true);
      });
      setInterval(() => Tutorial.tick(), 150);
      setInterval(() => Tutorial.hintTick(), 3000);
    },
    // Not while something else has to be answered first.
    paused() {
      const top = PE.App.router.current();
      return !top || top.name === 'title' || !!PE.Dom.modalNow || !!PE.ChestReveal.now || !PE.AgeGate.answered();
    },
    active() { return !!(PE.App && PE.App.g.tutorial.active()); },
    tick() {
      const g = PE.App.g;
      if (!g.tutorial.active()) { if (!$('tutor').hidden) Tutorial.hide(); return; }
      if (Tutorial.paused()) { Tutorial.hide(); return; }
      g.tutorial.update();
      Tutorial.draw();
    },
    hide() { const el = $('tutor'); el.hidden = true; el.innerHTML = ''; Tutorial.shownStep = null; Tutorial.box = null; },
    draw(force) {
      const g = PE.App.g;
      const s = g.tutorial.step();
      if (!s) { Tutorial.hide(); return; }
      if (PE.Dom.isTouching() && !force) return;
      const el = $('tutor');
      const speed = s.speedUp && g.tutorial.canSpeedUp();
      const sig = s.id + (speed ? 'S' : '');
      if (Tutorial.shownStep !== sig) {
        Tutorial.shownStep = sig;
        Tutorial.box = null;
        const who = names()[s.who];
        el.innerHTML = `<div class="dim d-top"></div><div class="dim d-bottom"></div><div class="dim d-left"></div><div class="dim d-right"></div>
          <div class="tut-hole"></div><div class="tut-arrow">${icon('UPG-06', 54)}</div>
          <div class="tut-card">
            <img class="tut-face" src="${PE.HelperArt.url(s.face)}" alt="${esc(who)}" draggable="false">
            <div class="tut-bubble"><b>${esc(who)}</b><p>${esc(s.text)}</p>
              <div class="tut-row"><button class="tut-skip" data-act="skip">Skip guide</button>
              ${speed ? `<button class="btn small go" data-act="speed">${icon('STA-04', 18)}Grow it now</button>` : ''}
              ${s.until === 'next' ? '<button class="btn small go" data-act="next">Next</button>' : ''}</div>
            </div>
          </div>`;
        el.hidden = false;
        if (!PE.App.state.settings.reducedMotion) el.classList.add('moving');
        PE.Sound.play('helper');
      }
      Tutorial.place(s);
    },
    place(s) {
      const el = $('tutor');
      const W = $('ui').clientWidth, H = $('ui').clientHeight;
      const b = s.point && POINT[s.point] ? POINT[s.point]() : null;
      const sig = b ? `${Math.round(b.x)},${Math.round(b.y)},${Math.round(b.w)},${Math.round(b.h)}` : 'none';
      if (Tutorial.box === sig) return;
      Tutorial.box = sig;
      const pad = 6;
      const hole = b ? { x: Math.max(0, b.x - pad), y: Math.max(0, b.y - pad), w: b.w + pad * 2, h: b.h + pad * 2 } : { x: 0, y: H, w: 0, h: 0 };
      const set = (q, css) => Object.assign(el.querySelector(q).style, css);
      set('.d-top', { left: 0, top: 0, width: `${W}px`, height: `${hole.y}px` });
      set('.d-bottom', { left: 0, top: `${hole.y + hole.h}px`, width: `${W}px`, height: `${Math.max(0, H - hole.y - hole.h)}px` });
      set('.d-left', { left: 0, top: `${hole.y}px`, width: `${hole.x}px`, height: `${hole.h}px` });
      set('.d-right', { left: `${hole.x + hole.w}px`, top: `${hole.y}px`, width: `${Math.max(0, W - hole.x - hole.w)}px`, height: `${hole.h}px` });
      set('.tut-hole', { left: `${hole.x}px`, top: `${hole.y}px`, width: `${hole.w}px`, height: `${hole.h}px`, display: b ? 'block' : 'none' });
      const arrow = el.querySelector('.tut-arrow');
      if (b) {
        // Above the target if there's room, otherwise below it pointing up.
        const above = hole.y > 70;
        arrow.style.display = 'block';
        arrow.style.left = `${Math.min(W - 58, Math.max(4, hole.x + hole.w / 2 - 27))}px`;
        arrow.style.top = above ? `${hole.y - 60}px` : `${hole.y + hole.h + 4}px`;
        arrow.classList.toggle('pointing-down', above);
      } else arrow.style.display = 'none';
      // The speech card goes wherever the target isn't.
      const card = el.querySelector('.tut-card');
      const low = !b || hole.y + hole.h / 2 < H * 0.55;
      card.classList.toggle('at-bottom', low);
      card.classList.toggle('at-top', !low);
    },
    // ---- One-time hints ---------------------------------------------------------------------------------------
    hintTick() {
      const g = PE.App.g;
      if (g.tutorial.active() || Tutorial.paused() || PE.Dom.isTouching() || PE.HelperUI.now || PE.HelperUI.waiting.length) return;
      if (performance.now() - (Tutorial.lastHint || -60000) < 20000) return;
      const h = g.tutorial.dueHint();
      if (!h) return;
      g.tutorial.markHint(h.id);
      Tutorial.lastHint = performance.now();
      if (PE.App.state.settings.helpers) PE.HelperUI.add({ helper: h.who, name: names()[h.who], text: h.text, face: h.face, hint: true });
      else PE.Dom.toast(h.text, 'big', 'SYS-05');
      PE.App.saveGame();
    },
    skipForTest() { const g = PE.App.g; g.tutorial.skip(); PE.Data.tutorial.hints.forEach((h) => g.tutorial.markHint(h.id)); Tutorial.hide(); },
  };
  PE.Tutorial = Tutorial;

  // ---- The 18+ check and fiction notice: once, on first start -------------------------------------------------------
  const AgeGate = {
    answered: () => !!PE.App.state.consent && PE.App.state.consent.ageOk === true,
    init() {
      const el = $('agegate');
      PE.Dom.attachTaps(el, (act) => {
        if (act === 'yes') {
          PE.App.state.consent = { ageOk: true, atUtc: new Date().toISOString() };
          PE.App.saveGame();
          el.hidden = true;
          el.innerHTML = '';
        } else if (act === 'no') AgeGate.drawGoodbye();
        else if (act === 'back') AgeGate.draw();
      });
      if (!AgeGate.answered()) AgeGate.draw();
    },
    draw() {
      const T = PE.Data.tutorial.ageGate;
      const el = $('agegate');
      const face = PE.Data.helperSprites.screens.title;
      el.innerHTML = `<div class="age-box"><img class="age-logo" src="assets/ui/LOGO-01.webp" alt="Pot Empire Tycoon" draggable="false">
        <img class="age-haze" src="${PE.HelperArt.url(face)}" alt="" draggable="false">
        <p class="age-q">${esc(T.question)}</p>
        <button class="btn go wide" data-act="yes">${esc(T.yes)}</button>
        <button class="btn plain wide" data-act="no">${esc(T.no)}</button>
        <p class="muted center">${esc(T.notice)}</p></div>`;
      el.hidden = false;
    },
    drawGoodbye() {
      const T = PE.Data.tutorial.ageGate;
      $('agegate').innerHTML = `<div class="age-box"><img class="age-logo" src="assets/ui/LOGO-01.webp" alt="Pot Empire Tycoon" draggable="false">
        <p class="age-q">${esc(T.goodbye)}</p>
        <button class="btn plain wide" data-act="back">${esc(T.back)}</button></div>`;
    },
    acceptForTest() {
      PE.App.state.consent = { ageOk: true, atUtc: 'test' };
      $('agegate').hidden = true;
      $('agegate').innerHTML = '';
    },
  };
  PE.AgeGate = AgeGate;
})(globalThis.PE = globalThis.PE || {});
