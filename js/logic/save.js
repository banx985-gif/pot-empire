// The save system. Runs without Phaser or a browser: give it anything with getItem / setItem /
// removeItem (the phone's localStorage in the game, a simple fake in the tests).
//
// How a save is written, so that a crash at any moment still leaves a good copy:
//   1. write the new save to a temporary slot and read it back to check it
//   2. copy the current good save to the backup slot
//   3. write the new save to the main slot, then clear the temporary slot
//
// How a save is loaded: try main, then temporary, then backup. Each must pass a checksum (a
// fingerprint that detects damaged text). Anything damaged is kept aside, never silently thrown away.
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
    };
    let blocked = false;   // true when the save on this phone is from a newer build than this one

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
        return { state, migratedFrom: env.saveVersion < version ? env.saveVersion : null };
      } catch (e) {
        keepDamagedCopy(raw);
        return { problem: `${slot}: ${e.message}` };
      }
    }

    function load() {
      const problems = [];
      for (const slot of ['main', 'temp', 'backup']) {
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
        return { ok: false, error: e.message };
      }
    }

    return { load, save, isBlocked: () => blocked, KEYS };
  }

  PE.Save = { createSaveSystem, makeEnvelope, readEnvelope, checksum, KEY_PREFIX };
})(globalThis.PE = globalThis.PE || {});
