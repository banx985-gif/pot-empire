// Job 27: drawn signs and words (docs/NEXT_ART_WORDS_SIGNS.md). A screen asks for a sign by its id; if Aaron's drawing of it
// is in the game (data/word_art.js, made by tools/import_word_art.js from art/ui/words/) it shows the picture, otherwise
// the words stay typed exactly as before. So a new sign drops in with no code change.
(function (PE) {
  const W = () => (PE.Data.wordArt || { have: {}, list: [] });
  const src = (id) => `assets/words/${id}.webp`;
  const attr = (s) => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
  const Words = {
    has: (id) => !!W().have[id],
    // A district's banner id: WRD-DIST-OLD-TOWN and so on.
    districtId: (name) => `WRD-DIST-${String(name).toUpperCase().replace(/[^A-Z0-9]+/g, '-')}`,
    src,
    // For a menu: the drawn sign (as an <img>, its words as the alt text), or the typed fallback html.
    html(id, words, fallback, cls = '') {
      if (!Words.has(id)) return fallback;
      return `<img class="word-art ${cls}" data-word="${id}" src="${src(id)}" alt="${attr(words)}" draggable="false">`;
    },
    // Only the drawing (nothing when it isn't drawn), for a spot that has no typed words today.
    extra(id, words, cls = '') { return Words.html(id, words, '', cls); },
    // A message pop-up that leads with the drawn words when they exist (the rest of the message stays typed).
    toast(id, words, text, kind = '', iconId = null) {
      PE.Dom.toast(text, Words.has(id) ? 'big words' : kind, Words.has(id) ? null : iconId);
      const box = document.getElementById('toasts'), t = box && box.lastElementChild;
      if (t && Words.has(id)) t.insertAdjacentHTML('afterbegin', Words.html(id, words, '', 'toast-word'));
    },
    // For the Phaser screens: the sign as a texture ('word-<id>'), fetched once. ready(key) only if it's drawn.
    texture(scene, id, ready) {
      if (!Words.has(id)) return false;
      const key = 'word-' + id;
      if (scene.textures.exists(key)) { ready(key); return true; }
      const img = new Image();
      img.onload = () => {
        if (!scene.sys || scene.sys.settings.status >= Phaser.Scenes.SHUTDOWN) return;
        if (!scene.textures.exists(key)) scene.textures.addImage(key, img);
        ready(key);
      };
      img.src = src(id);
      return true;
    },
    // Swaps a typed Phaser label for the drawn sign, the same height as `height` (world units), in the same spot, with the
    // same origin and depth. done(image) is told the new object (callers that keep the label keep this instead).
    swapLabel(scene, id, label, height, done) {
      return Words.texture(scene, id, (key) => {
        if (!label.scene) return;
        const im = scene.add.image(label.x, label.y, key).setOrigin(label.originX, label.originY).setDepth(label.depth);
        im.setScale(height / im.height);
        im.wordId = id;
        label.destroy();
        if (done) done(im);
      });
    },
  };
  PE.Words = Words;
})(globalThis.PE = globalThis.PE || {});
