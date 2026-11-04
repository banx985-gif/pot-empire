// Player XP, Empire Rank and the level ladder. Player level and Empire Rank are the same number:
// the bible's ladder lists the rewards for Rank 1-60 and Rank 61+ carries on with no final rank.
(function (PE) {
  const { Money } = PE;

  PE.Game.register('progress', (g) => {
    const { state, data, B } = g;
    const ladder = new Map(data.ladder.map((r) => [r.level, r]));
    const featureLevel = {};
    data.ladder.forEach((r) => { if (r.feature) featureLevel[r.feature] = r.level; });

    // XP needed to go from level to level + 1. Remembered, so it is only worked out once per level.
    const xpMemo = [0, B.player.xpFirstLevel];
    function xpToNext(level) {
      for (let l = xpMemo.length; l <= level; l++) {
        const band = B.player.xpBands.find((b) => l <= b.upTo);
        xpMemo[l] = xpMemo[l - 1] * band.growth;
      }
      return Math.round(xpMemo[level]);
    }

    function chestCash(level) {
      return Math.round(B.chests.cashBase * Math.pow(B.chests.cashLevelGrowth, level - 1));
    }
    function chestTokens(level) {
      return Math.round(B.chests.collectionTokensBase + B.chests.collectionTokensPerLevel * level);
    }

    function grantLevel(level) {
      const row = ladder.get(level);
      const unlocked = [];
      g.once(`level:${level}`, () => {
        state.player.talentPoints += B.player.talentPointsPerLevel;
        if (row) {
          if (row.kind === 'cashChest') {
            const cash = chestCash(level), tokens = chestTokens(level);
            g.earn('cash', cash, 'chest');
            g.earn('collectionTokens', tokens, 'chest');
            unlocked.push(`Chest: $${Money.format(cash)} and ${tokens} Collection Tokens`);
            if (level >= B.chests.researchTokensFromLevel) {
              g.earn('researchTokens', B.chests.researchTokensPerChest, 'chest');
              unlocked.push(`${B.chests.researchTokensPerChest} Research Tokens`);
            }
            if (g.collections) unlocked.push(...g.collections.chestDrop(`level:${level}`, level));
          } else if (row.kind === 'choiceChest') {
            state.player.pendingChoices.push({ id: `choice:${level}`, level });
            unlocked.push('Milestone choice chest: pick your reward');
          } else if (row.kind === 'unlockFacility') {
            unlocked.push(`${row.text} is now available`);
          } else if (row.text) {
            unlocked.push(row.text);
          }
        } else {
          // Rank 61+: repeatable milestone rewards.
          const m = B.player.rankMilestones.find((x) => level % x.every === 0);
          if (m) {
            g.earn('cash', chestCash(level) * m.cashLevels, 'rank');
            if (m.gems) g.earn('rainbowGems', m.gems, 'rank');
            g.earn('researchTokens', m.researchTokens, 'rank');
            unlocked.push(`Rank ${level} milestone reward`);
          }
          if (B.player.titleRanks.includes(level)) {
            state.player.titles.push(`Rank ${level} Tycoon`);
            unlocked.push(`Title: Rank ${level} Tycoon`);
          }
        }
      });
      return unlocked;
    }

    g.progress = {
      level: () => state.player.level,
      xpToNext,
      chestCash,
      chestTokens,
      featureLevel: (name) => featureLevel[name],
      hasFeature: (name) => state.player.level >= (featureLevel[name] ?? Infinity),

      addXp(amount) {
        if (!(amount > 0)) return;
        let xp = Money.toBig(state.player.xp) + Money.toBig(amount);
        let gained = false;
        for (;;) {
          const need = BigInt(xpToNext(state.player.level));
          if (xp < need) break;
          xp -= need;
          state.player.level += 1;
          gained = true;
          const rewards = grantLevel(state.player.level);
          g.emit('levelUp', { level: state.player.level, rewards, text: (ladder.get(state.player.level) || {}).text });
        }
        state.player.xp = xp.toString();
        if (gained) g.effects.invalidate();
      },

      // The three options of a milestone choice chest.
      choiceOptions(level) {
        const cash = chestCash(level) * B.chests.milestoneCashMult;
        const tokens = chestTokens(level) * B.chests.milestoneTokenMult;
        const out = [
          { id: 'cash', text: `$${Money.format(cash)} cash` },
          { id: 'tokens', text: `${tokens} Collection Tokens` },
        ];
        if (g.collections) out.push({ id: 'card', text: 'A random manager card' });
        else out.push({ id: 'talent', text: '+1 Talent Point' });
        return out;
      },
      claimChoice(choiceId, optionId) {
        const list = state.player.pendingChoices;
        const i = list.findIndex((c) => c.id === choiceId);
        if (i < 0) return false;
        const { level } = list[i];
        return g.once(choiceId, () => {
          list.splice(i, 1);
          if (optionId === 'cash') g.earn('cash', chestCash(level) * B.chests.milestoneCashMult, 'chest');
          else if (optionId === 'tokens') g.earn('collectionTokens', chestTokens(level) * B.chests.milestoneTokenMult, 'chest');
          else if (optionId === 'card' && g.collections) g.collections.grantRandomManager(choiceId, level);
          else state.player.talentPoints += 1;
          g.emit('changed');
        });
      },

      // ---- Talent points --------------------------------------------------------------------
      buyTalent(id) {
        const row = B.talents.rows.find((t) => t.id === id);
        if (!row) return false;
        const rank = state.player.talents[id] || 0;
        if (rank >= row.maxRanks || state.player.talentPoints < 1) return false;
        state.player.talentPoints -= 1;
        state.player.talents[id] = rank + 1;
        g.effects.invalidate();
        g.emit('changed');
        return true;
      },
    };

    g.effects.addProvider(() => B.talents.rows
      .filter((t) => state.player.talents[t.id])
      .map((t) => ({ key: t.effectKey, value: t.perRank * state.player.talents[t.id], group: `talent:${t.id}` })));
  });
})(globalThis.PE = globalThis.PE || {});
