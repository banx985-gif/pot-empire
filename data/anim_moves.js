// Which animation goes with which moment. Change anything here freely: it's only data.
// The frames themselves are listed in data/anim_art.js, made by tools/import_anim_art.js from art/characters.
//
// walk:   which set of frames walks in each direction. A direction with no set uses the mirror of the other side
//         (left copies right), or else the nearest direction there is.
// moves:  a name the rest of the game uses (chat, cheer, angry...) and what it plays for each character:
//           set       the frames. A list means pick one at random each time.
//           from, to  only these frames (counting from 1)
//           frames    these frames, in this order
//           fps, loop, hold (stays on the last frame), times (plays this many times), random (frames in random order)
//           then      the move that follows this one (get angry, then point)
// looks:  Uncle Haze is drawn with two hairstyles that must never be mixed: changing from one to the other only happens
//         behind a little puff of smoke. Anything not listed here is "messy".
//         NOTE: HAZE_ANIM.md has no TWO HAIR LOOKS section yet, so this list comes from looking at the frames.
//         Swept hair ("styled"): all the walks and HAZE-CHAT1, 2, 3. Curly hair ("messy"): everything else, which is why he
//         only talks with CHAT4, 5, 6 for now. HAZE-GREET-01 is swept and 02 to 06 curly, so only 02 to 06 are used.
//         His turn-around video idle (HAZE-IDLE-SHEET) has different hair again, so it isn't used at all.
(globalThis.PE = globalThis.PE || {}).Data = globalThis.PE.Data || {};
globalThis.PE.Data.animMoves = {
  // Everyone else (customers, managers): frames named like this will be picked up by themselves when they're filed.
  defaultWalk: { down: 'WALKFRONT', up: 'WALKAWAY', right: 'WALKSIDE', downright: 'WALKDOWNRIGHT', downleft: 'WALKDOWNLEFT', upright: 'WALKUPRIGHT', upleft: 'WALKUPLEFT' },
  defaultMoves: {
    idle: { set: 'IDLE', fps: 6, loop: true },
    chat: { set: 'TALK', fps: 7, loop: true },
    talk: { set: 'TALK', fps: 7, loop: true },
    happy: { set: 'REACT', fps: 8 },
    give: { set: 'GIVE', fps: 8 },
  },
  walk: {
    HAZE: { down: 'WALKFRONT', up: 'WALKAWAY', right: 'WALKSIDE', downright: 'WALKDOWNRIGHT', downleft: 'WALKDOWNLEFT', upright: 'WALKUPRIGHT', upleft: 'WALKUPLEFT' },
    BUDZ: { down: 'WALKFRONT', up: 'WALK', right: 'WALKSIDE', downright: 'WALKDOWNRIGHT', downleft: 'WALKDOWNLEFT', upright: 'WALKUPRIGHT', upleft: 'WALKUPLEFT' },
    LEAFY: { down: 'WALKFRONT', up: 'WALKAWAY', right: 'WALKRIGHT', left: 'WALKLEFT', downright: 'WALKDOWNRIGHT', downleft: 'WALKDOWNLEFT', upright: 'WALKUPRIGHT', upleft: 'WALKUPLEFT' },
  },
  looks: {
    HAZE: { WALKFRONT: 'styled', WALKAWAY: 'styled', WALKSIDE: 'styled', WALKDOWNRIGHT: 'styled', WALKDOWNLEFT: 'styled', WALKUPRIGHT: 'styled', WALKUPLEFT: 'styled', CHAT1: 'styled', CHAT2: 'styled', CHAT3: 'styled' },
  },
  // How tall each one stands next to the others.
  size: { HAZE: 1, BUDZ: 0.86, LEAFY: 0.92 },
  moves: {
    HAZE: {
      idle: { set: 'TALK', from: 1, to: 1, hold: true },
      stand: { set: 'TALK', from: 1, to: 1, hold: true },
      look: { set: 'SPIN', frames: [1, 2, 1, 6, 1], fps: 4 },
      greet: { set: 'GREET', from: 2, to: 6, fps: 8, hold: true },
      talk: { set: 'TALK', fps: 9, loop: true, random: true },
      chat: { set: ['CHAT4', 'CHAT5', 'CHAT6'], fps: 7, loop: true },
      laugh: { set: 'SHRUGCHEER', from: 5, to: 6, fps: 5, times: 3 },
      cheer: { set: 'CHEERANGRY', from: 1, to: 3, fps: 7, times: 2, hold: true },
      angry: { set: 'CHEERANGRY', from: 4, to: 6, fps: 7, hold: true },
      shrug: { set: 'SHRUGCHEER', from: 1, to: 4, fps: 7, hold: true },
      puzzled: { set: 'SHRUGCHEER', from: 1, to: 4, fps: 7, hold: true },
      think: { set: 'CHAT6', fps: 6, hold: true },
      rub: { set: 'CLAP', fps: 8, times: 2 },
      clap: { set: 'CLAP', fps: 8, times: 2 },
      flick: { set: 'TOWELFLICK', fps: 8, hold: true },
      sleepy: { set: 'SPIN', frames: [1], hold: true },
    },
    BUDZ: {
      idle: { set: 'SMOKE-SMOOTH', fps: 8, loop: true },
      stand: { set: 'CHAT1', from: 1, to: 1, hold: true },
      look: { set: 'TURN', frames: [1, 2, 3, 2, 1], fps: 5 },
      greet: { set: 'TURN', frames: [5, 4, 3, 2, 1], fps: 8, hold: true },
      talk: { set: ['CHAT1', 'CHAT2', 'CHAT3'], fps: 7, loop: true },
      chat: { set: ['CHAT1', 'CHAT2', 'CHAT3'], fps: 7, loop: true },
      laugh: { set: 'LAUGH', fps: 7, hold: true },
      cheer: { set: 'CHEER', fps: 8, hold: true },
      angry: { set: 'GETANGRY', fps: 8, then: 'point' },
      point: { set: 'POINT', fps: 8, times: 2, hold: true },
      shrug: { set: 'CHAT2', from: 3, to: 6, fps: 6, hold: true },
      puzzled: { set: 'CHAT2', from: 3, to: 6, fps: 6, hold: true },
      think: { set: 'CHAT1', fps: 6, hold: true },
      rub: { set: 'RUB', fps: 8, times: 3 },
      clap: { set: 'RUB', fps: 8, times: 2 },
      sleepy: { set: 'SMOKE-SMOOTH', fps: 4, loop: true },
    },
    LEAFY: {
      idle: { set: 'CHAT1', from: 1, to: 1, hold: true },
      stand: { set: 'CHAT1', from: 1, to: 1, hold: true },
      look: { set: 'THINK', from: 1, to: 3, fps: 4, hold: true },
      greet: { set: 'THINK', from: 4, to: 6, fps: 7, hold: true },
      talk: { set: ['CHAT1', 'CHAT2', 'CHAT3'], fps: 7, loop: true },
      chat: { set: ['CHAT1', 'CHAT2', 'CHAT3'], fps: 7, loop: true },
      laugh: { set: 'CHAT3', fps: 8, hold: true },
      cheer: { set: 'THINK', from: 5, to: 6, fps: 5, times: 2, hold: true },
      angry: { set: 'PUZZLED', from: 3, to: 6, fps: 7, hold: true },
      shrug: { set: 'PUZZLED', from: 4, to: 6, fps: 7, hold: true },
      puzzled: { set: 'PUZZLED', fps: 7, hold: true },
      think: { set: 'THINK', fps: 7, hold: true },
      rub: { set: 'THINK', from: 4, to: 6, fps: 7, hold: true },
      clap: { set: 'CHAT2', fps: 8 },
      sleepy: { set: 'SLEEPY', fps: 6, then: 'sleep' },
      sleep: { set: 'SLEEP', from: 1, to: 4, fps: 5, then: 'asleep' },
      asleep: { set: 'SLEEP', from: 5, to: 6, fps: 2, loop: true },
    },
  },
};
