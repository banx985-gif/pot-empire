// The heart of the rules. createGame ties a saved state to the clock and the data tables, and each
// service (grow, progress, offline, ...) adds its part. No Phaser here. The game runs the same in
// a test, in the balance simulator and on the phone.
(function (PE) {
  const { Money } = PE;

  function createGame(options) {
    const { state, clock } = options;
    const data = options.data || PE.Data;
    const listeners = [];
    const applied = new Set(state.appliedTransactionIds);

    const g = {
      state, data, clock,
      B: data.balance,

      // ---- Time. The rules always ask here. -------------------------------------------------
      // If the phone's clock is wound back, game time carries on from the latest moment it has
      // seen, so plants never un-grow and no time is earned twice. Stored as an offset so game
      // time keeps running normally afterwards rather than freezing.
      now() {
        const t = state.time;
        const real = clock.nowMs();
        let eff = real + t.offsetMs;
        if (eff < t.highWaterMs) {
          t.offsetMs += t.highWaterMs - eff;
          t.rollbacks += 1;
          eff = t.highWaterMs;
        }
        t.highWaterMs = eff;
        return eff;
      },
      nowUtc() { return new Date(g.now()).toISOString(); },

      // ---- Events: the rules tell the screens what happened; they never call the screens. ----
      on(fn) { listeners.push(fn); return () => listeners.splice(listeners.indexOf(fn), 1); },
      emit(type, payload) { for (const fn of listeners) fn(type, payload || {}); },

      // ---- Currencies ------------------------------------------------------------------------
      balance: (cur) => state.currencies[cur],
      earn(cur, amount, why) {
        const before = state.currencies[cur];
        state.currencies[cur] = Money.add(before, amount);
        if (cur === 'cash') {
          state.stats.lifetimeCash = Money.add(state.stats.lifetimeCash, amount);
          if (g.meta && g.meta.onCashEarned) g.meta.onCashEarned(amount, why);
        }
        g.emit('currency', { cur, why });
      },
      canAfford: (cur, amount) => Money.gte(state.currencies[cur], amount),
      spend(cur, amount, why) {
        if (!g.canAfford(cur, amount)) return false;
        state.currencies[cur] = Money.sub(state.currencies[cur], amount);
        g.emit('currency', { cur, why });
        return true;
      },

      // ---- One-time rewards ------------------------------------------------------------------
      // Runs fn only if this transaction id has never been applied. Returns true if it ran.
      once(txId, fn) {
        if (applied.has(txId)) return false;
        applied.add(txId);
        state.appliedTransactionIds.push(txId);
        // Keep the save small: drop only the very oldest ids (level and chest ids are also guarded
        // by their own records, so old ids here can't pay again).
        if (state.appliedTransactionIds.length > 3000) {
          const gone = state.appliedTransactionIds.splice(0, 500);
          gone.forEach((id) => applied.delete(id));
        }
        fn();
        return true;
      },
      wasApplied: (txId) => applied.has(txId),

      // A fresh repeatable dice roll. The counter is saved, so results can't be re-rolled by reopening.
      nextRoll(label) {
        state.rng.counter += 1;
        return PE.Rng.roll(`${state.rng.seed}:${label}:${state.rng.counter}`);
      },
    };

    for (const name of PE.Game.serviceOrder) PE.Game.services[name](g);
    g.now();
    return g;
  }

  PE.Game = { createGame, services: {}, serviceOrder: [] };
  // Each service file registers itself here. Order = load order in index.html.
  PE.Game.register = (name, fn) => { PE.Game.services[name] = fn; PE.Game.serviceOrder.push(name); };
})(globalThis.PE = globalThis.PE || {});
