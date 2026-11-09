// Who says what in pop-up conversations, and the little lines the helpers say to each other in the world. Only data:
// change anything. Written by Claude Code for job 11. Aaron hasn't seen or approved these lines yet.
//
// A scene line:  { who: 'HAZE' | 'BUDZ' | 'LEAFY', text, move, react: { BUDZ: 'laugh' } }
//   move   what the speaker plays (data/anim_moves.js has the names). Without one: chat.
//   react  what the others do while this line is said.
(globalThis.PE = globalThis.PE || {}).Data = globalThis.PE.Data || {};
globalThis.PE.Data.scenes = {
  // What a helper plays for a line, by what set the line off. Without one: chat.
  jokeMoves: {
    firstHarvest: 'cheer', automation: 'clap', rareFind: 'rub', bigUpgrade: 'cheer', facility: 'greet',
    prestige: 'cheer', idleReturn: 'greet', rank: 'cheer', setComplete: 'cheer', rival: 'laugh', chat: 'chat',
  },

  // Uncle Haze's helper pop-ups that show him busy or just woken up (messy hair, data/anim_moves.js). All others are styled.
  messyEvents: ['idleReturn'],

  // The welcome back shows Haze messy: he's been hard at work (js/ui/panels_grow.js).
  welcomeBack: {
    plain: [
      { who: 'HAZE', move: 'flick', text: 'There you are, kid. The place ran itself. Mostly.', react: { BUDZ: 'cheer' } },
    ],
    thirsty: [
      { who: 'LEAFY', move: 'puzzled', text: "Your plants got thirsty while you were away. Water them and they'll perk right up.", react: { BUDZ: 'shrug' } },
    ],
  },

  // The first look at a festival's page in each festival.
  festivals: {
    rainbow: [
      { who: 'BUDZ', move: 'cheer', text: 'Rainbow Roadtrip! Every harvest scores points!', react: { HAZE: 'clap' } },
      { who: 'HAZE', move: 'chat', text: 'Took one of these in 1974. Got back in 1977. Grow lots, kid.', react: { BUDZ: 'laugh' } },
    ],
    default: [
      { who: 'BUDZ', move: 'cheer', text: "It's a FESTIVAL! Every harvest scores points, and there are prizes all the way up!", react: { LEAFY: 'think' } },
      { who: 'LEAFY', move: 'think', text: 'The prizes are only for show. Budz will still cry when he gets one.', react: { BUDZ: 'laugh' } },
    ],
  },

  // In the world: small bubbles when two helpers meet. Each is a little back and forth.
  smallTalk: [
    { HAZE: 'Back in 1974...', BUDZ: 'Here we go!' },
    { BUDZ: 'Snack break?', LEAFY: 'You just had one.' },
    { LEAFY: 'Have you watered?', HAZE: 'Have you?' },
    { HAZE: 'Nice day for it.', LEAFY: 'For what?' },
    { BUDZ: 'I love this place!', HAZE: 'You love every place.' },
    { LEAFY: 'I made a list.', BUDZ: 'Is it snacks?' },
    { HAZE: 'Hear that?', BUDZ: 'Hear what?' },
    { BUDZ: 'New shoes!', LEAFY: 'Those are old.' },
  ],
  // In the world: a word or two when something happens nearby.
  barks: {
    harvest: ['Nice!', 'Look at that!', 'Beautiful.'],
    ripe: ['Ooh, ready!', 'Pick it!'],
    wilted: ['Hey! Water!', 'Poor thing!'],
    locked: ['Huh?', 'Not yet...'],
    rival: ['Oh, come ON.', 'Them again!'],
  },
  // What each helper does when something happens nearby. Anything not listed just carries on.
  reactions: {
    harvest: { HAZE: 'cheer', BUDZ: 'cheer', LEAFY: 'clap' },
    ripe: { BUDZ: 'rub', HAZE: 'clap', LEAFY: 'think' },
    wilted: { BUDZ: 'angry', HAZE: 'shrug', LEAFY: 'puzzled' },
    locked: { LEAFY: 'puzzled', HAZE: 'shrug', BUDZ: 'shrug' },
    rival: { BUDZ: 'angry', HAZE: 'angry', LEAFY: 'puzzled' },
  },
  // Budz never yells at the player. His 'angry' is only ever aimed at a thirsty plant (standing behind it) or a rival's
  // building (js/ui/helper_life.js): with nothing to aim at, he doesn't do it.
  budzPlant: ['Grow big, little buddy.', 'Looking good, mate.', "Who's a tall boy?", 'Roots down, leaves up.', 'You and me, pal.'],
  budzTellOff: ['Drink your water!', 'Oi! Drink up!', 'What did I tell you?!'],
  budzRival: ['Oi! Beat it!', 'This is OUR town!', 'Take a hike!'],
  // Job 19B: a short comment when they stop at something in a grow room. Rare: one every 25 s at most, each
  // (js/ui/helper_life.js). ripe: ready to pick; nice: ripe and a top grade; thirsty: needs water; growing; tank: a full
  // water tank waiting for a Spray!
  comments: {
    HAZE: {
      ripe: ['This one\'s ready, kid.', 'Pick me, says this one.', 'Ripe. Go on then.'],
      nice: ['Now THAT is a bud.', 'Top shelf. I taught you well.', 'Look at the frost on that.'],
      thirsty: ['Bit dry, this one.', 'Somebody water this poor thing.'],
      growing: ['Coming along nicely.', 'Slow and steady, little one.', 'Good roots on this.'],
      tank: ['Tank\'s full. Hit Spray!', 'Water\'s ready when you are.'],
    },
    BUDZ: {
      ripe: ['You did it, buddy!', 'Harvest time, mate!'],
      nice: ['WOW. Look at you!', 'Best in show, pal!'],
      thirsty: ['Drink your water!', 'Oi! Drink up!'],
      growing: ['Grow big, little buddy.', "Who's a tall boy?", 'Roots down, leaves up.'],
      tank: ['Tank\'s full! Spray time!'],
    },
  },
  // Terpz, Budz's cousin, in his gift balloon (VEH-06, job 19B). He has no walking art yet, so he only ever flies.
  terpzArrive: ['Special delivery!', 'Catch, cuz!', 'Gift from the sky!', 'Tap me, I\'m loaded!'],
  terpzThanks: ['Enjoy, cuz!', 'Laters!', 'Peace out!'],
  // Now and then, at random, when someone's standing about. weight: how likely. pop: a thought bubble that bursts at the end.
  liveMoves: {
    // Job 19B: a proper mix, so smoking is just one of the things they do. ROFL and CRUSH are rare.
    HAZE: [{ move: 'inspect', weight: 3 }, { move: 'roll', weight: 3 }, { move: 'peace', weight: 3 }, { move: 'mutter', weight: 2 }, { move: 'wave', weight: 2 }, { move: 'rofl', weight: 0.6 }],
    BUDZ: [{ move: 'giggle', weight: 3 }, { move: 'rub', weight: 2 }, { move: 'whoop', weight: 2 }, { move: 'mutter', weight: 2 }, { move: 'daydream', weight: 1.5, pop: true }, { move: 'crush', weight: 0.5, pop: true }],
    LEAFY: [{ move: 'drowsy', weight: 1 }],
  },
};
