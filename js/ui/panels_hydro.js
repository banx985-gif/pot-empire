// Station details and hydro upgrades (UI05, UI09), strain album and mastery (UI22, UI23).
(function (PE) {
  const { esc, money, duration, strainThumb } = PE.Dom;
  const g = () => PE.App.g;
  const params = () => PE.App.router.current().params;

  const BRANCH_NAMES = { lights: 'Hanging light', sprinkler: 'Sprinkler', pots: 'Pots', computer: 'Computer', capacity: 'Pot slots' };
  const BRANCH_ICONS = { lights: 'UPG-01', sprinkler: 'UPG-02', pots: 'UPG-03', computer: 'UPG-04', capacity: 'UPG-05' };
  const VISUALS = {
    lights: ['Tiny lamp', 'Long strip', 'Dual strips', 'Wide panel', 'Segmented array', 'Full-width showpiece'],
    sprinkler: ['Single nozzle', 'Twin nozzle', 'Triple nozzle', 'Spray bar', 'Dual spray bar', 'Full rail'],
    pots: ['Small plain', 'Wider rim', 'Taller glossy', 'Reinforced', 'Large premium', 'Largest signature'],
    computer: ['Switch box', 'Small screen', 'Colour monitor', 'Multi-screen', 'Touch console', 'Command centre'],
    capacity: ['Fixed spots', 'Fixed spots', 'Fixed spots', 'Fixed spots', 'Fixed spots', 'Fixed spots'],
  };

  function effectText(B, branch, lvl) {
    const i = lvl - 1;
    if (branch === 'lights') return `Grow time x${B.hydro.lightTimeMultiplier[i]}`;
    if (branch === 'sprinkler') return `Water lasts x${B.hydro.sprinklerMaintenanceInterval[i]}, away earnings ${Math.round(B.hydroModels.offlineEfficiency[i] * 100)}%`;
    if (branch === 'pots') return `+${B.hydro.potQualityBonus[i]} quality, +${Math.round(B.hydroModels.potValueBonus[i] * 100)}% value`;
    if (branch === 'computer') return ['Manual', 'Harvest All', 'Saved replant', 'Auto-harvest', 'Auto-replant', 'Replant queue'][i];
    return `${B.hydro.potSlotsByCapacityLevel[i]} pots`;
  }

  PE.Panels.station = {
    title: ({ si }) => `Station ${Number(si) + 1}: hydro`,
    sheet: true,
    live: true,
    render({ fid, si }) {
      const game = g();
      const n = Number(si);
      const st = game.grow.stationOf(fid, n);
      const B = game.B;
      const model = B.hydroModels.rows[st.model - 1];
      const rows = game.grow.BRANCHES.map((b) => {
        const lvl = st.levels[b];
        const max = lvl >= B.hydro.mainModelGate.maxLevel;
        const cost = max ? 0 : game.grow.branchCost(fid, n, b);
        const afford = !max && game.canAfford('cash', cost);
        return `<div class="item">${PE.Dom.icon(BRANCH_ICONS[b], 40)}<div class="grow"><b>${BRANCH_NAMES[b]} L${lvl}</b>
          <small>${esc(VISUALS[b][lvl - 1])} · ${esc(effectText(B, b, lvl))}</small>
          ${max ? '' : `<small class="next">Next: ${esc(effectText(B, b, lvl + 1))}</small>`}</div>
          ${max ? '<span class="tag go">MAX</span>' : `<button class="btn small ${afford ? 'buy' : 'cant'}" data-act="up:${b}">${money(cost)}</button>`}</div>`;
      }).join('');

      const prev = game.grow.modelUpgradePreview(fid, n);
      const gate = B.hydro.mainModelGate;
      const maxed = game.grow.BRANCHES.filter((b) => st.levels[b] >= gate.maxLevel).length;
      const modelBlock = prev
        ? `<h4>Next model: ${esc(prev.toName)}</h4>${PE.Dom.hydroPreview(st.model + 1)}
          <p class="muted">${esc(prev.benefit)}. Needs ${gate.branchesAtMaxLevel} of ${gate.ofBranches} parts at L${gate.maxLevel} (you have ${maxed}).</p>
          <button class="btn wide ${prev.gateMet && game.canAfford('cash', prev.cost) ? 'buy' : 'cant'}" data-act="model">${PE.Dom.icon('UPG-06', 24)}Upgrade to ${esc(prev.toName)}: ${money(prev.cost)}</button>`
        : '<p class="muted">This is the top model.</p>';

      let queue = '';
      if (game.grow.hasStationFeature(st, 'queue')) {
        const open = PE.Data.strains.filter((s) => game.grow.isStrainUnlocked(s.id));
        queue = `<h4>Replant queue (up to ${B.hydroModels.queueLength})</h4>
          <p class="muted">Auto-replant takes these strains in turn. Empty = each pot regrows what it had.</p>
          <div class="chips">${open.map((s) => `<button class="chip ${st.queue.includes(s.id) ? 'on' : ''}" data-act="queue:${s.id}">${esc(s.name)}</button>`).join('')}</div>`;
      }

      return `<p><b class="model-${st.model}">${esc(model.name)}</b> · ${st.pots.length} pots · ${PE.Money.format(st.harvests)} harvests</p>
        ${PE.Panels.stationAuto(fid, n)}
        <h4>Parts</h4>${rows}${modelBlock}${queue}`;
    },
    actions: {
      up(branch) {
        const r = params();
        const res = g().grow.upgradeBranch(r.fid, Number(r.si), branch);
        if (!res.ok && res.why === 'cash') PE.Dom.toast('Not enough cash yet');
      },
      auto(which, on) {
        const r = params();
        g().grow.setAuto(r.fid, Number(r.si), which, on === '1');
      },
      service() {
        const r = params();
        g().grow.service(r.fid, Number(r.si));
      },
      queue(id) {
        const r = params();
        const st = g().grow.stationOf(r.fid, Number(r.si));
        const q = st.queue.includes(id) ? st.queue.filter((x) => x !== id) : [...st.queue, id];
        g().grow.setQueue(r.fid, Number(r.si), q);
      },
      model() {
        const r = params();
        const game = g();
        const n = Number(r.si);
        const p = game.grow.modelUpgradePreview(r.fid, n);
        if (!p) return;
        if (!p.gateMet) { PE.Dom.toast('Max out more parts first'); return; }
        if (!game.canAfford('cash', p.cost)) { PE.Dom.toast('Not enough cash yet'); return; }
        PE.Dom.confirm(`Upgrade to ${p.toName}?`, `${PE.Dom.hydroPreview(g().grow.stationOf(r.fid, n).model + 1)}
          <p><b>Your plants on this station:</b></p>
          <ul class="plain">
            <li>${p.matureCount} ready plant${p.matureCount === 1 ? '' : 's'} harvested and sold now: +${money(p.matureCash)}</li>
            <li>${p.growingCount} growing plant${p.growingCount === 1 ? '' : 's'} removed and paid for how far they grew: +${money(p.growingCash)}</li>
          </ul>
          <p><b>Goes back to Level 1, this station only:</b></p>
          <ul class="plain"><li>${p.resets.map((x) => `${BRANCH_NAMES[x.branch]} L${x.from}`).join(', ')}</li><li>Pots: ${p.potsFrom} down to ${p.potsTo}</li></ul>
          <p><b>You keep:</b> ${p.kept.map(esc).join(', ')}.</p>
          <p><b>You get:</b> ${esc(p.benefit)}.</p>
          <p class="muted">Cost: ${money(p.cost)}</p>`, 'Upgrade', () => { game.grow.modelUpgrade(r.fid, n); PE.App.saveGame(); });
      },
    },
  };

  // ---- Strain album and mastery ---------------------------------------------------------------------
  PE.Panels.album = {
    title: 'Strain album',
    render() {
      const game = g();
      const open = PE.Data.strains.filter((s) => game.grow.isStrainUnlocked(s.id)).length;
      let html = `<p>${open} of 60 strains unlocked</p>`;
      for (const rarity of PE.DataCheck.RARITIES) {
        html += `<h4 class="r-${rarity}">${PE.Dom.rarityIcon(rarity, 20)} ${rarity}</h4>`;
        html += PE.Data.strains.filter((s) => s.rarity === rarity).map((s) => {
          const st = game.grow.strainStats(s.id);
          const on = game.grow.isStrainUnlocked(s.id);
          const lvl = game.grow.masteryLevel(s.id);
          const best = game.state.stats.bestGrade[s.id];
          const lvlOk = game.progress.level() >= st.unlockLevel;
          return `<div class="item ${on ? '' : 'locked'}" data-act="open:${s.id}">${strainThumb(s.id, 5, 52)}${PE.Dom.logo(s.id, 40)}
            <div class="grow"><b>${esc(s.name)}</b><small>${on ? `Mastery ${lvl}/50${best !== undefined ? ` · best ${game.B.quality.grades[best].name}` : ''}` : (lvlOk ? 'Ready to unlock' : `Level ${st.unlockLevel}`)}</small></div>
            ${on ? '' : (lvlOk ? `<span class="tag">${money(st.unlockCost)}</span>` : '<span class="tag">Locked</span>')}</div>`;
        }).join('');
      }
      return html;
    },
    actions: { open(id) { PE.App.router.go('strainInfo', { id }); } },
  };

  PE.Panels.strainInfo = {
    title: ({ id }) => g().grow.strainStats(id).name,
    sheet: true,
    render({ id }) {
      const game = g();
      const st = game.grow.strainStats(id);
      const on = game.grow.isStrainUnlocked(id);
      const m = game.state.mastery[id] || { level: 1, xp: 0 };
      const t = game.B.masteryTable;
      const need = Math.round(t.xpFirstLevel * Math.pow(t.growth, m.level - 1));
      const rewards = Object.entries(t.rewards).map(([lvl, r]) => `<li class="${m.level >= Number(lvl) ? 'got' : ''}"><b>L${lvl}</b> ${esc(r.text)}</li>`).join('');
      const stages = PE.Data.strainFrames.stages.map((_, i) => strainThumb(id, i, 48)).join('');
      return `<div class="stages">${stages}</div>
        <p class="r-${st.rarity}">${PE.Dom.logo(id, 56)} ${PE.Dom.rarityIcon(st.rarity, 18)}${st.rarity} · ${esc(st.roleLabel)}</p>
        <p>Grows in ${duration(st.baseSeconds)} before upgrades · sells for ${money(st.price)} at Standard</p>
        ${on ? `<p>${PE.Dom.icon('QLT-06', 22)}<b>Mastery ${m.level}/50</b> · ${Math.round(m.xp)}/${need} XP</p><div class="bar"><i style="width:${m.level >= 50 ? 100 : Math.min(100, (m.xp / need) * 100).toFixed(1)}%"></i></div>`
    : `<button class="btn wide ${game.progress.level() >= st.unlockLevel && game.canAfford('cash', st.unlockCost) ? 'buy' : 'cant'}" data-act="unlock">${game.progress.level() >= st.unlockLevel ? `Unlock ${money(st.unlockCost)}` : `Opens at level ${st.unlockLevel}`}</button>`}
        <h4>Mastery rewards</h4><ul class="plain rewards">${rewards}</ul>`;
    },
    actions: {
      unlock() {
        const res = g().grow.unlockStrain(params().id);
        if (!res.ok) PE.Dom.toast(res.why === 'cash' ? 'Not enough cash yet' : 'Not available yet');
      },
    },
  };

  PE.Panels.collection = { title: 'Collection', render: () => PE.Panels.album.render(), actions: PE.Panels.album.actions };
})(globalThis.PE = globalThis.PE || {});
