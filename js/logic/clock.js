// GameClock: the only place the rules ask "what time is it?". Tests can pass in a fake clock.
// All saved times are UTC text, e.g. 2026-11-04T10:15:00.000Z.
(function (PE) {
  function createClock(nowMs) {
    const now = nowMs || (() => Date.now());
    return {
      nowMs: () => now(),
      nowUtc: () => new Date(now()).toISOString(),
    };
  }

  // Seconds from one saved time to another. Never negative, so winding the phone's clock
  // backwards can't produce negative timers. Bad input counts as no time passed.
  function secondsBetween(fromUtc, toUtc) {
    const a = Date.parse(fromUtc), b = Date.parse(toUtc);
    if (!Number.isFinite(a) || !Number.isFinite(b)) return 0;
    return Math.max(0, (b - a) / 1000);
  }

  PE.Clock = { createClock, secondsBetween };
})(globalThis.PE = globalThis.PE || {});
