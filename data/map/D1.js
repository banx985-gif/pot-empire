// Old Town, on the painting art/map/districts/MAP-D1: crooked cobbled lanes, a duck pond with a bridge, 16 plots.
(function ({ plot, painted, districts }) {
  districts.push(painted({
    id: 'D1', w: 1000, h: 1800, art: 'MAP-D1',
    look: { sky: 0x2f6e28 },
    nodes: {
      nwTop: [262, 195], nwBend: [320, 275], nw: [390, 305], overPlot5: [520, 345], hub: [660, 400], ne: [800, 330], neTop: [905, 270], neEnd: [975, 235],
      eastS: [720, 470], eastBig: [785, 535], sMid: [650, 620], sMidLow: [585, 695], bridgeE: [505, 700], bridgeW: [325, 730],
      westA: [240, 365], westB: [205, 445], westC: [90, 535], westEnd: [15, 640],
      benchLow: [565, 765], crossE: [640, 855], rightIn: [760, 800], rightEnd: [860, 770], gapE: [665, 960], gapLow: [610, 1035],
      underBridge: [295, 800], w1: [200, 880], w2: [60, 940], m1: [380, 900], m2: [490, 975], bigE: [530, 1040], bigE2: [505, 1120], low1: [440, 1200], low2: [335, 1255], low3: [170, 1265], lowEnd: [10, 1228],
      isl1: [525, 1165], isl2: [590, 1245], isl3: [750, 1225], isl4: [900, 1218], islEnd: [960, 1265],
      in1: [550, 1310], in2: [440, 1360], in3: [345, 1385], lot13a: [305, 1300], s1: [335, 1460], s2: [375, 1545], s3: [470, 1620], s4: [580, 1660], s5: [685, 1645], s6: [775, 1560], s7: [885, 1525], sEnd: [990, 1565],
      down: [705, 1790], left1: [245, 1490], left2: [130, 1455], leftEnd: [10, 1430],
    },
    paths: [
      { kind: 'lane', via: ['nwTop', 'nwBend', 'nw', 'overPlot5', 'hub', 'eastS', 'eastBig', 'sMid', 'sMidLow', 'benchLow', 'crossE', 'gapE', 'gapLow', 'bigE'] },
      { kind: 'lane', via: ['hub', 'ne', 'neTop', 'neEnd'] },
      { kind: 'lane', via: ['nwBend', 'westA', 'westB', 'westC', 'westEnd'] },
      { kind: 'bridge', via: ['sMidLow', 'bridgeE', 'bridgeW', 'underBridge'] },
      { kind: 'lane', via: ['underBridge', 'w1', 'w2'] },
      { kind: 'lane', via: ['w1', 'm1', 'm2', 'bigE', 'bigE2', 'low1', 'low2', 'low3', 'lowEnd'] },
      { kind: 'lane', via: ['crossE', 'rightIn', 'rightEnd'] },
      { kind: 'lane', via: ['bigE2', 'isl1', 'isl2', 'isl3', 'isl4', 'islEnd'] },
      { kind: 'lane', via: ['isl2', 'in1', 'in2', 'in3', 's1', 's2', 's3', 's4', 's5', 's6', 's7', 'sEnd'] },
      { kind: 'lane', via: ['low2', 'lot13a', 'in3'] },
      { kind: 'lane', via: ['s5', 'down'] },
      { kind: 'lane', via: ['s2', 'left1', 'left2', 'leftEnd'] },
    ],
    spots: { F01: plot(710, 1430, 530, 300), F02: plot(255, 1050, 510, 300), F03: plot(660, 235, 500, 280) },
    features: { X01: plot(860, 1640, 280, 170), X02: plot(665, 1135, 215, 120), X03: plot(505, 880, 260, 150) },
    rivalSpots: [plot(180, 1670, 300, 180, { rival: 'RIVAL-01' }), plot(805, 655, 330, 190, { rival: 'RIVAL-02' }), plot(150, 310, 270, 160, { rival: 'RIVAL-03' })],
    spareLots: [plot(125, 115, 240, 140), plot(855, 85, 200, 120), plot(360, 385, 180, 100), plot(835, 420, 300, 170), plot(160, 770, 270, 150), plot(835, 870, 290, 170), plot(175, 1355, 215, 130)],
    helperSpots: [{ x: 585, y: 1660 }, { x: 470, y: 1620 }, { x: 375, y: 1545 }],
    water: [
      { type: 'shape', pts: [[140, 590], [210, 545], [330, 565], [440, 600], [420, 645], [340, 680], [230, 680], [170, 650]] },
      { type: 'shape', pts: [[385, 765], [450, 745], [510, 775], [480, 810], [420, 815]] },
    ],
    vans: [['down', 'nwTop'], ['low3', 'eastBig']],
    props: [{ art: 'PRP-08', x: 905, y: 1135, size: 62 }, { art: 'PRP-07', x: 90, y: 1395, size: 44 }, { art: 'PRP-06', x: 640, y: 1090, size: 44 }],
  }));
})(globalThis.PE.Data.map);
