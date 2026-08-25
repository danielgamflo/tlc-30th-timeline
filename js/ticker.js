/* ============================================================
   ticker.js — the two running bars that frame the piece
   ------------------------------------------------------------
   lives above every scene, so it is there from the first frame of
   the logo to the last of the outro and the loop never shows a
   seam in it.

   the track holds the phrase repeated enough times to cover the
   stage twice, and its offset is  -(t * SPEED) % unitWidth  — so
   it is a pure function of t like everything else, and it wraps
   without ever running out of tape.
   ============================================================ */

var TICKER = (function () {

  var SPEED = 30;      /* px per second */
  var PHRASE = ["The Life Church", "30th Anniversary", "1996 — 2026"];

  /* the bars are not there from frame 0: they arrive as the logo
     leaves — top drops in, bottom rises in — and they clear again
     before the loop wraps, so frame 0 is always empty paper. */
  var BAR_H  = 46;     /* must match css .ticker height */
  var IN_AT  = 8.30;   /* absolute seconds — the logo is shrinking */
  var IN_DUR = 0.85;
  var OUT_LEAD = 1.50; /* seconds before the end that they start to go */
  var OUT_DUR  = 1.10;

  var bars = [];       /* { track, unit } */
  var stage = null;

  function build(stageEl) {
    stage = stageEl;
    bars = [];

    var nodes = stage.querySelectorAll(".ticker");
    for (var b = 0; b < nodes.length; b++) {
      var track = nodes[b].querySelector(".ticker__track");
      track.innerHTML = "";

      /* one unit of the pattern, measured, then repeated to cover
         the stage twice over so the wrap is never visible */
      var unit = document.createElement("span");
      unit.className = "ticker__unit";
      unit.innerHTML = phraseHtml();
      track.appendChild(unit);

      var unitW = unit.offsetWidth || 1;
      var need = Math.ceil((stage.clientWidth * 2) / unitW) + 1;
      for (var k = 1; k < need; k++) {
        var copy = unit.cloneNode(true);
        track.appendChild(copy);
      }

      bars.push({ el: nodes[b], track: track, unit: unitW });
    }
  }

  function phraseHtml() {
    var out = "";
    for (var i = 0; i < PHRASE.length; i++) {
      out += "<i>" + PHRASE[i] + "</i><b>&bull;</b>";
    }
    return out;
  }

  /* top bar runs left, bottom bar runs right — the same text moving
     as one block would read as a still image */
  function render(t, total) {
    var arrive = A.easeOutQuint(A.seg(t, IN_AT, IN_DUR));
    var leave  = A.easeInOutQuint(A.seg(t, total - OUT_LEAD, OUT_DUR));
    var placed = arrive * (1 - leave);
    var off = (1 - placed) * BAR_H;

    for (var b = 0; b < bars.length; b++) {
      var top = (b === 0);

      /* the bar slides into frame; the tape inside keeps running */
      bars[b].el.style.transform =
        "translateY(" + A.round(top ? -off : off, 2) + "px)";

      var x = (t * SPEED * (top ? -1 : 1)) % bars[b].unit;
      if (x > 0) x -= bars[b].unit;
      bars[b].track.style.transform = "translateX(" + A.round(x, 2) + "px)";
    }
  }

  return { build: build, render: render };
})();
