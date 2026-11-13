// Bud Match (job 23): the weekly event day's match-3 game. Only the rules live here, with no screen and no game
// state, so the tests can play it. js/ui/bud_match_ui.js draws it; data/event_hub.js holds the levels.
//
// The board is w x h cells, read row by row from the top left. Each cell holds a tile { id, k, sp }:
//   k   bud, leaf, seed, jar, coin (or 'bomb' for a bomb tile, which has no kind of its own)
//   sp  null, 'row' or 'col' (a striped tile: clears its row or column when it goes) or 'bomb'
// Swap two neighbours to make a line of three or more of a kind. Four in a line makes a striped tile, five makes a
// bomb. Swapping a bomb with a tile clears every tile of that kind. Two special tiles swapped together combine.
// A swap that makes nothing swaps back and costs no move. A board with no move left is reshuffled.
(function (PE) {
  const KINDS = ['bud', 'leaf', 'seed', 'jar', 'coin'];
  const TILE_SCORE = 10;

  // A small seeded random number maker, so a board can be replayed exactly (mulberry32). Its state is a number.
  function rand(b) {
    b.rng = (b.rng + 0x6D2B79F5) >>> 0;
    let t = b.rng;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  const kindsOf = (b) => b.kindList;
  const newTile = (b, k, sp = null) => ({ id: ++b.nextId, k: k || kindsOf(b)[Math.floor(rand(b) * b.kinds)], sp });
  const rc = (b, i) => [Math.floor(i / b.w), i % b.w];
  const at = (b, r, c) => (r < 0 || c < 0 || r >= b.h || c >= b.w ? -1 : r * b.w + c);
  const matchable = (t) => t && t.k !== 'bomb';

  // ---- Lines of three or more ---------------------------------------------------------------------------------------
  // Every run of 3+ of one kind, as lists of cells.
  function runs(b) {
    const out = [];
    for (const across of [true, false]) {
      const outer = across ? b.h : b.w, inner = across ? b.w : b.h;
      for (let o = 0; o < outer; o++) {
        let start = 0;
        for (let n = 1; n <= inner; n++) {
          const i0 = across ? at(b, o, start) : at(b, start, o);
          const i1 = n < inner ? (across ? at(b, o, n) : at(b, n, o)) : -1;
          const same = i1 >= 0 && matchable(b.cells[i0]) && matchable(b.cells[i1]) && b.cells[i0].k === b.cells[i1].k;
          if (same) continue;
          if (n - start >= 3 && matchable(b.cells[i0])) {
            const cells = [];
            for (let x = start; x < n; x++) cells.push(across ? at(b, o, x) : at(b, x, o));
            out.push({ cells, across, k: b.cells[i0].k });
          }
          start = n;
        }
      }
    }
    return out;
  }

  // Would swapping these two make a line (or set off specials)?
  function swapWorks(b, i, j) {
    const A = b.cells[i], B = b.cells[j];
    if (!A || !B) return false;
    if (A.sp && B.sp) return true;
    if (A.k === 'bomb' || B.k === 'bomb') return true;
    b.cells[i] = B; b.cells[j] = A;
    const ok = runs(b).some((r) => r.cells.includes(i) || r.cells.includes(j));
    b.cells[i] = A; b.cells[j] = B;
    return ok;
  }
  const neighbours = (b, i, j) => { const [r1, c1] = rc(b, i), [r2, c2] = rc(b, j); return Math.abs(r1 - r2) + Math.abs(c1 - c2) === 1; };
  // A move that works, or null.
  function findMove(b) {
    for (let i = 0; i < b.cells.length; i++) {
      const [r, c] = rc(b, i);
      for (const j of [at(b, r, c + 1), at(b, r + 1, c)]) if (j >= 0 && swapWorks(b, i, j)) return [i, j];
    }
    return null;
  }

  // ---- A new board ------------------------------------------------------------------------------------------------------
  // level: { w, h, kinds, moves, goal: { score } | { collect: { coin: 20 } } }
  function create(level, seed = 1) {
    const b = {
      w: level.w || 7, h: level.h || 8, kinds: Math.min(KINDS.length, level.kinds || 5), kindList: null, rng: seed >>> 0, nextId: 0,
      cells: [], score: 0, movesLeft: level.moves, moves: level.moves, goal: level.goal, got: {}, done: false, won: false,
      stars: level.stars || null, biggestChain: 0, combos: 0, shuffles: 0,
    };
    // The kinds a level's goal asks for are always on the board; the rest are filled in from the list.
    const wanted = Object.keys((level.goal && level.goal.collect) || {}).filter((k) => KINDS.includes(k));
    b.kindList = [...wanted, ...KINDS.filter((k) => !wanted.includes(k))].slice(0, Math.max(b.kinds, wanted.length));
    b.kinds = b.kindList.length;
    for (let tries = 0; tries < 50; tries++) {
      b.cells = [];
      for (let i = 0; i < b.w * b.h; i++) {
        // No line of three to begin with.
        const [r, c] = rc(b, i);
        let t;
        for (let n = 0; n < 20; n++) {
          t = newTile(b);
          const left = c >= 2 && b.cells[i - 1].k === t.k && b.cells[i - 2].k === t.k;
          const up = r >= 2 && b.cells[i - b.w].k === t.k && b.cells[i - 2 * b.w].k === t.k;
          if (!left && !up) break;
        }
        b.cells.push(t);
      }
      if (findMove(b)) break;
    }
    return b;
  }

  // ---- Specials going off ------------------------------------------------------------------------------------------------
  // Adds what a special tile at cell i clears to the set, and sets off any special it reaches.
  function blast(b, i, hit, why) {
    const t = b.cells[i];
    if (!t || !t.sp) return;
    const [r, c] = rc(b, i);
    const add = (j) => { if (j < 0 || hit.has(j)) return; hit.add(j); blast(b, j, hit, why); };
    hit.add(i);
    if (t.sp === 'row') for (let x = 0; x < b.w; x++) add(at(b, r, x));
    else if (t.sp === 'col') for (let y = 0; y < b.h; y++) add(at(b, y, c));
    else if (t.sp === 'bomb') {
      // A bomb caught in a blast clears every tile of the kind there's most of.
      const count = {};
      for (const x of b.cells) if (x && matchable(x)) count[x.k] = (count[x.k] || 0) + 1;
      const k = Object.keys(count).sort((p, q) => count[q] - count[p])[0];
      b.cells.forEach((x, j) => { if (x && x.k === k) add(j); });
    }
    why.push(t.sp);
  }

  // Two specials swapped together, or a bomb swapped with a tile: what they clear.
  function comboHit(b, i, j) {
    const A = b.cells[i], B = b.cells[j];
    const hit = new Set([i, j]);
    const why = [];
    const [r, c] = rc(b, j);
    const line = (rows, cols) => {
      for (const y of rows) for (let x = 0; x < b.w; x++) if (at(b, y, x) >= 0) hit.add(at(b, y, x));
      for (const x of cols) for (let y = 0; y < b.h; y++) if (at(b, y, x) >= 0) hit.add(at(b, y, x));
    };
    const bombs = [A, B].filter((t) => t.sp === 'bomb').length;
    const stripes = [A, B].filter((t) => t.sp === 'row' || t.sp === 'col').length;
    if (bombs === 2) { b.cells.forEach((x, n) => hit.add(n)); why.push('bomb+bomb'); }
    else if (bombs === 1 && stripes === 1) { line([r - 1, r, r + 1].filter((y) => y >= 0 && y < b.h), [c - 1, c, c + 1].filter((x) => x >= 0 && x < b.w)); why.push('bomb+stripe'); }
    else if (stripes === 2) { line([r], [c]); why.push('stripe+stripe'); }
    else if (bombs === 1) {
      const other = A.sp === 'bomb' ? B : A;
      b.cells.forEach((x, n) => { if (x && x.k === other.k) hit.add(n); });
      why.push('bomb');
    }
    // Anything special caught in it goes off too (the two swapped ones have done their bit).
    A.sp = null; B.sp = null;
    for (const n of [...hit]) if (n !== i && n !== j) blast(b, n, hit, why);
    return { hit, why };
  }

  // ---- Clearing, falling, refilling ----------------------------------------------------------------------------------------
  const snap = (b) => b.cells.map((t) => (t ? { id: t.id, k: t.k, sp: t.sp } : null));
  function collect(b, cells) {
    for (const n of cells) { const t = b.cells[n]; if (t && t.k !== 'bomb') b.got[t.k] = (b.got[t.k] || 0) + 1; }
  }
  function fall(b) {
    const moved = [];
    for (let c = 0; c < b.w; c++) {
      let to = b.h - 1;
      for (let r = b.h - 1; r >= 0; r--) {
        const i = at(b, r, c);
        if (!b.cells[i]) continue;
        const j = at(b, to, c);
        if (j !== i) { b.cells[j] = b.cells[i]; b.cells[i] = null; moved.push(b.cells[j].id); }
        to--;
      }
      for (let r = to; r >= 0; r--) b.cells[at(b, r, c)] = newTile(b);
    }
    return moved;
  }
  // Clears a set of cells (making a special where a long line was), then lets everything fall. One "wave".
  function clearWave(b, hit, made, chain, why, steps) {
    collect(b, hit);
    const gain = hit.size * TILE_SCORE * chain + made.length * 60;
    b.score += gain;
    for (const n of hit) b.cells[n] = null;
    for (const m of made) b.cells[m.i] = { id: ++b.nextId, k: m.k, sp: m.sp };
    steps.push({ type: 'clear', cells: [...hit], made: made.map((m) => ({ i: m.i, sp: m.sp })), chain, gain, why: why.slice(), snap: snap(b) });
    fall(b);
    steps.push({ type: 'fall', snap: snap(b) });
  }
  // Every line on the board now: what to clear and which specials it makes. near: the cells the player just swapped.
  function lineWave(b, near) {
    const list = runs(b);
    if (!list.length) return null;
    const hit = new Set();
    const made = [];
    const why = [];
    // Lines that cross (an L or a T) count together for the bomb.
    const groups = [];
    for (const rn of list) {
      const g = groups.find((x) => x.k === rn.k && rn.cells.some((n) => x.cells.has(n)));
      if (g) { rn.cells.forEach((n) => g.cells.add(n)); g.runs.push(rn); } else groups.push({ k: rn.k, cells: new Set(rn.cells), runs: [rn] });
    }
    for (const g of groups) {
      g.cells.forEach((n) => hit.add(n));
      const longest = Math.max(...g.runs.map((x) => x.cells.length));
      const size = g.cells.size;
      let sp = null;
      if (longest >= 5 || size >= 5 && g.runs.length > 1) sp = 'bomb';
      else if (longest === 4) sp = g.runs.find((x) => x.cells.length === 4).across ? 'row' : 'col';
      if (sp) {
        const spot = [...g.cells].find((n) => near.includes(n)) ?? [...g.cells][Math.floor(g.cells.size / 2)];
        made.push({ i: spot, sp, k: sp === 'bomb' ? 'bomb' : g.k });
      }
    }
    // A special in a line goes off.
    for (const n of [...hit]) blast(b, n, hit, why);
    // The new special stays on the board.
    for (const m of made) hit.add(m.i);
    return { hit, made, why };
  }

  function shuffle(b) {
    const tiles = b.cells.slice();
    for (let tries = 0; tries < 100; tries++) {
      for (let i = tiles.length - 1; i > 0; i--) { const j = Math.floor(rand(b) * (i + 1)); [tiles[i], tiles[j]] = [tiles[j], tiles[i]]; }
      b.cells = tiles.slice();
      if (!runs(b).length && findMove(b)) return true;
    }
    // Still stuck (a tiny board): new tiles.
    b.cells = b.cells.map(() => newTile(b));
    while (runs(b).length || !findMove(b)) b.cells = b.cells.map(() => newTile(b));
    return true;
  }

  // ---- Goals and stars --------------------------------------------------------------------------------------------------------
  function goalProgress(b) {
    const G = b.goal || {};
    if (G.score) return [{ what: 'score', need: G.score, have: b.score }];
    return Object.entries(G.collect || {}).map(([k, n]) => ({ what: k, need: n, have: Math.min(n, b.got[k] || 0) }));
  }
  const goalMet = (b) => goalProgress(b).every((x) => x.have >= x.need);
  // 1 star for the goal; 2 and 3 for moves left over (a quarter, a half of them) or a score target if the level gives one.
  function starsFor(b) {
    if (!b.won) return 0;
    if (b.stars) return 1 + (b.score >= b.stars[0] ? 1 : 0) + (b.score >= b.stars[1] ? 1 : 0);
    const left = b.movesLeft / b.moves;
    return left >= 0.5 ? 3 : left >= 0.25 ? 2 : 1;
  }

  // ---- A move ---------------------------------------------------------------------------------------------------------------
  // Swaps cells i and j. Returns { ok, steps } where steps is what happened, in order, for the screen to play:
  //   swap, back (it didn't work), clear (cells, made specials, chain), fall, shuffle. Each has a snap of the board after it.
  function swap(b, i, j) {
    if (b.done || i === j || !neighbours(b, i, j)) return { ok: false, why: 'not neighbours', steps: [] };
    if (!swapWorks(b, i, j)) return { ok: false, why: 'no line', steps: [{ type: 'swap', a: i, b: j }, { type: 'back', a: i, b: j }] };
    const steps = [{ type: 'swap', a: i, b: j }];
    [b.cells[i], b.cells[j]] = [b.cells[j], b.cells[i]];
    b.movesLeft -= 1;
    let chain = 1;
    const A = b.cells[i], B = b.cells[j];
    if ((A.sp && B.sp) || A.k === 'bomb' || B.k === 'bomb') {
      const { hit, why } = comboHit(b, i, j);
      b.combos += 1;
      clearWave(b, hit, [], chain, why, steps);
      chain += 1;
    }
    for (let guard = 0; guard < 60; guard++) {
      const w = lineWave(b, chain === 1 ? [i, j] : []);
      if (!w) break;
      if (w.why.length) b.combos += 1;
      clearWave(b, w.hit, w.made, chain, w.why, steps);
      chain += 1;
    }
    b.biggestChain = Math.max(b.biggestChain, chain - 1);
    if (goalMet(b)) { b.done = true; b.won = true; }
    else if (b.movesLeft <= 0) { b.done = true; b.won = false; }
    else if (!findMove(b)) { shuffle(b); b.shuffles += 1; steps.push({ type: 'shuffle', snap: snap(b) }); }
    return { ok: true, steps, chain: chain - 1 };
  }

  PE.BudMatch = { KINDS, create, swap, swapWorks, findMove, runs, shuffle, goalProgress, goalMet, starsFor, neighbours, snap, rc, at };
})(globalThis.PE = globalThis.PE || {});
