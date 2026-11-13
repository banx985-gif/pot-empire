// Going from one district to another. Rebuilt in code from Aaron's reference videos (art/fx/transition/TRANSITION_ART.md):
// the pieces are pictures, the timings are here, and which district uses which is data (data/map.js, travel).
//   A  a smoke puff grows from your finger till it fills the screen, the title pops in, the clouds break up and drift off
//   B  a band of smoke sweeps up the screen, with the new map below it and the old map above it
//   C  pink smoke swirls in from the middle, then breaks into small pieces, clearing from the middle outwards
// Tap to skip. Reduced motion: a plain fade and the title. All on one layer above the game, so nothing inside the map changes.
(function (PE) {
  const DIR = 'assets/fx/transition/';
  const calm = () => PE.App.calm();
  const url = (id) => `${DIR}${id}.webp`;
  const hasArt = (id) => { const e = PE.Data.assetRegistry.entries.find((x) => x.id === id); return !!e && e.status === 'imported'; };
  const el = (cls, parent, tag = 'div') => { const d = document.createElement(tag); d.className = cls; parent.appendChild(d); return d; };
  const rand = (a, b) => a + Math.random() * (b - a);

  // Where the finger last came down: the puff starts there.
  let finger = null;
  window.addEventListener('pointerdown', (e) => { finger = { x: e.clientX, y: e.clientY }; }, { capture: true, passive: true });

  const Travel = {
    now: null,        // what's playing: { id, style, phase }
    lastStyle: null,  // the tests read these
    shots: 0,
    preload() {
      if (this.loaded) return;
      this.loaded = true;
      for (const id of ['TRANS-PUFF', 'TRANS-CLOUD-FULL', 'TRANS-CLOUD-PINK', 'TRANS-SMOKE-PINK', 'TRANS-SMOKE-WIPE', 'TITLE-D1', 'TITLE-D2', 'TITLE-D3', 'TITLE-D4']) if (hasArt(id)) new Image().src = url(id);
    },

    go(id) {
      if (this.now) return;
      const look = PE.Data.map.travel[id] || PE.Data.map.travel.D1;
      const root = document.getElementById('travel');
      root.innerHTML = '';
      root.hidden = false;
      root.style.pointerEvents = 'auto';
      const run = { id, style: calm() ? 'fade' : look.style, phase: 'start', look, root, timers: [], rafs: [], anims: [], swapped: false };
      this.now = run;
      this.lastStyle = run.style;
      root.onpointerdown = (e) => { e.stopPropagation(); this.finish(run); };
      this.title(run);
      if (run.style === 'fade') this.fade(run);
      else if (run.style === 'B') this.wipe(run);
      else this.puff(run);
    },

    // ---- The small jobs ------------------------------------------------------------------------------------------
    later(run, ms, fn) { run.timers.push(setTimeout(() => { if (this.now === run) fn(); }, ms)); },
    anim(run, target, frames, opts) {
      const a = target.animate(frames, { fill: 'forwards', ...opts });
      run.anims.push(a);
      return a;
    },
    every(run, fn) {
      const step = (t) => { if (this.now !== run) return; if (fn(t) !== false) requestAnimationFrame(step); };
      requestAnimationFrame(step);
    },
    // The new district's title: Aaron's picture (all four are drawn). Live text only if a picture fails to load.
    title(run) {
      const name = PE.App.g.map.districts().find((d) => d.id === run.id).name;
      const box = el('travel-title', run.root);
      box.style.opacity = 0;
      const text = () => { box.innerHTML = ''; const t = el('travel-title-text', box); t.textContent = name; };
      if (hasArt(`TITLE-${run.id}`)) {
        const img = el('', box, 'img');
        img.alt = name;
        img.draggable = false;
        img.onerror = text;
        img.src = url(`TITLE-${run.id}`);
      } else text();
      run.titleEl = box;
    },
    // Swaps the map underneath, then calls back when the new painting is up (or after a moment, whichever comes first).
    swap(run, ready) {
      run.swapped = true;
      PE.App.g.map.setCurrent(run.id);
      PE.App.router.replace('empire', { district: run.id });
      const began = performance.now();
      const look = () => {
        if (this.now !== run) return;
        const m = PE.App.game.scene.getScene('empire');
        const up = m && m.scene.isActive() && m.ready && m.district === run.id && m.ground && m.ground.baseImage;
        if (up || performance.now() - began > 2500) ready(); else setTimeout(look, 40);
      };
      setTimeout(look, 40);
    },
    popTitle(run) {
      run.phase = 'title';
      run.titleEl.style.opacity = 1;
      this.anim(run, run.titleEl, [{ transform: 'translate(-50%, -50%) scale(0.2)' }, { transform: 'translate(-50%, -50%) scale(1.12)', offset: 0.7 }, { transform: 'translate(-50%, -50%) scale(1)' }], { duration: 340, easing: 'ease-out' });
    },
    // The title floats up near the top, holds, then fades. Taps go straight through to the map by now.
    settleTitle(run, from = '-50%') {
      run.phase = 'settle';
      run.root.style.pointerEvents = 'none';
      const up = 'translate(-50%, calc(-50% - 31vh))';
      this.anim(run, run.titleEl, [{ transform: from === '-50%' ? 'translate(-50%, -50%)' : from }, { transform: up }], { duration: 480, easing: 'ease-in-out' });
      this.later(run, 480 + 2000, () => {
        this.anim(run, run.titleEl, [{ opacity: 1, transform: up }, { opacity: 0, transform: up }], { duration: 320 });
        this.later(run, 340, () => this.finish(run));
      });
    },

    // ---- Styles A and C: a puff that fills the screen -------------------------------------------------------------
    puff(run) {
      const { root, look } = run;
      const R = root.getBoundingClientRect();
      const C = run.style === 'C';
      const at = !C && finger ? { x: finger.x - R.left, y: finger.y - R.top } : { x: R.width / 2, y: R.height / 2 };
      const cover = Math.hypot(Math.max(at.x, R.width - at.x), Math.max(at.y, R.height - at.y)) * 2.6;
      const puff = el('travel-puff', root, 'img');
      puff.src = url(look.puff);
      puff.draggable = false;
      puff.style.cssText = `left:${at.x}px;top:${at.y}px;width:${cover}px;`;
      run.phase = 'grow';
      this.anim(run, puff, [{ transform: `translate(-50%,-50%) scale(0.03)${C ? ' rotate(-40deg)' : ''}`, opacity: 0.8 }, { transform: 'translate(-50%,-50%) scale(1) rotate(0deg)', opacity: 1 }], { duration: 600, easing: 'cubic-bezier(.5,0,.8,.6)' });
      const cloud = el('travel-cloud', root, 'img');
      cloud.src = url(look.cloud);
      cloud.draggable = false;
      cloud.style.opacity = 0;
      this.later(run, 480, () => this.anim(run, cloud, [{ opacity: 0 }, { opacity: 1 }], { duration: 120 }));
      this.later(run, 610, () => {
        puff.remove();
        run.phase = 'covered';
        const shown = performance.now();
        this.swap(run, () => this.later(run, Math.max(0, 260 - (performance.now() - shown)), () => {
          if (C) this.clearC(run, cloud); else { this.popTitle(run); this.later(run, 480, () => this.clearA(run, cloud)); }
        }));
      });
    },
    // A: the clouds break into puffs that drift off and fade.
    clearA(run, cloud) {
      run.phase = 'clearing';
      const R = run.root.getBoundingClientRect();
      const spots = [[0.22, 0.2], [0.72, 0.17], [0.5, 0.42], [0.17, 0.62], [0.78, 0.6], [0.34, 0.85], [0.7, 0.86]];
      for (const [fx, fy] of spots) {
        const p = el('travel-bit', run.root, 'img');
        p.src = url(run.look.puff);
        p.draggable = false;
        const size = R.width * rand(0.62, 0.86);
        p.style.cssText = `left:${fx * R.width}px;top:${fy * R.height}px;width:${size}px;`;
        const dx = (fx - 0.5) * R.width * 1.1, dy = (fy - 0.5) * R.height * 0.8;
        this.anim(run, p, [{ transform: 'translate(-50%,-50%) scale(1)', opacity: 1 }, { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(1.25)`, opacity: 0 }], { duration: rand(760, 1050), easing: 'ease-out', delay: rand(0, 80) });
      }
      run.root.insertBefore(run.titleEl, null);
      this.anim(run, cloud, [{ opacity: 1 }, { opacity: 0 }], { duration: 240 });
      this.later(run, 560, () => this.settleTitle(run));
    },
    // C: lots of small pieces drift away and the smoke clears from the middle out, with the title appearing as it goes.
    clearC(run, cloud) {
      run.phase = 'clearing';
      const R = run.root.getBoundingClientRect();
      const began = performance.now();
      const COUNT = 26;
      for (let i = 0; i < COUNT; i++) {
        const a = rand(0, Math.PI * 2), r = rand(0.05, 0.55) * Math.max(R.width, R.height);
        const p = el('travel-bit', run.root, 'img');
        p.src = url(run.look.puff);
        p.draggable = false;
        const size = R.width * rand(0.1, 0.28);
        p.style.cssText = `left:${R.width / 2 + Math.cos(a) * r * 0.6}px;top:${R.height / 2 + Math.sin(a) * r * 0.6}px;width:${size}px;`;
        const delay = (r / Math.max(R.width, R.height)) * 700;
        this.anim(run, p, [{ transform: 'translate(-50%,-50%) scale(1) rotate(0deg)', opacity: 0 }, { transform: 'translate(-50%,-50%) scale(1) rotate(0deg)', opacity: 1, offset: 0.12 }, { transform: `translate(calc(-50% + ${Math.cos(a) * r * 0.7}px), calc(-50% + ${Math.sin(a) * r * 0.7 - 30}px)) scale(0.6) rotate(${rand(-90, 90)}deg)`, opacity: 0 }], { duration: rand(760, 1000), delay, easing: 'ease-out' });
      }
      const MAX = Math.hypot(R.width, R.height) * 0.62;
      this.every(run, () => {
        const k = Math.min(1, (performance.now() - began) / 1000);
        const r = MAX * k * k * 1.15;
        const m = `radial-gradient(circle at 50% 50%, transparent ${r}px, #000 ${r + 110}px)`;
        cloud.style.webkitMaskImage = m;
        cloud.style.maskImage = m;
        return k < 1;
      });
      this.later(run, 340, () => this.popTitle(run));
      this.later(run, 1150, () => { cloud.remove(); this.settleTitle(run); });
    },

    // ---- Style B: a band of smoke sweeping up, the seam between the old map and the new one ---------------------------
    wipe(run) {
      const game = PE.App.game;
      const fallback = () => { if (this.now === run) { run.style = 'A'; this.lastStyle = 'A'; run.look = PE.Data.map.travel.D1; this.puff(run); } };
      let done = false;
      // A picture of the map as it is now, to stay on screen above the band.
      try {
        // JPEG, not Phaser's usual PNG: the map has no see-through parts, and it's several times quicker to make on a phone.
        game.renderer.snapshot((image) => {
          if (done || this.now !== run) return;
          done = true;
          this.shots += 1;
          if (!image || !image.src) { fallback(); return; }
          const old = el('travel-old', run.root, 'img');
          old.draggable = false;
          old.src = image.src;
          run.phase = 'covered';
          this.swap(run, () => this.band(run, old));
        }, 'image/jpeg', 0.88);
      } catch (e) { fallback(); }
      setTimeout(() => { if (!done) { done = true; fallback(); } }, 700);
    },
    band(run, old) {
      run.phase = 'clearing';
      const R = run.root.getBoundingClientRect();
      const H = R.height;
      const band = el('travel-band', run.root, 'img');
      band.src = url(run.look.band);
      band.draggable = false;
      const bh = H * 0.5;
      band.style.height = `${bh}px`;
      run.root.insertBefore(run.titleEl, null);
      const began = performance.now();
      const T = 1500;
      let titled = false;
      this.every(run, () => {
        const k = Math.min(1, (performance.now() - began) / T);
        // The seam: the middle of the band, from just under the screen to just above it.
        const seam = H + bh * 0.5 - k * (H + bh);
        band.style.transform = `translateY(${seam - bh / 2}px)`;
        const clip = `inset(0 0 ${Math.min(H, Math.max(0, H - seam))}px 0)`;
        old.style.clipPath = clip;
        old.style.webkitClipPath = clip;
        // The title follows just under the band on its way up, then stays near the top.
        const y = Math.max(H * 0.19, seam + bh * 0.42);
        if (y < H * 0.9) {
          if (!titled) { titled = true; run.phase = 'title'; this.anim(run, run.titleEl, [{ opacity: 0 }, { opacity: 1 }], { duration: 260 }); }
          run.titleEl.style.transform = `translate(-50%, calc(-50% + ${y - H / 2}px))`;
        }
        if (k >= 1) {
          band.remove();
          old.remove();
          run.phase = 'settle';
          run.root.style.pointerEvents = 'none';
          this.later(run, 2000, () => {
            this.anim(run, run.titleEl, [{ opacity: 1 }, { opacity: 0 }], { duration: 320 });
            this.later(run, 340, () => this.finish(run));
          });
          return false;
        }
        return true;
      });
    },

    // ---- Reduced motion: a fade and the title -------------------------------------------------------------------------
    fade(run) {
      const veil = el('travel-veil', run.root);
      run.root.insertBefore(run.titleEl, null);
      run.phase = 'covered';
      this.anim(run, veil, [{ opacity: 0 }, { opacity: 1 }], { duration: 220 });
      this.later(run, 240, () => this.swap(run, () => {
        run.phase = 'title';
        run.titleEl.style.opacity = 1;
        run.titleEl.style.transform = 'translate(-50%, -50%)';
        this.anim(run, veil, [{ opacity: 1 }, { opacity: 0 }], { duration: 300 });
        this.later(run, 320, () => { run.root.style.pointerEvents = 'none'; });
        this.later(run, 1500, () => this.finish(run));
      }));
    },

    // Done, or skipped: whatever's left goes, and you're on the new map.
    finish(run) {
      if (this.now !== run) return;
      this.now = null;
      run.timers.forEach(clearTimeout);
      run.anims.forEach((a) => { try { a.cancel(); } catch (e) { /* already gone */ } });
      if (!run.swapped) { PE.App.g.map.setCurrent(run.id); PE.App.router.replace('empire', { district: run.id }); }
      run.root.hidden = true;
      run.root.innerHTML = '';
      run.root.onpointerdown = null;
    },
  };
  PE.Travel = Travel;
})(globalThis.PE = globalThis.PE || {});
