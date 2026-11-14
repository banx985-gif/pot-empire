// Phone notifications (job 18), in Uncle Haze's voice, with a main on/off switch and one for each kind (Settings).
//   - In the app: Capacitor's Local Notifications plugin. When the game goes into the background it works out when
//     things will be ready and books them on the phone; no server. Coming back cancels any still waiting.
//   - In a phone's browser: the browser's own notifications, if it allows them, for as long as the page is kept
//     alive in the background. If it doesn't, nothing happens.
//   - It never asks when the game first opens (job 21). It asks later, in the game's own pop-up first: after the first
//     harvest AND 5 minutes of play, or the second time the game is opened, whichever comes first. The phone's own
//     permission box only shows if the player taps yes. A "not now" waits a month before one more try, then never again.
//   - At most MAX_A_DAY a day, at least MIN_GAP apart, and never between 10 pm and 8 am phone time (moved to 8 am).
//   - Tapping one opens the game on the right screen.
(function (PE) {
  const KINDS = [
    { key: 'notifyHarvest', id: 'harvest', title: 'Plants ready', text: 'Psst. Your plants are ready to harvest, kid. They grew up so fast.', route: 'garage' },
    { key: 'notifyTank', id: 'tank', title: 'Tank full', text: "The water tank's full. Come hit Spray! before Budz drinks it.", route: 'garage' },
    { key: 'notifyOrders', id: 'orders', title: 'Order ready', text: "A delivery's done and the cash is waiting. Don't leave it on the porch.", route: 'contracts' },
    { key: 'notifyDaily', id: 'daily', title: 'Daily reward', text: "Today's reward is in. Free stuff. I checked, it's legal. In the game.", route: 'calendar' },
    { key: 'notifyEvents', id: 'event', title: 'Festival time', text: 'A festival just kicked off! Every harvest scores points. Grab your sneakers.', route: 'festival' },
    // Job 25: the automation has run as long as it can while you're away, and the weekly Event Day.
    { key: 'notifyCap', id: 'cap', title: 'Growers on a break', text: "Your stations have done all they can while you're away. Pop back and they'll start again.", route: 'garage' },
    { key: 'notifyEventDay', id: 'eventDay', title: 'Event Day!', text: "It's Weekly Event Day. Bud Match is open, and there are prizes. Leafy's already playing.", route: 'eventHub' },
  ];
  const ASK_TITLE = 'Want a nudge?';
  const ASK_AFTER_PLAY_MS = 5 * 60000;     // with a harvest done
  const ASK_SETTLE_MS = 20000;             // on a second open: a little play first, never straight away
  const ASK_AGAIN_MS = 30 * 86400000;      // after a "not now"
  const ASK_MOST = 2;                      // times ever
  const MAX_A_DAY = 2;   // job 25: never more than 2 a day
  const MIN_GAP_MS = 2 * 3600000;
  const QUIET_FROM = 22, QUIET_TO = 8;
  const AHEAD_MS = 48 * 3600000;
  const BASE_ID = 1800;   // the app's notification numbers: 1800 to 1800 + the most it books
  const cap = () => (window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform() ? window.Capacitor : null);
  const S = () => PE.App.state.settings;
  const on = (key) => S().notify !== false && (!key || S()[key] !== false);

  // Moves a time out of the quiet hours (10 pm to 8 am, phone time) to 8 am.
  function wake(ms) {
    const d = new Date(ms);
    const h = d.getHours();
    if (h >= QUIET_FROM) { d.setDate(d.getDate() + 1); d.setHours(QUIET_TO, 0, 0, 0); } else if (h < QUIET_TO) d.setHours(QUIET_TO, 0, 0, 0);
    return d.getTime();
  }

  const Notify = {
    KINDS,
    ASK_TITLE,
    sessionMs: 0,
    wake,
    booked: [],   // what's booked now (the tests read this)
    timers: [],
    // When each kind will next be ready, in phone time (ms), or null. Game time can run ahead of the phone's clock
    // (the tester panel's time jump), so it's measured from now.
    upcoming() {
      const g = PE.App.g;
      const gnow = g.now(), real = Date.now();
      const at = (gameMs) => real + Math.max(0, gameMs - gnow);
      const out = {};
      let ripe = Infinity, tank = Infinity, order = Infinity;
      g.grow.eachStation((fid, si, st) => {
        for (const p of st.pots) if (p && p.readyMs > gnow) ripe = Math.min(ripe, p.readyMs);
        if (st.pots.some(Boolean)) { const full = g.grow.tankFullAt(fid, si); if (full > gnow) tank = Math.min(tank, full); }
      });
      for (const r of g.facilities.rows) {
        if (!g.facilities.isOwned(r.id) || (r.mode !== 'Logistics' && r.mode !== 'Factory')) continue;
        for (const s of g.business.slots(r.id)) if (s && s.job && s.job.endMs > gnow) order = Math.min(order, s.job.endMs);
      }
      if (ripe < Infinity) out.harvest = at(ripe);
      if (tank < Infinity) out.tank = at(tank);
      if (order < Infinity) out.orders = at(order);
      if (!g.calendar.canClaim()) out.daily = at((Math.floor(gnow / 86400000) + 1) * 86400000);
      const f = g.meta.festivalNow();
      if (!f.active && f.startsMs > gnow) out.event = at(f.startsMs);
      // Job 25: when the time-away automation will have run its full time (only if a station runs by itself).
      let auto = false;
      g.grow.eachStation((fid, si, st) => { if (st.auto.harvest && st.auto.replant && st.pots.some(Boolean)) auto = true; });
      if (auto) out.cap = real + g.offline.capSeconds() * 1000;
      // The next Weekly Event Day, at 10 in the morning (by the phone's date).
      if (g.eventHub) { const ev = g.eventHub.weekly(); if (!ev.on && ev.startsMs > gnow) out.eventDay = at(ev.startsMs + 10 * 3600000); }
      return out;
    },
    // The list to book: each kind that's on, moved out of the quiet hours, soonest first, spaced out, a few a day.
    plan() {
      if (!on()) return [];
      const when = Notify.upcoming();
      const real = Date.now();
      const list = KINDS.filter((k) => on(k.key) && when[k.id] && when[k.id] - real < AHEAD_MS).map((k) => ({ ...k, at: wake(when[k.id]) }));
      list.sort((a, b) => a.at - b.at);
      const out = [];
      for (const n of list) {
        const prev = out[out.length - 1];
        if (prev && n.at - prev.at < MIN_GAP_MS) n.at = wake(prev.at + MIN_GAP_MS);
        const day = new Date(n.at).toDateString();
        if (out.filter((o) => new Date(o.at).toDateString() === day).length >= MAX_A_DAY) continue;
        if (n.at - real < AHEAD_MS) out.push(n);
      }
      return out.sort((a, b) => a.at - b.at);
    },
    // Going into the background: book them. Coming back: cancel them.
    away(isAway) {
      if (!PE.App || !PE.App.g) return;
      Notify.cancel();
      if (isAway && Notify.allowed) Notify.book(Notify.plan());
    },
    book(list) {
      Notify.booked = list.map((n, i) => ({ id: BASE_ID + i, kind: n.id, at: n.at, title: n.title, text: n.text, route: n.route }));
      if (!list.length) return;
      const c = cap();
      if (c) {
        c.nativePromise('LocalNotifications', 'schedule', { notifications: Notify.booked.map((n) => ({
          // Not to the second: so the phone never has to ask for exact-alarm rights (it would open a settings page).
          id: n.id, title: n.title, body: n.text, isExactNotification: false, schedule: { at: new Date(n.at).toISOString(), allowWhileIdle: true }, extra: { route: n.route },
        })) }).catch(() => {});
        return;
      }
      // The browser: only while it keeps the page alive.
      for (const n of Notify.booked) {
        Notify.timers.push(setTimeout(() => Notify.showWeb(n), Math.max(0, n.at - Date.now())));
      }
    },
    showWeb(n) {
      try {
        if (!('Notification' in window) || Notification.permission !== 'granted') return;
        const opts = { body: n.text, icon: 'assets/ui/RWD-04.webp', tag: n.kind, data: { route: n.route } };
        if (navigator.serviceWorker && navigator.serviceWorker.ready) navigator.serviceWorker.ready.then((r) => r.showNotification(n.title, opts)).catch(() => {});
        else new Notification(n.title, opts).onclick = () => { window.focus(); Notify.open(n.route); };
      } catch (e) { /* not allowed here: skip quietly */ }
    },
    cancel() {
      for (const t of Notify.timers) clearTimeout(t);
      Notify.timers = [];
      const c = cap();
      if (c) c.nativePromise('LocalNotifications', 'cancel', { notifications: Array.from({ length: 12 }, (_, i) => ({ id: BASE_ID + i })) }).catch(() => {});
      Notify.booked = [];
    },
    // Opens the right screen for a notification that was tapped.
    open(route) {
      if (!PE.App) return;
      if (route === 'garage') PE.App.goToRoom('F01');
      else PE.App.router.go(route, {});
    },
    // Whether the phone lets us. Asks it only when told to (after the first harvest).
    check(ask) {
      const c = cap();
      if (c) {
        const call = ask ? 'requestPermissions' : 'checkPermissions';
        return c.nativePromise('LocalNotifications', call, {}).then((r) => { Notify.allowed = r && r.display === 'granted'; return Notify.allowed; }).catch(() => (Notify.allowed = false));
      }
      if (!('Notification' in window)) return Promise.resolve(Notify.allowed = false);
      if (Notification.permission === 'granted') return Promise.resolve(Notify.allowed = true);
      if (!ask || Notification.permission === 'denied') return Promise.resolve(Notify.allowed = false);
      return Promise.resolve(Notification.requestPermission()).then((p) => (Notify.allowed = p === 'granted')).catch(() => (Notify.allowed = false));
    },
    // Is it time to ask? (job 21) Never on the first screens, in the guide, or over another pop-up.
    askDue() {
      const ui = PE.App.state.ui, g = PE.App.g;
      if (ui.notifyAnswer === 'yes' || (ui.notifyAsks || 0) >= ASK_MOST) return false;
      if (ui.notifyAsked && !ui.notifyAnswer) return false;   // marked as asked by an older version (or a test)
      if (ui.notifyAnswer === 'no' && Date.now() - (ui.notifyAskedAt || 0) < ASK_AGAIN_MS) return false;
      const played = (g.state.stats.harvests > 0 && (ui.playMs || 0) >= ASK_AFTER_PLAY_MS) || ((ui.opens || 0) >= 2 && Notify.sessionMs >= ASK_SETTLE_MS);
      return played;
    },
    canAskNow() {
      const app = PE.App, top = app.router.current();
      if (!top || top.name === 'title' || !PE.AgeGate.answered() || app.g.tutorial.active()) return false;
      if (PE.Dom.modalNow || PE.Dom.panelRoute || PE.Dom.isTouching() || (PE.Intro && PE.Intro.open)) return false;
      if ((PE.HelperUI && PE.HelperUI.now) || (PE.ChestReveal && PE.ChestReveal.now)) return false;
      const cel = document.getElementById('celebrate');
      return !(cel && !cel.hidden);
    },
    // Counts time played (only while the game is on screen, past the title), then asks when it's time.
    tick(ms) {
      const app = PE.App;
      if (!app || !app.g || document.hidden) return;
      const top = app.router.current();
      if (!top || top.name === 'title' || !PE.AgeGate.answered()) return;
      const ui = app.state.ui;
      ui.playMs = (ui.playMs || 0) + ms;
      Notify.sessionMs += ms;
      if (Notify.askDue() && Notify.canAskNow()) Notify.maybeAsk();
    },
    // Uncle Haze asks first in the game's own pop-up; only a yes brings up the phone's own permission box.
    maybeAsk() {
      const ui = PE.App.state.ui;
      if (!Notify.askDue()) return;
      ui.notifyAsked = true;
      ui.notifyAskedAt = Date.now();
      ui.notifyAsks = (ui.notifyAsks || 0) + 1;
      ui.notifyAnswer = 'no';   // until they say yes
      PE.App.saveGame();
      PE.Dom.modal({
        title: ASK_TITLE,
        html: `<div class="notify-ask">${PE.AnimDom ? PE.AnimDom.html('HAZE', 120, 'notify-haze') : ''}<p>Want a nudge when your plants are ripe, kid? Only the good stuff, never at night. You can switch them off in Settings.</p></div>`,
        buttons: [
          { label: 'Not now', style: 'plain', onTap: () => { ui.notifyAnswer = 'no'; ui.notifyAskedAt = Date.now(); PE.App.saveGame(); } },
          { label: 'Yes please', style: 'go', onTap: () => { ui.notifyAnswer = 'yes'; S().notify = true; PE.App.saveGame(); Notify.check(true); } },
        ],
      });
      setTimeout(() => { const el = document.querySelector('#modal .notify-haze'); if (el) PE.AnimDom.play(el, 'greet'); }, 50);
    },
    // A switch changed in Settings: anything booked that's now off is cancelled.
    changed() { Notify.cancel(); },
    init() {
      // Older saves have no switches yet: all on.
      for (const k of ['notify', ...KINDS.map((x) => x.key)]) if (S()[k] === undefined) S()[k] = true;
      // Saves from before job 21 that were already asked keep their answer: never asked twice by mistake.
      const ui = PE.App.state.ui;
      if (ui.notifyAsked && !ui.notifyAnswer) { ui.notifyAnswer = S().notify === false ? 'no' : 'yes'; ui.notifyAskedAt = ui.notifyAskedAt || Date.now(); ui.notifyAsks = 1; }
      ui.opens = (ui.opens || 0) + 1;
      // Only looks at what the phone already allows: never brings up its permission box.
      Notify.check(false);
      let last = Date.now();
      setInterval(() => { const t = Date.now(); Notify.tick(Math.min(t - last, 10000)); last = t; }, 2000);
      document.addEventListener('visibilitychange', () => Notify.away(document.hidden));
      const c = cap();
      if (c && c.addListener) {
        c.addListener('App', 'appStateChange', (st) => Notify.away(!st.isActive));
        c.addListener('LocalNotifications', 'localNotificationActionPerformed', (e) => {
          const route = e && e.notification && e.notification.extra && e.notification.extra.route;
          if (route) Notify.open(route);
        });
      }
      if (navigator.serviceWorker) navigator.serviceWorker.addEventListener('message', (e) => { if (e.data && e.data.notifyRoute) Notify.open(e.data.notifyRoute); });
    },
  };
  PE.Notify = Notify;
})(globalThis.PE = globalThis.PE || {});
