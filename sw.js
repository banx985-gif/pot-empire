// Pot Empire - service worker (the small script that lets the installed game work offline).
//
// NETWORK FIRST: when the phone is online it fetches the newest files (so a new build shows up on
// the next open) and keeps a copy. When offline it plays from that copy.
//
// VERSION is stamped by publish.ps1 on every publish. A new version makes the phone install this
// worker fresh and throw away old copies.
const VERSION = '20261104-213115';
const PREFIX = 'pot-empire-';   // other Banx games share this web address: only ever touch our own copies
const CACHE = PREFIX + VERSION;

const CORE = ['./', './index.html', './manifest.webmanifest', './css/main.css'];
// Every file in the game, filled in by publish.ps1 so it's all saved on the first visit.
const PRECACHE = ["./assets/icons/apple-touch-icon.png","./assets/icons/icon-192.png","./assets/icons/icon-512.png","./assets/icons/icon-maskable-512.png","./assets/strains/STR-001.webp","./assets/strains/STR-002.webp","./assets/strains/STR-003.webp","./assets/strains/STR-004.webp","./assets/strains/STR-005.webp","./assets/strains/STR-006.webp","./assets/strains/STR-007.webp","./assets/strains/STR-008.webp","./assets/strains/STR-009.webp","./assets/strains/STR-010.webp","./assets/strains/STR-011.webp","./assets/strains/STR-012.webp","./assets/strains/STR-013.webp","./assets/strains/STR-014.webp","./assets/strains/STR-015.webp","./assets/strains/STR-016.webp","./assets/strains/STR-017.webp","./assets/strains/STR-018.webp","./assets/strains/STR-019.webp","./assets/strains/STR-020.webp","./assets/strains/STR-021.webp","./assets/strains/STR-022.webp","./assets/strains/STR-023.webp","./assets/strains/STR-024.webp","./assets/strains/STR-025.webp","./assets/strains/STR-026.webp","./assets/strains/STR-027.webp","./assets/strains/STR-028.webp","./assets/strains/STR-029.webp","./assets/strains/STR-030.webp","./assets/strains/STR-031.webp","./assets/strains/STR-032.webp","./assets/strains/STR-033.webp","./assets/strains/STR-034.webp","./assets/strains/STR-035.webp","./assets/strains/STR-036.webp","./assets/strains/STR-037.webp","./assets/strains/STR-038.webp","./assets/strains/STR-039.webp","./assets/strains/STR-040.webp","./assets/strains/STR-041.webp","./assets/strains/STR-042.webp","./assets/strains/STR-043.webp","./assets/strains/STR-044.webp","./assets/strains/STR-045.webp","./assets/strains/STR-046.webp","./assets/strains/STR-047.webp","./assets/strains/STR-048.webp","./assets/strains/STR-049.webp","./assets/strains/STR-050.webp","./assets/strains/STR-051.webp","./assets/strains/STR-052.webp","./assets/strains/STR-053.webp","./assets/strains/STR-054.webp","./assets/strains/STR-055.webp","./assets/strains/STR-056.webp","./assets/strains/STR-057.webp","./assets/strains/STR-058.webp","./assets/strains/STR-059.webp","./assets/strains/STR-060.webp","./css/main.css","./data/asset_registry.js","./data/balance.v1.js","./data/helpers.js","./data/managers.js","./data/rivals.js","./data/strains.js","./data/strain_frames.js","./data/vips.js","./index.html","./js/build_info.js","./js/logic/clock.js","./js/logic/data_check.js","./js/logic/router.js","./js/logic/save.js","./js/logic/save_schema.js","./js/ui/app.js","./js/ui/screen.js","./js/ui/screens.js","./manifest.webmanifest","./vendor/phaser-LICENSE.md","./vendor/phaser.min.js"];

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
