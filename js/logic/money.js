// Money: saved as text, worked out with BigInt (whole numbers of any size), so very large amounts
// never overflow or lose accuracy. Prices and rewards come in as ordinary numbers and are rounded.
(function (PE) {
  const toBig = (v) => {
    if (typeof v === 'bigint') return v;
    if (typeof v === 'string') return BigInt(v);
    if (!Number.isFinite(v)) return v > 0 ? BigInt(Number.MAX_SAFE_INTEGER) ** 20n : 0n;
    return BigInt(Math.round(v));
  };
  const add = (a, b) => (toBig(a) + toBig(b)).toString();
  const sub = (a, b) => (toBig(a) - toBig(b)).toString();
  const gte = (a, b) => toBig(a) >= toBig(b);
  const toNumber = (v) => Number(toBig(v));

  // The short names players know from idle games: thousand, million, billion, trillion, quadrillion, quintillion,
  // sextillion, septillion, octillion, nonillion, decillion, then undecillion (UDc) up to vigintillion (Vg, 10^63).
  // Past that it's the power of ten: "1.23e66". (The old "aa, ab ... ai" letters read like a broken number: "$89.9ai".)
  // Octillion and nonillion are "Oct" and "Non": "Oc" read like a zero in the game's font ("$999Oc" looked like "$9990c").
  const SUFFIX = ['', 'K', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx', 'Sp', 'Oct', 'Non', 'Dc',
    'UDc', 'DDc', 'TDc', 'QaDc', 'QiDc', 'SxDc', 'SpDc', 'OctDc', 'NonDc', 'Vg'];

  // 1234 -> "1.23K", 1500000 -> "1.50M", 10^40 -> "10.0Dc"... always three figures, any size.
  function format(v) {
    const big = toBig(v);
    const neg = big < 0n;
    const digits = (neg ? -big : big).toString();
    if (digits.length <= 3) return (neg ? '-' : '') + digits;
    const group = Math.floor((digits.length - 1) / 3);
    if (group >= SUFFIX.length) {
      // Scientific: 1.23e66. Cut, not rounded, the same as the short names (never shows more than you have).
      const exp = digits.length - 1;
      return (neg ? '-' : '') + digits[0] + '.' + digits.slice(1, 3) + 'e' + exp;
    }
    const head = digits.length - group * 3;
    const lead = digits.slice(0, head);
    const tail = digits.slice(head, head + (3 - head));
    return (neg ? '-' : '') + lead + (tail ? '.' + tail : '') + SUFFIX[group];
  }

  // Back from the short form to a rough number (used by the tests to prove every size reads right).
  function parseShort(text) {
    const m = String(text).match(/^(-?)(\d+(?:\.\d+)?)(?:e(\d+)|([A-Za-z]*))$/);
    if (!m) return NaN;
    const n = Number(m[2]) * (m[3] ? 10 ** (Number(m[3])) : 1000 ** SUFFIX.indexOf(m[4] || ''));
    return m[4] && SUFFIX.indexOf(m[4]) < 0 ? NaN : (m[1] ? -n : n);
  }

  PE.Money = { toBig, add, sub, gte, toNumber, format, parseShort, SUFFIX };
})(globalThis.PE = globalThis.PE || {});
