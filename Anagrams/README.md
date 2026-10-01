# GamePigeon Word Trainer

A static, offline practice tool for GamePigeon's **Anagrams** (6 or 7 letters)
and **Word Hunt** (4×4 or 5×5 swipe grid). You get a random board, and the
board is complete when you have found **every** word in the word list. There is
no timer. You can start a new board whenever you like.

## Run it

Either:

- open `index.html` directly in a browser (double-click), or
- serve it locally:

  ```sh
  cd Anagrams
  python3 -m http.server 8000
  # then open http://localhost:8000
  ```

There's no build step and no network access is needed. Progress for each
board is saved in your browser's `localStorage`. Each board has an id
(e.g. `wh4-k3m9qa`) in the URL, so you can replay or share a board with
"copy link".

## Controls

Both modes are keyboard-first. Mouse and touch also work.

| Key | Anagrams | Word Hunt |
|---|---|---|
| letter | place the next unused tile with that letter (ignored if none is left) | extend the path (see below) |
| <kbd>Enter</kbd> | clear (words score automatically) | submit |
| <kbd>Backspace</kbd> | remove the last letter | remove the last letter |
| <kbd>Esc</kbd> | clear | clear |
| 🔊 button | sound on/off (remembered) | sound on/off |
| <kbd>Space</kbd> | shuffle the rack | — |
| <kbd>Shift</kbd>+letter | — | always add the letter (for doubled letters) |
| <kbd>1</kbd>–<kbd>4</kbd> | switch mode | switch mode |
| <kbd>=</kbd> | new board | new board |

**Word Hunt typing rules**

- Typing a letter selects a tile with that letter. After that, only letters
  on a tile that connects to the path are accepted. Anything else is ignored.
- If only one tile can be next, it's chosen for you. On the screenshot board
  `NERO/RAFA/DYFM/PVTY`, typing `N-E-F` picks the only F next to E.
- If several tiles fit, one is chosen. **Press the same letter again** to
  cycle to the next matching tile for that position (`D`, then `D` again,
  switches between the board's Ds).
- If the last letter is *not* ambiguous, pressing it again adds a second
  copy. If it *is* ambiguous, a repeat cycles instead, so use
  **Shift+letter** to add the doubled letter.
- If your next letter doesn't connect to the highlighted path but connects
  from another path that spells the same letters, the highlight moves to
  that path instead of ignoring your input.

**Anagrams scoring:** a word counts the moment you spell it, with no Enter
needed. The letters stay in place so you can keep extending: typing
`A-R-C-H-I-N-E` scores ARC, ARCH and ARCHINE as you go. Press Enter or Esc
(or the CLEAR button) to start a new word. This differs from GamePigeon,
where you press ENTER.

**Sound:** short synthesized effects (no audio files). Notes rise as you add
letters, there's a chime for a new word (longer for longer words), a double
blip for a repeat, a buzz for a word that isn't in the list, and a fanfare
when you complete a board. Use the speaker button to mute.

While you type, the word turns green if it's a new valid word and yellow if
you've already found it, as in GamePigeon. In Word Hunt, hovering over a word
in the list shows its path on the board.

## How closely this matches GamePigeon

GamePigeon doesn't publish its rules. Here's what's known and what's
guessed:

| Rule | Trainer | Status |
|---|---|---|
| Word list (Anagrams) | Collins Scrabble Words 2012 (CSW12), 3+ letters | **Strong evidence**: matches GamePigeon's possible-word counts exactly on RDIEPT (61) and ICIEMLA (69). See below. |
| Word list (Word Hunt) | Same CSW12 list (longest word is 15 letters) | **Assumed** to be the same dictionary; not checked against Word Hunt yet |
| Minimum word length | 3 | Matches |
| Word Hunt paths | Any of the 8 neighbors; no tile reused within a word | Matches |
| Anagrams points | 3 → 100, 4 → 400, 5 → 1200, 6 → 2000, 7 → 3000 | Community-reported; 7 letters is the least certain |
| Word Hunt points | 3 → 100, 4 → 400, 5 → 800, 6 → 1400, 7 → 1800, 8 → 2200, then +400 per extra letter | Community-reported; 9+ letters extrapolated |
| Anagrams letter generation | Random word of the rack length from the list, shuffled, so a full-length word always exists | **Unknown**; this is a guess |
| Word Hunt letter generation | English letter-frequency weights; 30–50% vowels; at most one each of J/Q/X/Z; Q only with a U; no letter more than 3× (4×4) / 4× (5×5) | **Unknown**; an approximation |
| Timer | None | Differs on purpose (GamePigeon: 60 s Anagrams, 80 s Word Hunt) |
| Donut / Cross Word Hunt boards, opponents | Not included | Differs |

### Why CSW12

GamePigeon doesn't publish its dictionary. To find it, we compared each
candidate list's word count (3+ letters) with the counts GamePigeon reports
for two racks:

| List | RDIEPT (GamePigeon: 61) | ICIEMLA (GamePigeon: 69) |
|---|---|---|
| **CSW12** (Collins 2012) | **61** | **69** |
| CSW07 / SOWPODS | 60 | 68 |
| CSW15 | 62 | 71 |
| CSW19 / CSW21 | 63 | 71 |
| NWL2020 / NWL2023 / TWL2014 | 50–51 | 61 |
| TWL06 | 49 | 59 |
| ENABLE | 49 | 56 |
| k-gerner `letters7.txt` (previously used) | 55 | 55 |

Only CSW12 matches both. The k-gerner list turned out to be a later Collins
edition with every word that's also a name removed (*girl, love, male, lace,
ginger*…). The tests in `tests/core.test.js` check both counts. More data
points (especially Word Hunt totals) would make this more certain.

Things that are still unknown: whether GamePigeon filters offensive words
(CSW12 contains them, and these two racks don't test it), and whether Word
Hunt uses the same list.

**Licensing:** CSW12 is © HarperCollins. It's included here for personal
use. Keep this repository private, and don't publish `data/csw12.txt` or
`js/words.js`.

### Swapping the word list

Put one lowercase word per line in `data/csw12.txt` (or regenerate it from a
raw Collins file with `python3 tools/build_words.py --from-raw CSW12.txt`),
then rebuild the embedded list:

```sh
python3 tools/build_words.py   # writes js/words.js
```

## Files

```
index.html, style.css   page
js/core.js              pure game logic (generators, solvers, scoring, keyboard state machines)
js/app.js               UI
js/audio.js             synthesized sound effects (Web Audio)
js/words.js             generated word list (do not edit)
data/csw12.txt          source word list (CSW12)
tools/build_words.py    builds js/words.js from data/
tests/core.test.js      unit tests: node --test tests/core.test.js
```
