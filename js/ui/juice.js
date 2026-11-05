// Polish (big job 3, Stage 7): the top bar's cash counting up, coins flying to the top bar, sparkles on rare
// finds, and menus sliding in. Plain page elements moved with the browser's own smooth animation, so it costs
// next to nothing. Nothing here changes any numbers in the game. Reduced motion switches all of it off.
(function (PE) {
  const $ = (id) => document.getElementById(id);
  const calm = () => PE.App.state.settings.reducedMotion || (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const MAX_LIVE = 24;   // never more than this many flying bits at once
  let live = 0;

  // ---- The cash number counts up instead of jumping ----------------------------------------------------------
  const Counter = {
    shown: null,
    from: 0,
    to: 0,
    startedAt: 0,
    raf: 0,
    sync() {
      const el = $('cash-num');
      if (!el) return;
      const target = PE.App.state.currencies.cash;
      const n = PE.Money.toNumber(target);
      // Very large numbers, a fall in cash, or the first draw: just show it.
      if (Counter.shown === null || calm() || n <= Counter.to || !Number.isFinite(n)) {
        if (Counter.raf) { cancelAnimationFrame(Counter.raf); Counter.raf = 0; }
        Counter.shown = n; Counter.to = n;
        el.textContent = PE.Dom.money(target);
        return;
      }
      Counter.from = Counter.shown;
      Counter.to = n;
      Counter.startedAt = performance.now();
      if (!Counter.raf) Counter.raf = requestAnimationFrame(Counter.step);
    },
    step(now) {
      const el = $('cash-num');
      const t = Math.min(1, (now - Counter.startedAt) / 420);
      const eased = 1 - (1 - t) * (1 - t);
      Counter.shown = Counter.from + (Counter.to - Counter.from) * eased;
      if (el) el.textContent = t >= 1 ? PE.Dom.money(PE.App.state.currencies.cash) : PE.Dom.money(String(Math.floor(Counter.shown)));
      Counter.raf = t < 1 ? requestAnimationFrame(Counter.step) : 0;
    },
  };

  const uiPoint = (x, y) => { const r = $('ui').getBoundingClientRect(); return { x: x - r.left, y: y - r.top }; };
  function piece(cls, html) {
    const el = document.createElement('div');
    el.className = cls;
    el.innerHTML = html;
    $('juice').appendChild(el);
    live++;
    return el;
  }
  const done = (el) => { el.remove(); live--; };

  const Juice = {
    Counter,
    // Coins from a point on the page to the top bar's cash.
    coins(pageX, pageY, count = 4) {
      if (calm() || !$('juice')) return;
      const target = document.querySelector('#hud .cash .ico');
      if (!target) return;
      const tr = target.getBoundingClientRect();
      const to = uiPoint(tr.left + tr.width / 2, tr.top + tr.height / 2);
      const from = uiPoint(pageX, pageY);
      for (let i = 0; i < count && live < MAX_LIVE; i++) {
        const el = piece('fly-coin', PE.Dom.icon('CUR-01', 26));
        el.style.transform = `translate(${from.x + (i - count / 2) * 9}px, ${from.y}px) scale(.7)`;
        const anim = el.animate([
          { transform: `translate(${from.x + (i - count / 2) * 9}px, ${from.y}px) scale(.7)`, opacity: 1 },
          { transform: `translate(${(from.x + to.x) / 2 + (i - count / 2) * 28}px, ${(from.y + to.y) / 2 + 26}px) scale(1.15)`, opacity: 1, offset: 0.4 },
          { transform: `translate(${to.x}px, ${to.y}px) scale(.6)`, opacity: 0.9 },
        ], { duration: 520 + i * 60, easing: 'cubic-bezier(.45,.05,.55,.95)', fill: 'forwards' });
        anim.onfinish = () => {
          done(el);
          const cash = document.querySelector('#hud .cash');
          if (cash && cash.animate) cash.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.1)' }, { transform: 'scale(1)' }], { duration: 170 });
        };
      }
    },
    // A burst of stars at a point on the page, for rare finds.
    sparkle(pageX, pageY, count = 9) {
      if (calm() || !$('juice')) return;
      const at = uiPoint(pageX, pageY);
      for (let i = 0; i < count && live < MAX_LIVE; i++) {
        const el = piece('fly-star', PE.Dom.icon('RWD-05', 22));
        const a = (i / count) * Math.PI * 2 + 0.4;
        const r = 46 + (i % 3) * 22;
        const anim = el.animate([
          { transform: `translate(${at.x}px, ${at.y}px) scale(.2) rotate(0deg)`, opacity: 1 },
          { transform: `translate(${at.x + Math.cos(a) * r}px, ${at.y + Math.sin(a) * r}px) scale(1) rotate(160deg)`, opacity: 1, offset: 0.6 },
          { transform: `translate(${at.x + Math.cos(a) * r * 1.3}px, ${at.y + Math.sin(a) * r * 1.3 + 16}px) scale(.3) rotate(240deg)`, opacity: 0 },
        ], { duration: 720, easing: 'ease-out', fill: 'forwards' });
        anim.onfinish = () => done(el);
      }
    },
    liveCount: () => live,
    init() {
      const g = PE.App.g;
      g.on((type, e) => {
        if (type !== 'harvest' || !e) return;
        const scene = PE.App.game.scene.getScene('garage');
        if (!scene || !scene.scene.isActive() || !scene.potPagePoint || e.facility !== scene.fid) return;
        const p = scene.potPagePoint(e.station, e.pot);
        Juice.coins(p.x, p.y - 40, e.grade >= 2 ? 5 : 3);
        // Top Shelf or better is a rare find.
        if (e.grade >= 3) { Juice.sparkle(p.x, p.y - 60); PE.Sound.play('rare'); }
      });
    },
  };
  PE.Juice = Juice;
})(globalThis.PE = globalThis.PE || {});
