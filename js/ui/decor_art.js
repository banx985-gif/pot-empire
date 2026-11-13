// Placed decorations, drawn where they sit in a room, from Aaron's art (art/collections/decor, D01-D72; job 17).
// Every room has one fixed socket for each of the six pieces (game/data/room_spots.js, worked out by
// tools/build_room_spots.js, moved by hand with the tester panel's "Move spots"):
//   wall-wall        wall poster            neon-wall        neon sign (glows a little)
//   hanging-ceiling  mobile, from the top   shelf-shelf      ornament, on a little ledge on the back wall
//   counter-counter  figurine, on the shop counter or a floor corner          floor-floor      rug
// A room with no picture (stand-in floor) uses the old places along its wall.
(function (PE) {
  // Where each piece goes in a stand-in room: x is a share of the room's width, y from the wall's height.
  const PLAIN = {
    'wall-wall': { x: 0.14, y: (wall) => wall * 0.46, w: 0.5, h: 0.62 },
    'neon-wall': { x: 0.86, y: (wall) => wall * 0.42, w: 0.7, h: 0.45 },
    'hanging-ceiling': { x: 0.3, y: () => 0, w: 0.4, h: 0.55 },
    'shelf-shelf': { x: 0.7, y: (wall) => wall * 0.78, w: 0.35, h: 0.35 },
    'counter-counter': { x: 0.08, y: (wall) => wall + 90, w: 0.4, h: 0.5 },
    'floor-floor': { x: 0.5, y: (wall) => wall + 66, w: 1.8, h: 0.5 },
  };
  const ANCHOR = { 'hanging-ceiling': [0.5, 0], 'shelf-shelf': [0.5, 1], 'counter-counter': [0.5, 1] };

  // A socket's place and room, in game units.
  function socketOf(name, opts) {
    const r = opts.room && opts.room.sockets && opts.room.sockets[name];
    if (r) return r;
    if (opts.room && opts.room.sockets) return null;   // this room has no place for it
    const p = PLAIN[name];
    if (!p) return null;
    return { x: opts.w * p.x, y: p.y(opts.wall), w: opts.wall * p.w * 1.6, h: opts.wall * p.h * 1.6 };
  }

  // Depth: wall pieces and rugs behind everything standing in the room; figurines sort with people and furniture.
  const depthOf = (name, s) => (name === 'counter-counter' ? s.y : name === 'floor-floor' ? -986 : -985);

  function draw(scene, name, id, s) {
    const key = 'ui-' + id;
    const art = PE.Data.itemArt[id] || [400, 400];
    const k = Math.min(s.w / art[0], s.h / art[1]);
    const [ox, oy] = ANCHOR[name] || [0.5, 0.5];
    const parts = [];
    if (name === 'shelf-shelf') {
      // The little ledge it stands on.
      const G = scene.add.graphics().setDepth(-985.5);
      const lw = Math.max(art[0] * k * 1.25, 120);
      G.fillStyle(0x000000, 0.28).fillRect(s.x - lw / 2 + 6, s.y + 6, lw, 18);
      G.fillStyle(0x6a4628, 1).fillRect(s.x - lw / 2, s.y, lw, 16);
      G.fillStyle(0x8c6238, 1).fillRect(s.x - lw / 2, s.y, lw, 5);
      parts.push(G);
    }
    if (name === 'hanging-ceiling') {
      // The cord it hangs from, up to the top edge.
      const G = scene.add.graphics().setDepth(-985.5);
      G.lineStyle(4, 0xd8d0c0, 0.9).lineBetween(s.x, 0, s.x, s.y + 4);
      parts.push(G);
    }
    const im = scene.add.image(s.x, s.y, '__WHITE').setVisible(false).setDepth(depthOf(name, s));
    parts.push(im);
    const put = () => {
      if (!im.scene) return;
      im.setTexture(key).setOrigin(ox, oy).setScale(k).setVisible(true);
      if (name === 'neon-wall' && !(PE.App && PE.App.calm())) {
        scene.tweens.add({ targets: im, alpha: 0.82, duration: 1100, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      }
    };
    if (scene.textures.exists(key)) put();
    else PE.UI.loadIcons(scene, [id], () => { if (scene.textures.exists(key)) put(); });
    return { destroy: () => parts.forEach((o) => o.destroy()), image: im };
  }

  const DecorArt = {
    // Puts what's placed in this room in its sockets, and keeps it up to date.
    // opts: { room (the room from PE.Layout.roomAt, with its sockets), or for a stand-in room: w, wall }
    attach(scene, fid, opts) {
      const shown = new Map();   // socket -> { id, piece }
      const all = new Map(PE.Data.collectibles.decorations.map((d) => [d.id, d]));
      const sync = () => {
        if (scene.sys.settings.status >= Phaser.Scenes.SHUTDOWN) return;
        const placed = PE.App.state.collections.decorByFacility[fid] || {};
        for (const [socket, s] of shown) {
          if (placed[socket] !== s.id) { s.piece.destroy(); shown.delete(socket); }
        }
        for (const [socket, id] of Object.entries(placed)) {
          if (!all.get(id) || shown.has(socket)) continue;
          const s = socketOf(socket, opts);
          if (!s) continue;
          shown.set(socket, { id, piece: draw(scene, socket, id, s), at: s });
        }
        scene.decorShown = [...shown.values()].map((s) => s.id);
        scene.decorPieces = [...shown.entries()].map(([socket, s]) => ({ socket, id: s.id, at: s.at, image: s.piece.image }));
      };
      sync();
      const off = scene.g.on((type) => { if (type === 'changed') sync(); });
      scene.events.on('wake', sync);
      scene.events.once('shutdown', () => { off(); scene.events.off('wake', sync); shown.clear(); });
    },
  };
  PE.DecorArt = DecorArt;
})(globalThis.PE = globalThis.PE || {});
