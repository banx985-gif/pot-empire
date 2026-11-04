// Shared drawing helpers for all screens: the screen size, the phone's safe areas, buttons,
// and cutting a strain sheet into its six stage pictures.
(function (PE) {
  // Read the phone's safe areas (notch, rounded corners) from the CSS helper box in index.html.
  function readSafeInsets() {
    const box = document.getElementById('safe-probe');
    const css = box ? getComputedStyle(box) : null;
    const px = (v) => (css ? parseFloat(css[v]) || 0 : 0);
    return { top: px('paddingTop'), right: px('paddingRight'), bottom: px('paddingBottom'), left: px('paddingLeft') };
  }

  // The drawing surface is sized in real screen pixels so text and art stay sharp.
  // Every length on screen is given in "u": 1u is 1/390th of the width, about one finger-point.
  function layout(scene) {
    const dpr = PE.App.dpr;
    const W = scene.scale.width, H = scene.scale.height;
    const s = readSafeInsets();
    const u = W / 390;
    return {
      W, H, u,
      left: s.left * dpr,
      right: W - s.right * dpr,
      top: s.top * dpr,
      bottom: H - s.bottom * dpr,
      font: (size) => `${Math.round(size * u)}px`,
    };
  }

  function addButton(scene, x, y, w, h, label, onTap, opts = {}) {
    const L = layout(scene);
    const g = scene.add.graphics();
    g.fillStyle(opts.fill ?? 0xff4fa3, 1);
    g.fillRoundedRect(x - w / 2, y - h / 2, w, h, 14 * L.u);
    g.lineStyle(Math.max(1, 1.5 * L.u), 0xffffff, 0.9);
    g.strokeRoundedRect(x - w / 2, y - h / 2, w, h, 14 * L.u);
    const text = scene.add.text(x, y, label, {
      fontFamily: 'system-ui, sans-serif', fontStyle: 'bold', fontSize: L.font(opts.size ?? 20), color: '#ffffff',
    }).setOrigin(0.5);
    const zone = scene.add.zone(x, y, w, h).setInteractive({ useHandCursor: true });
    zone.on('pointerup', onTap);
    return { g, text, zone, x, y, w, h };
  }

  // Load a strain sheet (if not already loaded). onReady runs when loading ends, even on failure.
  function loadSheet(scene, strainId, onReady) {
    const key = 'sheet-' + strainId;
    const done = () => { addFrames(scene, strainId); onReady(); };
    if (scene.textures.exists(key)) { done(); return; }
    scene.load.image(key, `assets/strains/${strainId}.webp`);
    scene.load.once('complete', done);
    scene.load.start();
  }

  function addFrames(scene, strainId) {
    const key = 'sheet-' + strainId;
    if (!scene.textures.exists(key)) return;
    const tex = scene.textures.get(key);
    PE.Data.strainFrames.sheets[strainId].frames.forEach((f, i) => {
      if (!tex.has('stage' + i)) tex.add('stage' + i, 0, f.x, f.y, f.w, f.h);
    });
  }

  PE.UI = { layout, addButton, loadSheet };
})(globalThis.PE = globalThis.PE || {});
