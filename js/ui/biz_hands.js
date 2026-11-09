// Job 19: shops and the factory, hands-on (the same way as the grow room in job 18). Touch the thing itself:
//   - Shop shelves: tap a shelf and a small stash of your products pops up beside it, with what's on that shelf now.
//     Drag a product onto any shelf to stock it (or just tap it to stock the shelf you tapped). Tap anywhere else to
//     close it.
//   - Factory machines: tap an idle machine to start its last product again (a machine that's never made anything, or
//     can't make it now, opens the recipe cards: a list of choices). A finished batch pops out with a bounce into a
//     little crate beside the machine: tap the crate (or the machine) to collect it. Tap a busy machine to see how long.
//   - Every shelf and machine has a small upgrade tag on its top corner: one tap opens its upgrade, lit up.
// The room itself is js/ui/biz_room.js; the rules are js/logic/business.js. Placeholder art: the crate is drawn by the
// game (no crate picture yet), with the batch's product picture on it.
(function (PE) {
  const $ = (id) => document.getElementById(id);
  const esc = (t) => PE.Dom.esc(String(t));
  const calm = () => (PE.App && PE.App.state.settings.reducedMotion);
  const scene = () => { const s = PE.App.game.scene.getScene('bizroom'); return s && s.scene.isActive() && s.ready ? s : null; };
  const worth = (n) => '$' + PE.Money.format(n);

  const Hands = {
    stashAt: null,
    drag: null,

    // ---- The upgrade tag ------------------------------------------------------------------------------------------
    // Where it sits on a shelf or machine (room units): its top left corner.
    tagSpot(s, i) { const c = s.spot(i); return { x: c.x - 165, y: c.y - 255 }; },
    drawTag(s, v, i) {
      if (v.tag) return;
      const p = Hands.tagSpot(s, i);
      const c = s.add.container(p.x, p.y).setDepth(90001);
      const g = s.add.graphics();
      g.fillStyle(0x140a24, 1).fillCircle(0, 0, 44);
      g.fillStyle(0xc6ff3d, 1).fillCircle(0, 0, 37);
      g.fillStyle(0x140a24, 1).fillTriangle(-17, 8, 17, 8, 0, -18).fillRect(-7, 6, 14, 16);
      c.add(g);
      v.tag = c;
    },
    tagHit(s, i, x, y) { const p = Hands.tagSpot(s, i); return Math.hypot(x - p.x, y - p.y) < 62; },
    // The shelf or machine's upgrades, in its menu, lit up.
    openUpgrade(fid, i) {
      Hands.closeShelf();
      PE.App.openPanel('business', { fid });
      setTimeout(() => PE.Dom.spotlight && PE.Dom.spotlight(`#panel .row-btns[data-slot="${i}"]`), 60);
      (Hands.log = Hands.log || []).push({ upgrade: i });
    },

    // ---- Shop shelves: the product stash ------------------------------------------------------------------------
    // Everything a shelf can sell: House Bags (your crop) and every product you've unlocked, the ones you have most of first.
    products() {
      const g = PE.App.g;
      const open = g.data.collectibles.products.filter((p) => g.state.collections.productsUnlocked[p.id]);
      const list = [{ id: 'CROP', name: 'House Bags', have: g.state.stock.crop }, ...open.map((p) => ({ id: p.id, name: p.name, have: g.stock.getStock(p.id) }))];
      return list.sort((a, b) => (PE.Money.toNumber(b.have) > 0) - (PE.Money.toNumber(a.have) > 0));
    },
    pic(id, size) {
      if (id === 'CROP') return `<img class="biz-pic" src="assets/ui/${PE.GrowTools ? PE.GrowTools.jarArt(9) : 'JAR-02'}.webp" alt="" draggable="false" style="width:${size}px;height:${size}px">`;
      return PE.Dom.productPic ? PE.Dom.productPic(PE.App.g, id, size) : '';
    },
    openShelf(i) {
      const s = scene();
      if (!s) return;
      Hands.closeShelf();
      const g = PE.App.g, fid = s.fid;
      const slot = g.business.slots(fid)[i];
      const now = slot.sku
        ? `<b>${esc(g.stock.skuName(slot.sku))}</b> · ${worth(slot.sku === 'CROP' ? g.state.stock.crop : g.stock.getStock(slot.sku))} in stock · sells ${(g.business.shelfRatePerMinute(fid, slot) * 100).toFixed(1)}% a minute`
        : 'Empty';
      const box = document.createElement('div');
      box.id = 'shelf-stash';
      box.innerHTML = `<div class="stash-head">Shelf ${i + 1}: ${now}</div><div class="stash-head sub">Drag a product onto a shelf</div><div class="stash-row">${Hands.products().map((p) => {
        const none = !(PE.Money.toNumber(p.have) > 0);
        return `<button class="stash-seed biz-prod ${none ? 'none' : ''} ${slot.sku === p.id ? 'on' : ''}" data-sku="${p.id}" aria-label="${esc(p.name)}">${Hands.pic(p.id, 46)}<small>${esc(p.name)}</small><small class="have">${none ? 'none yet' : worth(p.have)}</small></button>`;
      }).join('')}<button class="stash-seed more" data-up="1" aria-label="Upgrade this shelf"><span class="more-plus">&#9650;</span><small>Upgrade</small></button></div>`;
      $('ui').appendChild(box);
      const at = s.spotPagePoint(i);
      const u = $('ui').getBoundingClientRect();
      const W = u.width, bw = Math.min(W - 16, box.offsetWidth), bh = box.offsetHeight;
      const left = Math.max(8, Math.min(W - bw - 8, at.x - u.left - bw / 2));
      const z = s.cameras.main.zoom * (u.width / s.scale.width);
      let top = at.y - u.top - 270 * z - bh - 8;
      if (top < 90) top = at.y - u.top + 200 * z;
      top = Math.max(8, Math.min(u.height - bh - 140, top));
      box.style.left = `${left}px`;
      box.style.top = `${top}px`;
      Hands.stashAt = { fid, i, box };
      box.addEventListener('pointerdown', (e) => {
        const b = e.target.closest('[data-sku],[data-up]');
        if (!b) return;
        e.preventDefault();
        e.stopPropagation();
        if (b.dataset.up) { Hands.openUpgrade(fid, i); return; }
        Hands.begin(e, b.dataset.sku, b);
      });
      Hands.outside = (e) => { if (Hands.stashAt && !Hands.stashAt.box.contains(e.target) && !Hands.drag) { Hands.closeShelf(); Hands.swallowUntil = performance.now() + 600; } };
      setTimeout(() => window.addEventListener('pointerdown', Hands.outside, true), 0);
    },
    // Is this tap the one that just closed the stash? (The room ignores it.)
    swallowTap() { const yes = performance.now() < (Hands.swallowUntil || 0); Hands.swallowUntil = 0; return yes; },
    closeShelf() {
      if (Hands.outside) { window.removeEventListener('pointerdown', Hands.outside, true); Hands.outside = null; }
      if (Hands.stashAt) { Hands.stashAt.box.remove(); Hands.stashAt = null; }
    },
    stock(fid, i, sku) {
      const g = PE.App.g;
      const slot = g.business.slots(fid)[i];
      if (!slot) return false;
      g.business.setShelf(fid, i, sku);
      PE.Sound.play && PE.Sound.play('plant');
      PE.Dom.toast(`Shelf ${i + 1}: ${g.stock.skuName(sku)}`, '', 'ACT-03');
      (Hands.log = Hands.log || []).push({ stocked: i, sku });
      PE.App.saveGame();
      return true;
    },
    // A product follows your finger; let go over a shelf to stock it.
    begin(e, sku, from) {
      const ghost = document.createElement('div');
      ghost.className = 'biz-ghost';
      ghost.innerHTML = Hands.pic(sku, 64);
      ghost.style.visibility = 'hidden';
      $('ui').appendChild(ghost);
      Hands.drag = { sku, ghost, sx: e.clientX, sy: e.clientY, moved: false, id: e.pointerId };
      Hands.place(e.clientX, e.clientY);
      const move = (ev) => {
        const d = Hands.drag;
        if (!d) return;
        if (!d.moved && Math.hypot(ev.clientX - d.sx, ev.clientY - d.sy) > 12) { d.moved = true; ghost.style.visibility = ''; }
        Hands.place(ev.clientX, ev.clientY);
        const s = scene(), over = d.moved && s ? s.slotAtPage(ev.clientX, ev.clientY - 40) : null;
        if (s) s.dropGlow(over);
      };
      const up = (ev) => {
        window.removeEventListener('pointermove', move, true);
        window.removeEventListener('pointerup', up, true);
        window.removeEventListener('pointercancel', up, true);
        const d = Hands.drag;
        Hands.drag = null;
        ghost.remove();
        const s = scene();
        if (s) s.dropGlow(null);
        if (!d || !s || !Hands.stashAt) return;
        const { fid, i } = Hands.stashAt;
        if (!d.moved) { if (Hands.stock(fid, i, d.sku)) Hands.closeShelf(); return; }
        const at = s.slotAtPage(ev.clientX, ev.clientY - 40);
        if (at !== null && Hands.stock(fid, at, d.sku)) Hands.closeShelf();
      };
      window.addEventListener('pointermove', move, true);
      window.addEventListener('pointerup', up, true);
      window.addEventListener('pointercancel', up, true);
    },
    place(x, y) {
      const d = Hands.drag;
      if (!d) return;
      const u = $('ui').getBoundingClientRect();
      d.ghost.style.transform = `translate(${x - u.left - 32}px, ${y - u.top - 96}px)`;
    },

    // ---- Factory machines -----------------------------------------------------------------------------------------
    // A tap on a machine: collect, start again, or say how it's going.
    tapMachine(s, i) {
      const g = PE.App.g, fid = s.fid, b = g.business;
      const slot = b.slots(fid)[i];
      if (slot.job) {
        if (g.now() >= slot.job.endMs && !b.lineWaiting(fid, slot)) { Hands.collect(s, i); return; }
        if (b.lineWaiting(fid, slot)) { PE.Dom.toast(`The ${g.stock.skuName(slot.sku)} store is full. Sell some and it comes in.`); return; }
        PE.Dom.toast(`${g.stock.skuName(slot.sku)}: ${PE.Dom.duration ? PE.Dom.duration((slot.job.endMs - g.now()) / 1000) : Math.ceil((slot.job.endMs - g.now()) / 1000) + ' s'} to go`, '', 'STA-02');
        return;
      }
      // Idle: the last product again, if the recipe's all there. Otherwise the recipe cards.
      if (slot.sku && b.recipe(fid, i, slot.sku).ok) {
        const r = b.startLine(fid, i, slot.sku);
        if (r.ok) {
          PE.Dom.toast(`Making ${g.stock.skuName(slot.sku)}`, '', 'STA-02');
          s.machineBump(i);
          (Hands.log = Hands.log || []).push({ started: i, sku: slot.sku });
          PE.App.saveGame();
          return;
        }
      }
      PE.App.openPanel('skuPicker', { fid, i, mode: s.row.mode });
    },
    // The crate's tapped (or the machine): the batch goes into your stock.
    collect(s, i) {
      const g = PE.App.g;
      const slot = g.business.slots(s.fid)[i];
      const sku = slot && slot.sku;
      const r = g.business.claimLine(s.fid, i);
      if (r && r.ok === false) { if (r.why === 'storeFull') PE.Dom.toast('That store is full. Nothing is lost: it waits here.'); return; }
      s.crateCollected(i);
      PE.Dom.toast(`Batch collected! ${sku ? g.stock.skuName(sku) : ''}`, '', 'ACT-03');
      (Hands.log = Hands.log || []).push({ collected: i, sku });
      PE.App.saveGame();
    },
  };

  // ---- The crate, in the room ----------------------------------------------------------------------------------------
  // Drawn by the game for now: a wooden crate with the product's picture on its side.
  Hands.crateTexture = function crateTexture(s) {
    if (s.textures.exists('biz-crate')) return;
    const G = s.make.graphics({ x: 0, y: 0, add: false });
    G.fillStyle(0x000000, 0.25).fillEllipse(80, 150, 150, 22);
    G.fillStyle(0x8a5a2b, 1).fillRoundedRect(8, 30, 144, 116, 10);
    G.fillStyle(0xb57a3c, 1).fillRoundedRect(14, 36, 132, 104, 8);
    G.fillStyle(0x8a5a2b, 1).fillRect(14, 62, 132, 8).fillRect(14, 104, 132, 8);
    G.lineStyle(6, 0x5e3a17, 1).strokeRoundedRect(8, 30, 144, 116, 10);
    G.fillStyle(0xc6ff3d, 1).fillRoundedRect(0, 18, 160, 18, 8);
    G.generateTexture('biz-crate', 160, 160);
    G.destroy();
  };
  PE.BizHands = Hands;
})(globalThis.PE = globalThis.PE || {});
