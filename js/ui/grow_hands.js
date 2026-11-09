// Hands-on growing in the grow room (job 18): touch the things, not menus. Adds to the grow room (js/ui/grow_room.js):
//   - the water pump with a see-through tank beside each station. It fills by itself; tap the pump to fill it faster
//     (a wobble and a gurgle). Full: a "Spray!" button pops up above it. Tap it, or the sprinklers go off by themselves
//     a few seconds later (js/logic/grow.js has the rules). The sprinklers play the model's spray animation.
//   - the planted glow: a soft glow round every planted pot in its strain's rarity colour. Once the plant is ripe and its
//     quality shows, the glow gets stronger with the grade, and Exotic cycles through the rainbow.
// Placeholder art: the pump and tank aren't drawn yet (Aaron's art list). Until they come: the model's computer stand
// (HY-Mn-BASE) with a glass tank drawn by the game, and its water level.
(function (PE) {
  const P = PE.Screens.garage.prototype;
  const Layout = PE.Layout;
  const FONT = 'system-ui, sans-serif';
  const TANK = { w: 124, h: 176 };
  const SPRAY_SHOWS_MS = 4200;   // how long the sprinklers run when they go off
  // The same rarity colours as the cards and badges (css/main.css .r-Common ...).
  const RARITY = { Common: 0xcfd8dc, Uncommon: 0x9cff8a, Rare: 0x6fd3ff, Epic: 0xd39aff, Legendary: 0xffd84d, Mythic: 0xff7ac6 };
  // Glow strength: while growing (quality still hidden), then by grade once ripe: Standard, Fine, Premium, Top Shelf, Exotic.
  const GROWING_ALPHA = 0.26;
  const GRADE_ALPHA = [0.3, 0.42, 0.55, 0.7, 0.72];
  // Each model's water, so the tank matches its station.
  const WATER = { 1: 0x9cff5a, 2: 0xc77dff, 3: 0x52c8ff, 4: 0xffb347, 5: 0x7ff0ff };
  const strainRarity = (id) => { const s = PE.Data.strains.find((x) => x.id === id); return s ? s.rarity : 'Common'; };

  // ---- The pump and tank --------------------------------------------------------------------------------------------
  // Stands opposite the computer, on the station's other side.
  P.drawPump = function drawPump(v, si, st, pos) {
    const D = PE.Data;
    const M = Layout.model(D, st.model, this.faceOf(si));
    const base = Layout.piece(D, st.model, 'BASE');
    const x = pos.x - M.computer.x, y = pos.y + M.computer.y;
    this.part(v, `M${st.model}-BASE`, x, y, base.w, base.h, pos.y + 210, 0.5, 1);
    const top = y - base.h * 0.86;
    const g = this.add.graphics().setDepth(pos.y + 211).setPosition(x, top);
    v.parts.push(g);
    const btn = this.add.container(x, top - TANK.h - 64).setDepth(pos.y + 340).setVisible(false);
    const bg = this.add.graphics();
    bg.fillStyle(0x140a24, 1).fillRoundedRect(-96, -40, 192, 80, 32);
    bg.fillStyle(0xc6ff3d, 1).fillRoundedRect(-89, -33, 178, 66, 27);
    bg.fillStyle(0xffffff, 0.45).fillRoundedRect(-78, -27, 120, 14, 7);
    const label = this.add.text(0, 2, 'Spray!', { fontFamily: FONT, fontStyle: 'bold', fontSize: '40px', color: '#140a24' }).setOrigin(0.5);
    btn.add([bg, label]);
    btn.wantVisible = false;
    v.parts.push(btn);
    v.pump = {
      si, x, y, top, g, btn, level: -1, colour: WATER[st.model] || 0x52c8ff,
      box: { l: x - TANK.w / 2 - 34, r: x + TANK.w / 2 + 34, t: top - TANK.h - 14, b: y + 10 },
      btnBox: { l: x - 100, r: x + 100, t: btn.y - 46, b: btn.y + 46 },
    };
  };

  // The tank, drawn round its own spot (so it can wobble in place): glass, the water in it and the pump handle.
  P.drawTank = function drawTank(pump, level) {
    const G = pump.g;
    const w = TANK.w, h = TANK.h;
    G.clear();
    // The pump handle on its side, and the pipe up to the sprinklers.
    G.fillStyle(0x3a2b55, 1).fillRoundedRect(w / 2 - 6, -h * 0.72, 30, 14, 6);
    G.fillStyle(0xff4fa3, 1).fillCircle(w / 2 + 26, -h * 0.72 + 7, 13);
    G.fillStyle(0x6c6c80, 1).fillRect(-8, -h - 26, 16, 30);
    // Glass.
    G.fillStyle(0xffffff, 0.14).fillRoundedRect(-w / 2, -h, w, h, 20);
    // Water, filling from the bottom.
    const fill = Math.max(0, Math.min(1, level)) * (h - 14);
    if (fill > 2) {
      G.fillStyle(pump.colour, 0.85).fillRoundedRect(-w / 2 + 7, -7 - fill, w - 14, fill, Math.min(14, fill / 2));
      G.fillStyle(0xffffff, 0.35).fillRect(-w / 2 + 14, -7 - fill + 4, w - 28, 5);
    }
    // Marks up the side, and the shine.
    G.lineStyle(3, 0xffffff, 0.35);
    for (let k = 1; k < 4; k++) G.lineBetween(w / 2 - 22, -h * (k / 4), w / 2 - 10, -h * (k / 4));
    G.fillStyle(0xffffff, 0.3).fillRoundedRect(-w / 2 + 10, -h + 14, 12, h * 0.6, 6);
    G.lineStyle(6, 0xffffff, 0.85).strokeRoundedRect(-w / 2, -h, w, h, 20);
    G.lineStyle(3, 0x140a24, 0.9).strokeRoundedRect(-w / 2 - 3, -h - 3, w + 6, h + 6, 22);
  };

  P.updatePump = function updatePump(v, si, st, growing, now) {
    const pump = v.pump;
    if (!pump || this.testOverride) { if (pump && pump.level < 0) { this.drawTank(pump, 0.5); pump.level = 0.5; } return; }
    const level = this.g.grow.tankLevel(this.fid, si, now);
    if (Math.abs(level - pump.level) > 0.004) { this.drawTank(pump, level); pump.level = level; }
    // Full, with something growing: the Spray! button pops up and bobs.
    const ready = level >= 1 && growing;
    pump.btn.wantVisible = ready;
    pump.btn.setVisible(ready && v.shown !== false);
    if (ready && !pump.bob && !this.calm()) {
      pump.btn.setScale(0.4);
      pump.bob = this.tweens.chain({ targets: pump.btn, tweens: [
        { scale: 1, duration: 260, ease: 'Back.easeOut' },
        { y: pump.btn.y - 12, duration: 520, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' },
      ] });
    } else if (!ready && pump.bob) { pump.bob.stop(); pump.bob = null; pump.btn.setScale(1).setY(pump.btnBox.t + 46); }
  };

  // Moves the camera, if it has to, so a station's pump and its Spray! button can be seen (the guide uses it).
  P.showPump = function showPump(si) {
    const v = this.stationViews.get(si);
    if (!v || !v.pump) return;
    const p = v.pump, cam = this.cameras.main, w = cam.worldView;
    const m = 60;
    if (p.box.l > w.x + m && p.box.r < w.right - m && p.btnBox.t > w.y + m && p.box.b < w.bottom - m) return;
    cam.centerOn(p.x + Math.min(260, w.width * 0.25), (p.btnBox.t + p.box.b) / 2);
    cam.preRender();
    this.clampCamera();
  };
  // Where the pump is on the page, or its Spray! button once the tank's full (the guide points at it).
  P.pumpPagePoint = function pumpPagePoint(si) {
    const v = this.stationViews.get(si);
    if (!v || !v.pump) return null;
    const p = v.pump;
    if (p.btn.visible) return { ...this.worldToPage(p.x, p.btn.y), spray: true };
    return this.worldToPage(p.x, p.top - TANK.h / 2);
  };
  // What a tap at this room point lands on, if it's a pump or a Spray! button.
  P.hitPump = function hitPump(wx, wy) {
    for (const v of this.stationViews.values()) {
      const p = v.pump;
      if (!p || v.shown === false) continue;
      const B = p.btnBox;
      if (p.btn.visible && wx > B.l && wx < B.r && wy > B.t && wy < B.b) return { si: p.si, spray: true };
      const A = p.box;
      if (wx > A.l && wx < A.r && wy > A.t && wy < A.b) return { si: p.si, pump: true };
    }
    return null;
  };
  P.tapPump = function tapPump(hit) {
    const g = this.g;
    if (hit.spray) {
      if (g.grow.spray(this.fid, hit.si)) { PE.Sound.play('spray'); PE.App.saveGame(); }
      return;
    }
    const before = g.grow.tankLevel(this.fid, hit.si);
    if (before >= 1) { PE.Dom.toast('Full! Hit Spray!'); return; }
    g.grow.pump(this.fid, hit.si);
    PE.Sound.play('pump');
    if (PE.Haptics) PE.Haptics.light();
  };
  // A pump stroke: the tank wobbles.
  P.wobblePump = function wobblePump(si) {
    const v = this.stationViews.get(si);
    if (!v || !v.pump || this.calm()) return;
    const G = v.pump.g;
    if (v.pump.wob) v.pump.wob.stop();
    G.setScale(1);
    v.pump.wob = this.tweens.add({ targets: G, scaleX: 1.07, scaleY: 0.93, duration: 70, yoyo: true, repeat: 1, ease: 'Sine.easeInOut', onComplete: () => G.setScale(1) });
  };
  // The sprinklers went off: they run for a few seconds.
  P.sprayed = function sprayed(si) {
    const v = this.stationViews.get(si);
    if (v) v.sprayUntil = performance.now() + SPRAY_SHOWS_MS;
    this.lastRefresh = 0;
  };
  P.sprinklerOn = function sprinklerOn(v, si, growing) {
    if (this.testOverride) return growing;
    // A station that waters itself (sprinkler level 3 and up) keeps its sprinklers running while something grows.
    if (growing && this.g.grow.autoWaters(this.fid, si)) return true;
    return performance.now() < (v.sprayUntil || 0);
  };

  // A soft round glow, white so it can take any colour.
  function haloTexture(scene) {
    if (scene.textures.exists('pot-halo')) return;
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const x = c.getContext('2d');
    const g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.45, 'rgba(255,255,255,0.55)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g;
    x.fillRect(0, 0, 128, 128);
    scene.textures.addCanvas('pot-halo', c);
  }

  // ---- The planted glow ---------------------------------------------------------------------------------------------
  P.updateHalo = function updateHalo(pv, p, stage, x, pos, spot, depth, v) {
    if (pv.halo) { pv.halo.destroy(); pv.halo = null; }
    if (this.exoticHalos) this.exoticHalos.delete(pv);
    if (!p) return;
    haloTexture(this);
    const ripe = stage === 5;
    const alpha = ripe ? GRADE_ALPHA[Math.max(0, Math.min(4, p.q || 0))] : GROWING_ALPHA;
    const w = spot.w * (ripe ? 1.9 : 1.6);
    pv.halo = this.add.image(x, pos.y + spot.rim - 30, 'pot-halo').setDepth(depth - 2).setBlendMode(Phaser.BlendModes.ADD)
      .setDisplaySize(w, w * 0.9).setTint(RARITY[strainRarity(p.s)] || 0xffffff).setAlpha(alpha).setVisible(v.shown !== false);
    pv.halo.baseAlpha = alpha;
    // Exotic: a rainbow that slowly goes round.
    if (ripe && p.q >= 4) (this.exoticHalos = this.exoticHalos || new Set()).add(pv);
  };
  P.stepHalos = function stepHalos(time) {
    if (!this.exoticHalos || !this.exoticHalos.size || this.calm()) return;
    const c = Phaser.Display.Color.HSVToRGB(((time / 3000) % 1), 0.85, 1);
    for (const pv of this.exoticHalos) if (pv.halo && pv.halo.scene) pv.halo.setTint(c.color);
  };
})(globalThis.PE = globalThis.PE || {});
