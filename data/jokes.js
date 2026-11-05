// Helper jokes (bible sections 1, 9, 10A, 14A): Uncle Haze, Budz and Leafy say something short now and
// then, only when something worth noticing happens. Every line can be skipped with one tap.
//
// STARTER LIST, written by Claude Code for overnight job 2. Aaron hasn't seen or approved these.
// Adult-themed but clean: no crude jokes, no real brands, nothing that reads as real-world advice.
//
// Each joke: id (stable, never reuse), helper (HAZE / BUDZ / LEAFY), event, text, and fourthWall: true
// for the few that wink at the player or the game itself.
// face: the expression the line opens with. face2: the expression it changes to partway through a longer
// line. Both are sprite ids; art/characters/helpers/HELPER_ART.md says what each one shows.
// Events (what the rules send, see js/logic/helpers.js):
//   firstHarvest  the very first harvest          automation  first station on full auto
//   rareFind      first Rare-or-better strain      bigUpgrade  a new hydro model installed
//   facility      a facility bought                prestige    a regional prestige
//   idleReturn    back after a long time away      rank        every 10th Empire Rank
//   setComplete   a six-piece set finished         rival       a rival CEO beaten
//   chat          tapped on the Empire map (the rules never say these by themselves)
(globalThis.PE = globalThis.PE || {}).Data = globalThis.PE.Data || {};
globalThis.PE.Data.jokes = [
  // ---- First harvest ----
  { id: 'J001', helper: 'HAZE', event: 'firstHarvest', face: 'HAZE-40', face2: 'HAZE-05', text: "Your first harvest! I remember mine. Well. I remember the general vibe of mine." },
  { id: 'J002', helper: 'BUDZ', event: 'firstHarvest', face: 'BUDZ-37', face2: 'BUDZ-07', text: "One plant down, an empire to go! Okay, that's a lot to go. But we're GOING!" },
  { id: 'J003', helper: 'LEAFY', event: 'firstHarvest', face: 'LEAFY-21', face2: 'LEAFY-14', text: "It sold itself the moment you picked it. That's what we call low customer friction." },

  // ---- First automation ----
  { id: 'J010', helper: 'HAZE', event: 'automation', face: 'HAZE-38', face2: 'HAZE-04', text: "Auto-harvest and auto-replant. The plants do the work now. Just like I planned in 1974." },
  { id: 'J011', helper: 'LEAFY', event: 'automation', face: 'LEAFY-24', face2: 'LEAFY-17', text: "Automation is on. You may now rest your tapping finger. It has served with honour." },
  { id: 'J012', helper: 'BUDZ', event: 'automation', face: 'BUDZ-48', face2: 'BUDZ-10', text: "It runs while you're away?! This is the greatest day of my small green life!" },

  // ---- Rare finds ----
  { id: 'J020', helper: 'HAZE', event: 'rareFind', face: 'HAZE-33', face2: 'HAZE-08', text: "Ooh, that one's special. Look at those buds. Don't look too long, they get shy." },
  { id: 'J021', helper: 'BUDZ', event: 'rareFind', face: 'BUDZ-39', face2: 'BUDZ-12', text: "A RARE one! I'm not crying, you're crying. Okay I'm crying a bit." },
  { id: 'J022', helper: 'LEAFY', event: 'rareFind', face: 'LEAFY-26', face2: 'LEAFY-12', text: "Rarer strains take longer and sell for more. I wrote that down. On a leaf. It blew away." },
  { id: 'J023', helper: 'HAZE', event: 'rareFind', face: 'HAZE-29', face2: 'HAZE-06', text: "Back in my day we only had one strain. It was called 'the strain'. This is better." },
  { id: 'J024', helper: 'LEAFY', event: 'rareFind', face: 'LEAFY-23', face2: 'LEAFY-13', text: "If the artist drew this one, it looks amazing. If you see a plain box, they're still drawing it.", fourthWall: true },

  // ---- Big upgrades (new hydro model) ----
  { id: 'J030', helper: 'BUDZ', event: 'bigUpgrade', face: 'BUDZ-45', face2: 'BUDZ-08', text: "New hydro model! Shiny! It even smells new. Is that the paint or the plants?" },
  { id: 'J031', helper: 'HAZE', event: 'bigUpgrade', face: 'HAZE-31', face2: 'HAZE-03', text: "The parts went back to level one. That's not a loss, man. That's a fresh start with a better frame." },
  { id: 'J032', helper: 'LEAFY', event: 'bigUpgrade', face: 'LEAFY-19', face2: 'LEAFY-12', text: "I read the reset box twice so you didn't have to. You did read it, though. Right?" },
  { id: 'J033', helper: 'HAZE', event: 'bigUpgrade', face: 'HAZE-37', face2: 'HAZE-04', text: "Every model's a whole new look. Like me changing sunglasses. Except I never change sunglasses." },

  // ---- Facilities ----
  { id: 'J040', helper: 'BUDZ', event: 'facility', face: 'BUDZ-21', face2: 'BUDZ-06', text: "Another building! At this rate we'll need a map. Oh wait, we have a map. Nice." },
  { id: 'J041', helper: 'HAZE', event: 'facility', face: 'HAZE-27', face2: 'HAZE-06', text: "More floor space. More room to grow. More room to lose my keys." },
  { id: 'J042', helper: 'LEAFY', event: 'facility', face: 'LEAFY-29', face2: 'LEAFY-14', text: "New facility unlocked. I've already colour-coded it in my head." },
  { id: 'J043', helper: 'HAZE', event: 'facility', face: 'HAZE-41', face2: 'HAZE-03', text: "Remember the garage? Look at you now. I'd hug you, but I'm a picture.", fourthWall: true },

  // ---- Prestige ----
  { id: 'J050', helper: 'HAZE', event: 'prestige', face: 'HAZE-40', face2: 'HAZE-02', text: "You reset a whole district for Empire Shares. Bold. Zen. Very me." },
  { id: 'J051', helper: 'LEAFY', event: 'prestige', face: 'LEAFY-26', face2: 'LEAFY-22', text: "Everything in that district grows faster now, forever. Forever is a long time. I checked." },
  { id: 'J052', helper: 'BUDZ', event: 'prestige', face: 'BUDZ-37', face2: 'BUDZ-10', text: "Prestige! It's like starting over, but with a cooler hat. We don't have hats. Yet." },

  // ---- Back after a long time away ----
  { id: 'J060', helper: 'HAZE', event: 'idleReturn', face: 'HAZE-39', face2: 'HAZE-21', text: "Oh hey, you're back. I didn't move. I'm a very good waiter." },
  { id: 'J061', helper: 'BUDZ', event: 'idleReturn', face: 'BUDZ-23', face2: 'BUDZ-07', text: "You're BACK! The plants kept growing! I kept talking! Nobody listened!" },
  { id: 'J062', helper: 'LEAFY', event: 'idleReturn', face: 'LEAFY-27', face2: 'LEAFY-18', text: "While you were away: nothing died. Plants here never die. That's company policy." },
  { id: 'J063', helper: 'HAZE', event: 'idleReturn', face: 'HAZE-21', face2: 'HAZE-06', text: "You closed the app. It went dark. Very peaceful. Then you opened it. Also nice.", fourthWall: true },
  { id: 'J064', helper: 'LEAFY', event: 'idleReturn', face: 'LEAFY-22', face2: 'LEAFY-16', text: "Welcome back. I'd ask where you went, but I live inside a phone, so I don't really have a frame of reference.", fourthWall: true },
  { id: 'J065', helper: 'BUDZ', event: 'idleReturn', face: 'BUDZ-47', face2: 'BUDZ-03', text: "No daily streak to lose here. Come and go like the breeze, friend." },

  // ---- Every 10th rank ----
  { id: 'J070', helper: 'BUDZ', event: 'rank', face: 'BUDZ-53', face2: 'BUDZ-20', text: "Another ten ranks! Do a little dance! I'll wait. I can't see you, so I'll assume you did.", fourthWall: true },
  { id: 'J071', helper: 'HAZE', event: 'rank', face: 'HAZE-31', face2: 'HAZE-06', text: "There's no top rank, you know. It's levels all the way up. Like a really tall plant." },
  { id: 'J072', helper: 'LEAFY', event: 'rank', face: 'LEAFY-36', face2: 'LEAFY-12', text: "Your Empire Rank went up. Your Empire Rank is now higher. I've been asked to keep these short." },
  { id: 'J073', helper: 'HAZE', event: 'rank', face: 'HAZE-30', face2: 'HAZE-04', text: "Rank sixty isn't the end, man. The game just keeps going. Like my stories." },
  { id: 'J074', helper: 'BUDZ', event: 'rank', face: 'BUDZ-40', face2: 'BUDZ-20', text: "Ten more ranks of pure green glory! I'd throw confetti, but the game already did." },

  // ---- Set complete ----
  { id: 'J080', helper: 'LEAFY', event: 'setComplete', face: 'LEAFY-28', face2: 'LEAFY-07', text: "A full set! All six! I love it when things match." },
  { id: 'J081', helper: 'HAZE', event: 'setComplete', face: 'HAZE-30', face2: 'HAZE-10', text: "Six of a kind. That's a full set, or a very small band." },
  { id: 'J082', helper: 'BUDZ', event: 'setComplete', face: 'BUDZ-24', face2: 'BUDZ-19', text: "SET COMPLETE! What do we collect next? Everything? Everything." },

  // ---- Rivals ----
  { id: 'J090', helper: 'BUDZ', event: 'rival', face: 'BUDZ-43', face2: 'BUDZ-44', text: "You beat a rival CEO! No hard feelings. Okay, some hard feelings. Theirs, not ours." },
  { id: 'J091', helper: 'HAZE', event: 'rival', face: 'HAZE-28', face2: 'HAZE-05', text: "Rivals come and go. Good plants stay. That's on a poster somewhere. I made the poster." },
  { id: 'J092', helper: 'LEAFY', event: 'rival', face: 'LEAFY-25', face2: 'LEAFY-21', text: "Rival beaten. I'll add them to the list of people who underestimated a garage." },

  // ---- Tapped on the Empire map ----
  { id: 'J100', helper: 'HAZE', event: 'chat', face: 'HAZE-27', face2: 'HAZE-03', text: "Hey, you found me. I was just standing here, supervising. It's harder than it looks." },
  { id: 'J101', helper: 'HAZE', event: 'chat', face: 'HAZE-29', face2: 'HAZE-05', text: "See that road? I'm almost sure it goes somewhere. I've been meaning to check since 1974." },
  { id: 'J102', helper: 'HAZE', event: 'chat', face: 'HAZE-30', face2: 'HAZE-06', text: "Nice little empire you've got. Mind if I lean on it?" },
  { id: 'J103', helper: 'BUDZ', event: 'chat', face: 'BUDZ-53', face2: 'BUDZ-07', text: "Hi! Hi! You tapped me! Nobody ever taps me! Well, you did. Just then. Hi!" },
  { id: 'J104', helper: 'BUDZ', event: 'chat', face: 'BUDZ-43', face2: 'BUDZ-03', text: "I counted the vans. There's more of them than yesterday. Or I can't count. Either way, good news." },
  { id: 'J105', helper: 'BUDZ', event: 'chat', face: 'BUDZ-37', face2: 'BUDZ-10', text: "Did you see the balloon? There's a balloon sometimes! Tap it! It's free! I love free!" },
  { id: 'J106', helper: 'LEAFY', event: 'chat', face: 'LEAFY-25', face2: 'LEAFY-14', text: "Yes? I'm busy watching things grow. It's slower than you'd think, and I'm very good at it." },
  { id: 'J107', helper: 'LEAFY', event: 'chat', face: 'LEAFY-26', face2: 'LEAFY-13', text: "A red mark means something's ready. It goes away when it isn't. Unlike some games I could mention.", fourthWall: true },
  { id: 'J108', helper: 'LEAFY', event: 'chat', face: 'LEAFY-27', face2: 'LEAFY-18', text: "That empty patch of grass is reserved. For what? Nobody tells me anything." },
];
