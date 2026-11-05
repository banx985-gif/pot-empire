// The 36 primary menus of bible section 10, and where each one lives in the game. The browser test
// (tools/browser_features.js) opens every one from this list, so a missing or broken screen shows up.
// Also the screens that were missing before big job 2 (UI03, UI08, UI31/32 split, UI34, UI35).
(function (PE) {
  const { esc, money, strainThumb } = PE.Dom;
  const { Money } = PE;
  const g = () => PE.App.g;

  // ---- UI03 Facility selector: a quick sheet from the grow room ---------------------------------------------
  PE.Panels.facilitySelector = {
    title: 'Go to',
    sheet: true,
    render() {
      const game = g();
      const here = PE.App.state.ui.lastRoom;
      const owned = game.facilities.rows.filter((r) => game.facilities.isOwned(r.id));
      return owned.map((r) => `<div class="item" data-act="go:${r.id}"><span class="fac-ico">${PE.Dom.modeIcon(r.mode)}</span><div class="grow"><b>${esc(r.name)}</b><small>${esc(r.mode)}</small></div>${r.id === here ? '<span class="tag go">Here</span>' : '<span class="tag">Go</span>'}</div>`).join('')
        + '<button class="btn wide plain" data-act="map">Open the Empire map</button>';
    },
    actions: {
      go(fid) { PE.App.goToRoom(fid); },
      map() { PE.App.navTo('empire'); },
    },
  };
  PE.Hud.actions.rooms = () => PE.App.openPanel('facilitySelector', {});

  // ---- UI08 Harvest result: shown after harvesting from the plant details sheet -----------------------------
  PE.Panels.harvestResult = {
    title: 'Harvest',
    sheet: true,
    render({ r }) {
      const game = g();
      const s = game.grow.strainStats(r.strainId);
      const grade = game.B.quality.grades[r.grade];
      const best = game.state.stats.bestGrade[r.strainId];
      return `<div class="harvest-card q${r.grade}">${strainThumb(r.strainId, 5, 120)}
          <b class="grade q-mark" data-q="${r.grade}">${PE.Dom.qualityIcon(r.grade, 34)}${esc(grade.name)}</b>
          <span class="bigcash">+${money(r.cash)}${r.doubled ? ' x2!' : ''}</span>
          <small>${esc(s.name)} · +${Money.format(r.xp)} XP · Mastery ${game.grow.masteryLevel(r.strainId)}</small>
          ${best === r.grade && r.grade > 0 ? '<small class="title-tag">Best quality yet for this strain!</small>' : ''}</div>
        <button class="btn wide go" data-act="__close">${PE.Dom.icon('ACT-02', 22)}Nice</button>`;
    },
    actions: {},
  };
  PE.Panels.plant.actions.harvest = () => {
    const p = PE.App.router.current().params;
    const r = g().grow.harvest(p.fid, Number(p.si), Number(p.pi));
    if (r) PE.App.router.replace('harvestResult', { r: { cash: r.cash, grade: r.grade, doubled: r.doubled, xp: r.xp, strainId: r.strainId } });
    else PE.App.back();
  };

  // ---- UI31 Festival hub and UI32 Festival progression ---------------------------------------------------------
  const tiers = PE.Panels.festival.render;
  PE.Panels.festivalTiers = { title: 'Festival progression', live: true, render: tiers, actions: PE.Panels.festival.actions };
  PE.Panels.festival = {
    title: 'Festival hub',
    live: true,
    render() {
      const game = g();
      const f = game.meta.festivalNow();
      const s = game.meta.festivalState();
      const T = game.B.meta.festival;
      const next = game.meta.festivalCalendar(3);
      const ev = game.meta.eventNamed(f.theme);
      const claimed = Object.keys(s.claimed || {}).length;
      return `${f.active ? `${PE.Dom.icon('GOL-03', 84, 'center-ico')}<p class="bigtitle">${esc(f.theme)}</p><p class="center">${esc(ev.blurb)}</p><p class="center muted">On now · ends in ${PE.Dom.duration((f.endsMs - game.now()) / 1000)}</p>
          <p class="center"><b>${Money.format(Math.floor(s.points))} points</b> · ${claimed} of ${T.tiers} tiers claimed</p>
          <button class="btn wide go" data-act="tiers">See the ${T.tiers} reward tiers</button>`
        : `${PE.Dom.icon('GOL-03', 84, 'center-ico')}<p class="bigtitle">Next: ${esc(f.theme)}</p><p class="center">${esc(ev.blurb)}</p><p class="center muted">Starts in ${PE.Dom.duration((f.endsMs - game.now()) / 1000)}. There's a new one every month.</p>`}
        ${game.purchases && game.purchases.passActive() ? '<p class="center title-tag">Event pass: +25% Festival Tickets</p>' : ''}
        <p class="center">${PE.Dom.icon('CUR-06', 22)} ${Money.format(game.state.currencies.festivalTickets)} Festival Tickets <button class="btn small plain" data-act="shop">Spend</button></p>
        <h4>Coming up</h4>${next.map((n) => `<div class="item"><div class="grow"><b>${esc(n.theme)}</b><small>Starts ${new Date(n.startsMs).toLocaleDateString()}</small></div></div>`).join('')}
        <p class="muted">Every harvest scores points while a festival is on. Rewards you reach but don't claim wait in the Tasks inbox for seven days.</p>`;
    },
    actions: {
      tiers() { PE.App.router.go('festivalTiers', {}); },
      shop() { PE.App.navTo('shop'); },
    },
  };

  // ---- The map: bible section 10 number -> how to get there -------------------------------------------------------
  // open: what a player taps, as a route + params. Grow-room screens open inside the garage scene.
  PE.Menus = [
    { ui: 'UI01', name: 'Splash/title', route: 'title', scene: true },
    { ui: 'UI02', name: 'Empire map', route: 'empire', scene: true },
    { ui: 'UI03', name: 'Facility selector', route: 'facilitySelector' },
    { ui: 'UI03b', name: 'All places list', route: 'empireList' },
    { ui: 'UI03c', name: 'District switcher', route: 'districts' },
    { ui: 'UI04', name: 'Grow room', route: 'garage', scene: true },
    { ui: 'UI05', name: 'Grow station details', route: 'station', params: { fid: 'F01', si: 0 } },
    { ui: 'UI06', name: 'Strain picker', route: 'strainPicker', params: { fid: 'F01', si: 0, pi: 0 } },
    { ui: 'UI07', name: 'Plant details', route: 'plant', params: { fid: 'F01', si: 0, pi: 0 } },
    { ui: 'UI08', name: 'Harvest result', route: 'harvestResult', params: { r: { cash: 120, grade: 2, doubled: false, xp: 5, strainId: 'STR-001' } } },
    { ui: 'UI09', name: 'Hydro upgrades', route: 'station', params: { fid: 'F01', si: 0 }, note: 'same sheet as UI05: station details with its upgrade rows' },
    { ui: 'UI10', name: 'Facility renovation', route: 'facilityInfo', params: { fid: 'F01' } },
    { ui: 'UI11', name: 'Retail room', route: 'business', params: { fid: 'F04' } },
    { ui: 'UI12', name: 'Store upgrades', route: 'business', params: { fid: 'F04' }, note: 'upgrade rows inside the retail room' },
    { ui: 'UI13', name: 'Factory room', route: 'business', params: { fid: 'F05' } },
    { ui: 'UI14', name: 'Factory upgrades', route: 'business', params: { fid: 'F05' }, note: 'upgrade rows inside the factory room' },
    { ui: 'UI15', name: 'Product catalogue', route: 'catalogue' },
    { ui: 'UI16', name: 'Delivery depot', route: 'business', params: { fid: 'F09' } },
    { ui: 'UI17', name: 'Delivery contracts', route: 'contracts' },
    { ui: 'UI18', name: 'Research tree', route: 'business', params: { fid: 'F06' } },
    { ui: 'UI19', name: 'Manager binder', route: 'managerBinder' },
    { ui: 'UI20', name: 'Manager detail', route: 'managerDetail', params: { id: 'M01' } },
    { ui: 'UI21', name: 'Manager assignment', route: 'managerDetail', params: { id: 'M01' }, note: 'assign rows inside manager detail' },
    { ui: 'UI22', name: 'Strain album', route: 'album' },
    { ui: 'UI23', name: 'Strain mastery', route: 'strainInfo', params: { id: 'STR-001' } },
    { ui: 'UI24', name: 'Relic collection', route: 'relicList' },
    { ui: 'UI25', name: 'Brand collection', route: 'stickerList' },
    { ui: 'UI26', name: 'Vehicle collection', route: 'vehicleList' },
    { ui: 'UI27', name: 'Decoration inventory', route: 'decorList' },
    { ui: 'UI28', name: 'Rivals', route: 'rivals' },
    { ui: 'UI29', name: 'Daily tasks', route: 'tasks' },
    { ui: 'UI29b', name: 'Login calendar', route: 'calendar' },
    { ui: 'UI30', name: 'Achievements', route: 'achievements' },
    { ui: 'UI31', name: 'Festival hub', route: 'festival' },
    { ui: 'UI32', name: 'Festival progression', route: 'festivalTiers' },
    { ui: 'UI33', name: 'Regional prestige', route: 'prestige' },
    { ui: 'UI34', name: 'Shop', route: 'shop' },
    { ui: 'UI35', name: 'Settings/help', route: 'settings' },
    { ui: 'X01', name: "Uncle Haze's Shack", route: 'hazeShack' },
    { ui: 'X02', name: 'Seed Shop', route: 'seedShop' },
    { ui: 'X03', name: 'Talent Agency', route: 'talentAgency' },
    { ui: 'X05', name: 'Arcade', route: 'arcade' },
    { ui: 'X07', name: 'VIP Lounge', route: 'vipLounge' },
    { ui: 'X08', name: "Collector's Warehouse", route: 'collectorsWarehouse' },
    { ui: 'UI36', name: 'Offline earnings', route: 'welcomeBack', modal: true, note: 'the welcome-back pop-up (PE.Offline.showIfPending)' },
  ];
})(globalThis.PE = globalThis.PE || {});
