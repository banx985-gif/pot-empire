// Collection screens (UI19-27): managers, relics, stickers, vehicles, packaging, decorations, avatars,
// loadouts and the token shop. Managers show their real portraits. Other cards are PLACEHOLDERS: id + name on a plain card.
(function (PE) {
  const { esc, strainThumb } = PE.Dom;
  const { Money } = PE;
  const g = () => PE.App.g;
  const params = () => PE.App.router.current().params;
  const toast = (t) => PE.Dom.toast(t);
  const C = () => PE.Data.collectibles;

  const card = (it) => (it.category === 'manager' ? `<span class="card-ph r-bg-${it.rarity} has-portrait">${PE.Dom.portrait(it.id, it.name)}</span>` : `<span class="card-ph r-bg-${it.rarity}">${esc(it.id)}</span>`);
  const percent = (v) => `${Math.round(v * 1000) / 10}%`;
  const NICE = {
    growSpeed: 'grow speed', saleBonus: 'sale value', yieldBonus: 'yield', masteryXp: 'mastery XP', extraHarvestChance: 'double-sale chance',
    maintenanceInterval: 'water time', replantHeadStart: 'replant head start', upgradeDiscount: 'upgrade discount', serviceRecovery: 'dry-station recovery',
    offlineEfficiency: 'away earnings', premiumChance: 'Premium chance', topShelfChance: 'Top Shelf chance', exoticChance: 'Exotic chance',
    retailDemand: 'shop demand', retailPrice: 'shop prices', vipPayout: 'VIP pay', vipChance: 'VIP chance', factorySpeed: 'factory speed', productValue: 'product value',
    factoryOffline: 'away factory output', deliverySpeed: 'delivery speed', deliveryPayout: 'delivery pay', deliveryCapacity: 'delivery load', researchDiscount: 'research discount',
    festivalPoints: 'festival points', festivalReward: 'festival rewards', familyDemand: 'demand', contractCredit: 'contract credit', prestigeShares: 'prestige shares',
    vehicleSpeed: 'speed', vehicleCapacity: 'load', vehicleReward: 'pay', vehicleReliability: 'bonus-pay chance',
  };
  function effectLine(it) {
    if (it.effectKey === 'qualityFloor') return 'Nothing sells below Fine';
    if (it.effectKey === 'qualityScore') return `+${it.magnitude} quality score`;
    if (it.effectKey === 'reputation') return `+${it.magnitude} reputation`;
    if (it.effectKey === 'vipRefresh') return `+${it.magnitude} VIP reroll a day`;
    if (it.effectKey === 'productSku') return `Crop x${it.magnitude}`;
    return `+${percent(it.magnitude)} ${NICE[it.effectKey] || it.effectKey}`;
  }
  const whenText = (it) => (it.family ? ` (${it.family})` : it.branch ? ` (${it.branch})` : it.when ? ` when: ${it.passive || it.when}` : '');

  // ---- Hub ---------------------------------------------------------------------------------------------
  const SECTIONS = [
    { id: 'album', label: 'Strains', key: 'strains', icon: '🌿' },
    { id: 'managerBinder', label: 'Managers', key: 'managers', icon: '🧑‍🌾' },
    { id: 'relicList', label: 'Relics', key: 'relics', icon: '🔮' },
    { id: 'stickerList', label: 'Brand stickers', key: 'stickers', icon: '⭐' },
    { id: 'vehicleList', label: 'Vehicles', key: 'vehicles', icon: '🚐' },
    { id: 'packagingList', label: 'Packaging', key: 'packaging', icon: '📦' },
    { id: 'decorList', label: 'Decorations', key: 'decorations', icon: '🪩' },
    { id: 'avatarList', label: 'Avatars', key: 'avatars', icon: '🎭' },
    { id: 'catalogue', label: 'Products', key: 'products', icon: '🍪' },
  ];
  PE.Panels.collection = {
    title: 'Collection',
    render() {
      const game = g();
      const c = game.collections.counts();
      const total = c.managers.have + c.relics.have + c.stickers.have + c.vehicles.have + c.packaging.have + c.decorations.have + c.products.have + c.strains.have;
      return `<p><b>${total} of 378</b> collected · ${Money.format(game.state.currencies.collectionTokens)} Collection Tokens</p>
        <div class="hub">${SECTIONS.map((s) => `<button class="hub-btn" data-act="go:${s.id}"><span>${s.icon}</span><b>${s.label}</b><small>${c[s.key].have}/${c[s.key].total}</small></button>`).join('')}
        <button class="hub-btn" data-act="go:loadouts"><span>💾</span><b>Loadouts</b><small>Saved setups</small></button></div>
        <p class="muted">Duplicates turn into Collection Tokens. Spend tokens on any item you've reached the level for. Manager cards level up with duplicates. Other cards are placeholders until their art is drawn.</p>`;
    },
    actions: { go(id) { PE.App.router.go(id, {}); } },
  };

  // A generic list: owned first, level, buy with tokens.
  function itemRow(it, right, extra = '') {
    const game = g();
    const own = game.collections.owns(it.id);
    const lvlOk = game.progress.level() >= it.levelGate;
    const fallback = !own && it.duplicateConversion
      ? (lvlOk ? `<button class="btn small ${game.canAfford('collectionTokens', it.duplicateConversion.shopPrice) ? 'buy' : 'plain'}" data-act="buy:${it.id}">${it.duplicateConversion.shopPrice} tokens</button>` : `<span class="tag">Level ${it.levelGate}</span>`)
      : '';
    return `<div class="item ${own ? '' : 'locked'}">${card(it)}<div class="grow"><b>${esc(it.name)}</b>
      <small class="r-${it.rarity}">${it.rarity}</small><small>${esc(effectLine(it))}${esc(whenText(it))}</small>${extra}</div>${own ? right : fallback}</div>`;
  }
  const buyAction = (id) => {
    const r = g().collections.buyWithTokens(id);
    if (!r.ok) toast(r.why === 'tokens' ? 'Not enough Collection Tokens' : 'Not available yet');
    else { toast(`${g().collections.item(id).name} added!`); PE.App.saveGame(); }
  };

  // The bar on a manager card: duplicates towards the next level, like 2/3 with an up arrow.
  function cardProgress(id) {
    const c = g().collections.managerCard(id);
    if (!c) return '';
    const width = c.max ? 100 : Math.min(100, (c.fragments / c.need) * 100);
    return `<div class="card-progress"><span class="card-lvl">L${c.level}</span><span class="dup-bar ${c.max ? 'max' : ''}"><i style="width:${width}%"></i><b>${c.max ? 'MAX' : `${c.fragments}/${c.need} ⬆`}</b></span></div>`;
  }

  // ---- Managers (UI19, UI20, UI21) -----------------------------------------------------------------------
  PE.Panels.managerBinder = {
    title: ({ target }) => (target ? 'Assign a manager' : 'Manager binder'),
    render({ target }) {
      const game = g();
      const assigned = game.state.managers.assigned;
      let html = target ? `<p class="muted">${game.collections.managersAt(target).length}/${game.collections.managerSlots(target)} slots used here.</p>` : '';
      const list = C().managers.filter((m) => !target || game.collections.validTarget(m, target) || !game.collections.owns(m.id));
      const roles = [...new Set(list.map((m) => m.role))];
      for (const role of roles) {
        html += `<h4>${esc(role)}</h4>`;
        html += list.filter((m) => m.role === role).map((m) => {
          const own = game.collections.owns(m.id);
          const here = assigned[m.id];
          const extra = own ? `${cardProgress(m.id)}${here ? `<small>At ${esc(placeName(here))}</small>` : ''}` : '';
          let right;
          if (target && own && game.collections.validTarget(m, target)) {
            right = here === target ? `<button class="btn small go" data-act="un:${m.id}">Here</button>` : `<button class="btn small buy" data-act="assign:${m.id}:${target}">Assign</button>`;
          } else right = `<button class="btn small plain" data-act="open:${m.id}">Open</button>`;
          return itemRow(m, right, extra);
        }).join('');
      }
      return html;
    },
    actions: {
      assign(id, ...rest) {
        const target = rest.join(':');
        const r = g().collections.assignManager(id, target);
        if (!r.ok) toast(r.why === 'full' ? 'No free manager slot here' : 'Can\'t go there');
        else PE.App.saveGame();
      },
      un(id) { g().collections.unassignManager(id); PE.App.saveGame(); },
      open(id) { PE.App.router.go('managerDetail', { id }); },
      buy: buyAction,
    },
  };
  function placeName(target) {
    const game = g();
    if (!target.includes(':')) return game.facilities.row(target).name;
    const [f, s] = target.split(':');
    return `${game.facilities.row(f).name}, station ${Number(s) + 1}`;
  }

  PE.Panels.managerDetail = {
    title: ({ id }) => g().collections.item(id).name,
    sheet: true,
    render({ id }) {
      const game = g();
      const m = game.collections.item(id);
      const here = game.state.managers.assigned[id];
      const targets = game.collections.managerTargets(id);
      return `<div class="item big">${card(m)}<div class="grow"><small class="r-${m.rarity}">${m.rarity} · ${esc(m.role)}</small><b>${esc(effectLine(m))}${esc(whenText(m))}</b><small>${esc(m.strategy)}</small></div></div>
        ${game.collections.owns(id) ? `${cardProgress(id)}<p class="muted">Duplicates level this card up. Each level adds ${Math.round(game.B.collectionRules.managerLevelBonus * 100)}% to its effect. You also get Collection Tokens for every duplicate.</p>` : ''}
        <h4>Assign to</h4>
        ${targets.length ? targets.map((t) => `<div class="item" data-act="assign:${id}:${t.id}"><div class="grow"><b>${esc(t.name)}</b></div>${here === t.id ? '<span class="tag go">Here</span>' : '<span class="tag">Assign</span>'}</div>`).join('') : '<p class="muted">You don\'t own a place this manager can work yet.</p>'}
        ${here ? `<button class="btn wide plain" data-act="un:${id}">Remove from ${esc(placeName(here))}</button>` : ''}`;
    },
    actions: {
      assign(id, ...rest) {
        const r = g().collections.assignManager(id, rest.join(':'));
        if (!r.ok) toast(r.why === 'full' ? 'No free manager slot there' : 'Can\'t go there');
        else PE.App.saveGame();
      },
      un(id) { g().collections.unassignManager(id); PE.App.saveGame(); },
    },
  };

  // ---- Relics (UI24): three per district -----------------------------------------------------------------
  PE.Panels.relicList = {
    title: 'Relics',
    render() {
      const game = g();
      const map = game.state.collections.relicsByDistrict;
      const where = {};
      for (const [d, ids] of Object.entries(map)) ids.forEach((id) => { where[id] = d; });
      let html = '<p class="muted">Three per district. Three of one set adds its set bonus.</p>';
      html += game.facilities.districts.map((d) => `<p><b>${esc(d.name)}:</b> ${(map[d.id] || []).map((id) => esc(game.collections.item(id).name)).join(', ') || 'empty'} (${(map[d.id] || []).length}/3)</p>`).join('');
      const sets = [...new Set(C().relics.map((r) => r.set))];
      for (const set of sets) {
        const items = C().relics.filter((r) => r.set === set);
        html += `<h4>${esc(set)} set</h4><p class="muted">Three equipped: +${items[0].setBonus.effectKey === 'qualityScore' ? items[0].setBonus.magnitude : percent(items[0].setBonus.magnitude)} ${esc(items[0].setBonus.text)}</p>`;
        html += items.map((r) => {
          const chips = game.facilities.districts.map((d) => `<button class="chip ${where[r.id] === d.id ? 'on' : ''}" data-act="eq:${d.id}:${r.id}">${esc(d.id)}</button>`).join('');
          return itemRow(r, `<div class="chips">${chips}</div>`);
        }).join('');
      }
      return html;
    },
    actions: {
      eq(d, id) {
        const game = g();
        const cur = game.state.collections.relicsByDistrict[d] || [];
        if (cur.includes(id)) game.collections.unequipRelic(id);
        else { const r = game.collections.equipRelic(d, id); if (!r.ok) toast('That district has three already'); }
        PE.App.saveGame();
      },
      buy: buyAction,
    },
  };

  // ---- Stickers (UI25): two per retail/factory business ---------------------------------------------------
  PE.Panels.stickerList = {
    title: 'Brand stickers',
    render() {
      const game = g();
      const biz = game.facilities.rows.filter((r) => (r.mode === 'Retail' || r.mode === 'Factory') && game.facilities.isOwned(r.id));
      const map = game.state.collections.stickersByBusiness;
      const where = {};
      for (const [f, ids] of Object.entries(map)) ids.forEach((id) => { where[id] = f; });
      let html = `<p class="muted">Two per shop or factory. ${biz.length ? '' : 'Buy a shop or factory first.'}</p>`;
      const sets = [...new Set(C().stickers.map((r) => r.set))];
      for (const set of sets) {
        html += `<h4>${esc(set)}</h4>`;
        html += C().stickers.filter((s) => s.set === set).map((s) => {
          const chips = biz.map((b) => `<button class="chip ${where[s.id] === b.id ? 'on' : ''}" data-act="eq:${b.id}:${s.id}">${esc(b.id)}</button>`).join('');
          return itemRow(s, `<div class="chips">${chips}</div>`);
        }).join('');
      }
      return html;
    },
    actions: {
      eq(f, id) {
        const game = g();
        const cur = game.state.collections.stickersByBusiness[f] || [];
        if (cur.includes(id)) game.collections.unequipSticker(id);
        else { const r = game.collections.equipSticker(f, id); if (!r.ok) toast('Two stickers per business'); }
        PE.App.saveGame();
      },
      buy: buyAction,
    },
  };

  // ---- Vehicles (UI26) ---------------------------------------------------------------------------------------
  PE.Panels.vehicleList = {
    title: 'Vehicles',
    render() {
      const kinds = [...new Set(C().vehicles.map((v) => v.kind))];
      return '<p class="muted">Pick a vehicle when you dispatch a contract from the Distribution Depot.</p>' + kinds.map((k) => `<h4>${esc(k)}</h4>${C().vehicles.filter((v) => v.kind === k).map((v) => itemRow(v, '<span class="tag go">Owned</span>')).join('')}`).join('');
    },
    actions: { buy: buyAction },
  };

  // ---- Packaging: one per SKU ---------------------------------------------------------------------------------
  PE.Panels.packagingList = {
    title: 'Packaging',
    render() {
      const game = g();
      const skus = [{ id: 'CROP', name: 'House Bags' }, ...C().products.filter((p) => game.state.collections.productsUnlocked[p.id])];
      const by = game.state.collections.packagingBySku;
      const lines = [...new Set(C().packaging.map((k) => k.line))];
      let html = `<p class="muted">One per product. Choosing a product puts this packaging on it.</p>`;
      for (const line of lines) {
        html += `<h4>${esc(line)}</h4>` + C().packaging.filter((k) => k.line === line).map((k) => {
          const used = Object.keys(by).find((s) => by[s] === k.id);
          const chips = skus.map((s) => `<button class="chip ${used === s.id ? 'on' : ''}" data-act="set:${s.id}:${k.id}">${esc(s.name)}</button>`).join('');
          return itemRow(k, `<div class="chips narrow">${chips}</div>`);
        }).join('');
      }
      return html;
    },
    actions: {
      set(sku, id) {
        const game = g();
        const cur = game.state.collections.packagingBySku[sku];
        game.collections.setPackaging(sku, cur === id ? null : id);
        PE.App.saveGame();
      },
      buy: buyAction,
    },
  };

  // ---- Decorations (UI27): fixed sockets ------------------------------------------------------------------------
  PE.Panels.decorList = {
    title: 'Decorations',
    render() {
      const game = g();
      const owned = game.facilities.rows.filter((r) => game.facilities.isOwned(r.id) && !['Research', 'Prestige'].includes(r.mode));
      const by = game.state.collections.decorByFacility;
      const where = {};
      for (const [f, sockets] of Object.entries(by)) Object.values(sockets).forEach((id) => { where[id] = f; });
      const sets = [...new Set(C().decorations.map((d) => d.set))];
      let html = '<p class="muted">Each piece goes in its own fixed socket in a facility. Three of one set in one facility adds +3% sale value there. Placed pieces are not drawn in the rooms yet: the art doesn\'t exist.</p>';
      for (const set of sets) {
        html += `<h4>${esc(set)}</h4>` + C().decorations.filter((d) => d.set === set).map((d) => {
          const chips = owned.map((r) => `<button class="chip ${where[d.id] === r.id ? 'on' : ''}" data-act="put:${r.id}:${d.id}">${esc(r.id)}</button>`).join('');
          return itemRow(d, `<div class="chips narrow">${chips}</div>`);
        }).join('');
      }
      return html;
    },
    actions: {
      put(f, id) {
        const game = g();
        const here = Object.values(game.state.collections.decorByFacility[f] || {}).includes(id);
        if (here) game.collections.removeDecoration(id);
        else game.collections.placeDecoration(f, id);
        PE.App.saveGame();
      },
      buy: buyAction,
    },
  };

  // ---- Avatars --------------------------------------------------------------------------------------------------
  PE.Panels.avatarList = {
    title: 'Avatars',
    render() {
      const game = g();
      const cur = game.state.profile.avatarStrainId;
      return `<p class="muted">Each strain's logo becomes an avatar at Mastery 10. Cosmetic only. Logo art isn't drawn yet, so the mature plant stands in.</p>` + C().avatars.map((a) => {
        const lvl = game.grow.masteryLevel(a.strainId);
        const open = lvl >= game.B.mastery.avatarUnlockLevel;
        return `<div class="item ${open ? '' : 'locked'}" ${open ? `data-act="pick:${a.strainId}"` : ''}>${strainThumb(a.strainId, 5, 44)}<div class="grow"><b>${esc(a.name)}</b><small>${open ? 'Unlocked' : `Mastery ${lvl}/10`}</small></div>${cur === a.strainId ? '<span class="tag go">Selected</span>' : ''}</div>`;
      }).join('');
    },
    actions: { pick(id) { g().collections.setAvatar(id); PE.App.saveGame(); } },
  };

  // ---- Loadouts -----------------------------------------------------------------------------------------------
  PE.Panels.loadouts = {
    title: 'Saved loadouts',
    render() {
      const game = g();
      const list = game.state.collections.loadouts;
      const n = game.B.collectionRules.loadoutSlots;
      return '<p class="muted">Saves your manager, relic and sticker choices so you can swap whole setups.</p>' + Array.from({ length: n }, (_, i) => {
        const l = list[i];
        return `<div class="item"><div class="grow"><b>${l ? esc(l.name) : `Empty slot ${i + 1}`}</b><small>${l ? `${Object.keys(l.managers).length} managers` : 'Nothing saved'}</small></div>
          <button class="btn small plain" data-act="save:${i}">Save</button>${l ? `<button class="btn small go" data-act="use:${i}">Use</button>` : ''}</div>`;
      }).join('');
    },
    actions: {
      save(i) { g().collections.saveLoadout(Number(i)); toast('Loadout saved'); PE.App.saveGame(); },
      use(i) {
        const r = g().collections.applyLoadout(Number(i));
        if (r.ok) toast(r.skipped ? `Loaded. ${r.skipped} couldn't be placed.` : 'Loadout applied');
        PE.App.saveGame();
      },
    },
  };

  // A station's manager row, shown on the hydro screen.
  const baseStation = PE.Panels.station.render;
  PE.Panels.station.render = (p) => {
    const game = g();
    const target = `${p.fid}:${Number(p.si)}`;
    const at = game.collections.managersAt(target);
    const names = at.map((id) => game.collections.item(id).name).join(', ');
    return `${baseStation(p)}<h4>Manager</h4><div class="item" data-act="managers"><div class="grow"><b>${names ? esc(names) : 'None assigned'}</b><small>${at.length}/${game.collections.managerSlots(target)} slots</small></div><span class="tag">Open</span></div>`;
  };
  PE.Panels.station.actions.managers = () => {
    const r = params();
    PE.App.router.go('managerBinder', { target: `${r.fid}:${Number(r.si)}` });
  };
})(globalThis.PE = globalThis.PE || {});
