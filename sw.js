// Pot Empire - service worker (the small script that lets the installed game work offline).
//
// NETWORK FIRST: when the phone is online it fetches the newest files (so a new build shows up on
// the next open) and keeps a copy. When offline it plays from that copy.
//
// VERSION is stamped by publish.ps1 on every publish. A new version makes the phone install this
// worker fresh and throw away old copies.
const VERSION = '20261105-102249';
const PREFIX = 'pot-empire-';   // other Banx games share this web address: only ever touch our own copies
const CACHE = PREFIX + VERSION;

const CORE = ['./', './index.html', './manifest.webmanifest', './css/main.css'];
// Every file in the game, filled in by publish.ps1 so it's all saved on the first visit.
const PRECACHE = ["./assets/helpers/HAZE.webp","./assets/icons/apple-touch-icon.png","./assets/icons/icon-192.png","./assets/icons/icon-512.png","./assets/icons/icon-maskable-512.png","./assets/strains_s/STR-001.webp","./assets/strains_s/STR-002.webp","./assets/strains_s/STR-003.webp","./assets/strains_s/STR-004.webp","./assets/strains_s/STR-005.webp","./assets/strains_s/STR-006.webp","./assets/strains_s/STR-007.webp","./assets/strains_s/STR-008.webp","./assets/strains_s/STR-009.webp","./assets/strains_s/STR-010.webp","./assets/strains_s/STR-011.webp","./assets/strains_s/STR-012.webp","./assets/strains_s/STR-013.webp","./assets/strains_s/STR-014.webp","./assets/strains_s/STR-015.webp","./assets/strains_s/STR-016.webp","./assets/strains_s/STR-017.webp","./assets/strains_s/STR-018.webp","./assets/strains_s/STR-019.webp","./assets/strains_s/STR-020.webp","./assets/strains_s/STR-021.webp","./assets/strains_s/STR-022.webp","./assets/strains_s/STR-023.webp","./assets/strains_s/STR-024.webp","./assets/strains_s/STR-025.webp","./assets/strains_s/STR-026.webp","./assets/strains_s/STR-027.webp","./assets/strains_s/STR-028.webp","./assets/strains_s/STR-029.webp","./assets/strains_s/STR-030.webp","./assets/strains_s/STR-031.webp","./assets/strains_s/STR-032.webp","./assets/strains_s/STR-033.webp","./assets/strains_s/STR-034.webp","./assets/strains_s/STR-035.webp","./assets/strains_s/STR-036.webp","./assets/strains_s/STR-037.webp","./assets/strains_s/STR-038.webp","./assets/strains_s/STR-039.webp","./assets/strains_s/STR-040.webp","./assets/strains_s/STR-041.webp","./assets/strains_s/STR-042.webp","./assets/strains_s/STR-043.webp","./assets/strains_s/STR-044.webp","./assets/strains_s/STR-045.webp","./assets/strains_s/STR-046.webp","./assets/strains_s/STR-047.webp","./assets/strains_s/STR-048.webp","./assets/strains_s/STR-049.webp","./assets/strains_s/STR-050.webp","./assets/strains_s/STR-051.webp","./assets/strains_s/STR-052.webp","./assets/strains_s/STR-053.webp","./assets/strains_s/STR-054.webp","./assets/strains_s/STR-055.webp","./assets/strains_s/STR-056.webp","./assets/strains_s/STR-057.webp","./assets/strains_s/STR-058.webp","./assets/strains_s/STR-059.webp","./assets/strains_s/STR-060.webp","./css/main.css","./data/asset_registry.js","./data/balance.v1.js","./data/balance.v2.js","./data/balance.v3.js","./data/collectibles.js","./data/helpers.js","./data/jokes.js","./data/ladder.js","./data/managers.js","./data/rivals.js","./data/shop.js","./data/strains.js","./data/strain_frames.js","./data/vips.js","./index.html","./js/build_info.js","./js/logic/business.js","./js/logic/clock.js","./js/logic/collections.js","./js/logic/data_check.js","./js/logic/effects.js","./js/logic/facilities.js","./js/logic/game.js","./js/logic/goals.js","./js/logic/grow.js","./js/logic/helpers.js","./js/logic/layout.js","./js/logic/meta.js","./js/logic/money.js","./js/logic/offline.js","./js/logic/profile.js","./js/logic/progress.js","./js/logic/purchases.js","./js/logic/rng.js","./js/logic/router.js","./js/logic/save.js","./js/logic/save_schema.js","./js/ui/app.js","./js/ui/dom.js","./js/ui/grow_room.js","./js/ui/helpers_ui.js","./js/ui/menus.js","./js/ui/panels_collection.js","./js/ui/panels_empire.js","./js/ui/panels_grow.js","./js/ui/panels_hydro.js","./js/ui/panels_meta.js","./js/ui/panels_profile.js","./js/ui/panels_settings.js","./js/ui/panels_shop.js","./js/ui/quality_fx.js","./js/ui/screen.js","./js/ui/screens.js","./js/ui/sound.js","./manifest.webmanifest","./vendor/phaser-LICENSE.md","./vendor/phaser.min.js"];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      // One file failing must not block the rest.
      .then((c) => Promise.allSettled(CORE.concat(PRECACHE).map((u) =>
        c.add(new Request(u, { cache: 'reload' })))))
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
  event.respondWith(
    fetch(req, { cache: 'no-cache' })
      .then((res) => {
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
        }
        return res;
      })
      .catch(() => caches.match(req, { ignoreSearch: true })
        .then((hit) => hit || (req.mode === 'navigate' ? caches.match('./index.html') : Response.error())))
  );
});
