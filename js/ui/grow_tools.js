// Hands-on growing in the grow room (job 18): you touch the things themselves, there are no tool buttons.
//   - Planting: tap an empty pot and your seed stash pops up beside it, one packet per strain you own. Drag a packet
//     onto the pot (or any empty pot) to plant it; a plain tap on a packet plants it in the pot you tapped. Tap anywhere
//     else to close it. The first time, a pale hand shows the drag. "More strains" opens the strain list to unlock more.
//   - Harvesting: flick (a quick swipe) across a station with ripe plants and your harvest tool flies along the swipe,
//     cutting every ripe plant it passes, with a POP and buds flying to the stash jar. The Peace Boomerang curves out
//     and comes back. A plain tap on a ripe plant still picks it.
//   - Watering is the pump and tank beside each station (js/ui/grow_hands.js).
//
// Art (job 17): ACT-09 seed packet (the strain's badge shows in its window), ACT-10 the guide's pointing glove, the
// harvest tools TOOL-01..05 with their trails TRAIL-01..05, POP-01 where a plant is cut, TOOL-00 for a locked tool.
// Tools are only a look: they unlock with your level and change nothing else (see LIST). The stash jar (JAR-01..03)
// sits in the corner of the grow room: harvested buds fly into it.
(function (PE) {
  const $ = (id) => document.getElementById(id);
  const calm = () => (PE.App && PE.App.calm());
  const HAND = '<img src="assets/ui/ACT-10.webp" alt="" draggable="false">';
  // The harvest tools, best last. Unlocked by player level; the best one you have is the one you swing.
  const LIST = [
    { id: 'TOOL-01', trail: 'TRAIL-01', name: 'Rusty Scissors', level: 1 },
    { id: 'TOOL-02', trail: 'TRAIL-02', name: 'Golden Shears', level: 8 },
    { id: 'TOOL-03', trail: 'TRAIL-03', name: 'Peace Boomerang', level: 18, boomerang: true },
    { id: 'TOOL-04', trail: 'TRAIL-04', name: 'Laser Trimmer', level: 30 },
    { id: 'TOOL-05', trail: 'TRAIL-05', name: 'Rainbow Scythe', level: 45 },
  ];
  // How full the stash jar looks: harvests banked for the factory (the stock's harvest units).
  const JAR_HALF = 1, JAR_FULL = 25;
  // The flick: how fast a finger has to be going to throw the tool on (page pixels a millisecond), how far it can fly,
  // and how far apart along a swipe it checks for plants (so a fast swipe can't skip one).
  const THROW_SPEED = 0.45, THROW_MS = 380, THROW_MAX = 620, STEP = 18;
  const scene = () => { const s = PE.App.game.scene.getScene('garage'); return s && s.scene.isActive() && s.ready ? s : null; };
  const fidNow = () => PE.App.router.current().params.fid;
  const RARITY_ORDER = ['Mythic', 'Legendary', 'Epic', 'Rare', 'Uncommon', 'Common'];

  const Tools = {
    HAND,
    LIST,
    drag: null,
    stashAt: null,
    // The harvest tool you swing: the best your level has unlocked. During the guide it's the plain garden shears it talks about.
    tool() {
      const lvl = PE.App.g.progress.level();
      let best = LIST[0];
      for (const t of LIST) if (lvl >= t.level) best = t;
      return best;
    },
    shearsArt() { return PE.App.g.tutorial.active() ? 'ACT-07' : Tools.tool().id; },
    // How many harvests are in the stash, and which jar picture that is.
    stash() {
      const units = (PE.App.g.state.stock && PE.App.g.state.stock.units) || {};
      return Object.values(units).reduce((a, b) => a + (b || 0), 0);
    },
    jarArt(n = Tools.stash()) { return n >= JAR_FULL ? 'JAR-03' : n >= JAR_HALF ? 'JAR-02' : 'JAR-01'; },
    // The seeds you own: every strain you've unlocked. Whatever was last grown here first, then the rarest.
    seeds(fid = fidNow()) {
      const g = PE.App.g;
      const last = [];
      g.grow.eachStation((f, si, st) => { if (f === fid) for (const s of st.lastStrains) if (s && !last.includes(s)) last.push(s); });
      const owned = PE.Data.strains.filter((s) => g.grow.isStrainUnlocked(s.id));
      owned.sort((a, b) => {
        const la = last.indexOf(a.id), lb = last.indexOf(b.id);
        if ((la >= 0) !== (lb >= 0)) return la >= 0 ? -1 : 1;
        if (la >= 0) return la - lb;
        return RARITY_ORDER.indexOf(a.rarity) - RARITY_ORDER.indexOf(b.rarity);
      });
      return owned.map((s) => s.id);
    },
    seedStrain() { return Tools.seeds()[0] || 'STR-001'; },
    packet(id, size = 46) {
      return `<span class="seed-pack" style="width:${size}px;height:${size}px"><img class="tool-art" src="assets/ui/ACT-09.webp" alt="" draggable="false"><span class="seed-window">${PE.Dom.avatarPic(id, Math.round(size * 0.52))}</span></span>`;
    },
    // The old tool buttons are gone (job 18); this keeps the stash jar and closes the seed stash when you leave.
    sync() {
      const el = $('tools');
      if (el) el.hidden = true;
      const route = PE.App.router.current();
      const on = !!route && route.name === 'garage' && !PE.Dom.panelRoute;
      Tools.syncJar(on);
      if (!on) Tools.closeStash();
    },
    // The stash jar in the grow room's corner. Tap it to see the stash and your harvest tools.
    syncJar(on) {
      let jar = $('stash-jar');
      if (!on) { if (jar) jar.hidden = true; return; }
      if (!jar) {
        jar = document.createElement('div');
        jar.id = 'stash-jar';
        jar.innerHTML = '<button class="jar-btn" data-act="stash" aria-label="Stash jar"><img class="jar" alt="" draggable="false"><b class="jar-n"></b></button>';
        $('ui').appendChild(jar);
        PE.Dom.attachTaps(jar, (act) => { if (act === 'stash') Tools.showStash(); });
      }
      jar.hidden = false;
      const n = Tools.stash();
      const art = Tools.jarArt(n);
      const img = jar.querySelector('img.jar');
      if (img.dataset.art !== art) { img.dataset.art = art; img.src = `assets/ui/${art}.webp`; }
      const label = PE.Money.format(n);
      const tag = jar.querySelector('.jar-n');
      if (tag.textContent !== label) tag.textContent = label;
    },
    showStash() {
      const lvl = PE.App.g.progress.level();
      const cur = Tools.tool();
      const rows = LIST.map((t) => {
        const open = lvl >= t.level;
        return `<div class="tool-row ${t === cur ? 'on' : ''}"><img src="assets/ui/${open ? t.id : 'TOOL-00'}.webp" alt="" draggable="false"><span><b>${open ? t.name : 'Locked'}</b><small>${open ? (t === cur ? 'Flicking this one' : 'Unlocked') : 'Opens at level ' + t.level}</small></span></div>`;
      }).join('');
      const n = Tools.stash();
      PE.Dom.modal({ title: 'Your stash', cls: 'stash-card', html: `<p class="stash-line"><img class="stash-pic" src="assets/ui/${Tools.jarArt(n)}.webp" alt="">${n ? `<span><b>${PE.Money.format(n)}</b> harvests banked for your factory recipes.</span>` : '<span>Empty for now. Every harvest drops buds in here.</span>'}</p><h4>Harvest tools</h4><div class="tool-list">${rows}</div>`, buttons: [{ label: 'OK', style: 'go' }] });
    },
    // A bud has landed: the jar bumps, its lid pops and it twinkles.
    jarLanded() {
      const jar = $('stash-jar');
      if (!jar || jar.hidden || calm()) return;
      const now = performance.now();
      if (now - (Tools.lastLand || 0) < 160) return;
      Tools.lastLand = now;
      jar.classList.remove('bump');
      void jar.offsetWidth;
      jar.classList.add('bump');
      const lid = document.createElement('img');
      lid.className = 'jar-lid';
      lid.src = 'assets/ui/JAR-LID.webp';
      const spark = document.createElement('img');
      spark.className = 'jar-spark';
      spark.src = 'assets/ui/SPARK-01.webp';
      jar.append(lid, spark);
      setTimeout(() => { lid.remove(); spark.remove(); }, 520);
    },
    // Where buds fly to, on the page: the jar, if it's showing.
    jarPoint() {
      const jar = $('stash-jar');
      if (!jar || jar.hidden) return null;
      const r = jar.getBoundingClientRect();
      return r.width ? { x: r.left + r.width / 2, y: r.top + r.height * 0.45 } : null;
    },

    // ---- The seed stash -------------------------------------------------------------------------------------------
    // Where a pot is on the page.
    potOnPage(si, pi) {
      const s = scene();
      if (!s) return null;
      const st = s.stationData(si);
      const pos = s.room.stations[si];
      const spot = PE.Layout.potSpot(PE.Data, st.model, pi, st.levels.pots, s.faceOf(si));
      const cam = s.cameras.main;
      const r = s.game.canvas.getBoundingClientRect();
      const k = r.width / s.scale.width;
      const sx = (pos.x + spot.x - cam.worldView.x) * cam.zoom, sy = (pos.y + spot.rim - cam.worldView.y) * cam.zoom;
      return { x: r.left + sx * k, y: r.top + sy * k, w: spot.w * cam.zoom * k };
    },
    openStash(si, pi) {
      Tools.closeStash();
      const fid = fidNow();
      const ids = Tools.seeds(fid);
      const at = Tools.potOnPage(si, pi);
      if (!at) return;
      const u = $('ui').getBoundingClientRect();
      const box = document.createElement('div');
      box.id = 'seed-stash';
      box.innerHTML = `<div class="stash-head">Your seeds <small>drag one onto the pot</small></div><div class="stash-row">${ids.map((id) => {
        const s = PE.Data.strains.find((x) => x.id === id);
        return `<button class="stash-seed" data-seed="${id}" aria-label="${PE.Dom.esc(s.name)}">${Tools.packet(id, 52)}<small class="r-${s.rarity}">${PE.Dom.esc(s.name)}</small></button>`;
      }).join('')}<button class="stash-seed more" data-more="1" aria-label="More strains"><span class="more-plus">+</span><small>More strains</small></button></div>`;
      $('ui').appendChild(box);
      // Beside the pot: above it if there's room, otherwise below; kept on the screen.
      const W = u.width, bw = Math.min(W - 16, box.offsetWidth), bh = box.offsetHeight;
      const left = Math.max(8, Math.min(W - bw - 8, at.x - u.left - bw / 2));
      let top = at.y - u.top - at.w * 0.9 - bh - 10;
      if (top < 90) top = at.y - u.top + at.w * 0.5 + 12;
      top = Math.max(8, Math.min(u.height - bh - 140, top));
      box.style.left = `${left}px`;
      box.style.top = `${top}px`;
      Tools.stashAt = { fid, si, pi, box };
      box.addEventListener('pointerdown', (e) => {
        const b = e.target.closest('[data-seed],[data-more]');
        if (!b) return;
        e.preventDefault();
        e.stopPropagation();
        if (b.dataset.more) { Tools.closeStash(); PE.App.openPanel('strainPicker', { fid, si, pi }); return; }
        Tools.begin('seed', e, { strain: b.dataset.seed });
      });
      // Tap anywhere else to close it.
      // That tap only closes it: the room doesn't also act on it.
      Tools.outside = (e) => { if (Tools.stashAt && !Tools.stashAt.box.contains(e.target) && !Tools.drag) { Tools.closeStash(); Tools.swallowUntil = performance.now() + 600; } };
      setTimeout(() => window.addEventListener('pointerdown', Tools.outside, true), 0);
      if (!PE.App.state.ui.seedHandSeen && !PE.App.g.tutorial.active()) Tools.showHand();
    },
    // Is this tap the one that just closed the stash? (The room ignores it.)
    swallowTap() { const yes = performance.now() < (Tools.swallowUntil || 0); Tools.swallowUntil = 0; return yes; },
    closeStash() {
      if (Tools.outside) { window.removeEventListener('pointerdown', Tools.outside, true); Tools.outside = null; }
      if (Tools.hand) { Tools.hand.remove(); Tools.hand = null; }
      if (Tools.stashAt) { Tools.stashAt.box.remove(); Tools.stashAt = null; }
    },
    // The first time: a pale hand drags the first packet onto the pot, over and over until you do it.
    showHand() {
      const S = Tools.stashAt;
      const from = S && S.box.querySelector('[data-seed]');
      const to = S && Tools.potOnPage(S.si, S.pi);
      if (!from || !to) return;
      const u = $('ui').getBoundingClientRect();
      const f = from.getBoundingClientRect();
      const a = { x: f.left + f.width / 2 - u.left - 18, y: f.top + f.height / 2 - u.top - 10 };
      const z = { x: to.x - u.left - 18, y: to.y - u.top - 30 };
      const hand = document.createElement('div');
      hand.className = 'stash-hand';
      hand.innerHTML = HAND;
      $('ui').appendChild(hand);
      Tools.hand = hand;
      if (calm()) { hand.style.transform = `translate(${z.x}px, ${z.y}px)`; return; }
      hand.animate([
        { transform: `translate(${a.x}px, ${a.y}px)`, opacity: 0 },
        { transform: `translate(${a.x}px, ${a.y}px)`, opacity: 0.85, offset: 0.15 },
        { transform: `translate(${z.x}px, ${z.y}px)`, opacity: 0.85, offset: 0.75 },
        { transform: `translate(${z.x}px, ${z.y}px)`, opacity: 0 },
      ], { duration: 1800, iterations: Infinity, easing: 'ease-in-out' });
    },
    plantSeed(strain, si, pi) {
      const g = PE.App.g, fid = fidNow();
      const st = g.grow.stationOf(fid, si);
      if (!st || st.pots[pi]) return false;
      if (!g.grow.plant(fid, si, pi, strain)) return false;
      PE.Sound.play('plant');
      PE.App.state.ui.seedHandSeen = true;
      PE.App.saveGame();
      return true;
    },

    // ---- Dragging a seed, and the flick ---------------------------------------------------------------------------
    init() {
      // A flick starts from the room's own touch, which may not say which finger it was: it takes the first one that moves.
      const mine = (e) => { if (!Tools.drag) return false; if (Tools.drag.id === null) Tools.drag.id = e.pointerId; return e.pointerId === Tools.drag.id; };
      window.addEventListener('pointermove', (e) => { if (mine(e)) Tools.move(e); }, { passive: true });
      window.addEventListener('pointerup', (e) => { if (mine(e)) Tools.end(e); });
      window.addEventListener('pointercancel', (e) => { if (Tools.drag && e.pointerId === Tools.drag.id) Tools.cancel(); });
      // A second finger means a pinch: no flick.
      window.addEventListener('pointerdown', (e) => { if (Tools.drag && e.pointerId !== Tools.drag.id && Tools.drag.tool === 'flick') Tools.cancel(); }, true);
    },
    // The grow room calls this when a finger goes down on a station with something ripe on it. x, y: where, on the page.
    flickStart(x, y) {
      if (Tools.drag) return false;
      Tools.begin('flick', { pointerId: null, clientX: x, clientY: y });
      return true;
    },
    begin(tool, e, extra = {}) {
      const ghost = document.createElement('div');
      ghost.id = 'tool-ghost';
      ghost.innerHTML = tool === 'seed' ? Tools.packet(extra.strain, 72) : `<img class="tool-art" src="assets/ui/${Tools.shearsArt()}.webp" alt="" draggable="false">`;
      if (tool === 'flick') { ghost.classList.add('swing'); ghost.style.visibility = 'hidden'; }
      $('ui').appendChild(ghost);
      Tools.drag = { tool, id: e.pointerId, sx: e.clientX, sy: e.clientY, lx: e.clientX, ly: e.clientY, cx: e.clientX, cy: e.clientY, angle: -20, moved: false, ghost, trailAt: 0, path: [{ x: e.clientX, y: e.clientY, t: performance.now() }], cut: 0, ...extra };
      Tools.place(e.clientX, e.clientY);
    },
    place(x, y) {
      const u = $('ui').getBoundingClientRect();
      const d = Tools.drag;
      // A seed is held up above the finger, so you can see the pot under it. The harvest tool is right on the finger,
      // leaning the way it's swung.
      const up = d.tool === 'seed' ? 84 : 42;
      d.ghost.style.transform = `translate(${x - u.left - 42}px, ${y - u.top - up}px)${d.tool === 'flick' ? ` rotate(${d.angle.toFixed(1)}deg)` : ''}`;
    },
    // The swing: the tool leans into the swipe and its trail follows, fading fast.
    swing(x, y, dx, dy) {
      const d = Tools.drag;
      const lean = Math.max(-55, Math.min(55, dx * 2.2));
      d.angle += (lean - d.angle) * 0.5;
      if (calm()) return;
      const now = performance.now();
      if (now - d.trailAt < 40) return;
      d.trailAt = now;
      const u = $('ui').getBoundingClientRect();
      const t = document.createElement('img');
      t.className = 'tool-trail';
      t.src = `assets/ui/${Tools.tool().trail}.webp`;
      t.style.left = `${x - u.left}px`;
      t.style.top = `${y - u.top}px`;
      t.style.transform = `translate(-50%, -50%) rotate(${Math.atan2(dy, dx).toFixed(2)}rad)`;
      $('ui').appendChild(t);
      setTimeout(() => t.remove(), 420);
    },
    // A burst where a plant was cut.
    pop(x, y) {
      if (calm()) return;
      const u = $('ui').getBoundingClientRect();
      const p = document.createElement('img');
      p.className = 'tool-pop';
      p.src = 'assets/ui/POP-01.webp';
      p.style.left = `${x - u.left}px`;
      p.style.top = `${y - u.top}px`;
      $('ui').appendChild(p);
      setTimeout(() => p.remove(), 460);
    },
    // What's under a page point in the room.
    hitAtPage(x, y) { const s = scene(); if (!s) return null; const p = s.pageToWorld(x, y); return s.hitAt(p.x, p.y); },
    // The tool passes over a page point: any ripe plant there is cut. Generous: the point and a little above it count.
    cutAt(x, y) {
      const g = PE.App.g, fid = fidNow();
      for (const yy of [y, y - 40]) {
        const hit = Tools.hitAtPage(x, yy);
        if (!hit || hit.ghost || hit.pump || hit.spray || hit.pi === null || hit.pi === undefined) continue;
        const p = g.grow.stationOf(fid, hit.si).pots[hit.pi];
        if (p && g.now() >= p.readyMs && g.grow.harvest(fid, hit.si, hit.pi)) { Tools.pop(x, yy); Tools.drag && (Tools.drag.cut += 1); PE.App.saveGame(); return true; }
      }
      return false;
    },
    // Along a line, every few pixels, so a fast swipe can't skip a plant.
    cutAlong(ax, ay, bx, by) {
      const n = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay) / STEP));
      for (let i = 1; i <= n; i++) Tools.cutAt(ax + ((bx - ax) * i) / n, ay + ((by - ay) * i) / n);
    },
    move(e) {
      const d = Tools.drag;
      const x = e.clientX, y = e.clientY;
      if (!d.moved && Math.hypot(x - d.sx, y - d.sy) > 12) { d.moved = true; d.ghost.style.visibility = ''; }
      d.path.push({ x, y, t: performance.now() });
      if (d.path.length > 8) d.path.shift();
      if (d.tool === 'flick' && d.moved) {
        Tools.swing(x, y, x - d.lx, y - d.ly);
        Tools.cutAlong(d.lx, d.ly, x, y);
      }
      d.lx = x; d.ly = y;
      Tools.place(x, y);
    },
    end(e) {
      const d = Tools.drag;
      if (d.tool === 'seed') {
        const S = Tools.stashAt;
        Tools.cancel();
        if (!d.moved) { if (S && Tools.plantSeed(d.strain, S.si, S.pi)) Tools.closeStash(); return; }
        // Dropped on an empty pot: planted. The seed is aimed by its packet, held just above the finger.
        const hit = Tools.hitAtPage(e.clientX, e.clientY - 60) || Tools.hitAtPage(e.clientX, e.clientY);
        if (hit && !hit.ghost && hit.pi !== null && hit.pi !== undefined && Tools.plantSeed(d.strain, hit.si, hit.pi)) Tools.closeStash();
        return;
      }
      // The flick.
      if (!d.moved) {
        // A plain tap: what the room does with any tap (a ripe plant is picked, anything else opens as usual).
        Tools.cancel();
        const s = scene();
        if (s) { const r = s.game.canvas.getBoundingClientRect(); s.tapAt(((d.cx - r.left) * s.scale.width) / r.width, ((d.cy - r.top) * s.scale.height) / r.height); }
        return;
      }
      // Thrown: the tool carries on along the swipe, cutting as it goes. The boomerang curves out and comes back.
      const first = d.path[0], last = d.path[d.path.length - 1];
      const ms = Math.max(1, last.t - first.t);
      const vx = (last.x - first.x) / ms, vy = (last.y - first.y) / ms;
      const speed = Math.hypot(vx, vy);
      if (speed < THROW_SPEED || calm()) { Tools.cancel(); return; }
      const dist = Math.min(THROW_MAX, speed * THROW_MS);
      const ux = vx / speed, uy = vy / speed;
      const boomerang = !!Tools.tool().boomerang && !PE.App.g.tutorial.active();
      const total = boomerang ? THROW_MS * 2 : THROW_MS;
      const t0 = performance.now();
      let px = last.x, py = last.y;
      Tools.flying = d;
      Tools.drag = null;
      const step = () => {
        if (Tools.flying !== d) return;
        const k = Math.min(1, (performance.now() - t0) / total);
        let x, y;
        if (boomerang) {
          // Out and back along a loop: forward, round to the side, home again.
          const a = k * Math.PI * 2;
          x = last.x + ux * dist * 0.5 * (1 - Math.cos(a)) - uy * dist * 0.28 * Math.sin(a);
          y = last.y + uy * dist * 0.5 * (1 - Math.cos(a)) + ux * dist * 0.28 * Math.sin(a);
          d.angle += 38;
        } else {
          const e2 = 1 - (1 - k) * (1 - k);
          x = last.x + ux * dist * e2;
          y = last.y + uy * dist * e2;
          d.angle += 22;
        }
        Tools.drag = d;
        Tools.cutAlong(px, py, x, y);
        Tools.swing(x, y, x - px, y - py);
        Tools.place(x, y);
        Tools.drag = null;
        px = x; py = y;
        if (k < 1) requestAnimationFrame(step);
        else { d.ghost.remove(); Tools.flying = null; }
      };
      requestAnimationFrame(step);
    },
    cancel() {
      if (!Tools.drag) return;
      Tools.drag.ghost.remove();
      Tools.drag = null;
    },
    // Where the guide's hand starts for each move (js/ui/tutorial_ui.js): the first seed in the stash.
    point(tool) {
      if (tool !== 'seed') return null;
      const b = document.querySelector('#seed-stash [data-seed]');
      if (!b) return null;
      const r = b.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    },
  };
  PE.GrowTools = Tools;
})(globalThis.PE = globalThis.PE || {});
