// The Event Hub (job 23): which events run when, what they pay, the caps, and Bud Match's levels. Only data: change
// anything. Written by Claude Code; Aaron hasn't seen the numbers yet (all stand-ins).
//
// events: one row per event. Today only the Weekly Event Day. A later event (April 420, holidays) is a new row:
//   id, name, blurb       what the hub shows
//   when                  { weekly: true } = on the player's chosen day each week (settings, Saturday by default)
//                         { from: 'MM-DD', to: 'MM-DD' } = those dates each year, by the player's own date
//   game                  which game it plays (only 'budMatch' so far)
//   look                  icon (assets/ui) and colour for its card
//   rewards               which reward table pays (rewards.<name>)
(globalThis.PE = globalThis.PE || {}).Data = globalThis.PE.Data || {};
globalThis.PE.Data.eventHub = {
  source: 'STAND-IN. Job 23 card. Made up by Claude Code: easy to change.',
  defaultDay: 6,          // 0 Sunday ... 6 Saturday
  events: [
    {
      id: 'weekly', name: 'Weekly Event Day', when: { weekly: true }, game: 'budMatch', rewards: 'weekly',
      blurb: 'One day a week. Play Bud Match, earn stars, grab the weekly prizes.',
      look: { icon: 'GOL-03', colour: '#ff4fa3' },
    },
  ],

  // What the games pay. Rewards use the same words as the calendar (cashHarvests = typical harvests of cash, gems), plus
  // boostMinutes (every growing plant finishes this much sooner) and seedPack (a strain you haven't got, free).
  rewards: {
    weekly: {
      // A level's first win each week. Replays pay nothing (stars still count if you beat your best).
      win: { cashHarvests: 2 },
      threeStars: { gems: 1 },
      // Stars earned this week: each milestone is paid once a week.
      milestones: [
        { stars: 3, reward: { cashHarvests: 5 } },
        { stars: 6, reward: { boostMinutes: 30 } },
        { stars: 10, reward: { gems: 3 } },
        { stars: 15, reward: { seedPack: 1 } },
        { stars: 20, reward: { gems: 5, boostMinutes: 60 } },
        { stars: 30, reward: { cashHarvests: 25, seedPack: 1 } },
      ],
    },
  },

  // The most the events can pay, so they add to the main game and never replace it. Anything over is not paid
  // (the hub says so).
  caps: {
    day: { cashHarvests: 50, gems: 12, boostMinutes: 120, seedPack: 2 },
    week: { cashHarvests: 120, gems: 25, boostMinutes: 240, seedPack: 3 },
  },

  // Bud Match. Board 7 wide by 8 tall unless a level says. kinds: how many tile kinds (fewer is easier).
  // goal: { score } or { collect: { coin: 20 } }. stars: [2 star score, 3 star score]; without it, moves left decide.
  budMatch: {
    tiles: { bud: 'BUD-01', leaf: 'QLT-01', seed: 'ACT-01', jar: 'JAR-02', coin: 'CUR-01' },
    names: { bud: 'buds', leaf: 'leaves', seed: 'seeds', jar: 'jars', coin: 'coins' },
    levels: [
      { moves: 20, kinds: 4, goal: { score: 1200 }, stars: [1800, 2400] },
      { moves: 18, kinds: 4, goal: { collect: { coin: 12 } } },
      { moves: 20, kinds: 4, goal: { collect: { jar: 15 } } },
      { moves: 18, kinds: 4, goal: { score: 1800 }, stars: [2500, 3200] },
      { moves: 20, kinds: 5, goal: { collect: { coin: 15 } } },
      { moves: 20, kinds: 5, goal: { collect: { bud: 14, leaf: 14 } } },
      { moves: 18, kinds: 5, goal: { score: 2000 }, stars: [2800, 3600] },
      { moves: 20, kinds: 5, goal: { collect: { jar: 20 } } },
      { moves: 18, kinds: 5, goal: { collect: { coin: 20 } } },
      { moves: 22, kinds: 5, goal: { collect: { seed: 16, coin: 16 } } },
      { moves: 20, kinds: 5, goal: { score: 2600 }, stars: [3400, 4200] },
      { moves: 18, kinds: 5, goal: { collect: { jar: 22 } } },
      { moves: 20, kinds: 5, goal: { collect: { leaf: 24 } } },
      { moves: 18, kinds: 5, goal: { collect: { coin: 22 } } },
      { moves: 20, kinds: 5, goal: { score: 3000 }, stars: [3800, 4600] },
      { moves: 22, kinds: 5, goal: { collect: { bud: 18, seed: 18 } } },
      { moves: 18, kinds: 5, goal: { collect: { jar: 24 } } },
      { moves: 20, kinds: 5, goal: { collect: { coin: 26 } } },
      { moves: 18, kinds: 5, goal: { score: 3200 }, stars: [4000, 5000] },
      { moves: 22, kinds: 5, goal: { collect: { jar: 18, coin: 18 } } },
      { moves: 18, kinds: 5, goal: { collect: { leaf: 26 } } },
      { moves: 20, kinds: 5, goal: { score: 3600 }, stars: [4400, 5400] },
      { moves: 18, kinds: 5, goal: { collect: { coin: 28 } } },
      { moves: 20, kinds: 5, goal: { collect: { jar: 28 } } },
      { moves: 22, kinds: 5, goal: { collect: { bud: 20, leaf: 20 } } },
      { moves: 18, kinds: 5, goal: { score: 4000 }, stars: [5000, 6000] },
      { moves: 18, kinds: 5, goal: { collect: { coin: 30 } } },
      { moves: 20, kinds: 5, goal: { collect: { jar: 30 } } },
      { moves: 22, kinds: 5, goal: { collect: { seed: 22, coin: 22 } } },
      { moves: 20, kinds: 5, goal: { score: 4600 }, stars: [5600, 6800] },
    ],
  },
};
