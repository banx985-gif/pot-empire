// UI35 Settings and help: sound and music, look and feel, accessibility, the speed counter, save backup
// and restore, the test shop switch, and a short how-to-play.
(function (PE) {
  const { esc } = PE.Dom;
  const g = () => PE.App.g;
  const toast = (t) => PE.Dom.toast(t);
  const S = () => PE.App.state.settings;
  const changed = () => { PE.App.saveGame(); PE.Look.apply(); };
  const toggle = (key, title, text) => `<div class="item"><div class="grow"><b>${title}</b><small>${text}</small></div>
    <button class="btn small ${S()[key] ? 'go' : 'cant'}" data-act="flip:${key}" aria-pressed="${!!S()[key]}">${S()[key] ? 'On' : 'Off'}</button></div>`;
  const slider = (key, title) => `<label class="item slider"><div class="grow"><b>${title}</b><small>${Math.round(S()[key] * 100)}%</small></div>
    <input type="range" min="0" max="100" step="5" value="${Math.round(S()[key] * 100)}" data-change="vol:${key}" aria-label="${title}"></label>`;

  const HELP = [
    ['Grow', 'Tap an empty pot to plant. Plants grow through five stages; tap a ripe one to harvest. Harvests sell by themselves.'],
    ['Upgrade', 'Tap a station\'s bench to upgrade its light, sprinkler, pots, computer and pot count. A new hydro model resets the parts but grows much more.'],
    ['Automate', 'From level 6 and 9 (or with computer upgrades) stations harvest and replant by themselves, even while the game is closed (up to 8 hours, 12 with research).'],
    ['Expand', 'The Empire tab buys new places: more grow rooms, shops, a factory, research, deliveries and HQ.'],
    ['Collect', 'Managers, relics, stickers, vehicles, products, packaging and decorations each help in their own way. Duplicates turn into Collection Tokens.'],
    ['Prestige', 'Optional. Restart one district\'s equipment for Empire Shares that raise every harvest forever.'],
    ['Breaks are fine', 'Nothing dies, no streaks are lost, and there\'s no energy to wait for.'],
  ];

  PE.Panels.settings = {
    title: 'Settings and help',
    render() {
      const s = S();
      const build = PE.BUILD.startsWith('__') ? 'dev' : PE.BUILD;
      return `<h4>Sound</h4>${slider('sound', 'Sound effects')}${slider('music', 'Music')}
        ${toggle('haptics', 'Vibration', 'A gentle buzz on harvest, collect and level up')}
        <h4>Notifications</h4>
        ${toggle('notify', 'Notifications', 'A shout from Uncle Haze when something is ready. Never at night, only a few a day.')}
        ${s.notify ? PE.Notify.KINDS.map((k) => toggle(k.key, k.title, k.text)).join('') : ''}
        <h4>Events</h4>
        <div class="item"><div class="grow"><b>Event day</b><small>The day of the week the Weekly Event Day runs, by your phone's date. Tap to change.</small></div>
          <button class="btn small go" data-act="eventDay">${PE.EventHub.DAYS[g().eventHub.eventDay()]}</button></div>
        <h4>Look and feel</h4>
        ${toggle('reducedMotion', 'Reduced motion', 'Fewer moving effects; celebrations stay still')}
        <div class="item"><div class="grow"><b>Text size</b><small>The writing in menus and pop-ups. Tap to change.</small></div>
          <button class="btn small go" data-act="flip:bigText" aria-pressed="${!!s.bigText}">${s.bigText ? 'Large' : 'Normal'}</button></div>
        ${toggle('colourBlind', 'Colour-blind friendly', 'Quality shows a letter and shape, not just a colour')}
        ${toggle('helpers', 'Helper jokes', 'Uncle Haze, Budz and Leafy now and then')}
        <button class="btn wide plain" data-act="replayList">Help: replay helper lines</button>
        <h4>Speed</h4>
        ${toggle('showFps', 'Show speed counter', 'Frames per second in the corner, to check how smoothly it runs')}
        <h4>Your save</h4>
        <p class="muted">The game saves by itself on this phone. A backup is a piece of text you can keep somewhere safe and paste back later.</p>
        <div class="row-btns"><button class="btn small buy" data-act="backup">Make a backup</button><button class="btn small plain" data-act="restoreBox">Restore a backup</button></div>
        <div id="save-box"></div>
        <h4>Test shop</h4>
        ${toggle('pretendShop', 'Pretend payments and ads', 'For testing only: no real money, no real ads')}
        <h4>${PE.Dom.icon('SYS-02', 20)} How to play</h4>
        <button class="btn wide go" data-act="replayGuide">${PE.Dom.icon('SYS-02', 22)}Replay tutorial</button>
        <button class="btn wide plain" data-act="replayIntro">Replay intro</button>
        ${PE.HelperArt.says(PE.Data.helperSprites.screens.howToPlay, PE.Data.helperSprites.words.howToPlay, 'Leafy')}
        ${HELP.map(([t, x]) => `<div class="item"><div class="grow"><b>${esc(t)}</b><small>${esc(x)}</small></div></div>`).join('')}
        <p class="muted" data-act="version">Build ${esc(build)} · Balance table v${g().B.tableVersion} (provisional) · Save version ${PE.SaveSchema.CURRENT_VERSION}</p>
        <p class="muted">Music and ambience by TomMusic. Sound effects from ESM's Vibrant Game.</p>
        <p class="muted">A fictional game for adults. Nothing here is real advice or a real product.${s ? '' : ''}</p>`;
    },
    actions: {
      eventDay() { g().eventHub.setDay((g().eventHub.eventDay() + 1) % 7); PE.App.saveGame(); },
      version() { PE.Tester.tapVersion(); },
      flip(key) {
        S()[key] = !S()[key]; changed();
        if (/^notify/.test(key)) { PE.Notify.changed(); if (key === 'notify' && S().notify) PE.Notify.check(true); PE.Dom.renderPanel(); } if (key === 'colourBlind') PE.Look.redrawRoom(); },
      vol(key, v) { S()[key] = Math.max(0, Math.min(1, Number(v) / 100)); changed(); if (key === 'sound') PE.Sound.play('tap'); },
      replayList() { PE.App.router.go('helperReplay', {}); },
      replayIntro() { PE.Intro.show(true); },
      replayGuide() {
        g().tutorial.replay();
        PE.App.saveGame();
        PE.App.goToRoom('F01');
      },
      backup() {
        const text = PE.App.saves.exportText(PE.App.state);
        PE.App.router.go('saveBackup', { text });
      },
      restoreBox() { PE.App.router.go('saveRestore', {}); },
    },
  };

  // The backup text, with copy and download. Kept off the main settings list so it doesn't redraw.
  PE.Panels.saveBackup = {
    title: 'Save backup',
    render({ text }) {
      return `<p>Copy this text, or download it as a file, and keep it safe. It includes everything in your game.</p>
        <textarea id="backup-text" class="savetext" readonly>${esc(text)}</textarea>
        <div class="row-btns"><button class="btn small go" data-act="copy">Copy</button><button class="btn small buy" data-act="download">Download file</button></div>`;
    },
    actions: {
      copy() {
        const el = document.getElementById('backup-text');
        const done = () => toast('Backup copied');
        if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(el.value).then(done, () => { el.select(); document.execCommand('copy'); done(); });
        else { el.select(); document.execCommand('copy'); done(); }
      },
      download() {
        const text = document.getElementById('backup-text').value;
        const a = document.createElement('a');
        a.href = URL.createObjectURL(new Blob([text], { type: 'text/plain' }));
        a.download = `pot-empire-backup-${new Date().toISOString().slice(0, 10)}.txt`;
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(a.href), 2000);
      },
    },
  };

  PE.Panels.saveRestore = {
    title: 'Restore a backup',
    render() {
      return `<p>Paste a backup, or pick a backup file. Your current game is kept as a spare copy, then the game restarts with the backup.</p>
        <textarea id="restore-text" class="savetext" placeholder="Paste the backup text here"></textarea>
        <button class="btn wide buy" data-act="fromText">Restore this text</button>
        <label class="btn wide plain filepick">Pick a backup file<input id="restore-file" type="file" accept=".txt,text/plain"></label>`;
    },
    actions: {
      fromText() { restoreFrom(document.getElementById('restore-text').value); },
    },
  };
  function restoreFrom(text) {
    const r = PE.App.saves.importText(text);
    if (!r.ok) { PE.Dom.modal({ title: 'That backup can\'t be used', html: `<p>${esc(r.why)}. Nothing was changed.</p>`, buttons: [{ label: 'OK', style: 'go' }] }); return; }
    PE.Dom.modal({ title: 'Backup restored', html: '<p>The game will restart now with your backup.</p>', buttons: [{ label: 'Restart', style: 'go', onTap: () => location.reload() }] });
  }
  PE.Settings = { restoreFrom };

  // Sliders and the file picker are read from change events (taps are handled elsewhere).
  PE.Settings.init = () => {
    const panel = document.getElementById('panel');
    panel.addEventListener('change', (e) => {
      const t = e.target;
      if (t.id === 'restore-file' && t.files && t.files[0]) {
        const f = t.files[0];
        const rd = new FileReader();
        rd.onload = () => restoreFrom(String(rd.result));
        rd.readAsText(f);
        return;
      }
      if (t.dataset && t.dataset.change) PE.Dom.runAction(`${t.dataset.change}:${t.value}`);
    });
  };
})(globalThis.PE = globalThis.PE || {});
