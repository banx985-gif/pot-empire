// Smooth art (job 18). Aaron's pictures are drawn much smaller on a phone than their own size: a pot 3 to 12 times, a
// plant up to 24 times when pulled right out. Shrinking that much in one step makes edges crunchy and fine lines
// shimmer (the "16-bit" look). Graphics cards fix this with mipmaps: ready-made half, quarter, eighth... sized copies
// of each picture, blended between as it shrinks. The old graphics mode (WebGL 1) only makes them for pictures whose
// sides are 256, 512, 1024 and so on, and almost none of ours are. WebGL 2, which phones have had for years, makes
// them for any size, so the game starts on WebGL 2 when it can and makes the copies for each picture as it arrives.
//   PE.Smooth.context()     a WebGL 2 canvas and context for Phaser, or null (then Phaser starts as before)
//   PE.Smooth.attach(game)  from then on, every picture added gets its in-between sizes
(function (PE) {
  let made = 0;

  function context() {
    try {
      const canvas = document.createElement('canvas');
      // The same settings Phaser asks for by itself.
      const gl = canvas.getContext('webgl2', { alpha: false, depth: true, antialias: true, premultipliedAlpha: true, stencil: true, preserveDrawingBuffer: false, powerPreference: 'default', desynchronized: false });
      return gl ? { canvas, gl } : null;
    } catch (e) { return null; }
  }

  // Only pictures loaded from files: they're sent to the graphics card once and never change. (Text and drawn
  // shapes are redrawn, and would lose their copies.)
  const isPicture = (src) => (typeof HTMLImageElement !== 'undefined' && src instanceof HTMLImageElement) || (typeof ImageBitmap !== 'undefined' && src instanceof ImageBitmap);

  function smooth(game, texture) {
    const r = game.renderer;
    const gl = r && r.gl;
    if (!gl || typeof WebGL2RenderingContext === 'undefined' || !(gl instanceof WebGL2RenderingContext)) return;
    for (const src of texture.source || []) {
      const wrap = src.glTexture;
      if (!wrap || !wrap.webGLTexture || !isPicture(src.image) || wrap.smooth) continue;
      gl.activeTexture(gl.TEXTURE0);
      const was = gl.getParameter(gl.TEXTURE_BINDING_2D);
      gl.bindTexture(gl.TEXTURE_2D, wrap.webGLTexture);
      gl.generateMipmap(gl.TEXTURE_2D);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
      // A sharper choice of copy at a slant isn't needed: the game is flat, seen straight on.
      gl.bindTexture(gl.TEXTURE_2D, was);
      // Phaser's own note of the filter stays plain LINEAR, so if the phone ever has to rebuild the picture (rare: the
      // graphics card was reset), it comes back plain rather than blank.
      wrap.smooth = true;
      made++;
    }
  }

  function attach(game) {
    const all = () => { for (const key of game.textures.getTextureKeys()) smooth(game, game.textures.get(key)); };
    game.textures.on('addtexture', (key, texture) => smooth(game, texture));
    game.events.once('ready', all);
  }

  PE.Smooth = { context, attach, count: () => made, isWebGL2: (game) => !!(game.renderer && game.renderer.gl && typeof WebGL2RenderingContext !== 'undefined' && game.renderer.gl instanceof WebGL2RenderingContext) };
})(globalThis.PE = globalThis.PE || {});
