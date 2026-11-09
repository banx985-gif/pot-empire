// The title screen. Other screens: grow_room.js (Phaser) and panels_*.js (menus).
(function (PE) {
  const FONT = 'system-ui, sans-serif';

  const SPLASHES = ['SPLASH-01', 'SPLASH-02', 'SPLASH-03', 'SPLASH-04'];
  class TitleScreen extends Phaser.Scene {
    constructor() { super('title'); }
    // The next splash in turn, remembered on this phone (if it can't be, one at random).
    static nextSplash() {
      let n = Math.floor(Math.random() * SPLASHES.length);
      try { const last = Number(localStorage.getItem('pe-splash')); if (Number.isFinite(last) && localStorage.getItem('pe-splash') !== null) n = (last + 1) % SPLASHES.length; localStorage.setItem('pe-splash', String(n)); } catch (e) { /* private window: random */ }
      return SPLASHES[n];
    }

    create() {
      const L = PE.UI.layout(this);
      const midX = (L.left + L.right) / 2;
      // The real title logo. If it can't load, plain words stand in.
      PE.UI.loadIcons(this, ['LOGO-01'], () => {
        if (!this.textures.exists('ui-LOGO-01')) {
          this.add.text(midX, L.top + 90 * L.u, 'POT EMPIRE TYCOON', { fontFamily: FONT, fontStyle: '900', fontSize: L.font(34), color: '#c6ff3d' }).setOrigin(0.5);
          return;
        }
        const logo = this.add.image(midX, L.top + 14 * L.u, 'ui-LOGO-01').setOrigin(0.5, 0).setDepth(5);
        const w = Math.min((L.right - L.left) * 0.86, (L.bottom - L.top) * 0.24 * (logo.width / logo.height));
        logo.setDisplaySize(w, w * (logo.height / logo.width));
      });

      // Job 19B: one of Aaron's four splash pictures (art/brand/SPLASH-01..04), a different one each time the game starts.
      // The whole square picture is shown between the logo and the START button (no faces cut off); behind it, the
      // same picture fills the screen, faded, so there are no bars. Loaded only for this screen, let go when it closes.
      const which = TitleScreen.nextSplash();
      const key = 'title-splash';
      const pic = new Image();
      pic.onload = () => {
        if (this.sys.settings.status >= Phaser.Scenes.SHUTDOWN) return;
        if (!this.textures.exists(key)) this.textures.addImage(key, pic);
        const W = this.scale.width, H = this.scale.height;
        const cover = Math.max(W / pic.width, H / pic.height);
        this.add.image(W / 2, H / 2, key).setScale(cover).setAlpha(0.32).setDepth(-2);
        this.add.rectangle(W / 2, H / 2, W, H, 0x140a24, 0.45).setDepth(-1);
        const top = L.top + (L.bottom - L.top) * 0.27, bottom = L.bottom - 150 * L.u;
        const size = Math.min((L.right - L.left) * 0.94, bottom - top);
        this.add.image(midX, (top + bottom) / 2, key).setDisplaySize(size, size).setDepth(1);
        this.splashShown = which;
      };
      pic.src = `assets/ui/${which}.webp`;
      this.events.once('shutdown', () => { pic.onload = null; if (this.textures.exists(key)) this.textures.remove(key); });

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
