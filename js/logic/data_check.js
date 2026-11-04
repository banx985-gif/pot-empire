// Checks the data tables are complete and hang together. Runs in the tests and when the game starts.
// Returns a list of problems (empty = all good).
(function (PE) {
  const RARITIES = ['Common', 'Uncommon', 'Rare', 'Epic', 'Legendary', 'Mythic'];

  function range(prefix, n, width) {
    return Array.from({ length: n }, (_, i) => prefix + String(i + 1).padStart(width, '0'));
  }

  function checkIds(problems, label, rows, expected) {
    if (!Array.isArray(rows)) { problems.push(`${label}: table missing`); return; }
    const got = rows.map((r) => r.id);
    if (got.join() !== expected.join()) problems.push(`${label}: ids are not exactly ${expected[0]} to ${expected[expected.length - 1]}`);
    rows.forEach((r) => { if (!r.name) problems.push(`${label}: ${r.id} has no name`); });
  }

  function checkData(d) {
    const problems = [];
    checkIds(problems, 'strains', d.strains, range('STR-', 60, 3));
    checkIds(problems, 'managers', d.managers, range('M', 60, 2));
    checkIds(problems, 'rivals', d.rivals, range('RIVAL-', 12, 2));
    checkIds(problems, 'vips', d.vips, range('VIP-', 12, 2));
    checkIds(problems, 'helpers', d.helpers, ['HAZE', 'BUDZ', 'LEAFY']);

    (d.strains || []).forEach((s, i) => {
      if (s.rarity !== RARITIES[Math.floor(i / 10)]) problems.push(`strains: ${s.id} rarity is ${s.rarity}`);
      const sheet = d.strainFrames && d.strainFrames.sheets[s.id];
      if (!sheet || sheet.frames.length !== 6) problems.push(`strain frames: ${s.id} doesn't have six frames`);
    });

    if (d.collectibles) {
      const c = d.collectibles;
      checkIds(problems, 'relics', c.relics, range('R', 48, 2));
      checkIds(problems, 'stickers', c.stickers, range('B', 48, 2));
      checkIds(problems, 'vehicles', c.vehicles, range('V', 24, 2));
      checkIds(problems, 'products', c.products, range('P', 36, 2));
      checkIds(problems, 'packaging', c.packaging, range('K', 30, 2));
      checkIds(problems, 'decorations', c.decorations, range('D', 72, 2));
      checkIds(problems, 'avatars', c.avatars, range('AV-', 60, 3));
    }

    if (!d.balance) problems.push('balance table missing');
    else {
      if (d.balance.status !== 'provisional') problems.push('balance table must be marked provisional until the simulator passes');
      if (!Number.isInteger(d.balance.tableVersion)) problems.push('balance table has no version');
    }
    if (!d.assetRegistry) problems.push('asset registry missing');
    return problems;
  }

  PE.DataCheck = { checkData, RARITIES };
})(globalThis.PE = globalThis.PE || {});
