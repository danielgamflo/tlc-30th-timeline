/* ============================================================
   outro.js — closing scene, and the hinge of the loop
   ------------------------------------------------------------
   runs on a clone of the logo markup, so the two are guaranteed
   to sit in exactly the same place.

   it starts on the state the timeline hands over — the rule at
   full width with the mustard square on it — and walks the logo
   intro backwards, then clears the frame so frame 0 of the logo
   can follow with no visible seam.

   beats
     0.00  the seed lets go
     0.20  the rule pulls back into the centre
     0.55  the mark grows out of that point
     1.20  THE LIFE CHURCH returns
     1.60  1996 — 2026 returns
     2.40  hold
     4.60  the frame clears  -> back to the top
   ============================================================ */

var SCENE_OUTRO = (function () {

  var MARK_H = 256;   /* must match css .logo-mark height */
  var SEED   = 46;    /* must match css .seed size        */

  var r = {};

  function init(root) {
    r.rule     = root.querySelector(".rule");
    r.wordmark = root.querySelector(".logo-wordmark");
    r.mark     = root.querySelector(".logo-mark");
    r.dates    = root.querySelector(".logo-dates");
    r.ruleL    = root.querySelector(".logo-dates__rule--l");
    r.ruleR    = root.querySelector(".logo-dates__rule--r");
    r.seed     = root.querySelector(".seed");
  }

  function render(t) {

    var clear = A.ease(t, 4.60, 0.80, A.easeInCubic);   /* the final wipe */

    /* --- the seed lets go ------------------------------------- */
    var sOut = A.ease(t, 0.00, 0.40, A.easeInCubic);
    r.seed.style.opacity = A.round(1 - sOut, 3);
    r.seed.style.transform = "scale(" + A.round(A.lerp(1, 0.35, sOut), 4) + ")";

    /* --- the rule pulls back in, then holds until the wipe ---- */
    var rIn = A.ease(t, 0.20, 0.65, A.easeOutQuint);
    r.rule.style.transform = "scaleX(" + A.round(1 - rIn, 4) + ")";

    /* --- the mark grows back out of the centre ---------------- */
    var mUp = A.ease(t, 0.55, 0.95, A.easeInOutCubic);
    var markS = A.lerp(SEED / MARK_H, 1, mUp);
    r.mark.style.opacity = A.round(A.clamp(mUp * 2.6) * (1 - clear), 3);
    r.mark.style.transform =
      "translateY(0px) scale(" + A.round(markS, 4) + ")";

    /* --- wordmark --------------------------------------------- */
    var w = A.ease(t, 1.20, 0.80, A.easeOutQuint);
    var track = A.lerp(0.62, 0.22, w);
    r.wordmark.style.opacity       = A.round(w * (1 - clear), 3);
    r.wordmark.style.letterSpacing = A.round(track, 4) + "em";
    r.wordmark.style.textIndent    = A.round(track, 4) + "em";
    r.wordmark.style.transform =
      "translateY(" + A.round(A.lerp(16, 0, w) - clear * 14, 2) + "px)";

    /* --- dates + flanking rules -------------------------------- */
    var d = A.ease(t, 1.60, 0.65, A.easeOutCubic);
    var f = A.ease(t, 1.70, 0.75, A.easeOutQuint) * (1 - clear);
    r.dates.style.opacity = A.round(d * (1 - clear), 3);
    r.dates.style.transform =
      "translateY(" + A.round(A.lerp(12, 0, d) + clear * 14, 2) + "px)";
    r.ruleL.style.transform = "scaleX(" + A.round(f, 4) + ")";
    r.ruleR.style.transform = "scaleX(" + A.round(f, 4) + ")";
  }

  return {
    name: "outro",
    duration: 5.5,
    markers: [0.00, 0.55, 1.20, 1.60, 2.40, 4.60, 5.30],
    selector: "#scene-outro",
    cloneFrom: "#scene-logo",   /* built from the logo markup at boot */
    init: init,
    render: render
  };
})();
