// Sound, music, phone vibration, the frames-per-second counter and button "juice" (bible section 1).
//
// REAL SOUNDS since big job 3: docs/SOUND_LIST.md lists every file and where it came from. Each is fetched the
// first time it's needed, so nothing loads before the player taps. While one is on its way (or if it can't
// load) a short tone made by the browser stands in, so a press is never silent.
// Music and ambience are long, so they play from the file itself, which takes far less memory than a decoded
// sound. If the music can't load, the old quiet generated chords play instead.
// Sound only starts after the first tap, as phones require.
(function (PE) {
  const settings = () => PE.App.state.settings;

  // The stand-in tones: [ [frequency Hz, start s, length s, wave], ... ]
  const TONES = {
    tap: [[660, 0, 0.05, 'triangle']],
    button: [[660, 0, 0.05, 'triangle']],
    upgrade: [[523, 0, 0.07, 'triangle'], [784, 0.06, 0.1, 'triangle']],
    plant: [[440, 0, 0.06, 'sine']],
    harvest: [[392, 0, 0.06, 'sine'], [587, 0.05, 0.12, 'sine']],
    collect: [[784, 0, 0.06, 'triangle'], [1047, 0.05, 0.1, 'triangle']],
    celebrate: [[523, 0, 0.1, 'triangle'], [659, 0.09, 0.1, 'triangle'], [784, 0.18, 0.1, 'triangle'], [1047, 0.27, 0.22, 'triangle']],
    helper: [[880, 0, 0.05, 'sine'], [1175, 0.05, 0.08, 'sine']],
    error: [[196, 0, 0.12, 'square']],
  };
  const LOUDNESS = { tap: 0.35, button: 0.45, reveal: 0.6, plant: 0.6, helper: 0.6 };
  const CHORDS = [[220, 277, 330], [196, 247, 294], [175, 220, 262], [196, 247, 330]];
  const FIRST_TO_FETCH = ['tap', 'button', 'plant', 'harvest', 'collect', 'error'];

  const Sound = {
    ctx: null,
    last: {},
    buffers: {},
    fetching: {},
    musicTimer: null,
    chord: 0,
    onMap: false,
    tracks: {},    // music and ambience: { el, gain, failed }
    played: [],    // the last few, for the automatic check
    ext() {
      if (Sound._ext) return Sound._ext;
      const probe = document.createElement('audio');
      Sound._ext = probe.canPlayType && probe.canPlayType('audio/ogg; codecs="vorbis"') ? 'ogg' : 'm4a';
      return Sound._ext;
    },
    unlock() {
      if (Sound.ctx) { if (Sound.ctx.state === 'suspended') Sound.ctx.resume().catch(() => {}); Sound.syncMusic(); return; }
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      try { Sound.ctx = new AC(); } catch (e) { return; }
      FIRST_TO_FETCH.forEach((n) => Sound.fetchSound(n));
      Sound.syncMusic();
    },
    fetchSound(name) {
      if (Sound.buffers[name] || Sound.fetching[name] || !Sound.ctx || location.protocol === 'file:') return;
      Sound.fetching[name] = true;
      fetch(`assets/audio/${name}.${Sound.ext()}`)
        .then((r) => { if (!r.ok) throw new Error('missing'); return r.arrayBuffer(); })
        .then((data) => Sound.ctx.decodeAudioData(data))
        .then((buffer) => { Sound.buffers[name] = buffer; })
        .catch(() => { /* the tone keeps standing in */ });
    },
    tone(freq, at, len, wave, vol) {
      const c = Sound.ctx;
      const o = c.createOscillator(), gn = c.createGain();
      o.type = wave; o.frequency.value = freq;
      const t0 = c.currentTime + at;
      gn.gain.setValueAtTime(0.0001, t0);
      gn.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), t0 + Math.min(0.015, len / 3));
      gn.gain.exponentialRampToValueAtTime(0.0001, t0 + len);
      o.connect(gn).connect(c.destination);
      o.start(t0); o.stop(t0 + len + 0.02);
    },
    play(name) {
      const vol = settings().sound;
      if (!Sound.ctx || !(vol > 0) || document.hidden || PE.Native.away) return;
      const now = performance.now();
      if (now - (Sound.last[name] || 0) < 70) return;   // a burst of the same sound plays once
      Sound.last[name] = now;
      Sound.played.push(name);
      if (Sound.played.length > 40) Sound.played.shift();
      const buffer = Sound.buffers[name];
      if (buffer) {
        const src = Sound.ctx.createBufferSource(), gn = Sound.ctx.createGain();
        src.buffer = buffer;
        gn.gain.value = vol * (LOUDNESS[name] || 0.8);
        src.connect(gn).connect(Sound.ctx.destination);
        src.start();
        return;
      }
      Sound.fetchSound(name);
      for (const [f, at, len, wave] of TONES[name] || []) Sound.tone(f, at, len, wave, 0.12 * vol);
    },
    // A long looping file. Fetched whole first: that also makes it work from the offline copy.
    track(name) {
      if (Sound.tracks[name]) return Sound.tracks[name];
      const tr = Sound.tracks[name] = { el: null, gain: null, failed: location.protocol === 'file:' };
      if (tr.failed) return tr;
      fetch(`assets/audio/${name}.${Sound.ext()}`)
        .then((r) => { if (!r.ok) throw new Error('missing'); return r.blob(); })
        .then((blob) => {
          const el = new Audio(URL.createObjectURL(blob));
          el.loop = true;
          const gain = Sound.ctx.createGain();
          gain.gain.value = 0;
          Sound.ctx.createMediaElementSource(el).connect(gain).connect(Sound.ctx.destination);
          tr.el = el; tr.gain = gain;
          Sound.syncMusic();
        })
        .catch(() => { tr.failed = true; Sound.syncMusic(); });
      return tr;
    },
    setTrack(name, level) {
      const on = Sound.ctx && level > 0 && !document.hidden && !PE.Native.away;
      if (!on && !Sound.tracks[name]) return null;
      const tr = Sound.track(name);
      if (!tr.el) return tr;
      tr.gain.gain.setTargetAtTime(on ? level : 0, Sound.ctx.currentTime, 0.2);
      if (on && tr.el.paused) tr.el.play().catch(() => { /* phones may need one more tap: retried on the next one */ });
      else if (!on && !tr.el.paused) tr.el.pause();
      return tr;
    },
    // Called whenever a volume, the map or the screen changes, and on every tap.
    syncMusic() {
      if (!Sound.ctx) return;
      const s = settings();
      const tr = Sound.setTrack('music', s.music * 0.45);
      Sound.setTrack('ambience', Sound.onMap ? s.sound * 0.3 : 0);
      // The generated chords only if the real music file can't be had.
      const chords = !!(tr && tr.failed) && s.music > 0 && !document.hidden && !PE.Native.away;
      if (chords && !Sound.musicTimer) {
        const step = () => {
          const v = settings().music * 0.035;
          for (const f of CHORDS[Sound.chord % CHORDS.length]) Sound.tone(f, 0, 3.6, 'sine', v);
          Sound.chord++;
        };
        step();
        Sound.musicTimer = setInterval(step, 3800);
      } else if (!chords && Sound.musicTimer) { clearInterval(Sound.musicTimer); Sound.musicTimer = null; }
    },
    setOnMap(on) { Sound.onMap = on; Sound.syncMusic(); },
  };

  // ---- Phone vibration. Adapted from Aaron's canvas management series (core/Haptics.js). -----------------
  const Haptics = {
    count: 0,
    buzz(pattern) {
      if (settings().haptics === false) return;
      Haptics.count++;
      try { if (navigator.vibrate) navigator.vibrate(pattern); } catch (e) { /* not allowed here */ }
    },
    light() { Haptics.buzz(12); },
    medium() { Haptics.buzz(28); },
    strong() { Haptics.buzz([40, 50, 90]); },
  };
  PE.Haptics = Haptics;

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
    // Sounds and vibration from what happens in the game.
    let lastHarvestBuzz = 0;
    g.on((type, e) => {
      if (type === 'harvest') {
        Sound.play('harvest');
        if (performance.now() - lastHarvestBuzz > 150) { lastHarvestBuzz = performance.now(); Haptics.light(); }
      } else if (type === 'levelUp') { Sound.play('levelup'); Haptics.strong(); }
      else if (type === 'celebrate') { if (!e || e.kind !== 'station') Sound.play('celebrate'); }
      else if (type === 'helperSay') Sound.play('helper');
      else if (type === 'purchased') Sound.play('upgrade');
      else if (type === 'festivalStarted') Sound.play('festival');
      else if (type === 'offlineClaimed') { Sound.play('collect'); Haptics.medium(); }
    });
    const spend = g.spend;
    g.spend = (...a) => { const ok = spend(...a); if (ok) Sound.play('upgrade'); return ok; };
    // Collecting and planting aren't events of their own, so these listen in on the actions themselves.
    const after = (obj, key, fn) => { const was = obj[key]; obj[key] = (...a) => { const r = was.apply(obj, a); fn(r); return r; }; };
    const collected = (r) => { if (r && r.ok) { Sound.play('collect'); Haptics.medium(); } };
    after(g.grow, 'plant', (r) => { if (r) Sound.play('plant'); });
    after(g.map, 'collect', collected);
    after(g.map, 'claimGift', (r) => { if (r && r.ok) { Sound.play('gift'); Haptics.medium(); } });
    after(g.business, 'claimLine', collected);
    after(g.business, 'claimRoute', collected);
    after(g.calendar, 'claim', collected);
    const toast = PE.Dom.toast.bind(PE.Dom);
    PE.Dom.toast = (text, kind, iconId) => { if (/^Not |^No more|switched off/.test(text)) Sound.play('error'); toast(text, kind, iconId); };

    // Every tap: unlock sound (phones need a tap first) and a click on buttons.
    window.addEventListener('pointerdown', (e) => {
      Sound.unlock();
      if (!e.target.closest) return;
      if (e.target.closest('#ui .btn, #ui .chest')) Sound.play('button');
      else if (e.target.closest('#ui button, #ui [data-act]')) Sound.play('tap');
    }, true);
    document.addEventListener('visibilitychange', () => Sound.syncMusic());
    applyLook();
  };
})(globalThis.PE = globalThis.PE || {});
