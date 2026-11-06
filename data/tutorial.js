// The words for the first-time guide, the one-time hints and the 18+ screen. Aaron can edit all of this.
// Written by Claude Code for big job 3. Aaron hasn't seen or approved these lines yet.
//
// A guide step:
//   who, face   HAZE, BUDZ or LEAFY, and the sprite id (art/characters/helpers/HELPER_ART.md says what each shows)
//   text        what they say
//   point       what the bouncing arrow points at (js/ui/tutorial_ui.js has the list). Leave out for none.
//   until       what ends the step (js/logic/tutorial.js has the list). 'next' means a Continue button.
//   talk        the helper fills the bottom of the screen, with a round bubble and Continue. Without it: a short spiky tip.
//   move        what they play while they say it (data/anim_moves.js has the names). Without one: chat.
//   drag        which tool the guide hand shows being dragged: seed, water or shears. Tapping still works.
//   camera      'close' keeps the room's camera right in on the first pot. Otherwise it pulls back.
//   drain       the station's water meter is low when this step starts, so watering has something to do
//   skipIf      skip this step when it can't be done (say, on a replay with no empty pots)
//   needs       this step only makes sense while this is true; if it stops being true, go back a step
//   gift        hand over just enough cash for the first upgrade, once ever
//   speedUp     offer a free "grow it now" button, once ever
//
// A hint: rule says when (js/logic/tutorial.js has the list); it shows once, then never again.
(globalThis.PE = globalThis.PE || {}).Data = globalThis.PE.Data || {};
globalThis.PE.Data.tutorial = {
  steps: [
    { id: 'welcome', who: 'HAZE', face: 'HAZE-27', move: 'greet', talk: true, camera: 'close', text: "Kid! You made it. This garage is all that's left of the family business. Let's wake it up.", until: 'next' },
    { id: 'seed', who: 'HAZE', face: 'HAZE-03', camera: 'close', drag: 'seed', text: 'Drag the seed onto the pot!', point: 'seedTarget', until: 'plantedOne', skipIf: 'noEmptyPot' },
    { id: 'lights', who: 'BUDZ', face: 'BUDZ-19', move: 'cheer', talk: true, camera: 'close', text: "Lights on! See that? The whole place wakes up when something's growing.", until: 'next' },
    { id: 'water', who: 'LEAFY', face: 'LEAFY-03', camera: 'close', drag: 'water', drain: true, text: 'Thirsty! Drag the water onto it.', point: 'firstPlant', until: 'wateredOne', skipIf: 'nothingGrowing' },
    { id: 'wait', who: 'BUDZ', face: 'BUDZ-03', camera: 'close', text: 'Growing! First one is on me. Tap to grow it now.', until: 'somethingRipe', speedUp: true, skipIf: 'nothingGrowing' },
    { id: 'harvest', who: 'HAZE', face: 'HAZE-04', camera: 'close', drag: 'shears', text: 'See it glow? Drag the shears across it!', point: 'ripePot', until: 'harvested', skipIf: 'nothingRipe' },
    { id: 'sold', who: 'LEAFY', face: 'LEAFY-03', move: 'think', talk: true, text: 'Buds sell by themselves. Cash goes up top. Please do not spend it all on sneakers. Budz.', point: 'cash', until: 'next' },
    { id: 'seedAgain', who: 'HAZE', face: 'HAZE-03', drag: 'seed', text: 'Plant another one.', point: 'seedTarget', until: 'plantedOne', skipIf: 'noEmptyPot' },
    { id: 'bench', who: 'HAZE', face: 'HAZE-22', text: 'A little startup envelope. Tap the bench.', point: 'firstBench', until: 'stationOpen', gift: true, skipIf: 'cantUpgrade' },
    { id: 'upgrade', who: 'BUDZ', face: 'BUDZ-21', text: 'A bigger light! Faster plants!', point: 'upgradeLight', until: 'upgraded', needs: 'stationOpen', skipIf: 'stationShut' },
    { id: 'closeSheet', who: 'LEAFY', face: 'LEAFY-03', text: 'Good. Close that before Budz buys another.', point: 'closePanel', until: 'noPanel', skipIf: 'stationShut' },
    { id: 'toMap', who: 'BUDZ', face: 'BUDZ-37', text: "Now the fun bit. Let's see the neighbourhood!", point: 'navEmpire', until: 'onMap', skipIf: 'onMap' },
    { id: 'map', who: 'HAZE', face: 'HAZE-42', move: 'clap', talk: true, text: "This is Old Town. Tap a building to go in. A red mark means something's waiting. That's the job. I'm gonna have a nap.", until: 'next' },
  ],

  hints: [
    { id: 'station', move: 'think', rule: 'stationReady', who: 'LEAFY', face: 'LEAFY-24', text: 'A new station can be bought in the Garage now. Look for the button above the tabs.' },
    { id: 'hydro', move: 'clap', rule: 'modelReady', who: 'HAZE', face: 'HAZE-40', text: "That station's ready for a whole new hydro model. Tap its bench. Parts go back to level 1, but it grows a lot more. Trust me. I've read a pamphlet." },
    { id: 'managers', move: 'cheer', rule: 'hasManager', who: 'BUDZ', face: 'BUDZ-21', text: 'You got a manager! Collection tab, then Managers. Put them on a station and they work for you. Duplicates level them up!' },
    { id: 'shop', move: 'think', rule: 'hasRetail', who: 'LEAFY', face: 'LEAFY-28', text: "You own a shop. Stock each shelf and customers buy by themselves, even while you're away. In the game. Only in the game." },
    { id: 'factory', move: 'clap', rule: 'hasFactory', who: 'HAZE', face: 'HAZE-40', text: 'A factory! Your crop goes in, products come out, and products sell for more.' },
    { id: 'recipes', move: 'think', rule: 'inFactory', who: 'LEAFY', face: 'LEAFY-24', text: 'Each product has a recipe card. Green ticks mean you have enough. Red means go and make the missing thing first.' },
    { id: 'festival', move: 'cheer', rule: 'festivalOn', who: 'BUDZ', face: 'BUDZ-48', text: 'FESTIVAL! Every harvest scores points, and there are prizes all the way up. Tap Festival on the map.' },
    { id: 'prestige', move: 'chat', rule: 'prestigeOpen', who: 'HAZE', face: 'HAZE-38', text: "Prestige is open. You restart one district's gear for shares that boost every harvest forever. It's optional. No rush, kid." },
    { id: 'calendar', move: 'think', rule: 'calendarReady', who: 'LEAFY', face: 'LEAFY-03', text: 'Daily calendar: a free thing for each day you visit. Miss a day and it just waits. We are not monsters.' },
    { id: 'district', move: 'cheer', rule: 'secondDistrict', who: 'BUDZ', face: 'BUDZ-37', text: 'A new district! Tap the district button at the bottom of the map to go and look.' },
  ],

  // The intro comic: it plays once, before the very first go. Settings can replay it. art: INTRO-01..04 once drawn.
  intro: [
    { art: 'INTRO-01', stand: 'town', text: 'Once, this town was the friendliest place on Earth. Every garden had a garden gnome. And some of them were smiling for a reason.' },
    { art: 'INTRO-02', stand: 'velvet', text: "Then came The Velvet Investor. Shop by shop, street by street, he's buying up the whole town." },
    { art: 'INTRO-03', stand: 'haze', text: 'Only Uncle Haze held out. "They can have my shop, kid. They can\'t have my garage."' },
    { art: 'INTRO-04', stand: 'garage', text: 'So he left you the keys. One garage. One bulb. One seed. Time to take this town back.' },
  ],

  ageGate: {
    question: 'This game is for adults. Are you 18 or older?',
    yes: "I'm 18 or older",
    no: 'Exit',
    notice: 'Pot Empire Tycoon is a work of fiction. It gives no real growing instructions and sells nothing real. Nothing in it is advice, or an invitation to do anything your local laws forbid.',
    goodbye: "No worries. Come back when you're 18.",
    back: 'I answered wrong: go back',
  },
};
