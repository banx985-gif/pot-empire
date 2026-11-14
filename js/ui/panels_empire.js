// Empire map, facility expansion, retail, factory, depot, research, contracts.
(function (PE) {
  const { esc, money, duration } = PE.Dom;
  const { Money } = PE;
  const g = () => PE.App.g;
  const params = () => PE.App.router.current().params;
  const toast = (t) => PE.Dom.toast(t);
  const why = (r, fallback) => {
    const text = { inputs: 'Missing an ingredient: see the red line', storeFull: 'That store is full', cash: 'Not enough cash yet', level: 'Your level is too low', progress: 'Needs more local progress', tokens: 'Not enough tokens', crop: 'Not enough crop stock yet: keep harvesting', stock: 'Not enough stock for that', vehicleBusy: 'That vehicle is out on a route', lab: 'Buy the Research Lab first', busy: 'That one is busy' };
    toast(text[r.why] || fallback || 'Not available yet');
  };
  const worth = (v) => money(Math.floor(v));

  // ---- District switcher: a sheet over the map ---------------------------------------------------------
  PE.Panels.districts = {
    title: 'Districts',
    sheet: true,
    render() {
      const game = g();
      PE.Travel.preload();
      return game.map.districts().map((d) => {
        const open = game.map.isUnlocked(d.id);
        const here = game.map.current() === d.id;
        const owned = d.facilities.filter((f) => game.facilities.isOwned(f)).length;
        const right = here ? '<span class="tag go">Here</span>' : open ? '<span class="tag go">Go</span>' : `${PE.Words.extra('SIGN-LOCKED', 'Locked', 'tag-word')}<span class="tag">Level ${game.map.unlockLevel(d)}</span>`;
        return `<div class="item ${open ? '' : 'locked'}" ${open && !here ? `data-act="go:${d.id}"` : ''}><span class="fac-ico">${PE.Dom.icon('NAV-01', 30)}</span><div class="grow"><b>${PE.Words.html(PE.Words.districtId(d.name), d.name, esc(d.name), 'dist-banner')}${open && game.map.needsYou(d.id) ? ' <em class="alert-dot">!</em>' : ''}</b><small>${open ? `${owned} of ${d.facilities.length} places owned` : 'Keep growing to open this district'}</small></div>${right}</div>`;
      }).join('');
    },
    actions: {
      go(id) {
        if (!g().map.isUnlocked(id)) return;
        PE.App.back();
        PE.Travel.go(id);
      },
    },
  };

  // ---- A lot on the map that isn't bought yet ----------------------------------------------------------
  PE.Panels.lotInfo = {
    title: ({ fid }) => g().facilities.row(fid).name,
    sheet: true,
    render({ fid }) {
      const game = g();
      const F = game.facilities;
      const row = F.row(fid);
      const cost = F.econ(fid).cost;
      if (F.isOwned(fid)) return '<p class="center">It\'s yours!</p><button class="btn wide go" data-act="enter">Go inside</button>';
      const count = row.stations ? `${row.stations} ${row.mode === 'Grow' ? 'stations' : 'slots'} at full size` : row.mode;
      const body = `<div class="item"><span class="fac-ico">${PE.Dom.modeIcon(row.mode)}</span><div class="grow"><b>${esc(row.mode)}</b><small>${count}</small></div></div>`;
      if (!F.isAvailable(fid)) return `${body}<p class="center"><b>Opens at level ${row.playerLevel}.</b> You're level ${game.progress.level()}.</p>`;
      return `${body}<button class="btn wide ${game.canAfford('cash', cost) ? 'buy' : 'cant'}" data-act="buy">Buy for ${money(cost)}</button>`;
    },
    actions: {
      buy() {
        const { fid } = params();
        const r = g().facilities.buy(fid);
        if (!r.ok) why(r); else { PE.App.saveGame(); PE.App.back(); }
      },
      enter() { PE.App.goToRoom(params().fid); },
    },
  };

  // ---- Every place as a plain list, one tap from the map (UI03) ------------------------------------------
  PE.Panels.empireList = {
    title: 'All places',
    render() {
      const game = g();
      const F = game.facilities;
      let html = '';
      for (const d of F.districts) {
        html += `<h4>${esc(d.name)}</h4>`;
        html += d.facilities.map((fid) => {
          const row = F.row(fid);
          const own = F.isOwned(fid);
          const open = F.isAvailable(fid);
          const cost = F.econ(fid).cost;
          let right = '';
          if (own) right = '<span class="tag go">Go</span>';
          else if (open) right = `<button class="btn small ${game.canAfford('cash', cost) ? 'buy' : 'cant'}" data-act="buy:${fid}">Buy ${money(cost)}</button>`;
          else right = `<span class="tag">Level ${row.playerLevel}</span>`;
          const count = row.stations ? (own ? `${F.ownedStationCount(fid)}/${row.stations} ${row.mode === 'Grow' ? 'stations' : 'slots'}` : `${row.stations} ${row.mode === 'Grow' ? 'stations' : 'slots'}`) : row.mode;
          return `<div class="item ${own ? '' : 'locked'}" ${own ? `data-act="go:${fid}"` : ''}><span class="fac-ico">${PE.Dom.modeIcon(row.mode)}</span>
            <div class="grow"><b>${esc(row.name)}</b><small>${esc(row.mode)} · ${count}</small>
            ${own ? `<div class="bar thin"><i style="width:${(F.localProgress(fid) * 100).toFixed(0)}%"></i></div>` : ''}</div>${right}</div>`;
        }).join('');
        html += game.map.featuresIn(d.id).map((f) => `<div class="item" data-act="feature:${f.id}"><span class="fac-ico">${PE.Dom.icon('BIZ-06', 30)}</span><div class="grow"><b>${esc(f.name)}${game.map.status(f.id).kind === 'idle' ? ` ${PE.Dom.icon('STA-03', 16)}` : ''}</b><small>${esc(game.map.status(f.id).text || 'Tap to go in')}</small></div><span class="tag go">Go</span></div>`).join('');
      }
      return html;
    },
    actions: {
      feature(id) { PE.App.openPanel(g().map.featureRow(id).route, {}); },
      go(fid) { PE.App.goToRoom(fid); },
      buy(fid) {
        const r = g().facilities.buy(fid);
        if (!r.ok) why(r); else PE.App.saveGame();
      },
    },
  };

  function expansionBlock(fid) {
    const game = g();
    const F = game.facilities;
    const row = F.row(fid);
    const mark = F.nextStationMark(fid);
    let out = `<p class="muted">Local progress ${(F.localProgress(fid) * 100).toFixed(0)}%</p><div class="bar thin"><i style="width:${(F.localProgress(fid) * 100).toFixed(0)}%"></i></div>`;
    if (row.stations && mark !== null) {
      const ok = F.canBuyStation(fid);
      out += `<button class="btn wide ${ok && game.canAfford('cash', F.nextStationCost(fid)) ? 'buy' : 'cant'}" data-act="slot">${ok ? `Add a slot: ${money(F.nextStationCost(fid))}` : `Next slot at ${(mark * 100).toFixed(0)}% local progress`}</button>`;
    }
    const reno = F.renovationInfo(fid);
    if (reno) {
      out += `<button class="btn wide ${reno.ready && game.canAfford('cash', reno.cost) ? 'buy' : 'cant'}" data-act="renovate">${reno.ready ? `Renovation ${reno.index + 1}: ${money(reno.cost)} (+${Math.round(reno.bonus * 100)}% value here)` : `Renovation ${reno.index + 1} at ${Math.round(reno.at * 100)}% local progress`}</button>`;
    } else {
      const ex = F.expansionInfo(fid);
      out += ex ? `<button class="btn wide ${game.canAfford('cash', ex.cost) ? 'buy' : 'cant'}" data-act="expand">Expansion ${ex.level + 1}: ${money(ex.cost)} (+${Math.round(ex.bonus * 100)}% value here)</button><p class="muted">All renovations done. Expansions never run out.</p>` : '<p class="muted">All renovations done.</p>';
    }
    return out;
  }
  const expansionActions = {
    slot() { const r = g().facilities.buyStation(params().fid); if (!r.ok) why(r); },
    renovate() {
      const fid = params().fid;
      const game = g();
      const F = game.facilities;
      const reno = F.renovationInfo(fid);
      const now = F.roomSize(fid);
      const next = reno ? PE.Data.map.roomForRenovation[reno.index + 1] : now;
      const go = () => { const r = F.renovate(fid); if (!r.ok) why(r); else PE.App.saveGame(); };
      // When the room knocks through into its next size, show it first: before and after, with the price.
      const before = PE.MapArt.url(`ROOM-${fid}-${now}`), after = PE.MapArt.url(`ROOM-${fid}-${next}`);
      if (!reno || !reno.ready || next <= now || !before || !after) { go(); return; }
      const spots = (s) => F.roomSpots(fid, s);
      const thing = F.row(fid).mode === 'Grow' ? 'setups' : F.row(fid).mode === 'Retail' ? 'shelves' : 'machines';
      PE.Dom.confirm(`Renovation ${reno.index + 1}`, `<div class="room-preview">
          <figure><img src="${before}" alt="The room now"><figcaption>Now: room for ${spots(now)} ${thing}</figcaption></figure>
          <figure><img src="${after}" alt="The room after"><figcaption>After: room for ${spots(next)} ${thing}</figcaption></figure>
        </div>
        <p>The walls come down and the room grows. Everything you've set up stays as it is.</p>`, `Renovate: ${money(reno.cost)}`, go);
    },
    expand() { const r = g().facilities.expand(params().fid); if (!r.ok) why(r); },
  };
  PE.Panels.facilityInfo = {
    title: ({ fid }) => g().facilities.row(fid).name,
    sheet: true,
    render: ({ fid }) => expansionBlock(fid),
    actions: expansionActions,
  };

  const levelsBlock = (fid, i, s, labels) => {
    const game = g();
    return Object.entries(labels).map(([k, label]) => {
      const lvl = s.levels[k];
      const max = lvl >= game.B.businessEconomy.maxUpgradeLevel;
      const c = max ? 0 : game.business.upgradeCost(fid, k, lvl);
      return `<button class="btn small ${!max && game.canAfford('cash', c) ? 'buy' : 'cant'}" data-act="lvl:${i}:${k}">${label} L${lvl}${max ? ' MAX' : ` ${money(c)}`}</button>`;
    }).join('');
  };

  // ---- Business rooms ----------------------------------------------------------------------------------
  function retailBody(fid) {
    const game = g();
    const b = game.business;
    const shelves = b.slots(fid).map((s, i) => {
      if (!s.sku) return `<div class="shelf"><div class="item" data-act="pick:${i}"><div class="grow"><b>Shelf ${i + 1}</b><small>Empty. Tap to stock it.</small></div><span class="tag go">Stock</span></div>
        <div class="row-btns" data-slot="${i}">${levelsBlock(fid, i, s, { speed: 'Speed', capacity: 'Capacity', value: 'Value' })}</div></div>`;
      const rate = b.shelfRatePerMinute(fid, s);
      const have = game.stock.getStock(s.sku);
      return `<div class="shelf"><div class="item" data-act="pick:${i}"><div class="grow"><b>Shelf ${i + 1}: ${esc(game.stock.skuName(s.sku))}</b>
        <small>Stock worth ${worth(have)} · sells ${(rate * 100).toFixed(1)}% a minute at x${b.shelfMarkup(fid, s).toFixed(2)}</small></div><span class="tag">Change</span></div>
        <div class="row-btns" data-slot="${i}">${levelsBlock(fid, i, s, { speed: 'Speed', capacity: 'Capacity', value: 'Value' })}</div></div>`;
    }).join('');
    return `<p class="muted">Customers buy by themselves. Harvests add crop stock; factories add products. Demand shifts every few hours.</p>${shelves}${expansionBlock(fid)}${bizAssign(fid)}`;
  }

  // A recipe card: inputs on one side, output and timer on the other.
  function inputRow(x) {
    const amount = x.kind === 'strain'
      ? `${Money.format(x.have)}/${Money.format(x.need)}`
      : `${worth(Money.toNumber(x.have))} / ${worth(x.need)}`;
    return `<div class="in ${x.ok ? 'met' : 'short'}"><span class="mark">${PE.Dom.icon(x.ok ? 'STA-06' : 'SYS-04', 14)}</span><span class="what">${esc(x.label)}</span><span class="amt">${amount}</span></div>`;
  }
  function usesText(game, id) {
    const uses = game.business.productUses(id);
    const recipes = uses.filter((u) => u.startsWith('recipe:')).map((u) => game.stock.skuName(u.slice(7)));
    return ['Shop shelves', ...(uses.includes('vip') ? ['VIP orders'] : []), ...(uses.includes('contracts') ? ['delivery contracts'] : []), ...recipes].join(', ');
  }
  // A product's picture (art/shop/products). With packaging chosen for it (Collections), the package with the product on it.
  function productPic(game, id, size = 44) {
    const pack = (game.state.collections.packagingBySku || {})[id];
    if (!PE.Dom.itemPic || !PE.Dom.hasItemArt(id)) return `<span class="card-ph small">${esc(id)}</span>`;
    if (!pack || !PE.Dom.hasItemArt(pack)) return `<span class="prod-pic">${PE.Dom.itemPic(id, size)}</span>`;
    return `<span class="prod-pic packed" title="${esc(pack)}">${PE.Dom.itemPic(pack, size)}${PE.Dom.itemPic(id, Math.round(size * 0.55), 'on-pack')}</span>`;
  }
  PE.Dom.productPic = productPic;

  function recipeCard(game, fid, i, p) {
    const r = game.business.recipe(fid, i, p.id);
    return `<div class="recipe ${r.ok ? 'ready' : ''}">
      <div class="r-top"><b>${esc(p.name)}</b><small>${esc(p.family)}</small></div>
      <div class="r-body"><div class="r-in">${r.inputs.map(inputRow).join('')}</div>
        <div class="r-arrow">${PE.Dom.icon('SYS-03', 22, 'flip')}</div>
        <div class="r-out">${productPic(game, p.id, 44)}<b>${worth(r.output)}</b><small>${PE.Dom.icon('STA-02', 14)}${duration(r.seconds)}</small></div></div>
      <small class="r-uses">Used for: ${esc(usesText(game, p.id))}</small>
      <button class="btn wide ${r.ok ? 'go' : 'cant'}" data-act="set:${p.id}">${r.ok ? 'Make it' : 'Missing something'}</button></div>`;
  }

  function factoryBody(fid) {
    const game = g();
    const b = game.business;
    const now = game.now();
    const lines = b.slots(fid).map((l, i) => {
      if (l.job) {
        const ready = now >= l.job.endMs;
        const waiting = b.lineWaiting(fid, l);
        const t = Math.min(1, (now - l.job.startMs) / (l.job.endMs - l.job.startMs));
        const cost = b.speedUpCost(fid, i);
        const rush = cost !== null ? `<button class="btn small ${game.canAfford('rainbowGems', cost) ? 'buy' : 'cant'}" data-act="rush:${i}">${PE.Dom.icon('STA-04', 18)}${cost} ${PE.Dom.icon('CUR-02', 18)}</button>` : '';
        return `<div class="shelf"><div class="item"><div class="grow"><b>Line ${i + 1}: ${esc(game.stock.skuName(l.sku))}</b>
          <small>${waiting ? `Waiting: the ${esc(game.stock.skuName(l.sku))} store is full (${worth(b.storeCap())}). Sell some and it comes in. Nothing is lost.` : ready ? `Done: ${worth(l.job.output)} of product` : `${duration((l.job.endMs - now) / 1000)} left, makes ${worth(l.job.output)}`}</small>
          <div class="bar thin"><i style="width:${(t * 100).toFixed(0)}%"></i></div></div>
          ${ready && !waiting ? `<button class="btn small go" data-act="claim:${i}">Claim</button>` : rush}</div>
          <div class="row-btns" data-slot="${i}">${levelsBlock(fid, i, l, { speed: 'Speed', batch: 'Batch', value: 'Value' })}</div></div>`;
      }
      return `<div class="shelf"><div class="item" data-act="pick:${i}"><div class="grow"><b>Line ${i + 1}</b><small>Idle${l.sku ? `, last made ${esc(game.stock.skuName(l.sku))}` : ''}.${l.waitForPlayer ? ' Its next batch costs cash, so it waited for you.' : ''} Tap to choose a product.</small></div><span class="tag go">Start</span></div>
        <div class="row-btns" data-slot="${i}">${levelsBlock(fid, i, l, { speed: 'Speed', batch: 'Batch', value: 'Value' })}</div></div>`;
    }).join('');
    return `<p><b>Crop stock: ${worth(game.state.stock.crop)}</b></p>
      <p class="muted">Harvests by rarity: ${PE.DataCheck.RARITIES.map((r) => `${r} ${Money.format((game.state.stock.units || {})[r] || 0)}`).join(' · ')}</p>
      <button class="btn wide plain" data-act="catalogue">Product catalogue</button>
      ${lines}${expansionBlock(fid)}${bizAssign(fid)}`;
  }

  function depotBody(fid) {
    const game = g();
    const b = game.business;
    const now = game.now();
    b.ensureOffers();
    const owned = game.data.collectibles.vehicles.filter((v) => game.state.collections.owned[v.id]);
    const routes = b.slots(fid).map((r, i) => {
      if (r.job) {
        const ready = now >= r.job.endMs;
        const t = Math.min(1, (now - r.job.startMs) / (r.job.endMs - r.job.startMs));
        return `<div class="item" data-slot="${i}">${PE.Dom.itemPic ? PE.Dom.itemPic(r.vehicle, 44, 'veh-pic') : ''}<div class="grow"><b>Route ${i + 1}: ${esc(r.job.offer.name)}</b>
          <small>${esc(game.collections.item(r.vehicle).name)} · pays ${worth(r.job.reward)}${ready ? '' : ` · ${duration((r.job.endMs - now) / 1000)} left`}</small>
          <div class="bar thin"><i style="width:${(t * 100).toFixed(0)}%"></i></div></div>
          ${ready ? `<button class="btn small go" data-act="claim:${i}">Claim</button>` : `<button class="btn small plain" data-act="cancel:${i}">Cancel</button>`}</div>`;
      }
      const auto = game.research.hasFlag('deliveryAuto') ? `<button class="btn small ${r.auto ? 'go' : 'cant'}" data-act="auto:${i}:${r.auto ? 0 : 1}">Auto ${r.auto ? 'on' : 'off'}</button>` : '';
      return `<div class="item" data-slot="${i}">${r.vehicle && PE.Dom.itemPic ? PE.Dom.itemPic(r.vehicle, 44, 'veh-pic') : ''}<div class="grow"><b>Route ${i + 1}</b><small>${r.vehicle ? esc(game.collections.item(r.vehicle).name) : 'No vehicle'}. Idle.</small></div>${auto}
        <button class="btn small buy" data-act="dispatch:${i}">Dispatch</button></div>`;
    }).join('');
    return `<p class="muted">${owned.length} vehicles owned. ${game.state.depot.offers.length} contracts on offer.</p>${routes}${expansionBlock(fid)}${bizAssign(fid)}`;
  }

  // After rank 6: endless refinements.
  function refineBtn(id) {
    const game = g();
    const c = game.research.refineCost(id);
    const n = game.research.refineOf(id);
    return `<button class="btn small ${game.canAfford('researchTokens', c.tokens) && game.canAfford('cash', c.cash) ? 'buy' : 'cant'}" data-act="refine:${id}">Refine ${n + 1}<br>${c.tokens} tokens · ${money(c.cash)}</button>`;
  }
  function researchBody() {
    const game = g();
    const R = game.research;
    const rows = R.branches().map((b) => {
      const rank = R.rankOf(b.id);
      const c = R.cost(b.id);
      const dots = Array.from({ length: game.B.research.ranks }, (_, i) => `<span class="dot ${i < rank ? 'on' : ''}"></span>`).join('');
      return `<div class="item"><div class="grow"><b>${esc(b.id)}</b> ${dots}<small>${esc(b.text)}</small></div>
        ${c ? `<button class="btn small ${game.canAfford('researchTokens', c.tokens) && game.canAfford('cash', c.cash) ? 'buy' : 'cant'}" data-act="research:${b.id}">${c.tokens} tokens<br>${money(c.cash)}</button>` : refineBtn(b.id)}</div>`;
    }).join('');
    return `<p>${PE.Plates.cur(PE.Dom.icon('CUR-03', 22), Money.format(game.state.currencies.researchTokens))} <b>Research Tokens</b></p><p class="muted">Permanent. Tokens come from chests${game.meta ? ', daily tasks and achievements' : ''}.</p>${rows}${bizAssign('F06')}`;
  }

  // A manager row for a business, filled in by Stage 4's collection screens.
  function bizAssign(fid) {
    const game = g();
    const at = game.collections.managersAt(fid);
    const names = at.map((id) => game.collections.item(id).name).join(', ');
    return `${PE.Plates.staffHead('Manager')}<div class="item" data-act="managers">${PE.Dom.managerFaces(at)}<div class="grow"><b>${names ? esc(names) : 'None assigned'}</b><small>${at.length}/${game.collections.managerSlots(fid)} slots</small></div><span class="tag">Open</span></div>`;
  }

  PE.Panels.business = {
    title: ({ fid }) => g().facilities.row(fid).name,
    live: true,
    render({ fid }) {
      const mode = g().facilities.row(fid).mode;
      if (mode === 'Retail') return retailBody(fid);
      if (mode === 'Factory') return factoryBody(fid);
      if (mode === 'Logistics') return depotBody(fid);
      if (mode === 'Research') return researchBody();
      return PE.Panels.hqBody ? PE.Panels.hqBody() : '<p class="center muted">Empire Headquarters: arrives with regional prestige.</p>';
    },
    actions: {
      ...expansionActions,
      lvl(i, what) { const r = g().business.upgradeSlot(params().fid, Number(i), what); if (!r.ok && r.why !== 'max') why(r); },
      pick(i) {
        const fid = params().fid;
        PE.App.router.go('skuPicker', { fid, i: Number(i), mode: g().facilities.row(fid).mode });
      },
      rush(i) {
        const r = g().business.speedUpLine(params().fid, Number(i));
        if (!r.ok) toast(r.why === 'gems' ? 'Not enough Rainbow Gems. It\'ll finish by itself soon.' : 'Already done');
        else PE.App.saveGame();
      },
      claim(i) {
        const fid = params().fid;
        const mode = g().facilities.row(fid).mode;
        const r = mode === 'Factory' ? g().business.claimLine(fid, Number(i)) : g().business.claimRoute(fid, Number(i));
        if (!r.ok && r.why === 'storeFull') toast('That store is full. Nothing is lost: it waits here.');
        if (r.ok && r.cash) toast(`Delivered: +${worth(r.cash)}`);
        PE.App.saveGame();
      },
      cancel(i) {
        const fid = params().fid;
        PE.Dom.confirm('Cancel this delivery?', '<p>The vehicle turns back. All the stock is returned and nothing is paid.</p>', 'Cancel delivery', () => g().business.cancelRoute(fid, Number(i)), { noLabel: 'Keep going' });
      },
      auto(i, on) { g().business.setRouteAuto(params().fid, Number(i), on === '1'); },
      dispatch(i) { PE.App.router.go('contractPicker', { fid: params().fid, i: Number(i) }); },
      catalogue() { PE.App.router.go('catalogue'); },
      research(id) { const r = g().research.buy(id); if (!r.ok && r.why !== 'max') why(r); else if (r.ok) PE.App.saveGame(); },
      refine(id) { const r = g().research.refine(id); if (!r.ok) why(r); else PE.App.saveGame(); },
      managers() { PE.App.router.go('managerBinder', { target: params().fid }); },
    },
  };

  // Shelf or line: choose what it handles.
  PE.Panels.skuPicker = {
    title: ({ mode }) => (mode === 'Retail' ? 'Stock this shelf' : 'Recipes'),
    sheet: true,
    live: true,
    render({ fid, i, mode }) {
      const game = g();
      const open = game.data.collectibles.products.filter((p) => game.state.collections.productsUnlocked[p.id]);
      if (mode !== 'Retail') {
        if (!open.length) return '<p class="muted">No products yet.</p>';
        const list = open.slice().sort((a, b) => Number(game.business.recipe(fid, i, b.id).ok) - Number(game.business.recipe(fid, i, a.id).ok) || b.magnitude - a.magnitude);
        return `<p class="muted">Green ticks are what you have. Red needs more.</p>${list.map((p) => recipeCard(game, fid, i, p)).join('')}`;
      }
      let rows = '';
      if (mode === 'Retail') {
        rows += `<div class="item" data-act="set:CROP"><div class="grow"><b>House Bags</b><small>Your crop stock: ${worth(game.state.stock.crop)}</small></div><span class="tag go">Use</span></div>`;
      }
      rows += open.map((p) => `<div class="item" data-act="set:${p.id}"><div class="grow"><b>${esc(p.name)}</b><small>${esc(p.family)} · ${mode === 'Retail' ? `stock ${worth(game.stock.getStock(p.id))}` : `crop x${game.business.batchOutputMult(fid, game.business.slots(fid)[i], p.id).toFixed(2)} in ${duration(game.business.batchSeconds(fid, game.business.slots(fid)[i], p.id))}`}</small></div><span class="tag go">Use</span></div>`).join('');
      if (!open.length && mode !== 'Retail') rows += '<p class="muted">No products yet.</p>';
      return rows;
    },
    actions: {
      set(sku) {
        const { fid, i, mode } = params();
        if (mode === 'Retail') { g().business.setShelf(fid, i, sku); PE.App.back(); return; }
        const r = g().business.startLine(fid, i, sku);
        if (!r.ok) why(r); else { PE.App.back(); PE.App.saveGame(); }
      },
    },
  };

  function needsText(game, id) {
    const row = game.data.recipes.rows[id] || {};
    const bits = ['crop'];
    if (row.strain) bits.push(`${row.strain.units} ${row.strain.rarity}+ harvests`);
    for (const p of row.products || []) bits.push(game.stock.skuName(p));
    if (row.cashShare) bits.push('cash');
    return 'Needs: ' + bits.join(', ');
  }

  // UI15 product catalogue.
  PE.Panels.catalogue = {
    title: 'Product catalogue',
    render() {
      const game = g();
      const lvl = game.progress.level();
      let html = '';
      for (const fam of Object.keys(game.data.collectibles.families)) {
        html += `<h4>${esc(fam)}</h4>`;
        html += game.data.collectibles.products.filter((p) => p.family === fam).map((p) => {
          const on = game.state.collections.productsUnlocked[p.id];
          const open = lvl >= p.levelGate;
          const c = game.business.productCost(p.id);
          return `<div class="item ${on ? '' : 'locked'}">${productPic(game, p.id, 48)}<div class="grow"><b>${esc(p.name)}</b><small>Crop x${p.magnitude} · batch ${duration(p.batchSeconds)}${on ? ` · stock ${worth(game.stock.getStock(p.id))}` : ''}</small><small>${esc(needsText(game, p.id))}</small></div>
            ${on ? '<span class="tag go">Owned</span>' : open ? `<button class="btn small ${game.canAfford('cash', c) ? 'buy' : 'cant'}" data-act="unlock:${p.id}">${money(c)}</button>` : `<span class="tag">Level ${p.levelGate}</span>`}</div>`;
        }).join('');
      }
      return html;
    },
    actions: { unlock(id) { const r = g().business.unlockProduct(id); if (!r.ok) why(r); else PE.App.saveGame(); } },
  };

  // UI17 delivery contracts: pick a contract and vehicle for a route.
  PE.Panels.contractPicker = {
    title: 'Choose a contract',
    sheet: true,
    live: true,
    render({ fid, i }) {
      const game = g();
      const b = game.business;
      b.ensureOffers();
      const route = b.slots(fid)[i];
      const owned = game.data.collectibles.vehicles.filter((v) => game.state.collections.owned[v.id]);
      const busy = new Set(b.slots(fid).filter((r) => r.job).map((r) => r.vehicle));
      const free = owned.filter((v) => !busy.has(v.id));
      const vehicleId = route.vehicle && free.some((v) => v.id === route.vehicle) ? route.vehicle : (free[0] && free[0].id);
      const chips = owned.map((v) => `<button class="chip ${v.id === vehicleId ? 'on' : ''} ${busy.has(v.id) ? 'off-state' : ''}" data-act="veh:${v.id}">${PE.Dom.itemPic ? PE.Dom.itemPic(v.id, 28, 'chip-pic') : ''}${esc(v.name)}</button>`).join('');
      const offers = game.state.depot.offers.map((o) => {
        const q = vehicleId ? b.quote(fid, o, vehicleId) : null;
        return `<div class="item" ${q && q.amount >= 1 ? `data-act="go:${o.id}:${vehicleId}"` : ''}><div class="grow"><b>${esc(o.name)}: ${esc(game.stock.skuName(o.sku))}</b>
          <small>${q ? `Moves ${worth(q.amount)} of stock · ${duration(q.seconds)} · pays ${worth(q.reward)}` : 'Needs a free vehicle'}</small></div>
          <span class="tag ${q && q.amount >= 1 ? 'go' : ''}">${q && q.amount >= 1 ? 'Send' : 'No stock'}</span></div>`;
      }).join('');
      const limit = game.B.businessEconomy.rerollsPerDay;
      return `<h4>Vehicle</h4><div class="chips">${chips || '<span class="muted">No vehicles yet.</span>'}</div><h4>Contracts</h4>${offers}
        <button class="btn wide plain" data-act="reroll">New offers (${Math.max(0, limit - game.state.depot.rerolls)} left today)</button>`;
    },
    actions: {
      veh(id) { const { fid, i } = params(); g().business.setRouteVehicle(fid, i, id); },
      go(offerId, vehicleId) {
        const { fid, i } = params();
        const r = g().business.dispatch(fid, i, offerId, vehicleId);
        if (!r.ok) why(r); else { PE.App.back(); PE.App.saveGame(); }
      },
      reroll() { if (!g().business.reroll()) toast('No more new offers today'); },
    },
  };

  // Contracts tab: everything timed in one place.
  PE.Panels.contracts = {
    title: 'Contracts',
    live: true,
    render() {
      const game = g();
      const depots = game.business.ids('Logistics');
      let html = PE.Panels.vipBody ? PE.Panels.vipBody() : '';
      if (depots.length) {
        html += '<h4>Deliveries</h4>' + depots.map((f) => `<div class="item" data-act="depot:${f}"><div class="grow"><b>${esc(game.facilities.row(f).name)}</b><small>${game.business.slots(f).filter((r) => r.job).length} of ${game.business.slots(f).length} routes busy</small></div><span class="tag">Open</span></div>`).join('');
      } else {
        html += `<h4>Deliveries</h4><p class="muted">Delivery contracts open with the Distribution Depot at level ${game.facilities.row('F09').playerLevel}.</p>`;
      }
      return html;
    },
    actions: {
      depot(f) { PE.App.openPanel('business', { fid: f }); },
    },
  };

  PE.Panels.facilityHud = true;
  delete PE.Panels.facilityHud;
})(globalThis.PE = globalThis.PE || {});
