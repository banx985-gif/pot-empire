// Every number the game's rules use. NOTHING HERE IS FINAL: the balance isn't locked until the
// simulator says so (reports/balance_sim.md). Version 4 (job 5) replaces balance.v3.js and adds the map,
// recipes, gift, calendar and speed-up tables; marked "v4:" below. Older versions are kept in this folder
// as history and are not loaded. "v3:" marks what changed from v2; see reports/balance_sim.md for why.
//
// Each table says where its numbers came from:
//   "bible ..."  = copied from docs/BUILD_BIBLE_V9.md (the bible calls these candidates)
//   "STAND-IN"   = the bible gives no number, so this is a made-up starting value. Aaron has not
//                  seen or approved these.
(globalThis.PE = globalThis.PE || {}).Data = globalThis.PE.Data || {};
globalThis.PE.Data.balance = {
  tableVersion: 4,
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
    source: 'STAND-IN, tuned by tools/balance_sim.js',
    // i = position of the strain inside its rarity (0-9). Later strains in a rarity are worth more.
    // price = salePrice * (1 + priceStep * i), time = growSeconds * (1 + growStep * i)
    // unlock level = unlockLevel + floor(i * levelStep), unlock cost = round(unlockCost * costGrowth^i)
    Common: { growSeconds: 60, growStep: 0.1, yieldPerPot: 1, salePrice: 10, priceStep: 0.12, harvestXp: 5, masteryXp: 5, unlockLevel: 1, levelStep: 0.5, unlockCost: 60, costGrowth: 1.5, qualityScore: 0 },
    Uncommon: { growSeconds: 120, growStep: 0.08, yieldPerPot: 1, salePrice: 34, priceStep: 0.12, harvestXp: 8, masteryXp: 5, unlockLevel: 6, levelStep: 0.6, unlockCost: 2500, costGrowth: 1.45, qualityScore: 2 },
    Rare: { growSeconds: 240, growStep: 0.08, yieldPerPot: 1, salePrice: 110, priceStep: 0.12, harvestXp: 12, masteryXp: 6, unlockLevel: 13, levelStep: 0.7, unlockCost: 60000, costGrowth: 1.45, qualityScore: 4 },
    Epic: { growSeconds: 420, growStep: 0.08, yieldPerPot: 1, salePrice: 340, priceStep: 0.12, harvestXp: 18, masteryXp: 7, unlockLevel: 22, levelStep: 0.8, unlockCost: 1500000, costGrowth: 1.45, qualityScore: 6 },
    Legendary: { growSeconds: 720, growStep: 0.08, yieldPerPot: 1, salePrice: 1000, priceStep: 0.12, harvestXp: 26, masteryXp: 8, unlockLevel: 33, levelStep: 0.9, unlockCost: 40000000, costGrowth: 1.45, qualityScore: 8 },
    Mythic: { growSeconds: 1200, growStep: 0.08, yieldPerPot: 1, salePrice: 3000, priceStep: 0.12, harvestXp: 36, masteryXp: 10, unlockLevel: 45, levelStep: 1, unlockCost: 1000000000, costGrowth: 1.45, qualityScore: 10 },
  },

  // Bible section 5: six viable strain roles. Each strain gets one, in a repeating order.
  strainRoles: {
    source: 'bible section 5 for the six roles, STAND-IN for the numbers',
    order: ['speed', 'yield', 'quality', 'contracts', 'factory', 'festivals'],
    speed: { growMult: 0.85, priceMult: 0.92, label: 'Fast grower' },
    yield: { growMult: 1.1, yieldMult: 1.25, label: 'Heavy yield' },
    quality: { qualityScore: 8, priceMult: 0.97, label: 'Quality-prone' },
    contracts: { contractCredit: 1, priceMult: 0.98, label: 'Contract favourite' },
    factory: { cropMult: 1.5, priceMult: 0.98, label: 'Factory feed' },
    festivals: { festivalMult: 1.5, priceMult: 0.98, label: 'Festival star' },
  },

  player: {
    source: 'STAND-IN, tuned by tools/balance_sim.js',
    // XP for the next level = previous * growth, with growth chosen by level band.
    // Levels above 60 use the last band forever: there is no final rank (bible section 2).
    xpFirstLevel: 47,        // v3: was 34 (first automation came at 19 minutes for the 5-minute player)
    xpBands: [{ upTo: 10, growth: 1.36 }, { upTo: 30, growth: 1.33 }, { upTo: 60, growth: 1.105 }, { upTo: 1e9, growth: 1.035 }],
    talentPointsPerLevel: 1,
    // Bible section 2: Rank 61+ milestone rewards at every 10/25/50/100 ranks. Biggest match wins.
    rankMilestones: [
      { every: 100, cashLevels: 40, gems: 25, researchTokens: 50 },
      { every: 50, cashLevels: 25, gems: 10, researchTokens: 25 },
      { every: 25, cashLevels: 15, gems: 5, researchTokens: 10 },
      { every: 10, cashLevels: 8, gems: 0, researchTokens: 5 },
    ],
    titleRanks: [100, 250, 500, 1000],
  },

  chests: {
    source: 'STAND-IN',
    cashBase: 40,
    cashLevelGrowth: 1.22,
    collectionTokensBase: 3,
    collectionTokensPerLevel: 0.5,
    milestoneCashMult: 3,
    milestoneTokenMult: 3,
    researchTokensFromLevel: 22,
    researchTokensPerChest: 2,
  },

  talents: {
    source: 'STAND-IN. The bible gives a talent point per level but no talent list.',
    rows: [
      { id: 'green_thumb', name: 'Green Thumb', effectKey: 'growSpeed', perRank: 0.01, maxRanks: 20, text: 'Plants grow faster' },
      { id: 'salesman', name: 'Smooth Talker', effectKey: 'saleBonus', perRank: 0.015, maxRanks: 20, text: 'Harvests sell for more' },
      { id: 'heavy_hands', name: 'Heavy Hands', effectKey: 'yieldBonus', perRank: 0.01, maxRanks: 20, text: 'Bigger yields' },
      { id: 'keen_eye', name: 'Keen Eye', effectKey: 'qualityScore', perRank: 1, maxRanks: 20, text: 'Better quality odds' },
      { id: 'night_owl', name: 'Night Owl', effectKey: 'offlineEfficiency', perRank: 0.01, maxRanks: 15, text: 'Automation earns more while away' },
      { id: 'tight_fist', name: 'Tight Fist', effectKey: 'upgradeDiscount', perRank: 0.005, maxRanks: 20, text: 'Hydro upgrades cost less' },
    ],
  },

  // A hydro model's own strength. The bible's formula has modelFactor; its value isn't given.
  hydroModels: {
    source: 'names from bible section 4, numbers STAND-IN tuned by tools/balance_sim.js',
    rows: [
      { model: 1, name: 'Groovy Green', timeFactor: 1, valueMult: 1, color: 0x8fd63a },
      { model: 2, name: 'Purple Haze', timeFactor: 0.94, valueMult: 3, color: 0x9a5be0 },
      { model: 3, name: 'Cosmic Blue', timeFactor: 0.88, valueMult: 9, color: 0x2fc6e8 },
      { model: 4, name: 'Sunset Gold', timeFactor: 0.82, valueMult: 27, color: 0xf2a02e },
      { model: 5, name: 'Rainbow Madness', timeFactor: 0.76, valueMult: 81, color: 0xff4fa3 },
    ],
    // Sprinkler level: how much automation earns while the game is closed.
    offlineEfficiency: [0.65, 0.7, 0.75, 0.8, 0.85, 0.9],   // v3: was 0.5-0.8. Short-session players live mostly offline
    // Computer level that opens each feature on that station ahead of the player-level ladder.
    computerFeatures: { harvestAll: 2, preset: 3, autoHarvest: 4, autoReplant: 5, queue: 6 },
    computerSpeed: [0, 0.01, 0.02, 0.03, 0.04, 0.05],
    queueLength: 3,
    // Pot levels also raise the sale value a little, as the bible says ("improve quality/value").
    potValueBonus: [0, 0.05, 0.1, 0.16, 0.23, 0.3],
  },

  maintenance: {
    source: 'STAND-IN. Bible: sprinklers reduce maintenance. No plant death, no chore wall.',
    baseIntervalSeconds: 1800,
    slowdown: 1.1,
  },

  qualityOdds: {
    source: 'STAND-IN for the odds. Limits keep Exotic rare at any bonus (bible: capped).',
    // Weight of each grade at quality score 0, in grade order.
    base: [78, 16, 4.6, 1.2, 0.2],
    // Each grade's weight grows with score: weight * e^(gradeIndex * score / scale)
    scale: 90,
    // Hard limits on the final chance of each grade, whatever the bonuses.
    min: [0.08, 0.05, 0.01, 0.002, 0.0005],
    max: [0.9, 0.55, 0.4, 0.25, 0.12],
    maxScore: 200,
  },

  masteryTable: {
    source: 'STAND-IN for XP and rewards. Bible: permanent L1-50, rewards at L10/20/30/40/50.',
    xpFirstLevel: 30,
    growth: 1.16,
    rewards: {
      10: { text: 'Profile avatar unlocked, +2% sale value', saleBonus: 0.02, avatar: true },
      20: { text: '+3% grow speed', growSpeed: 0.03 },
      30: { text: '+6 quality score', qualityScore: 6 },
      40: { text: '+6% yield', yieldBonus: 0.06 },
      50: { text: '+8% sale value and a profile title', saleBonus: 0.08, title: true },
    },
  },

  facilityEconomy: {
    source: 'STAND-IN, tuned by tools/balance_sim.js. Bible: slots at even local milestones, R1/R2/R3 at 25/60/100%.',
    rows: {
      F01: { startStations: 2, cost: 0, valueMult: 1, upgradeScale: 1, stationCostBase: 150, localTarget: 60 },
      F02: { startStations: 1, cost: 300, valueMult: 1.4, upgradeScale: 1.4, stationCostBase: 800, localTarget: 240 },
      F03: { startStations: 1, cost: 6000, valueMult: 2, upgradeScale: 2, stationCostBase: 5000, localTarget: 700 },
      F04: { startStations: 2, cost: 40000, valueMult: 1, upgradeScale: 1, stationCostBase: 15000, localTarget: 300 },
      F05: { startStations: 1, cost: 250000, valueMult: 1, upgradeScale: 1, stationCostBase: 120000, localTarget: 300 },
      F06: { startStations: 0, cost: 2000000, valueMult: 1, upgradeScale: 1, stationCostBase: 0, localTarget: 100 },
      F07: { startStations: 1, cost: 25000000, valueMult: 3, upgradeScale: 3, stationCostBase: 8000000, localTarget: 2500 },
      F08: { startStations: 2, cost: 250000000, valueMult: 1.5, upgradeScale: 1.5, stationCostBase: 50000000, localTarget: 600 },
      F09: { startStations: 1, cost: 2500000000, valueMult: 1, upgradeScale: 1, stationCostBase: 800000000, localTarget: 300 },
      F10: { startStations: 1, cost: 30000000000, valueMult: 4.5, upgradeScale: 4.5, stationCostBase: 8000000000, localTarget: 5000 },
      F11: { startStations: 1, cost: 500000000000, valueMult: 7, upgradeScale: 7, stationCostBase: 120000000000, localTarget: 8000 },
      F12: { startStations: 0, cost: 2000000000000, valueMult: 1, upgradeScale: 1, stationCostBase: 0, localTarget: 100 },
    },
    stationCostGrowth: 1.7,
    // Cost of renovation R1/R2/R3 = stationCostBase * these; each adds this much local sale value.
    renovationCostMult: [1.5, 4, 10],
    renovationValueBonus: [0.05, 0.1, 0.15],
    localXpPerHarvest: 1,
    localXpPerUpgrade: 3,
    // v3: endless grow-room expansions after R3: +valueBonus local value each,
    // cost = stationCostBase * renovationCostMult[2] * costMult * costGrowth^n.
    expansion: { valueBonus: 0.04, costMult: 2, costGrowth: 1.09 },
  },

  districts: {
    source: 'STAND-IN. The bible has districts for relics and prestige but does not list them.',
    rows: [
      { id: 'D1', name: 'Old Town', facilities: ['F01', 'F02', 'F03'] },
      { id: 'D2', name: 'Market Quarter', facilities: ['F04', 'F05', 'F06'] },
      { id: 'D3', name: 'Commerce Park', facilities: ['F07', 'F08', 'F09'] },
      { id: 'D4', name: 'Empire Heights', facilities: ['F10', 'F11', 'F12'] },
    ],
  },

  businessEconomy: {
    source: 'STAND-IN, tuned by tools/balance_sim.js. Bible section 8 gives the loops, not the numbers.',
    cropShare: 0.35,            // share of a harvest's sale value that also becomes crop stock
    shelfDrainPerMinute: 0.05,  // share of a shelf's stock sold each minute at normal demand
    speedPerLevel: 0.2,
    valuePerLevel: 0.12,
    retailMarkup: 1.5,
    demandWindowHours: 6,
    demandMin: 0.8,
    demandMax: 1.3,
    reputationToDemand: 0.01,
    reputationToValue: 0.002,   // in grow rooms, factories and depots reputation adds to value instead
    lowStockValue: 2,
    offlineRetailScale: 0.3,
    capacityOfflinePerLevel: 0.08,
    maxUpgradeLevel: 20,          // v3: was 10. Levels 11-20 are the "deeper upgrades"
    deepUpgradeFromLevel: 10,     // v3: shelf/line levels past this one need Empire Rank deepUpgradeRank
    deepUpgradeRank: 61,
    upgradeGrowth: 1.6,
    upgradeFactor: { speed: 0.5, capacity: 0.4, value: 0.7, batch: 0.6 },
    batchShare: 0.25,           // share of crop stock one batch takes
    batchSharePerLevel: 0.05,
    factoryBoostSpeed: 0.2,
    productCostBase: 40000,
    productCostGrowth: 1.28,
    contractShare: 0.2,
    contractCreditCap: 100,
    creditPerHarvest: 0.2,
    creditToPayout: 0.002,
    offerCount: 4,
    rerollsPerDay: 3,
    reliableBonus: 0.5,
    recentContractSeconds: 1800,
    contractTypes: [
      { id: 'local', name: 'Local drop', seconds: 600, mult: 1.7 },
      { id: 'city', name: 'City run', seconds: 1800, mult: 2.1 },
      { id: 'regional', name: 'Regional haul', seconds: 3600, mult: 2.6 },
      { id: 'overnight', name: 'Overnight freight', seconds: 21600, mult: 3.6 },
      { id: 'express', name: 'Advanced express', seconds: 900, mult: 2.6, advanced: true },
      { id: 'national', name: 'Advanced national', seconds: 43200, mult: 5, advanced: true },
    ],
  },

  research: {
    source: 'Bible section 8: six branches, six ranks, 36 nodes. Numbers STAND-IN.',
    ranks: 6,
    tokenBase: 3,
    tokenGrowth: 1.6,
    cashBase: 1000000,
    cashGrowth: 12,
    maxDiscount: 0.5,
    // v3: endless refinements after rank 6. Each adds shareOfRank of one rank's effect, still capped.
    refine: { shareOfRank: 0.25, tokenBase: 20, tokenGrowth: 1.05, cashMult: 1, cashGrowth: 1.35 },
    boosterDiscount: 0.1,
    branches: [
      { id: 'Grow', effectKey: 'growSpeed', perRank: 0.05, text: 'Grow speed. Rank 3 raises the away cap to 12 hours.', flags: { offlineCap: 3 } },
      { id: 'Quality', effectKey: 'qualityScore', perRank: 5, text: 'Quality score on all harvests.' },
      { id: 'Retail', effectKey: 'retailDemand', perRank: 0.1, text: 'Customer demand in all shops.' },
      { id: 'Factory', effectKey: 'factorySpeed', perRank: 0.1, text: 'Factory speed. Rank 3 makes lines restart by themselves.', flags: { factoryAuto: 3 } },
      { id: 'Logistics', effectKey: 'deliveryPayout', perRank: 0.08, text: 'Delivery pay. Rank 3 opens auto-dispatch.', flags: { deliveryAuto: 3 } },
      { id: 'Events', effectKey: 'festivalPoints', perRank: 0.1, text: 'Festival points.' },
    ],
  },

  collectionRules: {
    source: 'Bible section 7 for the slot counts, STAND-IN for the rest.',
    stationManagerSlots: 1,
    businessManagerSlots: 1,
    managerLevelBonus: 0.1,
    managerMaxLevel: 5,
    fragmentsPerLevel: 3,
    relicsPerDistrict: 3,
    stickersPerBusiness: 2,
    loadoutSlots: 3,
    chestCategories: ['managers', 'relics', 'stickers', 'vehicles', 'packaging', 'decorations'],
  },

  meta: {
    source: 'Counts from bible sections 8, 9 (6 themes, 7 days, 20 tiers, 3 daily, 5 weekly, 36 achievements, 12 rivals). All numbers STAND-IN.',
    inboxDays: 7,
    dailyCount: 3,
    weeklyCount: 5,
    dailyReward: { researchTokens: 1, cashHarvests: 5 },
    weeklyReward: { researchTokens: 4, collectionTokens: 10, cashHarvests: 40 },
    dailyTasks: [
      { id: 'd_harvest', metric: 'harvests', target: 15, text: 'Harvest 15 plants' },
      { id: 'd_harvest_big', metric: 'harvests', target: 40, text: 'Harvest 40 plants' },
      { id: 'd_premium', metric: 'premiumHarvests', target: 2, text: 'Harvest 2 Premium or better' },
      { id: 'd_upgrade', metric: 'hydroUpgrades', target: 2, text: 'Buy 2 hydro upgrades' },
      { id: 'd_batch', metric: 'batches', target: 2, text: 'Claim 2 factory batches', needs: 'F05' },
      { id: 'd_deliver', metric: 'deliveries', target: 1, text: 'Finish a delivery', needs: 'F09' },
    ],
    weeklyTasks: [
      { id: 'w_harvest', metric: 'harvests', target: 200, text: 'Harvest 200 plants' },
      { id: 'w_harvest_big', metric: 'harvests', target: 800, text: 'Harvest 800 plants' },
      { id: 'w_premium', metric: 'premiumHarvests', target: 20, text: 'Harvest 20 Premium or better' },
      { id: 'w_upgrade', metric: 'hydroUpgrades', target: 12, text: 'Buy 12 hydro upgrades' },
      { id: 'w_tasks', metric: 'tasksClaimed', target: 6, text: 'Claim 6 tasks' },
      { id: 'w_batch', metric: 'batches', target: 10, text: 'Claim 10 factory batches', needs: 'F05' },
      { id: 'w_deliver', metric: 'deliveries', target: 5, text: 'Finish 5 deliveries', needs: 'F09' },
      { id: 'w_vip', metric: 'vipDone', target: 2, text: 'Finish 2 VIP orders', needs: 'F04' },
    ],
    wheel: [
      { chance: 0.45, cashHarvests: 10 },
      { chance: 0.25, collectionTokens: 5 },
      { chance: 0.15, cashHarvests: 30 },
      { chance: 0.1, researchTokens: 1 },
      { chance: 0.05, gems: 2 },
    ],
    achievementTokens: 2,
    achievementGems: 5,
    achievements: [
      { id: 'harvester', name: 'Harvester', metric: 'harvests', tiers: [50, 500, 5000, 50000, 500000, 5000000] },
      { id: 'mogul', name: 'Mogul', metric: 'lifetimeCash', tiers: [1e4, 1e6, 1e8, 1e10, 1e12, 1e14] },
      { id: 'botanist', name: 'Botanist', metric: 'masteryTotal', tiers: [10, 50, 150, 400, 1000, 2000] },
      { id: 'builder', name: 'Builder', metric: 'hydroUpgrades', tiers: [10, 50, 150, 400, 1000, 2500] },
      { id: 'trader', name: 'Trader', metric: 'businessJobs', tiers: [5, 25, 100, 300, 1000, 3000] },
      { id: 'collector', name: 'Collector', metric: 'items', tiers: [5, 20, 60, 120, 200, 318] },
    ],
    rivalCashHarvests: 50,
    rivalTokens: 2,
    rivalChallenges: [
      { metric: 'harvests', target: 100, text: 'Harvest 100 plants' },
      { metric: 'level', target: 8, text: 'Reach level 8' },
      { metric: 'strains', target: 10, text: 'Unlock 10 strains' },
      { metric: 'facilities', target: 4, text: 'Own 4 facilities' },
      { metric: 'lifetimeCash', target: 10000000, text: 'Earn $10M in total' },
      { metric: 'items', target: 15, text: 'Collect 15 items' },
      { metric: 'facilities', target: 7, text: 'Own 7 facilities' },
      { metric: 'masteryTotal', target: 200, text: 'Reach 200 total mastery levels' },
      { metric: 'prestiges', target: 3, text: 'Complete 3 regional prestiges' },
      { metric: 'businessJobs', target: 300, text: 'Finish 300 batches and deliveries' },
      { metric: 'lifetimeCash', target: 1e13, text: 'Earn $10T in total' },
      { metric: 'facilities', target: 12, text: 'Own all 12 facilities' },
    ],
    festival: {
      themes: ['Rainbow Roadtrip', 'Cosmic Carnival', 'Neon Night Market', 'Peace & Petals', 'Disco Harvest', 'Galaxy Groove'],
      lengthDays: 7,
      everyWeeks: 2,          // one week on, one week off
      tiers: 20,
      tierBase: 40,
      tierPower: 2,
      ticketsPerTier: 2,
      cashHarvestsPerTier: 10,
    },
    prestige: {
      unlockLevel: 29,          // v3: was 25 (the 45-minute player prestiged on Day 2)
      thresholds: { D1: 2000000, D2: 100000000, D3: 10000000000, D4: 1000000000000 },
      repeatGrowth: 6,        // v3: each earlier prestige of the same district multiplies its threshold by this
      bonusPerShare: 0.02,
      cap: 25,
      boosterBonus: 0.15,
      hqBonus: 0.25,
    },
    vip: {
      maxOffers: 3,
      hours: 6,
      skuChance: 0.35,
      skuShare: 0.2,
      skuMult: 2.4,
      harvestsMin: 3,
      harvestsSpread: 6,
      harvestMult: 1.5,
      tokens: 3,
    },
  },

  // Big job 2, Stage 1. The bible: occasional, short, skippable; never constant chatter.
  helpers: {
    source: 'STAND-IN. Bible sections 1, 9: helpers speak only at meaningful moments.',
    cooldownMinutes: 6,      // after a line, nothing more for this long (first-time events excepted)
    repeatChance: 0.35,      // after the first time, the chance an event gets a line at all
    idleReturnHours: 2,      // "welcome back" lines only after being away this long
    showSeconds: 9,          // a line closes by itself after this long; one tap closes it sooner
    secondFaceMinChars: 60,  // lines at least this long change expression partway through
    secondFaceAtShare: 0.4,  // how far through the time on screen that change happens
    blinkEverySeconds: 2.6,  // how often a blink/idle frame is swapped in
    blinkHoldMs: 170,        // how long that frame stays before going back
    celebrateHelperSize: 124, // how wide the cheering helper is on a banner, in screen points
  },
  celebrations: {
    source: 'STAND-IN. Bible section 10A: short and skippable, reduced-motion option.',
    rankEvery: 10,
    majorRanks: [25, 60, 100, 250, 500, 1000],
    seconds: 2.4,
    reducedMotionSeconds: 1.6,
    maxWaiting: 3,
  },
  profile: {
    source: 'Bible section 10A for the six slots, STAND-IN for the rest',
    hallSlots: 6,
    hallOfFameLevel: 4,      // "a simple early feature gate"
    nameMaxLength: 20,
  },

  offline: {
    source: 'bible section 6 for the cap, STAND-IN for the rest',
    minAwaySeconds: 60,          // shorter gaps are treated as normal play
    xpShare: 1,                  // v3: was 0.25. Share of normal XP earned while away (helps short-session players reach Rank 60 in 4-6 weeks)
  },

  effectCaps: {
    source: 'STAND-IN. Bible: cap stacking, never apply a modifier twice.',
    growSpeed: 2, yieldBonus: 2, saleBonus: 4, qualityScore: 80, masteryXp: 2, extraHarvestChance: 0.3,
    offlineEfficiency: 0.2, maintenanceInterval: 1.5, upgradeDiscount: 0.4,
  },
};
