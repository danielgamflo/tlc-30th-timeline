/* ============================================================
   outro.js — the clearing
   ------------------------------------------------------------
   no logo here. the last card has already flown up and out, so all
   that is left is to take the rail away and hand an empty frame to
   the loop. the running bars stay a moment longer and leave last,
   which is what keeps the ending from reading as a cut.

   frame 0 and the final frame are both bare paper, so the loop has
   no seam.

   beats
     0.00  the seed lets go
     0.15  the rail retracts into the centre it came from
     1.60  bare paper; only the bars are still running
     ~2.5  the bars leave too  ->  back to the logo
   ============================================================ */

var SCENE_OUTRO = (function () {

  var r = {};

  function init(root) {
    r.rule     = root.querySelector(".rule");
    r.wordmark = root.querySelector(".logo-wordmark");
    r.mark     = root.querySelector(".logo-mark");
    r.dates    = root.querySelector(".logo-dates");
    r.seed     = root.querySelector(".seed");

    /* this scene reuses the logo's markup, but none of the logo */
    r.wordmark.style.opacity = 0;
    r.mark.style.opacity = 0;
    r.dates.style.opacity = 0;
  }

  function render(t) {
    var sOut = A.ease(t, 0.00, 0.35, A.easeInCubic);
    r.seed.style.opacity = A.round(1 - sOut, 3);
    r.seed.style.transform = "scale(" + A.round(A.lerp(1, 0.3, sOut), 4) + ")";

    var pull = A.ease(t, 0.15, 1.30, A.easeInOutQuint);
    r.rule.style.transform = "scaleX(" + A.round(1 - pull, 4) + ")";
  }

  return {
    name: "outro",
    duration: 2.5,
    markers: [0.00, 0.15, 1.60, 2.40],
    selector: "#scene-outro",
    cloneFrom: "#scene-logo",   /* built from the logo markup at boot */
    init: init,
    render: render
  };
})();
