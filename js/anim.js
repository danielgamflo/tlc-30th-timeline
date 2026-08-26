/* ============================================================
   anim.js — time math
   ------------------------------------------------------------
   RULE FOR THIS WHOLE PROJECT:
   every visual state must be derivable from t alone.
   no CSS transitions, no CSS keyframes, no accumulated state.
   that is what lets us render the exact same frames headlessly
   for the MP4 export instead of screen-recording in real time.
   ============================================================ */

var A = (function () {

  function clamp(v, lo, hi) {
    if (lo === undefined) lo = 0;
    if (hi === undefined) hi = 1;
    return v < lo ? lo : (v > hi ? hi : v);
  }

  function lerp(a, b, t) { return a + (b - a) * t; }

  /* progress 0..1 of a beat that starts at `start` and lasts `dur` */
  function seg(t, start, dur) {
    if (dur <= 0) return t >= start ? 1 : 0;
    return clamp((t - start) / dur);
  }

  /* ---- easings ---- */
  function linear(t)       { return t; }
  function easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); }
  function easeInCubic(t)  { return t * t * t; }
  function easeInOutCubic(t) {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }
  function easeOutExpo(t)  { return t >= 1 ? 1 : 1 - Math.pow(2, -10 * t); }
  function easeOutQuint(t) { return 1 - Math.pow(1 - t, 5); }

  /* the "90-90" and "75-75" curves from After Effects: heavy ease at
     both ends, quick through the middle. Quint reads as ~90, Cubic ~75. */
  function easeInOutQuint(t) {
    return t < 0.5 ? 16 * t * t * t * t * t
                   : 1 - Math.pow(-2 * t + 2, 5) / 2;
  }

  /* overshoot — the "stamp" feel. s controls how far past it goes. */
  function easeOutBack(t, s) {
    if (s === undefined) s = 1.70158;
    var p = t - 1;
    return 1 + (s + 1) * p * p * p + s * p * p;
  }

  /* ---- shorthand: eased segment ---- */
  function ease(t, start, dur, fn, arg) {
    var p = seg(t, start, dur);
    return (fn || easeOutCubic)(p, arg);
  }

  /* map an eased beat straight onto a value range */
  function tween(t, start, dur, from, to, fn, arg) {
    return lerp(from, to, ease(t, start, dur, fn, arg));
  }

  function round(v, places) {
    var m = Math.pow(10, places === undefined ? 3 : places);
    return Math.round(v * m) / m;
  }

  /* ---- contrast ----------------------------------------------
     WCAG relative luminance, so the ink colour on any panel is
     measured rather than guessed. burnt orange is the interesting
     one: it fails against black AND against cream, which is why it
     is an accent here and never sits under body copy.
     ------------------------------------------------------------ */

  function luminance(hex) {
    var h = hex.replace("#", "");
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    var c = [0, 1, 2].map(function (i) {
      var v = parseInt(h.substr(i * 2, 2), 16) / 255;
      return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  }

  function contrast(a, b) {
    var la = luminance(a), lb = luminance(b);
    var hi = Math.max(la, lb), lo = Math.min(la, lb);
    return (hi + 0.05) / (lo + 0.05);
  }

  /* blend two hex colours — for a shape that has to change colour
     across a beat rather than cut */
  function mix(a, b, t) {
    function rgb(h) {
      h = h.replace("#", "");
      if (h.length === 3) h = h[0]+h[0]+h[1]+h[1]+h[2]+h[2];
      return [0,1,2].map(function (i) { return parseInt(h.substr(i*2,2), 16); });
    }
    var x = rgb(a), y = rgb(b);
    return "rgb(" + [0,1,2].map(function (i) {
      return Math.round(x[i] + (y[i] - x[i]) * t);
    }).join(",") + ")";
  }

  /* pick whichever of the two inks reads better on this background */
  function inkOn(bg, dark, light) {
    dark = dark || "#000000";
    light = light || "#F4F0E6";
    return contrast(bg, dark) >= contrast(bg, light) ? dark : light;
  }

  return {
    clamp: clamp, lerp: lerp, seg: seg, ease: ease, tween: tween, round: round,
    luminance: luminance, contrast: contrast, inkOn: inkOn, mix: mix,
    linear: linear,
    easeOutCubic: easeOutCubic,
    easeInCubic: easeInCubic,
    easeInOutCubic: easeInOutCubic,
    easeOutExpo: easeOutExpo,
    easeOutQuint: easeOutQuint,
    easeInOutQuint: easeInOutQuint,
    easeOutBack: easeOutBack
  };
})();
