// Factory recipes (job 5, Stage 3): what each product needs besides crop stock. Every number is a STAND-IN
// and provisional, like the balance tables. Crop stock is always an input; a row adds to it:
//   strain    harvests of that rarity or rarer, spent when a batch starts ("3 Uncommon or rarer harvests")
//   products  other products, each using productShare of the batch's crop value
//   cashShare cash, as a share of the batch's crop value
// A product's value isn't lost when it goes into another one: it counts towards the new batch.
// The data check fails if any product ends up with no use.
(globalThis.PE = globalThis.PE || {}).Data = globalThis.PE.Data || {};
globalThis.PE.Data.recipes = {
  tableVersion: 1,
  status: 'provisional',
  productShare: 0.2,

  // Who wants finished products, besides other recipes. Every family can go on a shop shelf.
  usedBy: {
    shelves: ['Snacks', 'Drinks', 'Accessories', 'Novelty Gifts', 'Wellness Fiction', 'Premium Packs'],
    contracts: ['Snacks', 'Drinks', 'Accessories', 'Novelty Gifts', 'Wellness Fiction', 'Premium Packs'],
    vip: ['Snacks', 'Drinks', 'Accessories', 'Novelty Gifts', 'Wellness Fiction', 'Premium Packs'],
  },

  rows: {
    P01: {},   // Rainbow Crunch
    P02: { strain: { rarity: 'Common', units: 3 }, products: ['P01'] },   // Cosmic Cookies
    P03: { strain: { rarity: 'Common', units: 4 }, products: ['P02'] },   // Disco Bites
    P04: { strain: { rarity: 'Common', units: 5 }, products: ['P03'] },   // Groovy Gummies
    P05: { strain: { rarity: 'Common', units: 6 }, products: ['P04'] },   // Sunshine Squares
    P06: { strain: { rarity: 'Common', units: 7 }, products: ['P05'] },   // Moon Munchies
    P07: { strain: { rarity: 'Common', units: 2 } },   // Prism Pop
    P08: { strain: { rarity: 'Common', units: 3 }, products: ['P07'] },   // Galaxy Fizz
    P09: { strain: { rarity: 'Common', units: 4 }, products: ['P08'] },   // Mellow Melon
    P10: { strain: { rarity: 'Common', units: 5 }, products: ['P09'] },   // Electric Lemon
    P11: { strain: { rarity: 'Common', units: 6 }, products: ['P10'] },   // Sunset Soda
    P12: { strain: { rarity: 'Common', units: 7 }, products: ['P11'] },   // Hippie Hibiscus
    P13: { strain: { rarity: 'Uncommon', units: 2 }, products: ['P06'], cashShare: 0.05 },   // Peace Pin
    P14: { strain: { rarity: 'Uncommon', units: 3 }, products: ['P13'], cashShare: 0.05 },   // Groove Spinner
    P15: { strain: { rarity: 'Uncommon', units: 4 }, products: ['P14'], cashShare: 0.05 },   // Tie-Dye Tote
    P16: { strain: { rarity: 'Uncommon', units: 5 }, products: ['P15'], cashShare: 0.05 },   // Rainbow Lanyard
    P17: { strain: { rarity: 'Uncommon', units: 6 }, products: ['P16'], cashShare: 0.05 },   // Cosmic Keyring
    P18: { strain: { rarity: 'Uncommon', units: 7 }, products: ['P17'], cashShare: 0.05 },   // Neon Sunglasses
    P19: { strain: { rarity: 'Uncommon', units: 2 }, products: ['P12'], cashShare: 0.05 },   // Dancing Leaf
    P20: { strain: { rarity: 'Uncommon', units: 3 }, products: ['P19'], cashShare: 0.05 },   // Disco Lava Lamp
    P21: { strain: { rarity: 'Uncommon', units: 4 }, products: ['P20'], cashShare: 0.05 },   // Mini UFO
    P22: { strain: { rarity: 'Uncommon', units: 5 }, products: ['P21'], cashShare: 0.05 },   // Smiley Cushion
    P23: { strain: { rarity: 'Uncommon', units: 6 }, products: ['P22'], cashShare: 0.05 },   // Groovy Snowglobe
    P24: { strain: { rarity: 'Uncommon', units: 7 }, products: ['P23'], cashShare: 0.05 },   // Rainbow Gnome
    P25: { strain: { rarity: 'Rare', units: 2 }, products: ['P18'], cashShare: 0.1 },   // Calm Cloud Balm
    P26: { strain: { rarity: 'Rare', units: 3 }, products: ['P25'], cashShare: 0.1 },   // Dreamy Bath Bomb
    P27: { strain: { rarity: 'Rare', units: 4 }, products: ['P26'], cashShare: 0.1 },   // Peaceful Pillow Mist
    P28: { strain: { rarity: 'Rare', units: 5 }, products: ['P27'], cashShare: 0.1 },   // Sunbeam Soap
    P29: { strain: { rarity: 'Rare', units: 6 }, products: ['P28'], cashShare: 0.1 },   // Rainbow Bath Salts
    P30: { strain: { rarity: 'Rare', units: 7 }, products: ['P29'], cashShare: 0.1 },   // Moonlight Candle
    P31: { strain: { rarity: 'Rare', units: 2 }, products: ['P24'], cashShare: 0.1 },   // Golden Groove Box
    P32: { strain: { rarity: 'Rare', units: 3 }, products: ['P31'], cashShare: 0.1 },   // Prism Collector Kit
    P33: { strain: { rarity: 'Rare', units: 4 }, products: ['P32'], cashShare: 0.1 },   // Galaxy Gift Set
    P34: { strain: { rarity: 'Rare', units: 5 }, products: ['P33'], cashShare: 0.1 },   // Royal Rainbow Case
    P35: { strain: { rarity: 'Rare', units: 6 }, products: ['P34'], cashShare: 0.1 },   // Cosmic Celebration Box
    P36: { strain: { rarity: 'Rare', units: 7 }, products: ['P35', 'P30'], cashShare: 0.1 },   // Eternal Festival Hamper
  },
};
