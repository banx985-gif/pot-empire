// What a saved game looks like, and how to upgrade old saves.
//
// To change the save layout: raise CURRENT_VERSION, add a step to MIGRATIONS that turns the old
// layout into the new one, and add a test with a sample of the old layout. Never edit an old step.
//
// Saves hold plain facts only (ids, numbers, UTC times), never anything from Phaser.
(function (PE) {
  const CURRENT_VERSION = 4;

  function newCollections() {
    return { owned: {}, productsUnlocked: {}, relicsByDistrict: {}, stickersByBusiness: {}, decorByFacility: {}, packagingBySku: {}, loadouts: [] };
  }

  function newStation(nowMs) {
    return {
      model: 1,
      levels: { lights: 1, sprinkler: 1, pots: 1, computer: 1, capacity: 1 },
      pots: [null, null],     // each pot: null, or { s: strain id, plantedAtUtc, plantedMs, readyMs, q: quality }
      lastStrains: [],
      auto: { harvest: false, replant: false },
      queue: [],
      queueIndex: 0,
      lastServiceMs: nowMs,
      harvests: 0,
    };
  }

  function createNewState(nowUtc, balanceVersion) {
    const nowMs = Date.parse(nowUtc);
    return {
      createdAtUtc: nowUtc,
      lastSeenUtc: nowUtc,
      balanceTableVersion: balanceVersion,
      // Text rather than numbers, because these can grow beyond what a normal number holds exactly.
      currencies: {
        cash: '0', researchTokens: '0', empireShares: '0',
        collectionTokens: '0', festivalTickets: '0', rainbowGems: '0',
      },
      player: { level: 1, xp: '0', talentPoints: 1, talents: {}, pendingChoices: [], titles: [] },
      time: { offsetMs: 0, highWaterMs: nowMs, lastActiveMs: nowMs, rollbacks: 0 },
      rng: { seed: nowUtc, counter: 0 },
      stats: { harvests: 0, lifetimeCash: '0', offlineClaims: 0, bestGrade: {}, lastHarvestDay: null, deliveries: 0 },
      unlockedStrains: { 'STR-001': true },
      pendingOffline: null,
      settings: { reducedMotion: false },
      facilities: { F01: { unlocked: true, renovation: 0, localXp: 0, stations: { 0: newStation(nowMs), 1: newStation(nowMs) } } },
      mastery: {},
      managers: { owned: {}, assigned: {} },
      collections: newCollections(),
      stock: { crop: 0, products: {}, contractCredit: 0 },
      depot: { day: null, seed: 0, rerolls: 0, offers: [] },
      research: {},
      contracts: { active: [], history: [] },
      events: {},
      prestigeHistory: [],
      purchases: [],
      appliedTransactionIds: [],   // so an offline claim or reward can never pay out twice
      profile: { businessName: '', username: '', avatarStrainId: null, favouriteStrainId: null },
      hallOfFameFeaturedStrainIds: [null, null, null, null, null, null],
      milestones: {},
      ui: { garageStrainId: 'STR-001' },
    };
  }

  // Each step takes a save at version N and returns it at version N+1.
  const MIGRATIONS = {
    // Version 1 was the very first layout and never shipped. It stays here so the upgrade path is
    // proven from day one: cash as a number, a single millisecond time, no transaction list.
    1(old) {
      const fresh = createNewState(new Date(old.lastSeenMs).toISOString(), old.balanceTableVersion || 1);
      fresh.createdAtUtc = new Date(old.createdMs ?? old.lastSeenMs).toISOString();
      fresh.currencies.cash = String(old.cash ?? 0);
      fresh.currencies.rainbowGems = String(old.gems ?? 0);
      fresh.player.level = old.level ?? 1;
      if (old.garageStrainId) fresh.ui.garageStrainId = old.garageStrainId;
      return fresh;
    },
    // Version 3 (overnight job 1, Stage 1): adds growing, game time, dice, stats. Only fills in what
    // is missing, because a version 1 save arrives here already in the newest layout.
    2(old) {
      const s = old;
      const nowMs = Date.parse(s.lastSeenUtc);
      s.player = { talentPoints: 1, talents: {}, pendingChoices: [], titles: [], ...s.player };
      s.time = s.time || { offsetMs: 0, highWaterMs: nowMs, lastActiveMs: nowMs, rollbacks: 0 };
      s.rng = s.rng || { seed: s.createdAtUtc, counter: 0 };
      s.stats = s.stats || { harvests: 0, lifetimeCash: s.currencies.cash, offlineClaims: 0, bestGrade: {}, lastHarvestDay: null };
      s.unlockedStrains = s.unlockedStrains || { 'STR-001': true };
      s.pendingOffline = s.pendingOffline || null;
      s.settings = s.settings || { reducedMotion: false };
      const f = s.facilities.F01;
      f.localXp = f.localXp || 0;
      if (!Object.keys(f.stations || {}).length) f.stations = { 0: newStation(nowMs), 1: newStation(nowMs) };
      return s;
    },
    // Version 4 (overnight job 1, Stage 3): stock, depot, collections.
    3(old) {
      const s = old;
      s.collections = { ...newCollections(), ...s.collections };
      s.stock = s.stock || { crop: 0, products: {}, contractCredit: 0 };
      s.depot = s.depot || { day: null, seed: 0, rerolls: 0, offers: [] };
      s.stats.deliveries = s.stats.deliveries || 0;
      return s;
    },
  };

  // The minimum a save must have to be usable. Returns a list of what's wrong (empty = fine).
  function checkState(state) {
    const problems = [];
    if (!state || typeof state !== 'object') return ['not an object'];
    if (!Number.isFinite(Date.parse(state.lastSeenUtc))) problems.push('lastSeenUtc is not a valid time');
    if (!state.currencies || typeof state.currencies.cash !== 'string') problems.push('currencies missing');
    if (!state.facilities || !state.facilities.F01) problems.push('garage missing');
    if (!Array.isArray(state.appliedTransactionIds)) problems.push('transaction list missing');
    if (!state.time || !Number.isFinite(state.time.lastActiveMs)) problems.push('game time missing');
    return problems;
  }

  PE.SaveSchema = { CURRENT_VERSION, MIGRATIONS, createNewState, newStation, checkState };
})(globalThis.PE = globalThis.PE || {});
