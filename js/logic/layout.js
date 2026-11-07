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
    potWidth: [108, 112, 116, 120, 126, 132],
    trayWidth: 132,
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

  // Everything about one model's frame, worked out from its anchors.
  const memo = {};
  function model(data, m) {
    if (memo[m]) return memo[m];
    const a = data.hydroAnchors[m];
    const size = data.hydroArt[`M${m}-FRAME`];
    const [[x0, y0], [x1, y1]] = a.holes;
    const s = WORLD.potSpacing / ((x1 - x0) / 6);
    const hx = (x0 + x1) / 2, hy = (y0 + y1) / 2;
    const [b0, b1] = a.stretch;
    const extra = WORLD.railHeight - (hy - a.railY) * s;
    const top = -hy * s - extra;
    const frame = {
      x: -hx * s, y: top, w: size[0] * s, s, slices: [b0, b1],
      topH: b0 * s, midH: (b1 - b0) * s + extra, botH: (size[1] - b1) * s,
      bottom: (size[1] - hy) * s, pxW: size[0], pxH: size[1],
    };
    memo[m] = {
      frame,
      slotDy: ((y1 - y0) / 6) * s,
      hang: { x: (a.hangX - hx) * s, y: -WORLD.railHeight },
      badge: { x: (a.badge[0] - hx) * s, y: (a.badge[1] - hy) * s },
      computer: a.computer,
    };
    return memo[m];
  }
  // A pot's position from the station's middle hole.
  const slotY = (data, m, potIndex) => (WORLD.anchorOrder[potIndex] - 3) * model(data, m).slotDy;

  // The size of a piece on screen: { w, h }.
  function piece(data, m, part, level) {
    const id = level ? `M${m}-${part}-${level}` : `M${m}-${part}`;
    const [pw, ph] = data.hydroArt[id] || [100, 100];
    const aspect = pw / ph;
    const byWidth = (w) => ({ w, h: w / aspect });
    const byHeight = (h, maxW) => { const w = Math.min(h * aspect, maxW); return { w, h: w / aspect }; };
    if (part === 'POT') return byWidth(WORLD.potWidth[level - 1]);
    if (part === 'TRAY') return byWidth(WORLD.trayWidth);
    if (part === 'LGT') return byHeight(WORLD.lightHeight[level - 1], WORLD.lightMaxWidth);
    if (part === 'SPR') return byHeight(WORLD.sprinklerHeight[level - 1], WORLD.sprinklerMaxWidth);
    if (part === 'CMP') return byWidth(WORLD.computerWidth[level - 1]);
    if (part === 'BASE') return byWidth(WORLD.baseWidth);
    if (part === 'BADGE') return byWidth(WORLD.badgeWidth);
    return byWidth(pw);
  }

  // Where a pot's parts go, from the station's middle hole.
  function potSpot(data, m, potIndex, potLevel) {
    const y = slotY(data, m, potIndex);
    const size = piece(data, m, 'POT', potLevel);
    const bottom = y + WORLD.potSink;
    return { x: anchorX(potIndex), y, bottom, top: bottom - size.h, rim: bottom - size.h * (1 - WORLD.rimAt), w: size.w, h: size.h };
  }

  // The light hangs from the rail, the sprinkler just under it, and the spray runs from there to the pots.
  function overhead(data, m, lights, sprinkler) {
    const M = model(data, m);
    const L = piece(data, m, 'LGT', lights), S = piece(data, m, 'SPR', sprinkler);
    const lightTop = M.hang.y - 8;
    const lightBottom = lightTop + L.h;
    const sprTop = lightBottom - 14;
    const sprBottom = sprTop + S.h;
    return { x: M.hang.x, lightTop, lightBottom, sprTop, sprBottom, L, S };
  }

  // The most any model can ever take up, around its middle hole.
  function modelBounds(data, m) {
    const M = model(data, m);
    const p = maxPlantSize(data);
    let l = M.frame.x, r = M.frame.x + M.frame.w, t = M.frame.y, b = M.frame.bottom + WORLD.labelBelow;
    for (let i = 0; i < 7; i++) {
      const spot = potSpot(data, m, i, 6);
      l = Math.min(l, spot.x - Math.max(p.w, WORLD.trayWidth) / 2);
      r = Math.max(r, spot.x + Math.max(p.w, WORLD.trayWidth) / 2);
    }
    const O = overhead(data, m, 6, 6);
    l = Math.min(l, O.x - O.L.w / 2); r = Math.max(r, O.x + O.L.w / 2);
    const cmp = piece(data, m, 'CMP', 6), base = piece(data, m, 'BASE');
    const half = Math.max(cmp.w, base.w) / 2;
    r = Math.max(r, M.computer.x + half);
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
    const spots = r.spots.map((p, i) => (moved[i] ? { ...p, x: Math.round(moved[i][0]), y: Math.round(moved[i][1]) } : { ...p }));
    const box = r.kind === 'grow' ? setupBox(data) : FURNITURE;
    return {
      id, fid, size, kind: r.kind, w: r.w, h: r.h, scale: r.scale, picture: `ROOM-${id}`, pictureSize: r.picture,
      floor: r.floor, counter: r.counter, door: r.door, keepClear: r.keepClear || [],
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

  PE.Layout = { WORLD, FURNITURE, FOOT, maxPlantSize, setupBox, anchorX, slotY, model, modelBounds, piece, potSpot, overhead, columnsFor, room, roomView, setupBounds, roomAt, onFloor };
})(globalThis.PE = globalThis.PE || {});
