// Offline: what happens to the time the game was closed.
//
// The promise: time away is counted exactly once, however many times the game is reopened, and
// the money from it can be claimed exactly once.
//   1. settle(): works out what was earned since lastActiveMs, moves lastActiveMs forward and puts
//      the result in state.pendingOffline. Pots are changed in the same step, so the save either
//      holds all of it or none of it.
//   2. claim(): pays state.pendingOffline once, guarded by its transaction id.
//
// While away:
//   - every plant keeps its timestamp, so it keeps growing, however long the game is closed
//   - a plant that finished is collected once and sold, on any station, so coming back always
//     pays out (no automation needed)
//   - a station with auto-harvest AND auto-replant keeps cycling, at the sprinkler's offline
//     efficiency, for up to the offline cap (8 hours, 12 when upgraded)
(function (PE) {
  const { Money } = PE;

  PE.Game.register('offline', (g) => {
    const { state, B } = g;

    function capSeconds() {
      const upgraded = g.research ? g.research.hasOfflineCapUpgrade() : false;
      return (upgraded ? B.growing.offlineCapHours.upgraded : B.growing.offlineCapHours.base) * 3600;
    }

    function efficiency(st, fid, si) {
      const base = B.hydroModels.offlineEfficiency[st.levels.sprinkler - 1];
      const bonus = g.effects.get('offlineEfficiency', g.grow.internals.contextFor(fid, si));
      return Math.min(1, base + bonus);
    }

    function settle() {
      const now = g.now();
      const from = state.time.lastActiveMs;
      const awaySeconds = Math.max(0, (now - from) / 1000);
      state.time.lastActiveMs = now;
      if (awaySeconds < B.offline.minAwaySeconds) return null;

      const cap = capSeconds();
      const creditedSeconds = Math.min(awaySeconds, cap);
      const limit = from + creditedSeconds * 1000;
      const report = {
        txId: `offline:${from}:${now}`,
        fromMs: from, toMs: now,
        awaySeconds, creditedSeconds, capped: awaySeconds > cap,
        cash: 0, xp: 0, harvests: 0, grades: [0, 0, 0, 0, 0], mastery: {},
        extras: [],
      };
      const { plantInto, nextReplantStrain } = g.grow.internals;

      g.grow.eachStation((fid, si, st) => {
        const cycling = st.auto.harvest && st.auto.replant
          && g.grow.hasStationFeature(st, 'autoHarvest') && g.grow.hasStationFeature(st, 'autoReplant');
        const eff = efficiency(st, fid, si);
        st.pots.forEach((p, pi) => {
          if (!p) {
            // An empty pot on a replanting station starts a plant the moment the player left.
            if (!cycling) return;
            const next = nextReplantStrain(st, pi);
            if (!next || !g.grow.isStrainUnlocked(next)) return;
            p = plantInto(fid, si, pi, next, from);
          }
          if (p.readyMs > now) return;           // still growing: its timestamp carries it on
          const s = g.grow.strainStats(p.s);
          report.cash += g.grow.saleValue(fid, si, p.s, p.q);
          report.xp += s.harvestXp;
          report.harvests += 1;
          report.grades[p.q] += 1;
          report.mastery[p.s] = (report.mastery[p.s] || 0) + s.masteryXp;
          state.stats.harvests += 1;
          st.harvests += 1;
          state.stats.bestGrade[p.s] = Math.max(state.stats.bestGrade[p.s] ?? 0, p.q);
          if (g.facilities) g.facilities.addLocalXp(fid, B.facilityEconomy.localXpPerHarvest);
          if (g.stock) g.stock.onHarvest(s, p.q, g.grow.saleValue(fid, si, p.s, p.q), g.grow.internals.contextFor(fid, si, p.s));
          if (g.meta) g.meta.onHarvest(s, p.q, true, fid, g.grow.saleValue(fid, si, p.s, p.q));

          if (!cycling) { st.pots[pi] = null; return; }

          // Further whole cycles, only inside the credited time. Paid at the average quality, so a
          // long absence doesn't need thousands of dice rolls.
          const strainId = p.s;
          const cycle = g.grow.cycleSeconds(fid, si, strainId) * 1000;
          const start = Math.max(p.readyMs, from);
          let extra = start < limit ? Math.floor((limit - start) / cycle) : 0;
          if (extra > 0) {
            const each = g.grow.expectedSale(fid, si, strainId);
            report.cash += each * extra * eff;
            report.xp += s.harvestXp * extra * eff;
            report.harvests += extra;
            report.mastery[strainId] = (report.mastery[strainId] || 0) + s.masteryXp * extra * eff;
            const chances = g.grow.chancesFor(fid, si, strainId);
            chances.forEach((c, i) => { report.grades[i] += Math.round(c * extra); });
            state.stats.harvests += extra;
            st.harvests += extra;
            if (g.facilities) g.facilities.addLocalXp(fid, B.facilityEconomy.localXpPerHarvest * extra * eff);
            if (g.stock) g.stock.onOfflineCycles(s, each * extra * eff, extra);
            if (g.meta) g.meta.onOfflineCycles(s, extra * eff, fid, each * extra * eff);
          }
          // Replant: partway through a cycle if the time ran out naturally, fresh if the cap cut it off.
          const next = nextReplantStrain(st, pi) || strainId;
          const replantAt = report.capped ? now : start + extra * cycle;
          plantInto(fid, si, pi, next, Math.min(now, replantAt));
        });
      });

      // Other businesses (shops, factories, deliveries) add theirs.
      if (g.business) g.business.settleOffline(from, now, creditedSeconds, report);

      report.cash = Money.toBig(report.cash).toString();   // text, so it can be any size
      report.xp = Math.round(report.xp * B.offline.xpShare);   // being away earns less XP than playing
      if (report.cash === '0' && report.harvests === 0 && !report.extras.length) return report;

      // Unclaimed money from an earlier return is rolled together, never lost and never doubled.
      const old = state.pendingOffline;
      if (old) {
        report.cash = Money.add(old.cash, report.cash);
        report.xp += old.xp;
        report.harvests += old.harvests;
        report.grades = report.grades.map((n, i) => n + old.grades[i]);
        for (const [k, v] of Object.entries(old.mastery)) report.mastery[k] = (report.mastery[k] || 0) + v;
        report.extras = old.extras.concat(report.extras);
        report.awaySeconds += old.awaySeconds;
        report.creditedSeconds += old.creditedSeconds;
        report.fromMs = old.fromMs;
      }
      state.pendingOffline = report;
      g.emit('offlineReady', report);
      return report;
    }

    g.offline = {
      settle,
      capSeconds,
      pending: () => state.pendingOffline,

      // Pays what was earned. Safe to call any number of times.
      claim() {
        const r = state.pendingOffline;
        if (!r) return null;
        state.pendingOffline = null;
        const ran = g.once(r.txId, () => {
          g.earn('cash', r.cash, 'offline');
          for (const [id, xp] of Object.entries(r.mastery)) g.grow.addMastery(id, xp);
          g.progress.addXp(r.xp);
          state.stats.offlineClaims += 1;
          g.emit('offlineClaimed', r);
          g.emit('changed');
        });
        return ran ? r : null;
      },
    };

    // The regular heartbeat while the game is open.
    g.tick = function tick() {
      const now = g.now();
      const gap = (now - state.time.lastActiveMs) / 1000;
      if (gap >= B.offline.minAwaySeconds) {
        // The phone slept or the page was hidden: this is a return, not normal play.
        settle();
      } else {
        state.time.lastActiveMs = now;
        if (g.business) g.business.tick(now, gap);
      }
      g.grow.tickAuto();
      if (g.meta) g.meta.tick(now);
    };
  });
})(globalThis.PE = globalThis.PE || {});
