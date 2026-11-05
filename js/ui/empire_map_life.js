// What makes the Empire map feel alive (job 5, Stage 2): vans, walkers, chimney smoke, glowing grow
// buildings, swaying plants, butterflies, the helpers standing about, the free gift flyer and the rival
// buildings. It adds to the map scene in js/ui/empire_map.js.
//
// Kept light on purpose: about 20 small pictures moved with simple sums, no physics and no timers per
// object. With reduced motion on, nothing moves but everything can still be tapped.
// ALL STAND-INS until map art arrives. Real pictures take over by file name (VEH-01, WLK-01, FX-01 ...).
(function (PE) {
  const FONT = 'system-ui, sans-serif';
  const proto = PE.EmpireMapScene.prototype;
  const RIVAL_COLOURS = [0xb5533c, 0xff8a3d, 0xb79ce0, 0xd4af37, 0x8a4fff, 0x62d04b, 0xff7ad9, 0x38b6a8, 0xe0566e, 0x8b8fa3, 0xff9ecb, 0x2a1f3d];

  function tex(scene, key, w, h, draw) {
    if (!scene.textures.exists(key)) {
      const G = scene.make.graphics({ x: 0, y: 0, add: false });
      draw(G);
      G.generateTexture(key, w, h);
      G.destroy();
    }
    return key;
  }
  // A moving piece: it starts as a stand-in and swaps to real art if that's been imported.
  function piece(scene, x, y, key, artId, size) {
    const s = scene.add.image(x, y, key);
    if (artId) PE.MapArt.load(scene, artId, (k) => { s.setTexture(k).setDisplaySize(size, size); });
    return s;
  }
  function lengths(pts) {
    const seg = [];
    let total = 0;
    for (let i = 1; i < pts.length; i++) { const d = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); seg.push(d); total += d; }
    return { seg, total };
  }
  function along(pts, seg, d) {
    let i = 0, left = d;
    while (i < seg.length - 1 && left > seg[i]) { left -= seg[i]; i++; }
    const t = seg[i] ? left / seg[i] : 0;
    const [ax, ay] = pts[i], [bx, by] = pts[i + 1];
    return { x: ax + (bx - ax) * t, y: ay + (by - ay) * t, dx: bx - ax, dy: by - ay };
  }

  proto.setUpLife = function setUpLife() {
    this.life = { movers: [], walkers: [], puffs: [], glows: [], sways: [], flyers: [], helpers: new Map(), rivals: new Map(), gift: null, giftCheck: 0, loaded: [], t: 0 };
    this.calmNow = this.calm();
    this.makeLifeTextures();
    this.buildRivals();
    this.buildVans();
    this.buildWalkers();
    this.buildBuildingLife();
    this.buildFlyers();
    this.buildHelpers();
  };

  proto.makeLifeTextures = function makeLifeTextures() {
    tex(this, 'map-van', 76, 52, (G) => {
      G.fillStyle(0x000000, 0.2).fillEllipse(38, 46, 70, 12);
      G.fillStyle(0xff4fa3, 1).fillRoundedRect(4, 8, 68, 32, 8);
      G.fillStyle(0x52e6ff, 1).fillRect(52, 13, 16, 13);
      G.fillStyle(0xffd84d, 1).fillCircle(26, 22, 7);
      G.fillStyle(0x140a24, 1).fillCircle(20, 41, 8).fillCircle(56, 41, 8);
    });
    ['0xc6ff3d', '0xff8a3d', '0x52e6ff', '0xff4fa3'].forEach((c, i) => tex(this, `map-walker-${i}`, 30, 58, (G) => {
      G.fillStyle(0x000000, 0.2).fillEllipse(15, 54, 24, 7);
      G.fillStyle(0xf2c9a0, 1).fillCircle(15, 11, 9);
      G.fillStyle(Number(c), 1).fillRoundedRect(6, 20, 18, 22, 5);
      G.fillStyle(0x2c1a4d, 1).fillRect(8, 40, 6, 13).fillRect(16, 40, 6, 13);
    }));
    tex(this, 'map-boat', 110, 60, (G) => {
      G.fillStyle(0xffffff, 0.5).fillEllipse(55, 50, 106, 14);
      G.fillStyle(0xff8a3d, 1).fillRoundedRect(10, 26, 90, 22, 9);
      G.fillStyle(0xffffff, 1).fillRoundedRect(34, 6, 44, 24, 5);
      G.fillStyle(0x52e6ff, 1).fillRect(40, 11, 32, 10);
    });
    tex(this, 'map-train', 170, 56, (G) => {
      G.fillStyle(0x000000, 0.2).fillEllipse(85, 50, 164, 11);
      G.fillStyle(0xc0392b, 1).fillRoundedRect(4, 8, 70, 34, 7);
      G.fillStyle(0x52e6ff, 1).fillRect(52, 14, 16, 13);
      G.fillStyle(0x8b8fa3, 1).fillRoundedRect(84, 12, 80, 30, 4);
      G.fillStyle(0x140a24, 1).fillCircle(20, 44, 7).fillCircle(58, 44, 7).fillCircle(104, 44, 7).fillCircle(144, 44, 7);
    });
    tex(this, 'map-puff', 52, 52, (G) => { G.fillStyle(0xe8def8, 1).fillCircle(26, 28, 18).fillCircle(16, 24, 12).fillCircle(36, 22, 12); });
    tex(this, 'map-glow', 128, 128, (G) => { for (let r = 62; r > 0; r -= 6) G.fillStyle(0xc6ff3d, 0.07).fillCircle(64, 64, r); });
    tex(this, 'map-plant', 40, 70, (G) => {
      G.lineStyle(5, 0x2f7a1c, 1).lineBetween(20, 70, 20, 26);
      G.fillStyle(0x62c23a, 1).fillEllipse(20, 18, 20, 36).fillEllipse(8, 32, 22, 12).fillEllipse(32, 32, 22, 12).fillEllipse(8, 48, 18, 10).fillEllipse(32, 48, 18, 10);
    });
    tex(this, 'map-butterfly', 28, 22, (G) => { G.fillStyle(0xff4fa3, 1).fillEllipse(8, 9, 14, 16).fillEllipse(20, 9, 14, 16); G.fillStyle(0xffd84d, 1).fillEllipse(9, 16, 9, 9).fillEllipse(19, 16, 9, 9); G.fillStyle(0x1d0f33, 1).fillRect(13, 4, 2, 15); });
    tex(this, 'map-bird', 36, 18, (G) => { G.lineStyle(4, 0x1d0f33, 1).lineBetween(2, 4, 18, 12).lineBetween(18, 12, 34, 4); });
    tex(this, 'map-balloon', 110, 170, (G) => {
      G.fillStyle(0xff4fa3, 1).fillCircle(55, 54, 50);
      G.fillStyle(0xffd84d, 1).fillEllipse(55, 54, 48, 100);
      G.fillStyle(0x52e6ff, 1).fillEllipse(55, 54, 16, 100);
      G.fillStyle(0xc6ff3d, 1).fillTriangle(55, 30, 40, 66, 70, 66);
      G.lineStyle(3, 0x1d0f33, 1).lineBetween(28, 96, 42, 130).lineBetween(82, 96, 68, 130);
      G.fillStyle(0xb8834a, 1).fillRoundedRect(36, 128, 38, 30, 5);
      G.fillStyle(0xffd84d, 1).fillRect(52, 128, 6, 30);
    });
  };

  // ---- Rival buildings at the edges: beating a rival takes the spot over ---------------------------------
  proto.rivalKey = function rivalKey(rid, beaten) {
    const i = Number(rid.split('-')[1]) - 1;
    const key = `map-rival-${rid}-${beaten ? 1 : 0}`;
    return tex(this, key, 260, 300, (G) => {
      const wall = beaten ? 0x5fbf3a : RIVAL_COLOURS[i];
      G.fillStyle(0x000000, 0.18).fillEllipse(120, 284, 220, 34);
      G.fillStyle(0x000000, 0.25).fillRect(180, 92, 34, 190);
      G.fillStyle(wall, 1).fillRect(36, 96, 150, 188);
      G.fillStyle(0x1d0f33, 1).fillPoints([{ x: 36, y: 96 }, { x: 186, y: 96 }, { x: 214, y: 74 }, { x: 64, y: 74 }], true);
      G.lineStyle(4, 0x140a24, 1).strokeRect(36, 96, 150, 188);
      for (let x = 0; x < 3; x++) for (let y = 0; y < 3; y++) G.fillStyle(beaten ? 0xc6ff3d : 0x1d0f33, 0.85).fillRect(52 + x * 44, 112 + y * 44, 30, 30);
      G.fillStyle(0x2c1a4d, 1).fillRect(92, 240, 38, 44);
      if (beaten) {
        G.lineStyle(6, 0x1d0f33, 1).lineBetween(110, 74, 110, 8);
        G.fillStyle(0xc6ff3d, 1).fillTriangle(112, 10, 176, 26, 112, 44);
      } else {
        G.fillStyle(0xffffff, 1).fillTriangle(110, 40, 92, 70, 128, 70);
      }
    });
  };
  proto.buildRivals = function buildRivals() {
    for (const spot of this.layout.rivalSpots) {
      const rival = PE.Data.rivals.find((r) => r.id === spot.rival);
      const image = this.add.image(spot.x, spot.y + 20, this.rivalKey(spot.rival, false)).setOrigin(0.46, 1).setDepth(spot.y);
      const num = Number(spot.rival.split('-')[1]);
      const artId = 'RBL-' + String(num).padStart(2, '0');
      PE.MapArt.load(this, artId, (k) => { image.setTexture(k).setDisplaySize(300, 300); });
      const label = this.add.text(spot.x, spot.y + 28, rival.name, {
        fontFamily: FONT, fontStyle: 'bold', fontSize: '22px', color: '#ffd9d9', stroke: '#1d0f33', strokeThickness: 5,
      }).setOrigin(0.5, 0).setDepth(spot.y + 1);
      this.life.rivals.set(spot.rival, { spot, image, label, beaten: null, realArt: !!PE.MapArt.url(artId), rival });
    }
  };

  // ---- Vans, boats and trains: they follow whatever paths the district's layout file gives ------------------
  proto.deliveryRoutes = function deliveryRoutes() {
    // Depot and shops or factory and shops: a van shuttles between two of your places in this district.
    const owned = this.def.facilities.filter((f) => this.g.facilities.isOwned(f));
    const mode = (f) => this.g.facilities.row(f).mode;
    const from = owned.find((f) => mode(f) === 'Logistics') || owned.find((f) => mode(f) === 'Factory');
    const to = owned.find((f) => mode(f) === 'Retail');
    if (!from || !to) return [];
    const way = PE.MapPaths.routeBetween(this.layout, this.layout.spots[from], this.layout.spots[to]);
    return way && way.length > 1 ? [way] : [];
  };
  proto.addMover = function addMover(pts, key, artId, size, speed, i, opts = {}) {
    const { seg, total } = lengths(pts);
    const sprite = piece(this, pts[0][0], pts[0][1], key, artId, size);
    this.life.movers.push({ sprite, pts, seg, total, d: total * (0.2 + 0.3 * i), dir: i % 2 ? -1 : 1, speed, lane: opts.lane === undefined ? 20 : opts.lane });
  };
  proto.buildVans = function buildVans() {
    const L = this.layout;
    const owned = this.def.facilities.filter((f) => this.g.facilities.isOwned(f)).length;
    const paths = [...this.deliveryRoutes()];
    (L.vans || []).slice(0, Math.min(2, owned)).forEach(([a, b]) => { const way = PE.MapPaths.route(L, a, b); if (way && way.length > 1) paths.push(way); });
    paths.forEach((pts, i) => this.addMover(pts, 'map-van', 'VEH-01', 90, 62 + i * 10, i));
    // Boats and trains are there whether or not you own anything: it's their town too.
    PE.MapPaths.linesOf(L, (k) => k.boat).slice(0, 2).forEach((l, i) => this.addMover(l.pts, 'map-boat', 'VEH-05', 100, 34, i, { lane: 0 }));
    PE.MapPaths.linesOf(L, (k) => k.train).slice(0, 1).forEach((l, i) => this.addMover(l.pts, 'map-train', null, 150, 110, i, { lane: 0 }));
  };

  // ---- Walkers: into your shops if you own one, otherwise strolling down a lane or path ---------------------
  proto.buildWalkers = function buildWalkers() {
    const shops = this.def.facilities.filter((f) => this.g.facilities.isOwned(f) && this.g.facilities.row(f).mode === 'Retail');
    const count = shops.length ? 4 : 2;
    const strolls = PE.MapPaths.linesOf(this.layout, (k, kind) => k.walk && kind !== 'drive' && kind !== 'boulevard' && kind !== 'bridge').filter((l) => l.pts.length > 3);
    for (let i = 0; i < count; i++) {
      const key = `map-walker-${i % 4}`, artId = 'WLK-0' + ((i % 6) + 1);
      if (shops.length) {
        const s = this.layout.spots[shops[i % shops.length]];
        const from = { x: s.x + (i % 2 ? 210 : -210), y: s.y + 80 + i * 8 };
        const to = { x: s.x + 4, y: s.y + 8 };
        const sprite = piece(this, from.x, from.y, key, artId, 80).setOrigin(0.5, 1);
        this.life.walkers.push({ sprite, from, to, t: (i * 0.27) % 1, entering: true, speed: 0.05 + i * 0.006 });
      } else if (strolls.length) {
        const pts = strolls[i % strolls.length].pts;
        const { seg, total } = lengths(pts);
        const sprite = piece(this, pts[0][0], pts[0][1], key, artId, 80).setOrigin(0.5, 1);
        this.life.walkers.push({ sprite, pts, seg, total, d: total * ((i * 0.37) % 1), dir: i % 2 ? -1 : 1, speed: 22 + i * 3 });
      }
    }
  };

  // ---- Smoke, lights, swaying plants ---------------------------------------------------------------------------
  proto.buildBuildingLife = function buildBuildingLife() {
    for (const fid of this.def.facilities) {
      if (!this.g.facilities.isOwned(fid)) continue;
      const s = this.layout.spots[fid];
      const mode = this.g.facilities.row(fid).mode;
      if (mode === 'Factory') {
        for (let i = 0; i < 4; i++) {
          const p = piece(this, s.x + 74, s.y - 200, 'map-puff', 'FX-01', 52).setDepth(s.y + 2).setAlpha(0);
          this.life.puffs.push({ sprite: p, x: s.x + 74, y: s.y - 200, phase: i / 4 });
        }
      }
      if (mode === 'Grow') {
        const glow = this.add.image(s.x, s.y - 66, 'map-glow').setDepth(s.y + 2).setBlendMode(Phaser.BlendModes.ADD).setScale(2.7, 1.8);
        this.life.glows.push({ sprite: glow, phase: s.x % 7 });
        for (let i = 0; i < 3; i++) {
          const p = this.add.image(s.x - 150 + i * 30, s.y + 2 + (i % 2) * 8, 'map-plant').setOrigin(0.5, 1).setDepth(s.y + 3);
          this.life.sways.push({ sprite: p, phase: i * 1.7 + s.y });
        }
      }
    }
  };
  proto.buildFlyers = function buildFlyers() {
    const { w, h } = this.layout;
    const dice = (l) => PE.Rng.roll(`life:${this.district}:${l}`);
    for (let i = 0; i < 3; i++) {
      const s = piece(this, 0, 0, 'map-butterfly', 'FX-03', 40).setDepth(70000);
      this.life.flyers.push({ sprite: s, kind: 'butterfly', cx: 160 + dice('x' + i) * (w - 320), cy: 300 + dice('y' + i) * (h - 600), r: 80 + dice('r' + i) * 80, phase: i * 2 });
    }
    const bird = piece(this, 0, 0, 'map-bird', 'FX-04', 50).setDepth(71000);
    this.life.flyers.push({ sprite: bird, kind: 'bird', y: 300 + dice('by') * (h - 600), phase: 0 });
  };

  // ---- Helpers: near what's new ---------------------------------------------------------------------------------
  proto.buildHelpers = function buildHelpers() {
    if (!PE.App.state.settings.helpers) return;
    const spots = this.g.map.helperSpots(this.district);
    PE.Data.helpers.forEach((h, i) => {
      const id = PE.Data.helperSprites.mapPose[h.id];
      const key = 'helper-' + id;
      const at = spots[i];
      const entry = { id: h.id, at, image: null };
      this.life.helpers.set(h.id, entry);
      const place = () => {
        if (this.sys.settings.status >= Phaser.Scenes.SHUTDOWN) return;
        entry.image = this.add.image(at.x, at.y + 8, key).setOrigin(0.5, 0.96).setDisplaySize(170, 170).setDepth(at.y);
      };
      if (this.textures.exists(key)) { place(); return; }
      const img = new Image();
      img.onload = () => { if (this.sys.settings.status < Phaser.Scenes.SHUTDOWN) { if (!this.textures.exists(key)) this.textures.addImage(key, img); place(); } };
      img.src = PE.HelperArt.url(id);
      this.life.loaded.push(key);
    });
  };

  // ---- Every frame: simple sums only --------------------------------------------------------------------------
  proto.updateLife = function updateLife(time) {
    const L = this.life;
    const dt = Math.min(0.1, (time - (L.last || time)) / 1000);
    L.last = time;
    this.updateGift(time, dt);
    if (this.calmNow) return;
    L.t += dt;
    const T = L.t;
    for (const m of L.movers) {
      m.d += m.dir * m.speed * dt;
      if (m.d > m.total) { m.d = m.total; m.dir = -1; }
      if (m.d < 0) { m.d = 0; m.dir = 1; }
      const p = along(m.pts, m.seg, m.d);
      const len = Math.hypot(p.dx, p.dy) || 1;
      const lane = m.lane * m.dir;
      m.sprite.setPosition(p.x + (p.dy / len) * lane, p.y - (p.dx / len) * lane);
      m.sprite.setFlipX((p.dx * m.dir) < -4);
      m.sprite.setDepth(m.sprite.y);
    }
    for (const w of L.walkers) {
      if (w.pts) {   // strolling along a street, on the pavement
        w.d += w.dir * w.speed * dt;
        if (w.d > w.total) { w.d = w.total; w.dir = -1; }
        if (w.d < 0) { w.d = 0; w.dir = 1; }
        const p = along(w.pts, w.seg, w.d);
        const len = Math.hypot(p.dx, p.dy) || 1;
        w.sprite.setPosition(p.x + (p.dy / len) * 30, p.y - (p.dx / len) * 30 - Math.abs(Math.sin(T * 7 + w.d)) * 4);
        w.sprite.setFlipX(p.dx * w.dir < 0);
        w.sprite.setDepth(p.y);
        continue;
      }
      w.t += w.speed * dt;
      if (w.t > 1) w.t = 0;
      const x = w.from.x + (w.to.x - w.from.x) * w.t;
      const y = w.from.y + (w.to.y - w.from.y) * w.t;
      w.sprite.setPosition(x, y - Math.abs(Math.sin(T * 7 + w.t * 40)) * 4);
      w.sprite.setFlipX(w.to.x < w.from.x);
      w.sprite.setDepth(y);
      // Fades out at the shop door, then the next customer arrives.
      w.sprite.setAlpha(w.entering ? Math.min(1, (1 - w.t) * 8, w.t * 8) : 1);
    }
    for (const p of L.puffs) {
      const k = (T * 0.22 + p.phase) % 1;
      p.sprite.setPosition(p.x + k * 26, p.y - k * 90).setAlpha(0.75 * (1 - k)).setScale(0.55 + k * 0.9);
    }
    for (const g of L.glows) g.sprite.setAlpha(0.42 + 0.2 * Math.sin(T * 1.6 + g.phase));
    for (const s of L.sways) s.sprite.setRotation(Math.sin(T * 1.5 + s.phase) * 0.09);
    for (const f of L.flyers) {
      if (f.kind === 'butterfly') {
        f.sprite.setPosition(f.cx + Math.sin(T * 0.6 + f.phase) * f.r, f.cy + Math.sin(T * 1.1 + f.phase) * f.r * 0.6);
        f.sprite.setScale(1, 0.6 + Math.abs(Math.sin(T * 9 + f.phase)) * 0.5);
      } else {
        const w = this.layout.w + 240;
        f.sprite.setPosition(((T * 42) % w) - 120, f.y + Math.sin(T) * 18);
        f.sprite.setScale(1, 0.7 + Math.abs(Math.sin(T * 5)) * 0.4);
      }
    }
  };

  // Called four times a second. Settings can change while the map is open, so it checks again here.
  proto.refreshLife = function refreshLife() {
    const wasCalm = this.calmNow;
    this.calmNow = this.calm();
    if (this.calmNow && !wasCalm) this.settleLife();
    const L = this.life;
    for (const v of L.rivals.values()) {
      const beaten = !!this.g.state.meta.rivals[v.spot.rival];
      if (beaten !== v.beaten) {
        v.beaten = beaten;
        if (v.realArt) v.image.setTint(beaten ? 0xbfffa0 : 0xffffff);
        else v.image.setTexture(this.rivalKey(v.spot.rival, beaten));
        v.label.setText(beaten ? `${v.rival.name}: taken over!` : v.rival.name).setColor(beaten ? '#c6ff3d' : '#ffd9d9');
      }
    }
    for (const h of L.helpers.values()) if (h.image) h.image.setVisible(PE.App.state.settings.helpers);
  };
  // Reduced motion: everything stops somewhere sensible and stays tappable.
  proto.settleLife = function settleLife() {
    const L = this.life;
    for (const p of L.puffs) p.sprite.setAlpha(0);
    for (const s of L.sways) s.sprite.setRotation(0);
    for (const g of L.glows) g.sprite.setAlpha(0.4);
    for (const w of L.walkers) w.sprite.setAlpha(1);
    for (const f of L.flyers) f.sprite.setVisible(false);
  };

  // ---- The free gift flyer: never an ad, only a tap -----------------------------------------------------------------
  proto.updateGift = function updateGift(time, dt) {
    const L = this.life;
    if (!L.gift) {
      if (time - L.giftCheck < 1000) return;
      L.giftCheck = time;
      if (this.g.map.giftDue()) this.spawnGift();
      return;
    }
    const f = L.gift;
    f.left -= dt;
    if (!this.calmNow) {
      f.x += f.vx * dt;
      f.sprite.setPosition(f.x, f.y + Math.sin(time / 500) * 10);
    }
    if (f.left <= 0) {
      f.sprite.destroy();
      L.gift = null;
      this.g.map.giftMissed();
    }
  };
  proto.spawnGift = function spawnGift() {
    const cam = this.cameras.main;
    const seconds = this.g.B.map.gift.flySeconds;
    const vw = cam.width / cam.zoom, vh = cam.height / cam.zoom;
    const y = cam.midPoint.y - vh * 0.12;
    const fromLeft = cam.midPoint.x > this.layout.w / 2;
    const margin = 70;
    const x = this.calmNow ? cam.midPoint.x : (fromLeft ? cam.midPoint.x - vw / 2 - margin : cam.midPoint.x + vw / 2 + margin);
    const dist = vw + margin * 2;
    const sprite = piece(this, x, y, 'map-balloon', 'VEH-06', 170).setDepth(80000);
    this.life.gift = { sprite, x, y, vx: (fromLeft ? 1 : -1) * dist / seconds, left: seconds };
  };

  // ---- Taps ------------------------------------------------------------------------------------------------------
  proto.tapLife = function tapLife(x, y, k) {
    const L = this.life;
    if (L.gift) {
      const s = L.gift.sprite;
      if (Math.abs(x - s.x) < Math.max(80, 44 * k) && Math.abs(y - s.y) < Math.max(100, 54 * k)) {
        const r = this.g.map.claimGift();
        if (r.ok) {
          this.floatText(s.x, s.y - 40, r.text);
          PE.Dom.toast(`Free gift: ${r.text}`);
          PE.App.saveGame();
        }
        s.destroy();
        L.gift = null;
        return true;
      }
    }
    for (const h of L.helpers.values()) {
      if (!h.image || !h.image.visible) continue;
      if (Math.abs(x - h.at.x) < 60 && y < h.at.y + 16 && y > h.at.y - 130) {
        this.g.helpers.chat(h.id);
        return true;
      }
    }
    for (const v of L.rivals.values()) {
      if (Math.abs(x - v.spot.x) < 120 && y < v.spot.y + 60 && y > v.spot.y - 280) {
        this.rememberView();
        if (v.beaten && PE.Story.has(v.spot.rival)) PE.Story.show(v.spot.rival);
        else PE.App.openPanel('rivals', {});
        return true;
      }
    }
    return false;
  };

  proto.lifeShutdown = function lifeShutdown() {
    // Helper pictures are only held while the map is open.
    for (const key of this.life.loaded) if (this.textures.exists(key)) this.textures.remove(key);
  };

  // Used by the automatic browser test to really tap things.
  proto.giftPagePoint = function giftPagePoint() { const s = this.life.gift.sprite; return this.worldToPage(s.x, s.y); };
  proto.helperPagePoint = function helperPagePoint(id) { const h = this.life.helpers.get(id); return this.worldToPage(h.at.x, h.at.y - 60); };
  proto.rivalPagePoint = function rivalPagePoint(id) { const v = this.life.rivals.get(id); return this.worldToPage(v.spot.x, v.spot.y - 100); };

  // ---- The story scene for a beaten rival: short, and one tap skips it --------------------------------------------------
  const Story = {
    has: (rivalId) => !!PE.Data.rivalStory[rivalId],
    show(rivalId) {
      const chapter = PE.Data.rivalStory[rivalId];
      if (!chapter || !PE.App.state.settings.helpers) return;
      const rival = PE.Data.rivals.find((r) => r.id === rivalId);
      const names = Object.fromEntries(PE.Data.helpers.map((h) => [h.id, h.name]));
      PE.App.g.map.markStorySeen(rivalId);
      const step = (i) => {
        const line = chapter.lines[i];
        const last = i === chapter.lines.length - 1;
        const who = line.who === 'RIVAL' ? rival.name : names[line.who];
        const pic = line.who === 'RIVAL'
          ? `<img class="story-face" src="assets/characters/${rivalId}.webp" alt="${PE.Dom.esc(who)}" onerror="this.style.visibility='hidden'">`
          : `<img class="story-face" src="${PE.HelperArt.url(line.face)}" alt="${PE.Dom.esc(who)}" onerror="this.style.visibility='hidden'">`;
        PE.Dom.modal({
          title: chapter.title,
          cls: 'story',
          html: `${pic}<p class="story-who">${PE.Dom.esc(who)}</p><p>${PE.Dom.esc(line.text)}</p>`,
          buttons: last ? [{ label: 'Done', style: 'go' }] : [{ label: 'Skip', style: 'plain' }, { label: 'Next', style: 'go', onTap: () => step(i + 1) }],
        });
      };
      step(0);
    },
  };
  PE.Story = Story;
})(globalThis.PE = globalThis.PE || {});
