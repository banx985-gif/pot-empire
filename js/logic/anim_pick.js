// The sums behind the character animation player, with no drawing: which way someone's facing, which frames that means,
// and what a move name turns into for a character. js/ui/anim.js does the drawing.
(function (PE) {
  // Angles on screen, in degrees: y goes down, so "down" is 90.
  const DIRS = { right: 0, downright: 45, down: 90, downleft: 135, left: 180, upleft: 225, up: 270, upright: 315 };
  const MIRROR = { left: 'right', right: 'left', upleft: 'upright', upright: 'upleft', downleft: 'downright', downright: 'downleft' };
  const Data = () => PE.Data;
  const art = (id) => Data().animArt.chars[id] || null;
  const gap = (a, b) => Math.min(Math.abs(a - b), 360 - Math.abs(a - b));
  const pickSet = (want, frames, roll) => {
    const list = (Array.isArray(want) ? want : [want]).filter((s) => s && frames[s]);
    return list.length ? list[Math.min(list.length - 1, Math.floor(roll * list.length))] : null;
  };

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
  // A direction can list several sets for variety; roll (0 to 1, kept for the whole walk) picks one.
  // style 'skate': the skater kid on his board. Vehicles (V01 to V24) always drive.
  function walkFor(id, dx, dy, roll = 0, style = 'walk') {
    const frames = art(id);
    if (!frames) return null;
    const A = Data().animMoves;
    // Sunny Skates (VIP-01) has no walk at all: she skates everywhere.
    const skates = frames.SKATEFRONT && (style === 'skate' || !frames.WALKFRONT);
    const map = isVehicle(id) ? A.defaultDrive : skates ? A.defaultSkate : A.walk[id] || A.defaultWalk;
    const a = DIRS[dirOf(dx, dy)];
    const order = Object.keys(DIRS).sort((p, q) => gap(a, DIRS[p]) - gap(a, DIRS[q]));
    for (const d of order) {
      const here = pickSet(map[d], frames, roll);
      if (here) return { set: here, flip: false, dir: d };
      const other = pickSet(map[MIRROR[d]], frames, roll);
      if (other) return { set: other, flip: true, dir: d };
    }
    return null;
  }

  // Uncle Haze's two hairstyles: anything not on his messy list is styled. Nobody else has two.
  const lookOf = (id, set) => (((Data().animMoves.messy[id] || []).includes(set)) ? 'messy' : 'styled');

  // What a move turns into for this character, or null if they have no frames for it. roll: 0 to 1, picks from a list.
  // look 'messy' uses the character's messy table, if they have one: only for "busy or just woke up" pop-ups.
  function resolve(id, name, roll = Math.random(), look = 'styled') {
    const A = Data().animMoves;
    const frames = art(id);
    if (!frames) return null;
    const table = (look === 'messy' && A.moves[`${id}_MESSY`]) || A.moves[id] || A.defaultMoves;
    const spec = table[name];
    if (!spec) return null;
    const list = (Array.isArray(spec.set) ? spec.set : [spec.set]).filter((s) => frames[s]);
    if (!list.length) return null;
    const set = spec.first ? list[0] : list[Math.min(list.length - 1, Math.floor(roll * list.length))];
    const n = frames[set].n;
    let order;
    if (spec.frames) order = spec.frames.map((f) => f - 1);
    else {
      order = [];
      for (let i = (spec.from || 1) - 1; i <= (spec.to || n) - 1; i++) order.push(i);
    }
    order = order.filter((f) => f < n);
    // Aaron's own timing for these frames (job 17): seq = [frame, ms] steps in order, or ms = how long each frame shows.
    let ms = null;
    const fr = frames[set];
    if (!spec.frames && !spec.from && !spec.to && fr.seq) { order = fr.seq.map((s) => s[0]); ms = fr.seq.map((s) => s[1]); }
    else if (fr.ms && !spec.fps) ms = order.map((f) => fr.ms[f] || 120);
    return { name, set, order, ms, fps: spec.fps || 6, loop: !!spec.loop, hold: !!spec.hold, times: spec.times || 1, random: !!spec.random, then: spec.then || null, bob: !!spec.bob, look: lookOf(id, set) };
  }
  const hasFrames = (id) => !!art(id);
  // Depot vehicles (V02), town traffic (VEH-01) and Budz's van (LOAD-02).
  function isVehicle(id) { return /^(V|VEH-|LOAD-)\d\d$/.test(id); }
  const canSkate = (id) => !!(art(id) && art(id).SKATEFRONT);

  PE.AnimPick = { DIRS, dirOf, walkFor, lookOf, resolve, hasFrames, canSkate, isVehicle };
})(globalThis.PE = globalThis.PE || {});
