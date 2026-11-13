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
  const potBox = (si, pi) => { const s = garage(); if (!s || pi < 0) return null; s.showStation(si); s.showPot(si, pi); const p = s.potPagePoint(si, pi); return around(p.x, p.y - 20, 96, 110); };
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
    // The pot, or if they tapped it and the strain list came up, the strain.
    // Once the seed stash is open (job 18), the stash and the pot together, so both can be touched.
    seedTarget: () => {
      if (document.querySelector('#panel [data-act^="plant:"]')) return relative(domBox('#panel [data-act^="plant:"]'));
      const pot = potBox(0, PE.App.g.tutorial.emptyPot(0));
      const stash = document.getElementById('seed-stash');
      if (!stash || !pot) return pot;
      const r = relative(stash.getBoundingClientRect());
      const x = Math.min(pot.x, r.x), y = Math.min(pot.y, r.y);
      return { x, y, w: Math.max(pot.x + pot.w, r.x + r.width) - x, h: Math.max(pot.y + pot.h, r.y + r.height) - y };
    },
    // The pump, then its Spray! button once the tank's full (job 18).
    pump: () => { const s = garage(); if (!s) return null; s.showPump(0); const p = s.pumpPagePoint(0); if (!p) return null; return p.spray ? around(p.x, p.y, 190, 90) : around(p.x, p.y, 150, 200); },
    firstPlant: () => { const s = garage(); if (!s) return null; const pi = PE.App.g.grow.stationOf('F01', 0).pots.findIndex(Boolean); return pi < 0 ? null : potBox(0, pi); },
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
    still() { return PE.App.calm(); },
    tick() {
      const g = PE.App.g;
      if (!g.tutorial.active()) { if (!$('tutor').hidden) Tutorial.hide(); return; }
      if (Tutorial.paused()) { Tutorial.hide(); return; }
      // The very first time: the story first.
      if (PE.Intro.open) { Tutorial.hide(); return; }
      if (PE.Intro.due()) { PE.Intro.show(); Tutorial.hide(); return; }
      g.tutorial.update();
      Tutorial.draw();
    },
    hide() { const el = $('tutor'); el.hidden = true; el.innerHTML = ''; el.className = ''; document.body.classList.remove('tut-open'); Tutorial.stopHand(); Tutorial.shownStep = null; Tutorial.box = null; },
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
        const dims = '<div class="dim d-top"></div><div class="dim d-bottom"></div><div class="dim d-left"></div><div class="dim d-right"></div><div class="tut-hole"></div>';
        const big = PE.AnimDom.html(s.who, Math.round($('ui').clientHeight * 0.4));
        if (s.talk) {
          // The big talker: bottom half of the screen, round bubble, Continue.
          el.innerHTML = `${dims}<div class="tut-talk"><div class="talk-who">${big}</div>
            <div class="talk-bubble"><b>${esc(who)}</b><p class="talk-line">${esc(s.text)}</p></div>
            <div class="talk-row"><button class="btn go" data-act="next">Continue</button><button class="tut-skip" data-act="skip">Skip guide</button></div></div>`;
        } else {
          // A spiky tip: one line, no button, gone when the thing is done.
          el.innerHTML = `${dims}<div class="tut-arrow">${icon('UPG-06', 54)}</div><div class="tut-hand" hidden>${PE.GrowTools.HAND}</div>
            <div class="tut-tip"><b class="sr">${esc(who)}: </b>${esc(s.text)}</div>
            <div class="tip-row">${speed ? `<button class="btn small go" data-act="speed">${icon('STA-04', 18)}Grow it now</button>` : ''}<button class="tut-skip" data-act="skip">Skip guide</button></div>`;
        }
        if (s.talk) {
          const box = el.querySelector('.tut-talk .anim-box');
          const move = s.move || 'chat';
          let typing = true;
          PE.AnimDom.play(box, move, move === 'chat' ? {} : { done: () => { if (typing && box.isConnected) PE.AnimDom.play(box, 'chat'); } });
          PE.Talk.typeOut(el.querySelector('.tut-talk .talk-line'), s.text, () => { typing = false; if (box.dataset.move === 'chat') PE.AnimDom.settle(box); });
        }
        el.className = s.drag ? 'open' : '';
        document.body.classList.add('tut-open');
        const nav = $('bottomnav');
        if (nav) nav.classList.toggle('ok', s.until === 'onMap');
        el.hidden = false;
        if (!Tutorial.still()) el.classList.add('moving');
        PE.Sound.play('helper');
        Tutorial.stopHand();
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
      Tutorial.guideHand(s, b);
      const set = (q, css) => Object.assign(el.querySelector(q).style, css);
      set('.d-top', { left: 0, top: 0, width: `${W}px`, height: `${hole.y}px` });
      set('.d-bottom', { left: 0, top: `${hole.y + hole.h}px`, width: `${W}px`, height: `${Math.max(0, H - hole.y - hole.h)}px` });
      set('.d-left', { left: 0, top: `${hole.y}px`, width: `${hole.x}px`, height: `${hole.h}px` });
      set('.d-right', { left: `${hole.x + hole.w}px`, top: `${hole.y}px`, width: `${Math.max(0, W - hole.x - hole.w)}px`, height: `${hole.h}px` });
      set('.tut-hole', { left: `${hole.x}px`, top: `${hole.y}px`, width: `${hole.w}px`, height: `${hole.h}px`, display: b ? 'block' : 'none' });
      const arrow = el.querySelector('.tut-arrow');
      if (arrow && s.drag) arrow.style.display = 'none';
      else if (arrow && b) {
        // Above the target if there's room, otherwise below it pointing up.
        const above = hole.y > 70;
        arrow.style.display = 'block';
        arrow.style.left = `${Math.min(W - 58, Math.max(4, hole.x + hole.w / 2 - 27))}px`;
        arrow.style.top = above ? `${hole.y - 60}px` : `${hole.y + hole.h + 4}px`;
        arrow.classList.toggle('pointing-down', above);
      } else if (arrow) arrow.style.display = 'none';
      // The tip goes wherever the target isn't.
      const low = !b || hole.y + hole.h / 2 < H * 0.55;
      for (const q of ['.tut-tip', '.tip-row']) {
        const card = el.querySelector(q);
        if (card) { card.classList.toggle('at-bottom', low); card.classList.toggle('at-top', !low); }
      }
    },
    // The guide hand: shows the arc from the tool to the target, the first time. It stops when the step does.
    stopHand() { if (Tutorial.handAnim) { Tutorial.handAnim.cancel(); Tutorial.handAnim = null; } },
    guideHand(s, b) {
      const hand = $('tutor').querySelector('.tut-hand');
      if (!hand) return;
      if (!s.drag || !b || document.querySelector('#panel [data-act^="plant:"]')) { hand.hidden = true; Tutorial.stopHand(); return; }
      const u = uiRect();
      let a, z;
      if (s.drag === 'flick') {
        // A swipe right across the ripe plant (job 18).
        a = { x: b.x - 90, y: b.y + b.h / 2 - 10 }; z = { x: b.x + b.w + 60, y: b.y + b.h / 2 - 30 };
      } else {
        // The seed: from the first packet in the stash onto the pot, once the stash is open.
        const from = PE.GrowTools.point(s.drag);
        if (!from) { hand.hidden = true; Tutorial.stopHand(); return; }
        const S = PE.GrowTools.stashAt, to = S && PE.GrowTools.potOnPage(S.si, S.pi);
        a = { x: from.x - u.left - 18, y: from.y - u.top - 10 };
        z = to ? { x: to.x - u.left - 18, y: to.y - u.top - 30 } : { x: b.x + b.w / 2 - 18, y: b.y + b.h / 2 - 10 };
      }
      const key = `${s.drag}|${Math.round(a.x)}|${Math.round(a.y)}|${Math.round(z.x)}|${Math.round(z.y)}`;
      if (Tutorial.handKey === key && Tutorial.handAnim) return;
      Tutorial.handKey = key;
      hand.hidden = false;
      Tutorial.stopHand();
      if (Tutorial.still()) { hand.style.transform = `translate(${z.x}px, ${z.y}px)`; return; }
      const mid = { x: (a.x + z.x) / 2, y: Math.min(a.y, z.y) - 70 };
      Tutorial.handAnim = hand.animate([
        { transform: `translate(${a.x}px, ${a.y}px)`, opacity: 0, offset: 0 },
        { transform: `translate(${a.x}px, ${a.y}px)`, opacity: 1, offset: 0.1 },
        { transform: `translate(${mid.x}px, ${mid.y}px)`, opacity: 1, offset: 0.45, easing: 'ease-in' },
        { transform: `translate(${z.x}px, ${z.y}px)`, opacity: 1, offset: 0.8 },
        { transform: `translate(${z.x}px, ${z.y}px)`, opacity: 0, offset: 1 },
      ], { duration: 1700, iterations: Infinity, easing: 'ease-in-out' });
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
      if (PE.App.state.settings.helpers) PE.HelperUI.add({ helper: h.who, name: names()[h.who], text: h.text, face: h.face, move: h.move, hint: true });
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
