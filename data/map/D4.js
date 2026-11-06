// Empire Heights, on the painting art/map/districts/MAP-D4 (second version): a terraced hillside, one winding paved road
// with lanes off it, up to a big summit clearing where HQ stands. A river with stone bridges at the bottom.
(function ({ plot, painted, districts }) {
  districts.push(painted({
    id: 'D4', w: 1000, h: 1800, art: 'MAP-D4',
    look: { sky: 0x6a4f9c },
    notStreet: ['riverW', 'riverM', 'riverE'],
    nodes: {
      summit: [480, 305], s1: [385, 272], s2: [295, 215], s3: [278, 155], s4: [340, 90], s5: [440, 50], s6: [600, 15], s7: [770, 40], s8: [835, 82], s9: [878, 150], s10: [832, 228], s11: [700, 282],
      c1: [190, 140],
      a1: [385, 330], a2: [290, 370], a3: [250, 412], a4: [305, 470], a5: [455, 495], a6: [512, 525], b1: [590, 442], b2: [745, 430],
      c2: [535, 585], c3: [700, 622], c4: [770, 700], c5: [725, 778], c6: [620, 810], c7: [495, 880], c8: [440, 905], d1: [440, 605], d2: [345, 680], d3: [300, 760], d4: [390, 830],
      r1: [800, 770], r2: [930, 810], r3: [965, 860],
      e1: [180, 775], e2: [60, 835], e3: [22, 895], e4: [100, 985], e5: [280, 1000], e6: [360, 1060], e7: [375, 1130], e8: [330, 1210], e9: [250, 1280],
      bL1: [240, 1330], bL2: [170, 1385], bL3: [105, 1430],
      g1: [170, 1505], g2: [280, 1530], g3: [370, 1590], g4: [410, 1645], g5: [360, 1720], g6: [200, 1790],
      f1: [480, 980], f2: [600, 1040], f3: [800, 1110], f4: [890, 1180], f5: [880, 1260], f6: [760, 1310], f7: [705, 1385], f8: [745, 1470],
      h0: [640, 1370], h1: [520, 1410], h2: [535, 1490], m0: [300, 1305], bR: [462, 1600],
      u1: [490, 1705], u2: [600, 1735], u3: [705, 1795],
      riverW: [570, 1625], riverM: [705, 1665], riverE: [900, 1770],
    },
    paths: [
      { kind: 'road', via: ['summit', 's1', 's2', 's3', 's4', 's5', 's6', 's7', 's8', 's9', 's10', 's11', 'summit'] },
      { kind: 'path', via: ['s3', 'c1'] },
      { kind: 'road', via: ['summit', 'a1', 'a2', 'a3', 'a4', 'a5', 'a6', 'c2', 'c3', 'c4', 'c5', 'c6', 'c7', 'c8'] },
      { kind: 'lane', via: ['a6', 'b1', 'b2'] },
      { kind: 'road', via: ['c2', 'd1', 'd2', 'd3', 'd4', 'c8'] },
      { kind: 'lane', via: ['c5', 'r1', 'r2', 'r3'] },
      { kind: 'road', via: ['d3', 'e1', 'e2', 'e3', 'e4', 'e5', 'e6', 'e7', 'e8', 'e9', 'bL1'] },
      { kind: 'bridge', via: ['bL1', 'bL2', 'bL3'] },
      { kind: 'road', via: ['bL3', 'g1', 'g2', 'g3', 'g4', 'g5', 'g6'] },
      { kind: 'road', via: ['c8', 'f1', 'f2', 'f3', 'f4', 'f5', 'f6', 'f7', 'f8'] },
      { kind: 'road', via: ['f6', 'h0', 'h1', 'h2'] },
      { kind: 'road', via: ['bL1', 'm0', 'h1'] },
      { kind: 'bridge', via: ['h2', 'bR'] },
      { kind: 'road', via: ['bR', 'g4'] },
      { kind: 'road', via: ['g4', 'u1', 'u2', 'u3'] },
      { kind: 'boat', via: ['riverW', 'riverM', 'riverE'] },
    ],
    spots: { F10: plot(610, 1190, 320, 155), F11: plot(770, 895, 410, 170), F12: plot(560, 155, 490, 240, { w: 240, y: 300, node: 'summit' }) },
    features: { X10: plot(210, 1120, 270, 150), X11: plot(200, 620, 350, 175), X12: plot(770, 530, 360, 170, { w: 225 }) },
    rivalSpots: [plot(175, 312, 205, 125, { rival: 'RIVAL-10' }), plot(845, 1390, 215, 120, { rival: 'RIVAL-11' }), plot(215, 880, 245, 125, { rival: 'RIVAL-12', w: 195 })],
    spareLots: [plot(130, 110, 175, 80), plot(160, 1605, 275, 145), plot(900, 335, 150, 70), plot(470, 425, 235, 95), plot(505, 720, 210, 120)],
    helperSpots: [{ x: 700, y: 282 }, { x: 385, y: 272 }, { x: 278, y: 155 }],
    water: [
      { type: 'shape', pts: [[-10, 1290], [130, 1305], [165, 1330], [95, 1395], [50, 1425], [-10, 1400]] },
      { type: 'shape', pts: [[225, 1425], [300, 1420], [440, 1450], [475, 1490], [420, 1560], [385, 1575], [300, 1515], [215, 1490]] },
      { type: 'shape', pts: [[510, 1565], [600, 1590], [710, 1595], [830, 1670], [1010, 1740], [1010, 1810], [860, 1810], [730, 1760], [600, 1680], [510, 1650]] },
    ],
    vans: [['g6', 'summit'], ['a3', 'f8']],
    // The summit: HQ's forecourt, with a fountain and parked cars.
    props: [
      { art: 'PRP-11', x: 385, y: 175, size: 86 }, { art: 'PRP-09', x: 405, y: 130, size: 74 }, { art: 'VEH-01', x: 735, y: 195, size: 66 }, { art: 'PRP-09', x: 720, y: 85, size: 74 }, { art: 'PRP-06', x: 590, y: 70, size: 40 },
      { art: 'PRP-07', x: 610, y: 915, size: 40 }, { art: 'PRP-08', x: 945, y: 900, size: 50 },
    ],
  }));
})(globalThis.PE.Data.map);
