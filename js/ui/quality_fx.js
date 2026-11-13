// Quality grades shown as reusable effects over the plant, never redrawn plants (bible section 5).
// The pictures are PLACEHOLDERS made from plain shapes (asset registry: FX-QUALITY, planned).
//   Standard: nothing   Fine: sparkles   Premium: stars   Top Shelf: stars + glow   Exotic: rainbow + stars + glow
(function (PE) {
  const { WORLD } = PE.Layout;

  function makeTextures(scene) {
    if (scene.textures.exists('fx-star')) return;
    const g = scene.make.graphics({ add: false });
    // Sparkle: thin four-point star.
    g.fillStyle(0xffffff, 1);
    g.fillPoints([{ x: 16, y: 0 }, { x: 19, y: 13 }, { x: 32, y: 16 }, { x: 19, y: 19 }, { x: 16, y: 32 }, { x: 13, y: 19 }, { x: 0, y: 16 }, { x: 13, y: 13 }], true);
    g.generateTexture('fx-sparkle', 32, 32);
    g.clear();
    // Star: five points.
    const pts = [];
    for (let i = 0; i < 10; i++) {
      const r = i % 2 ? 7 : 16, a = -Math.PI / 2 + (i * Math.PI) / 5;
      pts.push({ x: 16 + Math.cos(a) * r, y: 16 + Math.sin(a) * r });
    }
    g.fillStyle(0xffd84d, 1);
    g.fillPoints(pts, true);
    g.generateTexture('fx-star', 32, 32);
    g.clear();
    // Glow: soft rings.
    for (let r = 64; r > 0; r -= 8) { g.fillStyle(0xfff6b0, 0.035); g.fillCircle(64, 64, r); }
    g.generateTexture('fx-glow', 128, 128);
    g.clear();
    // Rainbow: a simple arc of six bands.
    const bands = [0xff4f4f, 0xff9a3c, 0xffe14d, 0x6ee05a, 0x52a6ff, 0xb46bff];
    bands.forEach((c, i) => {
      g.lineStyle(5, c, 0.8);
      g.beginPath();
      g.arc(80, 80, 76 - i * 5, Math.PI, 0, false);
      g.strokePath();
    });
    g.generateTexture('fx-rainbow', 160, 84);
    g.destroy();
  }

  // Fixed spots around the plant, so an effect never reaches outside the space the layout reserves.
  const SPOTS = [[-46, -60], [40, -82], [-18, -122], [52, -40], [-58, -100], [14, -50]];

  function create(scene, x, potY, grade) {
    if (!grade) return null;
    makeTextures(scene);
    const base = potY - WORLD.potBaseForFx;
    const c = scene.add.container(x, base).setDepth(potY + 4);
    if (grade >= 3) c.add(scene.add.image(0, -66, 'fx-glow').setScale(1.15).setAlpha(0.8));
    if (grade === 4) c.add(scene.add.image(0, -118, 'fx-rainbow').setScale(0.85).setAlpha(0.6));
    const tex = grade === 1 ? 'fx-sparkle' : 'fx-star';
    const count = [0, 3, 4, 5, 6][grade];
    for (let i = 0; i < count; i++) c.add(scene.add.image(SPOTS[i][0], SPOTS[i][1], tex).setScale(0.75));
    // Colour-blind friendly: a shape and letter for the grade, not only colours and sparkles.
    if (PE.App.state.settings.colourBlind) {
      const mark = ['', '▲ F', '■ P', '◆ T', '★ E'][grade];
      c.add(scene.add.text(0, -150, mark, { fontFamily: 'system-ui, sans-serif', fontStyle: '900', fontSize: '26px', color: '#ffffff', stroke: '#1d0f33', strokeThickness: 6 }).setOrigin(0.5));
    }
    if (!PE.App.calm()) {
      c.tween = scene.tweens.add({ targets: c, alpha: 0.55, yoyo: true, repeat: -1, duration: 800, ease: 'Sine.easeInOut' });
      c.once('destroy', () => c.tween.stop());
    }
    return c;
  }

  PE.QualityFx = { create };
})(globalThis.PE = globalThis.PE || {});
