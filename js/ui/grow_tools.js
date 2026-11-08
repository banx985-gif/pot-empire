// The tools you drag in a grow room: seed onto a pot, water onto a station, shears across ripe plants. Tapping everything
// still works just as it did: drags are an extra, never the only way.
//
// Art (job 17, art/ui/feel and art/tools): ACT-07 garden shears, ACT-08 water drop, ACT-09 seed packet (the strain's badge
// shows in its window), ACT-10 the guide's pointing glove. The harvest tools TOOL-01..05 are what you swing as you drag the
// shears across ripe plants, each with its own trail (TRAIL-01..05), and POP-01 bursts where a plant is cut. TOOL-00 stands
// for a tool not unlocked yet. Tools are only a look: they unlock with your level and change nothing else (see LIST).
// The stash jar (JAR-01..03) sits in the corner of the grow room: harvested buds fly into it.
(function (PE) {
  const $ = (id) => document.getElementById(id);
  const calm = () => (PE.App && PE.App.state.settings.reducedMotion);
  const HAND = '<img src="assets/ui/ACT-10.webp" alt="" draggable="false">';
  // The harvest tools, best last. Unlocked by player level; the best one you have is the one you swing.
  const LIST = [
    { id: 'TOOL-01', trail: 'TRAIL-01', name: 'Rusty Scissors', level: 1 },
    { id: 'TOOL-02', trail: 'TRAIL-02', name: 'Golden Shears', level: 8 },
    { id: 'TOOL-03', trail: 'TRAIL-03', name: 'Peace Boomerang', level: 18 },
    { id: 'TOOL-04', trail: 'TRAIL-04', name: 'Laser Trimmer', level: 30 },
    { id: 'TOOL-05', trail: 'TRAIL-05', name: 'Rainbow Scythe', level: 45 },
  ];
  // How full the stash jar looks: harvests banked for the factory (the stock's harvest units).
  const JAR_HALF = 1, JAR_FULL = 25;
  const scene = () => { const s = PE.App.game.scene.getScene('garage'); return s && s.scene.isActive() && s.ready ? s : null; };

  const Tools = {
    HAND,
    LIST,
    drag: null,
    shown: '',
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
    seedStrain() {
      const g = PE.App.g, fid = PE.App.router.current().params.fid;
      // Whatever was last grown here, otherwise the first strain you own.
      let last = null;
      g.grow.eachStation((f, si, st) => { if (f === fid && !last) last = st.lastStrains.find(Boolean) || null; });
      return last && g.grow.isStrainUnlocked(last) ? last : (Object.keys(g.state.unlockedStrains)[0] || 'STR-001');
    },
    icon(tool) {
      if (tool === 'shears') return `<img class="tool-art" src="assets/ui/${Tools.shearsArt()}.webp" alt="" draggable="false">`;
      if (tool === 'water') return '<img class="tool-art" src="assets/ui/ACT-08.webp" alt="" draggable="false">';
      // The seed packet, with the strain's badge in its window.
      return `<span class="seed-pack"><img class="tool-art" src="assets/ui/ACT-09.webp" alt="" draggable="false"><span class="seed-window">${PE.Dom.avatarPic(Tools.seedStrain(), 24)}</span></span>`;
    },
    sync() {
      const el = $('tools');
      if (!el) return;
      const route = PE.App.router.current();
      const on = !!route && route.name === 'garage' && !PE.Dom.panelRoute;
      Tools.syncJar(on);
      if (!on) { el.hidden = true; return; }
      el.hidden = false;
      const sig = Tools.seedStrain() + '|' + Tools.shearsArt();
      if (Tools.shown === sig && el.childElementCount) return;
      Tools.shown = sig;
      el.innerHTML = [['seed', 'Seed'], ['water', 'Water'], ['shears', 'Shears']].map(([t, name]) => `<button class="tool" data-tool="${t}" aria-label="${name}">${Tools.icon(t)}<span class="tool-tag">${name}</span></button>`).join('');
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
        return `<div class="tool-row ${t === cur ? 'on' : ''}"><img src="assets/ui/${open ? t.id : 'TOOL-00'}.webp" alt="" draggable="false"><span><b>${open ? t.name : 'Locked'}</b><small>${open ? (t === cur ? 'Swinging this one' : 'Unlocked') : 'Opens at level ' + t.level}</small></span></div>`;
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
    init() {
      const el = $('tools');
      el.addEventListener('pointerdown', (e) => {
        const b = e.target.closest('[data-tool]');
        if (!b || Tools.drag || !scene()) return;
        e.preventDefault();
        e.stopPropagation();
        Tools.begin(b.dataset.tool, e);
      });
      window.addEventListener('pointermove', (e) => { if (Tools.drag && e.pointerId === Tools.drag.id) Tools.move(e); }, { passive: true });
      window.addEventListener('pointerup', (e) => { if (Tools.drag && e.pointerId === Tools.drag.id) Tools.end(e); });
      window.addEventListener('pointercancel', (e) => { if (Tools.drag && e.pointerId === Tools.drag.id) Tools.cancel(); });
    },
    begin(tool, e) {
      const ghost = document.createElement('div');
      ghost.id = 'tool-ghost';
      ghost.innerHTML = Tools.icon(tool);
      if (tool === 'shears') ghost.classList.add('swing');
      $('ui').appendChild(ghost);
      Tools.drag = { tool, id: e.pointerId, sx: e.clientX, sy: e.clientY, lx: e.clientX, ly: e.clientY, angle: -20, moved: false, ghost, done: new Set(), trailAt: 0 };
      Tools.place(e);
    },
    place(e) {
      const u = $('ui').getBoundingClientRect();
      const d = Tools.drag;
      // Held up above the finger, so you can see what's under it. The harvest tool leans the way it's swung.
      d.ghost.style.transform = `translate(${e.clientX - u.left - 36}px, ${e.clientY - u.top - 84}px)${d.tool === 'shears' ? ` rotate(${d.angle.toFixed(1)}deg)` : ''}`;
    },
    // The swing: the tool leans into the swipe and its trail follows, fading fast.
    swing(e) {
      const d = Tools.drag;
      const dx = e.clientX - d.lx, dy = e.clientY - d.ly;
      if (Math.hypot(dx, dy) < 6) return;
      d.lx = e.clientX; d.ly = e.clientY;
      const lean = Math.max(-55, Math.min(55, dx * 2.2));
      d.angle += (lean - d.angle) * 0.5;
      if (calm()) return;
      const now = performance.now();
      if (now - d.trailAt < 45) return;
      d.trailAt = now;
      const u = $('ui').getBoundingClientRect();
      const t = document.createElement('img');
      t.className = 'tool-trail';
      t.src = `assets/ui/${Tools.tool().trail}.webp`;
      t.style.left = `${e.clientX - u.left}px`;
      t.style.top = `${e.clientY - u.top - 56}px`;
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
    // Where the tool's working end is: just above the finger.
    target(e) { const s = scene(); if (!s) return null; const p = s.pageToWorld(e.clientX, e.clientY - 56); return s.hitAt(p.x, p.y); },
    move(e) {
      const d = Tools.drag;
      if (!d.moved && Math.hypot(e.clientX - d.sx, e.clientY - d.sy) > 14) d.moved = true;
      if (d.moved && d.tool === 'shears') Tools.swing(e);
      Tools.place(e);
      if (!d.moved) return;
      const hit = Tools.target(e);
      if (!hit || hit.ghost) return;
      const g = PE.App.g, fid = PE.App.router.current().params.fid;
      // The shears work as they cross a ripe plant, and water as it crosses a station.
      if (d.tool === 'shears' && hit.pi !== null) {
        const p = g.grow.stationOf(fid, hit.si).pots[hit.pi];
        if (p && g.now() >= p.readyMs) { g.grow.harvest(fid, hit.si, hit.pi); Tools.pop(e.clientX, e.clientY - 56); PE.App.saveGame(); }
      }
      if (d.tool === 'water' && !d.done.has(hit.si)) {
        d.done.add(hit.si);
        g.grow.service(fid, hit.si);
        PE.App.saveGame();
      }
    },
    end(e) {
      const d = Tools.drag;
      const hit = d.moved ? Tools.target(e) : null;
      Tools.cancel();
      if (!d.moved) { Tools.tapped(d.tool); return; }
      if (d.tool === 'seed' && hit && !hit.ghost && hit.pi !== null) {
        const g = PE.App.g, fid = PE.App.router.current().params.fid;
        if (!g.grow.stationOf(fid, hit.si).pots[hit.pi] && g.grow.plant(fid, hit.si, hit.pi, Tools.seedStrain())) PE.App.saveGame();
      }
    },
    cancel() {
      if (!Tools.drag) return;
      Tools.drag.ghost.remove();
      Tools.drag = null;
    },
    // A plain tap on a tool does the obvious thing, so nobody ever has to drag.
    tapped(tool) {
      const g = PE.App.g, fid = PE.App.router.current().params.fid;
      const count = g.facilities.ownedStationCount(fid);
      if (tool === 'water') {
        let any = false;
        for (let si = 0; si < count; si++) if (g.grow.waterMeter(fid, si) < 1 && g.grow.stationOf(fid, si).pots.some(Boolean)) { g.grow.service(fid, si); any = true; }
        if (!any) PE.Dom.toast('Everything has plenty of water.');
        PE.App.saveGame();
      } else if (tool === 'shears') {
        for (let si = 0; si < count; si++) {
          const pi = g.grow.stationOf(fid, si).pots.findIndex((p) => p && g.now() >= p.readyMs);
          if (pi >= 0) { g.grow.harvest(fid, si, pi); PE.App.saveGame(); return; }
        }
        PE.Dom.toast('Nothing ripe yet.');
      } else {
        for (let si = 0; si < count; si++) {
          const pi = g.grow.stationOf(fid, si).pots.findIndex((p) => !p);
          if (pi >= 0) { PE.App.openPanel('strainPicker', { fid, si, pi }); return; }
        }
        PE.Dom.toast('All your pots are full.');
      }
    },
    point(tool) { const b = document.querySelector(`#tools [data-tool="${tool}"]`); if (!b) return null; const r = b.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; },
  };
  PE.GrowTools = Tools;
})(globalThis.PE = globalThis.PE || {});
