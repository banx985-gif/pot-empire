// The Event Hub (job 23): which event is on today by the player's own date, the weekly progress and prizes, and the
// caps that keep events a side dish. Everything about what runs when and what it pays is in data/event_hub.js.
//
// Saved in state.eventHub:
//   levels        Bud Match: best stars per level (a level opens when the one before has a star). Kept for good.
//   week          the week the progress below belongs to (the date of that week's Monday). A new week starts fresh.
//   stars         stars earned this week (a level's better best adds the difference)
//   weekBest      best stars per level this week
//   wins          levels won this week (their win prize is paid once a week)
//   milestones    milestone prizes claimed this week
//   paid          what's been paid today (paidDay) and this week, for the caps
//   force         the secret test switch: the event day is on whatever the date
(function (PE) {
  PE.Game.register('eventHub', (g) => {
    const { state } = g;
    const D = () => PE.Data.eventHub;
    const DAY = 86400000;

    // The player's own date (their phone's time zone), as YYYY-MM-DD.
    const pad = (n) => String(n).padStart(2, '0');
    const dateKey = (ms) => { const d = new Date(ms); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
    const midnight = (ms) => { const d = new Date(ms); d.setHours(0, 0, 0, 0); return d.getTime(); };
    // A day later at midnight (not + 24 hours: a clock change day is 23 or 25 hours long).
    const nextMidnight = (ms) => { const d = new Date(midnight(ms)); d.setDate(d.getDate() + 1); return d.getTime(); };
    const weekKey = (ms) => { const d = new Date(midnight(ms)); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return dateKey(d.getTime()); };

    function s() {
      if (!state.eventHub) state.eventHub = { levels: {}, week: null, stars: 0, weekBest: {}, wins: {}, milestones: {}, paidDay: null, paid: { day: {}, week: {} }, force: false, seen: false };
      const E = state.eventHub;
      const wk = weekKey(g.now());
      if (E.week !== wk) Object.assign(E, { week: wk, stars: 0, weekBest: {}, wins: {}, milestones: {}, paid: { day: {}, week: {} }, paidDay: null });
      const today = dateKey(g.now());
      if (E.paidDay !== today) { E.paidDay = today; E.paid.day = {}; }
      return E;
    }
    const eventDay = () => { const d = state.settings.eventDay; return Number.isInteger(d) && d >= 0 && d <= 6 ? d : D().defaultDay; };

    // Is this event on at this moment? Returns { on, startsMs, endsMs } by the player's own date.
    function timing(ev, ms = g.now()) {
      const W = ev.when || {};
      if (W.weekly) {
        if (s().force) return { on: true, startsMs: midnight(ms), endsMs: nextMidnight(ms), forced: true };
        const today = new Date(ms).getDay();
        const wait = (eventDay() - today + 7) % 7;
        if (wait === 0) return { on: true, startsMs: midnight(ms), endsMs: nextMidnight(ms) };
        const d = new Date(midnight(ms)); d.setDate(d.getDate() + wait);
        const start = d.getTime();
        d.setDate(d.getDate() + 1);
        return { on: false, startsMs: start, endsMs: d.getTime() };
      }
      if (W.from && W.to) {
        // A date range each year (for later events). Ranges over New Year aren't needed yet.
        const y = new Date(ms).getFullYear();
        const day = (txt, year) => { const [m, dd] = txt.split('-').map(Number); return new Date(year, m - 1, dd).getTime(); };
        for (const year of [y, y + 1]) {
          const a = day(W.from, year), b = nextMidnight(day(W.to, year));
          if (ms < b) return { on: ms >= a, startsMs: a, endsMs: b };
        }
      }
      return { on: false, startsMs: Infinity, endsMs: Infinity };
    }
    function list(ms = g.now()) { return D().events.map((ev) => ({ ...ev, ...timing(ev, ms) })); }
    const weekly = () => list().find((e) => e.id === 'weekly');

    // ---- Paying, within the caps -------------------------------------------------------------------------------------
    const lockedStrains = () => g.data.strains.map((x) => g.grow.strainStats(x.id)).filter((x) => !g.grow.isStrainUnlocked(x.id) && x.unlockLevel <= g.progress.level())
      .sort((a, b) => a.unlockLevel - b.unlockLevel || a.unlockCost - b.unlockCost);
    // Every growing plant finishes this much sooner (never past ready).
    function boost(minutes) {
      const now = g.now();
      let n = 0;
      g.grow.eachStation((fid, si, st) => st.pots.forEach((p) => { if (p && p.readyMs > now) { p.readyMs = Math.max(now, p.readyMs - minutes * 60000); n++; } }));
      g.emit('changed');
      return n;
    }
    // Pays a reward, cut down to what's left under today's and this week's caps. Returns { text, capped }.
    function pay(r, why) {
      const E = s(), caps = D().caps;
      const room = (k) => Math.max(0, Math.min((caps.day[k] ?? Infinity) - (E.paid.day[k] || 0), (caps.week[k] ?? Infinity) - (E.paid.week[k] || 0)));
      const give = {};
      let capped = false;
      for (const [k, v] of Object.entries(r)) {
        if (!v) continue;
        const ok = Math.min(v, room(k));
        if (ok < v) capped = true;
        if (ok > 0) { give[k] = ok; E.paid.day[k] = (E.paid.day[k] || 0) + ok; E.paid.week[k] = (E.paid.week[k] || 0) + ok; }
      }
      const text = [];
      const plain = g.meta.payReward({ cashHarvests: give.cashHarvests || 0, gems: give.gems || 0 }, why);
      if (plain) text.push(plain);
      if (give.boostMinutes) { boost(give.boostMinutes); text.push(`Grow boost: every plant ${give.boostMinutes} min sooner`); }
      for (let n = 0; n < (give.seedPack || 0); n++) {
        const strain = lockedStrains()[0];
        if (strain) {
          state.unlockedStrains[strain.id] = true;
          g.emit('strainUnlocked', { id: strain.id, rarity: strain.rarity, free: true });
          text.push(`Seed pack: ${strain.name}`);
        } else {
          // Every strain at your level already: the pack is paid in cash instead.
          const c = g.meta.payReward({ cashHarvests: 10 }, why);
          text.push(`Seed pack: ${c}`);
        }
      }
      g.emit('changed');
      return { text: text.join(', '), capped, given: give };
    }

    // ---- Bud Match ------------------------------------------------------------------------------------------------------
    const levels = () => D().budMatch.levels;
    const best = (n) => s().levels[n] || 0;
    const isOpen = (n) => n >= 1 && n <= levels().length && (n === 1 || best(n - 1) > 0);
    // A level's settings for the board (counting from 1).
    const level = (n) => ({ n, w: 7, h: 8, ...levels()[n - 1] });

    // The end of a level: stars count for the week, a first win this week pays, milestones are reached.
    // seed: the board's seed, so the same finished game can't be reported twice.
    function finish(n, result, txId) {
      const E = s();
      const out = { ok: false, text: '', capped: false, newStars: 0, milestones: [] };
      if (!isOpen(n)) return { ...out, why: 'locked' };
      if (!weekly().on) return { ...out, why: 'closed' };
      g.once(`bm:${txId}`, () => {
        out.ok = true;
        const stars = result.won ? Math.max(1, Math.min(3, result.stars || 1)) : 0;
        if (!stars) return;
        if (stars > best(n)) E.levels[n] = stars;
        const before = E.weekBest[n] || 0;
        if (stars > before) { E.weekBest[n] = stars; E.stars += stars - before; out.newStars = stars - before; }
        const bits = [];
        let capped = false;
        const R = D().rewards[weekly().rewards];
        if (!E.wins[n]) {
          E.wins[n] = true;
          const r = pay({ ...R.win, ...(stars === 3 ? R.threeStars : {}) }, 'event');
          if (r.text) bits.push(r.text);
          capped = capped || r.capped;
        }
        out.text = bits.join(', ');
        out.capped = capped;
      });
      if (!out.ok) out.why = 'already';
      g.emit('changed');
      return out;
    }
    // Milestone prizes reached and not yet claimed this week.
    function milestones() {
      const E = s(), R = D().rewards[weekly().rewards];
      return R.milestones.map((m, i) => ({ ...m, i, reached: E.stars >= m.stars, claimed: !!E.milestones[i] }));
    }
    function claimMilestone(i) {
      const E = s();
      const m = milestones()[i];
      if (!m || !m.reached) return { ok: false, why: 'not yet' };
      if (E.milestones[i]) return { ok: false, why: 'already' };
      let r = null;
      g.once(`evm:${E.week}:${i}`, () => { E.milestones[i] = true; r = pay(m.reward, 'event'); });
      if (!r) { E.milestones[i] = true; return { ok: false, why: 'already' }; }
      return { ok: true, ...r };
    }

    g.eventHub = {
      list, weekly, timing, dateKey, weekKey, eventDay,
      state: s,
      setForce(on) { s().force = !!on; g.emit('changed'); },
      setDay(d) { state.settings.eventDay = d; g.emit('changed'); },
      levels, level, isOpen, best, finish, milestones, claimMilestone, pay, boost,
      caps: () => D().caps,
      paid: () => s().paid,
      anyToClaim: () => milestones().some((m) => m.reached && !m.claimed),
    };
  });
})(globalThis.PE = globalThis.PE || {});
