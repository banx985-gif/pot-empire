// Collections: owning items, duplicates, assigning managers, equipping relics / stickers /
// decorations / packaging, saved loadouts. Every active item becomes effects in the effects list, so
// the rule "strongest in its stacking group counts, nothing twice" applies to all of them.
(function (PE) {
  PE.Game.register('collections', (g) => {
    const { state, data, B } = g;
    const C = data.collectibles;
    const all = new Map();
    for (const list of [C.managers, C.relics, C.stickers, C.vehicles, C.products, C.packaging, C.decorations, C.avatars]) {
      for (const it of list) all.set(it.id, it);
    }
    const col = () => state.collections;
    // These aren't tied to a place, so they count wherever the relic is equipped.
    const EMPIRE_WIDE = new Set(['researchDiscount', 'festivalPoints', 'festivalReward', 'prestigeShares', 'vipPayout', 'upgradeDiscount']);
    const T = () => B.collectionRules;

    function managerTarget(m) { return m.scope; }

    function managerSlots(targetId) {
      // targetId is "F01:0" for a station, or a facility id for a business.
      const isStation = targetId.includes(':');
      let n = isStation ? T().stationManagerSlots : T().businessManagerSlots;
      if (g.progress.hasFeature('extraManagerSlot')) n += 1;
      return n;
    }
    function validTarget(m, targetId) {
      const scope = managerTarget(m);
      if (scope === 'station') return targetId.includes(':') && !!g.grow.stationOf(...parseStation(targetId));
      if (targetId.includes(':')) return false;
      if (!g.facilities.isOwned(targetId)) return false;
      const mode = g.facilities.row(targetId).mode;
      if (scope === 'Research') return mode === 'Research';
      return mode === scope;
    }
    function parseStation(t) { const [f, s] = t.split(':'); return [f, Number(s)]; }

    function managerLevelMult(id) {
      const o = state.managers.owned[id];
      return o ? 1 + (o.level - 1) * T().managerLevelBonus : 1;
    }
    function effectScopeFor(m, target) {
      if (m.scope === 'station') return { station: target };
      if (m.scope === 'Research') return {};
      return { facility: target };
    }

    // ---- All active items as effects ----------------------------------------------------------------
    g.effects.addProvider(() => {
      const out = [];
      for (const [id, target] of Object.entries(state.managers.assigned)) {
        const m = all.get(id);
        if (!m) continue;
        const value = m.effectKey === 'qualityFloor' ? m.magnitude : m.magnitude * managerLevelMult(id);
        out.push({ key: m.effectKey, value, group: m.stackingGroup, scope: effectScopeFor(m, target), when: m.when, family: m.family, branch: m.branch });
      }
      for (const [district, ids] of Object.entries(col().relicsByDistrict)) {
        const sets = {};
        for (const id of ids) {
          const r = all.get(id);
          if (!r) continue;
          out.push({ key: r.effectKey, value: r.magnitude, group: `${r.stackingGroup}:${district}`, scope: EMPIRE_WIDE.has(r.effectKey) ? {} : { district } });
          sets[r.set] = (sets[r.set] || 0) + 1;
        }
        for (const [set, n] of Object.entries(sets)) {
          if (n < 3) continue;
          const b = C.relics.find((r) => r.set === set).setBonus;
          out.push({ key: b.effectKey, value: b.magnitude, group: `${b.stackingGroup}:${district}`, scope: EMPIRE_WIDE.has(b.effectKey) ? {} : { district } });
        }
      }
      for (const [fid, ids] of Object.entries(col().stickersByBusiness)) {
        for (const id of ids) {
          const s = all.get(id);
          if (s) out.push({ key: s.effectKey, value: s.magnitude, group: `${s.stackingGroup}:${fid}`, scope: { facility: fid }, when: 'family', family: s.family });
        }
      }
      for (const [fid, sockets] of Object.entries(col().decorByFacility)) {
        const sets = {};
        for (const id of Object.values(sockets)) {
          const d = all.get(id);
          if (!d) continue;
          out.push({ key: d.effectKey, value: d.magnitude, group: `${d.stackingGroup}:${fid}`, scope: { facility: fid } });
          sets[d.set] = (sets[d.set] || 0) + 1;
        }
        if (Object.values(sets).some((n) => n >= 3)) {
          const b = C.decorations[0].setBonus;
          out.push({ key: b.effectKey, value: b.magnitude, group: `${b.stackingGroup}:${fid}`, scope: { facility: fid } });
        }
      }
      return out;
    });

    function grant(id, txId) {
      const item = all.get(id);
      if (!item) return null;
      let result = null;
      const apply = () => {
        const owned = col().owned;
        if (owned[id] && item.duplicateConversion) {
          // A duplicate: turns into Collection Tokens. Manager duplicates also add a fragment.
          g.earn('collectionTokens', item.duplicateConversion.tokens, 'duplicate');
          state.stats.duplicates = (state.stats.duplicates || 0) + 1;
          result = { id, duplicate: true, tokens: item.duplicateConversion.tokens };
          if (item.category === 'manager') {
            const m = state.managers.owned[id];
            m.fragments += 1;
            if (m.fragments >= T().fragmentsPerLevel && m.level < T().managerMaxLevel) {
              m.fragments -= T().fragmentsPerLevel;
              m.level += 1;
              g.effects.invalidate();
              result.leveled = m.level;
            }
          }
        } else {
          owned[id] = 1;
          if (item.category === 'manager') state.managers.owned[id] = { level: 1, fragments: 0 };
          g.effects.invalidate();
          result = { id, duplicate: false };
          g.emit('itemGained', { id, name: item.name, category: item.category });
        }
        if (g.meta) g.meta.onItemGained(item);
      };
      if (txId) g.once(`grant:${id}:${txId}`, apply); else apply();
      g.emit('changed');
      return result;
    }

    function dropPool(level, categories) {
      const out = [];
      for (const cat of categories) for (const it of C[cat]) if (it.levelGate <= level) out.push(it);
      return out;
    }
    function randomDrop(seedText, level, categories) {
      const pool = dropPool(level, categories);
      if (!pool.length) return null;
      return pool[Math.floor(PE.Rng.roll(`${state.rng.seed}:drop:${seedText}`) * pool.length)];
    }

    g.collections = {
      all,
      grant,
      item: (id) => all.get(id),
      owns: (id) => !!col().owned[id],
      counts() {
        const out = {};
        for (const key of ['managers', 'relics', 'stickers', 'vehicles', 'packaging', 'decorations']) {
          out[key] = { have: C[key].filter((i) => col().owned[i.id]).length, total: C[key].length };
        }
        out.products = { have: C.products.filter((p) => col().productsUnlocked[p.id]).length, total: C.products.length };
        out.strains = { have: Object.keys(state.unlockedStrains).length, total: 60 };
        out.avatars = { have: g.collections.avatarsUnlocked().length, total: 60 };
        return out;
      },

      // A manager's progress towards its next level, from duplicates.
      managerCard(id) {
        const m = state.managers.owned[id];
        if (!m) return null;
        const max = m.level >= T().managerMaxLevel;
        return { level: m.level, fragments: m.fragments, need: T().fragmentsPerLevel, max, bonus: (m.level - 1) * T().managerLevelBonus };
      },
      // Opens a chest: gives the cards and tells the screen to show the reveal. Chests only come from
      // play: level rewards, milestone choices and the login calendar. Nothing in the shop calls this.
      openChest(txId, level, count = 1, opts = {}) {
        const cats = opts.categories || T().chestCategories;
        const cards = [];
        for (let i = 0; i < count; i++) {
          const key = count > 1 ? `${txId}:${i}` : txId;
          const it = opts.pick ? opts.pick(key, i) : randomDrop(key, level, cats);
          if (!it) continue;
          const r = grant(it.id, key);
          if (!r) continue;   // this chest has already been opened
          const card = { id: it.id, name: it.name, rarity: it.rarity, category: it.category, duplicate: !!r.duplicate, tokens: r.tokens || 0, leveled: r.leveled || 0 };
          if (it.category === 'manager') { const c = g.collections.managerCard(it.id); card.fragments = c.fragments; card.need = c.need; }
          cards.push(card);
        }
        if (cards.length) g.emit('chestOpened', { source: opts.source || 'chest', title: opts.title, cards });
        return cards;
      },
      chestDrop(txId, level) {
        return g.collections.openChest(txId, level, 1, { source: 'level', title: `Level ${level} chest!` })
          .map((c) => (c.duplicate ? `${c.name} (duplicate): +${c.tokens} Collection Tokens` : `New: ${c.name}`));
      },
      grantRandomManager(txId, level) {
        const cards = g.collections.openChest(txId, level, 1, { categories: ['managers'], source: 'choice', title: 'Manager card!' });
        return cards.length ? all.get(cards[0].id) : null;
      },

      // The targeted collection shop: Collection Tokens buy a chosen item.
      buyWithTokens(id) {
        const it = all.get(id);
        if (!it || !it.duplicateConversion || it.category === 'product') return { ok: false, why: 'bad' };
        if (g.progress.level() < it.levelGate) return { ok: false, why: 'level' };
        if (col().owned[id]) return { ok: false, why: 'owned' };
        if (!g.spend('collectionTokens', it.duplicateConversion.shopPrice, 'shop')) return { ok: false, why: 'tokens' };
        grant(id);
        return { ok: true };
      },

      // ---- Managers ---------------------------------------------------------------------------
      assignManager(id, target) {
        const m = all.get(id);
        if (!m || m.category !== 'manager' || !col().owned[id]) return { ok: false, why: 'owned' };
        if (!validTarget(m, target)) return { ok: false, why: 'target' };
        const here = Object.entries(state.managers.assigned).filter(([k, t]) => t === target && k !== id).length;
        if (here >= managerSlots(target)) return { ok: false, why: 'full' };
        state.managers.assigned[id] = target;     // one place only: moving replaces the old assignment
        g.effects.invalidate();
        g.emit('changed');
        return { ok: true };
      },
      unassignManager(id) {
        delete state.managers.assigned[id];
        g.effects.invalidate();
        g.emit('changed');
      },
      managersAt: (target) => Object.entries(state.managers.assigned).filter(([, t]) => t === target).map(([id]) => id),
      managerSlots,
      validTarget,
      managerTargets(id) {
        const m = all.get(id);
        const out = [];
        for (const r of g.facilities.rows) {
          if (!g.facilities.isOwned(r.id)) continue;
          if (m.scope === 'station' && r.mode === 'Grow') {
            for (let i = 0; i < g.facilities.ownedStationCount(r.id); i++) out.push({ id: `${r.id}:${i}`, name: `${r.name}, station ${i + 1}` });
          } else if (m.scope !== 'station' && r.mode === m.scope) out.push({ id: r.id, name: r.name });
        }
        return out;
      },

      // ---- Relics: three per district -----------------------------------------------------------
      equipRelic(district, id) {
        if (!col().owned[id] || all.get(id).category !== 'relic') return { ok: false, why: 'owned' };
        const map = col().relicsByDistrict;
        for (const [d, list] of Object.entries(map)) if (list.includes(id)) map[d] = list.filter((x) => x !== id);
        const list = map[district] || (map[district] = []);
        if (list.length >= T().relicsPerDistrict) return { ok: false, why: 'full' };
        list.push(id);
        g.effects.invalidate();
        g.emit('changed');
        return { ok: true };
      },
      unequipRelic(id) {
        const map = col().relicsByDistrict;
        for (const d of Object.keys(map)) map[d] = map[d].filter((x) => x !== id);
        g.effects.invalidate();
        g.emit('changed');
      },

      // ---- Stickers: two per retail / factory business ------------------------------------------
      equipSticker(fid, id) {
        if (!col().owned[id] || all.get(id).category !== 'sticker') return { ok: false, why: 'owned' };
        const mode = g.facilities.isOwned(fid) && g.facilities.row(fid).mode;
        if (mode !== 'Retail' && mode !== 'Factory') return { ok: false, why: 'target' };
        const map = col().stickersByBusiness;
        for (const k of Object.keys(map)) map[k] = map[k].filter((x) => x !== id);
        const list = map[fid] || (map[fid] = []);
        if (list.length >= T().stickersPerBusiness) return { ok: false, why: 'full' };
        list.push(id);
        g.effects.invalidate();
        g.emit('changed');
        return { ok: true };
      },
      unequipSticker(id) {
        const map = col().stickersByBusiness;
        for (const k of Object.keys(map)) map[k] = map[k].filter((x) => x !== id);
        g.effects.invalidate();
        g.emit('changed');
      },

      // ---- Packaging: one per SKU --------------------------------------------------------------
      setPackaging(sku, id) {
        if (id !== null && (!col().owned[id] || all.get(id).category !== 'packaging')) return false;
        if (id === null) delete col().packagingBySku[sku];
        else {
          for (const k of Object.keys(col().packagingBySku)) if (col().packagingBySku[k] === id) delete col().packagingBySku[k];
          col().packagingBySku[sku] = id;
        }
        g.emit('changed');
        return true;
      },

      // ---- Decorations: fixed sockets ----------------------------------------------------------
      placeDecoration(fid, id) {
        const d = all.get(id);
        if (!d || d.category !== 'decoration' || !col().owned[id] || !g.facilities.isOwned(fid)) return { ok: false, why: 'owned' };
        if (['Research', 'Prestige'].includes(g.facilities.row(fid).mode)) return { ok: false, why: 'target' };   // no reputation to earn there
        const map = col().decorByFacility;
        for (const f of Object.keys(map)) for (const s of Object.keys(map[f])) if (map[f][s] === id) delete map[f][s];
        (map[fid] || (map[fid] = {}))[d.socketId] = id;
        g.effects.invalidate();
        g.emit('changed');
        return { ok: true };
      },
      removeDecoration(id) {
        const map = col().decorByFacility;
        for (const f of Object.keys(map)) for (const s of Object.keys(map[f])) if (map[f][s] === id) delete map[f][s];
        g.effects.invalidate();
        g.emit('changed');
      },

      // ---- Saved loadouts ----------------------------------------------------------------------
      saveLoadout(slot, name) {
        if (slot < 0 || slot >= T().loadoutSlots) return false;
        col().loadouts[slot] = {
          name: name || `Loadout ${slot + 1}`,
          managers: { ...state.managers.assigned },
          relics: JSON.parse(JSON.stringify(col().relicsByDistrict)),
          stickers: JSON.parse(JSON.stringify(col().stickersByBusiness)),
        };
        g.emit('changed');
        return true;
      },
      applyLoadout(slot) {
        const l = col().loadouts[slot];
        if (!l) return { ok: false };
        state.managers.assigned = {};
        let skipped = 0;
        for (const [id, target] of Object.entries(l.managers)) {
          if (col().owned[id] && validTarget(all.get(id), target)) state.managers.assigned[id] = target; else skipped++;
        }
        col().relicsByDistrict = JSON.parse(JSON.stringify(l.relics));
        col().stickersByBusiness = JSON.parse(JSON.stringify(l.stickers));
        g.effects.invalidate();
        g.emit('changed');
        return { ok: true, skipped };
      },

      // ---- Avatars: unlocked at strain Mastery 10 -----------------------------------------------
      avatarsUnlocked: () => C.avatars.filter((a) => g.grow.masteryLevel(a.strainId) >= B.mastery.avatarUnlockLevel),
      setAvatar(strainId) {
        if (g.grow.masteryLevel(strainId) < B.mastery.avatarUnlockLevel) return false;
        state.profile.avatarStrainId = strainId;
        g.emit('changed');
        return true;
      },
    };
  });
})(globalThis.PE = globalThis.PE || {});
