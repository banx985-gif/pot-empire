// The tools you drag in a grow room: seed onto a pot, water onto a station, shears across ripe plants. Tapping everything
// still works just as it did: drags are an extra, never the only way.
//
// STAND-IN art until ACT-07 (shears), ACT-08 (big water drop) and ACT-10 (pointing hand) arrive: the shears and the hand
// are drawn right here, the water drop is the existing ACT-04 and the seed shows the strain's own logo.
(function (PE) {
  const $ = (id) => document.getElementById(id);
  const SHEARS = '<svg viewBox="0 0 64 64"><path d="M30 34 L10 6 L18 3 L35 28Z" fill="#dfe6f0" stroke="#1d0f33" stroke-width="3"/><path d="M34 34 L54 6 L46 3 L29 28Z" fill="#c4cedc" stroke="#1d0f33" stroke-width="3"/><circle cx="32" cy="32" r="4" fill="#ffd84d" stroke="#1d0f33" stroke-width="2"/><circle cx="19" cy="50" r="9" fill="none" stroke="#ff4fa3" stroke-width="6"/><circle cx="45" cy="50" r="9" fill="none" stroke="#ff4fa3" stroke-width="6"/><path d="M29 37 L23 43 M35 37 L41 43" stroke="#ff4fa3" stroke-width="6"/></svg>';
  const HAND = '<svg viewBox="0 0 64 64"><path d="M26 6c3 0 5 2 5 5v18l3-1c2-3 6-3 8 0l2-1c2-2 6-1 7 2l1 1c3-1 6 1 6 4v10c0 9-6 16-16 16H34c-5 0-8-2-11-6L9 38c-2-3 2-7 6-4l6 5V11c0-3 2-5 5-5z" fill="#ffe0bd" stroke="#1d0f33" stroke-width="3" stroke-linejoin="round"/></svg>';
  const scene = () => { const s = PE.App.game.scene.getScene('garage'); return s && s.scene.isActive() && s.ready ? s : null; };

  const Tools = {
    HAND,
    drag: null,
    shown: '',
    seedStrain() {
      const g = PE.App.g, fid = PE.App.router.current().params.fid;
      // Whatever was last grown here, otherwise the first strain you own.
      let last = null;
      g.grow.eachStation((f, si, st) => { if (f === fid && !last) last = st.lastStrains.find(Boolean) || null; });
      return last && g.grow.isStrainUnlocked(last) ? last : (Object.keys(g.state.unlockedStrains)[0] || 'STR-001');
    },
    icon(tool) {
      if (tool === 'shears') return SHEARS;
      if (tool === 'water') return PE.Dom.icon('ACT-04', 42);
      return `<img src="assets/logos/${Tools.seedStrain()}.webp" alt="" draggable="false">`;
    },
    sync() {
      const el = $('tools');
      if (!el) return;
      const route = PE.App.router.current();
      const on = !!route && route.name === 'garage' && !PE.Dom.panelRoute;
      if (!on) { el.hidden = true; return; }
      el.hidden = false;
      const sig = Tools.seedStrain();
      if (Tools.shown === sig && el.childElementCount) return;
      Tools.shown = sig;
      el.innerHTML = [['seed', 'Seed'], ['water', 'Water'], ['shears', 'Shears']].map(([t, name]) => `<button class="tool" data-tool="${t}" aria-label="${name}">${Tools.icon(t)}<span class="tool-tag">${name}</span></button>`).join('');
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
      $('ui').appendChild(ghost);
      Tools.drag = { tool, id: e.pointerId, sx: e.clientX, sy: e.clientY, moved: false, ghost, done: new Set() };
      Tools.place(e);
    },
    place(e) {
      const u = $('ui').getBoundingClientRect();
      // Held up above the finger, so you can see what's under it.
      Tools.drag.ghost.style.transform = `translate(${e.clientX - u.left - 36}px, ${e.clientY - u.top - 84}px)`;
    },
    // Where the tool's working end is: just above the finger.
    target(e) { const s = scene(); if (!s) return null; const p = s.pageToWorld(e.clientX, e.clientY - 56); return s.hitAt(p.x, p.y); },
    move(e) {
      const d = Tools.drag;
      if (!d.moved && Math.hypot(e.clientX - d.sx, e.clientY - d.sy) > 14) d.moved = true;
      Tools.place(e);
      if (!d.moved) return;
      const hit = Tools.target(e);
      if (!hit || hit.ghost) return;
      const g = PE.App.g, fid = PE.App.router.current().params.fid;
      // The shears work as they cross a ripe plant, and water as it crosses a station.
      if (d.tool === 'shears' && hit.pi !== null) {
        const p = g.grow.stationOf(fid, hit.si).pots[hit.pi];
        if (p && g.now() >= p.readyMs) { g.grow.harvest(fid, hit.si, hit.pi); PE.App.saveGame(); }
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
