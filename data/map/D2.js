// Market Quarter, on the painting art/map/districts/MAP-D2: a round plaza with stalls and a fountain, a stream, 15 plots.
(function ({ plot, painted, districts }) {
  districts.push(painted({
    id: 'D2', w: 1000, h: 1800, art: 'MAP-D2',
    look: { sky: 0x5f7a2c },
    nodes: {
      topE: [745, 30], topE2: [750, 170], n1: [640, 270], n2: [440, 255], n3: [270, 285], n4: [60, 325],
      eastLane: [560, 410], eastLane2: [590, 480], ringN: [510, 520], ringNE: [760, 580], ringE: [840, 730], ringSE: [770, 890], ringS: [510, 985], ringSW: [270, 900], ringW: [185, 730], ringNW: [260, 570],
      westN: [262, 400], westS: [285, 500], w1: [110, 580], w0: [10, 610],
      sw1: [100, 1040], sw0: [5, 1075],
      bridgeW: [660, 990], bridgeE: [880, 998],
      riv0: [850, 1045], riv1: [775, 1110], riv2: [760, 1240], riv3: [770, 1340], riv4: [620, 1345], riv5: [330, 1345], riv6: [65, 1390],
      s1: [270, 1450], s2: [270, 1590], s3: [285, 1620], s4: [660, 1600], s5: [760, 1650], s6: [860, 1790],
      rivE: [980, 1350], bot1: [285, 1760],
    },
    paths: [
      { kind: 'road', via: ['ringN', 'ringNE', 'ringE', 'ringSE', 'ringS', 'ringSW', 'ringW', 'ringNW', 'ringN'] },
      { kind: 'lane', via: ['topE', 'topE2', 'n1', 'n2', 'n3', 'n4'] },
      { kind: 'lane', via: ['n1', 'eastLane', 'eastLane2', 'ringN'] },
      { kind: 'lane', via: ['n3', 'westN', 'westS', 'ringNW'] },
      { kind: 'lane', via: ['ringNW', 'w1', 'w0'] },
      { kind: 'lane', via: ['ringSW', 'sw1', 'sw0'] },
      { kind: 'lane', via: ['ringS', 'bridgeW'] },
      { kind: 'bridge', via: ['bridgeW', 'bridgeE'] },
      { kind: 'lane', via: ['bridgeE', 'riv0', 'riv1', 'riv2', 'riv3', 'riv4', 'riv5', 'riv6'] },
      { kind: 'lane', via: ['riv3', 'rivE'] },
      { kind: 'lane', via: ['riv5', 's1', 's2', 's3', 's4', 's5', 's6'] },
      { kind: 'lane', via: ['s3', 'bot1'] },
    ],
    spots: { F04: plot(530, 1230, 380, 210), F05: plot(770, 395, 340, 240), F06: plot(225, 150, 380, 235) },
    features: { X04: plot(510, 555, 240, 50, { node: 'ringN' }), X05: plot(795, 1480, 300, 190), X06: plot(470, 1680, 350, 135) },
    rivalSpots: [plot(190, 1260, 215, 160, { rival: 'RIVAL-04' }), plot(590, 165, 250, 165, { rival: 'RIVAL-05' }), plot(140, 430, 215, 180, { rival: 'RIVAL-06' })],
    spareLots: [plot(860, 155, 165, 115), plot(430, 395, 190, 175), plot(90, 720, 160, 175), plot(910, 725, 140, 200), plot(880, 1210, 155, 135), plot(125, 1495, 170, 130), plot(415, 1495, 220, 175)],
    helperSpots: [{ x: 510, y: 985 }, { x: 270, y: 900 }, { x: 770, y: 890 }],
    water: [
      { type: 'river', pts: [[100, 1120], [260, 1090], [420, 1075], [600, 1050], [780, 1010], [900, 950], [1000, 860]], width: 45 },
    ],
    vans: [['s6', 'ringS'], ['ringW', 'ringE']],
    props: [{ art: 'PRP-12', x: 60, y: 1010, size: 92 }, { art: 'PRP-04', x: 620, y: 1120, size: 42 }, { art: 'PRP-08', x: 950, y: 1100, size: 60 }, { art: 'PRP-05', x: 40, y: 830, size: 42 }],
  }));
})(globalThis.PE.Data.map);
