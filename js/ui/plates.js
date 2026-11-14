// Job 32: Aaron's blank UI plates (art/ui/plates/README.md): buttons (normal and pressed), header ribbons, section tabs,
// price plates, building labels and nameplates. The game types the words on top. data/plate_art.js (made by
// tools/import_plate_art.js) says which are in the game; each rule below is only added for a plate that is there, so a
// missing plate keeps the old coded look exactly as before.
(function (PE) {
  const P = () => (PE.Data.plateArt || { have: {} });
  const src = (id) => `assets/plates/${id}.webp`;
  const OUTLINE = 'text-shadow: -1.5px -1.5px 0 #1d0f33, 1.5px -1.5px 0 #1d0f33, -1.5px 1.5px 0 #1d0f33, 1.5px 1.5px 0 #1d0f33, 0 2px 0 #1d0f33, 0 -2px 0 #1d0f33, 2px 0 0 #1d0f33, -2px 0 0 #1d0f33;';
  // Which nameplate goes with whom: Rivals the pink and red spiky one, VIPs the crown, the helpers the blue and silver.
  // Job 33: customers the cream one with the pointer, managers the teal one with the crowd.
  const NAME_FOR = { RIVAL: 'NAME-02', VIP: 'NAME-VIP', HAZE: 'NAME-01', BUDZ: 'NAME-01', LEAFY: 'NAME-01', TERPZ: 'NAME-01', CUSTOMER: 'NAME-03', MANAGER: 'NAME-CROWD' };

  const Plates = {
    has: (id) => !!P().have[id],
    src,
    NAME_FOR,
    // A stretchable plate as a CSS border picture, drawn `height` page pixels tall: its ends keep their shape and only
    // the middle stretches (nine-slice). Sets only the picture and its edges, so a size rule can set them separately.
    slice(id) { const e = P().have[id].edge; return `border-image-source: url(${src(id)}); border-image-slice: ${e[0]} ${e[1]} ${e[2]} ${e[3]} fill; border-image-repeat: stretch;`; },
    widths(id, height) {
      const p = P().have[id], k = height / p.h;
      return `border-image-width: ${p.edge.map((v) => `${(v * k).toFixed(1)}px`).join(' ')}; border-image-outset: 0;`;
    },
    // A name on its nameplate, for a menu ('who' is RIVAL, VIP or a helper's id). Plain bold words when it isn't drawn.
    name(who, html) {
      const id = NAME_FOR[who];
      return id && Plates.has(id) ? `<b class="plate-name" data-plate="${id}">${html}</b>` : `<b>${html}</b>`;
    },
    // Job 33: an amount of one of the other kinds of money (tokens, tickets, shares) in a menu, on the gem-studded gold plate
    // (PRICE-04). Without the plate it's the same picture and number as before.
    cur(iconHtml, amount) { return `<span class="cur-plate">${iconHtml} ${amount}</span>`; },
    // Job 33: a staff heading (the manager list's job headings, and Manager in a building's menu) on the crowd nameplate.
    staffHead(html) { return Plates.has('NAME-CROWD') ? `<h4 class="staff-head">${Plates.name('MANAGER', html)}</h4>` : `<h4>${html}</h4>`; },

    css() {
      const has = Plates.has, out = [];
      const rule = (sel, body) => out.push(`${sel} { ${body} }`);
      // ---- Buttons: green (go, harvest), gold (buy, chests), pink (warnings), grey (can't yet), each with its pressed look.
      const BTN = [
        ['BTN-LIME-LONG', '#ui .btn.go, #ui .btn.harvest'],
        ['BTN-GOLD-LONG', '#ui .btn.buy, #ui .chest'],
        ['BTN-PINK-LONG', '#ui .btn.danger'],
        ['BTN-GREY-LONG', '#ui .btn.cant, #ui .btn[aria-disabled="true"], #ui .btn[disabled], #ui .btn.off-state'],
      ];
      const pressed = (sel) => sel.split(',').map((s) => `${s.trim()}:active`).join(', ');
      const sized = [];
      for (const [id, sel] of BTN) {
        if (!has(id)) continue;
        rule(sel, `${Plates.slice(id)} border-style: solid; border-color: transparent;`);
        if (has(`${id}-PRESSED`)) rule(pressed(sel), `${Plates.slice(`${id}-PRESSED`)}`);
        sized.push([id, sel]);
      }
      if (sized.length) {
        const all = sized.map(([, s]) => s).join(', ');
        const id = sized[0][0];
        rule(all, Plates.widths(id, 46));
        rule(all.split(',').map((s) => s.replace('#ui ', '#ui .row-btns ')).join(',') + ', ' + all.split(',').map((s) => `${s.trim()}.small`).join(', '), Plates.widths(id, 38));
      }
      // ---- Round map buttons: green, gold when something there is waiting for you, and the pressed look.
      if (has('BTN-LIME-ROUND')) rule('.map-side-btn span', `background-image: url(${src('BTN-LIME-ROUND')});`);
      if (has('BTN-GOLD-ROUND')) rule('.map-side-btn:has(.side-alert) > span:first-child', `background-image: url(${src('BTN-GOLD-ROUND')});`);
      if (has('BTN-LIME-ROUND-PRESSED')) rule('.map-side-btn:active > span:first-child, .map-side-btn.held > span:first-child', `background-image: url(${src('BTN-LIME-ROUND-PRESSED')});`);
      // Job 33: a round map button you can't use yet (Prestige before its level) is the grey round one.
      if (has('BTN-GREY-ROUND')) rule('.map-side-btn.locked > span:first-child, .map-side-btn.locked:active > span:first-child, .map-side-btn.locked.held > span:first-child', `background-image: url(${src('BTN-GREY-ROUND')});`);
      // Job 33: the On/Off switches in Settings are round: green when on, the second grey (BTN-GREY-ROUND-B) when off.
      if (has('BTN-LIME-ROUND') && has('BTN-GREY-ROUND-B')) {
        rule('#ui .btn.small.flip', `width: 50px; height: 50px; min-height: 0; padding: 0 0 2px; flex: none; border: 0 !important; border-image: none !important; background: url(${src('BTN-LIME-ROUND')}) center / contain no-repeat; color: #fff; font-size: 13px; font-weight: 900; animation: none; ${OUTLINE}`);
        rule('#ui .btn.small.flip[aria-pressed="false"]', `background-image: url(${src('BTN-GREY-ROUND-B')});`);
        if (has('BTN-LIME-ROUND-PRESSED')) rule('#ui .btn.small.flip[aria-pressed="true"]:active', `background-image: url(${src('BTN-LIME-ROUND-PRESSED')});`);
      }
      // ---- Tabs: the bottom tabs and the section tabs (chips). The picked one is lime with dark words.
      if (has('TAB-NORMAL') && has('TAB-SELECTED')) {
        rule('#bottomnav button, #ui .chip', `background: none !important; border-width: 1px !important; border-style: solid !important; border-color: transparent !important; ${Plates.slice('TAB-NORMAL')} ${Plates.widths('TAB-NORMAL', 50)} border-radius: 0;`);
        rule('#ui .chip', `${Plates.widths('TAB-NORMAL', 38)} padding: 8px 14px;`);
        rule('#bottomnav button.on, #ui .chip.on', `${Plates.slice('TAB-SELECTED')} color: #1d0f33 !important; text-shadow: 0 1px 0 #ffffff80;`);
      }
      // ---- Ribbons: every menu's title (RIB-02), pop-up titles (RIB-01) and the section titles inside menus (RIB-03).
      // (In the middle of the bar whichever side its close or back button is on.)
      if (has('RIB-02')) {
        // (A :has can't hold another :has, so the bar is set up for the ribbon whatever its title is.)
        rule('#panel header', 'position: relative; min-height: 46px;');
        rule('#panel header > .closer:not(.back)', 'margin-left: auto;');
        rule('#panel header > h2:not(:has(img))', `position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); flex: none; margin: 0; box-sizing: border-box; min-width: 150px; max-width: calc(100% - 104px); padding: 7px 46px 10px; text-align: center; color: #fff; ${OUTLINE} overflow: hidden; text-overflow: ellipsis; white-space: nowrap; pointer-events: none; border: 1px solid transparent; ${Plates.slice('RIB-02')} ${Plates.widths('RIB-02', 42)}`);
      }
      if (has('RIB-01')) rule('#modal .card > h3:not(:has(img)):not(:empty)', `width: fit-content; max-width: 100%; box-sizing: border-box; margin: 0 auto 12px; padding: 9px 50px 14px; text-align: center; color: #fff; ${OUTLINE} border: 1px solid transparent; ${Plates.slice('RIB-01')} ${Plates.widths('RIB-01', 54)}`);
      if (has('RIB-03')) rule('#panel .scroll > h4:not(.staff-head)', `width: fit-content; max-width: 100%; box-sizing: border-box; margin-left: auto; margin-right: auto; padding: 5px 40px 9px; text-align: center; color: #fff; ${OUTLINE} border: 1px solid transparent; ${Plates.slice('RIB-03')} ${Plates.widths('RIB-03', 36)}`);
      // ---- Price plates: the small info tags in menus (Level 12, Open, Owned) and the shop's big price. Dark words on cream.
      if (has('PRICE-01')) rule('#ui .tag:not(.go)', `background: none; border-radius: 0; color: #3a1d00; border: 1px solid transparent; padding: 5px 13px 6px; ${Plates.slice('PRICE-01')} ${Plates.widths('PRICE-01', 28)}`);
      // ---- Job 33: the top bar: your cash on the long plate (PRICE-05), gems on PRICE-03. The number is typed on top, dark on
      // the cream middle. The other kinds of money in menus on PRICE-04.
      if (has('PRICE-05')) {
        rule('#hud .cash', `display: flex; align-items: center; box-sizing: border-box; height: 38px; padding: 0 16px 1px 8px; color: #2b1600; font-size: 19px; font-weight: 900; text-shadow: 0 1px 0 #fff8; border: 1px solid transparent; ${Plates.slice('PRICE-05')} ${Plates.widths('PRICE-05', 38)}`);
        rule('#hud .cash .ico', 'flex: none; margin-right: 3px;');
        rule('#hud #cash-num', 'min-width: 0; overflow: hidden; text-overflow: ellipsis;');
      }
      if (has('PRICE-03')) rule('#hud .gems', `display: flex; align-items: center; box-sizing: border-box; height: 34px; padding: 0 12px 1px 7px; color: #3d1466; font-size: 15px; font-weight: 900; border: 1px solid transparent; ${Plates.slice('PRICE-03')} ${Plates.widths('PRICE-03', 34)}`);
      if (has('PRICE-05') || has('PRICE-03')) rule('.hud-top', 'gap: 6px;');
      if (has('PRICE-04')) rule('#ui .cur-plate', `display: inline-flex; align-items: center; gap: 3px; box-sizing: border-box; height: 32px; padding: 0 14px 1px; vertical-align: middle; color: #2b1600; font-weight: 900; border: 1px solid transparent; ${Plates.slice('PRICE-04')} ${Plates.widths('PRICE-04', 32)}`);
      if (has('PRICE-02')) rule('#ui .bigcash', `width: fit-content; margin: 8px auto !important; padding: 6px 40px 9px; color: #3a1d00; border: 1px solid transparent; ${Plates.slice('PRICE-02')} ${Plates.widths('PRICE-02', 62)}`);
      // ---- Nameplates (Plates.name): the whole plate, never squashed narrower than it's drawn; words in its middle.
      for (const id of Object.keys(P().have).filter((k) => k.startsWith('NAME-'))) {
        const p = P().have[id], h = 34, top = id === 'NAME-VIP' || id === 'NAME-CROWD' ? 0.3 : id === 'NAME-02' ? 0.1 : 0.04;
        const dark = id === 'NAME-03';
        rule(`.plate-name[data-plate="${id}"]`, `display: inline-flex; align-items: center; justify-content: center; box-sizing: border-box; height: ${h}px; min-width: ${Math.round((h * p.w) / p.h)}px; max-width: 100%; padding: ${Math.round(h * top)}px 18px 0; background: url(${src(id)}) center / 100% 100% no-repeat; color: ${dark ? '#1d0f33' : '#fff'}; font-size: 13.5px; font-weight: 900; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; ${dark ? '' : OUTLINE}`);
      }
      // Job 33: a staff heading sits in the middle of its row, on its nameplate (no ribbon).
      if (has('NAME-CROWD')) rule('#panel .scroll > h4.staff-head', 'text-align: center; margin: 12px 0 6px;');
      return out.join('\n');
    },
    // Puts the rules on the page (once). Done as the game starts.
    install() {
      if (typeof document === 'undefined' || document.getElementById('plate-css')) return;
      const st = document.createElement('style');
      st.id = 'plate-css';
      st.textContent = Plates.css();
      document.head.appendChild(st);
    },

    // ---- For the Phaser screens ----------------------------------------------------------------------------------------
    // The plate as a texture ('plate-<id>'), fetched once. ready(key) only if it's drawn. Returns false if it isn't.
    texture(scene, id, ready) {
      if (!Plates.has(id)) return false;
      const key = 'plate-' + id;
      if (scene.textures.exists(key)) { ready(key); return true; }
      const img = new Image();
      img.onload = () => {
        if (!scene.sys || scene.sys.settings.status >= Phaser.Scenes.SHUTDOWN) return;
        if (!scene.textures.exists(key)) scene.textures.addImage(key, img);
        ready(key);
      };
      img.src = src(id);
      return true;
    },
    // Several at once: done() once every drawn one of them is ready (straight away if none are drawn).
    textures(scene, ids, done) {
      const want = ids.filter(Plates.has);
      let left = want.length;
      if (!left) { done(); return; }
      for (const id of want) Plates.texture(scene, id, () => { if (--left === 0) done(); });
    },
    // A plate behind a typed Phaser label (origin 0.5, 0, like the map's names). It follows the label wherever it's
    // moved (call Plates.follow after moving it), and grows with its words but is never narrower than it's drawn.
    behind(scene, id, label, opts = {}) {
      return Plates.texture(scene, id, (key) => {
        if (!label.scene) return;
        if (label.plate) label.plate.destroy();
        label.plate = scene.add.image(label.x, label.y, key).setOrigin(0.5, 0.5);
        label.plate.padX = opts.padX || 0.55;   // parts of the label's height, each side
        label.plate.padY = opts.padY || 0.45;
        label.plate.lift = opts.lift || 0;      // nudges the words down (a crown or spikes on top), part of the plate's height
        label.once('destroy', () => { if (label.plate) label.plate.destroy(); });
        Plates.follow(label);
      });
    },
    follow(label) {
      const p = label.plate;
      if (!p || !p.scene) return;
      const sx = label.scaleX, sy = label.scaleY;
      const w = label.width * sx, h = label.height * sy;
      const src2 = p.texture.getSourceImage();
      const ph = h * (1 + 2 * p.padY) / (1 - p.lift);
      const pw = Math.max(w + 2 * h * p.padX, (ph * src2.width) / src2.height);
      p.setDisplaySize(pw, ph);
      p.setPosition(label.x - (label.originX - 0.5) * w, label.y + (0.5 - label.originY) * h - (ph * p.lift) / 2);
      p.setDepth(label.depth - 0.01).setVisible(label.visible).setAlpha(label.alpha);
    },
  };
  PE.Plates = Plates;
  Plates.install();
})(globalThis.PE = globalThis.PE || {});
