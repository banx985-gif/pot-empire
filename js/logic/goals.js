// The one line of guidance under the top bar: what's the most useful thing to do next?
(function (PE) {
  function current(g) {
    const { state } = g;
    const pots = [];
    g.grow.eachStation((fid, si, st) => st.pots.forEach((p) => pots.push(p)));
    const now = g.now();
    if (state.stats.harvests === 0) {
      if (!pots.some(Boolean)) return 'Tap an empty pot to plant your first seed';
      if (pots.some((p) => p && now >= p.readyMs)) return 'Your plant is ready. Tap it to harvest!';
      return 'Your plant is growing. Fill the other pots too!';
    }
    if (pots.some((p) => !p)) return 'Plant the empty pots to earn more';
    if (g.meta && g.meta.pinnedGoal) { const t = g.meta.pinnedGoal(); if (t) return t; }
    const lvl = state.player.level;
    const next = g.data.ladder.find((r) => r.level > lvl && r.kind !== 'cashChest');
    if (next) return `Level ${next.level}: ${next.kind === 'choiceChest' ? 'Milestone chest' : next.text}`;
    return 'Keep growing your empire';
  }
  PE.Goals = { current };
})(globalThis.PE = globalThis.PE || {});
