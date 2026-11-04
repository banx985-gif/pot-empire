// The screens. They only draw and pass taps along; the rules live in js/logic/.
(function (PE) {
  const FONT = 'system-ui, sans-serif';

  // ---- Title screen (placeholder) -------------------------------------------------------------
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

      PE.UI.loadSheet(this, 'STR-001', () => {
        if (!this.textures.exists('sheet-STR-001')) return;
        const img = this.add.image(midX, (L.top + L.bottom) / 2 + 10 * L.u, 'sheet-STR-001', 'stage5');
        img.setScale(Math.min((L.right - L.left) * 0.75 / img.width, (L.bottom - L.top) * 0.42 / img.height));
      });

      this.startButton = PE.UI.addButton(this, midX, L.bottom - 110 * L.u, 240 * L.u, 64 * L.u, 'START', () => PE.App.router.go('garage'), { size: 26 });

      this.add.text(midX, L.bottom - 22 * L.u, `Build ${PE.BUILD.startsWith("__") ? "dev" : PE.BUILD}  ·  Fictional game for adults`, {
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

  // ---- Garage screen: empty for now, shows one strain's six stages ------------------------------
  class GarageScreen extends Phaser.Scene {
    constructor() { super('garage'); }

    create() {
      const L = PE.UI.layout(this);
      const midX = (L.left + L.right) / 2;
      const strains = PE.Data.strains;
      const state = PE.App.state;
      let index = strains.findIndex((s) => s.id === state.ui.garageStrainId);
      if (index < 0) index = 0;
      const strain = strains[index];
      this.strainId = strain.id;
      this.ready = false;

      this.backButton = PE.UI.addButton(this, L.left + 52 * L.u, L.top + 34 * L.u, 88 * L.u, 48 * L.u, 'Back', () => PE.App.back(), { fill: 0x5a3a8c, size: 16 });
      this.add.text(L.left + 106 * L.u, L.top + 18 * L.u, 'Garage Grow Den', {
        fontFamily: FONT, fontStyle: 'bold', fontSize: L.font(18), color: '#ffffff',
      });
      this.add.text(L.left + 106 * L.u, L.top + 40 * L.u, 'Empty for now: growing arrives in M1', {
        fontFamily: FONT, fontSize: L.font(12), color: '#b9a8d6',
      });

      this.add.text(midX, L.top + 88 * L.u, strain.name, {
        fontFamily: FONT, fontStyle: 'bold', fontSize: L.font(24), color: '#c6ff3d',
      }).setOrigin(0.5);
      this.add.text(midX, L.top + 114 * L.u, `${strain.id}  ·  ${strain.rarity}`, {
        fontFamily: FONT, fontSize: L.font(14), color: '#52e6ff',
      }).setOrigin(0.5);

      // Thumb zone: step through every strain, to check all the sheets on a real phone.
      const navY = L.bottom - 44 * L.u;
      const step = (by) => {
        const next = (index + by + strains.length) % strains.length;
        state.ui.garageStrainId = strains[next].id;
        PE.App.saveGame();
        this.scene.restart();
      };
      this.prevButton = PE.UI.addButton(this, L.left + 66 * L.u, navY, 116 * L.u, 60 * L.u, 'Prev', () => step(-1), { fill: 0x5a3a8c });
      this.nextButton = PE.UI.addButton(this, L.right - 66 * L.u, navY, 116 * L.u, 60 * L.u, 'Next', () => step(1), { fill: 0x5a3a8c });
      this.add.text(midX, navY, `${index + 1} / ${strains.length}`, {
        fontFamily: FONT, fontStyle: 'bold', fontSize: L.font(16), color: '#ffffff',
      }).setOrigin(0.5);

      const area = { x: L.left + 8 * L.u, y: L.top + 132 * L.u, w: L.right - L.left - 16 * L.u, h: navY - 40 * L.u - (L.top + 132 * L.u) };
      PE.UI.loadSheet(this, strain.id, () => {
        this.drawStages(L, strain.id, area);
        this.ready = true;
      });
    }

    drawStages(L, strainId, area) {
      const sheet = PE.Data.strainFrames.sheets[strainId];
      const names = PE.Data.strainFrames.stages;
      const hasArt = this.textures.exists('sheet-' + strainId);
      const cellW = area.w / 3, cellH = area.h / 2;
      const labelH = 22 * L.u, pad = 6 * L.u;
      const maxW = cellW - pad * 2, maxH = cellH - labelH - pad * 2;

      // The same zoom for the six plant stages so the growth reads true. The seed is drawn on
      // its own because seeds are painted huge on the sheet compared to the plants.
      const fit = (f) => Math.min(maxW / f.w, maxH / f.h);
      const plantZoom = Math.min(...sheet.frames.slice(1).map(fit));
      const box = this.add.graphics();
      sheet.frames.forEach((f, i) => {
        const col = i % 3, row = Math.floor(i / 3);
        const x = area.x + col * cellW, y = area.y + row * cellH;
        box.lineStyle(Math.max(1, L.u), 0xffffff, 0.22);
        box.strokeRoundedRect(x + 2 * L.u, y + 2 * L.u, cellW - 4 * L.u, cellH - 4 * L.u, 8 * L.u);
        const baseY = y + cellH - labelH - pad;
        const centreX = x + cellW / 2;
        if (hasArt) {
          const zoom = i === 0 ? Math.min(fit(f), plantZoom) : plantZoom;
          const img = this.add.image(centreX, baseY, 'sheet-' + strainId, 'stage' + i);
          img.setOrigin(0.5, 1).setScale(zoom);
        } else {
          // Plain placeholder if the art couldn't be loaded.
          const ph = this.add.graphics();
          ph.fillStyle(0x777777, 1);
          ph.fillRect(centreX - maxW / 3, baseY - maxH * 0.7, maxW * 2 / 3, maxH * 0.7);
        }
        this.add.text(centreX, y + cellH - labelH / 2 - 3 * L.u, names[i], {
          fontFamily: FONT, fontSize: L.font(12), color: '#e8def8',
        }).setOrigin(0.5);
      });
    }
  }

  PE.Screens = { title: TitleScreen, garage: GarageScreen };
})(globalThis.PE = globalThis.PE || {});
