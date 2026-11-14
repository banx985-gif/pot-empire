// Which animation goes with which moment. Change anything here freely: it's only data.
// The frames themselves are listed in data/anim_art.js, made by tools/import_anim_art.js from art/characters.
//
// walk:   which set of frames walks in each direction. A direction with no set uses the mirror of the other side
//         (left copies right), or else the nearest direction there is. A list means pick one for each walk, for variety.
// moves:  a name the rest of the game uses (chat, cheer, angry...) and what it plays for each character:
//           set       the frames. A list means use the first of them this character has (a list for one person's
//                     own table means pick one at random each time).
//           from, to  only these frames (counting from 1)
//           frames    these frames, in this order
//           first     use the first set in the list they have (a fallback list), not one at random
//           fps, loop, hold (stays on the last frame), times (plays this many times), random (frames in random order)
//           bob       a gentle up and down while it holds
//           then      the move that follows this one (get angry, then point)
//
// Uncle Haze's hair (Aaron, 6 Nov; art/characters/helpers/haze_anim/HAZE_ANIM.md): STYLED is his everyday look: the map,
// rooms, walking, chatting, greeting and every random move, so moves.HAZE only uses styled frames. MESSY is ONLY for
// pop-ups where he's been busy or just woke up, in moves.HAZE_MESSY (a pop-up asks for it, see js/ui/talk.js). The two are
// never mixed. Styled still has no walk away and no walk down-right drawn: until they come, those use WALKUPLEFT and
// the mirror of WALKDOWNLEFT.
// Styled also has no cheer, anger, clap or shrug of its own, so those are his closest GREET and CHAT frames.
(globalThis.PE = globalThis.PE || {}).Data = globalThis.PE.Data || {};
globalThis.PE.Data.animMoves = {
  // Everyone else (customers, managers): frames named like this will be picked up by themselves when they're filed.
  defaultWalk: { down: 'WALKFRONT', up: 'WALKAWAY', left: 'WALKLEFT', right: ['WALKRIGHT', 'WALKSIDE'], downright: 'WALKDOWNRIGHT', downleft: 'WALKDOWNLEFT', upright: 'WALKUPRIGHT', upleft: 'WALKUPLEFT' },
  // Job 17B: the skater kid riding his board (longer trips on the map), and the delivery vehicles driving the roads.
  defaultSkate: { down: 'SKATEFRONT', up: 'SKATEAWAY', left: 'SKATELEFT', right: 'SKATERIGHT', downright: 'SKATEDOWNRIGHT', downleft: 'SKATEDOWNLEFT', upright: 'SKATEUPRIGHT', upleft: 'SKATEUPLEFT' },
  defaultDrive: { down: 'DRIVEFRONT', up: 'DRIVEAWAY', left: 'DRIVELEFT', right: 'DRIVERIGHT', downright: 'DRIVEDOWNRIGHT', downleft: 'DRIVEDOWNLEFT', upright: 'DRIVEUPRIGHT', upleft: 'DRIVEUPLEFT' },
  defaultMoves: {
    idle: { set: ['IDLE', 'TALKFRONT'], from: 1, to: 1, hold: true, bob: true },
    chat: { set: ['TALK', 'TALKFRONT'], fps: 7, loop: true },
    talk: { set: ['TALK', 'TALKFRONT'], fps: 7, loop: true },
    // At the counter, waiting to be served: the reach-out's first frame (hand at rest) with a gentle bob.
    // Job 19: no reach-out drawn yet: frame 01 of the walk (or skate) away from us, facing the counter.
    // Job 20: a van standing in its bay at the depot: its first driving frame, facing you.
    parked: { set: ['DRIVEFRONT', 'DRIVEAWAY'], first: true, from: 1, to: 1, hold: true },
    order: { set: ['TALKAWAY', 'TALK', 'WALKAWAY', 'SKATEAWAY'], first: true, from: 1, to: 1, hold: true, bob: true },
    happy: { set: ['HAPPY', 'REACT', 'FULL'], fps: 8, hold: true },
    // Job 17: the files called TALK<facing> are a reach-out (paying, taking the bag), not talking. Played once at the
    // counter, for the way the customer is facing (js/ui/biz_room.js picks reachUP, reachDOWNLEFT...), then back to rest.
    reachDOWN: { set: 'TALKFRONT' }, reachUP: { set: 'TALKAWAY' }, reachLEFT: { set: 'TALKLEFT' }, reachRIGHT: { set: 'TALKRIGHT' },
    reachDOWNLEFT: { set: 'TALKDOWNLEFT' }, reachDOWNRIGHT: { set: 'TALKDOWNRIGHT' }, reachUPLEFT: { set: 'TALKUPLEFT' }, reachUPRIGHT: { set: 'TALKUPRIGHT' },
    give: { set: 'GIVE', fps: 8 },
    // The skater kid pushes a jar of buds at the screen and winks (a close-up, for pop-ups). Played once, Aaron's timing.
    jar: { set: 'JAR', hold: false },
  },
  walk: {
    HAZE: { down: ['WALKFRONT2', 'WALKFRONT2', 'WALKFRONT'], right: 'WALKSIDE', downleft: 'WALKDOWNLEFT', upright: 'WALKUPRIGHT', upleft: 'WALKUPLEFT', up: 'WALKUPLEFT' },
    BUDZ: { down: 'WALKFRONT', up: 'WALK', right: 'WALKSIDE', downright: 'WALKDOWNRIGHT', downleft: 'WALKDOWNLEFT', upright: 'WALKUPRIGHT', upleft: 'WALKUPLEFT' },
    LEAFY: { down: 'WALKFRONT', up: 'WALKAWAY', right: 'WALKRIGHT', left: 'WALKLEFT', downright: 'WALKDOWNRIGHT', downleft: 'WALKDOWNLEFT', upright: 'WALKUPRIGHT', upleft: 'WALKUPLEFT' },
  },
  messy: {
    HAZE: ['SPIN', 'TALK', 'TALKTOWEL', 'TOWELFLICK', 'JOINTUP', 'CLAP', 'SHRUGCHEER', 'CHEERANGRY', 'CHAT4', 'CHAT5', 'CHAT6'],
  },
  // Job 22B (Aaron: everyone about the same height): every person is scaled by their measured height, so this is only
  // for a customer meant to be a touch taller or shorter (0.95 to 1.05). Helpers are all 1.
  size: {},
  moves: {
    // Terpz's gift balloon (job 19B): it fills up on the ground before take-off, to Aaron's timing.
    'VEH-06': { inflate: { set: 'INFLATE', hold: true } },
    // Terpz (job 32): only his 8-direction walk is drawn so far (terpz_anim/TERPZ_ANIM.md). Until his standing and
    // reactions come he stands on WALKFRONT frame 01, with a gentle bob, for everything that isn't walking.
    // His own frames, filed as TERPZ-<MOVE>-01.png, take over here once they're in.
    TERPZ: Object.fromEntries(['idle', 'stand', 'look', 'greet', 'wave', 'talk', 'chat', 'cheer', 'angry', 'shrug', 'puzzled', 'think', 'rub', 'clap', 'laugh', 'flick', 'sleepy']
      .map((m) => [m, { set: ['IDLE', 'WALKFRONT'], first: true, from: 1, to: 1, hold: true, bob: true }])),
    HAZE: {
      // Job 19B: his smoke without the peace sign (PUFF, frames 064-088). The peace sign is its own move, now and then.
      idle: { set: 'PUFF', loop: true },
      peace: { set: 'PEACE' },
      // Muttering to himself over a plant, or just thinking out loud: a couple of goes, then back to idle.
      mutter: { set: ['CHAT1', 'CHAT2', 'CHAT3'], fps: 7, times: 2 },
      wave: { set: 'GREET', fps: 8 },
      stand: { set: 'CHAT1', from: 1, to: 1, hold: true, bob: true },
      look: { set: 'CHAT3', frames: [1, 3, 1], fps: 3 },
      greet: { set: 'GREET', fps: 8, hold: true },
      talk: { set: ['CHAT1', 'CHAT2', 'CHAT3'], fps: 7, loop: true },
      chat: { set: ['CHAT1', 'CHAT2', 'CHAT3'], fps: 7, loop: true },
      laugh: { set: 'ROFL1', fps: 8, then: 'rolling' },
      rofl: { set: 'ROFL1', fps: 8, then: 'rolling' },
      rolling: { set: 'ROFL2', fps: 8, times: 3 },
      cheer: { set: 'GREET', from: 4, to: 6, fps: 7, hold: true },
      angry: { set: 'CHAT2', from: 2, to: 3, fps: 5, times: 3, hold: true },
      shrug: { set: 'CHAT2', from: 4, to: 5, fps: 5, hold: true },
      puzzled: { set: 'CHAT2', from: 4, to: 5, fps: 5, hold: true },
      think: { set: 'CHAT3', from: 1, to: 3, fps: 5, hold: true },
      rub: { set: 'CHAT1', from: 2, to: 3, fps: 6, times: 2 },
      clap: { set: 'CHAT1', from: 2, to: 3, fps: 6, times: 2 },
      flick: { set: 'GREET', from: 4, to: 6, fps: 7, hold: true },
      sleepy: { set: 'PUFF', fps: 4, loop: true },
      inspect: { set: 'INSPECT1', fps: 7, then: 'inspect2' },
      inspect2: { set: 'INSPECT2', fps: 7 },
      roll: { set: 'ROLL1', fps: 7, then: 'roll2' },
      roll2: { set: 'ROLL2', fps: 7 },
      // Job 22, the rare phone call (HAZE-PHONE-TIMELINE.json): his pocket buzzes, he pulls the phone out and answers,
      // talks for as long as the call lasts, then puts it away. steps count from 0 in full_call.
      buzz: { set: 'PHONE', seq: 'pocket_buzz_loop', loop: true },
      answer: { set: 'PHONE', seq: 'full_call', steps: [11, 14], then: 'oncall' },
      oncall: { set: 'PHONE', seq: 'conversation_loop', loop: true },
      hangup: { set: 'PHONE', seq: 'full_call', steps: [42, 46], hold: true },
    },
    // Pop-ups only, when he's been busy or just woke up. Every name here is in moves.HAZE too.
    HAZE_MESSY: {
      idle: { set: 'TALK', from: 1, to: 1, hold: true },
      stand: { set: 'TALK', from: 1, to: 1, hold: true },
      look: { set: 'SPIN', frames: [1, 2, 1, 6, 1], fps: 4 },
      greet: { set: 'CHEERANGRY', from: 1, to: 3, fps: 7, hold: true },
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
      // Only ever at a plant or a rival, never the player (js/ui/helper_life.js).
      angry: { set: 'GETANGRY', fps: 8, then: 'point' },
      point: { set: 'POINT', fps: 8, times: 2, hold: true },
      shrug: { set: 'CHAT2', from: 3, to: 6, fps: 6, hold: true },
      puzzled: { set: 'CHAT2', from: 3, to: 6, fps: 6, hold: true },
      think: { set: 'CHAT1', fps: 6, hold: true },
      rub: { set: 'RUB', fps: 8, times: 3 },
      clap: { set: 'RUB', fps: 8, times: 2 },
      sleepy: { set: 'SMOKE-SMOOTH', fps: 4, loop: true },
      daydream: { set: 'DAYDREAM1', fps: 7, then: 'daydreaming' },
      daydreaming: { set: 'DAYDREAM2', fps: 7, times: 3, hold: true },
      crush: { set: 'CRUSH', fps: 6, hold: true },
      // Job 19B: one go, then back to idle (the ones above hold their last frame for reactions).
      giggle: { set: 'LAUGH', fps: 7 },
      whoop: { set: 'CHEER', fps: 8 },
      mutter: { set: ['CHAT1', 'CHAT2', 'CHAT3'], fps: 7, times: 2 },
    },
    LEAFY: {
      idle: { set: 'CHAT1', from: 1, to: 1, hold: true, bob: true },
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
      // Yawn, big stretch, pillow down, asleep. He stretches again when he wakes.
      drowsy: { set: 'DROWSY', fps: 6, then: 'stretch' },
      stretch: { set: 'STRETCH', fps: 6 },
      sleepy: { set: 'DROWSY', fps: 6, then: 'pillow' },
      pillow: { set: 'SLEEPY', fps: 6, then: 'sleep' },
      sleep: { set: 'SLEEP', from: 1, to: 4, fps: 5, then: 'asleep' },
      asleep: { set: 'SLEEP', from: 5, to: 6, fps: 2, loop: true },
      // Job 22, the rare phone call (LEAFY-PHONE-TIMELINE.json): phone out from behind his leaf, taps in the number
      // (over and over while it rings), raises it and chats, then puts it away.
      phoneout: { set: 'PHONE', seq: 'full_call', steps: [0, 2], then: 'dial' },
      dial: { set: 'PHONE', seq: 'dialling_loop', loop: true },
      raise: { set: 'PHONE', seq: 'full_call', steps: [14, 16], then: 'onphone' },
      onphone: { set: 'PHONE', seq: 'conversation_loop', loop: true },
      hangup: { set: 'PHONE', seq: 'full_call', steps: [45, 48], hold: true },
    },
  },
};

