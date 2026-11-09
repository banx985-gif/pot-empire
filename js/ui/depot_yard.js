// Job 20: the Distribution Depot, hands-on. Your vans stand at their bays in the yard; the contracts on offer wait on
// the loading dock as crates, each with what it wants on its side. Drag a crate onto a van to load it: the van is full
// and drives out (on the map it drives the roads, js/ui/empire_map_life.js), delivers, and comes back. When it's back
// in the yard the crate's reward pops. Tap a van to see what's on board and when it's back; tap a crate to see what
// the order wants. The green up-arrow tag on each bay opens that route in the depot's menu, lit up; the one on a van
// opens its card in the vehicle collection. The rules are js/logic/business.js; the Contracts tab keeps the list.
// Placeholder art: no depot room picture yet, so the yard, bays and dock are drawn by the game; the crates are the
// game-drawn crate from the factory (js/ui/biz_hands.js).
(function (PE) {
  const FONT = 'system-ui, sans-serif';
  const MAX_CRATES = 4;
  const worth = (n) => '$' + PE.Money.format(n);

  class DepotYard extends Phaser.Scene {
    constructor() { super('depot'); }
    init(params) { this.fid = params.fid; }
    calm() { return PE.App.state.settings.reducedMotion; }

    create() {
      this.g = PE.App.g;
      this.ready = false;
      this.cameras.main.setBackgroundColor('#2a2438');
      this.bays = [];
      this.crates = [];
      this.log = [];          // what happened, for the tests
      this.layoutYard();
      this.drawYard();
      this.setUpInput();
      this.unsub = this.g.on((type) => { if (type === 'changed') this.dirty = true; });
      this.events.once('shutdown', () => { this.ready = false; this.unsub(); PE.EdgeArrows && PE.EdgeArrows.update(this, []); });
      this.ready = true;
      this.dirty = true;
      this.refresh();
      if (!this.calm()) this.cameras.main.fadeIn(170, 20, 10, 36);
      PE.Hud.refresh();
    }

    // ---- Where everything goes (screen units, the camera doesn't move) -------------------------------------------
    layoutYard() {
      const L = PE.UI.layout(this);
      this.L = L;
      const u = L.u;
      const top = L.top + 96 * u, bottom = L.bottom - 168 * u;
      this.dock = { x: L.left + 10 * u, y: top, w: L.right - L.left - 20 * u, h: 150 * u };
      const routes = this.g.business.slots(this.fid).length;
      const cols = routes > 1 ? 2 : 1;
      const rows = Math.max(1, Math.ceil(routes / cols));
      const y0 = this.dock.y + this.dock.h + 26 * u;
      const cellW = (L.right - L.left - 20 * u) / cols, cellH = Math.min(260 * u, (bottom - y0) / rows);
      this.cells = [];
      for (let i = 0; i < routes; i++) {
        const c = i % cols, r = Math.floor(i / cols);
        this.cells.push({ x: L.left + 10 * u + c * cellW, y: y0 + r * cellH, w: cellW, h: cellH });
      }
      this.exitY = L.bottom + 140 * u;   // where vans drive off to (off the bottom of the screen)
    }
    drawYard() {
      const { L } = this;
      const u = L.u;
      const G = this.add.graphics().setDepth(0);
      // Tarmac, the dock and the bays.
      G.fillStyle(0x3a3448, 1).fillRect(0, 0, L.W, L.H);
      for (let y = 0; y < L.H; y += 46 * u) G.fillStyle(0x342e42, 1).fillRect(0, y, L.W, 22 * u);
      const D = this.dock;
      G.fillStyle(0x6b4a2b, 1).fillRoundedRect(D.x, D.y, D.w, D.h, 14 * u);
      G.fillStyle(0x8a5f36, 1).fillRoundedRect(D.x + 6 * u, D.y + 6 * u, D.w - 12 * u, D.h - 20 * u, 10 * u);
      G.fillStyle(0xffd84d, 1);
      for (let x = D.x + 8 * u; x < D.x + D.w - 20 * u; x += 40 * u) G.fillRect(x, D.y + D.h - 12 * u, 20 * u, 8 * u);
      this.add.text(D.x + 14 * u, D.y + 8 * u, 'LOADING DOCK', { fontFamily: FONT, fontStyle: '900', fontSize: L.font(12), color: '#ffe9b0' }).setDepth(1);
      this.cells.forEach((c, i) => {
        G.lineStyle(4 * u, 0xffffff, 0.75);
        G.beginPath(); G.moveTo(c.x + 8 * u, c.y + 8 * u); G.lineTo(c.x + 8 * u, c.y + c.h - 8 * u); G.moveTo(c.x + c.w - 8 * u, c.y + 8 * u); G.lineTo(c.x + c.w - 8 * u, c.y + c.h - 8 * u); G.strokePath();
        this.add.text(c.x + c.w / 2, c.y + c.h - 30 * u, `BAY ${i + 1}`, { fontFamily: FONT, fontStyle: '900', fontSize: L.font(13), color: '#ffffffaa' }).setOrigin(0.5).setDepth(1);
        const bay = { i, c, van: null, vid: null, sign: null, bar: this.add.graphics().setDepth(6), state: 'empty' };
        bay.sign = this.add.text(c.x + c.w / 2, c.y + c.h - 52 * u, '', { fontFamily: FONT, fontStyle: 'bold', fontSize: L.font(13), color: '#ffffff', align: 'center', stroke: '#1d0f33', strokeThickness: 4 * u }).setOrigin(0.5).setDepth(7);
        bay.tag = this.makeTag(c.x + 30 * u, c.y + 28 * u);
        this.bays.push(bay);
      });
      this.glow = this.add.graphics().setDepth(5);
    }
    // The green up-arrow tag (the same as on shelves and machines).
    makeTag(x, y, size = 1) {
      const u = this.L.u * size;
      const c = this.add.container(x, y).setDepth(9);
      const g = this.add.graphics();
      g.fillStyle(0x140a24, 1).fillCircle(0, 0, 17 * u);
      g.fillStyle(0xc6ff3d, 1).fillCircle(0, 0, 14 * u);
      g.fillStyle(0x140a24, 1).fillTriangle(-7 * u, 3 * u, 7 * u, 3 * u, 0, -8 * u).fillRect(-3 * u, 2 * u, 6 * u, 7 * u);
      c.add(g);
      c.r = 22 * u;
      return c;
    }
    vanH() { return Math.min(this.cells[0] ? this.cells[0].h * 0.95 : 200, 230 * this.L.u); }
    parkAt(bay) { return { x: bay.c.x + bay.c.w / 2, y: bay.c.y + bay.c.h * 0.78 }; }

    // ---- Keeping the yard up to date --------------------------------------------------------------------------------
    update(time) {
      if (!this.ready) return;
      PE.Anim.stepAll(this, Math.min(0.1, (this.game.loop.delta || 16) / 1000));
      if (this.dirty || time - (this.last || 0) > 500) { this.last = time; this.dirty = false; this.refresh(); }
    }
    refresh() {
      const b = this.g.business, fid = this.fid;
      b.ensureOffers();
      const routes = b.slots(fid);
      if (routes.length !== this.bays.length) { this.scene.restart({ fid }); return; }
      // Every bay gets a van: its own, or a free one you own.
      const owned = this.g.data.collectibles.vehicles.filter((v) => this.g.state.collections.owned[v.id]).map((v) => v.id);
      const taken = new Set(routes.map((r) => r.vehicle).filter(Boolean));
      routes.forEach((r, i) => {
        if (!r.vehicle && !r.job) { const v = owned.find((id) => !taken.has(id)); if (v) { b.setRouteVehicle(fid, i, v); taken.add(v); } }
      });
      const now = this.g.now();
      routes.forEach((r, i) => this.syncBay(this.bays[i], r, now));
      this.syncCrates();
    }
    syncBay(bay, r, now) {
      const u = this.L.u;
      const want = r.job ? (now >= r.job.endMs ? 'back' : 'out') : r.vehicle ? 'parked' : 'empty';
      if (bay.vid !== r.vehicle || !bay.van) {
        if (bay.van) bay.van.destroy();
        bay.van = null;
        bay.vid = r.vehicle;
        if (r.vehicle) {
          const p = this.parkAt(bay);
          bay.van = new PE.Anim.Actor(this, r.vehicle, { x: p.x, y: p.y, height: this.vanH(), depth: 4 });
          bay.van.play('parked');
          if (bay.vanTag) bay.vanTag.destroy();
          bay.vanTag = this.makeTag(bay.c.x + bay.c.w - 30 * u, bay.c.y + 28 * u, 0.9);
        }
        bay.state = null;
      }
      if (want !== bay.state) {
        const was = bay.state;
        bay.state = want;
        if (want === 'out') this.driveOut(bay, was === 'parked');
        else if (want === 'back') this.driveIn(bay, r);
        else if (want === 'parked' && bay.van) { const p = this.parkAt(bay); bay.van.moveTo(p.x, p.y); bay.van.image.setVisible(true).setAlpha(1); bay.van.play('parked'); }
      }
      // The bay's sign and the time bar.
      bay.bar.clear();
      if (want === 'out') {
        const t = Math.min(1, (now - r.job.startMs) / (r.job.endMs - r.job.startMs));
        bay.sign.setText(`Out on ${r.job.offer.name}\nback in ${PE.Dom.duration((r.job.endMs - now) / 1000)}`);
        const c = bay.c, w = c.w - 40 * u;
        bay.bar.fillStyle(0x000000, 0.6).fillRect(c.x + 20 * u, c.y + c.h - 18 * u, w, 10 * u);
        bay.bar.fillStyle(0xc6ff3d, 1).fillRect(c.x + 20 * u, c.y + c.h - 18 * u, w * t, 10 * u);
      } else if (want === 'parked') bay.sign.setText('Drag a crate on');
      else if (want === 'empty') bay.sign.setText('No van yet');
      else bay.sign.setText('');
    }
    // Loaded: off it drives, out of the yard (and onto the map's roads).
    driveOut(bay, animate) {
      if (!bay.van) return;
      const van = bay.van;
      this.log.push({ out: bay.i, vid: bay.vid });
      if (!animate || this.calm()) { van.image.setVisible(false); return; }
      van.heading(0, 1);
      const p = { y: van.y };
      this.tweens.add({ targets: p, y: this.exitY, duration: 1300, ease: 'Sine.easeIn', onUpdate: () => van.moveTo(van.x, p.y), onComplete: () => van.image.setVisible(false) });
    }
    // Back from the delivery: it drives in to its bay, and the crate's reward pops.
    driveIn(bay, r) {
      const van = bay.van;
      const done = () => {
        const res = this.g.business.claimRoute(this.fid, bay.i);
        if (van) van.play('parked');
        if (res && res.ok) {
          const p = this.parkAt(bay);
          this.popReward(p.x, p.y - this.vanH() * 0.45, res.cash);
          PE.Dom.toast(`Delivered: +${worth(res.cash)}`, '', 'CUR-01');
          this.log.push({ back: bay.i, cash: res.cash });
          PE.App.saveGame();
        }
      };
      if (!van) { done(); return; }
      const p = this.parkAt(bay);
      van.image.setVisible(true).setAlpha(1);
      if (this.calm()) { van.moveTo(p.x, p.y); done(); return; }
      const s = { y: this.exitY };
      van.moveTo(p.x, s.y);
      van.heading(0, -1);
      this.tweens.add({ targets: s, y: p.y, duration: 1200, ease: 'Sine.easeOut', onUpdate: () => van.moveTo(p.x, s.y), onComplete: done });
    }
    popReward(x, y, cash) {
      const u = this.L.u;
      const t = this.add.text(x, y, `+${worth(cash)}`, { fontFamily: FONT, fontStyle: '900', fontSize: this.L.font(26), color: '#c6ff3d', stroke: '#1d0f33', strokeThickness: 6 * u }).setOrigin(0.5).setDepth(50);
      if (this.calm()) { this.time.delayedCall(1200, () => t.destroy()); return; }
      t.setScale(0.4);
      this.tweens.add({ targets: t, scale: 1.15, duration: 260, ease: 'Back.easeOut' });
      this.tweens.add({ targets: t, y: y - 90 * u, alpha: 0, delay: 700, duration: 700, onComplete: () => t.destroy() });
      const r = this.game.canvas.getBoundingClientRect();
      if (PE.Juice) PE.Juice.coins(r.left + (x * r.width) / this.scale.width, r.top + (y * r.height) / this.scale.height, 6);
    }

    // ---- The crates on the dock: the contracts on offer --------------------------------------------------------------
    syncCrates() {
      const offers = this.g.state.depot.offers.slice(0, MAX_CRATES);
      const sig = offers.map((o) => o.id).join('|');
      if (sig === this.crateSig) return;
      this.crateSig = sig;
      this.crates.forEach((c) => c.box.destroy());
      this.crates = [];
      PE.BizHands.crateTexture(this);
      const D = this.dock, u = this.L.u;
      const n = Math.max(1, offers.length);
      const step = D.w / n;
      offers.forEach((o, k) => {
        const x = D.x + step * (k + 0.5), y = D.y + D.h * 0.62;
        const box = this.add.container(x, y).setDepth(20);
        const size = Math.min(92 * u, step * 0.8);
        box.add(this.add.image(0, 0, 'biz-crate').setDisplaySize(size, size));
        const pic = o.sku === 'CROP' ? 'JAR-02' : o.sku;
        const put = () => { if (box.scene && this.textures.exists('ui-' + pic)) { const im = this.add.image(0, -size * 0.12, 'ui-' + pic); im.setScale((size * 0.45) / Math.max(im.width, im.height)); box.add(im); } };
        if (this.textures.exists('ui-' + pic)) put(); else PE.UI.loadIcons(this, [pic], put);
        const label = this.add.text(0, size * 0.5 + 2 * u, worth(this.quoteFor(o).reward), { fontFamily: FONT, fontStyle: '900', fontSize: this.L.font(13), color: '#c6ff3d', stroke: '#1d0f33', strokeThickness: 4 * u }).setOrigin(0.5, 0);
        box.add(label);
        this.crates.push({ o, box, home: { x, y }, size });
      });
    }
    // What a contract would pay with the best free van (or the first you own, just to show a number).
    quoteFor(o) {
      const b = this.g.business, fid = this.fid;
      const routes = b.slots(fid);
      const r = routes.find((x) => x.vehicle && !x.job) || routes.find((x) => x.vehicle);
      return r ? b.quote(fid, o, r.vehicle) : { reward: o.baseReward || 0, amount: 0, seconds: 0 };
    }

    // ---- Touch: drag a crate onto a van, tap a van, a crate or a tag --------------------------------------------------
    setUpInput() {
      const input = this.input;
      const moved = 12 * PE.App.dpr;
      let down = null;
      const menuOpen = () => !!PE.Dom.panelRoute || !!PE.Dom.modalNow;
      input.on('pointerdown', (p) => {
        if (menuOpen() || (p.event && p.event.target !== this.game.canvas)) { down = null; return; }
        const crate = this.crates.find((c) => Math.abs(p.x - c.box.x) < c.size * 0.6 && Math.abs(p.y - c.box.y) < c.size * 0.6);
        down = { x: p.x, y: p.y, id: p.id, crate, moved: false };
        if (crate) crate.box.setDepth(60);
      });
      input.on('pointermove', (p) => {
        if (!down || p.id !== down.id || !p.isDown) return;
        if (!down.moved && Math.hypot(p.x - down.x, p.y - down.y) > moved) down.moved = true;
        if (down.moved && down.crate) { down.crate.box.setPosition(p.x, p.y - 30 * this.L.u); this.showDrop(this.bayAt(p.x, p.y)); }
      });
      input.on('pointerup', (p) => {
        if (!down || p.id !== down.id) return;
        const d = down;
        down = null;
        this.showDrop(null);
        if (d.crate && d.moved) { this.dropCrate(d.crate, this.bayAt(p.x, p.y)); return; }
        if (d.crate) d.crate.box.setDepth(20);
        if (!d.moved) this.tapAt(p.x, p.y, d.crate);
      });
    }
    bayAt(x, y) { return this.bays.find((b) => x >= b.c.x && x <= b.c.x + b.c.w && y >= b.c.y && y <= b.c.y + b.c.h) || null; }
    showDrop(bay) {
      this.glow.clear();
      if (!bay) return;
      const ok = bay.state === 'parked';
      this.glow.lineStyle(6 * this.L.u, ok ? 0xc6ff3d : 0xff2d55, 0.95).strokeRoundedRect(bay.c.x + 4, bay.c.y + 4, bay.c.w - 8, bay.c.h - 8, 16 * this.L.u);
    }
    // A crate let go over a bay: loaded if that van is free; otherwise it slides back to the dock.
    dropCrate(crate, bay) {
      const back = () => { if (!crate.box.scene) return; crate.box.setDepth(20); if (this.calm()) crate.box.setPosition(crate.home.x, crate.home.y); else this.tweens.add({ targets: crate.box, x: crate.home.x, y: crate.home.y, duration: 220, ease: 'Sine.easeOut' }); };
      if (!bay) { back(); return; }
      if (bay.state !== 'parked' || !bay.vid) { PE.Dom.toast(bay.state === 'empty' ? 'No van in that bay yet' : 'That van is out on a delivery'); back(); return; }
      const r = this.g.business.dispatch(this.fid, bay.i, crate.o.id, bay.vid);
      if (!r.ok) {
        PE.Dom.toast({ stock: `Not enough ${this.g.stock.skuName(crate.o.sku)} in stock for that one`, vehicleBusy: 'That van is out on a route' }[r.why] || 'That one can\'t go right now');
        back();
        return;
      }
      this.log.push({ loaded: bay.i, offer: crate.o.id });
      PE.Sound.play && PE.Sound.play('plant');
      crate.box.destroy();
      this.crates = this.crates.filter((c) => c !== crate);
      this.crateSig = null;
      PE.App.saveGame();
      this.refresh();
    }
    tapAt(x, y, crate) {
      const g = this.g;
      for (const bay of this.bays) {
        if (Math.hypot(x - bay.tag.x, y - bay.tag.y) < bay.tag.r) { this.openRoute(bay.i); return; }
        if (bay.vanTag && bay.vid && Math.hypot(x - bay.vanTag.x, y - bay.vanTag.y) < bay.vanTag.r) { this.openVan(bay.vid); return; }
      }
      if (crate) {
        const o = crate.o, q = this.quoteFor(o);
        PE.Dom.toast(`${o.name} wants ${g.stock.skuName(o.sku)}: moves ${worth(q.amount)} of stock, pays ${worth(q.reward)}${q.seconds ? `, ${PE.Dom.duration(q.seconds)} there and back` : ''}. Drag it onto a van.`, '', 'RWD-04');
        this.log.push({ tapCrate: o.id });
        return;
      }
      const bay = this.bayAt(x, y);
      if (!bay) return;
      const r = g.business.slots(this.fid)[bay.i];
      const name = r.vehicle ? g.collections.item(r.vehicle).name : 'No van';
      if (r.job) PE.Dom.toast(g.now() >= r.job.endMs ? `${name} is back!` : `${name}: ${worth(r.job.amount)} of ${g.stock.skuName(r.job.offer.sku)} for ${r.job.offer.name}, back in ${PE.Dom.duration((r.job.endMs - g.now()) / 1000)}`, '', 'STA-02');
      else PE.Dom.toast(r.vehicle ? `${name} is empty. Drag a crate onto it.` : 'No van in this bay yet. Vans come from the Collection.', '', 'STA-02');
      this.log.push({ tapVan: bay.i });
    }
    openRoute(i) {
      PE.App.openPanel('business', { fid: this.fid });
      setTimeout(() => PE.Dom.spotlight && PE.Dom.spotlight(`#panel .item[data-slot="${i}"]`), 60);
      this.log.push({ tagRoute: i });
    }
    openVan(vid) {
      PE.App.openPanel('vehicleList', {});
      setTimeout(() => PE.Dom.spotlight && PE.Dom.spotlight(`#panel [data-item="${vid}"]`), 60);
      this.log.push({ tagVan: vid });
    }
    // Where a bay, van or crate is on the page (the tests tap there for real).
    toPage(x, y) { const r = this.game.canvas.getBoundingClientRect(); return { x: r.left + (x * r.width) / this.scale.width, y: r.top + (y * r.height) / this.scale.height }; }
  }
  PE.Screens.depot = DepotYard;
  PE.DepotYard = DepotYard;
})(globalThis.PE = globalThis.PE || {});
