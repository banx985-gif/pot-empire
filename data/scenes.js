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

  welcomeBack: {
    plain: [
      { who: 'HAZE', move: 'greet', text: 'There you are, kid. The place ran itself. Mostly.', react: { BUDZ: 'cheer' } },
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
    wilted: { BUDZ: 'angry', HAZE: 'angry', LEAFY: 'puzzled' },
    locked: { LEAFY: 'puzzled', HAZE: 'shrug', BUDZ: 'shrug' },
    rival: { BUDZ: 'angry', HAZE: 'angry', LEAFY: 'puzzled' },
  },
};
