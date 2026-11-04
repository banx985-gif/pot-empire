// Where everything stands in a grow room, in "world units". Pure numbers, no drawing. The Phaser
// room and the spacing test both read these, so the test checks what the game really draws.
//
// The fully expanded seven-pot footprint is reserved from the start (bible section 3), so a setup
// never has to move when it grows. To stop setups touching, raise gapX / gapZ. Never shrink or hide art.
(function (PE) {
  const WORLD = {
    plantScale: 0.26,      // world units per pixel of the full-size strain sheet
    seedScale: 0.11,
    potSpacing: 135,       // between fixed pot anchors
    potWidth: [74, 80, 80, 88, 94, 100],   // by pot level
    potHeight: [40, 42, 48, 48, 52, 56],
    plantBaseAbovePot: 28, // the stem starts this far above the pot's base line
    lightY: 232,           // light height above the pot base line
    sprinklerY: 208,       // sprinkler hangs just below the light
    gantryTop: 262,
    gantryHalfExtra: 18,
    fxHeadroom: 16,        // sparkles / rainbow reaching above the gantry
    benchBelow: 72,        // bench, computer and name sign below the pot base line
    gapX: 120,             // clear floor between neighbouring whole setups
    gapZ: 120,
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

  function setupBox(data) {
    const p = maxPlantSize(data);
    const halfW = 3 * WORLD.potSpacing + p.w / 2 + WORLD.gantryHalfExtra;
    const up = Math.max(WORLD.gantryTop, p.h + WORLD.plantBaseAbovePot) + WORLD.fxHeadroom;
    return { halfW, up, down: WORLD.benchBelow };
  }

  const anchorX = (potIndex) => (WORLD.anchorOrder[potIndex] - 3) * WORLD.potSpacing;
  const columnsFor = (n) => (n <= 3 ? 1 : n <= 6 ? 2 : 3);

  // The whole room for a grow facility: its size and where each station's pot line sits.
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

  // The space a setup can ever occupy, at its biggest. Used by the spacing test.
  function setupBounds(pos, box) {
    return { left: pos.x - box.halfW, right: pos.x + box.halfW, top: pos.y - box.up, bottom: pos.y + box.down };
  }

  PE.Layout = { WORLD, maxPlantSize, setupBox, anchorX, columnsFor, room, setupBounds };
})(globalThis.PE = globalThis.PE || {});
