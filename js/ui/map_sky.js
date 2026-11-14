// Job 25: the map's sky. A gentle layer over the Empire map that follows the phone's own clock and weather of the day:
//   morning   a soft gold wash          (6 to 9)
//   day       nothing: the painting as Aaron drew it
//   evening   warm orange, and a warm light comes on at every building you own   (18 to 21)
//   night     a deep blue wash, the building lights stronger                    (21 to 6)
//   rain      now and then (about one day in four, for a couple of hours, picked from the date): light rain streaks
//             and a slightly grey wash. Sunny the rest of the time.
// Off with Low power or Reduced motion (the map shows plain daylight then). Taps go straight through it. No art needed:
// shapes only, until weather art exists.
(function (PE) {
  const WASH = {
    morning: { colour: 0xffc46b, alpha: 0.12 },
    day: null,
    evening: { colour: 0xff8a3d, alpha: 0.2 },
    night: { colour: 0x1a1f5e, alpha: 0.38 },
  };
  const RAIN_WASH = { colour: 0x6b7a8f, alpha: 0.16 };
  const DROPS = 70;

  // What the sky is doing at this moment (the phone's time).
  function sky(ms = Date.now()) {
    const d = new Date(ms);
    const h = d.getHours() + d.getMinutes() / 60;
    const part = h >= 21 || h < 6 ? 'night' : h >= 18 ? 'evening' : h < 9 ? 'morning' : 'day';
    // Rain: a steady pick from the date, so it's the same all day for everyone on that date, and it can be tested.
    const day = Math.floor((ms - d.getTimezoneOffset() * 60000) / 86400000);
    let x = (day * 2654435761) >>> 0; x ^= x >>> 13; x = Math.imul(x, 1597334677) >>> 0;
    const rainy = x % 4 === 0;
    const start = 9 + (x % 9);   // starts between 9 am and 5 pm, lasts two hours
    const raining = rainy && h >= start && h < start + 2;
    return { part, raining, lights: part === 'evening' || part === 'night' };
  }

  const Sky = {
    sky,
    // forced: { part, raining } for the tests and the tester panel.
    forced: null,
    attach(scene) {
      const st = { scene, wash: null, drops: [], lights: [], sig: '' };
      scene.sky = st;
      const cam = scene.cameras.main;
      st.wash = scene.add.rectangle(0, 0, 10, 10, 0x000000, 0).setOrigin(0, 0).setScrollFactor(0).setDepth(70000);
      if (!scene.textures.exists('sky-drop')) {
        const G = scene.make.graphics({ x: 0, y: 0, add: false });
        G.fillStyle(0xdfeaff, 0.75).fillRoundedRect(0, 0, 3, 26, 1.5);
        G.generateTexture('sky-drop', 3, 26);
        G.destroy();
      }
      if (!scene.textures.exists('sky-light')) {
        const G = scene.make.graphics({ x: 0, y: 0, add: false });
        for (let r = 62; r > 0; r -= 4) G.fillStyle(0xffd27a, 0.05).fillCircle(64, 64, r);
        G.generateTexture('sky-light', 128, 128);
        G.destroy();
      }
      Sky.update(scene, 0, true);
      scene.events.once('shutdown', () => { scene.sky = null; });
      void cam;
    },
    now() { return Sky.forced || (window.__skyDay ? { part: 'day', raining: false, lights: false } : sky()); },
    update(scene, dt, force) {
      const st = scene.sky;
      if (!st) return;
      const calm = PE.App.calm();
      const s = calm ? { part: 'day', raining: false, lights: false } : Sky.now();
      const cam = scene.cameras.main;
      const sig = `${s.part}|${s.raining}|${s.lights}|${cam.width}x${cam.height}`;
      if (force || sig !== st.sig) {
        st.sig = sig;
        st.state = s;
        const w = s.raining ? RAIN_WASH : WASH[s.part];
        st.wash.setSize(cam.width, cam.height).setFillStyle(w ? w.colour : 0, w ? w.alpha : 0).setVisible(!!w);
        // Building lights: a warm pool at each building you own.
        for (const l of st.lights) l.destroy();
        st.lights = [];
        if (s.lights && scene.views) {
          for (const v of scene.views.values()) {
            if (v.feature || !PE.App.g.facilities.isOwned(v.fid)) continue;
            const glow = scene.add.image(v.s.x, v.s.y - 60, 'sky-light').setBlendMode(Phaser.BlendModes.ADD).setDepth(70001)
              .setDisplaySize((v.artW || v.s.w || 300) * 1.3, (v.artW || v.s.w || 300) * 0.8).setAlpha(s.part === 'night' ? 0.7 : 0.45);
            st.lights.push(glow);
          }
        }
        for (const d of st.drops) d.destroy();
        st.drops = [];
        if (s.raining) {
          for (let i = 0; i < DROPS; i++) {
            const d = scene.add.image(Math.random() * cam.width, Math.random() * cam.height, 'sky-drop').setScrollFactor(0).setDepth(70002).setAngle(12).setAlpha(0.55);
            d.speed = 900 + Math.random() * 500;
            st.drops.push(d);
          }
        }
      }
      // The rain falls (a few dozen small pictures, moved each frame; none at all when it's dry).
      for (const d of st.drops) {
        d.y += d.speed * dt;
        d.x -= d.speed * dt * 0.2;
        if (d.y > cam.height + 30) { d.y = -30; d.x = Math.random() * (cam.width + 100); }
      }
    },
  };
  PE.MapSky = Sky;
})(globalThis.PE = globalThis.PE || {});
