// The six monthly events. The festival engine (js/logic/meta.js) runs one each month, in this rotation.
// Each has a look on the map and its own shop items. All stand-in looks, drawn in code, until event art exists.
// The names and order match bible section 8. Prices and items are made up by Claude Code: easy to change.
//   tint, tintAlpha   a colour wash over the whole map
//   bunting           the colours of the flags
//   deco              the little thing along the streets (js/ui/empire_map_ground.js draws each one)
//   items             sold only during this event, for Festival Tickets. Cosmetic only.
//   roomTheme         the grow room colours one of the items unlocks
(globalThis.PE = globalThis.PE || {}).Data = globalThis.PE.Data || {};
globalThis.PE.Data.events = [
  {
    id: 'rainbow', name: 'Rainbow Roadtrip', tint: 0xffe08a, tintAlpha: 0.08, bunting: [0xff4f4f, 0xff8a3d, 0xffd84d, 0x62d04b, 0x52a6ff, 0xb47cff], deco: 'flag',
    blurb: 'The whole town hits the road. Mind the campervans.',
    roomTheme: { id: 'evt_rainbow', name: 'Roadtrip Rainbow', wall: 0x2f4a6e, floor: 0x4a3f5e },
    items: [
      { id: 'evt_rainbow_title', name: 'Title: Rainbow Roadtripper', cost: 80, currency: 'festivalTickets', grants: { title: 'Rainbow Roadtripper' } },
      { id: 'evt_rainbow_theme', name: 'Facility theme: Roadtrip Rainbow', cost: 300, currency: 'festivalTickets', grants: { theme: 'evt_rainbow' } },
    ],
  },
  {
    id: 'cosmic', name: 'Cosmic Carnival', tint: 0x7a4fff, tintAlpha: 0.16, bunting: [0xb47cff, 0x52e6ff, 0xff4fa3, 0xffffff], deco: 'star',
    blurb: 'Fortune tellers, rides and a suspicious amount of glitter.',
    roomTheme: { id: 'evt_cosmic', name: 'Cosmic Carnival', wall: 0x25145c, floor: 0x3a2a70 },
    items: [
      { id: 'evt_cosmic_title', name: 'Title: Carnival Comet', cost: 80, currency: 'festivalTickets', grants: { title: 'Carnival Comet' } },
      { id: 'evt_cosmic_theme', name: 'Facility theme: Cosmic Carnival', cost: 300, currency: 'festivalTickets', grants: { theme: 'evt_cosmic' } },
    ],
  },
  {
    id: 'neon', name: 'Neon Night Market', tint: 0x1a1060, tintAlpha: 0.3, bunting: [0xff4fa3, 0x52e6ff, 0xc6ff3d], deco: 'lantern',
    blurb: 'The sun clocks off. The stalls do not.',
    roomTheme: { id: 'evt_neon', name: 'Night Market', wall: 0x10082e, floor: 0x2a1650 },
    items: [
      { id: 'evt_neon_title', name: 'Title: Night Market Regular', cost: 80, currency: 'festivalTickets', grants: { title: 'Night Market Regular' } },
      { id: 'evt_neon_theme', name: 'Facility theme: Night Market', cost: 300, currency: 'festivalTickets', grants: { theme: 'evt_neon' } },
    ],
  },
  {
    id: 'peace', name: 'Peace & Petals', tint: 0xff9ecb, tintAlpha: 0.12, bunting: [0xff9ecb, 0xffffff, 0xc6ff3d, 0xffd84d], deco: 'petal',
    blurb: 'Everyone is getting along. It is deeply unsettling.',
    roomTheme: { id: 'evt_peace', name: 'Peace & Petals', wall: 0x5c3a56, floor: 0x5a4a50 },
    items: [
      { id: 'evt_peace_title', name: 'Title: Petal Pusher', cost: 80, currency: 'festivalTickets', grants: { title: 'Petal Pusher' } },
      { id: 'evt_peace_theme', name: 'Facility theme: Peace & Petals', cost: 300, currency: 'festivalTickets', grants: { theme: 'evt_peace' } },
    ],
  },
  {
    id: 'disco', name: 'Disco Harvest', tint: 0xff8a3d, tintAlpha: 0.13, bunting: [0xffd84d, 0xff4fa3, 0xb47cff, 0xff8a3d], deco: 'disco',
    blurb: 'The plants have rhythm. Nobody knows how.',
    roomTheme: { id: 'evt_disco', name: 'Harvest Disco', wall: 0x4a1f55, floor: 0x5c3a1f },
    items: [
      { id: 'evt_disco_title', name: 'Title: Harvest Moves', cost: 80, currency: 'festivalTickets', grants: { title: 'Harvest Moves' } },
      { id: 'evt_disco_theme', name: 'Facility theme: Harvest Disco', cost: 300, currency: 'festivalTickets', grants: { theme: 'evt_disco' } },
    ],
  },
  {
    id: 'galaxy', name: 'Galaxy Groove', tint: 0x1c3a8c, tintAlpha: 0.22, bunting: [0x52e6ff, 0xffffff, 0x7a9dff, 0xb47cff], deco: 'planet',
    blurb: 'Far out. Literally. Someone brought a telescope.',
    roomTheme: { id: 'evt_galaxy', name: 'Galaxy Groove', wall: 0x0e1a4a, floor: 0x1f2c66 },
    items: [
      { id: 'evt_galaxy_title', name: 'Title: Galactic Groover', cost: 80, currency: 'festivalTickets', grants: { title: 'Galactic Groover' } },
      { id: 'evt_galaxy_theme', name: 'Facility theme: Galaxy Groove', cost: 300, currency: 'festivalTickets', grants: { theme: 'evt_galaxy' } },
    ],
  },
];
// Their room themes go in the shop's list, locked until bought.
for (const e of globalThis.PE.Data.events) globalThis.PE.Data.shop.themes[e.roomTheme.id] = { name: e.roomTheme.name, wall: e.roomTheme.wall, floor: e.roomTheme.floor };
