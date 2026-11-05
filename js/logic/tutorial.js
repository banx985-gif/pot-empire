// The first-time guide and one-time hints: which step we're on and when it ends. No drawing here (that's
// js/ui/tutorial_ui.js) and no words (those are in data/tutorial.js).
//
// The idea of one-time hints, each with a rule and remembered once fired, comes from Aaron's canvas management
// series (core/HintSystem.js).
(function (PE) {
  PE.Game.register('tutorial', (g) => {
    const { state, data } = g;
    const T = () => {
      if (!state.tutorial) state.tutorial = PE.SaveSchema.newTutorial();
      if (!state.tutorial.hints) state.tutorial.hints = {};
      return state.tutorial;
    };
    const steps = () => data.tutorial.steps;

    // What the guide can see. route() is the screen or menu showing now, set by the drawing side.
    const view = { route: () => null, params: () => ({}) };
    const station = (si) => g.grow.stationOf('F01', si);
    const hasStation = (si) => g.facilities.ownedStationCount('F01') > si;
    const emptyPot = (si) => (hasStation(si) ? station(si).pots.findIndex((p) => !p) : -1);
    const anyPots = (test) => {
      let hit = false;
      g.grow.eachStation((f, si, st) => { if (f === 'F01' && st.pots.some((p) => p && test(p))) hit = true; });
      return hit;
    };
    const ripe = () => anyPots((p) => g.now() >= p.readyMs);
    const growing = () => anyPots(() => true);
    const panelIs = (name) => view.route() === name;
    const firstCost = () => g.grow.branchCost('F01', 0, 'lights');
    const lightMaxed = () => station(0).levels.lights >= g.B.hydro.mainModelGate.maxLevel;

    // What ends a step, what skips one, and what a step needs.
    const CHECK = {
      pickerOpen: () => panelIs('strainPicker'),
      pickerShut: () => !panelIs('strainPicker'),
      stationOpen: () => panelIs('station'),
      stationShut: () => !panelIs('station'),
      noPanel: () => view.route() === 'garage',
      onMap: () => view.route() === 'empire',
      plantedOne: () => growing(),
      plantedTwo: () => hasStation(1) && station(1).pots.some(Boolean),
      somethingRipe: ripe,
      nothingRipe: () => !ripe(),
      nothingGrowing: () => !growing(),
      noEmptyPot: () => emptyPot(0) < 0,
      noSecondPot: () => !hasStation(1) || emptyPot(1) < 0,
      harvested: () => T().harvestedAt !== undefined,
      upgraded: () => station(0).levels.lights > (T().lightsAtStart || 1),
      // On a first play the envelope pays for it. On a replay, only if there's money for it.
      cantUpgrade: () => lightMaxed() || (T().gifted && !g.canAfford('cash', firstCost())),
    };

    const H = (fn) => { try { return !!fn(); } catch (e) { return false; } };
    const RULES = {
      stationReady: () => g.facilities.canBuyStation('F01'),
      modelReady: () => {
        let ready = false;
        g.grow.eachStation((f, si) => { const p = g.grow.modelUpgradePreview(f, si); if (p && p.gateMet) ready = true; });
        return ready;
      },
      hasManager: () => Object.keys(state.managers.owned).length > 0,
      hasRetail: () => g.facilities.rows.some((r) => r.mode === 'Retail' && g.facilities.isOwned(r.id)),
      hasFactory: () => g.facilities.rows.some((r) => r.mode === 'Factory' && g.facilities.isOwned(r.id)),
      inFactory: () => panelIs('business') && g.facilities.row(view.params().fid).mode === 'Factory',
      festivalOn: () => g.meta.festivalNow().active,
      prestigeOpen: () => g.progress.level() >= g.meta.prestigeUnlockLevel(),
      calendarReady: () => g.calendar.canClaim() && view.route() === 'empire',
      secondDistrict: () => g.map.districts().filter((d) => g.map.isUnlocked(d.id)).length > 1,
    };

    function enter() {
      const t = T();
      if (t.done) return;
      // Steps that can't be done right now are passed over.
      while (t.step < steps().length) {
        const s = steps()[t.step];
        if (!(s.skipIf && CHECK[s.skipIf] && CHECK[s.skipIf]())) break;
        t.step++;
      }
      if (t.step >= steps().length) { finish(false); return; }
      const s = steps()[t.step];
      if (s.gift) {
        g.once('tutorial:envelope', () => {
          const short = firstCost() - PE.Money.toNumber(state.currencies.cash);
          if (short > 0) g.earn('cash', String(Math.ceil(short)), 'tutorial');
          t.gifted = true;
          g.emit('changed');
        });
      }
      if (s.until === 'upgraded') t.lightsAtStart = station(0).levels.lights;
    }
    function finish(skipped) {
      const t = T();
      t.done = true;
      t.skipped = !!skipped;
      t.replay = false;
      t.step = 0;
      g.emit('tutorialEnded', { skipped: !!skipped });
      g.emit('changed');
    }

    g.on((type) => {
      if (type === 'harvest' && !T().done && T().harvestedAt === undefined) T().harvestedAt = g.now();
    });

    g.tutorial = {
      setView(route, params) { view.route = route; view.params = params; },
      active: () => !T().done,
      step: () => (T().done ? null : steps()[T().step] || null),
      stepIndex: () => T().step,
      total: () => steps().length,
      emptyPot,
      // Called often by the drawing side. Moves on when the step's job is done.
      update() {
        const t = T();
        if (t.done) return;
        const s = steps()[t.step];
        if (!s) { finish(false); return; }
        // Finished first: a choice in a menu closes that menu, and that's success, not backing out.
        if (s.until !== 'next' && CHECK[s.until] && CHECK[s.until]()) { t.step++; t.lastEntered = t.step; enter(); return; }
        if (s.needs && CHECK[s.needs] && !CHECK[s.needs]()) {
          // The player backed out (the phone's Back button, say): one step back.
          if (t.step > 0) t.step--;
          t.lastEntered = t.step;
          enter();
          return;
        }
        if (t.lastEntered !== t.step) { t.lastEntered = t.step; enter(); }
      },
      next() {
        const t = T();
        const s = steps()[t.step];
        if (t.done || !s || s.until !== 'next') return;
        t.step++;
        enter();
        if (t.step >= steps().length) finish(false);
      },
      skip() { if (!T().done) finish(true); },
      // Offered once: the first plant is ready right away.
      canSpeedUp: () => !state.appliedTransactionIds.includes('tutorial:speedup') && growing() && !ripe(),
      speedUp() {
        return g.once('tutorial:speedup', () => {
          g.grow.eachStation((f, si, st) => {
            if (f !== 'F01') return;
            st.pots.forEach((p) => { if (p && g.now() < p.readyMs) { const left = p.readyMs - g.now(); p.readyMs -= left; p.plantedMs -= left; } });
          });
          g.emit('changed');
        });
      },
      replay() {
        const t = T();
        Object.assign(t, { step: 0, done: false, skipped: false, replay: true, lastEntered: undefined, harvestedAt: undefined });
        enter();
        g.emit('changed');
      },

      // ---- Hints ------------------------------------------------------------------------------------------
      hintSeen: (id) => !!T().hints[id],
      // The next hint that's due, or null. At most one at a time; the game shows it and marks it seen.
      dueHint() {
        const t = T();
        if (!t.done) return null;
        // A save from before hints existed has already seen all of what's open to it: no old news.
        if (t.oldSave) {
          for (const h of data.tutorial.hints) if (H(RULES[h.rule])) t.hints[h.id] = true;
          t.oldSave = false;
          return null;
        }
        return data.tutorial.hints.find((h) => !t.hints[h.id] && H(RULES[h.rule])) || null;
      },
      markHint(id) { T().hints[id] = true; },
      RULES,
      CHECK,
    };
  });
})(globalThis.PE = globalThis.PE || {});
