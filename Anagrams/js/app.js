/* UI for the GamePigeon Anagrams / Word Hunt trainer. Logic lives in core.js. */
(function () {
  'use strict';

  var C = window.GPCore;
  var dict = C.Dictionary.fromString(window.GP_WORDS);

  var MODES = {
    an6: { kind: 'an', size: 6 },
    an7: { kind: 'an', size: 7 },
    wh4: { kind: 'wh', size: 4 },
    wh5: { kind: 'wh', size: 5 }
  };
  var MODE_KEYS = { 1: 'an6', 2: 'an7', 3: 'wh4', 4: 'wh5' };

  var $ = function (id) { return document.getElementById(id); };
  var els = {
    game: $('game'), grid: $('grid'), svg: $('pathSvg'), slots: $('slots'), rack: $('rack'),
    enter: $('enterBtn'), shuffle: $('shuffleBtn'), feedback: $('feedback'), hint: $('keysHint'),
    words: $('wordsCount'), score: $('score'), boardId: $('boardId'), copy: $('copyLink'),
    found: $('foundCount'), total: $('totalCount'), byLength: $('byLength'), list: $('wordList'),
    complete: $('complete'), newBtn: $('newBtn'), reveal: $('revealBtn')
  };

  // ------------------------------------------------------------ storage ---
  // Progress is a per-browser convenience; everything works without it.
  var STORE_KEY = 'gp-word-trainer-v1';
  var store = (function () {
    try { return JSON.parse(localStorage.getItem(STORE_KEY)) || {}; } catch (e) { return {}; }
  })();
  store.games = store.games || {};
  store.current = store.current || {};
  function persist() {
    var keys = Object.keys(store.games);
    if (keys.length > 60) keys.slice(0, keys.length - 60).forEach(function (k) { delete store.games[k]; });
    try { localStorage.setItem(STORE_KEY, JSON.stringify(store)); } catch (e) { /* ignore */ }
  }

  // --------------------------------------------------------------- state ---
  var game = null;   // current board
  var input = null;  // anagramInput / gridInput state
  var preview = null; // word whose path is previewed on the grid
  var lastFound = null;
  var flash = null;  // transient result message {text, cls}
  var flashTimer = 0;

  function gameKey() { return game.mode + ':' + game.seed; }
  function points(w) { return game.cfg.kind === 'an' ? C.anagramPoints(w) : C.wordHuntPoints(w); }

  function startGame(mode, seed) {
    var cfg = MODES[mode];
    seed = seed || C.randomSeed();
    game = { mode: mode, cfg: cfg, seed: seed, found: [], revealed: false };
    if (cfg.kind === 'an') {
      var rack = C.generateAnagramRack(dict, cfg.size, seed);
      game.letters = rack.letters;
      game.solutions = new Map(C.solveAnagram(dict, rack.letters, cfg.size).map(function (w) { return [w, null]; }));
      input = C.anagramInput(game.letters.slice());
    } else {
      game.grid = C.generateGrid(cfg.size, seed);
      game.solutions = new Map(C.solveGrid(dict, game.grid, cfg.size).map(function (s) { return [s.word, s.path]; }));
      input = C.gridInput(game.grid, cfg.size);
    }
    var saved = store.games[gameKey()];
    if (saved) {
      game.found = (saved.found || []).filter(function (w) { return game.solutions.has(w); });
      game.revealed = !!saved.revealed;
    }
    store.mode = mode;
    store.current[mode] = seed;
    saveGame();
    preview = null;
    lastFound = null;
    try { history.replaceState(null, '', '#' + mode + '-' + seed); } catch (e) { /* file:// in some browsers */ }
    flash = null;
    buildBoard();
    renderAll();
  }

  function saveGame() {
    store.games[gameKey()] = { found: game.found, revealed: game.revealed };
    persist();
  }

  // ------------------------------------------------------------- actions ---
  function currentWord() {
    return game.cfg.kind === 'an' ? C.anagramWord(input) : input.typed;
  }

  function liveClass(word) {
    if (word.length < 3) return '';
    if (game.found.indexOf(word) >= 0) return 'dup';
    if (game.solutions.has(word)) return 'good';
    return '';
  }

  function submit(silentIfShort) {
    var word = currentWord();
    if (!word) return;
    clearInput();
    var W = word.toUpperCase();
    if (word.length < 3) {
      if (!silentIfShort) flashMsg('Too short', 'bad');
    } else if (game.found.indexOf(word) >= 0) {
      flashMsg(W + ' — already found', 'dup');
    } else if (game.solutions.has(word)) {
      game.found.push(word);
      lastFound = word;
      saveGame();
      flashMsg(W + ' (+' + points(word) + ')', 'good');
    } else {
      flashMsg(W + ' — not in word list', 'bad');
    }
    renderAll();
  }

  function clearInput() {
    input = game.cfg.kind === 'an' ? C.anagramInput(input.letters) : C.gridClear(input);
  }

  function setInput(next) {
    if (next === input) return; // ignored keystroke
    input = next;
    preview = null;
    flash = null;
    renderInput();
  }

  function shuffleRack() {
    if (game.cfg.kind !== 'an') return;
    var letters = C.shuffle(input.letters.slice(), Math.random);
    input = C.anagramInput(letters);
    renderInput();
  }

  function newBoard() { startGame(game.mode); }

  function reveal() {
    if (game.revealed) return;
    var missing = game.solutions.size - game.found.length;
    if (missing && !window.confirm('Reveal the ' + missing + ' remaining word' + (missing === 1 ? '' : 's') + '?')) return;
    game.revealed = true;
    saveGame();
    renderAll();
  }

  // ---------------------------------------------------------- feedback ---
  function flashMsg(text, cls) {
    flash = { text: text, cls: cls };
    clearTimeout(flashTimer);
    flashTimer = setTimeout(function () { flash = null; renderFeedback(); }, 1400);
    renderFeedback();
  }

  // Shows the word being spelled (coloured like GamePigeon: green = new
  // valid word, yellow = already found), else the last result message.
  function renderFeedback() {
    var word = currentWord();
    var text, cls;
    if (word) {
      cls = liveClass(word);
      text = word.toUpperCase() + (cls === 'good' ? ' (+' + points(word) + ')' : '');
      cls = cls || 'live';
    } else if (flash) {
      text = flash.text;
      cls = flash.cls;
    } else {
      els.feedback.innerHTML = '';
      return;
    }
    els.feedback.innerHTML = '<span class="' + cls + '"></span>';
    els.feedback.firstChild.textContent = text;
  }

  // ------------------------------------------------------------- render ---
  function buildBoard() {
    var kind = game.cfg.kind;
    els.game.className = 'game ' + kind;
    document.querySelectorAll('.modes button').forEach(function (b) {
      b.setAttribute('aria-pressed', String(b.dataset.mode === game.mode));
    });
    els.boardId.textContent = game.mode + '-' + game.seed;

    if (kind === 'wh') {
      var n = game.cfg.size;
      els.grid.className = 'grid s' + n;
      els.grid.style.gridTemplateColumns = 'repeat(' + n + ', 1fr)';
      els.grid.querySelectorAll('.tile').forEach(function (t) { t.remove(); });
      game.grid.forEach(function (ch, i) {
        var t = document.createElement('div');
        t.className = 'tile';
        t.dataset.cell = i;
        t.textContent = ch;
        els.grid.appendChild(t);
      });
      els.hint.innerHTML =
        'Type letters to trace · repeat a letter to switch between matching tiles · ' +
        '<kbd>Shift</kbd>+letter adds a doubled letter · <kbd>Enter</kbd> submit · ' +
        '<kbd>Backspace</kbd> undo · <kbd>Esc</kbd> clear · drag with mouse/touch works too';
    } else {
      els.hint.innerHTML =
        'Type letters · <kbd>Enter</kbd> submit · <kbd>Backspace</kbd> undo · ' +
        '<kbd>Esc</kbd> clear · <kbd>Space</kbd> shuffle · tap tiles works too';
    }
  }

  function renderAll() {
    renderInput();
    renderProgress();
  }

  function renderInput() {
    var word = currentWord();
    var lc = liveClass(word);
    if (game.cfg.kind === 'wh') renderGrid(lc);
    else renderAnagram(lc);
    renderFeedback();
  }

  function renderGrid(lc) {
    var path = input.path;
    var previewPath = preview ? game.solutions.get(preview) : null;
    els.grid.querySelectorAll('.tile').forEach(function (t) {
      var c = +t.dataset.cell;
      var sel = path.indexOf(c) >= 0;
      t.className = 'tile' + (sel ? ' sel' + (lc ? ' ' + lc : '') : '') +
        (previewPath && previewPath.indexOf(c) >= 0 ? ' preview' : '');
    });
    drawPaths(path, previewPath);
  }

  function tileCenter(cell, box) {
    var t = els.grid.querySelector('[data-cell="' + cell + '"]');
    var r = t.getBoundingClientRect();
    return [r.left - box.left + r.width / 2, r.top - box.top + r.height / 2, r.width];
  }

  function drawPaths(path, previewPath) {
    var box = els.grid.getBoundingClientRect();
    els.svg.setAttribute('viewBox', '0 0 ' + box.width + ' ' + box.height);
    var out = '';
    [[previewPath, 'preview'], [path, '']].forEach(function (pair) {
      var p = pair[0];
      if (!p || p.length < 2) return;
      var w = 0;
      var pts = p.map(function (c) { var xy = tileCenter(c, box); w = xy[2]; return xy[0] + ',' + xy[1]; });
      out += '<polyline class="' + pair[1] + '" stroke-width="' + (w * 0.16) + '" points="' + pts.join(' ') + '"/>';
    });
    els.svg.innerHTML = out;
  }

  function renderAnagram(lc) {
    var n = game.cfg.size;
    var cols = 'repeat(' + n + ', 1fr)';
    els.slots.style.gridTemplateColumns = cols;
    els.rack.style.gridTemplateColumns = cols;
    var slotsHtml = '';
    for (var i = 0; i < n; i++) {
      var r = input.slots[i];
      slotsHtml += r === undefined
        ? '<div class="slot"></div>'
        : '<div class="tile sel ' + lc + '" data-slot="' + i + '">' + input.letters[r] + '</div>';
    }
    els.slots.innerHTML = slotsHtml;
    els.rack.innerHTML = input.letters.map(function (ch, idx) {
      var used = input.slots.indexOf(idx) >= 0;
      return '<div class="tile' + (used ? ' used' : '') + '" data-rack="' + idx + '">' + ch + '</div>';
    }).join('');
    els.enter.classList.toggle('ready', input.slots.length >= 3);
  }

  function renderProgress() {
    var found = game.found;
    var total = game.solutions.size;
    var score = found.reduce(function (s, w) { return s + points(w); }, 0);
    els.words.textContent = found.length;
    els.score.textContent = String(score).padStart(4, '0');
    els.found.textContent = found.length;
    els.total.textContent = total;
    els.reveal.disabled = game.revealed || found.length === total;

    var done = found.length === total;
    els.complete.hidden = !done && !game.revealed;
    if (done) {
      els.complete.textContent = 'Board complete — all ' + total + ' words found. Press = for a new board.';
    } else if (game.revealed) {
      els.complete.textContent = 'Revealed: ' + (total - found.length) + ' missed (shown in red). You can still enter them.';
    }

    // Per-length progress.
    var byLen = {};
    game.solutions.forEach(function (_, w) {
      var b = byLen[w.length] || (byLen[w.length] = { total: 0, found: 0 });
      b.total++;
    });
    found.forEach(function (w) { byLen[w.length].found++; });
    els.byLength.innerHTML = Object.keys(byLen).map(Number).sort(function (a, b) { return a - b; }).map(function (len) {
      var b = byLen[len];
      return '<div class="len-row' + (b.found === b.total ? ' done' : '') + '">' +
        '<span>' + len + ' letters</span>' +
        '<span class="bar"><i style="width:' + (100 * b.found / b.total) + '%"></i></span>' +
        '<span class="num">' + b.found + ' / ' + b.total + '</span></div>';
    }).join('');

    // Word list, longest first.
    var shown = found.slice();
    if (game.revealed) game.solutions.forEach(function (_, w) { if (found.indexOf(w) < 0) shown.push(w); });
    var groups = {};
    shown.forEach(function (w) { (groups[w.length] || (groups[w.length] = [])).push(w); });
    var lens = Object.keys(groups).map(Number).sort(function (a, b) { return b - a; });
    els.list.classList.toggle('hoverable', game.cfg.kind === 'wh');
    if (!lens.length) {
      els.list.innerHTML = '<p class="empty-note">Words you find show up here.</p>';
      return;
    }
    els.list.innerHTML = lens.map(function (len) {
      var ws = groups[len].sort();
      return '<div class="word-group"><h3>' + len + ' letters · ' + points(ws[0]) + ' pts</h3><ul>' +
        ws.map(function (w) {
          var cls = found.indexOf(w) < 0 ? 'missed' : (w === lastFound ? 'new' : '');
          return '<li class="' + cls + '" data-word="' + w + '">' + w + '</li>';
        }).join('') + '</ul></div>';
    }).join('');
  }

  // ------------------------------------------------------------ keyboard ---
  document.addEventListener('keydown', function (e) {
    if (e.metaKey || e.ctrlKey || e.altKey || !game) return;
    var k = e.key;
    if (k === 'Enter' || k === ' ') {
      e.preventDefault();
      if (document.activeElement && document.activeElement !== document.body) document.activeElement.blur();
    }
    if (/^[a-zA-Z]$/.test(k)) {
      e.preventDefault();
      var ch = k.toLowerCase();
      setInput(game.cfg.kind === 'an' ? C.anagramPress(input, ch) : C.gridPress(input, ch, e.shiftKey));
    } else if (k === 'Backspace') {
      e.preventDefault();
      setInput(game.cfg.kind === 'an' ? C.anagramBackspace(input) : C.gridBackspace(input));
    } else if (k === 'Enter') {
      submit(false);
    } else if (k === 'Escape') {
      clearInput();
      preview = null;
      renderInput();
    } else if (k === ' ') {
      shuffleRack();
    } else if (k === '=') {
      newBoard();
    } else if (MODE_KEYS[k]) {
      selectMode(MODE_KEYS[k]);
    }
  });

  // ------------------------------------------------------ pointer: grid ---
  var dragging = false;

  // Cell under the point. `inner` shrinks the hit area to a circle so that
  // diagonal swipes don't clip neighbouring tiles.
  function cellAt(x, y, inner) {
    var tiles = els.grid.querySelectorAll('.tile');
    for (var i = 0; i < tiles.length; i++) {
      var r = tiles[i].getBoundingClientRect();
      if (inner) {
        var dx = x - (r.left + r.width / 2), dy = y - (r.top + r.height / 2);
        if (dx * dx + dy * dy <= Math.pow(r.width * 0.42, 2)) return +tiles[i].dataset.cell;
      } else if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) {
        return +tiles[i].dataset.cell;
      }
    }
    return -1;
  }

  els.grid.addEventListener('pointerdown', function (e) {
    var cell = cellAt(e.clientX, e.clientY, false);
    if (cell < 0) return;
    e.preventDefault();
    dragging = true;
    els.grid.setPointerCapture(e.pointerId);
    setInput(C.gridSetPath(input, [cell]));
  });
  els.grid.addEventListener('pointermove', function (e) {
    if (!dragging) return;
    var cell = cellAt(e.clientX, e.clientY, true);
    var path = input.path;
    if (cell < 0 || cell === path[path.length - 1]) return;
    if (cell === path[path.length - 2]) {
      setInput(C.gridSetPath(input, path.slice(0, -1)));
    } else if (path.indexOf(cell) < 0 && C.isAdjacent(input.adj, path[path.length - 1], cell)) {
      setInput(C.gridSetPath(input, path.concat([cell])));
    }
  });
  function endDrag() {
    if (!dragging) return;
    dragging = false;
    submit(true);
  }
  els.grid.addEventListener('pointerup', endDrag);
  els.grid.addEventListener('pointercancel', endDrag);

  // ---------------------------------------------------- pointer: anagram ---
  els.rack.addEventListener('click', function (e) {
    var t = e.target.closest('[data-rack]');
    if (t) setInput(C.anagramTap(input, +t.dataset.rack));
  });
  els.slots.addEventListener('click', function (e) {
    var t = e.target.closest('[data-slot]');
    if (t) setInput(C.anagramTruncate(input, +t.dataset.slot));
  });
  els.enter.addEventListener('click', function () { submit(false); });
  els.shuffle.addEventListener('click', shuffleRack);

  // ------------------------------------------------------ panel / misc ---
  function previewWord(w) {
    if (game.cfg.kind !== 'wh' || input.typed) return;
    preview = w;
    renderGrid('');
  }
  els.list.addEventListener('mouseover', function (e) {
    var li = e.target.closest('[data-word]');
    previewWord(li ? li.dataset.word : null);
  });
  els.list.addEventListener('mouseleave', function () { previewWord(null); });
  els.list.addEventListener('click', function (e) {
    var li = e.target.closest('[data-word]');
    if (li) previewWord(preview === li.dataset.word ? null : li.dataset.word);
  });

  function selectMode(mode) {
    if (game && mode === game.mode) return;
    startGame(mode, store.current[mode]);
  }
  document.querySelectorAll('.modes button').forEach(function (b) {
    b.addEventListener('click', function () { selectMode(b.dataset.mode); });
  });
  els.newBtn.addEventListener('click', newBoard);
  els.reveal.addEventListener('click', reveal);
  els.copy.addEventListener('click', function () {
    var url = location.href.split('#')[0] + '#' + game.mode + '-' + game.seed;
    var done = function () { els.copy.textContent = 'copied'; setTimeout(function () { els.copy.textContent = 'copy link'; }, 1200); };
    if (navigator.clipboard) navigator.clipboard.writeText(url).then(done, function () { window.prompt('Board link:', url); });
    else window.prompt('Board link:', url);
  });
  // Keep buttons from holding focus so Enter/Space always go to the game.
  document.addEventListener('mousedown', function (e) {
    if (e.target.closest('button')) e.preventDefault();
  });
  window.addEventListener('resize', function () { if (game && game.cfg.kind === 'wh') renderGrid(liveClass(input.typed)); });

  function fromHash() {
    var m = /^#(an6|an7|wh4|wh5)-([a-z0-9]{1,32})$/.exec(location.hash);
    return m ? { mode: m[1], seed: m[2] } : null;
  }
  window.addEventListener('hashchange', function () {
    var h = fromHash();
    if (h && (h.mode !== game.mode || h.seed !== game.seed)) startGame(h.mode, h.seed);
  });

  var h = fromHash();
  if (h) startGame(h.mode, h.seed);
  else {
    var mode = MODES[store.mode] ? store.mode : 'an6';
    startGame(mode, store.current[mode]);
  }
})();
