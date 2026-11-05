// Paints one district's ground from its layout file into a single picture, once. Far cheaper than drawing it
// every frame: this one picture is the land, water, roads and all the filler.
// ALL STAND-INS until map art arrives: to add a new kind of filler, add one painter to PROPS below.
(function (PE) {
  const S = 0.6;             // picture pixels per map unit
  const P = (v) => v * S;
  const dim = (c, f) => (Math.round(((c >> 16) & 255) * f) << 16) | (Math.round(((c >> 8) & 255) * f) << 8) | Math.round((c & 255) * f);
  const mix = (c, to, f) => {
    const ch = (s) => Math.round(((c >> s) & 255) * (1 - f) + ((to >> s) & 255) * f);
    return (ch(16) << 16) | (ch(8) << 8) | ch(0);
  };
  const OUT = 0x2a1a3a;

  function poly(G, pts) { G.fillPoints(pts.map(([x, y]) => ({ x: P(x), y: P(y) })), true); }
  function stroke(G, pts, width, colour, alpha = 1) {
    G.lineStyle(P(width), colour, alpha);
    G.fillStyle(colour, alpha);
    for (let i = 0; i < pts.length; i++) {
      if (i) G.lineBetween(P(pts[i - 1][0]), P(pts[i - 1][1]), P(pts[i][0]), P(pts[i][1]));
      G.fillCircle(P(pts[i][0]), P(pts[i][1]), P(width / 2));
    }
  }
  const ell = (G, x, y, rx, ry, c, a = 1) => G.fillStyle(c, a).fillEllipse(P(x), P(y), P(rx * 2), P(ry * 2));
  const rect = (G, x, y, w, h, c, a = 1) => G.fillStyle(c, a).fillRect(P(x), P(y), P(w), P(h));
  const circ = (G, x, y, r, c, a = 1) => G.fillStyle(c, a).fillCircle(P(x), P(y), P(r));
  // A simple box with a slanted roof: houses, shops, warehouses and towers are all this.
  function block(G, x, y, w, h, wall, roof) {
    ell(G, x + 10, y + 2, w * 0.62, w * 0.16, 0x000000, 0.18);
    const d = w * 0.18;
    G.fillStyle(dim(wall, 0.72), 1);
    poly(G, [[x + w / 2, y], [x + w / 2 + d, y - d * 0.7], [x + w / 2 + d, y - h - d * 0.7], [x + w / 2, y - h]]);
    rect(G, x - w / 2, y - h, w, h, wall);
    G.fillStyle(roof, 1);
    poly(G, [[x - w / 2, y - h], [x + w / 2, y - h], [x + w / 2 + d, y - h - d * 0.7], [x - w / 2 + d, y - h - d * 0.7]]);
    G.lineStyle(P(3), OUT, 0.8).strokeRect(P(x - w / 2), P(y - h), P(w), P(h));
  }
  const tree = (G, x, y, s, a, b) => {
    ell(G, x + 6, y, 32 * s, 10 * s, 0x000000, 0.17);
    rect(G, x - 6 * s, y - 36 * s, 12 * s, 36 * s, 0x6b4a2c);
    circ(G, x, y - 62 * s, 38 * s, a);
    circ(G, x - 16 * s, y - 52 * s, 24 * s, a);
    circ(G, x + 16 * s, y - 50 * s, 24 * s, a);
    circ(G, x - 8 * s, y - 72 * s, 22 * s, b);
  };

  // Everything that can stand on the map. Each gets (G, prop, layout's look).
  const PROPS = {
    tree(G, p, k) { const s = 0.85 + (p.tone || 0.5) * 0.4; tree(G, p.x, p.y, s, dim(k.grassDark, 0.72), k.grassDark); },
    pine(G, p, k) {
      const s = 0.85 + (p.tone || 0.5) * 0.4, c = dim(k.grassDark, 0.55);
      ell(G, p.x + 5, p.y, 26 * s, 8 * s, 0x000000, 0.17);
      rect(G, p.x - 5 * s, p.y - 22 * s, 10 * s, 22 * s, 0x5a3f28);
      for (let i = 0; i < 3; i++) { G.fillStyle(i === 2 ? dim(k.grassDark, 0.72) : c, 1); poly(G, [[p.x - (32 - i * 7) * s, p.y - (16 + i * 24) * s], [p.x + (32 - i * 7) * s, p.y - (16 + i * 24) * s], [p.x, p.y - (58 + i * 24) * s]]); }
    },
    palm(G, p) {
      ell(G, p.x + 5, p.y, 24, 8, 0x000000, 0.17);
      G.lineStyle(P(9), 0x9c7a4c, 1).lineBetween(P(p.x), P(p.y), P(p.x + 10), P(p.y - 72));
      for (const [dx, dy] of [[-44, -10], [44, -8], [-30, -30], [32, -30], [-40, 14], [42, 14]]) { G.lineStyle(P(11), 0x3f9a3a, 1).lineBetween(P(p.x + 10), P(p.y - 72), P(p.x + 10 + dx), P(p.y - 72 + dy)); }
    },
    bush(G, p, k) { const c = dim(k.grassDark, 0.82); ell(G, p.x, p.y, 25, 9, 0x000000, 0.14); circ(G, p.x - 13, p.y - 12, 15, c); circ(G, p.x + 13, p.y - 12, 15, c); circ(G, p.x, p.y - 20, 17, k.grassDark); },
    flowers(G, p) {
      const c = [0xff4fa3, 0xffd84d, 0x52e6ff, 0xffffff];
      const t = p.tone || 0.5;
      for (let i = 0; i < 6; i++) circ(G, p.x + Math.sin(i * 2.4 + t * 9) * 28, p.y + Math.cos(i * 1.7 + t * 5) * 13, 6, c[(i + Math.floor(t * 4)) % 4]);
    },
    rock(G, p) { ell(G, p.x, p.y - 8, 20, 13, 0x8b8fa3); ell(G, p.x - 4, p.y - 13, 10, 5, 0xb6bac8); },
    reed(G, p, k) { for (let i = -2; i <= 2; i++) { G.lineStyle(P(4), dim(k.grassDark, 0.7), 1).lineBetween(P(p.x + i * 9), P(p.y), P(p.x + i * 13), P(p.y - 36)); } },
    house(G, p) {
      const c = p.c || 0xe8a06a;
      if (p.yard) { ell(G, p.x, p.y - 2, 92, 30, 0xffffff, 0.12); }
      block(G, p.x, p.y, 110, 66, c, dim(c, 0.45));
      rect(G, p.x - 10, p.y - 38, 22, 38, 0x6b4a2c);
      rect(G, p.x - 44, p.y - 50, 24, 22, 0xcdf7f2);
      rect(G, p.x + 22, p.y - 50, 24, 22, 0xcdf7f2);
      if (p.yard) for (let i = -8; i <= 8; i++) rect(G, p.x + i * 11 - 2, p.y + 8, 4, 18, 0xf4eedd);
    },
    shed(G, p) { block(G, p.x, p.y, 58, 40, 0xa98a5e, 0x6b5438); },
    shop(G, p) {
      const c = p.c || 0xff8a3d;
      block(G, p.x, p.y, 108, 76, 0xf2e3c8, 0x8a6a50);
      rect(G, p.x - 44, p.y - 38, 50, 28, 0x52e6ff);
      rect(G, p.x + 16, p.y - 44, 24, 44, 0x6b4a2c);
      for (let i = 0; i < 6; i++) rect(G, p.x - 54 + i * 18, p.y - 62, 18, 16, i % 2 ? 0xffffff : c);
    },
    stall(G, p) {
      const c = p.c || 0xff4fa3;
      ell(G, p.x, p.y + 2, 44, 12, 0x000000, 0.18);
      rect(G, p.x - 34, p.y - 30, 68, 30, 0xb8834a);
      rect(G, p.x - 34, p.y - 38, 5, 38, 0x5a3f28);
      rect(G, p.x + 29, p.y - 38, 5, 38, 0x5a3f28);
      for (let i = 0; i < 4; i++) rect(G, p.x - 40 + i * 20, p.y - 56, 20, 22, i % 2 ? 0xffffff : c);
      for (let i = 0; i < 4; i++) circ(G, p.x - 22 + i * 15, p.y - 28, 6, [0xc6ff3d, 0xff8a3d, 0xffd84d, 0xff4fa3][i]);
    },
    warehouse(G, p) {
      const c = p.c || 0x8b8fa3;
      block(G, p.x, p.y, 210, 110, c, dim(c, 0.6));
      for (let i = 0; i < 2; i++) { rect(G, p.x - 86 + i * 96, p.y - 66, 72, 66, dim(c, 0.5)); for (let y = 0; y < 66; y += 11) rect(G, p.x - 86 + i * 96, p.y - 66 + y, 72, 4, dim(c, 0.7)); }
      for (let i = 0; i < 5; i++) rect(G, p.x - 90 + i * 38, p.y - 100, 26, 14, 0xcdf7f2, 0.8);
    },
    container(G, p) { block(G, p.x, p.y, 84, 42, p.c || 0xff8a3d, dim(p.c || 0xff8a3d, 0.7)); for (let i = 0; i < 7; i++) rect(G, p.x - 38 + i * 12, p.y - 38, 4, 34, dim(p.c || 0xff8a3d, 0.75)); },
    crate(G, p) { block(G, p.x, p.y, 34, 30, 0xb8834a, 0x8f6638); },
    crane(G, p) {
      G.lineStyle(P(10), 0xffd84d, 1).lineBetween(P(p.x), P(p.y), P(p.x), P(p.y - 210));
      G.lineBetween(P(p.x - 50), P(p.y - 200), P(p.x + 140), P(p.y - 200));
      G.lineStyle(P(3), 0x2a1a3a, 1).lineBetween(P(p.x + 110), P(p.y - 200), P(p.x + 110), P(p.y - 90));
      rect(G, p.x + 90, p.y - 90, 42, 28, 0xff8a3d);
      rect(G, p.x - 28, p.y - 14, 56, 14, 0x3d4356);
    },
    tower(G, p) {
      const c = p.c || 0x3a2f70, h = p.h || 240;
      block(G, p.x, p.y, 112, h, c, dim(c, 0.65));
      for (let col = 0; col < 3; col++) for (let row = 0; row < Math.floor(h / 40); row++) rect(G, p.x - 40 + col * 30, p.y - h + 14 + row * 38, 20, 22, (col + row * 3) % 4 === 0 ? 0xff4fa3 : (col + row) % 3 ? 0xffd84d : 0x52e6ff, 0.9);
    },
    roofgarden(G, p, k) {
      block(G, p.x, p.y, 150, 120, 0x4f3f8c, 0x62c23a);
      for (let i = 0; i < 5; i++) circ(G, p.x - 56 + i * 30, p.y - 128 - (i % 2) * 4, 13, i % 2 ? 0xc6ff3d : dim(k.grassDark, 1) === k.grassDark ? 0x3f9a3a : 0x3f9a3a);
      for (let c = 0; c < 3; c++) for (let r = 0; r < 2; r++) rect(G, p.x - 50 + c * 40, p.y - 90 + r * 40, 22, 24, 0x52e6ff, 0.9);
    },
    fountain(G, p) {
      ell(G, p.x, p.y, 72, 34, 0x8b8fa3);
      ell(G, p.x, p.y - 4, 60, 26, 0x52c9f0);
      rect(G, p.x - 7, p.y - 42, 14, 38, 0xb6bac8);
      ell(G, p.x, p.y - 42, 22, 8, 0xb6bac8);
      for (const dx of [-16, 16, 0]) { G.lineStyle(P(4), 0xffffff, 0.75).lineBetween(P(p.x), P(p.y - 58), P(p.x + dx), P(p.y - 42 + Math.abs(dx))); }
    },
    statue(G, p) { ell(G, p.x, p.y, 40, 14, 0x000000, 0.18); rect(G, p.x - 24, p.y - 24, 48, 24, 0xb6bac8); rect(G, p.x - 10, p.y - 70, 20, 46, 0xd4af37); circ(G, p.x, p.y - 80, 13, 0xd4af37); },
    bench(G, p) { rect(G, p.x - 26, p.y - 18, 52, 7, 0x7a4a2c); rect(G, p.x - 26, p.y - 8, 52, 7, 0x8f5a36); rect(G, p.x - 22, p.y - 8, 5, 10, 0x2a1a3a); rect(G, p.x + 17, p.y - 8, 5, 10, 0x2a1a3a); },
    lamp(G, p) { rect(G, p.x - 3, p.y - 62, 6, 62, 0x2a1a3a); circ(G, p.x, p.y - 68, 11, 0xffe9a0); circ(G, p.x, p.y - 68, 18, 0xffe9a0, 0.25); },
    car(G, p) {
      const colours = [0xff4fa3, 0x52e6ff, 0xffd84d, 0xc6ff3d, 0xff8a3d, 0xffffff];
      const c = colours[Math.abs(Math.round(p.x + p.y)) % colours.length];
      ell(G, p.x, p.y, 40, 9, 0x000000, 0.2);
      G.fillStyle(c, 1).fillRoundedRect(P(p.x - 36), P(p.y - 22), P(72), P(20), P(6));
      G.fillStyle(dim(c, 0.82), 1).fillRoundedRect(P(p.x - 20), P(p.y - 36), P(40), P(16), P(5));
      rect(G, p.x - 15, p.y - 33, 13, 11, 0xcdf7f2);
      rect(G, p.x + 2, p.y - 33, 13, 11, 0xcdf7f2);
      circ(G, p.x - 21, p.y - 2, 7, 0x140a24);
      circ(G, p.x + 21, p.y - 2, 7, 0x140a24);
    },
    fence(G, p) { const n = Math.floor((p.w || 150) / 18); for (let i = 0; i <= n; i++) rect(G, p.x - (p.w || 150) / 2 + i * 18 - 2, p.y - 20, 4, 22, 0xf4eedd); rect(G, p.x - (p.w || 150) / 2, p.y - 14, p.w || 150, 4, 0xf4eedd); },
    playground(G, p) {
      ell(G, p.x, p.y, 72, 30, 0xd8c78f);
      G.lineStyle(P(6), 0xff4fa3, 1).lineBetween(P(p.x - 40), P(p.y), P(p.x - 30), P(p.y - 60));
      G.lineBetween(P(p.x - 20), P(p.y), P(p.x - 30), P(p.y - 60));
      G.lineStyle(P(6), 0x52e6ff, 1).lineBetween(P(p.x - 30), P(p.y - 60), P(p.x + 40), P(p.y - 4));
      circ(G, p.x + 34, p.y - 22, 8, 0xffd84d);
    },
    skate(G, p) {
      ell(G, p.x, p.y, 140, 56, 0xb6bac8);
      ell(G, p.x - 46, p.y, 44, 28, 0x8b8fa3);
      ell(G, p.x + 52, p.y + 4, 36, 22, 0x8b8fa3);
      G.lineStyle(P(5), 0xff4fa3, 1).lineBetween(P(p.x - 110), P(p.y - 16), P(p.x + 110), P(p.y - 26));
      for (const d of [-90, -20, 60]) rect(G, p.x + d, p.y - 24, 4, 12, 0x2a1a3a);
    },
    bunting(G, p) { const c = p.colours || [0xff4fa3, 0xffd84d, 0x52e6ff, 0xc6ff3d]; G.lineStyle(P(3), 0x2a1a3a, 1).lineBetween(P(p.x - 70), P(p.y - 34), P(p.x + 70), P(p.y - 34)); for (let i = 0; i < 7; i++) { G.fillStyle(c[i % c.length], 1); poly(G, [[p.x - 66 + i * 20, p.y - 34], [p.x - 52 + i * 20, p.y - 34], [p.x - 59 + i * 20, p.y - 16]]); } rect(G, p.x - 74, p.y - 40, 5, 40, 0x7a4a2c); rect(G, p.x + 70, p.y - 40, 5, 40, 0x7a4a2c); },
    dock(G, p) { rect(G, p.x - 60, p.y - 14, 120, 28, 0xa8814f); for (let i = 0; i < 6; i++) rect(G, p.x - 58 + i * 20, p.y - 14, 3, 28, 0x7a5a34); rect(G, p.x - 56, p.y + 14, 7, 16, 0x5a3f28); rect(G, p.x + 50, p.y + 14, 7, 16, 0x5a3f28); },
    moored(G, p) { ell(G, p.x, p.y, 44, 13, 0xffffff); ell(G, p.x, p.y - 4, 34, 8, 0xff8a3d); rect(G, p.x - 2, p.y - 44, 4, 40, 0x5a3f28); G.fillStyle(0xffffff, 1); poly(G, [[p.x + 2, p.y - 44], [p.x + 30, p.y - 12], [p.x + 2, p.y - 12]]); },
    umbrella(G, p) { rect(G, p.x - 2, p.y - 36, 4, 36, 0x7a4a2c); G.fillStyle(0xff4fa3, 1); poly(G, [[p.x - 30, p.y - 30], [p.x + 30, p.y - 30], [p.x, p.y - 54]]); },
    cottage(G, p) { block(G, p.x, p.y, 92, 54, p.c || 0xe8a06a, 0x8a4a3a); },
  };

  // The little things an event puts along the streets. data/events.js says which event uses which.
  const DECO = {
    flag(G, x, y, c) { rect(G, x - 2, y - 50, 4, 50, 0x5a3f28); G.fillStyle(c, 1); poly(G, [[x + 2, y - 50], [x + 34, y - 40], [x + 2, y - 28]]); },
    star(G, x, y, c) { rect(G, x - 2, y - 42, 4, 42, 0x2a1a3a); G.fillStyle(c, 1); poly(G, [[x, y - 74], [x + 16, y - 34], [x - 16, y - 34]]); poly(G, [[x, y - 26], [x + 16, y - 60], [x - 16, y - 60]]); },
    lantern(G, x, y, c) { rect(G, x - 2, y - 58, 4, 58, 0x2a1a3a); rect(G, x - 2, y - 58, 26, 3, 0x2a1a3a); circ(G, x + 22, y - 40, 24, c, 0.25); G.fillStyle(c, 1).fillRoundedRect(P(x + 11), P(y - 54), P(22), P(28), P(7)); },
    petal(G, x, y, c) { rect(G, x - 2, y - 26, 4, 26, 0x3f9a3a); for (let i = 0; i < 5; i++) circ(G, x + Math.cos(i * 1.26) * 13, y - 34 + Math.sin(i * 1.26) * 13, 9, c); circ(G, x, y - 34, 7, 0xffd84d); },
    disco(G, x, y, c) { rect(G, x - 2, y - 56, 4, 56, 0x2a1a3a); circ(G, x, y - 70, 19, 0xd5d8e0); for (let i = -1; i <= 1; i++) { rect(G, x - 16, y - 72 + i * 8, 32, 3, c); rect(G, x + i * 8 - 1, y - 86, 3, 32, 0xffffff, 0.7); } },
    planet(G, x, y, c) { rect(G, x - 2, y - 40, 4, 40, 0x2a1a3a); circ(G, x, y - 58, 18, c); G.lineStyle(P(4), 0xffffff, 0.85).strokeEllipse(P(x), P(y - 58), P(58), P(14)); },
  };
  function paintEvent(G, L, ev) {
    const { MapPaths } = PE;
    const prints = MapPaths.footprints(L);
    const lines = MapPaths.linesOf(L, (k, kind) => ['boulevard', 'road'].includes(kind));
    const others = MapPaths.linesOf(L, (k, kind) => kind !== 'boat');
    let n = 0;
    for (const l of lines) {
      for (let i = 4; i < l.pts.length - 1; i += 9) {
        const [x0, y0] = l.pts[i], [x1, y1] = l.pts[i + 1];
        const len = Math.hypot(x1 - x0, y1 - y0) || 1;
        const side = i % 2 ? 1 : -1;
        const x = x0 - ((y1 - y0) / len) * (l.width / 2 + 26) * side, y = y0 + ((x1 - x0) / len) * (l.width / 2 + 26) * side;
        if (x < 30 || y < 30 || x > L.w - 30 || y > L.h - 30) continue;
        if (MapPaths.onWater(L, x, y) || prints.some((f) => MapPaths.inFootprint(f, x, y, 8))) continue;
        if (others.some((o) => MapPaths.distToLine(x, y, o.pts) < o.width / 2 + 8)) continue;
        DECO[ev.deco](G, x, y, ev.bunting[n++ % ev.bunting.length]);
      }
    }
    // Bunting in front of every place, and across any square.
    for (const f of prints.filter((p) => !p.id.startsWith('lot'))) PROPS.bunting(G, { x: f.s.x, y: f.s.y - 2, colours: ev.bunting });
    for (const z of (L.zones || []).filter((q) => q.type === 'plaza')) {
      PROPS.bunting(G, { x: z.x - z.rx * 0.5, y: z.y - z.ry * 0.55, colours: ev.bunting });
      PROPS.bunting(G, { x: z.x + z.rx * 0.5, y: z.y - z.ry * 0.55, colours: ev.bunting });
    }
    rect(G, 0, 0, L.w, L.h, ev.tint, ev.tintAlpha);
  }

  const ZONES = {
    park(G, z, k) { ell(G, z.x, z.y, z.rx, z.ry, mix(k.grass, 0xffffff, 0.14)); },
    yard(G, z, k) { ell(G, z.x, z.y, z.rx, z.ry, mix(k.grass, 0xd8c78f, 0.45)); },
    plaza(G, z, k) {
      ell(G, z.x, z.y, z.rx, z.ry, mix(k.path, 0xffffff, 0.2));
      const c = dim(k.path, 0.9);
      for (let r = 0.25; r < 1; r += 0.25) G.lineStyle(P(4), c, 0.8).strokeEllipse(P(z.x), P(z.y), P(z.rx * 2 * r), P(z.ry * 2 * r));
    },
    concrete(G, z) { ell(G, z.x, z.y, z.rx, z.ry, 0x9aa3a8, 0.75); },
    sand(G, z, k) { ell(G, z.x, z.y, z.rx, z.ry, k.sand); },
    hill(G, z, k) { ell(G, z.x, z.y, z.rx, z.ry, mix(k.grass, 0xffffff, 0.07)); },
  };

  function drawPath(G, line, k) {
    const { kind, pts, width } = line;
    if (kind === 'boat') {
      for (let i = 2; i < pts.length; i += 3) ell(G, pts[i][0], pts[i][1], 16, 5, 0xffffff, 0.45);
    } else if (kind === 'rail') {
      stroke(G, pts, width, 0x8c8077);
      for (let i = 1; i < pts.length; i++) {
        const [ax, ay] = pts[i - 1], [bx, by] = pts[i];
        const len = Math.hypot(bx - ax, by - ay) || 1, nx = -(by - ay) / len, ny = (bx - ax) / len;
        G.lineStyle(P(7), 0x5a3f28, 1).lineBetween(P(ax + nx * 20), P(ay + ny * 20), P(ax - nx * 20), P(ay - ny * 20));
      }
      for (const off of [-12, 12]) {
        const shifted = pts.map((p, i) => { const q = pts[Math.min(pts.length - 1, i + 1)], o = pts[Math.max(0, i - 1)]; const len = Math.hypot(q[0] - o[0], q[1] - o[1]) || 1; return [p[0] - (q[1] - o[1]) / len * off, p[1] + (q[0] - o[0]) / len * off]; });
        stroke(G, shifted, 5, 0xd5d8e0);
      }
    } else if (kind === 'bridge') {
      stroke(G, pts, width + 18, 0x6b4a2c);
      stroke(G, pts, width, 0xa8814f);
      for (let i = 0; i < pts.length; i += 2) circ(G, pts[i][0], pts[i][1], 3, 0x5a3f28);
    } else if (kind === 'path') {
      stroke(G, pts, width, k.path);
    } else {
      stroke(G, pts, width + 12, k.kerb);
    }
  }
  function drawRoadTop(G, line, k) {
    const { kind, pts, width } = line;
    if (['boat', 'rail', 'bridge', 'path'].includes(kind)) return;
    stroke(G, pts, width, kind === 'drive' ? mix(k.road, k.path, 0.45) : k.road);
    if (kind !== 'boulevard' && kind !== 'road') return;
    // Dashes down the middle.
    let d = 0;
    G.lineStyle(P(5), k.line, 0.85);
    for (let i = 1; i < pts.length; i++) {
      const on = d % 80 < 40;
      if (on) G.lineBetween(P(pts[i - 1][0]), P(pts[i - 1][1]), P(pts[i][0]), P(pts[i][1]));
      d += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    }
  }

  function paint(G, L, key, ev) {
    const k = L.look;
    const { MapPaths } = PE;
    const d = MapPaths.derive(L);
    const dice = (label) => PE.Rng.roll(`map:${key}:${label}`);
    const sea = L.base === 'sea';
    rect(G, 0, 0, L.w, L.h, sea ? k.water : k.grass);
    if (sea) {
      // Beach first, then grass inside it.
      for (const land of d.land) { G.fillStyle(k.sand, 1); poly(G, land); }
      for (const land of d.land) {
        const cx = land.reduce((a, b) => a + b[0], 0) / land.length, cy = land.reduce((a, b) => a + b[1], 0) / land.length;
        G.fillStyle(k.grass, 1);
        poly(G, land.map(([x, y]) => [cx + (x - cx) * 0.9, cy + (y - cy) * 0.9]));
      }
    } else {
      for (let i = 0; i < 110; i++) ell(G, dice('gx' + i) * L.w, dice('gy' + i) * L.h, 30 + dice('gw' + i) * 90, 14 + dice('gh' + i) * 40, k.grassDark, 0.42);
    }
    for (const z of L.zones || []) ZONES[z.type](G, z, k);
    for (const w of d.water) {
      if (w.type === 'pond') {
        ell(G, w.x, w.y, w.rx + 13, w.ry + 11, k.sand);
        ell(G, w.x, w.y, w.rx, w.ry, k.water);
        ell(G, w.x - w.rx * 0.2, w.y - w.ry * 0.2, w.rx * 0.45, 7, 0xffffff, 0.4);
      } else if (w.type === 'river') {
        stroke(G, w.line, w.width + 22, k.sand);
        stroke(G, w.line, w.width, k.water);
        for (let i = 3; i < w.line.length; i += 5) ell(G, w.line[i][0] + Math.sin(i) * w.width * 0.3, w.line[i][1] + Math.cos(i * 2) * w.width * 0.25, 22, 4, 0xffffff, 0.32);
      } else { G.fillStyle(k.water, 1); poly(G, w.poly); }
    }
    const lines = d.lines;
    lines.forEach((l) => drawPath(G, l, k));
    lines.forEach((l) => drawRoadTop(G, l, k));
    // Room left for buildings added later.
    for (const lot of L.spareLots || []) {
      ell(G, lot.x, lot.y, 122, 54, k.grassDark, 0.9);
      G.lineStyle(P(4), 0xffffff, 0.3).strokeEllipse(P(lot.x), P(lot.y), P(244), P(108));
      for (const dx of [-90, 90]) { rect(G, lot.x + dx - 3, lot.y - 24, 6, 26, 0xe8def8); }
    }
    for (const p of MapPaths.placeProps(L)) { const fn = PROPS[p.type]; if (fn) fn(G, p, k); }
    if (ev) paintEvent(G, L, ev);
    // Soft edges: the ground fades into a darker border, so the end of the map looks like the end.
    for (let i = 0; i < 8; i++) {
      const m = i * 12 + 12;
      G.fillStyle(k.sky, 0.11);
      G.fillRect(0, 0, P(L.w), P(m)).fillRect(0, P(L.h - m), P(L.w), P(m)).fillRect(0, 0, P(m), P(L.h)).fillRect(P(L.w - m), 0, P(m), P(L.h));
    }
  }

  PE.MapGround = {
    PROPS,
    // Makes the picture if it isn't there yet. Only one district's ground is held in memory at a time.
    bake(scene, L, ev) {
      const key = `map-ground-${L.id}-${ev ? ev.id : 'plain'}`;
      for (const k of scene.textures.getTextureKeys()) if (k.startsWith('map-ground-') && k !== key) scene.textures.remove(k);
      if (!scene.textures.exists(key)) {
        const G = scene.make.graphics({ x: 0, y: 0, add: false });
        paint(G, L, L.id, ev);
        G.generateTexture(key, Math.ceil(P(L.w)), Math.ceil(P(L.h)));
        G.destroy();
      }
      return scene.add.image(0, 0, key).setOrigin(0, 0).setScale(1 / S).setDepth(-100000);
    },
  };
})(globalThis.PE = globalThis.PE || {});
