// Tasks (UI29), achievements (UI30), rivals (UI28), festivals (UI31, 32), regional prestige (UI33),
// VIP orders.
(function (PE) {
  const { esc, money, duration } = PE.Dom;
  const { Money } = PE;
  const g = () => PE.App.g;
  const toast = (t) => PE.Dom.toast(t);
  const fmt = (v) => Money.format(Math.floor(v));
  const bar = (p) => `<div class="bar thin"><i style="width:${Math.min(100, p * 100).toFixed(0)}%"></i></div>`;
  const paid = (r) => { if (r.ok && r.text) toast(r.text); PE.App.saveGame(); };

  // The round buttons down the side of the Empire map (js/ui/empire_map.js).
  const MENU = [
    { id: 'tasks', label: 'Tasks', icon: 'GOL-01' },
    { id: 'festival', label: 'Festival', icon: 'GOL-03' },
    { id: 'achievements', label: 'Awards', icon: 'GOL-02' },
    { id: 'rivals', label: 'Rivals', icon: 'GOL-05' },
    { id: 'prestige', label: 'Prestige', icon: 'GOL-04' },
  ];
  PE.MapMenu = [{ id: 'calendar', label: 'Daily', icon: 'RWD-04', dot: () => g().calendar.canClaim() }, ...MENU];

  PE.Panels.tasks = {
    title: 'Daily and weekly tasks',
    live: true,
    render() {
      const game = g();
      const tk = game.meta.tasks();
      const row = (kind, t) => {
        const done = game.meta.taskProgress(t);
        const finished = done >= t.target;
        return `<div class="item"><div class="grow"><b>${esc(t.text)}</b><small>${fmt(Math.min(done, t.target))} / ${fmt(t.target)}</small>${bar(done / t.target)}</div>
          ${t.claimed ? '<span class="tag go">Done</span>' : finished ? `<button class="btn small go" data-act="claim:${kind}:${t.id}">Claim</button>` : ''}</div>`;
      };
      const B = game.B.meta;
      const inbox = game.meta.inbox();
      return `<button class="btn wide ${game.meta.wheelUsed() ? 'cant' : 'buy'}" data-act="wheel">${PE.Dom.icon('RWD-03', 26)}${game.meta.wheelUsed() ? 'Prize wheel: spun today, back tomorrow' : 'Spin the free prize wheel'}</button>
        <h4>${PE.Dom.icon('GOL-01', 20)} Today (${PE.Dom.icon('CUR-03', 16)} ${B.dailyReward.researchTokens} each)</h4>${tk.daily.map((t) => row('daily', t)).join('')}
        <h4>${PE.Dom.icon('GOL-01', 20)} This week (${PE.Dom.icon('CUR-03', 16)} ${B.weeklyReward.researchTokens} each)</h4>${tk.weekly.map((t) => row('weekly', t)).join('')}
        <p class="muted">Nothing is lost if you miss a day.</p>
        ${inbox.length ? `<h4>Inbox</h4>${inbox.map((i) => `<div class="item"><div class="grow"><b>${esc(i.text)}</b><small>Keeps for ${duration((i.expiresMs - game.now()) / 1000)}</small></div><button class="btn small go" data-act="inbox:${i.id.replace(/:/g, '~')}">Claim</button></div>`).join('')}` : ''}`;
    },
    actions: {
      claim(kind, id) { paid(g().meta.claimTask(kind, id)); },
      wheel() { const r = g().meta.spinWheel(); if (r.ok) PE.Dom.toast(`Prize: ${r.text}`, 'big', 'RWD-03'); PE.App.saveGame(); },
      inbox(id) { paid(g().meta.claimInbox(id.replace(/~/g, ':'))); },
    },
  };

  PE.Panels.achievements = {
    title: 'Achievements',
    render() {
      const game = g();
      const list = game.meta.achievementList();
      const got = list.filter((a) => a.claimed).length;
      const groups = [...new Set(list.map((a) => a.group))];
      return `<p>${got} of ${list.length} claimed</p>` + groups.map((grp) => {
        const tiers = list.filter((a) => a.group === grp);
        const next = tiers.find((a) => !a.claimed) || tiers[tiers.length - 1];
        return `<div class="item"><div class="grow"><b>${esc(next.name)}</b> ${tiers.map((a) => `<span class="dot ${a.claimed ? 'on' : ''}"></span>`).join('')}
          <small>Tier ${next.tier}: ${fmt(Math.min(next.progress, next.target))} / ${fmt(next.target)}</small>${bar(next.progress / next.target)}</div>
          ${next.claimed ? '<span class="tag go">All done</span>' : next.done ? `<button class="btn small go" data-act="claim:${next.id}">Claim</button>` : ''}</div>`;
      }).join('');
    },
    actions: { claim(id) { paid(g().meta.claimAchievement(id)); } },
  };

  PE.Panels.rivals = {
    title: 'Rivals',
    render() {
      const list = g().meta.rivalList();
      return `<p class="muted">Twelve rival CEOs. Beat each one by reaching their milestone. Their buildings stand at the edges of the Empire map.</p>` + list.map((r) => `<div class="item" ${r.beaten ? `data-act="story:${r.id}"` : ''}>${PE.Dom.portrait(r.id, r.name)}
        <div class="grow"><b>${esc(r.name)}</b><small>${esc(r.text)}</small><small>${fmt(Math.min(r.progress, r.target))} / ${fmt(r.target)}</small>${bar(r.progress / r.target)}</div>
        ${r.beaten ? '<span class="tag go">Beaten</span>' : r.done ? `<button class="btn small go" data-act="beat:${r.id}">Claim</button>` : ''}</div>`).join('');
    },
    actions: { beat(id) { paid(g().meta.beatRival(id)); }, story(id) { PE.Story.show(id); } },
  };

  PE.Panels.festival = {
    title: 'Festival',
    live: true,
    render() {
      const game = g();
      const f = game.meta.festivalNow();
      const s = game.meta.festivalState();
      if (!f.active) return `<p class="center"><b>${esc(f.theme)} is next.</b></p><p class="center muted">It starts in ${duration((f.endsMs - game.now()) / 1000)}. You have ${Money.format(game.state.currencies.festivalTickets)} Festival Tickets.</p>`;
      const n = game.B.meta.festival.tiers;
      let rows = '';
      for (let t = 1; t <= n; t++) {
        const need = game.meta.tierNeed(t);
        const reach = s.points >= need;
        const r = game.meta.festivalReward(t);
        rows += `<div class="item ${reach ? '' : 'locked'}"><div class="grow"><b>Tier ${t}</b><small>${fmt(need)} points · ${r.festivalTickets} tickets${r.title ? ' + title' : ''}</small></div>
          ${s.claimed[t] ? '<span class="tag go">Done</span>' : reach ? `<button class="btn small go" data-act="tier:${t}">Claim</button>` : ''}</div>`;
      }
      return `<p class="bigtitle">${esc(f.theme)}</p><p class="center muted">Ends in ${duration((f.endsMs - game.now()) / 1000)}. Every harvest scores points; rarer strains and Festival star strains score more.</p>
        <p class="center"><b>${fmt(s.points)} points</b></p>${rows}`;
    },
    actions: { tier(t) { paid(g().meta.claimFestivalTier(Number(t))); } },
  };

  PE.Panels.prestige = {
    title: 'Regional prestige',
    render() {
      const game = g();
      const lvl = game.meta.prestigeUnlockLevel();
      const shares = Money.format(game.state.currencies.empireShares);
      const head = `<p>${PE.Dom.icon('CUR-04', 22)} <b>${shares} Empire Shares</b> · all harvests x${game.meta.globalMultiplier().toFixed(2)}</p>
        <p class="muted">Optional. Restart one district's equipment for permanent Empire Shares. You can always keep playing without it.</p>`;
      if (game.progress.level() < lvl) return `${head}<p class="center">Opens at level ${lvl}.</p>`;
      const rows = game.facilities.districts.map((d) => {
        const p = game.meta.prestigePreview(d.id);
        return `<div class="item"><div class="grow"><b>${esc(d.name)}</b><small>Earned since last: ${money(Math.floor(p.earned))}</small><small>Worth ${p.shares} Shares now</small></div>
          <button class="btn small ${p.shares >= 1 ? 'buy' : 'cant'}" data-act="go:${d.id}">Preview</button></div>`;
      }).join('');
      const hist = game.state.prestigeHistory.slice(-5).reverse().map((h) => `<li>${esc(game.facilities.district(h.district).name)}: +${h.shares} Shares</li>`).join('');
      return `${head}${rows}${hist ? `<h4>History</h4><ul class="plain">${hist}</ul>` : ''}`;
    },
    actions: {
      go(id) {
        const game = g();
        const p = game.meta.prestigePreview(id);
        if (p.shares < 1) { toast('Earn more in this district first'); return; }
        const crops = p.matureCount + p.growingCount;
        PE.Dom.confirm(`Prestige ${p.district}?`, `
          <p class="bigcash">+${p.shares} Shares</p>
          <p>All harvests x${p.bonusNow.toFixed(2)} up to x${p.bonusAfter.toFixed(2)}, forever.</p>
          <p><b>Goes back to the start, this district only:</b></p>
          <ul class="plain">${p.resets.map((r) => `<li>${esc(r)}</li>`).join('')}</ul>
          ${crops ? `<p><b>Plants here:</b> ${p.matureCount} ready sold now (+${money(p.matureCash)}), ${p.growingCount} growing paid for how far they grew (+${money(p.growingCash)}).</p>` : ''}
          <p><b>You keep:</b> ${p.kept.map(esc).join(', ')}.</p>`, 'Prestige', () => {
          const r = game.meta.prestige(id);
          if (!r.ok) toast('Not available');
          PE.App.saveGame();
        });
      },
    },
  };

  PE.Panels.hqBody = () => {
    const game = g();
    return `<p><b>Empire Headquarters</b></p><p class="muted">Owning HQ adds ${Math.round(game.B.meta.prestige.hqBonus * 100)}% to every prestige. Empire Rank ${game.state.player.level}. ${Money.format(game.state.currencies.empireShares)} Empire Shares. There's no last rank: this is a milestone, not the end.</p>
      <button class="btn wide buy" data-act="openPrestige">Regional prestige</button>`;
  };
  PE.Panels.business.actions.openPrestige = () => PE.App.router.go('prestige', {});

  // VIP orders, inside the Contracts tab.
  PE.Panels.vipBody = () => {
    const game = g();
    if (!game.progress.hasFeature('vip')) return `<h4>VIP orders</h4><p class="muted">VIP orders open at level ${game.progress.featureLevel('vip')}.</p>`;
    const now = game.now();
    const rows = game.meta.vipOffers().map((o) => {
      const ready = game.meta.vipDone(o);
      const left = duration((o.expiresMs - now) / 1000);
      return `<div class="item">${PE.Dom.portrait(o.vipId, o.name, 'small')}<div class="grow"><b>${esc(o.name)}</b><small>${esc(o.text)}</small>
        <small>${o.kind === 'sku' ? (o.accepted ? `Reserved ${money(Math.floor(o.reserved))} of stock` : 'Reserves stock when accepted') : `${o.done}/${o.units}`} · ${left} left${o.accepted ? ` · pays ${money(game.meta.vipReward(o))}` : ''}</small></div>
        ${ready ? `<button class="btn small go" data-act="vipClaim:${o.id}">Claim</button>` : o.accepted ? `<button class="btn small plain" data-act="vipCancel:${o.id}">Cancel</button>` : `<button class="btn small buy" data-act="vipTake:${o.id}">Accept</button>`}</div>`;
    }).join('');
    return `<h4>VIP orders</h4><p class="muted">Optional. Cancelling or running out of time gives back anything you reserved.</p>${rows}`;
  };
  Object.assign(PE.Panels.contracts.actions, {
    vipTake(id) { const r = g().meta.acceptVip(id); if (!r.ok) toast(r.why === 'stock' ? 'Not enough of that stock yet' : 'Not available'); PE.App.saveGame(); },
    vipClaim(id) { const r = g().meta.claimVip(id); if (r.ok) toast(`VIP paid ${money(r.cash)}`); PE.App.saveGame(); },
    vipCancel(id) { g().meta.cancelVip(id); PE.App.saveGame(); },
  });
})(globalThis.PE = globalThis.PE || {});
