// The connected economy: grow -> stock -> shops / factory -> deliveries -> cash -> upgrades.
//
// Stock is measured in dollars of wholesale value, not units. That keeps the same rules working from
// a garage to a mega farm: a harvest adds a share of its sale value as crop stock (on top of the
// automatic sale, never instead of it, so stock can never block anything).
//   Factory: turns crop stock into product stock worth more, after a timer.
//   Retail:  shelves sell a share of their stock each minute, at a markup, faster with demand.
//   Delivery: moves a share of stock for a contract, pays a bigger markup after a timer.
(function (PE) {
  const CROP = 'CROP';

  PE.Game.register('business', (g) => {
    const { state, data, B } = g;
    const E = () => B.businessEconomy;
    const products = new Map(data.collectibles.products.map((p) => [p.id, p]));
    const vehicles = new Map(data.collectibles.vehicles.map((v) => [v.id, v]));
    const packaging = new Map(data.collectibles.packaging.map((k) => [k.id, k]));
    const stock = () => state.stock;
    const getStock = (sku) => (sku === CROP ? stock().crop : stock().products[sku] || 0);
    const addStock = (sku, v) => {
      if (sku === CROP) stock().crop = Math.max(0, stock().crop + v);
      else stock().products[sku] = Math.max(0, (stock().products[sku] || 0) + v);
    };
    const familyOf = (sku) => (sku === CROP ? 'Crop' : products.get(sku).family);
    const skuTierOf = (sku) => (sku === CROP ? 0 : products.get(sku).skuTier);
    const skuName = (sku) => (sku === CROP ? 'House Bags' : products.get(sku).name);
    const ownsAnyBusiness = () => ['F04', 'F05', 'F08', 'F09'].some((f) => g.facilities.isOwned(f));

    // ---- Stock from harvests ----------------------------------------------------------------------
    g.stock = {
      CROP, getStock, addStock, skuName, familyOf,
      onHarvest(strain, grade, cash, ctx) {
        if (!ownsAnyBusiness()) {
          if (strain.contractCredit) stock().contractCredit = Math.min(E().contractCreditCap, stock().contractCredit + strain.contractCredit * E().creditPerHarvest);
          return;
        }
        addStock(CROP, cash * E().cropShare * strain.cropMult);
        if (strain.contractCredit) {
          const extra = ctx ? g.effects.get('contractCredit', ctx) : 0;
          stock().contractCredit = Math.min(E().contractCreditCap, stock().contractCredit + strain.contractCredit * E().creditPerHarvest * (1 + extra));
        }
      },
      onOfflineCycles(strain, cashTotal) {
        if (ownsAnyBusiness()) addStock(CROP, cashTotal * E().cropShare * strain.cropMult);
      },
    };

    function slots(fid) { return g.facilities.get(fid).slots; }
    function upgradeCost(fid, what, lvl) {
      const e = E();
      return Math.round(g.facilities.econ(fid).stationCostBase * e.upgradeFactor[what] * Math.pow(e.upgradeGrowth, lvl - 1));
    }

    // ---- Retail ------------------------------------------------------------------------------------
    function demandWave(family, now) {
      const windowId = Math.floor(now / (E().demandWindowHours * 3600000));
      return E().demandMin + PE.Rng.roll(`demand:${family}:${windowId}`) * (E().demandMax - E().demandMin);
    }
    function retailCtx(fid, shelf) {
      const f = g.facilities.get(fid);
      const skus = new Set(f.slots.map((s) => s.sku).filter(Boolean));
      const family = shelf && shelf.sku ? familyOf(shelf.sku) : undefined;
      return {
        facility: fid, mode: 'Retail', district: g.facilities.districtOf(fid), family,
        skuTier: shelf && shelf.sku ? skuTierOf(shelf.sku) : undefined,
        lowStock: shelf && shelf.sku ? getStock(shelf.sku) < E().lowStockValue * g.facilities.econ(fid).stationCostBase : false,
        mixedShelves: skus.size >= 2,
        dailyStreak: g.meta ? g.meta.dayStreak() : 0,
      };
    }
    const packFor = (sku) => { const id = state.collections.packagingBySku && state.collections.packagingBySku[sku]; return id ? packaging.get(id) : null; };
    function packBonus(sku, key) { const k = sku ? packFor(sku) : null; return k && k.effectKey === key ? k.magnitude : 0; }

    function shelfRatePerMinute(fid, shelf, now) {
      if (!shelf.sku) return 0;
      const ctx = retailCtx(fid, shelf);
      const rep = g.effects.get('reputation', ctx);
      const demand = demandWave(familyOf(shelf.sku), now) * (1 + rep * E().reputationToDemand)
        * (1 + g.effects.get('retailDemand', ctx) + g.effects.get('familyDemand', ctx) + packBonus(shelf.sku, 'retailDemand'));
      return E().shelfDrainPerMinute * (1 + (shelf.levels.speed - 1) * E().speedPerLevel) * demand;
    }
    function shelfMarkup(fid, shelf) {
      const ctx = retailCtx(fid, shelf);
      const research = g.effects.get('retailPrice', ctx) + packBonus(shelf.sku, 'retailPrice');
      return E().retailMarkup * g.facilities.econ(fid).valueMult
        * (1 + (shelf.levels.value - 1) * E().valuePerLevel) * (1 + research);
    }
    function runShelf(fid, shelf, seconds, now, scale) {
      if (!shelf.sku) return 0;
      const have = getStock(shelf.sku);
      if (have <= 0) return 0;
      const rate = shelfRatePerMinute(fid, shelf, now) * scale;
      const share = 1 - Math.exp(-rate * (seconds / 60));
      const sold = have * share;
      addStock(shelf.sku, -sold);
      const cash = sold * shelfMarkup(fid, shelf);
      return cash;
    }

    // ---- Factory -----------------------------------------------------------------------------------
    function factoryCtx(fid, line, sku) {
      const f = g.facilities.get(fid);
      const active = f.slots.filter((l) => l.job).length;
      const family = sku ? familyOf(sku) : undefined;
      return { facility: fid, mode: 'Factory', district: g.facilities.districtOf(fid), family, activeLines: active };
    }
    function batchSeconds(fid, line, sku) {
      const p = products.get(sku);
      const speed = g.effects.get('factorySpeed', factoryCtx(fid, line, sku)) + (g.progress.hasFeature('factoryBoost') ? E().factoryBoostSpeed : 0)
        + (line.levels.speed - 1) * E().speedPerLevel;
      return p.batchSeconds / (1 + speed);
    }
    function batchInput(line) {
      return stock().crop * Math.min(1, E().batchShare + (line.levels.batch - 1) * E().batchSharePerLevel);
    }
    function batchOutputMult(fid, line, sku) {
      const p = products.get(sku);
      const ctx = factoryCtx(fid, line, sku);
      return p.magnitude * (1 + (line.levels.value - 1) * E().valuePerLevel)
        * (1 + g.effects.get('productValue', ctx) + g.effects.get('familyDemand', ctx) + g.effects.get('reputation', ctx) * E().reputationToValue);
    }
    function startLine(fid, i, sku) {
      const line = slots(fid)[i];
      if (!line || line.job) return { ok: false, why: 'busy' };
      if (!state.collections.productsUnlocked[sku]) return { ok: false, why: 'locked' };
      const input = batchInput(line);
      if (input < 1) return { ok: false, why: 'crop' };
      addStock(CROP, -input);
      const seconds = batchSeconds(fid, line, sku);
      const now = g.now();
      line.sku = sku;
      line.job = { input, output: input * batchOutputMult(fid, line, sku), startMs: now, endMs: now + seconds * 1000 };
      g.emit('changed');
      return { ok: true };
    }
    function claimLine(fid, i) {
      const line = slots(fid)[i];
      if (!line || !line.job || g.now() < line.job.endMs) return { ok: false, why: 'notReady' };
      const job = line.job;
      line.job = null;
      addStock(line.sku, job.output);
      g.facilities.addLocalXp(fid, 1);
      if (g.meta) g.meta.count('batches', 1);
      g.emit('changed');
      return { ok: true, output: job.output };
    }

    // ---- Delivery ------------------------------------------------------------------------------------
    const VEHICLE_EFFECT = { vehicleSpeed: 'speed', vehicleCapacity: 'capacity', vehicleReward: 'reward', vehicleReliability: 'reliability' };
    function vehicleStats(id) {
      const v = vehicles.get(id);
      const out = { speed: v.baseSpeed, capacity: v.baseCapacity, reward: v.baseReward, reliability: 0 };
      const k = VEHICLE_EFFECT[v.effectKey];
      if (k === 'speed') out.speed *= 1 + v.magnitude;
      if (k === 'capacity') out.capacity *= 1 + v.magnitude;
      if (k === 'reward') out.reward *= 1 + v.magnitude;
      if (k === 'reliability') out.reliability = v.magnitude;
      return out;
    }
    function deliveryCtx(fid, seconds, vehicleId) {
      const v = vehicleId ? vehicles.get(vehicleId) : null;
      const f = g.facilities.get(fid);
      const kinds = new Set(f.slots.map((r) => r.vehicle).filter(Boolean).map((id) => vehicles.get(id).kind));
      return {
        facility: fid, mode: 'Logistics', district: g.facilities.districtOf(fid), routeSeconds: seconds,
        vehicleTier: v ? v.tier : undefined, fleetKinds: kinds.size, festivalActive: g.meta ? g.meta.festivalActive() : false,
      };
    }
    function makeOffer(seed, nowDay) {
      const dice = (label) => PE.Rng.roll(`${state.rng.seed}:offer:${seed}:${nowDay}:${label}`);
      const t = E().contractTypes;
      const adv = g.progress.hasFeature('advancedContracts');
      const pool = adv ? t : t.filter((x) => !x.advanced);
      const type = pool[Math.floor(dice('type') * pool.length)];
      const unlocked = Object.keys(state.collections.productsUnlocked);
      // A contract is only useful for stock you actually have. Crop is the fallback.
      const stocked = [CROP, ...unlocked].filter((s) => getStock(s) >= 1);
      const options = stocked.length ? stocked : [CROP];
      const sku = options[Math.floor(dice('sku') * options.length)];
      return { id: `${nowDay}-${seed}`, type: type.id, name: type.name, sku, seconds: type.seconds, mult: type.mult };
    }
    function ensureOffers() {
      const d = state.depot;
      const day = Math.floor(g.now() / 86400000);
      if (d.day !== day) { d.day = day; d.rerolls = 0; d.offers = []; }
      while (d.offers.length < E().offerCount) { d.seed += 1; d.offers.push(makeOffer(d.seed, day)); }
    }
    function quote(fid, offer, vehicleId) {
      const vs = vehicleStats(vehicleId);
      const seconds = offer.seconds / (vs.speed * (1 + g.effects.get('deliverySpeed', deliveryCtx(fid, offer.seconds, vehicleId))));
      const ctx = deliveryCtx(fid, offer.seconds, vehicleId);
      const share = Math.min(0.9, E().contractShare * (vs.capacity / 0.2) * (1 + g.effects.get('deliveryCapacity', ctx)));
      const amount = getStock(offer.sku) * share;
      const payout = 1 + g.effects.get('deliveryPayout', ctx) + packBonus(offer.sku, 'deliveryPayout') + g.effects.get('reputation', ctx) * E().reputationToValue;
      const creditBoost = 1 + stock().contractCredit * E().creditToPayout;
      const reward = amount * offer.mult * vs.reward * payout * creditBoost * g.facilities.econ(fid).valueMult;
      return { seconds, amount, reward };
    }

    function dispatch(fid, routeIndex, offerId, vehicleId) {
      const route = slots(fid)[routeIndex];
      if (!route || route.job) return { ok: false, why: 'busy' };
      const offer = state.depot.offers.find((o) => o.id === offerId);
      if (!offer) return { ok: false, why: 'offer' };
      const owned = state.collections.owned[vehicleId];
      if (!owned || !vehicles.has(vehicleId)) return { ok: false, why: 'vehicle' };
      if (slots(fid).some((r, i) => i !== routeIndex && r.vehicle === vehicleId && r.job)) return { ok: false, why: 'vehicleBusy' };
      const q = quote(fid, offer, vehicleId);
      if (q.amount < 1) return { ok: false, why: 'stock' };
      addStock(offer.sku, -q.amount);
      const now = g.now();
      route.vehicle = vehicleId;
      route.job = { offer, amount: q.amount, reward: q.reward, startMs: now, endMs: now + q.seconds * 1000, txId: `deliver:${fid}:${routeIndex}:${now}` };
      stock().contractCredit = 0;
      state.depot.offers = state.depot.offers.filter((o) => o.id !== offerId);
      ensureOffers();
      g.emit('changed');
      return { ok: true };
    }
    // Cancelling is always safe: the stock comes back in full.
    function cancelRoute(fid, i) {
      const route = slots(fid)[i];
      if (!route || !route.job || g.now() >= route.job.endMs) return false;
      addStock(route.job.offer.sku, route.job.amount);
      route.job = null;
      g.emit('changed');
      return true;
    }
    function claimRoute(fid, i) {
      const route = slots(fid)[i];
      if (!route || !route.job || g.now() < route.job.endMs) return { ok: false, why: 'notReady' };
      const job = route.job;
      route.job = null;
      let cash = job.reward;
      const reliable = vehicleStats(route.vehicle).reliability;
      if (reliable > 0 && PE.Rng.roll(job.txId) < reliable) cash *= 1 + E().reliableBonus;
      const paid = g.once(job.txId, () => {
        g.earn('cash', cash, 'delivery');
        g.facilities.addLocalXp(fid, 2);
        state.stats.deliveries += 1;
        state.stats.recentContractUntilMs = g.now() + E().recentContractSeconds * 1000;
        if (g.meta) g.meta.count('deliveries', 1);
      });
      g.emit('changed');
      return { ok: paid, cash };
    }

    // ---- New slots when a business is bought -------------------------------------------------------------
    function newSlot(mode) {
      if (mode === 'Retail') return { sku: null, levels: { speed: 1, capacity: 1, value: 1 } };
      if (mode === 'Factory') return { sku: null, job: null, levels: { speed: 1, batch: 1, value: 1 } };
      return { vehicle: null, job: null, auto: false };
    }

    // ---- Automation from research --------------------------------------------------------------------------
    function runAutomation() {
      if (g.research.hasFlag('factoryAuto')) {
        for (const fid of g.business.ids('Factory')) {
          slots(fid).forEach((line, i) => {
            if (line.job && g.now() >= line.job.endMs) { const sku = line.sku; claimLine(fid, i); startLine(fid, i, sku); }
            else if (!line.job && line.sku) startLine(fid, i, line.sku);
          });
        }
      }
      if (g.research.hasFlag('deliveryAuto')) {
        for (const fid of g.business.ids('Logistics')) {
          ensureOffers();
          slots(fid).forEach((route, i) => {
            if (route.job && g.now() >= route.job.endMs) claimRoute(fid, i);
            if (!route.job && route.auto && route.vehicle) {
              const offer = state.depot.offers.slice().sort((a, b) => getStock(b.sku) - getStock(a.sku))[0];
              if (offer) dispatch(fid, i, offer.id, route.vehicle);
            }
          });
        }
      }
    }

    g.business = {
      CROP,
      ids: (mode) => g.facilities.rows.filter((r) => r.mode === mode && g.facilities.isOwned(r.id)).map((r) => r.id),
      slots,
      onFacilityBought(fid) {
        const row = g.facilities.row(fid);
        const f = g.facilities.get(fid);
        if (row.mode === 'Grow') return;
        f.slots = [];
        for (let i = 0; i < g.facilities.econ(fid).startStations; i++) f.slots.push(newSlot(row.mode));
        if (row.mode === 'Logistics') {
          if (!state.collections.owned.V01) g.collections.grant('V01', `depot:${fid}`);
          ensureOffers();
        }
        if (row.mode === 'Factory' && !Object.keys(state.collections.productsUnlocked).length) state.collections.productsUnlocked.P01 = true;
      },
      addSlot(fid) {
        const row = g.facilities.row(fid);
        slots(fid).push(newSlot(row.mode));
      },

      // Retail
      setShelf(fid, i, sku) {
        const s = slots(fid)[i];
        if (!s) return false;
        if (sku !== CROP && !state.collections.productsUnlocked[sku]) return false;
        s.sku = sku;
        g.emit('changed');
        return true;
      },
      shelfRatePerMinute: (fid, shelf) => shelfRatePerMinute(fid, shelf, g.now()),
      shelfMarkup,
      demandWave: (family) => demandWave(family, g.now()),
      upgradeSlot(fid, i, what) {
        const s = slots(fid)[i];
        if (!s || !s.levels || s.levels[what] === undefined) return { ok: false, why: 'bad' };
        if (s.levels[what] >= E().maxUpgradeLevel) return { ok: false, why: 'max' };
        const cost = upgradeCost(fid, what, s.levels[what]);
        if (!g.spend('cash', cost, 'business')) return { ok: false, why: 'cash' };
        s.levels[what] += 1;
        g.facilities.addLocalXp(fid, B.facilityEconomy.localXpPerUpgrade);
        g.emit('changed');
        return { ok: true };
      },
      upgradeCost,

      // Factory
      startLine, claimLine, batchSeconds, batchInput, batchOutputMult,
      productCost: (id) => Math.round(E().productCostBase * Math.pow(E().productCostGrowth, data.collectibles.products.findIndex((p) => p.id === id))),
      unlockProduct(id) {
        const p = products.get(id);
        if (!p || state.collections.productsUnlocked[id]) return { ok: false, why: 'already' };
        if (g.progress.level() < p.levelGate) return { ok: false, why: 'level' };
        if (!g.spend('cash', g.business.productCost(id), 'product')) return { ok: false, why: 'cash' };
        state.collections.productsUnlocked[id] = true;
        g.emit('changed');
        return { ok: true };
      },

      // Delivery
      ensureOffers, quote, dispatch, cancelRoute, claimRoute, vehicleStats,
      setRouteAuto(fid, i, on) { const r = slots(fid)[i]; if (r) r.auto = !!on; g.emit('changed'); },
      setRouteVehicle(fid, i, v) { const r = slots(fid)[i]; if (r && !r.job && state.collections.owned[v]) r.vehicle = v; g.emit('changed'); },
      reroll() {
        const d = state.depot;
        ensureOffers();
        const limit = E().rerollsPerDay + Math.max(0, ...g.business.ids('Retail').map((f) => g.effects.get('vipRefresh', { facility: f })));
        if (d.rerolls >= limit) return false;
        d.rerolls += 1;
        d.offers = [];
        ensureOffers();
        g.emit('changed');
        return true;
      },

      // Runs every tick with the seconds since the last one.
      tick(now, gapSeconds) {
        if (gapSeconds <= 0) return;
        for (const fid of g.business.ids('Retail')) {
          for (const shelf of slots(fid)) {
            const cash = runShelf(fid, shelf, gapSeconds, now, 1);
            if (cash > 0) {
              shelf.pendingCash = (shelf.pendingCash || 0) + cash;
              // Bank whole dollars so tiny sales aren't lost to rounding.
              if (shelf.pendingCash >= 1) {
                const whole = Math.floor(shelf.pendingCash);
                shelf.pendingCash -= whole;
                g.earn('cash', whole, 'retail');
                g.facilities.addLocalXp(fid, gapSeconds / 60);
              }
            }
          }
        }
        runAutomation();
      },

      // While the game was closed. Time is capped by the offline rules; shops run at a share of
      // full speed depending on their capacity level.
      settleOffline(from, now, creditedSeconds, report) {
        let retail = 0;
        for (const fid of g.business.ids('Retail')) {
          for (const shelf of slots(fid)) {
            const scale = E().offlineRetailScale + (shelf.levels.capacity - 1) * E().capacityOfflinePerLevel;
            retail += runShelf(fid, shelf, creditedSeconds, now, scale);
            if (shelf.sku) g.facilities.addLocalXp(fid, creditedSeconds / 600);
          }
        }
        let batches = 0;
        for (const fid of g.business.ids('Factory')) {
          slots(fid).forEach((line, i) => {
            if (line.job && now >= line.job.endMs && g.research.hasFlag('factoryAuto')) {
              const boost = 1 + g.effects.get('factoryOffline', factoryCtx(fid, line, line.sku));
              line.job.output *= boost;
              const sku = line.sku;
              claimLine(fid, i);
              startLine(fid, i, sku);
              batches++;
            }
          });
        }
        let delivered = 0;
        for (const fid of g.business.ids('Logistics')) {
          if (!g.research.hasFlag('deliveryAuto')) continue;
          slots(fid).forEach((route, i) => {
            if (route.job && now >= route.job.endMs) {
              const r = claimRoute(fid, i);
              if (r.ok) delivered += r.cash;
            }
          });
        }
        if (retail > 0) {
          report.cash += retail;
          report.extras.push(`Shops sold $${PE.Money.format(retail)}`);
        }
        if (batches) report.extras.push(`${batches} factory batches finished`);
        if (delivered) report.extras.push(`Deliveries paid $${PE.Money.format(delivered)}`);
      },
    };
  });

  // ---- Research: six branches x six ranks = 36 permanent nodes ---------------------------------------
  PE.Game.register('research', (g) => {
    const { state, B } = g;
    const T = () => B.research;
    const rankOf = (branch) => state.research[branch] || 0;
    const branchRow = (id) => T().branches.find((b) => b.id === id);

    g.research = {
      rankOf,
      branches: () => T().branches,
      nodeCount: () => T().branches.length * T().ranks,
      cost(branch) {
        const r = rankOf(branch);
        if (r >= T().ranks) return null;
        const discount = Math.min(T().maxDiscount, g.effects.get('researchDiscount', { branch }) + (g.progress.hasFeature('researchBooster') ? T().boosterDiscount : 0));
        return {
          tokens: Math.max(1, Math.round(T().tokenBase * Math.pow(T().tokenGrowth, r) * (1 - discount))),
          cash: Math.round(T().cashBase * Math.pow(T().cashGrowth, r) * (1 - discount)),
        };
      },
      buy(branch) {
        if (!g.facilities.isOwned('F06')) return { ok: false, why: 'lab' };
        const c = g.research.cost(branch);
        if (!c) return { ok: false, why: 'max' };
        if (!g.canAfford('researchTokens', c.tokens)) return { ok: false, why: 'tokens' };
        if (!g.canAfford('cash', c.cash)) return { ok: false, why: 'cash' };
        g.spend('researchTokens', c.tokens, 'research');
        g.spend('cash', c.cash, 'research');
        state.research[branch] = rankOf(branch) + 1;
        g.effects.invalidate();
        if (g.meta) g.meta.count('research', 1);
        g.emit('changed');
        return { ok: true };
      },
      hasFlag(flag) {
        return T().branches.some((b) => b.flags && b.flags[flag] !== undefined && rankOf(b.id) >= b.flags[flag]);
      },
      hasOfflineCapUpgrade: () => g.research.hasFlag('offlineCap'),
    };

    g.effects.addProvider(() => T().branches.filter((b) => rankOf(b.id) > 0).map((b) => ({
      key: b.effectKey, value: b.perRank * rankOf(b.id), group: `research:${b.id}`,
    })));
  });
})(globalThis.PE = globalThis.PE || {});
