// The game's diary: the last 200 lines of what it said, and every unexpected error, so a tester can send them in.
// Loaded before everything else, so an error while the game is starting is caught too. Holds nothing in the save.
(function (PE) {
  const MAX_LINES = 200, MAX_ERRORS = 50;
  const lines = [];
  const errors = [];

  const stamp = () => new Date().toISOString().slice(11, 23);
  function text(v) {
    if (typeof v === 'string') return v;
    if (v instanceof Error) return v.stack || v.message;
    try { return JSON.stringify(v); } catch (e) { return String(v); }
  }

  const Log = {
    add(kind, ...parts) {
      lines.push(`${stamp()} ${kind} ${parts.map(text).join(' ')}`.slice(0, 600));
      if (lines.length > MAX_LINES) lines.shift();
    },
    error(where, ...parts) {
      const line = `${stamp()} ${where}: ${parts.map(text).join(' ')}`.slice(0, 1500);
      errors.push(line);
      if (errors.length > MAX_ERRORS) errors.shift();
      Log.add('ERROR', where, ...parts);
    },
    lines: () => lines.slice(),
    errors: () => errors.slice(),
    // Sets up the listeners. Only in a browser: the tests and the simulators run without one.
    watch(win) {
      const con = win.console;
      for (const k of ['log', 'info', 'warn', 'error']) {
        const real = con[k] && con[k].bind(con);
        if (!real) continue;
        con[k] = (...a) => { if (k === 'error') Log.error('console', ...a); else Log.add(k, ...a); real(...a); };
      }
      // Capture is needed to hear about a picture or script that failed to load: those don't bubble up.
      win.addEventListener('error', (e) => {
        const t = e.target;
        if (t && t !== win && t.tagName) { Log.error('failed to load', t.tagName, t.src || t.href || ''); return; }
        Log.error('error', e.message || 'unknown', e.filename ? `${e.filename}:${e.lineno}:${e.colno}` : '', e.error && e.error.stack ? e.error.stack : '');
      }, true);
      win.addEventListener('unhandledrejection', (e) => Log.error('promise', e.reason));
    },
  };
  PE.Log = Log;
  if (typeof window !== 'undefined' && window.addEventListener) Log.watch(window);
})(globalThis.PE = globalThis.PE || {});
