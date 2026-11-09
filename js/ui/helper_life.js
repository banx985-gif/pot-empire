// Haze, Budz and Leafy going about their day on the map and inside the rooms: they walk, stop, idle, chat when they
// meet, nap, and react to what happens nearby. Tap one for a tip or a joke.
//
// A screen gives this a "world": where they can stand and which way they can walk. All the wording is in data/scenes.js
// and all the moves in data/anim_moves.js. Kept light: at most two helpers on a screen, off-screen ones are paused, and
// with reduced motion they stand still (and can still be tapped).
(function (PE) {
  const calm = () => (PE.App && PE.App.state.settings.reducedMotion);
  const FONT = 'system-ui, sans-serif';
  const pick = (list) => list[Math.floor(Math.random() * list.length)];
  const rand = (a, b) => a + Math.random() * (b - a);

  // All the times, in seconds. Easy to tune.
  const T = {
    idle: [2.5, 6],
    meetEvery: [22, 40],      // how often one goes looking for the other
    chatLine: 2.4,            // one small bubble
    chatGap: 45,              // the shortest time between two chats
    reactGap: 7,              // the shortest time between two reactions
    napEvery: [70, 150],      // random naps, not too often
    napFor: [12, 26],
    playerIdle: 45,           // nobody has touched the screen: time for Leafy's nap
    liveEvery: [45, 110],     // a random move (Haze inspects or rolls, Budz daydreams): not too often
    plantEvery: [70, 170],    // Budz wanders over to chat to a plant
    rivalEvery: [120, 260],   // Budz goes and yells at a rival's building, if one's near
    plantChat: 3,
  };

  let lastInput = 0;
  if (typeof window !== 'undefined') window.addEventListener('pointerdown', () => { lastInput = performance.now(); }, { capture: true, passive: true });

  class Life {
    constructor(scene, world) {
      this.scene = scene;
      this.world = world;
      this.list = [];
      this.t = 0;
      this.nextMeet = rand(8, 16);
      this.nextChat = 6;
      this.nextReact = 0;
      this.nextNap = rand(...T.napEvery);
      this.nextLive = rand(...T.liveEvery);
      this.nextPlant = rand(...T.plantEvery);
      this.nextRival = rand(...T.rivalEvery);
      this.live = [];     // which random moves have played (the tests read this)
      this.tiredDone = false;
      this.chatNow = null;
      this.chats = 0;     // how many so far (the tests read this)
      this.reactions = [];
      Life.turn = (Life.turn || 0) + 1;
      if (!PE.App.state.settings.helpers) return;
      // Uncle Haze and one other: two per screen at most, and they take turns.
      const other = Life.turn % 2 ? 'BUDZ' : 'LEAFY';
      // One of each (job 19): a helper who's out driving their vehicle somewhere doesn't also walk about here.
      for (const id of world.ids || ['HAZE', other]) if (!PE.Cast || PE.Cast.isFree(id)) this.add(id);
    }
    add(id) {
      const i = this.list.length;
      const at = this.world.start(i, id);
      const actor = new PE.Anim.Actor(this.scene, id, { x: at.x, y: at.y, height: this.world.height, depth: this.world.depth });
      const e = { id, actor, at: { x: at.x, y: at.y }, image: actor.image, state: 'idle', wait: rand(...T.idle), node: at.node, path: null, bubble: null, napLeft: 0 };
      this.list.push(e);
      actor.play('idle');
      return e;
    }
    frozen() { return calm() || window.__frozenHelpers; }

    // ---- Every frame ---------------------------------------------------------------------------------------------
    update(dt) {
      if (!this.list.length) return;
      this.t += dt;
      for (const e of this.list) {
        e.at.x = e.actor.x; e.at.y = e.actor.y;
        this.keepBubble(e, dt);
      }
      if (this.frozen()) return;
      if (this.chatNow) this.stepChat(dt);
      for (const e of this.list) this.stepOne(e, dt);
      this.maybeMeet();
      this.maybeNap();
      this.maybeLive();
      this.maybeBudz();
    }
    stepOne(e, dt) {
      // Off-screen: paused where they are.
      if (e.actor.paused) return;
      if (e.state === 'idle') {
        e.wait -= dt;
        if (e.wait <= 0) this.afterIdle(e);
      } else if (e.state === 'walk') this.stepWalk(e, dt);
      else if (e.state === 'nap') {
        e.napLeft -= dt;
        this.zzz(e, dt);
        if (e.napLeft <= 0) this.wake(e);
      } else if (e.state === 'busy') {
        e.busyLeft -= dt;
        if (e.busyLeft <= 0) { const go = e.busyDone; e.busyDone = null; e.state = 'react'; go(); }
      }
    }
    afterIdle(e) {
      if (Math.random() < 0.22) {
        e.state = 'react';
        e.actor.play('look', { done: () => this.backToIdle(e) });
        return;
      }
      this.walk(e);
    }
    walk(e, toward) {
      const way = this.world.path(e, toward);
      if (!way || way.length < 2) { this.backToIdle(e); return; }
      e.path = { pts: way, i: 0, left: 0 };
      e.state = 'walk';
      e.actor.walkRoll = Math.random();
      e.actor.heading(way[1][0] - way[0][0], way[1][1] - way[0][1]);
    }
    stepWalk(e, dt) {
      const P = e.path;
      let go = this.world.speed * dt;
      // The last stretch up to a plant is behind it; the first stretch back is too.
      if (P.depths && P.depths[P.i] !== undefined) e.actor.setBehind(P.depths[P.i]);
      while (go > 0 && P.i < P.pts.length - 1) {
        const [ax, ay] = P.pts[P.i], [bx, by] = P.pts[P.i + 1];
        const len = Math.hypot(bx - ax, by - ay) || 1;
        const room = len - P.left;
        if (go < room) {
          P.left += go; go = 0;
          const k = P.left / len;
          e.actor.moveTo(ax + (bx - ax) * k, ay + (by - ay) * k);
          e.actor.heading(bx - ax, by - ay);
        } else { go -= room; P.left = 0; P.i++; }
      }
      if (P.i >= P.pts.length - 1) {
        const [x, y] = P.pts[P.pts.length - 1];
        e.actor.moveTo(x, y);
        e.path = null;
        if (e.arrive) { const go = e.arrive; e.arrive = null; go(); return; }
        this.backToIdle(e);
      }
    }
    backToIdle(e) {
      if (e.state === 'chat') return;
      e.arrive = null;
      e.busyDone = null;
      e.actor.setBehind(null);
      e.state = 'idle';
      e.wait = rand(...T.idle);
      e.actor.play('idle');
    }

    // ---- Meeting and chatting ----------------------------------------------------------------------------------------
    maybeMeet() {
      if (this.list.length < 2 || this.chatNow || this.t < this.nextChat) return;
      const [a, b] = this.list;
      const free = (e) => (e.state === 'idle' || e.state === 'walk') && !e.actor.paused;
      if (!free(a) || !free(b)) return;
      const gap = Math.hypot(a.actor.x - b.actor.x, a.actor.y - b.actor.y);
      if (gap < this.world.near) { this.startChat(a, b); return; }
      if (this.t > this.nextMeet) {
        this.nextMeet = this.t + rand(...T.meetEvery);
        this.walk(a, { x: b.actor.x + this.world.near * 0.5, y: b.actor.y, node: b.node });
      }
    }
    startChat(a, b) {
      const lines = PE.Data.scenes.smallTalk.filter((l) => l[a.id] && l[b.id]);
      const fallback = { [a.id]: pick(['Hey.', 'All good?']), [b.id]: pick(['Hey.', 'All good.']) };
      const line = lines.length ? pick(lines) : fallback;
      this.chats += 1;
      this.nextChat = this.t + T.chatGap;
      for (const e of [a, b]) { e.state = 'chat'; e.path = null; }
      a.actor.image.setFlipX(b.actor.x > a.actor.x);
      b.actor.image.setFlipX(a.actor.x > b.actor.x);
      this.chatNow = { a, b, line, turn: 0, left: 0 };
      this.nextTurn();
    }
    nextTurn() {
      const C = this.chatNow;
      if (!C) return;
      const order = Object.keys(C.line)[0] === C.b.id ? [C.b, C.a] : [C.a, C.b];
      if (C.turn >= 2) { this.endChat(); return; }
      const speaker = order[C.turn], other = order[1 - C.turn];
      if (other.bubble) { other.bubble.destroy(); other.bubble = null; }
      speaker.actor.play('chat', { flip: speaker.actor.image.flipX });
      other.actor.play('idle', { flip: other.actor.image.flipX });
      this.say(speaker, C.line[speaker.id], T.chatLine);
      C.left = T.chatLine;
      C.turn += 1;
    }
    stepChat(dt) {
      const C = this.chatNow;
      C.left -= dt;
      if (C.left <= 0) this.nextTurn();
    }
    endChat() {
      const { a, b } = this.chatNow;
      this.chatNow = null;
      for (const e of [a, b]) {
        if (e.bubble) { e.bubble.destroy(); e.bubble = null; }
        e.state = 'react';
        this.backToIdle(e);
        e.wait = rand(0.4, 2);
      }
    }

    // ---- Naps ------------------------------------------------------------------------------------------------------------
    maybeNap() {
      const tired = performance.now() - lastInput > T.playerIdle * 1000;
      if (!tired) this.tiredDone = false;
      const leafy = this.list.find((e) => e.id === 'LEAFY');
      if (tired && !this.tiredDone) {
        this.tiredDone = true;
        if (leafy && leafy.state === 'idle') { this.nap(leafy); return; }
        for (const e of this.list) if (e.state === 'idle') { e.state = 'react'; e.actor.play('sleepy', { done: () => this.backToIdle(e) }); e.wait = 8; }
        return;
      }
      if (this.t > this.nextNap) {
        this.nextNap = this.t + rand(...T.napEvery);
        if (leafy && leafy.state === 'idle') this.nap(leafy);
      }
    }
    nap(e) {
      e.state = 'nap';
      e.napLeft = rand(...T.napFor);
      e.zzzIn = 4;
      e.actor.play('sleepy');
    }
    wake(e) {
      if (e.state !== 'nap') return;
      e.state = 'react';
      e.actor.play('stretch', { done: () => this.backToIdle(e) });
    }
    // A few Zzz drifting up while they're asleep.
    zzz(e, dt) {
      e.zzzIn -= dt;
      if (e.zzzIn > 0 || !e.actor.cur || e.actor.cur.name !== 'asleep') return;
      e.zzzIn = 1.8;
      const k = this.world.textScale();
      const t = this.scene.add.text(e.actor.x + e.actor.height * 0.2, e.actor.y - e.actor.height * 0.35, 'Z', { fontFamily: FONT, fontStyle: 'bold', fontSize: '26px', color: '#ffffff', stroke: '#1d0f33', strokeThickness: 5 }).setOrigin(0.5).setDepth(95000).setScale(k * 0.5);
      this.scene.tweens.add({ targets: t, y: t.y - e.actor.height * 0.3, x: t.x + e.actor.height * 0.08, alpha: 0, duration: 1500, onComplete: () => t.destroy() });
    }

    // ---- Random moves when someone's standing about ------------------------------------------------------------------
    maybeLive() {
      if (this.t < this.nextLive) return;
      this.nextLive = this.t + rand(...T.liveEvery);
      const free = this.list.filter((e) => e.state === 'idle' && !e.actor.paused && (PE.Data.scenes.liveMoves[e.id] || []).length);
      if (free.length) this.liveMove(pick(free));
    }
    // Plays one of this helper's random moves, or a given one.
    liveMove(e, name) {
      const list = PE.Data.scenes.liveMoves[e.id] || [];
      let m = list.find((x) => x.move === name);
      if (!m) {
        let roll = Math.random() * list.reduce((a, x) => a + x.weight, 0);
        m = list.find((x) => (roll -= x.weight) <= 0) || list[0];
      }
      if (!m) return;
      this.live.push(`${e.id}:${m.move}`);
      e.state = 'react';
      e.path = null;
      e.actor.play(m.move, { done: () => { if (m.pop) this.popBubble(e); this.backToIdle(e); } });
    }
    // The thought bubble is part of Budz's frames: when he goes back to idle it bursts, with a quick little shrink.
    popBubble(e) {
      if (calm()) return;
      const h = e.actor.height;
      const c = this.scene.add.circle(e.actor.x + h * 0.42, e.actor.y - h * 1.05, h * 0.3, 0xffffff, 0.85).setDepth(e.actor.image.depth + 1);
      this.scene.tweens.add({ targets: c, scale: 0, alpha: 0, duration: 170, ease: 'Back.easeIn', onComplete: () => c.destroy() });
    }

    // ---- Budz and the plants, Budz and the rivals --------------------------------------------------------------------
    maybeBudz() {
      const e = this.list.find((x) => x.id === 'BUDZ');
      if (!e || e.state !== 'idle' || e.actor.paused) return;
      if (this.world.plantFor && this.t > this.nextPlant) {
        this.nextPlant = this.t + rand(...T.plantEvery);
        this.budzToPlant(e, false);
      } else if (this.world.rivalFor && this.t > this.nextRival) {
        this.nextRival = this.t + rand(...T.rivalEvery);
        this.budzToRival(e);
      }
    }
    // Walks up BEHIND a plant, drawn behind it, and faces the screen over the top of it: his talk frames face front, so
    // it's never from in front. A growing plant gets a kind word, a thirsty one gets told off.
    budzToPlant(e, wilted) {
      const P = this.world.plantFor && this.world.plantFor(e, wilted);
      if (!P) return false;
      const go = this.walkAlong(e, P.way, P.depths);
      if (!go) return false;
      e.arrive = () => {
        e.state = 'react';
        this.plantVisits = (this.plantVisits || 0) + 1;
        const off = () => { const back = this.walkAlong(e, P.way.slice().reverse(), P.backDepths); if (!back) this.backToIdle(e); };
        if (wilted) {
          this.say(e, pick(PE.Data.scenes.budzTellOff), 2.4);
          e.actor.play('angry', { done: off });
        } else {
          this.say(e, pick(PE.Data.scenes.budzPlant), T.plantChat);
          e.actor.play('chat');
          e.state = 'busy';
          e.busyLeft = T.plantChat;
          e.busyDone = off;
        }
      };
      return true;
    }
    // Walks to a rival's building and gives it what for.
    budzToRival(e) {
      const R = this.world.rivalFor && this.world.rivalFor(e);
      if (!R) return false;
      const shout = () => {
        e.state = 'react';
        this.rivalShouts = (this.rivalShouts || 0) + 1;
        // His pointing arm is on the left of the picture: mirror him if the building's on his right.
        e.actor.image.setFlipX(R.x > e.actor.x);
        this.say(e, pick(PE.Data.scenes.budzRival), 2.4);
        e.actor.play('angry', { done: () => this.backToIdle(e) });
      };
      if (!R.way || R.way.length < 2) { shout(); return true; }
      if (!this.walkAlong(e, R.way)) return false;
      e.arrive = shout;
      return true;
    }
    walkAlong(e, way, depths) {
      if (!way || way.length < 2) return false;
      e.path = { pts: way, i: 0, left: 0, depths };
      e.state = 'walk';
      e.actor.walkRoll = Math.random();
      e.actor.heading(way[1][0] - way[0][0], way[1][1] - way[0][1]);
      return true;
    }

    // ---- Things happening nearby ----------------------------------------------------------------------------------------
    // kind: harvest, ripe, wilted, locked or rival (data/scenes.js says who does what).
    react(kind) {
      if (this.t < this.nextReact && kind !== 'locked') return false;
      const moves = PE.Data.scenes.reactions[kind];
      if (!moves) return false;
      let any = false;
      const barks = PE.Data.scenes.barks[kind];
      for (const e of this.list) {
        if (e.actor.paused || e.state === 'chat' || e.state === 'busy' || !moves[e.id]) continue;
        if (e.state === 'nap' && kind !== 'harvest') continue;
        // Budz only ever yells at the thing itself: behind the plant, or at the rival's building. Nothing to aim at: no yelling.
        if (e.id === 'BUDZ' && moves[e.id] === 'angry') {
          if (e.state === 'walk' && e.arrive) continue;
          if (this.frozen()) { this.reactions.push(`${e.id}:${moves[e.id]}`); any = true; continue; }
          const ok = kind === 'wilted' ? this.budzToPlant(e, true) : this.budzToRival(e);
          if (ok) { any = true; this.reactions.push(`${e.id}:${moves[e.id]}`); }
          continue;
        }
        e.state = 'react';
        e.path = null;
        if (!this.frozen()) e.actor.play(moves[e.id], { done: () => this.backToIdle(e) });
        if (!any && barks && !this.frozen()) this.say(e, pick(barks), 1.6);
        any = true;
        this.reactions.push(`${e.id}:${moves[e.id]}`);
        if (this.frozen()) e.state = 'idle';
      }
      if (any) this.nextReact = this.t + T.reactGap;
      return any;
    }

    // ---- A small speech bubble ------------------------------------------------------------------------------------------
    say(e, text, seconds) {
      if (e.bubble) e.bubble.destroy();
      const k = this.world.textScale();
      e.bubble = this.scene.add.text(e.actor.x, e.actor.y - e.actor.height - 6 * k, text, {
        fontFamily: FONT, fontStyle: 'bold', fontSize: '26px', color: '#1d0f33', backgroundColor: '#ffffff', padding: { x: 14, y: 8 }, align: 'center', wordWrap: { width: 300 },
      }).setOrigin(0.5, 1).setDepth(95000).setScale(k * 0.5);
      e.bubbleLeft = seconds;
    }
    keepBubble(e, dt) {
      if (!e.bubble) return;
      e.bubbleLeft -= dt;
      if (e.bubbleLeft <= 0 || e.actor.paused) { e.bubble.destroy(); e.bubble = null; return; }
      e.bubble.setPosition(e.actor.x, e.actor.y - e.actor.height - 6 * this.world.textScale());
    }

    // ---- Taps ------------------------------------------------------------------------------------------------------------
    // Returns the helper under this point, having greeted, or null. hidden: is this helper behind something at that point?
    tap(x, y, hidden) {
      for (const e of this.list) {
        if (!e.image.visible) continue;
        // Only if the finger is clearly on their body. Otherwise the tap belongs to whatever's underneath (a building).
        if (e.actor.covers(x, y) && !(hidden && hidden(e))) {
          this.nextChat = Math.max(this.nextChat, this.t + 8);
          if (e.state === 'nap') e.state = 'react';
          if (this.chatNow && (this.chatNow.a === e || this.chatNow.b === e)) this.endChat();
          e.path = null;
          e.arrive = null;
          e.busyDone = null;
          e.actor.setBehind(null);
          e.state = 'react';
          e.actor.play('greet', { done: () => this.backToIdle(e) });
          return e;
        }
      }
      return null;
    }
    // Used by the automatic browser tests: somewhere clearly on their body, in whatever pose they're in.
    // blocked(e, x, y), if given, says when something is drawn in front of them there (a building on the map).
    // Then only a point that can really be seen counts, and null means they're out of sight.
    pagePoint(id, blocked) {
      const e = this.list.find((x) => x.id === id);
      if (!e) return e;
      const A = e.actor;
      for (const k of [0.55, 0.65, 0.45, 0.75, 0.35, 0.85, 0.25]) {
        for (const side of [0, -0.1, 0.1]) {
          const x = A.x + A.height * side, y = A.y - A.height * k;
          if (A.covers(x, y) && !(blocked && blocked(e, x, y))) return this.scene.worldToPage(x, y);
        }
      }
      return blocked ? null : this.scene.worldToPage(A.x, A.y - A.height * 0.55);
    }
    setVisible(on) {
      for (const e of this.list) {
        if (e.actor.setNow || e.actor.stillK) e.image.setVisible(on);
        if (!on && e.bubble) { e.bubble.destroy(); e.bubble = null; }
      }
    }
  }

  // Walking lines in a room: the wide gaps between setups, so nobody walks through anything. A path goes along one gap
  // and then along another. xs and ys are the lines; every crossing is somewhere they can stand.
  function aisleWorld(xs, ys, opts) {
    const spots = [];
    for (const x of xs) for (const y of ys) spots.push([x, y]);
    return {
      height: opts.height,
      speed: opts.speed,
      near: opts.near,
      depth: opts.depth,
      ids: opts.ids,
      spots,
      textScale: opts.textScale,
      start(i) { const [x, y] = spots[(i * 3 + 1 + (Life.turn || 0)) % spots.length]; return { x, y }; },
      path(e, toward) {
        const here = [e.actor.x, e.actor.y];
        let to;
        if (toward) to = spots.slice().sort((a, b) => Math.hypot(a[0] - toward.x, a[1] - toward.y) - Math.hypot(b[0] - toward.x, b[1] - toward.y))[0];
        else {
          const others = spots.filter((s) => Math.hypot(s[0] - here[0], s[1] - here[1]) > 40);
          to = others.length ? pick(others) : null;
        }
        if (!to) return null;
        if (to[0] === here[0] || to[1] === here[1]) return [here, to];
        return [here, [to[0], here[1]], to];
      },
    };
  }

  PE.HelperLife = { Life, aisleWorld, T };
})(globalThis.PE = globalThis.PE || {});
