// The daily login calendar (job 5, Stage 6): 28 days, one reward per day you log in.
// Bible: no punishing missed-day streaks. Missing days only pauses it: day 5 stays day 5 until you come
// back. One claim per day of game time, the same guarded clock as offline money, so winding the phone's
// clock back gives nothing. All rewards and which calendar runs are in the balance table, so a seasonal
// calendar is only a new row there.
(function (PE) {
  PE.Game.register('calendar', (g) => {
    const { state, data, B } = g;
    const T = () => B.calendar;
    const c = () => {
      if (!state.calendar) state.calendar = PE.SaveSchema.newCalendar();
      return state.calendar;
    };
    const today = () => Math.floor(g.now() / 86400000);
    // A saved calendar that's been removed from the table falls back to the current one.
    const table = () => T().calendars[c().id] || T().calendars[T().active];
    const RARITIES = PE.DataCheck.RARITIES;

    const canClaim = () => c().lastClaimDay !== today();

    // A manager card of at least this rarity. Ones you don't own come first, so the best prizes feel new.
    function pickManager(key, minRarity) {
      const from = RARITIES.indexOf(minRarity);
      const pool = data.collectibles.managers.filter((m) => RARITIES.indexOf(m.rarity) >= from);
      const fresh = pool.filter((m) => !state.collections.owned[m.id]);
      const list = fresh.length ? fresh : pool;
      return list[Math.floor(PE.Rng.roll(`${state.rng.seed}:cal:${key}`) * list.length)];
    }
    function pickDecoration(key) {
      const pool = data.collectibles.decorations;
      const fresh = pool.filter((d) => !state.collections.owned[d.id]);
      const list = fresh.length ? fresh : pool;
      return list[Math.floor(PE.Rng.roll(`${state.rng.seed}:cal:${key}`) * list.length)];
    }

    function payDay(r, key, dayNumber) {
      const bits = [];
      const plain = g.meta.payReward(r, 'calendar');
      if (plain) bits.push(plain);
      const title = `Day ${dayNumber} prize!`;
      const level = Math.max(1, g.progress.level());
      if (r.chest) {
        const cards = g.collections.openChest(`cal:${key}:chest`, level, r.chest, { source: 'calendar', title });
        bits.push(`a chest with ${cards.length} cards`);
      }
      if (r.manager) {
        const cards = g.collections.openChest(`cal:${key}:mgr`, level, 1, { source: 'calendar', title, pick: (k) => pickManager(k, r.manager) });
        if (cards[0]) bits.push(cards[0].name);
      }
      if (r.decoration) {
        const cards = g.collections.openChest(`cal:${key}:dec`, level, 1, { source: 'calendar', title, pick: (k) => pickDecoration(k) });
        if (cards[0]) bits.push(cards[0].name);
      }
      return bits.join(', ');
    }

    g.calendar = {
      canClaim,
      // Which reward is next, counting from 1. Never goes backwards.
      dayNumber: () => c().claimed + 1,
      round: () => c().round,
      streak: () => { const cal = c(); const gap = cal.lastClaimDay === null || cal.lastClaimDay === undefined ? 99 : today() - cal.lastClaimDay; return gap <= 1 || (gap === 2 && cal.catchUpWeek !== Math.floor(today() / 7)) ? cal.streak || 0 : 0; },
      bestStreak: () => c().bestStreak || 0,
      caughtUp: () => !!c().caughtUp,
      name: () => table().name,
      days: () => table().days,
      // For the screen: every day, and whether it's been claimed.
      rows() {
        return table().days.map((r, i) => ({ day: i + 1, reward: r, claimed: i < c().claimed, next: i === c().claimed }));
      },
      claim() {
        if (!canClaim()) return { ok: false, why: 'today' };
        const cal = c();
        const dayNumber = cal.claimed + 1;
        const reward = table().days[cal.claimed];
        const key = `${cal.id}:${cal.round}:${dayNumber}`;
        let text = '';
        const ran = g.once(`calendar:${key}`, () => {
          // Job 25: the login streak. A day in a row adds one; one missed day in between is forgiven once a week (the
          // catch-up), so a busy day doesn't wipe it; more than that starts it again at 1. Every 7th day of a streak pays a
          // little extra (balance table: calendar.streak).
          const gap = cal.lastClaimDay === null || cal.lastClaimDay === undefined ? null : today() - cal.lastClaimDay;
          const week = Math.floor(today() / 7);
          if (gap === 1) cal.streak = (cal.streak || 0) + 1;
          else if (gap === 2 && cal.catchUpWeek !== week) { cal.streak = (cal.streak || 0) + 1; cal.catchUpWeek = week; cal.caughtUp = true; }
          else cal.streak = 1;
          if (gap !== 2) cal.caughtUp = false;
          cal.bestStreak = Math.max(cal.bestStreak || 0, cal.streak);
          cal.lastClaimDay = today();
          text = payDay(reward, key, dayNumber);
          const S = T().streak;
          if (S && cal.streak % S.every === 0) { const extra = g.meta.payReward(S.reward, 'streak'); if (extra) text += `, ${cal.streak} day streak: ${extra}`; }
          cal.claimed += 1;
          // All done: a new calendar starts tomorrow, using whichever one is current then.
          if (cal.claimed >= table().days.length) {
            cal.claimed = 0;
            cal.round += 1;
            cal.id = T().active;
          }
          g.emit('changed');
        });
        return { ok: ran, text, day: dayNumber };
      },
      // Shown once on the first open of each day, only if there's a reward waiting.
      shouldShow: () => canClaim() && c().lastShownDay !== today(),
      markShown() { c().lastShownDay = today(); },
    };
  });
})(globalThis.PE = globalThis.PE || {});
