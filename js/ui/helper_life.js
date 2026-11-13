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
    idle: [2, 5],
    meetEvery: [22, 40],      // how often one goes looking for the other
    chatLine: 2.4,            // one small bubble
    chatGap: 45,              // the shortest time between two chats
    reactGap: 7,              // the shortest time between two reactions
    napEvery: [70, 150],      // random naps, not too often
    napFor: [12, 26],
    playerIdle: 45,           // nobody has touched the screen: time for Leafy's nap
    liveEvery: [14, 30],      // a random move from their mix (job 19B: more often, so they don't just stand and smoke)
    plantEvery: [22, 45],     // Budz wanders over to chat to a plant
    hazeLookAt: 0.4,          // after a rest, how often Haze strolls over to look a plant over (job 19B)
    commentGap: 25,           // the least time between two comments from the same helper (job 19B: 20 to 30 s)
    rivalEvery: [120, 260],   // Budz goes and yells at a rival's building, if one's near
    plantChat: 3,
  };
  // Job 22, the rare phone call: Leafy rings Haze in the same grow room. All easy to tune.
  const CALL = {
    gapMs: 15 * 60 * 1000,    // at most once every 15 minutes of play (counted by js/ui/notify.js)
    checkEvery: 20,           // how often (seconds) it rolls the dice while both are standing about
    chance: 0.12,             // the chance on each roll
    dial: 1.6,                // Leafy taps in the number before the pocket buzzes
    ring: 1.8,                // Haze's pocket buzzes, he looks over
    pickUp: 0.9,              // phone out and up to the ear, before the first line
    line: 2.3,                // each speech bubble
    hangUp: 1.3,              // both put their phones away
    look: 1.0,                // a look at each other, then back to normal
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
      this.comments = [];   // job 19B: every comment said, with when (the tests read this)
      this.visits = [];     // and every plant Haze stopped at
      this.callNow = null;  // job 22: the phone call, while it's on
      this.calls = [];      // every call started, and how it ended (the tests read this)
      this.nextCall = CALL.checkEvery;
      this.lounges = [];    // job 26: every trip to the lounge, and how it went (the tests read this)
      this.nextLounge = rand(5, 20);
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
      if (this.callNow) this.stepCall(dt);
      for (const e of this.list) this.stepOne(e, dt);
      this.maybeMeet();
      this.maybeNap();
      this.maybeLive();
      this.maybeBudz();
      this.maybeCall();
      this.maybeLounge();
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
      } else if (e.state === 'lounge') this.stepLounge(e, dt);
      else if (e.state === 'busy') {
        e.busyLeft -= dt;
        if (e.busyLeft <= 0) { const go = e.busyDone; e.busyDone = null; e.state = 'react'; go(); }
      }
    }
    afterIdle(e) {
      // Job 19B: Haze strolls over to a plant and looks it over.
      if (e.id === 'HAZE' && this.world.plantLook && Math.random() < T.hazeLookAt && this.hazeToPlant(e)) return;
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
          if (!P.own) e.actor.heading(bx - ax, by - ay);
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
      if (e.state === 'chat' || e.state === 'call' || e.state === 'lounge') return;
      e.arrive = null;
      e.busyDone = null;
      e.actor.setBehind(null);
      e.state = 'idle';
      e.wait = rand(...T.idle);
      // Job 19B: smoking is one of their idles, not the only one. Otherwise they stand easy (a gentle bob).
      e.actor.play(Math.random() < 0.45 ? 'idle' : 'stand');
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
      // Whoever has gone longest without one gets the next (job 19B), so both of them keep busy.
      if (free.length) this.liveMove(free.sort((x, y) => (x.lastLive || 0) - (y.lastLive || 0))[0]);
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
      e.lastLive = this.t;
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
        this.visits.push({ id: e.id, kind: wilted ? 'thirsty' : P.kind || 'growing', t: this.t });
        const off = () => { const back = this.walkAlong(e, P.way.slice().reverse(), P.backDepths); if (!back) this.backToIdle(e); };
        if (wilted) {
          this.comment(e, 'thirsty', 2.4) || this.say(e, pick(PE.Data.scenes.budzTellOff), 2.4);
          e.actor.play('angry', { done: off });
        } else {
          // A tiny bubble as he talks to it, but only now and then (job 19B: comments stay rare).
          this.comment(e, P.kind || 'growing', T.plantChat);
          e.actor.play('chat');
          e.state = 'busy';
          e.busyLeft = T.plantChat;
          e.busyDone = off;
        }
      };
      return true;
    }
    // ---- Job 19B: Haze looks the plants over, and a comment here and there ---------------------------------------------
    // Walks up to the front of a plant, looks it over (his INSPECT frames now and then), says something if it's been a
    // while, and moves on.
    hazeToPlant(e) {
      const P = this.world.plantLook && this.world.plantLook(e);
      if (!P || !this.walkAlong(e, P.way)) return false;
      e.arrive = () => {
        e.state = 'react';
        this.plantLooks = (this.plantLooks || 0) + 1;
        this.visits.push({ id: e.id, kind: P.kind, t: this.t });
        if (P.flip !== undefined) e.actor.image.setFlipX(P.flip);
        this.comment(e, P.kind, 2.6);
        e.actor.play(Math.random() < 0.5 ? 'inspect' : 'mutter', { done: () => this.backToIdle(e) });
      };
      return true;
    }
    // A short line in their voice about what they've stopped at, if they haven't said something for a while.
    // Returns true if they said it.
    comment(e, kind, seconds = 2.4) {
      const lines = ((PE.Data.scenes.comments || {})[e.id] || {})[kind];
      if (!lines || !lines.length) return false;
      if (e.lastComment !== undefined && this.t - e.lastComment < T.commentGap) return false;
      e.lastComment = this.t;
      this.comments.push({ id: e.id, kind, t: this.t });
      this.say(e, pick(lines), seconds);
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

    // ---- Job 22: the rare phone call ---------------------------------------------------------------------------------
    // Leafy rings Haze while they're both standing about in the same grow room. Only where the screen allows it
    // (world.callOk: a grow room, not its first visit, not in the guide, a menu, or while dragging), at most once every
    // 15 minutes of play, and only a small chance even then. The lines count as each one's next comment.
    callReady() {
      if (!this.world.callOk || this.callNow || this.chatNow || this.frozen()) return null;
      const leafy = this.list.find((e) => e.id === 'LEAFY'), haze = this.list.find((e) => e.id === 'HAZE');
      if (!leafy || !haze) return null;
      // Both standing still and on screen: not walking, napping, chatting or doing a move.
      const still = (e) => e.state === 'idle' && !e.path && !e.actor.paused && e.actor.image.visible;
      if (!still(leafy) || !still(haze)) return null;
      // The 25 second comment limit holds for both of them.
      for (const e of [leafy, haze]) if (e.lastComment !== undefined && this.t - e.lastComment < T.commentGap) return null;
      if (!this.world.callOk()) return null;
      return { leafy, haze };
    }
    static callGapOk() {
      const ui = PE.App.state.ui;
      return (ui.playMs || 0) - (ui.lastCallPlayMs === undefined ? 0 : ui.lastCallPlayMs) >= CALL.gapMs;
    }
    maybeCall() {
      if (this.t < this.nextCall) return;
      const pair = this.callReady();
      if (!pair) return;
      this.nextCall = this.t + CALL.checkEvery;
      if (!Life.callGapOk() || Math.random() >= CALL.chance) return;
      this.startCall(pair.leafy, pair.haze);
    }
    startCall(leafy, haze) {
      const list = PE.Data.scenes.phoneCalls || [];
      if (!list.length) return false;
      if (this.chatNow) this.endChat();
      // Not the same call twice in a row.
      let i = Math.floor(Math.random() * list.length);
      if (list.length > 1 && i === Life.lastCallLines) i = (i + 1) % list.length;
      Life.lastCallLines = i;
      PE.App.state.ui.lastCallPlayMs = PE.App.state.ui.playMs || 0;
      for (const e of [leafy, haze]) {
        if (e.bubble) { e.bubble.destroy(); e.bubble = null; }
        e.state = 'call'; e.path = null; e.arrive = null; e.busyDone = null; e.actor.setBehind(null);
      }
      leafy.actor.image.setFlipX(haze.actor.x > leafy.actor.x);
      this.callNow = { leafy, haze, lines: list[i], step: 'dial', left: CALL.dial, line: 0, t0: this.t };
      this.calls.push({ at: this.t, lines: i, end: null, steps: ['dial'] });
      leafy.actor.play('phoneout');
      haze.actor.play('stand');
      return true;
    }
    callStep(step, left) {
      const C = this.callNow;
      C.step = step;
      C.left = left;
      this.calls[this.calls.length - 1].steps.push(step);
    }
    stepCall(dt) {
      const C = this.callNow;
      const { leafy, haze } = C;
      // Either of them off the screen: stop cleanly.
      if (leafy.actor.paused || haze.actor.paused) { this.endCall('away'); return; }
      C.left -= dt;
      if (C.left > 0) return;
      if (C.step === 'dial') {
        // His pocket buzzes, and he looks over at Leafy.
        haze.actor.image.setFlipX(leafy.actor.x > haze.actor.x);
        haze.actor.play('buzz');
        this.callStep('ring', CALL.ring);
      } else if (C.step === 'ring') {
        haze.actor.play('answer');
        leafy.actor.play('raise');
        this.callStep('talk', CALL.pickUp);
      } else if (C.step === 'talk') {
        if (C.line >= C.lines.length) {
          for (const e of [leafy, haze]) { if (e.bubble) { e.bubble.destroy(); e.bubble = null; } e.actor.play('hangup'); }
          this.callStep('hangup', CALL.hangUp);
          return;
        }
        const [who, text] = C.lines[C.line];
        const speaker = who === 'HAZE' ? haze : leafy, other = speaker === haze ? leafy : haze;
        if (other.bubble) { other.bubble.destroy(); other.bubble = null; }
        this.say(speaker, text, CALL.line + 0.2);
        speaker.lastComment = this.t;
        this.comments.push({ id: speaker.id, kind: 'call', t: this.t });
        C.line += 1;
        C.left = CALL.line;
      } else if (C.step === 'hangup') {
        // A look at each other, then back to what they were doing.
        leafy.actor.image.setFlipX(haze.actor.x > leafy.actor.x);
        haze.actor.image.setFlipX(leafy.actor.x > haze.actor.x);
        leafy.actor.play('stand');
        haze.actor.play('stand');
        this.callStep('look', CALL.look);
      } else this.endCall('done');
    }
    endCall(why) {
      const C = this.callNow;
      if (!C) return;
      this.callNow = null;
      this.calls[this.calls.length - 1].end = why;
      for (const e of [C.leafy, C.haze]) {
        if (e.bubble) { e.bubble.destroy(); e.bubble = null; }
        // Their lines count as their latest comment, so the 25 second limit runs on from the call.
        e.lastComment = this.t;
        e.state = 'react';
        this.backToIdle(e);
        e.wait = rand(1, 3);
      }
      this.nextChat = Math.max(this.nextChat, this.t + 10);
    }

    // ---- Job 26: the gaming lounge ---------------------------------------------------------------------------------------
    // Now and then an idle helper goes over to the room's lounge: walks to the TV, picks up a controller, walks to their
    // seat (a sofa has a place for each helper; a recliner or massage chair seats one), sits and plays for a few minutes
    // (data/lounge.js), then gets up and carries on. The TV shows the game while anyone's playing. Never during the phone
    // call, a chat, or while they're off the screen.
    maybeLounge() {
      const W = this.world.lounge;
      if (!W || this.frozen() || this.t < this.nextLounge) return;
      const D = PE.Data.lounge;
      this.nextLounge = this.t + D.check;
      const free = this.list.filter((e) => e.state === 'idle' && !e.path && !e.actor.paused && (e.loungeRest || 0) <= this.t && (PE.Data.animArt.chars[e.id] || {}).LOUNGE && W.slotFor(e.id));
      if (!free.length) return;
      // A friend already on the sofa makes it more likely (all three together is the rare treat).
      const chance = (D.perHour * D.check) / 3600 * (W.playing.size ? 3 : 1);
      if (Math.random() >= chance) return;
      this.goLounge(free[Math.floor(Math.random() * free.length)]);
    }
    goLounge(e) {
      const W = this.world.lounge;
      const slot = W && W.slotFor(e.id);
      if (!slot || e.state === 'lounge' || e.state === 'call') return false;
      W.take(e.id, slot.key);
      e.state = 'lounge';
      e.path = null; e.arrive = null; e.busyDone = null;
      if (e.bubble) { e.bubble.destroy(); e.bubble = null; }
      e.lg = { phase: 'toTv', slot, at: this.t };
      this.lounges.push({ id: e.id, seat: W.kind, at: this.t, steps: ['toTv'], end: null, played: 0 });
      // Along the open floor to just below the TV, then up to it with his back to us.
      const F = W.front;
      const near = [F.x, Math.min(W.seat.y + 160, F.y + W.seat.h + 380)];
      const floor = this.world.route ? this.world.route([e.actor.x, e.actor.y], near) : null;
      const first = floor && floor.length > 1 ? [[e.actor.x, e.actor.y], ...floor.slice(1)] : null;
      const upToTv = () => this.loungeLeg(e, [[e.actor.x, e.actor.y], [W.seat.x + (W.seat.w / 2 + 140) * (e.actor.x < W.seat.x ? -1 : 1), e.actor.y], [F.x + (slot.x - W.seat.x) * 0.4, F.y]], 'loungeAway', () => this.atTv(e));
      if (first) { this.walkAlong(e, first); e.state = 'lounge'; e.arrive = upToTv; } else upToTv();
      return true;
    }
    // A stretch walked with the lounge's own frames (away from us, or toward us with the controller).
    loungeLeg(e, pts, move, then) {
      e.path = { pts, i: 0, left: 0, own: true };
      e.actor.play(move, { flip: false });
      e.lg.walk = true;
      e.arrive = () => { e.lg.walk = false; then(); };
    }
    atTv(e) {
      const W = this.world.lounge;
      e.lg.phase = 'pick';
      this.loungeStep(e, 'pick');
      e.actor.play('loungePick', { flip: false, done: () => {
        if (e.state !== 'lounge') return;
        e.lg.phase = 'toSeat';
        this.loungeStep(e, 'toSeat');
        // Behind the seat's back from here on: it hides their legs as they reach it.
        e.actor.setBehind(W.behind);
        this.loungeLeg(e, [[e.actor.x, e.actor.y], [e.lg.slot.x, e.lg.slot.y]], 'loungeToward', () => this.sitDown(e));
      } });
    }
    sitDown(e) {
      const W = this.world.lounge;
      e.lg.phase = 'sit';
      this.loungeStep(e, 'sit');
      e.actor.moveTo(e.lg.slot.x, e.lg.slot.y);
      e.actor.play('loungeSit' + W.kind, { flip: false, done: () => {
        if (e.state !== 'lounge') return;
        e.lg.phase = 'play';
        e.lg.until = this.t + W.minutes() * 60;
        e.lg.sat = this.t;
        this.loungeStep(e, 'play');
        W.setPlaying(e.id, true);
        e.actor.play('loungePlay' + W.kind, { flip: false });
      } });
    }
    stepLounge(e, dt) {
      if (e.path) { this.stepWalk(e, dt); return; }
      if (e.lg && e.lg.phase === 'play' && this.t >= e.lg.until) this.getUp(e);
    }
    getUp(e) {
      const W = this.world.lounge;
      e.lg.phase = 'up';
      this.loungeStep(e, 'up');
      const rec = this.lounges[this.lounges.length - 1];
      if (rec && rec.id === e.id) rec.played = this.t - (e.lg.sat || this.t);
      W.setPlaying(e.id, false);
      e.actor.play('loungeUp' + W.kind, { flip: false, done: () => {
        if (e.state !== 'lounge') return;
        // Out past the end of the seat (still behind its back), then off to carry on with the day.
        const side = e.lg.slot.x < W.seat.x ? -1 : 1;
        const out = [W.seat.x + side * (W.seat.w / 2 + 150), e.actor.y];
        this.walkAlong(e, [[e.actor.x, e.actor.y], out]);
        e.state = 'lounge';
        e.lg.phase = 'away';
        e.arrive = () => this.leaveLounge(e, 'done');
      } });
    }
    leaveLounge(e, why) {
      const W = this.world.lounge;
      if (W) { W.free(e.id); W.setPlaying(e.id, false); }
      for (let i = this.lounges.length - 1; i >= 0; i--) if (this.lounges[i].id === e.id && !this.lounges[i].end) { this.lounges[i].end = why; break; }
      e.lg = null;
      e.path = null;
      e.arrive = null;
      e.actor.setBehind(null);
      e.state = 'react';
      if (why !== 'tapped') this.backToIdle(e);
      // Not straight back to the TV.
      e.loungeRest = this.t + 120;
    }
    loungeStep(e, step) {
      for (let i = this.lounges.length - 1; i >= 0; i--) if (this.lounges[i].id === e.id && !this.lounges[i].end) { this.lounges[i].steps.push(step); break; }
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
        if (e.actor.paused || e.state === 'chat' || e.state === 'busy' || e.state === 'call' || e.state === 'lounge' || !moves[e.id]) continue;
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
          if (e.state === 'lounge' && e.lg && e.lg.phase === 'play') { e.lg.tapped = (e.lg.tapped || 0) + 1; return e; }
          if (e.state === 'lounge') this.leaveLounge(e, 'tapped');
          if (e.state === 'nap') e.state = 'react';
          if (this.chatNow && (this.chatNow.a === e || this.chatNow.b === e)) this.endChat();
          // The phone call stops cleanly and the tap wins (job 22).
          if (this.callNow && (this.callNow.leafy === e || this.callNow.haze === e)) this.endCall('tapped');
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

  PE.HelperLife = { Life, aisleWorld, T, CALL };
})(globalThis.PE = globalThis.PE || {});
