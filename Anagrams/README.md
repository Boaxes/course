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
| <kbd>Enter</kbd> | submit | submit |
| <kbd>Backspace</kbd> | remove the last letter | remove the last letter |
| <kbd>Esc</kbd> | clear | clear |
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

While you type, the word turns green if it's a new valid word and yellow if
you've already found it, as in GamePigeon. In Word Hunt, hovering over a word
in the list shows its path on the board.

## How closely this matches GamePigeon

GamePigeon doesn't publish its rules. Here's what's known and what's
guessed:

| Rule | Trainer | Status |
|---|---|---|
| Word list | [k-gerner/Game-Pigeon-Solvers](https://github.com/k-gerner/Game-Pigeon-Solvers): `anagrams/letters7.txt` for Anagrams, `wordhunt/letters10.txt` for Word Hunt. The two lists match for words of 7 letters or fewer. | **Assumed** (your choice). The real dictionary is unpublished. |
| Minimum word length | 3 | Matches |
| Word Hunt paths | Any of the 8 neighbors; no tile reused within a word | Matches |
| Anagrams points | 3 → 100, 4 → 400, 5 → 1200, 6 → 2000, 7 → 3000 | Community-reported; 7 letters is the least certain |
| Word Hunt points | 3 → 100, 4 → 400, 5 → 800, 6 → 1400, 7 → 1800, 8 → 2200, then +400 per extra letter | Community-reported; 9+ letters extrapolated |
| Anagrams letter generation | Random word of the rack length from the list, shuffled, so a full-length word always exists | **Unknown**; this is a guess |
| Word Hunt letter generation | English letter-frequency weights; 30–50% vowels; at most one each of J/Q/X/Z; Q only with a U; no letter more than 3× (4×4) / 4× (5×5) | **Unknown**; an approximation |
| Timer | None | Differs on purpose (GamePigeon: 60 s Anagrams, 80 s Word Hunt) |
| Donut / Cross Word Hunt boards, opponents | Not included | Differs |

### Known quirks of the word list

- **Words that are also names are missing.** Examples include *girl, love,
  rain, king, rose, hope, angle, amber, alpha, ginger*, while plurals such as
  *girls* and *gingers* are present. GamePigeon almost certainly accepts many
  of these, so the trainer will reject words the real game takes. It also
  won't require them to complete a board.
- It contains many obscure Collins-style words (*aal, abac, abcee…*), and
  completing a board requires them.
- It includes offensive words, the same as the source list.
- Word Hunt words longer than 10 letters aren't in the list and can't score.

### Swapping the word list

Replace `data/letters7.txt` and/or `data/letters10.txt`, using one lowercase
word per line, then regenerate the embedded list:

```sh
python3 tools/build_words.py   # writes js/words.js
```

The script checks that `letters10.txt` agrees with `letters7.txt` for words
of 7 letters or fewer. If you want different lists per mode, relax that check.

## Files

```
index.html, style.css   page
js/core.js              pure game logic (generators, solvers, scoring, keyboard state machines)
js/app.js               UI
js/words.js             generated word list (do not edit)
data/                   source word lists
tools/build_words.py    builds js/words.js from data/
tests/core.test.js      unit tests: node --test tests/core.test.js
```
