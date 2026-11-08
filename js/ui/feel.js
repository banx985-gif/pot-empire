// Small things that make the first minutes feel good (job 10): the loading screen ending, the intro comic, and the red arrows at the edge of the screen. No game rules here.
(function (PE) {
  const $ = (id) => document.getElementById(id);
  const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const calm = () => (PE.App && PE.App.state.settings.reducedMotion) || (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  PE.Loading = {
    done() { const el = $('loading'); if (el) el.remove(); },
  };

  // ---- The intro comic: Aaron's INTRO-01..04 pictures, the headline written live in each sky. Skippable; Settings replays it.
  const Intro = {
    at: 0,
    open: false,
    onEnd: null,
    init() {
      PE.Dom.attachTaps($('intro'), (act) => {
        if (act === 'skip') Intro.close();
        else if (act === 'next') Intro.step(Intro.at + 1);
      });
    },
    // A new player sees it once, before their very first go.
    due() {
      const g = PE.App.g, ui = PE.App.state.ui;
      return g.tutorial.active() && !ui.introSeen && g.tutorial.stepIndex() === 0 && !PE.App.state.tutorial.replay;
    },
    show(replay) {
      Intro.open = true;
      Intro.replay = !!replay;
      PE.App.state.ui.introSeen = true;
      PE.App.saveGame();
      Intro.step(0);
    },
    step(i) {
      const list = PE.Data.tutorial.intro;
      if (i >= list.length) { Intro.close(); return; }
      Intro.at = i;
      const p = list[i];
      const pic = `<img class="full" src="assets/intro/${p.art}.webp" alt="" draggable="false"><h2 class="comic-head">${esc(p.head)}${p.sub ? `<span>${esc(p.sub)}</span>` : ''}</h2>`;
      const el = $('intro');
      el.innerHTML = `<div class="comic-page comic-pop">${pic}</div>
        <p class="comic-cap">${esc(p.text)}</p>
        <div class="comic-row"><button class="comic-skip" data-act="skip">Skip</button><span class="comic-dots">${list.map((_, k) => (k === i ? '●' : '○')).join('')}</span>
        <button class="btn go" data-act="next">${i === list.length - 1 ? "Let's go!" : 'Next'}</button></div>`;
      el.hidden = false;
    },
    close() {
      Intro.open = false;
      const el = $('intro');
      el.hidden = true;
      el.innerHTML = '';
    },
  };
  PE.Intro = Intro;

  // ---- Red arrows: something off the side of the screen needs you --------------------------------------------------------
  const EdgeArrows = {
    sig: '',
    tapFns: {},
    init() {
      PE.Dom.attachTaps($('edges'), (act) => { const fn = EdgeArrows.tapFns[act]; if (fn) fn(); });
    },
    clear() {
      const el = $('edges');
      if (el && EdgeArrows.sig) el.innerHTML = '';
      EdgeArrows.sig = '';
      EdgeArrows.tapFns = {};
    },
    // items: { id, x, y (map or room point), tap }. Only those off the screen get an arrow, at most 4.
    update(scene, items) {
      if (PE.Dom.panelRoute || PE.Dom.modalNow || PE.Dom.isTouching() || !scene.scene.isActive()) { EdgeArrows.clear(); return; }
      const box = $('ui').getBoundingClientRect();
      const inset = { l: 34, r: 34, t: 96, b: 110 };
      const midX = box.width / 2, midY = (box.height + inset.t - inset.b) / 2;
      const out = [];
      for (const it of items.slice(0, 4)) {
        const p = scene.worldToPage(it.x, it.y);
        const dx = p.x - box.left - midX, dy = p.y - box.top - midY;
        const k = Math.min((midX - inset.l) / Math.abs(dx || 1), ((box.height - inset.t - inset.b) / 2) / Math.abs(dy || 1));
        if (k >= 1) continue;
        out.push({ ...it, ax: midX + dx * k, ay: midY + dy * k, rot: Math.atan2(dy, dx) + Math.PI / 2 });
      }
      const sig = out.map((o) => `${o.id}:${Math.round(o.ax / 4)},${Math.round(o.ay / 4)}`).join('|');
      if (sig === EdgeArrows.sig) return;
      EdgeArrows.sig = sig;
      EdgeArrows.tapFns = Object.fromEntries(out.map((o) => [o.id, o.tap]));
      $('edges').innerHTML = out.map((o) => `<button class="edge-arrow" data-act="${esc(o.id)}" aria-label="Something needs you over here" style="left:${o.ax}px;top:${o.ay}px"><i style="transform:rotate(${o.rot}rad)"></i>!</button>`).join('');
    },
  };
  PE.EdgeArrows = EdgeArrows;
})(globalThis.PE = globalThis.PE || {});
