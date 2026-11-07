// The living Empire map. Each district has its own layout file in data/map/ (D1.js, D2.js ...), and is
// listed in index.html after this one. See js/logic/map_paths.js for what goes in a layout file.
//
// To add a district in a future update: paint it (art/map/districts), add a file in data/map/, add its script
// line to index.html, and add a row to balance "districts" (with its facilities). Saves only remember district
// ids they've seen, so nothing needs to change in old saves. A district can be any shape:
// tests/fixtures/island_layout.js is a working example of islands joined by bridges and boats.
//
// Each district's map units are the painting's: 1000 wide, 1800 tall. Move a building by changing its clearing's numbers.
(globalThis.PE = globalThis.PE || {}).Data = globalThis.PE.Data || {};
(function (Data) {
  const MAX_BUILDING = 360;    // a building never gets wider than this, however big its painted plot
  // A painted clearing: its middle (cx, cy) and its width and height on the painting. A building stands in the middle,
  // with its front corner at (x, y). The picture's base is about 0.58 as tall as it's wide, so that's where the
  // front corner lands.
  // Near the painting's top edge a tall building would poke off the map, so a layout can set its own w and y there.
  const plot = (cx, cy, pw, ph, extra = {}) => {
    const w = extra.w || Math.min(MAX_BUILDING, Math.round(pw * 0.95));
    return { x: cx, y: Math.round(cy + w * 0.29), w, cx, cy, pw, ph, ...extra };
  };
  // Every clearing joins the street at the nearest named point, and its door is on its edge facing that point.
  function painted(L) {
    const all = [...Object.values(L.spots), ...Object.values(L.features), ...L.rivalSpots, ...L.spareLots];
    for (const s of all) {
      if (!s.node) s.node = Object.keys(L.nodes).filter((n) => !(L.notStreet || []).includes(n)).sort((a, b) => Math.hypot(L.nodes[a][0] - s.cx, L.nodes[a][1] - s.cy) - Math.hypot(L.nodes[b][0] - s.cx, L.nodes[b][1] - s.cy))[0];
      const [nx, ny] = L.nodes[s.node];
      const a = Math.atan2((ny - s.cy) / (s.ph / 2), (nx - s.cx) / (s.pw / 2));
      s.door = [Math.round(s.cx + Math.cos(a) * s.pw * 0.42), Math.round(s.cy + Math.sin(a) * s.ph * 0.42)];
    }
    return L;
  }
  Data.map = {
    districts: [],
    plot,
    painted,
    // Which picture each renovation shows: base, renovated, renovated, fully renovated.
    lookForRenovation: [1, 2, 2, 3],
    // Which size each building's inside is at, by renovation (job 16): size 2 at R1, size 3 at R2. R3 keeps size 3.
    roomForRenovation: [1, 2, 3, 3],
    lockedLotArt: 'TIL-12',
    // How you arrive in each district (js/ui/travel.js). Cowork's pick, from TRANSITION_ART.md: easy to change.
    travel: {
      D1: { style: 'A', puff: 'TRANS-PUFF', cloud: 'TRANS-CLOUD-FULL' },
      D2: { style: 'A', puff: 'TRANS-PUFF', cloud: 'TRANS-CLOUD-FULL' },
      D3: { style: 'B', band: 'TRANS-SMOKE-WIPE' },
      D4: { style: 'C', puff: 'TRANS-SMOKE-PINK', cloud: 'TRANS-CLOUD-PINK' },
    },
    // Where the chimney is on each factory picture (fractions of its width and height): the smoke comes from there.
    chimney: { 'BLD-F05-1': [0.24, 0.21], 'BLD-F05-2': [0.21, 0.22], 'BLD-F05-3': [0.17, 0.21] },
  };
})(globalThis.PE.Data);
