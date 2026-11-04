// What a saved game looks like, and how to upgrade old saves.
//
// To change the save layout: raise CURRENT_VERSION, add a step to MIGRATIONS that turns the old
// layout into the new one, and add a test with a sample of the old layout. Never edit an old step.
//
// Saves hold plain facts only (ids, numbers, UTC times), never anything from Phaser.
(function (PE) {
  const CURRENT_VERSION = 2;

  function createNewState(nowUtc, balanceVersion) {
    return {
      createdAtUtc: nowUtc,
      lastSeenUtc: nowUtc,
      balanceTableVersion: balanceVersion,
      // Text rather than numbers, because these can grow beyond what a normal number holds exactly.
      currencies: {
        cash: '0', researchTokens: '0', empireShares: '0',
        collectionTokens: '0', festivalTickets: '0', rainbowGems: '0',
      },
      player: { level: 1, xp: '0' },
      facilities: { F01: { unlocked: true, renovation: 0, stations: {} } },
      mastery: {},
      managers: { owned: {}, assigned: {} },
      collections: {},
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
  };

  // The minimum a save must have to be usable. Returns a list of what's wrong (empty = fine).
  function checkState(state) {
    const problems = [];
    if (!state || typeof state !== 'object') return ['not an object'];
    if (!Number.isFinite(Date.parse(state.lastSeenUtc))) problems.push('lastSeenUtc is not a valid time');
    if (!state.currencies || typeof state.currencies.cash !== 'string') problems.push('currencies missing');
    if (!state.facilities || !state.facilities.F01) problems.push('garage missing');
    if (!Array.isArray(state.appliedTransactionIds)) problems.push('transaction list missing');
    return problems;
  }

  PE.SaveSchema = { CURRENT_VERSION, MIGRATIONS, createNewState, checkState };
})(globalThis.PE = globalThis.PE || {});
