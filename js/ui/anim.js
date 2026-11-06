// The character animation player. Any character can use it: it looks up which moves exist for them (data/anim_art.js,
// data/anim_moves.js), and with no frames it shows their still picture with a gentle bob instead.
//   PE.Anim.Actor     a character standing in a Phaser scene (the map, rooms)
//   PE.AnimDom        a character in a pop-up or menu (no canvas needed)
// Frames are only fetched when needed, and a scene lets go of its sheets when it closes. With reduced motion everyone
// stands still on the first frame.
(function (PE) {
  const Pick = () => PE.AnimPick;
  const Art = () => PE.Data.animArt;
  const calm = () => (PE.App && PE.App.state.settings.reducedMotion) || (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const shuffled = (list, count) => { const out = []; for (let i = 0; i < count; i++) out.push(list[Math.floor(Math.random() * list.length)]); return out; };
  const sizeOf = (id) => (PE.Data.animMoves.size || {})[id] || 1;

  // A still picture, for those with no frames yet: portraits (M01), walkers (WLK-01), VIPs (VIP-01).
  function stillUrl(id) {
    if (/^(M\d\d|VIP-\d\d|RIVAL-\d\d)$/.test(id)) return `assets/characters/${id}.webp`;
    if (/^WLK-/.test(id)) return `assets/map/${id}.webp`;
    return null;
  }

  // ---- In a scene ---------------------------------------------------------------------------------------------------
  class Actor {
    // opts: x, y (feet), height (how tall they stand, in world units), depth (leave out to sort by y)
    constructor(scene, id, opts) {
      this.scene = scene;
      this.id = id;
      this.height = opts.height * sizeOf(id);
      this.x = opts.x;
      this.y = opts.y;
      this.fixedDepth = opts.depth;
      this.image = scene.add.image(opts.x, opts.y, '__WHITE').setVisible(false);
      this.image.setDepth(opts.depth === undefined ? opts.y : opts.depth);
      this.t = Math.random() * 6;
      this.lift = 0;
      this.cur = null;       // what's playing
      this.setNow = null;    // the frames on screen now
      this.frame = 0;
      this.token = 0;
      this.cuts = 0;
      this.paused = false;
      this.hasFrames = Pick().hasFrames(id);
      Actor.own(scene, this);
      if (!this.hasFrames) this.showStill();
    }
    static own(scene, actor) {
      if (!scene.animActors) {
        scene.animActors = [];
        scene.animSheets = new Set();
        scene.events.once('shutdown', () => {
          for (const a of scene.animActors) a.gone = true;
          for (const key of scene.animSheets) if (scene.textures.exists(key)) scene.textures.remove(key);
          scene.animActors = null;
          scene.animSheets = null;
        });
      }
      scene.animActors.push(actor);
    }
    showStill() {
      const url = stillUrl(this.id);
      this.bob = true;
      if (!url) return;
      const key = 'still-' + this.id;
      const put = () => {
        if (this.gone) return;
        const src = this.scene.textures.get(key).getSourceImage();
        this.stillK = this.height / src.height;
        this.image.setTexture(key).setOrigin(0.5, 0.97).setScale(this.stillK).setVisible(true);
      };
      if (this.scene.textures.exists(key)) { put(); return; }
      const img = new Image();
      img.onload = () => {
        if (this.gone || !this.scene.animSheets) return;
        if (!this.scene.textures.exists(key)) { this.scene.textures.addImage(key, img); this.scene.animSheets.add(key); }
        put();
      };
      img.src = url;
    }
    // Fetches one sheet of frames, then calls back. Only once per scene.
    sheet(set, ready, failed) {
      const scene = this.scene;
      const key = `anim-${this.id}-${set}`;
      if (scene.textures.exists(key)) { ready(key); return; }
      const f = Art().chars[this.id][set];
      const img = new Image();
      img.onload = () => {
        if (this.gone || !scene.animSheets) return;
        if (!scene.textures.exists(key)) {
          scene.textures.addSpriteSheet(key, img, { frameWidth: f.w, frameHeight: f.h });
          scene.animSheets.add(key);
        }
        ready(key);
      };
      img.onerror = () => { if (!this.gone) failed(); };
      img.src = `assets/anim/${this.id}/${set}.webp`;
    }
    // A move by name (chat, cheer, idle...). Calls done() when a move that ends has ended.
    // With no frames for it the still picture stays and bobs.
    play(name, opts = {}) {
      const spec = Pick().resolve(this.id, name);
      if (!spec) { this.endFallback(opts.done); return; }
      const order = spec.random ? shuffled(spec.order, 40) : spec.order;
      this.start({ ...spec, order, done: opts.done, flip: opts.flip === undefined ? this.image.flipX : opts.flip });
    }
    endFallback(done) {
      if (!this.hasFrames && !this.image.visible) this.showStill();
      this.cur = null;
      if (done) this.scene.time.delayedCall(calm() ? 0 : 500, () => { if (!this.gone) done(); });
    }
    // Walking this way. Keeps the same frames going if they're already walking in that direction.
    heading(dx, dy) {
      const w = Pick().walkFor(this.id, dx, dy);
      if (!w) { if (!this.hasFrames) this.image.setFlipX(dx > 0); return; }
      if (this.cur && this.cur.walk && this.cur.set === w.set) { this.image.setFlipX(w.flip); return; }
      const n = Art().chars[this.id][w.set].n;
      this.start({ name: 'walk', walk: true, set: w.set, order: Array.from({ length: n }, (_, i) => i), fps: 8, loop: true, times: 1, flip: w.flip, look: Pick().lookOf(this.id, w.set) });
    }
    start(play) {
      const token = ++this.token;
      this.sheet(play.set, (key) => {
        if (this.gone || token !== this.token) return;
        const f = Art().chars[this.id][play.set];
        // Two hairstyles never meet: a little puff of smoke hides the change.
        if (Pick().needsCut(this.id, this.setNow, play.set)) this.cutAway();
        this.cur = { ...play, key, at: 0 };
        this.setNow = play.set;
        this.frame = play.order[0];
        // A 520 pixel frame is Art().small tall on the sheet, and a character stands about 92% of that.
        this.image.setTexture(key, play.order[0]).setOrigin(f.ox, f.oy).setFlipX(!!play.flip)
          .setScale(this.height / (Art().small * 0.92)).setVisible(true);
        if (calm() && play.done) { const done = play.done; play.done = null; this.scene.time.delayedCall(0, () => { if (!this.gone) done(); }); }
      }, () => this.endFallback(play.done));
    }
    cutAway() {
      this.cuts += 1;
      if (calm()) return;
      this.cutTill = 0.14;
      this.image.setAlpha(0.05);
      const scene = this.scene;
      PE.MapArt.load(scene, 'FX-01', (k) => {
        if (this.gone) return;
        const s = scene.add.image(this.x, this.y - this.height * 0.45, k).setDepth(this.image.depth + 1);
        const size = this.height * 0.75;
        const src = scene.textures.get(k).getSourceImage();
        s.setDisplaySize((src.width / src.height) * size, size).setAlpha(0.9);
        scene.tweens.add({ targets: s, alpha: 0, scale: s.scaleX * 1.4, duration: 300, onComplete: () => s.destroy() });
      });
    }
    moveTo(x, y) {
      this.x = x; this.y = y;
      this.image.setPosition(x, y + this.lift);
      if (this.fixedDepth === undefined) this.image.setDepth(y);
    }
    // In the camera's view (with a little to spare)?
    onScreen() {
      const v = this.scene.cameras.main.worldView;
      const m = this.height;
      return this.x > v.x - m && this.x < v.right + m && this.y > v.y - m && this.y < v.bottom + m * 2;
    }
    // Every frame. "may" says whether this one may change pictures now (at most two per screen).
    step(dt, may) {
      if (this.cutTill > 0) { this.cutTill -= dt; if (this.cutTill <= 0) this.image.setAlpha(1); }
      if (calm() || !may) return;
      if (!this.cur) {
        if (this.bob && this.image.visible && this.stillK) {
          this.t += dt;
          this.lift = -Math.abs(Math.sin(this.t * 2.2)) * this.height * 0.018;
          this.image.setPosition(this.x, this.y + this.lift);
        }
        return;
      }
      const c = this.cur;
      if (c.fps <= 0) return;
      c.at += dt;
      const i = Math.floor(c.at * c.fps);
      if (c.loop) { this.show(c.order[i % c.order.length]); return; }
      if (i < c.order.length * c.times) { this.show(c.order[i % c.order.length]); return; }
      this.finish(c);
    }
    show(f) {
      if (this.frame === f) return;
      this.frame = f;
      if (this.image.texture.key === this.cur.key) this.image.setFrame(f);
    }
    finish(c) {
      this.cur = { ...c, fps: 0, done: null };
      this.show(c.hold ? c.order[c.order.length - 1] : c.order[0]);
      if (c.then) this.play(c.then, { done: c.done });
      else if (c.done) c.done();
    }
    destroy() {
      this.gone = true;
      this.image.destroy();
      if (this.scene.animActors) this.scene.animActors = this.scene.animActors.filter((a) => a !== this);
    }
  }

  // Everything in a scene, once a frame: off-screen ones are paused, and at most two change pictures per screen.
  function stepAll(scene, dt) {
    if (!scene.animActors) return;
    let free = 2;
    for (const a of scene.animActors) {
      a.paused = !a.onScreen();
      if (a.paused) continue;
      const moving = !!(a.cur && a.cur.fps > 0 && a.hasFrames);
      a.step(dt, !moving || free > 0);
      if (moving && free > 0) free -= 1;
    }
  }

  // ---- In a pop-up or menu -------------------------------------------------------------------------------------------
  const live = new Set();
  let ticking = null;
  function paint(a, f) {
    if (a.frame === f) return;
    a.frame = f;
    const col = f % a.cols, row = Math.floor(f / a.cols);
    a.inner.style.backgroundPosition = `${a.cols > 1 ? (col / (a.cols - 1)) * 100 : 0}% ${a.rows > 1 ? (row / (a.rows - 1)) * 100 : 0}%`;
  }
  function tick() {
    for (const a of live) {
      if (!a.el.isConnected) { live.delete(a); continue; }
      if (a.fps <= 0) { live.delete(a); continue; }
      a.at += 0.066;
      const i = Math.floor(a.at * a.fps);
      if (a.loop) { paint(a, a.order[i % a.order.length]); continue; }
      if (i < a.order.length * a.times) { paint(a, a.order[i % a.order.length]); continue; }
      a.fps = 0;
      paint(a, a.hold ? a.order[a.order.length - 1] : a.order[0]);
      const then = a.then, done = a.done;
      a.done = null;
      if (then) AnimDom.play(a.el, then, { done });
      else if (done) done();
    }
    if (!live.size) { clearInterval(ticking); ticking = null; }
  }
  const AnimDom = {
    // A square box with the feet at the bottom middle. Call play() on it once it's on the page.
    html(id, height, cls = '') {
      return `<span class="anim-box ${cls}" data-char="${id}" role="img" aria-label="${id}" style="width:${height}px;height:${height}px"><i class="anim-sheet"></i></span>`;
    },
    // Plays a move on a box. The new sheet only swaps in once it has loaded, so nothing ever flashes blank.
    play(el, name, opts = {}) {
      if (!el) return;
      const id = el.dataset.char;
      const spec = Pick().resolve(id, name);
      const f = spec && Art().chars[id][spec.set];
      if (!spec || !f.big) { if (opts.done) opts.done(); return; }
      const url = `assets/anim/${id}/${spec.set}.l.webp`;
      el._want = name;
      const go = () => {
        if (!el.isConnected || el._want !== name) return;
        const inner = el.querySelector('.anim-sheet');
        const rows = Math.ceil(f.n / f.cols);
        const size = el.clientHeight || parseFloat(el.style.height);
        const scale = (size * sizeOf(id)) / (Art().small * 0.92);
        const w = f.w * scale, h = f.h * scale;
        inner.style.cssText = `width:${w}px;height:${h}px;left:${size / 2 - f.ox * w}px;top:${size - f.oy * h}px;background-image:url("${url}");background-size:${f.cols * 100}% ${rows * 100}%`;
        el.dataset.set = spec.set;
        el.dataset.look = spec.look;
        el.dataset.move = name;
        const still = calm();
        const order = spec.random ? shuffled(spec.order, 40) : spec.order;
        const a = el._anim || (el._anim = { el, inner });
        Object.assign(a, { order, fps: still || order.length < 2 ? 0 : spec.fps, loop: spec.loop, hold: spec.hold, times: spec.times, then: still ? null : spec.then, done: opts.done || null, at: 0, frame: -1, cols: f.cols, rows });
        paint(a, order[0]);
        if (a.fps > 0) { live.add(a); if (!ticking) ticking = setInterval(tick, 66); } else if (a.done) { const d = a.done; a.done = null; d(); }
      };
      const img = new Image();
      img.onload = go;
      img.onerror = () => { if (opts.done) opts.done(); };
      img.src = url;
    },
    // Stop on the move's first frame (a speech bubble has finished typing out).
    settle(el) {
      const a = el && el._anim;
      if (!a || !a.loop) return;
      a.fps = 0;
      paint(a, a.order[0]);
    },
    // How many are moving right now. Used by the tests.
    moving: () => [...live].filter((a) => a.el.isConnected && a.fps > 0).length,
  };

  PE.Anim = { Actor, stepAll, stillUrl };
  PE.AnimDom = AnimDom;
})(globalThis.PE = globalThis.PE || {});
