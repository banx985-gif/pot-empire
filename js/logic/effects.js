// Effects: every bonus in the game (talents, mastery, research, managers, relics, decorations ...)
// goes through here, so nothing can be counted twice by accident.
//
//   An effect = { key, value, group, scope, when }
//   - inside one GROUP only the single strongest effect counts (two cards of the same kind don't stack)
//   - different groups add together
//   - the total for a key is limited by the cap in the balance table (bible: cap stacking)
//
//   scope says where it applies: {} = everywhere, or { facility, station, business, district }
//   when  is an optional condition name, checked against what is being worked out (see CONDITIONS)
(function (PE) {
  const CONDITIONS = {
    shortCycle: (c) => c.baseSeconds !== undefined && c.baseSeconds <= 120,
    longCycle: (c) => c.baseSeconds !== undefined && c.baseSeconds > 120,
    fullStation: (c) => !!c.stationFull,
    mixedStrains: (c) => !!c.stationMixed,
    sameStrain: (c) => !!c.stationSame,
    premiumOrBetter: (c) => c.grade !== undefined && c.grade >= 2,
    rareStrain: (c) => !!c.rarityIndex && c.rarityIndex >= 2,
    commonSku: (c) => c.skuTier === 0,
    uncommonSku: (c) => c.skuTier === 1,
    rareSku: (c) => c.skuTier >= 2,
    firstHarvestToday: (c) => !!c.firstHarvestToday,
    multiLine: (c) => c.activeLines >= 2,
    shortRoute: (c) => c.routeSeconds !== undefined && c.routeSeconds <= 1800,
    longRoute: (c) => c.routeSeconds !== undefined && c.routeSeconds > 1800,
    smallVehicle: (c) => c.vehicleTier !== undefined && c.vehicleTier <= 1,
    heavyVehicle: (c) => c.vehicleTier !== undefined && c.vehicleTier >= 3,
    family: (c, e) => c.family === e.family,
    branch: (c, e) => c.branch === e.branch,
    fleetVariety: (c) => c.fleetKinds >= 3,
    festivalActive: (c) => !!c.festivalActive,
    lowStock: (c) => !!c.lowStock,
    streak: (c) => c.dailyStreak >= 1,
    afterContract: (c) => !!c.recentContract,
    vipOrder: (c) => !!c.vip,
  };

  function scopeMatches(scope, c) {
    if (!scope) return true;
    if (scope.facility !== undefined && scope.facility !== c.facility) return false;
    if (scope.station !== undefined && scope.station !== c.station) return false;
    if (scope.mode !== undefined && scope.mode !== c.mode) return false;
    if (scope.district !== undefined && scope.district !== c.district) return false;
    return true;
  }

  // Works out the total of one effect from a list of effects. A plain function, so tests can use it.
  function total(list, key, ctx, caps) {
    const best = new Map();
    for (const e of list) {
      if (e.key !== key) continue;
      if (!scopeMatches(e.scope, ctx)) continue;
      if (e.when && !CONDITIONS[e.when](ctx, e)) continue;
      const cur = best.get(e.group);
      if (cur === undefined || e.value > cur) best.set(e.group, e.value);
    }
    let sum = 0;
    for (const v of best.values()) sum += v;
    const cap = caps ? caps[key] : undefined;
    return cap !== undefined ? Math.min(sum, cap) : sum;
  }

  PE.Effects = { CONDITIONS, total };

  PE.Game.register('effects', (g) => {
    const providers = [];   // functions that each return a list of effects
    let cache = null;
    g.effects = {
      addProvider(fn) { providers.push(fn); cache = null; },
      invalidate() { cache = null; },
      list() {
        if (!cache) {
          cache = [];
          for (const p of providers) for (const e of p()) cache.push(e);
        }
        return cache;
      },
      get: (key, ctx = {}) => total(g.effects.list(), key, ctx, g.B.effectCaps),
    };
  });
})(globalThis.PE = globalThis.PE || {});
