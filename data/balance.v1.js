// Every number the game's rules use. NOTHING HERE IS FINAL: the balance isn't locked until the
// simulator (milestone M7) says so. When numbers change in a way that matters, add balance.v2.js
// rather than editing history, and bump tableVersion.
//
// Each table says where its numbers came from:
//   "bible ..."  = copied from docs/BUILD_BIBLE_V9.md (the bible calls these candidates)
//   "STAND-IN"   = the bible gives no number, so this is a made-up starting value for M1 to run on.
//                  Aaron has not seen or approved these.
(globalThis.PE = globalThis.PE || {}).Data = globalThis.PE.Data || {};
globalThis.PE.Data.balance = {
  tableVersion: 1,
  status: 'provisional',

  facilities: {
    source: 'bible section 3',
    rows: [
      { id: 'F01', name: 'Garage Grow Den', mode: 'Grow', stations: 3, playerLevel: 1 },
      { id: 'F02', name: 'Backstreet Warehouse', mode: 'Grow', stations: 6, playerLevel: 3 },
      { id: 'F03', name: 'Hippie Greenhouse', mode: 'Grow', stations: 9, playerLevel: 8 },
      { id: 'F04', name: 'Corner Dispensary', mode: 'Retail', stations: 6, playerLevel: 12 },
      { id: 'F05', name: 'Processing Factory', mode: 'Factory', stations: 5, playerLevel: 17 },
      { id: 'F06', name: 'Research Lab', mode: 'Research', stations: 0, playerLevel: 22 },
      { id: 'F07', name: 'Commercial Grow Farm', mode: 'Grow', stations: 12, playerLevel: 28 },
      { id: 'F08', name: 'Downtown Dispensary', mode: 'Retail', stations: 8, playerLevel: 34 },
      { id: 'F09', name: 'Distribution Depot', mode: 'Logistics', stations: 6, playerLevel: 40 },
      { id: 'F10', name: 'Industrial Grow Complex', mode: 'Grow', stations: 12, playerLevel: 46 },
      { id: 'F11', name: 'Psychedelic Mega Farm', mode: 'Grow', stations: 15, playerLevel: 53 },
      { id: 'F12', name: 'Empire Headquarters', mode: 'Prestige', stations: 0, playerLevel: 60 },
    ],
    renovationAtLocalProgress: [0.25, 0.6, 1],
  },

  hydro: {
    source: 'bible section 4',
    potSlotsByCapacityLevel: [2, 3, 4, 5, 6, 7],
    lightTimeMultiplier: [1, 0.91, 0.83, 0.76, 0.7, 0.65],
    sprinklerMaintenanceInterval: [1, 1.25, 1.5, 1.8, 2.15, 2.5],
    potQualityBonus: [0, 6, 12, 19, 27, 36],
    // upgrade cost = round(base * modelGrowth^(model-1) * branchFactor * levelGrowth^(nextLevel-2))
    upgradeCost: {
      base: 75,
      modelGrowth: 14,
      levelGrowth: 1.8,
      branchFactor: { lights: 1, sprinkler: 0.8, pots: 1.2, computer: 1.3, capacity: 1.5 },
    },
    // main model cost = round(base * growth^(model-1))
    mainModelCost: { base: 12000, growth: 25 },
    mainModelGate: { branchesAtMaxLevel: 4, ofBranches: 5, maxLevel: 6 },
  },

  growing: {
    source: 'bible section 6',
    minCycleSeconds: 15,
    offlineCapHours: { base: 8, upgraded: 12 },
  },

  quality: {
    source: 'bible section 5',
    grades: [
      { id: 'standard', name: 'Standard', valueMultiplier: 1 },
      { id: 'fine', name: 'Fine', valueMultiplier: 1.5 },
      { id: 'premium', name: 'Premium', valueMultiplier: 2.2 },
      { id: 'top_shelf', name: 'Top Shelf', valueMultiplier: 3.5 },
      { id: 'exotic', name: 'Exotic', valueMultiplier: 5 },
    ],
  },

  mastery: {
    source: 'bible section 5',
    maxLevel: 50,
    rewardLevels: [10, 20, 30, 40, 50],
    avatarUnlockLevel: 10,
  },

  shopAud: {
    source: 'bible section 11 (proposed prices, not confirmed store tiers)',
    starterBundle: 2.99,
    noAds: 5.99,
    gemsSmall: 1.99,
    gemsMedium: 7.99,
    gemsLarge: 14.99,
    gemsMega: 29.99,
    eventPass: 6.99,
    facilityTheme: 3.99,
  },

  rewardedAdLimitsPerDay: {
    source: 'bible section 11',
    doubleOfflineClaim: 2,
    extraWheelSpins: 2,
    deliverySpeedUp: 1,
    harvestQualityReward: 1,
    total: 6,
  },

  // ---- The bible gives no numbers for these. Made-up starting values, see top of file. --------
  strainBaseByRarity: {
    source: 'STAND-IN',
    Common: { growSeconds: 60, yieldPerPot: 1, salePrice: 5, harvestXp: 5, masteryXp: 5 },
    Uncommon: { growSeconds: 90, yieldPerPot: 1, salePrice: 9, harvestXp: 8, masteryXp: 5 },
    Rare: { growSeconds: 150, yieldPerPot: 1, salePrice: 16, harvestXp: 14, masteryXp: 5 },
    Epic: { growSeconds: 240, yieldPerPot: 1, salePrice: 28, harvestXp: 24, masteryXp: 5 },
    Legendary: { growSeconds: 360, yieldPerPot: 1, salePrice: 50, harvestXp: 40, masteryXp: 5 },
    Mythic: { growSeconds: 600, yieldPerPot: 1, salePrice: 90, harvestXp: 70, masteryXp: 5 },
  },
  playerXpCurve: {
    source: 'STAND-IN',
    // XP needed for the next level = round(base * growth^(level-1))
    base: 50,
    growth: 1.25,
  },
};
