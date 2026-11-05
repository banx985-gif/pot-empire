// Player profile and Hall of Fame (bible section 10A).
// Profile: business name, username, avatar, favourite strain, Empire Rank, titles, prestige badges and
// the Hall of Fame strains. Hall of Fame: six fixed slots, each one unique unlocked strain (or empty).
(function (PE) {
  PE.Game.register('profile', (g) => {
    const { state, data, B } = g;
    const P = () => B.profile;
    const prof = () => state.profile;
    const hall = () => state.hallOfFameFeaturedStrainIds;

    // Names are shown as live text, so they're kept plain: no control characters or < >, single
    // spaces, and a length limit.
    function clean(text) {
      return String(text == null ? '' : text).replace(/[\u0000-\u001f\u007f<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, P().nameMaxLength);
    }

    function slots() {
      return hall().map((id, slot) => {
        if (!id) return { slot, strainId: null };
        const s = g.grow.strainStats(id);
        const best = state.stats.bestGrade[id];
        return { slot, strainId: id, name: s.name, rarity: s.rarity, mastery: g.grow.masteryLevel(id), bestGrade: best === undefined ? null : B.quality.grades[best].name };
      });
    }

    g.profile = {
      clean,
      setBusinessName(text) { prof().businessName = clean(text); g.emit('changed'); return prof().businessName; },
      setUsername(text) { prof().username = clean(text); g.emit('changed'); return prof().username; },
      setFavourite(id) {
        if (id !== null && !g.grow.isStrainUnlocked(id)) return false;
        prof().favouriteStrainId = id;
        g.emit('changed');
        return true;
      },
      setTitle(title) {
        if (title !== null && !state.player.titles.includes(title)) return false;
        prof().title = title;
        g.emit('changed');
        return true;
      },
      displayName: () => prof().businessName || 'Your Grow Business',
      badges() {
        return g.facilities.districts.map((d) => ({ id: d.id, name: d.name, count: state.prestigeHistory.filter((h) => h.district === d.id).length })).filter((b) => b.count > 0);
      },

      hallUnlocked: () => g.progress.level() >= P().hallOfFameLevel,
      hallLevel: () => P().hallOfFameLevel,
      hallSlots: slots,
      // Puts a strain in a slot (null empties it). A strain shown in another slot moves here.
      feature(slot, id) {
        slot = Number(slot);
        if (!g.profile.hallUnlocked()) return { ok: false, why: 'level' };
        if (!Number.isInteger(slot) || slot < 0 || slot >= P().hallSlots) return { ok: false, why: 'bad' };
        if (id !== null && !g.grow.isStrainUnlocked(id)) return { ok: false, why: 'locked' };
        const list = hall();
        if (id !== null) { const was = list.indexOf(id); if (was >= 0) list[was] = null; }
        list[slot] = id;
        g.emit('changed');
        return { ok: true };
      },
    };

    // A damaged or old save may have a short, long or repeating list: fix it quietly.
    const fixed = [];
    for (let i = 0; i < P().hallSlots; i++) {
      const id = Array.isArray(hall()) ? hall()[i] : null;
      fixed.push(id && data.strains.some((s) => s.id === id) && !fixed.includes(id) ? id : null);
    }
    state.hallOfFameFeaturedStrainIds = fixed;
  });
})(globalThis.PE = globalThis.PE || {});
