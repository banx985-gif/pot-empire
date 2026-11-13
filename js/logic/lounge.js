// The gaming lounge (job 26): which grow room has one, with which TV and seat. The numbers are in data/lounge.js; where
// it stands in the room and the helpers playing are in js/ui/lounge.js.
// Saved in state.lounge.rooms: { F01: { tv: 'TV-1', seat: 'SOFA' } }.
(function (PE) {
  PE.Game.register('lounge', (g) => {
    const { state } = g;
    const D = () => PE.Data.lounge;
    const s = () => { if (!state.lounge) state.lounge = { rooms: {} }; return state.lounge; };
    const tv = (id) => D().tvs.find((t) => t.id === id) || null;
    const seat = (id) => D().seats.find((t) => t.id === id) || null;
    // Only 'free' ones for now; test: true is the secret switch that places anything.
    const canUse = (row, test) => !!row && (test || row.unlock === 'free');

    g.lounge = {
      tv, seat,
      tvs: () => D().tvs,
      seats: () => D().seats,
      in: (fid) => s().rooms[fid] || null,
      rooms: () => Object.keys(s().rooms),
      // Puts a lounge in a grow room (or changes its TV or seat). The room itself says whether it fits (js/ui/lounge.js).
      place(fid, tvId, seatId, opts = {}) {
        const row = g.facilities.row(fid);
        if (!row || row.mode !== 'Grow' || !g.facilities.isOwned(fid)) return { ok: false, why: 'room' };
        const t = tv(tvId), st = seat(seatId);
        if (!canUse(t, opts.test) || !canUse(st, opts.test)) return { ok: false, why: 'locked' };
        s().rooms[fid] = { tv: t.id, seat: st.id };
        g.emit('lounge', { fid });
        g.emit('changed');
        return { ok: true };
      },
      remove(fid) {
        if (!s().rooms[fid]) return false;
        delete s().rooms[fid];
        g.emit('lounge', { fid });
        g.emit('changed');
        return true;
      },
    };
  });
})(globalThis.PE = globalThis.PE || {});
