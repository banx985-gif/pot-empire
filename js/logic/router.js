// UI Router: keeps track of which screen is showing and the way back. It knows nothing about
// Phaser. The Phaser side listens with onChange and shows the matching screen.
(function (PE) {
  function createRouter(routeNames) {
    const known = new Set(routeNames);
    const stack = [];
    const listeners = [];

    function emit(reason) {
      const top = stack[stack.length - 1] || null;
      listeners.forEach((fn) => fn(top, reason));
    }
    function check(name) {
      if (!known.has(name)) throw new Error(`Unknown screen: ${name}`);
    }

    return {
      go(name, params = {}) { check(name); stack.push({ name, params }); emit('go'); },
      replace(name, params = {}) { check(name); stack.pop(); stack.push({ name, params }); emit('replace'); },
      // Goes back one screen. Returns false if already on the first screen.
      back() {
        if (stack.length <= 1) return false;
        stack.pop();
        emit('back');
        return true;
      },
      current: () => stack[stack.length - 1] || null,
      depth: () => stack.length,
      onChange(fn) { listeners.push(fn); },
    };
  }

  PE.Router = { createRouter };
})(globalThis.PE = globalThis.PE || {});
