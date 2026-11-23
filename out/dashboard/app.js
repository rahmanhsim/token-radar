// Token Radar — Single-page application logic
// Reads window.RADAR_DATA or window.RADAR
(function () {
  'use strict';

  var DATA = window.RADAR_DATA || window.RADAR || null;
  if (!DATA || !Array.isArray(DATA.rows)) {
    var errEl = document.getElementById('results-count');
    if (errEl) errEl.textContent = 'error: data source missing';
    return;
  }

  // Application State
  var state = {
    search: '',
    category: 'all',
    watchlistOnly: false,
    sortCol: 'rank',
    sortDir: 'asc',
    pageSize: 100,
    displayedCount: 100,
    selectedSlug: null
  };

  // DOM Elements
  var statProtocols = document.getElementById('stat-protocols');
  var statWatchlist = document.getElementById('stat-watchlist');
  var statImplied = document.getElementById('stat-implied');
  var asOfDate = document.getElementById('as-of-date');
  var modelVer = document.getElementById('model-ver');

  var searchInput = document.getElementById('search-input');
  var categorySelect = document.getElementById('category-select');
  var filterAllBtn = document.getElementById('filter-all');
  var filterWlBtn = document.getElementById('filter-watchlist');
  var resultsCount = document.getElementById('results-count');

  var tableBody = document.getElementById('table-body');
  var tableHeaders = document.querySelectorAll('.th-sortable');
  var emptyState = document.getElementById('empty-state');
  var resetFiltersBtn = document.getElementById('reset-filters-btn');
  var loadMoreWrap = document.getElementById('load-more-wrap');
  var loadMoreBtn = document.getElementById('load-more-btn');

  var detailModal = document.getElementById('detail-modal');
  var dialogContent = document.getElementById('dialog-content');

  // Formatting Helpers
  function fmtUsd(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    var abs = Math.abs(n);
    if (abs >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
    if (abs >= 1e6) return '$' + (n / 1e6).toFixed(2) + 'M';
    if (abs >= 1e3) return '$' + Math.round(n / 1e3).toLocaleString('en-US') + 'K';
    return '$' + Math.round(n).toLocaleString('en-US');
  }

  function fmtUsdFull(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    return '$' + Math.round(n).toLocaleString('en-US');
  }

  function fmtPct(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    var sign = n > 0 ? '+' : '';
    return sign + n.toFixed(2) + '%';
  }

  function fmtAge(days) {
    if (days === null || days === undefined || !isFinite(days)) return 'unknown';
    return Math.round(days) + ' d';
  }

  function padDots(label, totalLen) {
    var dots = '';
    var needed = Math.max(2, totalLen - label.length);
    for (var i = 0; i < needed; i++) dots += '.';
    return label + ' ' + dots + ' ';
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // URL Hash State Sync
  function readHash() {
    var hash = window.location.hash.replace(/^#/, '');
    if (!hash) return;
    var params = new URLSearchParams(hash);
    if (params.get('q')) state.search = params.get('q');
    if (params.get('category')) state.category = params.get('category');
    if (params.get('wl') === '1') state.watchlistOnly = true;
    if (params.get('sort')) state.sortCol = params.get('sort');
    if (params.get('dir') === 'desc' || params.get('dir') === 'asc') state.sortDir = params.get('dir');
    if (params.get('p')) state.selectedSlug = params.get('p');
  }

  function writeHash() {
    var params = new URLSearchParams();
    if (state.search) params.set('q', state.search);
    if (state.category !== 'all') params.set('category', state.category);
    if (state.watchlistOnly) params.set('wl', '1');
    if (state.sortCol !== 'rank') params.set('sort', state.sortCol);
    if (state.sortDir !== 'asc') params.set('dir', state.sortDir);
    if (state.selectedSlug) params.set('p', state.selectedSlug);

    var next = params.toString();
    if (next) {
      window.history.replaceState(null, '', '#' + next);
    } else {
      window.history.replaceState(null, '', window.location.pathname + window.location.search);
    }
  }

  // Header & Stat Chips Initialization
  function initHeaderStats() {
    var rows = DATA.rows;
    var totalProtocols = rows.length;
    var totalWatchlist = 0;
    var totalImpliedValue = 0;

    for (var i = 0; i < rows.length; i++) {
      if (rows[i].is_watchlist) totalWatchlist++;
      if (rows[i].implied_value_usd) totalImpliedValue += rows[i].implied_value_usd;
    }

    if (statProtocols) statProtocols.textContent = totalProtocols.toString();
    if (statWatchlist) statWatchlist.textContent = totalWatchlist.toString();
    if (statImplied) statImplied.textContent = fmtUsd(totalImpliedValue);
    if (asOfDate && DATA.as_of) asOfDate.textContent = 'snapshot: ' + DATA.as_of;
    if (modelVer && DATA.model_version) modelVer.textContent = 'model: ' + DATA.model_version;
  }

  // Populate Categories Filter
  function initCategories() {
    var catMap = {};
    for (var i = 0; i < DATA.rows.length; i++) {
      var cat = DATA.rows[i].category;
      if (cat) catMap[cat] = (catMap[cat] || 0) + 1;
      else catMap['Other'] = (catMap['Other'] || 0) + 1;
    }

    var sortedCategories = Object.keys(catMap).sort();
    categorySelect.innerHTML = '<option value="all">all categories (' + DATA.rows.length + ')</option>';

    for (var j = 0; j < sortedCategories.length; j++) {
      var c = sortedCategories[j];
      var opt = document.createElement('option');
      opt.value = c;
      opt.textContent = c.toLowerCase() + ' (' + catMap[c] + ')';
      if (state.category === c) opt.selected = true;
      categorySelect.appendChild(opt);
    }
  }

  // Filter Rows
  function getFilteredRows() {
    var q = state.search.trim().toLowerCase();
    var cat = state.category;
    var wlOnly = state.watchlistOnly;

    return DATA.rows.filter(function (r) {
      if (wlOnly && !r.is_watchlist) return false;
      if (cat !== 'all') {
        var rCat = r.category || 'Other';
        if (rCat !== cat) return false;
      }
      if (q) {
        var name = (r.name || '').toLowerCase();
        var slug = (r.slug || '').toLowerCase();
        if (name.indexOf(q) === -1 && slug.indexOf(q) === -1) {
          return false;
        }
      }
      return true;
    });
  }

  // Sort Rows
  function getSortedRows(rows) {
    var col = state.sortCol;
    var dir = state.sortDir === 'asc' ? 1 : -1;

    return rows.slice().sort(function (a, b) {
      var av, bv;

      if (col === 'rank') {
        av = a.rank;
        bv = b.rank;
      } else if (col === 'name') {
        av = (a.name || '').toLowerCase();
        bv = (b.name || '').toLowerCase();
        if (av < bv) return -dir;
        if (av > bv) return dir;
        return 0;
      } else if (col === 'category') {
        av = (a.category || '').toLowerCase();
        bv = (b.category || '').toLowerCase();
        if (av < bv) return -dir;
        if (av > bv) return dir;
        return 0;
      } else if (col === 'tvl_usd') {
        av = a.tvl_usd || 0;
        bv = b.tvl_usd || 0;
      } else if (col === 'change_7d') {
        av = a.change_7d === null || a.change_7d === undefined ? -Infinity : a.change_7d;
        bv = b.change_7d === null || b.change_7d === undefined ? -Infinity : b.change_7d;
      } else if (col === 'age_days') {
        av = a.age_days === null || a.age_days === undefined ? -1 : a.age_days;
        bv = b.age_days === null || b.age_days === undefined ? -1 : b.age_days;
      } else if (col === 'implied_value_usd') {
        av = a.implied_value_usd || 0;
        bv = b.implied_value_usd || 0;
      } else {
        av = a.rank;
        bv = b.rank;
      }

      if (av < bv) return -dir;
      if (av > bv) return dir;
      return a.rank - b.rank;
    });
  }

  // Update Sort Header Icons
  function updateHeaderIndicators() {
    for (var i = 0; i < tableHeaders.length; i++) {
      var th = tableHeaders[i];
      var col = th.getAttribute('data-col');
      var indicator = th.querySelector('.sort-indicator');
      if (indicator) {
        if (col === state.sortCol) {
          indicator.textContent = state.sortDir === 'asc' ? '▲' : '▼';
        } else {
          indicator.textContent = '';
        }
      }
    }
  }

  // Render Table
  function renderTable() {
    updateHeaderIndicators();

    var filtered = getFilteredRows();
    var sorted = getSortedRows(filtered);
    var totalCount = DATA.rows.length;
    var filteredCount = sorted.length;

    // Results count
    if (filteredCount === totalCount) {
      resultsCount.textContent = 'showing ' + Math.min(state.displayedCount, filteredCount) + ' of ' + totalCount + ' protocols';
    } else {
      resultsCount.textContent = 'showing ' + Math.min(state.displayedCount, filteredCount) + ' of ' + filteredCount + ' (' + totalCount + ' total)';
    }

    if (filteredCount === 0) {
      tableBody.innerHTML = '';
      emptyState.style.display = 'block';
      loadMoreWrap.style.display = 'none';
      return;
    }

    emptyState.style.display = 'none';

    // Maximum implied value for the visual bar
    var maxImplied = 1;
    for (var m = 0; m < DATA.rows.length; m++) {
      if (DATA.rows[m].implied_value_usd > maxImplied) {
        maxImplied = DATA.rows[m].implied_value_usd;
      }
    }

    var visibleRows = sorted.slice(0, state.displayedCount);
    var html = '';

    for (var i = 0; i < visibleRows.length; i++) {
      var r = visibleRows[i];

      var growthClass = 'growth-zero';
      if (r.change_7d !== null && r.change_7d !== undefined) {
        growthClass = r.change_7d > 0 ? 'growth-pos' : r.change_7d < 0 ? 'growth-neg' : 'growth-zero';
      }

      var chainsText = r.chains && r.chains.length ? r.chains.slice(0, 3).join(', ') : 'primary';
      if (r.chains && r.chains.length > 3) chainsText += ' +' + (r.chains.length - 3);

      var barPct = Math.max(5, Math.round((r.implied_value_usd / maxImplied) * 100));

      var rankClass = 'rank-badge';
      if (r.rank === 1) {
        rankClass = 'rank-badge rank-1';
      } else if (r.rank <= 3) {
        rankClass = 'rank-badge rank-top';
      }

      var wlBadge = r.is_watchlist ? '<span class="star-pill" title="watchlist floor">★ watchlist</span>' : '';

      html += '<tr tabindex="0" data-slug="' + escapeHtml(r.slug) + '" role="button" aria-label="view details for ' + escapeHtml(r.name) + '">' +
        '<td class="td-rank"><span class="' + rankClass + '">#' + r.rank + '</span></td>' +
        '<td class="td-proto">' +
          '<div class="proto-info">' +
            '<div class="proto-name-row">' +
              '<span class="proto-name">' + escapeHtml(r.name) + '</span>' +
              wlBadge +
            '</div>' +
            '<span class="proto-chains">' + escapeHtml(chainsText) + '</span>' +
          '</div>' +
        '</td>' +
        '<td class="td-category"><span class="category-pill">' + escapeHtml(r.category || 'other') + '</span></td>' +
        '<td class="td-tvl"><span class="cell-num">' + fmtUsd(r.tvl_usd) + '</span></td>' +
        '<td class="td-growth"><span class="cell-num ' + growthClass + '">' + fmtPct(r.change_7d) + '</span></td>' +
        '<td class="td-age"><span class="cell-num">' + fmtAge(r.age_days) + '</span></td>' +
        '<td class="td-implied">' +
          '<div class="implied-cell-wrap">' +
            '<span class="implied-val-text">' + fmtUsd(r.implied_value_usd) + '</span>' +
            '<div class="implied-bar-bg"><div class="implied-bar-fill" style="width: ' + barPct + '%;"></div></div>' +
          '</div>' +
        '</td>' +
      '</tr>';
    }

    tableBody.innerHTML = html;

    // Load More visibility
    if (filteredCount > state.displayedCount) {
      loadMoreWrap.style.display = 'flex';
      var remaining = filteredCount - state.displayedCount;
      loadMoreBtn.textContent = 'load more protocols (+' + Math.min(state.pageSize, remaining) + ')';
    } else {
      loadMoreWrap.style.display = 'none';
    }
  }

  // Open Protocol Detail Dialog (Dark Terminal Card)
  function openDetail(slug) {
    var row = null;
    for (var i = 0; i < DATA.rows.length; i++) {
      if (DATA.rows[i].slug === slug) {
        row = DATA.rows[i];
        break;
      }
    }
    if (!row) return;

    state.selectedSlug = slug;
    writeHash();

    var chainsList = row.chains && row.chains.length ? row.chains.join(', ') : 'single chain';
    var steps = row.farm_steps || [];

    var html = '<div class="term-title-bar">' +
      '<div class="term-dots">' +
        '<span class="term-dot dot-red" aria-hidden="true"></span>' +
        '<span class="term-dot dot-yellow" aria-hidden="true"></span>' +
        '<span class="term-dot dot-green" aria-hidden="true"></span>' +
      '</div>' +
      '<div class="term-window-title" id="modal-title">radar@terminal: ~/protocols/' + escapeHtml(row.slug) + ' - zsh (80x24)</div>' +
      '<button type="button" class="term-close-btn" id="modal-close-btn" aria-label="close terminal">[x] close</button>' +
    '</div>' +
    '<div class="term-body">' +
      '<div class="term-prompt-cmd">' +
        '<span class="term-cmd-glyph">&gt;</span>radar inspect --protocol ' + escapeHtml(row.slug) + ' --model ' + escapeHtml(DATA.model_version || 'radar-2') +
      '</div>' +
      '<div class="term-arithmetic-block">' +
        '<div class="term-line"><span class="term-prompt-sign">&gt;</span><span class="term-math-label">' + padDots('protocol', 18) + '</span><span class="term-math-val">' + escapeHtml(row.name) + ' [rank #' + row.rank + (row.is_watchlist ? ', watchlist' : '') + ']</span></div>' +
        '<div class="term-line"><span class="term-prompt-sign">&gt;</span><span class="term-math-label">' + padDots('category', 18) + '</span><span class="term-math-val">' + escapeHtml(row.category || 'general') + '</span></div>' +
        '<div class="term-line"><span class="term-prompt-sign">&gt;</span><span class="term-math-label">' + padDots('chains', 18) + '</span><span class="term-math-val">' + escapeHtml(chainsList) + '</span></div>' +
        '<div class="term-line"><span class="term-prompt-sign">&gt;</span><span class="term-math-label">' + padDots('tvl_usd', 18) + '</span><span class="term-math-val">' + fmtUsdFull(row.tvl_usd) + '</span></div>' +
        '<div class="term-line"><span class="term-prompt-sign">&gt;</span><span class="term-math-label">' + padDots('base multiple', 18) + '</span><span class="term-math-val">x0.20</span></div>' +
        '<div class="term-line"><span class="term-prompt-sign">&gt;</span><span class="term-math-label">' + padDots('7d growth', 18) + '</span><span class="term-math-val">' + fmtPct(row.change_7d) + ' (mult: x' + row.growth_multiplier.toFixed(4) + ')</span></div>' +
        '<div class="term-line"><span class="term-prompt-sign">&gt;</span><span class="term-math-label">' + padDots('age multiplier', 18) + '</span><span class="term-math-val">x' + row.maturity_multiplier.toFixed(4) + ' (' + fmtAge(row.age_days) + ')</span></div>' +
        '<div class="term-line"><span class="term-prompt-sign">&gt;</span><span class="term-math-label">' + padDots('category mult', 18) + '</span><span class="term-math-val">x' + row.category_multiplier.toFixed(2) + '</span></div>' +
        '<div class="term-section-divider"></div>' +
        '<div class="term-line"><span class="term-prompt-sign">&gt;</span><span class="term-math-label">' + padDots('formula', 18) + '</span><span class="term-math-val">tvl * 0.20 * growth * age * category</span></div>' +
        '<div class="term-line"><span class="term-result-sign">=</span><span class="term-math-label">' + padDots('implied value', 18) + '</span><span class="term-math-val accent">' + fmtUsdFull(row.implied_value_usd) + '</span></div>' +
      '</div>' +
      '<div class="term-section-divider"></div>' +
      '<div class="term-section-header">[ farm execution plan &bull; ' + steps.length + ' actionable steps ]</div>' +
      '<div class="term-farm-steps">';

    for (var s = 0; s < steps.length; s++) {
      var stepNum = (s + 1 < 10 ? '0' : '') + (s + 1);
      html += '<div class="term-step-row">' +
        '<span class="term-step-index">' + stepNum + '.</span>' +
        '<span class="term-step-text">' + escapeHtml(steps[s]) + '</span>' +
      '</div>';
    }

    html += '</div>' +
      '<div class="term-footer-status">status: exit 0 &bull; press [esc] or click outside to dismiss</div>' +
    '</div>';

    dialogContent.innerHTML = html;

    var closeBtn = document.getElementById('modal-close-btn');
    if (closeBtn) {
      closeBtn.onclick = function () {
        closeDetail();
      };
    }

    if (typeof detailModal.showModal === 'function') {
      if (!detailModal.open) detailModal.showModal();
    } else {
      detailModal.setAttribute('open', '');
    }
  }

  function closeDetail() {
    state.selectedSlug = null;
    writeHash();
    if (typeof detailModal.close === 'function') {
      detailModal.close();
    } else {
      detailModal.removeAttribute('open');
    }
  }

  // Event Listeners
  function attachEvents() {
    // Search input
    searchInput.value = state.search;
    searchInput.addEventListener('input', function () {
      state.search = searchInput.value;
      state.displayedCount = state.pageSize;
      writeHash();
      renderTable();
    });

    // Category select
    categorySelect.addEventListener('change', function () {
      state.category = categorySelect.value;
      state.displayedCount = state.pageSize;
      writeHash();
      renderTable();
    });

    // Watchlist toggle
    function updateToggleButtons() {
      if (state.watchlistOnly) {
        filterAllBtn.classList.remove('active');
        filterAllBtn.setAttribute('aria-checked', 'false');
        filterWlBtn.classList.add('active');
        filterWlBtn.setAttribute('aria-checked', 'true');
      } else {
        filterAllBtn.classList.add('active');
        filterAllBtn.setAttribute('aria-checked', 'true');
        filterWlBtn.classList.remove('active');
        filterWlBtn.setAttribute('aria-checked', 'false');
      }
    }

    filterAllBtn.addEventListener('click', function () {
      state.watchlistOnly = false;
      state.displayedCount = state.pageSize;
      updateToggleButtons();
      writeHash();
      renderTable();
    });

    filterWlBtn.addEventListener('click', function () {
      state.watchlistOnly = true;
      state.displayedCount = state.pageSize;
      updateToggleButtons();
      writeHash();
      renderTable();
    });

    // Table header sort clicks
    for (var i = 0; i < tableHeaders.length; i++) {
      (function (th) {
        th.addEventListener('click', function () {
          var col = th.getAttribute('data-col');
          if (state.sortCol === col) {
            state.sortDir = state.sortDir === 'asc' ? 'desc' : 'asc';
          } else {
            state.sortCol = col;
            state.sortDir = (col === 'tvl_usd' || col === 'implied_value_usd' || col === 'change_7d') ? 'desc' : 'asc';
          }
          writeHash();
          renderTable();
        });
      })(tableHeaders[i]);
    }

    // Row clicks (delegation on tbody)
    tableBody.addEventListener('click', function (e) {
      var tr = e.target.closest('tr');
      if (tr) {
        var slug = tr.getAttribute('data-slug');
        if (slug) openDetail(slug);
      }
    });

    tableBody.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') {
        var tr = e.target.closest('tr');
        if (tr) {
          e.preventDefault();
          var slug = tr.getAttribute('data-slug');
          if (slug) openDetail(slug);
        }
      }
    });

    // Reset filters button
    if (resetFiltersBtn) {
      resetFiltersBtn.addEventListener('click', function () {
        state.search = '';
        state.category = 'all';
        state.watchlistOnly = false;
        state.displayedCount = state.pageSize;
        searchInput.value = '';
        categorySelect.value = 'all';
        updateToggleButtons();
        writeHash();
        renderTable();
      });
    }

    // Load More button
    if (loadMoreBtn) {
      loadMoreBtn.addEventListener('click', function () {
        state.displayedCount += state.pageSize;
        renderTable();
      });
    }

    // Dialog close on backdrop click
    detailModal.addEventListener('click', function (e) {
      if (e.target === detailModal) {
        closeDetail();
      }
    });

    detailModal.addEventListener('close', function () {
      state.selectedSlug = null;
      writeHash();
    });

    window.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && detailModal.open) {
        closeDetail();
      }
    });

    // Initialize toggle button state from hash
    updateToggleButtons();
  }

  // Application Bootstrap
  readHash();
  initHeaderStats();
  initCategories();
  attachEvents();
  renderTable();

  // If hash specified a protocol, open it
  if (state.selectedSlug) {
    openDetail(state.selectedSlug);
  }
})();
