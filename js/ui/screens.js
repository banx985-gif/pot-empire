// The title screen. Other screens: grow_room.js (Phaser) and panels_*.js (menus).
(function (PE) {
  const FONT = 'system-ui, sans-serif';

  class TitleScreen extends Phaser.Scene {
    constructor() { super('title'); }

    create() {
      const L = PE.UI.layout(this);
      const midX = (L.left + L.right) / 2;
      // The real title logo. If it can't load, plain words stand in.
      PE.UI.loadIcons(this, ['LOGO-01'], () => {
        if (!this.textures.exists('ui-LOGO-01')) {
          this.add.text(midX, L.top + 90 * L.u, 'POT EMPIRE TYCOON', { fontFamily: FONT, fontStyle: '900', fontSize: L.font(34), color: '#c6ff3d' }).setOrigin(0.5);
          return;
        }
        const pic = this.add.image(midX, L.top + 14 * L.u, 'ui-LOGO-01').setOrigin(0.5, 0).setDepth(5);
        const w = Math.min((L.right - L.left) * 0.86, (L.bottom - L.top) * 0.36 * (pic.width / pic.height));
        pic.setDisplaySize(w, w * (pic.height / pic.width));
      });

      PE.UI.loadStrain(this, 'STR-055', () => {
        if (!this.textures.exists('sheet-STR-055')) return;
        const img = this.add.image(midX, (L.top + L.bottom) / 2 + 60 * L.u, 'sheet-STR-055', 'stage5');
        img.setScale(Math.min((L.right - L.left) * 0.75 / img.width, (L.bottom - L.top) * 0.42 / img.height));
      });

      // Uncle Haze in front of the plant, loaded only for this screen and let go when it closes.
      const hazeId = PE.Data.helperSprites.screens.title;
      const hazeKey = 'helper-' + hazeId;
      const hazeImg = new Image();
      hazeImg.onload = () => {
        if (this.sys.settings.status >= Phaser.Scenes.SHUTDOWN) return;
        if (!this.textures.exists(hazeKey)) this.textures.addImage(hazeKey, hazeImg);
        const size = Math.min((L.right - L.left) * 0.62, (L.bottom - L.top) * 0.34);
        this.add.image(L.left + (L.right - L.left) * 0.26, L.bottom - 150 * L.u, hazeKey).setOrigin(0.5, 0.96).setDisplaySize(size, size);
      };
      hazeImg.src = PE.HelperArt.url(hazeId);
      this.events.once('shutdown', () => { hazeImg.onload = null; if (this.textures.exists(hazeKey)) this.textures.remove(hazeKey); });

      this.startButton = PE.UI.addButton(this, midX, L.bottom - 110 * L.u, 240 * L.u, 64 * L.u, 'START',
        () => PE.App.goToRoom(PE.App.state.ui.lastRoom || 'F01'), { size: 26 });

      this.add.text(midX, L.bottom - 22 * L.u, `Build ${PE.BUILD.startsWith('__') ? 'dev' : PE.BUILD}  ·  Fictional game for adults`, {
        fontFamily: FONT, fontSize: L.font(12), color: '#b9a8d6',
      }).setOrigin(0.5);

      const notice = PE.App.saveNotice;
      if (notice) {
        this.add.text(midX, L.bottom - 170 * L.u, notice, {
          fontFamily: FONT, fontSize: L.font(14), color: '#ffd84d', align: 'center', wordWrap: { width: (L.right - L.left) * 0.9 },
        }).setOrigin(0.5);
      }
    }
  }

  PE.Screens = { title: TitleScreen };
})(globalThis.PE = globalThis.PE || {});
