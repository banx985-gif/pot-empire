// Pop-up conversations and story scenes: two or three characters on a little stage, taking turns. Each scene is a script
// in data (who speaks, the line, which move): data/scenes.js and data/rival_story.js. Text types out while the mouth
// moves, then they settle. Any button skips ahead. With reduced motion everyone stands still and the text just shows.
(function (PE) {
  const calm = () => (PE.App && PE.App.state.settings.reducedMotion);
  const esc = (t) => PE.Dom.esc(t);
  const names = () => Object.fromEntries(PE.Data.helpers.map((h) => [h.id, h.name]));

  // Types a line into an element, and calls done at the end. The whole line is there from the start, so nothing jumps
  // about: the part not typed yet is only hidden.
  function typeOut(el, text, done) {
    if (!el) return;
    if (calm()) { el.textContent = text; if (done) done(); return; }
    el.innerHTML = `<span class="typed"></span><span class="untyped">${esc(text)}</span>`;
    const a = el.firstChild, b = el.lastChild;
    let i = 0;
    const timer = setInterval(() => {
      if (!el.isConnected) { clearInterval(timer); return; }
      i = Math.min(text.length, i + 1);
      a.textContent = text.slice(0, i);
      b.textContent = text.slice(i);
      if (i >= text.length) { clearInterval(timer); if (done) done(); }
    }, 28);
  }

  // Everyone's in the scene from the first line, so they stay in their places and only the speaker changes.
  function cast(lines) {
    const out = [];
    for (const l of lines) {
      if (!out.includes(l.who)) out.push(l.who);
      for (const w of Object.keys(l.react || {})) if (!out.includes(w)) out.push(w);
    }
    return out;
  }
  // Three fit on the stage. With more in the scene: whoever's speaking now, and whoever spoke just before and speaks next.
  function onStage(all, lines, i) {
    if (all.length <= 3) return all;
    const want = [lines[i].who, ...Object.keys(lines[i].react || {}), (lines[i - 1] || {}).who, (lines[i + 1] || {}).who, ...all].filter(Boolean);
    const keep = [...new Set(want)].slice(0, 3);
    return all.filter((w) => keep.includes(w));
  }

  function stageHtml(people, speaker, opts) {
    const size = people.length > 2 ? 104 : 132;
    return `<div class="talk-stage n${people.length}">${people.map((who) => {
      const on = who === speaker ? 'on' : '';
      if (who === 'RIVAL') return `<span class="talk-slot ${on}" data-who="RIVAL"><img class="story-face bobbing" src="assets/characters/${opts.rivalId}.webp" alt="${esc(opts.rivalName)}" draggable="false" onerror="this.style.visibility='hidden'"></span>`;
      return `<span class="talk-slot ${on}" data-who="${who}">${PE.AnimDom.html(who, size, '', opts.hair)}</span>`;
    }).join('')}</div>`;
  }

  // Sets one line going on a stage that's on the page.
  function runLine(root, line, people) {
    const slot = (who) => root.querySelector(`.talk-slot[data-who="${who}"] .anim-box`);
    const move = line.move || 'chat';
    const speaker = slot(line.who);
    const talking = () => move === 'chat' || move === 'talk';
    // At most two moving: the speaker and whoever reacts. Anyone else stands on their first idle frame.
    let reacted = 0;
    for (const who of people) {
      if (who === line.who || who === 'RIVAL') continue;
      const box = slot(who);
      const r = (line.react || {})[who];
      if (r && !reacted) { reacted = 1; PE.AnimDom.play(box, r, { done: () => PE.AnimDom.play(box, 'stand') }); } else PE.AnimDom.play(box, 'stand');
    }
    const text = root.querySelector('.talk-line');
    if (speaker) PE.AnimDom.play(speaker, move, talking() ? {} : { done: () => { if (speaker.isConnected) PE.AnimDom.play(speaker, 'chat'); } });
    typeOut(text, line.text, () => { if (speaker) { speaker._want = 'settled'; PE.AnimDom.settle(speaker); } });
  }

  const Talk = {
    // A scene in the middle of the screen, one line at a time. opts: title, lines, cls, rivalId, rivalName, onDone
    play(opts) {
      const { lines } = opts;
      if (!lines || !lines.length) { if (opts.onDone) opts.onDone(); return; }
      const all = cast(lines);
      const who = names();
      const step = (i) => {
        const line = lines[i];
        const people = onStage(all, lines, i);
        const last = i === lines.length - 1;
        const name = line.who === 'RIVAL' ? opts.rivalName : who[line.who];
        PE.Dom.modal({
          title: opts.title,
          cls: `talk-scene ${opts.cls || ''}`,
          html: `${stageHtml(people, line.who, opts)}<div class="talk-bubble-line"><b>${esc(name)}</b><p class="talk-line">${esc(line.text)}</p></div>`,
          buttons: last ? [{ label: 'Done', style: 'go', onTap: opts.onDone }] : [{ label: 'Skip', style: 'plain', onTap: opts.onDone }, { label: 'Next', style: 'go', onTap: () => step(i + 1) }],
        });
        // The pop-up may be waiting behind another one, so start the moment it's the one showing.
        const root = document.querySelector('#modal .card.talk-scene');
        if (root) runLine(root, line, people);
      };
      step(0);
    },
    // A one-line talker for inside another pop-up (the welcome back): call start() right after the pop-up opens.
    // hair 'messy': he's been working hard or just woke up.
    inlineHtml(lines, hair) {
      const people = cast(lines).slice(0, 3);
      return `<div class="talk-inline">${stageHtml(people, lines[0].who, { hair })}<div class="talk-bubble-line"><b>${esc(names()[lines[0].who])}</b><p class="talk-line">${esc(lines[0].text)}</p></div></div>`;
    },
    startInline(lines) {
      const root = document.querySelector('#modal .talk-inline');
      if (root) runLine(root, lines[0], cast(lines).slice(0, 3));
    },
    typeOut,
    cast,
    onStage,
  };
  PE.Talk = Talk;
})(globalThis.PE = globalThis.PE || {});
