// The Empire map scene: one big outdoor district you drag around and pinch to zoom. It only draws and
// passes taps along; the rules are in js/logic/empire_map.js and the layout in data/map.js.
//
// The ground is Aaron's painting (js/ui/empire_map_ground.js), and everything on it is real art, by file name, from
// the asset registry (npm run mapart). Only the signs on locked plots are still drawn here.
(function (PE) {
  // Job 20: the word on a building's bubble when something there needs you.
  const BUBBLE_WORDS = {
    Grow: { ready: 'Ripe!', idle: 'Plant!' }, Retail: { idle: 'Stock!' }, Factory: { ready: 'Batch!', idle: 'Start!' },
    Logistics: { ready: 'Van back!', idle: 'Load a van' }, Research: { idle: 'Research!' }, Prestige: { idle: 'Prestige!' },
  };
  const FONT = 'system-ui, sans-serif';
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

  // A locked or for-sale plot: the plot itself is painted, so this is only the sign that stands on it.
  const BOX_W = 360, BOX_H = 420;
  // The sign's board, in the sign picture: 132 x 62, its middle 179 pixels up from the picture's foot (job 22B: the price
  // is placed from these, so it sits in the middle of the board whatever the board does).
  const BOARD = { w: 132, h: 62, up: 179 };
  function drawLot(G, forSale) {
    const c = BOX_W / 2 - 12, b = BOX_H - 20;
    G.fillStyle(0x000000, 0.18).fillEllipse(c, b - 58, 60, 14);
    G.fillStyle(0x7a4a2c, 1).fillRect(c - 7, b - 150, 14, 92);
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
    load(scene, id, onReady, onFail) {
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
      // A busy server now and then says no: try twice more before giving up on the picture.
      let tries = 0;
      img.onerror = () => {
        if (scene.sys.settings.status >= Phaser.Scenes.SHUTDOWN) return;
        if (++tries <= 2) { setTimeout(() => { img.src = `${url}?retry=${tries}`; }, 900 * tries); return; }
        if (onFail) onFail();
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
      this.freeOtherDistrictArt();
      this.buildBuildings();
      this.buildFeatures();
      PE.UI.loadIcons(this, ['STA-03', 'STA-06', 'STA-02', 'CUR-01'], () => { this.bubbleArtReady = true; this.refresh(); });
      this.setUpCamera();
      this.setUpInput();
      if (this.setUpLife) this.setUpLife();
      this.refresh();
      this.ready = true;
      PE.Sound.setOnMap(true);
      if (!this.calm()) this.cameras.main.fadeIn(170, 29, 15, 51);
      this.events.on('sleep', () => { PE.Sound.setOnMap(false); PE.EdgeArrows.clear(); });
      this.events.on('wake', () => PE.Sound.setOnMap(true));
      this.unsub = this.g.on((type, e) => this.onGameEvent(type, e));
      this.events.once('shutdown', () => {
        this.ready = false;
        PE.Sound.setOnMap(false);
        PE.EdgeArrows.clear();
        this.events.off('sleep');
        this.events.off('wake');
        this.unsub();
        if (this.lifeShutdown) this.lifeShutdown();
      });
    }

    // ---- Ground: Aaron's painting (js/ui/empire_map_ground.js). ----
    drawGround() {
      const f = this.g.meta.festivalNow();
      this.eventSig = f.active ? f.theme : '';
      this.ground = PE.MapGround.show(this, this.layout, f.active ? this.g.meta.eventNamed(f.theme) : null);
    }

    // ---- Buildings ---------------------------------------------------------------------------------------
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
    // Building pictures are big. Only this district's are kept in memory.
    freeOtherDistrictArt() {
      const mine = [...this.def.facilities, ...Object.keys(this.layout.features || {})];
      const rivals = this.layout.rivalSpots.map((s) => 'RBL-' + s.rival.split('-')[1]);
      for (const k of this.textures.getTextureKeys()) {
        if (k.startsWith('art-BLD-') && !mine.some((id) => k.startsWith(`art-BLD-${id}-`))) this.textures.remove(k);
        if (k.startsWith('art-RBL-') && !rivals.includes(k.slice(4))) this.textures.remove(k);
      }
    }
    // Fits a building's real picture to its space, standing on its spot, and puts the bubble over its roof.
    fitArt(v, key) {
      if (!v.image.scene) return;   // that screen has gone: the picture arrived too late
      const src = this.textures.get(key).getSourceImage();
      const k = Math.min(v.s.w / src.width, (v.s.w * 1.5) / src.height);
      v.image.setTexture(key).setOrigin(0.5, 1).setPosition(v.s.x, v.s.y).setDisplaySize(src.width * k, src.height * k).setVisible(true);
      v.artTop = src.height * k;
      v.artW = src.width * k;
      v.bubble.c.y = v.s.y - v.artTop + 6;
      if (this.onBuildingArt) this.onBuildingArt(v);
    }
    buildFeatures() {
      for (const f of this.g.map.featuresIn(this.district)) {
        const s = this.layout.features[f.id];
        const image = this.add.image(s.x, s.y, this.lotKey(false)).setDepth(s.y).setVisible(false);
        const name = this.add.text(s.x, s.y + 6, f.name, { fontFamily: FONT, fontStyle: 'bold', fontSize: '19px', color: '#ffe9a0', stroke: '#1d0f33', strokeThickness: 5 }).setOrigin(0.5, 0).setDepth(s.y + 1);
        const sign = this.add.text(s.x, s.y, '', { fontSize: '1px' }).setVisible(false);
        const bubble = this.makeBubble(s.x, s.y - s.w * 0.7, s.y + 2);
        this.views.set(f.id, { fid: f.id, s, image, name, sign, bubble, shown: null, feature: f });
      }
    }
    buildBuildings() {
      for (const fid of this.def.facilities) {
        const s = this.layout.spots[fid];
        if (!s.w) s.w = 300;    // a layout with no painted plots yet
        const image = this.add.image(s.x, s.y + 20, this.lotKey(false)).setOrigin((BOX_W / 2 - 12) / BOX_W, 1).setDepth(s.y);
        const name = this.add.text(s.x, s.y + 6, this.g.facilities.row(fid).name, {
          fontFamily: FONT, fontStyle: 'bold', fontSize: '20px', color: '#ffffff', stroke: '#1d0f33', strokeThickness: 5,
        }).setOrigin(0.5, 0).setDepth(s.y + 1);
        const sign = this.add.text(s.x, s.y - 138, '', {
          fontFamily: FONT, fontStyle: '900', fontSize: '24px', color: '#1d0f33', align: 'center', lineSpacing: -3,
        }).setOrigin(0.5).setDepth(s.y + 1).setResolution(2);
        const bubble = this.makeBubble(s.x, s.y - 220, s.y + 2);
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
      const busyText = st.kind === 'busy' ? PE.Dom.duration(Math.max(0, st.endsMs - this.g.now()) / 1000) : (st.word || '');
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
        if (st.kind === 'busy' || busyText) {
          // Job 20: a word beside the alert says what's waiting (Ripe!, Batch!, Van back!), so you can see where to go.
          b.label.setText(busyText).setFontSize(st.kind === 'busy' ? 14 : 17).setStyle({ stroke: '#1d0f33', strokeThickness: 3 });
          if (st.kind !== 'busy') b.pic.setDisplaySize(30, 30);
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
      this.placeNames();
      if (time - (this.lastSharp || 0) > 120) { this.lastSharp = time; PE.MapGround.keepSharp(this, this.ground); }
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
        if (v.feature) {
          const stage = g.map.featureStage(v.fid);
          if (v.shown !== stage) {
            v.shown = stage;
            const id = `BLD-${v.fid}-${stage}`;
            v.artId = id;
            MapArt.load(this, id, (key) => { if (v.artId === id) this.fitArt(v, key); }, () => { if (v.image.scene) v.image.setVisible(true); });
          }
          v.bubble.c.setVisible(st.kind !== 'none');
          if (st.kind !== 'none') { this.drawBubble(v.bubble, st); v.bubble.c.setScale(k); }
          continue;
        }
        const own = g.facilities.isOwned(v.fid);
        const row = g.facilities.row(v.fid);
        const open = g.facilities.isAvailable(v.fid);
        const tier = own ? g.facilities.get(v.fid).renovation : -1;
        const shown = own ? `b${tier}` : open ? 'sale' : 'lot';
        if (v.shown !== shown) {
          v.shown = shown;
          this.showLook(v, own, open, tier);
        }
        this.showStickers(v, own);
        this.placeSign(v, own, open, row);
        const showBubble = st.kind !== 'none';
        if (own && (st.kind === 'ready' || st.kind === 'idle')) st.word = (BUBBLE_WORDS[row.mode] || {})[st.kind] || '';
        v.bubble.c.setVisible(showBubble);
        if (showBubble) { this.drawBubble(v.bubble, st); v.bubble.c.setScale(k); }
      }
      if (this.refreshLife) this.refreshLife();
      // Something off the side of the screen needs you: a red arrow points to it.
      const seen = this.cameras.main.worldView;
      PE.EdgeArrows.update(this, [...this.views.values()].filter((v) => (v.status.kind === 'ready' || v.status.kind === 'done') && (v.s.x < seen.x || v.s.x > seen.right || v.s.y - 90 < seen.y || v.s.y - 90 > seen.bottom)).map((v) => ({ id: v.fid, x: v.s.x, y: v.s.y - 90, tap: () => { this.cameras.main.centerOn(v.s.x, v.s.y - 110); this.cameras.main.preRender(); this.clampCamera(0); } })));
      // An event started or ended while the map's open: redraw it with the new look.
      const f = g.meta.festivalNow();
      if ((f.active ? f.theme : '') !== this.eventSig) this.scene.restart();
    }
    // The brand stickers a shop or factory has on (two at most), stuck small on the front of its building.
    showStickers(v, own) {
      const ids = own ? (this.g.state.collections.stickersByBusiness[v.fid] || []).filter((id) => PE.Data.itemArt && PE.Data.itemArt[id]) : [];
      const sig = ids.join(',') + '|' + Math.round(v.artTop || 0);
      if (sig === v.stickerSig) return;
      v.stickerSig = sig;
      for (const im of v.stickers || []) im.destroy();
      v.stickers = [];
      if (!ids.length) return;
      PE.UI.loadIcons(this, ids, () => {
        if (v.stickerSig !== sig || !v.image.scene) return;
        const top = v.artTop || 220, w = v.artW || v.s.w;
        const size = Math.max(34, w * 0.15);
        ids.forEach((id, i) => {
          const key = 'ui-' + id;
          if (!this.textures.exists(key)) return;
          const src = this.textures.get(key).getSourceImage();
          const k = size / Math.max(src.width, src.height);
          const im = this.add.image(v.s.x + w * 0.3 - i * size * 1.1, v.s.y - top * 0.24, key)
            .setScale(k).setAngle(i ? -9 : 7).setDepth(v.s.y + 0.5);
          im.stickerId = id;
          v.stickers.push(im);
        });
      });
    }
    // Job 22B: the words on a plot's sign. A for-sale price sits in the middle of the board, shrunk to fit inside it (the
    // short money form, 1.2K, 3.4M...), and moves and scales with the sign. The sign is drawn over the vans and trees.
    placeSign(v, own, open, row) {
      const text = own ? '' : open ? `FOR SALE\n$${PE.Money.format(this.g.facilities.econ(v.fid).cost)}` : `Level ${row.playerLevel}`;
      if (v.sign.text !== text) v.sign.setText(text);
      if (own) return;
      const k = v.image.scaleY || 1;
      const foot = v.image.y;
      // A locked plot's padlock fills the board's top, so its level goes along the bottom of the board.
      const cy = open ? foot - BOARD.up * k : foot - (BOARD.up - 21) * k;
      const room = open ? { w: (BOARD.w - 14) * k, h: (BOARD.h - 8) * k } : { w: (BOARD.w - 14) * k, h: 20 * k };
      const fit = Math.min(1, room.w / Math.max(1, v.sign.width), room.h / Math.max(1, v.sign.height));
      v.sign.setPosition(v.image.x, cy).setScale(fit);
      v.sign.setDepth(50000 + v.s.y + 2);
    }
    showLook(v, own, open, tier) {
      const id = !own ? PE.Data.map.lockedLotArt : `BLD-${v.fid}-${PE.Data.map.lookForRenovation[Math.min(3, tier)]}`;
      v.artId = id;
      v.image.setTexture(this.lotKey(open)).setOrigin((BOX_W / 2 - 12) / BOX_W, 1).setPosition(v.s.x, v.s.y + 20).setScale(1);
      // A plot's sign stands over the traffic and the trees (job 22B); a building goes back to its own depth.
      v.image.setDepth(own ? v.s.y : 50000 + v.s.y + 1);
      v.bubble.c.y = v.s.y - 220;
      v.artTop = 0;
      // A building stays hidden while its picture comes, so it never flashes up as a sign.
      const waiting = own && MapArt.load(this, id, (key) => {
        if (v.artId !== id) return;
        this.fitArt(v, key);
      }, () => { if (v.image.scene) v.image.setVisible(true); });
      v.image.setVisible(!waiting || (this.textures.exists('art-' + id)));
    }

    // ---- Camera -------------------------------------------------------------------------------------------
    zoomLimits() {
      const W = this.scale.width, H = this.scale.height;
      // Zoomed right out, the painting still fills the screen: nothing past its edges ever shows.
      const min = Math.max(W / this.layout.w, H / this.layout.h);
      return { min, max: Math.max(W / 360, min), start: Math.max(W / 600, min) };
    }
    setUpCamera() {
      const cam = this.cameras.main;
      const lim = this.zoomLimits();
      const saved = this.g.map.savedView(this.district);
      // Views saved before the painted maps were on a differently sized map: start those afresh.
      if (saved && saved.painted) {
        cam.setZoom(clamp(saved.zoom, lim.min, lim.max));
        cam.centerOn(saved.x, saved.y);
      } else {
        cam.setZoom(lim.start);
        // First visit: show the newest building here, or the first one on the way up.
        const owned = this.def.facilities.filter((f) => this.g.facilities.isOwned(f));
        const focus = this.layout.spots[owned.length ? owned[owned.length - 1] : this.def.facilities[0]];
        cam.centerOn(focus.x, focus.y - 110);
      }
      cam.preRender();
      this.clampCamera(0);
    }
    // The camera never pans past the painting's edges.
    clampCamera() {
      const cam = this.cameras.main;
      const { w, h } = this.layout;
      const vw = cam.width / cam.zoom, vh = cam.height / cam.zoom;
      const range = (lo, hi, v) => (lo > hi ? (lo + hi) / 2 : clamp(v, lo, hi));
      const mid = cam.midPoint;
      cam.centerOn(range(vw / 2, w - vw / 2, mid.x), range(vh / 2, h - vh / 2, mid.y));
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
      this.g.map.saveView(this.district, { zoom: Math.round(cam.zoom * 1000) / 1000, x: Math.round(cam.midPoint.x), y: Math.round(cam.midPoint.y), painted: true });
    }
    calm() { return PE.App.calm(); }
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
      const hits = [...this.views.values()].filter((v) => Math.abs(pt.x - v.s.x) < Math.max(v.s.w / 2, 70) && pt.y < v.s.y + 46 && pt.y > v.s.y - Math.max(v.artTop || 0, 170)).sort((a, b) => b.s.y - a.s.y);
      if (hits.length) { this.openBuilding(hits[0].fid); return; }
      if (this.tapLot) this.tapLot(pt.x, pt.y);
    }
    collectAt(v) {
      const r = this.g.map.collect(v.fid);
      if (r.ok) {
        PE.App.saveGame();
        this.floatText(v.s.x, v.bubble.c.y - 30, r.cash ? `+$${PE.Money.format(Math.floor(r.cash))}` : `+${r.count} collected`);
        if (r.cash) { const p = this.worldToPage(v.s.x, v.bubble.c.y); PE.Juice.coins(p.x, p.y, 6); this.cashPop(v.s.x, v.bubble.c.y); }
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
      const feature = this.g.map.featureRow(fid);
      if (feature) PE.App.openPanel(feature.route, {});
      else if (this.g.facilities.isOwned(fid)) this.peekThenGo(fid);
      else {
        if (!this.g.facilities.isAvailable(fid)) this.g.emit('lockedTap', { fid });
        PE.App.openPanel('lotInfo', { fid });
      }
    }
    // Tap a grow building, shop or factory: its roof lifts for a moment, showing its PEEK-Fnn-n picture, then you're inside.
    // Reduced motion, or a picture that can't be fetched, goes straight in.
    peekThenGo(fid) {
      const v = this.views.get(fid);
      const mode = this.g.facilities.row(fid).mode;
      if (this.peeking) return;
      // Job 20: a short zoom in on the building on the way in (not with reduced motion).
      // Every place is walked into since job 25 (the lab and HQ too).
      const walkIn = ['Grow', 'Retail', 'Factory', 'Logistics', 'Research', 'Prestige'].includes(mode);
      if (!walkIn) { PE.App.goToRoom(fid); return; }
      if (v && !this.calm()) {
        const cam = this.cameras.main;
        cam.pan(v.s.x, v.s.y - 90, 380, 'Sine.easeInOut');
        cam.zoomTo(Math.min(cam.zoom * 1.35, (this.zoomLimits ? this.zoomLimits().max : cam.zoom * 1.35)), 380, 'Sine.easeInOut');
        this.zoomedIn = (this.zoomedIn || 0) + 1;
      }
      if (!['Grow', 'Retail', 'Factory'].includes(mode) || !v || this.calm() || !v.image.visible || !v.artTop) {
        if (!v || this.calm()) { PE.App.goToRoom(fid); return; }
        this.peeking = true;
        this.time.delayedCall(380, () => { this.peeking = false; if (this.sys.settings.status < Phaser.Scenes.SHUTDOWN) PE.App.goToRoom(fid); });
        return;
      }
      this.peeking = true;
      const go = () => { this.peeking = false; if (this.sys.settings.status < Phaser.Scenes.SHUTDOWN) PE.App.goToRoom(fid); };
      const peekId = v.artId.replace('BLD-', 'PEEK-');
      const lift = (key) => {
        if (!v.image.scene) return;
        const src = this.textures.get(v.image.texture.key).getSourceImage();
        const cutAt = Math.round(src.height * 0.5);
        const roof = this.add.image(v.image.x, v.image.y, v.image.texture.key).setOrigin(0.5, 1).setDisplaySize(v.image.displayWidth, v.image.displayHeight).setDepth(v.image.depth + 1);
        roof.setCrop(0, 0, src.width, cutAt);
        // Under the lifting roof: the peek picture.
        v.image.setTexture(key);
        this.tweens.add({ targets: roof, y: roof.y - 90, alpha: 0, duration: 340, ease: 'Sine.easeOut', onComplete: () => this.time.delayedCall(110, go) });
      };
      if (!MapArt.load(this, peekId, lift, go)) go();
    }
    onGameEvent(type, e) {
      if (this.lifeEvent && this.ready) this.lifeEvent(type, e);
      if (type === 'changed' && this.ready) this.needRefresh = true;
    }

    // Every name on the map (buildings, features, rivals), each with the spot it belongs under.
    nameLabels() {
      const out = [];
      for (const v of this.views.values()) if (v.name && v.name.scene) out.push({ t: v.name, x: v.s.x, y: v.s.y + 6, top: v.s.y - (v.artTop || 200) });
      if (this.life && this.life.rivals) for (const r of this.life.rivals.values()) if (r.label && r.label.scene) out.push({ t: r.label, x: r.spot.x, y: r.spot.y + 6, top: r.spot.y - (r.image && r.image.displayHeight > 4 ? r.image.displayHeight : 200) });
      return out;
    }
    // Job 21: a name always shows whole. Near the screen's edge it slides back in (inside the safe area), and it keeps
    // clear of the side buttons. Drawn over the traffic and the trees, under the bubbles. Only redone when the camera moves.
    placeNames(force) {
      const cam = this.cameras.main;
      const side = document.querySelector('#actionbar .map-side');
      const sr = side ? side.getBoundingClientRect() : null;
      // The buttons along the bottom and the top bar: names stay between them.
      const low = [...document.querySelectorAll('#actionbar .map-switch, #actionbar .map-list, #actionbar .map-event')].map((e) => e.getBoundingClientRect()).filter((r) => r.height);
      const lowTop = low.length ? Math.min(...low.map((r) => r.top)) : null;
      const topBar = document.querySelector('#hud .hud-top');
      const hudBottom = topBar && !document.getElementById('hud').hidden ? topBar.getBoundingClientRect().bottom : 0;
      const sig = `${cam.scrollX.toFixed(1)}|${cam.scrollY.toFixed(1)}|${cam.zoom.toFixed(4)}|${this.scale.width}|${sr ? Math.round(sr.left) + ',' + Math.round(sr.top) + ',' + Math.round(sr.bottom) : ''}|${lowTop === null ? '' : Math.round(lowTop)}|${Math.round(hudBottom)}`;
      if (!force && sig === this.nameSig) return;
      this.nameSig = sig;
      const L = PE.UI.layout(this);
      // Worked out from the camera itself: its worldView can be a frame behind just after a zoom.
      const z = cam.zoom;
      const view = { x: cam.scrollX + cam.width * cam.originX - (cam.width / z) * cam.originX, y: cam.scrollY + cam.height * cam.originY - (cam.height / z) * cam.originY };
      const pad = 6 * L.u;
      // The side buttons, in the canvas's own pixels.
      let col = null;
      const cr = this.game.canvas.getBoundingClientRect();
      const k = this.scale.width / cr.width;
      if (sr && sr.width) col = { left: (sr.left - cr.left) * k, top: (sr.top - cr.top) * k, bottom: (sr.bottom - cr.top) * k };
      const yHi = lowTop === null ? L.bottom : Math.min(L.bottom, (lowTop - cr.top) * k);
      const yLo = Math.max(L.top, (hudBottom - cr.top) * k);
      for (const n of this.nameLabels()) {
        const t = n.t;
        if (t.depth < 50000) t.setDepth(50000 + n.y);
        const w = t.width * t.scaleX * z, h = t.height * t.scaleY * z;
        const sx = (n.x - view.x) * z, sy = (n.y - view.y) * z;
        const onScreen = sx > -w && sx < L.W + w;
        // Not tucked under the buttons along the bottom, or the top bar (only when its building is on screen).
        let ny = sy;
        const topY = (n.top - view.y) * z;   // the building's roof, on screen
        if (onScreen && topY < yHi - h && sy > yLo - h * 3) ny = Math.max(yLo + pad, Math.min(sy, yHi - pad - h));
        t.y = view.y + ny / z;
        // Slid in from the screen's edges, and clear of the side buttons at the height it ends up at.
        let lo = L.left + pad + w / 2, hi = L.right - pad - w / 2;
        if (col && ny + h > col.top - pad && ny < col.bottom + pad) hi = Math.min(hi, col.left - pad - w / 2);
        let nx = sx;
        // Only a name whose building is at least partly on screen is pulled in.
        if (onScreen) nx = lo > hi ? Math.max(L.left + pad + w / 2, hi) : Math.min(hi, Math.max(lo, sx));
        t.x = view.x + nx / z;
      }
    }
    // Where a map point is on screen, in page points. Used by the automatic browser test to really tap it.
    worldToPage(wx, wy) {
      const cam = this.cameras.main;
      const r = this.game.canvas.getBoundingClientRect();
      const sx = (wx - cam.midPoint.x) * cam.zoom + cam.width / 2;
      const sy = (wy - cam.midPoint.y) * cam.zoom + cam.height / 2;
      return { x: r.left + (sx * r.width) / this.scale.width, y: r.top + (sy * r.height) / this.scale.height };
    }
    // (Job 25: a little higher up the building, clear of the Event Day button over the bottom corner of the map.)
    buildingPagePoint(fid) { const s = this.layout.spots[fid] || this.layout.features[fid]; return this.worldToPage(s.x, s.y - 110); }
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
      const menu = PE.MapMenu || [];
      const side = menu.map((m) => `<button class="map-side-btn" data-act="menu:${m.id}" aria-label="${m.label}"><span>${PE.Dom.icon(m.icon, 28)}</span><small>${m.label}</small>${m.dot && m.dot() ? PE.Dom.icon('STA-03', 16, 'side-alert') : ''}</button>`).join('');
      // On a narrow screen the column folds into this one button (job 21). It carries a "!" if any inside has one.
      const anyDot = menu.some((m) => m.dot && m.dot());
      const fold = `<button class="map-side-btn map-side-fold" data-act="sideFold" aria-label="More"><span class="fold-open"><i class="fold-bars"><b></b><b></b><b></b></i></span><span class="fold-x">×</span>${anyDot && !PE.MapBar.open ? PE.Dom.icon('STA-03', 16, 'side-alert') : ''}</button>`;
      const f = g.meta.festivalNow();
      const left = PE.Dom.duration(Math.max(0, f.endsMs - g.now()) / 1000);
      const banner = `<button class="map-event ${f.active ? 'on' : ''}" data-act="menu:festival">${PE.Dom.icon('GOL-03', 30)}<span><b>${PE.Dom.esc(f.theme)}</b><small>${f.active ? `On now, ends in ${left}` : `Starts in ${left}`}</small></span></button>`;
      // Job 23: the Event button opens the Event Hub; with no event on, it counts down to the next.
      const hub = PE.EventHub ? PE.EventHub.button() : '';
      if (PE.EventHub && !PE.App.g.tutorial.active()) PE.EventHub.tipOnce();
      return `${hub}${banner}<div class="map-side${PE.MapBar.open ? ' open' : ''}">${side}${fold}</div>
        <button class="btn map-switch" data-act="districts">${PE.Dom.icon('NAV-01', 26)}${PE.Dom.esc(here.name)}${PE.Dom.icon('SYS-03', 14, 'down')}${waiting ? PE.Dom.icon('STA-03', 20) : ''}</button>
        <button class="btn plain map-list" data-act="mapList">${PE.Dom.icon('SYS-05', 22)}List</button>`;
    },
  };
  PE.Hud.actions.districts = () => PE.App.openPanel('districts', {});
  PE.Hud.actions.mapList = () => PE.App.openPanel('empireList', {});
  PE.Hud.actions.menu = (id) => { PE.MapBar.open = false; PE.App.router.go(id, {}); };
  PE.Hud.actions.sideFold = () => { PE.MapBar.open = !PE.MapBar.open; };
  // Holding a side button shows its name beside it (a quick tap just opens it).
  document.addEventListener('pointerdown', (e) => { const b = e.target.closest && e.target.closest('.map-side-btn'); if (b) b.classList.add('held'); }, true);
  const unhold = () => document.querySelectorAll('.map-side-btn.held').forEach((b) => b.classList.remove('held'));
  document.addEventListener('pointerup', unhold, true);
  document.addEventListener('pointercancel', unhold, true);
})(globalThis.PE = globalThis.PE || {});
