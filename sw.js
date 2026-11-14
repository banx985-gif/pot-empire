// Pot Empire - service worker (the small script that lets the installed game work offline).
//
// NETWORK FIRST for the game's code: when the phone is online it fetches the newest files (so a new build shows up on
// the next open) and keeps a copy. When offline it plays from that copy.
//
// COPY FIRST for pictures and sounds: each build has its own set of copies, so a saved one can't be out of date, and it doesn't
// need a trip to the server on a slow connection.
//
// VERSION is stamped by publish.ps1 on every publish. A new version makes the phone install this
// worker fresh and throw away old copies.
const VERSION = '20261114-103208';
const PREFIX = 'pot-empire-';   // other Banx games share this web address: only ever touch our own copies
const CACHE = PREFIX + VERSION;

const CORE = ['./', './index.html', './manifest.webmanifest', './css/main.css'];
// Every file in the game, filled in by publish.ps1 so it's all saved on the first visit.
const PRECACHE = ["./assets/avatars/STR-001.webp","./assets/avatars/STR-002.webp","./assets/avatars/STR-003.webp","./assets/avatars/STR-004.webp","./assets/avatars/STR-005.webp","./assets/avatars/STR-006.webp","./assets/avatars/STR-007.webp","./assets/avatars/STR-008.webp","./assets/avatars/STR-009.webp","./assets/avatars/STR-010.webp","./assets/avatars/STR-055.webp","./assets/furniture/SEAT-MASSAGE-34.webp","./assets/furniture/SEAT-MASSAGE-BACK.webp","./assets/furniture/SEAT-RECLINER-34.webp","./assets/furniture/SEAT-RECLINER-BACK.webp","./assets/furniture/SEAT-SOFA-34.webp","./assets/furniture/SEAT-SOFA-BACK.webp","./assets/furniture/SEAT-SOFA-FRONT.webp","./assets/furniture/TV-1-GAME-34.webp","./assets/furniture/TV-1-GAME.webp","./assets/furniture/TV-1-LOGO.webp","./assets/furniture/TV-2-GAME-34.webp","./assets/furniture/TV-2-GAME.webp","./assets/furniture/TV-2-LOGO.webp","./assets/furniture/TV-3-GAME.webp","./assets/furniture/TV-3-LOGO.webp","./assets/fx/transition/TITLE-D1.webp","./assets/fx/transition/TITLE-D2.webp","./assets/fx/transition/TITLE-D3.webp","./assets/fx/transition/TITLE-D4.webp","./assets/fx/transition/TRANS-CLOUD-FULL.webp","./assets/fx/transition/TRANS-CLOUD-PINK.webp","./assets/fx/transition/TRANS-PUFF.webp","./assets/fx/transition/TRANS-SMOKE-PINK.webp","./assets/fx/transition/TRANS-SMOKE-WIPE.webp","./assets/helpers/BUDZ-03.webp","./assets/helpers/BUDZ-19.webp","./assets/helpers/BUDZ-21.webp","./assets/helpers/BUDZ-37.webp","./assets/helpers/BUDZ-48.webp","./assets/helpers/HAZE-03.webp","./assets/helpers/HAZE-04.webp","./assets/helpers/HAZE-22.webp","./assets/helpers/HAZE-27.webp","./assets/helpers/HAZE-38.webp","./assets/helpers/HAZE-40.webp","./assets/helpers/HAZE-42.webp","./assets/helpers/LEAFY-03.webp","./assets/helpers/LEAFY-24.webp","./assets/helpers/LEAFY-28.webp","./assets/hydro/M1/HY-M1-BADGE.webp","./assets/hydro/M1/HY-M1-BASE.webp","./assets/hydro/M1/HY-M1-CMP-1.webp","./assets/hydro/M1/HY-M1-CMP-2.webp","./assets/hydro/M1/HY-M1-CMP-3.webp","./assets/hydro/M1/HY-M1-CMP-4.webp","./assets/hydro/M1/HY-M1-CMP-5.webp","./assets/hydro/M1/HY-M1-CMP-6.webp","./assets/hydro/M1/HY-M1-FRAME.webp","./assets/hydro/M1/HY-M1-FX-1.webp","./assets/hydro/M1/HY-M1-FX-2.webp","./assets/hydro/M1/HY-M1-FX-3.webp","./assets/hydro/M1/HY-M1-FX-4.webp","./assets/hydro/M1/HY-M1-FX-5.webp","./assets/hydro/M1/HY-M1-FX-6.webp","./assets/hydro/M1/HY-M1-LGT-1.webp","./assets/hydro/M1/HY-M1-LGT-2.webp","./assets/hydro/M1/HY-M1-LGT-3.webp","./assets/hydro/M1/HY-M1-LGT-4.webp","./assets/hydro/M1/HY-M1-LGT-5.webp","./assets/hydro/M1/HY-M1-LGT-6.webp","./assets/hydro/M1/HY-M1-POT-1.webp","./assets/hydro/M1/HY-M1-POT-2.webp","./assets/hydro/M1/HY-M1-POT-3.webp","./assets/hydro/M1/HY-M1-POT-4.webp","./assets/hydro/M1/HY-M1-POT-5.webp","./assets/hydro/M1/HY-M1-POT-6.webp","./assets/hydro/M1/HY-M1-SPR-1.webp","./assets/hydro/M1/HY-M1-SPR-2.webp","./assets/hydro/M1/HY-M1-SPR-3.webp","./assets/hydro/M1/HY-M1-SPR-4.webp","./assets/hydro/M1/HY-M1-SPR-5.webp","./assets/hydro/M1/HY-M1-SPR-6.webp","./assets/hydro/M1/HY-M1-TRAY.webp","./assets/hydro/spray/HY-M1-SPRAY-B.webp","./assets/hydro/spray/HY-M1-SPRAY-C.webp","./assets/hydro/spray/HY-M1-SPRAY-D.webp","./assets/hydro/spray/HY-M1-SPRAY-E.webp","./assets/hydro/spray/HY-M1-SPRAY.webp","./assets/icons/apple-touch-icon.png","./assets/icons/icon-192.png","./assets/icons/icon-512.png","./assets/icons/icon-maskable-512.png","./assets/intro/INTRO-01.webp","./assets/intro/INTRO-02.webp","./assets/intro/INTRO-03.webp","./assets/intro/INTRO-04.webp","./assets/intro/LOAD-01.webp","./assets/logos/STR-001.webp","./assets/logos/STR-002.webp","./assets/logos/STR-003.webp","./assets/logos/STR-004.webp","./assets/logos/STR-005.webp","./assets/logos/STR-006.webp","./assets/logos/STR-007.webp","./assets/logos/STR-008.webp","./assets/logos/STR-009.webp","./assets/logos/STR-010.webp","./assets/logos/STR-055.webp","./assets/map/BLD-F01-1.webp","./assets/map/BLD-F01-2.webp","./assets/map/BLD-F01-3.webp","./assets/map/BLD-F02-1.webp","./assets/map/BLD-F02-2.webp","./assets/map/BLD-F02-3.webp","./assets/map/BLD-F03-1.webp","./assets/map/BLD-F03-2.webp","./assets/map/BLD-F03-3.webp","./assets/map/BLD-X01-1.webp","./assets/map/BLD-X01-2.webp","./assets/map/BLD-X01-3.webp","./assets/map/BLD-X02-1.webp","./assets/map/BLD-X02-2.webp","./assets/map/BLD-X02-3.webp","./assets/map/BLD-X03-1.webp","./assets/map/BLD-X03-2.webp","./assets/map/BLD-X03-3.webp","./assets/map/districts/D1/base.webp","./assets/map/FX-01.webp","./assets/map/FX-02.webp","./assets/map/FX-03.webp","./assets/map/FX-04.webp","./assets/map/FX-05.webp","./assets/map/FX-06.webp","./assets/map/PRP-01.webp","./assets/map/PRP-02.webp","./assets/map/PRP-03.webp","./assets/map/PRP-04.webp","./assets/map/PRP-05.webp","./assets/map/PRP-06.webp","./assets/map/PRP-07.webp","./assets/map/PRP-08.webp","./assets/map/PRP-09.webp","./assets/map/PRP-10.webp","./assets/map/PRP-11.webp","./assets/map/PRP-12.webp","./assets/map/RBL-01.webp","./assets/map/RBL-02.webp","./assets/map/RBL-03.webp","./assets/map/VEH-01.webp","./assets/map/VEH-02.webp","./assets/map/VEH-03.webp","./assets/map/VEH-04.webp","./assets/map/VEH-05.webp","./assets/map/VEH-06.webp","./assets/map/WLK-01.webp","./assets/map/WLK-02.webp","./assets/map/WLK-03.webp","./assets/map/WLK-04.webp","./assets/map/WLK-05.webp","./assets/map/WLK-06.webp","./assets/rooms/ROOM-F01-1/base.webp","./assets/rooms/ROOM-F01-2/base.webp","./assets/strains_s/STR-001.webp","./assets/strains_s/STR-002.webp","./assets/strains_s/STR-003.webp","./assets/strains_s/STR-004.webp","./assets/strains_s/STR-005.webp","./assets/strains_s/STR-006.webp","./assets/strains_s/STR-007.webp","./assets/strains_s/STR-008.webp","./assets/strains_s/STR-009.webp","./assets/strains_s/STR-010.webp","./assets/strains_s/STR-055.webp","./assets/ui/ACT-01.webp","./assets/ui/ACT-02.webp","./assets/ui/ACT-03.webp","./assets/ui/ACT-04.webp","./assets/ui/ACT-05.webp","./assets/ui/ACT-06.webp","./assets/ui/ACT-07.webp","./assets/ui/ACT-08.webp","./assets/ui/ACT-09.webp","./assets/ui/ACT-10.webp","./assets/ui/ACT-11.webp","./assets/ui/BIZ-01.webp","./assets/ui/BIZ-02.webp","./assets/ui/BIZ-03.webp","./assets/ui/BIZ-04.webp","./assets/ui/BIZ-05.webp","./assets/ui/BIZ-06.webp","./assets/ui/BTN-01.webp","./assets/ui/BTN-02.webp","./assets/ui/BTN-03.webp","./assets/ui/BTN-04.webp","./assets/ui/BTN-05.webp","./assets/ui/BTN-06.webp","./assets/ui/BUB-01.webp","./assets/ui/BUB-02.webp","./assets/ui/BUD-01.webp","./assets/ui/COL-01.webp","./assets/ui/COL-02.webp","./assets/ui/COL-03.webp","./assets/ui/COL-04.webp","./assets/ui/COL-05.webp","./assets/ui/COL-06.webp","./assets/ui/CUR-01.webp","./assets/ui/CUR-02.webp","./assets/ui/CUR-03.webp","./assets/ui/CUR-04.webp","./assets/ui/CUR-05.webp","./assets/ui/CUR-06.webp","./assets/ui/GOL-01.webp","./assets/ui/GOL-02.webp","./assets/ui/GOL-03.webp","./assets/ui/GOL-04.webp","./assets/ui/GOL-05.webp","./assets/ui/GOL-06.webp","./assets/ui/JAR-01.webp","./assets/ui/JAR-02.webp","./assets/ui/JAR-03.webp","./assets/ui/JAR-LID.webp","./assets/ui/LOAD-02.webp","./assets/ui/LOAD-03.webp","./assets/ui/LOGO-01.webp","./assets/ui/MOOD-01.webp","./assets/ui/MOOD-02.webp","./assets/ui/MOOD-03.webp","./assets/ui/NAV-01.webp","./assets/ui/NAV-02.webp","./assets/ui/NAV-03.webp","./assets/ui/NAV-04.webp","./assets/ui/NAV-05.webp","./assets/ui/NAV-06.webp","./assets/ui/POP-01.webp","./assets/ui/QLT-01.webp","./assets/ui/QLT-02.webp","./assets/ui/QLT-03.webp","./assets/ui/QLT-04.webp","./assets/ui/QLT-05.webp","./assets/ui/QLT-06.webp","./assets/ui/RAR-01.webp","./assets/ui/RAR-02.webp","./assets/ui/RAR-03.webp","./assets/ui/RAR-04.webp","./assets/ui/RAR-05.webp","./assets/ui/RAR-06.webp","./assets/ui/RWD-01.webp","./assets/ui/RWD-02.webp","./assets/ui/RWD-03.webp","./assets/ui/RWD-04.webp","./assets/ui/RWD-05.webp","./assets/ui/RWD-06.webp","./assets/ui/SPARK-01.webp","./assets/ui/SPLASH-01.webp","./assets/ui/SPLASH-02.webp","./assets/ui/SPLASH-03.webp","./assets/ui/SPLASH-04.webp","./assets/ui/STA-01.webp","./assets/ui/STA-02.webp","./assets/ui/STA-03.webp","./assets/ui/STA-04.webp","./assets/ui/STA-05.webp","./assets/ui/STA-06.webp","./assets/ui/SYS-01.webp","./assets/ui/SYS-02.webp","./assets/ui/SYS-03.webp","./assets/ui/SYS-04.webp","./assets/ui/SYS-05.webp","./assets/ui/SYS-06.webp","./assets/ui/TOOL-00.webp","./assets/ui/TOOL-01.webp","./assets/ui/TRAIL-01.webp","./assets/ui/UPG-01.webp","./assets/ui/UPG-02.webp","./assets/ui/UPG-03.webp","./assets/ui/UPG-04.webp","./assets/ui/UPG-05.webp","./assets/ui/UPG-06.webp","./css/main.css","./data/balance.v1.js","./data/balance.v2.js","./data/balance.v3.js","./data/load_peeloff.js","./index.html","./js/game.bundle.js","./js/ui/log.js","./manifest.webmanifest","./vendor/phaser-LICENSE.md","./vendor/phaser.min.js"];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      // A few at a time, so saving the offline copy doesn't crowd out the game on a slow connection. One file failing must not block the rest.
      .then((c) => {
        const list = CORE.concat(PRECACHE);
        let next = 0;
        const worker = async () => {
          while (next < list.length) {
            const u = list[next++];
            try { await c.add(new Request(u, { cache: 'reload' })); } catch (e) { /* it's saved when it's first used */ }
          }
        };
        return Promise.all([worker(), worker(), worker(), worker()]);
      })
      .catch(() => { /* offline during install: copies are made as files are used */ })
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith(PREFIX) && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  if (new URL(req.url).pathname.includes('/assets/')) {
    event.respondWith(
      caches.open(CACHE).then((c) => c.match(req, { ignoreSearch: true }).then((hit) => hit || fetch(req).then((res) => {
        if (res && res.status === 200) c.put(req, res.clone());
        return res;
      })))
    );
    return;
  }
  event.respondWith(
    fetch(req, { cache: 'no-cache' })
      .then((res) => {
        if (res && res.status === 200) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
        }
        return res;
      })
      .catch(() => caches.match(req, { ignoreSearch: true })
        .then((hit) => hit || (req.mode === 'navigate' ? caches.match('./index.html') : Response.error())))
  );
});

// Job 18: a notification tapped in the browser opens the game (or brings it to the front) on the right screen.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const route = event.notification.data && event.notification.data.route;
  event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
    const open = list[0];
    if (open) { open.postMessage({ notifyRoute: route }); return open.focus(); }
    return self.clients.openWindow('./');
  }));
});
