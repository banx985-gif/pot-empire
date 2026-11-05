// UI34 Shop, the PRETEND store and the PRETEND ad (bible section 11).
// Real payments and ads are switched OFF (data/shop.js). The pretend store keeps its receipts in its
// own storage slot, apart from the save, like a real store account does: that is what lets "Restore
// purchases" be tested after wiping the save. Nothing here charges money or shows a real ad.
(function (PE) {
  const { esc, money } = PE.Dom;
  const { Money } = PE;
  const g = () => PE.App.g;
  const toast = (t) => PE.Dom.toast(t);
  const ACCOUNT_KEY = 'potEmpire.pretendStore.receipts';
  const urlPretend = /[?&]pretend=1\b/.test(location.search);

  function storage() { try { return window.localStorage; } catch (e) { return null; } }

  const Store = {
    pretendOn() {
      const sw = PE.Data.shop.switches;
      return sw.pretendAllowed && (urlPretend || !!PE.App.state.settings.pretendShop);
    },
    paymentsOn() { return PE.Data.shop.switches.realPaymentsEnabled || Store.pretendOn(); },
    adsOn() { return PE.Data.shop.switches.realAdsEnabled || Store.pretendOn() || g().ads.noAds(); },

    // ---- The pretend store "account" ----
    receipts() {
      const s = storage();
      try { return JSON.parse((s && s.getItem(ACCOUNT_KEY)) || '[]'); } catch (e) { return []; }
    },
    keep(receipt) {
      const s = storage();
      const list = Store.receipts();
      list.push(receipt);
      try { if (s) s.setItem(ACCOUNT_KEY, JSON.stringify(list)); } catch (e) { /* storage full: the purchase still applies */ }
    },

    buy(productId) {
      const p = g().purchases.product(productId);
      if (!Store.paymentsOn()) { toast('Purchases are switched off in this build'); return; }
      if (!g().purchases.canBuy(productId)) { toast('You already have this'); return; }
      PE.Dom.modal({
        title: 'Pretend purchase',
        cls: 'pretend',
        html: `<p class="center"><b>${esc(p.name)}</b></p><p class="bigcash">A$${g().purchases.priceAud(productId).toFixed(2)}</p><p class="muted center">TEST SHOP: no real money. This only checks that buying works.</p>`,
        buttons: [
          { label: 'Cancel', style: 'plain', onTap: () => Store.result('Purchase cancelled', '<p>Nothing was charged and nothing changed.</p>') },
          { label: 'Approve', style: 'go', onTap: () => {
            const r = { productId, txId: `pt-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e9).toString(36)}`, purchasedAtMs: g().now() };
            r.signature = g().purchases.sign(r);
            Store.keep(r);   // the store records it first, as a real store does
            const res = g().purchases.applyReceipt(r);
            PE.App.saveGame();
            Store.result(res.ok ? 'Purchase complete' : 'Purchase problem', res.ok ? `<p>${esc(res.text)}</p>` : `<p>The receipt didn't check out (${esc(res.why)}). Nothing was given.</p>`);
          } },
        ],
      });
    },
    restore() {
      if (!Store.paymentsOn()) { toast('Purchases are switched off in this build'); return; }
      const r = g().purchases.restore(Store.receipts());
      PE.App.saveGame();
      Store.result('Restore purchases', r.restored ? `<p>${r.restored} purchase${r.restored > 1 ? 's' : ''} restored.</p>` : '<p>Everything you own is already here.</p><p class="muted">Gem packs are used up when bought, so they aren\'t restored.</p>');
    },
    result(title, html) { PE.Dom.modal({ title, html, buttons: [{ label: 'OK', style: 'go' }] }); },

    // ---- The pretend ad: a short countdown card. Closing early gives nothing. ----
    watchAd(kind, after) {
      const game = g();
      const nothing = (why) => { if (after) after({ ok: false, why }); };
      if (!game.ads.canOffer(kind)) { toast(game.ads.left(kind) <= 0 ? 'No more of those today' : 'Nothing for that to do right now'); nothing('limit'); return; }
      const adId = `${kind}:${Date.now().toString(36)}:${Math.floor(Math.random() * 1e6)}`;
      const pay = () => {
        const r = game.ads.reward(kind, adId);
        PE.App.saveGame();
        if (r.ok) toast(r.text);
        if (after) after(r);
      };
      if (game.ads.noAds()) { pay(); return; }
      if (!Store.adsOn()) { toast('Ads are switched off in this build'); nothing('off'); return; }
      let left = PE.Data.shop.pretendAdSeconds;
      const card = () => `<div class="pretend-ad"><b>PRETEND AD</b><p>A real ad would play here.</p><p class="big">${left}</p></div>`;
      PE.Dom.modal({ title: 'Optional ad', html: card(), cls: 'adcard', buttons: [{ label: 'Close (no reward)', style: 'plain', onTap: () => { clearInterval(timer); nothing('closed'); } }] });
      const timer = setInterval(() => {
        left -= 1;
        const box = document.querySelector('#modal .pretend-ad .big');
        if (left > 0) { if (box) box.textContent = left; return; }
        clearInterval(timer);
        if (PE.Dom.modalNow && PE.Dom.modalNow.cls === 'adcard') PE.Dom.nextModal();
        pay();
        if (PE.Dom.panelRoute) PE.Dom.renderPanel();
      }, 1000);
    },
    adButton(kind, label) {
      const game = g();
      if (!Store.adsOn() || !game.ads.canOffer(kind)) return '';
      return `<button class="btn wide ad" data-act="ad:${kind}">${PE.Dom.icon(game.ads.noAds() ? 'RWD-04' : 'STA-05', 22)}${esc(label)} <small>(${game.ads.left(kind)} left today)</small></button>`;
    },
  };
  PE.Store = Store;

  // ---- UI34 Shop ----------------------------------------------------------------------------------------
  PE.Panels.shop = {
    title: 'Shop',
    render() {
      const game = g();
      const P = game.purchases;
      const pay = Store.paymentsOn();
      const st = game.state.currencies;
      const head = PE.Data.shop.switches.realPaymentsEnabled ? ''
        : pay ? '<p class="test-banner">TEST SHOP: pretend payments and ads. No real money.</p>'
          : '<p class="muted">Real purchases and ads are switched off in this build. Everything that helps you play can be earned for free.</p>';
      const products = P.products().map((p) => {
        const owned = P.owns(p.id);
        const right = owned ? (p.kind === 'pass' ? `<span class="tag go">Active</span>` : '<span class="tag go">Owned</span>')
          : `<button class="btn small ${pay ? 'buy' : 'cant'}" data-act="buy:${p.id}" ${pay ? '' : 'aria-disabled="true"'}>A$${P.priceAud(p.id).toFixed(2)}</button>`;
        return `<div class="item"><div class="grow"><b>${esc(p.name)}</b><small>${esc(p.text)}</small>${p.kind === 'pass' && owned ? `<small>Ends ${new Date(P.passEndsMs()).toLocaleDateString()}</small>` : ''}</div>${right}</div>`;
      }).join('');
      const items = P.shopItems().map((it) => {
        const owned = !it.repeat && P.itemOwned(it.id);
        const cur = PE.Dom.icon(it.currency === 'rainbowGems' ? 'CUR-02' : 'CUR-06', 18);
        return `<div class="item"><div class="grow"><b>${esc(it.name)}</b></div>${owned ? '<span class="tag go">Owned</span>' : `<button class="btn small ${game.canAfford(it.currency, it.cost) ? 'buy' : 'cant'}" data-act="item:${it.id}">${cur} ${it.cost}</button>`}</div>`;
      }).join('');
      const themes = P.themes().map((t) => `<button class="chip ${P.theme().name === t.name ? 'on' : ''}" data-act="theme:${t.id}" ${t.owned ? '' : 'aria-disabled="true"'}>${t.owned ? '' : PE.Dom.icon('SYS-06', 16)}${esc(t.name)}</button>`).join('');
      const ads = Store.adsOn() ? `<h4>Optional ads</h4><p class="muted">Never needed. ${game.ads.usedToday()} of ${game.B.rewardedAdLimitsPerDay.total} used today.</p>
        ${Store.adButton('harvestQualityReward', 'Next seed you plant is at least Premium') || '<p class="muted">Other ad rewards appear on the welcome-back, tasks and delivery screens when they can help.</p>'}` : '';
      return `${head}
        <p><b>${PE.Dom.icon('CUR-02', 22)} ${Money.format(st.rainbowGems)} Rainbow Gems · ${PE.Dom.icon('CUR-06', 22)} ${Money.format(st.festivalTickets)} Festival Tickets</b></p>
        <h4>Store</h4>${products}
        <button class="btn wide plain" data-act="restore">Restore purchases</button>
        <h4>Spend gems and tickets</h4><p class="muted">Cosmetics and small time-savers only.</p>${items}
        <h4>Room theme</h4><div class="chips">${themes}</div>
        ${ads}`;
    },
    actions: {
      buy(id) { Store.buy(id); },
      restore() { Store.restore(); },
      item(id) {
        const r = g().purchases.buyItem(id);
        if (r.ok) toast(r.text); else toast(r.why === 'gems' ? 'Not enough Rainbow Gems' : r.why === 'tickets' ? 'Not enough Festival Tickets' : 'Already owned');
        PE.App.saveGame();
      },
      theme(id) {
        if (!g().purchases.setTheme(id)) { toast('Get this theme first'); return; }
        PE.App.saveGame();
        PE.Look.redrawRoom();
        toast(`Theme: ${g().purchases.theme().name}`);
      },
      ad(kind) { Store.watchAd(kind); },
    },
  };

  // Optional ads where they help: tasks (extra wheel spin) and contracts (finish a delivery).
  const baseTasks = PE.Panels.tasks.render;
  PE.Panels.tasks.render = (p) => baseTasks(p).replace('<h4>', `${Store.adButton('extraWheelSpins', 'Extra prize wheel spin')}<h4>`);
  PE.Panels.tasks.actions.ad = (kind) => Store.watchAd(kind);
  const baseContracts = PE.Panels.contracts.render;
  PE.Panels.contracts.render = (p) => Store.adButton('deliverySpeedUp', 'Finish the next delivery now') + baseContracts(p);
  PE.Panels.contracts.actions.ad = (kind) => Store.watchAd(kind);
})(globalThis.PE = globalThis.PE || {});
