// The real rooms (job 16): Aaron's room picture behind everything, the glowing outline on an empty spot, the knock-through
// when a room grows, the floor the helpers and customers walk on, and the tester's spot nudging.
// The picture comes as one whole medium copy plus sharp squares of the full-size one, fetched only close up, like the
// district maps (tools/import_room_art.js). Spots: data/room_spots.js, worked out by tools/build_room_spots.js.
(function (PE) {
  const COLS = 3, ROWS = 2, OVERLAP = 2;   // must match tools/import_room_art.js
  const BASE_W = 2048;
  const MAX_SQUARES = 6;

  function loadImage(scene, key, url, done) {
    if (scene.textures.exists(key)) { done(); return; }
    const img = new Image();
    img.onload = () => {
      if (scene.sys.settings.status >= Phaser.Scenes.SHUTDOWN) return;
      if (!scene.textures.exists(key)) scene.textures.addImage(key, img);
      done();
    };
    let tries = 0;
    img.onerror = () => { if (++tries <= 2 && scene.sys.settings.status < Phaser.Scenes.SHUTDOWN) setTimeout(() => { img.src = `${url}?retry=${tries}`; }, 900 * tries); };
    img.src = url;
  }

  const RoomArt = {
    // Puts the room's picture in. Returns false (and draws nothing) if it hasn't been imported, so the stand-in stays.
    show(scene, room, depth = -998) {
      const base = PE.MapArt.url(room.picture);
      if (!base) return null;
      const dir = base.replace(/base\.webp$/, '');
      const art = { room, dir, depth, squares: new Map(), image: null, keys: [] };
      const key = `room-${room.picture}`;
      art.keys.push(key);
      loadImage(scene, key, base, () => {
        art.image = scene.add.image(0, 0, key).setOrigin(0, 0).setDisplaySize(room.w, room.h).setDepth(depth);
        // Job 25: each renovation done shows as a coloured section of trim along the front edge of the floor (pink, cyan,
        // lime, the same as in the plain rooms), so the second renovation shows too (it keeps the first one's picture).
        const f = scene.fid && scene.g && scene.g.facilities.get(scene.fid);
        const reno = f ? Math.min(3, f.renovation || 0) : 0;
        if (reno) {
          const T = scene.add.graphics().setDepth(depth + 1);
          const bh = Math.max(24, room.h * 0.012), secW = room.w / 3;
          for (let i = 0; i < reno; i++) T.fillStyle([0xff4fa3, 0x52e6ff, 0xc6ff3d][i], 0.85).fillRect(secW * i + 8, room.h - bh, secW - 16, bh);
          art.trim = { reno, graphics: T };
        }
        if (scene.onRoomPicture) scene.onRoomPicture();
      });
      // Pictures are let go when the room closes: only one room's are ever held.
      scene.events.once('shutdown', () => {
        for (const k of art.keys) if (scene.textures.exists(k)) scene.textures.remove(k);
        art.squares.clear();
      });
      return art;
    },
    // Every so often: close up, fetch the sharp squares on screen; let go of the rest.
    keepSharp(scene, art) {
      if (!art || !art.image) return;
      const cam = scene.cameras.main;
      const { room } = art;
      // Sharp squares are worth it once the whole copy would be stretched on screen.
      const close = cam.zoom > (BASE_W / room.w) * 1.25;
      const want = new Set();
      if (close) {
        const v = cam.worldView, cw = room.w / COLS, ch = room.h / ROWS;
        for (let c = Math.max(0, Math.floor(v.x / cw)); c <= Math.min(COLS - 1, Math.floor(v.right / cw)); c++) {
          for (let r = Math.max(0, Math.floor(v.y / ch)); r <= Math.min(ROWS - 1, Math.floor(v.bottom / ch)); r++) want.add(`${c}_${r}`);
        }
      }
      for (const id of want) {
        if (art.squares.has(id)) continue;
        const entry = { image: null };
        art.squares.set(id, entry);
        const [c, r] = id.split('_').map(Number);
        const key = `room-${room.picture}-${id}`;
        art.keys.push(key);
        loadImage(scene, key, `${art.dir}s_${id}.webp`, () => {
          if (art.squares.get(id) !== entry) { if (scene.textures.exists(key)) scene.textures.remove(key); return; }
          // Each square starts at its own pixel in the full picture (a sliver early on its inner sides, so no seam shows).
          const src = scene.textures.get(key).getSourceImage();
          const [pw, ph] = room.pictureSize;
          const kx = room.w / pw, ky = room.h / ph;
          const left = Math.max(0, Math.round((c * pw) / COLS) - OVERLAP), top = Math.max(0, Math.round((r * ph) / ROWS) - OVERLAP);
          entry.image = scene.add.image(left * kx, top * ky, key).setOrigin(0, 0).setDisplaySize(src.width * kx, src.height * ky).setDepth(art.depth + 0.5);
        });
      }
      if (art.squares.size > MAX_SQUARES || (!close && art.squares.size)) {
        for (const [id, entry] of [...art.squares.entries()]) {
          if (want.has(id)) continue;
          if (entry.image) entry.image.destroy();
          const key = `room-${room.picture}-${id}`;
          if (scene.textures.exists(key)) scene.textures.remove(key);
          art.squares.delete(id);
        }
      }
      art.close = close;
    },

    // An empty spot that's open: a soft glowing outline of where the thing will stand, with a "+".
    // strong: the next one you can buy (brighter). Returns the pieces, so the room can move or remove them.
    spotGlow(scene, room, i, { strong, label, calm }) {
      const p = room.spots[i];
      const F = room.foot;
      const G = scene.add.graphics().setDepth(p.y - 2);
      const w = F.r - F.l, h = F.b - F.t, x0 = p.x + F.l, y0 = p.y + F.t;
      const c = strong ? 0xc6ff3d : 0xffffff;
      for (let k = 4; k >= 1; k--) G.lineStyle(k * 9, c, (strong ? 0.12 : 0.06) * (5 - k)).strokeRoundedRect(x0, y0, w, h, Math.min(60, h / 3));
      G.lineStyle(5, c, strong ? 0.9 : 0.4).strokeRoundedRect(x0, y0, w, h, Math.min(60, h / 3));
      G.fillStyle(c, strong ? 0.1 : 0.05).fillRoundedRect(x0, y0, w, h, Math.min(60, h / 3));
      const size = Math.min(w, h) * 0.32;
      const plus = scene.add.text(p.x + (F.l + F.r) / 2, y0 + h * 0.42, '+', { fontFamily: 'system-ui, sans-serif', fontStyle: '900', fontSize: `${Math.round(size)}px`, color: strong ? '#c6ff3d' : '#ffffff', stroke: '#140a24', strokeThickness: Math.max(4, size / 12) }).setOrigin(0.5).setAlpha(strong ? 1 : 0.55).setDepth(p.y - 1);
      const text = label ? scene.add.text(plus.x, y0 + h * 0.82, label, { fontFamily: 'system-ui, sans-serif', fontStyle: 'bold', fontSize: `${Math.round(size * 0.34)}px`, color: '#ffffff', align: 'center', stroke: '#140a24', strokeThickness: Math.max(4, size / 18) }).setOrigin(0.5).setAlpha(strong ? 1 : 0.6).setDepth(p.y - 1) : null;
      const tween = strong && !calm ? scene.tweens.add({ targets: G, alpha: 0.55, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' }) : null;
      return { destroy() { if (tween) tween.stop(); G.destroy(); plus.destroy(); if (text) text.destroy(); }, i, x0, y0, w, h, label: label || '' };
    },

    // The room grew: a quick dust puff across the screen, then the bigger room comes in.
    knockThrough(scene, then) {
      const calm = PE.App.calm();
      if (calm) { then(); return; }
      const cam = scene.cameras.main;
      const v = cam.worldView;
      const r = Math.max(v.width, v.height) * 0.09;
      const puffs = [];
      for (let k = 0; k < 16; k++) {
        const x = v.x + v.width * ((k * 0.618) % 1), y = v.y + v.height * (0.25 + 0.6 * ((k * 0.381) % 1));
        const c = scene.add.circle(x, y, r * (0.6 + ((k * 0.73) % 0.6)), [0xd8cfc0, 0xbfb3a0, 0xeee6d8][k % 3], 0.95).setDepth(200000).setScale(0.2);
        puffs.push(c);
        scene.tweens.add({ targets: c, scale: 1.6, alpha: 0, delay: k * 18, duration: 620, ease: 'Sine.easeOut' });
      }
      cam.shake(260, 0.006);
      if (PE.Sound && PE.Sound.play) PE.Sound.play('levelup');
      scene.time.delayedCall(420, () => { puffs.forEach((c) => c.destroy()); then(); });
    },

    // Where the helpers (and shop customers) can walk: a grid of points on open floor, kept off everything standing there.
    // blocked(x, y) says when a point is under a setup, a shelf or a machine.
    floorWorld(room, blocked, opts) {
      const step = opts.step || 120;
      const cols = Math.floor(room.w / step), rows = Math.floor(room.h / step);
      const open = new Uint8Array(cols * rows);
      const at = (c, r) => [(c + 0.5) * step, (r + 0.5) * step];
      for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
        const [x, y] = at(c, r);
        // A little in from the edge of the floor, so nobody brushes the walls.
        const inside = PE.Layout.onFloor(room, x, y) && PE.Layout.onFloor(room, x - step * 0.6, y) && PE.Layout.onFloor(room, x + step * 0.6, y) && PE.Layout.onFloor(room, x, y + step * 0.6) && PE.Layout.onFloor(room, x, y - step * 0.4);
        open[r * cols + c] = inside && !blocked(x, y) ? 1 : 0;
      }
      const cells = [];
      for (let i = 0; i < open.length; i++) if (open[i]) cells.push(i);
      // Somewhere to stroll to: a spread-out handful of open points.
      const stride = Math.max(1, Math.floor(cells.length / 40));
      const spots = cells.filter((i, n) => n % stride === Math.floor(stride / 2)).map((i) => at(i % cols, Math.floor(i / cols)));
      if (!spots.length && cells.length) spots.push(at(cells[0] % cols, Math.floor(cells[0] / cols)));
      const nearest = (x, y) => {
        let best = -1, bd = Infinity;
        for (const i of cells) { const [cx, cy] = at(i % cols, Math.floor(i / cols)); const d = (cx - x) ** 2 + (cy - y) ** 2; if (d < bd) { bd = d; best = i; } }
        return best;
      };
      // The shortest way between two open points, along the grid (A*), straightened where it can be.
      function route(fromXY, toXY) {
        const s = nearest(fromXY[0], fromXY[1]), t = nearest(toXY[0], toXY[1]);
        if (s < 0 || t < 0) return null;
        const tc = t % cols, tr = Math.floor(t / cols);
        const h = (i) => Math.hypot((i % cols) - tc, Math.floor(i / cols) - tr);
        const g = new Map([[s, 0]]), came = new Map(), openSet = [[h(s), s]], done = new Set();
        while (openSet.length) {
          openSet.sort((a, b) => a[0] - b[0]);
          const [, cur] = openSet.shift();
          if (cur === t) break;
          if (done.has(cur)) continue;
          done.add(cur);
          const cc = cur % cols, cr = Math.floor(cur / cols);
          for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
            if (!dr && !dc) continue;
            const nc = cc + dc, nr = cr + dr;
            if (nc < 0 || nr < 0 || nc >= cols || nr >= rows) continue;
            const n = nr * cols + nc;
            if (!open[n] || (dr && dc && (!open[cr * cols + nc] || !open[nr * cols + cc]))) continue;
            const ng = g.get(cur) + (dr && dc ? 1.414 : 1);
            if (ng < (g.has(n) ? g.get(n) : Infinity)) { g.set(n, ng); came.set(n, cur); openSet.push([ng + h(n), n]); }
          }
        }
        if (s !== t && !came.has(t)) return null;
        const cellsOnWay = [t];
        while (cellsOnWay[0] !== s) cellsOnWay.unshift(came.get(cellsOnWay[0]));
        const pts = cellsOnWay.map((i) => at(i % cols, Math.floor(i / cols)));
        // Keep only the corners.
        const out = [pts[0]];
        for (let i = 1; i < pts.length - 1; i++) {
          const [ax, ay] = out[out.length - 1], [bx, by] = pts[i], [cx, cy] = pts[i + 1];
          if (Math.sign(bx - ax) !== Math.sign(cx - bx) || Math.sign(by - ay) !== Math.sign(cy - by)) out.push(pts[i]);
        }
        if (pts.length > 1) out.push(pts[pts.length - 1]);
        return out;
      }
      const pick = (list) => list[Math.floor(Math.random() * list.length)];
      return {
        height: opts.height, speed: opts.speed, near: opts.near, depth: opts.depth, ids: opts.ids, textScale: opts.textScale,
        spots, route, isOpen: (x, y) => { const c = Math.floor(x / step), r = Math.floor(y / step); return c >= 0 && r >= 0 && c < cols && r < rows && !!open[r * cols + c]; },
        start(i) { const [x, y] = spots[(i * 5 + 2) % spots.length]; return { x, y }; },
        path(e, toward) {
          const here = [e.actor.x, e.actor.y];
          let to;
          if (toward) to = spots.slice().sort((a, b) => Math.hypot(a[0] - toward.x, a[1] - toward.y) - Math.hypot(b[0] - toward.x, b[1] - toward.y))[0];
          else { const others = spots.filter((s) => Math.hypot(s[0] - here[0], s[1] - here[1]) > 200); to = others.length ? pick(others) : null; }
          if (!to) return null;
          const way = route(here, to);
          if (!way) return null;
          return [here, ...way.slice(1)];
        },
      };
    },
  };

  // ---- Spots moved by hand on this phone (tester panel only) ----------------------------------------------------------
  const KEY = 'pe-room-spot-moves';
  const RoomSpots = {
    // Spots moved on this phone, by room: { 'F03-2': { 0: [x, y] } }.
    local() { try { return JSON.parse(localStorage.getItem(KEY) || '{}'); } catch (e) { return {}; } },
    move(roomId, i, x, y) {
      const all = RoomSpots.local();
      (all[roomId] = all[roomId] || {})[i] = [Math.round(x), Math.round(y)];
      try { localStorage.setItem(KEY, JSON.stringify(all)); } catch (e) { /* private window: the move lasts until the room closes */ }
      return all;
    },
    clear(roomId) {
      const all = RoomSpots.local();
      if (roomId) delete all[roomId]; else for (const k of Object.keys(all)) delete all[k];
      try { localStorage.setItem(KEY, JSON.stringify(all)); } catch (e) { /* nothing to do */ }
    },
    // The text "copy spots" puts on the clipboard: every spot of the room, ready to paste into data/room_spot_overrides.js.
    // Decoration sockets (job 17) come after the spots, as 's:<socket>': [x, y].
    text(room) {
      const lines = room.spots.map((p, i) => `${i}: [${p.x}, ${p.y}]`);
      for (const [name, q] of Object.entries(room.sockets || {})) lines.push(`'s:${name}': [${q.x}, ${q.y}]`);
      return `'${room.id}': { ${lines.join(', ')} },`;
    },
    // What each socket's marker says while moving spots.
    SOCKET_LABEL: { 'wall-wall': 'Poster', 'neon-wall': 'Neon', 'hanging-ceiling': 'Mobile', 'shelf-shelf': 'Ornament', 'counter-counter': 'Figurine', 'floor-floor': 'Rug' },
    editing: false,   // the tester panel's "move spots" switch

    // While moving spots: every spot of the room gets a big numbered marker (spots not open yet too).
    drawMarks(scene, room) {
      if (scene.spotMarks) { scene.spotMarks.forEach((o) => o.destroy()); scene.spotMarks = null; }
      if (!RoomSpots.editing || !room || !room.id) return;
      const k = Math.max(1, room.w / 3000);
      scene.spotMarks = room.spots.map((p, i) => {
        const c = scene.add.container(p.x, p.y).setDepth(300000);
        c.add(scene.add.circle(0, 0, 70 * k, 0xff2d55, 0.85).setStrokeStyle(8 * k, 0xffffff));
        c.add(scene.add.text(0, 0, String(i), { fontFamily: 'system-ui, sans-serif', fontStyle: '900', fontSize: `${Math.round(70 * k)}px`, color: '#ffffff' }).setOrigin(0.5));
        c.key = i;
        return c;
      });
      // The decoration sockets: a purple marker with the piece's name.
      for (const [name, q] of Object.entries(room.sockets || {})) {
        const c = scene.add.container(q.x, q.y).setDepth(300000);
        c.add(scene.add.circle(0, 0, 60 * k, 0x8a3cff, 0.85).setStrokeStyle(8 * k, 0xffffff));
        c.add(scene.add.text(0, 0, RoomSpots.SOCKET_LABEL[name] || name, { fontFamily: 'system-ui, sans-serif', fontStyle: '900', fontSize: `${Math.round(30 * k)}px`, color: '#ffffff' }).setOrigin(0.5));
        c.key = 's:' + name;
        scene.spotMarks.push(c);
      }
    },
    // The room's touch handlers ask these first. Each returns true when the touch was for moving a spot.
    down(scene, p) {
      if (!RoomSpots.editing || !scene.spotMarks) return false;
      const w = scene.cameras.main.getWorldPoint(p.x, p.y);
      const reach = 140 * Math.max(1, scene.room.w / 3000);
      let best = null;
      scene.spotMarks.forEach((m, i) => { const d = Math.hypot(m.x - w.x, m.y - w.y); if (d < reach && (!best || d < best.d)) best = { i, d, dx: m.x - w.x, dy: m.y - w.y }; });
      scene.spotDrag = best;
      return !!best;
    },
    drag(scene, p) {
      const d = scene.spotDrag;
      if (!d) return false;
      const w = scene.cameras.main.getWorldPoint(p.x, p.y);
      scene.spotMarks[d.i].setPosition(w.x + d.dx, w.y + d.dy);
      return true;
    },
    up(scene) {
      const d = scene.spotDrag;
      if (!d) return false;
      scene.spotDrag = null;
      const m = scene.spotMarks[d.i];
      RoomSpots.move(scene.room.id, m.key, m.x, m.y);
      PE.Dom.toast(`${typeof m.key === 'number' ? 'Spot ' + m.key : RoomSpots.SOCKET_LABEL[m.key.slice(2)] + ' socket'} moved. Tester panel: "Copy spots" to send it.`);
      scene.scene.restart(scene.sys.settings.data);
      return true;
    },
  };

  PE.RoomArt = RoomArt;
  PE.RoomSpots = RoomSpots;
})(globalThis.PE = globalThis.PE || {});