// Job 26: the gaming lounge (LOUNGE-01..20 and LOUNGE-TIMELINE.json, the same poses for all three helpers): walk to the TV
// (walking away from us), reach, pick up the controller, turn, walk to the seat (toward us), sit, play; getting up is the
// sitting played backwards (there's no get-up drawn yet). Each seat has its own way of sitting and playing.
(function (A) {
  const L = (seq, more) => ({ set: 'LOUNGE', seq, ...more });
  const sit = { SOFA: ['SOFA:turn_and_sit'], RECLINER: ['RECLINER:turn_and_sit', 'RECLINER:settle_into_recliner', 'RECLINER:raise_feet'], MASSAGE: ['MASSAGE:turn_and_sit', 'MASSAGE:settle_into_massage_chair'] };
  const play = { SOFA: 'SOFA:seated_gaming', RECLINER: 'RECLINER:reclined_gaming', MASSAGE: 'MASSAGE:seated_gaming' };
  for (const id of ['HAZE', 'BUDZ', 'LEAFY']) {
    const T = A.moves[id];
    T.loungeAway = L('SOFA:approach_tv', { steps: [0, 3], loop: true });
    T.loungePick = L(['SOFA:reach_empty_hand', 'SOFA:pick_up_controller', 'SOFA:turn_with_controller', 'SOFA:face_seat'], { hold: true });
    T.loungeToward = L('SOFA:walk_to_seat', { steps: [0, 3], loop: true });
    for (const seat of Object.keys(sit)) {
      T['loungeSit' + seat] = L(['SOFA:stop_at_seat', ...sit[seat]], { hold: true });
      T['loungePlay' + seat] = L(play[seat], { loop: true });
      T['loungeUp' + seat] = L(sit[seat], { reverse: true, hold: true });
    }
  }
})(globalThis.PE.Data.animMoves);
