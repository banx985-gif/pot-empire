// The gaming lounge in a grow room (job 26): a TV on a stand against the back wall and a seat facing it, a good way in
// front (about 3 to 4 helper heights, less in a small room). The helpers walk over, pick up a controller, sit and play
// (js/ui/helper_life.js). Which room has one, and with which TV and seat: js/logic/lounge.js. Numbers: data/lounge.js.
//
// Where it goes: worked out from the room itself, the same way every time. Along the back of the open floor, never on a
// station's spot (bought or still to come), the door, the rug, the figurine corner or anything kept clear; the room's
// props move out of its way. A room with no space for it says so.
// Drawn: the TV behind everyone, the seated helpers, then the seat's back picture in front of them (so only their heads
// and shoulders show over it, as if seen from behind).
(function (PE) {
  const D = () => PE.Data.lounge;
  const H = () => PE.Anim.PERSON_H.grow;
  const ART = () => PE.Data.furnitureArt || {};
  const SEAT_DEPTH = 45000;          // the seat's back: in front of the helpers (who stand at 40000)
  const BEHIND_SEAT = 44000;         // a helper behind the seat's back (walking to it, sitting, getting up)

  // The layout of a lounge in a room: { tv: {id, x, y, w, h}, seat: {id, x, y, w, h, slots}, front, rect } or null.
  function plan(room, setup) {
    if (!room || !room.floor || !setup) return null;
    const tv = PE.App.g.lounge.tv(setup.tv), seat = PE.App.g.lounge.seat(setup.seat);
    if (!tv || !seat) return null;
    const tvArt = ART()[`${tv.id}-LOGO`] || { w: 4, h: 3 }, seatArt = ART()[`SEAT-${seat.id}-BACK`] || { w: 2, h: 1 };
    const tvW = tv.w, tvH = (tvW * tvArt.h) / tvArt.w;
    const seatW = seat.w, seatH = (seatW * seatArt.h) / seatArt.w;
    const L = PE.Layout, box = room.box || { halfW: 0, up: 0, down: 0 };
    const ys = room.floor.map((p) => p[1]), xs = room.floor.map((p) => p[0]);
    const top = Math.min(...ys), bottom = Math.max(...ys), left = Math.min(...xs), right = Math.max(...xs);
    const cx = (left + right) / 2;
    const sockets = room.sockets || {};
    const half = Math.max(tvW, seatW) / 2 + 60;
    const clash = (x, y0, y1) => {
      for (const s of room.spots || []) if (x + half > s.x - box.halfW - 80 && x - half < s.x + box.halfW + 80 && y1 > s.y - box.up - 160 && y0 < s.y + box.down + 140) return true;
      if (room.door && Math.abs(x - room.door.x) < 700 + half && y1 > room.door.y - 900) return true;
      for (const k of [sockets['floor-floor'], sockets['counter-counter']]) if (k && Math.abs(x - k.x) < k.w / 2 + half + 60 && y1 > k.y - k.h - 200 && y0 < k.y + 200) return true;
      for (const c of room.keepClear || []) if (x + half > c.x && x - half < c.x + c.w && y1 > c.y && y0 < c.y + c.h) return true;
      return false;
    };
    const on = (x, y, w) => L.onFloor(room, x, y) && L.onFloor(room, x - w / 2, y) && L.onFloor(room, x + w / 2, y);
    let best = null;
    for (let x = left + half; x <= right - half; x += 60) {
      // The TV's feet: the first row of floor at the back, a little in from the wall.
      let ty = null;
      for (let y = top + 40; y < bottom; y += 30) if (on(x, y, tvW)) { ty = y + 30; break; }
      if (ty === null || !on(x, ty, tvW)) continue;
      for (let gap = D().gap.most; gap >= D().gap.least - 1e-6; gap -= 0.1) {
        const sy = ty + gap * H();
        if (!on(x, sy, seatW) || !on(x, sy + 60, seatW * 0.6)) continue;
        if (clash(x, ty - 120, sy + 80)) continue;
        const score = gap * 10 - Math.abs(x - cx) / 2000;
        if (!best || score > best.score) best = { x, ty, sy, gap, score };
        break;
      }
    }
    if (!best) return null;
    const { x, ty, sy } = best;
    const seatLeft = x - seatW / 2;
    const slot = (frac) => ({ x: seatLeft + frac * seatW, y: sy - seatH * seat.sitFrom });
    const slots = {};
    for (const [who, frac] of Object.entries(seat.slots)) slots[who] = slot(frac);
    return {
      tv: { id: tv.id, x, y: ty, w: tvW, h: tvH },
      seat: { id: seat.id, x, y: sy, w: seatW, h: seatH, slots, longer: seat.longer || 1 },
      gap: best.gap,
      front: { x, y: ty + 140 },                        // where they stand to pick up the controller
      rect: { x0: x - half, x1: x + half, y0: ty - 60, y1: sy + 90 },
    };
  }

  // A furniture picture as a texture, fetched once per scene.
  function texture(scene, id, ready) {
    const key = 'furn-' + id;
    if (scene.textures.exists(key)) { ready(key); return; }
    if (!ART()[id]) return;
    const img = new Image();
    img.onload = () => {
      if (!scene.sys || scene.sys.settings.status >= Phaser.Scenes.SHUTDOWN) return;
      if (!scene.textures.exists(key)) scene.textures.addImage(key, img);
      ready(key);
    };
    img.src = `assets/furniture/${id}.webp`;
  }

  const Lounge = {
    plan, SEAT_DEPTH, BEHIND_SEAT,
    // Works out the room's lounge before the props are placed, so they keep out of its way.
    prepare(scene) {
      const setup = !scene.testOverride && PE.App.g.lounge.in(scene.fid);
      scene.lounge = setup ? plan(scene.room, setup) : null;
      scene.loungeMissing = !!setup && !scene.lounge;   // placed, but the room has no space for it
      // Is there room for one at all (the smallest seat and TV)? The Lounge button only shows where there is.
      scene.loungeFits = !scene.testOverride && !!scene.room.picture && !!plan(scene.room, { tv: 'TV-1', seat: 'RECLINER' });
      if (scene.lounge) {
        const r = scene.lounge.rect;
        scene.room = { ...scene.room, keepClear: [...(scene.room.keepClear || []), { x: r.x0, y: r.y0 - 600, w: r.x1 - r.x0, h: r.y1 - r.y0 + 600 }] };
      }
      return scene.lounge;
    },
    // Draws it. A plain block stands in for any picture that's missing.
    attach(scene) {
      const P = scene.lounge;
      if (!P) return;
      const parts = scene.loungeParts = {};
      parts.shadow = scene.add.image(P.seat.x, P.seat.y - 8, 'pot-halo').setTint(0x000000).setAlpha(0.35).setDisplaySize(P.seat.w * 0.95, P.seat.w * 0.2).setDepth(P.seat.y - 2);
      parts.tvShadow = scene.add.image(P.tv.x, P.tv.y - 6, 'pot-halo').setTint(0x000000).setAlpha(0.3).setDisplaySize(P.tv.w * 0.9, P.tv.w * 0.16).setDepth(P.tv.y - 2);
      parts.tv = scene.add.rectangle(P.tv.x, P.tv.y, P.tv.w, P.tv.h, 0x222033).setOrigin(0.5, 1).setDepth(P.tv.y);
      parts.seat = scene.add.rectangle(P.seat.x, P.seat.y, P.seat.w, P.seat.h, 0x7a3fa0).setOrigin(0.5, 1).setDepth(SEAT_DEPTH);
      Lounge.showScreen(scene, false);
      texture(scene, `SEAT-${P.seat.id}-BACK`, (key) => {
        if (!parts.seat.scene) return;
        const im = scene.add.image(P.seat.x, P.seat.y, key).setOrigin(0.5, 1).setDisplaySize(P.seat.w, P.seat.h).setDepth(SEAT_DEPTH);
        parts.seat.destroy();
        parts.seat = im;
      });
    },
    // The TV's screen: the Pot Empire logo when nobody's playing, the game while someone is.
    showScreen(scene, playing) {
      const P = scene.lounge, parts = scene.loungeParts;
      if (!P || !parts) return;
      const id = `${P.tv.id}-${playing ? 'GAME' : 'LOGO'}`;
      scene.loungeScreen = playing ? 'GAME' : 'LOGO';
      texture(scene, id, (key) => {
        if (!parts.tv.scene || scene.loungeScreen !== (playing ? 'GAME' : 'LOGO')) return;
        if (parts.tv.type === 'Image') parts.tv.setTexture(key).setDisplaySize(P.tv.w, P.tv.h);
        else { const im = scene.add.image(P.tv.x, P.tv.y, key).setOrigin(0.5, 1).setDisplaySize(P.tv.w, P.tv.h).setDepth(P.tv.y); parts.tv.destroy(); parts.tv = im; }
      });
    },
    // Helpers walk round it (the walk lines).
    blocks(scene, x, y) {
      const P = scene.lounge;
      if (!P) return false;
      const r = P.rect;
      return x > r.x0 && x < r.x1 && y > r.y0 - 80 && y < r.y1;
    },
    // Is this world point on the TV or the seat?
    hit(scene, x, y) {
      const P = scene.lounge;
      if (!P) return false;
      const inside = (o) => o && Math.abs(x - o.x) < o.w / 2 && y < o.y && y > o.y - o.h;
      return inside(P.tv) || inside(P.seat);
    },
    // What the helpers need to know (js/ui/helper_life.js): where to go, which seat is whose, and the TV's screen.
    world(scene) {
      const P = scene.lounge;
      if (!P) return null;
      const taken = new Map();
      return {
        kind: P.seat.id, front: P.front, tv: P.tv, seat: P.seat, behind: BEHIND_SEAT,
        // Where this helper would sit, or null if it's taken.
        slotFor(id) {
          const s = P.seat.slots[id] || P.seat.slots.any;
          if (!s) return null;
          const key = P.seat.slots[id] ? id : 'any';
          if (taken.has(key) && taken.get(key) !== id) return null;
          return { ...s, key };
        },
        take(id, key) { taken.set(key, id); },
        free(id) { for (const [k, v] of [...taken]) if (v === id) taken.delete(k); },
        playing: new Set(),
        setPlaying(id, on) {
          if (on) this.playing.add(id); else this.playing.delete(id);
          const now = this.playing.size > 0;
          if ((scene.loungeScreen === 'GAME') !== now) Lounge.showScreen(scene, now);
        },
        minutes() { const [a, b] = D().playMinutes; return (a + Math.random() * (b - a)) * (P.seat.longer || 1); },
      };
    },
  };
  PE.Lounge = Lounge;

  // ---- The menu: place a lounge in this room, pick its TV and seat, or take it away --------------------------------------
  const { esc, icon } = PE.Dom;
  const pic = (id, size) => `<img class="lg-pic" src="assets/furniture/${id}.webp" alt="" style="max-width:${size}px;max-height:${size}px" draggable="false" onerror="this.style.visibility='hidden'">`;
  PE.Panels.lounge = {
    title: 'Gaming lounge',
    sheet: true,
    render(p) {
      const g = PE.App.g;
      const fid = p.fid || PE.App.state.ui.lastRoom || 'F01';
      const now = g.lounge.in(fid);
      const pickTv = (now && now.tv) || 'TV-1', pickSeat = (now && now.seat) || 'SOFA';
      const scene = PE.App.game && PE.App.game.scene.getScene('garage');
      const noRoom = scene && scene.fid === fid && scene.loungeMissing;
      const card = (kind, row, art, on) => `<button class="lg-card ${on ? 'on' : ''} ${row.unlock === 'free' ? '' : 'locked'}" data-act="${kind}:${row.id}">${pic(art, 92)}<b>${esc(row.name)}</b><small>${esc(row.blurb)}</small></button>`;
      return `<p class="muted">The helpers come over now and then, pick up a controller, sit down and play for a few minutes. Tap the TV or the seat in the room to change them.</p>
        ${noRoom ? '<p class="lg-warn">This room has no space left for the lounge. Try a bigger room, or a smaller seat.</p>' : ''}
        <h4>TV</h4><div class="lg-row">${g.lounge.tvs().map((t) => card('tv', t, `${t.id}-GAME-34` in (PE.Data.furnitureArt || {}) ? `${t.id}-GAME-34` : `${t.id}-LOGO`, t.id === pickTv)).join('')}</div>
        <h4>Seat</h4><div class="lg-row">${g.lounge.seats().map((t) => card('seat', t, `SEAT-${t.id}-34`, t.id === pickSeat)).join('')}</div>
        ${now ? `<button class="btn wide plain" data-act="remove">${icon('SYS-04', 22)}Take the lounge out of this room</button>` : `<button class="btn wide go" data-act="place">${icon('COL-06', 22)}Put a lounge in this room</button>`}`;
    },
    actions: {
      tv(id) { Lounge.set({ tv: id }); },
      seat(id) { Lounge.set({ seat: id }); },
      place() { Lounge.set({}); },
      remove() { const fid = Lounge.fid(); PE.App.g.lounge.remove(fid); Lounge.reload(fid); },
    },
  };
  Lounge.fid = () => { const r = PE.Dom.panelRoute; return (r && r.params && r.params.fid) || PE.App.state.ui.lastRoom || 'F01'; };
  Lounge.set = (change, opts = {}) => {
    const g = PE.App.g, fid = change.fid || Lounge.fid();
    const now = g.lounge.in(fid) || { tv: 'TV-1', seat: 'SOFA' };
    const r = g.lounge.place(fid, change.tv || now.tv, change.seat || now.seat, opts);
    if (!r.ok) { PE.Dom.toast(r.why === 'locked' ? 'Not unlocked yet' : 'Only in a grow room you own'); return r; }
    PE.App.saveGame();
    Lounge.reload(fid);
    return r;
  };
  // The room redraws with its new lounge.
  Lounge.reload = (fid) => {
    const s = PE.App.game && PE.App.game.scene.getScene('garage');
    if (s && s.sys.isActive() && s.fid === fid && !s.testOverride) { s.ready = false; s.scene.restart({ fid }); }
  };
  // The secret test switch: place any TV and seat, unlocked or not (and ?lounge=TV-3,MASSAGE on the web address).
  Lounge.testPlace = (fid, tv, seat) => Lounge.set({ fid, tv, seat }, { test: true });
  if (typeof location !== 'undefined') {
    const m = location.search.match(/[?&]lounge=([A-Z0-9-]+),([A-Z]+)/);
    if (m) { const go = () => { if (PE.App && PE.App.g && PE.App.g.lounge) PE.App.g.lounge.place(PE.App.state.ui.lastRoom || 'F01', m[1], m[2], { test: true }); else setTimeout(go, 300); }; go(); }
  }
})(globalThis.PE = globalThis.PE || {});
