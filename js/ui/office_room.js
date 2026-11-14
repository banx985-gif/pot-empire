// Job 25: the Research Lab and Empire Headquarters are rooms you walk into, like the shops and the depot (they used to
// open a menu over the map). Drawn by the game, because there's no room picture for them yet (registry ids F06-BASE and
// F12-BASE, both "planned"); the floor, wall and trim are themed and the trim colour follows the renovation.
//   Lab: one bench per research branch, with its flasks bubbling once it has a rank, its rank dots, and a green arrow
//        when the next rank can be bought. Tap a bench, or the token board, to open the lab's menu. Leafy works here.
//   HQ:  the big desk (tap: the HQ menu), the Empire board on the wall (tap: regional prestige) with a trophy for each
//        prestige so far. Haze sits in charge.
// Managers given to either place stand in it. All the numbers and buying stay in the Manage menu (js/ui/panels_empire.js).
(function (PE) {
  const FONT = 'system-ui, sans-serif';
  const TRIM = [0x7d8794, 0x3fbf5a, 0x3f8cff, 0xffc83d];   // renovation 0..3
  const FLASK = [0x61ffd2, 0xff6fb5, 0xffd84d, 0x8a7dff, 0x6fd0ff, 0xc6ff3d];

  class OfficeRoom extends Phaser.Scene {
    constructor() { super('office'); }
    init(params) { this.fid = params.fid; }
    calm() { return PE.App.calm(); }

    create() {
      this.g = PE.App.g;
      this.ready = false;
      this.lab = this.g.facilities.row(this.fid).mode === 'Research';
      this.L = PE.UI.layout(this);
      this.taps = [];          // { kind, id, x, y, w, h }: what can be tapped (the tests read this too)
      this.log = [];
      this.cameras.main.setBackgroundColor(this.lab ? '#16343a' : '#22172f');
      this.reno = (this.g.facilities.get(this.fid) || {}).renovation || 0;
      this.drawShell();
      this.dyn = this.add.graphics().setDepth(5);
      this.texts = [];
      if (this.lab) this.buildLab(); else this.buildHq();
      this.buildPeople();
      this.input.on('pointerup', (p) => this.tap(p.x, p.y));
      this.unsub = this.g.on((type) => { if (type === 'changed') this.dirty = true; });
      this.events.once('shutdown', () => { this.ready = false; this.unsub(); });
      this.ready = true;
      this.dirty = true;
      if (!this.calm()) this.cameras.main.fadeIn(170, 20, 10, 36);
      PE.Hud.refresh();
    }

    // ---- The room: wall, floor, the renovation trim, the sign ------------------------------------------------------
    drawShell() {
      const { L } = this;
      const u = L.u;
      const G = this.add.graphics().setDepth(0);
      const wallTop = L.top + 100 * u;
      this.wallY = wallTop + 210 * u;   // where the wall meets the floor
      if (this.lab) {
        G.fillStyle(0x1f5a63, 1).fillRect(0, 0, L.W, this.wallY);
        G.lineStyle(1.5 * u, 0xffffff, 0.08);
        for (let x = 0; x < L.W; x += 34 * u) G.lineBetween(x, 0, x, this.wallY);
        for (let y = 0; y < this.wallY; y += 34 * u) G.lineBetween(0, y, L.W, y);
        for (let y = this.wallY, r = 0; y < L.H; y += 56 * u, r++) {
          for (let x = (r % 2) * 56 * u - 56 * u, c = 0; x < L.W; x += 56 * u, c++) G.fillStyle((r + c) % 2 ? 0xc9d4d8 : 0xb3c0c5, 1).fillRect(x, y, 56 * u, 56 * u);
        }
      } else {
        G.fillStyle(0x2b2140, 1).fillRect(0, 0, L.W, this.wallY);
        for (let x = 0; x < L.W; x += 64 * u) G.fillStyle(0x33284b, 1).fillRect(x + 6 * u, 0, 52 * u, this.wallY);
        G.fillStyle(0x6b1f2b, 1).fillRect(0, this.wallY, L.W, L.H - this.wallY);
        G.lineStyle(3 * u, 0xffc83d, 0.25).strokeRect(28 * u, this.wallY + 40 * u, L.W - 56 * u, L.H - this.wallY - 200 * u);
      }
      // The renovation trim: grey, then green, blue and gold as the place is done up.
      G.fillStyle(TRIM[Math.min(3, this.reno)], 1).fillRect(0, this.wallY - 10 * u, L.W, 14 * u);
      G.fillStyle(0x000000, 0.22).fillRect(0, this.wallY + 4 * u, L.W, 10 * u);
      const name = this.g.facilities.row(this.fid).name.toUpperCase();
      this.add.text(L.W / 2, wallTop + 26 * u, name, { fontFamily: FONT, fontStyle: '900', fontSize: L.font(22), color: '#ffe9a0', stroke: '#140a24', strokeThickness: 5 * u }).setOrigin(0.5).setDepth(2);
      this.add.text(L.W / 2, wallTop + 52 * u, ['', 'Renovated', 'Renovated twice', 'Fully renovated'][Math.min(3, this.reno)], { fontFamily: FONT, fontStyle: 'bold', fontSize: L.font(11), color: '#ffffffaa' }).setOrigin(0.5).setDepth(2);
    }
    label(x, y, text, size = 12, colour = '#ffffff', origin = 0.5) {
      return this.add.text(x, y, text, { fontFamily: FONT, fontStyle: 'bold', fontSize: this.L.font(size), color: colour, align: 'center', stroke: '#140a24', strokeThickness: 4 * this.L.u }).setOrigin(origin, 0.5).setDepth(8);
    }

    // ---- The lab ----------------------------------------------------------------------------------------------------
    buildLab() {
      const { L } = this;
      const u = L.u;
      const R = this.g.research;
      // The token board on the wall.
      const bw = 200 * u, bh = 90 * u, bx = L.W / 2 - bw / 2, by = this.wallY - bh - 30 * u;
      const G = this.add.graphics().setDepth(1);
      G.fillStyle(0x0d1f24, 1).fillRoundedRect(bx, by, bw, bh, 10 * u);
      G.lineStyle(3 * u, 0x61ffd2, 0.7).strokeRoundedRect(bx, by, bw, bh, 10 * u);
      this.board = this.label(L.W / 2, by + bh / 2, '', 13, '#61ffd2');
      this.taps.push({ kind: 'board', id: 'tokens', x: bx, y: by, w: bw, h: bh });
      // One bench per branch, two across.
      const branches = R.branches();
      const cols = 2, rows = Math.ceil(branches.length / cols);
      const top = this.wallY + 40 * u, bottom = L.bottom - 170 * u;
      const cw = (L.right - L.left - 30 * u) / cols, ch = Math.min(150 * u, (bottom - top) / rows);
      this.benches = branches.map((b, i) => {
        const x = L.left + 15 * u + (i % cols) * cw, y = top + Math.floor(i / cols) * ch;
        const bench = { id: b.id, x: x + 10 * u, y, w: cw - 20 * u, h: ch - 16 * u, colour: FLASK[i % FLASK.length] };
        const g = this.add.graphics().setDepth(3);
        const ty = bench.y + bench.h * 0.55;
        g.fillStyle(0x000000, 0.2).fillRoundedRect(bench.x + 4 * u, ty + 26 * u, bench.w - 8 * u, 12 * u, 6 * u);
        g.fillStyle(0x56606b, 1).fillRect(bench.x + 12 * u, ty + 10 * u, 8 * u, 30 * u).fillRect(bench.x + bench.w - 20 * u, ty + 10 * u, 8 * u, 30 * u);
        g.fillStyle(0xe9eef0, 1).fillRoundedRect(bench.x, ty - 6 * u, bench.w, 20 * u, 6 * u);
        g.fillStyle(0xffffff, 1).fillRoundedRect(bench.x, ty - 6 * u, bench.w, 7 * u, 4 * u);
        bench.ty = ty;
        bench.name = this.label(bench.x + bench.w / 2, ty + 26 * u, b.id, 11, '#ffffff');
        bench.tag = this.add.graphics().setDepth(9);
        this.taps.push({ kind: 'bench', id: b.id, x: bench.x, y: bench.y, w: bench.w, h: bench.h });
        return bench;
      });
    }
    drawLab(t) {
      const u = this.L.u;
      const R = this.g.research, game = this.g;
      const D = this.dyn.clear();
      const max = game.B.research.ranks;
      let done = 0;
      for (const b of this.benches) {
        const rank = R.rankOf(b.id);
        done += Math.min(rank, max);
        // Flasks: one per rank, up to six; lit ones bubble.
        const n = 6, gap = (b.w - 30 * u) / n;
        for (let k = 0; k < n; k++) {
          const fx = b.x + 15 * u + gap * (k + 0.5), fy = b.ty - 6 * u;
          const lit = k < rank;
          const bob = lit && !this.calm() ? Math.sin(t / 300 + k) * 2 * u : 0;
          D.fillStyle(0xffffff, 0.35).fillRect(fx - 3 * u, fy - 30 * u, 6 * u, 12 * u);
          D.fillStyle(lit ? b.colour : 0x9aa7ad, lit ? 0.95 : 0.4).fillCircle(fx, fy - 12 * u, 10 * u);
          if (lit) D.fillStyle(0xffffff, 0.7).fillCircle(fx - 3 * u, fy - 16 * u + bob, 2.5 * u);
        }
        // Rank dots and the green arrow when the next rank is affordable.
        for (let k = 0; k < max; k++) D.fillStyle(k < rank ? 0xc6ff3d : 0x000000, k < rank ? 1 : 0.35).fillCircle(b.x + b.w / 2 + (k - (max - 1) / 2) * 13 * u, b.y + 8 * u, 4.5 * u);
        const c = R.cost(b.id);
        const can = c && game.canAfford('researchTokens', c.tokens) && game.canAfford('cash', c.cash);
        b.tag.clear();
        b.can = !!can;
        if (can) {
          const x = b.x + b.w - 14 * u, y = b.y + 10 * u + (this.calm() ? 0 : Math.abs(Math.sin(t / 350)) * -4 * u);
          b.tag.fillStyle(0x140a24, 1).fillCircle(x, y, 13 * u).fillStyle(0xc6ff3d, 1).fillCircle(x, y, 10.5 * u);
          b.tag.fillStyle(0x140a24, 1).fillTriangle(x - 5 * u, y + 2 * u, x + 5 * u, y + 2 * u, x, y - 6 * u).fillRect(x - 2 * u, y + 1 * u, 4 * u, 5 * u);
        }
      }
      this.board.setText(`${PE.Money.format(game.state.currencies.researchTokens)} tokens\n${done}/${R.nodeCount()} researched`);
    }

    // ---- HQ -----------------------------------------------------------------------------------------------------------
    buildHq() {
      const { L } = this;
      const u = L.u;
      const G = this.add.graphics().setDepth(1);
      // The Empire board on the wall.
      const bw = 230 * u, bh = 100 * u, bx = L.W / 2 - bw / 2, by = this.wallY - bh - 24 * u;
      G.fillStyle(0x10233a, 1).fillRoundedRect(bx, by, bw, bh, 8 * u);
      G.lineStyle(4 * u, 0x8a5f36, 1).strokeRoundedRect(bx, by, bw, bh, 8 * u);
      this.board = this.label(L.W / 2, by + bh / 2, '', 12, '#bfe3ff');
      this.taps.push({ kind: 'board', id: 'prestige', x: bx, y: by, w: bw, h: bh });
      // The trophy shelf, under the board.
      this.shelf = { x: L.left + 30 * u, y: this.wallY + 70 * u, w: L.right - L.left - 60 * u };
      G.fillStyle(0x8a5f36, 1).fillRect(this.shelf.x, this.shelf.y, this.shelf.w, 9 * u);
      // The big desk.
      const dw = Math.min(300 * u, L.right - L.left - 60 * u), dh = 90 * u, dx = L.W / 2 - dw / 2, dy = this.wallY + 210 * u;
      const D = this.add.graphics().setDepth(dy + dh);
      D.fillStyle(0x000000, 0.25).fillRoundedRect(dx + 6 * u, dy + dh - 6 * u, dw, 18 * u, 8 * u);
      D.fillStyle(0x5a3820, 1).fillRoundedRect(dx, dy, dw, dh, 10 * u);
      D.fillStyle(0x7a4a2c, 1).fillRoundedRect(dx, dy, dw, 22 * u, 10 * u);
      D.fillStyle(0x1d0f33, 1).fillRoundedRect(dx + dw * 0.62, dy - 46 * u, 70 * u, 44 * u, 5 * u);
      D.fillStyle(0x61ffd2, 0.8).fillRect(dx + dw * 0.62 + 5 * u, dy - 41 * u, 60 * u, 30 * u);
      D.fillStyle(0xffd84d, 1).fillRoundedRect(dx + dw * 0.18, dy - 12 * u, 46 * u, 14 * u, 4 * u);
      this.desk = { x: dx, y: dy, w: dw, h: dh };
      this.label(L.W / 2, dy + dh * 0.62, 'THE BOSS', 12, '#ffe9a0');
      this.taps.push({ kind: 'desk', id: 'hq', x: dx, y: dy - 50 * u, w: dw, h: dh + 50 * u });
    }
    drawHq(t) {
      const u = this.L.u;
      const game = this.g;
      const D = this.dyn.clear();
      const prestiges = game.state.prestigeHistory.length;
      this.board.setText(`EMPIRE\n${prestiges} prestige${prestiges === 1 ? '' : 's'} · level ${game.state.player.level}\n${PE.Money.format(game.state.currencies.empireShares)} Empire Shares`);
      // One cup per prestige (up to a shelf full), a gentle shine on the newest.
      const S = this.shelf, n = Math.min(10, prestiges);
      for (let k = 0; k < n; k++) {
        const x = S.x + 20 * u + k * ((S.w - 40 * u) / 9), y = S.y;
        D.fillStyle(0xffc83d, 1).fillRect(x - 3 * u, y - 10 * u, 6 * u, 10 * u).fillRect(x - 8 * u, y - 3 * u, 16 * u, 3 * u);
        D.fillStyle(0xffd84d, 1).fillRoundedRect(x - 9 * u, y - 26 * u, 18 * u, 17 * u, 5 * u);
        if (k === n - 1 && !this.calm()) D.fillStyle(0xffffff, 0.3 + 0.3 * Math.sin(t / 400)).fillCircle(x - 3 * u, y - 20 * u, 3 * u);
      }
      if (!n) this.emptyShelf = this.emptyShelf || this.label(this.L.W / 2, S.y - 14 * u, 'Your prestige trophies go here', 10, '#ffffffaa');
    }

    // ---- People: Leafy in the lab, Haze at HQ, and any managers working here ----------------------------------------
    buildPeople() {
      const { L } = this;
      const u = L.u;
      const H = 120 * u;
      this.people = [];
      const add = (id, x, y, move) => {
        const a = new PE.Anim.Actor(this, id, { x, y, height: H });
        if (a.clash) { a.image.destroy(); return null; }
        if (move) a.play(move);
        this.people.push(a);
        return a;
      };
      if (this.lab) {
        const b = this.benches[0];
        // Behind her bench, so it hides her legs: she's working at it.
        this.boss = add('LEAFY', b ? b.x + b.w * 0.2 : L.W * 0.3, b ? b.ty + 12 * u : this.wallY + 120 * u, 'think');
        if (this.boss) this.boss.image.setDepth(2.5);
      } else {
        this.boss = add('HAZE', this.desk.x + this.desk.w * 0.3, this.desk.y + 55 * u, 'idle');
        if (this.boss) this.boss.image.setDepth(this.desk.y + this.desk.h - 1);
      }
      const managers = this.g.collections.managersAt(this.fid);
      managers.forEach((id, i) => add(id, L.left + (i % 2 ? L.right - L.left - 50 * u : 50 * u), L.bottom - 190 * u - Math.floor(i / 2) * 40 * u, 'idle'));
      this.nextMove = 4000;
    }

    // ---- Taps ---------------------------------------------------------------------------------------------------------
    tap(x, y) {
      if (!this.ready || (PE.Dom && PE.Dom.panelRoute)) return;
      const hit = this.taps.find((r) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h);
      if (!hit) return;
      this.log.push(hit.kind + ':' + hit.id);
      PE.Sound && PE.Sound.play && PE.Sound.play('tap');
      if (hit.kind === 'board' && hit.id === 'prestige') { PE.App.router.go('prestige', {}); return; }
      PE.App.openPanel('business', { fid: this.fid });
    }

    update(time, delta) {
      if (!this.ready) return;
      PE.Anim.stepAll(this, Math.min(0.1, (delta || 16) / 1000));
      if (this.boss && !this.calm()) {
        this.nextMove -= delta || 16;
        if (this.nextMove <= 0) {
          this.nextMove = 6000 + Math.random() * 5000;
          const moves = this.lab ? ['think', 'puzzled', 'stretch', 'idle'] : ['idle', 'talk', 'peace', 'inspect'];
          this.boss.play(moves[Math.floor(Math.random() * moves.length)]);
        }
      }
      if (this.dirty || time - (this.last || 0) > 120) {
        this.last = time; this.dirty = false;
        if (this.lab) this.drawLab(time); else this.drawHq(time);
      }
    }
  }

  PE.Screens.office = OfficeRoom;
  PE.OfficeRoom = OfficeRoom;
})(globalThis.PE = globalThis.PE || {});
