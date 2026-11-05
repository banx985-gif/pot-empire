// The sums behind the district maps, with no drawing: curved paths, which places connect to which, the
// route a van or boat takes, what counts as water, and where the filler (trees, houses) can stand.
// A district's data file (data/map/D1.js ...) says what's where; everything else comes from here. That's
// why a new district can be any shape: land, sea, islands, bridges or boat lanes, with no code change.
//
// In a district file:
//   nodes   named points: { a: [x, y] }. Two paths meet by naming the same point.
//   paths   { kind, via: ['a', 'b', 'c'] }   kinds are listed in KINDS below
//   spots / rivalSpots / spareLots   a building's middle-front x, y, and node: the point its drive joins
//   water   { type: 'pond', x, y, rx, ry } | { type: 'river', pts, width } | { type: 'shape', pts }
//   base    'land' (the default) or 'sea', and then land: [ [[x, y], ...], ... ] are the islands
//   zones   flat painted areas under everything (park, plaza, hill, sand, yard, concrete)
//   props   things standing on the ground, placed by hand or scattered (see placeProps)
(function (PE) {
  // width: how wide it's drawn. drive: vans can use it. boat: boats use it. walk: people use it.
  const KINDS = {
    boulevard: { width: 112, drive: true, walk: true },
    road: { width: 82, drive: true, walk: true },
    lane: { width: 54, drive: true, walk: true },
    bridge: { width: 82, drive: true, walk: true, overWater: true },
    path: { width: 26, walk: true },
    boat: { width: 40, boat: true, overWater: true, waterOnly: true },
    rail: { width: 44, train: true },
    drive: { width: 44, drive: true, walk: true },
  };
  const LINKED = (k) => k !== 'rail';   // what "you can get there" means: everything but the train line

  // A Catmull-Rom curve: it passes through every point given, so paths still meet exactly at their nodes.
  function curve(p0, p1, p2, p3, step) {
    const out = [];
    const n = Math.max(1, Math.round(Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) / step));
    for (let i = 0; i < n; i++) {
      const t = i / n, t2 = t * t, t3 = t2 * t;
      const f = (a, b, c, d) => 0.5 * (2 * b + (c - a) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (3 * b - a - 3 * c + d) * t3);
      out.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])]);
    }
    return out;
  }
  function smooth(points, step = 26) {
    if (points.length < 2) return points.slice();
    const out = [];
    for (let i = 0; i < points.length - 1; i++) {
      out.push(...curve(points[i - 1] || points[i], points[i], points[i + 1], points[i + 2] || points[i + 1], step));
    }
    out.push(points[points.length - 1].slice());
    return out;
  }
  function smoothLoop(points, step = 26) {
    const n = points.length, out = [];
    for (let i = 0; i < n; i++) out.push(...curve(points[(i - 1 + n) % n], points[i], points[(i + 1) % n], points[(i + 2) % n], step));
    return out;
  }

  // Worked out once per layout, then kept.
  const memo = new WeakMap();
  function derive(L) {
    let d = memo.get(L);
    if (d) return d;
    d = { lines: [], edges: new Map() };
    const add = (a, b, kind, pts) => {
      const len = lengthOf(pts);
      if (!d.edges.has(a)) d.edges.set(a, []);
      if (!d.edges.has(b)) d.edges.set(b, []);
      d.edges.get(a).push({ to: b, kind, pts, len });
      d.edges.get(b).push({ to: a, kind, pts: pts.slice().reverse(), len });
    };
    for (const p of L.paths) {
      const raw = p.via.map((id) => {
        if (!L.nodes[id]) throw new Error(`${L.id}: path uses unknown point "${id}"`);
        return L.nodes[id];
      });
      const pts = smooth(raw);
      d.lines.push({ kind: p.kind, pts, width: (KINDS[p.kind] || KINDS.road).width });
      // One graph edge per stretch between named points, each following its share of the curve.
      for (let i = 0; i < raw.length - 1; i++) {
        const stretch = curve(raw[i - 1] || raw[i], raw[i], raw[i + 1], raw[i + 2] || raw[i + 1], 26);
        stretch.push(raw[i + 1].slice());
        add(p.via[i], p.via[i + 1], p.kind, stretch);
      }
    }
    // Each building's drive is a short stretch from its door to its named point.
    for (const s of buildingSpots(L)) {
      if (!s.node) continue;
      if (!L.nodes[s.node]) throw new Error(`${L.id}: building uses unknown point "${s.node}"`);
      const n = L.nodes[s.node];
      const door = [s.x, s.y + 34];
      const pts = [door, n];
      d.lines.push({ kind: 'drive', pts: smooth(pts), width: KINDS.drive.width });
      add(doorId(s), s.node, 'drive', smooth(pts));
    }
    d.land = (L.land || []).map((poly) => smoothLoop(poly));
    d.water = (L.water || []).map((w) => (w.type === 'shape' ? { ...w, poly: smoothLoop(w.pts) } : w.type === 'river' ? { ...w, line: smooth(w.pts) } : w));
    memo.set(L, d);
    return d;
  }
  const doorId = (s) => `door:${s.x},${s.y}`;
  const lengthOf = (pts) => { let t = 0; for (let i = 1; i < pts.length; i++) t += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); return t; };

  function buildingSpots(L) {
    return [...Object.values(L.spots), ...(L.rivalSpots || []), ...(L.spareLots || [])];
  }

  const distToLine = (x, y, pts) => {
    let best = Infinity;
    for (let i = 1; i < pts.length; i++) {
      const [ax, ay] = pts[i - 1], [bx, by] = pts[i];
      const l2 = (bx - ax) ** 2 + (by - ay) ** 2 || 1;
      const t = Math.min(1, Math.max(0, ((x - ax) * (bx - ax) + (y - ay) * (by - ay)) / l2));
      best = Math.min(best, Math.hypot(x - (ax + (bx - ax) * t), y - (ay + (by - ay) * t)));
    }
    return best;
  };
  function inPoly(x, y, poly) {
    let inside = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const [xi, yi] = poly[i], [xj, yj] = poly[j];
      if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
  }
  function onWater(L, x, y, margin = 0) {
    const d = derive(L);
    if (L.base === 'sea' && !d.land.some((poly) => inPoly(x, y, poly))) return true;
    return d.water.some((w) => {
      if (w.type === 'pond') return Math.hypot((x - w.x) / (w.rx + margin), (y - w.y) / (w.ry + margin)) < 1;
      if (w.type === 'river') return distToLine(x, y, w.line) < w.width / 2 + margin;
      return inPoly(x, y, w.poly);
    });
  }
  // The space a building takes. Facilities are the biggest; a spare lot is flat ground.
  function footprints(L) {
    return [
      ...Object.entries(L.spots).map(([id, s]) => ({ id, s, x0: s.x - 175, x1: s.x + 175, y0: s.y - 300, y1: s.y + 62 })),
      ...(L.rivalSpots || []).map((s) => ({ id: s.rival, s, x0: s.x - 125, x1: s.x + 125, y0: s.y - 270, y1: s.y + 58 })),
      ...(L.spareLots || []).map((s) => ({ id: `lot ${s.x},${s.y}`, s, x0: s.x - 130, x1: s.x + 130, y0: s.y - 70, y1: s.y + 60 })),
    ];
  }
  const inFootprint = (f, x, y, r = 0) => x > f.x0 - r && x < f.x1 + r && y > f.y0 - r && y < f.y1 + r;

  // ---- Getting around ------------------------------------------------------------------------------------
  // The way between two named points (or a building's door), as a line of points. Null if there isn't one.
  function route(L, from, to, allow = (k) => (KINDS[k] || {}).drive) {
    const { edges } = derive(L);
    if (!edges.has(from) || !edges.has(to)) return null;
    const dist = new Map([[from, 0]]), prev = new Map(), open = new Set([from]);
    while (open.size) {
      let u = null;
      for (const n of open) if (u === null || dist.get(n) < dist.get(u)) u = n;
      open.delete(u);
      if (u === to) break;
      for (const e of edges.get(u)) {
        if (!allow(e.kind)) continue;
        const nd = dist.get(u) + e.len;
        if (nd < (dist.has(e.to) ? dist.get(e.to) : Infinity)) { dist.set(e.to, nd); prev.set(e.to, { from: u, e }); open.add(e.to); }
      }
    }
    if (!prev.has(to)) return from === to ? [] : null;
    const parts = [];
    for (let at = to; at !== from; at = prev.get(at).from) parts.unshift(prev.get(at).e.pts);
    const out = [];
    for (const p of parts) out.push(...(out.length ? p.slice(1) : p));
    return out;
  }
  const routeBetween = (L, a, b, allow) => route(L, doorId(a), doorId(b), allow);

  // Every named point and door you can reach from the first building, by any linked path.
  function reachable(L) {
    const { edges } = derive(L);
    const start = doorId(buildingSpots(L)[0]);
    const seen = new Set([start]), todo = [start];
    while (todo.length) {
      for (const e of edges.get(todo.pop()) || []) {
        if (LINKED(e.kind) && !seen.has(e.to)) { seen.add(e.to); todo.push(e.to); }
      }
    }
    return seen;
  }
  // A web has loops. A single road with side branches has none. Counts how many independent loops there are.
  function loops(L) {
    const { edges } = derive(L);
    const nodes = [...edges.keys()].filter((n) => !n.startsWith('door:'));
    const seen = new Set();
    let parts = 0, count = 0;
    for (const n of nodes) {
      if (seen.has(n)) continue;
      parts++;
      const todo = [n];
      seen.add(n);
      while (todo.length) for (const e of edges.get(todo.pop())) if (!e.to.startsWith('door:') && LINKED(e.kind) && !seen.has(e.to)) { seen.add(e.to); todo.push(e.to); }
    }
    for (const n of nodes) count += edges.get(n).filter((e) => !e.to.startsWith('door:') && LINKED(e.kind)).length;
    return count / 2 - nodes.length + parts;
  }
  const linesOf = (L, test) => derive(L).lines.filter((l) => test(KINDS[l.kind] || {}, l.kind));

  // ---- Filler --------------------------------------------------------------------------------------------
  // Everything standing on the ground, in one list, the same every time (fixed dice), and clear of roads,
  // water and buildings.
  //   { type: 'tree', x, y }                        one thing, placed by hand
  //   { type: 'scatter', what: ['tree', 'bush'], area: [x0, y0, x1, y1], count }   thrown around an area
  //   { type: 'clump', what: ['tree'], x, y, r, count }                            a natural-looking group
  const SIZE = { tree: 46, pine: 36, palm: 36, bush: 22, flowers: 22, rock: 22, house: 78, shed: 42, shop: 74, warehouse: 118, container: 44, tower: 74, crate: 22, cottage: 66, stall: 34, umbrella: 22 };
  function placeProps(L) {
    const d = derive(L);
    if (d.props) return d.props;
    const out = [];
    const roads = d.lines;
    const prints = footprints(L);
    const dice = (label) => PE.Rng.roll(`layout:${L.id}:${label}`);
    const clear = (x, y, type, r) => {
      if (x < r || y < r || x > L.w - r || y > L.h - r) return false;
      if (type !== 'reed' && onWater(L, x, y, r)) return false;
      if (roads.some((l) => distToLine(x, y, l.pts) < l.width / 2 + r)) return false;
      if (prints.some((f) => inFootprint(f, x, y, r))) return false;
      if ((L.keepClear || []).some((z) => Math.hypot(x - z.x, y - z.y) < z.r + r)) return false;
      return !out.some((o) => o.solid && Math.hypot(o.x - x, (o.y - y) * 1.4) < (o.r + r) * 0.82);
    };
    const put = (type, x, y, extra = {}) => out.push({ type, x, y, r: SIZE[type] || 20, solid: !!SIZE[type], ...extra });
    (L.props || []).forEach((p) => { if (!['scatter', 'clump'].includes(p.type)) put(p.type, p.x, p.y, p); });
    (L.props || []).forEach((p, pi) => {
      if (p.type !== 'scatter' && p.type !== 'clump') return;
      for (let i = 0; i < p.count; i++) {
        const type = p.what[Math.floor(dice(`${pi}:k${i}`) * p.what.length)];
        let x, y;
        if (p.type === 'scatter') {
          const [x0, y0, x1, y1] = p.area;
          x = x0 + dice(`${pi}:x${i}`) * (x1 - x0);
          y = y0 + dice(`${pi}:y${i}`) * (y1 - y0);
        } else {
          const a = dice(`${pi}:a${i}`) * Math.PI * 2, r = Math.sqrt(dice(`${pi}:r${i}`)) * p.r;
          x = p.x + Math.cos(a) * r;
          y = p.y + Math.sin(a) * r * 0.7;
        }
        if (clear(x, y, type, SIZE[type] || 20)) put(type, x, y, { tone: dice(`${pi}:t${i}`) });
      }
    });
    d.props = out.sort((a, b) => a.y - b.y);
    return d.props;
  }

  PE.MapPaths = { KINDS, smooth, smoothLoop, derive, route, routeBetween, reachable, loops, onWater, footprints, inFootprint, placeProps, linesOf, doorId, buildingSpots, distToLine, lengthOf };
})(globalThis.PE = globalThis.PE || {});
