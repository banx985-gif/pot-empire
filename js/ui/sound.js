// Sound, music, the frames-per-second counter and button "juice" (bible section 1: rich, lively buttons).
//
// STAND-IN SOUNDS: there are no sound files yet, so every sound is a short tone made by the browser
// (Web Audio) and the music is a slow, quiet generated chord loop. All are listed in the asset
// registry (SFX-* and MUSIC-*) so real ones can replace them by name.
// Sound only starts after the first tap, as phones require.
(function (PE) {
  const settings = () => PE.App.state.settings;

  // name: [ [frequency Hz, start s, length s, wave], ... ]
  const SOUNDS = {
    tap: [[660, 0, 0.05, 'triangle']],
    buy: [[523, 0, 0.07, 'triangle'], [784, 0.06, 0.1, 'triangle']],
    harvest: [[392, 0, 0.06, 'sine'], [587, 0.05, 0.12, 'sine']],
    celebrate: [[523, 0, 0.1, 'triangle'], [659, 0.09, 0.1, 'triangle'], [784, 0.18, 0.1, 'triangle'], [1047, 0.27, 0.22, 'triangle']],
    helper: [[880, 0, 0.05, 'sine'], [1175, 0.05, 0.08, 'sine']],
    error: [[196, 0, 0.12, 'square']],
  };
  const CHORDS = [[220, 277, 330], [196, 247, 294], [175, 220, 262], [196, 247, 330]];

  const Sound = {
    ctx: null,
    last: {},
    musicTimer: null,
    chord: 0,
    unlock() {
      if (Sound.ctx) { if (Sound.ctx.state === 'suspended') Sound.ctx.resume().catch(() => {}); return; }
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      try { Sound.ctx = new AC(); } catch (e) { return; }
      Sound.syncMusic();
    },
    tone(freq, at, len, wave, vol) {
      const c = Sound.ctx;
      const o = c.createOscillator(), gn = c.createGain();
      o.type = wave; o.frequency.value = freq;
      const t = c.currentTime + at;
      gn.gain.setValueAtTime(0.0001, t);
      gn.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), t + Math.min(0.015, len / 3));
      gn.gain.exponentialRampToValueAtTime(0.0001, t + len);
      o.connect(gn).connect(c.destination);
      o.start(t); o.stop(t + len + 0.02);
    },
    play(name) {
      const vol = settings().sound;
      if (!Sound.ctx || !(vol > 0) || document.hidden) return;
      const now = performance.now();
      if (now - (Sound.last[name] || 0) < 70) return;   // a burst of the same sound plays once
      Sound.last[name] = now;
      for (const [f, at, len, wave] of SOUNDS[name]) Sound.tone(f, at, len, wave, 0.12 * vol);
    },
    // A quiet chord every few seconds while music is on and the game is showing.
    syncMusic() {
      const on = Sound.ctx && settings().music > 0 && !document.hidden;
      if (on && !Sound.musicTimer) {
        const step = () => {
          const v = settings().music * 0.035;
          for (const f of CHORDS[Sound.chord % CHORDS.length]) Sound.tone(f, 0, 3.6, 'sine', v);
          Sound.chord++;
        };
        step();
        Sound.musicTimer = setInterval(step, 3800);
      } else if (!on && Sound.musicTimer) { clearInterval(Sound.musicTimer); Sound.musicTimer = null; }
    },
  };

  // ---- Frames per second, for checking speed on a phone (Settings) ------------------------------------
  const Fps = {
    timer: null,
    sync() {
      const el = document.getElementById('fps');
      const on = settings().showFps;
      el.hidden = !on;
      if (on && !Fps.timer && !PE.App.game) { setTimeout(Fps.sync, 300); return; }   // the game isn't made yet
      if (on && !Fps.timer) {
        // Counts pictures really drawn (the screen refresh rate can be higher when the room is idle).
        let frames = 0, last = performance.now(), worst = 0, prev = performance.now();
        Fps.count = () => { frames++; const n = performance.now(); worst = Math.max(worst, n - prev); prev = n; };
        PE.App.game.events.on('postrender', Fps.count);
        Fps.timer = setInterval(() => {
          const game = PE.App.game;
          const now = performance.now();
          const fps = (frames * 1000) / (now - last);
          frames = 0; last = now;
          const mem = performance.memory ? ` · ${Math.round(performance.memory.usedJSHeapSize / 1048576)} MB` : '';
          const active = game.scene.getScenes(true).length ? '' : ' (room paused)';
          el.textContent = `${Math.round(fps)} fps · slowest ${Math.round(worst)} ms${mem}${active}`;
          worst = 0;
        }, 1000);
      } else if (!on && Fps.timer) { clearInterval(Fps.timer); Fps.timer = null; PE.App.game.events.off('postrender', Fps.count); }
    },
  };

  // ---- Look and feel switches ---------------------------------------------------------------------------
  function applyLook() {
    const s = settings();
    const root = document.documentElement;
    root.classList.toggle('big-text', !!s.bigText);
    root.classList.toggle('calm', !!s.reducedMotion);
    root.classList.toggle('cb', !!s.colourBlind);
    Fps.sync();
    Sound.syncMusic();
  }

  PE.Sound = Sound;
  PE.Fps = Fps;
  // Redraws the grow room (after a theme or colour-blind change), even while it waits behind a menu.
  function redrawRoom() {
    const sc = PE.App.game && PE.App.game.scene.getScene('garage');
    if (sc && (sc.scene.isActive() || sc.scene.isSleeping())) { const wasAsleep = sc.scene.isSleeping(); sc.scene.restart(sc.scene.settings.data); if (wasAsleep) sc.events.once('create', () => sc.scene.sleep()); }
  }
  PE.Look = { apply: applyLook, redrawRoom };

  PE.Look.init = () => {
    const g = PE.App.g;
    // Sounds from what happens in the game.
    g.on((type) => {
      if (type === 'harvest') Sound.play('harvest');
      else if (type === 'celebrate') Sound.play('celebrate');
      else if (type === 'helperSay') Sound.play('helper');
      else if (type === 'purchased') Sound.play('buy');
    });
    const spend = g.spend;
    g.spend = (...a) => { const ok = spend(...a); if (ok) Sound.play('buy'); return ok; };
    const toast = PE.Dom.toast.bind(PE.Dom);
    PE.Dom.toast = (text, kind) => { if (/^Not |^No more|switched off/.test(text)) Sound.play('error'); toast(text, kind); };

    // Every tap: unlock sound (phones need a tap first) and a click on buttons.
    window.addEventListener('pointerdown', (e) => {
      Sound.unlock();
      if (e.target.closest && e.target.closest('#ui button, #ui [data-act]')) Sound.play('tap');
    }, true);
    document.addEventListener('visibilitychange', () => Sound.syncMusic());
    applyLook();
  };
})(globalThis.PE = globalThis.PE || {});
