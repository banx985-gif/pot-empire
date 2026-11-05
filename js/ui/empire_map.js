// The Empire map scene: one big outdoor district you drag around and pinch to zoom. It only draws and
// passes taps along; the rules are in js/logic/empire_map.js and the layout in data/map.js.
//
// ALL MAP ART IS STAND-IN until Aaron's map art arrives. Each picture is drawn from plain shapes, unless
// the asset registry says a real copy has been imported (npm run mapart), in which case that's shown
// instead, by file name. Everything is listed in the registry as "planned".
(function (PE) {
  const FONT = 'system-ui, sans-serif';
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  const OVERSCROLL = 70;    // map units you can drag past the edge before it springs back

  const dim = (c, f) => (((c >> 16) & 255) * f) << 16 | (((c >> 8) & 255) * f) << 8 | ((c & 255) * f);
  const mix = (c, to, f) => {
    const ch = (s) => Math.round(((c >> s) & 255) * (1 - f) + ((to >> s) & 255) * f);
    return (ch(16) << 16) | (ch(8) << 8) | ch(0);
  };

  // ---- Stand-in buildings -----------------------------------------------------------------------------
  // tier = renovations done (0 to 3). Every renovation visibly adds something.
  const BOX_W = 360, BOX_H = 420;
  function box(G, cx, base, w, h, wall, roof) {
    const depth = Math.round(w * 0.2);
    G.fillStyle(dim(wall, 0.72), 1);
    G.fillPoints([{ x: cx + w / 2, y: base }, { x: cx + w / 2 + depth, y: base - depth * 0.7 }, { x: cx + w / 2 + depth, y: base - h - depth * 0.7 }, { x: cx + w / 2, y: base - h }], true);
    G.fillStyle(wall, 1).fillRect(cx - w / 2, base - h, w, h);
    G.fillStyle(roof, 1);
    G.fillPoints([{ x: cx - w / 2, y: base - h }, { x: cx + w / 2, y: base - h }, { x: cx + w / 2 + depth, y: base - h - depth * 0.7 }, { x: cx - w / 2 + depth, y: base - h - depth * 0.7 }], true);
    G.lineStyle(4, 0x140a24, 1).strokeRect(cx - w / 2, base - h, w, h);
  }
  const windows = (G, x, y, cols, rows, w, h, gap, c) => {
    G.fillStyle(c, 1);
    for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) G.fillRect(x + i * (w + gap), y + j * (h + gap), w, h);
  };
  const leaf = (G, x, y, s, c) => {
    G.fillStyle(c, 1);
    G.fillTriangle(x, y - s, x - s * 0.45, y, x + s * 0.45, y);
    G.fillTriangle(x - s * 0.8, y - s * 0.45, x, y, x - s * 0.1, y - s * 0.2);
    G.fillTriangle(x + s * 0.8, y - s * 0.45, x, y, x + s * 0.1, y - s * 0.2);
  };
  // What each facility looks like: its colours and shape. Own look, not any other game's.
  const SHAPE = {
    F01(G, c, b, t) { box(G, c, b, 190, 110, 0x9c8f7c, 0x6b5f50); G.fillStyle(0x3a3346, 1).fillRect(c - 70, b - 80, 140, 80); for (let y = 0; y < 80; y += 14) G.fillStyle(0x56505f, 1).fillRect(c - 70, b - 80 + y, 140, 6); G.fillStyle(0xc6ff3d, t ? 0.8 : 0.35).fillRect(c - 70, b - 8, 140, 8); },
    F02(G, c, b, t) { box(G, c, b, 240, 140, 0xa34f3a, 0x5c3a36); G.fillStyle(0x2c1a4d, 1).fillRect(c - 54, b - 96, 108, 96); G.fillStyle(0xff4fa3, 0.9).fillCircle(c - 88, b - 92, 16); G.fillStyle(0x52e6ff, 0.9).fillCircle(c + 86, b - 62, 14); if (t > 1) G.fillStyle(0xc6ff3d, 0.9).fillCircle(c + 86, b - 108, 11); },
    F03(G, c, b) { box(G, c, b, 240, 130, 0x9fe8e0, 0xcdf7f2); G.lineStyle(3, 0xffffff, 0.8); for (let x = -90; x <= 90; x += 45) G.lineBetween(c + x, b - 130, c + x, b); G.fillStyle(0x3f8a1c, 1); for (let x = -90; x <= 90; x += 45) G.fillCircle(c + x, b - 26, 18); leaf(G, c, b - 70, 28, 0xc6ff3d); },
    F04(G, c, b) { box(G, c, b, 220, 120, 0xffd9a0, 0xa06a50); G.fillStyle(0x52e6ff, 1).fillRect(c - 86, b - 66, 66, 48); G.fillStyle(0x7a4a2c, 1).fillRect(c + 16, b - 74, 56, 74); for (let i = 0; i < 8; i++) G.fillStyle(i % 2 ? 0xffffff : 0xff4fa3, 1).fillRect(c - 110 + i * 27.5, b - 92, 27.5, 18); leaf(G, c, b - 118, 24, 0x3f8a1c); },
    F05(G, c, b) { box(G, c, b, 260, 130, 0x8b8fa3, 0x5a5d70); G.fillStyle(0x5a5d70, 1).fillRect(c + 54, b - 216, 40, 110); G.fillStyle(0xff8a3d, 1).fillRect(c + 54, b - 216, 40, 14); windows(G, c - 110, b - 104, 3, 2, 44, 30, 12, 0xffd84d); G.lineStyle(10, 0x52e6ff, 1).lineBetween(c - 124, b - 16, c + 124, b - 16); },
    F06(G, c, b) { box(G, c, b, 220, 110, 0xe8e4f4, 0x9a8fb8); G.fillStyle(0x52e6ff, 0.75).fillCircle(c, b - 128, 58); G.fillStyle(0xffffff, 0.6).fillCircle(c - 18, b - 148, 14); G.lineStyle(5, 0x3a3346, 1).lineBetween(c + 60, b - 110, c + 90, b - 196); G.fillStyle(0xff4fa3, 1).fillCircle(c + 90, b - 196, 9); windows(G, c - 92, b - 80, 3, 1, 44, 40, 20, 0x5a3a8c); },
    F07(G, c, b) { box(G, c - 40, b, 200, 150, 0xc0392b, 0x7a2a22); G.fillStyle(0xffffff, 1).fillRect(c - 74, b - 92, 68, 92); G.fillStyle(0xc0392b, 1).fillRect(c - 68, b - 86, 56, 86); G.lineStyle(5, 0xffffff, 1).lineBetween(c - 68, b - 86, c - 12, b); for (let i = 0; i < 2; i++) { G.fillStyle(0xcdf7f2, 0.9).fillEllipse(c + 110, b - 24 - i * 52, 110, 46); G.lineStyle(3, 0x3f8a1c, 1).strokeEllipse(c + 110, b - 24 - i * 52, 110, 46); } },
    F08(G, c, b) { box(G, c, b, 230, 180, 0x3a2666, 0x241646); G.fillStyle(0x52e6ff, 0.9).fillRect(c - 96, b - 74, 192, 62); G.fillStyle(0xffd84d, 0.9).fillRect(c - 96, b - 166, 192, 24); leaf(G, c, b - 92, 38, 0xc6ff3d); },
    F09(G, c, b) { box(G, c, b, 270, 110, 0xd98c3f, 0x8a5a2a); for (let i = 0; i < 3; i++) G.fillStyle(0x2c1a4d, 1).fillRect(c - 118 + i * 84, b - 80, 66, 80); G.fillStyle(0xb8834a, 1).fillRect(c - 170, b - 40, 40, 40); G.fillRect(c - 160, b - 78, 30, 38); G.fillStyle(0xff4fa3, 1).fillRect(c + 94, b - 34, 68, 28); G.fillStyle(0x52e6ff, 1).fillRect(c + 130, b - 30, 26, 14); },
    F10(G, c, b) { box(G, c, b, 300, 160, 0x4a6074, 0x2f3f4f); for (let i = 0; i < 5; i++) { G.fillStyle(0xc6ff3d, 0.9).fillRect(c - 130 + i * 54, b - 150, 40, 40); G.fillStyle(0x8b8fa3, 1).fillRect(c - 124 + i * 54, b - 190, 28, 24); } windows(G, c - 120, b - 84, 4, 1, 42, 54, 18, 0x52e6ff); },
    F11(G, c, b) { box(G, c, b, 300, 120, 0xb47cff, 0x7a4fc0); [0xff4fa3, 0xffd84d, 0x52e6ff].forEach((col, i) => { G.fillStyle(col, 1).fillCircle(c - 94 + i * 94, b - 138, 54); G.fillStyle(0xffffff, 0.45).fillCircle(c - 110 + i * 94, b - 156, 12); }); G.fillStyle(0xc6ff3d, 1).fillRect(c - 150, b - 22, 300, 22); },
    F12(G, c, b) { box(G, c, b, 190, 300, 0x241646, 0x140a24); windows(G, c - 76, b - 280, 4, 7, 26, 26, 12, 0xffd84d); G.fillStyle(0xff4fa3, 1).fillRect(c - 96, b - 40, 192, 40); leaf(G, c, b - 330, 46, 0xffd84d); },
  };
  function drawBuilding(G, fid, tier) {
    const c = BOX_W / 2 - 12, b = BOX_H - 20;
    G.fillStyle(0x000000, 0.18).fillEllipse(c + 18, b - 2, 330, 56);
    G.fillStyle(mix(0xb6a78e, 0xffffff, tier * 0.12), 1).fillRoundedRect(c - 165, b - 34, 330, 52, 14);
    SHAPE[fid](G, c, b, tier);
    if (tier >= 1) {            // R1: painted trim and flower boxes
      G.fillStyle(0xff4fa3, 1).fillCircle(c - 150, b - 6, 12).fillCircle(c + 150, b - 6, 12);
      G.fillStyle(0xc6ff3d, 1).fillCircle(c - 128, b + 6, 10).fillCircle(c + 128, b + 6, 10);
    }
    if (tier >= 2) {            // R2: a flag
      G.lineStyle(5, 0x2c1a4d, 1).lineBetween(c - 160, b - 8, c - 160, b - 100);
      G.fillStyle(0xc6ff3d, 1).fillTriangle(c - 158, b - 100, c - 104, b - 84, c - 158, b - 68);
    }
    if (tier >= 3) {            // R3: gold lights and a glow
      G.fillStyle(0xffd84d, 1);
      for (let x = -150; x <= 150; x += 50) G.fillCircle(c + x, b + 14, 6);
      G.lineStyle(4, 0xffd84d, 0.9).strokeRoundedRect(c - 168, b - 36, 336, 56, 14);
      G.fillStyle(0xffd84d, 0.9).fillTriangle(c + 150, b - 112, c + 136, b - 86, c + 164, b - 86);
    }
  }
  function drawLot(G, forSale) {
    const c = BOX_W / 2 - 12, b = BOX_H - 20;
    G.fillStyle(0x000000, 0.14).fillEllipse(c, b - 40, 320, 120);
    G.fillStyle(0xa98a5e, 1).fillEllipse(c, b - 46, 300, 110);
    G.fillStyle(0x8f744e, 1).fillEllipse(c - 60, b - 40, 70, 22).fillEllipse(c + 70, b - 58, 60, 18);
    G.lineStyle(5, 0xe8def8, 1);
    for (let i = -6; i <= 6; i++) { const x = c + i * 25; G.lineBetween(x, b - 4 - Math.abs(i) * 6, x, b - 36 - Math.abs(i) * 6); }
    G.lineBetween(c - 150, b - 22 - 36, c, b - 20).lineBetween(c, b - 20, c + 150, b - 22 - 36);
    G.fillStyle(0x7a4a2c, 1).fillRect(c - 7, b - 150, 14, 90);
    G.fillStyle(forSale ? 0xc6ff3d : 0xe8def8, 1).fillRoundedRect(c - 66, b - 190, 132, 62, 8);
    G.lineStyle(4, 0x2c1a4d, 1).strokeRoundedRect(c - 66, b - 190, 132, 62, 8);
    if (!forSale) {   // a padlock
      G.lineStyle(6, 0x8b8fa3, 1).strokeCircle(c, b - 170, 12);
      G.fillStyle(0xffd84d, 1).fillRoundedRect(c - 16, b - 168, 32, 26, 5);
    }
  }

  // ---- Real art, once it's imported -------------------------------------------------------------------
  const MapArt = {
    entry: (id) => PE.Data.assetRegistry.entries.find((e) => e.id === id),
    url(id) { const e = this.entry(id); return e && e.status === 'imported' && e.gamePath ? e.gamePath.replace(/^game\//, '') : null; },
    // Calls back with a texture key when the real picture is ready. Does nothing while it's still a stand-in.
    load(scene, id, onReady) {
      const url = this.url(id);
      if (!url) return false;
      const key = 'art-' + id;
      if (scene.textures.exists(key)) { onReady(key); return true; }
      const img = new Image();
      img.onload = () => {
        if (scene.sys.settings.status >= Phaser.Scenes.SHUTDOWN) return;
        if (!scene.textures.exists(key)) scene.textures.addImage(key, img);
        onReady(key);
      };
      img.src = url;
      return true;
    },
  };
  PE.MapArt = MapArt;

  // ---- The scene -------------------------------------------------------------------------------------
  class EmpireMap extends Phaser.Scene {
    constructor() { super('empire'); }

    init(params) {
      this.g = PE.App.g;
      if (params.district) this.g.map.setCurrent(params.district);
      this.district = this.g.map.current();
    }

    create() {
      this.layout = this.g.map.layout(this.district);
      this.def = this.g.map.districts().find((d) => d.id === this.district);
      this.views = new Map();
      this.lastRefresh = 0;
      this.cameras.main.setBackgroundColor(this.layout.look.sky);
      this.drawGround();
      this.buildBuildings();
      PE.UI.loadIcons(this, ['STA-03', 'STA-06', 'STA-02', 'CUR-01'], () => { this.bubbleArtReady = true; this.refresh(); });
      this.setUpCamera();
      this.setUpInput();
      if (this.setUpLife) this.setUpLife();
      this.refresh();
      this.ready = true;
      this.unsub = this.g.on((type, e) => this.onGameEvent(type, e));
      this.events.once('shutdown', () => {
        this.ready = false;
        this.unsub();
        if (this.lifeShutdown) this.lifeShutdown();
      });
    }

    // ---- Ground: painted once from the district's layout file (js/ui/empire_map_ground.js). ----
    drawGround() { PE.MapGround.bake(this, this.layout); }

    // ---- Buildings ---------------------------------------------------------------------------------------
    standInKey(fid, tier) {
      const key = `map-bld-${fid}-${tier}`;
      if (!this.textures.exists(key)) {
        const G = this.make.graphics({ x: 0, y: 0, add: false });
        drawBuilding(G, fid, tier);
        G.generateTexture(key, BOX_W, BOX_H);
        G.destroy();
      }
      return key;
    }
    lotKey(forSale) {
      const key = forSale ? 'map-lot-sale' : 'map-lot-locked';
      if (!this.textures.exists(key)) {
        const G = this.make.graphics({ x: 0, y: 0, add: false });
        drawLot(G, forSale);
        G.generateTexture(key, BOX_W, BOX_H);
        G.destroy();
      }
      return key;
    }
    buildBuildings() {
      for (const fid of this.def.facilities) {
        const s = this.layout.spots[fid];
        const image = this.add.image(s.x, s.y + 20, this.lotKey(false)).setOrigin((BOX_W / 2 - 12) / BOX_W, 1).setDepth(s.y);
        const name = this.add.text(s.x, s.y + 28, this.g.facilities.row(fid).name, {
          fontFamily: FONT, fontStyle: 'bold', fontSize: '26px', color: '#ffffff', stroke: '#1d0f33', strokeThickness: 6,
        }).setOrigin(0.5, 0).setDepth(s.y + 1);
        const sign = this.add.text(s.x, s.y - 148, '', {
          fontFamily: FONT, fontStyle: 'bold', fontSize: '22px', color: '#1d0f33', align: 'center',
        }).setOrigin(0.5).setDepth(s.y + 1);
        const bubble = this.makeBubble(s.x, s.y - 230, s.y + 2);
        this.views.set(fid, { fid, s, image, name, sign, bubble, shown: null });
      }
    }
    makeBubble(x, y, depth) {
      const c = this.add.container(x, y).setDepth(depth + 60000);
      const bg = this.add.graphics();
      const label = this.add.text(0, -1, '', { fontFamily: FONT, fontStyle: '900', fontSize: '22px', color: '#ffffff' }).setOrigin(0.5);
      const pic = this.add.image(0, 0, '__WHITE').setVisible(false);
      c.add([bg, pic, label]);
      c.setVisible(false);
      return { c, bg, label, pic, sig: null };
    }
    // Only redrawn when it changes, so most frames cost nothing.
    drawBubble(b, st) {
      const busyText = st.kind === 'busy' ? PE.Dom.duration(Math.max(0, st.endsMs - this.g.now()) / 1000) : '';
      const sig = st.kind + busyText;
      if (sig === b.sig && b.hadArt === this.bubbleArtReady) return;
      b.sig = sig;
      b.hadArt = this.bubbleArtReady;
      // The real status art (STA-03 alert, STA-06 done, STA-02 timer, CUR-01 cash), once it has loaded.
      const artId = { ready: 'STA-03', idle: 'STA-03', done: 'STA-06', buy: 'CUR-01', busy: 'STA-02' }[st.kind];
      const key = 'ui-' + artId;
      if (artId && this.textures.exists(key)) {
        const size = st.kind === 'busy' ? 26 : st.kind === 'ready' ? 50 : 44;
        b.pic.setTexture(key).setDisplaySize(size, size).setVisible(true);
        b.bg.clear();
        if (st.kind === 'busy') {
          b.label.setText(busyText).setFontSize(14).setStyle({ stroke: '#1d0f33', strokeThickness: 3 });
          const w = b.label.width + 40;
          b.bg.fillStyle(0x1d0f33, 0.92).fillRoundedRect(-w / 2, -16, w, 32, 15);
          b.bg.lineStyle(2, 0xffffff, 0.9).strokeRoundedRect(-w / 2, -16, w, 32, 15);
          b.pic.setPosition(-w / 2 + 15, 0);
          b.label.setPosition(14, -1);
        } else {
          b.pic.setPosition(0, 0);
          b.label.setText('');
        }
        return;
      }
      const texts = { ready: '!', idle: '!', done: 'ok', buy: '$', busy: busyText };
      const text = texts[st.kind] || '';
      const colour = { ready: 0xff2d55, idle: 0xff8a3d, done: 0x2fbf5b, buy: 0x2fbf5b, busy: 0x2c1a4d }[st.kind];
      b.label.setText(text).setFontSize(st.kind === 'busy' ? 14 : 22);
      const hw = st.kind === 'busy' ? Math.max(22, b.label.width / 2 + 9) : 18;
      b.bg.clear();
      b.bg.fillStyle(0x000000, 0.3).fillRoundedRect(-hw, -16, hw * 2, 38, 17);
      b.bg.fillStyle(colour, 1).fillRoundedRect(-hw, -18, hw * 2, 36, 17);
      b.bg.lineStyle(2, 0xffffff, 1).strokeRoundedRect(-hw, -18, hw * 2, 36, 17);
      b.bg.fillStyle(colour, 1).fillTriangle(-6, 17, 6, 17, 0, 26);
    }

    update(time) {
      if (!this.ready) return;
      if (this.updateLife) this.updateLife(time);
      if (time - this.lastRefresh < 250) return;
      this.lastRefresh = time;
      this.refresh();
    }

    refresh() {
      const g = this.g;
      const k = PE.App.dpr / this.cameras.main.zoom;  // bubbles stay the same size on screen at any zoom
      for (const v of this.views.values()) {
        const st = g.map.status(v.fid);
        v.status = st;
        const own = g.facilities.isOwned(v.fid);
        const row = g.facilities.row(v.fid);
        const open = g.facilities.isAvailable(v.fid);
        const tier = own ? g.facilities.get(v.fid).renovation : -1;
        const shown = own ? `b${tier}` : open ? 'sale' : 'lot';
        if (v.shown !== shown) {
          v.shown = shown;
          this.showLook(v, own, open, tier);
        }
        if (own) v.sign.setText('');
        else v.sign.setText(open ? `FOR SALE\n$${PE.Money.format(g.facilities.econ(v.fid).cost)}` : `Level ${row.playerLevel}`);
        const showBubble = st.kind !== 'none';
        v.bubble.c.setVisible(showBubble);
        if (showBubble) { this.drawBubble(v.bubble, st); v.bubble.c.setScale(k); }
      }
      if (this.refreshLife) this.refreshLife();
    }
    showLook(v, own, open, tier) {
      const id = !own ? PE.Data.map.lockedLotArt : `BLD-${v.fid}-${PE.Data.map.lookForRenovation[Math.min(3, tier)]}`;
      v.artId = id;
      v.image.setTexture(own ? this.standInKey(v.fid, Math.min(3, tier)) : this.lotKey(open));
      v.image.setOrigin((BOX_W / 2 - 12) / BOX_W, 1).setScale(1);
      MapArt.load(this, id, (key) => {
        if (v.artId !== id) return;
        v.image.setTexture(key).setOrigin(0.5, 0.92).setDisplaySize(BOX_W, BOX_W);
      });
    }

    // ---- Camera -------------------------------------------------------------------------------------------
    zoomLimits() {
      const W = this.scale.width;
      return { min: W / this.layout.w, max: W / 440, start: W / 860 };
    }
    setUpCamera() {
      const cam = this.cameras.main;
      const lim = this.zoomLimits();
      const saved = this.g.map.savedView(this.district);
      if (saved) {
        cam.setZoom(clamp(saved.zoom, lim.min, lim.max));
        cam.centerOn(saved.x, saved.y);
      } else {
        cam.setZoom(lim.start);
        // First visit: show the newest building here, or the first one on the way up.
        const owned = this.def.facilities.filter((f) => this.g.facilities.isOwned(f));
        const focus = this.layout.spots[owned.length ? owned[owned.length - 1] : this.def.facilities[0]];
        cam.centerOn(focus.x, focus.y - 80);
      }
      cam.preRender();
      this.clampCamera(0);
    }
    // give = how far past the edge the map may go. While dragging there's a little give, so the edge
    // feels soft; on letting go it springs back.
    clampCamera(give = OVERSCROLL) {
      const cam = this.cameras.main;
      const { w, h } = this.layout;
      const vw = cam.width / cam.zoom, vh = cam.height / cam.zoom;
      const extra = 90 * PE.App.dpr / cam.zoom;  // the top bar and tabs cover some of the screen
      const range = (lo, hi, v) => (lo > hi ? (lo + hi) / 2 : clamp(v, lo - give, hi + give));
      const mid = cam.midPoint;
      cam.centerOn(range(vw / 2, w - vw / 2, mid.x), range(vh / 2 - extra, h - vh / 2 + extra, mid.y));
      cam.preRender();
      // Remembered as it moves: when the scene closes, its camera has already gone.
      this.rememberView();
    }
    springBack() {
      const cam = this.cameras.main;
      const x0 = cam.scrollX, y0 = cam.scrollY;
      this.clampCamera(0);
      const x1 = cam.scrollX, y1 = cam.scrollY;
      if ((x0 === x1 && y0 === y1) || this.calm()) return;
      cam.scrollX = x0; cam.scrollY = y0;
      this.tweens.add({ targets: cam, scrollX: x1, scrollY: y1, duration: 180, ease: 'Sine.easeOut' });
    }
    rememberView() {
      const cam = this.cameras.main;
      if (!cam) return;
      this.g.map.saveView(this.district, { zoom: Math.round(cam.zoom * 1000) / 1000, x: Math.round(cam.midPoint.x), y: Math.round(cam.midPoint.y) });
    }
    calm() { return PE.App.state.settings.reducedMotion || (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches); }
    setZoomAround(zoom, sx, sy) {
      const cam = this.cameras.main;
      const lim = this.zoomLimits();
      const before = cam.getWorldPoint(sx, sy);
      cam.setZoom(clamp(zoom, lim.min, lim.max));
      cam.preRender();
      const after = cam.getWorldPoint(sx, sy);
      cam.scrollX += before.x - after.x;
      cam.scrollY += before.y - after.y;
      cam.preRender();
      this.clampCamera(0);
      this.refresh();
    }

    // ---- Touch ---------------------------------------------------------------------------------------------
    setUpInput() {
      const input = this.input;
      input.addPointer(2);
      const moved = 12 * PE.App.dpr;
      let drag = null, pinch = null;
      const onCanvas = (p) => !p.event || p.event.target === this.game.canvas;
      const menuOpen = () => !!PE.Dom.panelRoute || !!PE.Dom.modalNow;
      input.on('pointerdown', (p) => {
        if (!onCanvas(p) || menuOpen()) { drag = null; return; }
        this.tweens.killTweensOf(this.cameras.main);
        const a = input.pointer1, b = input.pointer2;
        if (a.isDown && b.isDown) {
          pinch = { dist: Phaser.Math.Distance.Between(a.x, a.y, b.x, b.y), zoom: this.cameras.main.zoom };
          drag = null;
        } else drag = { id: p.id, sx: p.x, sy: p.y, lastX: p.x, lastY: p.y, moved: false };
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
        if (pinch) { if (!input.pointer1.isDown && !input.pointer2.isDown) pinch = null; drag = null; this.springBack(); return; }
        if (drag && p.id === drag.id) {
          if (!drag.moved) this.tapAt(p.x, p.y);
          else this.springBack();
        }
        drag = null;
      });
      input.on('wheel', (p, over, dx, dy) => this.setZoomAround(this.cameras.main.zoom * (dy > 0 ? 0.9 : 1.1), p.x, p.y));
    }
    tapAt(sx, sy) {
      const pt = this.cameras.main.getWorldPoint(sx, sy);
      const k = PE.App.dpr / this.cameras.main.zoom;
      if (this.tapLife && this.tapLife(pt.x, pt.y, k)) return;
      // Bubbles first: they sit on top, and "ready" ones collect.
      for (const v of this.views.values()) {
        if (!v.bubble.c.visible) continue;
        if (Math.abs(pt.x - v.bubble.c.x) < 34 * k && Math.abs(pt.y - v.bubble.c.y) < 34 * k) {
          if (v.status.kind === 'ready') this.collectAt(v);
          else this.openBuilding(v.fid);
          return;
        }
      }
      // Nearest building front wins where two overlap.
      const hits = [...this.views.values()].filter((v) => Math.abs(pt.x - v.s.x) < 175 && pt.y < v.s.y + 70 && pt.y > v.s.y - 330).sort((a, b) => b.s.y - a.s.y);
      if (hits.length) this.openBuilding(hits[0].fid);
    }
    collectAt(v) {
      const r = this.g.map.collect(v.fid);
      if (r.ok) {
        PE.App.saveGame();
        this.floatText(v.s.x, v.s.y - 260, r.cash ? `+$${PE.Money.format(Math.floor(r.cash))}` : `+${r.count} collected`);
      }
      this.refresh();
    }
    floatText(x, y, label) {
      const k = PE.App.dpr / this.cameras.main.zoom;
      const t = this.add.text(x, y, label, { fontFamily: FONT, fontStyle: 'bold', fontSize: '18px', color: '#c6ff3d', stroke: '#1d0f33', strokeThickness: 4 }).setOrigin(0.5).setDepth(90000).setScale(k);
      this.tweens.add({ targets: t, y: this.calm() ? y : y - 70 * k, alpha: 0, duration: 1100, ease: 'Sine.easeOut', onComplete: () => t.destroy() });
    }
    openBuilding(fid) {
      this.rememberView();
      if (this.g.facilities.isOwned(fid)) PE.App.goToRoom(fid);
      else PE.App.openPanel('lotInfo', { fid });
    }
    onGameEvent(type) {
      if (type === 'changed' && this.ready) this.needRefresh = true;
    }

    // Where a map point is on screen, in page points. Used by the automatic browser test to really tap it.
    worldToPage(wx, wy) {
      const cam = this.cameras.main;
      const r = this.game.canvas.getBoundingClientRect();
      const sx = (wx - cam.midPoint.x) * cam.zoom + cam.width / 2;
      const sy = (wy - cam.midPoint.y) * cam.zoom + cam.height / 2;
      return { x: r.left + (sx * r.width) / this.scale.width, y: r.top + (sy * r.height) / this.scale.height };
    }
    buildingPagePoint(fid) { const s = this.layout.spots[fid]; return this.worldToPage(s.x, s.y - 60); }
    bubblePagePoint(fid) { const b = this.views.get(fid).bubble.c; return this.worldToPage(b.x, b.y); }
  }

  PE.Screens.empire = EmpireMap;
  PE.EmpireMapScene = EmpireMap;

  // ---- Bars on the map ------------------------------------------------------------------------------------
  // The switcher and the round side buttons. Filled in by PE.Hud.refresh through this function.
  PE.MapBar = {
    html() {
      const g = PE.App.g;
      const here = g.map.districts().find((d) => d.id === g.map.current());
      const waiting = g.map.districts().some((d) => d.id !== here.id && g.map.isUnlocked(d.id) && g.map.needsYou(d.id));
      const side = (PE.MapMenu || []).map((m) => `<button class="map-side-btn" data-act="menu:${m.id}" aria-label="${m.label}"><span>${PE.Dom.icon(m.icon, 34)}</span><small>${m.label}</small>${m.dot && m.dot() ? PE.Dom.icon('STA-03', 22, 'side-alert') : ''}</button>`).join('');
      return `<div class="map-side">${side}</div>
        <button class="btn map-switch" data-act="districts">${PE.Dom.icon('NAV-01', 26)}${PE.Dom.esc(here.name)}${PE.Dom.icon('SYS-03', 14, 'down')}${waiting ? PE.Dom.icon('STA-03', 20) : ''}</button>
        <button class="btn plain map-list" data-act="mapList">${PE.Dom.icon('SYS-05', 22)}List</button>`;
    },
  };
  PE.Hud.actions.districts = () => PE.App.openPanel('districts', {});
  PE.Hud.actions.mapList = () => PE.App.openPanel('empireList', {});
  PE.Hud.actions.menu = (id) => PE.App.router.go(id, {});
})(globalThis.PE = globalThis.PE || {});
