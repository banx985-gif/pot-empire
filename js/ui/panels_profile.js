// Player profile, Hall of Fame and the strain picker they share (bible section 10A). Also adds the
// helper settings and "replay helper lines" (bible section 9: optional Help replay) to Settings.
// Strain logos aren't drawn yet: a PLACEHOLDER neon-initials badge on black stands in.
(function (PE) {
  const { esc, money, strainThumb } = PE.Dom;
  const { Money } = PE;
  const g = () => PE.App.g;
  const toast = (t) => PE.Dom.toast(t);
  const params = () => PE.App.router.current().params;

  const NEON = ['#52e6ff', '#c6ff3d', '#ff4fa3', '#ffd84d', '#b47cff', '#ff8a3d'];
  function logo(strainId, size = 30) {
    const s = PE.Data.strains.find((x) => x.id === strainId);
    const initials = s.name.split(' ').map((w) => w[0]).join('').slice(0, 3);
    const c = NEON[(Number(strainId.slice(4)) - 1) % NEON.length];
    return `<span class="logo-ph" style="--c:${c};width:${size}px;height:${size}px;font-size:${Math.round(size * 0.38)}px" title="Logo art not drawn yet">${esc(initials)}</span>`;
  }
  PE.Dom.logo = logo;

  function avatar(size = 84) {
    const id = g().state.profile.avatarStrainId;
    return `<span class="avatar" style="width:${size}px;height:${size}px">${id ? strainThumb(id, 5, size - 12) : '<span class="av-none">🌱</span>'}</span>`;
  }

  // ---- Player profile -----------------------------------------------------------------------------
  PE.Panels.profile = {
    title: 'Profile',
    render() {
      const game = g();
      const st = game.state;
      const p = st.profile;
      const P = game.profile;
      const need = game.progress.xpToNext(st.player.level);
      const max = game.B.profile.nameMaxLength;
      const fav = p.favouriteStrainId ? game.grow.strainStats(p.favouriteStrainId) : null;
      const badges = P.badges();
      const hall = P.hallSlots().filter((s) => s.strainId);
      const titles = st.player.titles;
      return `<div class="profile-head">${avatar()}
          <div class="grow"><b class="biz">${esc(P.displayName())}</b>
          <small>${p.username ? '@' + esc(p.username) : 'No username yet'}</small>
          ${p.title ? `<small class="title-tag">${esc(p.title)}</small>` : ''}</div></div>
        <p><b>Empire Rank ${st.player.level}</b> · ${Money.format(st.player.xp)} / ${Money.format(need)} XP</p>
        <div class="bar"><i style="width:${Math.min(100, (Money.toNumber(st.player.xp) / need) * 100).toFixed(1)}%"></i></div>
        <div class="row-btns"><button class="btn small go" data-act="talents">Talents (${st.player.talentPoints})</button><button class="btn small plain" data-act="avatars">Change avatar</button></div>

        <h4>Names</h4>
        <label class="field"><span>Business name</span><input id="pf-biz" maxlength="${max}" value="${esc(p.businessName)}" placeholder="Your Grow Business" autocomplete="off"></label>
        <label class="field"><span>Username</span><input id="pf-user" maxlength="${max}" value="${esc(p.username)}" placeholder="pick a name" autocomplete="off"></label>
        <button class="btn wide buy" data-act="saveNames">Save names</button>

        <h4>Favourite strain</h4>
        <div class="item" data-act="pickFav">${fav ? strainThumb(fav.id, 5, 48) : ''}<div class="grow"><b>${fav ? esc(fav.name) : 'None picked'}</b><small>${fav ? `${esc(fav.rarity)} · Mastery ${game.grow.masteryLevel(fav.id)}` : 'Tap to pick one'}</small></div><span class="tag">Change</span></div>

        <h4>Hall of Fame</h4>
        ${P.hallUnlocked()
    ? `<div class="item" data-act="hall"><div class="grow hall-mini">${hall.length ? hall.map((s) => strainThumb(s.strainId, 5, 40)).join('') : '<small>No strains featured yet</small>'}</div><span class="tag go">Open</span></div>`
    : `<p class="muted">Opens at Empire Rank ${P.hallLevel()}.</p>`}

        <h4>Titles</h4>
        ${titles.length ? `<div class="chips">${titles.map((t, i) => `<button class="chip ${p.title === t ? 'on' : ''}" data-act="title:${i}">${esc(t)}</button>`).join('')}${p.title ? '<button class="chip" data-act="title:-1">Hide title</button>' : ''}</div>` : '<p class="muted">Earn titles from mastery, rivals, festivals and high ranks.</p>'}

        <h4>Prestige badges</h4>
        ${badges.length ? `<div class="chips">${badges.map((b) => `<span class="chip on">🌟 ${esc(b.name)} x${b.count}</span>`).join('')}</div>` : '<p class="muted">Each regional prestige adds a badge for that district.</p>'}

        <h4>Stats</h4>
        <ul class="plain"><li>${Money.format(st.stats.harvests)} harvests</li><li>${money(st.stats.lifetimeCash)} earned in total</li>
          <li>${Object.keys(st.unlockedStrains).length} of 60 strains</li><li>${Object.keys(st.collections.owned).length} collection items</li></ul>`;
    },
    actions: {
      talents() { PE.App.router.go('talents', {}); },
      avatars() { PE.App.router.go('avatarList', {}); },
      saveNames() {
        const game = g();
        game.profile.setBusinessName(document.getElementById('pf-biz').value);
        game.profile.setUsername(document.getElementById('pf-user').value);
        PE.App.saveGame();
        toast('Names saved');
      },
      pickFav() { PE.App.router.go('strainChoice', { mode: 'fav' }); },
      hall() { PE.App.router.go('hallOfFame', {}); },
      title(i) {
        const t = Number(i) < 0 ? null : g().state.player.titles[Number(i)];
        g().profile.setTitle(t === undefined ? null : t);
        PE.App.saveGame();
      },
    },
  };

  // ---- Hall of Fame -----------------------------------------------------------------------------------
  PE.Panels.hallOfFame = {
    title: 'Hall of Fame',
    render() {
      const game = g();
      if (!game.profile.hallUnlocked()) return `<p class="center">The Hall of Fame opens at Empire Rank ${game.profile.hallLevel()}.</p>`;
      const cells = game.profile.hallSlots().map((s) => (s.strainId
        ? `<div class="hall-slot" data-act="slot:${s.slot}">${strainThumb(s.strainId, 5, 104)}<span class="hall-logo">${logo(s.strainId, 34)}</span>
            <b>${esc(s.name)}</b><small class="r-${s.rarity}">${s.rarity}</small><small>Best: ${s.bestGrade ? esc(s.bestGrade) : 'not harvested yet'}</small><small>Mastery ${s.mastery}</small></div>`
        : `<div class="hall-slot empty" data-act="slot:${s.slot}"><span class="plus">+</span><small>Slot ${s.slot + 1}</small><small>Tap to feature a strain</small></div>`)).join('');
      return `<p class="muted">Show off six of your strains. Tap a slot to choose.</p><div class="hall-grid">${cells}</div>`;
    },
    actions: { slot(i) { PE.App.router.go('strainChoice', { mode: 'hall', slot: Number(i) }); } },
  };

  // ---- Strain choice for the Hall of Fame and favourite strain ------------------------------------------
  PE.Panels.strainChoice = {
    title: ({ mode, slot }) => (mode === 'hall' ? `Hall of Fame slot ${Number(slot) + 1}` : 'Favourite strain'),
    sheet: true,
    render({ mode, slot }) {
      const game = g();
      const hall = game.state.hallOfFameFeaturedStrainIds;
      const current = mode === 'hall' ? hall[Number(slot)] : game.state.profile.favouriteStrainId;
      const rows = PE.Data.strains.filter((s) => game.grow.isStrainUnlocked(s.id)).map((s) => {
        const best = game.state.stats.bestGrade[s.id];
        const elsewhere = mode === 'hall' && hall.includes(s.id) && s.id !== current;
        return `<div class="item" data-act="pick:${s.id}">${strainThumb(s.id, 5, 52)}<div class="grow"><b>${esc(s.name)}</b>
          <small class="r-${s.rarity}">${s.rarity} · Mastery ${game.grow.masteryLevel(s.id)}</small>
          <small>Best: ${best === undefined ? 'not harvested yet' : game.B.quality.grades[best].name}${elsewhere ? ' · moves from its other slot' : ''}</small></div>
          ${s.id === current ? '<span class="tag go">Chosen</span>' : ''}</div>`;
      }).join('');
      return (current ? `<button class="btn wide plain" data-act="pick:none">${mode === 'hall' ? 'Empty this slot' : 'No favourite'}</button>` : '') + rows;
    },
    actions: {
      pick(id) {
        const { mode, slot } = params();
        const strain = id === 'none' ? null : id;
        const r = mode === 'hall' ? g().profile.feature(slot, strain) : { ok: g().profile.setFavourite(strain) };
        if (r.ok) { PE.App.saveGame(); PE.App.back(); } else toast('Not available');
      },
    },
  };

  // ---- Settings: helpers on/off and the helper-line replay ----------------------------------------------
  const baseSettings = PE.Panels.settings.render;
  PE.Panels.settings.render = (p) => {
    const s = PE.App.state.settings;
    return `<div class="item"><div class="grow"><b>Helper jokes</b><small>Uncle Haze, Budz and Leafy now and then</small></div>
      <button class="btn small ${s.helpers ? 'go' : 'plain'}" data-act="helpers">${s.helpers ? 'On' : 'Off'}</button></div>
      ${baseSettings(p)}
      <button class="btn wide plain" data-act="replayList">Help: replay helper lines</button>`;
  };
  Object.assign(PE.Panels.settings.actions, {
    helpers() { const s = PE.App.state.settings; s.helpers = !s.helpers; PE.App.saveGame(); },
    replayList() { PE.App.router.go('helperReplay', {}); },
  });

  PE.Panels.helperReplay = {
    title: 'Helper lines',
    render() {
      const heard = g().helpers.heard();
      if (!heard.length) return '<p class="center muted">Nothing yet. The helpers speak up when something big happens.</p>';
      const names = Object.fromEntries(PE.Data.helpers.map((h) => [h.id, h.name]));
      return '<p class="muted">Tap one to hear it again.</p>' + heard.map((j) => `<div class="item" data-act="say:${j.id}"><div class="grow"><b>${esc(names[j.helper])}</b><small>${esc(j.text)}</small></div><span class="tag">Replay</span></div>`).join('');
    },
    actions: { say(id) { g().helpers.replay(id); } },
  };
})(globalThis.PE = globalThis.PE || {});
