// What makes the Empire map feel alive (job 5, Stage 2): vans, walkers, chimney smoke, glowing grow
// buildings, swaying plants, butterflies, the helpers and managers (js/ui/helper_life.js), the free gift flyer and the
// rival buildings. It adds to the map scene in js/ui/empire_map.js.
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
    this.buildLots();
    this.buildVans();
    this.buildWalkers();
    this.buildBuildingLife();
    this.buildFlyers();
    this.buildHelpers();
    this.buildManagers();
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
      // The last one is a VIP with her own frames (VIP-08 Nova, or VIP-09 Goldie in every other district).
      const vip = ['VIP-08', 'VIP-09'][(Number(this.district.slice(1)) + 1) % 2];
      const artId = i === count - 1 && PE.AnimPick.hasFrames(vip) ? vip : 'WLK-0' + (((i + Number(this.district.slice(1))) % 6) + 1);
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
      // A walker with drawn frames walks for real. The others keep their still picture with a bob until theirs arrive.
      const actor = PE.AnimPick.hasFrames(artId) ? new PE.Anim.Actor(this, artId, { x: way[0][0], y: way[0][1], height: 46 }) : null;
      const sprite = actor ? actor.image : piece(this, way[0][0], way[0][1], artId, 44).setOrigin(0.5, 0.95);
      this.life.walkers.push({ actor, sprite, pts: way, seg, total, d: total * ((i * 0.37) % 1), dir: entering || i % 2 === 0 ? 1 : -1, speed: 17 + i * 2, entering, side: i % 2 ? 6 : -6 });
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

  // ---- Helpers: they walk the painted streets near what's new, and Uncle Haze starts outside his Shack ------------
  proto.buildHelpers = function buildHelpers() {
    if (!PE.App.state.settings.helpers) return;
    const L = this.layout;
    const onFoot = (k) => (PE.MapPaths.KINDS[k] || {}).walk;
    const shack = (L.features || {}).X01;
    const spots = this.g.map.helperSpots(this.district);
    const names = Object.keys(L.nodes).filter((n) => !(L.notStreet || []).includes(n));
    const nearest = (x, y, list = names) => list.slice().sort((p, q) => Math.hypot(L.nodes[p][0] - x, L.nodes[p][1] - y) - Math.hypot(L.nodes[q][0] - x, L.nodes[q][1] - y))[0];
    const home = spots[0] || { x: L.w / 2, y: L.h / 2 };
    const world = {
      height: 100,
      speed: 24,
      near: 170,
      textScale: () => PE.App.dpr / this.cameras.main.zoom,
      start: (i, id) => {
        const p = id === 'HAZE' && shack ? { x: shack.x - shack.w * 0.42, y: shack.y + 14 } : (spots[i] || home);
        return { x: p.x, y: p.y + (id === 'HAZE' && shack ? 0 : 8), node: nearest(p.x, p.y) };
      },
      // Along the streets to somewhere not far from here, or towards someone.
      path: (e, toward) => {
        const close = names.filter((n) => n !== e.node && Math.hypot(L.nodes[n][0] - e.actor.x, L.nodes[n][1] - e.actor.y) < 620);
        const to = toward ? nearest(toward.x, toward.y) : close[Math.floor(Math.random() * close.length)];
        if (!to || to === e.node) return null;
        const way = PE.MapPaths.route(L, e.node, to, onFoot);
        if (!way || way.length < 2) return null;
        e.node = to;
        return [[e.actor.x, e.actor.y], ...way];
      },
    };
    // For Budz: a rival's building close by that he can go and yell at, and the way there.
    world.rivalFor = (e) => {
      let best = null, gap = 520;
      for (const v of this.life.rivals.values()) {
        if (v.beaten) continue;
        const d = Math.hypot(v.spot.x - e.actor.x, v.spot.y - e.actor.y);
        if (d < gap) { gap = d; best = v.spot; }
      }
      if (!best) return null;
      const stop = best.node;
      const way = e.node === stop ? [] : PE.MapPaths.route(L, e.node, stop, onFoot);
      if (way === null) return null;
      if (way.length) e.node = stop;
      // The last few steps are off the road, to just in front of the building's corner on the near side.
      const n = L.nodes[stop];
      const side = n[0] < best.x ? -1 : 1;
      const front = [best.x + side * best.w * 0.46, best.y + 14];
      return { x: best.x, way: [[e.actor.x, e.actor.y], ...way, front] };
    };
    const life = this.life.helperLife = new PE.HelperLife.Life(this, world);
    for (const e of life.list) {
      this.life.helpers.set(e.id, e);
      if (e.id === 'HAZE' && shack) this.life.haze = e;
    }
  };

  // ---- Managers stand at their building, and hand something over when it sells ------------------------------------
  proto.buildManagers = function buildManagers() {
    this.life.managers = [];
    if (!PE.App.state.settings.helpers) return;
    for (const fid of this.def.facilities) {
      if (!this.g.facilities.isOwned(fid) || this.g.facilities.row(fid).mode !== 'Retail') continue;
      const id = this.g.collections.managersAt(fid)[0];
      if (!id) continue;
      const s = this.layout.spots[fid];
      const actor = new PE.Anim.Actor(this, id, { x: s.x + s.w * 0.38, y: s.y + 10, height: 74 });
      this.life.managers.push({ id, fid, actor });
    }
  };
  // Hand it over: the "here you go" move if they have one, and the product icon pops out beside the hand.
  // sku: what sold. The crop shows the logo of the strain last harvested. A product has a stand-in label until its art arrives.
  const FAMILY_COLOUR = { Snacks: 0xff8a3d, Drinks: 0x52a6ff, Accessories: 0x62d04b, 'Novelty Gifts': 0xff4fa3, 'Wellness Fiction': 0xb47cff, 'Premium Packs': 0xffd84d };
  function productLabel(scene, id) {
    const key = 'product-' + id;
    if (scene.textures.exists(key)) return key;
    const p = PE.Data.collectibles.products.find((x) => x.id === id);
    if (!p) return null;
    const size = 96;
    const tex = scene.textures.createCanvas(key, size, size);
    const c = tex.context;
    const col = (FAMILY_COLOUR[p.family] !== undefined ? FAMILY_COLOUR[p.family] : 0xff4fa3).toString(16).padStart(6, '0');
    c.fillStyle = '#' + col; c.beginPath(); c.roundRect(4, 4, size - 8, size - 8, 16); c.fill();
    c.lineWidth = 5; c.strokeStyle = '#1d0f33'; c.stroke();
    c.fillStyle = '#1d0f33'; c.font = '900 40px system-ui, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText(p.name.split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase(), size / 2, size / 2 + 2);
    tex.refresh();
    return key;
  }
  function soldPicture(scene, sku, ready) {
    const g = PE.App.g;
    if (sku && sku !== g.business.CROP) { const k = productLabel(scene, sku); if (k) { ready(k); return; } }
    if (sku === g.business.CROP || !sku) {
      let strain = PE.App.lastHarvestStrain;
      if (!strain) g.grow.eachStation((f, si, st) => { if (!strain) strain = st.lastStrains.find(Boolean); });
      if (strain) {
        const key = 'logo-' + strain;
        if (scene.textures.exists(key)) { ready(key); return; }
        const pic = new Image();
        pic.onload = () => { if (scene.sys.settings.status >= Phaser.Scenes.SHUTDOWN) return; if (!scene.textures.exists(key)) scene.textures.addImage(key, pic); ready(key); };
        pic.src = `assets/logos/${strain}.webp`;
        return;
      }
    }
    PE.UI.loadIcons(scene, ['ACT-03'], () => { if (scene.textures.exists('ui-ACT-03')) ready('ui-ACT-03'); });
  }
  PE.Anim.handOver = function handOver(scene, actor, sku) {
    actor.play('give');
    soldPicture(scene, sku, (key) => {
      if (actor.gone) return;
      PE.Anim.lastHanded = key;
      const size = actor.height * 0.34;
      const s = scene.add.image(actor.x + actor.height * 0.3, actor.y - actor.height * 0.5, key).setDisplaySize(size, size).setDepth(actor.image.depth + 1);
      if (PE.App.state.settings.reducedMotion) { scene.time.delayedCall(400, () => s.destroy()); return; }
      scene.tweens.add({ targets: s, y: s.y - actor.height * 0.45, x: s.x + actor.height * 0.12, alpha: 0, duration: 800, ease: 'Sine.easeOut', onComplete: () => s.destroy() });
    });
  };
  // Spare clearings are lots for future buildings. A stand-in sign drawn in code, until its art arrives (PRP-LOT).
  proto.buildLots = function buildLots() {
    const L = this.layout;
    const props = L.props || [];
    this.lotSigns = (L.spareLots || []).filter((s) => !props.some((p) => Math.hypot(p.x - s.x, p.y - s.y) < 46)).map((s) => {
      const c = this.add.container(s.x, s.y).setDepth(s.y);
      const G = this.add.graphics();
      G.fillStyle(0x000000, 0.25).fillEllipse(0, 2, 70, 16);
      G.fillStyle(0x6a4628, 1).fillRect(-4, -46, 8, 48);
      G.fillStyle(0xf6efe0, 1).fillRoundedRect(-37, -78, 74, 40, 6);
      G.lineStyle(3, 0x1d0f33, 1).strokeRoundedRect(-37, -78, 74, 40, 6);
      const t = this.add.text(0, -58, 'LOT\nFOR SALE', { fontFamily: 'system-ui, sans-serif', fontStyle: '900', fontSize: '13px', color: '#1d0f33', align: 'center', lineSpacing: -2 }).setOrigin(0.5).setResolution(2);
      c.add([G, t]);
      return { x: s.x, y: s.y };
    });
  };
  proto.tapLot = function tapLot(x, y) {
    const hit = (this.lotSigns || []).find((s) => Math.abs(x - s.x) < 50 && y < s.y + 22 && y > s.y - 90);
    if (!hit) return false;
    PE.Dom.toast('More of the empire is coming soon');
    return true;
  };
  proto.lifeEvent = function lifeEvent(type, e) {
    const L = this.life;
    if (!L) return;
    if (L.helperLife) {
      if (type === 'rivalBeaten') { L.helperLife.react('harvest'); this.bigWin(); } else if (type === 'harvest') L.helperLife.react('harvest');
      else if (type === 'lockedTap') L.helperLife.react('locked');
    }
    if (type === 'sold' && L.managers && L.managers.length) {
      const now = performance.now();
      if (now - (L.lastGive || 0) < 5000) return;
      const m = L.managers.find((x) => !x.actor.paused && x.fid === e.fid) || L.managers.find((x) => !x.actor.paused);
      if (!m) return;
      L.lastGive = now;
      PE.Anim.handOver(this, m.actor, e.sku);
    }
  };

  // A big win: Uncle Haze laughs till he falls over.
  proto.bigWin = function bigWin() {
    const H = this.life.helperLife;
    const e = H && H.list.find((x) => x.id === 'HAZE');
    if (e && !e.actor.paused && e.state !== 'chat' && !H.frozen()) H.liveMove(e, 'rofl');
  };

  // ---- Every frame: simple sums only --------------------------------------------------------------------------
  proto.updateLife = function updateLife(time) {
    const L = this.life;
    const dt = Math.min(0.1, (time - (L.last || time)) / 1000);
    L.last = time;
    this.updateGift(time, dt);
    PE.Anim.stepAll(this, dt);
    if (L.helperLife) L.helperLife.update(dt);
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
      if (w.actor) {
        w.actor.moveTo(p.x + (p.dy / len) * w.side, p.y - (p.dx / len) * w.side);
        w.actor.heading(p.dx * w.dir, p.dy * w.dir);
        continue;
      }
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
    if (L.helperLife) L.helperLife.setVisible(PE.App.state.settings.helpers);
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
    // A helper hidden behind a building or a rival's building can't be tapped: the tap's for the building.
    const helper = L.helperLife && L.helperLife.tap(x, y, (h) => this.helperBlockedAt(h, x, y));
    if (helper) {
      this.g.helpers.chat(helper.id);
      return true;
    }
    for (const v of L.rivals.values()) {
      if (Math.abs(x - v.spot.x) < Math.max(v.spot.w / 2, 70) && y < v.spot.y + 46 && y > v.spot.y - Math.max(v.spot.w * 0.95, 170)) {
        this.rememberView();
        if (!v.beaten && L.helperLife) L.helperLife.react('rival');
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
  // Is a building or a rival's building drawn in front of this helper at this spot on the map?
  proto.helperBlockedAt = function helperBlockedAt(h, x, y) {
    const pics = [...this.views.values()].map((v) => v.image).concat([...this.life.rivals.values()].map((v) => v.image));
    return pics.some((im) => im.visible && im.depth > h.actor.image.depth && PE.Anim.solidAt(this, im, x, y));
  };
  // A point on the helper that can really be seen, or null if a building hides them.
  proto.helperPagePoint = function helperPagePoint(id) { return this.life.helperLife.pagePoint(id, (h, x, y) => this.helperBlockedAt(h, x, y)); };
  // For the tests: a point to tap on the helper. If a building hides them, first move them to the nearest open spot on a street,
  // with the camera on them. (A helper that's out of sight behind a building can't be tapped, by design: the tap is the building's.)
  proto.helperTapPoint = function helperTapPoint(id) {
    const here = this.helperPagePoint(id);
    if (here) return here;
    const e = this.life.helperLife.list.find((x) => x.id === id);
    const pts = PE.MapPaths.linesOf(this.layout, (k) => k.walk).flatMap((l) => l.pts)
      .sort((p, q) => Math.hypot(p[0] - e.actor.x, p[1] - e.actor.y) - Math.hypot(q[0] - e.actor.x, q[1] - e.actor.y));
    const cam = this.cameras.main;
    for (const [x, y] of pts) {
      e.actor.setBehind(null);
      e.actor.moveTo(x, y);
      cam.centerOn(x, y - 40); cam.preRender(); this.clampCamera();
      const p = this.helperPagePoint(id);
      if (p) return p;
    }
    return null;
  };
  proto.rivalPagePoint = function rivalPagePoint(id) { const v = this.life.rivals.get(id); return this.worldToPage(v.spot.x, v.spot.y - 50); };

  // ---- The story scene for a beaten rival: short, and one tap skips it --------------------------------------------------
  const Story = {
    has: (rivalId) => !!PE.Data.rivalStory[rivalId],
    show(rivalId) {
      const chapter = PE.Data.rivalStory[rivalId];
      if (!chapter || !PE.App.state.settings.helpers) return;
      const rival = PE.Data.rivals.find((r) => r.id === rivalId);
      PE.App.g.map.markStorySeen(rivalId);
      // A rival makes a move: anyone on the map reacts as the chapter starts.
      const m = PE.App.game.scene.getScene('empire');
      if (m && m.ready && m.life && m.life.helperLife) m.life.helperLife.react('rival');
      PE.Talk.play({ title: chapter.title, cls: 'story', lines: chapter.lines, rivalId, rivalName: rival.name });
    },
  };
  PE.Story = Story;
})(globalThis.PE = globalThis.PE || {});
