// The 12 feature buildings: menu features turned into places on the map (docs/DESIGN_NOTES.md, 5 Nov).
// Where each stands is in its district's layout file (data/map/D1.js ...), under "features". This file says:
//   route    the screen a tap opens
//   metric   how far along the player is in this feature (js/logic/empire_map.js works it out)
//   stages   the metric needed for looks 2 and 3 (BLD-Xnn-1, -2, -3). Made up by Claude Code: easy to change.
//   why      the words behind its "!", shown only when there's really something to do there
(globalThis.PE = globalThis.PE || {}).Data = globalThis.PE.Data || {};
globalThis.PE.Data.featureBuildings = [
  { id: 'X01', name: "Uncle Haze's Shack", district: 'D1', route: 'hazeShack', metric: 'calendarDays', stages: [7, 28], why: "Today's calendar reward is waiting" },
  { id: 'X02', name: 'Seed Shop', district: 'D1', route: 'seedShop', metric: 'strains', stages: [10, 30], why: 'You can unlock a new strain' },
  { id: 'X03', name: 'Talent Agency', district: 'D1', route: 'talentAgency', metric: 'managers', stages: [10, 30], why: 'A chest reward is waiting' },
  { id: 'X04', name: 'Festival Grounds', district: 'D2', route: 'festival', metric: 'festivalTiers', stages: [5, 30], why: 'A festival reward is ready' },
  { id: 'X05', name: 'Arcade', district: 'D2', route: 'arcade', metric: 'wheelSpins', stages: [10, 40], why: "Today's free spin is waiting" },
  { id: 'X06', name: 'Task Board Cafe', district: 'D2', route: 'tasks', metric: 'tasksClaimed', stages: [20, 100], why: 'A task reward is ready' },
  { id: 'X07', name: 'VIP Lounge', district: 'D3', route: 'vipLounge', metric: 'vipDone', stages: [5, 25], why: 'A VIP order is ready to claim' },
  { id: 'X08', name: "Collector's Warehouse", district: 'D3', route: 'collectorsWarehouse', metric: 'collectibles', stages: [20, 80], why: 'You can afford a collectible' },
  { id: 'X09', name: 'Rival Boxing Gym', district: 'D3', route: 'rivals', metric: 'rivalsBeaten', stages: [4, 9], why: 'A rival is ready to beat' },
  { id: 'X10', name: 'Hall of Fame Museum', district: 'D4', route: 'hallOfFame', metric: 'hallFilled', stages: [2, 6], why: 'An empty display is waiting' },
  { id: 'X11', name: 'Stock Exchange', district: 'D4', route: 'prestige', metric: 'prestiges', stages: [1, 5], why: 'A district can prestige' },
  { id: 'X12', name: 'Trophy Tower', district: 'D4', route: 'achievements', metric: 'achievementsClaimed', stages: [10, 30], why: 'An achievement is ready to claim' },
];
