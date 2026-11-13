// The tip box (job 21): the one line of "what to do next" (js/logic/goals.js) used to float over the map as bare text.
// Now it's a small rounded panel in the game's style, in a fixed safe spot just under the top bar:
//   - a light background, an outline, Leafy's face, one short line, and a small close button;
//   - one tip at a time; it fades away on its own after a few seconds, or as soon as the player does what it says
//     (the line changes), or when they tap the close button;
//   - a tip that's been shown isn't shown again (remembered in the save, the newest 60);
//   - hidden while the guide, a menu, a pop-up, the title or the 18+ question is up.
(function (PE) {
  const $ = (id) => document.getElementById(id);
  const SHOW_MS = 6500;
  const FADE_MS = 400;
  const KEEP = 60;
  const FACE = 'LEAFY-03';

  const Tips = {
    now: null,          // the line on screen
    extra: [],          // one-off tips waiting their turn (Tips.once)
    // A one-off tip shows once ever (remembered in its own list, ui.tipsOnce), on the screen it's about.
    onceSeen() { const ui = PE.App.state.ui; if (!Array.isArray(ui.tipsOnce)) ui.tipsOnce = []; return ui.tipsOnce; },
    once(text, where = 'empire') { if (!Tips.extra.some((t) => t.text === text) && !Tips.onceSeen().includes(text)) Tips.extra.push({ text, where }); },
    hideAt: 0,
    fading: false,
    seen() {
      const ui = PE.App.state.ui;
      if (!Array.isArray(ui.tipsSeen)) ui.tipsSeen = [];
      return ui.tipsSeen;
    },
    markSeen(text) {
      const list = Tips.seen();
      if (!list.includes(text)) list.push(text);
      while (list.length > KEEP) list.shift();
    },
    // Somewhere else is in charge of the screen right now.
    busy() {
      const app = PE.App;
      const top = app.router.current();
      if (!top || top.name === 'title' || !PE.AgeGate.answered() || app.g.tutorial.active()) return true;
      if (PE.Dom.panelRoute || PE.Dom.modalNow || (PE.Intro && PE.Intro.open)) return true;
      return !$('hud') || $('hud').hidden;
    },
    // Called often (every half second, and when the top bar redraws).
    sync() {
      const app = PE.App;
      if (!app || !app.g) return;
      const el = $('tipbox');
      if (!el) return;
      if (Tips.busy()) { if (Tips.now) Tips.hide(true); return; }
      // A one-off tip (job 23: the Event button) goes ahead of the usual "what next" line until it's been seen.
      // Only on the screen it's about (the Event button's tip on the map); elsewhere the usual line.
      const here = app.router.current().name;
      const one = Tips.extra.find((t) => t.where === here && (!Tips.onceSeen().includes(t.text) || Tips.now === t.text));
      const want = one ? one.text : PE.Goals.current(app.g);
      // Done what it said: away it goes.
      if (Tips.now && Tips.now !== want) { Tips.markSeen(Tips.now); Tips.hide(); return; }
      if (Tips.now) { if (Date.now() >= Tips.hideAt) { Tips.markSeen(Tips.now); Tips.hide(); } else Tips.place(); return; }
      if (Tips.fading || Tips.seen().includes(want)) return;
      Tips.show(want);
      if (one && !Tips.onceSeen().includes(one.text)) Tips.onceSeen().push(one.text);
    },
    show(text) {
      const el = $('tipbox');
      Tips.now = text;
      Tips.hideAt = Date.now() + SHOW_MS;
      el.innerHTML = `<img class="tip-face" src="${PE.HelperArt.url(FACE)}" alt="" draggable="false" onerror="this.style.visibility='hidden'"><p class="tip-text">${PE.Dom.esc(text)}</p><button class="tip-x" data-act="close" aria-label="Close tip">×</button>`;
      el.classList.remove('out');
      el.hidden = false;
      Tips.place();
    },
    // Just under the top bar (which is taller with a chest button), inside the safe area.
    place() {
      const el = $('tipbox');
      const hud = document.querySelector('#hud .hud-top');
      const chest = document.querySelector('#hud .chest');
      const ui = $('ui').getBoundingClientRect();
      const under = Math.max(hud ? hud.getBoundingClientRect().bottom : 0, chest ? chest.getBoundingClientRect().bottom : 0) - ui.top;
      const top = Math.round(under + 6) + 'px';
      if (el.style.top !== top) el.style.top = top;
    },
    hide(now) {
      const el = $('tipbox');
      Tips.now = null;
      if (now || PE.App.calm()) { el.hidden = true; el.innerHTML = ''; Tips.fading = false; return; }
      Tips.fading = true;
      el.classList.add('out');
      setTimeout(() => { if (!Tips.now) { el.hidden = true; el.innerHTML = ''; } Tips.fading = false; }, FADE_MS);
    },
    init() {
      PE.Dom.attachTaps($('tipbox'), (act) => { if (act === 'close' && Tips.now) { Tips.markSeen(Tips.now); PE.App.saveGame(); Tips.hide(); } });
      setInterval(() => Tips.sync(), 500);
    },
  };
  PE.Tips = Tips;
})(globalThis.PE = globalThis.PE || {});
