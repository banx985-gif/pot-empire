// Empire Heights, on the painting art/map/districts/MAP-D4: one road winding up terraces to the summit plaza, a river below.
(function ({ plot, painted, districts }) {
  districts.push(painted({
    id: 'D4', w: 1000, h: 1800, art: 'MAP-D4',
    look: { sky: 0x6a4f9c },
    minLoops: 0,      // this painting really is one winding road, with lanes off it
    notStreet: ['riverW', 'riverM', 'riverE'],
    nodes: {
      bW: [285, 1400], bM: [430, 1385], bF: [610, 1395], bE: [730, 1450],
      up1: [490, 1350], up2: [620, 1290], up3: [800, 1240], up4: [950, 1170], up5: [960, 1090], up6: [880, 1030], up7: [760, 1000], up8: [600, 985], up8b: [505, 980], up9: [400, 975], up10: [200, 945], up11: [80, 880], up12: [35, 815], up13: [100, 760],
      up14: [230, 730], up15: [400, 715], up16b: [510, 700], up16: [600, 680], up17: [800, 645], up18: [950, 575], up19: [985, 500], up20: [900, 435], up21: [760, 440], up22: [600, 445], up22b: [535, 445], up23: [400, 440], up24: [280, 420], up25: [150, 385], up26: [100, 335], up27: [170, 245], summit: [265, 190],
      alley1: [505, 1200], alley2: [510, 905], alley3: [535, 630],
      stair1b: [175, 640], stair2b: [805, 925],
      riverW: [340, 1610], riverM: [480, 1625], riverE: [660, 1590],
    },
    paths: [
      { kind: 'bridge', via: ['bW', 'bM', 'bF', 'bE'] },
      { kind: 'road', via: ['bM', 'up1', 'up2', 'up3', 'up4', 'up5', 'up6', 'up7', 'up8', 'up8b', 'up9', 'up10', 'up11', 'up12', 'up13', 'up14', 'up15', 'up16b', 'up16', 'up17', 'up18', 'up19', 'up20', 'up21', 'up22', 'up22b', 'up23', 'up24', 'up25', 'up26', 'up27', 'summit'] },
      { kind: 'path', via: ['up8b', 'alley1'] },
      { kind: 'path', via: ['up16b', 'alley2'] },
      { kind: 'path', via: ['up22b', 'alley3'] },
      { kind: 'path', via: ['up14', 'stair1b'] },
      { kind: 'path', via: ['up7', 'stair2b'] },
      { kind: 'boat', via: ['riverW', 'riverM', 'riverE'] },
    ],
    spots: { F10: plot(780, 1120, 235, 125), F11: plot(235, 830, 230, 125), F12: plot(530, 190, 530, 215, { node: 'summit' }) },
    features: { X10: plot(225, 1115, 235, 130), X11: plot(785, 825, 230, 135), X12: plot(815, 520, 240, 150) },
    rivalSpots: [plot(150, 1465, 190, 125, { rival: 'RIVAL-10' }), plot(855, 1495, 190, 130, { rival: 'RIVAL-11' }), plot(250, 555, 260, 150, { rival: 'RIVAL-12' })],
    spareLots: [plot(465, 560, 105, 145), plot(600, 560, 115, 145), plot(440, 825, 110, 165), plot(575, 825, 110, 160), plot(430, 1115, 120, 175), plot(575, 1115, 115, 180)],
    helperSpots: [{ x: 430, y: 1385 }, { x: 620, y: 1290 }, { x: 800, y: 1240 }],
    water: [
      { type: 'shape', pts: [[-10, 1260], [150, 1290], [280, 1320], [280, 1375], [60, 1390], [-10, 1400]] },
      { type: 'shape', pts: [[300, 1490], [700, 1500], [760, 1590], [620, 1700], [480, 1800], [260, 1800], [300, 1650]] },
      { type: 'shape', pts: [[640, 1345], [880, 1350], [880, 1400], [650, 1400]] },
    ],
    vans: [['bW', 'summit'], ['up14', 'up21']],
    props: [{ art: 'PRP-03', x: 330, y: 660, size: 90 }, { art: 'PRP-07', x: 60, y: 1010, size: 44 }, { art: 'PRP-12', x: 940, y: 930, size: 92 }, { art: 'PRP-05', x: 900, y: 1290, size: 44 }],
  }));
})(globalThis.PE.Data.map);
