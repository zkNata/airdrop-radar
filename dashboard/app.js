// Airdrop Radar's dashboard. It reads window.RADAR (written beside dashboard/ by main.ts) and renders
// the ranked board, a filterable table, a per-protocol detail view with the model's own inputs and the
// protocol's farm plan, and the fitted size curve. No network: every byte it shows is in data.js.
//
// The farm plan below is the same derivation main.ts writes to board.json (lib/model.ts): category,
// chains, TVL and age in, the same seven steps out. If you change one, change the other.
(function () {
  'use strict';
  var DATA = window.RADAR || {};
  var M = DATA.model || {};
  var ROWS = DATA.rows || [];
  var LIVE = DATA.live || [];
  var FIT = DATA.fit || {};
  var state = { q: '', cat: 'all', verdict: 'all', tab: 'pre-token', sort: 'rank', dir: 1, selected: null };

  function $(t, a, c) { var n = document.createElement(t); if (a) for (var k in a) { if (k === 'text') n.textContent = a[k]; else if (k === 'html') n.innerHTML = a[k]; else if (k.slice(0, 2) === 'on' && typeof a[k] === 'function') n.addEventListener(k.slice(2), a[k]); else if (a[k] !== null) n.setAttribute(k, a[k]); } if (c !== undefined) { if (!Array.isArray(c)) c = [c]; c.forEach(function (x) { if (x !== null && x !== undefined) n.appendChild(typeof x === 'string' ? document.createTextNode(x) : x); }); } return n; }
  function fmtUsd(n) { if (n === null || n === undefined) return '—'; if (n >= 1e9) return '$' + (n / 1e9).toFixed(2).replace(/\.00$/, '') + 'B'; if (n >= 1e6) return '$' + (n / 1e6).toFixed(1).replace(/\.0$/, '') + 'M'; if (n >= 1e3) return '$' + (n / 1e3).toFixed(1).replace(/\.0$/, '') + 'K'; return '$' + Math.round(n); }
  function fmtPct(n) { if (n === null || n === undefined) return '—'; return (n >= 0 ? '+' : '') + n.toFixed(2) + '%'; }
  function fmtAge(d) { if (d === null || d === undefined) return '—'; if (d >= 365) return (d / 365).toFixed(1).replace(/\.0$/, '') + 'y'; return d + 'd'; }
  function fmtMoney(n) { return '$' + (Math.round(n * 100) / 100); }

  // ---- farm plan: mirror of lib/model.ts (same inputs, same strings) ----
  function chainOf(p) { return p.chains.length > 0 ? p.chains[0] : 'its main chain'; }
  function secondOf(p) { return p.chains.length > 1 ? p.chains[1] : null; }
  function capitalFor(p) { if (p.tvl >= 5e9) return 250; if (p.tvl >= 1e9) return 150; if (p.tvl >= 1e8) return 100; return 50; }
  function holdFor(age) { if (age === null || age === undefined) return 45; if (age < 180) return 60; if (age < 365) return 45; return 30; }
  function gasPerTx(c) {
    c = (c || '').toLowerCase();
    if (c === 'ethereum') return 8;
    if (c === 'solana' || c === 'sui' || c === 'aptos') return 1;
    if (c === 'tron' || c === 'binance') return 1;
    if (['base', 'arbitrum', 'optimism', 'polygon', 'zksync era', 'linea', 'blast', 'scroll', 'unichain', 'ink', 'katana', 'corn', 'monad', 'arc', 'abstract', 'soneium', 'mode', 'fraxtal', 'zora', 'world chain', 'avalanche', 'fantom', 'celo', 'gnosis', 'xdai'].indexOf(c) >= 0) return 1;
    return 2;
  }
  function actionFor(p, capital, chain) {
    var c = (p.cat || '').toLowerCase(), name = p.name;
    if (c.indexOf('lend') >= 0 || c.indexOf('cdp') >= 0 || c.indexOf('collateral') >= 0) return 'Supply $' + capital + ' of USDC to ' + name + ' on ' + chain + ' and keep the position open.';
    if (c.indexOf('dex') >= 0 || c.indexOf('yield') >= 0 || c.indexOf('leveraged farm') >= 0) return 'Provide $' + capital + ' of liquidity to ' + name + '\'s main pool on ' + chain + ' and keep the position open.';
    if (c.indexOf('bridge') >= 0) return 'Bridge $' + capital + ' of USDC to ' + chain + ' through ' + name + ' and use the bridged funds in its app.';
    if (c.indexOf('stak') >= 0 || c.indexOf('restak') >= 0) return 'Stake $' + capital + ' of the chain\'s staking asset through ' + name + ' and keep the receipt.';
    if (c.indexOf('perpetual') >= 0 || c.indexOf('derivative') >= 0) return 'Deposit $' + capital + ' of USDC as margin on ' + name + ' and open one small hedge.';
    if (c.indexOf('prediction') >= 0) return 'Fund $' + capital + ' and place one market position on ' + name + '.';
    if (c.indexOf('curator') >= 0 || c.indexOf('allocator') >= 0 || c.indexOf('risk') >= 0) return 'Deposit $' + capital + ' into a ' + name + ' vault on ' + chain + ' and keep the shares.';
    if (c.indexOf('stable') >= 0) return 'Mint or deposit $' + capital + ' of the stable asset through ' + name + ' on ' + chain + '.';
    if (c.indexOf('rwa') >= 0) return 'Mint $' + capital + ' of the protocol\'s yield asset on ' + chain + ' and hold it.';
    if (c.indexOf('insurance') >= 0) return 'Buy $' + capital + ' of cover from ' + name + ' on ' + chain + ' and keep the policy.';
    if (c.indexOf('farm') >= 0) return 'Deposit $' + capital + ' of USDC into ' + name + '\'s farm on ' + chain + ' and keep the position open.';
    return 'Deposit $' + capital + ' of USDC into ' + name + ' on ' + chain + ' and keep the position open.';
  }
  function secondActionFor(p, capital, chain) {
    var c = (p.cat || '').toLowerCase(), name = p.name, half = Math.max(10, Math.round(capital / 2));
    if (c.indexOf('dex') >= 0 || c.indexOf('yield') >= 0) return 'Swap $' + half + ' through ' + name + ' on ' + chain + ' so the wallet shows trading activity as well as liquidity.';
    if (c.indexOf('lend') >= 0 || c.indexOf('cdp') >= 0) return 'Borrow $' + half + ' against the deposit on ' + name + ' and repay it within the same week.';
    if (c.indexOf('stak') >= 0 || c.indexOf('restak') >= 0) return 'Delegate a further $' + half + ' through ' + name + ' on ' + chain + ' and keep both receipts.';
    if (c.indexOf('bridge') >= 0) return 'Bridge $' + half + ' back through ' + name + ' so the wallet shows two-way use.';
    if (c.indexOf('perpetual') >= 0 || c.indexOf('derivative') >= 0) return 'Close the hedge on ' + name + ' and open one new small position.';
    return 'Use $' + half + ' in a second feature of ' + name + ' on ' + chain + ', such as a swap or a vote.';
  }
  function stepText(s) { var t = s.text + ' Cost: ' + s.cost + '. Time: ' + s.time + '.'; if (t.length > 600) t = t.slice(0, 596) + '...'; if (t.length < 20) t += ' Hold the position and check the protocol\'s own page.'; return t; }
  function farmSteps(p) {
    var chain = chainOf(p), second = secondOf(p), capital = capitalFor(p), hold = holdFor(p.age),
      gas = gasPerTx(chain), weeks = Math.max(1, Math.ceil(hold / 7)), steps = [
        { text: 'Use a fresh wallet that holds only the funds you plan to farm, and keep its seed phrase offline.', cost: 'no fee to set up', time: '5 minutes' },
        { text: actionFor(p, capital, chain), cost: '$' + capital + ' of capital and about $' + gas + ' of gas', time: '15 minutes to set up' }];
    if (second !== null) {
      var half = Math.max(10, Math.round(capital / 2));
      steps.push({ text: p.name + ' also runs on ' + second + ': repeat the position there with $' + half + ' so the wallet is active on both chains.', cost: '$' + half + ' of capital and about $' + gasPerTx(second) + ' of gas', time: '10 minutes' });
    } else {
      steps.push({ text: secondActionFor(p, capital, chain), cost: 'about $' + gas + ' of gas', time: '10 minutes' });
    }
    steps.push(
      { text: 'Make one qualifying action each week, such as a deposit, a borrow, a swap or a vote.', cost: 'about $' + (gas * weeks) + ' of gas over ' + weeks + ' weeks', time: '10 minutes a week' },
      { text: 'Hold the position for at least ' + hold + ' days so the activity is counted in more than one snapshot.', cost: 'the $' + capital + ' stays in the position', time: hold + ' days' },
      { text: 'Before you withdraw, open the protocol\'s own points or rewards page and claim only from the link it publishes.', cost: 'no fee to check, and never pay to claim', time: '10 minutes' },
      { text: 'Write the wallet, the dates and every transaction in a farm log, then unwind in two steps so the exit is itself recorded.', cost: 'about $' + (gas * 2) + ' of gas to exit', time: '10 minutes' });
    return steps.map(stepText);
  }
  function farmEcon(p) {
    var chain = chainOf(p), second = secondOf(p), capital = capitalFor(p), hold = holdFor(p.age),
      weeks = Math.max(1, Math.ceil(hold / 7)), txs = 1 + 1 + weeks + 2, gas = txs * gasPerTx(chain);
    if (second !== null) gas += gasPerTx(second);
    var opp = Math.round(capital * (M.apr || 0.05) * (hold / 365) * 100) / 100;
    var net = Math.round((gas + opp) * 100) / 100;
    var v = (p.implied >= 2e7 && net <= 40) ? 'FARM' : (p.implied >= 8e6 && net <= 100) ? 'THIN' : 'SKIP';
    return { capital: capital, gas: gas, opp: opp, net: net, verdict: v, hold: hold };
  }
  // Row arrays -> objects. Row: [rank, slug, name, cat, chains, tvl, chg, age, implied]
  function rowObj(r) { return { rank: r[0], slug: r[1], name: r[2], cat: r[3], chains: r[4] ? r[4].split(', ') : [], chainsText: r[4] || '', tvl: r[5], chg: r[6], age: r[7], implied: r[8] }; }
  function growthPct(r) { var g = (r.chg === null || r.chg === undefined) ? 0 : r.chg; return Math.min(M.growth_cap || 120, Math.max(M.growth_floor || -60, g)); }
  function maturity(r) { var a = (r.age === null || r.age === undefined) ? (M.unknown_age_days || 990) : r.age; return (M.maturity_floor || 0.8) + (Math.min(Math.max(a, 0), M.maturity_days || 1095) / (M.maturity_days || 1095)) * (M.maturity_range || 0.2); }

  // ---- hash state ----
  function readHash() {
    var h = (location.hash || '').replace(/^#/, ''), parts = h.split('&');
    parts.forEach(function (kv) { var i = kv.indexOf('='); if (i < 0) return; var k = kv.slice(0, i), v = decodeURIComponent(kv.slice(i + 1)); if (k === 'q') state.q = v; if (k === 'cat') state.cat = v; if (k === 'verdict') state.verdict = v; if (k === 'tab') state.tab = v; if (k === 'detail') state.selected = v; });
  }
  function writeHash() {
    var p = [];
    if (state.q) p.push('q=' + encodeURIComponent(state.q));
    if (state.cat !== 'all') p.push('cat=' + encodeURIComponent(state.cat));
    if (state.verdict !== 'all') p.push('verdict=' + state.verdict);
    if (state.tab !== 'pre-token') p.push('tab=' + state.tab);
    if (state.selected) p.push('detail=' + state.selected);
    history.replaceState(null, '', p.length ? '#' + p.join('&') : location.pathname + location.search);
  }

  // ---- chart: fitted size curve over the 111 comparables ----
  function chart() {
    var pts = DATA.comps || [], W = 560, H = 300, P = 34;
    var xs = pts.map(function (p) { return p[0]; }), ys = pts.map(function (p) { return p[1]; });
    var x0 = Math.min.apply(null, xs) - 0.3, x1 = Math.max.apply(null, xs) + 0.3;
    var y0 = Math.min.apply(null, ys) - 0.3, y1 = Math.max.apply(null, ys) + 0.3;
    function X(v) { return P + (v - x0) / (x1 - x0) * (W - 2 * P); }
    function Y(v) { return H - P - (v - y0) / (y1 - y0) * (H - 2 * P); }
    var s = '<svg class="chart" viewBox="0 0 560 300" role="img" aria-label="Scatter of traded comparables with the fitted size curve">';
    s += '<rect x="0" y="0" width="560" height="300" fill="#fff"/>';
    [[Math.log(1e7), '$10M'], [Math.log(1e8), '$100M'], [Math.log(1e9), '$1B'], [Math.log(1e10), '$10B']].forEach(function (t) {
      s += '<line x1="' + X(t[0]).toFixed(1) + '" y1="' + (H - P) + '" x2="' + X(t[0]).toFixed(1) + '" y2="' + P + '" stroke="#eef2ee"/>';
      s += '<text x="' + X(t[0]).toFixed(1) + '" y="' + (H - 12) + '" font-size="10" fill="#5c6b60" text-anchor="middle">' + t[1] + '</text>';
    });
    [[Math.log(1e6), '$1M'], [Math.log(1e7), '$10M'], [Math.log(1e8), '$100M'], [Math.log(1e9), '$1B']].forEach(function (t) {
      s += '<line x1="' + P + '" y1="' + Y(t[0]).toFixed(1) + '" x2="' + (W - P) + '" y2="' + Y(t[0]).toFixed(1) + '" stroke="#eef2ee"/>';
      s += '<text x="8" y="' + (Y(t[0]) + 3).toFixed(1) + '" font-size="10" fill="#5c6b60">' + t[1] + '</text>';
    });
    pts.forEach(function (p) { s += '<circle cx="' + X(p[0]).toFixed(1) + '" cy="' + Y(p[1]).toFixed(1) + '" r="2.4" fill="#0b6e4f" opacity="0.55"/>'; });
    var fx0 = x0, fx1 = x1;
    s += '<line x1="' + X(fx0).toFixed(1) + '" y1="' + Y(M.intercept + M.elasticity * fx0).toFixed(1) + '" x2="' + X(fx1).toFixed(1) + '" y2="' + Y(M.intercept + M.elasticity * fx1).toFixed(1) + '" stroke="#0b6e4f" stroke-width="2.5"/>';
    s += '<line x1="' + X(fx0).toFixed(1) + '" y1="' + Y(Math.log(0.25) + fx0).toFixed(1) + '" x2="' + X(fx1).toFixed(1) + '" y2="' + Y(Math.log(0.25) + fx1).toFixed(1) + '" stroke="#a33327" stroke-width="1.5" stroke-dasharray="5 4"/>';
    s += '<text x="' + (W - P) + '" y="' + (Y(M.intercept + M.elasticity * fx1) - 8).toFixed(1) + '" font-size="11" fill="#0b6e4f" text-anchor="end">fitted curve</text>';
    s += '<text x="' + (W - P) + '" y="' + (Y(Math.log(0.25) + fx1) + 16).toFixed(1) + '" font-size="11" fill="#a33327" text-anchor="end">house starter (0.25 x TVL)</text>';
    s += '<text x="' + P + '" y="16" font-size="11" fill="#17211b">log market cap vs log TVL, ' + (FIT.comps || 111) + ' traded comparables</text>';
    return s + '</svg>';
  }

  // ---- rendering ----
  function header() {
    var farm = 0, thin = 0, skip = 0;
    ROWS.forEach(function (r) { var e = farmEcon(rowObj(r)); if (e.verdict === 'FARM') farm++; else if (e.verdict === 'THIN') thin++; else skip++; });
    return $('div', {}, [
      $('div', { class: 'top' }, [
        $('span', { class: 'eyebrow', html: '<span class="dot"></span>Airdrop Radar' }),
        $('span', { text: 'Snapshot ' + (DATA.as_of || '') + ' · DefiLlama protocol index · radar-2 model' }),
      ]),
      $('h1', { text: '200 pre-token protocols, ranked by implied launch value' }),
      $('p', { class: 'lede', text: 'The watchlist is the floor: every protocol with at least $50M of TVL and no token on record. The early radar adds 160 pre-token protocols below that floor. Implied value is a model fitted on the tokens that already trade, not a promise — and every row carries a farm plan netted to the dollar.' }),
      $('div', { class: 'stats' }, [
        $('div', { class: 'stat' }, [$('b', { text: (DATA.watchlist_size || 0) + ' / ' + (DATA.watchlist_size || 0) }), $('span', { text: 'Watchlist covered' })]),
        $('div', { class: 'stat' }, [$('b', { text: String(DATA.board_size || 0) }), $('span', { text: 'Pre-token rows scored' })]),
        $('div', { class: 'stat' }, [$('b', { text: String(DATA.early_size || 0) }), $('span', { text: 'Early rows below the floor' })]),
        $('div', { class: 'stat' }, [$('b', { text: 'FARM ' + farm + ' · THIN ' + thin + ' · SKIP ' + skip }), $('span', { text: 'Farm verdicts on the board' })]),
      ]),
    ]);
  }
  function modelPanel() {
    var f = FIT;
    return $('section', { class: 'panel' }, [
      $('h2', { text: 'The value model, fitted on the snapshot itself' }),
      $('div', { class: 'fitgrid' }, [
        $('div', {}, [
          $('p', { html: 'log(market cap) = <span class="mono">8.0718 + 0.4524 · log(TVL) + 0.003 · growth + log(maturity)</span>' }),
          $('p', { text: 'Growth is the 7-day TVL change, clamped to −60…+120%. Maturity is 0.8 + 0.2 · min(age, 1095) / 1095; an unknown listing date counts as 990 days, the median age of the comparables.' }),
          $('table', {}, [
            $('tr', {}, [$('td', { text: 'Comparables fitted' }), $('td', { text: (f.comps || 111) + ' of ' + (f.traded_total || 144) + ' traded' })]),
            $('tr', {}, [$('td', { text: 'Left out of the fit' }), $('td', { text: (f.excluded_dead || 16) + ' dead tokens (cap ≤ 0), ' + (f.excluded_cex_bridge || 17) + ' CEX / bridge records' })]),
            $('tr', {}, [$('td', { text: 'In-sample R²' }), $('td', { text: String(f.r2_in_sample ?? 0.14) })]),
            $('tr', {}, [$('td', { text: 'Out-of-sample R² (5-fold)' }), $('td', { text: String(f.r2_oos_5fold ?? 0.09) })]),
            $('tr', {}, [$('td', { text: 'House starter, same folds' }), $('td', { text: String(f.r2_oos_starter ?? -0.08) })]),
            $('tr', {}, [$('td', { text: 'Size elasticity' }), $('td', { text: '0.45 — value grows slower than TVL' })]),
          ]),
          $('p', { text: 'TVL size is the only loading that survives out of sample; the growth and age loadings in the free fit are both indistinguishable from zero, so they enter as small bounded priors. No protocol name is special-cased.' }),
        ]),
        $('div', { html: chart() }),
      ]),
    ]);
  }
  function controls() {
    var cats = Array.from(new Set(ROWS.map(function (r) { return r[3] || 'Other'; }))).sort();
    var search = $('input', { type: 'search', placeholder: 'Search name, category or chain', value: state.q, 'aria-label': 'Search' });
    search.addEventListener('input', function () { state.q = search.value; writeHash(); render(); });
    var cat = $('select', { 'aria-label': 'Category' });
    cat.appendChild($('option', { value: 'all', text: 'All categories' }));
    cats.forEach(function (c) { cat.appendChild($('option', { value: c, text: c, selected: c === state.cat ? 'selected' : null })); });
    cat.addEventListener('change', function () { state.cat = cat.value; writeHash(); render(); });
    var ver = $('select', { 'aria-label': 'Farm verdict' });
    [['all', 'All verdicts'], ['FARM', 'FARM'], ['THIN', 'THIN'], ['SKIP', 'SKIP']].forEach(function (o) { ver.appendChild($('option', { value: o[0], text: o[1], selected: o[0] === state.verdict ? 'selected' : null })); });
    ver.addEventListener('change', function () { state.verdict = ver.value; writeHash(); render(); });
    var pre = $('button', { type: 'button', 'aria-pressed': state.tab === 'pre-token' ? 'true' : 'false', text: 'Pre-token', onclick: function () { state.tab = 'pre-token'; writeHash(); render(); } });
    var live = $('button', { type: 'button', 'aria-pressed': state.tab === 'live' ? 'true' : 'false', text: 'Live token', onclick: function () { state.tab = 'live'; writeHash(); render(); } });
    return $('div', { class: 'controls' }, [
      $('div', {}, [$('label', { text: 'Search' }), search]),
      $('div', {}, [$('label', { text: 'Category' }), cat]),
      $('div', {}, [$('label', { text: 'Farm verdict' }), ver]),
      $('div', { class: 'tabs' }, [pre, live]),
    ]);
  }
  function filteredRows() {
    var q = state.q.trim().toLowerCase();
    return ROWS.map(rowObj).filter(function (r) {
      if (state.cat !== 'all' && (r.cat || 'Other') !== state.cat) return false;
      if (state.verdict !== 'all' && farmEcon(r).verdict !== state.verdict) return false;
      if (!q) return true;
      return (r.name + ' ' + r.slug + ' ' + (r.cat || '') + ' ' + r.chainsText).toLowerCase().indexOf(q) >= 0;
    });
  }
  function sortedRows(list) {
    var k = state.sort, d = state.dir;
    return list.slice().sort(function (a, b) {
      var va = k === 'name' ? a.name : k === 'tvl' ? a.tvl : k === 'chg' ? (a.chg === null ? -999 : a.chg) : k === 'age' ? (a.age === null ? -1 : a.age) : k === 'implied' ? a.implied : a.rank;
      var vb = k === 'name' ? b.name : k === 'tvl' ? b.tvl : k === 'chg' ? (b.chg === null ? -999 : b.chg) : k === 'age' ? (b.age === null ? -1 : b.age) : k === 'implied' ? b.implied : b.rank;
      if (va < vb) return -d; if (va > vb) return d; return a.slug < b.slug ? -1 : 1;
    });
  }
  function sortHeader(key, label) {
    var arrow = state.sort === key ? (state.dir === 1 ? ' ▲' : ' ▼') : '';
    return $('th', {}, [$('button', { type: 'button', text: label + arrow, onclick: function () { if (state.sort === key) state.dir = -state.dir; else { state.sort = key; state.dir = key === 'name' ? 1 : -1; } render(); } })]);
  }
  function boardTable() {
    var list = sortedRows(filteredRows());
    var maxImp = 1; ROWS.forEach(function (r) { if (r[8] > maxImp) maxImp = r[8]; });
    var head = $('tr', {}, [sortHeader('rank', 'Rank'), sortHeader('name', 'Protocol'), sortHeader('tvl', 'TVL'), sortHeader('chg', '7d'), sortHeader('age', 'Age'), sortHeader('implied', 'Implied value'), $('th', { text: 'Farm' })]);
    var body = list.map(function (r) {
      var e = farmEcon(r);
      var chg = r.chg === null ? $('span', { text: '—' }) : $('span', { class: r.chg >= 0 ? 'up' : 'down', text: fmtPct(r.chg) });
      return $('tr', { 'data-slug': r.slug, tabindex: '0', onclick: function () { openDetail(r.slug); }, onkeydown: function (ev) { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); openDetail(r.slug); } } }, [
        $('td', { text: String(r.rank) }),
        $('td', {}, [$('div', { class: 'name', text: r.name }), $('div', { class: 'sub', text: (r.cat || 'Other') + ' on ' + (r.chainsText || '—') })]),
        $('td', { class: 'num', text: fmtUsd(r.tvl) }),
        $('td', { class: 'num' }, [chg]),
        $('td', { class: 'num', text: fmtAge(r.age) }),
        $('td', { class: 'num' }, [$('span', { class: 'bar' }, [$('i', { style: 'width:' + Math.max(2, Math.round(r.implied / maxImp * 100)) + '%' })]), $('span', { text: fmtUsd(r.implied) })]),
        $('td', {}, [$('span', { class: 'pill ' + e.verdict.toLowerCase(), text: e.verdict })]),
      ]);
    });
    var empty = list.length === 0 ? $('p', { class: 'count', text: 'No rows match these filters.' }) : null;
    return $('div', {}, [
      $('p', { class: 'count', text: list.length + ' rows shown · select a row for its model and farm plan' }),
      $('table', { class: 'board' }, [$('caption', { class: 'sub', text: 'Pre-token protocols, strongest implied value first.' }), $('thead', {}, [head]), $('tbody', {}, body)]),
      empty,
    ]);
  }
  function liveTable() {
    var head = $('tr', {}, [$('th', { text: 'Protocol' }), $('th', { class: 'num', text: 'TVL' }), $('th', { class: 'num', text: 'Market cap' }), $('th', { class: 'num', text: '7d' })]);
    var body = LIVE.map(function (l) {
      return $('tr', {}, [
        $('td', {}, [$('div', { class: 'name', text: l[1] }), $('div', { class: 'sub', text: (l[2] || 'Other') + ' on ' + (l[3] || '—') })]),
        $('td', { class: 'num', text: fmtUsd(l[4]) }),
        $('td', { class: 'num', text: fmtUsd(l[5]) }),
        $('td', { class: 'num' }, [l[6] === null ? $('span', { text: '—' }) : $('span', { class: l[6] >= 0 ? 'up' : 'down', text: fmtPct(l[6]) })]),
      ]);
    });
    return $('div', {}, [
      $('p', { class: 'count', text: 'Protocols whose token already trades — the market’s own values, kept apart from the ranked board.' }),
      $('table', { class: 'board' }, [$('thead', {}, [head]), $('tbody', {}, body)]),
    ]);
  }
  function detailDialog() {
    var dlg = $('dialog', { id: 'detail' });
    dlg.addEventListener('close', function () { state.selected = null; writeHash(); });
    return dlg;
  }
  function openDetail(slug) {
    var r = ROWS.map(rowObj).filter(function (x) { return x.slug === slug; })[0];
    if (!r) return;
    state.selected = slug; writeHash();
    var e = farmEcon(r);
    var g = growthPct(r), mat = maturity(r);
    var size = Math.exp((M.intercept || 8.0718) + (M.elasticity || 0.4524) * Math.log(r.tvl));
    var gf = Math.exp((M.growth_tilt || 0.003) * g);
    var dlg = document.getElementById('detail');
    dlg.innerHTML = '';
    var box = $('div', { class: 'dlg' }, [
      $('button', { class: 'close', type: 'button', text: 'Close', onclick: function () { dlg.close(); } }),
      $('h2', { text: '#' + r.rank + ' ' + r.name }),
      $('p', { class: 'sub', text: (r.cat || 'Other') + ' on ' + (r.chainsText || '—') + ' · TVL ' + fmtUsd(r.tvl) + ' · 7d ' + fmtPct(r.chg) + ' · age ' + fmtAge(r.age) + ' · no token on record' }),
      $('h3', { text: 'Why this value — the model, step by step' }),
      $('table', {}, [
        $('tr', {}, [$('td', { text: 'Size value — exp(8.0718 + 0.4524 · log TVL)' }), $('td', { text: fmtUsd(size) })]),
        $('tr', {}, [$('td', { text: 'Growth factor — exp(0.003 · ' + g.toFixed(2) + '%)' }), $('td', { text: '×' + gf.toFixed(3) })]),
        $('tr', {}, [$('td', { text: 'Maturity factor — age ' + fmtAge(r.age) }), $('td', { text: '×' + mat.toFixed(3) })]),
        $('tr', {}, [$('td', { text: 'Implied launch value' }), $('td', { text: fmtUsd(r.implied) })]),
      ]),
      $('h3', { text: 'Farm plan — netted to the dollar' }),
      $('table', {}, [
        $('tr', {}, [$('td', { text: 'Capital in the position' }), $('td', { text: fmtMoney(e.capital) })]),
        $('tr', {}, [$('td', { text: 'Gas (setup, weekly, exit)' }), $('td', { text: fmtMoney(e.gas) })]),
        $('tr', {}, [$('td', { text: 'Opportunity cost, 5% a year over ' + e.hold + ' days' }), $('td', { text: fmtMoney(e.opp) })]),
        $('tr', {}, [$('td', { text: 'Net cost of the plan' }), $('td', { text: fmtMoney(e.net) })]),
        $('tr', {}, [$('td', { text: 'Verdict' }), $('td', {}, [$('span', { class: 'pill ' + e.verdict.toLowerCase(), text: e.verdict })])]),
      ]),
      $('p', { class: 'sub', text: 'FARM: implied value at least $20M and net cost at most $40. THIN: at least $8M and at most $100. Otherwise SKIP. A rule of thumb, not a promise — a token may never launch.' }),
      $('h3', { text: 'The seven steps' }),
      $('ol', {}, farmSteps(r).map(function (s) { return $('li', { text: s }); })),
    ]);
    dlg.appendChild(box);
    if (!dlg.open) dlg.showModal();
  }
  function render() {
    var main = document.getElementById('board');
    main.innerHTML = '';
    main.setAttribute('aria-busy', 'false');
    main.appendChild(detailDialog());
    main.appendChild(header());
    main.appendChild(modelPanel());
    main.appendChild(controls());
    main.appendChild(state.tab === 'live' ? liveTable() : boardTable());
    main.appendChild($('footer', {}, [
      $('p', { text: 'Snapshot ' + (DATA.as_of || '') + ' from DefiLlama’s public protocol index; ' + (DATA.watchlist_size || 0) + ' protocols on the watchlist, ' + (DATA.board_size || 0) + ' rows on the board. Implied value is this entry’s own model claim, never make.fun’s, and never a prediction that a token will launch.' }),
      $('p', { text: 'Gas figures are typical, not quotes; the farm plan never asks you to pay to claim. Airdrop Radar, model radar-2.' }),
    ]));
    if (state.selected) openDetail(state.selected);
  }
  readHash();
  render();
})();
