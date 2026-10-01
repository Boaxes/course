/*
 * Small synthesized sound effects (Web Audio, no audio files).
 * The AudioContext is created on the first user gesture, as browsers require.
 */
(function (root) {
  'use strict';

  var ctx = null;
  var muted = false;
  // Pentatonic steps so rising tile notes always sound pleasant.
  var STEPS = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24, 26, 28, 31, 33, 36];

  function unlock() {
    if (!ctx) {
      var AC = root.AudioContext || root.webkitAudioContext;
      if (!AC) return null;
      try { ctx = new AC(); } catch (e) { return null; }
    }
    if (ctx.state === 'suspended') ctx.resume().catch(function () {});
    return ctx;
  }

  function freq(semitones) { return 440 * Math.pow(2, (semitones - 9) / 12); } // 0 = C4

  // One enveloped oscillator note.
  function note(f, start, dur, type, vol) {
    var o = ctx.createOscillator();
    var g = ctx.createGain();
    o.type = type || 'sine';
    o.frequency.setValueAtTime(f, start);
    g.gain.setValueAtTime(0.0001, start);
    g.gain.exponentialRampToValueAtTime(vol || 0.12, start + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    o.connect(g).connect(ctx.destination);
    o.start(start);
    o.stop(start + dur + 0.02);
  }

  var SOUNDS = {
    // A tile was added; `i` is its position in the word (pitch rises).
    tile: function (t, i) { note(freq(12 + STEPS[Math.min(i || 0, STEPS.length - 1)]), t, 0.09, 'triangle', 0.09); },
    back: function (t) { note(freq(7), t, 0.07, 'triangle', 0.06); },
    // New valid word; longer words get a longer, higher chime.
    good: function (t, len) {
      var n = Math.max(2, Math.min((len || 3) - 1, 6));
      for (var k = 0; k < n; k++) note(freq(24 + STEPS[k + 1]), t + k * 0.06, 0.18, 'sine', 0.12);
    },
    dup: function (t) { note(freq(16), t, 0.12, 'sine', 0.08); note(freq(16), t + 0.1, 0.12, 'sine', 0.06); },
    bad: function (t) { note(110, t, 0.16, 'square', 0.05); note(98, t + 0.08, 0.16, 'square', 0.05); },
    shuffle: function (t) { for (var k = 0; k < 4; k++) note(freq(19 - k * 2), t + k * 0.03, 0.06, 'triangle', 0.05); },
    complete: function (t) {
      [0, 4, 7, 12, 16, 19, 24].forEach(function (s, k) { note(freq(24 + s), t + k * 0.08, 0.35, 'triangle', 0.12); });
    }
  };

  function play(name, arg) {
    if (muted || !SOUNDS[name]) return;
    if (!unlock()) return;
    try { SOUNDS[name](ctx.currentTime + 0.005, arg); } catch (e) { /* ignore */ }
  }

  root.GPAudio = {
    play: play,
    unlock: unlock,
    isMuted: function () { return muted; },
    setMuted: function (m) { muted = !!m; }
  };
})(typeof self !== 'undefined' ? self : this);
