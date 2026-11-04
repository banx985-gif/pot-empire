// The grow room: one continuous roofless room, pan and pinch-zoom, fixed setups.
// All pictures except the plants are PLACEHOLDERS drawn from plain shapes with a small label.
// They are listed in the asset registry as "planned". This file only draws and passes taps along.
(function (PE) {
  const { WORLD } = PE.Layout;
  const FONT = 'system-ui, sans-serif';
  const LOOK = Math.sin((WORLD.lookDown * Math.PI) / 180);
  const LIGHT_NAMES = ['Tiny lamp', 'Long strip', 'Dual strips', 'Wide panel', 'Segmented array', 'Full-width showpiece'];
  const COMPUTER_NAMES = ['Switch box', 'Small screen', 'Colour monitor', 'Multi-screen', 'Touch console', 'Command centre'];

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
      this.stationViews = new Map();
      this.floaters = [];
      this.roomSig = null;
      this.lastRefresh = 0;
      this.ready = false;
      this.cameras.main.setBackgroundColor('#140a24');

      this.drawRoom();
      this.bars = this.add.graphics().setDepth(100000);
      this.setUpCamera();
      this.setUpInput();

      this.unsub = this.g.on((type, e) => this.onGameEvent(type, e));
      this.events.once('shutdown', () => { this.unsub(); });

      this.refresh(true);
      this.ready = true;
    }

    // ---- The room itself (placeholder) ----------------------------------------------------------
    drawRoom() {
      const { w, h } = this.room;
      const wall = WORLD.wallHeight;
      const f = this.g.facilities.get(this.fid);
      const reno = f ? f.renovation : 0;
      const G = this.add.graphics().setDepth(-1000);
      this.roomG = G;
      const wallColor = [0x2c1a4d, 0x33205a, 0x3a2666, 0x452d78][reno];
      const floorColor = [0x3a3346, 0x41394f, 0x4a4159, 0x544a66][reno];

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
      this.add.text(w / 2, wall * 0.42, row.name.toUpperCase(), {
        fontFamily: FONT, fontStyle: '900', fontSize: '74px', color: '#ff4fa3', stroke: '#c6ff3d', strokeThickness: 4,
      }).setOrigin(0.5).setAlpha(0.55).setDepth(-999);
      this.add.text(w / 2, wall * 0.78, 'placeholder room: floor and wall art not drawn yet', {
        fontFamily: FONT, fontSize: '22px', color: '#b9a8d6',
      }).setOrigin(0.5).setAlpha(0.7).setDepth(-999);

      // Reserved spots for setups not bought yet.
      for (let i = this.stationCount(); i < this.room.stations.length; i++) {
        const b = PE.Layout.setupBounds(this.room.stations[i], this.room.box);
        G.lineStyle(3, 0xffffff, 0.14).strokeRoundedRect(b.left + 30, b.top + 80, b.right - b.left - 60, b.bottom - b.top - 90, 24);
        this.add.text((b.left + b.right) / 2, (b.top + b.bottom) / 2 + 20, 'Future station', {
          fontFamily: FONT, fontSize: '30px', color: '#ffffff',
        }).setOrigin(0.5).setAlpha(0.25).setDepth(-999);
      }
    }

    // ---- Camera: pan, pinch, limits -------------------------------------------------------------
    zoomLimits() {
      const dpr = PE.App.dpr;
      const W = this.scale.width, H = this.scale.height;
      const { w, h, box } = this.room;
      const fitRoom = Math.min(W / w, H / h);
      const fitSetup = W / (box.halfW * 2 + 24);
      return { min: Math.min(fitRoom, fitSetup) * 0.96, fitSetup, max: 1.7 * dpr };
    }

    // Default: fits the widest setup you actually own, so early plants aren't tiny.
    defaultZoom() {
      const lim = this.zoomLimits();
      let cap = 2;
      this.g.grow.eachStation((f, si, st) => { if (f === this.fid) cap = Math.max(cap, st.pots.length); });
      if (this.testOverride) cap = 7;
      const width = cap >= 7 ? this.room.box.halfW * 2 + 24 : (cap + 1) * WORLD.potSpacing + 80;
      return Phaser.Math.Clamp(this.scale.width / width, lim.fitSetup, lim.max);
    }

    setUpCamera() {
      const cam = this.cameras.main;
      const saved = (PE.App.cameraMemory || {})[this.fid];
      if (saved) {
        cam.setZoom(saved.zoom);
        cam.centerOn(saved.x, saved.y);
      } else {
        cam.setZoom(this.defaultZoom());
        const s0 = this.room.stations[0], s1 = this.room.stations[this.room.cols] || s0;
        cam.centerOn(s0.x - (this.testOverride ? 0 : WORLD.potSpacing / 2), (s0.y + s1.y) / 2 - 70);
      }
      this.clampCamera();
    }

    clampCamera() {
      const cam = this.cameras.main;
      const { w, h } = this.room;
      const vw = cam.width / cam.zoom, vh = cam.height / cam.zoom;
      const mid = cam.midPoint;
      // Room stays reachable behind the top bar and bottom tabs: allow some extra travel.
      const extraY = 130 * PE.App.dpr / cam.zoom;
      const clamp = (v, lo, hi) => (lo > hi ? (lo + hi) / 2 : Math.min(hi, Math.max(lo, v)));
      cam.centerOn(clamp(mid.x, vw / 2, w - vw / 2), clamp(mid.y, vh / 2 - extraY, h - vh / 2 + extraY));
      (PE.App.cameraMemory = PE.App.cameraMemory || {})[this.fid] = { zoom: cam.zoom, x: cam.midPoint.x, y: cam.midPoint.y };
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
          cam.scrollX -= (p.x - drag.lastX) / cam.zoom;
          cam.scrollY -= (p.y - drag.lastY) / cam.zoom;
          cam.preRender();
          this.clampCamera();
        }
        drag.lastX = p.x; drag.lastY = p.y;
      });
      input.on('pointerup', (p) => {
        if (pinch) { if (!input.pointer1.isDown && !input.pointer2.isDown) pinch = null; drag = null; return; }
        if (drag && p.id === drag.id && !drag.moved) this.tapAt(p.x, p.y);
        drag = null;
      });
      input.on('wheel', (p, over, dx, dy) => this.setZoomAround(this.cameras.main.zoom * (dy > 0 ? 0.9 : 1.1), p.x, p.y));
    }

    // ---- Tapping ----------------------------------------------------------------------------------
    hitAt(wx, wy) {
      const owned = this.stationCount();
      const box = this.room.box;
      for (let si = owned - 1; si >= 0; si--) {
        const pos = this.room.stations[si];
        const st = this.stationData(si);
        if (Math.abs(wx - pos.x) > box.halfW) continue;
        for (let pi = 0; pi < st.pots.length; pi++) {
          const ax = pos.x + PE.Layout.anchorX(pi);
          if (Math.abs(wx - ax) <= WORLD.potSpacing / 2 && wy <= pos.y + 18 && wy >= pos.y - 200) return { si, pi };
        }
        if (wy > pos.y - WORLD.gantryTop && wy < pos.y + box.down) return { si, pi: null };
      }
      return null;
    }

    tapAt(sx, sy) {
      const pt = this.cameras.main.getWorldPoint(sx, sy);
      const hit = this.hitAt(pt.x, pt.y);
      if (!hit || this.testOverride) return;
      const g = this.g;
      const { si, pi } = hit;
      if (pi === null) { PE.App.openPanel('station', { fid: this.fid, si }); return; }
      const p = this.stationData(si).pots[pi];
      if (!p) { PE.App.openPanel('strainPicker', { fid: this.fid, si, pi }); return; }
      if (g.now() >= p.readyMs) g.grow.harvest(this.fid, si, pi);
      else PE.App.openPanel('plant', { fid: this.fid, si, pi });
    }

    // Where a pot is on screen, in page points. Used by the automatic browser test to really tap it.
    potPagePoint(si, pi) {
      const pos = this.room.stations[si];
      return this.worldToPage(pos.x + PE.Layout.anchorX(pi), pos.y - 10);
    }
    worldToPage(wx, wy) {
      const cam = this.cameras.main;
      const r = this.game.canvas.getBoundingClientRect();
      const sx = (wx - cam.midPoint.x) * cam.zoom + cam.width / 2;
      const sy = (wy - cam.midPoint.y) * cam.zoom + cam.height / 2;
      return { x: r.left + (sx * r.width) / this.scale.width, y: r.top + (sy * r.height) / this.scale.height };
    }

    onGameEvent(type, e) {
      if (type === 'harvest' && e.facility === this.fid) this.floatHarvest(e);
    }

    floatHarvest(e) {
      const pos = this.room.stations[e.station];
      const x = pos.x + PE.Layout.anchorX(e.pot), y = pos.y - 90;
      const grade = this.bal.quality.grades[e.grade];
      const label = `+$${PE.Money.format(e.cash)}${e.grade > 0 ? ' ' + grade.name : ''}${e.doubled ? ' x2!' : ''}`;
      const t = this.add.text(x, y, label, {
        fontFamily: FONT, fontStyle: 'bold', fontSize: '30px', color: e.grade >= 3 ? '#ffd84d' : '#c6ff3d', stroke: '#1d0f33', strokeThickness: 6,
      }).setOrigin(0.5).setDepth(100001);
      const still = PE.App.state.settings.reducedMotion;
      this.tweens.add({ targets: t, y: still ? y : y - 70, alpha: 0, duration: still ? 900 : 1100, ease: 'Sine.easeOut', onComplete: () => t.destroy() });
    }

    // ---- Stations ------------------------------------------------------------------------------------
    stationCount() {
      return this.testOverride ? this.testOverride.stations.length : this.g.facilities.ownedStationCount(this.fid);
    }

    stationData(si) {
      return this.testOverride ? this.testOverride.stations[si] : this.g.grow.stationOf(this.fid, si);
    }

    update(time) {
      if (!this.ready) return;
      if (time - (this.lastRefresh || 0) < 200) return;
      this.lastRefresh = time;
      this.refresh();
    }

    refresh() {
      const count = this.stationCount();
      const now = this.testOverride ? this.testOverride.now : this.g.now();
      const f = this.g.facilities.get(this.fid);
      const roomSig = `${count}|${f ? f.renovation : 0}`;
      if (this.roomSig && this.roomSig !== roomSig) { this.scene.restart(); return; }
      this.roomSig = roomSig;

      const B = this.bars;
      B.clear();
      for (let si = 0; si < count; si++) {
        const st = this.stationData(si);
        const pos = this.room.stations[si];
        const view = this.viewFor(si, st, pos);
        const potH = WORLD.potHeight[st.levels.pots - 1];
        st.pots.forEach((p, pi) => {
          this.updatePot(view, si, st, pi, p, now, pos);
          const x = pos.x + PE.Layout.anchorX(pi);
          if (!p) {
            // A clear "+" on an empty pot.
            B.lineStyle(6, 0xc6ff3d, 0.95);
            B.lineBetween(x - 14, pos.y - potH - 18, x + 14, pos.y - potH - 18);
            B.lineBetween(x, pos.y - potH - 32, x, pos.y - potH - 4);
          } else if (now < p.readyMs) {
            const t = this.g.grow.potProgress(p, now);
            B.fillStyle(0x000000, 0.6).fillRect(x - 40, pos.y + 8, 80, 9);
            B.fillStyle(0xc6ff3d, 1).fillRect(x - 39, pos.y + 9, 78 * t, 7);
          }
        });
        if (!this.testOverride && this.g.grow.serviceDue(this.fid, si)) {
          B.fillStyle(0x52e6ff, 1).fillCircle(pos.x - this.room.box.halfW + 46, pos.y + 44, 13);
        }
      }
    }

    viewFor(si, st, pos) {
      const sig = `${st.model}|${st.levels.lights}|${st.levels.sprinkler}|${st.levels.pots}|${st.levels.computer}|${st.levels.capacity}|${st.pots.length}|${st.auto.harvest}|${st.auto.replant}`;
      let v = this.stationViews.get(si);
      if (v && v.sig === sig) return v;
      if (v) { v.back.destroy(); v.front.destroy(); v.texts.forEach((t) => t.destroy()); v.pots.forEach((pv) => { if (pv.img) pv.img.destroy(); if (pv.logo) pv.logo.destroy(); if (pv.logoBg) pv.logoBg.destroy(); if (pv.fx) pv.fx.destroy(); if (pv.tween) pv.tween.stop(); }); }
      v = { sig, back: this.add.graphics(), front: this.add.graphics(), texts: [], pots: [] };
      v.back.setDepth(pos.y - 5);
      v.front.setDepth(pos.y + 5);
      this.stationViews.set(si, v);
      this.drawStation(v, si, st, pos);
      return v;
    }

    label(v, x, y, text, size, color = '#ffffff', depth = 6) {
      const t = this.add.text(x, y, text, { fontFamily: FONT, fontSize: `${size}px`, fontStyle: 'bold', color, resolution: 1 }).setOrigin(0.5).setDepth(this.room.stations.length ? y + depth : depth);
      v.texts.push(t);
      return t;
    }

    drawStation(v, si, st, pos) {
      const model = this.bal.hydroModels.rows[st.model - 1];
      const color = model.color;
      const { back, front } = v;
      const box = this.room.box;
      const x = pos.x, y = pos.y;
      const half = box.halfW - 6;

      // Frame: bench, two uprights, a crossbar. Five models = five shapes (placeholder versions).
      const frameTop = y - WORLD.gantryTop;
      back.fillStyle(darken(color, 0.35), 1);
      const bw = [14, 18, 12, 24, 16][st.model - 1];
      back.fillRect(x - half, frameTop, bw, y - frameTop + 14);
      back.fillRect(x + half - bw, frameTop, bw, y - frameTop + 14);
      if (st.model === 2) back.fillEllipse(x, frameTop + 6, half * 2, 30);
      else if (st.model === 3) { back.fillTriangle(x - half, frameTop + 12, x, frameTop - 12, x + half, frameTop + 12); }
      else back.fillRect(x - half, frameTop, half * 2, st.model === 4 ? 22 : 12);
      if (st.model === 5) {
        const rainbow = [0xff4fa3, 0xffd84d, 0xc6ff3d, 0x52e6ff, 0x9a5be0];
        rainbow.forEach((c, i) => { back.fillStyle(c, 1).fillRect(x - half + (i * half * 2) / 5, frameTop, (half * 2) / 5, 12); });
      }

      // Bench the pots stand on.
      back.fillStyle(darken(color, 0.15), 1).fillRoundedRect(x - half, y - 8, half * 2, 34, 8);
      back.fillStyle(lighten(color, 0.3), 1).fillRect(x - half, y - 8, half * 2, 5);

      // Fixed pot anchors: faint marks for the slots not opened yet.
      for (let a = st.pots.length; a < 7; a++) {
        const ax = x + PE.Layout.anchorX(a);
        back.lineStyle(3, 0xffffff, 0.2).strokeEllipse(ax, y - 2, 60, 18);
      }

      // Hanging light: width grows with level. Sprinkler hangs just below it.
      const lvl = st.levels.lights;
      const lightHalf = [40, 130, 180, 260, 330, half - 30][lvl - 1];
      const ly = y - WORLD.lightY;
      back.lineStyle(3, 0xdddddd, 0.8);
      back.lineBetween(x - lightHalf * 0.7, frameTop + 8, x - lightHalf * 0.7, ly);
      back.lineBetween(x + lightHalf * 0.7, frameTop + 8, x + lightHalf * 0.7, ly);
      back.fillStyle(0x2a2a33, 1).fillRoundedRect(x - lightHalf, ly - 8, lightHalf * 2, 16, 6);
      back.fillStyle(0xfff6b0, 1);
      if (lvl === 3 || lvl >= 5) {
        const parts = lvl === 3 ? 2 : lvl === 5 ? 5 : 9;
        const gap = 6;
        const w = (lightHalf * 2 - gap * (parts + 1)) / parts;
        for (let i = 0; i < parts; i++) back.fillRect(x - lightHalf + gap + i * (w + gap), ly + 2, w, 6);
      } else back.fillRect(x - lightHalf + 5, ly + 2, lightHalf * 2 - 10, 6);

      const sLvl = st.levels.sprinkler;
      const sy = y - WORLD.sprinklerY;
      const nozzles = [1, 2, 3, 5, 7, 11][sLvl - 1];
      const sHalf = Math.min(lightHalf - 4, [24, 70, 120, 190, 270, half - 40][sLvl - 1]);
      back.lineStyle(5, 0x9ad7ff, 0.9).lineBetween(x - sHalf, sy, x + sHalf, sy);
      back.lineStyle(2, 0xdddddd, 0.6).lineBetween(x, ly + 8, x, sy);
      for (let n = 0; n < nozzles; n++) {
        const nx = nozzles === 1 ? x : x - sHalf + (n * sHalf * 2) / (nozzles - 1);
        back.fillStyle(0x9ad7ff, 1).fillCircle(nx, sy + 4, 4);
        back.fillStyle(0x9ad7ff, 0.4).fillTriangle(nx, sy + 6, nx - 7 - sLvl * 2, sy + 22, nx + 7 + sLvl * 2, sy + 22);
      }

      // Computer on the front of the bench, in the middle.
      const cLvl = st.levels.computer;
      const cw = 32 + cLvl * 8;
      front.fillStyle(0x1b1b24, 1).fillRoundedRect(x - cw / 2, y + 24, cw, 30, 5);
      front.fillStyle(cLvl === 1 ? 0xff4f4f : 0x52e6ff, 1);
      if (cLvl === 1) front.fillRect(x - 6, y + 32, 12, 12);
      else {
        const screens = cLvl >= 6 ? 3 : cLvl >= 4 ? 2 : 1;
        const sw = (cw - 6 - (screens - 1) * 3) / screens;
        for (let i = 0; i < screens; i++) front.fillRect(x - cw / 2 + 3 + i * (sw + 3), y + 27, sw, 18);
      }

      // Pots: back of the rim drawn behind the plant, the front face drawn in front of it.
      const potW = WORLD.potWidth[st.levels.pots - 1], potH = WORLD.potHeight[st.levels.pots - 1];
      for (let pi = 0; pi < st.pots.length; pi++) {
        const ax = x + PE.Layout.anchorX(pi);
        back.fillStyle(darken(color, 0.55), 1).fillEllipse(ax, y - potH, potW, 18);
        front.fillStyle(lighten(color, 0.08), 1);
        front.fillPoints([
          { x: ax - potW / 2, y: y - potH }, { x: ax + potW / 2, y: y - potH },
          { x: ax + potW * 0.38, y: y + 2 }, { x: ax - potW * 0.38, y: y + 2 },
        ], true);
        front.fillStyle(lighten(color, 0.35), 1).fillRect(ax - potW / 2, y - potH, potW, 5);
        if (st.levels.pots >= 3) front.fillStyle(0xffffff, 0.25).fillRect(ax - potW / 2 + 6, y - potH + 7, 7, potH - 14);
        v.pots[pi] = {};
      }

      // Name sign and placeholder labels.
      this.label(v, x - 60, y + 40, `Station ${si + 1} · ${model.name}`, 20, '#ffffff').setOrigin(1, 0.5);
      const auto = [st.auto.harvest ? 'AUTO-HARVEST' : '', st.auto.replant ? 'AUTO-REPLANT' : ''].filter(Boolean).join(' + ');
      if (auto) this.label(v, x + 60, y + 40, auto, 16, '#c6ff3d').setOrigin(0, 0.5);
      this.label(v, x + lightHalf + 8, y - WORLD.lightY + 1, `[placeholder] ${LIGHT_NAMES[lvl - 1]} L${lvl}`, 14, '#d8cdea').setOrigin(lvl >= 6 ? 1 : 0, 0.5).setX(lvl >= 6 ? x + lightHalf : x + lightHalf + 8).setY(lvl >= 6 ? y - WORLD.lightY - 15 : y - WORLD.lightY + 1);
      this.label(v, x, y + 66, `[placeholder] ${COMPUTER_NAMES[cLvl - 1]} L${cLvl}`, 13, '#d8cdea');
    }

    updatePot(v, si, st, pi, p, now, pos) {
      const pv = v.pots[pi] || (v.pots[pi] = {});
      const stage = p ? this.g.grow.stageOf(p, now) : -1;
      const key = p ? `${p.s}|${stage}|${p.q}` : 'empty';
      if (pv.key === key) return;
      const had = pv.key;
      pv.key = key;
      const x = pos.x + PE.Layout.anchorX(pi);
      const potH = WORLD.potHeight[st.levels.pots - 1];
      if (pv.tween) { pv.tween.stop(); pv.tween = null; }
      if (pv.fx) { pv.fx.destroy(); pv.fx = null; }

      if (!p) {
        if (pv.img) { pv.img.destroy(); pv.img = null; }
        if (pv.logo) { pv.logo.destroy(); pv.logo = null; pv.logoBg.destroy(); pv.logoBg = null; }
        return;
      }

      // Strain logo overlay on the pot front. PLACEHOLDER: dark badge + initials until logo art exists.
      if (!pv.logo || pv.logoFor !== p.s) {
        if (pv.logo) { pv.logo.destroy(); pv.logoBg.destroy(); }
        const name = this.g.grow.strainStats(p.s).name;
        const initials = name.split(' ').map((w) => w[0]).join('').slice(0, 3);
        pv.logoBg = this.add.rectangle(x, pos.y - potH / 2 + 2, 44, 26, 0x05050a, 0.9).setDepth(pos.y + 6);
        pv.logo = this.add.text(x, pos.y - potH / 2 + 2, initials, { fontFamily: FONT, fontStyle: 'bold', fontSize: '17px', color: '#52e6ff' }).setOrigin(0.5).setDepth(pos.y + 7);
        pv.logoFor = p.s;
      }

      const texture = 'sheet-' + p.s;
      const apply = () => {
        if (pv.key !== key || this.sys.settings.status >= Phaser.Scenes.SHUTDOWN) return;
        const f = PE.Data.strainFrames.sheets[p.s].frames[stage];
        if (!this.textures.exists(texture)) {
          // Art failed to load: plain placeholder shape.
          if (!pv.img) pv.img = this.add.rectangle(x, pos.y - potH * 0.5 - 40, 50, 80, 0x777777).setDepth(pos.y);
          return;
        }
        if (!pv.img || pv.img.type !== 'Image') {
          if (pv.img) pv.img.destroy();
          pv.img = this.add.image(x, pos.y, texture, 'stage' + stage).setDepth(pos.y);
        } else pv.img.setTexture(texture, 'stage' + stage);
        const scale = (stage === 0 ? WORLD.seedScale : WORLD.plantScale) / PE.UI.SHEET_SCALE;
        pv.img.setOrigin(f.baseX / f.w, 1).setScale(scale);
        pv.img.setPosition(x, stage === 0 ? pos.y - potH + 4 : pos.y - potH * 0.5);
        pv.img.setAlpha(1);
        this.onStageShown(pv, p, stage, x, pos, had);
      };
      PE.UI.loadStrain(this, p.s, apply);
    }

    // A mature plant gently pulses so it reads as "tap me". Quality effects come from the Fx helper.
    onStageShown(pv, p, stage, x, pos) {
      if (stage !== 5 || !pv.img) return;
      if (PE.QualityFx) pv.fx = PE.QualityFx.create(this, x, pos.y, p.q);
      if (PE.App.state.settings.reducedMotion || this.testOverride) return;
      const base = pv.img.scaleX;
      pv.tween = this.tweens.add({ targets: pv.img, scaleX: base * 1.03, scaleY: base * 1.03, yoyo: true, repeat: -1, duration: 650, ease: 'Sine.easeInOut' });
    }
  }

  PE.Screens.garage = GrowRoom;
})(globalThis.PE = globalThis.PE || {});
