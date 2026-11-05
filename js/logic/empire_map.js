// The Empire map's rules. No drawing here: js/ui/empire_map.js only shows what this says.
//
// Status bubbles are worked out fresh from the game every time they're asked for and are never saved,
// so a bubble can't get stuck: when there's nothing to do, status() says so straight away.
//   ready  "!"    something can be collected right now; tapping the bubble collects it
//   idle   "!"    something is idle and the player can do something about it; tapping goes inside
//   busy   timer  running, with the time until the next thing finishes
//   done   tick   nothing needed: it's running by itself
//   buy    "$"    a locked lot that can be bought right now
//   none          no bubble
// "idle" only appears when the player really can act: a depot route with no free vehicle or no stock
// to send, or a factory line with nothing to make, doesn't nag.
(function (PE) {
  PE.Game.register('map', (g) => {
    const { state, data, B } = g;
    const layouts = data.map.districts;
    const layoutOf = (id) => layouts.find((d) => d.id === id);
    const defs = () => B.districts.rows.filter((d) => layoutOf(d.id));

    function mapState() {
      if (!state.map) state.map = PE.SaveSchema.newMapState();
      return state.map;
    }
    // A district opens at the level of its first facility. A district added later works the same.
    const unlockLevel = (d) => Math.min(...d.facilities.map((f) => g.facilities.row(f).playerLevel));
    const isUnlocked = (id) => !!mapState().unlocked[id];

    function checkUnlocks(silent) {
      const m = mapState();
      for (const d of defs()) {
        if (m.unlocked[d.id] || g.progress.level() < unlockLevel(d)) continue;
        m.unlocked[d.id] = true;
        if (!silent) {
          g.emit('districtUnlocked', { id: d.id, name: d.name });
          g.emit('celebrate', { kind: 'district', text: `New district: ${d.name}!` });
        }
      }
    }
    // A save from before the map already has its districts open, with no banners for old news.
    if (!mapState().introDone) {
      checkUnlocks(true);
      mapState().introDone = true;
    }
    if (!isUnlocked(mapState().district) || !layoutOf(mapState().district)) mapState().district = layouts[0].id;

    // The gift counter belongs to one day (game time, so winding the clock back earns nothing).
    function scheduleGift(G) {
      const T = B.map.gift;
      const roll = PE.Rng.roll(`${state.rng.seed}:giftwait:${G.day}:${G.count}`);
      G.nextMs = g.now() + (T.minMinutes + roll * (T.maxMinutes - T.minMinutes)) * 60000;
    }
    function giftState() {
      const m = mapState();
      const day = Math.floor(g.now() / 86400000);
      if (m.gift.day !== day) {
        m.gift.day = day;
        m.gift.count = 0;
        scheduleGift(m.gift);
      }
      return m.gift;
    }

    // ---- Status ---------------------------------------------------------------------------------------
    function growStatus(fid) {
      const now = g.now();
      let ready = 0, empty = 0, soonest = Infinity, stations = 0, automatic = 0;
      g.grow.eachStation((f, si, st) => {
        if (f !== fid) return;
        stations++;
        if (st.auto.harvest && st.auto.replant) automatic++;
        for (const p of st.pots) {
          if (!p) empty++;
          else if (now >= p.readyMs) ready++;
          else soonest = Math.min(soonest, p.readyMs);
        }
      });
      if (ready) return { kind: 'ready', count: ready, text: ready === 1 ? 'A plant is ready to harvest' : `${ready} plants are ready to harvest` };
      if (empty) return { kind: 'idle', text: empty === 1 ? 'A pot is empty' : `${empty} pots are empty` };
      if (stations && automatic === stations) return { kind: 'done', text: 'Everything here runs by itself' };
      if (soonest < Infinity) return { kind: 'busy', endsMs: soonest, text: 'Growing' };
      return { kind: 'none', text: '' };
    }
    function retailStatus(fid) {
      const shelves = g.business.slots(fid);
      const anyStock = g.stock.getStock(g.stock.CROP) >= 1 || Object.keys(state.collections.productsUnlocked).some((p) => g.stock.getStock(p) >= 1);
      const stuck = shelves.filter((s) => !s.sku || g.stock.getStock(s.sku) < 1).length;
      if (stuck && anyStock) return { kind: 'idle', text: stuck === 1 ? 'A shelf needs stock' : `${stuck} shelves need stock` };
      if (shelves.some((s) => s.sku && g.stock.getStock(s.sku) >= 1)) return { kind: 'done', text: 'Customers are buying' };
      return { kind: 'none', text: 'Waiting for stock from your harvests' };
    }
    function factoryStatus(fid) {
      const now = g.now();
      const lines = g.business.slots(fid);
      const ready = lines.filter((l) => l.job && now >= l.job.endMs && !g.business.lineWaiting(fid, l)).length;
      if (ready) return { kind: 'ready', count: ready, text: ready === 1 ? 'A batch is ready' : `${ready} batches are ready` };
      const canStart = g.business.anyRecipeReady(fid);
      if (canStart && lines.some((l) => !l.job)) return { kind: 'idle', text: 'A line is idle' };
      const busy = lines.filter((l) => l.job && now < l.job.endMs).map((l) => l.job.endMs);
      if (busy.length) return { kind: 'busy', endsMs: Math.min(...busy), text: 'Making products' };
      if (lines.some((l) => l.job)) return { kind: 'none', text: 'Waiting: the store for that product is full' };
      return { kind: 'none', text: 'Waiting for crop stock' };
    }
    function depotStatus(fid) {
      const now = g.now();
      const routes = g.business.slots(fid);
      const ready = routes.filter((r) => r.job && now >= r.job.endMs).length;
      if (ready) return { kind: 'ready', count: ready, text: ready === 1 ? 'A delivery is back' : `${ready} deliveries are back` };
      const busyVehicles = new Set(routes.filter((r) => r.job).map((r) => r.vehicle));
      const freeVehicle = g.data.collectibles.vehicles.some((v) => state.collections.owned[v.id] && !busyVehicles.has(v.id));
      g.business.ensureOffers();
      const canSend = state.depot.offers.some((o) => g.stock.getStock(o.sku) >= 1);
      if (freeVehicle && canSend && routes.some((r) => !r.job)) return { kind: 'idle', text: 'A route is idle' };
      const busy = routes.filter((r) => r.job).map((r) => r.job.endMs);
      if (busy.length) return { kind: 'busy', endsMs: Math.min(...busy), text: 'Out on deliveries' };
      return { kind: 'none', text: 'Waiting for stock to deliver' };
    }
    function researchStatus() {
      const R = g.research;
      const can = R.branches().some((b) => {
        const c = R.cost(b.id) || R.refineCost(b.id);
        return c && g.canAfford('researchTokens', c.tokens) && g.canAfford('cash', c.cash);
      });
      if (can) return { kind: 'idle', text: 'You can afford new research' };
      return { kind: 'none', text: 'Saving up for the next research' };
    }
    function prestigeStatus() {
      const can = defs().some((d) => { const p = g.meta.prestigePreview(d.id); return p && p.unlocked && p.shares >= 1; });
      return can ? { kind: 'idle', text: 'A district can prestige' } : { kind: 'none', text: '' };
    }
    function status(fid) {
      const row = g.facilities.row(fid);
      if (!g.facilities.isOwned(fid)) {
        if (!g.facilities.isAvailable(fid)) return { kind: 'none', locked: true, text: `Opens at level ${row.playerLevel}` };
        return g.canAfford('cash', g.facilities.econ(fid).cost)
          ? { kind: 'buy', locked: true, text: 'For sale, and you can afford it' }
          : { kind: 'none', locked: true, text: 'For sale' };
      }
      switch (row.mode) {
        case 'Grow': return growStatus(fid);
        case 'Retail': return retailStatus(fid);
        case 'Factory': return factoryStatus(fid);
        case 'Logistics': return depotStatus(fid);
        case 'Research': return researchStatus();
        default: return prestigeStatus();
      }
    }

    // Collect from the map, without going inside. Only ever takes what's really ready.
    function collect(fid) {
      if (!g.facilities.isOwned(fid) || status(fid).kind !== 'ready') return { ok: false, why: 'notReady' };
      const row = g.facilities.row(fid);
      const now = g.now();
      let cash = 0, count = 0;
      if (row.mode === 'Grow') {
        g.grow.eachStation((f, si, st) => {
          if (f !== fid) return;
          st.pots.forEach((p, pi) => {
            if (!p || now < p.readyMs) return;
            const r = g.grow.harvest(fid, si, pi);
            if (r) { cash += r.cash; count++; }
          });
        });
      } else if (row.mode === 'Factory') {
        g.business.slots(fid).forEach((l, i) => { if (l.job && now >= l.job.endMs && g.business.claimLine(fid, i).ok) count++; });
      } else if (row.mode === 'Logistics') {
        g.business.slots(fid).forEach((r, i) => {
          if (r.job && now >= r.job.endMs) {
            const res = g.business.claimRoute(fid, i);
            if (res.ok) { cash += res.cash; count++; }
          }
        });
      }
      g.emit('changed');
      return { ok: count > 0, cash, count };
    }

    g.map = {
      layout: layoutOf,
      layouts,
      districts: defs,
      unlockLevel,
      isUnlocked,
      current: () => mapState().district,
      // Returns false for a district that isn't open yet.
      setCurrent(id) {
        if (!layoutOf(id) || !isUnlocked(id)) return false;
        mapState().district = id;
        return true;
      },
      status,
      collect,
      // Which renovation picture a building shows: 0 = locked lot, then 1, 2, 3.
      look(fid) {
        if (!g.facilities.isOwned(fid)) return 0;
        return data.map.lookForRenovation[Math.min(3, g.facilities.get(fid).renovation)];
      },
      // What's waiting in a district, for the "!" on the district switcher.
      needsYou(id) {
        const d = defs().find((x) => x.id === id);
        return !!d && d.facilities.some((f) => ['ready', 'idle', 'buy'].includes(status(f).kind));
      },
      // Where the helpers stand: beside what's new here (a lot you can buy, or your newest place).
      helperSpots(id) {
        const L = layoutOf(id);
        const d = defs().find((x) => x.id === id);
        const forSale = d.facilities.find((f) => !g.facilities.isOwned(f) && g.facilities.isAvailable(f));
        const owned = d.facilities.filter((f) => g.facilities.isOwned(f));
        const focus = forSale || owned[owned.length - 1];
        if (!focus) return L.helperSpots;
        const s = L.spots[focus];
        const inside = (v, hi) => Math.max(90, Math.min(hi - 90, v));
        return [[-210, 74], [215, 86], [-40, 225]].map(([dx, dy]) => ({ x: inside(s.x + dx, L.w), y: inside(s.y + dy, L.h) }));
      },
      markStorySeen(id) { mapState().storySeen[id] = true; },

      // ---- The free gift: a little thing that crosses the map now and then. Capped per day. --------
      giftDue() {
        const G = giftState();
        return G.count < B.map.gift.perDay && g.now() >= G.nextMs;
      },
      giftsLeftToday() { return Math.max(0, B.map.gift.perDay - giftState().count); },
      // It flew past untapped: nothing's lost, another comes soon.
      giftMissed() {
        const G = giftState();
        G.nextMs = g.now() + B.map.gift.missedMinutes * 60000;
      },
      claimGift() {
        if (!g.map.giftDue()) return { ok: false, why: 'notDue' };
        const G = giftState();
        const n = G.count;
        let text = '';
        const ran = g.once(`gift:${G.day}:${n}`, () => {
          const roll = PE.Rng.roll(`${state.rng.seed}:gift:${G.day}:${n}`);
          let sum = 0;
          const prizes = B.map.gift.prizes;
          const prize = prizes.find((p) => { sum += p.chance; return roll < sum; }) || prizes[0];
          text = g.meta.payReward(prize, 'gift');
          G.count = n + 1;
          scheduleGift(G);
          g.emit('changed');
        });
        return { ok: ran, text };
      },
      saveView(id, view) { mapState().view[id] = view; },
      savedView: (id) => mapState().view[id] || null,
      tick() { checkUnlocks(false); },
    };

    const baseTick = g.tick;
    g.tick = function tick() {
      if (baseTick) baseTick();
      checkUnlocks(false);
    };
  });
})(globalThis.PE = globalThis.PE || {});
