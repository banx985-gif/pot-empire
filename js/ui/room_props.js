// Things standing on a grow room's empty floor (job 21), so it doesn't look bare: planters, bushes, benches, lamp posts
// and the like, from art already in the game (Aaron's map props, art/map/props). Nothing new is drawn.
//   - Only along the edges of the open floor, never on a station's spot (bought or still to come), the door, the rug,
//     the figurine corner or the middle of the floor where Haze and Budz walk. Helpers walk round them.
//   - Picked the same way every time for each room picture, so a room always looks the same.
//   - Just for looks: a tap goes straight through them.
(function (PE) {
  // What suits each building, and how tall each piece stands in room units (Haze is about 560).
  const SETS = {
    F01: ['PRP-07', 'PRP-09', 'PRP-06', 'PRP-12'],
    F02: ['PRP-08', 'PRP-06', 'PRP-09', 'PRP-07', 'PRP-12'],
    F03: ['PRP-04', 'PRP-06', 'PRP-05', 'PRP-07', 'PRP-02'],
    F07: ['PRP-06', 'PRP-08', 'PRP-04', 'PRP-09', 'PRP-05'],
    F10: ['PRP-09', 'PRP-06', 'PRP-07', 'PRP-12', 'PRP-05'],
    F11: ['PRP-11', 'PRP-04', 'PRP-03', 'PRP-06', 'PRP-05', 'PRP-02'],
  };
  const TALL = { 'PRP-02': 860, 'PRP-03': 940, 'PRP-04': 520, 'PRP-05': 440, 'PRP-06': 400, 'PRP-07': 460, 'PRP-08': 440, 'PRP-09': 1050, 'PRP-11': 640, 'PRP-12': 560 };
  const WIDE = { 'PRP-07': 1.3, 'PRP-08': 1.35, 'PRP-12': 1.3, 'PRP-11': 1.4 };   // roughly how wide for its height
  const GLOW = { 'PRP-09': true };   // a lamp post: a warm pool of light round its foot

  // A steady random number from a word: the same room gets the same props.
  function seeded(word) {
    let h = 2166136261;
    for (let i = 0; i < word.length; i++) { h ^= word.charCodeAt(i); h = Math.imul(h, 16777619); }
    return () => { h = Math.imul(h ^ (h >>> 15), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909); h ^= h >>> 16; return (h >>> 0) / 4294967296; };
  }

  // Where they go: a list of { id, x, y (their feet), h, w }.
  function plan(room) {
    if (!room || !room.floor || room.kind !== 'grow') return [];
    const list = SETS[room.fid];
    if (!list) return [];
    const L = PE.Layout, box = room.box;
    const P = room.floor;
    const cx = P.reduce((a, p) => a + p[0], 0) / P.length, cy = P.reduce((a, p) => a + p[1], 0) / P.length;
    const ys = P.map((p) => p[1]);
    const floorTop = Math.min(...ys), floorBottom = Math.max(...ys);
    const sockets = room.sockets || {};
    const rug = sockets['floor-floor'], corner = sockets['counter-counter'];
    // Somewhere it mustn't stand: a station's spot (with room to walk round it), the door, the rug and the corner.
    const clash = (x, y, w, h) => {
      // (Further back than a station is fine: it's drawn behind the bench. Low pieces only there.)
      for (const s of room.spots) if (x + w / 2 > s.x - box.halfW - 120 && x - w / 2 < s.x + box.halfW + 120 && y > s.y - box.up && y - Math.min(h, 300) < s.y + box.down + 200) return true;
      if (room.door && Math.abs(x - room.door.x) < 900 && y > room.door.y - 900) return true;
      for (const k of [rug, corner]) if (k && Math.abs(x - k.x) < k.w / 2 + w / 2 + 120 && Math.abs(y - k.y) < k.h + 260) return true;
      for (const c of room.keepClear || []) if (x + w / 2 > c.x && x - w / 2 < c.x + c.w && y > c.y && y - h < c.y + c.h) return true;
      return false;
    };
    // Points just inside the edge of the floor, all the way round.
    const cands = [];
    for (let i = 0; i < P.length; i++) {
      const [ax, ay] = P[i], [bx, by] = P[(i + 1) % P.length];
      const len = Math.hypot(bx - ax, by - ay);
      for (let d = 160; d < len - 160; d += 180) {
        const ex = ax + ((bx - ax) * d) / len, ey = ay + ((by - ay) * d) / len;
        const k = Math.hypot(cx - ex, cy - ey) || 1;
        for (const inset of [220, 420]) cands.push([ex + ((cx - ex) / k) * inset, ey + ((cy - ey) / k) * inset]);
      }
    }
    const rnd = seeded(room.id);
    for (let i = cands.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [cands[i], cands[j]] = [cands[j], cands[i]]; }
    const most = Math.min(6, 2 + Math.round((room.w * room.h) / 22e6));
    const out = [];
    let n = Math.floor(rnd() * list.length);
    for (const [x, y] of cands) {
      if (out.length >= most) break;
      if (out.some((o) => Math.hypot(o.x - x, (o.y - y) * 1.6) < 800)) continue;
      // The next piece in turn that fits here.
      for (let t = 0; t < list.length; t++) {
        const id = list[(n + t) % list.length];
        const h = TALL[id] || 420, w = h * (WIDE[id] || 1);
        // Tall pieces only at the back, by the wall, so they never hide anything.
        if (h > 700 && y > floorTop + (floorBottom - floorTop) * 0.3) continue;
        // Feet and both sides on the floor.
        if (!L.onFloor(room, x, y) || !L.onFloor(room, x - w / 2, y - 20) || !L.onFloor(room, x + w / 2, y - 20)) continue;
        if (clash(x, y, w, h)) continue;
        out.push({ id, x: Math.round(x), y: Math.round(y), h, w });
        n += t + 1;
        break;
      }
    }
    return out;
  }

  const RoomProps = {
    plan,
    // Draws them in the room. Returns the plan (the room's walk lines use it to go round them).
    attach(scene, room) {
      const props = plan(room);
      scene.roomProps = props.map((p) => ({ ...p, image: null }));
      for (const p of scene.roomProps) {
        if (GLOW[p.id]) {
          p.glow = scene.add.image(p.x, p.y - 30, 'pot-halo').setDepth(-989).setBlendMode(Phaser.BlendModes.ADD).setTint(0xffd27a).setAlpha(0.45).setDisplaySize(900, 360);
        }
        p.shadow = scene.add.image(p.x, p.y - 6, 'pot-halo').setDepth(p.y - 1).setTint(0x000000).setAlpha(0.35).setDisplaySize(p.w * 0.9, p.w * 0.22);
        PE.MapArt.load(scene, p.id, (key) => {
          if (!scene.sys || scene.sys.settings.status >= Phaser.Scenes.SHUTDOWN) return;
          const src = scene.textures.get(key).getSourceImage();
          const k = p.h / src.height;
          p.image = scene.add.image(p.x, p.y, key).setOrigin(0.5, 0.97).setScale(k).setDepth(p.y);
        });
      }
      return props;
    },
    // Is this point taken by one (for the walk lines)?
    blocks(props, x, y) {
      return (props || []).some((p) => Math.abs(x - p.x) < p.w / 2 + 70 && y > p.y - Math.min(p.h, 300) && y < p.y + 90);
    },
  };
  PE.RoomProps = RoomProps;
})(globalThis.PE = globalThis.PE || {});
