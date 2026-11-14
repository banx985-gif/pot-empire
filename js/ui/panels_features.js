// The screens inside the feature buildings on the map (job 9). Four of the twelve buildings just open a screen
// the game already had; these are the ones that gather a few features under one roof.
(function (PE) {
  const { esc, money, strainThumb, icon } = PE.Dom;
  const { Money } = PE;
  const g = () => PE.App.g;
  const toast = (t) => PE.Dom.toast(t);
  const go = (name) => PE.App.router.go(name, {});
  const row = (act, iconId, title, text, tag, on) => `<div class="item" data-act="${act}">${icon(iconId, 44)}<div class="grow"><b>${esc(title)}</b><small>${esc(text)}</small></div><span class="tag ${on ? 'go' : ''}">${esc(tag)}</span></div>`;

  // ---- X01 Uncle Haze's Shack: helpers, tutorial replay, login calendar ------------------------------------------
  PE.Panels.hazeShack = {
    title: "Uncle Haze's Shack",
    render() {
      const game = g();
      const can = game.calendar.canClaim();
      return `${PE.HelperArt.says('HAZE-26', 'Come in, kid. Mind the wind chimes. Nobody knows who hung them.', 'Uncle Haze')}
        ${row('calendar', 'RWD-04', game.calendar.name(), can ? "Today's reward is waiting" : 'Come back tomorrow for the next one', can ? 'Claim' : 'Open', can)}
        ${row('lines', 'SYS-02', 'Helper lines', `${game.helpers.heard().length} heard so far. Hear them again.`, 'Open')}
        ${row('guide', 'SYS-05', 'Replay tutorial', 'Haze walks you through the basics again', 'Start')}`;
    },
    actions: {
      calendar() { go('calendar'); },
      lines() { go('helperReplay'); },
      guide() { g().tutorial.replay(); PE.App.saveGame(); PE.App.goToRoom('F01'); },
    },
  };

  // ---- X02 Seed Shop: seed packets, with the strain's graffiti badge on each -----------------------------------------
  PE.Panels.seedShop = {
    title: 'Seed Shop',
    render() {
      const game = g();
      const lvl = game.progress.level();
      const rows = PE.Data.strains.map((s) => {
        const st = game.grow.strainStats(s.id);
        const open = game.grow.isStrainUnlocked(s.id);
        const levelOk = lvl >= st.unlockLevel;
        if (!open && st.unlockLevel > lvl + 3) return '';
        return `<div class="item ${open ? '' : 'locked'}" data-act="info:${s.id}"><span class="seed-packet">${PE.Dom.avatarPic(s.id, 52)}${strainThumb(s.id, 0, 22)}</span>
          <div class="grow"><b>${esc(s.name)}</b><small class="r-${s.rarity}">${PE.Dom.rarityIcon(s.rarity)}${s.rarity} · ${esc(st.roleLabel)}</small></div>
          ${open ? '<span class="tag go">Owned</span>' : levelOk
    ? `<button class="btn small ${game.canAfford('cash', st.unlockCost) ? 'buy' : 'cant'}" data-act="unlock:${s.id}">${money(st.unlockCost)}</button>`
    : `<span class="tag">Level ${st.unlockLevel}</span>`}</div>`;
      }).join('');
      return `${PE.HelperArt.says('LEAFY-03', 'Fresh seeds. Fictional seeds. Please stop asking if they are real.', 'Leafy')}${rows}<p class="muted center">More strains appear as you level up.</p>`;
    },
    actions: {
      info(id) { PE.App.router.go('strainInfo', { id }); },
      unlock(id) {
        const r = g().grow.unlockStrain(id);
        if (!r.ok) toast(r.why === 'cash' ? 'Not enough cash yet' : 'Not available yet');
        else { PE.Words.toast('WRD-NEW-STRAIN', 'New Strain!', `${g().grow.strainStats(id).name} unlocked!`, '', 'COL-02'); PE.App.saveGame(); }
      },
    },
  };

  // ---- X03 Talent Agency: managers and chests ---------------------------------------------------------------------------
  PE.Panels.talentAgency = {
    title: 'Talent Agency',
    render() {
      const game = g();
      const c = game.collections.counts();
      const waiting = game.state.player.pendingChoices.length;
      return `${PE.HelperArt.says('BUDZ-21', "Everyone here has an agent! I'm MY agent! I take twenty percent of my snacks!", 'Budz')}
        ${row('chest', 'RWD-01', 'Milestone chests', waiting ? `${waiting} waiting for you to pick a reward` : 'You get one at milestone levels', waiting ? 'Choose' : 'None', waiting > 0)}
        ${row('binder', 'COL-01', 'Manager binder', `${c.managers.have} of ${c.managers.total} signed. Duplicates level them up.`, 'Open')}
        <p class="muted">${PE.Plates.cur(PE.Dom.icon('CUR-05', 20), Money.format(game.state.currencies.collectionTokens))} Collection Tokens to spend on managers you've reached the level for. Chests only ever come from playing.</p>`;
    },
    actions: {
      chest() { if (g().state.player.pendingChoices.length) PE.Hud.showChoice(); else toast('No chest waiting yet'); },
      binder() { go('managerBinder'); },
    },
  };

  // ---- X05 Arcade: the prize wheel --------------------------------------------------------------------------------------
  PE.Panels.arcade = {
    title: 'Arcade',
    render() {
      const used = g().meta.wheelUsed();
      return `${PE.Words.extra('WRD-LUCKY-SPIN', 'Lucky Spin', 'panel-word')}${icon('RWD-03', 150, 'center-ico')}
        <p class="center">${used ? 'You had your free spin today. The machine needs a nap.' : 'One free spin a day. No tokens, no catch.'}</p>
        <button class="btn wide ${used ? 'cant' : 'buy'}" data-act="spin">${used ? 'Back tomorrow' : 'Spin the prize wheel'}</button>
        ${PE.Store && PE.Store.adButton ? PE.Store.adButton('extraWheelSpins', 'An extra spin') : ''}`;
    },
    actions: {
      spin() {
        const r = g().meta.spinWheel();
        if (r.ok) { PE.Dom.toast(`Prize: ${r.text}`, 'big', 'RWD-03'); PE.Sound.play('celebrate'); PE.App.saveGame(); }
        else toast('Not until tomorrow');
      },
      ad: (...a) => (PE.Panels.tasks.actions.ad ? PE.Panels.tasks.actions.ad(...a) : undefined),
    },
  };

  // ---- X07 VIP Lounge ----------------------------------------------------------------------------------------------------
  PE.Panels.vipLounge = {
    title: 'VIP Lounge',
    live: true,
    render() { return PE.Panels.vipBody(); },
    get actions() { return PE.Panels.contracts.actions; },
  };

  // ---- X08 Collector's Warehouse: relics, stickers, decorations -------------------------------------------------------------
  PE.Panels.collectorsWarehouse = {
    title: "Collector's Warehouse",
    render() {
      const c = g().collections.counts();
      return `<p class="muted">${PE.Plates.cur(PE.Dom.icon('CUR-05', 20), Money.format(g().state.currencies.collectionTokens))} Collection Tokens. Duplicates turn into tokens, and tokens buy anything you've reached the level for.</p>
        ${row('go:relicList', 'COL-03', 'Relics', `${c.relics.have} of ${c.relics.total}. Three per district.`, 'Open')}
        ${row('go:stickerList', 'COL-04', 'Brand stickers', `${c.stickers.have} of ${c.stickers.total}. Two per shop or factory.`, 'Open')}
        ${row('go:decorList', 'COL-06', 'Decorations', `${c.decorations.have} of ${c.decorations.total}. Each has its own spot in a room.`, 'Open')}`;
    },
    actions: { go(name) { go(name); } },
  };
})(globalThis.PE = globalThis.PE || {});
