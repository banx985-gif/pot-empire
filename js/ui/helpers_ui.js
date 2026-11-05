// How helpers and celebrations look. The rules (js/logic/helpers.js) decide when; this draws them.
//
// Helper line: the game behind goes dark, the helper pops up in front of a graffiti splash with a
// speech bubble (the look from docs/DESIGN_NOTES.md). One tap anywhere closes it, and it closes by
// itself after a few seconds. It waits while a pop-up is open or a finger is down.
// Celebration: a short banner with confetti at the top of the screen. It never blocks the game:
// taps go straight through to the room, except on the banner itself, which closes it.
(function (PE) {
  const { esc } = PE.Dom;
  const $ = (id) => document.getElementById(id);
  const B = () => PE.App.g.B;
  const still = () => PE.App.state.settings.reducedMotion || (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  // Budz and Leafy have no art yet: a plain code-drawn badge stands in (listed in the asset registry).
  const STAND_IN = { BUDZ: { icon: '🌱', cls: 'budz' }, LEAFY: { icon: '🍃', cls: 'leafy' } };
  function portrait(helper, name) {
    if (helper === 'HAZE') return `<img class="who-img" src="assets/helpers/HAZE.webp" alt="${esc(name)}">`;
    const s = STAND_IN[helper];
    return `<div class="who-ph ${s.cls}"><span>${s.icon}</span><em>${esc(name)}<br>art coming soon</em></div>`;
  }

  const HelperUI = {
    waiting: [],
    now: null,
    timer: null,
    add(e) {
      if (e.replay) this.waiting.unshift(e);
      else if (this.waiting.length < 2) this.waiting.push(e);
    },
    canShow() {
      const app = PE.App;
      if (!app || !app.game || PE.Dom.modalNow || PE.Dom.isTouching()) return false;
      const top = app.router.current();
      return !!top && top.name !== 'title';
    },
    pump() {
      if (this.now || !this.waiting.length || !this.canShow()) return;
      const e = this.now = this.waiting.shift();
      const el = $('helper');
      el.className = still() ? 'still' : '';
      el.innerHTML = `<div class="helper-pop" data-act="skip">
          <div class="splash"><i></i><i></i><i></i></div>
          <div class="who">${portrait(e.helper, e.name)}</div>
          <div class="bubble"><b>${esc(e.name)}</b><p>${esc(e.text)}</p><small>Tap anywhere to skip</small></div>
        </div>`;
      el.hidden = false;
      clearTimeout(this.timer);
      this.timer = setTimeout(() => this.close(), B().helpers.showSeconds * 1000);
    },
    close() {
      clearTimeout(this.timer);
      this.now = null;
      const el = $('helper');
      el.hidden = true;
      el.innerHTML = '';
    },
  };

  const CONFETTI = 14;
  const Celebrate = {
    waiting: [],
    now: null,
    timer: null,
    add(e) {
      if (this.waiting.length >= B().celebrations.maxWaiting) this.waiting.shift();   // keep the newest
      this.waiting.push(e);
      this.pump();
    },
    pump() {
      if (this.now || !this.waiting.length || !PE.App || !PE.App.game) return;
      const e = this.now = this.waiting.shift();
      const calm = still();
      const small = e.kind === 'station';
      const el = $('celebrate');
      el.className = `${calm ? 'still' : ''} ${small ? 'small' : ''}`;
      const bits = calm || small ? '' : Array.from({ length: CONFETTI }, (_, i) => `<i style="--i:${i}"></i>`).join('');
      el.innerHTML = `<div class="confetti">${bits}</div><div class="banner" data-act="skip"><span class="stars">✦ ✧ ✦</span><b>${esc(e.text)}</b></div>`;
      el.hidden = false;
      clearTimeout(this.timer);
      const C = B().celebrations;
      this.timer = setTimeout(() => this.close(), (calm ? C.reducedMotionSeconds : C.seconds) * 1000);
    },
    close() {
      clearTimeout(this.timer);
      this.now = null;
      const el = $('celebrate');
      el.hidden = true;
      el.innerHTML = '';
      setTimeout(() => this.pump(), 120);
    },
  };

  PE.HelperUI = HelperUI;
  PE.Celebrate = Celebrate;
  PE.HelperUI.init = () => {
    PE.Dom.attachTaps($('helper'), () => HelperUI.close());
    PE.Dom.attachTaps($('celebrate'), (act) => { if (act === 'skip') Celebrate.close(); });
    setInterval(() => HelperUI.pump(), 400);
  };
})(globalThis.PE = globalThis.PE || {});
