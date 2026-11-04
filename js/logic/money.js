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

  const SUFFIX = ['', 'K', 'M', 'B', 'T'];
  function suffixFor(group) {
    if (group < SUFFIX.length) return SUFFIX[group];
    // After T: aa, ab, ac ... zz (idle-game style), then just the power of ten.
    const n = group - SUFFIX.length;
    if (n >= 676) return `e${group * 3}`;
    return String.fromCharCode(97 + Math.floor(n / 26)) + String.fromCharCode(97 + (n % 26));
  }

  // 1234 -> "1.23K", 1500000 -> "1.50M", any size.
  function format(v) {
    const big = toBig(v);
    const neg = big < 0n;
    const digits = (neg ? -big : big).toString();
    if (digits.length <= 3) return (neg ? '-' : '') + digits;
    const group = Math.floor((digits.length - 1) / 3);
    const head = digits.length - group * 3;
    const lead = digits.slice(0, head);
    const tail = digits.slice(head, head + (3 - head));
    return (neg ? '-' : '') + lead + (tail ? '.' + tail : '') + suffixFor(group);
  }

  PE.Money = { toBig, add, sub, gte, toNumber, format };
})(globalThis.PE = globalThis.PE || {});
