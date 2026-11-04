// Menus for growing: strain picker, plant details, station details, talents, settings.
(function (PE) {
  const { esc, money, duration, strainThumb } = PE.Dom;
  const g = () => PE.App.g;
  const toast = (t) => PE.Dom.toast(t);

  PE.Panels.strainPicker = {
    title: 'Pick a strain',
    sheet: true,
    render({ fid, si, pi }) {
      const game = g();
      const lvl = game.progress.level();
      const rows = PE.Data.strains.map((s) => {
        const st = game.grow.strainStats(s.id);
        const open = game.grow.isStrainUnlocked(s.id);
        const levelOk = lvl >= st.unlockLevel;
        const seconds = game.grow.cycleSeconds(fid, Number(si), s.id);
        const value = game.grow.expectedSale(fid, Number(si), s.id);
        if (!open && !levelOk && st.unlockLevel > lvl + 3) return '';
        return `<div class="item ${open ? '' : 'locked'}" ${open ? `data-act="plant:${s.id}"` : ''}>
          ${strainThumb(s.id, 5, 60)}
          <div class="grow"><b>${esc(s.name)}</b><small class="r-${s.rarity}">${s.rarity} · ${esc(st.roleLabel)} · Mastery ${game.grow.masteryLevel(s.id)}</small>
          <small>${duration(seconds)} · about ${money(value)} a harvest</small></div>
          ${open ? '<span class="tag go">Plant</span>'
    : levelOk ? `<button class="btn buy small" data-act="unlock:${s.id}">Unlock ${money(st.unlockCost)}</button>`
      : `<span class="tag">Level ${st.unlockLevel}</span>`}
        </div>`;
      }).join('');
      return rows + '<p class="muted center">More strains appear as you level up.</p>';
    },
    actions: {
      plant(id) {
        const r = PE.App.router.current().params;
        if (g().grow.plant(r.fid, Number(r.si), Number(r.pi), id)) PE.App.back();
      },
      unlock(id) {
        const res = g().grow.unlockStrain(id);
        if (!res.ok) toast(res.why === 'cash' ? 'Not enough cash yet' : 'Not available yet');
        else toast(`${g().grow.strainStats(id).name} unlocked!`);
      },
    },
  };

  PE.Panels.plant = {
    title: 'Plant details',
    sheet: true,
    live: true,
    render({ fid, si, pi }) {
      const game = g();
      const p = game.grow.stationOf(fid, Number(si)).pots[Number(pi)];
      if (!p) return '<p class="center">This pot is empty now.</p>';
      const s = game.grow.strainStats(p.s);
      const now = game.now();
      const left = Math.max(0, (p.readyMs - now) / 1000);
      const stage = game.grow.stageOf(p, now);
      const names = PE.Data.strainFrames.stages;
      return `<div class="item big">${strainThumb(p.s, stage, 96)}
        <div class="grow"><b>${esc(s.name)}</b><small class="r-${s.rarity}">${s.rarity} · ${esc(s.roleLabel)}</small>
        <small>Stage: ${names[stage]}</small><small>${left > 0 ? `Ready in ${duration(left)}` : 'Ready to harvest'}</small>
        <small>Worth about ${money(game.grow.expectedSale(fid, Number(si), p.s))}</small></div></div>
        <div class="bar"><i style="width:${(game.grow.potProgress(p, now) * 100).toFixed(1)}%"></i></div>
        ${left > 0 ? '<button class="btn plain wide" data-act="uproot">Remove this plant (no refund)</button>' : '<button class="btn go wide" data-act="harvest">Harvest</button>'}`;
    },
    actions: {
      uproot() {
        const r = PE.App.router.current().params;
        PE.Dom.confirm('Remove plant?', '<p>The plant is thrown away and pays nothing. The pot is free to replant.</p>', 'Remove', () => {
          if (g().grow.uproot(r.fid, Number(r.si), Number(r.pi))) PE.App.back();
        });
      },
      harvest() {
        const r = PE.App.router.current().params;
        g().grow.harvest(r.fid, Number(r.si), Number(r.pi));
        PE.App.back();
      },
    },
  };

  // Stage 1 station sheet. Stage 2 replaces this with the full hydro upgrade screen.
  PE.Panels.station = {
    title: ({ si }) => `Station ${Number(si) + 1}`,
    sheet: true,
    render({ fid, si }) {
      const game = g();
      const st = game.grow.stationOf(fid, Number(si));
      const model = game.B.hydroModels.rows[st.model - 1];
      return `<p><b>${esc(model.name)}</b> · ${st.pots.length} pots · ${st.harvests} harvests</p>
        ${PE.Panels.stationAuto(fid, Number(si))}`;
    },
    actions: {},
  };

  PE.Panels.stationAuto = (fid, si) => {
    const game = g();
    const st = game.grow.stationOf(fid, si);
    const row = (label, which, feature, lvl) => {
      const open = game.grow.hasStationFeature(st, feature);
      return `<div class="item"><div class="grow"><b>${label}</b>${open ? '' : `<small>Opens at player level ${lvl}</small>`}</div>
        ${open ? `<button class="btn small ${st.auto[which] ? 'go' : 'plain'}" data-act="auto:${which}:${st.auto[which] ? 0 : 1}">${st.auto[which] ? 'On' : 'Off'}</button>` : '<span class="tag">Locked</span>'}</div>`;
    };
    return row('Auto-harvest', 'harvest', 'autoHarvest', game.progress.featureLevel('autoHarvest'))
      + row('Auto-replant', 'replant', 'autoReplant', game.progress.featureLevel('autoReplant'))
      + (game.grow.serviceDue(fid, si) ? '<button class="btn wide buy" data-act="service">Top up the water (plants grow 10% slower until you do)</button>' : '');
  };
  PE.Panels.station.actions.auto = (which, on) => {
    const r = PE.App.router.current().params;
    g().grow.setAuto(r.fid, Number(r.si), which, on === '1');
  };
  PE.Panels.station.actions.service = () => {
    const r = PE.App.router.current().params;
    g().grow.service(r.fid, Number(r.si));
  };

  PE.Panels.talents = {
    title: 'Empire Rank and talents',
    sheet: false,
    render() {
      const game = g();
      const st = game.state.player;
      const next = PE.Data.ladder.filter((r) => r.level > st.level).slice(0, 5)
        .map((r) => `<li><b>L${r.level}</b> ${esc(r.kind === 'unlockFacility' ? 'Unlock ' + r.text : r.text)}</li>`).join('');
      const need = game.progress.xpToNext(st.level);
      const rows = game.B.talents.rows.map((t) => {
        const rank = st.talents[t.id] || 0;
        return `<div class="item"><div class="grow"><b>${esc(t.name)}</b><small>${esc(t.text)} · rank ${rank}/${t.maxRanks}</small></div>
          <button class="btn small ${st.talentPoints > 0 && rank < t.maxRanks ? 'go' : 'plain'}" data-act="talent:${t.id}">+1</button></div>`;
      }).join('');
      return `<p><b>Empire Rank ${st.level}</b> · ${PE.Money.format(st.xp)} / ${PE.Money.format(need)} XP</p>
        <div class="bar"><i style="width:${Math.min(100, (PE.Money.toNumber(st.xp) / need) * 100).toFixed(1)}%"></i></div>
        ${next ? `<h4>Coming up</h4><ul class="plain">${next}</ul>` : ''}
        <h4>Talent points: ${st.talentPoints}</h4>${rows}`;
    },
    actions: { talent(id) { g().progress.buyTalent(id); } },
  };

  PE.Panels.settings = {
    title: 'Settings',
    sheet: false,
    render() {
      const s = PE.App.state.settings;
      return `<div class="item"><div class="grow"><b>Reduced motion</b><small>Fewer moving effects</small></div>
        <button class="btn small ${s.reducedMotion ? 'go' : 'plain'}" data-act="motion">${s.reducedMotion ? 'On' : 'Off'}</button></div>
        <p class="muted">Build ${PE.BUILD.startsWith('__') ? 'dev' : esc(PE.BUILD)} · Balance table v${g().B.tableVersion} (provisional)</p>
        <p class="muted">A fictional game for adults. Nothing here is real advice or a real product.</p>`;
    },
    actions: { motion() { const s = PE.App.state.settings; s.reducedMotion = !s.reducedMotion; PE.App.saveGame(); } },
  };

  // Tabs that aren't built yet say so plainly.
  const later = (title, stage) => ({ title, sheet: false, render: () => `<p class="center muted">${esc(title)} arrives in ${stage}.</p>`, actions: {} });
  PE.Panels.empire = later('Empire map', 'Stage 3');
  PE.Panels.collection = later('Collection', 'Stage 4');
  PE.Panels.contracts = later('Contracts', 'Stage 3');
  PE.Panels.shop = later('Shop', 'a later milestone (M6)');

  // UI36: welcome back.
  PE.Offline = {
    showIfPending() {
      const game = g();
      const r = game.offline.pending();
      if (!r || PE.Dom.modalNow) return;
      const grades = r.grades.map((n, i) => (n ? `${n} ${game.B.quality.grades[i].name}` : '')).filter(Boolean).join(', ');
      const extras = r.extras.map((e) => `<li>${esc(e)}</li>`).join('');
      PE.Dom.modal({
        title: 'Welcome back!',
        cls: 'welcome',
        html: `<p>You were away for <b>${duration(r.awaySeconds)}</b>.${r.capped ? ` Automation is capped at ${duration(game.offline.capSeconds())}.` : ''}</p>
          <p class="bigcash">${money(r.cash)}</p>
          <ul class="plain"><li>${PE.Money.format(r.harvests)} harvests sold${grades ? `: ${grades}` : ''}</li><li>+${PE.Money.format(r.xp)} XP</li>${extras}</ul>`,
        buttons: [{
          label: 'Collect',
          style: 'go',
          onTap: () => { game.offline.claim(); PE.App.saveGame(); },
        }],
      });
    },
  };
})(globalThis.PE = globalThis.PE || {});
