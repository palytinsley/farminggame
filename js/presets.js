// Preset setups. They ship with the code, so they exist on any computer and can't be deleted.
// Each one starts from DEFAULT_SETTINGS and overrides only what differs, so any setting added later
// picks up its default automatically.
(function () {
  function cronin() {
    const s = window.cloneSettings(window.DEFAULT_SETTINGS);
    s.subtitle = 'Can you survive on the Great Plains?';
    s.rentOn = true;
    s.closedRange = false;

    const ids = ['corn', 'beans', 'wheat', 'barley', 'oats', 'hay', 'tobacco', 'peas', 'cattle', 'sheep', 'hogs'];
    const table = [
      // 1885 1886 1887 1888
      [2, 2, 1, 1],       // corn
      [3, 1, 1.5, 2.5],   // beans
      [1, 2, 2, 0],       // wheat
      [1, 2, 1.5, 0.5],   // barley
      [1, 2, 1, 0],       // oats
      [2, 1, 2, 0],       // hay
      [2, 2, 1, 2],       // tobacco
      [2, 2, 1, 3],       // peas
      [1, 0, 3, 0.5],     // cattle
      [2, 3, 1, 2],       // sheep
      [3, 0, 2, 0.5],     // hogs
    ];
    const news = [
      {
        theme: 'flood',
        headline: 'Rain Ruins the Small Grains',
        items: [
          'Serious lack of early spring rain followed by too much rain in July almost destroyed the wheat, barley, and oat crop in central Nebraska.',
          'The prices paid for corn, beans, field peas, and tobacco are up because of drought east of the Mississippi.',
          'Cattle prices are depressed because of large herds of range stock being sold in Texas.',
          'The price for sheep is up and the price paid for hogs is at an all-time high.',
        ],
      },
      {
        theme: 'blizzard',
        headline: 'Coldest Winter on Record Kills the Herds',
        items: [
          'The coldest winter in history with temperatures reaching 60 degrees below zero, which destroyed most of the cattle and hogs. Sheep prices are high.',
          'Abundant spring and summer rain throughout most of the state has produced excellent crops.',
          'The price of corn, wheat, barley, and oats is good and the price of tobacco and field peas remains the same.',
          'The bean crop has produced a small yield because of the late frost and the field hay prices are depressed because of the limited demand for hay.',
        ],
      },
      {
        theme: 'grasshoppers',
        headline: 'Grasshoppers Strike After a Dry Spring',
        items: [
          'Nature deals a crushing blow to farmers in Nebraska.',
          'After a hot dry spring with little rain, a plague of grasshoppers infested the crops. Most crops are badly damaged.',
          'Cattle prices are very good, as the range herds have not yet recovered from the killing winter of 1886.',
          'Sheep prices are depressed, but hog prices are good.',
        ],
      },
      {
        theme: 'drought',
        headline: 'Another Killing Winter, Then Prairie Fires',
        items: [
          'Another freezing winter deals a blow to livestock and farms.',
          'The temperatures dropped to well below zero and crushed herds of cattle and hogs under incredibly high snowdrifts. Sheep survived, but do not thrive.',
          'The dry summer and lack of rainfall created a constant hazard in prairie fires that destroyed many of the dry crops.',
          'Corn, wheat, barley, oats and field hay suffer under the harsh conditions, while tobacco, beans and field peas do well.',
        ],
      },
    ];
    s.rounds = news.map((n, y) => ({
      theme: n.theme,
      headline: n.headline,
      items: n.items.slice(),
      notes: '',
      returns: Object.fromEntries(ids.map((id, r) => [id, table[r][y]])),
    }));
    return s;
  }

  function original() {
    const s = window.cloneSettings(window.DEFAULT_SETTINGS);
    s.rentOn = false;
    s.closedRange = false;
    return s;
  }

  window.BUILT_IN_PRESETS = { 'Original': original(), 'Cronin': cronin() };
})();
