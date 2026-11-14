// The ONE switch between a test build and a store release (job 25, docs/SERVER_DECISION.md, docs/RELEASE_CHECKLIST.md).
//   'test'  everything a store release mustn't have is allowed: the pretend store and pretend ads (Settings, Test shop),
//           Google's own test ad units, Google Play's test purchases. Real money and real ads are OFF.
//   'live'  real Google Play Billing and real AdMob ads (each still only if its own switch in data/shop.js is on, once the
//           store and the ad network have accepted the game), and no pretend store.
// tools/android_build.js refuses to make a store release (release bundle) while this says 'test', and the game's
// tests check that it says 'test' until Aaron flips it. Only Aaron flips it, when his Google Play Console account,
// the age rating and the store checks are done.
(globalThis.PE = globalThis.PE || {}).Data = globalThis.PE.Data || {};
globalThis.PE.Data.release = {
  mode: 'test',
  // Google's published TEST ad units (they always show a test ad, never a real one). Real ones go in at release.
  adUnits: { test: { rewarded: 'ca-app-pub-3940256099942544/5224354917' }, live: { rewarded: '' } },
};
