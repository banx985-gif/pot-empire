// The big chest reveal (job 5, Stage 4): a glow, cards flipping over, rarity colours, real manager
// portraits. Chests only ever come from playing (bible section 11): the rules send 'chestOpened', this
// draws it. One tap flips them all, the next tap closes it, and it closes by itself after a few seconds.
// Reduced motion: no glow or flipping, the cards are simply there.
(function (PE) {
  const { esc } = PE.Dom;
  const $ = (id) => document.getElementById(id);
  const still = () => PE.App.state.settings.reducedMotion || (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const FLIP_GAP_MS = 320, FIRST_FLIP_MS = 520, STAY_MS = 6000;

  function face(c) {
    const pic = c.category === 'manager'
      ? PE.Dom.portrait(c.id, c.name, 'reveal-pic')
      : `<span class="reveal-ph">${esc(c.id)}</span>`;
    let note = '<em class="new">NEW!</em>';
    if (c.duplicate) {
      note = `<em>+${c.tokens} tokens</em>`;
      if (c.category === 'manager') {
        note += c.leveled
          ? `<em class="up">${PE.Dom.icon('RWD-06', 16)}Level ${c.leveled}!</em>`
          : `<span class="dup-bar" title="Duplicates to next level"><i style="width:${Math.min(100, (c.fragments / c.need) * 100)}%"></i><b>${c.fragments}/${c.need}</b></span>`;
      }
    }
    return `${pic}<b class="reveal-name">${esc(c.name)}</b><small class="r-${c.rarity}">${PE.Dom.rarityIcon(c.rarity)}${esc(c.rarity)}</small>${note}`;
  }

  const Reveal = {
    waiting: [],
    now: null,
    timers: [],
    add(e) {
      if (this.waiting.length >= 3) this.waiting.shift();   // keep the newest
      this.waiting.push(e);
    },
    pump() {
      if (this.now || !this.waiting.length || !PE.App || !PE.App.game) return;
      if (PE.Dom.modalNow || PE.Dom.isTouching() || (PE.HelperUI && PE.HelperUI.now)) return;
      const top = PE.App.router.current();
      if (!top || top.name === 'title') return;
      const e = this.now = this.waiting.shift();
      const calm = still();
      PE.Sound.play('chest');
      const el = $('reveal');
      el.className = calm ? 'still' : '';
      el.innerHTML = `<div class="reveal-box" data-act="tap">
          <div class="reveal-glow"></div>
          ${PE.Dom.icon('RWD-02', 96, 'reveal-chest')}<h3>${esc(e.title || 'Chest opened!')}</h3>
          <div class="reveal-cards n${e.cards.length}">${e.cards.map((c, i) => `<div class="reveal-card rare-${c.rarity} ${calm ? 'flip' : ''}" data-i="${i}"><div class="inner"><div class="back">${PE.Dom.icon('RWD-01', 72)}</div><div class="front">${face(c)}</div></div></div>`).join('')}</div>
          <small class="reveal-skip">Tap to ${calm ? 'close' : 'skip'}</small>
        </div>`;
      el.hidden = false;
      this.flipped = calm;
      if (!calm) {
        e.cards.forEach((_, i) => this.timers.push(setTimeout(() => this.flipOne(i), FIRST_FLIP_MS + i * FLIP_GAP_MS)));
        this.timers.push(setTimeout(() => { this.flipped = true; }, FIRST_FLIP_MS + e.cards.length * FLIP_GAP_MS));
      }
      this.timers.push(setTimeout(() => this.close(), STAY_MS + e.cards.length * FLIP_GAP_MS));
    },
    flipOne(i) {
      const card = document.querySelector(`#reveal .reveal-card[data-i="${i}"]`);
      if (card) {
        card.classList.add('flip');
        PE.Sound.play('reveal');
        if (/rare-(Epic|Legendary|Mythic)/.test(card.className)) PE.Sound.play('rare');
      }
    },
    tap() {
      if (!this.now) return;
      if (this.flipped) { this.close(); return; }
      this.flipped = true;
      document.querySelectorAll('#reveal .reveal-card').forEach((c) => c.classList.add('flip'));
    },
    close() {
      this.timers.forEach(clearTimeout);
      this.timers = [];
      this.now = null;
      const el = $('reveal');
      el.hidden = true;
      el.innerHTML = '';
    },
    init() {
      PE.Dom.attachTaps($('reveal'), () => this.tap());
      setInterval(() => this.pump(), 300);
    },
  };
  PE.ChestReveal = Reveal;
})(globalThis.PE = globalThis.PE || {});
