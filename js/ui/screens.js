// The title screen. Other screens: grow_room.js (Phaser) and panels_*.js (menus).
(function (PE) {
  const FONT = 'system-ui, sans-serif';

  class TitleScreen extends Phaser.Scene {
    constructor() { super('title'); }

    create() {
      const L = PE.UI.layout(this);
      const midX = (L.left + L.right) / 2;
      this.add.text(midX, L.top + 70 * L.u, 'POT EMPIRE', {
        fontFamily: FONT, fontStyle: '900', fontSize: L.font(46), color: '#c6ff3d', stroke: '#ff4fa3', strokeThickness: 6 * L.u,
      }).setOrigin(0.5);
      this.add.text(midX, L.top + 118 * L.u, 'TYCOON', {
        fontFamily: FONT, fontStyle: '900', fontSize: L.font(30), color: '#52e6ff',
      }).setOrigin(0.5);

      PE.UI.loadStrain(this, 'STR-055', () => {
        if (!this.textures.exists('sheet-STR-055')) return;
        const img = this.add.image(midX, (L.top + L.bottom) / 2 + 10 * L.u, 'sheet-STR-055', 'stage5');
        img.setScale(Math.min((L.right - L.left) * 0.75 / img.width, (L.bottom - L.top) * 0.42 / img.height));
      });

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
