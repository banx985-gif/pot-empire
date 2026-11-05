// Helpers and milestone celebrations (bible sections 1, 9, 10A). The rules decide WHEN something is
// worth a word or a celebration; the screens (js/ui/helpers_ui.js) decide how it looks.
//
// Helpers: Uncle Haze, Budz and Leafy say one short joke from data/jokes.js when something meaningful
// happens. The first time of each kind always gets a line. After that a line is only a maybe, and
// never sooner than the cooldown after the last one, so they stay occasional rather than chatty.
// Jokes aren't repeated until every joke for that event has been heard.
//
// Celebrations: short, skippable, sent as 'celebrate' events. First-time ones are written into
// state.milestones so they only ever happen once.
(function (PE) {
  PE.Game.register('helpers', (g) => {
    const { state, data, B } = g;
    const H = () => B.helpers;
    const C = () => B.celebrations;
    const hs = () => state.helpers;
    const RARITIES = PE.DataCheck.RARITIES;
    const helperName = Object.fromEntries(data.helpers.map((h) => [h.id, h.name]));
    const byEvent = {};
    for (const j of data.jokes) (byEvent[j.event] = byEvent[j.event] || []).push(j);

    // Its own counter, so asking the helpers never moves the dice used for harvests.
    function roll(label) { hs().tries = (hs().tries || 0) + 1; return PE.Rng.roll(`${state.rng.seed}:helper:${label}:${hs().tries}`); }

    // Returns the joke said, or null if the helpers stay quiet this time.
    function say(event) {
      const list = byEvent[event];
      if (!list || !state.settings.helpers) return null;
      const now = g.now();
      const first = !hs().firstDone[event];
      if (!first) {
        if (now - hs().lastMs < H().cooldownMinutes * 60000) return null;
        if (roll('maybe:' + event) >= H().repeatChance) return null;
      }
      const fresh = list.filter((j) => !hs().seen[j.id]);
      const pool = fresh.length ? fresh : list.filter((j) => j.id !== hs().lastId);
      const j = pool[Math.floor(roll('pick:' + event) * pool.length)] || list[0];
      hs().firstDone[event] = true;
      hs().seen[j.id] = (hs().seen[j.id] || 0) + 1;
      hs().lastMs = now;
      hs().lastId = j.id;
      hs().said += 1;
      g.emit('helperSay', { jokeId: j.id, helper: j.helper, name: helperName[j.helper], text: j.text, event, face: j.face, face2: j.face2 });
      return j;
    }

    // A celebration that can only ever happen once. Returns true the first time.
    function firstTime(key) {
      if (state.milestones[key]) return false;
      state.milestones[key] = g.nowUtc();
      return true;
    }
    const celebrate = (kind, text) => g.emit('celebrate', { kind, text });

    function isMajorRank(level) { return level % C().rankEvery === 0 || C().majorRanks.includes(level); }

    function setDone(item) {
      if (!item || !item.set) return false;
      const list = item.category === 'relic' ? data.collectibles.relics : item.category === 'decoration' ? data.collectibles.decorations : null;
      if (!list) return false;
      return list.filter((x) => x.set === item.set).every((x) => state.collections.owned[x.id]);
    }

    g.on((type, e) => {
      switch (type) {
        case 'harvest':
          if (state.stats.harvests === 1) say('firstHarvest');
          if (e.grade === B.quality.grades.length - 1 && firstTime('firstGrade:top')) celebrate('discovery', `First ${B.quality.grades[e.grade].name} harvest!`);
          break;
        case 'strainUnlocked': {
          const ri = RARITIES.indexOf(e.rarity);
          if (ri >= 2 && firstTime('rarity:' + e.rarity)) {
            celebrate('discovery', `Your first ${e.rarity} strain: ${g.grow.strainStats(e.id).name}!`);
            say('rareFind');
          }
          break;
        }
        case 'celebrate':
          if (e.kind === 'model') say('bigUpgrade');
          else if (e.kind === 'prestige') say('prestige');
          else if (e.kind === 'rival') say('rival');
          break;
        case 'facilityBought': say('facility'); break;
        case 'levelUp':
          if (isMajorRank(e.level)) {
            celebrate('rank', `Empire Rank ${e.level}!`);
            if (e.level % C().rankEvery === 0) say('rank');
          }
          break;
        case 'itemGained': {
          const item = g.collections.item(e.id);
          if (setDone(item) && firstTime(`set:${item.category}:${item.set}`)) {
            celebrate('set', `${item.set} set complete!`);
            say('setComplete');
          }
          break;
        }
        case 'offlineClaimed':
          if (e.awaySeconds >= H().idleReturnHours * 3600) say('idleReturn');
          break;
        default:
      }
    });

    // First useful automation: checked on the heartbeat until it has happened once.
    const baseTick = g.tick;
    g.tick = function tick() {
      baseTick();
      if (state.milestones.automation) return;
      let on = false;
      g.grow.eachStation((fid, si, st) => { if (st.auto.harvest && st.auto.replant) on = true; });
      if (on && firstTime('automation')) {
        celebrate('automation', 'Fully automatic! This station now harvests and replants by itself.');
        say('automation');
      }
    };

    g.helpers = {
      say,
      isMajorRank,
      heard: () => data.jokes.filter((j) => hs().seen[j.id]),
      // Tapped on the map: always answers, never touches the cooldown, doesn't repeat itself straight away.
      chat(helperId) {
        const list = data.jokes.filter((j) => j.event === 'chat' && j.helper === helperId);
        if (!list.length) return null;
        const fresh = list.filter((j) => !hs().seen[j.id]);
        const pool = fresh.length ? fresh : list.filter((j) => j.id !== hs().lastId);
        const j = pool[Math.floor(roll('chat') * pool.length)] || list[0];
        hs().seen[j.id] = (hs().seen[j.id] || 0) + 1;
        hs().lastId = j.id;
        g.emit('helperSay', { jokeId: j.id, helper: j.helper, name: helperName[j.helper], text: j.text, event: 'chat', face: j.face, face2: j.face2, replay: true });
        return j;
      },
      // Help replay: says a joke heard before, without touching the cooldown.
      replay(jokeId) {
        const j = data.jokes.find((x) => x.id === jokeId);
        if (!j || !hs().seen[j.id]) return false;
        g.emit('helperSay', { jokeId: j.id, helper: j.helper, name: helperName[j.helper], text: j.text, event: j.event, face: j.face, face2: j.face2, replay: true });
        return true;
      },
    };
  });
})(globalThis.PE = globalThis.PE || {});
