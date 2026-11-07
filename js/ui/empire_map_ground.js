// One district's ground: Aaron's painting (art/map/districts/MAP-Dn). The game has two sets of copies:
//   a whole small picture (always shown), and sharp squares of the big one (only the ones you're looking at, close up).
// That keeps memory low, and works on phones that can't hold one huge picture. See tools/import_map_art.js.
// During an event, its decorations go on top as a separate see-through picture.
(function (PE) {
  const S = 0.6;             // event picture pixels per map unit
  const P = (v) => v * S;
  const COLS = 4, ROWS = 8;  // the sharp squares: must match tools/import_map_art.js
  const OVERLAP = 2;         // each square overlaps by this many pixels, so no seam shows between them
  const SHARP_W = 2048;      // the sharp copy's width in pixels
  const SHARP_BELOW = 560;   // sharp squares come in when you can see fewer map units across than this
  const MAX_SQUARES = 24;    // the most squares held in memory at once

  const rect = (G, x, y, w, h, c, a = 1) => G.fillStyle(c, a).fillRect(P(x), P(y), P(w), P(h));
  const circ = (G, x, y, r, c, a = 1) => G.fillStyle(c, a).fillCircle(P(x), P(y), P(r));
  const poly = (G, pts) => G.fillPoints(pts.map(([x, y]) => ({ x: P(x), y: P(y) })), true);

  const DECO_SIZE = 1.7;
  // The little things an event puts along the streets. data/events.js says which event uses which.
  const DECO = {
    flag(G, x, y, c) { rect(G, x - 2, y - 50, 4, 50, 0x5a3f28); G.fillStyle(c, 1); poly(G, [[x + 2, y - 50], [x + 34, y - 40], [x + 2, y - 28]]); },
    star(G, x, y, c) { rect(G, x - 2, y - 42, 4, 42, 0x2a1a3a); G.fillStyle(c, 1); poly(G, [[x, y - 74], [x + 16, y - 34], [x - 16, y - 34]]); poly(G, [[x, y - 26], [x + 16, y - 60], [x - 16, y - 60]]); },
    lantern(G, x, y, c) { rect(G, x - 2, y - 58, 4, 58, 0x2a1a3a); rect(G, x - 2, y - 58, 26, 3, 0x2a1a3a); circ(G, x + 22, y - 40, 24, c, 0.25); G.fillStyle(c, 1).fillRoundedRect(P(x + 11), P(y - 54), P(22), P(28), P(7)); },
    petal(G, x, y, c) { rect(G, x - 2, y - 26, 4, 26, 0x3f9a3a); for (let i = 0; i < 5; i++) circ(G, x + Math.cos(i * 1.26) * 13, y - 34 + Math.sin(i * 1.26) * 13, 9, c); circ(G, x, y - 34, 7, 0xffd84d); },
    disco(G, x, y, c) { rect(G, x - 2, y - 56, 4, 56, 0x2a1a3a); circ(G, x, y - 70, 19, 0xd5d8e0); for (let i = -1; i <= 1; i++) { rect(G, x - 16, y - 72 + i * 8, 32, 3, c); rect(G, x + i * 8 - 1, y - 86, 3, 32, 0xffffff, 0.7); } },
    planet(G, x, y, c) { rect(G, x - 2, y - 40, 4, 40, 0x2a1a3a); circ(G, x, y - 58, 18, c); G.lineStyle(P(4), 0xffffff, 0.85).strokeEllipse(P(x), P(y - 58), P(58), P(14)); },
  };
  // The edge of each street, every so often, as long as it's clear of plots and other streets and water.
  function paintEvent(G, L, ev) {
    const { MapPaths } = PE;
    const prints = MapPaths.footprints(L);
    const streets = MapPaths.linesOf(L, (k, kind) => kind !== 'boat' && kind !== 'rail' && kind !== 'drive');
    let n = 0;
    // Strings of little flags along every street, in the event's colours.
    for (const l of streets) {
      for (let i = 2; i < l.pts.length - 1; i += 3) {
        const [x0, y0] = l.pts[i], [x1, y1] = l.pts[i + 1];
        if (MapPaths.onWater(L, x0, y0, 6)) continue;
        const len = Math.hypot(x1 - x0, y1 - y0) || 1;
        const ux = (x1 - x0) / len, uy = (y1 - y0) / len;
        G.fillStyle(ev.bunting[n++ % ev.bunting.length], 0.95);
        poly(G, [[x0 - ux * 8, y0 - uy * 8 - 10], [x0 + ux * 8, y0 + uy * 8 - 10], [x0, y0 + 6]]);
      }
    }
    for (const l of streets) {
      for (let i = 6; i < l.pts.length - 1; i += 13) {
        const [x0, y0] = l.pts[i], [x1, y1] = l.pts[i + 1];
        const len = Math.hypot(x1 - x0, y1 - y0) || 1;
        const side = i % 2 ? 1 : -1;
        const x = x0 - ((y1 - y0) / len) * 32 * side, y = y0 + ((x1 - x0) / len) * 32 * side;
        if (x < 30 || y < 30 || x > L.w - 30 || y > L.h - 30) continue;
        if (MapPaths.onWater(L, x, y, 16) || prints.some((f) => MapPaths.inFootprint(f, x, y, 6))) continue;
        if (streets.some((o) => MapPaths.distToLine(x, y, o.pts) < 24)) continue;
        G.save();
        G.translateCanvas(P(x), P(y));
        G.scaleCanvas(DECO_SIZE, DECO_SIZE);
        DECO[ev.deco](G, 0, 0, ev.bunting[n++ % ev.bunting.length]);
        G.restore();
      }
    }
  }

  const base = (L) => `assets/map/districts/${L.id}/base.webp`;
  const square = (L, c, r) => `assets/map/districts/${L.id}/s_${c}_${r}.webp`;

  function loadImage(scene, key, url, ready, tries = 2) {
    if (scene.textures.exists(key)) { ready(); return; }
    const img = new Image();
    img.onload = () => {
      if (scene.sys.settings.status >= Phaser.Scenes.SHUTDOWN) return;
      if (!scene.textures.exists(key)) scene.textures.addImage(key, img);
      ready();
    };
    img.onerror = () => { if (tries > 1 && scene.sys.settings.status < Phaser.Scenes.SHUTDOWN) scene.time.delayedCall(1500, () => loadImage(scene, key, url, ready, tries - 1)); };
    img.src = url;
  }

  PE.MapGround = {
    S,
    // Puts the district's ground in the scene and returns what the scene needs to keep it sharp.
    show(scene, L, ev) {
      const eventKey = ev ? `map-event-${L.id}-${ev.id}` : null;
      for (const k of scene.textures.getTextureKeys()) {
        const other = (k.startsWith('map-base-') && k !== `map-base-${L.id}`) || (k.startsWith('map-square-') && !k.startsWith(`map-square-${L.id}-`)) || (k.startsWith('map-event-') && k !== eventKey);
        if (other) scene.textures.remove(k);
      }
      const ground = { L, squares: new Map(), used: 0, baseImage: null, eventKey };
      const key = `map-base-${L.id}`;
      if (L.art) loadImage(scene, key, base(L), () => {
        ground.baseImage = scene.add.image(0, 0, key).setOrigin(0, 0).setDisplaySize(L.w, L.h).setDepth(-100000);
      });
      if (ev) {
        if (!scene.textures.exists(eventKey)) {
          const G = scene.make.graphics({ x: 0, y: 0, add: false });
          paintEvent(G, L, ev);
          G.generateTexture(eventKey, Math.ceil(P(L.w)), Math.ceil(P(L.h)));
          G.destroy();
        }
        // The colour wash over the ground, then the decorations.
        scene.add.rectangle(0, 0, L.w, L.h, ev.tint, ev.tintAlpha).setOrigin(0, 0).setDepth(-99100);
        scene.add.image(0, 0, eventKey).setOrigin(0, 0).setScale(1 / S).setDepth(-99000);
      }
      return ground;
    },
    // Called as the camera moves. Close up: fetch the squares on screen, and let go of ones far away.
    keepSharp(scene, ground) {
      const cam = scene.cameras.main;
      const { L, squares } = ground;
      if (!L.art) return;
      const viewW = cam.width / cam.zoom;
      const close = viewW < SHARP_BELOW;
      const cellW = L.w / COLS, cellH = L.h / ROWS;
      const want = new Set();
      if (close) {
        const vh = cam.height / cam.zoom, mid = cam.midPoint;
        const c0 = Math.max(0, Math.floor((mid.x - viewW / 2) / cellW)), c1 = Math.min(COLS - 1, Math.floor((mid.x + viewW / 2) / cellW));
        const r0 = Math.max(0, Math.floor((mid.y - vh / 2) / cellH)), r1 = Math.min(ROWS - 1, Math.floor((mid.y + vh / 2) / cellH));
        for (let c = c0; c <= c1; c++) for (let r = r0; r <= r1; r++) want.add(`${c}_${r}`);
      }
      for (const id of want) {
        if (squares.has(id)) { squares.get(id).lastWanted = scene.time.now; continue; }
        const [c, r] = id.split('_').map(Number);
        const entry = { image: null, lastWanted: scene.time.now };
        squares.set(id, entry);
        const key = `map-square-${L.id}-${id}`;
        loadImage(scene, key, square(L, c, r), () => {
          if (squares.get(id) !== entry) { if (scene.textures.exists(key)) scene.textures.remove(key); return; }
          // Each square carries an extra sliver on its inner sides: it's drawn exactly where those pixels belong.
          const src = scene.textures.get(key).getSourceImage();
          const unit = L.w / SHARP_W;
          const x = c * cellW - (c > 0 ? OVERLAP * unit : 0), y = r * cellH - (r > 0 ? OVERLAP * unit : 0);
          entry.image = scene.add.image(x, y, key).setOrigin(0, 0).setDisplaySize(src.width * unit, src.height * unit).setDepth(-99500);
        });
      }
      // Too many held: let go of the ones wanted longest ago. (Those on screen are always wanted.)
      if (squares.size > MAX_SQUARES) {
        const spare = [...squares.entries()].filter(([id]) => !want.has(id)).sort((a, b) => a[1].lastWanted - b[1].lastWanted);
        for (const [id, entry] of spare.slice(0, squares.size - MAX_SQUARES)) {
          if (entry.image) entry.image.destroy();
          const key = `map-square-${L.id}-${id}`;
          if (scene.textures.exists(key)) scene.textures.remove(key);
          squares.delete(id);
        }
      }
      ground.close = close;
    },
  };
})(globalThis.PE = globalThis.PE || {});
