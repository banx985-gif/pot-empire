// The Event Hub (job 23): an Event button on the map opens it. It shows the Weekly Event Day (on now, or the countdown
// to the next one), the week's stars and milestone prizes, Bud Match's levels, and how much of today's and this week's
// prize limit is used. The rules are in js/logic/event_hub.js and the numbers in data/event_hub.js.
(function (PE) {
  const { esc, icon, duration } = PE.Dom;
  const g = () => PE.App.g;
  const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const REWARD_ICON = { cashHarvests: 'CUR-01', gems: 'CUR-02', boostMinutes: 'STA-02', seedPack: 'ACT-09' };
  const REWARD_NAME = { cashHarvests: 'Cash', gems: 'Gems', boostMinutes: 'Grow boost', seedPack: 'Seed pack' };
  const rewardText = (r) => Object.entries(r).filter(([, v]) => v).map(([k, v]) => `${icon(REWARD_ICON[k], 18)}${k === 'boostMinutes' ? `${v} min` : k === 'cashHarvests' ? `${v} harvests` : `${v}`}`).join(' ');
  // The stars are the game's own star art (RWD-05), grey when not earned.
  const starRow = (n, of = 3, size = 14) => Array.from({ length: of }, (_, i) => icon('RWD-05', size, `bm-star ${i < n ? 'on' : ''}`)).join('');

  // The words on the map button: "On now" or the countdown.
  function status() {
    const ev = g().eventHub.weekly();
    if (ev.on) return { on: true, text: `On now · ${duration((ev.endsMs - g().now()) / 1000)} left` };
    return { on: false, text: `In ${duration((ev.startsMs - g().now()) / 1000)}` };
  }
  PE.EventHub = {
    DAYS, status,
    // The map's Event button (above the festival banner).
    button() {
      const st = status();
      const claim = g().eventHub.anyToClaim();
      return `<button class="map-hub ${st.on ? 'on' : ''}" data-act="eventHub">${icon('GOL-03', 30)}<span>${PE.Words.html('WRD-EVENT-WEEKLY', 'Event', '<b>Event</b>', 'hub-word')}<small>${esc(st.text)}</small></span>${claim ? icon('STA-03', 16, 'side-alert') : ''}</button>`;
    },
    // A Haze or Leafy tip the first time the button shows (job 21's tip box).
    tipOnce() {
      if (!PE.Tips || !PE.Tips.once) return;
      const st = status();
      PE.Tips.once(st.on ? 'It\'s Weekly Event Day! Tap Event to play Bud Match.' : `Event Day is every ${DAYS[g().eventHub.eventDay()]}. Tap Event to see what's on.`);
    },
  };
  PE.Hud.actions.eventHub = () => PE.App.openPanel('eventHub', {});

  PE.Panels.eventHub = {
    title: 'Events',
    live: true,
    render() {
      const game = g(), H = game.eventHub;
      const ev = H.weekly();
      const E = H.state();
      const now = game.now();
      const head = `<div class="ev-card ${ev.on ? 'on' : ''}" style="--ev:${esc(ev.look.colour)}">
        ${icon(ev.look.icon, 64)}
        <div class="grow">${PE.Words.html('WRD-EVENT-WEEKLY', ev.name, `<b>${esc(ev.name)}</b>`, 'ev-word')}<small>${esc(ev.blurb)}</small>
          <p class="ev-when">${ev.on ? `On today! Ends in ${duration((ev.endsMs - now) / 1000)}` : `Next one ${DAYS[new Date(ev.startsMs).getDay()]}, in ${duration((ev.startsMs - now) / 1000)}`}</p>
          <small>Event day: ${DAYS[H.eventDay()]} (change it in Settings)${ev.forced ? ' · test switch on' : ''}</small></div></div>`;
      const next = H.levels().findIndex((x, i) => !H.best(i + 1));
      const playN = next < 0 ? H.levels().length : next + 1;
      const play = PE.Words.extra('WRD-BUD-MATCH', 'Bud Match', 'ev-bm-word') + (ev.on
        ? `<button class="btn wide go bm-play" data-act="play:${playN}">${icon('GOL-05', 24)}Play Bud Match · level ${playN}</button>`
        : `<button class="btn wide cant bm-play" data-act="closed">${PE.Words.html('SIGN-CLOSED', 'Closed', icon('STA-02', 24), 'btn-word')}Bud Match opens on event day</button>`);
      // The week's stars and milestone prizes.
      const ms = H.milestones();
      const top = ms[ms.length - 1].stars;
      const marks = ms.map((m) => `<i class="ev-mark ${m.reached ? 'on' : ''}" style="left:${(m.stars / top) * 100}%">${m.stars}</i>`).join('');
      const rows = ms.map((m) => `<div class="item ev-prize ${m.reached ? '' : 'locked'}"><div class="grow"><b>${m.stars} stars</b><small>${rewardText(m.reward)}</small></div>
        ${m.claimed ? '<span class="tag go">Done</span>' : m.reached ? `<button class="btn small go" data-act="claim:${m.i}">Claim</button>` : `<span class="tag">${E.stars}/${m.stars}</span>`}</div>`).join('');
      const week = `<h4>${icon('RWD-05', 20)} This week: ${E.stars} stars</h4><div class="ev-bar"><b style="width:${Math.min(100, (E.stars / top) * 100)}%"></b>${marks}</div>`;
      // Levels: open in order.
      const grid = H.levels().map((lv, i) => {
        const n = i + 1, open = H.isOpen(n), best = H.best(n);
        return `<button class="bm-lvl ${open ? '' : 'locked'} ${best ? 'done' : ''}" data-act="${open && ev.on ? `play:${n}` : 'closed'}" aria-label="Level ${n}"><b>${open ? n : icon('SYS-01', 18)}</b><span>${starRow(best)}</span></button>`;
      }).join('');
      // The prize limits.
      const caps = H.caps(), paid = H.paid();
      const capRow = (k) => `<span>${icon(REWARD_ICON[k], 16)}${REWARD_NAME[k]} ${paid.day[k] || 0}/${caps.day[k]} today · ${paid.week[k] || 0}/${caps.week[k]} this week</span>`;
      // Job 25: every other event in the data table (data/event_hub.js) gets its own card here with no new code: its look,
      // name, words, and on now or when it starts. One that plays Bud Match opens it while it's on. (Its prizes use the
      // weekly tables until a second event exists and needs its own week of stars.)
      const others = H.list().filter((x) => x.id !== 'weekly' && x.startsMs !== Infinity).map((x) => `<div class="ev-card small ${x.on ? 'on' : ''}" data-event="${esc(x.id)}" style="--ev:${esc((x.look || {}).colour || '#52e6ff')}">
        ${icon((x.look || {}).icon || 'GOL-03', 44)}<div class="grow"><b>${esc(x.name)}</b><small>${esc(x.blurb || '')}</small>
        <p class="ev-when">${x.on ? `On now! Ends in ${duration((x.endsMs - now) / 1000)}` : `Starts in ${duration((x.startsMs - now) / 1000)}`}</p></div>
        ${x.on && x.game === 'budMatch' ? `<button class="btn small go" data-act="play:${playN}">Play</button>` : ''}</div>`).join('');
      return `${head}${play}${others ? `<h4>${icon('GOL-03', 20)} More events</h4>${others}` : ''}${week}<div class="ev-prizes">${rows}</div>
        <h4>${icon('GOL-05', 20)} Bud Match levels</h4><div class="bm-grid">${grid}</div>
        <h4>Prize limits</h4><p class="muted small ev-caps">Events add to the main game, never replace it, so their prizes stop at a limit. ${Object.keys(caps.day).map(capRow).join('')}</p>`;
    },
    actions: {
      play(n) { PE.App.openPanel('budMatch', { level: Number(n) }); },
      closed() { PE.Dom.toast(g().eventHub.weekly().on ? 'Win the level before it first' : `Bud Match opens on ${DAYS[g().eventHub.eventDay()]}`); },
      claim(i) {
        const r = g().eventHub.claimMilestone(Number(i));
        if (r.ok) { PE.Dom.toast(`${r.text || 'Limit reached'}${r.capped ? ' (prize limit reached)' : ''}`, '', 'RWD-05'); PE.App.saveGame(); }
      },
    },
  };

  // ---- The secret test switch: ?eventday on the web address, or the tester panel ---------------------------------------
  if (typeof location !== 'undefined' && /[?&]eventday\b/.test(location.search)) {
    const on = () => { if (PE.App && PE.App.g) PE.App.g.eventHub.setForce(true); else setTimeout(on, 300); };
    on();
  }
})(globalThis.PE = globalThis.PE || {});
