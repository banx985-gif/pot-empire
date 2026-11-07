// The save system. Runs without Phaser or a browser: give it anything with getItem / setItem /
// removeItem (the phone's localStorage in the game, a simple fake in the tests).
//
// How a save is written, so that a crash at any moment still leaves a good copy:
//   1. write the new save to a temporary slot and read it back to check it
//   2. copy the current good save to the backup slot
//   3. write the new save to the main slot, then clear the temporary slot
//
// How a save is loaded: try temporary, then main, then backup. The temporary slot is only ever there if a save didn't finish, and
// what's in it is the newest game. Each must pass a checksum (a fingerprint that detects damaged text), and then a trial run if the
// game gives one: a save with a good fingerprint and wrong insides must not stop the game starting. Anything damaged is kept aside,
// never silently thrown away.
//
// Two copies open at once (two tabs): the newest one opened owns the save. An older copy can't save any more, so it can't write old
// progress over new. It's told, and reopening it makes it the owner.
(function (PE) {
  const FORMAT = 'pot-empire-save';
  // Prefixed because every Banx game on github.io shares one storage area.
  const KEY_PREFIX = 'potEmpire.save.';

  function checksum(text) {
    let h = 0x811c9dc5;
    for (let i = 0; i < text.length; i++) {
      h ^= text.charCodeAt(i);
      h = Math.imul(h, 0x01000193);
    }
    return (h >>> 0).toString(16);
  }

  function makeEnvelope(saveVersion, state, savedAtUtc) {
    const data = JSON.stringify(state);
    return JSON.stringify({ format: FORMAT, saveVersion, savedAtUtc, checksum: checksum(data), data });
  }

  // Returns { envelope } if the text is an undamaged save, or { error }.
  function readEnvelope(raw) {
    if (raw === null || raw === undefined) return { missing: true };
    let env;
    try { env = JSON.parse(raw); } catch (e) { return { error: 'not readable' }; }
    if (!env || env.format !== FORMAT) return { error: 'not a Pot Empire save' };
    if (!Number.isInteger(env.saveVersion) || env.saveVersion < 1) return { error: 'bad version number' };
    if (typeof env.data !== 'string' || checksum(env.data) !== env.checksum) return { error: 'checksum failed' };
    return { envelope: env };
  }

  function migrate(state, fromVersion, toVersion, migrations) {
    let current = state;
    for (let v = fromVersion; v < toVersion; v++) {
      if (typeof migrations[v] !== 'function') throw new Error(`no upgrade step from version ${v}`);
      current = migrations[v](current);
    }
    return current;
  }

  function createSaveSystem(options) {
    const storage = options.storage;
    const clock = options.clock;
    const schema = options.schema || PE.SaveSchema;
    const balanceVersion = options.balanceVersion || 1;
    const version = options.currentVersion || schema.CURRENT_VERSION;
    const migrations = options.migrations || schema.MIGRATIONS;
    const KEYS = {
      main: KEY_PREFIX + 'main',
      temp: KEY_PREFIX + 'temp',
      backup: KEY_PREFIX + 'backup',
      damaged: KEY_PREFIX + 'damaged',
      owner: KEY_PREFIX + 'owner',
    };
    const copyId = options.copyId || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
    let otherCopy = false;  // true once a newer copy of the game has taken over this save
    const readOwner = () => { try { return storage.getItem(KEYS.owner); } catch (e) { return null; } };
    const takeOwnership = () => { try { storage.setItem(KEYS.owner, copyId); } catch (e) { /* no room: this copy just carries on */ } };
    let blocked = false;   // true when the save on this phone is from a newer build than this one
    let held = false;      // true during the tester's Fast time: nothing it does may be saved

    function keepDamagedCopy(raw) {
      try { storage.setItem(KEYS.damaged, raw); } catch (e) { /* no room: nothing more we can do */ }
    }

    // Try one slot. Returns { state, migratedFrom } or { problem } or { missing } or { tooNew }.
    function tryLoad(slot) {
      let raw;
      try { raw = storage.getItem(KEYS[slot]); } catch (e) { return { problem: `${slot}: storage unavailable` }; }
      const read = readEnvelope(raw);
      if (read.missing) return { missing: true };
      if (read.error) { keepDamagedCopy(raw); return { problem: `${slot}: ${read.error}` }; }
      const env = read.envelope;
      if (env.saveVersion > version) return { tooNew: true, version: env.saveVersion };
      try {
        const old = JSON.parse(env.data);
        const state = migrate(old, env.saveVersion, version, migrations);
        const problems = schema.checkState(state);
        if (problems.length) throw new Error(problems.join(', '));
        if (options.trial) options.trial(JSON.parse(JSON.stringify(state)));
        return { state, migratedFrom: env.saveVersion < version ? env.saveVersion : null };
      } catch (e) {
        keepDamagedCopy(raw);
        return { problem: `${slot}: ${e.message}` };
      }
    }

    function load() {
      const problems = [];
      takeOwnership();
      for (const slot of ['temp', 'main', 'backup']) {
        const res = tryLoad(slot);
        if (res.tooNew) {
          blocked = true;
          return {
            state: schema.createNewState(clock.nowUtc(), balanceVersion), source: 'too-new',
            recovered: false, migratedFrom: null, problems: [`${slot}: saved by a newer build (version ${res.version})`],
          };
        }
        if (res.state) {
          return { state: res.state, source: slot, recovered: problems.length > 0, migratedFrom: res.migratedFrom, problems };
        }
        if (res.problem) problems.push(res.problem);
      }
      return {
        state: schema.createNewState(clock.nowUtc(), balanceVersion), source: 'new',
        recovered: false, lostSave: problems.length > 0, migratedFrom: null, problems,
      };
    }

    function save(state) {
      if (blocked) return { ok: false, error: 'blocked: this phone has a save from a newer build' };
      if (held) return { ok: false, held: true, error: 'held: fast time is on' };
      const owner = readOwner();
      if (owner && owner !== copyId) { otherCopy = true; return { ok: false, otherCopy: true, error: 'the game was opened somewhere else on this phone' }; }
      if (!owner) takeOwnership();
      const nowUtc = clock.nowUtc();
      state.lastSeenUtc = nowUtc;
      const payload = makeEnvelope(version, state, nowUtc);
      try {
        storage.setItem(KEYS.temp, payload);
        if (storage.getItem(KEYS.temp) !== payload) throw new Error('temporary copy did not read back');
        const current = storage.getItem(KEYS.main);
        // Only a good save may become the backup, so a damaged main can't wipe out a good backup.
        if (current !== null && readEnvelope(current).envelope) storage.setItem(KEYS.backup, current);
        storage.setItem(KEYS.main, payload);
        storage.removeItem(KEYS.temp);
        return { ok: true, savedAtUtc: nowUtc };
      } catch (e) {
        // A failure the game lived through (usually no room). The last good save stands, and the half-done copy goes to free up room.
        try { storage.removeItem(KEYS.temp); } catch (e2) { /* nothing more to do */ }
        return { ok: false, error: e.message };
      }
    }

    // Save backup (Settings): the whole save as one piece of text, with its checksum.
    function exportText(state) { return makeEnvelope(version, state, clock.nowUtc()); }
    // Save restore: checks the text exactly like a load (checksum, upgrade, sanity), then makes it the
    // main save. The save it replaces becomes the backup. After this nothing more is saved until the
    // game restarts, so the running game can't write over the restored one.
    function importText(text) {
      const read = readEnvelope(String(text || '').trim());
      if (read.missing || read.error) return { ok: false, why: read.error || 'empty' };
      const env = read.envelope;
      if (env.saveVersion > version) return { ok: false, why: 'from a newer build' };
      try {
        const state = migrate(JSON.parse(env.data), env.saveVersion, version, migrations);
        const problems = schema.checkState(state);
        if (problems.length) return { ok: false, why: problems.join(', ') };
        const current = storage.getItem(KEYS.main);
        if (current !== null && readEnvelope(current).envelope) storage.setItem(KEYS.backup, current);
        storage.setItem(KEYS.main, makeEnvelope(version, state, clock.nowUtc()));
        storage.removeItem(KEYS.temp);   // an old unfinished save mustn't win over the restored game
        blocked = true;
        return { ok: true };
      } catch (e) {
        return { ok: false, why: e.message };
      }
    }

    return { load, save, exportText, importText, isBlocked: () => blocked, isOtherCopy: () => otherCopy, ownedByOther: () => { const o = readOwner(); return !!o && o !== copyId; }, setHold: (v) => { held = !!v; }, KEYS };
  }

  PE.Save = { createSaveSystem, makeEnvelope, readEnvelope, checksum, KEY_PREFIX };
})(globalThis.PE = globalThis.PE || {});
