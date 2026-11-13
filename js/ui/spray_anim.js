// Aaron's animated sprinkler sprays in the grow rooms (job 17B, art/hydro/spray_anim/SPRAY_ANIM.md, packed by
// tools/import_spray_anim.js into data/spray_anim.js). While a sprinkler is on, its model's spray loops under the head,
// a little bigger each level. After each loop one of that model's versions is picked at random, so it keeps changing.
// Each sheet is only fetched when a station first needs it, only sprays on screen move, and a version nobody is using
// any more is let go. A model with no animation for its level keeps its still HY-Mn-FX-L picture (js/ui/grow_room.js).
(function (PE) {
  const D = () => PE.Data.sprayAnim;
  const calm = () => (PE.App && PE.App.calm());
  const keyOf = (set) => 'spray-' + set;

  // The versions this model plays at this sprinkler level ([] = none, keep the still).
  function setsFor(model, level) {
    const M = D() && D().models[model];
    if (!M) return [];
    return (M[level] || M.all || []).slice();
  }
  // How far down the spray reaches, as a share of the gap from the head to the pots: a little more each level.
  const reachAt = (level) => 0.72 + 0.056 * (Math.max(1, Math.min(6, level)) - 1);

  // Fetches one sheet for this scene (once; anyone else wanting it while it's on its way waits for that fetch).
  function load(scene, set, ready) {
    const key = keyOf(set);
    if (scene.textures.exists(key)) { ready(key); return; }
    if (!scene.sprayFetch) {
      scene.sprayFetch = new Map();
      scene.sprayKeys = new Set();
      scene.sprays = [];
      scene.events.once('shutdown', () => {
        for (const k of scene.sprayKeys) if (scene.textures.exists(k)) scene.textures.remove(k);
        scene.sprayFetch = null; scene.sprayKeys = null; scene.sprays = null;
      });
    }
    const fetches = scene.sprayFetch;
    const known = fetches.get(key);
    if (known) { if (known.waiting) known.waiting.push(ready); return; }
    const job = { waiting: [ready] };
    fetches.set(key, job);
    const f = D().sets[set];
    const img = new Image();
    img.onload = () => {
      const waiting = job.waiting;
      job.waiting = null;
      if (scene.sprayFetch !== fetches) return;   // that visit to the room has ended
      if (!scene.textures.exists(key)) { scene.textures.addSpriteSheet(key, img, { frameWidth: f.w, frameHeight: f.h }); scene.sprayKeys.add(key); }
      for (const w of waiting) w(key);
    };
    img.onerror = () => { fetches.delete(key); };
    img.src = `assets/hydro/spray/${set}.webp`;
  }

  // Lets go of a version's sheet once no spray in the room shows it.
  function release(scene, set) {
    if (!scene.sprays || scene.sprays.some((s) => s.set === set || s.nextSet === set)) return;
    const key = keyOf(set);
    if (scene.textures.exists(key)) scene.textures.remove(key);
    scene.sprayKeys.delete(key);
    scene.sprayFetch.delete(key);
  }

  class Spray {
    // x, y: the bottom of the sprinkler head. gap: from there down to the pots.
    constructor(scene, opts) {
      this.scene = scene;
      this.list = setsFor(opts.model, opts.level);
      this.level = opts.level;
      this.x = opts.x; this.y = opts.y; this.gap = opts.gap;
      this.image = scene.add.image(opts.x, opts.y, '__WHITE').setDepth(opts.depth).setVisible(false);
      this.image.wantVisible = false;
      this.on = false;
      this.at = 0;
      this.frame = 0;
      this.set = null;
      this.nextSet = null;
      load(scene, this.list[Math.floor(Math.random() * this.list.length)], (key) => this.use(key));
      scene.sprays.push(this);
    }
    use(key) {
      if (this.gone) return;
      const set = key.slice(6);
      const old = this.set;
      const f = D().sets[set];
      this.set = set;
      this.f = f;
      this.at = 0;
      this.frame = 0;
      // The start point goes right under the head; the part below it reaches most of the way to the pots.
      const below = Math.max(120, this.gap * reachAt(this.level));
      const h = below / (1 - f.sy);
      const w = h * (f.w / f.h);
      this.image.setTexture(key, 0).setOrigin(f.sx, f.sy).setDisplaySize(w, h).setPosition(this.x, this.y);
      this.ready = true;
      // The room shows it on its next look round (5 times a second), if the station is in view and watering.
      if (old && old !== set) release(this.scene, old);
    }
    // After each loop: any of the model's versions, at random (it may be the same one again).
    nextLoop() {
      if (this.list.length < 2) return;
      const pick = this.list[Math.floor(Math.random() * this.list.length)];
      if (pick === this.set) return;
      this.nextSet = pick;
      load(this.scene, pick, (key) => { if (this.nextSet === pick) { this.nextSet = null; this.use(key); } });
    }
    onScreen() {
      const v = this.scene.cameras.main.worldView;
      const im = this.image;
      return im.visible && this.x + im.displayWidth > v.x && this.x - im.displayWidth < v.right && this.y + im.displayHeight > v.y && this.y - 100 < v.bottom;
    }
    step(dt) {
      if (!this.ready || !this.image.visible || calm() || !this.onScreen()) return;
      const ms = this.f.ms;
      this.at += dt * 1000;
      let k = this.frame;
      while (this.at >= ms[k]) {
        this.at -= ms[k];
        k += 1;
        if (k >= this.f.n) { k = 0; const was = this.set; this.nextLoop(); if (this.set !== was) return; }
      }
      if (k !== this.frame) { this.frame = k; this.image.setFrame(k); }
    }
    destroy() {
      this.gone = true;
      if (this.image.scene) this.image.destroy();
      const S = this.scene.sprays;
      if (S) this.scene.sprays = S.filter((s) => s !== this);
      if (this.set) release(this.scene, this.set);
    }
  }

  function stepAll(scene, dt) {
    if (!scene.sprays) return;
    for (const s of scene.sprays) s.step(dt);
  }

  PE.SprayAnim = { setsFor, Spray, stepAll, reachAt };
})(globalThis.PE = globalThis.PE || {});
