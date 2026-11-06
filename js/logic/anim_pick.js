// The sums behind the character animation player, with no drawing: which way someone's facing, which frames that means,
// and what a move name turns into for a character. js/ui/anim.js does the drawing.
(function (PE) {
  // Angles on screen, in degrees: y goes down, so "down" is 90.
  const DIRS = { right: 0, downright: 45, down: 90, downleft: 135, left: 180, upleft: 225, up: 270, upright: 315 };
  const MIRROR = { left: 'right', right: 'left', upleft: 'upright', upright: 'upleft', downleft: 'downright', downright: 'downleft' };
  const Data = () => PE.Data;
  const art = (id) => Data().animArt.chars[id] || null;
  const gap = (a, b) => Math.min(Math.abs(a - b), 360 - Math.abs(a - b));

  // The direction closest to the way they're heading.
  function dirOf(dx, dy) {
    let a = (Math.atan2(dy, dx) * 180) / Math.PI;
    if (a < 0) a += 360;
    let best = 'down', least = 999;
    for (const [d, deg] of Object.entries(DIRS)) {
      if (gap(a, deg) < least) { least = gap(a, deg); best = d; }
    }
    return best;
  }

  // Which frames walk this way: { set, flip, dir }, or null if this character has no walk at all.
  function walkFor(id, dx, dy) {
    const frames = art(id);
    if (!frames) return null;
    const map = Data().animMoves.walk[id] || Data().animMoves.defaultWalk;
    const a = DIRS[dirOf(dx, dy)];
    const order = Object.keys(DIRS).sort((p, q) => gap(a, DIRS[p]) - gap(a, DIRS[q]));
    for (const d of order) {
      if (map[d] && frames[map[d]]) return { set: map[d], flip: false, dir: d };
      const m = MIRROR[d];
      if (m && map[m] && frames[map[m]]) return { set: map[m], flip: true, dir: d };
    }
    return null;
  }

  const lookOf = (id, set) => ((Data().animMoves.looks[id] || {})[set]) || 'messy';
  // Moving between hairstyles has to happen behind a cut.
  const needsCut = (id, fromSet, toSet) => !!fromSet && lookOf(id, fromSet) !== lookOf(id, toSet);

  // What a move turns into for this character, or null if they have no frames for it. roll: 0 to 1, picks from a list.
  function resolve(id, name, roll = Math.random()) {
    const A = Data().animMoves;
    const frames = art(id);
    if (!frames) return null;
    const spec = (A.moves[id] || A.defaultMoves)[name];
    if (!spec) return null;
    const list = (Array.isArray(spec.set) ? spec.set : [spec.set]).filter((s) => frames[s]);
    if (!list.length) return null;
    const set = list[Math.min(list.length - 1, Math.floor(roll * list.length))];
    const n = frames[set].n;
    let order;
    if (spec.frames) order = spec.frames.map((f) => f - 1);
    else {
      order = [];
      for (let i = (spec.from || 1) - 1; i <= (spec.to || n) - 1; i++) order.push(i);
    }
    order = order.filter((f) => f < n);
    return { name, set, order, fps: spec.fps || 6, loop: !!spec.loop, hold: !!spec.hold, times: spec.times || 1, random: !!spec.random, then: spec.then || null, look: lookOf(id, set) };
  }
  const hasFrames = (id) => !!art(id);

  PE.AnimPick = { DIRS, dirOf, walkFor, lookOf, needsCut, resolve, hasFrames };
})(globalThis.PE = globalThis.PE || {});
