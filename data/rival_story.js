// A short, skippable comic scene each time you beat a rival, building up to The Velvet Investor.
// Written by Claude Code for jobs 5 and 6. Aaron hasn't seen or approved these. Easy to change: it's only data.
// who: RIVAL (the beaten rival's own portrait), or HAZE, BUDZ, LEAFY with a sprite id in face. Each has 3-5 lines.
(globalThis.PE = globalThis.PE || {}).Data = globalThis.PE.Data || {};
globalThis.PE.Data.rivalStory = {
  'RIVAL-01': { title: 'Chapter 1: The old lounge', lines: [
    { who: 'RIVAL', text: 'Beaten by a garage? In my day, we had standards. And velvet curtains.' },
    { who: 'BUDZ', face: 'BUDZ-19', text: 'We won a lounge! It smells like 1974 and regret!' },
    { who: 'HAZE', face: 'HAZE-04', text: 'Velvet, huh. Funny. Somebody keeps buying up this town, and they sign everything in velvet ink.' },
  ] },
  'RIVAL-02': { title: 'Chapter 2: Lights out', lines: [
    { who: 'RIVAL', text: "Fine, the club's yours. Just keep the neon on. It's the only thing paying me back." },
    { who: 'LEAFY', face: 'LEAFY-19', text: 'It has a fog machine, a lost-property box and eleven unpaid bills.' },
    { who: 'BUDZ', face: 'BUDZ-19', text: "We got a CLUB! Wait, why's there a letter here offering to buy it? From someone called The Velvet Investor?" },
  ] },
  'RIVAL-03': { title: 'Chapter 3: The tall office', lines: [
    { who: 'RIVAL', text: 'I only ever rented this tower. Somebody much richer owns the ground under it.' },
    { who: 'HAZE', face: 'HAZE-05', text: 'Nobody owns the ground, man. Except, apparently, this one person.' },
    { who: 'LEAFY', face: 'LEAFY-19', text: "That's three rivals with the same landlord. I've started a spreadsheet. On a leaf. Again." },
  ] },
  'RIVAL-04': { title: 'Chapter 4: All that glitters', lines: [
    { who: 'RIVAL', text: "Keep the mansion! The gold's only paint anyway. Don't tell anyone." },
    { who: 'BUDZ', face: 'BUDZ-45', text: 'I licked a door handle to check. Can confirm: paint.' },
    { who: 'LEAFY', face: 'LEAFY-22', text: "Please stop licking our assets." },
    { who: 'HAZE', face: 'HAZE-38', text: 'Painted gold. Painted smile. This Velvet character sure likes things that only look expensive.' },
  ] },
  'RIVAL-05': { title: 'Chapter 5: Stage fright', lines: [
    { who: 'RIVAL', text: 'You stole my audience! They said your plants have better stage presence.' },
    { who: 'BUDZ', face: 'BUDZ-45', text: "We ARE the better stage presence!" },
    { who: 'LEAFY', face: 'LEAFY-23', text: "The speakers just crackled on by themselves. A very smooth voice said: 'Enjoy it while it lasts.'" },
    { who: 'BUDZ', face: 'BUDZ-20', text: "Rude! Also, can we keep the speakers?" },
  ] },
  'RIVAL-06': { title: 'Chapter 6: Odd results', lines: [
    { who: 'RIVAL', text: "My sums say you can't win. My sums also said this lab wouldn't catch fire, so." },
    { who: 'HAZE', face: 'HAZE-04', text: 'I respect a scientist who shows his burns.' },
    { who: 'LEAFY', face: 'LEAFY-22', text: 'The notes here say someone paid for all this research, then hid it. Guess whose ink it is.' },
  ] },
  'RIVAL-07': { title: 'Chapter 7: Last dance', lines: [
    { who: 'RIVAL', text: 'The disco is yours, darling. Mind the floor. And mind the Investor. Nobody says no twice.' },
    { who: 'BUDZ', face: 'BUDZ-37', text: 'The floor lights up when I walk on it! I am never leaving.' },
    { who: 'HAZE', face: 'HAZE-05', text: "Nobody says no twice. Lucky for us, we've never said it once. We just keep growing." },
  ] },
  'RIVAL-08': { title: 'Chapter 8: Wiped out', lines: [
    { who: 'RIVAL', text: 'Okay, that was gnarly. You can have the ramps. I was only ever here for the ramps.' },
    { who: 'LEAFY', face: 'LEAFY-23', text: 'A grey van has parked outside all three of our depots. It has very clean windows. Suspiciously clean.' },
    { who: 'BUDZ', face: 'BUDZ-37', text: "RAMPS! And vans! Let's wave at them!" },
    { who: 'HAZE', face: 'HAZE-04', text: "Wave nice, kid. Let 'em count how many hands we've got now." },
  ] },
  'RIVAL-09': { title: 'Chapter 9: End of the rainbow', lines: [
    { who: 'RIVAL', text: 'My van yard is all yours. Half of them already had a velvet sticker on the bumper anyway.' },
    { who: 'HAZE', face: 'HAZE-38', text: "So the end of the rainbow's a parking lot. Sounds about right." },
    { who: 'LEAFY', face: 'LEAFY-23', text: "That's nine rivals, one shadowy buyer and zero surprises. I've stopped being shocked. Mostly." },
  ] },
  'RIVAL-10': { title: 'Chapter 10: Steel nerve', lines: [
    { who: 'RIVAL', text: 'I built half this city in steel. The Investor owns the other half, and wants mine too.' },
    { who: 'BUDZ', face: 'BUDZ-20', text: 'What do we want with half a city?' },
    { who: 'LEAFY', face: 'LEAFY-19', text: 'Parking, mainly.' },
    { who: 'HAZE', face: 'HAZE-22', text: "Then that's the half we keep. Man, I've never owned half a city before. Feels about the same." },
  ] },
  'RIVAL-11': { title: 'Chapter 11: Petals fall', lines: [
    { who: 'RIVAL', text: "The boutique's yours. Be careful up on the hill, sweetie. That tower has been waiting for you." },
    { who: 'LEAFY', face: 'LEAFY-22', text: "An invitation came. Velvet envelope. It says 'Do come up. Bring the garage.'" },
    { who: 'BUDZ', face: 'BUDZ-20', text: "One rival left. I'm not scared. Leafy's scared. I'm just standing behind Leafy for tactical reasons." },
    { who: 'HAZE', face: 'HAZE-05', text: 'Put your good shoes on, kids. We got a meeting.' },
  ] },
  'RIVAL-12': { title: 'Final chapter: The Velvet Investor', lines: [
    { who: 'RIVAL', text: 'I bought every rival you ever faced. And you beat them all from a garage. How very... inconvenient.' },
    { who: 'BUDZ', face: 'BUDZ-37', text: 'Is this a good time to mention we also own your parking?' },
    { who: 'LEAFY', face: 'LEAFY-19', text: "I've checked the paperwork. Twice. On several leaves. It's ours. All of it." },
    { who: 'RIVAL', text: "Then let me make one last offer. I'd like to invest. A small share. Velvet, naturally." },
    { who: 'HAZE', face: 'HAZE-42', text: "You can't buy a good plant, friend. You can only grow one. Welcome to the empire, everybody!" },
  ] },
};
