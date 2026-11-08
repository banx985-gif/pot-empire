// How helpers and celebrations look. The rules (js/logic/helpers.js) decide when; this draws them.
// Which picture goes with which moment is data: data/jokes.js and data/helper_sprites.js.
//
// Helper line: the game behind goes dark, the helper pops up in front of a graffiti splash with a
// speech bubble (the look from docs/DESIGN_NOTES.md). One tap anywhere closes it, and it closes by
// itself after a few seconds. It waits while a pop-up is open or a finger is down.
// The helper plays a move for the moment (data/scenes.js says which), then chats while the words type out, and settles
// when they've finished. Reduced motion switches all of that off and leaves one still picture.
// Celebration: a short banner with confetti at the top of the screen, with a helper cheering under it.
// It never blocks the game: taps go straight through to the room, except on the banner itself, which
// closes it.
//
// Speed: a picture is only fetched when it's about to show.
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
    add(e) {
      if (PE.App && PE.App.g.tutorial.active() && !e.replay) return;
      if (e.replay) this.waiting.unshift(e);
      else if (this.waiting.length < 2) this.waiting.push(e);
    },
    canShow() {
      const app = PE.App;
      if (!app || !app.game || PE.Dom.modalNow || PE.Dom.isTouching() || (PE.ChestReveal && PE.ChestReveal.now) || app.g.tutorial.active() || !PE.AgeGate.answered()) return false;
      const top = app.router.current();
      return !!top && top.name !== 'title';
    },
    pump() {
      if (this.now || !this.waiting.length || !this.canShow()) return;
      const e = this.now = this.waiting.shift();
      const calm = still();
      const el = $('helper');
      el.className = calm ? 'still' : '';
      el.innerHTML = `<div class="helper-pop" data-act="skip">
          <div class="who"><div class="splash"><i></i><i></i><i></i></div>${PE.AnimDom.html(e.helper, 230, '', PE.Data.scenes.messyEvents.includes(e.event) ? 'messy' : 'styled')}</div>
          <div class="bubble"><b>${esc(e.name)}</b><p class="talk-line">${esc(e.text)}</p><small>Tap anywhere to skip</small></div>
        </div>`;
      el.hidden = false;
      clearTimeout(this.timer);
      const H = B().helpers;
      this.timer = setTimeout(() => this.timedClose(), H.showSeconds * 1000);
      this.liven(e);
    },
    // A move for the moment, then chatting while the words type out.
    liven(e) {
      const box = document.querySelector('#helper .anim-box');
      const move = e.move || PE.Data.scenes.jokeMoves[e.event] || 'chat';
      this.typing = true;
      if (move === 'chat') PE.AnimDom.play(box, 'chat');
      else PE.AnimDom.play(box, move, { done: () => { if (box.isConnected && this.typing) PE.AnimDom.play(box, 'chat'); } });
      PE.Talk.typeOut(document.querySelector('#helper .talk-line'), e.text, () => { this.typing = false; if (box.dataset.move === 'chat') PE.AnimDom.settle(box); });
    },
    // Time's up, but never pull it out from under a finger: the finger's lift would land on the room below as a tap.
    timedClose() {
      if (PE.Dom.isTouching()) { this.timer = setTimeout(() => this.timedClose(), 200); return; }
      this.close();
    },
    close() {
      clearTimeout(this.timer);
      this.extras.forEach((t) => { clearTimeout(t); clearInterval(t); });
      this.extras = [];
      this.typing = false;
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
      // Uncle Haze and Budz cheer with their real moves. Leafy has no cheer drawn yet, so keeps her picture.
      const who = id.split('-')[0];
      if (who !== 'LEAFY') return PE.AnimDom.html(who, size, 'cheer').replace('data-char', `data-face="${id}" data-char`);
      return `<img class="cheer" src="${HelperArt.url(id)}" alt="" width="${size}" height="${size}" data-face="${id}" draggable="false" onerror="this.style.visibility='hidden'">`;
    },
    // A sale pop-up: the skater kid pushes a jar of buds at you and winks (WLK-01-JAR, job 17B).
    jar() {
      if (!PE.AnimPick.resolve('WLK-01', 'jar')) return '';
      return PE.AnimDom.html('WLK-01', B().helpers.celebrateHelperSize, 'jar');
    },
    pump() {
      if (this.now || !this.waiting.length || !PE.App || !PE.App.game) return;
      const e = this.now = this.waiting.shift();
      const calm = still();
      const small = e.kind === 'station';
      const el = $('celebrate');
      el.className = `${calm ? 'still' : ''} ${small ? 'small' : ''}`;
      const bits = calm || small ? '' : Array.from({ length: CONFETTI }, (_, i) => `<i style="--i:${i}"></i>`).join('');
      el.innerHTML = `<div class="confetti">${bits}</div><div class="banner" data-act="skip"><span class="stars">${PE.Dom.icon(e.kind === 'level' ? 'RWD-06' : 'RWD-05', 40)}</span><b>${esc(e.text)}</b>${e.jar ? this.jar() : this.cheer(e.kind)}</div>`;
      el.hidden = false;
      if (e.jar) PE.AnimDom.play(el.querySelector('.jar.anim-box'), 'jar');
      else PE.AnimDom.play(el.querySelector('.cheer.anim-box'), 'cheer');
      clearTimeout(this.timer);
      const C = B().celebrations;
      this.timer = setTimeout(() => this.timedClose(), (calm ? C.reducedMotionSeconds : C.seconds) * 1000);
    },
    timedClose() {
      if (PE.Dom.isTouching()) { this.timer = setTimeout(() => this.timedClose(), 200); return; }
      this.close();
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
