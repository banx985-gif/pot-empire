// The shop (bible section 11): the candidate catalogue, the rewarded-ad list and the on/off switches.
//
// SWITCHES: real payments and ads are OFF. Cannabis-themed games may not be allowed ads or some store
// payments; that is checked before release (docs/RELEASE_CHECKLIST.md). While they're off the shop
// shows what's planned but nothing can be bought or watched. For testing there is a PRETEND store and
// a PRETEND ad: open the game with ?pretend=1 (or switch "Test shop" on in Settings). No real money,
// no real ads, nothing leaves the phone.
//
// Prices are the bible's proposed AUD amounts, not confirmed store tiers. Contents are STAND-IN.
// Every gameplay power stays earnable without paying (bible section 11): paid items give cosmetics,
// currency and time, never something that can't be earned.
(globalThis.PE = globalThis.PE || {}).Data = globalThis.PE.Data || {};
globalThis.PE.Data.shop = {
  switches: {
    realPaymentsEnabled: false,   // stays false until store, age-rating and policy checks pass
    realAdsEnabled: false,        // stays false until the ad network accepts a cannabis-themed game
    pretendAllowed: true,         // the test store and test ad can be switched on (Settings or ?pretend=1)
  },

  // kind: oneTime (bought once, restorable), consumable (can be bought again, not restorable),
  //       pass (lasts passDays from purchase, restorable while it lasts), theme (cosmetic, restorable)
  products: [
    { id: 'starter_bundle', name: 'Starter bundle', priceKey: 'starterBundle', kind: 'oneTime',
      text: 'A head start: cash worth 60 typical harvests, 30 Collection Tokens and the "Founding Grower" title.',
      grants: { cashHarvests: 60, collectionTokens: 30, title: 'Founding Grower' } },
    { id: 'no_ads', name: 'No-ads convenience', priceKey: 'noAds', kind: 'oneTime',
      text: 'Get every optional ad reward without watching, same daily limits.',
      grants: { entitlement: 'noAds' } },
    { id: 'gems_small', name: 'Rainbow Gems: small', priceKey: 'gemsSmall', kind: 'consumable', text: '100 Rainbow Gems.', grants: { gems: 100 } },
    { id: 'gems_medium', name: 'Rainbow Gems: medium', priceKey: 'gemsMedium', kind: 'consumable', text: '450 Rainbow Gems.', grants: { gems: 450 } },
    { id: 'gems_large', name: 'Rainbow Gems: large', priceKey: 'gemsLarge', kind: 'consumable', text: '950 Rainbow Gems.', grants: { gems: 950 } },
    { id: 'gems_mega', name: 'Rainbow Gems: mega', priceKey: 'gemsMega', kind: 'consumable', text: '2,100 Rainbow Gems, mostly for cosmetics.', grants: { gems: 2100 } },
    { id: 'event_pass', name: 'Cosmetic event pass', priceKey: 'eventPass', kind: 'pass', passDays: 28,
      text: '28 days: +25% Festival Tickets from tiers, a pass title. Cosmetic and non-essential only.',
      grants: { entitlement: 'eventPass', title: 'Festival Pass Holder' } },
    { id: 'theme_neon', name: 'Facility theme: Neon Nights', priceKey: 'facilityTheme', kind: 'theme',
      text: 'A neon wall and floor colour scheme for every grow room. Looks only.',
      grants: { theme: 'neon' } },
  ],

  // Things Rainbow Gems and Festival Tickets buy: cosmetics and small conveniences only.
  gemItems: [
    { id: 'gem_title_rainbow', name: 'Title: Rainbow Royalty', cost: 120, currency: 'rainbowGems', grants: { title: 'Rainbow Royalty' } },
    { id: 'gem_theme_sunset', name: 'Facility theme: Sunset Haze', cost: 300, currency: 'rainbowGems', grants: { theme: 'sunset' } },
    { id: 'gem_finish_delivery', name: 'Finish one delivery now', cost: 10, currency: 'rainbowGems', repeat: true, grants: { finishDelivery: true } },
    { id: 'ticket_title_party', name: 'Title: Festival Legend', cost: 200, currency: 'festivalTickets', grants: { title: 'Festival Legend' } },
    { id: 'ticket_theme_disco', name: 'Facility theme: Disco Floor', cost: 400, currency: 'festivalTickets', grants: { theme: 'disco' } },
  ],

  // Facility themes for the grow rooms. Job 17 (Cowork): with Aaron's room pictures a theme no longer recolours the floor;
  // it gives the room's lighting a soft colour tint (tint, never hiding the art). wall and floor are only for a room
  // whose picture is missing (the plain stand-in floor).
  themes: {
    default: { name: 'Classic', wall: 0x2b1d45, floor: 0x3a3048 },
    neon: { name: 'Neon Nights', wall: 0x12062e, floor: 0x241a4a, tint: 0x6a3cff },
    sunset: { name: 'Sunset Haze', wall: 0x4a1f3a, floor: 0x4a3434, tint: 0xff8a3d },
    disco: { name: 'Disco Floor', wall: 0x2a0f45, floor: 0x3d2a5c, tint: 0xff4fa3 },
  },

  // Rewarded ads (bible section 11): opt-in only, daily limits in balance.rewardedAdLimitsPerDay.
  ads: [
    { id: 'doubleOfflineClaim', name: 'Double your welcome-back cash', where: 'Welcome back' },
    { id: 'extraWheelSpins', name: 'An extra prize wheel spin', where: 'Tasks' },
    { id: 'deliverySpeedUp', name: 'Finish one delivery now', where: 'Delivery depot' },
    { id: 'harvestQualityReward', name: 'Next harvest is at least Premium', where: 'Shop' },
  ],
  pretendAdSeconds: 3,
};
