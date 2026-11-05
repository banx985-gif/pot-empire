// A short, skippable story scene each time you beat a rival, building up to The Velvet Investor.
// Written by Claude Code for job 5. Aaron hasn't seen or approved these. Easy to change: it's only data.
// who: RIVAL (the beaten rival's own portrait), or HAZE, BUDZ, LEAFY with a sprite id in face.
(globalThis.PE = globalThis.PE || {}).Data = globalThis.PE.Data || {};
globalThis.PE.Data.rivalStory = {
  'RIVAL-01': { title: 'Chapter 1: The old lounge', lines: [
    { who: 'RIVAL', text: "Beaten by a garage? In my day, we had standards. And velvet curtains." },
    { who: 'HAZE', face: 'HAZE-04', text: "Velvet, huh. Funny. Somebody keeps buying up this town, and they sign everything in velvet ink." },
  ] },
  'RIVAL-02': { title: 'Chapter 2: Lights out', lines: [
    { who: 'RIVAL', text: "Fine, the club's yours. Just keep the neon on. It's the only thing paying me back." },
    { who: 'BUDZ', face: 'BUDZ-19', text: "We got a CLUB! Wait, why's there a letter here offering to buy it? From someone called The Velvet Investor?" },
  ] },
  'RIVAL-03': { title: 'Chapter 3: The tall office', lines: [
    { who: 'RIVAL', text: "I only ever rented this tower. Somebody much richer owns the ground under it." },
    { who: 'LEAFY', face: 'LEAFY-19', text: "That's three rivals with the same landlord. I've started a spreadsheet. On a leaf. Again." },
  ] },
  'RIVAL-04': { title: 'Chapter 4: All that glitters', lines: [
    { who: 'RIVAL', text: "Keep the mansion! The gold's only paint anyway. Don't tell anyone." },
    { who: 'HAZE', face: 'HAZE-38', text: "Painted gold. Painted smile. This Velvet character sure likes things that only look expensive." },
  ] },
  'RIVAL-05': { title: 'Chapter 5: Stage fright', lines: [
    { who: 'RIVAL', text: "You stole my audience! They said your plants have better stage presence." },
    { who: 'BUDZ', face: 'BUDZ-45', text: "We ARE the better stage presence! Also the speakers just played a message: 'Enjoy it while it lasts.' Rude!" },
  ] },
  'RIVAL-06': { title: 'Chapter 6: Odd results', lines: [
    { who: 'RIVAL', text: "My sums say you can't win. My sums also said this lab wouldn't catch fire, so." },
    { who: 'LEAFY', face: 'LEAFY-22', text: "The notes here say someone paid for all this research, then hid it. Guess whose ink it's in." },
  ] },
  'RIVAL-07': { title: 'Chapter 7: Last dance', lines: [
    { who: 'RIVAL', text: "The disco is yours, darling. Mind the floor. And mind the Investor. Nobody says no twice." },
    { who: 'HAZE', face: 'HAZE-05', text: "Nobody says no twice. Lucky for us, we've never said it once. We just keep growing." },
  ] },
  'RIVAL-08': { title: 'Chapter 8: Wiped out', lines: [
    { who: 'RIVAL', text: "Okay, that was gnarly. You can have the ramps. I was only ever here for the ramps." },
    { who: 'BUDZ', face: 'BUDZ-37', text: "RAMPS! And a free tip: the Investor's vans have been watching our deliveries. Let's wave at them!" },
  ] },
  'RIVAL-09': { title: 'Chapter 9: End of the rainbow', lines: [
    { who: 'RIVAL', text: "My van yard's all yours. Half of them already had a velvet sticker on the bumper anyway." },
    { who: 'LEAFY', face: 'LEAFY-23', text: "So that's nine rivals, one shadowy buyer and zero surprises. I've stopped being shocked. Mostly." },
  ] },
  'RIVAL-10': { title: 'Chapter 10: Steel nerve', lines: [
    { who: 'RIVAL', text: "I built half this city in steel. The Investor owns the other half, and wants mine too." },
    { who: 'HAZE', face: 'HAZE-22', text: "Then that's the half we keep. Man, I've never owned half a city before. Feels about the same." },
  ] },
  'RIVAL-11': { title: 'Chapter 11: Petals fall', lines: [
    { who: 'RIVAL', text: "The boutique's yours. Be careful up on the hill, sweetie. That tower has been waiting for you." },
    { who: 'BUDZ', face: 'BUDZ-20', text: "One rival left. I'm not scared. Leafy's scared. I'm just standing behind Leafy for tactical reasons." },
  ] },
  'RIVAL-12': { title: 'Final chapter: The Velvet Investor', lines: [
    { who: 'RIVAL', text: "I bought every rival you ever faced. And you beat them all from a garage. How very... inconvenient." },
    { who: 'HAZE', face: 'HAZE-42', text: "Told you, man. You can't buy a good plant. You can only grow one. Welcome to the empire, everybody!" },
  ] },
};
