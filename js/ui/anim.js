// The character animation player. Any character can use it: it looks up which moves exist for them (data/anim_art.js,
// data/anim_moves.js), and with no frames it shows their still picture with a gentle bob instead.
//   PE.Anim.Actor     a character standing in a Phaser scene (the map, rooms)
//   PE.AnimDom        a character in a pop-up or menu (no canvas needed)
// Frames are only fetched when needed, and a scene lets go of its sheets when it closes. With reduced motion everyone
// stands still on the first frame.
(function (PE) {
  const Pick = () => PE.AnimPick;
  const Art = () => PE.Data.animArt;
  const calm = () => (PE.App && PE.App.calm());
  const shuffled = (list, count) => { const out = []; for (let i = 0; i < count; i++) out.push(list[Math.floor(Math.random() * list.length)]); return out; };
  // Job 22B, one standing-height rule for everyone: a person is scaled by how tall they really stand in their pictures
  // (measured by tools/import_anim_art.js, PE.Data.animArt.stand), so Haze, Budz, Leafy and every customer given the same
  // height stand the same height. sizeOf is only for a customer drawn a few percent taller or shorter on purpose
  // (data/anim_moves.js size, kept within 0.95 to 1.05). Vehicles keep the old rule: the frame is about 92% of them.
  const sizeOf = (id) => Math.min(1.05, Math.max(0.95, (PE.Data.animMoves.size || {})[id] || 1));
  const standPx = (id) => (Art().stand && Art().stand[id]) || Art().small * 0.92;

  // A still picture, for those with no frames yet: portraits (M01), walkers (WLK-01), VIPs (VIP-01).
  function stillUrl(id) {
    if (/^(M\d\d|VIP-\d\d|RIVAL-\d\d)$/.test(id)) return `assets/characters/${id}.webp`;
    if (/^WLK-/.test(id)) return `assets/map/${id}.webp`;
    if (/^V\d\d$/.test(id)) return `assets/ui/${id}.webp`;
    return null;
  }

  // Is this world point on a solid part of a picture (not its see-through part)?
  function solidAt(scene, im, x, y) {
    if (!im.frame || !im.scaleX) return false;
    const fw = im.frame.cutWidth, fh = im.frame.cutHeight;
    let u = (x - im.x) / im.scaleX + im.originX * fw;
    const v = (y - im.y) / im.scaleY + im.originY * fh;
    if (im.flipX) u = fw - u;
    if (u < 0 || v < 0 || u >= fw || v >= fh) return false;
    return (scene.textures.getPixelAlpha(Math.floor(u), Math.floor(v), im.texture.key, im.frame.name) || 0) > 90;
  }

  // ---- In a scene ---------------------------------------------------------------------------------------------------
  const RETRY_MS = 20000;   // how long before a picture that failed to arrive is tried again
  class Actor {
    // opts: x, y (feet), height (how tall they stand, in world units), depth (leave out to sort by y)
    constructor(scene, id, opts) {
      this.scene = scene;
      this.id = id;
      this.height = opts.height * (Pick().isVehicle(id) ? 1 : sizeOf(id));
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
      this.paused = false;
      this.hasFrames = Pick().hasFrames(id);
      this.walkRoll = Math.random();
      // One of each character (js/logic/cast.js): clash is true if this person was already out somewhere else.
      this.castOwner = PE.Cast ? PE.Cast.token(Pick().isVehicle(id) ? 'drive' : 'walk') : null;
      this.clash = !!(PE.Cast && !PE.Cast.claim(id, this.castOwner));
      Actor.own(scene, this);
      if (!this.hasFrames) this.showStill();
    }
    static own(scene, actor) {
      if (!scene.animActors) {
        scene.animActors = [];
        scene.animSheets = new Set();
        scene.animFetches = new Map();
        scene.events.once('shutdown', () => {
          for (const a of scene.animActors) { a.gone = true; if (PE.Cast && !a.clash) PE.Cast.free(a.id, a.castOwner); }
          for (const key of scene.animSheets) if (scene.textures.exists(key)) scene.textures.remove(key);
          scene.animActors = null;
          scene.animSheets = null;
          scene.animFetches = null;
        });
      }
      scene.animActors.push(actor);
    }
    showStill() {
      const url = stillUrl(this.id);
      // Vehicles with no driving frames yet slide their still picture (no bob), drawn about as big as a driving one.
      const vehicle = Pick().isVehicle(this.id);
      this.bob = !vehicle;
      if (!url) return;
      const key = 'still-' + this.id;
      const put = () => {
        if (this.gone) return;
        const src = this.scene.textures.get(key).getSourceImage();
        this.stillK = ((vehicle ? 0.6 : 1) * this.height) / src.height;
        this.image.setTexture(key).setOrigin(0.5, vehicle ? 0.9 : 0.97).setScale(this.stillK).setVisible(true);
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
    // Fetches one sheet of frames, then calls back. Only once per scene: everyone wanting a sheet that's on its way waits for that one
    // fetch, and one that failed isn't asked for again for a while. (Walkers ask every frame, so without this a slow or missing
    // picture was fetched again 60 times a second by each walker.)
    sheet(set, ready, failed) {
      const scene = this.scene;
      const key = `anim-${this.id}-${set}`;
      if (scene.textures.exists(key)) { ready(key); return; }
      const fetches = scene.animFetches;
      if (!fetches) { failed(); return; }
      const known = fetches.get(key);
      if (known && known.waiting) { known.waiting.push({ ready, failed }); return; }
      if (known && performance.now() < known.retryAt) { failed(); return; }
      const job = { waiting: [{ ready, failed }], retryAt: 0 };
      fetches.set(key, job);
      const f = Art().chars[this.id][set];
      const img = new Image();
      const finish = (ok) => {
        const waiting = job.waiting;
        job.waiting = null;
        if (scene.animFetches !== fetches) return;   // that visit to the scene has ended
        if (ok && !scene.textures.exists(key)) {
          scene.textures.addSpriteSheet(key, img, { frameWidth: f.w, frameHeight: f.h });
          scene.animSheets.add(key);
        }
        if (!ok) job.retryAt = performance.now() + RETRY_MS;
        for (const w of waiting) { if (ok) w.ready(key); else w.failed(); }
      };
      img.onload = () => finish(true);
      img.onerror = () => finish(false);
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
    // style 'skate': the skater kid rides his board instead.
    heading(dx, dy, style = 'walk') {
      const w = Pick().walkFor(this.id, dx, dy, this.walkRoll, style);
      if (!w) { if (!this.hasFrames) this.image.setFlipX(dx > 0); return; }
      if (this.cur && this.cur.walk && this.cur.set === w.set) { this.image.setFlipX(w.flip); return; }
      if (this.wanted === w.set) return;   // on its way
      const fr = Art().chars[this.id][w.set];
      // Aaron's own timing where the notes give it (170 ms walks, the skater's push, 100 ms driving), otherwise 8 a second.
      this.start({ name: 'walk', walk: true, set: w.set, order: Array.from({ length: fr.n }, (_, i) => i), fps: 8, ms: fr.ms || null, loop: true, times: 1, flip: w.flip, look: Pick().lookOf(this.id, w.set) });
    }
    start(play) {
      const token = ++this.token;
      this.wanted = play.set;
      this.sheet(play.set, (key) => {
        if (token === this.token) this.wanted = null;
        if (this.gone || token !== this.token) return;
        const f = Art().chars[this.id][play.set];
        this.cur = { ...play, key, at: 0 };
        this.setNow = play.set;
        this.frame = play.order[0];
        // A 520 pixel frame is Art().small tall on the sheet, and a character stands about 92% of that.
        this.image.setTexture(key, play.order[0]).setOrigin(f.ox, f.oy).setFlipX(!!play.flip)
          .setScale(this.height / standPx(this.id)).setVisible(true);
        if (calm() && play.done) { const done = play.done; play.done = null; this.scene.time.delayedCall(0, () => { if (!this.gone) done(); }); }
      }, () => {
        if (token === this.token) this.wanted = null;
        if (!this.gone) this.endFallback(play.done);
      });
    }
    // Is this point of the world clearly on the character's body, not on the empty part of their picture or a wisp of
    // smoke? A tap anywhere else belongs to whatever's underneath.
    covers(wx, wy) {
      const im = this.image;
      if (!im.visible || !im.frame || !im.scaleX) return false;
      const r = this.height * 0.035;
      const solid = [[0, 0], [r, 0], [-r, 0], [0, r], [0, -r]].filter(([a, b]) => solidAt(this.scene, im, wx + a, wy + b)).length;
      return solid >= 4;
    }
    // Drawn at this depth, for standing behind something. null goes back to normal.
    setBehind(depth) {
      if (this.behind === depth || (depth === null && this.behind === undefined)) return;
      this.behind = depth === null ? undefined : depth;
      this.image.setDepth(depth === null ? (this.fixedDepth === undefined ? this.y : this.fixedDepth) : depth);
    }
    moveTo(x, y) {
      this.x = x; this.y = y;
      this.image.setPosition(x, y + this.lift);
      if (this.fixedDepth === undefined && this.behind === undefined) this.image.setDepth(y);
    }
    // In the camera's view (with a little to spare)?
    onScreen() {
      const v = this.scene.cameras.main.worldView;
      const m = this.height;
      return this.x > v.x - m && this.x < v.right + m && this.y > v.y - m && this.y < v.bottom + m * 2;
    }
    // Every frame. "may" says whether this one may change pictures now (at most two per screen).
    step(dt, may) {
      if (calm()) return;
      // Not its turn to change pictures: its clock still runs, so it keeps its speed and catches up next turn.
      if (!may) { if (this.cur && this.cur.fps > 0) this.cur.at += dt; return; }
      if (!this.cur) {
        if (this.bob && this.image.visible && this.stillK) {
          this.t += dt;
          this.lift = -Math.abs(Math.sin(this.t * 2.2)) * this.height * 0.018;
          this.image.setPosition(this.x, this.y + this.lift);
        }
        return;
      }
      const c = this.cur;
      // A held frame with a gentle bob, so nobody stands stock still.
      if (c.bob) {
        this.t += dt;
        this.lift = -Math.abs(Math.sin(this.t * 1.7)) * this.height * 0.01;
        this.image.setPosition(this.x, this.y + this.lift);
      } else if (this.lift) { this.lift = 0; this.image.setPosition(this.x, this.y); }
      if (c.fps <= 0) return;
      c.at += dt;
      let i = Math.floor(c.at * c.fps);
      if (c.ms) {
        // Each frame shows for its own time.
        const total = c.ms.reduce((a, b) => a + b, 0) / 1000;
        const lap = Math.floor(c.at / total);
        let t = c.at - lap * total, k = 0;
        while (k < c.ms.length - 1 && t >= c.ms[k] / 1000) { t -= c.ms[k] / 1000; k++; }
        i = lap * c.order.length + k;
      }
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
      if (PE.Cast && !this.gone && !this.clash) PE.Cast.free(this.id, this.castOwner);
      this.gone = true;
      this.image.destroy();
      if (this.scene.animActors) this.scene.animActors = this.scene.animActors.filter((a) => a !== this);
    }
  }

  // Everything in a scene, once a frame: off-screen ones are paused, and at most two change pictures per screen.
  function stepAll(scene, dt) {
    if (!scene.animActors) return;
    // Job 17B: with the vans and more customers moving too, they take turns: each frame starts one further along the
    // list, so nobody (like a helper made after the vans) waits forever for a turn. Changing frames is cheap, so 4 a screen.
    let free = 4;
    const list = scene.animActors;
    const start = (scene.animTurn = ((scene.animTurn || 0) + 1) % Math.max(1, list.length));
    for (let k = 0; k < list.length; k++) {
      const a = list[(start + k) % list.length];
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
      let i = Math.floor(a.at * a.fps);
      if (a.ms) {
        // Each frame shows for its own time (job 17B: the skater's jar show-off in pop-ups).
        const total = a.ms.reduce((x, y) => x + y, 0) / 1000;
        const lap = Math.floor(a.at / total);
        let t = a.at - lap * total, k = 0;
        while (k < a.ms.length - 1 && t >= a.ms[k] / 1000) { t -= a.ms[k] / 1000; k++; }
        i = lap * a.order.length + k;
      }
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
    // look 'messy': Uncle Haze's busy, just-woke-up hair. Only for those pop-ups.
    html(id, height, cls = '', look = 'styled') {
      return `<span class="anim-box ${cls}" data-char="${id}" data-hair="${look}" role="img" aria-label="${id}" style="width:${height}px;height:${height}px"><i class="anim-sheet"></i></span>`;
    },
    // Plays a move on a box. The new sheet only swaps in once it has loaded, so nothing ever flashes blank.
    play(el, name, opts = {}) {
      if (!el) return;
      const id = el.dataset.char;
      const spec = Pick().resolve(id, name, Math.random(), el.dataset.hair || 'styled');
      const f = spec && Art().chars[id][spec.set];
      if (!spec || !f.big) { if (opts.done) opts.done(); return; }
      const url = `assets/anim/${id}/${spec.set}.l.webp`;
      el._want = name;
      const go = () => {
        if (!el.isConnected || el._want !== name) return;
        const inner = el.querySelector('.anim-sheet');
        const rows = Math.ceil(f.n / f.cols);
        const size = el.clientHeight || parseFloat(el.style.height);
        const scale = (size * sizeOf(id)) / standPx(id);
        const w = f.w * scale, h = f.h * scale;
        inner.style.cssText = `width:${w}px;height:${h}px;left:${size / 2 - f.ox * w}px;top:${size - f.oy * h}px;background-image:url("${url}");background-size:${f.cols * 100}% ${rows * 100}%`;
        el.dataset.set = spec.set;
        el.dataset.look = spec.look;
        el.dataset.move = name;
        const still = calm();
        const order = spec.random ? shuffled(spec.order, 40) : spec.order;
        const a = el._anim || (el._anim = { el, inner });
        Object.assign(a, { order, ms: spec.random ? null : spec.ms, fps: still || order.length < 2 ? 0 : spec.fps, loop: spec.loop, hold: spec.hold, times: spec.times, then: still ? null : spec.then, done: opts.done || null, at: 0, frame: -1, cols: f.cols, rows });
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

  // Job 22B: how tall a person stands in each place, in that place's own world units. Helpers, customers, VIPs and
  // managers all use the same number there (the old map had helpers twice the height of the customers).
  const PERSON_H = { map: 62, shop: 300, grow: 560 };

  PE.Anim = { Actor, stepAll, stillUrl, solidAt, PERSON_H, standPx };
  PE.AnimDom = AnimDom;
})(globalThis.PE = globalThis.PE || {});
