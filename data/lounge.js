// The gaming lounge (job 26): a TV on a stand against a grow room's back wall and a seat facing it, where the helpers sit
// and play video games. Only data: change anything. Written by Claude Code; Aaron hasn't seen the numbers yet.
//
// unlock: how a TV or seat is got: 'free' | 'earn' | 'gems' | 'shop'. All 'free' for now (Aaron, 13 Nov: "not sure if
// earnable or pay, see if it works first"). Only 'free' ones can be placed until the others are built.
// Sizes are in grow room units, where a helper stands 560 tall (PE.Anim.PERSON_H.grow).
(globalThis.PE = globalThis.PE || {}).Data = globalThis.PE.Data || {};
globalThis.PE.Data.lounge = {
  source: 'STAND-IN. Job 26 card. Made up by Claude Code.',
  tvs: [
    { id: 'TV-1', name: 'Classic TV', blurb: 'A trusty TV on a stand, one controller.', unlock: 'free', w: 620 },
    { id: 'TV-2', name: 'Wide TV', blurb: 'Wide screen and a sound bar.', unlock: 'free', w: 720 },
    { id: 'TV-3', name: 'Curved TV', blurb: 'Curved screen, big speakers, two controllers.', unlock: 'free', w: 820 },
  ],
  // slots: where each helper sits, as a share of the seat's width from its left edge (seen from behind). The sofa's are
  // from the art notes (Haze left, Budz middle, Leafy right), Haze's moved in a little (his seated pose leans left of his
  // feet, so at 17% he hung off the arm). w: about 3.3, 1.8 and 2.0 helper shoulder widths.
  seats: [
    { id: 'SOFA', name: 'Sofa', blurb: 'Room for all three.', unlock: 'free', w: 680, slots: { HAZE: 0.26, BUDZ: 0.5, LEAFY: 0.8 }, sitFrom: 0.33 },
    { id: 'RECLINER', name: 'Recliner', blurb: 'Feet up, game on.', unlock: 'free', w: 380, slots: { any: 0.5 }, sitFrom: 0.42, longer: 1.25 },
    { id: 'MASSAGE', name: 'Massage chair', blurb: 'It hums. They love it.', unlock: 'free', w: 420, slots: { any: 0.5 }, sitFrom: 0.36, longer: 1.4 },
  ],
  // How far in front of the TV the seat stands (feet to feet), in helper heights: the most, and the least that will do.
  gap: { most: 3.5, least: 1.6 },
  // How long they play, in real minutes (random between), and how often an idle helper goes over: about this many times
  // an hour, checked every check seconds while they're standing about.
  playMinutes: [3, 8],
  perHour: 4,
  check: 30,
  // How often all three helpers come into a room with a sofa (a rare treat): a share of visits.
  allThree: 0.25,
};
