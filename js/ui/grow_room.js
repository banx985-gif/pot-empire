// The grow room: one continuous roofless room, pan and pinch-zoom, fixed setups.
// The hydro stations are real art, built from pieces (data/hydro_anchors.js says where they attach). The room's
// floor and walls are still PLACEHOLDERS drawn from plain shapes. This file only draws and passes taps along.
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
      this.events.once('shutdown', () => { this.unsub(); this.stationViews.forEach((v) => { v.gone = true; }); });

      PE.UI.loadIcons(this, ['ACT-01', 'ACT-04'], () => {});
      this.lastCull = '';
      this.refresh(true);
      this.ready = true;
      if (!PE.App.state.settings.reducedMotion && !this.testOverride) this.cameras.main.fadeIn(170, 20, 10, 36);
    }

    // ---- The room itself (placeholder) ----------------------------------------------------------
    drawRoom() {
      const { w, h } = this.room;
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
      const saved = (PE.App.cameraMemory || {})[this.fid];
      if (saved) {
        cam.setZoom(saved.zoom);
        cam.centerOn(saved.x, saved.y);
      } else {
        cam.setZoom(this.defaultZoom());
        const s0 = this.room.stations[0];
        cam.centerOn(s0.x - (this.testOverride ? 0 : WORLD.potSpacing / 2), s0.y - WORLD.railHeight * 0.3);
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
      if (type === 'harvest' && e.facility === this.fid) this.floatHarvest(e);
    }

    floatHarvest(e) {
      const pos = this.room.stations[e.station];
      const x = pos.x + Layout.anchorX(e.pot), y = pos.y + Layout.slotY(PE.Data, this.stationData(e.station).model, e.pot) - 150;
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
        if (due && !view.water && this.textures.exists('ui-ACT-04')) view.water = this.add.image(pos.x - 220, pos.y + 150, 'ui-ACT-04').setDisplaySize(64, 64).setDepth(pos.y + 330);
        if (view.water) view.water.setVisible(due);
        this.updateSpray(view, growing && !due);
      }
      this.cullStations();
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
        view.pots.forEach((pv) => [pv.tray, pv.back, pv.front, pv.img, pv.logo, pv.logoBg, pv.fx].forEach((o) => { if (o) o.setVisible(on && !(o === pv.logo && !pv.logoShown)); }));
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
          [pv.seedIcon, pv.img, pv.logo, pv.logoBg, pv.fx, pv.tray, pv.back, pv.front].forEach((o) => { if (o) o.destroy(); });
          if (pv.tween) pv.tween.stop();
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
      this.part(v, `M${m}-LGT-${L.lights}`, pos.x + O.x, pos.y + O.lightTop, O.L.w, O.L.h, back + 2, 0.5, 0);
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
      const key = p ? `${p.s}|${stage}|${p.q}` : 'empty';
      if (pv.key === key) return;
      const had = pv.key;
      pv.key = key;
      const spot = pv.spot;
      const x = pos.x + spot.x;
      const depth = pos.y + spot.y;
      if (pv.tween) { pv.tween.stop(); pv.tween = null; }
      if (pv.fx) { pv.fx.destroy(); pv.fx = null; }

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
        this.onStageShown(pv, p, stage, x, pos, had, spot, depth);
      };
      PE.UI.loadStrain(this, p.s, apply);
    }

    // A mature plant gently pulses so it reads as "tap me". Quality effects come from the Fx helper.
    onStageShown(pv, p, stage, x, pos, had, spot, depth) {
      if (stage !== 5 || !pv.img) return;
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
