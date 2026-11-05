// The login calendar screen (job 5, Stage 6). The rules are in js/logic/calendar.js.
(function (PE) {
  const { esc } = PE.Dom;
  const { Money } = PE;
  const g = () => PE.App.g;

  // An icon for the main thing in a day's reward, and the words for it.
  function icon(r) {
    if (r.manager) return '🧑‍🌾';
    if (r.decoration) return '🪩';
    if (r.chest) return '🎁';
    if (r.gems) return '💎';
    if (r.researchTokens) return '🔬';
    if (r.festivalTickets) return '🎟️';
    if (r.collectionTokens) return '🃏';
    return '💵';
  }
  function words(r) {
    const bits = [];
    if (r.manager) bits.push(`a ${r.manager} or better manager card`);
    if (r.decoration) bits.push('a decoration');
    if (r.chest) bits.push(`a chest with ${r.chest} cards`);
    if (r.cashHarvests) bits.push(`${r.cashHarvests} harvests of cash`);
    if (r.collectionTokens) bits.push(`${r.collectionTokens} Collection Tokens`);
    if (r.researchTokens) bits.push(`${r.researchTokens} Research Token${r.researchTokens > 1 ? 's' : ''}`);
    if (r.festivalTickets) bits.push(`${r.festivalTickets} Festival Tickets`);
    if (r.gems) bits.push(`${r.gems} Rainbow Gems`);
    if (r.title) bits.push(`the title "${r.title}"`);
    return bits.join(' + ');
  }

  PE.Panels.calendar = {
    title: () => g().calendar.name(),
    sheet: true,
    render() {
      const C = g().calendar;
      const rows = C.rows();
      const next = rows.find((d) => d.next);
      const can = C.canClaim();
      const grid = rows.map((d) => `<div class="cal-day ${d.day % 7 === 0 ? 'big' : ''} ${d.day === rows.length ? 'best' : ''} ${d.claimed ? 'claimed' : ''} ${d.next && can ? 'next' : ''}"><small>${d.day}</small>${icon(d.reward)}</div>`).join('');
      return `<div class="cal-today"><span class="ico">${icon(next.reward)}</span><div class="grow"><b>Day ${next.day} of ${rows.length}${C.round() > 1 ? ` · Calendar ${Money.format(C.round())}` : ''}</b><small style="display:block">${esc(words(next.reward))}</small></div></div>
        <button class="btn wide ${can ? 'go' : 'plain'}" data-act="claim">${can ? `Claim day ${next.day}` : 'Come back tomorrow for this one'}</button>
        <div class="cal-grid">${grid}</div>
        <p class="muted center">One reward a day you log in. Missing days never resets it: your place just waits for you.</p>`;
    },
    actions: {
      claim() {
        const r = g().calendar.claim();
        if (!r.ok) { PE.Dom.toast('Already claimed today. See you tomorrow!'); return; }
        if (r.text) PE.Dom.toast(`Day ${r.day}: ${r.text}`, 'big');
        PE.App.saveGame();
      },
    },
  };
})(globalThis.PE = globalThis.PE || {});
