// Purchases and rewarded ads (bible section 11). Rules only: the store and the ad player themselves
// are "adapters" in js/ui/store.js. Today the only adapters are PRETEND ones for testing; real store
// and ad adapters slot in later behind the same calls.
//
// Purchases: every receipt is checked (receipt validation) and paid exactly once, by its transaction
// id. Restore replays the store's receipts: it brings back what you OWN (no-ads, themes, titles, a
// pass still running), never consumable currency, so restoring can't be used to farm gems or cash.
// Ads: opt-in only, daily limits per reward and in total. The no-ads purchase gives the same capped
// rewards without watching.
(function (PE) {
  const { Money } = PE;
  // The pretend store signs its receipts with this. A real store's receipts are checked by its own
  // rules (and ideally a server) instead: see docs/RELEASE_CHECKLIST.md.
  const PRETEND_SECRET = 'pot-empire-pretend-store-v1';
  function sign(r) { return PE.Save.checksum(`${PRETEND_SECRET}|${r.productId}|${r.txId}|${r.purchasedAtMs}`); }
  function verify(r) {
    return !!r && typeof r.productId === 'string' && typeof r.txId === 'string' && Number.isFinite(r.purchasedAtMs) && r.signature === sign(r);
  }

  PE.Game.register('purchases', (g) => {
    const { state, data, B } = g;
    const S = () => data.shop;
    const product = (id) => S().products.find((p) => p.id === id);
    const ent = () => state.entitlements;
    const dayOf = (ms) => Math.floor(ms / 86400000);

    function cashFromHarvests(n) { return Math.max(n * 10, Math.round(state.meta.typicalHarvest * n)); }

    // Gives what a product or shop item contains. full = false gives only what you keep (restore).
    function give(grants, full, why, passUntilMs) {
      const text = [];
      if (full && grants.cashHarvests) { const c = cashFromHarvests(grants.cashHarvests); g.earn('cash', c, why); text.push(`$${Money.format(c)}`); }
      if (full && grants.collectionTokens) { g.earn('collectionTokens', grants.collectionTokens, why); text.push(`${grants.collectionTokens} Collection Tokens`); }
      if (full && grants.gems) { g.earn('rainbowGems', grants.gems, why); text.push(`${grants.gems} Rainbow Gems`); }
      if (grants.title && !state.player.titles.includes(grants.title)) { state.player.titles.push(grants.title); text.push(`Title: ${grants.title}`); }
      if (grants.theme) { ent().themes[grants.theme] = true; text.push(`Theme: ${S().themes[grants.theme].name}`); }
      if (grants.entitlement === 'noAds') { ent().noAds = true; text.push('No-ads convenience'); }
      if (grants.entitlement === 'eventPass') { ent().passUntilMs = Math.max(ent().passUntilMs || 0, passUntilMs); text.push('Event pass'); g.effects.invalidate(); }
      if (full && grants.finishDelivery) text.push(g.ads.finishDelivery() ? 'A delivery finished' : 'No delivery was running');
      return text.join(', ');
    }

    function owns(id) {
      const p = product(id);
      if (!p) return false;
      if (p.kind === 'pass') return g.purchases.passActive();
      if (p.kind === 'consumable') return false;
      return state.purchases.some((x) => x.productId === id);
    }

    // A receipt from the store (bought now, or replayed by restore). Paid once per transaction id.
    function applyReceipt(receipt, restoring) {
      if (!verify(receipt)) return { ok: false, why: 'invalid' };
      const p = product(receipt.productId);
      if (!p) return { ok: false, why: 'unknown' };
      if (restoring && p.kind === 'consumable') return { ok: false, why: 'consumable' };
      const passUntilMs = p.kind === 'pass' ? receipt.purchasedAtMs + p.passDays * 86400000 : 0;
      if (restoring && p.kind === 'pass' && passUntilMs <= g.now()) return { ok: false, why: 'expired' };
      let text = '';
      const ran = g.once(`purchase:${receipt.txId}`, () => {
        // Restoring on a phone that never had it: give what you keep. A fresh purchase gives it all.
        text = give(p.grants, !restoring, 'purchase', passUntilMs);
        state.purchases.push({ txId: receipt.txId, productId: p.id, atUtc: new Date(receipt.purchasedAtMs).toISOString(), restored: !!restoring });
        g.emit('purchased', { productId: p.id, restored: !!restoring });
        g.emit('changed');
      });
      return ran ? { ok: true, text } : { ok: false, why: 'already' };
    }

    g.purchases = {
      sign, verify,
      products: () => S().products,
      product,
      priceAud: (id) => B.shopAud[product(id).priceKey],
      owns,
      // Can this be bought right now? (one-time things only once, a pass not while it's running)
      canBuy: (id) => !!product(id) && !owns(id),
      applyReceipt: (r) => applyReceipt(r, false),
      // Replays the store's receipt list. Returns how many came back.
      restore(receipts) {
        let restored = 0, skipped = 0;
        for (const r of receipts || []) { if (applyReceipt(r, true).ok) restored++; else skipped++; }
        return { restored, skipped };
      },
      passActive: () => (ent().passUntilMs || 0) > g.now(),
      passEndsMs: () => ent().passUntilMs || 0,

      // Gem and ticket shop: cosmetics and small conveniences.
      shopItems: () => S().gemItems,
      buyItem(id) {
        const it = S().gemItems.find((x) => x.id === id);
        if (!it) return { ok: false, why: 'unknown' };
        if (!it.repeat && state.shopOwned[id]) return { ok: false, why: 'owned' };
        if (!g.spend(it.currency, it.cost, 'shop')) return { ok: false, why: it.currency === 'rainbowGems' ? 'gems' : 'tickets' };
        if (!it.repeat) state.shopOwned[id] = true;
        const text = give(it.grants, true, 'shop');
        g.emit('changed');
        return { ok: true, text };
      },
      itemOwned: (id) => !!state.shopOwned[id],

      themes: () => Object.entries(S().themes).map(([id, t]) => ({ id, name: t.name, owned: id === 'default' || !!ent().themes[id] })),
      theme: () => S().themes[state.ui.theme && (state.ui.theme === 'default' || ent().themes[state.ui.theme]) ? state.ui.theme : 'default'],
      setTheme(id) {
        if (id !== 'default' && !ent().themes[id]) return false;
        state.ui.theme = id;
        g.emit('changed');
        return true;
      },
    };

    // The event pass: +25% Festival Tickets from tiers while it runs (cosmetic-side, non-essential).
    g.effects.addProvider(() => (g.purchases.passActive() ? [{ key: 'festivalReward', value: 0.25, group: 'eventPass' }] : []));

    // ---- Rewarded ads -------------------------------------------------------------------------------
    const L = () => B.rewardedAdLimitsPerDay;
    function adDay() {
      const day = dayOf(g.now());
      if (state.ads.day !== day) { state.ads.day = day; state.ads.counts = {}; }
      return state.ads;
    }
    function left(kind) {
      const a = adDay();
      const used = Object.values(a.counts).reduce((x, y) => x + y, 0);
      return Math.max(0, Math.min(L()[kind] - (a.counts[kind] || 0), L().total - used));
    }
    function finishDelivery() {
      for (const fid of g.business.ids('Logistics')) {
        const r = g.business.slots(fid).filter((x) => x.job && x.job.endMs > g.now()).sort((a, b) => a.job.endMs - b.job.endMs)[0];
        if (r) { r.job.endMs = g.now(); g.emit('changed'); return true; }
      }
      return false;
    }
    // Can this reward be offered at all right now? (something for it to act on)
    function usable(kind, ctx) {
      if (kind === 'doubleOfflineClaim') return !!state.pendingOffline && state.pendingOffline.cash > 0;
      if (kind === 'extraWheelSpins') return g.meta.wheelUsed();
      if (kind === 'deliverySpeedUp') return g.business.ids('Logistics').some((f) => g.business.slots(f).some((x) => x.job && x.job.endMs > g.now()));
      if (kind === 'harvestQualityReward') return !state.ads.qualityBoost;
      return false;
    }

    g.ads = {
      left,
      usedToday: () => Object.values(adDay().counts).reduce((x, y) => x + y, 0),
      usable,
      canOffer: (kind) => left(kind) > 0 && usable(kind),
      noAds: () => !!ent().noAds,
      finishDelivery,
      // Gives the reward for one watched ad (or one no-ads tap). adId makes it pay once only.
      reward(kind, adId) {
        if (left(kind) <= 0) return { ok: false, why: 'limit' };
        if (!usable(kind)) return { ok: false, why: 'nothing' };
        let res = { ok: false, why: 'already' };
        g.once(`ad:${adId}`, () => {
          adDay().counts[kind] = (adDay().counts[kind] || 0) + 1;
          if (kind === 'doubleOfflineClaim') {
            const r = g.offline.claim();
            const extra = r ? r.cash : 0;
            if (r) g.once(`ad:double:${r.txId}`, () => g.earn('cash', extra, 'ad'));
            res = { ok: true, text: `+$${Money.format(extra)} extra` };
          } else if (kind === 'extraWheelSpins') {
            const s = g.meta.spinBonus(`ad:${adId}`);
            res = { ok: true, text: `Prize: ${s.text}` };
          } else if (kind === 'deliverySpeedUp') {
            finishDelivery();
            res = { ok: true, text: 'Delivery finished' };
          } else if (kind === 'harvestQualityReward') {
            state.ads.qualityBoost = true;
            res = { ok: true, text: 'Your next seed planted by hand will be at least Premium' };
          }
          g.emit('changed');
        });
        return res;
      },
      // Used once by the next seed planted by hand (js/logic/grow.js).
      takeQualityBoost() {
        if (!state.ads.qualityBoost) return false;
        state.ads.qualityBoost = false;
        return true;
      },
    };

    // A pass that ran out while the game was open: effects are worked out again once.
    const baseTick = g.tick;
    let lastTickMs = g.now();
    g.tick = function tick() {
      baseTick();
      const now = g.now();
      const ends = ent().passUntilMs || 0;
      if (lastTickMs < ends && ends <= now) g.effects.invalidate();
      lastTickMs = now;
    };
  });
})(globalThis.PE = globalThis.PE || {});
