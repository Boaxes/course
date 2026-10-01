/*
 * Pure game logic for the GamePigeon Anagrams / Word Hunt trainer.
 * No DOM access here, so the same file runs in the browser (window.GPCore)
 * and under Node for tests (require('./core.js')).
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.GPCore = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var A = 97; // 'a'.charCodeAt(0)

  // ---------------------------------------------------------------- RNG ---
  // Seeded so a board can be replayed / shared by its id.

  function xmur3(str) {
    var h = 1779033703 ^ str.length;
    for (var i = 0; i < str.length; i++) {
      h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
      h = (h << 13) | (h >>> 19);
    }
    return function () {
      h = Math.imul(h ^ (h >>> 16), 2246822507);
      h = Math.imul(h ^ (h >>> 13), 3266489909);
      return (h ^= h >>> 16) >>> 0;
    };
  }

  function makeRng(seed) {
    var a = xmur3(String(seed))();
    return function () {
      a = (a + 0x6d2b79f5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function randomSeed() {
    var s = '';
    for (var i = 0; i < 6; i++) s += 'abcdefghjkmnpqrstuvwxyz23456789'[Math.floor(Math.random() * 31)];
    return s;
  }

  function shuffle(arr, rng) {
    for (var i = arr.length - 1; i > 0; i--) {
      var j = Math.floor(rng() * (i + 1));
      var t = arr[i]; arr[i] = arr[j]; arr[j] = t;
    }
    return arr;
  }

  // ------------------------------------------------------------ Scoring ---
  // Community-reported values (GamePigeon does not publish them).

  var ANAGRAM_POINTS = { 3: 100, 4: 400, 5: 1200, 6: 2000, 7: 3000 };

  function anagramPoints(word) {
    return ANAGRAM_POINTS[word.length] || 0;
  }

  // 3:100 4:400 5:800 6:1400 7:1800 8:2200, then +400 per extra letter.
  function wordHuntPoints(word) {
    var n = word.length;
    if (n < 3) return 0;
    if (n === 3) return 100;
    if (n === 4) return 400;
    if (n === 5) return 800;
    if (n === 6) return 1400;
    return 1800 + 400 * (n - 7);
  }

  // --------------------------------------------------------- Dictionary ---

  function Dictionary(words) {
    this.words = words;
    this.set = new Set(words);
    this.byLength = {};
    for (var i = 0; i < words.length; i++) {
      var w = words[i];
      (this.byLength[w.length] || (this.byLength[w.length] = [])).push(w);
    }
  }
  Dictionary.fromString = function (s) {
    return new Dictionary(s.split(/\s+/).filter(Boolean));
  };
  Dictionary.prototype.has = function (w) { return this.set.has(w); };

  function letterCounts(str) {
    var c = new Array(26).fill(0);
    for (var i = 0; i < str.length; i++) c[str.charCodeAt(i) - A]++;
    return c;
  }

  // True if `word` can be spelled from the letter multiset `counts`.
  function fitsCounts(word, counts, scratch) {
    for (var k = 0; k < 26; k++) scratch[k] = counts[k];
    for (var i = 0; i < word.length; i++) {
      if (--scratch[word.charCodeAt(i) - A] < 0) return false;
    }
    return true;
  }

  // ----------------------------------------------------------- Anagrams ---

  // GamePigeon's generator is unknown. We pick a random dictionary word of
  // the rack length and shuffle it, so a full-length word always exists.
  function generateAnagramRack(dict, size, seed) {
    var rng = makeRng('anagram:' + size + ':' + seed);
    var pool = dict.byLength[size];
    var word = pool[Math.floor(rng() * pool.length)];
    var letters = word.split('');
    // Don't hand out the answer already spelled (unless unavoidable).
    for (var tries = 0; tries < 20; tries++) {
      shuffle(letters, rng);
      if (letters.join('') !== word) break;
    }
    return { letters: letters, seedWord: word };
  }

  function solveAnagram(dict, letters, maxLen) {
    var counts = letterCounts(letters.join(''));
    var scratch = new Array(26);
    var out = [];
    for (var len = 3; len <= maxLen; len++) {
      var pool = dict.byLength[len] || [];
      for (var i = 0; i < pool.length; i++) {
        if (fitsCounts(pool[i], counts, scratch)) out.push(pool[i]);
      }
    }
    return out;
  }

  // Keyboard/tap state for the rack. `slots` holds rack indices in order.
  function anagramInput(letters) {
    return { letters: letters, slots: [] };
  }
  function anagramWord(st) {
    return st.slots.map(function (i) { return st.letters[i]; }).join('');
  }
  // Type a letter: uses the first unused rack tile with that letter.
  // Returns the same object if the letter isn't available (ignored).
  function anagramPress(st, ch) {
    for (var i = 0; i < st.letters.length; i++) {
      if (st.letters[i] === ch && st.slots.indexOf(i) < 0) return anagramTap(st, i);
    }
    return st;
  }
  // Tap a specific rack tile.
  function anagramTap(st, rackIndex) {
    if (st.slots.indexOf(rackIndex) >= 0) return st;
    return { letters: st.letters, slots: st.slots.concat([rackIndex]) };
  }
  // Remove the slot at `pos` and everything after it.
  function anagramTruncate(st, pos) {
    return { letters: st.letters, slots: st.slots.slice(0, pos) };
  }
  function anagramBackspace(st) {
    return anagramTruncate(st, Math.max(0, st.slots.length - 1));
  }

  // ---------------------------------------------------------- Word Hunt ---

  function neighbors(size) {
    var adj = [];
    for (var r = 0; r < size; r++) {
      for (var c = 0; c < size; c++) {
        var list = [];
        for (var dr = -1; dr <= 1; dr++) {
          for (var dc = -1; dc <= 1; dc++) {
            if (!dr && !dc) continue;
            var rr = r + dr, cc = c + dc;
            if (rr >= 0 && rr < size && cc >= 0 && cc < size) list.push(rr * size + cc);
          }
        }
        adj.push(list);
      }
    }
    return adj;
  }

  // GamePigeon's tile distribution is unknown. This is an approximation:
  // English letter-frequency weights with a few sanity constraints.
  var LETTER_WEIGHTS = {
    e: 12, a: 9, i: 8, o: 8, n: 7, r: 7, t: 7, s: 6, l: 5, u: 4, d: 4,
    g: 3, c: 3, m: 3, p: 3, h: 3, b: 2, f: 2, y: 2, w: 2, k: 1.2, v: 1,
    x: 0.4, z: 0.4, j: 0.3, q: 0.3
  };
  var VOWELS = 'aeiou';
  var RARE = 'jqxz';

  function generateGrid(size, seed) {
    var rng = makeRng('grid:' + size + ':' + seed);
    var letters = Object.keys(LETTER_WEIGHTS);
    var total = letters.reduce(function (s, l) { return s + LETTER_WEIGHTS[l]; }, 0);
    var n = size * size;
    var maxSame = size === 4 ? 3 : 4;
    for (;;) {
      var grid = [];
      for (var i = 0; i < n; i++) {
        var x = rng() * total, k = 0;
        while ((x -= LETTER_WEIGHTS[letters[k]]) > 0) k++;
        grid.push(letters[k]);
      }
      var counts = letterCounts(grid.join(''));
      var vowels = grid.filter(function (l) { return VOWELS.indexOf(l) >= 0; }).length;
      if (vowels < Math.round(n * 0.3) || vowels > Math.round(n * 0.5)) continue;
      if (counts.some(function (c) { return c > maxSame; })) continue;
      if (RARE.split('').some(function (l) { return counts[l.charCodeAt(0) - A] > 1; })) continue;
      if (counts['q'.charCodeAt(0) - A] && !counts['u'.charCodeAt(0) - A]) continue;
      return grid;
    }
  }

  // Find one path spelling `word` on the grid, or null.
  function findPath(grid, adj, word) {
    var path = [];
    var used = new Array(grid.length).fill(false);
    function dfs(cell, i) {
      if (grid[cell] !== word[i]) return false;
      path.push(cell); used[cell] = true;
      if (i === word.length - 1) return true;
      var nb = adj[cell];
      for (var k = 0; k < nb.length; k++) {
        if (!used[nb[k]] && dfs(nb[k], i + 1)) return true;
      }
      path.pop(); used[cell] = false;
      return false;
    }
    for (var c = 0; c < grid.length; c++) if (dfs(c, 0)) return path;
    return null;
  }

  // Every dictionary word that can be traced on the grid, with one path each.
  function solveGrid(dict, grid, size) {
    var adj = neighbors(size);
    var counts = letterCounts(grid.join(''));
    var scratch = new Array(26);
    var out = [];
    var words = dict.words;
    for (var i = 0; i < words.length; i++) {
      var w = words[i];
      if (w.length > grid.length || !fitsCounts(w, counts, scratch)) continue;
      var p = findPath(grid, adj, w);
      if (p) out.push({ word: w, path: p });
    }
    return out;
  }

  /*
   * Keyboard input for the grid.
   *
   * state = { grid, size, adj, typed, paths, path }
   *   typed  the letters typed so far
   *   paths  every simple path on the board that spells `typed`
   *   path   the one currently highlighted (one of `paths`)
   *
   * Rules:
   *  - A letter is accepted only if some tile with that letter connects to
   *    a path spelling what was typed so far; otherwise it is ignored.
   *  - If exactly one tile fits, it is chosen automatically. If several fit,
   *    one is picked and pressing the SAME letter again cycles to the next
   *    candidate tile for that position.
   *  - If the last letter has only one candidate, pressing it again appends
   *    another copy (e.g. the second E in "BEE").
   *  - `force` (Shift+letter) always appends instead of cycling.
   *  - If the next letter doesn't connect to the highlighted path but does
   *    connect from a different path that spells the same letters, the
   *    highlight moves to that path instead of ignoring the input.
   */
  var MAX_PATHS = 50000;

  function gridInput(grid, size) {
    return { grid: grid, size: size, adj: neighbors(size), typed: '', paths: [], path: [] };
  }

  function samePrefix(a, b, len) {
    for (var i = 0; i < len; i++) if (a[i] !== b[i]) return false;
    return true;
  }

  // Paths that differ from the current one only in the last tile.
  function lastTileCandidates(st) {
    var n = st.path.length;
    if (!n) return [];
    return st.paths.filter(function (p) { return samePrefix(p, st.path, n - 1); });
  }

  function with_(st, typed, paths, path) {
    return { grid: st.grid, size: st.size, adj: st.adj, typed: typed, paths: paths, path: path };
  }

  function gridAppend(st, ch) {
    var next = [];
    if (!st.typed) {
      for (var c = 0; c < st.grid.length; c++) if (st.grid[c] === ch) next.push([c]);
    } else {
      for (var i = 0; i < st.paths.length && next.length < MAX_PATHS; i++) {
        var p = st.paths[i];
        var nb = st.adj[p[p.length - 1]];
        for (var k = 0; k < nb.length; k++) {
          var cell = nb[k];
          if (st.grid[cell] === ch && p.indexOf(cell) < 0) next.push(p.concat([cell]));
        }
      }
    }
    if (!next.length) return st; // doesn't connect: ignored
    var cur = st.path;
    var keep = next.filter(function (p) { return samePrefix(p, cur, cur.length); });
    return with_(st, st.typed + ch, next, (keep[0] || next[0]).slice());
  }

  function gridPress(st, ch, force) {
    var n = st.typed.length;
    if (!force && n && st.typed[n - 1] === ch) {
      var cands = lastTileCandidates(st);
      if (cands.length > 1) {
        cands.sort(function (a, b) { return a[n - 1] - b[n - 1]; });
        var at = 0;
        for (var i = 0; i < cands.length; i++) if (cands[i][n - 1] === st.path[n - 1]) at = i;
        return with_(st, st.typed, st.paths, cands[(at + 1) % cands.length].slice());
      }
    }
    return gridAppend(st, ch);
  }

  function gridBackspace(st) {
    if (!st.typed) return st;
    var seen = new Set(), paths = [];
    for (var i = 0; i < st.paths.length; i++) {
      var p = st.paths[i].slice(0, -1);
      var key = p.join(',');
      if (p.length && !seen.has(key)) { seen.add(key); paths.push(p); }
    }
    return with_(st, st.typed.slice(0, -1), paths, st.path.slice(0, -1));
  }

  function gridClear(st) {
    return with_(st, '', [], []);
  }

  // Replace the selection with an explicit path (mouse / touch drag).
  function gridSetPath(st, path) {
    var typed = path.map(function (c) { return st.grid[c]; }).join('');
    return with_(st, typed, path.length ? [path.slice()] : [], path.slice());
  }

  function isAdjacent(adj, a, b) {
    return adj[a].indexOf(b) >= 0;
  }

  return {
    makeRng: makeRng,
    randomSeed: randomSeed,
    shuffle: shuffle,
    Dictionary: Dictionary,
    ANAGRAM_POINTS: ANAGRAM_POINTS,
    anagramPoints: anagramPoints,
    wordHuntPoints: wordHuntPoints,
    generateAnagramRack: generateAnagramRack,
    solveAnagram: solveAnagram,
    anagramInput: anagramInput,
    anagramWord: anagramWord,
    anagramPress: anagramPress,
    anagramTap: anagramTap,
    anagramTruncate: anagramTruncate,
    anagramBackspace: anagramBackspace,
    neighbors: neighbors,
    isAdjacent: isAdjacent,
    generateGrid: generateGrid,
    findPath: findPath,
    solveGrid: solveGrid,
    gridInput: gridInput,
    gridPress: gridPress,
    gridBackspace: gridBackspace,
    gridClear: gridClear,
    gridSetPath: gridSetPath
  };
});
