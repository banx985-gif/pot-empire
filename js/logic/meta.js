// M5: regional prestige, rivals, daily and weekly tasks, achievements, festivals, VIP orders.
// Nothing here can be lost by missing a day: no streak penalties, expired offers just go away, and
// any festival reward you reached but didn't claim waits in the inbox for seven days.
(function (PE) {
  const { Money } = PE;

  PE.Game.register('meta', (g) => {
    const { state, data, B } = g;
    const T = () => B.meta;
    const m = () => state.meta;
    const dayOf = (ms) => Math.floor(ms / 86400000);
    const count = (key, n) => { m().counters[key] = (m().counters[key] || 0) + n; };

    function metric(key) {
      switch (key) {
        case 'lifetimeCash': return Money.toNumber(state.stats.lifetimeCash);
        case 'level': return state.player.level;
        case 'facilities': return g.facilities.rows.filter((r) => g.facilities.isOwned(r.id)).length;
        case 'strains': return Object.keys(state.unlockedStrains).length;
        case 'items': return Object.keys(state.collections.owned).length;
        case 'masteryTotal': return Object.values(state.mastery).reduce((a, x) => a + x.level, 0);
        case 'prestiges': return state.prestigeHistory.length;
        case 'businessJobs': return (m().counters.deliveries || 0) + (m().counters.batches || 0);
        case 'harvests': return state.stats.harvests;
        default: return m().counters[key] || 0;
      }
    }

    // A reward's cash is expressed in "typical harvests" so it stays useful at any stage.
    function cashFromHarvests(n) { return Math.max(n * 10, Math.round(m().typicalHarvest * n)); }
    function payReward(r, why) {
      const text = [];
      if (r.cashHarvests) { const c = cashFromHarvests(r.cashHarvests); g.earn('cash', c, why); text.push(`$${Money.format(c)}`); }
      if (r.researchTokens) { g.earn('researchTokens', r.researchTokens, why); text.push(`${r.researchTokens} Research Tokens`); }
      if (r.collectionTokens) { g.earn('collectionTokens', r.collectionTokens, why); text.push(`${r.collectionTokens} Collection Tokens`); }
      if (r.festivalTickets) { g.earn('festivalTickets', r.festivalTickets, why); text.push(`${r.festivalTickets} Festival Tickets`); }
      if (r.gems) { g.earn('rainbowGems', r.gems, why); text.push(`${r.gems} Rainbow Gems`); }
      if (r.title) { if (!state.player.titles.includes(r.title)) state.player.titles.push(r.title); text.push(`Title: ${r.title}`); }
      return text.join(', ');
    }

    // ---- Tasks -------------------------------------------------------------------------------------
    function available(tpl) {
      if (tpl.needs && !g.facilities.isOwned(tpl.needs)) return false;
      return true;
    }
    function pickTasks(pool, n, seedText) {
      const open = pool.filter(available);
      const scored = open.map((t) => ({ t, r: PE.Rng.roll(`${state.rng.seed}:${seedText}:${t.id}`) })).sort((a, b) => a.r - b.r);
      return scored.slice(0, n).map(({ t }) => ({ id: t.id, metric: t.metric, target: t.target, text: t.text, start: metric(t.metric), claimed: false }));
    }
    function rollTasks() {
      const day = dayOf(g.now());
      const week = Math.floor(day / 7);
      const tk = m().tasks;
      if (tk.day !== day) { tk.day = day; tk.daily = pickTasks(T().dailyTasks, T().dailyCount, `daily:${day}`); }
      if (tk.week !== week) { tk.week = week; tk.weekly = pickTasks(T().weeklyTasks, T().weeklyCount, `weekly:${week}`); }
    }
    function claimTask(kind, id) {
      rollTasks();
      const tk = m().tasks;
      const list = kind === 'daily' ? tk.daily : tk.weekly;
      const t = list.find((x) => x.id === id);
      if (!t || t.claimed) return { ok: false, why: 'claimed' };
      if (metric(t.metric) - t.start < t.target) return { ok: false, why: 'notDone' };
      const stamp = kind === 'daily' ? tk.day : tk.week;
      let text = '';
      const ran = g.once(`task:${kind}:${stamp}:${id}`, () => {
        t.claimed = true;
        text = payReward(kind === 'daily' ? T().dailyReward : T().weeklyReward, 'task');
        count('tasksClaimed', 1);
        if (kind === 'daily') m().lastTaskDay = tk.day;
        g.emit('changed');
      });
      return { ok: ran, text };
    }

    // ---- Prize wheel: one free spin a day -----------------------------------------------------------------
    function spinWheel() {
      const day = dayOf(g.now());
      if (m().wheelDay === day) return { ok: false, why: 'used' };
      const r = PE.Rng.roll(`${state.rng.seed}:wheel:${day}`);
      const slices = T().wheel;
      const slice = slices[PE.Rng.pick(slices.map((s) => s.chance), r)];
      let text = '';
      const ran = g.once(`wheel:${day}`, () => {
        m().wheelDay = day;
        text = payReward(slice, 'wheel');
        g.emit('changed');
      });
      return { ok: ran, text };
    }

    // ---- Achievements: six groups x six tiers = 36 -------------------------------------------------------
    function achievementList() {
      return T().achievements.flatMap((grp) => grp.tiers.map((target, i) => ({
        id: `${grp.id}-${i + 1}`, group: grp.id, name: grp.name, tier: i + 1, target, metric: grp.metric,
        progress: metric(grp.metric), done: metric(grp.metric) >= target, claimed: !!m().achievements[`${grp.id}-${i + 1}`],
      })));
    }
    function claimAchievement(id) {
      const a = achievementList().find((x) => x.id === id);
      if (!a || a.claimed) return { ok: false, why: 'claimed' };
      if (!a.done) return { ok: false, why: 'notDone' };
      let text = '';
      const ran = g.once(`achievement:${id}`, () => {
        m().achievements[id] = true;
        text = payReward({ researchTokens: T().achievementTokens * a.tier, gems: a.tier >= 4 ? T().achievementGems * (a.tier - 3) : 0 }, 'achievement');
        g.emit('changed');
      });
      return { ok: ran, text };
    }

    // ---- Rivals: 12 static CEOs, one milestone challenge each ----------------------------------------------
    function rivalList() {
      return data.rivals.map((r, i) => {
        const c = T().rivalChallenges[i];
        const progress = metric(c.metric);
        return { id: r.id, name: r.name, text: c.text, target: c.target, progress, done: progress >= c.target, beaten: !!m().rivals[r.id] };
      });
    }
    function beatRival(id) {
      const r = rivalList().find((x) => x.id === id);
      if (!r || r.beaten) return { ok: false, why: 'claimed' };
      if (!r.done) return { ok: false, why: 'notDone' };
      const i = data.rivals.findIndex((x) => x.id === id);
      let text = '';
      const ran = g.once(`rival:${id}`, () => {
        m().rivals[id] = true;
        text = payReward({ cashHarvests: T().rivalCashHarvests * (i + 1), researchTokens: T().rivalTokens * (i + 1), title: `Beat ${r.name}` }, 'rival');
        g.emit('celebrate', { kind: 'rival', text: `You beat ${r.name}!` });
        g.emit('changed');
      });
      return { ok: ran, text };
    }

    // ---- Festivals: one reusable seven-day engine, six themes, 20 tiers ---------------------------------------
    function festivalNow(nowMs) {
      const t = T().festival;
      const week = Math.floor(dayOf(nowMs) / t.lengthDays);
      const on = week % t.everyWeeks === 0;
      const index = Math.floor(week / t.everyWeeks) % t.themes.length;
      const endsMs = (week + 1) * t.lengthDays * 86400000;
      return { id: `F${week}`, week, active: on, theme: t.themes[index], endsMs };
    }
    function tierNeed(tier) { const t = T().festival; return Math.round(t.tierBase * Math.pow(tier, t.tierPower)); }
    function festivalReward(tier) {
      const t = T().festival;
      const bonus = 1 + g.effects.get('festivalReward', {});
      const out = { festivalTickets: Math.round(t.ticketsPerTier * tier * bonus), cashHarvests: Math.round(t.cashHarvestsPerTier * bonus) };
      if (tier % 5 === 0) out.title = `${festivalNow(g.now()).theme} Tier ${tier}`;
      return out;
    }
    function tickFestival(nowMs) {
      const f = festivalNow(nowMs);
      const cur = m().festival;
      if (cur.id === f.id) return;
      // The event ended: anything reached but not claimed goes to the inbox for seven days.
      if (cur.id && cur.points > 0) {
        for (let tier = 1; tier <= T().festival.tiers; tier++) {
          if (cur.points >= tierNeed(tier) && !cur.claimed[tier]) {
            m().inbox.push({ id: `${cur.id}:${tier}`, text: `${cur.theme || 'Festival'} tier ${tier}`, reward: { festivalTickets: Math.round(T().festival.ticketsPerTier * tier), cashHarvests: T().festival.cashHarvestsPerTier }, expiresMs: nowMs + T().inboxDays * 86400000 });
          }
        }
      }
      m().festival = { id: f.id, theme: f.theme, active: f.active, points: 0, claimed: {} };
      g.emit('changed');
    }
    function addFestivalPoints(n, strain) {
      const fest = m().festival;
      if (!fest.active) return;
      const mult = (strain ? strain.festivalMult : 1) * (1 + g.effects.get('festivalPoints', {}));
      fest.points += n * mult;
    }
    function claimFestivalTier(tier) {
      const fest = m().festival;
      if (!fest.active || fest.claimed[tier]) return { ok: false, why: 'claimed' };
      if (tier < 1 || tier > T().festival.tiers || fest.points < tierNeed(tier)) return { ok: false, why: 'notDone' };
      let text = '';
      const ran = g.once(`festival:${fest.id}:${tier}`, () => {
        fest.claimed[tier] = true;
        text = payReward(festivalReward(tier), 'festival');
        g.emit('changed');
      });
      return { ok: ran, text };
    }
    function claimInbox(id) {
      const i = m().inbox.findIndex((x) => x.id === id);
      if (i < 0) return { ok: false };
      const it = m().inbox[i];
      if (g.now() > it.expiresMs) { m().inbox.splice(i, 1); return { ok: false, why: 'expired' }; }
      let text = '';
      const ran = g.once(`inbox:${id}`, () => {
        m().inbox.splice(i, 1);
        text = payReward(it.reward, 'inbox');
        g.emit('changed');
      });
      return { ok: ran, text };
    }

    // ---- Regional prestige -----------------------------------------------------------------------------------
    function shareBonus() {
      return 1 + g.effects.get('prestigeShares', {}) + (g.progress.hasFeature('prestigeBooster') ? T().prestige.boosterBonus : 0)
        + (g.facilities.isOwned('F12') ? T().prestige.hqBonus : 0);
    }
    function prestigePreview(districtId) {
      const d = g.facilities.district(districtId);
      if (!d) return null;
      const P = T().prestige;
      const earned = m().districtEarned[districtId] || 0;
      const before = state.prestigeHistory.filter((h) => h.district === districtId).length;
      const threshold = P.thresholds[districtId] * Math.pow(P.repeatGrowth, before);
      const shares = Math.floor(Math.sqrt(earned / threshold) * shareBonus());
      const resets = [];
      let matureCash = 0, growingCash = 0, matureCount = 0, growingCount = 0;
      const now = g.now();
      for (const fid of d.facilities) {
        if (!g.facilities.isOwned(fid)) continue;
        const row = g.facilities.row(fid);
        if (row.mode === 'Grow') {
          for (let si = 0; si < g.facilities.ownedStationCount(fid); si++) {
            const st = g.grow.stationOf(fid, si);
            resets.push(`${row.name}, station ${si + 1}: model M${st.model} back to M1, parts back to L1 (pots stay at ${st.pots.length})`);
            st.pots.forEach((p) => {
              if (!p) return;
              const v = g.grow.saleValue(fid, si, p.s, p.q);
              const t = g.grow.potProgress(p, now);
              if (t >= 1) { matureCash += v; matureCount++; } else { growingCash += v * t; growingCount++; }
            });
          }
        } else if (row.mode === 'Retail' || row.mode === 'Factory') {
          resets.push(`${row.name}: upgrades back to L1 (slots stay)`);
        }
      }
      return {
        district: d.name, districtId, earned, shares, unlocked: g.progress.level() >= P.unlockLevel, resets,
        matureCount, matureCash: Math.round(matureCash), growingCount, growingCash: Math.round(growingCash),
        kept: ['Owned facilities and all expansions', 'Pot positions and renovations', 'Strains and mastery', 'Managers, relics and collections', 'Research', 'Cosmetics and purchases', 'All other districts', 'Your cash'],
        bonusNow: g.meta.globalMultiplier(), bonusAfter: bonusFor(Money.toNumber(state.currencies.empireShares) + shares),
      };
    }
    const bonusFor = (shares) => Math.min(T().prestige.cap, 1 + shares * T().prestige.bonusPerShare);
    function prestige(districtId) {
      const p = prestigePreview(districtId);
      if (!p) return { ok: false, why: 'bad' };
      if (!p.unlocked) return { ok: false, why: 'level' };
      if (p.shares < 1) return { ok: false, why: 'shares' };
      const d = g.facilities.district(districtId);
      const now = g.now();
      for (const fid of d.facilities) {
        if (!g.facilities.isOwned(fid)) continue;
        const row = g.facilities.row(fid);
        if (row.mode === 'Grow') {
          for (let si = 0; si < g.facilities.ownedStationCount(fid); si++) g.grow.prestigeReset(fid, si, now);
        } else if (row.mode === 'Retail' || row.mode === 'Factory') {
          g.business.slots(fid).forEach((s) => { Object.keys(s.levels).forEach((k) => { s.levels[k] = 1; }); });
        }
      }
      g.earn('empireShares', p.shares, 'prestige');
      m().districtEarned[districtId] = 0;
      state.prestigeHistory.push({ district: districtId, atUtc: g.nowUtc(), shares: p.shares });
      g.effects.invalidate();
      g.emit('celebrate', { kind: 'prestige', text: `${d.name} prestige! +${p.shares} Empire Shares` });
      g.emit('changed');
      return { ok: true, shares: p.shares };
    }

    // ---- VIP orders: optional, timed, never in the way --------------------------------------------------------
    function vipBonusPay() {
      const shops = g.business.ids('Retail');
      const here = shops.length ? Math.max(...shops.map((f) => g.effects.get('vipPayout', { facility: f }))) : g.effects.get('vipPayout', {});
      return 1 + here;
    }
    function makeVipOffer(seed) {
      const V = T().vip;
      const dice = (l) => PE.Rng.roll(`${state.rng.seed}:vip:${seed}:${l}`);
      const person = data.vips[Math.floor(dice('who') * data.vips.length)];
      // A VIP only asks for a product you have some of.
      const owned = Object.keys(state.collections.productsUnlocked).filter((sku) => g.stock.getStock(sku) >= 1);
      const wantsSku = owned.length > 0;
      const skuWeight = V.skuChance + Object.values(state.collections.packagingBySku).reduce((a, id) => {
        const k = g.collections.item(id);
        return a + (k && k.effectKey === 'vipChance' ? k.magnitude : 0);
      }, 0);
      const kindRoll = dice('kind');
      let offer;
      if (wantsSku && kindRoll < skuWeight) {
        const preferred = owned.filter((sku) => { const k = g.collections.item(state.collections.packagingBySku[sku]); return k && k.effectKey === 'vipChance'; });
        const list = preferred.length ? preferred : owned;
        const sku = list[Math.floor(dice('sku') * list.length)];
        offer = { kind: 'sku', sku, text: `Wants a share of your ${g.stock.skuName(sku)}` };
      } else if (kindRoll < skuWeight + (1 - skuWeight) / 2) {
        const best = Math.max(...Object.keys(state.unlockedStrains).map((id) => g.grow.strainStats(id).rarityIndex));
        const rarityIndex = Math.floor(dice('rarity') * (best + 1));
        const units = V.harvestsMin + Math.floor(dice('units') * V.harvestsSpread);
        offer = { kind: 'rarity', rarityIndex, units, done: 0, text: `Wants ${units} ${PE.DataCheck.RARITIES[rarityIndex]} or rarer harvests` };
      } else {
        const grade = 1 + Math.floor(dice('grade') * 2);
        const units = V.harvestsMin + Math.floor(dice('units') * V.harvestsSpread);
        offer = { kind: 'grade', grade, units, done: 0, text: `Wants ${units} ${B.quality.grades[grade].name} or better harvests` };
      }
      const now = g.now();
      return { id: `vip-${seed}`, vipId: person.id, name: person.name, accepted: false, expiresMs: now + V.hours * 3600000, ...offer };
    }
    function ensureVip() {
      if (!g.progress.hasFeature('vip')) return;
      const v = m().vip;
      const now = g.now();
      for (const o of v.offers.filter((x) => now > x.expiresMs)) {
        if (o.accepted && o.reserved) g.stock.addStock(o.sku, o.reserved);   // expired: reserved stock comes back
        v.history.push({ id: o.id, name: o.name, result: 'expired', atUtc: g.nowUtc() });
      }
      v.offers = v.offers.filter((x) => now <= x.expiresMs);
      while (v.offers.length < T().vip.maxOffers) { v.seed += 1; v.offers.push(makeVipOffer(v.seed)); }
      if (v.history.length > 30) v.history.splice(0, v.history.length - 30);
    }
    function vipReward(o) {
      const V = T().vip;
      const base = o.kind === 'sku' ? o.reserved * V.skuMult : m().typicalHarvest * o.units * V.harvestMult * (o.kind === 'grade' ? 1 + o.grade * 0.5 : 1 + o.rarityIndex * 0.3);
      return Math.max(10, Math.round(base * vipBonusPay()));
    }
    function acceptVip(id) {
      ensureVip();
      const o = m().vip.offers.find((x) => x.id === id);
      if (!o || o.accepted) return { ok: false, why: 'bad' };
      if (o.kind === 'sku') {
        const amount = g.stock.getStock(o.sku) * T().vip.skuShare;
        if (amount < 1) return { ok: false, why: 'stock' };
        g.stock.addStock(o.sku, -amount);
        o.reserved = amount;
      }
      o.accepted = true;
      g.emit('changed');
      return { ok: true };
    }
    const vipDone = (o) => o.accepted && (o.kind === 'sku' || o.done >= o.units);
    function claimVip(id) {
      const v = m().vip;
      const o = v.offers.find((x) => x.id === id);
      if (!o || !vipDone(o)) return { ok: false, why: 'notDone' };
      const cash = vipReward(o);
      const ran = g.once(`vip:${id}`, () => {
        v.offers = v.offers.filter((x) => x.id !== id);
        g.earn('cash', cash, 'vip');
        g.earn('collectionTokens', T().vip.tokens, 'vip');
        count('vipDone', 1);
        v.history.push({ id, name: o.name, result: 'paid', cash: String(cash), atUtc: g.nowUtc() });
        ensureVip();
        g.emit('changed');
      });
      return { ok: ran, cash };
    }
    // Cancelling is always safe: reserved stock comes back in full.
    function cancelVip(id) {
      const v = m().vip;
      const o = v.offers.find((x) => x.id === id);
      if (!o) return false;
      if (o.reserved) g.stock.addStock(o.sku, o.reserved);
      v.offers = v.offers.filter((x) => x.id !== id);
      v.history.push({ id, name: o.name, result: 'cancelled', atUtc: g.nowUtc() });
      ensureVip();
      g.emit('changed');
      return true;
    }
    function vipOnHarvest(strain, grade, n) {
      for (const o of m().vip.offers) {
        if (!o.accepted || o.kind === 'sku') continue;
        if (o.kind === 'rarity' && strain.rarityIndex >= o.rarityIndex) o.done = Math.min(o.units, o.done + n);
        if (o.kind === 'grade' && grade >= o.grade) o.done = Math.min(o.units, o.done + n);
      }
    }

    // ---- Public --------------------------------------------------------------------------------------------
    g.meta = {
      count,
      metric,
      globalMultiplier: () => bonusFor(Money.toNumber(state.currencies.empireShares)),
      festivalActive: () => m().festival.active === true,
      dayStreak: () => (m().lastTaskDay === dayOf(g.now()) ? 1 : 0),
      pinnedGoal() {
        rollTasks();
        const t = m().tasks.daily.find((x) => !x.claimed);
        return t ? `Daily: ${t.text} (${Math.min(t.target, Math.round(metric(t.metric) - t.start))}/${t.target})` : null;
      },
      onCashEarned() {},
      onHarvest(strain, grade, offline, fid, cash) {
        const d = g.facilities.districtOf(fid);
        if (d && cash) m().districtEarned[d] = (m().districtEarned[d] || 0) + cash;
        if (cash) m().typicalHarvest = m().typicalHarvest * 0.98 + cash * 0.02;
        if (grade >= 2) count('premiumHarvests', 1);
        addFestivalPoints(1 + strain.rarityIndex, strain);
        vipOnHarvest(strain, grade, 1);
      },
      onOfflineCycles(strain, n, fid, cash) {
        const d = g.facilities.districtOf(fid);
        if (d && cash) m().districtEarned[d] = (m().districtEarned[d] || 0) + cash;
        addFestivalPoints((1 + strain.rarityIndex) * n, strain);
        vipOnHarvest(strain, 0, n);
      },
      onItemGained() {},
      tick(nowMs) {
        const day = dayOf(nowMs);
        tickFestival(nowMs);
        if (m().lastDay !== day) {
          m().lastDay = day;
          rollTasks();
          m().inbox = m().inbox.filter((x) => nowMs <= x.expiresMs);
        }
        if (m().vip.offers.some((o) => nowMs > o.expiresMs) || (g.progress.hasFeature('vip') && !m().vip.offers.length)) ensureVip();
      },

      tasks() { rollTasks(); return m().tasks; },
      taskProgress: (t) => Math.max(0, metric(t.metric) - t.start),
      claimTask,
      spinWheel,
      wheelUsed: () => m().wheelDay === dayOf(g.now()),
      // An extra spin (from an optional ad). label makes each one pay once.
      spinBonus(label) {
        const r = PE.Rng.roll(`${state.rng.seed}:wheel:${label}`);
        const slices = T().wheel;
        const slice = slices[PE.Rng.pick(slices.map((s) => s.chance), r)];
        let text = '';
        g.once(`wheel:${label}`, () => { text = payReward(slice, 'wheel'); g.emit('changed'); });
        return { ok: true, text };
      },
      achievementList,
      claimAchievement,
      achievementCount: () => T().achievements.length * T().achievements[0].tiers.length,
      rivalList,
      beatRival,
      festivalNow: () => festivalNow(g.now()),
      festivalState: () => m().festival,
      tierNeed,
      festivalReward,
      claimFestivalTier,
      inbox: () => m().inbox,
      claimInbox,
      prestigePreview,
      prestige,
      prestigeUnlockLevel: () => T().prestige.unlockLevel,
      vipOffers() { ensureVip(); return m().vip.offers; },
      vipDone,
      vipReward,
      acceptVip,
      claimVip,
      cancelVip,
      vipHistory: () => m().vip.history,
    };
  });
})(globalThis.PE = globalThis.PE || {});
