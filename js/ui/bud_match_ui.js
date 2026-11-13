// Bud Match's screen (job 23). The rules are in js/logic/bud_match.js; this draws the board as page elements (cheap on
// a phone: each tile is one small picture that slides with a CSS transition) and plays back what a move did, step by step.
// Touch only: drag a tile onto a neighbour, or tap one tile and then a neighbour. Haze and Leafy cheer big combos.
(function (PE) {
  const { esc, icon } = PE.Dom;
  const g = () => PE.App.g;
  const M = () => PE.BudMatch;
  const D = () => PE.Data.eventHub.budMatch;
  const calm = () => PE.App.calm();
  const wait = (ms) => new Promise((ok) => setTimeout(ok, calm() ? 0 : ms));
  const SWAP_MS = 150, POP_MS = 200, FALL_MS = 230;

  const UI = {
    b: null, n: 0, seed: 0, busy: false, sel: null, els: new Map(), size: 0, ended: null, cheers: 0,
    // A new game of level n.
    start(n) {
      UI.n = n;
      UI.seed = (Date.now() ^ (n * 2654435761)) >>> 0;
      UI.b = M().create(g().eventHub.level(n), UI.seed);
      UI.ended = null;
      UI.sel = null;
      UI.busy = false;
      UI.cheers = 0;
    },
    root: () => document.getElementById('bm-root'),

    // ---- Drawing --------------------------------------------------------------------------------------------------------
    html() {
      const lv = g().eventHub.level(UI.n);
      return `<div id="bm-root" class="bm" data-level="${UI.n}">
        <div class="bm-top"><div class="bm-goal"></div><div class="bm-moves"><small>Moves</small><b></b></div><div class="bm-score"><small>Score</small><b></b></div></div>
        <div class="bm-board-wrap"><div class="bm-board" style="--w:${lv.w || 7};--h:${lv.h || 8}"></div></div>
        <div class="bm-cast">${PE.AnimDom.html('HAZE', 96, 'bm-haze')}<p class="bm-say" hidden></p>${PE.AnimDom.html('LEAFY', 84, 'bm-leafy')}</div>
        <div class="bm-end" hidden></div></div>`;
    },
    // Called once the panel is on the page.
    mount() {
      const root = UI.root();
      if (!root || root.dataset.mounted) return;
      root.dataset.mounted = '1';
      UI.els = new Map();
      UI.measure();
      UI.place(M().snap(UI.b), true);
      UI.hud();
      const board = root.querySelector('.bm-board');
      board.addEventListener('pointerdown', UI.down);
      board.addEventListener('pointermove', UI.move);
      board.addEventListener('pointerup', UI.up);
      board.addEventListener('pointercancel', () => { UI.drag = null; });
      for (const [cls, move] of [['.bm-haze', 'idle'], ['.bm-leafy', 'idle']]) PE.AnimDom.play(root.querySelector(cls), move);
    },
    // How big a cell is: the board fills the width, or the height that's left, whichever is smaller.
    measure() {
      const root = UI.root();
      const wrap = root.querySelector('.bm-board-wrap');
      const b = UI.b;
      const r = wrap.getBoundingClientRect();
      UI.size = Math.max(24, Math.floor(Math.min(r.width / b.w, r.height / b.h)));
      const board = root.querySelector('.bm-board');
      board.style.width = `${UI.size * b.w}px`;
      board.style.height = `${UI.size * b.h}px`;
      board.style.setProperty('--cell', `${UI.size}px`);
    },
    xy(i) { const [r, c] = M().rc(UI.b, i); return [c * UI.size, r * UI.size]; },
    tileEl(t) {
      const el = document.createElement('div');
      el.className = 'bm-tile';
      el.dataset.id = t.id;
      UI.dress(el, t);
      UI.root().querySelector('.bm-board').appendChild(el);
      UI.els.set(t.id, el);
      return el;
    },
    dress(el, t) {
      const art = t.k === 'bomb' ? 'POP-01' : D().tiles[t.k];
      if (el.dataset.k !== t.k) { el.innerHTML = `<img src="assets/ui/${art}.webp" alt="" draggable="false">`; el.dataset.k = t.k; }
      el.classList.toggle('sp-row', t.sp === 'row');
      el.classList.toggle('sp-col', t.sp === 'col');
      el.classList.toggle('sp-bomb', t.sp === 'bomb');
    },
    // Puts every tile where the board says. New tiles drop in from above their column.
    place(snap, instant) {
      const seen = new Set();
      const dropFrom = {};
      snap.forEach((t, i) => {
        if (!t) return;
        seen.add(String(t.id));
        let el = UI.els.get(t.id);
        const [x, y] = UI.xy(i);
        if (!el) {
          el = UI.tileEl(t);
          const c = i % UI.b.w;
          dropFrom[c] = (dropFrom[c] || 0) + 1;
          el.style.transition = 'none';
          el.style.transform = `translate(${x}px, ${instant ? y : -dropFrom[c] * UI.size}px)`;
          void el.offsetWidth;
          el.style.transition = '';
        } else UI.dress(el, t);
        el.dataset.i = i;
        el.style.transform = `translate(${x}px, ${y}px)`;
      });
      for (const [id, el] of [...UI.els]) if (!seen.has(String(id))) { el.remove(); UI.els.delete(id); }
    },
    hud() {
      const root = UI.root();
      if (!root) return;
      const b = UI.b;
      const names = D().names;
      root.querySelector('.bm-goal').innerHTML = M().goalProgress(b).map((x) => x.what === 'score'
        ? `<span class="bm-chip ${x.have >= x.need ? 'done' : ''}">${icon('RWD-05', 22)}<b>${Math.min(x.have, x.need)}/${x.need}</b><small>score</small></span>`
        : `<span class="bm-chip ${x.have >= x.need ? 'done' : ''}">${icon(D().tiles[x.what], 22)}<b>${x.have}/${x.need}</b><small>${esc(names[x.what])}</small></span>`).join('');
      const mv = root.querySelector('.bm-moves b');
      if (mv.textContent !== String(b.movesLeft)) { mv.textContent = b.movesLeft; mv.classList.remove('bump'); void mv.offsetWidth; mv.classList.add('bump'); }
      root.querySelector('.bm-score b').textContent = b.score;
    },

    // ---- Touch --------------------------------------------------------------------------------------------------------------
    cellAt(e) {
      const r = UI.root().querySelector('.bm-board').getBoundingClientRect();
      const c = Math.floor((e.clientX - r.left) / UI.size), row = Math.floor((e.clientY - r.top) / UI.size);
      return c >= 0 && row >= 0 && c < UI.b.w && row < UI.b.h ? row * UI.b.w + c : -1;
    },
    down(e) {
      if (UI.busy || UI.b.done) return;
      const i = UI.cellAt(e);
      if (i < 0) return;
      e.currentTarget.setPointerCapture && e.currentTarget.setPointerCapture(e.pointerId);
      UI.drag = { i, x: e.clientX, y: e.clientY, id: e.pointerId, moved: false };
    },
    move(e) {
      const d = UI.drag;
      if (!d || d.id !== e.pointerId || d.moved) return;
      const dx = e.clientX - d.x, dy = e.clientY - d.y;
      if (Math.max(Math.abs(dx), Math.abs(dy)) < UI.size * 0.4) return;
      d.moved = true;
      const [r, c] = M().rc(UI.b, d.i);
      const j = Math.abs(dx) > Math.abs(dy) ? M().at(UI.b, r, c + Math.sign(dx)) : M().at(UI.b, r + Math.sign(dy), c);
      UI.select(null);
      if (j >= 0) UI.tryMove(d.i, j);
    },
    up(e) {
      const d = UI.drag;
      UI.drag = null;
      if (!d || d.moved || d.id !== e.pointerId) return;
      // A tap: pick a tile, then tap a neighbour to swap. Tapping it again lets go.
      if (UI.sel === null) { UI.select(d.i); return; }
      if (UI.sel === d.i) { UI.select(null); return; }
      if (M().neighbours(UI.b, UI.sel, d.i)) { const a = UI.sel; UI.select(null); UI.tryMove(a, d.i); return; }
      UI.select(d.i);
    },
    select(i) {
      UI.sel = i;
      for (const el of UI.els.values()) el.classList.toggle('sel', i !== null && Number(el.dataset.i) === i);
    },

    // ---- A move, played back step by step ---------------------------------------------------------------------------------
    async tryMove(i, j) {
      if (UI.busy || UI.b.done) return null;
      UI.busy = true;
      const before = M().snap(UI.b);
      const r = M().swap(UI.b, i, j);
      let prev = before;
      for (const s of r.steps) {
        if (!UI.root()) break;
        if (s.type === 'swap' || s.type === 'back') {
          const A = UI.els.get((s.type === 'swap' ? prev[s.a] : prev[s.b]).id), B = UI.els.get((s.type === 'swap' ? prev[s.b] : prev[s.a]).id);
          const [ax, ay] = UI.xy(s.a), [bx, by] = UI.xy(s.b);
          if (A) A.style.transform = `translate(${bx}px, ${by}px)`;
          if (B) B.style.transform = `translate(${ax}px, ${ay}px)`;
          if (s.type === 'back') { A && A.classList.add('nope'); B && B.classList.add('nope'); if (PE.Sound) PE.Sound.play('error'); }
          await wait(SWAP_MS + 20);
          if (s.type === 'back') { if (A) { A.style.transform = `translate(${ax}px, ${ay}px)`; A.classList.remove('nope'); } if (B) { B.style.transform = `translate(${bx}px, ${by}px)`; B.classList.remove('nope'); } await wait(SWAP_MS); }
          else { const t = prev[s.a]; prev = prev.slice(); prev[s.a] = prev[s.b]; prev[s.b] = t; }
        } else if (s.type === 'clear') {
          // The swapped board, before this wave: pop what's gone.
          for (const n of s.cells) { const t = prev[n]; const el = t && UI.els.get(t.id); if (el && !(s.snap[n] && s.snap[n].id === t.id)) el.classList.add('pop'); }
          if (s.chain >= 2 || s.why.length) UI.burst(s);
          if (PE.Sound) PE.Sound.play(s.why.length ? 'rare' : s.chain >= 2 ? 'collect' : 'harvest');
          await wait(POP_MS);
          UI.place(s.snap.map((t) => t), true);
          prev = s.snap;
        } else if (s.type === 'fall') {
          UI.place(s.snap);
          prev = s.snap;
          await wait(FALL_MS);
        } else if (s.type === 'shuffle') {
          UI.say('LEAFY', 'No moves left. Shuffle!');
          UI.place(s.snap);
          prev = s.snap;
          await wait(FALL_MS * 2);
        }
        UI.hud();
      }
      UI.hud();
      if (r.ok && (r.chain >= 3 || r.steps.some((s) => s.type === 'clear' && s.why.length))) UI.cheer(r);
      UI.busy = false;
      if (UI.b.done) UI.end();
      return r;
    },
    // A quick flash over a big wave.
    burst(s) {
      if (calm()) return;
      const root = UI.root();
      const f = document.createElement('div');
      f.className = 'bm-flash';
      f.textContent = s.why.includes('bomb+bomb') ? 'MEGA!' : s.why.length ? 'Boom!' : `Chain x${s.chain}`;
      root.querySelector('.bm-board-wrap').appendChild(f);
      setTimeout(() => f.remove(), 700);
    },
    // Haze and Leafy cheer a big combo, with one of their lines (data/scenes.js budMatchCheers).
    cheer() {
      const root = UI.root();
      if (!root) return;
      UI.cheers += 1;
      const who = UI.cheers % 2 ? 'HAZE' : 'LEAFY';
      const lines = (PE.Data.scenes.budMatchCheers || {})[who] || ['Nice!'];
      const box = root.querySelector(who === 'HAZE' ? '.bm-haze' : '.bm-leafy');
      PE.AnimDom.play(box, 'cheer', { done: () => setTimeout(() => { if (box.isConnected) PE.AnimDom.play(box, 'idle'); }, 900) });
      UI.say(who, lines[Math.floor(Math.random() * lines.length)]);
    },
    say(who, text) {
      const root = UI.root();
      if (!root) return;
      const p = root.querySelector('.bm-say');
      p.textContent = text;
      p.dataset.who = who;
      p.hidden = false;
      clearTimeout(UI.sayT);
      UI.sayT = setTimeout(() => { p.hidden = true; }, 1800);
    },

    // ---- The end of a level ---------------------------------------------------------------------------------------------------
    end() {
      const b = UI.b, H = g().eventHub;
      const stars = M().starsFor(b);
      const r = H.finish(UI.n, { won: b.won, stars }, `${H.state().week}:${UI.n}:${UI.seed}`);
      UI.ended = { won: b.won, stars, pay: r };
      PE.App.saveGame();
      const next = UI.n < H.levels().length && H.isOpen(UI.n + 1);
      const el = UI.root().querySelector('.bm-end');
      el.innerHTML = b.won
        ? `<div class="bm-card win"><h3>Level ${UI.n} done!</h3><p class="bm-stars">${Array.from({ length: 3 }, (_, i) => icon('RWD-05', 46, `bm-star ${i < stars ? 'on' : ''}`)).join('')}</p>
            <p>${r.text ? `Prize: ${esc(r.text)}` : r.newStars ? '' : 'No new prize: this week\'s win prize for this level is already paid.'}${r.capped ? '<br><small>Some of it was over the prize limit.</small>' : ''}</p>
            <p class="muted">${r.newStars ? `+${r.newStars} stars this week` : 'Beat your best stars to add more this week.'}</p>
            <div class="row-btns">${next ? `<button class="btn go" data-act="end:next">Next level</button>` : ''}<button class="btn plain" data-act="end:again">Play again</button><button class="btn plain" data-act="end:hub">Events</button></div></div>`
        : `<div class="bm-card lose"><h3>Out of moves</h3><p>So close. Every try is free, have another go.</p>
            <div class="row-btns"><button class="btn go" data-act="end:again">Try again</button><button class="btn plain" data-act="end:hub">Events</button></div></div>`;
      el.hidden = false;
      const box = UI.root().querySelector(b.won ? '.bm-haze' : '.bm-leafy');
      PE.AnimDom.play(box, b.won ? 'cheer' : 'shrug');
    },
    // The buttons on the end card go through the menu's own taps (PE.Panels.budMatch.actions.end).
    endTap(what) {
      if (what === 'hub') { PE.App.router.replace('eventHub', {}); return; }
      PE.App.router.replace('budMatch', { level: what === 'next' ? UI.n + 1 : UI.n });
    },
  };
  PE.BudMatchUI = UI;

  PE.Panels.budMatch = {
    title: (p) => `Bud Match · level ${p.level}`,
    render(p) {
      const n = Number(p.level) || 1;
      if (!UI.b || UI.n !== n || UI.root() === null || UI.ended) UI.start(n);
      setTimeout(() => UI.mount(), 0);
      return UI.html();
    },
    actions: { end(what) { UI.endTap(what); } },
  };
})(globalThis.PE = globalThis.PE || {});
