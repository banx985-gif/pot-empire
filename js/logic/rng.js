// Repeatable dice. A roll depends only on the text it is given, so the same roll can never come
// out differently after reopening the game, and tests can check results exactly.
(function (PE) {
  function hash32(text) {
    let h = 0x811c9dc5;
    for (let i = 0; i < text.length; i++) {
      h ^= text.charCodeAt(i);
      h = Math.imul(h, 0x01000193);
    }
    // Extra mixing, because similar texts ("x:1", "x:2") must give unrelated rolls.
    h ^= h >>> 16; h = Math.imul(h, 0x85ebca6b);
    h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35);
    h ^= h >>> 16;
    return h >>> 0;
  }
  // A number from 0 up to (not including) 1.
  const roll = (text) => hash32(text) / 4294967296;
  // Pick an index given chances that add up to 1.
  function pick(chances, r) {
    let sum = 0;
    for (let i = 0; i < chances.length; i++) {
      sum += chances[i];
      if (r < sum) return i;
    }
    return chances.length - 1;
  }
  PE.Rng = { hash32, roll, pick };
})(globalThis.PE = globalThis.PE || {});
