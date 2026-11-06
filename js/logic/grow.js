// Growing: stations, pots, plants, quality, mastery, hydro upgrades, automation.
(function (PE) {
  const { Money } = PE;
  const RARITIES = ['Common', 'Uncommon', 'Rare', 'Epic', 'Legendary', 'Mythic'];
  const BRANCHES = ['lights', 'sprinkler', 'pots', 'computer', 'capacity'];

  // Chances of each quality grade for a quality score, always inside the table's hard limits.
  function qualityChances(table, score, gradeChance) {
    const s = Math.max(0, Math.min(score, table.maxScore));
    const raw = table.base.map((w, i) => w * Math.exp((i * s) / table.scale));
    const sum = raw.reduce((a, b) => a + b, 0);
    let p = raw.map((w) => w / sum);
    if (gradeChance) p = p.map((v, i) => v + (gradeChance[i] || 0));
    // Clamp to the limits, then share what's left among grades not at a limit, a few passes.
    for (let pass = 0; pass < 8; pass++) {
      p = p.map((v, i) => Math.min(table.max[i], Math.max(table.min[i], v)));
      const left = 1 - p.reduce((a, b) => a + b, 0);
      if (Math.abs(left) < 1e-12) break;
      const free = p.map((v, i) => (left > 0 ? table.max[i] - v : v - table.min[i]));
      const room = free.reduce((a, b) => a + b, 0);
      if (room <= 0) break;
      p = p.map((v, i) => v + (left * free[i]) / room);
    }
    return p;
  }

  PE.Game.register('grow', (g) => {
    const { state, data, B } = g;
    const strainById = new Map(data.strains.map((s, i) => [s.id, { ...s, index: i }]));
    const statsMemo = new Map();

    function strainStats(id) {
      if (statsMemo.has(id)) return statsMemo.get(id);
      const s = strainById.get(id);
      const row = B.strainBaseByRarity[s.rarity];
      const i = s.index % 10;
      const roleId = B.strainRoles.order[s.index % B.strainRoles.order.length];
      const role = B.strainRoles[roleId];
      const out = {
        id, name: s.name, rarity: s.rarity, rarityIndex: RARITIES.indexOf(s.rarity), role: roleId, roleLabel: role.label,
        baseSeconds: row.growSeconds * (1 + row.growStep * i) * (role.growMult || 1),
        baseYield: row.yieldPerPot * (role.yieldMult || 1),
        price: row.salePrice * (1 + row.priceStep * i) * (role.priceMult || 1),
        harvestXp: row.harvestXp,
        masteryXp: row.masteryXp,
        qualityScore: row.qualityScore + (role.qualityScore || 0),
        cropMult: role.cropMult || 1,
        contractCredit: role.contractCredit || 0,
        festivalMult: role.festivalMult || 1,
        unlockLevel: row.unlockLevel + Math.floor(i * row.levelStep),
        unlockCost: id === data.strains[0].id ? 0 : Math.round(row.unlockCost * Math.pow(row.costGrowth, i)),
      };
      statsMemo.set(id, out);
      return out;
    }

    const fac = (fid) => state.facilities[fid];
    const stationOf = (fid, si) => { const f = fac(fid); return f && f.stations[si]; };
    const facRow = (fid) => B.facilityEconomy.rows[fid];

    function contextFor(fid, si, strainId, extra) {
      const st = stationOf(fid, si);
      const planted = st.pots.filter(Boolean);
      const distinct = new Set(planted.map((p) => p.s));
      const stats = strainId ? strainStats(strainId) : null;
      return {
        facility: fid, station: `${fid}:${si}`, mode: 'Grow', district: g.facilities ? g.facilities.districtOf(fid) : undefined,
        baseSeconds: stats ? stats.baseSeconds : undefined,
        rarityIndex: stats ? stats.rarityIndex : undefined,
        stationFull: planted.length === st.pots.length,
        stationMixed: distinct.size >= 2,
        stationSame: planted.length >= 2 && distinct.size === 1,
        firstHarvestToday: state.stats.lastHarvestDay !== Math.floor(g.now() / 86400000),
        recentContract: g.now() < (state.stats.recentContractUntilMs || 0),
        ...extra,
      };
    }

    function masteryLevel(strainId) {
      const m = state.mastery[strainId];
      return m ? m.level : 1;
    }
    function masteryBonus(strainId, key) {
      const lvl = masteryLevel(strainId);
      let sum = 0;
      for (const [at, r] of Object.entries(B.masteryTable.rewards)) if (lvl >= Number(at) && r[key]) sum += r[key];
      return sum;
    }

    function serviceDue(st, fid, si) {
      const interval = B.maintenance.baseIntervalSeconds * B.hydro.sprinklerMaintenanceInterval[st.levels.sprinkler - 1]
        * (1 + g.effects.get('maintenanceInterval', contextFor(fid, si)));
      return g.now() - st.lastServiceMs > interval * 1000;
    }

    // ---- Water ------------------------------------------------------------------------------------
    function waterInterval(st, fid, si) {
      return B.maintenance.baseIntervalSeconds * B.hydro.sprinklerMaintenanceInterval[st.levels.sprinkler - 1]
        * (1 + g.effects.get('maintenanceInterval', contextFor(fid, si)));
    }
    const autoWaters = (st) => st.levels.sprinkler >= B.water.autoFromSprinkler;
    const neverWilts = (st) => autoWaters(st) || (st.auto.harvest && hasStationFeature(st, 'autoHarvest'));
    // How the meter stands: 1 is just watered, 0 is dry.
    function waterMeter(st, fid, si, now = g.now()) {
      return Math.max(0, 1 - (now - st.lastServiceMs) / (waterInterval(st, fid, si) * 1000));
    }
    // How one plant is doing. Nothing's stored: watering puts it right, because it counts from the last watering.
    function plantHealth(st, fid, si, p, now = g.now()) {
      const W = B.water;
      const since = now - Math.max(st.lastServiceMs, p.plantedMs);
      const overDry = since - waterInterval(st, fid, si) * 1000;
      let lost = overDry > 0 ? Math.floor(overDry / (W.dropEverySeconds * 1000)) : 0;
      let wilted = false;
      if (now >= p.readyMs && !neverWilts(st)) {
        const ripeFor = (now - Math.max(p.readyMs, st.lastServiceMs)) / 3600000;
        if (ripeFor >= W.wiltStartHours) {
          wilted = true;
          const share = Math.min(1, (ripeFor - W.wiltStartHours) / (W.wiltFullHours - W.wiltStartHours));
          lost = Math.max(lost, 1 + Math.floor(share * (p.q + W.veryLowValue.length)));
        }
      }
      const past = lost - p.q;
      const worth = past > 0 ? W.veryLowValue[Math.min(past, W.veryLowValue.length) - 1] : 1;
      return { lost, grade: Math.max(0, p.q - lost), valueMult: worth, wilted, veryLow: past > 0 };
    }

    function cycleSeconds(fid, si, strainId) {
      const st = stationOf(fid, si);
      const s = strainStats(strainId);
      const model = B.hydroModels.rows[st.model - 1];
      const ctx = contextFor(fid, si, strainId);
      const speed = g.effects.get('growSpeed', ctx) + masteryBonus(strainId, 'growSpeed')
        + B.hydroModels.computerSpeed[st.levels.computer - 1];
      const recovery = g.effects.get('serviceRecovery', ctx);
      const slow = serviceDue(st, fid, si) ? 1 + (B.maintenance.slowdown - 1) * Math.max(0, 1 - recovery) : 1;
      const t = (s.baseSeconds * model.timeFactor * B.hydro.lightTimeMultiplier[st.levels.lights - 1] * slow) / (1 + speed);
      return Math.max(B.growing.minCycleSeconds, t);
    }

    function qualityScore(fid, si, strainId) {
      const st = stationOf(fid, si);
      const s = strainStats(strainId);
      return B.hydro.potQualityBonus[st.levels.pots - 1] + s.qualityScore + masteryBonus(strainId, 'qualityScore')
        + g.effects.get('qualityScore', contextFor(fid, si, strainId));
    }
    function chancesFor(fid, si, strainId) {
      const ctx = contextFor(fid, si, strainId);
      const extra = [0, g.effects.get('fineChance', ctx), g.effects.get('premiumChance', ctx),
        g.effects.get('topShelfChance', ctx), g.effects.get('exoticChance', ctx)];
      return qualityChances(B.qualityOdds, qualityScore(fid, si, strainId), extra);
    }

    // What a harvest pays. grade may be a fraction-free index; "expected" uses the average of the odds.
    function saleValue(fid, si, strainId, grade) {
      const st = stationOf(fid, si);
      const s = strainStats(strainId);
      const ctx = contextFor(fid, si, strainId, { grade });
      const yieldBonus = g.effects.get('yieldBonus', ctx) + masteryBonus(strainId, 'yieldBonus');
      const units = s.baseYield * (1 + yieldBonus);
      const additive = g.effects.get('saleBonus', ctx) + masteryBonus(strainId, 'saleBonus')
        + g.effects.get('reputation', ctx) * B.businessEconomy.reputationToValue
        + B.hydroModels.potValueBonus[st.levels.pots - 1]
        + (g.facilities ? g.facilities.localValueBonus(fid) : 0);
      const global = B.hydroModels.rows[st.model - 1].valueMult * facRow(fid).valueMult
        * (g.meta ? g.meta.globalMultiplier() : 1);
      const qualityMult = B.quality.grades[grade].valueMultiplier;
      return units * s.price * qualityMult * (1 + additive) * global;
    }
    function expectedSale(fid, si, strainId) {
      const chances = chancesFor(fid, si, strainId);
      return chances.reduce((sum, p, i) => sum + p * saleValue(fid, si, strainId, i), 0);
    }

    function addMastery(strainId, amount) {
      const m = state.mastery[strainId] || (state.mastery[strainId] = { level: 1, xp: 0 });
      const t = B.masteryTable;
      m.xp += amount;
      for (;;) {
        if (m.level >= B.mastery.maxLevel) { m.xp = 0; break; }
        const need = Math.round(t.xpFirstLevel * Math.pow(t.growth, m.level - 1));
        if (m.xp < need) break;
        m.xp -= need;
        m.level += 1;
        const reward = t.rewards[m.level];
        if (reward) {
          if (reward.title) state.player.titles.push(`${strainById.get(strainId).name} Master`);
          g.emit('masteryReward', { strainId, level: m.level, text: reward.text });
        }
        g.emit('masteryLevel', { strainId, level: m.level });
      }
    }

    function isStrainUnlocked(id) { return !!state.unlockedStrains[id]; }

    function plantInto(fid, si, pi, strainId, atMs, automated) {
      const st = stationOf(fid, si);
      let seconds = cycleSeconds(fid, si, strainId);
      if (automated) seconds *= 1 - Math.min(0.5, g.effects.get('replantHeadStart', contextFor(fid, si, strainId)));
      // Quality is decided at planting and stays hidden until the plant is mature, so it can't be
      // re-rolled by closing the game.
      const grade = PE.Rng.pick(chancesFor(fid, si, strainId), g.nextRoll('quality'));
      const floor = g.effects.get('qualityFloor', contextFor(fid, si, strainId));
      // An optional ad reward makes the next seed planted by hand at least Premium (grade 2).
      const boosted = !automated && g.ads && g.ads.takeQualityBoost() ? 2 : 0;
      st.pots[pi] = {
        s: strainId,
        plantedAtUtc: new Date(atMs).toISOString(),
        plantedMs: atMs,
        readyMs: atMs + seconds * 1000,
        q: Math.max(grade, Math.round(floor), boosted),
      };
      st.lastStrains[pi] = strainId;
      return st.pots[pi];
    }

    // Harvest one plant: returns the result but does not touch the pot. Cash, XP etc. go straight in.
    function payHarvest(fid, si, plant, why, valueMult = 1) {
      const st = stationOf(fid, si);
      const s = strainStats(plant.s);
      const ctx = contextFor(fid, si, plant.s, { grade: plant.q });
      let cash = saleValue(fid, si, plant.s, plant.q) * valueMult;
      const extra = g.effects.get('extraHarvestChance', ctx);
      const doubled = extra > 0 && g.nextRoll('extra') < extra;
      if (doubled) cash *= 2;
      const xp = s.harvestXp * B.quality.grades[plant.q].valueMultiplier ** 0.5;
      const masteryGain = s.masteryXp * (1 + g.effects.get('masteryXp', ctx));
      g.earn('cash', cash, why || 'harvest');
      addMastery(plant.s, masteryGain);
      st.harvests += 1;
      state.stats.harvests += 1;
      state.stats.lastHarvestDay = Math.floor(g.now() / 86400000);
      state.stats.bestGrade[plant.s] = Math.max(state.stats.bestGrade[plant.s] ?? 0, plant.q);
      if (g.facilities) g.facilities.addLocalXp(fid, B.facilityEconomy.localXpPerHarvest);
      if (g.stock) g.stock.onHarvest(s, plant.q, cash, ctx);
      if (g.meta) g.meta.onHarvest(s, plant.q, false, fid, cash);
      g.progress.addXp(xp);
      return { cash: Math.round(cash), grade: plant.q, doubled, xp, strainId: plant.s };
    }

    function potProgress(p, now) {
      const total = p.readyMs - p.plantedMs;
      return total <= 0 ? 1 : Math.min(1, Math.max(0, (now - p.plantedMs) / total));
    }
    function stageOf(p, now) {
      const t = potProgress(p, now);
      if (t >= 1) return 5;
      if (t < 0.1) return 0;
      return 1 + Math.min(3, Math.floor(((t - 0.1) / 0.9) * 4));
    }

    const hasStationFeature = (st, feature) => {
      const fromComputer = st.levels.computer >= (B.hydroModels.computerFeatures[feature] ?? Infinity);
      return g.progress.hasFeature(feature) || fromComputer;
    };

    function nextReplantStrain(st, pi) {
      if (st.queue.length && hasStationFeature(st, 'queue')) {
        const id = st.queue[st.queueIndex % st.queue.length];
        st.queueIndex = (st.queueIndex + 1) % st.queue.length;
        return id;
      }
      return st.lastStrains[pi] || null;
    }

    function eachStation(fn) {
      for (const [fid, f] of Object.entries(state.facilities)) {
        if (!f.unlocked || !f.stations) continue;
        for (const si of Object.keys(f.stations)) fn(fid, Number(si), f.stations[si]);
      }
    }

    // ---- Hydro upgrades -----------------------------------------------------------------------
    function branchCost(fid, si, branch) {
      const st = stationOf(fid, si);
      const c = B.hydro.upgradeCost;
      const next = st.levels[branch] + 1;
      const raw = c.base * Math.pow(c.modelGrowth, st.model - 1) * c.branchFactor[branch] * Math.pow(c.levelGrowth, next - 2);
      const scale = g.facilities ? g.facilities.upgradeCostScale(fid) : 1;
      const discount = g.effects.get('upgradeDiscount', contextFor(fid, si, null, { branch }));
      return Math.round(raw * scale * (1 - discount));
    }
    function modelCost(fid, si) {
      const st = stationOf(fid, si);
      const c = B.hydro.mainModelCost;
      const scale = g.facilities ? g.facilities.upgradeCostScale(fid) : 1;
      const discount = g.effects.get('upgradeDiscount', contextFor(fid, si, null));
      return Math.round(c.base * Math.pow(c.growth, st.model - 1) * scale * (1 - discount));
    }
    const modelGateMet = (st) => BRANCHES.filter((b) => st.levels[b] >= B.hydro.mainModelGate.maxLevel).length >= B.hydro.mainModelGate.branchesAtMaxLevel;

    // Exactly what a model upgrade will do. The confirm box shows this and modelUpgrade() does this.
    function modelUpgradePreview(fid, si) {
      const st = stationOf(fid, si);
      if (st.model >= B.hydroModels.rows.length) return null;
      const now = g.now();
      let matureCash = 0, matureCount = 0, growingCash = 0, growingCount = 0;
      st.pots.forEach((p) => {
        if (!p) return;
        const value = saleValue(fid, si, p.s, p.q);
        const t = potProgress(p, now);
        if (t >= 1) { matureCash += value; matureCount++; } else { growingCash += value * t; growingCount++; }
      });
      const next = B.hydroModels.rows[st.model];
      return {
        fromModel: st.model, toModel: next.model, toName: next.name,
        cost: modelCost(fid, si), gateMet: modelGateMet(st),
        matureCount, matureCash: Math.round(matureCash), growingCount, growingCash: Math.round(growingCash),
        resets: BRANCHES.map((b) => ({ branch: b, from: st.levels[b], to: 1 })),
        potsFrom: st.pots.length, potsTo: B.hydro.potSlotsByCapacityLevel[0],
        kept: ['Cash and all currencies', 'Other stations and facilities', 'Strains and mastery', 'Research, managers and collections'],
        benefit: `${next.name}: sale value x${next.valueMult}, grow time x${next.timeFactor}`,
      };
    }

    // A save from before watering existed: nothing is thirsty on its first day with it.
    if (!state.stats.waterFromMs) {
      state.stats.waterFromMs = g.now();
      eachStation((fid, si, st) => { st.lastServiceMs = g.now(); });
    }

    // ---- Public --------------------------------------------------------------------------------
    g.grow = {
      BRANCHES,
      strainStats,
      stationOf,
      eachStation,
      cycleSeconds,
      saleValue,
      expectedSale,
      chancesFor,
      qualityScore,
      masteryLevel,
      masteryBonus,
      addMastery,
      potProgress,
      stageOf,
      serviceDue: (fid, si) => serviceDue(stationOf(fid, si), fid, si),
      hasStationFeature,
      isStrainUnlocked,
      branchCost,
      modelCost,
      modelGateMet,
      modelUpgradePreview,

      unlockStrain(id) {
        const s = strainStats(id);
        if (state.unlockedStrains[id]) return { ok: false, why: 'already' };
        if (g.progress.level() < s.unlockLevel) return { ok: false, why: 'level' };
        if (!g.spend('cash', s.unlockCost, 'strain')) return { ok: false, why: 'cash' };
        state.unlockedStrains[id] = true;
        g.emit('strainUnlocked', { id, rarity: s.rarity });
        g.emit('changed');
        return { ok: true };
      },

      plant(fid, si, pi, strainId) {
        const st = stationOf(fid, si);
        if (!st || pi < 0 || pi >= st.pots.length || st.pots[pi]) return false;
        if (!isStrainUnlocked(strainId)) return false;
        plantInto(fid, si, pi, strainId, g.now());
        g.emit('changed');
        return true;
      },

      // Remove a plant that is still growing. Nothing is paid; the pot is free again.
      uproot(fid, si, pi) {
        const st = stationOf(fid, si);
        const p = st && st.pots[pi];
        if (!p || g.now() >= p.readyMs) return false;
        st.pots[pi] = null;
        g.emit('changed');
        return true;
      },

      harvest(fid, si, pi) {
        const st = stationOf(fid, si);
        const p = st && st.pots[pi];
        if (!p || g.now() < p.readyMs) return null;
        // A plant left dry or wilted pays at the quality it's come down to.
        const health = plantHealth(st, fid, si, p);
        st.pots[pi] = null;
        st.lastServiceMs = g.now();    // a visit from the player also tends the station
        const result = payHarvest(fid, si, { ...p, q: health.grade }, undefined, health.valueMult);
        result.facility = fid; result.station = si; result.pot = pi;
        result.wilted = health.wilted; result.veryLow = health.veryLow; result.lost = health.lost;
        g.emit('harvest', result);
        if (st.auto.replant && hasStationFeature(st, 'autoReplant')) {
          const next = nextReplantStrain(st, pi);
          if (next && isStrainUnlocked(next)) plantInto(fid, si, pi, next, g.now(), true);
        }
        g.emit('changed');
        return result;
      },

      // Harvest every mature plant in one facility (or everywhere). Works once the ladder or a
      // computer level allows it on that station.
      harvestAll(onlyFid) {
        const results = [];
        eachStation((fid, si, st) => {
          if (onlyFid && fid !== onlyFid) return;
          if (!hasStationFeature(st, 'harvestAll')) return;
          st.pots.forEach((p, pi) => {
            if (p && g.now() >= p.readyMs) results.push(g.grow.harvest(fid, si, pi));
          });
        });
        return results;
      },
      readyCount(onlyFid) {
        let n = 0;
        const now = g.now();
        eachStation((fid, si, st) => {
          if (onlyFid && fid !== onlyFid) return;
          for (const p of st.pots) if (p && now >= p.readyMs) n++;
        });
        return n;
      },

      // L04 saved replant preset: fill every empty pot with what it last grew.
      replantAll(onlyFid) {
        let n = 0;
        eachStation((fid, si, st) => {
          if (onlyFid && fid !== onlyFid) return;
          if (!hasStationFeature(st, 'preset')) return;
          st.pots.forEach((p, pi) => {
            if (p) return;
            const id = st.lastStrains[pi];
            if (id && isStrainUnlocked(id)) { plantInto(fid, si, pi, id, g.now()); n++; }
          });
        });
        if (n) g.emit('changed');
        return n;
      },

      // Watering. A thirsty station's plants get a growth boost, and any lost quality comes back.
      service(fid, si) {
        const st = stationOf(fid, si);
        if (!st) return false;
        const now = g.now();
        const thirsty = waterMeter(st, fid, si, now) < B.water.boostBelowMeter;
        if (thirsty) {
          st.pots.forEach((p) => {
            if (!p || now >= p.readyMs) return;
            const off = (p.readyMs - now) * B.water.boostShare;
            p.readyMs -= off;
            p.plantedMs -= off;
          });
        }
        st.lastServiceMs = now;
        g.emit('watered', { facility: fid, station: si, boosted: thirsty });
        g.emit('changed');
        return true;
      },
      waterMeter: (fid, si, now) => waterMeter(stationOf(fid, si), fid, si, now),
      waterSecondsLeft: (fid, si) => Math.max(0, waterInterval(stationOf(fid, si), fid, si) - (g.now() - stationOf(fid, si).lastServiceMs) / 1000),
      plantHealth: (fid, si, p, now) => plantHealth(stationOf(fid, si), fid, si, p, now),
      neverWilts: (fid, si) => neverWilts(stationOf(fid, si)),
      autoWaters: (fid, si) => autoWaters(stationOf(fid, si)),
      // A little face for how a station's doing: 2 happy, 1 okay, 0 sad. Null with nothing growing.
      mood(fid, si, now = g.now()) {
        const st = stationOf(fid, si);
        if (!st.pots.some(Boolean)) return null;
        if (st.pots.some((p) => p && plantHealth(st, fid, si, p, now).lost > 0)) return 0;
        const m = waterMeter(st, fid, si, now);
        return m <= 0 ? 0 : m < B.water.boostBelowMeter ? 1 : 2;
      },
      // Called by the game's tick. Automatic sprinklers top themselves up while you're here.
      tickWater() {
        eachStation((fid, si, st) => { if (autoWaters(st)) st.lastServiceMs = g.now(); });
      },

      setAuto(fid, si, which, on) {
        const st = stationOf(fid, si);
        const feature = which === 'harvest' ? 'autoHarvest' : 'autoReplant';
        if (!st || !hasStationFeature(st, feature)) return false;
        st.auto[which] = !!on;
        g.emit('changed');
        return true;
      },

      setQueue(fid, si, ids) {
        const st = stationOf(fid, si);
        if (!st || !hasStationFeature(st, 'queue')) return false;
        st.queue = ids.filter(isStrainUnlocked).slice(0, B.hydroModels.queueLength);
        st.queueIndex = 0;
        g.emit('changed');
        return true;
      },

      upgradeBranch(fid, si, branch) {
        const st = stationOf(fid, si);
        if (!st || !BRANCHES.includes(branch)) return { ok: false, why: 'bad' };
        if (st.levels[branch] >= B.hydro.mainModelGate.maxLevel) return { ok: false, why: 'max' };
        const cost = branchCost(fid, si, branch);
        if (!g.spend('cash', cost, 'hydro')) return { ok: false, why: 'cash' };
        st.levels[branch] += 1;
        if (branch === 'capacity') {
          while (st.pots.length < B.hydro.potSlotsByCapacityLevel[st.levels.capacity - 1]) st.pots.push(null);
        }
        if (g.facilities) g.facilities.addLocalXp(fid, B.facilityEconomy.localXpPerUpgrade);
        if (g.meta) g.meta.count('hydroUpgrades', 1);
        g.emit('changed');
        return { ok: true };
      },

      // Replace the main model. Resets ONLY this station's five local levels and pot count. Every
      // crop is settled first: mature plants are harvested and sold, growing ones are paid for by
      // how far they had grown. Nothing is ever lost and nothing else changes.
      modelUpgrade(fid, si) {
        const st = stationOf(fid, si);
        if (!st || st.model >= B.hydroModels.rows.length) return { ok: false, why: 'max' };
        if (!modelGateMet(st)) return { ok: false, why: 'gate' };
        const preview = modelUpgradePreview(fid, si);
        if (!g.spend('cash', preview.cost, 'hydro')) return { ok: false, why: 'cash' };
        const now = g.now();
        st.pots.forEach((p, pi) => {
          if (!p) return;
          const t = potProgress(p, now);
          if (t >= 1) payHarvest(fid, si, p, 'modelUpgrade');
          else g.earn('cash', saleValue(fid, si, p.s, p.q) * t, 'modelUpgrade');
          st.pots[pi] = null;
        });
        st.model += 1;
        BRANCHES.forEach((b) => { st.levels[b] = 1; });
        st.pots = Array(B.hydro.potSlotsByCapacityLevel[0]).fill(null);
        if (st.auto.harvest && !hasStationFeature(st, 'autoHarvest')) st.auto.harvest = false;
        if (st.auto.replant && !hasStationFeature(st, 'autoReplant')) st.auto.replant = false;
        if (g.meta) g.meta.count('modelUpgrades', 1);
        g.emit('celebrate', { kind: 'model', text: `${B.hydroModels.rows[st.model - 1].name} installed!` });
        g.emit('changed');
        return { ok: true, preview };
      },

      // Regional prestige: back to the first model and level 1 parts, but pot positions stay
      // (bible section 8). Crops are settled the same way as a model upgrade.
      prestigeReset(fid, si, now) {
        const st = stationOf(fid, si);
        st.pots.forEach((p, pi) => {
          if (!p) return;
          const t = potProgress(p, now);
          if (t >= 1) payHarvest(fid, si, p, 'prestige');
          else g.earn('cash', saleValue(fid, si, p.s, p.q) * t, 'prestige');
          st.pots[pi] = null;
        });
        st.model = 1;
        for (const b of BRANCHES) if (b !== 'capacity') st.levels[b] = 1;
      },

      // Runs on every tick: automation.
      tickAuto() {
        const now = g.now();
        eachStation((fid, si, st) => {
          st.pots.forEach((p, pi) => {
            if (!p) {
              if (st.auto.replant && hasStationFeature(st, 'autoReplant')) {
                const next = nextReplantStrain(st, pi);
                if (next && isStrainUnlocked(next)) { plantInto(fid, si, pi, next, now, true); g.emit('changed'); }
              }
              return;
            }
            if (now < p.readyMs || !st.auto.harvest || !hasStationFeature(st, 'autoHarvest')) return;
            st.pots[pi] = null;
            const result = payHarvest(fid, si, p, 'autoHarvest');
            result.facility = fid; result.station = si; result.pot = pi; result.auto = true;
            g.emit('harvest', result);
            if (st.auto.replant && hasStationFeature(st, 'autoReplant')) {
              const next = nextReplantStrain(st, pi);
              if (next && isStrainUnlocked(next)) plantInto(fid, si, pi, next, now, true);
            }
            g.emit('changed');
          });
        });
      },

      // Used by the offline service to pay a batch of plants without any screen effects.
      internals: { plantInto, nextReplantStrain, contextFor, payHarvest },
    };

    // Mastery bonuses are per-strain and read directly; nothing to add to the effects list here.
  });

  PE.GrowRules = { qualityChances, BRANCHES };
})(globalThis.PE = globalThis.PE || {});
