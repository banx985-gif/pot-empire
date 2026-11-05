// The living Empire map. Each district has its own layout file in data/map/ (D1.js, D2.js ...), and is
// listed in index.html after this one. See js/logic/map_paths.js for what goes in a layout file.
//
// To add a district in a future update: add a file in data/map/, add its script line to index.html, and add
// a row to balance "districts" (with its facilities). Saves only remember district ids they've seen, so
// nothing needs to change in old saves. A district can be any shape: tests/fixtures/island_layout.js is a
// working example of islands joined by bridges and boats.
(globalThis.PE = globalThis.PE || {}).Data = globalThis.PE.Data || {};
globalThis.PE.Data.map = {
  districts: [],

  // Which picture each renovation shows: base, renovated, renovated, fully renovated.
  // Real art comes as BLD-Fnn-1, -2, -3 (docs/MAP_ART_PROMPTS.md), and a locked lot as TIL-12.
  lookForRenovation: [1, 2, 2, 3],
  lockedLotArt: 'TIL-12',
};
