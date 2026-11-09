// One of each character, always (job 19, VEHICLES_ANIM.md). Budz, Uncle Haze, Leafy, DJ Dayglow and Captain Citrus are
// single people: while one is out driving they mustn't also be walking about, and only one of their vehicle is on screen.
// Anything that puts a character or a ridden vehicle on screen asks here first (claim), and lets go when it's gone
// (free). A ridden vehicle claims its rider. No drawing here.
(function (PE) {
  // Who rides what. Vans, trucks and buses with no visible driver are free to go anywhere.
  const RIDER = { V02: 'VIP-02', V03: 'VIP-04', 'VEH-03': 'LEAFY', 'VEH-04': 'HAZE', 'LOAD-02': 'BUDZ', 'VEH-06': 'TERPZ' };
  const held = new Map();   // character -> { owner, how }
  let next = 1;

  const Cast = {
    RIDER,
    riderOf(vehicleId) { return RIDER[vehicleId] || null; },
    // The character this id puts on screen: a rider for a ridden vehicle, the character themself, or null (no driver).
    personOf(id) { return RIDER[id] || (PE.AnimPick && PE.AnimPick.isVehicle(id) ? null : id); },
    // A new owner token, one per thing on screen (a walker, a vehicle). how: 'walk' or 'drive', for the tests.
    token(how) { return { n: next++, how }; },
    // Puts this id on screen for owner. False if that person is already out somewhere else.
    claim(id, owner) {
      const who = Cast.personOf(id);
      if (!who) return true;
      const h = held.get(who);
      if (h && h.owner !== owner) return false;
      held.set(who, { owner, how: owner.how || 'walk', id });
      return true;
    },
    free(id, owner) {
      const who = Cast.personOf(id);
      if (!who) return;
      const h = held.get(who);
      if (h && h.owner === owner) held.delete(who);
    },
    // Lets go of everything one owner holds (a scene closing).
    freeAll(owners) { for (const [who, h] of [...held]) if (owners.has(h.owner)) held.delete(who); },
    isFree(id) { const who = Cast.personOf(id); return !who || !held.has(who); },
    // Who's out and how: { BUDZ: 'walk', 'VIP-02': 'drive' } (the tests read this).
    now() { const out = {}; for (const [who, h] of held) out[who] = h.how; return out; },
    reset() { held.clear(); },
  };
  PE.Cast = Cast;
})(globalThis.PE = globalThis.PE || {});
