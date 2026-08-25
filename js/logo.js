/* ============================================================
   logo.js — opening scene
   ------------------------------------------------------------
   beats
     0.35  a beat of empty paper, then the mark stamps in
     1.10  THE LIFE CHURCH tracks open above it
     1.70  1996 — 2026 sets below it
     2.40  hold — 4.6s of it, this is a lobby piece and people glance up
     7.00  wordmark and dates leave
     7.15  the mark shrinks onto the centre
     7.95  ---- the logo is fully gone ----
     8.05  the rule draws out of that same point
     8.30  the seed lands on the rule  -> hands off to the timeline

   the gap at 7.95 is deliberate: the logo collapses to a point, a
   beat passes, and only then does the line grow out of it. letting
   the two overlap made them read as one muddled move.
   ============================================================ */

var SCENE_LOGO = (function () {

  var MARK_H = 256;   /* must match css .logo-mark height */
  var SEED   = 46;    /* must match css .seed size        */

  var r = {};

  function init(root) {
    /* by class, not id — the outro scene is a clone of this markup */
    r.rule     = root.querySelector(".rule");
    r.wordmark = root.querySelector(".logo-wordmark");
    r.mark     = root.querySelector(".logo-mark");
    r.dates    = root.querySelector(".logo-dates");
    r.ruleL    = root.querySelector(".logo-dates__rule--l");
    r.ruleR    = root.querySelector(".logo-dates__rule--r");
    r.seed     = root.querySelector(".seed");
  }

  function render(t) {

    /* --- mark: stamp in, then shrink onto the centre ---------- */
    var mIn    = A.seg(t, 0.35, 0.90);
    var mShr   = A.ease(t, 7.15, 0.70, A.easeInOutCubic);
    var mFade  = A.ease(t, 7.60, 0.35, A.easeInCubic);

    var markS = A.lerp(1.30, 1, A.easeOutBack(mIn, 1.30))
              * A.lerp(1, SEED / MARK_H, mShr);
    var markY = A.lerp(-22, 0, A.easeOutCubic(mIn));

    r.mark.style.opacity = A.round(A.clamp(mIn * 3) * (1 - mFade), 3);
    r.mark.style.transform =
      "translateY(" + A.round(markY, 2) + "px) scale(" + A.round(markS, 4) + ")";

    /* --- wordmark --------------------------------------------- */
    var w    = A.ease(t, 1.10, 0.80, A.easeOutQuint);
    var wOut = A.ease(t, 7.00, 0.40, A.easeInCubic);
    var track = A.lerp(0.62, 0.22, w);
    r.wordmark.style.opacity       = A.round(w * (1 - wOut), 3);
    r.wordmark.style.letterSpacing = A.round(track, 4) + "em";
    r.wordmark.style.textIndent    = A.round(track, 4) + "em";
    r.wordmark.style.transform =
      "translateY(" + A.round(A.lerp(16, 0, w) - wOut * 16, 2) + "px)";

    /* --- dates + flanking rules -------------------------------- */
    var d    = A.ease(t, 1.70, 0.65, A.easeOutCubic);
    var dOut = A.ease(t, 7.00, 0.40, A.easeInCubic);
    var f    = A.ease(t, 1.80, 0.75, A.easeOutQuint) * (1 - dOut);
    r.dates.style.opacity = A.round(d * (1 - dOut), 3);
    r.dates.style.transform =
      "translateY(" + A.round(A.lerp(12, 0, d) + dOut * 16, 2) + "px)";
    r.ruleL.style.transform = "scaleX(" + A.round(f, 4) + ")";
    r.ruleR.style.transform = "scaleX(" + A.round(f, 4) + ")";

    /* --- the rule is born where the mark landed ---------------- */
    var rule = A.ease(t, 8.05, 0.80, A.easeOutExpo);
    r.rule.style.transform = "scaleX(" + A.round(rule, 4) + ")";

    /* --- and the seed takes over ------------------------------- */
    var s = A.seg(t, 8.30, 0.45);
    r.seed.style.opacity = A.round(A.clamp(s * 2.4), 3);
    r.seed.style.transform =
      "scale(" + A.round(A.lerp(0.40, 1, A.easeOutBack(s, 1.5)), 4) + ")";
  }

  return {
    name: "logo",
    duration: 9.5,
    /* the beats the arrow keys step between */
    markers: [0.00, 0.35, 1.10, 1.70, 2.40, 7.00, 7.15, 8.05, 8.30, 9.10],
    selector: "#scene-logo",
    init: init,
    render: render
  };
})();
