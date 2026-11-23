// Token Launch Radar. Reads window.RADAR (written beside dashboard/ by main.ts) and renders the
// ranked board, a filterable and sortable table, a per-protocol detail drawer with the model's own
// arithmetic and the protocol's farm plan, the calibration table the multiples came from, and the
// live-token set the board deliberately does not rank. No network: every byte is in data.js.
(function () {
  'use strict';

  var DATA = window.RADAR;
  if (!DATA) return;
  var app = document.getElementById('board');
  var state = { q: '', category: 'all', chain: 'all', watch: false, tab: 'pre', sort: 'implied_value_usd', dir: -1, selected: null };

  var usd0 = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
  function fmtUsd(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    if (Math.abs(n) >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
    if (Math.abs(n) >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
    if (Math.abs(n) >= 1e3) return '$' + Math.round(n / 1e3) + 'K';
    return usd0.format(n);
  }
  function fmtPct(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    return (n > 0 ? '+' : '') + n.toFixed(1) + '%';
  }
  function fmtAge(days) {
    if (days === null || days === undefined) return 'unknown';
    if (days >= 365) return (days / 365).toFixed(1) + 'y';
    return Math.max(0, Math.round(days)) + 'd';
  }
  function fmtMult(x) { return 'x' + (Math.round(x * 1000) / 1000); }

  // The model, recomputed in the page from the row's own figures: the same arithmetic lib/model.ts
  // ran, so the number on the board and the number here cannot drift apart.
  function impliedOf(row) {
    var m = DATA.model;
    var growth = Math.min(m.growth_cap, Math.max(m.growth_floor, row.change_7d === null || row.change_7d === undefined ? 0 : row.change_7d));
    var growthMult = 1 + (growth / 100) * m.growth_weight;
    var age = row.age_days === null || row.age_days === undefined ? m.unknown_age_days : row.age_days;
    var maturity = m.maturity_floor + (Math.min(Math.max(age, 0), m.maturity_days) / m.maturity_days) * m.maturity_range;
    var chains = 1 + m.chain_step * Math.min(Math.max(row.chains.length - 1, 0), m.chain_cap);
    return Math.max(1, Math.round(row.tvl_usd * row.category_multiple * growthMult * maturity * chains));
  }

  function el(tag, attrs) {
    var node = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        if (k === 'class') node.className = attrs[k];
        else if (k === 'text') node.textContent = attrs[k];
        else if (k.slice(0, 2) === 'on') node.addEventListener(k.slice(2), attrs[k]);
        else if (attrs[k] !== null && attrs[k] !== undefined) node.setAttribute(k, attrs[k]);
      });
    }
    for (var i = 2; i < arguments.length; i++) {
      var child = arguments[i];
      if (child === null || child === undefined) continue;
      if (Array.isArray(child)) child.forEach(function (c) { if (c) node.appendChild(c); });
      else if (typeof child === 'string') node.appendChild(document.createTextNode(child));
      else node.appendChild(child);
    }
    return node;
  }

  var maxImplied = Math.max.apply(null, DATA.rows.map(function (r) { return r.implied_value_usd; }));

  function header() {
    var totalImplied = DATA.rows.reduce(function (a, r) { return a + r.implied_value_usd; }, 0);
    var totalTvl = DATA.rows.reduce(function (a, r) { return a + r.tvl_usd; }, 0);
    return el('div', null,
      el('header', { 'class': 'top' },
        el('div', null,
          el('div', { 'class': 'mark' }, el('span', { 'class': 'dot' }), el('h1', null, 'Token Launch ', el('span', null, 'Radar'))),
          el('p', { 'class': 'tagline', text: 'Protocols that record no token yet, ranked by what a launch would be worth if the record stayed as it is — and what to do about each one before it issues.' })
        ),
        el('div', { 'class': 'meta' },
          el('div', null, 'Snapshot ', el('b', { text: DATA.as_of })),
          el('div', null, 'Source ', el('b', { text: DATA.source })),
          el('div', null, 'Model ', el('b', { text: DATA.model_version }))
        )
      ),
      el('section', { 'class': 'stats' },
        stat(fmtUsd(totalImplied), 'combined implied value of the board'),
        stat(String(DATA.board_size), 'pre-token protocols ranked'),
        stat(DATA.watchlist_size + ' / ' + DATA.watchlist_size, 'watchlist protocols covered'),
        stat(fmtUsd(totalTvl), 'TVL under watch')
      ),
      method()
    );
  }
  function stat(b, s) { return el('div', { 'class': 'stat' }, el('b', { text: b }), el('span', { text: s })); }

  function method() {
    var m = DATA.model;
    var rows = DATA.categories.map(function (c) {
      return el('tr', null,
        el('td', { text: c.category }),
        el('td', { 'class': 'n', text: String(c.comps) }),
        el('td', { 'class': 'n', text: c.median_ratio === null ? 'n/a' : fmtMult(c.median_ratio) }),
        el('td', { 'class': 'n', text: fmtMult(c.multiple) }));
    });
    return el('details', { 'class': 'method' },
      el('summary', null, 'How the ranking works ', el('span', null, '— the model, stated in full')),
      el('div', { 'class': 'body' },
        el('p', null,
          'The board first sets aside what is not a launch at all: wrapped, staked and bridged products of tokens that already trade (WBTC is not an undiscovered protocol), exchange products, and versioned pools of other protocols — the same test the snapshot\u2019s watchlist applies. For what remains: implied value = TVL x category multiple x momentum x maturity x distribution. The category multiple is not a house constant: it is the median market-cap / TVL ratio of the protocols in that category whose token already trades in this same snapshot, shrunk toward the snapshot-wide median of ',
          el('code', { text: fmtMult(DATA.global_multiple) }),
          ' by the number of comparables, so a thin category borrows strength from the whole market. Momentum is the 7-day TVL change clamped to [' + m.growth_floor + '%, +' + m.growth_cap + '%] at weight ' + m.growth_weight + '; maturity runs from ' + m.maturity_floor + ' to ' + (m.maturity_floor + m.maturity_range) + ' over ' + m.maturity_days + ' days without a token; distribution adds ' + (m.chain_step * 100) + '% per extra chain, up to ' + m.chain_cap + '. No name is special-cased: one function scores every row, and each row\u2019s detail view shows its own arithmetic.'
        ),
        el('table', { 'class': 'cats' },
          el('thead', null, el('tr', null,
            el('th', { text: 'Category' }), el('th', { 'class': 'n', text: 'Traded comps' }),
            el('th', { 'class': 'n', text: 'Median mcap / TVL' }), el('th', { 'class': 'n', text: 'Multiple used' }))),
          el('tbody', null, rows)
        )
      )
    );
  }

  function controls() {
    var cats = [];
    var chains = [];
    DATA.rows.forEach(function (r) {
      if (r.category && cats.indexOf(r.category) < 0) cats.push(r.category);
      r.chains.forEach(function (c) { if (chains.indexOf(c) < 0) chains.push(c); });
    });
    cats.sort(); chains.sort();
    var catSel = el('select', { 'aria-label': 'Category', onchange: function () { state.category = catSel.value; render(); } },
      [el('option', { value: 'all', text: 'All categories' })].concat(cats.map(function (c) { return el('option', { value: c, text: c }); })));
    catSel.value = state.category;
    var chainSel = el('select', { 'aria-label': 'Chain', onchange: function () { state.chain = chainSel.value; render(); } },
      [el('option', { value: 'all', text: 'All chains' })].concat(chains.map(function (c) { return el('option', { value: c, text: c }); })));
    chainSel.value = state.chain;
    var search = el('input', { type: 'search', placeholder: 'Search name or slug', 'aria-label': 'Search', value: state.q, oninput: function () { state.q = search.value; renderTable(); } });
    var watch = el('input', { type: 'checkbox', onchange: function () { state.watch = watch.checked; renderTable(); } });
    if (state.watch) watch.checked = true;
    return el('div', { 'class': 'controls' }, search, catSel, chainSel,
      el('label', { 'class': 'chk' }, watch, 'Watchlist only'),
      el('span', { 'class': 'count', id: 'rowcount' }));
  }

  function tabs() {
    function tab(id, label) {
      return el('button', { role: 'tab', 'aria-selected': state.tab === id ? 'true' : 'false', onclick: function () { state.tab = id; state.selected = null; render(); } }, label);
    }
    return el('div', { 'class': 'tabs', role: 'tablist' },
      tab('pre', 'Pre-token board (' + DATA.board_size + ')'),
      tab('live', 'Already trading (' + DATA.live_size + ')'));
  }

  function visibleRows() {
    var q = state.q.trim().toLowerCase();
    var rows = DATA.rows.filter(function (r) {
      if (state.watch && !r.watchlist) return false;
      if (state.category !== 'all' && r.category !== state.category) return false;
      if (state.chain !== 'all' && r.chains.indexOf(state.chain) < 0) return false;
      if (q && (r.name + ' ' + r.slug).toLowerCase().indexOf(q) < 0) return false;
      return true;
    });
    var k = state.sort, d = state.dir;
    rows.sort(function (a, b) {
      var x = a[k], y = b[k];
      if (x === null || x === undefined) x = -Infinity;
      if (y === null || y === undefined) y = -Infinity;
      return (x < y ? -1 : x > y ? 1 : a.rank - b.rank) * d;
    });
    return rows;
  }

  var tableHost = null;
  var drawerHost = null;

  function sortHead(label, key, cls) {
    var arrow = state.sort === key ? (state.dir === -1 ? ' \u25bc' : ' \u25b2') : '';
    return el('th', { 'class': 'sortable ' + (cls || ''), text: label + arrow, onclick: function () {
      if (state.sort === key) state.dir = -state.dir; else { state.sort = key; state.dir = -1; }
      renderTable();
    } });
  }

  function renderTable() {
    if (!tableHost) return;
    while (tableHost.firstChild) tableHost.removeChild(tableHost.firstChild);
    if (state.tab === 'live') { tableHost.appendChild(liveTable()); setCount(DATA.live_size + ' trading protocols, shown at market value'); return; }
    var rows = visibleRows();
    setCount(rows.length + ' of ' + DATA.board_size + ' protocols');
    if (rows.length === 0) { tableHost.appendChild(el('div', { 'class': 'empty', text: 'No protocol matches the current filter.' })); return; }
    var head = el('thead', null, el('tr', null,
      sortHead('#', 'rank', 'n'), sortHead('Protocol', 'name'), sortHead('Category', 'category'),
      el('th', { text: 'Chains' }), sortHead('TVL', 'tvl_usd', 'n'), sortHead('7d', 'change_7d', 'n hideS'),
      sortHead('Age', 'age_days', 'n hideS'), sortHead('Multiple', 'category_multiple', 'n hideS'),
      sortHead('Implied value', 'implied_value_usd', 'n')));
    var body = el('tbody', null, rows.map(function (r) {
      var tr = el('tr', { 'aria-selected': state.selected === r.slug ? 'true' : 'false', onclick: function () { openDrawer(r); } },
        el('td', { 'class': 'n', text: String(r.rank) }),
        el('td', null, el('span', { 'class': 'pname', text: r.name }), r.watchlist ? el('span', { 'class': 'badge', text: 'watchlist' }) : null,
          el('div', { 'class': 'pslug', text: r.slug })),
        el('td', { 'class': 'dim', text: r.category || 'Uncategorised' }),
        el('td', { 'class': 'dim', text: r.chains.length ? r.chains[0] + (r.chains.length > 1 ? ' +' + (r.chains.length - 1) : '') : 'n/a' }),
        el('td', { 'class': 'n', text: fmtUsd(r.tvl_usd) }),
        el('td', { 'class': 'n hideS ' + (r.change_7d === null ? '' : r.change_7d >= 0 ? 'pos' : 'neg'), text: fmtPct(r.change_7d) }),
        el('td', { 'class': 'n hideS dim', text: fmtAge(r.age_days) }),
        el('td', { 'class': 'n hideS dim', text: fmtMult(r.category_multiple) }),
        el('td', { 'class': 'n' }, el('div', null, el('b', { text: fmtUsd(r.implied_value_usd) }),
          el('div', { 'class': 'bar' }, el('i', { style: 'width:' + Math.max(1.5, (r.implied_value_usd / maxImplied) * 100) + '%' })))));
      return tr;
    }));
    tableHost.appendChild(el('table', { 'class': 'board' }, head, body));
  }
  function setCount(t) { var c = document.getElementById('rowcount'); if (c) c.textContent = t; }

  function liveTable() {
    var head = el('thead', null, el('tr', null,
      el('th', { text: 'Protocol' }), el('th', { text: 'Category' }), el('th', { text: 'Chains' }),
      el('th', { 'class': 'n', text: 'TVL' }), el('th', { 'class': 'n', text: 'Market cap' }), el('th', { 'class': 'n', text: '7d' })));
    var body = el('tbody', null, DATA.live.map(function (r) {
      return el('tr', null,
        el('td', null, el('span', { 'class': 'pname', text: r.name }), el('div', { 'class': 'pslug', text: r.slug })),
        el('td', { 'class': 'dim', text: r.category || 'Uncategorised' }),
        el('td', { 'class': 'dim', text: r.chains.length ? r.chains[0] + (r.chains.length > 1 ? ' +' + (r.chains.length - 1) : '') : 'n/a' }),
        el('td', { 'class': 'n', text: fmtUsd(r.tvl_usd) }),
        el('td', { 'class': 'n', text: fmtUsd(r.mcap_usd) }),
        el('td', { 'class': 'n ' + (r.change_7d === null ? '' : r.change_7d >= 0 ? 'pos' : 'neg'), text: fmtPct(r.change_7d) }));
    }));
    return el('div', null,
      el('p', { 'class': 'dim', text: 'These protocols already have a token: the radar shows the market\u2019s own value for them and never ranks them. Their market-cap / TVL ratios are the calibration the pre-token board is priced from.' }),
      el('table', { 'class': 'board' }, head, body));
  }

  function mrow(label, val, frac) {
    return el('div', { 'class': 'mrow' },
      el('span', { 'class': 'dim', text: label }),
      el('span', { 'class': 'track' }, el('i', { style: 'width:' + Math.round(Math.max(0, Math.min(1, frac)) * 100) + '%' })),
      el('b', { text: val }));
  }

  function openDrawer(r) {
    state.selected = r.slug;
    renderTable();
    while (drawerHost.firstChild) drawerHost.removeChild(drawerHost.firstChild);
    var check = impliedOf(r);
    var steps = r.farm_steps.map(function (s) {
      var cost = '';
      var m = s.match(/ Cost: (.*)\. Time: (.*)\.$/);
      var text = s;
      if (m) { text = s.slice(0, m.index); cost = 'Cost: ' + m[1] + ' \u00b7 Time: ' + m[2]; }
      return el('li', null, text, cost ? el('span', { 'class': 'cost', text: cost }) : null);
    });
    var drawer = el('aside', { 'class': 'drawer' },
      el('button', { 'class': 'close', 'aria-label': 'Close', text: '\u00d7', onclick: closeDrawer }),
      el('h2', { text: r.name }),
      el('p', { 'class': 'sub', text: (r.category || 'Uncategorised') + ' \u00b7 ' + r.slug + (r.watchlist ? ' \u00b7 on the snapshot watchlist' : ' \u00b7 early radar, below the watchlist floor') }),
      el('div', { 'class': 'big' }, el('small', { text: 'Implied launch value' }), fmtUsd(r.implied_value_usd)),
      el('div', { 'class': 'kv' },
        el('span', { text: 'Rank' }), el('b', { text: '#' + r.rank + ' of ' + DATA.board_size }),
        el('span', { text: 'TVL' }), el('b', { text: fmtUsd(r.tvl_usd) }),
        el('span', { text: 'TVL change, 7 days' }), el('b', { text: fmtPct(r.change_7d) }),
        el('span', { text: 'Tracked since' }), el('b', { text: r.listed_at || 'unknown' }),
        el('span', { text: 'Age with no token' }), el('b', { text: fmtAge(r.age_days) }),
        el('span', { text: 'Chains' }), el('b', { text: r.chains.join(', ') || 'n/a' }),
        el('span', { text: 'Token' }), el('b', { text: 'none recorded in the snapshot' })
      ),
      el('div', { 'class': 'modelbox' },
        el('h3', { text: 'The model on this row' }),
        mrow('TVL base', fmtUsd(r.tvl_usd), Math.min(1, r.tvl_usd / 1e10)),
        mrow('Category multiple', fmtMult(r.category_multiple), r.category_multiple / 1.5),
        mrow('Momentum', fmtMult(r.growth_multiplier), (r.growth_multiplier - 0.7) / 0.9),
        mrow('Maturity', fmtMult(r.maturity_multiplier), (r.maturity_multiplier - 0.55) / 0.45),
        mrow('Distribution', fmtMult(r.chain_multiplier), (r.chain_multiplier - 1) / 0.2),
        el('p', { 'class': 'dim', text: 'Category multiple from ' + r.category_comps + ' traded comparables in this snapshot. The page recomputes this row as ' + fmtUsd(check) + '; the board carries ' + fmtUsd(r.implied_value_usd) + '.' })
      ),
      el('h3', { 'class': 'plan', text: 'Farm plan' }),
      el('ol', { 'class': 'plan' }, steps)
    );
    drawerHost.appendChild(el('div', { 'class': 'scrim', onclick: closeDrawer }));
    drawerHost.appendChild(drawer);
  }
  function closeDrawer() {
    state.selected = null;
    while (drawerHost.firstChild) drawerHost.removeChild(drawerHost.firstChild);
    renderTable();
  }

  function render() {
    while (app.firstChild) app.removeChild(app.firstChild);
    app.appendChild(header());
    app.appendChild(tabs());
    if (state.tab === 'pre') app.appendChild(controls());
    tableHost = el('div', null);
    app.appendChild(tableHost);
    app.appendChild(el('footer', { text: 'Implied value is this entry\u2019s own model claim, computed only from the sealed snapshot of ' + DATA.as_of + '; it is not a prediction that a token will be issued. A protocol \u201crecords no token\u201d in DefiLlama\u2019s record — that is what the snapshot shows, and it is all the board claims.' }));
    drawerHost = el('div', null);
    app.appendChild(drawerHost);
    renderTable();
    app.removeAttribute('aria-busy');
  }
  render();
})();
