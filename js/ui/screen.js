// Shared drawing helpers: the screen size, the phone's safe areas, buttons on the canvas, and
// cutting a strain sheet into its six stage pictures.
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
    text.setStroke('#1d0f33', 5 * L.u).setDepth(2);
    const zone = scene.add.zone(x, y, w, h).setInteractive({ useHandCursor: true });
    zone.on('pointerup', onTap);
    // The real button art: the round ends stay the right shape and only the middle stretches.
    loadIcons(scene, [opts.art || 'BTN-01'], () => {
      const key = 'ui-' + (opts.art || 'BTN-01');
      const tex = scene.textures.get(key);
      const iw = tex.source[0].width, ih = tex.source[0].height;
      const cap = Math.round(iw * 0.3);
      if (!tex.has('L')) { tex.add('L', 0, 0, 0, cap, ih); tex.add('M', 0, cap, 0, iw - cap * 2, ih); tex.add('R', 0, iw - cap, 0, cap, ih); }
      const k = h / ih, capW = cap * k;
      g.clear();
      scene.add.image(x - w / 2, y, key, 'L').setOrigin(0, 0.5).setDisplaySize(capW, h).setDepth(1);
      scene.add.image(x, y, key, 'M').setDisplaySize(Math.max(1, w - capW * 2 + 1), h).setDepth(1);
      scene.add.image(x + w / 2, y, key, 'R').setOrigin(1, 0.5).setDisplaySize(capW, h).setDepth(1);
    });
    return { g, text, zone, x, y, w, h };
  }

  // Interface art for a canvas screen. Calls back once all are ready, or at once if they already are.
  // A picture that fails just stays missing: the caller's plain stand-in remains on screen.
  function loadIcons(scene, ids, onReady) {
    let left = ids.length;
    const one = () => { left--; if (!left && scene.sys.settings.status < Phaser.Scenes.SHUTDOWN) onReady(); };
    for (const id of ids) {
      const key = 'ui-' + id;
      if (scene.textures.exists(key)) { one(); continue; }
      const img = new Image();
      img.onload = () => { if (!scene.textures.exists(key)) scene.textures.addImage(key, img); one(); };
      img.onerror = one;
      img.src = `assets/ui/${id}.webp`;
    }
  }

  // Sheets being downloaded right now: id -> list of things waiting for it.
  // This belongs to the whole game, not one screen, because the player can leave a screen while
  // its art is still downloading (a quick tap on a slow connection).
  const waiting = new Map();

  // The game draws half-size copies of the strain sheets (assets/strains_s). A full sheet would
  // take about 6 MB of graphics memory; a room full of different strains would run a mid-range
  // phone out of memory. See tools/make_small_strains.js.
  const SHEET_SCALE = 0.5;
  const sheetUrl = (id) => `assets/strains_s/${id}.webp`;

  // Get a strain sheet ready, then call onReady, even if the art failed to load (the caller checks
  // and draws a plain placeholder). onReady is skipped if the screen has since been left.
  function loadStrain(scene, strainId, onReady) {
    const key = 'sheet-' + strainId;
    const finish = () => { if (scene.sys.settings.status < Phaser.Scenes.SHUTDOWN) onReady(); };
    if (scene.textures.exists(key)) { onReady(); return; }
    if (waiting.has(strainId)) { waiting.get(strainId).push(finish); return; }
    waiting.set(strainId, [finish]);

    const done = () => {
      const list = waiting.get(strainId);
      waiting.delete(strainId);
      list.forEach((fn) => fn());
    };
    const img = new Image();
    img.onload = () => { addFrames(scene.textures, key, strainId, img); done(); };
    img.onerror = () => { console.warn('Art failed to load: ' + strainId); done(); };
    img.src = sheetUrl(strainId);
  }

  function addFrames(textures, key, strainId, img) {
    const tex = textures.addImage(key, img);
    PE.Data.strainFrames.sheets[strainId].frames.forEach((f, i) => {
      tex.add('stage' + i, 0, f.x * SHEET_SCALE, f.y * SHEET_SCALE, f.w * SHEET_SCALE, f.h * SHEET_SCALE);
    });
  }

  PE.UI = { layout, addButton, loadIcons, loadStrain, sheetUrl, SHEET_SCALE };
})(globalThis.PE = globalThis.PE || {});
