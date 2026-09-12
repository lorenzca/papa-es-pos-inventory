(function () {
  var targets = window.PAPA_JUMP_TARGETS || [];
  var palette = document.getElementById('jumpPalette');
  var input = document.getElementById('jumpInput');
  var list = document.getElementById('jumpList');
  var empty = document.getElementById('jumpEmpty');
  var accountChip = document.getElementById('accountChip');

  if (!palette || !input || !list || !targets.length) return;

  var visible = [];
  var activeIndex = 0;

  var currentPath = window.location.pathname.replace(/\/+$/, '') || '/';
  var isMac = /Mac|iPhone|iPad/.test(window.navigator.platform || '')
    || /Mac OS X/.test(window.navigator.userAgent || '');

  // set mac keyboard shortcut label on account chip
  if (isMac && accountChip) {
    accountChip.setAttribute('title', 'Quick Jump (⌘ K)');
    accountChip.setAttribute('aria-keyshortcuts', 'Meta+K');
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function isCurrent(target) {
    return target.href.replace(/\/+$/, '') === currentPath;
  }

  // searchable text fields for each route target
  function haystack(target) {
    return [
      target.label,
      target.sub,
      target.keywords,
      target.href.replace(/\//g, ' ')
    ];
  }

  // filter target list by search query
  function rank(query) {
    var trimmed = String(query || '').trim();
    if (!trimmed) return targets.slice();

    if (window.PapaSearch && typeof window.PapaSearch.filter === 'function') {
      return window.PapaSearch.filter(targets, trimmed, haystack);
    }

    var needle = trimmed.toLowerCase();
    return targets.filter(function (target) {
      return haystack(target).join(' ').toLowerCase().indexOf(needle) >= 0;
    });
  }

  // render filtered list in modal
  function render() {
    visible = rank(input.value);
    if (activeIndex >= visible.length) activeIndex = 0;

    list.innerHTML = visible.map(function (target, index) {
      return [
        '<a href="', escapeHtml(target.href), '" data-index="', index, '"',
        ' class="palette-row', index === activeIndex ? ' is-active' : '',
        target.danger ? ' is-danger' : '', '">',
        '  <span class="min-w-0">',
        '    <span class="palette-row-label">', escapeHtml(target.label), '</span>',
        '    <span class="palette-row-sub">', escapeHtml(target.sub || ''), '</span>',
        '  </span>',
        '  <span class="palette-row-tail">',
        isCurrent(target) ? '<span class="palette-tag">here</span>' : '',
        '    <span class="kbd">↵</span>',
        '  </span>',
        '</a>'
      ].join('');
    }).join('');

    empty.classList.toggle('hidden', visible.length > 0);
  }

  function isOpen() {
    return !palette.classList.contains('hidden');
  }

  // open search palette modal
  function open() {
    palette.classList.remove('hidden');
    if (accountChip) accountChip.setAttribute('aria-expanded', 'true');
    input.value = '';
    activeIndex = 0;
    render();
    var here = visible.findIndex(isCurrent);
    if (here === 0 && visible.length > 1) {
      activeIndex = 1;
      render();
    }
    input.focus();
  }

  // close search palette modal
  function close() {
    palette.classList.add('hidden');
    if (accountChip) accountChip.setAttribute('aria-expanded', 'false');
  }

  // navigate active selection with arrow keys
  function move(step) {
    if (!visible.length) return;
    activeIndex = (activeIndex + step + visible.length) % visible.length;
    render();
    var row = list.querySelector('.palette-row.is-active');
    if (row && row.scrollIntoView) row.scrollIntoView({ block: 'nearest' });
  }

  // navigate to active target url
  function go() {
    var target = visible[activeIndex];
    if (target) window.location.href = target.href;
  }

  if (accountChip) accountChip.addEventListener('click', open);

  // close on backdrop click
  palette.addEventListener('click', function (event) {
    if (event.target === palette) close();
  });

  input.addEventListener('input', function () {
    activeIndex = 0;
    render();
  });

  // keyboard navigation in search input
  input.addEventListener('keydown', function (event) {
    if (event.key === 'ArrowDown') { event.preventDefault(); return move(1); }
    if (event.key === 'ArrowUp') { event.preventDefault(); return move(-1); }
    if (event.key === 'Enter') { event.preventDefault(); return go(); }
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      close();
    }
  });

  // sync active item on hover
  list.addEventListener('mousemove', function (event) {
    var row = event.target.closest ? event.target.closest('.palette-row') : null;
    if (!row) return;
    var index = Number(row.getAttribute('data-index'));
    if (index !== activeIndex) {
      activeIndex = index;
      render();
    }
  });

  // ctrl+k / cmd+k shortcut to toggle palette
  document.addEventListener('keydown', function (event) {
    var combo = (event.ctrlKey || event.metaKey) && String(event.key).toLowerCase() === 'k';
    if (!combo) return;
    event.preventDefault();
    if (isOpen()) close(); else open();
  }, true);

  // escape to close palette
  document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape' && isOpen()) close();
  });

  render();
})();