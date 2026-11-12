// The original game, exactly as the slide deck had it. "Reset to original" goes back to this.
(function () {
  const items = [
    { id: 'corn', name: 'Corn', kind: 'crop', price: 5 },
    { id: 'beans', name: 'Beans', kind: 'crop', price: 5 },
    { id: 'wheat', name: 'Wheat', kind: 'crop', price: 2 },
    { id: 'barley', name: 'Barley', kind: 'crop', price: 2 },
    { id: 'oats', name: 'Oats', kind: 'crop', price: 2 },
    { id: 'hay', name: 'Field Hay', kind: 'crop', price: 1 },
    { id: 'tobacco', name: 'Tobacco', kind: 'crop', price: 10 },
    { id: 'peas', name: 'Field Peas', kind: 'crop', price: 5 },
    // For animals, perUnit is used only in Closed range mode: how many animals one unit of pasture feeds.
    // 0 means the animal needs no pasture.
    { id: 'cattle', name: 'Cattle', kind: 'animal', price: 10, perUnit: 2 },
    { id: 'sheep', name: 'Sheep', kind: 'animal', price: 5, perUnit: 10 },
    { id: 'hogs', name: 'Hogs', kind: 'animal', price: 5, perUnit: 0 },
  ];

  const rounds = window.ORIGINAL_NEWS.map((n, i) => ({
    theme: n.theme,
    headline: n.headline,
    items: n.items.slice(),
    notes: n.notes,
    returns: Object.assign({}, window.ORIGINAL_RETURNS[i]),
  }));

  window.DEFAULT_SETTINGS = {
    title: 'The Farming Game',
    subtitle: 'Four years on a homestead along the Platte River',
    region: 'Central Nebraska',
    paper: 'The Platte Valley Gazette',
    dateline: 'Kearney, Neb.',
    startYear: 1885,
    capital: 1500,
    living: 300,
    shipping: 200,
    acres: 160,
    unit: 10,
    maxCrops: 3,
    // Optional mode: rent extra land. Off by default.
    rentOn: false,
    landlord: 'Union Pacific Railroad',
    rentPrice: 100,      // dollars per block
    rentBlock: 50,       // acres per block
    rentMaxBlocks: 2,    // most blocks a farm can rent each year
    // Optional mode: cattle and sheep need pasture on the farm's own acres. Off by default.
    // The pasture rate for each animal is its perUnit, in items above.
    closedRange: false,
    includePractice: true,
    introSounds: true,
    revealSounds: true,
    items,
    rounds,
  };

  window.THEME_LABELS = {
    drought: 'Drought (sun and dust)',
    blizzard: 'Blizzard (snow at night)',
    grasshoppers: 'Grasshopper swarm',
    flood: 'Flood (rain and lightning)',
    none: 'No animation (plain color)',
  };

  window.cloneSettings = s => JSON.parse(JSON.stringify(s));
})();
