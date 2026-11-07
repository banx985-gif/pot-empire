// Placed decorations, drawn where they sit in a room. These are stand-ins made in code until the DECOR art arrives:
// the shape says which piece it is, and the colour says which set.
(function (PE) {
  const COLOURS = [0xff4fa3, 0x52e6ff, 0xc6ff3d, 0xffd84d, 0xff8a3d, 0xb47cff, 0x62d04b, 0xff5f5f, 0x4fd8c4, 0xf2a6ff, 0x9fb7ff, 0xe8c07a];
  const setColour = (name) => { let h = 0; for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0; return COLOURS[h % COLOURS.length]; };

  // Each piece: where in the room, and how it's drawn. x is a share of the room's width; u scales with the wall's height.
  const PIECES = {
    'wall-wall': { x: 0.14, y: (r) => r.wall * 0.46, draw(G, c, u) {   // a poster
      G.fillStyle(0x000000, 0.3).fillRect(-46 * u + 4, -62 * u + 4, 92 * u, 124 * u);
      G.fillStyle(0xf6efe0, 1).fillRect(-46 * u, -62 * u, 92 * u, 124 * u);
      G.fillStyle(c, 1).fillRect(-38 * u, -54 * u, 76 * u, 72 * u);
      G.fillStyle(0xffffff, 0.8).fillTriangle(-30 * u, 10 * u, 0, -40 * u, 30 * u, 10 * u);
      G.fillStyle(c, 1).fillRect(-38 * u, 28 * u, 76 * u, 8 * u).fillRect(-38 * u, 42 * u, 50 * u, 8 * u);
    } },
    'neon-wall': { x: 0.86, y: (r) => r.wall * 0.42, draw(G, c, u) {   // a neon sign: a glowing outline
      G.lineStyle(14 * u, c, 0.25).strokeRoundedRect(-58 * u, -34 * u, 116 * u, 68 * u, 22 * u);
      G.lineStyle(5 * u, c, 1).strokeRoundedRect(-58 * u, -34 * u, 116 * u, 68 * u, 22 * u);
      G.lineStyle(5 * u, 0xffffff, 0.9).lineBetween(-30 * u, 10 * u, -10 * u, -14 * u);
      G.lineBetween(-10 * u, -14 * u, 10 * u, 10 * u);
      G.lineBetween(10 * u, 10 * u, 30 * u, -14 * u);
    } },
    'hanging-ceiling': { x: 0.3, y: () => 0, draw(G, c, u) {   // something hanging on a cord
      G.lineStyle(3 * u, 0xd8d0c0, 1).lineBetween(0, 0, 0, 56 * u);
      G.fillStyle(c, 1).fillTriangle(-34 * u, 92 * u, 34 * u, 92 * u, 0, 56 * u);
      G.fillStyle(0xffffff, 0.45).fillCircle(0, 102 * u, 12 * u);
    } },
    'shelf-shelf': { x: 0.7, y: (r) => r.wall * 0.74, draw(G, c, u) {   // a small shelf with an ornament
      G.fillStyle(0x6a4628, 1).fillRect(-54 * u, 0, 108 * u, 9 * u);
      G.fillStyle(c, 1).fillRoundedRect(-36 * u, -38 * u, 24 * u, 38 * u, 6 * u);
      G.fillStyle(0xffffff, 0.8).fillCircle(14 * u, -14 * u, 14 * u);
      G.fillStyle(c, 1).fillCircle(14 * u, -14 * u, 8 * u);
    } },
    'counter-counter': { x: 0.08, y: (r) => r.wall + 40, draw(G, c, u) {   // a stand with a display piece on it
      G.fillStyle(0x000000, 0.25).fillEllipse(0, 50 * u, 110 * u, 26 * u);
      G.fillStyle(0x6a4628, 1).fillRoundedRect(-44 * u, 0, 88 * u, 50 * u, 6 * u);
      G.fillStyle(0x8c6238, 1).fillRoundedRect(-48 * u, -6 * u, 96 * u, 14 * u, 5 * u);
      G.fillStyle(c, 1).fillCircle(0, -28 * u, 22 * u);
      G.fillStyle(0xffffff, 0.6).fillCircle(-7 * u, -35 * u, 6 * u);
    } },
    'floor-floor': { x: 0.5, y: (r) => r.wall + 66, draw(G, c, u) {   // a rug
      G.fillStyle(c, 0.85).fillEllipse(0, 0, 330 * u, 88 * u);
      G.fillStyle(0xffffff, 0.3).fillEllipse(0, 0, 260 * u, 62 * u);
      G.fillStyle(c, 0.9).fillEllipse(0, 0, 190 * u, 40 * u);
    } },
  };

  const DecorArt = {
    // Puts what's placed in this room on its walls and floor, and keeps it up to date.
    attach(scene, fid, room) {
      const shown = new Map();   // socket -> { id, g }
      const all = new Map(PE.Data.collectibles.decorations.map((d) => [d.id, d]));
      const u = (room.wall / 180) * 1.1;
      const sync = () => {
        if (scene.sys.settings.status >= Phaser.Scenes.SHUTDOWN) return;
        const placed = PE.App.state.collections.decorByFacility[fid] || {};
        for (const [socket, s] of shown) {
          if (placed[socket] !== s.id) { s.g.destroy(); shown.delete(socket); }
        }
        for (const [socket, id] of Object.entries(placed)) {
          const d = all.get(id);
          const piece = PIECES[socket];
          if (!d || !piece || shown.has(socket)) continue;
          const G = scene.add.graphics({ x: room.w * piece.x, y: piece.y(room) }).setDepth(-985);
          piece.draw(G, setColour(d.set), u);
          shown.set(socket, { id, g: G });
        }
        scene.decorShown = [...shown.values()].map((s) => s.id);
      };
      sync();
      const off = scene.g.on((type) => { if (type === 'changed') sync(); });
      scene.events.on('wake', sync);
      scene.events.once('shutdown', () => { off(); scene.events.off('wake', sync); shown.clear(); });
    },
  };
  PE.DecorArt = DecorArt;
})(globalThis.PE = globalThis.PE || {});
