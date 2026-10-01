// Run: node --test tests/core.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const C = require('../js/core.js');
const dict = C.Dictionary.fromString(require('../js/words.js'));

// Board from the Word Hunt screenshot:
//   N E R O      0  1  2  3
//   R A F A      4  5  6  7
//   D Y F M      8  9 10 11
//   P V T Y     12 13 14 15
const SHOT = 'nerorafadyfmpvty'.split('');

function typeAll(st, s) {
  for (const ch of s) st = C.gridPress(st, ch);
  return st;
}

test('word list loads with expected size', () => {
  assert.equal(dict.words.length, 270039); // CSW12, 3+ letters
  assert.ok(dict.has('raft'));
  assert.ok(!dict.has('qi')); // 2-letter words are excluded
});

// "Possible words" counts observed in GamePigeon Anagrams. CSW12 is the only
// edition checked that reproduces both exactly.
test('anagram counts match GamePigeon data points', () => {
  assert.equal(C.solveAnagram(dict, 'rdiept'.split(''), 6).length, 61);
  assert.equal(C.solveAnagram(dict, 'iciemla'.split(''), 7).length, 69);
});

test('scoring tables', () => {
  assert.deepEqual(['abc', 'abcd', 'abcde', 'abcdef', 'abcdefg'].map(C.anagramPoints), [100, 400, 1200, 2000, 3000]);
  assert.deepEqual(
    ['abc', 'abcd', 'abcde', 'abcdef', 'abcdefg', 'abcdefgh', 'abcdefghi'].map(C.wordHuntPoints),
    [100, 400, 800, 1400, 1800, 2200, 2600]
  );
});

test('anagram rack is a shuffled dictionary word and is reproducible', () => {
  for (const size of [6, 7]) {
    const a = C.generateAnagramRack(dict, size, 'seed1');
    const b = C.generateAnagramRack(dict, size, 'seed1');
    assert.deepEqual(a, b);
    assert.equal(a.letters.length, size);
    assert.ok(dict.has(a.seedWord));
    assert.equal([...a.letters].sort().join(''), [...a.seedWord].sort().join(''));
    const sol = C.solveAnagram(dict, a.letters, size);
    assert.ok(sol.includes(a.seedWord));
    assert.ok(sol.every((w) => w.length >= 3 && w.length <= size && dict.has(w)));
  }
});

test('anagram solver on the LEGINGR screenshot rack', () => {
  const sol = C.solveAnagram(dict, 'legingr'.split(''), 7);
  for (const w of ['linger', 'ginger', 'niggle', 'reign', 'girl']) assert.ok(sol.includes(w), w);
  assert.ok(!sol.includes('legging')); // needs three Gs
});

test('anagram keyboard: picks unused tiles, ignores missing letters', () => {
  let st = C.anagramInput('legingr'.split(''));
  st = C.anagramPress(st, 'g');
  st = C.anagramPress(st, 'g');
  assert.equal(C.anagramWord(st), 'gg');
  assert.notEqual(st.slots[0], st.slots[1]);
  const before = st;
  st = C.anagramPress(st, 'g'); // only two Gs
  assert.equal(st, before);
  st = C.anagramPress(st, 'z');
  assert.equal(st, before);
  st = C.anagramBackspace(st);
  assert.equal(C.anagramWord(st), 'g');
  st = C.anagramTruncate(st, 0);
  assert.equal(C.anagramWord(st), '');
});

test('grid solver finds RAFT with a valid path', () => {
  const sol = C.solveGrid(dict, SHOT, 4);
  const raft = sol.find((s) => s.word === 'raft');
  assert.ok(raft);
  const adj = C.neighbors(4);
  assert.equal(raft.path.map((c) => SHOT[c]).join(''), 'raft');
  for (let i = 1; i < raft.path.length; i++) assert.ok(C.isAdjacent(adj, raft.path[i - 1], raft.path[i]));
  assert.equal(new Set(raft.path).size, raft.path.length);
  assert.equal(new Set(sol.map((s) => s.word)).size, sol.length);
});

test('grid keyboard: N-E-F auto-picks the only connecting F', () => {
  const st = typeAll(C.gridInput(SHOT, 4), 'nef');
  assert.equal(st.typed, 'nef');
  assert.deepEqual(st.path, [0, 1, 6]);
});

test('grid keyboard: letters that do not connect are ignored', () => {
  let st = typeAll(C.gridInput(SHOT, 4), 'ne');
  const before = st;
  st = C.gridPress(st, 'p'); // P exists but not next to E
  assert.equal(st, before);
  st = C.gridPress(st, 'q'); // not on the board at all
  assert.equal(st, before);
  assert.equal(C.gridPress(C.gridInput(SHOT, 4), 'q').typed, '');
});

test('grid keyboard: repeating an ambiguous letter cycles its tile', () => {
  let st = C.gridPress(C.gridInput(SHOT, 4), 'r');
  assert.deepEqual(st.path, [2]);
  st = C.gridPress(st, 'r');
  assert.equal(st.typed, 'r');
  assert.deepEqual(st.path, [4]);
  st = C.gridPress(st, 'r');
  assert.deepEqual(st.path, [2]);
  // R(2) -> A: both A(5) and A(7) connect, so A is ambiguous too.
  st = C.gridPress(st, 'a');
  assert.deepEqual(st.path, [2, 5]);
  st = C.gridPress(st, 'a');
  assert.deepEqual(st.path, [2, 7]);
});

test('grid keyboard: unambiguous repeat appends; Shift forces append', () => {
  // T(14) touches only F(10), so F is unambiguous and a second F
  // appends F(6) (F(10) and F(6) are adjacent).
  let st = typeAll(C.gridInput(SHOT, 4), 'tff');
  assert.equal(st.typed, 'tff');
  assert.deepEqual(st.path, [14, 10, 6]);
  // Ambiguous F after "y": Y(9) touches F(6) and F(10). Shift appends.
  let s2 = C.gridPress(C.gridInput(SHOT, 4), 'y');
  assert.deepEqual(s2.path, [9]);
  s2 = C.gridPress(s2, 'f');
  s2 = C.gridPress(s2, 'f', true);
  assert.equal(s2.typed, 'yff');
  assert.equal(new Set(s2.path).size, 3);
});

test('grid keyboard: reroutes to another path instead of ignoring', () => {
  // R picks R(2); RAF picks A(5)/F(6); T only connects from F(10).
  const st = typeAll(C.gridInput(SHOT, 4), 'raft');
  assert.equal(st.typed, 'raft');
  assert.equal(st.path.map((c) => SHOT[c]).join(''), 'raft');
  assert.equal(st.path[3], 14);
});

test('grid keyboard: backspace keeps alternatives', () => {
  let st = typeAll(C.gridInput(SHOT, 4), 'ra');
  st = C.gridBackspace(st);
  assert.equal(st.typed, 'r');
  assert.equal(st.paths.length, 2); // both Rs still available to cycle
  st = C.gridClear(st);
  assert.equal(st.typed, '');
});

test('grid generator: reproducible and within constraints', () => {
  for (const size of [4, 5]) {
    for (let i = 0; i < 50; i++) {
      const g = C.generateGrid(size, 's' + i);
      assert.deepEqual(g, C.generateGrid(size, 's' + i));
      assert.equal(g.length, size * size);
      if (g.includes('q')) assert.ok(g.includes('u'));
    }
  }
});
