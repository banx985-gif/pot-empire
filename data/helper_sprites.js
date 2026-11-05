// Which helper picture shows when. Change anything here freely: it's only data.
// What each sprite id shows is listed in art/characters/helpers/HELPER_ART.md.
// The expressions for each joke are in data/jokes.js (face, and face2 for later in a longer line).
(globalThis.PE = globalThis.PE || {}).Data = globalThis.PE.Data || {};
globalThis.PE.Data.helperSprites = {
  // How many sprites each helper has: HAZE-01 up to HAZE-48, and so on.
  counts: { HAZE: 48, BUDZ: 54, LEAFY: 36 },

  // Used if a line arrives with no expression of its own.
  defaultFace: { HAZE: 'HAZE-03', BUDZ: 'BUDZ-03', LEAFY: 'LEAFY-03' },

  // The tiny blink/idle frames swapped in for a moment while the bubble is open.
  // "fits" lists the faces drawn in nearly the same stance. The frames are only swapped over those,
  // because swapping one over a big pose (a jump, say) would make the whole body flicker.
  blink: {
    HAZE: { frames: ['HAZE-13', 'HAZE-14', 'HAZE-15', 'HAZE-16', 'HAZE-17', 'HAZE-18'], fits: { from: 1, to: 18 } },
    BUDZ: { frames: ['BUDZ-13', 'BUDZ-14', 'BUDZ-15', 'BUDZ-16', 'BUDZ-17', 'BUDZ-18'], fits: { from: 1, to: 18 } },
    // Leafy's frames 15 and 16 move the arms a lot, so they're left out.
    LEAFY: { frames: ['LEAFY-13', 'LEAFY-14', 'LEAFY-17', 'LEAFY-18'], fits: { from: 13, to: 18 } },
  },

  // Who cheers on the confetti banner, by kind of celebration. Takes turns through each list.
  // A kind that isn't listed (the small "new station" banner) has no helper.
  celebrate: {
    rank: ['BUDZ-48', 'HAZE-42', 'LEAFY-31'],
    district: ['HAZE-27', 'BUDZ-37', 'LEAFY-28'],
    facility: ['HAZE-40', 'BUDZ-45', 'LEAFY-28'],
    renovation: ['LEAFY-28', 'BUDZ-21', 'HAZE-22'],
    expansion: ['BUDZ-21', 'LEAFY-24', 'HAZE-38'],
    model: ['BUDZ-37', 'HAZE-42', 'LEAFY-31'],
    discovery: ['HAZE-33', 'BUDZ-39', 'LEAFY-33'],
    set: ['LEAFY-31', 'BUDZ-24', 'HAZE-34'],
    automation: ['HAZE-38', 'BUDZ-48', 'LEAFY-24'],
    rival: ['BUDZ-45', 'HAZE-34', 'LEAFY-21'],
    prestige: ['HAZE-42', 'BUDZ-48', 'LEAFY-31'],
  },

  // How the helpers stand on the Empire map.
  mapPose: { HAZE: 'HAZE-27', BUDZ: 'BUDZ-05', LEAFY: 'LEAFY-25' },

  // Pictures on the menus and the title screen.
  screens: {
    title: 'HAZE-27',             // Uncle Haze waving on the title screen
    howToPlay: 'LEAFY-26',        // Leafy, finger up, explaining how to play
    noLinesYet: 'BUDZ-05',        // Budz waiting, when no helper lines have been heard yet
    crew: { HAZE: 'HAZE-03', BUDZ: 'BUDZ-03', LEAFY: 'LEAFY-03' },   // "Your helpers" on the profile and the line list
  },

  // Words for the same screens, kept here so they're easy to change.
  words: {
    howToPlay: "Right, pay attention. I wrote it all down, so you don't have to guess.",
    noLinesYet: "Nothing yet! We'll speak up when something big happens. I'm ready. I'm SO ready.",
  },

  // Sprites not drawn yet. Empty: every sprite up to the counts above exists in art/.
  planned: [],
};
