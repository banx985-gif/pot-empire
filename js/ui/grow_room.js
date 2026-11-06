// The grow room: one open floor, pan and pinch-zoom, fixed setups. Each upgrade makes it bigger, with more spots.
// The hydro stations are real art, built from pieces (data/hydro_anchors.js says where they attach). The room's
// floor and walls are STAND-INS until art/rooms/ROOM-Fnn-1..3 arrive (they're used by file name once imported). There
// are no pads: the spots come from js/logic/layout.js. This file only draws and passes taps along.
// (An outdoor grow, if Aaron wants one, would be another screen like this: soil plots and water, no lights.)
(function (PE) {
  const { WORLD } = PE.Layout;
  const FONT = 'system-ui, sans-serif';
  const { Layout } = PE;
  const LOOK = Math.sin((WORLD.lookDown * Math.PI) / 180);

  const lighten = (c, f) => {
    const r = (c >> 16) & 255, g = (c >> 8) & 255, b = c & 255;
    const mix = (v) => Math.round(v + (255 - v) * f);
    return (mix(r) << 16) | (mix(g) << 8) | mix(b);
  };
  const darken = (c, f) => {
    const r = (c >> 16) & 255, g = (c >> 8) & 255, b = c & 255;
    return (Math.round(r * (1 - f)) << 16) | (Math.round(g * (1 - f)) << 8) | Math.round(b * (1 - f));
  };

  class GrowRoom extends Phaser.Scene {
    constructor() { super('garage'); }

    init(params) {
      this.fid = params.fid || 'F01';
      this.testOverride = params.test || null;
    }

    create() {
      const app = PE.App;
      this.g = app.g;
      this.bal = this.g.B;
      const row = this.g.facilities.row(this.fid);
      this.room = PE.Layout.room(PE.Data, row.stations);
      // Which of the room's 3 sizes it's at. Spots beyond that aren't part of the room yet.
      this.roomSize = this.testOverride ? 3 : this.g.facilities.roomSize(this.fid);
      this.open = this.testOverride ? row.stations : this.g.facilities.roomSpots(this.fid, this.roomSize);
      this.view = this.testOverride ? this.room : PE.Layout.roomView(this.room, this.open, this.roomSize);
      this.harvestAnims = [];
      this.stationViews = new Map();
      this.floaters = [];
      this.roomSig = null;
      this.lastRefresh = 0;
      this.ready = false;
      this.cameras.main.setBackgroundColor('#140a24');
      this.showAnchorMarks = !!(PE.App.debugAnchors);

      this.drawRoom();
      this.bars = this.add.graphics().setDepth(100000);
      this.setUpCamera();
      this.setUpInput();

      this.unsub = this.g.on((type, e) => this.onGameEvent(type, e));
      // Any touch, anywhere, skips a harvest animation.
      const skip = () => this.finishHarvestAnims();
      window.addEventListener('pointerdown', skip, true);
      this.events.once('shutdown', () => {
        window.removeEventListener('pointerdown', skip, true);
        this.unsub();
        this.stationViews.forEach((v) => { v.gone = true; });
        PE.EdgeArrows.clear();
        for (const k of this.textures.getTextureKeys()) if (k.startsWith('buds-')) this.textures.remove(k);
      });
      this.events.on('sleep', () => PE.EdgeArrows.clear());

      this.makeRoomTextures();
      PE.UI.loadIcons(this, ['ACT-01', 'ACT-04'], () => {});
      this.lastCull = '';
      this.helperLife = null;
      this.refresh(true);
      this.ready = true;
      if (!PE.App.state.settings.reducedMotion && !this.testOverride) this.cameras.main.fadeIn(170, 20, 10, 36);
    }

    calm() { return PE.App.state.settings.reducedMotion || this.testOverride || (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches); }

    makeRoomTextures() {
      const once = (key, w, h, draw) => {
        if (this.textures.exists(key)) return;
        const G = this.make.graphics({ x: 0, y: 0, add: false });
        draw(G);
        G.generateTexture(key, w, h);
        G.destroy();
      };
      // The light's cone: brightest at the top, fading out sideways and down.
      once('room-cone', 400, 600, (G) => {
        for (let i = 0; i < 12; i++) {
          const k = 1 - i / 12;
          G.fillStyle(0xfff4c0, 0.035).fillTriangle(200, 0, 200 - 190 * k, 600, 200 + 190 * k, 600);
        }
      });
      once('room-glow', 256, 256, (G) => { for (let r = 124; r > 0; r -= 8) G.fillStyle(0xa6ff3d, 0.055).fillCircle(128, 128, r); });
      // STAND-INS for MOOD-01..03: a plain face.
      [0, 1, 2].forEach((m) => once('room-mood-' + m, 72, 72, (G) => {
        G.fillStyle(0x1d0f33, 1).fillCircle(36, 36, 35);
        G.fillStyle([0xff6a5a, 0xffd84d, 0xa6ff3d][m], 1).fillCircle(36, 36, 31);
        G.fillStyle(0x1d0f33, 1).fillCircle(25, 29, 5).fillCircle(47, 29, 5);
        G.lineStyle(5, 0x1d0f33, 1);
        if (m === 1) G.lineBetween(23, 49, 49, 49);
        else {
          const dir = m === 2 ? 1 : -1;
          let last = null;
          for (let i = 0; i <= 8; i++) { const t = i / 8, x = 21 + 30 * t, y = 47 + dir * (6 - 24 * (t - 0.5) ** 2 * 1.5); if (last) G.lineBetween(last[0], last[1], x, y); last = [x, y]; }
        }
      }));
    }

    // ---- The room itself ----------------------------------------------------------
    drawRoom() {
      const { w, h } = this.view;
      const wall = WORLD.wallHeight;
      const f = this.g.facilities.get(this.fid);
      const reno = f ? f.renovation : 0;
      const G = this.add.graphics().setDepth(-1000);
      this.roomG = G;
      // A bought or earned room theme (Shop) swaps the base colours; renovations still lighten them.
      const theme = PE.App.g.purchases ? PE.App.g.purchases.theme() : null;
      const custom = theme && theme.name !== 'Classic';
      const wallColor = custom ? lighten(theme.wall, reno * 0.06) : [0x2c1a4d, 0x33205a, 0x3a2666, 0x452d78][reno];
      const floorColor = custom ? lighten(theme.floor, reno * 0.06) : [0x3a3346, 0x41394f, 0x4a4159, 0x544a66][reno];

      G.fillStyle(wallColor, 1).fillRect(0, 0, w, wall);
      G.fillStyle(floorColor, 1).fillRect(0, wall, w, h - wall);

      // Floor tiles, squashed to the ~44 degree look-down angle.
      const tile = 180;
      G.lineStyle(2, 0xffffff, 0.05);
      for (let x = 0; x <= w; x += tile) G.lineBetween(x, wall, x, h);
      for (let y = wall; y <= h; y += tile * LOOK) G.lineBetween(0, y, w, y);

      // Thin plain structural borders: bottom of back wall, thin side walls, roofless top edge.
      G.lineStyle(4, 0xffffff, 0.25).lineBetween(0, wall, w, wall);
      G.fillStyle(darken(wallColor, 0.25), 1).fillRect(0, 0, 14, h).fillRect(w - 14, 0, 14, h);
      G.lineStyle(2, 0xffffff, 0.2).lineBetween(0, 1, w, 1);

      // Renovations visibly add aligned floor and wall sections.
      for (let i = 0; i < reno; i++) {
        const secW = w / 3;
        G.fillStyle([0xff4fa3, 0x52e6ff, 0xc6ff3d][i], 0.12).fillRect(secW * i, 0, secW, wall);
        G.fillStyle([0xff4fa3, 0x52e6ff, 0xc6ff3d][i], 0.05).fillRect(secW * i, wall, secW, h - wall);
      }

      const row = this.g.facilities.row(this.fid);
      this.add.text(w / 2, wall * 0.5, row.name.toUpperCase(), {
        fontFamily: FONT, fontStyle: '900', fontSize: '74px', color: '#ff4fa3', stroke: '#c6ff3d', strokeThickness: 4,
      }).setOrigin(0.5).setAlpha(0.55).setDepth(-999);

      // The real room picture for this size, if it's been drawn and imported.
      if (!this.testOverride) PE.MapArt.load(this, `ROOM-${this.fid}-${this.roomSize}`, (key) => { this.add.image(0, 0, key).setOrigin(0, 0).setDisplaySize(w, h).setDepth(-998); });

      // The next slot, where it will go: a dashed ghost with its price.
      this.ghostG = this.add.graphics().setDepth(-900);
      this.ghostText = this.add.text(0, 0, '', { fontFamily: FONT, fontStyle: 'bold', fontSize: '40px', color: '#ffffff', align: 'center', stroke: '#140a24', strokeThickness: 6 }).setOrigin(0.5).setDepth(-899).setVisible(false);
      this.ghostSig = null;
    }
    drawGhost() {
      const i = this.stationCount();
      const on = !this.testOverride && i < this.open && i < this.room.stations.length;
      const canBuy = on && this.g.facilities.canBuyStation(this.fid);
      const sig = on ? `${i}|${canBuy}|${canBuy ? this.g.facilities.nextStationCost(this.fid) : ''}` : '';
      if (sig === this.ghostSig) return;
      this.ghostSig = sig;
      this.ghostG.clear();
      this.ghostText.setVisible(on);
      this.ghost = on ? i : null;
      if (!on) return;
      const b = PE.Layout.setupBounds(this.room.stations[i], this.room.box);
      const x0 = b.left + 60, x1 = b.right - 60, y0 = b.top + 240, y1 = b.bottom - 40;
      const dash = (ax, ay, bx, by) => { const n = Math.floor(Math.hypot(bx - ax, by - ay) / 54); for (let k = 0; k < n; k += 2) this.ghostG.lineBetween(ax + ((bx - ax) * k) / n, ay + ((by - ay) * k) / n, ax + ((bx - ax) * (k + 1)) / n, ay + ((by - ay) * (k + 1)) / n); };
      this.ghostG.lineStyle(8, canBuy ? 0xc6ff3d : 0xffffff, canBuy ? 0.75 : 0.25);
      dash(x0, y0, x1, y0); dash(x1, y0, x1, y1); dash(x1, y1, x0, y1); dash(x0, y1, x0, y0);
      this.ghostText.setPosition((x0 + x1) / 2, (y0 + y1) / 2).setAlpha(canBuy ? 1 : 0.4)
        .setText(canBuy ? `+ Station\n${PE.Dom.money(this.g.facilities.nextStationCost(this.fid))}` : 'Next station\nopens as this place grows');
    }

    // ---- Camera: pan, pinch, limits -------------------------------------------------------------
    zoomLimits() {
      const dpr = PE.App.dpr;
      const W = this.scale.width, H = this.scale.height;
      const { box } = this.room;
      const { w, h } = this.view;
      const fitRoom = Math.min(W / w, H / h);
      const fitSetup = W / (box.halfW * 2 + 24);
      return { min: Math.min(fitRoom, fitSetup) * 0.96, fitSetup, max: 1.7 * dpr };
    }

    // Default: as close as the pots you own allow, so early plants aren't tiny and are easy to tap.
    defaultZoom() {
      const lim = this.zoomLimits();
      let cap = 2;
      this.g.grow.eachStation((f, si, st) => { if (f === this.fid) cap = Math.max(cap, st.pots.length); });
      if (this.testOverride) cap = 7;
      const width = cap >= 7 ? this.room.box.halfW * 2 + 24 : Math.max(1050, (cap + 2) * WORLD.potSpacing + 260);
      return Phaser.Math.Clamp(this.scale.width / width, lim.fitSetup, lim.max);
    }

    setUpCamera() {
      const cam = this.cameras.main;
      const memory = (PE.App.cameraMemory || {})[this.fid];
      // The room grew: the camera pulls back to show it, rather than staying where it was.
      const saved = memory && memory.size === this.roomSize ? memory : null;
      this.stageOn = !this.testOverride && this.wantsStage();
      if (this.stageOn) {
        // First play: right in on one pot under one bulb, filling the screen.
        const s0 = this.room.stations[0];
        cam.setZoom(this.stageZoom());
        cam.centerOn(s0.x, s0.y - 200);
      } else if (saved) {
        cam.setZoom(saved.zoom);
        cam.centerOn(saved.x, saved.y);
      } else {
        cam.setZoom(this.defaultZoom());
        const s0 = this.room.stations[0];
        cam.centerOn(s0.x - (this.testOverride ? 0 : WORLD.potSpacing / 2), s0.y - WORLD.railHeight * 0.3);
      }
      this.clampCamera();
    }

    wantsStage() {
      const s = this.g.tutorial.active() && this.fid === 'F01' ? this.g.tutorial.step() : null;
      return !!(s && s.camera === 'close');
    }
    stageZoom() { return Phaser.Math.Clamp(this.scale.width / 580, this.zoomLimits().min, this.zoomLimits().max); }
    // A smooth move of the camera. Reduced motion just goes there.
    glide(zoom, x, y, ms = 650) {
      const cam = this.cameras.main;
      const stop = () => { cam.setZoom(zoom); cam.centerOn(x, y); cam.preRender(); this.clampCamera(); };
      if (this.glideTween) this.glideTween.stop();
      if (this.calm()) { stop(); return; }
      const z0 = cam.zoom, x0 = cam.midPoint.x, y0 = cam.midPoint.y;
      this.glideTween = this.tweens.addCounter({
        from: 0, to: 1, duration: ms, ease: 'Sine.easeInOut',
        onUpdate: (tw) => { const t = tw.getValue(); cam.setZoom(z0 + (zoom - z0) * t); cam.centerOn(x0 + (x - x0) * t, y0 + (y - y0) * t); cam.preRender(); },
        onComplete: stop,
      });
    }
    // The guide's close-up ends: the camera pulls back to show more of the room.
    checkStage() {
      if (!this.stageOn || this.wantsStage()) return;
      this.stageOn = false;
      const s0 = this.room.stations[0];
      this.glide(this.defaultZoom(), s0.x - WORLD.potSpacing / 2, s0.y - WORLD.railHeight * 0.3, 900);
    }
    // ---- Close-up: double-tap a station to go right in, swipe sideways for the next one -----------------
    closeZoom() { return Phaser.Math.Clamp(this.scale.width / 1100, this.zoomLimits().min, this.zoomLimits().max); }
    enterCloseUp(si) {
      this.closeSi = si;
      const p = this.room.stations[si];
      this.glide(this.closeZoom(), p.x, p.y - 240, 320);
    }
    leaveCloseUp() {
      if (this.closeSi === undefined || this.closeSi === null) return;
      this.closeSi = null;
      const p = this.cameras.main.midPoint;
      this.glide(this.defaultZoom(), p.x, p.y, 320);
    }
    swipeCloseUp(dir) {
      const next = this.closeSi + dir;
      if (next < 0 || next >= this.stationCount()) return false;
      this.enterCloseUp(next);
      return true;
    }

    clampCamera() {
      const cam = this.cameras.main;
      const { w, h } = this.view;
      const vw = cam.width / cam.zoom, vh = cam.height / cam.zoom;
      const mid = cam.midPoint;
      // Room stays reachable behind the top bar and bottom tabs: allow some extra travel.
      const extraY = 130 * PE.App.dpr / cam.zoom;
      const clamp = (v, lo, hi) => (lo > hi ? (lo + hi) / 2 : Math.min(hi, Math.max(lo, v)));
      cam.centerOn(clamp(mid.x, vw / 2, w - vw / 2), clamp(mid.y, vh / 2 - extraY, h - vh / 2 + extraY));
      (PE.App.cameraMemory = PE.App.cameraMemory || {})[this.fid] = { zoom: cam.zoom, x: cam.midPoint.x, y: cam.midPoint.y, size: this.roomSize };
    }

    setZoomAround(zoom, sx, sy) {
      const cam = this.cameras.main;
      const lim = this.zoomLimits();
      const before = cam.getWorldPoint(sx, sy);
      cam.setZoom(Phaser.Math.Clamp(zoom, lim.min, lim.max));
      cam.preRender();
      const after = cam.getWorldPoint(sx, sy);
      cam.scrollX += before.x - after.x;
      cam.scrollY += before.y - after.y;
      cam.preRender();
      this.clampCamera();
    }

    setUpInput() {
      const input = this.input;
      input.addPointer(2);
      const moved = 12 * PE.App.dpr;
      let drag = null, pinch = null;

      // A touch that started on a menu is the menu's, never the room's.
      const onCanvas = (p) => !p.event || p.event.target === this.game.canvas;
      const menuOpen = () => !!PE.Dom.panelRoute || !!PE.Dom.modalNow;

      input.on('pointerdown', (p) => {
        if (!onCanvas(p) || menuOpen()) { drag = null; return; }
        const a = input.pointer1, b = input.pointer2;
        if (a.isDown && b.isDown) {
          this.closeSi = null;
          pinch = { dist: Phaser.Math.Distance.Between(a.x, a.y, b.x, b.y), zoom: this.cameras.main.zoom };
          drag = null;
        } else {
          drag = { id: p.id, sx: p.x, sy: p.y, lastX: p.x, lastY: p.y, moved: false };
        }
      });
      input.on('pointermove', (p) => {
        const cam = this.cameras.main;
        if (pinch && input.pointer1.isDown && input.pointer2.isDown) {
          const a = input.pointer1, b = input.pointer2;
          const d = Phaser.Math.Distance.Between(a.x, a.y, b.x, b.y);
          this.setZoomAround((pinch.zoom * d) / pinch.dist, (a.x + b.x) / 2, (a.y + b.y) / 2);
          return;
        }
        if (!drag || p.id !== drag.id || !p.isDown) return;
        if (!drag.moved && Math.hypot(p.x - drag.sx, p.y - drag.sy) > moved) drag.moved = true;
        if (drag.moved) {
          // In a close-up, sideways is for the next station.
          if (this.closeSi === null || this.closeSi === undefined) cam.scrollX -= (p.x - drag.lastX) / cam.zoom;
          cam.scrollY -= (p.y - drag.lastY) / cam.zoom;
          cam.preRender();
          this.clampCamera();
        }
        drag.lastX = p.x; drag.lastY = p.y;
      });
      input.on('pointerup', (p) => {
        if (pinch) { if (!input.pointer1.isDown && !input.pointer2.isDown) pinch = null; drag = null; return; }
        if (drag && p.id === drag.id) {
          if (!drag.moved) this.tapAt(p.x, p.y);
          else if (this.closeSi !== null && this.closeSi !== undefined && Math.abs(p.x - drag.sx) > 70 * PE.App.dpr && Math.abs(p.x - drag.sx) > Math.abs(p.y - drag.sy)) this.swipeCloseUp(p.x < drag.sx ? 1 : -1);
        }
        drag = null;
      });
      input.on('wheel', (p, over, dx, dy) => this.setZoomAround(this.cameras.main.zoom * (dy > 0 ? 0.9 : 1.1), p.x, p.y));
    }

    // ---- Tapping ----------------------------------------------------------------------------------
    hitAt(wx, wy) {
      const owned = this.stationCount();
      const box = this.room.box;
      if (this.ghost !== null && this.ghost !== undefined) {
        const b = PE.Layout.setupBounds(this.room.stations[this.ghost], box);
        if (wx > b.left + 60 && wx < b.right - 60 && wy > b.top + 240 && wy < b.bottom - 40) return { ghost: true };
      }
      for (let si = owned - 1; si >= 0; si--) {
        const pos = this.room.stations[si];
        const st = this.stationData(si);
        if (Math.abs(wx - pos.x) > box.halfW) continue;
        if (wy < pos.y - box.up || wy > pos.y + box.down) continue;
        // Front pots are nearest the camera, so they're checked first.
        const order = st.pots.map((_, pi) => pi).sort((a, b) => Layout.slotY(PE.Data, st.model, b) - Layout.slotY(PE.Data, st.model, a));
        for (const pi of order) {
          const ax = pos.x + Layout.anchorX(pi), ay = pos.y + Layout.slotY(PE.Data, st.model, pi);
          if (Math.abs(wx - ax) <= WORLD.potSpacing / 2 && wy <= ay + 56 && wy >= ay - 240) return { si, pi };
        }
        return { si, pi: null };
      }
      return null;
    }

    tapAt(sx, sy) {
      const pt = this.cameras.main.getWorldPoint(sx, sy);
      const hit = this.hitAt(pt.x, pt.y);
      if (this.testOverride) return;
      const g = this.g;
      // A ripe plant is picked at once. Anything else waits a moment, in case it's the first of a double-tap.
      const ripe = hit && !hit.ghost && hit.pi !== null && (() => { const p = this.stationData(hit.si).pots[hit.pi]; return p && g.now() >= p.readyMs; })();
      if (ripe) { g.grow.harvest(this.fid, hit.si, hit.pi); return; }
      // A helper in the gaps between setups: tap for a tip or a joke.
      if (!hit && this.helperLife) {
        const e = this.helperLife.tap(pt.x, pt.y);
        if (e) { g.helpers.chat(e.id); return; }
      }
      if (this.tapWait) {
        this.tapWait.remove();
        this.tapWait = null;
        if (this.closeSi !== null && this.closeSi !== undefined) this.leaveCloseUp();
        else if (hit && !hit.ghost) this.enterCloseUp(hit.si);
        return;
      }
      if (!hit) { this.tapWait = this.time.delayedCall(240, () => { this.tapWait = null; }); return; }
      if (g.tutorial.active()) { this.actOnTap(hit); return; }
      this.tapWait = this.time.delayedCall(240, () => { this.tapWait = null; this.actOnTap(hit); });
    }
    actOnTap(hit) {
      if (PE.Dom.panelRoute || PE.Dom.modalNow) return;
      const g = this.g;
      if (hit.ghost) {
        const r = g.facilities.buyStation(this.fid);
        if (!r.ok) { PE.Dom.toast(r.why === 'cash' ? 'Not enough cash yet' : 'This one opens as the place grows'); g.emit('lockedTap', {}); } else PE.App.saveGame();
        return;
      }
      const { si, pi } = hit;
      if (pi === null) { PE.App.openPanel('station', { fid: this.fid, si }); return; }
      const p = this.stationData(si).pots[pi];
      if (!p) { PE.App.openPanel('strainPicker', { fid: this.fid, si, pi }); return; }
      if (g.now() >= p.readyMs) g.grow.harvest(this.fid, si, pi);
      else PE.App.openPanel('plant', { fid: this.fid, si, pi });
    }
    // Page point to room point: the drag tools use this.
    pageToWorld(px, py) {
      const r = this.game.canvas.getBoundingClientRect();
      return this.cameras.main.getWorldPoint(((px - r.left) * this.scale.width) / r.width, ((py - r.top) * this.scale.height) / r.height);
    }

    // Where a pot is on screen, in page points. Used by the automatic browser test to really tap it.
    potPagePoint(si, pi) {
      const pos = this.room.stations[si];
      const m = this.stationData(si).model;
      return this.worldToPage(pos.x + Layout.anchorX(pi), pos.y + Layout.slotY(PE.Data, m, pi) - 30);
    }
    benchPagePoint(si) { const pos = this.room.stations[si]; return this.worldToPage(pos.x, pos.y + 150); }
    // Moves the camera, if it has to, so a station's pots can be seen. Used by the first-time guide.
    showStation(si) {
      const pos = this.room.stations[si];
      const cam = this.cameras.main;
      const v = cam.worldView;
      const margin = 170 * PE.App.dpr / cam.zoom;
      if (pos.y > v.y + margin && pos.y < v.bottom - margin) return;
      cam.centerOn(pos.x - WORLD.potSpacing / 2, pos.y - WORLD.railHeight * 0.3);
      cam.preRender();
      this.clampCamera();
    }
    worldToPage(wx, wy) {
      const cam = this.cameras.main;
      const r = this.game.canvas.getBoundingClientRect();
      const sx = (wx - cam.midPoint.x) * cam.zoom + cam.width / 2;
      const sy = (wy - cam.midPoint.y) * cam.zoom + cam.height / 2;
      return { x: r.left + (sx * r.width) / this.scale.width, y: r.top + (sy * r.height) / this.scale.height };
    }

    onGameEvent(type, e) {
      if (type === 'harvest' && e.facility === this.fid) { this.playHarvest(e); this.floatHarvest(e); }
      if (this.helperLife) {
        if (type === 'harvest' && e.facility === this.fid) {
          const haze = this.helperLife.list.find((x) => x.id === 'HAZE');
          // A high-quality bud gets a closer look from Uncle Haze.
          if (haze && e.grade >= 3 && haze.state !== 'chat' && !this.helperLife.frozen()) { this.helperLife.liveMove(haze, 'inspect'); } else this.helperLife.react('harvest');
        }
        else if (type === 'lockedTap') this.helperLife.react('locked');
      }
      if (type === 'watered' && e.facility === this.fid) this.splash(e.station);
    }

    floatHarvest(e) {
      const pos = this.room.stations[e.station];
      const x = pos.x + Layout.anchorX(e.pot), y = pos.y + Layout.slotY(PE.Data, this.stationData(e.station).model, e.pot) - 150;
      const grade = this.bal.quality.grades[e.grade];
      const label = `+$${PE.Money.format(e.cash)}${e.grade > 0 ? ' ' + grade.name : ''}${e.doubled ? ' x2!' : ''}${e.wilted ? ' (wilted)' : ''}`;
      const t = this.add.text(x, y, label, {
        fontFamily: FONT, fontStyle: 'bold', fontSize: '30px', color: e.grade >= 3 ? '#ffd84d' : '#c6ff3d', stroke: '#1d0f33', strokeThickness: 6,
      }).setOrigin(0.5).setDepth(100001);
      const still = PE.App.state.settings.reducedMotion;
      this.tweens.add({ targets: t, y: still ? y : y - 70, alpha: 0, duration: still ? 900 : 1100, ease: 'Sine.easeOut', onComplete: () => t.destroy() });
    }

    // The sprinkler's spray bursts for a moment, and a "+" pops, when you water.
    splash(si) {
      const v = this.stationViews.get(si);
      const pos = this.room.stations[si];
      if (!pos) return;
      const t = this.add.text(pos.x, pos.y - 300, 'Watered!', { fontFamily: FONT, fontStyle: 'bold', fontSize: '34px', color: '#7fe9ff', stroke: '#140a24', strokeThickness: 6 }).setOrigin(0.5).setDepth(100001);
      const still = this.calm();
      this.tweens.add({ targets: t, y: still ? t.y : t.y - 60, alpha: 0, duration: still ? 700 : 950, onComplete: () => t.destroy() });
      if (v && v.spray && !still) {
        v.spray.setVisible(v.shown !== false).setAlpha(1);
        this.tweens.add({ targets: v.spray, alpha: 0.5, duration: 700 });
      }
    }

    // ---- The harvest: the plant is stripped, its buds fly to the top bar. Under 1.5 seconds, and any touch skips it. ----
    budPieces(strainId, f) {
      const key = 'buds-' + strainId;
      if (this.textures.exists(key)) return key;
      const sheet = this.textures.get('sheet-' + strainId);
      const src = sheet && sheet.getSourceImage();
      if (!src || !src.width) return null;
      const size = 64, S = PE.UI.SHEET_SCALE;
      const canvas = this.textures.createCanvas(key, size * 8, size);
      if (!canvas) return null;
      const c = canvas.getContext();
      // Round patches cut from the top of this strain's own mature picture: nothing newly drawn.
      for (let i = 0; i < 8; i++) {
        const u = 0.28 + 0.44 * ((i * 0.618) % 1), v = 0.08 + 0.42 * ((i * 0.37) % 1);
        const sw = f.w * S * 0.2;
        const sx = f.x * S + f.w * S * u - sw / 2, sy = f.y * S + f.h * S * v - sw / 2;
        c.save();
        c.beginPath();
        c.arc(i * size + size / 2, size / 2, size / 2 - 2, 0, Math.PI * 2);
        c.clip();
        c.drawImage(src, sx, sy, sw, sw, i * size, 0, size, size);
        c.restore();
        canvas.add('b' + i, 0, i * size, 0, size, size);
      }
      canvas.refresh();
      return key;
    }
    finishHarvestAnims() {
      const list = this.harvestAnims;
      this.harvestAnims = [];
      list.forEach((a) => a.finish());
    }
    playHarvest(e) {
      const v = this.stationViews.get(e.station);
      const pv = v && v.pots[e.pot];
      if (!pv || !pv.img || v.shown === false || this.testOverride) return;
      const img = pv.img;
      pv.img = null;
      pv.key = undefined;
      if (pv.tween) { pv.tween.stop(); pv.tween = null; }
      if (pv.fx) { pv.fx.destroy(); pv.fx = null; }
      if (pv.glow) { pv.glowTween && pv.glowTween.stop(); pv.glow.destroy(); pv.glow = null; pv.glowTween = null; }
      if (img.type !== 'Image') { img.destroy(); return; }
      const calm = this.calm();
      const cam = this.cameras.main;
      const parts = [img];
      const tweens = [];
      const f = PE.Data.strainFrames.sheets[e.strainId].frames[5];
      const width = f.w * WORLD.plantScale;
      const x = img.x, base = img.y, tall = f.h * WORLD.plantScale;
      img.setTint(0xffffff);
      let finished = false;
      const anim = { finish: () => { if (finished) return; finished = true; tweens.forEach((t) => t.stop()); parts.forEach((o) => { if (o.scene) o.destroy(); }); } };
      this.harvestAnims.push(anim);
      const done = () => { anim.finish(); this.harvestAnims = this.harvestAnims.filter((a) => a !== anim); };

      // The stripped stalk takes the plant's place, lined up by its stem. Until it arrives, the plant just fades.
      const art = PE.Data.plantArt[e.strainId];
      const toStalk = (key) => {
        if (finished || !img.scene || !art || !art.stalk) return;
        const [w, h, stem] = art.stalk;
        const k = width / w;
        const stalk = this.add.image(x, base, key).setOrigin(stem, 1).setDisplaySize(w * k, h * k).setDepth(img.depth);
        parts.push(stalk);
        img.setVisible(false);
        if (!calm) tweens.push(this.tweens.add({ targets: stalk, delay: 550, duration: 650, alpha: 0, scaleX: stalk.scaleX * 0.82, scaleY: stalk.scaleY * 0.82, ease: 'Sine.easeIn' }));
      };
      this.loadPlantArt('stalk', e.strainId, toStalk);
      tweens.push(this.tweens.add({ targets: img, alpha: calm ? 0.5 : 0, duration: calm ? 200 : 700 }));
      if (calm) { tweens.push(this.tweens.addCounter({ from: 0, to: 1, duration: 450, onComplete: done })); return; }

      // 4 to 8 bud pieces pop off and arc to the top bar.
      const key = this.budPieces(e.strainId, f);
      const cash = document.querySelector('.cash');
      const r = this.game.canvas.getBoundingClientRect();
      const box = cash ? cash.getBoundingClientRect() : { left: r.left + 60, top: r.top + 20, width: 0, height: 0 };
      const target = cam.getWorldPoint(((box.left + box.width / 2 - r.left) * this.scale.width) / r.width, ((box.top + box.height / 2 - r.top) * this.scale.height) / r.height);
      const n = Math.min(8, 4 + e.grade + (this.harvestAnims.length > 3 ? -2 : 1));
      if (key) for (let i = 0; i < n; i++) {
        const sx = x + (i - (n - 1) / 2) * (width / n) * 0.8, sy = base - tall * (0.45 + 0.4 * ((i * 0.618) % 1));
        const bud = this.add.image(sx, sy, key, 'b' + (i % 8)).setDepth(100000 + i).setDisplaySize(40, 40);
        parts.push(bud);
        const apexX = sx + (i - n / 2) * 30, apexY = sy - 110 - (i % 3) * 30;
        tweens.push(this.tweens.addCounter({
          from: 0, to: 1, delay: i * 45, duration: 760, ease: 'Sine.easeIn',
          onUpdate: (tw) => {
            const t = tw.getValue(), a = (1 - t) ** 2, b = 2 * t * (1 - t), c = t * t;
            bud.setPosition(a * sx + b * apexX + c * target.x, a * sy + b * apexY + c * target.y);
            bud.setDisplaySize(40 - t * 18, 40 - t * 18);
          },
          onComplete: () => bud.setVisible(false),
        }));
      }
      // The +N counter at the plant.
      const label = this.add.text(x, base - tall - 20, `+${n}`, { fontFamily: FONT, fontStyle: '900', fontSize: '46px', color: '#c6ff3d', stroke: '#140a24', strokeThickness: 7 }).setOrigin(0.5).setDepth(100002);
      parts.push(label);
      tweens.push(this.tweens.add({ targets: label, y: label.y - 70, alpha: 0, duration: 1100, ease: 'Sine.easeOut' }));
      tweens.push(this.tweens.addCounter({ from: 0, to: 1, duration: 1300, onComplete: done }));
    }
    // A wilted plant or stalk picture, fetched the first time it's needed.
    loadPlantArt(kind, strainId, ready) {
      const n = strainId.replace('STR-', '');
      const key = `${kind}-${strainId}`;
      if (this.textures.exists(key)) { ready(key); return; }
      const img = new Image();
      img.onload = () => { if (this.sys.settings.status >= Phaser.Scenes.SHUTDOWN) return; if (!this.textures.exists(key)) this.textures.addImage(key, img); ready(key); };
      img.src = kind === 'stalk' ? `assets/plants_stalk/STALK-STR-${n}.webp` : `assets/plants_wilted/WILT-STR-${n}.webp`;
    }

    // ---- Stations ------------------------------------------------------------------------------------
    stationCount() {
      return this.testOverride ? this.testOverride.stations.length : this.g.facilities.ownedStationCount(this.fid);
    }

    stationData(si) {
      return this.testOverride ? this.testOverride.stations[si] : this.g.grow.stationOf(this.fid, si);
    }

    // Haze and friends wander the gaps between the setups. Not during the guide: Haze is talking to you then.
    buildLife() {
      const R = this.room, box = R.box;
      const cols = Math.min(R.cols, Math.max(1, this.open));
      const rows = Math.max(1, Math.ceil(this.open / R.cols));
      const first = R.stations[0];
      const xs = [first.x - box.halfW + 130 - WORLD.margin];
      for (let c = 0; c < cols; c++) xs.push(first.x + c * (box.halfW * 2 + WORLD.gapX) + box.halfW + (c < cols - 1 ? WORLD.gapX / 2 : Math.min(WORLD.gapX / 2, (this.view.w - (first.x + c * (box.halfW * 2 + WORLD.gapX) + box.halfW)) / 2)));
      const ys = [];
      for (let r = 0; r < rows; r++) ys.push(Math.min(this.view.h - 40, first.y + r * (box.up + box.down + WORLD.gapZ) + box.down + WORLD.gapZ * 0.4));
      const world = PE.HelperLife.aisleWorld(xs, ys, { height: 560, speed: 240, near: 1000, depth: 40000, textScale: () => PE.App.dpr / this.cameras.main.zoom });
      world.plantFor = (e, wilted) => this.plantForBudz(e, wilted);
      this.helperLife = new PE.HelperLife.Life(this, world);
    }
    // For Budz: the way to a spot just behind a plant, a little further up the screen than its pot, and how deep to draw him
    // on each stretch so the plant is in front of him. A thirsty or wilted plant if wilted, otherwise a growing one.
    plantForBudz(e, wilted) {
      const now = this.g.now();
      const found = [];
      for (let si = 0; si < this.stationCount(); si++) {
        const v = this.stationViews.get(si);
        this.stationData(si).pots.forEach((p, pi) => {
          if (!p || !v || !v.pots || !v.pots[pi] || !v.pots[pi].spot) return;
          const health = this.g.grow.plantHealth(this.fid, si, p, now);
          if (wilted ? health.wilted : (now < p.readyMs && !health.wilted)) found.push({ si, pi, spot: v.pots[pi].spot });
        });
      }
      if (!found.length) return null;
      const t = found[Math.floor(Math.random() * found.length)];
      const pos = this.room.stations[t.si];
      const x = pos.x + t.spot.x;
      const potDepth = pos.y + t.spot.y;
      const y = pos.y + t.spot.top - 8;                 // his feet, behind the rim of the pot
      const backY = pos.y - this.room.box.up - 20;      // the gap behind the whole setup
      const here = [e.actor.x, e.actor.y];
      const way = [here, [here[0], backY], [x, backY], [x, y]];
      const front = e.actor.fixedDepth;
      this.budzAt = { si: t.si, pi: t.pi, x, y, potDepth };
      return { way, depths: [front, front, potDepth - 1], backDepths: [potDepth - 1, front, front] };
    }
    // Every so often: is anything newly ripe, or newly wilted?
    watchPlants() {
      const L = this.helperLife;
      if (!L) return;
      let ripe = 0, wilted = 0;
      const now = this.g.now();
      for (let si = 0; si < this.stationCount(); si++) {
        for (const p of this.stationData(si).pots) {
          if (!p || now < p.readyMs) continue;
          ripe += 1;
          if (this.g.grow.plantHealth(this.fid, si, p, now).wilted) wilted += 1;
        }
      }
      if (wilted > (this.seenWilted || 0)) L.react('wilted');
      else if (ripe > (this.seenRipe || 0)) L.react('ripe');
      this.seenWilted = wilted;
      this.seenRipe = ripe;
    }
    update(time, delta) {
      if (!this.ready) return;
      if (!this.testOverride && !this.helperLife && !this.g.tutorial.active()) this.buildLife();
      if (this.helperLife) {
        const dt = Math.min(0.1, (delta || 16) / 1000);
        PE.Anim.stepAll(this, dt);
        this.helperLife.update(dt);
        if (PE.App.state.settings.helpers) this.helperLife.setVisible(true);
        if (time - (this.lastWatch || 0) > 3000) { this.lastWatch = time; this.watchPlants(); }
      }
      if (time - (this.lastRefresh || 0) < 200) return;
      this.lastRefresh = time;
      this.refresh();
    }

    refresh() {
      const count = this.stationCount();
      const now = this.testOverride ? this.testOverride.now : this.g.now();
      const f = this.g.facilities.get(this.fid);
      const size = this.testOverride ? 3 : this.g.facilities.roomSize(this.fid);
      const roomSig = `${count}|${f ? f.renovation : 0}|${size}`;
      if (this.roomSig && this.roomSig !== roomSig) { this.scene.restart(); return; }
      this.roomSig = roomSig;

      const B = this.bars;
      B.clear();
      this.drawGhost();
      this.checkStage();
      const arrows = [];
      const seen = this.cameras.main.worldView;
      for (let si = 0; si < count; si++) {
        const st = this.stationData(si);
        const pos = this.room.stations[si];
        const view = this.viewFor(si, st, pos);
        let growing = false;
        st.pots.forEach((p, pi) => {
          this.updatePot(view, si, st, pi, p, now, pos);
          if (p) growing = true;
          const spot = Layout.potSpot(PE.Data, st.model, pi, st.levels.pots);
          const x = pos.x + spot.x, y = pos.y;
          const pv = view.pots[pi];
          if (pv.seedIcon) pv.seedIcon.setVisible(!p);
          if (!p) {
            if (this.textures.exists('ui-ACT-01')) {
              // The real plant icon on an empty pot.
              if (!pv.seedIcon) pv.seedIcon = this.add.image(x, y + spot.rim - 44, 'ui-ACT-01').setDisplaySize(84, 84).setDepth(y + spot.y + 8);
            } else {
              B.lineStyle(6, 0xc6ff3d, 0.95);
              B.lineBetween(x - 14, y + spot.rim - 18, x + 14, y + spot.rim - 18);
              B.lineBetween(x, y + spot.rim - 32, x, y + spot.rim - 4);
            }
          } else if (now < p.readyMs) {
            const t = this.g.grow.potProgress(p, now);
            const by = y + spot.bottom + 8;
            B.fillStyle(0x000000, 0.6).fillRect(x - 46, by, 92, 12);
            B.fillStyle(0xc6ff3d, 1).fillRect(x - 45, by + 1, 90 * t, 10);
          }
        });
        const due = !this.testOverride && this.g.grow.serviceDue(this.fid, si);
        this.updateGadgets(view, si, st, pos, growing, now);
        // Something needs you, off the side of the screen: a red arrow points to it.
        if (!this.testOverride && (pos.x < seen.x || pos.x > seen.right || pos.y - 260 < seen.y || pos.y - 260 > seen.bottom) && (due && growing || st.pots.some((p) => p && now >= p.readyMs))) {
          arrows.push({ id: 's' + si, x: pos.x, y: pos.y - 260, tap: () => this.glide(this.cameras.main.zoom, pos.x, pos.y - 240, 300) });
        }
        if (due && !view.water && this.textures.exists('ui-ACT-04')) view.water = this.add.image(pos.x - 220, pos.y + 150, 'ui-ACT-04').setDisplaySize(64, 64).setDepth(pos.y + 330);
        if (view.water) view.water.setVisible(due);
        this.updateSpray(view, growing && !due);
      }
      if (!this.testOverride) PE.EdgeArrows.update(this, arrows);
      this.cullStations();
    }

    // The light, its cone, the water timer on the computer, the meter and the mood face.
    updateGadgets(v, si, st, pos, growing, now) {
      if (!v.ready || this.testOverride) return;
      if (v.lightOn !== growing) {
        const first = v.lightOn === undefined;
        v.lightOn = growing;
        if (v.light && v.light.setTint) { if (growing) v.light.clearTint(); else v.light.setTint(0x55505f); }
        if (v.cone) {
          v.cone.wantVisible = growing;
          v.cone.setVisible(growing && v.shown !== false);
          if (growing && !first && !this.calm()) { v.cone.setAlpha(0.9); this.tweens.add({ targets: v.cone, alpha: 0.4, duration: 600, ease: 'Sine.easeOut' }); } else v.cone.setAlpha(0.4);
        }
      }
      const meter = this.g.grow.waterMeter(this.fid, si, now);
      const auto = this.g.grow.autoWaters(this.fid, si);
      const left = this.g.grow.waterSecondsLeft(this.fid, si);
      const text = auto ? 'AUTO' : left <= 0 ? 'DRY' : `${String(Math.floor(left / 3600)).padStart(2, '0')}:${String(Math.floor(left / 60) % 60).padStart(2, '0')}:${String(Math.floor(left) % 60).padStart(2, '0')}`;
      if (v.timer && v.timer.text !== text) v.timer.setText(text).setColor(left <= 0 ? '#ff6a5a' : '#7fe9ff');
      if (v.shown !== false && v.meterAt) {
        const { x, y } = v.meterAt;
        this.bars.fillStyle(0x000000, 0.65).fillRect(x - 70, y, 140, 14);
        this.bars.fillStyle(meter < 0.25 ? 0xff6a5a : 0x52e6ff, 1).fillRect(x - 68, y + 2, 136 * meter, 10);
      }
      if (v.moodImg) {
        const mood = this.g.grow.mood(this.fid, si, now);
        if (mood === null) { v.moodImg.wantVisible = false; v.moodImg.setVisible(false); } else {
          v.moodImg.wantVisible = true;
          v.moodImg.setTexture('room-mood-' + mood).setDisplaySize(72, 72).setVisible(v.shown !== false);
        }
      }
    }

    // Stations off the screen aren't drawn: a big late-game room stays light.
    cullStations() {
      const v = this.cameras.main.worldView;
      const box = this.room.box;
      for (const [si, view] of this.stationViews) {
        const pos = this.room.stations[si];
        const on = pos.x + box.halfW > v.x && pos.x - box.halfW < v.right && pos.y + box.down > v.y && pos.y - box.up < v.bottom;
        if (view.shown === on) continue;
        view.shown = on;
        const set = (o) => { if (o) o.setVisible(on && o.wantVisible !== false); };
        view.parts.forEach(set);
        view.texts.forEach(set);
        view.pots.forEach((pv) => [pv.tray, pv.back, pv.front, pv.img, pv.logo, pv.logoBg, pv.fx, pv.glow].forEach((o) => { if (o) o.setVisible(on && !(o === pv.logo && !pv.logoShown)); }));
      }
    }

    // The spray: a gentle pulse while watering. Reduced motion leaves it still.
    updateSpray(view, watering) {
      const fx = view.spray;
      if (!fx) return;
      fx.wantVisible = watering;
      if (view.shown !== false) fx.setVisible(watering);
      const calm = PE.App.state.settings.reducedMotion || this.testOverride;
      if (watering && !calm && !view.sprayTween) {
        fx.setAlpha(0.45);
        const y0 = fx.y;
        view.sprayTween = this.tweens.add({ targets: fx, alpha: { from: 0.4, to: 0.8 }, y: { from: y0, to: y0 + 7 }, yoyo: true, repeat: -1, duration: 1300, ease: 'Sine.easeInOut' });
      } else if ((calm || !watering) && view.sprayTween) {
        view.sprayTween.stop();
        view.sprayTween = null;
        fx.setAlpha(0.55);
      } else if (calm && watering) fx.setAlpha(this.testOverride ? 0.85 : 0.55);
    }

    viewFor(si, st, pos) {
      const sig = `${st.model}|${st.levels.lights}|${st.levels.sprinkler}|${st.levels.pots}|${st.levels.computer}|${st.levels.capacity}|${st.pots.length}|${st.auto.harvest}|${st.auto.replant}`;
      let v = this.stationViews.get(si);
      if (v && v.sig === sig) return v;
      if (v) {
        v.gone = true;
        if (v.sprayTween) v.sprayTween.stop();
        if (v.water) v.water.destroy();
        v.parts.forEach((o) => o.destroy());
        v.texts.forEach((t) => t.destroy());
        v.pots.forEach((pv) => {
          [pv.seedIcon, pv.img, pv.logo, pv.logoBg, pv.fx, pv.tray, pv.back, pv.front, pv.glow].forEach((o) => { if (o) o.destroy(); });
          if (pv.tween) pv.tween.stop();
          if (pv.glowTween) pv.glowTween.stop();
        });
      }
      v = { sig, parts: [], texts: [], pots: st.pots.map(() => ({})), ready: false, si };
      this.stationViews.set(si, v);
      const m = st.model, L = st.levels;
      const ids = [`M${m}-FRAME`, `M${m}-BADGE`, `M${m}-BASE`, `M${m}-TRAY`, `M${m}-LGT-${L.lights}`, `M${m}-SPR-${L.sprinkler}`, `M${m}-FX-${L.sprinkler}`, `M${m}-CMP-${L.computer}`, `M${m}-POT-${L.pots}`];
      PE.UI.loadHydro(this, ids, () => { if (!v.gone) { this.drawStation(v, si, st, pos); this.lastRefresh = 0; } });
      return v;
    }

    label(v, x, y, text, size, color = '#ffffff', depth = 6) {
      const t = this.add.text(x, y, text, { fontFamily: FONT, fontSize: `${size}px`, fontStyle: 'bold', color, stroke: '#140a24', strokeThickness: 5, resolution: 1 }).setOrigin(0.5).setDepth(depth);
      v.texts.push(t);
      return t;
    }

    // One picture of a station, or a plain block if its art couldn't be fetched.
    part(v, id, x, y, w, h, depth, originX = 0.5, originY = 0.5) {
      const key = 'hy-' + id;
      const o = this.textures.exists(key)
        ? this.add.image(x, y, key).setOrigin(originX, originY).setDisplaySize(w, h)
        : this.add.rectangle(x, y, w, h, 0x777788).setOrigin(originX, originY);
      o.setDepth(depth);
      v.parts.push(o);
      return o;
    }

    // Built from the pieces, every one at its own level. Layout says where each goes.
    drawStation(v, si, st, pos) {
      const D = PE.Data;
      const m = st.model, L = st.levels;
      const M = Layout.model(D, m);
      const F = M.frame;
      const back = pos.y - 480;   // behind every pot and plant of this station

      // The frame, in three slices: the band with only the posts in it stretches, so the rail clears the plants.
      const key = `hy-M${m}-FRAME`;
      if (this.textures.exists(key)) {
        const tex = this.textures.get(key);
        const [b0, b1] = F.slices;
        if (!tex.has('T')) { tex.add('T', 0, 0, 0, F.pxW, b0); tex.add('M', 0, 0, b0, F.pxW, b1 - b0); tex.add('B', 0, 0, b1, F.pxW, F.pxH - b1); }
        let y = pos.y + F.y;
        for (const [name, h] of [['T', F.topH], ['M', F.midH], ['B', F.botH]]) {
          const piece = this.add.image(pos.x + F.x, y, key, name).setOrigin(0, 0).setDisplaySize(F.w, h + 0.5).setDepth(back);
          v.parts.push(piece);
          y += h;
        }
      } else this.part(v, `M${m}-FRAME`, pos.x, pos.y + F.y, F.w, F.bottom - F.y, back, 0.5, 0);

      const badge = Layout.piece(D, m, 'BADGE');
      this.part(v, `M${m}-BADGE`, pos.x + M.badge.x, pos.y + M.badge.y, badge.w, badge.h, pos.y + 200);

      // Overhead: light from the rail, sprinkler just under it, spray from there down to the pots.
      const O = Layout.overhead(D, m, L.lights, L.sprinkler);
      this.part(v, `M${m}-SPR-${L.sprinkler}`, pos.x + O.x, pos.y + O.sprTop, O.S.w, O.S.h, back + 1, 0.5, 0);
      v.light = this.part(v, `M${m}-LGT-${L.lights}`, pos.x + O.x, pos.y + O.lightTop, O.L.w, O.L.h, back + 2, 0.5, 0);
      // The light's cone: on only while something's growing.
      v.cone = this.add.image(pos.x + O.x, pos.y + O.lightBottom - 30, 'room-cone').setOrigin(0.5, 0).setDisplaySize(900, Math.max(200, -O.lightBottom + 10)).setDepth(pos.y + 206).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.4).setVisible(false);
      v.cone.wantVisible = false;
      v.parts.push(v.cone);
      v.lightOn = undefined;
      const fxId = `M${m}-FX-${L.sprinkler}`;
      const [fw, fh] = D.hydroArt[fxId] || [100, 100];
      const sprayH = Math.max(120, -70 - O.sprBottom);
      const sprayW = Math.min(1000, (sprayH * fw) / fh);
      v.spray = this.part(v, fxId, pos.x + O.x, pos.y + O.sprBottom - 12, sprayW, sprayH, pos.y + 205, 0.5, 0);
      v.spray.setAlpha(0.55).setVisible(false);
      v.spray.wantVisible = false;

      // Pots: each on a tray in its hole. The plant goes between the pot's back and a copy of its front, so it
      // really sits inside. Capacity adds pots at fixed spots: unopened holes stay empty.
      const potId = `M${m}-POT-${L.pots}`;
      const potKey = 'hy-' + potId;
      const tray = Layout.piece(D, m, 'TRAY');
      if (this.textures.exists(potKey)) {
        const tex = this.textures.get(potKey);
        const [pw, ph] = D.hydroArt[potId];
        if (!tex.has('front')) tex.add('front', 0, 0, Math.round(ph * WORLD.rimAt), pw, ph - Math.round(ph * WORLD.rimAt));
      }
      st.pots.forEach((_, pi) => {
        // The station may have gained a pot while its art was being fetched.
        const pv = v.pots[pi] || (v.pots[pi] = {});
        const spot = Layout.potSpot(D, m, pi, L.pots);
        const x = pos.x + spot.x, depth = pos.y + spot.y;
        pv.spot = spot;
        pv.tray = this.part(v, `M${m}-TRAY`, x, pos.y + spot.bottom + 8, tray.w, tray.h, depth - 1, 0.5, 1);
        v.parts.pop();
        pv.back = this.part(v, potId, x, pos.y + spot.top, spot.w, spot.h, depth, 0.5, 0);
        v.parts.pop();
        if (this.textures.exists(potKey)) {
          const cut = spot.h * WORLD.rimAt;
          pv.front = this.add.image(x, pos.y + spot.top + cut, potKey, 'front').setOrigin(0.5, 0).setDisplaySize(spot.w, spot.h - cut).setDepth(depth + 2);
        }
      });

      // The computer, on its stand at the side.
      const base = Layout.piece(D, m, 'BASE'), cmp = Layout.piece(D, m, 'CMP', L.computer);
      const cx = pos.x + M.computer.x, cy = pos.y + M.computer.y;
      this.part(v, `M${m}-BASE`, cx, cy, base.w, base.h, pos.y + 210, 0.5, 1);
      this.part(v, `M${m}-CMP-${L.computer}`, cx, cy - base.h * 0.86, cmp.w, cmp.h, pos.y + 211, 0.5, 1);

      // The water timer and meter on the computer, and the station's mood face above it.
      if (!this.testOverride) {
        const top = cy - base.h * 0.86 - cmp.h;
        v.timer = this.add.text(cx, top + cmp.h * 0.42, '', { fontFamily: 'monospace', fontStyle: 'bold', fontSize: '26px', color: '#7fe9ff', stroke: '#05050a', strokeThickness: 6 }).setOrigin(0.5).setDepth(pos.y + 212);
        v.texts.push(v.timer);
        v.meterAt = { x: cx, y: top - 22 };
        v.moodImg = this.add.image(cx, top - 66, 'room-mood-2').setDisplaySize(72, 72).setDepth(pos.y + 212).setVisible(false);
        v.moodImg.wantVisible = false;
        v.parts.push(v.moodImg);
      }

      const model = this.bal.hydroModels.rows[m - 1];
      const signY = pos.y + F.bottom + 32;
      this.label(v, pos.x, signY, `Station ${si + 1} · ${model.name}`, 30, '#ffffff', pos.y + 212);
      const auto = [st.auto.harvest ? 'AUTO-HARVEST' : '', st.auto.replant ? 'AUTO-REPLANT' : ''].filter(Boolean).join(' + ');
      if (auto) this.label(v, pos.x, signY - 36, auto, 22, '#c6ff3d', pos.y + 212);
      v.ready = true;
      v.shown = undefined;
      // Pots drew before the art arrived: their plants get put in again now.
      v.pots.forEach((pv) => { pv.key = undefined; });
      if (this.showAnchorMarks) this.markAnchors(v, st, pos);
    }

    // The debug overlay for tools/hydro_preview.js: a cross on every attachment point.
    markAnchors(v, st, pos) {
      const G = this.add.graphics().setDepth(99000);
      v.parts.push(G);
      const cross = (x, y, c) => { G.lineStyle(5, c, 1).lineBetween(x - 22, y, x + 22, y).lineBetween(x, y - 22, x, y + 22); };
      const M = Layout.model(PE.Data, st.model);
      for (let i = 0; i < 7; i++) cross(pos.x + Layout.anchorX(i), pos.y + Layout.slotY(PE.Data, st.model, i), 0xff2d55);
      cross(pos.x + M.hang.x, pos.y + M.hang.y, 0x52e6ff);
      cross(pos.x + M.badge.x, pos.y + M.badge.y, 0xffd84d);
      cross(pos.x + M.computer.x, pos.y + M.computer.y, 0xffffff);
    }

    updatePot(v, si, st, pi, p, now, pos) {
      const pv = v.pots[pi] || (v.pots[pi] = {});
      if (!v.ready || !pv.spot) return;
      const stage = p ? this.g.grow.stageOf(p, now) : -1;
      const wilted = !!p && stage === 5 && !this.testOverride && this.g.grow.plantHealth(this.fid, si, p, now).wilted;
      const key = p ? `${p.s}|${stage}|${p.q}|${wilted}` : 'empty';
      if (pv.key === key) return;
      const had = pv.key;
      pv.key = key;
      const spot = pv.spot;
      const x = pos.x + spot.x;
      const depth = pos.y + spot.y;
      if (pv.tween) { pv.tween.stop(); pv.tween = null; }
      if (pv.fx) { pv.fx.destroy(); pv.fx = null; }
      if (pv.glowTween) { pv.glowTween.stop(); pv.glowTween = null; }
      if (pv.glow) { pv.glow.destroy(); pv.glow = null; }

      if (!p) {
        if (pv.img) { pv.img.destroy(); pv.img = null; }
        if (pv.logo) { pv.logo.destroy(); pv.logo = null; pv.logoBg.destroy(); pv.logoBg = null; pv.logoFor = null; }
        return;
      }

      // The strain's neon logo on the front of the pot, on its dark backing.
      if (!pv.logo || pv.logoFor !== p.s) {
        if (pv.logo) { pv.logo.destroy(); pv.logoBg.destroy(); }
        const size = spot.w * 0.56;
        const ly = pos.y + spot.rim + (spot.bottom - spot.rim) * 0.5 + 4;
        pv.logoBg = this.add.rectangle(x, ly, size + 6, size * 0.92, 0x05050a, 0.92).setDepth(depth + 3);
        pv.logo = this.add.image(x, ly, '__WHITE').setVisible(false).setDepth(depth + 4);
        pv.logoFor = p.s;
        const logoPic = pv.logo, logoKey = 'logo-' + p.s;
        const show = () => { if (logoPic.scene && this.textures.exists(logoKey)) { logoPic.setTexture(logoKey).setDisplaySize(size, size).setVisible(v.shown !== false); pv.logoShown = true; } };
        if (this.textures.exists(logoKey)) show();
        else {
          const pic = new Image();
          pic.onload = () => { if (!this.textures.exists(logoKey)) this.textures.addImage(logoKey, pic); if (this.sys.settings.status < Phaser.Scenes.SHUTDOWN) show(); };
          pic.src = `assets/logos/${p.s}.webp`;
        }
      }

      const texture = 'sheet-' + p.s;
      const apply = () => {
        if (v.gone || pv.key !== key || this.sys.settings.status >= Phaser.Scenes.SHUTDOWN) return;
        const f = PE.Data.strainFrames.sheets[p.s].frames[stage];
        if (!this.textures.exists(texture)) {
          // Art failed to load: plain placeholder shape.
          if (!pv.img) pv.img = this.add.rectangle(x, pos.y + spot.rim - 40, 50, 80, 0x777777).setDepth(depth + 1);
          return;
        }
        if (!pv.img || pv.img.type !== 'Image') {
          if (pv.img) pv.img.destroy();
          pv.img = this.add.image(x, pos.y, texture, 'stage' + stage).setDepth(depth + 1);
        } else pv.img.setTexture(texture, 'stage' + stage);
        const scale = (stage === 0 ? WORLD.seedScale : WORLD.plantScale) / PE.UI.SHEET_SCALE;
        pv.img.setOrigin(f.baseX / f.w, 1).setScale(scale);
        // The stem starts inside the pot: the pot's front is drawn over the bottom of it.
        pv.img.setPosition(x, pos.y + spot.rim + (stage === 0 ? 2 : 14));
        pv.img.setAlpha(1);
        pv.img.setVisible(v.shown !== false);
        if (wilted) { this.showWilted(pv, p, f); return; }
        pv.img.clearTint();
        pv.img.setRotation(0);
        this.onStageShown(pv, p, stage, x, pos, had, spot, depth);
      };
      PE.UI.loadStrain(this, p.s, apply);
    }

    // A wilted plant shows its own picture, the same size and standing on the same stem. Until that arrives (or if it
    // can't), the mature picture is greyed and drooped by code.
    showWilted(pv, p, f) {
      const img = pv.img;
      img.setTint(0xa8a27a);
      img.setRotation(0.06);
      const art = (PE.Data.plantArt[p.s] || {}).wilt;
      if (!art) return;
      const key = pv.key;
      this.loadPlantArt('wilt', p.s, (tex) => {
        if (pv.key !== key || !pv.img || !pv.img.scene) return;
        const k = (f.w * WORLD.plantScale) / art[0];
        pv.img.setTexture(tex).setOrigin(art[2], 1).setDisplaySize(art[0] * k, art[1] * k).clearTint().setRotation(0);
      });
    }

    // A mature plant gently pulses so it reads as "tap me". Quality effects come from the Fx helper.
    onStageShown(pv, p, stage, x, pos, had, spot, depth) {
      if (stage !== 5 || !pv.img) return;
      // The ripe glow: green and pulsing, no reading needed.
      if (!this.testOverride && this.textures.exists('room-glow')) {
        pv.glow = this.add.image(x, pos.y + spot.rim - pv.img.displayHeight * 0.55, 'room-glow').setDepth(depth).setBlendMode(Phaser.BlendModes.ADD)
          .setDisplaySize(pv.img.displayWidth * 1.5, pv.img.displayHeight * 1.3).setAlpha(0.75);
        if (!this.calm()) pv.glowTween = this.tweens.add({ targets: pv.glow, alpha: { from: 0.45, to: 0.95 }, yoyo: true, repeat: -1, duration: 700, ease: 'Sine.easeInOut' });
      }
      if (PE.QualityFx) {
        pv.fx = PE.QualityFx.create(this, x, pos.y + spot.rim + WORLD.potBaseForFx, p.q);
        if (pv.fx) pv.fx.setDepth(depth + 5);
      }
      if (PE.App.state.settings.reducedMotion || this.testOverride) return;
      const base = pv.img.scaleX;
      pv.tween = this.tweens.add({ targets: pv.img, scaleX: base * 1.03, scaleY: base * 1.03, yoyo: true, repeat: -1, duration: 650, ease: 'Sine.easeInOut' });
    }
  }

  PE.Screens.garage = GrowRoom;
})(globalThis.PE = globalThis.PE || {});
