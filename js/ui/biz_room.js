// Walk-in rooms for both dispensaries and the Processing Factory. One open floor; shelves or machines stand at spots worked
// out for each room picture (data/room_spots.js), with wide gaps; each renovation makes the room bigger, with more spots.
// The room is Aaron's picture (art/rooms/ROOM-Fnn-1..3, js/ui/room_art.js), with the counter painted on. The shelves and
// machines are Aaron's art since job 17 (art/shop/), with the products for sale standing on the shelves. All the numbers and actions stay in the Manage menu
// (js/ui/panels_empire.js) and js/logic/business.js.
(function (PE) {
  const FONT = 'system-ui, sans-serif';
  const CELL_W = 620, CELL_H = 560, WALL = 210, MARGIN = 120, TOP_GAP = 150;
  const COLS = 2;

  class BizRoom extends Phaser.Scene {
    static MACHINE = { Snacks: 'MCH-01', Drinks: 'MCH-02', Accessories: 'MCH-03', 'Novelty Gifts': 'MCH-04', Wellness: 'MCH-05', 'Wellness Fiction': 'MCH-05', 'Premium Packs': 'MCH-06' };
    static FURNITURE_H = 430;
    static get CUSTOMER_H() { return PE.Anim.PERSON_H.shop; }   // job 22B: the same height as the helpers
    // Every customer with all they need for a shop visit: walks in all directions and a reach-out. Found from the
    // imported frames (data/anim_art.js), so a new one filed by Cowork joins in with no code change.
    static customers() {
      const chars = PE.Data.animArt.chars;
      // Job 19: a reach-out isn't needed any more (DJ Dayglow and Dottie Disco have none yet: they stand on walk frame 01 at
      // the counter), and Sunny Skates skates everywhere.
      const c = (id) => chars[id];
      return Object.keys(chars).filter((id) => /^(WLK|VIP)-\d\d$/.test(id) && (c(id).WALKFRONT || c(id).SKATEFRONT) && (c(id).WALKAWAY || c(id).SKATEAWAY) && (c(id).HAPPY || c(id).FULL)).sort();
    }   // how tall a shelf or machine stands, in room units
    // Where products stand on each piece: the board lines (0 = top of the picture, 1 = bottom), the left and right ends of a
    // board (0 to 1 across), how many fit on a board, and the largest an item may be (share of the picture's height).
    static SHELF_ROWS = {
      'SHELF-01': { ys: [0.335, 0.525, 0.72, 0.885], x: [0.2, 0.8], n: 4, h: 0.13 },
      'SHELF-02': { ys: [0.31, 0.47, 0.64, 0.81], x: [0.2, 0.8], n: 4, h: 0.12 },
      'SHELF-03': { ys: [0.29, 0.54, 0.79], x: [0.2, 0.8], n: 3, h: 0.17 },
      'STAND-01': { ys: [0.175], x: [0.22, 0.78], n: 3, h: 0.15 },
      'STAND-02': { ys: [0.43, 0.6, 0.75], x: [0.14, 0.86], n: 4, h: 0.12 },
      'STAND-03': { ys: [0.3, 0.43, 0.555, 0.68, 0.8], x: [0.18, 0.82], n: 4, h: 0.1 },
    };
    constructor() { super('bizroom'); }
    init(params) { this.fid = params.fid; }

    calm() { return PE.App.state.settings.reducedMotion; }
    spot(i) {
      if (this.room && this.room.spots[i]) return this.room.spots[i];
      return { x: MARGIN + CELL_W / 2 + (i % COLS) * CELL_W, y: WALL + TOP_GAP + CELL_H / 2 + Math.floor(i / COLS) * CELL_H };
    }

    create() {
      this.g = PE.App.g;
      this.row = this.g.facilities.row(this.fid);
      this.retail = this.row.mode === 'Retail';
      this.knocking = false;   // a restarted room is the same object: start each time with no knock-through going
      this.size = this.g.facilities.roomSize(this.fid);
      this.open = this.g.facilities.roomSpots(this.fid, this.size);
      this.room = PE.Layout.roomAt(PE.Data, this.fid, this.size, PE.RoomSpots.local());
      if (this.room) { this.w = this.room.w; this.h = this.room.h; } else {
        const rows = Math.max(1, Math.ceil(this.open / COLS));
        this.w = MARGIN * 2 + COLS * CELL_W + (this.size - 1) * 60;
        this.h = WALL + TOP_GAP + rows * CELL_H + 60 + (this.size - 1) * 100;
      }
      this.cameras.main.setBackgroundColor('#140a24');
      this.views = [];
      this.drawRoom();
      this.bars = this.add.graphics().setDepth(90002);
      this.ghostText = this.add.text(0, 0, '', { fontFamily: FONT, fontStyle: 'bold', fontSize: '38px', color: '#ffffff', align: 'center', stroke: '#140a24', strokeThickness: 6 }).setOrigin(0.5).setDepth(40);
      this.ghostG = this.add.graphics().setDepth(39);
      this.setUpCamera();
      this.setUpInput();
      this.walkers = [];
      this.buildLife();
      if (this.retail) this.buildCustomers();
      this.unsub = this.g.on((type, e) => this.onGameEvent(type, e));
      this.sig = null;
      this.ready = true;
      this.refresh();
      if (!this.calm()) this.cameras.main.fadeIn(170, 20, 10, 36);
      this.events.once('shutdown', () => { this.ready = false; this.unsub(); this.helperLife = null; this.managerActor = null; PE.BizHands.closeShelf(); this.dropG = null; this.dropAt = undefined; });
      PE.Hud.refresh();
    }

    drawRoom() {
      const { w, h, retail } = this;
      this.glows = [];
      // Aaron's room picture, counter and all. If it's missing, the stand-in room below.
      this.roomArt = this.room ? PE.RoomArt.show(this, this.room, -995) : null;
      if (this.roomArt) {
        PE.DecorArt.attach(this, this.fid, { room: this.room });
        return;
      }
      const reno = (this.g.facilities.get(this.fid) || {}).renovation || 0;
      const G = this.add.graphics().setDepth(-1000);
      const wall = retail ? [0x7a3b6a, 0x85426f, 0x94497a, 0xa35285][reno] : [0x3d4356, 0x444b60, 0x4d546a, 0x565e75][reno];
      const floor = retail ? [0xcaa27a, 0xd2ab83, 0xdab48d, 0xe2bd97][reno] : [0x5a5a64, 0x62626c, 0x6a6a75, 0x72727e][reno];
      G.fillStyle(wall, 1).fillRect(0, 0, w, WALL);
      G.fillStyle(floor, 1).fillRect(0, WALL, w, h - WALL);
      G.lineStyle(2, 0xffffff, 0.08);
      for (let x = 0; x <= w; x += 150) G.lineBetween(x, WALL, x, h);
      for (let y = WALL; y <= h; y += 110) G.lineBetween(0, y, w, y);
      G.lineStyle(5, 0xffffff, 0.3).lineBetween(0, WALL, w, WALL);
      G.fillStyle(0x000000, 0.25).fillRect(0, 0, 16, h).fillRect(w - 16, 0, 16, h);
      this.add.text(w / 2, 56, this.row.name.toUpperCase(), { fontFamily: FONT, fontStyle: '900', fontSize: '58px', color: '#ffe9a0', stroke: '#1d0f33', strokeThickness: 7 }).setOrigin(0.5).setDepth(-990);
      // Decor stays round the edges.
      for (let i = 0; i < 3 + reno; i++) { G.fillStyle(0x2f7a1c, 1).fillCircle(50, WALL + 90 + i * 240, 34); G.fillStyle(0x7a4a2c, 1).fillRect(36, WALL + 112 + i * 240, 28, 34); }
      if (retail) {
        // The counter, at the back.
        const cx = w / 2;
        G.fillStyle(0x000000, 0.25).fillRoundedRect(cx - 330, WALL + 62, 660, 50, 14);
        G.fillStyle(0x7a4a2c, 1).fillRoundedRect(cx - 320, WALL + 12, 640, 86, 14);
        G.fillStyle(0xa8743f, 1).fillRoundedRect(cx - 320, WALL + 6, 640, 28, 12);
        G.fillStyle(0xffd84d, 1).fillRoundedRect(cx + 150, WALL - 34, 92, 50, 8);
        G.fillStyle(0x1d0f33, 1).fillRect(cx + 162, WALL - 24, 68, 22);
        this.add.text(cx - 80, WALL + 58, 'COUNTER', { fontFamily: FONT, fontStyle: 'bold', fontSize: '30px', color: '#ffe9a0' }).setOrigin(0.5).setDepth(-990);
      } else {
        G.fillStyle(0x24242c, 1).fillRect(90, WALL - 20, w - 180, 26);
        for (let x = 150; x < w - 150; x += 180) { G.fillStyle(0xffd84d, 0.9).fillRect(x, WALL - 20, 90, 8); }
      }
      PE.DecorArt.attach(this, this.fid, { w, wall: WALL });
    }

    // The shelf or machine at a spot, from Aaron's art (art/shop/SHOP_ART.md). Redrawn only when it changes.
    // Shops: the shelf upgrade picks SHELF-01/02/03 (basic, better, best); drinks go in the STAND-03 fridge, premium packs and
    // accessories in the STAND-02 lit cabinet, and every fourth spot is a STAND-01 round table, for variety. The product it
    // sells stands on it, small, several copies; with packaging chosen for that product, it's the package with the product on it.
    // Factory: each line shows the machine for the family it makes (MCH-01..06). If a picture hasn't arrived, the old
    // drawn stand-in shows until it does.
    furnitureFor(slot, i) {
      if (!this.retail) {
        const fam = slot.sku ? this.g.stock.familyOf(slot.sku) : null;
        return { id: BizRoom.MACHINE[fam] || 'MCH-01', idle: !slot.job };
      }
      const fam = slot.sku && slot.sku !== 'CROP' ? this.g.stock.familyOf(slot.sku) : null;
      if (fam === 'Drinks') return { id: 'STAND-03' };
      if (fam === 'Premium Packs' || fam === 'Accessories') return { id: 'STAND-02' };
      if (i % 4 === 3) return { id: 'STAND-01' };
      const ups = slot.levels ? Object.values(slot.levels).reduce((t, l) => t + l - 1, 0) : 0;
      return { id: ups >= 15 ? 'SHELF-03' : ups >= 6 ? 'SHELF-02' : 'SHELF-01' };
    }
    // What stands on the shelf: [picture, small product picture on it or null].
    itemsFor(sku) {
      if (!sku) return null;
      const product = sku === 'CROP' ? 'BUD-01' : sku;
      const pack = this.g.state.collections.packagingBySku && this.g.state.collections.packagingBySku[sku];
      return pack ? [pack, product] : [product, null];
    }
    drawFurniture(v, slot, i) {
      const { x, y } = this.spot(i);
      const G = v.g;
      G.clear();
      (v.parts || []).forEach((o) => o.destroy());
      v.parts = [];
      const f = this.furnitureFor(slot, i);
      const items = this.retail ? this.itemsFor(slot.sku) : null;
      const want = [f.id, ...(items || []).filter(Boolean)];
      const missing = want.filter((id) => !this.textures.exists('ui-' + id));
      if (missing.length) {
        const look = v.look;
        PE.UI.loadIcons(this, missing, () => { if (v.look === look && this.ready) { v.look = null; this.refresh(); } });
        if (!this.textures.exists('ui-' + f.id)) { this.drawStandIn(v, slot, i); return; }
      }
      G.fillStyle(0x000000, 0.28).fillEllipse(x, y + 160, 400, 64);
      const art = PE.Data.itemArt[f.id] || [500, 640];
      const H = BizRoom.FURNITURE_H, k = H / art[1], W = art[0] * k;
      const top = y + 175 - H;
      const im = this.add.image(x, y + 175, 'ui-' + f.id).setOrigin(0.5, 1).setScale(k).setDepth(y);
      if (f.idle) im.setTint(0x9a9aa8);
      v.parts.push(im);
      const rows = BizRoom.SHELF_ROWS[f.id];
      if (!rows || !items) return;
      const [main, small] = items;
      if (!this.textures.exists('ui-' + main)) return;
      const ma = PE.Data.itemArt[main] || [192, 192];
      rows.ys.forEach((ry, r) => {
        const base = top + ry * H;
        const x0 = x - W / 2 + rows.x[0] * W, x1 = x - W / 2 + rows.x[1] * W;
        const n = rows.n;
        const cell = (x1 - x0) / n;
        const size = Math.min(cell * 0.92, rows.h * H);
        const ks = size / Math.max(ma[0], ma[1]);
        for (let c = 0; c < n; c++) {
          const cx = x0 + cell * (c + 0.5);
          v.parts.push(this.add.image(cx, base, 'ui-' + main).setOrigin(0.5, 1).setScale(ks).setDepth(y + 1 + r * 0.01));
          if (small && this.textures.exists('ui-' + small)) {
            const sa = PE.Data.itemArt[small] || [192, 192];
            const kk = (size * 0.5) / Math.max(sa[0], sa[1]);
            v.parts.push(this.add.image(cx, base - (ma[1] * ks) * 0.32, 'ui-' + small).setOrigin(0.5, 0.5).setScale(kk).setDepth(y + 1.005 + r * 0.01));
          }
        }
      });
    }
    // The old drawn shelf or machine, while its picture is on the way (or if it failed).
    drawStandIn(v, slot, i) {
      const { x, y } = this.spot(i);
      const G = v.g;
      G.fillStyle(0x000000, 0.25).fillEllipse(x, y + 148, 430, 70);
      if (this.retail) {
        G.fillStyle(0x5a3a22, 1).fillRoundedRect(x - 200, y - 150, 400, 300, 14);
        G.fillStyle(0x8a5f38, 1).fillRoundedRect(x - 186, y - 138, 372, 276, 10);
        for (let row = 0; row < 3; row++) G.fillStyle(0x5a3a22, 1).fillRect(x - 186, y - 60 + row * 86, 372, 12);
      } else {
        G.fillStyle(0x3a3f50, 1).fillRoundedRect(x - 210, y - 120, 420, 270, 18);
        G.fillStyle(0x8b8fa3, 1).fillRoundedRect(x - 190, y - 104, 380, 150, 12);
      }
    }

    refresh() {
      if (!this.ready) return;
      const g = this.g;
      const b = g.business;
      const slots = b.slots(this.fid);
      const now = g.now();
      const size = g.facilities.roomSize(this.fid);
      const sigRoom = `${slots.length}|${size}|${(g.facilities.get(this.fid) || {}).renovation}`;
      if (this.sig && this.sig !== sigRoom) {
        // The room grew into its next size: a knock-through, then the bigger room.
        if (this.knocking) return;
        this.knocking = true;
        if (size > this.size) PE.RoomArt.knockThrough(this, () => this.scene.restart({ fid: this.fid })); else this.scene.restart({ fid: this.fid });
        return;
      }
      this.sig = sigRoom;
      slots.forEach((slot, i) => {
        let v = this.views[i];
        if (!v) {
          const { x, y } = this.spot(i);
          v = this.views[i] = {
            g: this.add.graphics().setDepth(y),
            name: this.add.text(x, y + 182, '', { fontFamily: FONT, fontStyle: 'bold', fontSize: '30px', color: '#ffffff', align: 'center', stroke: '#1d0f33', strokeThickness: 6 }).setOrigin(0.5, 0).setDepth(90000),
            mark: this.add.text(x + 160, y - 265, '', { fontFamily: FONT, fontStyle: '900', fontSize: '42px', color: '#ffffff', backgroundColor: '#ff2d55', padding: { x: 16, y: 4 } }).setOrigin(0.5).setDepth(90001).setVisible(false),
            look: null,
          };
        }
        const look = `${slot.sku || ''}|${slot.job ? 'j' : ''}|${this.furnitureFor(slot, i).id}|${(this.itemsFor(slot.sku) || []).join(',')}`;
        if (v.look !== look) { v.look = look; this.drawFurniture(v, slot, i); }
        const label = slot.sku ? g.stock.skuName(slot.sku) : this.retail ? 'Empty shelf' : 'Idle machine';
        if (v.name.text !== label) v.name.setText(label);
        const ready = !this.retail && slot.job && now >= slot.job.endMs && !b.lineWaiting(this.fid, slot);
        const idle = this.retail ? !slot.sku : !slot.job;
        v.mark.setVisible(ready || idle).setText(ready ? 'Ready!' : '!').setBackgroundColor(ready ? '#2fbf5b' : '#ff2d55');
        // Job 19: the upgrade tag, and a finished batch's crate beside the machine (js/ui/biz_hands.js).
        PE.BizHands.drawTag(this, v, i);
        if (!this.retail) this.syncCrate(v, i, ready ? slot.sku : null);
      });
      this.bars.clear();
      if (!this.retail) slots.forEach((slot, i) => {
        if (!slot.job) return;
        const { x, y } = this.spot(i);
        const t = Math.min(1, (now - slot.job.startMs) / (slot.job.endMs - slot.job.startMs));
        this.bars.fillStyle(0x000000, 0.65).fillRect(x - 170, y + 226, 340, 22);
        this.bars.fillStyle(0xc6ff3d, 1).fillRect(x - 166, y + 230, 332 * t, 14);
      });
      this.drawGhost(slots.length);
      PE.EdgeArrows.update(this, slots.map((slot, i) => ({ slot, i })).filter(({ slot }) => !this.retail && slot.job && now >= slot.job.endMs).map(({ i }) => { const p = this.spot(i); return { id: 'm' + i, x: p.x, y: p.y, tap: () => { this.cameras.main.centerOn(p.x, p.y); this.clampCamera(); } }; }));
    }
    // Empty spots you can use: a soft glowing outline with a "+". The next one says its price (or when it opens).
    drawGhost(owned) {
      const last = Math.min(this.open, this.room ? this.room.spots.length : this.open);
      const next = owned < last ? owned : null;
      const can = next !== null && this.g.facilities.canBuyStation(this.fid);
      const thing = this.retail ? 'Shelf' : 'Machine';
      const sig = `${owned}|${last}|${can}|${can ? this.g.facilities.nextStationCost(this.fid) : ''}|${PE.RoomSpots.editing}`;
      if (sig === this.ghostSig) return;
      this.ghostSig = sig;
      this.ghostAt = next;
      this.ghostG.clear();
      this.ghostText.setVisible(false);
      this.glows.forEach((x) => x.destroy());
      this.glows = [];
      if (!this.room) {
        if (next === null) return;
        const { x, y } = this.spot(owned);
        this.ghostG.lineStyle(7, can ? 0xc6ff3d : 0xffffff, can ? 0.8 : 0.3).strokeRect(x - 210, y - 150, 420, 300);
        this.ghostText.setVisible(true).setPosition(x, y).setText(can ? `+ ${thing}\n${PE.Dom.money(this.g.facilities.nextStationCost(this.fid))}` : `Next ${thing.toLowerCase()}\nopens as this grows`);
        return;
      }
      for (let i = owned; i < last; i++) {
        const label = i !== next ? null : can ? `${thing} ${PE.Dom.money(this.g.facilities.nextStationCost(this.fid))}` : 'Opens as this grows';
        this.glows.push(PE.RoomArt.spotGlow(this, this.room, i, { strong: i === next && can, label, calm: this.calm() }));
      }
      PE.RoomSpots.drawMarks(this, this.room);
    }

    // Customers walk in at the front, look at a stocked shelf, walk up to the counter, reach out to pay (the TALK<facing>
    // frames are a reach-out, job 17), do their happy reaction and leave. They keep to the open floor, round the shelves
    // (js/ui/room_art.js finds the way). Every customer with walks and a reach-out takes a turn (PE.BizRoom.customers):
    // the dog walker, the skater kid and the VIPs. Anyone without a happy reaction yet hops with their full-body picture.
    buildCustomers() {
      if (this.calm()) return;
      const R = this.room;
      const door = R ? R.door : { x: this.w / 2, y: this.h - 40 };
      const counter = R && R.counter ? { x: R.counter.x, y: R.counter.y + 70 } : { x: this.w / 2, y: WALL + 150 };
      this.customerPool = BizRoom.customers();
      if (!this.customerPool.length) this.customerPool = ['WLK-06', 'WLK-04'];
      this.customerTurn = Math.floor(Math.random() * this.customerPool.length);
      const count = Math.min(this.customerPool.length, 1 + this.size);
      for (let n = 0; n < count; n++) {
        const id = this.nextCustomer();
        const actor = new PE.Anim.Actor(this, id, { x: door.x, y: door.y, height: BizRoom.CUSTOMER_H });
        actor.image.setAlpha(0);
        const side = (n % 2 ? 1 : -1) * (40 + 40 * Math.floor(n / 2));
        this.walkers.push({ actor, id, state: 'wait', left: n * 4 + 1, door: { x: door.x + side, y: door.y }, counter: { x: counter.x + side * 1.4, y: counter.y }, speed: 150 + n * 15, way: null });
      }
    }
    nextCustomer() {
      const pool = this.customerPool;
      const busy = new Set(this.walkers.map((w) => w.id));
      // One of each (job 19): DJ Dayglow and Captain Citrus don't walk in while they're out on their scooters.
      for (let k = 0; k < pool.length; k++) {
        const id = pool[this.customerTurn++ % pool.length];
        if (!busy.has(id) && (!PE.Cast || PE.Cast.isFree(id))) return id;
      }
      return pool[this.customerTurn++ % pool.length];
    }
    // Back out of the door: the next customer in line comes in next time.
    swapCustomer(w) {
      const id = this.nextCustomer();
      if (id === w.id) return;
      w.actor.destroy();
      w.id = id;
      w.actor = new PE.Anim.Actor(this, id, { x: w.door.x, y: w.door.y, height: BizRoom.CUSTOMER_H });
      w.actor.image.setAlpha(0);
      (this.customersSeen = this.customersSeen || new Set()).add(id);
    }
    // The reach-out for the way they face the counter: reachUP when the counter is behind them, and so on.
    reachMove(A, to) {
      const d = PE.AnimPick.dirOf(to.x - A.x, to.y - A.y);
      return 'reach' + d.toUpperCase();
    }

    // The way from here to there: along the open floor if this room has one, otherwise straight.
    wayTo(from, to) {
      const W = this.walkWorld;
      const r = W && W.route([from.x, from.y], [to.x, to.y]);
      if (!r) return [[from.x, from.y], [to.x, to.y]];
      // Only step onto the exact spot if it's open floor; otherwise stop at the nearest open point.
      const end = W.isOpen(to.x, to.y) ? [[to.x, to.y]] : [];
      const way = [[from.x, from.y], ...r.slice(1), ...end];
      return way.length > 1 ? way : [[from.x, from.y], r[0]];
    }
    // In front of a stocked shelf, where a customer stops to look.
    browseSpot() {
      const slots = this.g.business.slots(this.fid);
      const stocked = slots.map((sl, i) => ({ sl, i })).filter((o) => o.sl.sku);
      if (!stocked.length) return null;
      const p = this.spot(stocked[Math.floor(Math.random() * stocked.length)].i);
      return { x: p.x, y: p.y + 260 };
    }
    stepCustomers(dt) {
      const stocked = this.g.business.slots(this.fid).some((sl) => sl.sku);
      for (const w of this.walkers) {
        const A = w.actor;
        if (w.state === 'wait') {
          A.image.setAlpha(0);
          w.left -= dt;
          if (w.left <= 0 && stocked && this.retail) {
            A.moveTo(w.door.x, w.door.y);
            const shelf = this.browseSpot();
            w.state = 'in';
            w.way = this.wayTo(w.door, shelf || w.counter);
            w.next = shelf ? 'look' : 'buy';
          }
          continue;
        }
        if (w.way) {
          // Walking: along the way, a corner at a time. Fades in at the door, and out again on the way back.
          const [tx, ty] = w.way[1];
          const dx = tx - A.x, dy = ty - A.y, dist = Math.hypot(dx, dy), step = w.speed * dt;
          if (dist <= step) {
            A.moveTo(tx, ty);
            w.way.shift();
            if (w.way.length < 2) {
              w.way = null;
              if (w.state === 'out') { w.state = 'wait'; w.left = 2 + Math.random() * 5; this.swapCustomer(w); continue; }
              if (w.next === 'look') { w.state = 'look'; w.left = 1.4; A.play('idle'); } else {
                // At the counter: reach out to pay and take the bag, facing the counter, then wait with a gentle bob.
                w.state = 'buy';
                w.left = 1.6;
                const reach = this.reachMove(A, this.room && this.room.counter ? this.room.counter : { x: A.x, y: A.y - 100 });
                w.reached = PE.AnimPick.resolve(A.id, reach) ? reach : null;
                A.play(w.reached || 'order', { done: () => { if (w.state === 'buy' && !A.gone) A.play('order'); } });
              }
            }
          } else { A.moveTo(A.x + (dx / dist) * step, A.y + (dy / dist) * step); A.heading(dx, dy); }
          const fromDoor = Math.hypot(w.door.x - A.x, w.door.y - A.y);
          A.image.setAlpha(Math.min(1, fromDoor / 80 + 0.05));
          continue;
        }
        w.left -= dt;
        if (w.state === 'look' && w.left <= 0) {
          w.state = 'in';
          w.next = 'buy';
          w.way = this.wayTo({ x: A.x, y: A.y }, w.counter);
        } else if (w.state === 'buy' && w.left <= 0) {
          w.state = 'happy';
          const happy = PE.AnimPick.resolve(A.id, 'happy');
          // As long as their happy reaction lasts (Pixel Pete's breakdance is 4.3 s), at least 1.3 s.
          w.left = happy && happy.ms ? Math.max(1.3, happy.ms.reduce((t, m) => t + m, 0) / 1000 + 0.2) : 1.3;
          // The skater kid's board trick is drawn facing right: flipped when the door is to his left (job 17B).
          // The businesswoman's lipstick kiss grows big and fades, so it draws over everything near her.
          A.play('happy', A.id === 'WLK-01' ? { flip: w.door.x < A.x } : {});
          if (A.id === 'WLK-03') A.setBehind(1e6);
          w.happySet = happy ? happy.set : null;
          this.customersHappy = (this.customersHappy || 0) + 1;
          (this.customerLog = this.customerLog || []).push({ id: A.id, reach: w.reached, happy: w.happySet });
          if (this.managerActor) this.giveProduct();
          // No happy reaction drawn yet: a happy little hop (with the full-body picture, if they have one).
          if (!A.hasFrames || !happy || happy.set === 'FULL') this.tweens.add({ targets: A.image, y: A.image.y - A.height * 0.1, yoyo: true, repeat: 1, duration: 170, ease: 'Sine.easeOut' });
        } else if (w.state === 'happy' && w.left <= 0) {
          w.state = 'out';
          A.setBehind(null);
          A.image.setFlipX(false);
          w.way = this.wayTo({ x: A.x, y: A.y }, w.door);
        }
      }
    }
    // sku: what just sold. A customer at the counter buys whatever's on a stocked shelf here.
    giveProduct(sku) {
      const now = performance.now();
      if (now - (this.lastGive || 0) < 2500) return;
      this.lastGive = now;
      const stocked = this.g.business.slots(this.fid).filter((s) => s.sku);
      PE.Anim.handOver(this, this.managerActor, sku || (stocked.length ? stocked[Math.floor(Math.random() * stocked.length)].sku : null));
    }
    // Two helpers wander the open floor, round the shelves and machines.
    buildLife() {
      const opts = { height: PE.Anim.PERSON_H.shop, speed: 120, near: 520, textScale: () => PE.App.dpr / this.cameras.main.zoom };
      let world;
      if (this.room) {
        const F = PE.Layout.FURNITURE;
        const spots = this.room.spots.slice(0, Math.max(this.open, this.g.business.slots(this.fid).length));
        const blocked = (x, y) => spots.some((q) => x > q.x - F.halfW - 50 && x < q.x + F.halfW + 50 && y > q.y - 120 && y < q.y + F.down + 50);
        world = PE.RoomArt.floorWorld(this.room, blocked, { ...opts, step: 60 });
        this.walkWorld = world;
      }
      if (!world || !world.spots.length) {
        const xs = [MARGIN / 2 + 20, MARGIN + CELL_W, this.w - MARGIN / 2 - 20];
        const rows = Math.max(1, Math.ceil(this.open / COLS));
        const ys = [WALL + 165];
        for (let r = 0; r < rows; r++) ys.push(Math.min(this.h - 40, this.spot(r * COLS).y + CELL_H / 2 - 10));
        world = PE.HelperLife.aisleWorld(xs, ys, opts);
      }
      this.helperLife = new PE.HelperLife.Life(this, world);
      const manager = this.g.collections.managersAt(this.fid)[0];
      if (manager && PE.App.state.settings.helpers) {
        // The manager serves from beside the counter (or, in the factory, near the back wall).
        const at = this.room && this.room.counter ? { x: this.room.counter.x + 300, y: this.room.counter.y + 40 } : this.room ? { x: this.w / 2, y: Math.min(...this.room.floor.map((q) => q[1])) + 120 } : { x: this.w / 2 - 240, y: WALL + 96 };
        this.managerActor = new PE.Anim.Actor(this, manager, { x: at.x, y: at.y, height: PE.Anim.PERSON_H.shop });
        this.managerId = manager;
      }
    }
    onGameEvent(type, e) {
      if (!this.ready) return;
      if (type === 'lockedTap' && this.helperLife) this.helperLife.react('locked');
      if (type === 'sold' && e.fid === this.fid && this.managerActor) this.giveProduct(e.sku);
    }

    update(time, delta) {
      if (!this.ready) return;
      const dt = Math.min(0.1, (delta || 16) / 1000);
      PE.Anim.stepAll(this, dt);
      if (this.helperLife) this.helperLife.update(dt);
      this.stepCustomers(dt);
      if (time - (this.lastSharp || 0) > 150) { this.lastSharp = time; PE.RoomArt.keepSharp(this, this.roomArt); }
      if (time - (this.lastRefresh || 0) < 300) return;
      this.lastRefresh = time;
      this.refresh();
    }

    // ---- Camera and touch: the same feel as the grow room ------------------------------------------------------
    zoomLimits() {
      const W = this.scale.width, H = this.scale.height;
      const fit = Math.min(W / this.w, H / this.h);
      // cover: as close as needed for the room picture to fill the whole screen (job 17: on a tall phone the shop
      // filled less than half of it, with dark bands above and below).
      return { min: fit * 0.96, cover: Math.min(1.5 * PE.App.dpr, Math.max(W / this.w, H / this.h)), max: 1.5 * PE.App.dpr };
    }
    setUpCamera() {
      const cam = this.cameras.main;
      const lim = this.zoomLimits();
      const first = this.spot(0);
      if (this.room) {
        // Aaron's picture fills the screen, with the first shelf or machine in view; pan to see the rest, pinch out to see
        // it all. (Centred on the floor, a tall phone showed half of two shelves.)
        const fl = this.room.floor;
        const ys = fl.map((p) => p[1]);
        cam.setZoom(lim.cover);
        cam.centerOn(first.x, (Math.min(...ys) + Math.max(...ys)) / 2);
      } else {
        // The stand-in room: the whole room across the screen, a little further back as it grows.
        cam.setZoom(Phaser.Math.Clamp(this.scale.width / (this.w + (this.size - 1) * 80), lim.min, lim.max));
        cam.centerOn(this.w / 2, first.y);
      }
      cam.preRender();
      this.clampCamera(!!this.room);
    }
    // strict: no extra travel past the picture's edges (how a room opens: filling the screen, job 17).
    clampCamera(strict = false) {
      const cam = this.cameras.main;
      const vw = cam.width / cam.zoom, vh = cam.height / cam.zoom;
      const extra = strict ? 0 : 130 * PE.App.dpr / cam.zoom;
      const c = (v, lo, hi) => (lo > hi ? (lo + hi) / 2 : Math.min(hi, Math.max(lo, v)));
      cam.centerOn(c(cam.midPoint.x, vw / 2, this.w - vw / 2), c(cam.midPoint.y, vh / 2 - extra, this.h - vh / 2 + extra));
      cam.preRender();
    }
    setUpInput() {
      const input = this.input;
      input.addPointer(2);
      const moved = 12 * PE.App.dpr;
      let drag = null, pinch = null;
      const onCanvas = (p) => !p.event || p.event.target === this.game.canvas;
      const menuOpen = () => !!PE.Dom.panelRoute || !!PE.Dom.modalNow;
      input.on('pointerdown', (p) => {
        if (!onCanvas(p) || menuOpen()) { drag = null; return; }
        if (PE.RoomSpots.down(this, p)) { drag = null; return; }
        const a = input.pointer1, b = input.pointer2;
        if (a.isDown && b.isDown) { pinch = { dist: Phaser.Math.Distance.Between(a.x, a.y, b.x, b.y), zoom: this.cameras.main.zoom }; drag = null; } else drag = { id: p.id, sx: p.x, sy: p.y, lastX: p.x, lastY: p.y, moved: false };
      });
      input.on('pointermove', (p) => {
        const cam = this.cameras.main;
        if (PE.RoomSpots.drag(this, p)) return;
        if (pinch && input.pointer1.isDown && input.pointer2.isDown) {
          const lim = this.zoomLimits();
          cam.setZoom(Phaser.Math.Clamp((pinch.zoom * Phaser.Math.Distance.Between(input.pointer1.x, input.pointer1.y, input.pointer2.x, input.pointer2.y)) / pinch.dist, lim.min, lim.max));
          this.clampCamera();
          return;
        }
        if (!drag || p.id !== drag.id || !p.isDown) return;
        if (!drag.moved && Math.hypot(p.x - drag.sx, p.y - drag.sy) > moved) drag.moved = true;
        if (drag.moved) { cam.scrollX -= (p.x - drag.lastX) / cam.zoom; cam.scrollY -= (p.y - drag.lastY) / cam.zoom; cam.preRender(); this.clampCamera(); }
        drag.lastX = p.x; drag.lastY = p.y;
      });
      input.on('pointerup', (p) => {
        if (PE.RoomSpots.up(this, p)) return;
        if (pinch) { if (!input.pointer1.isDown && !input.pointer2.isDown) pinch = null; drag = null; return; }
        if (drag && p.id === drag.id && !drag.moved) this.tapAt(p.x, p.y);
        drag = null;
      });
    }
    // ---- Job 19: hands-on shelves and machines (js/ui/biz_hands.js) ----------------------------------------------
    // A finished batch pops out of its machine with a bounce, into a crate with the product's picture on it.
    syncCrate(v, i, sku) {
      if (!sku) { if (v.crate) { v.crate.destroy(); v.crate = null; } return; }
      if (v.crate && v.crate.sku === sku) return;
      if (v.crate) v.crate.destroy();
      PE.BizHands.crateTexture(this);
      const { x, y } = this.spot(i);
      const c = this.add.container(x + 215, y + 150).setDepth(y + 200);
      c.add(this.add.image(0, 0, 'biz-crate').setOrigin(0.5, 0.95).setDisplaySize(150, 150));
      const key = 'ui-' + sku;
      const put = () => { if (c.scene && this.textures.exists(key)) { const im = this.add.image(0, -62, key); im.setScale(74 / Math.max(im.width, im.height)); c.add(im); } };
      if (this.textures.exists(key)) put(); else PE.UI.loadIcons(this, [sku], put);
      c.sku = sku;
      v.crate = c;
      (this.crateLog = this.crateLog || []).push(i);
      if (this.calm()) return;
      // Out of the machine, up, and down with a bounce.
      c.setPosition(x, y - 40).setScale(0.3);
      this.tweens.add({ targets: c, x: x + 215, duration: 520, ease: 'Sine.easeOut' });
      this.tweens.add({ targets: c, scale: 1, duration: 300, ease: 'Back.easeOut' });
      this.tweens.add({ targets: c, y: { from: y - 40, to: y + 150 }, duration: 520, ease: 'Bounce.easeOut' });
    }
    crateHit(v, x, y) { return v && v.crate && Math.abs(x - v.crate.x) < 95 && y > v.crate.y - 160 && y < v.crate.y + 30; }
    crateCollected(i) {
      const v = this.views[i];
      if (!v || !v.crate) return;
      const c = v.crate;
      v.crate = null;
      if (this.calm()) { c.destroy(); return; }
      this.tweens.add({ targets: c, y: c.y - 120, alpha: 0, scale: 1.25, duration: 360, ease: 'Sine.easeOut', onComplete: () => c.destroy() });
    }
    // A machine starting up gives a little jump.
    machineBump(i) {
      const v = this.views[i];
      const im = v && v.parts && v.parts[0];
      if (!im || this.calm()) return;
      const y0 = im.y;
      this.tweens.add({ targets: im, y: y0 - 24, yoyo: true, duration: 140, ease: 'Sine.easeOut', onComplete: () => { im.y = y0; } });
    }
    // Which shelf or machine is under a page point (a product being dragged), or null.
    slotAtPage(px, py) {
      const r = this.game.canvas.getBoundingClientRect();
      const pt = this.cameras.main.getWorldPoint(((px - r.left) * this.scale.width) / r.width, ((py - r.top) * this.scale.height) / r.height);
      const slots = this.g.business.slots(this.fid);
      for (let i = 0; i < slots.length; i++) { const c = this.spot(i); if (Math.abs(pt.x - c.x) < 230 && pt.y > c.y - 260 && pt.y < c.y + 230) return i; }
      return null;
    }
    // The shelf a product's held over glows.
    dropGlow(i) {
      if (!this.dropG) this.dropG = this.add.graphics().setDepth(89999);
      if (this.dropAt === i) return;
      this.dropAt = i;
      this.dropG.clear();
      if (i === null || i === undefined) return;
      const c = this.spot(i);
      this.dropG.lineStyle(14, 0xc6ff3d, 0.9).strokeRoundedRect(c.x - 225, c.y - 270, 450, 460, 40);
    }

    tapAt(sx, sy) {
      if (PE.BizHands.swallowTap()) return;
      const pt = this.cameras.main.getWorldPoint(sx, sy);
      // The shelf or machine picture stands from 255 above its spot to 175 below (drawFurniture), its name just under it.
      const near = (i) => { const c = this.spot(i); return Math.abs(pt.x - c.x) < 230 && pt.y > c.y - 260 && pt.y < c.y + 230; };
      if (this.ghostAt !== null && this.ghostAt !== undefined && near(this.ghostAt)) {
        const r = this.g.facilities.buyStation(this.fid);
        if (!r.ok) { PE.Dom.toast(r.why === 'cash' ? 'Not enough cash yet' : 'This one opens as the place grows'); this.g.emit('lockedTap', {}); } else PE.App.saveGame();
        return;
      }
      const slots = this.g.business.slots(this.fid);
      // Job 19: the upgrade tag, then a crate, then the shelf or machine itself.
      for (let i = 0; i < slots.length; i++) if (PE.BizHands.tagHit(this, i, pt.x, pt.y)) { PE.BizHands.openUpgrade(this.fid, i); return; }
      for (let i = 0; i < slots.length; i++) if (this.crateHit(this.views[i], pt.x, pt.y)) { PE.BizHands.collect(this, i); return; }
      for (let i = 0; i < slots.length; i++) {
        if (!near(i)) continue;
        if (this.retail) PE.BizHands.openShelf(i); else PE.BizHands.tapMachine(this, i);
        return;
      }
      const helper = this.helperLife && this.helperLife.tap(pt.x, pt.y);
      if (helper) this.g.helpers.chat(helper.id);
    }
    worldToPage(wx, wy) {
      const cam = this.cameras.main;
      const r = this.game.canvas.getBoundingClientRect();
      const sx = (wx - cam.midPoint.x) * cam.zoom + cam.width / 2;
      const sy = (wy - cam.midPoint.y) * cam.zoom + cam.height / 2;
      return { x: r.left + (sx * r.width) / this.scale.width, y: r.top + (sy * r.height) / this.scale.height };
    }
    spotPagePoint(i) { const c = this.spot(i); return this.worldToPage(c.x, c.y); }
  }
  PE.Screens.bizroom = BizRoom;
  PE.BizRoom = BizRoom;
})(globalThis.PE = globalThis.PE || {});
