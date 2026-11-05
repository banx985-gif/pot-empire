// The words for the first-time guide, the one-time hints and the 18+ screen. Aaron can edit all of this.
// Written by Claude Code for big job 3. Aaron hasn't seen or approved these lines yet.
//
// A guide step:
//   who, face   HAZE, BUDZ or LEAFY, and the sprite id (art/characters/helpers/HELPER_ART.md says what each shows)
//   text        what they say
//   point       what the bouncing arrow points at (js/ui/tutorial_ui.js has the list). Leave out for none.
//   until       what ends the step (js/logic/tutorial.js has the list). 'next' means a Next button.
//   skipIf      skip this step when it can't be done (say, on a replay with no empty pots)
//   needs       this step only makes sense while this is true; if it stops being true, go back a step
//   gift        hand over just enough cash for the first upgrade, once ever
//   speedUp     offer a free "grow it now" button, once ever
//
// A hint: rule says when (js/logic/tutorial.js has the list); it shows once, then never again.
(globalThis.PE = globalThis.PE || {}).Data = globalThis.PE.Data || {};
globalThis.PE.Data.tutorial = {
  steps: [
    { id: 'welcome', who: 'HAZE', face: 'HAZE-27', text: "Welcome to the family business, kid. Well. Family garage. I'm your Uncle Haze, and these are the only two employees who work for snacks.", until: 'next' },
    { id: 'crew', who: 'BUDZ', face: 'BUDZ-19', text: "I'm Budz! I'm in charge of enthusiasm. Leafy's in charge of telling me to calm down.", until: 'next' },
    { id: 'plantPot', who: 'HAZE', face: 'HAZE-03', text: 'Empty pots are just sad hats. Tap this one.', point: 'firstEmptyPot', until: 'pickerOpen', skipIf: 'noEmptyPot' },
    { id: 'pickStrain', who: 'LEAFY', face: 'LEAFY-03', text: 'Pick Sunny Sprout. It grows fast and asks no questions.', point: 'firstStrain', until: 'plantedOne', needs: 'pickerOpen', skipIf: 'pickerShut' },
    { id: 'wait', who: 'BUDZ', face: 'BUDZ-03', text: "Now we wait! Or don't! First one's on me: tap the button and it's ready. Normally you'd just come back later. Nothing here ever dies.", until: 'somethingRipe', speedUp: true, skipIf: 'nothingGrowing' },
    { id: 'harvest', who: 'HAZE', face: 'HAZE-04', text: 'Look at that. Tap it to harvest. Harvests sell themselves, which is more than I can say for your cousin.', point: 'ripePot', until: 'harvested', skipIf: 'nothingRipe' },
    { id: 'sold', who: 'LEAFY', face: 'LEAFY-03', text: 'Cash goes up here. Please do not spend it all on sneakers. Budz.', point: 'cash', until: 'next' },
    { id: 'bench', who: 'HAZE', face: 'HAZE-22', text: "Here, a little startup envelope. Don't tell your aunt. Tap the bench to soup this station up.", point: 'firstBench', until: 'stationOpen', gift: true, skipIf: 'cantUpgrade' },
    { id: 'upgrade', who: 'BUDZ', face: 'BUDZ-21', text: 'A bigger light! Plants grow faster, and it looks way cooler. Mostly the second one.', point: 'upgradeLight', until: 'upgraded', needs: 'stationOpen', skipIf: 'stationShut' },
    { id: 'closeSheet', who: 'LEAFY', face: 'LEAFY-03', text: 'Good. Now close that before Budz buys another one.', point: 'closePanel', until: 'noPanel', skipIf: 'stationShut' },
    { id: 'second', who: 'HAZE', face: 'HAZE-03', text: "You've got a second station too. Two is a business, kid. Plant something there. More stations open up as this place grows.", point: 'secondEmptyPot', until: 'pickerOpen', skipIf: 'noSecondPot' },
    { id: 'pickSecond', who: 'LEAFY', face: 'LEAFY-03', text: 'Any strain you own will do.', point: 'firstStrain', until: 'plantedTwo', needs: 'pickerOpen', skipIf: 'pickerShut' },
    { id: 'toMap', who: 'BUDZ', face: 'BUDZ-37', text: "Now the fun bit! Come see the whole neighbourhood. We're gonna own it. Probably.", point: 'navEmpire', until: 'onMap', skipIf: 'onMap' },
    { id: 'map', who: 'HAZE', face: 'HAZE-42', text: "This is Old Town. Tap any building to go in. A red mark means something's waiting for you. That's the job. Go on, I'm gonna have a nap.", until: 'next' },
  ],

  hints: [
    { id: 'station', rule: 'stationReady', who: 'LEAFY', face: 'LEAFY-24', text: 'A new station can be bought in the Garage now. Look for the button above the tabs.' },
    { id: 'hydro', rule: 'modelReady', who: 'HAZE', face: 'HAZE-40', text: "That station's ready for a whole new hydro model. Tap its bench. Parts go back to level 1, but it grows a lot more. Trust me. I've read a pamphlet." },
    { id: 'managers', rule: 'hasManager', who: 'BUDZ', face: 'BUDZ-21', text: 'You got a manager! Collection tab, then Managers. Put them on a station and they work for you. Duplicates level them up!' },
    { id: 'shop', rule: 'hasRetail', who: 'LEAFY', face: 'LEAFY-28', text: "You own a shop. Stock each shelf and customers buy by themselves, even while you're away. In the game. Only in the game." },
    { id: 'factory', rule: 'hasFactory', who: 'HAZE', face: 'HAZE-40', text: 'A factory! Your crop goes in, products come out, and products sell for more.' },
    { id: 'recipes', rule: 'inFactory', who: 'LEAFY', face: 'LEAFY-24', text: 'Each product has a recipe card. Green ticks mean you have enough. Red means go and make the missing thing first.' },
    { id: 'festival', rule: 'festivalOn', who: 'BUDZ', face: 'BUDZ-48', text: 'FESTIVAL! Every harvest scores points, and there are prizes all the way up. Tap Festival on the map.' },
    { id: 'prestige', rule: 'prestigeOpen', who: 'HAZE', face: 'HAZE-38', text: "Prestige is open. You restart one district's gear for shares that boost every harvest forever. It's optional. No rush, kid." },
    { id: 'calendar', rule: 'calendarReady', who: 'LEAFY', face: 'LEAFY-03', text: 'Daily calendar: a free thing for each day you visit. Miss a day and it just waits. We are not monsters.' },
    { id: 'district', rule: 'secondDistrict', who: 'BUDZ', face: 'BUDZ-37', text: 'A new district! Tap the district button at the bottom of the map to go and look.' },
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
