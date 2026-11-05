// What makes the Empire map feel alive (job 5, Stage 2): vans, walkers, chimney smoke, glowing grow
// buildings, swaying plants, butterflies, the helpers standing about, the free gift flyer and the rival
// buildings. It adds to the map scene in js/ui/empire_map.js.
//
// Kept light on purpose: about 20 small pictures moved with simple sums, no physics and no timers per
// object. With reduced motion on, nothing moves but everything can still be tapped.
// The pieces are real art, by file name (art/map/MAP_PIECES_ART.md). The boats and the train have no art yet.
// Vehicles and walkers are drawn facing left: the game mirrors them for the other way.
(function (PE) {
  const FONT = 'system-ui, sans-serif';
  const proto = PE.EmpireMapScene.prototype;

  function tex(scene, key, w, h, draw) {
    if (!scene.textures.exists(key)) {
      const G = scene.make.graphics({ x: 0, y: 0, add: false });
      draw(G);
      G.generateTexture(key, w, h);
      G.destroy();
    }
    return key;
  }
  // A piece of real art, shown size tall once its picture has come. Nothing shows until then.
  function piece(scene, x, y, artId, size) {
    const s = scene.add.image(x, y, '__WHITE').setVisible(false);
    s.artReady = false;
    PE.MapArt.load(scene, artId, (k) => {
      if (!s.scene) return;
      const src = scene.textures.get(k).getSourceImage();
      s.setTexture(k).setDisplaySize((src.width / src.height) * size, size).setVisible(true);
      s.artReady = true;
      s.base = s.scaleY;
    });
    return s;
  }
  const VAN_ART = ['VEH-01', 'VEH-02', 'VEH-04', 'VEH-05', 'VEH-03'];
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
    this.life = { movers: [], walkers: [], puffs: [], glows: [], flyers: [], props: [], helpers: new Map(), rivals: new Map(), gift: null, giftCheck: 0, loaded: [], t: 0 };
    this.calmNow = this.calm();
    this.makeLifeTextures();
    this.buildProps();
    this.buildRivals();
    this.buildVans();
    this.buildWalkers();
    this.buildBuildingLife();
    this.buildFlyers();
    this.buildHelpers();
  };

  proto.makeLifeTextures = function makeLifeTextures() {
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
    tex(this, 'map-glow', 128, 128, (G) => { for (let r = 62; r > 0; r -= 6) G.fillStyle(0xc6ff3d, 0.07).fillCircle(64, 64, r); });
  };

  // ---- A few real props standing on the painting, placed in the district's file ---------------------------
  proto.buildProps = function buildProps() {
    for (const p of PE.MapPaths.placeProps(this.layout)) {
      const s = piece(this, p.x, p.y, p.art, p.size).setOrigin(0.5, 0.97).setDepth(p.y);
      this.life.props.push(s);
    }
  };

  // ---- Rival buildings at the edges: beating a rival takes the spot over ---------------------------------
  proto.buildRivals = function buildRivals() {
    for (const spot of this.layout.rivalSpots) {
      const rival = PE.Data.rivals.find((r) => r.id === spot.rival);
      const num = Number(spot.rival.split('-')[1]);
      const artId = 'RBL-' + String(num).padStart(2, '0');
      const image = this.add.image(spot.x, spot.y, '__WHITE').setOrigin(0.5, 1).setDepth(spot.y).setVisible(false);
      PE.MapArt.load(this, artId, (k) => {
        if (!image.scene) return;
        const src = this.textures.get(k).getSourceImage();
        const f = Math.min(spot.w / src.width, (spot.w * 1.3) / src.height);
        image.setTexture(k).setDisplaySize(src.width * f, src.height * f).setVisible(true);
      });
      const label = this.add.text(spot.x, spot.y + 6, rival.name, {
        fontFamily: FONT, fontStyle: 'bold', fontSize: '18px', color: '#ffd9d9', stroke: '#1d0f33', strokeThickness: 5,
      }).setOrigin(0.5, 0).setDepth(spot.y + 1);
      this.life.rivals.set(spot.rival, { spot, image, label, beaten: null, rival });
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
  proto.addMover = function addMover(pts, sprite, speed, i, opts = {}) {
    const { seg, total } = lengths(pts);
    this.life.movers.push({ sprite, pts, seg, total, d: total * (0.2 + 0.3 * i), dir: i % 2 ? -1 : 1, speed, lane: opts.lane === undefined ? 9 : opts.lane, artFaces: opts.artFaces || -1 });
  };
  proto.buildVans = function buildVans() {
    const L = this.layout;
    const owned = this.def.facilities.filter((f) => this.g.facilities.isOwned(f)).length;
    const paths = [...this.deliveryRoutes()];
    (L.vans || []).slice(0, Math.min(2, owned)).forEach(([a, b]) => { const way = PE.MapPaths.route(L, a, b); if (way && way.length > 1) paths.push(way); });
    const first = Number(this.district.slice(1)) - 1;
    paths.forEach((pts, i) => this.addMover(pts, piece(this, pts[0][0], pts[0][1], VAN_ART[(first + i) % VAN_ART.length], 58).setOrigin(0.5, 0.85), 62 + i * 10, i));
    // Boats and trains are there whether or not you own anything: it's their town too.
    PE.MapPaths.linesOf(L, (k) => k.boat).slice(0, 2).forEach((l, i) => this.addMover(l.pts, this.add.image(l.pts[0][0], l.pts[0][1], 'map-boat').setDisplaySize(90, 49), 26, i, { lane: 0, artFaces: 1 }));
    PE.MapPaths.linesOf(L, (k) => k.train).slice(0, 1).forEach((l, i) => this.addMover(l.pts, this.add.image(l.pts[0][0], l.pts[0][1], 'map-train').setDisplaySize(130, 43), 110, i, { lane: 0 }));
  };

  // ---- Walkers: along the painted streets, into your shops if you own one --------------------------------------
  proto.buildWalkers = function buildWalkers() {
    const L = this.layout;
    const onFoot = (k) => (PE.MapPaths.KINDS[k] || {}).walk;
    const shops = this.def.facilities.filter((f) => this.g.facilities.isOwned(f) && this.g.facilities.row(f).mode === 'Retail');
    const count = shops.length ? 4 : 3;
    const strolls = PE.MapPaths.linesOf(L, (k, kind) => k.walk && kind !== 'drive').filter((l) => l.pts.length > 3).sort((a, b) => b.pts.length - a.pts.length);
    for (let i = 0; i < count; i++) {
      const artId = 'WLK-0' + (((i + Number(this.district.slice(1))) % 6) + 1);
      let way = null, entering = false;
      if (shops.length) {
        // Customers walk the streets from a few junctions away, up to the shop door, and go in.
        const s = L.spots[shops[i % shops.length]];
        const from = Object.keys(L.nodes).filter((n) => PE.MapPaths.route(L, n, PE.MapPaths.doorId(s), onFoot)).sort((a, b) => Math.hypot(L.nodes[b][0] - s.x, L.nodes[b][1] - s.y) - Math.hypot(L.nodes[a][0] - s.x, L.nodes[a][1] - s.y))[1 + i * 2];
        way = from ? PE.MapPaths.route(L, from, PE.MapPaths.doorId(s), onFoot) : null;
        entering = !!way;
      }
      if (!way && strolls.length) way = strolls[i % strolls.length].pts;
      if (!way || way.length < 2) continue;
      const { seg, total } = lengths(way);
      const sprite = piece(this, way[0][0], way[0][1], artId, 44).setOrigin(0.5, 0.95);
      this.life.walkers.push({ sprite, pts: way, seg, total, d: total * ((i * 0.37) % 1), dir: entering || i % 2 === 0 ? 1 : -1, speed: 17 + i * 2, entering, side: i % 2 ? 6 : -6 });
    }
  };

  // ---- Smoke and lights ---------------------------------------------------------------------------
  proto.buildBuildingLife = function buildBuildingLife() {
    for (const fid of this.def.facilities) {
      if (!this.g.facilities.isOwned(fid)) continue;
      const s = this.layout.spots[fid];
      const mode = this.g.facilities.row(fid).mode;
      if (mode === 'Factory') {
        // Placed on the chimney once the building's picture is up (see onBuildingArt): each look's chimney is elsewhere.
        for (let i = 0; i < 4; i++) {
          const p = piece(this, s.x, s.y, 'FX-01', 34).setDepth(s.y + 2).setAlpha(0);
          this.life.puffs.push({ sprite: p, fid, x: s.x, y: s.y - s.w * 0.8, phase: i / 4 });
        }
      }
      if (mode === 'Grow') {
        const glow = this.add.image(s.x, s.y - s.w * 0.12, 'map-glow').setDepth(s.y + 2).setBlendMode(Phaser.BlendModes.ADD).setScale(s.w / 128, s.w / 220);
        this.life.glows.push({ sprite: glow, phase: s.x % 7 });
      }
    }
  };
  proto.buildFlyers = function buildFlyers() {
    const { w, h } = this.layout;
    const dice = (l) => PE.Rng.roll(`life:${this.district}:${l}`);
    for (let i = 0; i < 3; i++) {
      const s = piece(this, 0, 0, 'FX-03', 26).setDepth(70000);
      this.life.flyers.push({ sprite: s, kind: 'butterfly', cx: 160 + dice('x' + i) * (w - 320), cy: 300 + dice('y' + i) * (h - 600), r: 80 + dice('r' + i) * 80, phase: i * 2 });
    }
    const bird = piece(this, 0, 0, 'FX-04', 34).setDepth(71000);
    this.life.flyers.push({ sprite: bird, kind: 'bird', y: 300 + dice('by') * (h - 600), phase: 0 });
    for (let i = 0; i < 2; i++) {
      const s = piece(this, 0, 0, 'FX-05', 18).setDepth(69000);
      this.life.flyers.push({ sprite: s, kind: 'leaf', x: 120 + dice('lx' + i) * (w - 240), top: 200 + dice('ly' + i) * (h - 700), phase: i * 3 });
    }
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
        entry.image = this.add.image(at.x, at.y + 8, key).setOrigin(0.5, 0.96).setDisplaySize(110, 110).setDepth(at.y);
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
      m.sprite.setFlipX((p.dx * m.dir * m.artFaces) < -4);
      m.sprite.setDepth(m.sprite.y);
    }
    for (const w of L.walkers) {
      w.d += w.dir * w.speed * dt;
      if (w.entering) {
        // Fades out at the shop door, and the next customer comes along the street.
        if (w.d > w.total) w.d = 0;
        w.sprite.setAlpha(Math.min(1, (w.total - w.d) / 24, w.d / 24));
      } else {
        if (w.d > w.total) { w.d = w.total; w.dir = -1; }
        if (w.d < 0) { w.d = 0; w.dir = 1; }
      }
      const p = along(w.pts, w.seg, w.d);
      const len = Math.hypot(p.dx, p.dy) || 1;
      w.sprite.setPosition(p.x + (p.dy / len) * w.side, p.y - (p.dx / len) * w.side - Math.abs(Math.sin(T * 7 + w.d)) * 3);
      w.sprite.setFlipX(p.dx * w.dir > 0);
      w.sprite.setDepth(p.y);
    }
    for (const p of L.puffs) {
      const k = (T * 0.22 + p.phase) % 1;
      p.sprite.setPosition(p.x + k * 18, p.y - k * 66).setAlpha(0.75 * (1 - k));
      if (p.sprite.base) p.sprite.setScale(p.sprite.base * (0.55 + k * 0.9));
    }
    for (const g of L.glows) g.sprite.setAlpha(0.42 + 0.2 * Math.sin(T * 1.6 + g.phase));
    for (const f of L.flyers) {
      if (f.kind === 'butterfly') {
        f.sprite.setPosition(f.cx + Math.sin(T * 0.6 + f.phase) * f.r, f.cy + Math.sin(T * 1.1 + f.phase) * f.r * 0.6);
        if (f.sprite.base) f.sprite.setScale(f.sprite.base, f.sprite.base * (0.6 + Math.abs(Math.sin(T * 9 + f.phase)) * 0.5));
      } else if (f.kind === 'leaf') {
        // Drifts down a little way, fading, then starts again.
        const k = (T * 0.09 + f.phase) % 1;
        f.sprite.setPosition(f.x + Math.sin(T * 1.4 + f.phase) * 26, f.top + k * 220).setRotation(Math.sin(T + f.phase) * 0.8).setAlpha(Math.min(1, (1 - k) * 4, k * 4));
      } else {
        const w = this.layout.w + 240;
        f.sprite.setPosition(((T * 42) % w) - 120, f.y + Math.sin(T) * 18);
        if (f.sprite.base) f.sprite.setScale(f.sprite.base, f.sprite.base * (0.7 + Math.abs(Math.sin(T * 5)) * 0.4));
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
        v.image.setTint(beaten ? 0xbfffa0 : 0xffffff);
        v.label.setText(beaten ? `${v.rival.name}: taken over!` : v.rival.name).setColor(beaten ? '#c6ff3d' : '#ffd9d9');
      }
    }
    for (const h of L.helpers.values()) if (h.image) h.image.setVisible(PE.App.state.settings.helpers);
  };
  // Reduced motion: everything stops somewhere sensible and stays tappable.
  proto.settleLife = function settleLife() {
    const L = this.life;
    for (const p of L.puffs) p.sprite.setAlpha(0);
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
    const sprite = piece(this, x, y, 'VEH-06', 150).setDepth(80000);
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
          PE.Dom.toast(`Free gift: ${r.text}`, '', 'RWD-04');
          { const p = this.worldToPage(s.x, s.y); PE.Juice.sparkle(p.x, p.y, 7); }
          PE.App.saveGame();
        }
        s.destroy();
        L.gift = null;
        return true;
      }
    }
    for (const h of L.helpers.values()) {
      if (!h.image || !h.image.visible) continue;
      if (Math.abs(x - h.at.x) < 40 && y < h.at.y + 12 && y > h.at.y - 95) {
        this.g.helpers.chat(h.id);
        return true;
      }
    }
    for (const v of L.rivals.values()) {
      if (Math.abs(x - v.spot.x) < Math.max(v.spot.w / 2, 70) && y < v.spot.y + 46 && y > v.spot.y - Math.max(v.spot.w * 0.95, 170)) {
        this.rememberView();
        if (v.beaten && PE.Story.has(v.spot.rival)) PE.Story.show(v.spot.rival);
        else PE.App.openPanel('rivals', {});
        return true;
      }
    }
    return false;
  };

  // Smoke comes out of the chimney on whichever look the factory has now.
  proto.onBuildingArt = function onBuildingArt(v) {
    const at = PE.Data.map.chimney[v.artId];
    if (!at || !this.life) return;
    for (const p of this.life.puffs) {
      if (p.fid !== v.fid) continue;
      p.x = v.s.x + (at[0] - 0.5) * v.artW;
      p.y = v.s.y - v.artTop * (1 - at[1]);
    }
  };
  // A little burst of cash where you collected (FX-06).
  proto.cashPop = function cashPop(x, y) {
    PE.MapArt.load(this, 'FX-06', (k) => {
      const s = this.add.image(x, y, k).setDepth(90000);
      const size = 60 * PE.App.dpr / this.cameras.main.zoom;
      const src = this.textures.get(k).getSourceImage();
      s.setDisplaySize((src.width / src.height) * size, size);
      if (this.calm()) { this.time.delayedCall(350, () => s.destroy()); return; }
      this.tweens.add({ targets: s, y: y - size * 0.9, alpha: 0, duration: 650, ease: 'Sine.easeOut', onComplete: () => s.destroy() });
    });
  };

  proto.lifeShutdown = function lifeShutdown() {
    // Helper pictures are only held while the map is open.
    for (const key of this.life.loaded) if (this.textures.exists(key)) this.textures.remove(key);
  };

  // Used by the automatic browser test to really tap things.
  proto.giftPagePoint = function giftPagePoint() { const s = this.life.gift.sprite; return this.worldToPage(s.x, s.y); };
  proto.helperPagePoint = function helperPagePoint(id) { const h = this.life.helpers.get(id); return this.worldToPage(h.at.x, h.at.y - 60); };
  proto.rivalPagePoint = function rivalPagePoint(id) { const v = this.life.rivals.get(id); return this.worldToPage(v.spot.x, v.spot.y - 50); };

  // ---- The story scene for a beaten rival: short, and one tap skips it --------------------------------------------------
  const Story = {
    has: (rivalId) => !!PE.Data.rivalStory[rivalId],
    show(rivalId) {
      const chapter = PE.Data.rivalStory[rivalId];
      if (!chapter || !PE.App.state.settings.helpers) return;
      const rival = PE.Data.rivals.find((r) => r.id === rivalId);
      const names = Object.fromEntries(PE.Data.helpers.map((h) => [h.id, h.name]));
      PE.App.g.map.markStorySeen(rivalId);
      // A comic strip: each new line pops in as a panel under the one before, speakers on alternating sides.
      const panel = (line, i, fresh) => {
        const who = line.who === 'RIVAL' ? rival.name : names[line.who];
        const src = line.who === 'RIVAL' ? `assets/characters/${rivalId}.webp` : PE.HelperArt.url(line.face);
        return `<div class="comic-panel ${i % 2 ? 'right' : ''} ${fresh ? 'fresh' : ''}"><img class="story-face" src="${src}" alt="${PE.Dom.esc(who)}" onerror="this.style.visibility='hidden'"><div class="comic-say"><b class="story-who">${PE.Dom.esc(who)}</b><p>${PE.Dom.esc(line.text)}</p></div></div>`;
      };
      const step = (i) => {
        const last = i === chapter.lines.length - 1;
        const from = Math.max(0, i - 1);   // the line before stays up, so it reads as a conversation
        PE.Dom.modal({
          title: chapter.title,
          cls: 'story',
          html: `<div class="comic">${chapter.lines.slice(from, i + 1).map((l, k) => panel(l, from + k, from + k === i)).join('')}</div>`,
          buttons: last ? [{ label: 'Done', style: 'go' }] : [{ label: 'Skip', style: 'plain' }, { label: 'Next', style: 'go', onTap: () => step(i + 1) }],
        });
      };
      step(0);
    },
  };
  PE.Story = Story;
})(globalThis.PE = globalThis.PE || {});
