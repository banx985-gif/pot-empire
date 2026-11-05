// How helpers and celebrations look. The rules (js/logic/helpers.js) decide when; this draws them.
// Which picture goes with which moment is data: data/jokes.js and data/helper_sprites.js.
//
// Helper line: the game behind goes dark, the helper pops up in front of a graffiti splash with a
// speech bubble (the look from docs/DESIGN_NOTES.md). One tap anywhere closes it, and it closes by
// itself after a few seconds. It waits while a pop-up is open or a finger is down.
// While the bubble is open the helper feels alive without any rigging: a longer line changes to a
// second expression partway through, and blink frames are swapped in for a moment now and then.
// Reduced motion switches all of that off and leaves one still picture.
// Celebration: a short banner with confetti at the top of the screen, with a helper cheering under it.
// It never blocks the game: taps go straight through to the room, except on the banner itself, which
// closes it.
//
// Speed: a picture is only fetched when it's about to show, and the ones held ready for a line are
// let go when the bubble closes, so phones only ever hold a handful in memory.
(function (PE) {
  const { esc } = PE.Dom;
  const $ = (id) => document.getElementById(id);
  const B = () => PE.App.g.B;
  const Art = () => PE.Data.helperSprites;
  const still = () => PE.App.state.settings.reducedMotion || (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  const HelperArt = {
    url: (id) => `assets/helpers/${id}.webp`,
    // A picture that fades out of the way if it can't load (no network, not saved yet).
    img: (id, name, cls = '') => `<img class="${cls}" src="${HelperArt.url(id)}" alt="${esc(name)}" loading="lazy" draggable="false" onerror="this.style.visibility='hidden'">`,
    // A helper with a small speech bubble, for the menus.
    says: (id, text, name) => `<div class="helper-says">${HelperArt.img(id, name)}<p>${esc(text)}</p></div>`,
    // Can this blink frame be swapped over this face without the body jumping?
    fits(helper, face) {
      const b = Art().blink[helper];
      const n = Number(String(face).split('-')[1]);
      return !!b && n >= b.fits.from && n <= b.fits.to;
    },
  };
  PE.HelperArt = HelperArt;

  const HelperUI = {
    waiting: [],
    now: null,
    timer: null,
    extras: [],    // the other timers for the line on screen
    ready: {},     // pictures held ready for the line on screen, let go on close
    face: null,    // the expression showing now (a blink frame comes back to this)
    add(e) {
      if (e.replay) this.waiting.unshift(e);
      else if (this.waiting.length < 2) this.waiting.push(e);
    },
    canShow() {
      const app = PE.App;
      if (!app || !app.game || PE.Dom.modalNow || PE.Dom.isTouching() || (PE.ChestReveal && PE.ChestReveal.now)) return false;
      const top = app.router.current();
      return !!top && top.name !== 'title';
    },
    pump() {
      if (this.now || !this.waiting.length || !this.canShow()) return;
      const e = this.now = this.waiting.shift();
      const calm = still();
      const face = e.face || Art().defaultFace[e.helper];
      this.face = face;
      const el = $('helper');
      el.className = calm ? 'still' : '';
      el.innerHTML = `<div class="helper-pop" data-act="skip">
          <div class="who"><div class="splash"><i></i><i></i><i></i></div>${HelperArt.img(face, e.name, 'who-img').replace('loading="lazy" ', '')}</div>
          <div class="bubble"><b>${esc(e.name)}</b><p>${esc(e.text)}</p><small>Tap anywhere to skip</small></div>
        </div>`;
      el.hidden = false;
      clearTimeout(this.timer);
      const H = B().helpers;
      this.timer = setTimeout(() => this.close(), H.showSeconds * 1000);
      if (!calm) this.liven(e, H);
    },
    // The second expression and the blink frames. Pictures are fetched first, and only swapped in once
    // they're ready, so the helper never flashes blank.
    liven(e, H) {
      const wantSecond = e.face2 && e.text.length >= H.secondFaceMinChars;
      if (wantSecond) {
        this.hold(e.face2);
        this.extras.push(setTimeout(() => { if (this.show(e.face2)) this.face = e.face2; }, H.showSeconds * H.secondFaceAtShare * 1000));
      }
      const blink = Art().blink[e.helper];
      if (!blink) return;
      // Only fetch blink frames if this line will reach a face they fit over.
      if (HelperArt.fits(e.helper, this.face) || (wantSecond && HelperArt.fits(e.helper, e.face2))) blink.frames.forEach((id) => this.hold(id));
      let next = 0;
      this.extras.push(setInterval(() => {
        if (!HelperArt.fits(e.helper, this.face)) return;
        const frame = blink.frames[next++ % blink.frames.length];
        if (!this.show(frame)) return;
        this.extras.push(setTimeout(() => this.show(this.face), H.blinkHoldMs));
      }, H.blinkEverySeconds * 1000));
    },
    hold(id) {
      if (this.ready[id]) return;
      const img = new Image();
      img.src = HelperArt.url(id);
      this.ready[id] = img;
    },
    // Puts a picture on screen if it's ready. A picture already showing is always fine.
    show(id) {
      const pic = document.querySelector('#helper img.who-img');
      if (!pic || !this.now) return false;
      const held = this.ready[id];
      if (id !== this.face && !(held && held.complete && held.naturalWidth > 0)) return false;
      pic.src = HelperArt.url(id);
      pic.dataset.face = id;
      return true;
    },
    close() {
      clearTimeout(this.timer);
      this.extras.forEach((t) => { clearTimeout(t); clearInterval(t); });
      this.extras = [];
      this.ready = {};
      this.face = null;
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
    turns: {},    // whose turn it is to cheer, by kind of celebration
    add(e) {
      if (this.waiting.length >= B().celebrations.maxWaiting) this.waiting.shift();   // keep the newest
      this.waiting.push(e);
      this.pump();
    },
    // The helper cheering on this banner, or nothing. The helpers switch off in Settings here too.
    cheer(kind) {
      const list = Art().celebrate[kind];
      if (!list || !list.length || !PE.App.state.settings.helpers) return '';
      const turn = this.turns[kind] = (this.turns[kind] || 0) + 1;
      const id = list[(turn - 1) % list.length];
      const size = B().helpers.celebrateHelperSize;
      return `<img class="cheer" src="${HelperArt.url(id)}" alt="" width="${size}" height="${size}" data-face="${id}" draggable="false" onerror="this.style.visibility='hidden'">`;
    },
    pump() {
      if (this.now || !this.waiting.length || !PE.App || !PE.App.game) return;
      const e = this.now = this.waiting.shift();
      const calm = still();
      const small = e.kind === 'station';
      const el = $('celebrate');
      el.className = `${calm ? 'still' : ''} ${small ? 'small' : ''}`;
      const bits = calm || small ? '' : Array.from({ length: CONFETTI }, (_, i) => `<i style="--i:${i}"></i>`).join('');
      el.innerHTML = `<div class="confetti">${bits}</div><div class="banner" data-act="skip"><span class="stars">✦ ✧ ✦</span><b>${esc(e.text)}</b>${this.cheer(e.kind)}</div>`;
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
