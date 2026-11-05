// The living Empire map: four outdoor districts, each taller than wide. Only data: where things stand.
// To add a district in a future update, add a row here and one to balance "districts" (with its
// facilities). Saves only remember district ids they've seen, so nothing needs to change in old saves.
//
//   w, h         size of the map, in map units
//   spots        where each facility's building stands (x, y = the middle of its front edge)
//   roads        lines of [x, y] points: the road network. The first one is the main road.
//   spareLots    empty ground kept free for buildings added later
//   rivalSpots   rival CEO buildings at the edges of the map
//   helperSpots  where the helpers can stand when nothing new is nearby
(globalThis.PE = globalThis.PE || {}).Data = globalThis.PE.Data || {};
globalThis.PE.Data.map = {
  // The stand-in look of each district's ground. Real ground tiles replace these colours later.
  districts: [
    {
      id: 'D1', w: 1200, h: 2800,
      look: { grass: 0x5fae3c, grassDark: 0x4a9632, road: 0x4b4658, line: 0xffd84d, path: 0xc9b58a, water: 0x3fb6e6, sky: 0x2f6e28 },
      spots: { F01: { x: 340, y: 2400 }, F02: { x: 880, y: 1740 }, F03: { x: 320, y: 1040 } },
      roads: [
        [[610, 2900], [610, 2460], [640, 2020], [580, 1560], [600, 1120], [650, 640], [610, -100]],
        [[340, 2450], [610, 2450]],
        [[880, 1790], [610, 1790]],
        [[320, 1090], [600, 1090]],
        [[1040, 2640], [612, 2640]],
        [[150, 1500], [582, 1500]],
        [[1050, 560], [640, 560]],
      ],
      spareLots: [{ x: 930, y: 2300 }, { x: 240, y: 1800 }, { x: 900, y: 1140 }, { x: 300, y: 470 }],
      rivalSpots: [{ rival: 'RIVAL-01', x: 1040, y: 2600 }, { rival: 'RIVAL-02', x: 150, y: 1460 }, { rival: 'RIVAL-03', x: 1050, y: 520 }],
      helperSpots: [{ x: 720, y: 2620 }, { x: 500, y: 2240 }, { x: 710, y: 2240 }],
      pond: { x: 190, y: 2720, rx: 150, ry: 90 },
    },
    {
      id: 'D2', w: 1200, h: 2800,
      look: { grass: 0x8fb24a, grassDark: 0x7a9d3c, road: 0x56505f, line: 0xffffff, path: 0xe0b98a, water: 0x52c9dc, sky: 0x5f7a2c },
      spots: { F04: { x: 860, y: 2380 }, F05: { x: 330, y: 1720 }, F06: { x: 860, y: 1000 } },
      roads: [
        [[580, 2900], [600, 2430], [560, 1980], [620, 1500], [590, 1050], [560, 600], [600, -100]],
        [[860, 2430], [600, 2430]],
        [[330, 1770], [585, 1770]],
        [[860, 1050], [590, 1050]],
        [[150, 2620], [590, 2620]],
        [[1050, 1500], [620, 1500]],
        [[140, 520], [570, 520]],
      ],
      spareLots: [{ x: 280, y: 2260 }, { x: 930, y: 1760 }, { x: 290, y: 1120 }, { x: 900, y: 470 }],
      rivalSpots: [{ rival: 'RIVAL-04', x: 150, y: 2580 }, { rival: 'RIVAL-05', x: 1050, y: 1460 }, { rival: 'RIVAL-06', x: 140, y: 480 }],
      helperSpots: [{ x: 470, y: 2620 }, { x: 700, y: 2240 }, { x: 480, y: 2240 }],
      pond: { x: 1010, y: 2710, rx: 160, ry: 90 },
    },
    {
      id: 'D3', w: 1200, h: 2800,
      look: { grass: 0x4fa57d, grassDark: 0x418f6b, road: 0x3d4356, line: 0x52e6ff, path: 0xb6c4c9, water: 0x47a4e8, sky: 0x2a6a58 },
      spots: { F07: { x: 320, y: 2360 }, F08: { x: 880, y: 1700 }, F09: { x: 330, y: 1010 } },
      roads: [
        [[620, 2900], [590, 2410], [640, 1950], [600, 1500], [620, 1060], [590, 600], [620, -100]],
        [[320, 2410], [592, 2410]],
        [[880, 1750], [615, 1750]],
        [[330, 1060], [620, 1060]],
        [[1050, 2600], [598, 2600]],
        [[140, 1560], [600, 1560]],
        [[1050, 500], [595, 500]],
      ],
      spareLots: [{ x: 920, y: 2250 }, { x: 240, y: 1820 }, { x: 910, y: 1120 }, { x: 290, y: 470 }],
      rivalSpots: [{ rival: 'RIVAL-07', x: 1050, y: 2560 }, { rival: 'RIVAL-08', x: 140, y: 1520 }, { rival: 'RIVAL-09', x: 1050, y: 460 }],
      helperSpots: [{ x: 720, y: 2600 }, { x: 490, y: 2200 }, { x: 720, y: 2200 }],
      pond: { x: 180, y: 2730, rx: 150, ry: 80 },
    },
    {
      id: 'D4', w: 1200, h: 2800,
      look: { grass: 0x6a5aa8, grassDark: 0x5a4b96, road: 0x2f2a44, line: 0xff4fa3, path: 0xc9a8e0, water: 0x52e6ff, sky: 0x3a2f70 },
      spots: { F10: { x: 860, y: 2360 }, F11: { x: 320, y: 1660 }, F12: { x: 700, y: 860 } },
      roads: [
        [[590, 2900], [610, 2410], [570, 1950], [610, 1460], [590, 960], [600, 500], [590, -100]],
        [[860, 2410], [612, 2410]],
        [[320, 1710], [590, 1710]],
        [[700, 910], [592, 910]],
        [[150, 2600], [605, 2600]],
        [[1060, 1480], [610, 1480]],
        [[140, 480], [600, 480]],
      ],
      spareLots: [{ x: 270, y: 2240 }, { x: 930, y: 1760 }, { x: 240, y: 1020 }],
      rivalSpots: [{ rival: 'RIVAL-10', x: 150, y: 2560 }, { rival: 'RIVAL-11', x: 1060, y: 1440 }, { rival: 'RIVAL-12', x: 140, y: 440 }],
      helperSpots: [{ x: 470, y: 2620 }, { x: 720, y: 2220 }, { x: 470, y: 2220 }],
      pond: { x: 1020, y: 2710, rx: 150, ry: 80 },
    },
  ],

  // Which picture each renovation shows: base, renovated, renovated, fully renovated.
  // Real art comes as BLD-Fnn-1, -2, -3 (docs/MAP_ART_PROMPTS.md), and a locked lot as TIL-12.
  lookForRenovation: [1, 2, 2, 3],
  lockedLotArt: 'TIL-12',
};
