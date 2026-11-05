// Where things attach on each hydro model's frame picture, in pixels of the art/hydro frame. Edit freely, then
// run: node tools/hydro_preview.js   It draws every model with these points marked, into reports/hydro/.
//
//   holes     the middle of the first and last of the frame's 7 pot holes (the ones between are evenly spaced)
//   hangX     where along the rail the light hangs
//   railY     the underside of the rail, at hangX
//   stretch   a band of the picture with only the two upright posts in it. The game stretches this band so the
//             rail ends up high enough for the light, sprinkler and spray over the tallest plant.
//   badge     the middle of the front of the bench, where the model's emblem goes
//   computer  where the computer's stand sits, in world units from the middle pot hole. y is where its feet are.
(globalThis.PE = globalThis.PE || {}).Data = globalThis.PE.Data || {};
globalThis.PE.Data.hydroAnchors = {
  1: { holes: [[78, 282], [378, 365]], hangX: 245, railY: 88, stretch: [135, 215], badge: [240, 408], computer: { x: 560, y: 440 } },
  2: { holes: [[82, 245], [398, 318]], hangX: 258, railY: 84, stretch: [125, 205], badge: [240, 352], computer: { x: 570, y: 400 } },
  3: { holes: [[98, 268], [397, 190]], hangX: 228, railY: 72, stretch: [125, 170], badge: [235, 295], computer: { x: 590, y: 300 } },
  4: { holes: [[97, 220], [378, 313]], hangX: 238, railY: 92, stretch: [140, 185], badge: [205, 340], computer: { x: 590, y: 420 } },
  5: { holes: [[88, 315], [415, 222]], hangX: 245, railY: 88, stretch: [165, 200], badge: [245, 296], computer: { x: 600, y: 300 } },
};
