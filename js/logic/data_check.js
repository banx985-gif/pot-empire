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

    // Helper jokes: each one has a stable unique id, a real helper and a known event.
    if (d.jokes) {
      const EVENTS = ['firstHarvest', 'automation', 'rareFind', 'bigUpgrade', 'facility', 'prestige', 'idleReturn', 'rank', 'setComplete', 'rival'];
      const seen = new Set();
      d.jokes.forEach((j) => {
        if (seen.has(j.id)) problems.push(`jokes: ${j.id} used twice`);
        seen.add(j.id);
        if (!['HAZE', 'BUDZ', 'LEAFY'].includes(j.helper)) problems.push(`jokes: ${j.id} has an unknown helper`);
        if (!EVENTS.includes(j.event)) problems.push(`jokes: ${j.id} has an unknown event`);
        if (!j.text || j.text.length > 160) problems.push(`jokes: ${j.id} is empty or too long`);
      });
      EVENTS.forEach((e) => { if (!d.jokes.some((j) => j.event === e)) problems.push(`jokes: none for ${e}`); });
    }

    // Helper pictures: every id used anywhere must be a real sprite of the right helper.
    if (d.helperSprites) {
      const S = d.helperSprites;
      const real = (id, helper) => {
        const m = /^([A-Z]+)-(\d\d)$/.exec(String(id));
        return !!m && (!helper || m[1] === helper) && S.counts[m[1]] >= Number(m[2]) && Number(m[2]) >= 1;
      };
      const need = (id, helper, where) => { if (!real(id, helper)) problems.push(`helper art: ${where} uses ${id}, which isn't a sprite of ${helper || 'a helper'}`); };
      (d.jokes || []).forEach((j) => { need(j.face, j.helper, j.id); need(j.face2, j.helper, j.id); });
      for (const h of Object.keys(S.counts)) {
        need(S.defaultFace[h], h, 'defaultFace');
        need(S.screens.crew[h], h, 'screens.crew');
        S.blink[h].frames.forEach((id) => need(id, h, 'blink'));
      }
      for (const [kind, list] of Object.entries(S.celebrate)) list.forEach((id) => need(id, null, 'celebrate ' + kind));
      for (const k of ['title', 'howToPlay', 'noLinesYet']) need(S.screens[k], null, 'screens.' + k);
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
