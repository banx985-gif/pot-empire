// Facilities: owning them, adding station slots at local milestones, renovations, districts.
// Ownership and visual expansion are permanent: nothing here is ever taken away.
(function (PE) {
  PE.Game.register('facilities', (g) => {
    const { state, B } = g;
    const rows = B.facilities.rows;
    const byId = new Map(rows.map((r) => [r.id, r]));
    const econ = (fid) => B.facilityEconomy.rows[fid];
    const districts = B.districts.rows;

    function get(fid) { return state.facilities[fid]; }
    const isOwned = (fid) => !!(get(fid) && get(fid).unlocked);

    function ownedStationCount(fid) {
      const f = get(fid);
      if (!f) return 0;
      if (byId.get(fid).mode !== 'Grow') return (f.slots || []).length;
      return Object.keys(f.stations || {}).length;
    }
    function localProgress(fid) {
      const f = get(fid);
      if (!f) return 0;
      return Math.min(1, f.localXp / econ(fid).localTarget);
    }
    // Slots beyond the starting ones unlock at evenly spaced local progress marks.
    function nextStationMark(fid) {
      const row = byId.get(fid), e = econ(fid);
      const extra = row.stations - e.startStations;
      const have = ownedStationCount(fid) - e.startStations;
      if (have >= extra) return null;
      return (have + 1) / (extra + 1);
    }
    function nextStationCost(fid) {
      const e = econ(fid);
      const have = Math.max(0, ownedStationCount(fid) - e.startStations);
      return Math.round(e.stationCostBase * Math.pow(B.facilityEconomy.stationCostGrowth, have));
    }
    function addStationsTo(fid, n) {
      const f = get(fid);
      if (!f.stations) f.stations = {};
      for (let i = 0; i < n; i++) {
        const si = Object.keys(f.stations).length;
        f.stations[si] = PE.SaveSchema.newStation(g.now());
      }
    }

    g.facilities = {
      rows,
      row: (fid) => byId.get(fid),
      econ,
      isOwned,
      get,
      localProgress,
      ownedStationCount,
      // Each building's inside comes in 3 sizes. Renovating knocks through into the next one, and more spots open.
      // How many spots the room has at that size: its picture's spots (data/room_spots.js).
      roomSpots(fid, size) {
        const total = byId.get(fid).stations;
        const room = PE.Data.roomSpots && PE.Data.roomSpots[`${fid}-${size}`];
        if (room) return Math.min(total, room.spots.length);
        const start = Math.min(total, econ(fid).startStations);
        return size >= 3 ? total : Math.floor(start + ((total - start) * size) / 3);
      },
      roomSize(fid) {
        const f = get(fid);
        let size = f ? PE.Data.map.roomForRenovation[Math.min(3, f.renovation)] : 1;
        // Never less than what you own, or a slot you can buy right now: the room has space for it.
        const need = ownedStationCount(fid) + (g.facilities.canBuyStation(fid) ? 1 : 0);
        while (size < 3 && g.facilities.roomSpots(fid, size) < Math.min(need, byId.get(fid).stations)) size++;
        return size;
      },
      nextStationMark,
      nextStationCost,
      districtOf: (fid) => { const d = districts.find((x) => x.facilities.includes(fid)); return d ? d.id : undefined; },
      district: (id) => districts.find((d) => d.id === id),
      districts,

      // Is this facility open to buy at the player's level?
      isAvailable: (fid) => g.progress.level() >= byId.get(fid).playerLevel,

      buy(fid) {
        const row = byId.get(fid);
        if (!row || isOwned(fid)) return { ok: false, why: 'already' };
        if (g.progress.level() < row.playerLevel) return { ok: false, why: 'level' };
        if (!g.spend('cash', econ(fid).cost, 'facility')) return { ok: false, why: 'cash' };
        state.facilities[fid] = { unlocked: true, renovation: 0, localXp: 0, stations: {} };
        if (row.mode === 'Grow') addStationsTo(fid, econ(fid).startStations);
        if (g.business) g.business.onFacilityBought(fid);
        g.effects.invalidate();
        g.emit('facilityBought', { fid });
        g.emit('celebrate', { kind: 'facility', text: `${row.name} is yours!` });
        g.emit('changed');
        return { ok: true };
      },

      canBuyStation(fid) {
        const mark = nextStationMark(fid);
        return mark !== null && localProgress(fid) >= mark;
      },
      buyStation(fid) {
        const mark = nextStationMark(fid);
        if (mark === null) return { ok: false, why: 'max' };
        if (localProgress(fid) < mark) return { ok: false, why: 'progress' };
        if (!g.spend('cash', nextStationCost(fid), 'station')) return { ok: false, why: 'cash' };
        if (byId.get(fid).mode === 'Grow') addStationsTo(fid, 1);
        else g.business.addSlot(fid);
        g.emit('celebrate', { kind: 'station', text: 'New station!' });
        g.emit('changed');
        return { ok: true };
      },

      addLocalXp(fid, amount) {
        const f = get(fid);
        if (f) f.localXp += amount;
      },

      // ---- Renovations R1, R2, R3 at 25 / 60 / 100 % local progress ----------------------------
      renovationInfo(fid) {
        const f = get(fid);
        const r = f.renovation;
        if (r >= 3) return null;
        return {
          index: r,
          at: B.facilities.renovationAtLocalProgress[r],
          ready: localProgress(fid) >= B.facilities.renovationAtLocalProgress[r],
          cost: Math.round(Math.max(econ(fid).stationCostBase, 200) * B.facilityEconomy.renovationCostMult[r]),
          bonus: B.facilityEconomy.renovationValueBonus[r],
        };
      },
      renovate(fid) {
        const info = g.facilities.renovationInfo(fid);
        if (!info) return { ok: false, why: 'max' };
        if (!info.ready) return { ok: false, why: 'progress' };
        if (!g.spend('cash', info.cost, 'renovation')) return { ok: false, why: 'cash' };
        get(fid).renovation += 1;
        g.emit('celebrate', { kind: 'renovation', text: `Renovation ${info.index + 1} done!` });
        g.emit('changed');
        return { ok: true };
      },
      // Expansions (big job 2): after R3 a grow room can keep expanding, each step adding a little
      // local value for a cost that grows faster than the reward. Never ends, never required.
      expansionInfo(fid) {
        const f = get(fid);
        if (!f || f.renovation < 3 || byId.get(fid).mode !== 'Grow') return null;
        const X = B.facilityEconomy.expansion;
        const n = f.expansion || 0;
        return {
          level: n,
          cost: Math.round(Math.max(econ(fid).stationCostBase, 200) * B.facilityEconomy.renovationCostMult[2] * X.costMult * Math.pow(X.costGrowth, n)),
          bonus: X.valueBonus,
        };
      },
      expand(fid) {
        const info = g.facilities.expansionInfo(fid);
        if (!info) return { ok: false, why: 'progress' };
        if (!g.spend('cash', info.cost, 'expansion')) return { ok: false, why: 'cash' };
        get(fid).expansion = info.level + 1;
        if (get(fid).expansion % 5 === 0) g.emit('celebrate', { kind: 'expansion', text: `${byId.get(fid).name}: expansion ${get(fid).expansion}!` });
        g.emit('changed');
        return { ok: true };
      },
      localValueBonus(fid) {
        const f = get(fid);
        if (!f) return 0;
        let sum = 0;
        for (let i = 0; i < f.renovation; i++) sum += B.facilityEconomy.renovationValueBonus[i];
        return sum + (f.expansion || 0) * B.facilityEconomy.expansion.valueBonus;
      },
      upgradeCostScale: (fid) => econ(fid).upgradeScale || 1,
    };
  });
})(globalThis.PE = globalThis.PE || {});
