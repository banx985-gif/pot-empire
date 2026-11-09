// Where everything stands in a grow room, in "world units". Pure numbers, no drawing. The Phaser
// room and the spacing test both read these, so the test checks what the game really draws.
//
// Each hydro model's frame is real art with 7 pot holes on a slant, so the pots follow that slant. Where things
// attach is data: data/hydro_anchors.js. A station's (x, y) is the middle pot hole.
//
// The fully expanded seven-pot footprint is reserved from the start (bible section 3), so a setup
// never has to move when it grows. To stop setups touching, raise gapX / gapZ. Never shrink or hide art.
(function (PE) {
  const WORLD = {
    plantScale: 0.32,      // world units per pixel of the full-size strain sheet
    seedScale: 0.11,
    potSpacing: 135,       // sideways, between fixed pot anchors. Each frame is scaled to fit this.
    railHeight: 760,       // the rail's underside above the middle pot hole, on every model
    // Sizes of the pieces on screen, by level 1-6. The other side comes from each picture's own shape.
    // Job 19C: pots 25% bigger than before (108 to 132), so they sit proud of the holes. Their bottoms stay put.
    potWidth: [135, 140, 145, 150, 158, 165],
    trayWidth: 165,
    lightHeight: [190, 220, 240, 260, 280, 300],
    lightMaxWidth: 640,
    sprinklerHeight: [110, 120, 130, 140, 150, 160],
    sprinklerMaxWidth: 560,
    computerWidth: [110, 130, 150, 170, 190, 210],
    baseWidth: 170,
    badgeWidth: 150,
    rimAt: 0.2,            // how far down the pot picture its rim line is
    potBaseForFx: 20,      // the quality effects' base line, below the rim
    potSink: 22,           // a pot's bottom sits this far below the middle of its hole
    labelBelow: 60,        // the name sign under the bench
    fxHeadroom: 16,        // sparkles / rainbow reaching above a plant
    gapX: 220,             // clear floor between neighbouring whole setups: wide, as Aaron asked
    gapZ: 180,
    margin: 90,
    wallHeight: 180,
    lookDown: 44,          // camera angle, degrees. The floor is squashed by sin(angle).
    // Fixed pot anchors, from the middle outward: pot 1 is the middle spot.
    anchorOrder: [3, 2, 4, 1, 5, 0, 6],
  };

  function maxPlantSize(data) {
    let w = 0, h = 0;
    for (const s of Object.values(data.strainFrames.sheets)) {
      for (const f of s.frames.slice(1)) { w = Math.max(w, f.w); h = Math.max(h, f.h); }
    }
    return { w: w * WORLD.plantScale, h: h * WORLD.plantScale };
  }

  const anchorX = (potIndex) => (WORLD.anchorOrder[potIndex] - 3) * WORLD.potSpacing;

  // Job 19: Aaron's straight-on redraws (data/hydro_straight.js, measured by tools/import_hydro_art.js). A model uses
  // them once its FRAME is redrawn. face: 'front' (the default), or 'left' / 'right' for a setup turned sideways, which
  // only a model with a FRAME-SIDE picture can do. Anything else falls back to the front.
  const straightOf = (data, m) => (data.hydroStraight || {})[m] || null;
  function faceFor(data, m, face) {
    const S = straightOf(data, m);
    if (!S || !face || face === 'front' || !S.side) return 'front';
    return face === 'right' ? 'right' : 'left';
  }

  // Everything about one model's frame (facing one way), worked out from its anchors.
  // slots: the 7 hole positions from the middle one, { x, y, k } (k: how big a pot looks there, 1 = full size).
  // order: which slot pot 0, 1, 2... stands in.
  const memo = {};
  function model(data, m, face) {
    face = faceFor(data, m, face);
    const key = `${m}|${face}`;
    if (memo[key] && memo[key].data === data) return memo[key];
    const S = straightOf(data, m);
    let out;
    if (S && face === 'front') out = straightFront(data, m, S.front);
    else if (S) out = straightSide(data, m, S, face);
    else out = angled(data, m);
    out.data = data;
    out.face = face;
    memo[key] = out;
    return out;
  }
  // The frame in three slices: the band with only the posts in it stretches, so the rail is railHeight above the
  // middle hole and clears the tallest plant.
  function frameOf(size, s, hx, hy, railY, stretch) {
    const [b0, b1] = stretch;
    const extra = Math.max(0, WORLD.railHeight - (hy - railY) * s);
    return {
      x: -hx * s, y: -hy * s - extra, w: size[0] * s, s, slices: [b0, b1],
      topH: b0 * s, midH: (b1 - b0) * s + extra, botH: (size[1] - b1) * s,
      bottom: (size[1] - hy) * s, pxW: size[0], pxH: size[1],
    };
  }
  // The old angled benches: holes on a slant, evenly spaced between the first and last.
  function angled(data, m) {
    const a = data.hydroAnchors[m];
    const size = data.hydroArt[`M${m}-FRAME`];
    const [[x0, y0], [x1, y1]] = a.holes;
    const s = WORLD.potSpacing / ((x1 - x0) / 6);
    const hx = (x0 + x1) / 2, hy = (y0 + y1) / 2;
    const slotDy = ((y1 - y0) / 6) * s;
    return {
      straight: false, frameId: `M${m}-FRAME`, flip: false,
      frame: frameOf(size, s, hx, hy, a.railY, a.stretch),
      slotDy,
      slots: [0, 1, 2, 3, 4, 5, 6].map((i) => ({ x: (i - 3) * WORLD.potSpacing, y: (i - 3) * slotDy, k: 1 })),
      order: WORLD.anchorOrder,
      hang: { x: (a.hangX - hx) * s, y: -WORLD.railHeight },
      badge: { x: (a.badge[0] - hx) * s, y: (a.badge[1] - hy) * s },
      computer: a.computer,
    };
  }
  // A redrawn bench facing the screen: the 7 holes in one straight row, shown as wide as the old bench was.
  function straightFront(data, m, F) {
    const a = data.hydroAnchors[m];
    const old = (data.hydroOldSizes || {})[m];
    const s = (old ? old.frameW : 1250) / F.size[0];
    const [hx, hy] = F.holes[3];
    const frame = frameOf(F.size, s, hx, hy, F.railY, F.stretch);
    return {
      straight: true, frameId: `M${m}-FRAME`, flip: false, frame,
      slotDy: 0,
      slots: F.holes.map(([x, y]) => ({ x: (x - hx) * s, y: (y - hy) * s, k: 1 })),
      order: WORLD.anchorOrder,
      hang: { x: (F.hangX - hx) * s, y: -WORLD.railHeight },
      badge: { x: (F.badge[0] - hx) * s, y: (F.badge[1] - hy) * s },
      // The computer stands at the bench's end, its feet level with the bench's.
      computer: { x: a.computer.x, y: Math.round(frame.bottom) },
      holeW: (F.hw.reduce((t, w) => t + w, 0) / 7) * s,
    };
  }
  // A redrawn bench turned sideways: the holes run away from you, the far ones smaller. 'right' uses the bench seen
  // from its other side (FRAME-SIDE-FLIP), or the side picture mirrored if there isn't one.
  function straightSide(data, m, S, face) {
    const flipArt = face === 'right' && S.sideFlip;
    const F = flipArt ? S.sideFlip : S.side;
    const mirror = face === 'right' && !S.sideFlip ? -1 : 1;
    const front = straightFront(data, m, S.front);
    // The nearest pot is as big as a pot on the front-facing bench.
    const s = front.holeW / F.hw[0];
    const [hx, hy] = F.holes[3];
    const frame = frameOf(F.size, s, hx, hy, F.railY, F.stretch);
    if (mirror < 0) frame.x = -(F.size[0] - hx) * s;
    const near = F.holes[0];
    return {
      straight: true, side: true, frameId: `M${m}-FRAME-SIDE${flipArt ? '-FLIP' : ''}`, flip: mirror < 0, frame,
      slotDy: 0,
      slots: F.holes.map(([x, y], i) => ({ x: (x - hx) * s * mirror, y: (y - hy) * s, k: F.hw[i] / F.hw[0] })),
      // Nearest first, so the first pots planted are the big ones at the front.
      order: [0, 1, 2, 3, 4, 5, 6],
      hang: { x: (F.hangX - hx) * s * mirror, y: -WORLD.railHeight },
      badge: null,
      computer: { x: frame.w / 2 + 150, y: Math.round((near[1] - hy) * s + 40) },
      holeW: front.holeW,
    };
  }
  // Where a pot stands, from the station's middle hole: { x, y, k }.
  const potAt = (data, m, potIndex, face) => { const M = model(data, m, face); return M.slots[M.order[potIndex]]; };
  // A pot's position from the station's middle hole.
  const slotY = (data, m, potIndex, face) => potAt(data, m, potIndex, face).y;
  const potX = (data, m, potIndex, face) => potAt(data, m, potIndex, face).x;

  // The size of a piece on screen: { w, h }.
  function piece(data, m, part, level, face) {
    let id = level ? `M${m}-${part}-${level}` : `M${m}-${part}`;
    // A light seen from the side, if Aaron has drawn that one.
    const side = part === 'LGT' && face && faceFor(data, m, face) !== 'front' && data.hydroArt[`${id}-SIDE`];
    if (side) id += '-SIDE';
    const [pw, ph] = data.hydroArt[id] || [100, 100];
    const aspect = pw / ph;
    const byWidth = (w) => ({ w, h: w / aspect });
    const byHeight = (h, maxW) => { const w = Math.min(h * aspect, maxW); return { w, h: w / aspect }; };
    if (part === 'POT') return byWidth(WORLD.potWidth[level - 1]);
    if (part === 'TRAY') return byWidth(WORLD.trayWidth);
    if (part === 'LGT') {
      if (side) return { ...byHeight(WORLD.lightHeight[level - 1], WORLD.lightMaxWidth), id };
      // As wide as the old light was (job 19: the redrawn ones are a different shape).
      const old = (data.hydroOldSizes || {})[m];
      if (!old) return { ...byHeight(WORLD.lightHeight[level - 1], WORLD.lightMaxWidth), id };
      return { ...byWidth(Math.min(WORLD.lightHeight[level - 1] * old.light[level - 1], WORLD.lightMaxWidth)), id };
    }
    if (part === 'SPR') return byHeight(WORLD.sprinklerHeight[level - 1], WORLD.sprinklerMaxWidth);
    if (part === 'CMP') return byWidth(WORLD.computerWidth[level - 1]);
    if (part === 'BASE') return byWidth(WORLD.baseWidth);
    if (part === 'BADGE') return byWidth(WORLD.badgeWidth);
    return byWidth(pw);
  }

  // Where a pot's parts go, from the station's middle hole. k: smaller for the far holes of a sideways setup.
  function potSpot(data, m, potIndex, potLevel, face) {
    const at = potAt(data, m, potIndex, face);
    let full = piece(data, m, 'POT', potLevel);
    // On a straight bench the pots stand side by side: never wider than the gap between holes, so they don't touch.
    // (Turned sideways, the nearest pot is the same size as on the front-facing bench.)
    const M = model(data, m, 'front');
    if (M.straight) { const gap = Math.abs(M.slots[1].x - M.slots[0].x) * 0.96; if (full.w > gap) full = { w: gap, h: (full.h * gap) / full.w }; }
    const size = { w: full.w * at.k, h: full.h * at.k };
    const bottom = at.y + WORLD.potSink * at.k;
    return { x: at.x, y: at.y, k: at.k, bottom, top: bottom - size.h, rim: bottom - size.h * (1 - WORLD.rimAt), w: size.w, h: size.h };
  }

  // The light hangs from the rail, the sprinkler just under it, and the spray runs from there to the pots.
  function overhead(data, m, lights, sprinkler, face) {
    const M = model(data, m, face);
    const L = piece(data, m, 'LGT', lights, face), S = piece(data, m, 'SPR', sprinkler);
    const lightTop = M.hang.y - 8;
    const lightBottom = lightTop + L.h;
    const sprTop = lightBottom - 14;
    const sprBottom = sprTop + S.h;
    return { x: M.hang.x, lightTop, lightBottom, sprTop, sprBottom, L, S };
  }

  // The most any model can ever take up, around its middle hole, whichever way it faces.
  function modelBounds(data, m) {
    const faces = straightOf(data, m) && straightOf(data, m).side ? ['front', 'left', 'right'] : ['front'];
    const all = faces.map((f) => faceBounds(data, m, f));
    return { l: Math.min(...all.map((b) => b.l)), r: Math.max(...all.map((b) => b.r)), t: Math.min(...all.map((b) => b.t)), b: Math.max(...all.map((b) => b.b)) };
  }
  function faceBounds(data, m, face) {
    const M = model(data, m, face);
    const p = maxPlantSize(data);
    let l = M.frame.x, r = M.frame.x + M.frame.w, t = M.frame.y, b = M.frame.bottom + WORLD.labelBelow;
    for (let i = 0; i < 7; i++) {
      const spot = potSpot(data, m, i, 6, face);
      const half = Math.max(p.w, WORLD.trayWidth) * spot.k / 2;
      l = Math.min(l, spot.x - half);
      r = Math.max(r, spot.x + half);
    }
    const O = overhead(data, m, 6, 6, face);
    l = Math.min(l, O.x - O.L.w / 2); r = Math.max(r, O.x + O.L.w / 2);
    const cmp = piece(data, m, 'CMP', 6), base = piece(data, m, 'BASE');
    const half = Math.max(cmp.w, base.w) / 2;
    r = Math.max(r, M.computer.x + half);
    l = Math.min(l, -M.computer.x - base.w / 2);   // the water pump stands on the other side (job 18)
    b = Math.max(b, M.computer.y + 8);
    return { l, r, t, b };
  }


  function setupBox(data) {
    let halfW = 0, up = 0, down = 0;
    for (const m of Object.keys(data.hydroAnchors)) {
      const B = modelBounds(data, m);
      halfW = Math.max(halfW, -B.l, B.r);
      up = Math.max(up, -B.t);
      down = Math.max(down, B.b);
    }
    return { halfW, up: up + WORLD.fxHeadroom, down };
  }

  const columnsFor = (n) => (n <= 3 ? 1 : n <= 6 ? 2 : 3);

  // The whole room for a grow facility: its size and where each station's middle pot hole sits.
  function room(data, stationCount) {
    const box = setupBox(data);
    const cols = columnsFor(stationCount);
    const rows = Math.ceil(stationCount / cols);
    const cellW = box.halfW * 2 + WORLD.gapX;
    const cellH = box.up + box.down + WORLD.gapZ;
    const w = cols * cellW - WORLD.gapX + WORLD.margin * 2;
    const h = WORLD.wallHeight + rows * cellH - WORLD.gapZ + WORLD.margin;
    const stations = [];
    for (let i = 0; i < stationCount; i++) {
      const col = i % cols, row = Math.floor(i / cols);
      stations.push({
        x: WORLD.margin + box.halfW + col * cellW,
        y: WORLD.wallHeight + box.up + row * cellH,
      });
    }
    return { w, h, cols, rows, stations, box };
  }

  // The part of the room you can see at one of its 3 sizes: enough for the open spots, plus a bit more floor each
  // size. Spots stay where they are, so a setup never moves when the room grows.
  function roomView(R, open, size) {
    const cols = Math.min(R.cols, Math.max(1, open));
    const rows = Math.max(1, Math.ceil(open / R.cols));
    const cellW = R.box.halfW * 2 + WORLD.gapX, cellH = R.box.up + R.box.down + WORLD.gapZ;
    const extra = (size - 1) * 90;
    return {
      w: Math.min(R.w, cols * cellW - WORLD.gapX + WORLD.margin * 2 + extra),
      h: Math.min(R.h + 2 * 90, WORLD.wallHeight + rows * cellH - WORLD.gapZ + WORLD.margin + extra),
    };
  }

  // The space a setup can ever occupy, at its biggest. Used by the spacing test.
  function setupBounds(pos, box) {
    return { left: pos.x - box.halfW, right: pos.x + box.halfW, top: pos.y - box.up, bottom: pos.y + box.down };
  }

  // ---- The real rooms (job 16): Aaron's room pictures, with spots worked out by tools/build_room_spots.js ----------
  // A shelf or machine in a shop or the factory, around its spot (js/ui/biz_room.js draws them this size).
  const FURNITURE = { halfW: 215, up: 200, down: 190 };
  // Where each setup's legs stand, around its middle pot hole: the part that has to be on open floor.
  const FOOT = { setup: { l: -690, r: 705, t: -60, b: 480 }, shelf: { l: -215, r: 215, t: -40, b: 190 }, machine: { l: -215, r: 215, t: -40, b: 190 } };

  // One building's room at one of its 3 sizes. Spots fine-tuned by eye win over the worked-out ones: first the shared
  // ones in data/room_spot_overrides.js, then (on a tester's phone) any moved with the tester panel.
  // Returns the room's size in game units, its picture, and its spots in order (spot i is station, shelf or machine i).
  function roomAt(data, fid, size, local) {
    const id = `${fid}-${size}`;
    const r = data.roomSpots && data.roomSpots[id];
    if (!r) return null;
    const moved = Object.assign({}, (data.roomSpotOverrides || {})[id], local && local[id]);
    // A third entry turns a setup sideways (job 19): 'F01-1': { 0: [x, y, 'left'] }. Only models with a side view
    // of their bench can; the rest face the front.
    const spots = r.spots.map((p, i) => (moved[i] ? { ...p, x: Math.round(moved[i][0]), y: Math.round(moved[i][1]), ...(moved[i][2] ? { face: moved[i][2] } : {}) } : { ...p }));
    const box = r.kind === 'grow' ? setupBox(data) : FURNITURE;
    // Decoration sockets moved by hand are saved under "s:<socket>" beside the numbered spots.
    const sockets = {};
    for (const [name, s] of Object.entries(r.sockets || {})) sockets[name] = moved['s:' + name] ? { ...s, x: Math.round(moved['s:' + name][0]), y: Math.round(moved['s:' + name][1]) } : { ...s };
    return {
      id, fid, size, kind: r.kind, w: r.w, h: r.h, scale: r.scale, picture: `ROOM-${id}`, pictureSize: r.picture,
      floor: r.floor, counter: r.counter, door: r.door, keepClear: r.keepClear || [], sockets,
      spots, stations: spots.map((p) => ({ x: p.x, y: p.y })), box, foot: FOOT[spots[0] ? spots[0].type : 'setup'],
    };
  }
  // Is this point on the room's open floor?
  function onFloor(room, x, y) {
    let inside = false;
    const P = room.floor;
    for (let i = 0, j = P.length - 1; i < P.length; j = i++) {
      const [xi, yi] = P[i], [xj, yj] = P[j];
      if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
  }

  PE.Layout = { WORLD, FURNITURE, FOOT, maxPlantSize, setupBox, anchorX, slotY, potX, potAt, faceFor, model, modelBounds, piece, potSpot, overhead, columnsFor, room, roomView, setupBounds, roomAt, onFloor };
})(globalThis.PE = globalThis.PE || {});
