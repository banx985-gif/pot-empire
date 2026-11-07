// Walk-in rooms for both dispensaries and the Processing Factory. One open floor; shelves or machines stand at spots worked
// out for each room picture (data/room_spots.js), with wide gaps; each renovation makes the room bigger, with more spots.
// The room is Aaron's picture (art/rooms/ROOM-Fnn-1..3, js/ui/room_art.js), with the counter painted on. The shelves and
// machines are still STAND-INS drawn here until their art arrives. All the numbers and actions stay in the Manage menu
// (js/ui/panels_empire.js) and js/logic/business.js.
(function (PE) {
  const FONT = 'system-ui, sans-serif';
  const CELL_W = 620, CELL_H = 560, WALL = 210, MARGIN = 120, TOP_GAP = 150;
  const COLS = 2;

  class BizRoom extends Phaser.Scene {
    constructor() { super('bizroom'); }
    init(params) { this.fid = params.fid; }

    calm() { return PE.App.state.settings.reducedMotion || (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches); }
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
      this.events.once('shutdown', () => { this.ready = false; this.unsub(); this.helperLife = null; this.managerActor = null; });
      PE.Hud.refresh();
    }

    drawRoom() {
      const { w, h, retail } = this;
      this.glows = [];
      // Aaron's room picture, counter and all. If it's missing, the stand-in room below.
      this.roomArt = this.room ? PE.RoomArt.show(this, this.room, -995) : null;
      if (this.roomArt) {
        PE.DecorArt.attach(this, this.fid, { w, wall: Math.min(...this.room.floor.map((q) => q[1])) });
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

    // Stand-in furniture: a shelf with whatever's stocked on it, or a machine. Redrawn only when it changes.
    drawFurniture(v, slot, i) {
      const { x, y } = this.spot(i);
      const G = v.g;
      G.clear();
      G.fillStyle(0x000000, 0.25).fillEllipse(x, y + 148, 430, 70);
      if (this.retail) {
        G.fillStyle(0x5a3a22, 1).fillRoundedRect(x - 200, y - 150, 400, 300, 14);
        G.fillStyle(0x8a5f38, 1).fillRoundedRect(x - 186, y - 138, 372, 276, 10);
        const colors = slot.sku ? [0xff4fa3, 0x52e6ff, 0xc6ff3d, 0xffd84d, 0xff8a3d] : [];
        for (let row = 0; row < 3; row++) {
          const ry = y - 96 + row * 86;
          G.fillStyle(0x5a3a22, 1).fillRect(x - 186, ry + 36, 372, 12);
          for (let k = 0; slot.sku && k < 5; k++) { G.fillStyle(colors[(k + row + i) % 5], 1).fillRoundedRect(x - 160 + k * 66, ry - 18, 50, 54, 7); }
        }
      } else {
        G.fillStyle(0x3a3f50, 1).fillRoundedRect(x - 210, y - 120, 420, 270, 18);
        G.fillStyle(0x8b8fa3, 1).fillRoundedRect(x - 190, y - 104, 380, 150, 12);
        G.fillStyle(slot.job ? 0x52e6ff : 0x24242c, 1).fillRoundedRect(x - 150, y - 86, 170, 110, 10);
        G.fillStyle(0xff8a3d, 1).fillCircle(x + 90, y - 56, 26);
        G.fillStyle(0xc6ff3d, 1).fillCircle(x + 150, y - 56, 16);
        G.fillStyle(0x24242c, 1).fillRect(x - 190, y + 66, 380, 42);
        for (let k = 0; k < 8; k++) G.fillStyle(0x8b8fa3, 1).fillCircle(x - 170 + k * 48, y + 87, 11);
        G.fillStyle(0x5a5d70, 1).fillRect(x + 110, y - 180, 46, 70);
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
            name: this.add.text(x, y + 168, '', { fontFamily: FONT, fontStyle: 'bold', fontSize: '30px', color: '#ffffff', align: 'center', stroke: '#1d0f33', strokeThickness: 6 }).setOrigin(0.5, 0).setDepth(90000),
            mark: this.add.text(x + 160, y - 170, '', { fontFamily: FONT, fontStyle: '900', fontSize: '42px', color: '#ffffff', backgroundColor: '#ff2d55', padding: { x: 16, y: 4 } }).setOrigin(0.5).setDepth(90001).setVisible(false),
            look: null,
          };
        }
        const look = `${slot.sku || ''}|${slot.job ? 'j' : ''}`;
        if (v.look !== look) { v.look = look; this.drawFurniture(v, slot, i); }
        const label = slot.sku ? g.stock.skuName(slot.sku) : this.retail ? 'Empty shelf' : 'Idle machine';
        if (v.name.text !== label) v.name.setText(label);
        const ready = !this.retail && slot.job && now >= slot.job.endMs && !b.lineWaiting(this.fid, slot);
        const idle = this.retail ? !slot.sku : !slot.job;
        v.mark.setVisible(ready || idle).setText(ready ? 'Ready!' : '!').setBackgroundColor(ready ? '#2fbf5b' : '#ff2d55');
      });
      this.bars.clear();
      if (!this.retail) slots.forEach((slot, i) => {
        if (!slot.job) return;
        const { x, y } = this.spot(i);
        const t = Math.min(1, (now - slot.job.startMs) / (slot.job.endMs - slot.job.startMs));
        this.bars.fillStyle(0x000000, 0.65).fillRect(x - 170, y + 136, 340, 22);
        this.bars.fillStyle(0xc6ff3d, 1).fillRect(x - 166, y + 140, 332 * t, 14);
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

    // Customers walk in at the front, look at a stocked shelf, walk up to the counter, pay, do a happy little thing and leave.
    // They keep to the open floor, round the shelves (js/ui/room_art.js finds the way). WLK-06 the dog walker and VIP-08 Nova
    // have all their frames; anyone without a happy reaction does a hop instead.
    buildCustomers() {
      if (this.calm()) return;
      const R = this.room;
      const door = R ? R.door : { x: this.w / 2, y: this.h - 40 };
      const counter = R && R.counter ? { x: R.counter.x, y: R.counter.y + 70 } : { x: this.w / 2, y: WALL + 150 };
      const ids = ['WLK-06', 'VIP-08'].filter((id) => PE.AnimPick.hasFrames(id));
      if (!ids.length) ids.push('WLK-06', 'WLK-04');
      const tall = R ? 270 : 250;
      ids.forEach((id, n) => {
        const actor = new PE.Anim.Actor(this, id, { x: door.x, y: door.y, height: tall });
        actor.image.setAlpha(0);
        this.walkers.push({ actor, id, state: 'wait', left: n * 5 + 1, door: { x: door.x + (n ? 60 : -60), y: door.y }, counter: { x: counter.x + (n ? 70 : -70), y: counter.y }, speed: 150 + n * 20, way: null });
      });
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
              if (w.state === 'out') { w.state = 'wait'; w.left = 2 + Math.random() * 5; continue; }
              if (w.next === 'look') { w.state = 'look'; w.left = 1.4; A.play('idle'); } else { w.state = 'buy'; w.left = 1.6; A.play('order'); }
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
          w.left = 1.3;
          A.play('happy');
          this.customersHappy = (this.customersHappy || 0) + 1;
          if (this.managerActor) this.giveProduct();
          // No frames for it yet: a happy little hop.
          if (!A.hasFrames) this.tweens.add({ targets: A.image, y: A.image.y - A.height * 0.1, yoyo: true, repeat: 1, duration: 170, ease: 'Sine.easeOut' });
        } else if (w.state === 'happy' && w.left <= 0) {
          w.state = 'out';
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
      const opts = { height: 320, speed: 120, near: 520, textScale: () => PE.App.dpr / this.cameras.main.zoom };
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
        this.managerActor = new PE.Anim.Actor(this, manager, { x: at.x, y: at.y, height: 250 });
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
      return { min: fit * 0.96, max: 1.5 * PE.App.dpr };
    }
    setUpCamera() {
      const cam = this.cameras.main;
      const lim = this.zoomLimits();
      // A little further back as the room grows.
      // The whole room across the screen, as close as that allows.
      cam.setZoom(Phaser.Math.Clamp(this.scale.width / (this.room ? this.w * 0.92 : this.w + (this.size - 1) * 80), lim.min, lim.max));
      const first = this.spot(0);
      cam.centerOn(this.w / 2, this.room ? this.h * 0.55 : first.y);
      cam.preRender();
      this.clampCamera();
    }
    clampCamera() {
      const cam = this.cameras.main;
      const vw = cam.width / cam.zoom, vh = cam.height / cam.zoom;
      const extra = 130 * PE.App.dpr / cam.zoom;
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
    tapAt(sx, sy) {
      const pt = this.cameras.main.getWorldPoint(sx, sy);
      const near = (i) => { const c = this.spot(i); return Math.abs(pt.x - c.x) < 230 && pt.y > c.y - 200 && pt.y < c.y + 220; };
      if (this.ghostAt !== null && this.ghostAt !== undefined && near(this.ghostAt)) {
        const r = this.g.facilities.buyStation(this.fid);
        if (!r.ok) { PE.Dom.toast(r.why === 'cash' ? 'Not enough cash yet' : 'This one opens as the place grows'); this.g.emit('lockedTap', {}); } else PE.App.saveGame();
        return;
      }
      const slots = this.g.business.slots(this.fid);
      for (let i = 0; i < slots.length; i++) {
        if (!near(i)) continue;
        const s = slots[i];
        // A finished batch is collected on the spot. Anything else opens that slot's menu.
        if (!this.retail && s.job && this.g.now() >= s.job.endMs && !this.g.business.lineWaiting(this.fid, s)) {
          const r = this.g.business.claimLine(this.fid, i);
          if (r && r.ok !== false) { PE.Dom.toast('Batch collected!', '', 'ACT-03'); PE.App.saveGame(); }
          return;
        }
        if (!s.sku && !s.job) { PE.App.openPanel('skuPicker', { fid: this.fid, i, mode: this.row.mode }); return; }
        PE.App.openPanel('business', { fid: this.fid });
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
})(globalThis.PE = globalThis.PE || {});
