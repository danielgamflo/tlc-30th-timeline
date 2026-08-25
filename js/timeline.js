/* ============================================================
   timeline.js — the 39 dates
   ------------------------------------------------------------
   one cycle per date, always the same shape:

     APPEAR    the marker swells to the mustard square and the
               card grows out of it (above, then below, alternating)
     EXPAND    the big card grows from that same centre point
     HOLD      10s — long paragraphs creep upward inside their window
     CONTRACT  the big card collapses back into the small one
     ADVANCE   the strip slides left, the next date reaches centre

   nothing here is stateful: give it t, it gives you the frame.
   ============================================================ */

var SCENE_TIMELINE = (function () {

  /* ---- tuning ------------------------------------------------
     the shape of one date:
       APPEAR   the small card is born from the dot
       SPIN     the box grows out of the marker turning 120deg -> 0,
                and lands SQUARE
       WIDEN    the square opens out to 16:9
       HOLD     on screen. contents arrive over its first ~2.3s,
                then the photo drifts while it is read
       EXIT     the whole card leaves upward, off the top
       ADVANCE  the strip slides on to the next date
     ------------------------------------------------------------ */
  var APPEAR   = 0.55;
  var SPIN     = 0.85;
  var WIDEN    = 0.45;
  var HOLD     = 9.50;
  var EXIT     = 2.40;
  var ADVANCE  = 0.95;
  /* 40 x 14.70s  +  6.5s logo  +  5.5s outro  =  600.0s exactly */
  var CYCLE = APPEAR + SPIN + WIDEN + HOLD + EXIT + ADVANCE;

  var SPIN_FROM = 120;    /* degrees the box turns through on the way in */
  var BOX_W = 1500;       /* final 16:9 width; height is fixed in css    */
  var BOX_H = 880;        /* the square phase is BOX_H x BOX_H           */

  var SPACING = 300;      /* px between dates on the strip */
  var CARD_W = 200;       /* must match css .card__box width */
  var YEAR_FILL = 0.86;   /* share of the box the year spans */
  var YEAR_MAX = 82;      /* ceiling, so a short year cannot go silly */
  var DOT = 15;           /* idle marker size */
  var SQUARE = 46;        /* marker size at centre — matches .seed */

  var DRIFT = 1.045;         /* how far the photo creeps across the hold */

  var SOFT_IN = 0.85;        /* title / paragraph / stat: slow and smooth */
  var yearTravel = 0;        /* measured once: one pill-length, right to left */

  var PAPER = "#F4F0E6";

  /* full palette — used for accents (marker, pill, rules) */
  var COLORS = ["#BB6024", "#CB9216", "#666737", "#9FB0A3", "#D7D0C5", "#86754F"];

  var MUSTARD = "#CB9216";   /* the rail's markers, and nothing else */

  /* the card grounds: green, beige, stone. burnt orange and mustard
     are out of the cards entirely. all three clear 9:1 against black.
     STONE is the one colour not in the original six — the palette has
     no true grey, so it is a desaturated neighbour of the khaki. */
  var STONE  = "#B5B2AB";
  var PANELS = ["#9FB0A3", "#D7D0C5", STONE];

  /* rules and marks on top of a panel, never a text bed */
  var ACCENTS = ["#666737", "#86754F"];

  var data = [], nodes = [], r = {}, parts = [], built = false;
  var shownIndex = -1, overflowPx = 0;
  var expW = 0, expH = 0;         /* cached; cleared when the format changes */

  function invalidate() {
    expW = 0; expH = 0; shownIndex = -1;
    for (var i = 0; i < nodes.length; i++) nodes[i].last = null;
  }

  /* ---- build ------------------------------------------------- */

  function init(root) {
    r.root  = root;
    r.rule  = root.querySelector(".rule");
    r.strip = root.querySelector("#tl-strip");
    r.exp   = root.querySelector("#tl-expanded");
    r.expPhoto = root.querySelector("#exp-photo");
    r.expLabel = root.querySelector("#exp-label");
    r.expYear  = root.querySelector("#exp-year");
    r.expTitle = root.querySelector("#exp-title");
    r.expBody  = root.querySelector("#exp-body");
    r.expInner = root.querySelector("#exp-bodyinner");
    r.expPara  = root.querySelector("#exp-para");
    r.expStat  = root.querySelector("#exp-stat");
    r.expDivider = root.querySelector("#exp-divider");
    r.expLabelT  = root.querySelector("#exp-label-t");
    r.expPanel = root.querySelector("#exp-panel");

  }

  function setData(rows) {
    data = rows;
    buildStrip();
  }

  function buildStrip() {
    r.strip.innerHTML = "";
    nodes = [];

    for (var i = 0; i < data.length; i++) {
      var d = data[i];
      var top = (i % 2 === 0);          /* first one above, then alternating */
      var color = panelFor(i);
      var accent = accentFor(i);

      var node = document.createElement("div");
      node.className = "node " + (top ? "node--top" : "node--bottom");
      node.style.transform = "translateX(" + (i * SPACING) + "px)";

      var marker = document.createElement("div");
      marker.className = "node__marker";
      var dot = document.createElement("div");
      dot.className = "node__dot";
      var square = document.createElement("div");
      square.className = "node__square";
      marker.appendChild(dot);
      marker.appendChild(square);

      var stem = document.createElement("div");
      stem.className = "node__stem";

      var card = document.createElement("div");
      card.className = "node__card";

      var dateEl = document.createElement("div");
      dateEl.className = "card__date";
      var labelEl = document.createElement("div");
      labelEl.className = "card__label";
      labelEl.textContent = d.label || "";
      var yearEl = document.createElement("div");
      yearEl.className = "card__year";
      yearEl.textContent = d.year;
      dateEl.appendChild(labelEl);
      dateEl.appendChild(yearEl);

      var box = document.createElement("div");
      box.className = "card__box";

      var photo;
      var firstShot = (d.photos && d.photos.length) ? d.photos[0] : d.photo;
      if (firstShot) {
        photo = document.createElement("img");
        photo.className = "card__photo";
        photo.src = "assets/photos/" + firstShot;
        photo.style.objectPosition = focusOf(d, 0);
        photo.alt = "";
      } else {
        photo = document.createElement("div");
        photo.className = "card__photo card__photo--empty";
        photo.textContent = d.year;
      }

      /* the coloured band belongs to the box and arrives with it —
         only its wording waits its turn */
      var short = document.createElement("div");
      short.className = "card__short";
      short.style.background = color;
      short.style.color = A.inkOn(color, "#000000", PAPER);
      var shortText = document.createElement("span");
      shortText.className = "card__short__t";
      shortText.textContent = d.short;
      short.appendChild(shortText);

      box.appendChild(photo);
      box.appendChild(short);
      card.appendChild(dateEl);
      card.appendChild(box);
      /* stem first so the ring paints over it — the line runs behind
         the marker, it does not cross it */
      node.appendChild(stem);
      node.appendChild(marker);
      node.appendChild(card);
      r.strip.appendChild(node);

      nodes.push({ el: node, dot: dot, square: square, stem: stem, card: card,
                   box: box, short: shortText, date: dateEl, year: yearEl,
                   top: top, color: color, accent: accent, last: null });
    }
    fitYears();
    built = true;
  }

  /* the year is the loudest thing on the small card, so it is sized to
     fill a share of the box rather than to a fixed point size. "1996"
     and "1990s" then read at the same width down the whole rail
     instead of one of them coming up short. measured once, at build. */
  function fitYears() {
    var target = CARD_W * YEAR_FILL;
    for (var i = 0; i < nodes.length; i++) {
      var el = nodes[i].year;
      el.style.fontSize = "100px";
      var w = el.scrollWidth;
      if (!w) continue;
      el.style.fontSize = A.round(Math.min(100 * target / w, YEAR_MAX), 1) + "px";
    }
  }

  function panelFor(i)  { return PANELS[i % PANELS.length]; }
  function accentFor(i) { return ACCENTS[i % ACCENTS.length]; }

  /* the year badge must not disappear into the panel behind it */
  function pillFor(panel) {
    for (var i = 0; i < PANELS.length; i++) {
      /* the 6px black outline carries the separation, so a gentle
         step is enough — sage on mustard, the way the sketch has it */
      if (PANELS[i] !== panel && A.contrast(PANELS[i], panel) > 1.15) return PANELS[i];
    }
    return PAPER;
  }

  /* archive photos are landscape; the frame is portrait, so 40% of
     every shot is cropped away. centred is only right by luck — the
     subject is rarely in the middle. "focus" moves the crop:
       "focus": "30% 20%"            one value for the date
       "focus": ["30% 20%", "50% 40%"]   one per photo
     left out, it stays centred.                                   */
  function focusOf(d, k) {
    var f = d.focus;
    if (!f) return "50% 50%";
    if (typeof f === "string") return f;
    return f[k] || f[0] || "50% 50%";
  }

  function esc(s) {
    return String(s === null || s === undefined ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  /* ---- expanded card content --------------------------------- */

  function showExpanded(i) {
    if (i === shownIndex) return;
    shownIndex = i;
    var d = data[i];
    var color = panelFor(i);
    var accent = accentFor(i);
    var ink = A.inkOn(color, "#000000", PAPER);
    var pill = pillFor(color);

    /* the coloured, hatched ground belongs to the box itself — during
       the square phase the whole card is that one flat field */
    r.exp.style.backgroundColor = color;
    r.expPanel.style.color = ink;
    r.expYear.style.background = pill;
    r.expYear.style.color = A.inkOn(pill, "#000000", PAPER);
    r.expYear.style.borderColor = ink;
    r.expStat.style.borderLeftColor = accent;
    r.expLabelT.textContent = d.label || "";
    r.expYear.textContent  = d.year;
    r.expTitle.textContent = d.title;
    r.expPara.textContent  = d.paragraph;

    if (d.stat) {
      r.expStat.style.display = "block";
      r.expStat.innerHTML =
        "<b>" + esc(d.stat) + "</b>" +
        (d.source ? "<span>" + esc(d.source) + "</span>" : "");
    } else {
      r.expStat.style.display = "none";
      r.expStat.innerHTML = "";
    }

    /* one photo or several — "photos": ["a.jpg","b.jpg"] cross-fades
       them across the hold, stacked, so the mask reveal still plays
       on the first one and the rest simply relieve it. */
    var shots = d.photos && d.photos.length ? d.photos : (d.photo ? [d.photo] : []);
    if (shots.length) {
      r.expPhoto.className = "exp__photo";
      var html = "";
      for (var s2 = 0; s2 < shots.length; s2++) {
        html += '<img src="assets/photos/' + shots[s2] + '" alt="" ' +
                'style="object-position:' + focusOf(d, s2) + '">';
      }
      r.expPhoto.innerHTML = html;
    } else {
      r.expPhoto.className = "exp__photo exp__photo--empty";
      r.expPhoto.setAttribute("data-year", d.year);
      r.expPhoto.innerHTML = "";
    }

    /* the year travels one pill-length, so measure this pill */
    r.expYear.style.transform = "none";
    yearTravel = r.expYear.offsetWidth || 380;

    if (window.NOTES) NOTES.setDate(d);

    /* how far the paragraph has to creep, if at all */
    r.expInner.style.transform = "translateY(0px)";
    overflowPx = Math.max(0, r.expInner.offsetHeight - r.expBody.clientHeight);
  }

  /* ---- frame -------------------------------------------------- */

  function render(t) {
    if (!built) return;

    var i = Math.floor(t / CYCLE);
    if (i >= data.length) i = data.length - 1;
    var ct = t - i * CYCLE;                     /* time inside this date */

    /* phase boundaries */
    var tSpin    = APPEAR;
    var tWiden   = tSpin + SPIN;
    var tHold    = tWiden + WIDEN;
    var tExit    = tHold + HOLD;
    var tAdvance = tExit + EXIT;

    var appear  = A.seg(ct, 0, APPEAR);
    var spin    = A.seg(ct, tSpin, SPIN);
    var widen   = A.seg(ct, tWiden, WIDEN);
    var exit    = A.seg(ct, tExit, EXIT);
    var advance = A.seg(ct, tAdvance, ADVANCE);

    showExpanded(i);

    /* ---- strip position ------------------------------------- */
    /* the "current" date index, fractional while advancing */
    var pos = i + A.easeInOutCubic(advance);
    var stripX = (r.root.clientWidth / 2) - pos * SPACING;
    r.strip.style.transform = "translateX(" + A.round(stripX, 2) + "px)";

    /* after the last date there is nowhere to advance to, so the
       strip clears instead and hands the centre to the outro */
    var last = (i === data.length - 1);
    r.strip.style.opacity = last ? A.round(1 - A.easeInCubic(advance), 3) : 1;

    /* ---- nodes ---------------------------------------------- */
    for (var j = 0; j < nodes.length; j++) {
      var n = nodes[j];

      /* how close this node is to the centre, 0..1 */
      var dist = Math.abs(j - pos);
      var m = A.clamp(1 - dist / 0.62);

      /* a card exists only once its date has been through the centre.
         the box grows; the band and the date arrive at true size, the
         same rule the expanded card follows. scaling type from a point
         just smears it. */
      var boxS, boxO, shortO, dateO, stem;
      if (j < i) {
        boxS = 1; boxO = 1; shortO = 1; dateO = 1; stem = 1;
      } else if (j === i) {
        boxS   = A.lerp(0.18, 1, A.easeOutBack(A.seg(ct, 0, 0.42), 1.30));
        boxO   = A.clamp(A.seg(ct, 0, 0.12) * 1.6);
        shortO = A.ease(ct, 0.24, 0.26, A.easeOutQuint);
        dateO  = A.ease(ct, 0.30, 0.28, A.easeOutQuint);
        stem   = A.easeOutCubic(appear);
      } else {
        boxS = 0.18; boxO = 0; shortO = 0; dateO = 0; stem = 0;
      }

      var vis = (j <= i) ? 1 : 0;

      /* far-off nodes settle into a fixed state — skip rewriting them */
      var sig = (j < i ? "p" : "f") + A.round(m, 3) + "|" + A.round(boxS, 3) + "|" + A.round(boxO, 2)
              + "|" + A.round(shortO, 2) + "|" + A.round(dateO, 2)
              + "|" + vis + "|" + A.round(stem, 3);
      if (sig === n.last) continue;
      n.last = sig;

      /* hollow while its date is still ahead, filled once it has been
         through the centre — the rail reads as a progress bar */
      n.dot.style.background   = (j < i) ? MUSTARD : PAPER;
      n.dot.style.opacity      = A.round(1 - m, 3);
      n.dot.style.transform    = "scale(" + A.round(A.lerp(1, 0.62, m), 4) + ")";
      n.square.style.opacity   = A.round(m, 3);
      n.square.style.transform = "scale(" + A.round(A.lerp(0.32, 1, m), 4) + ")";

      n.card.style.opacity  = vis;
      n.stem.style.opacity  = vis;
      n.stem.style.transform = "scaleY(" + A.round(stem, 4) + ")";

      n.box.style.opacity   = A.round(boxO, 3);
      n.box.style.transform = "scale(" + A.round(boxS, 4) + ")";
      n.short.style.opacity = A.round(shortO, 3);
      n.date.style.opacity  = A.round(dateO, 3);
      n.date.style.transform =
        "translateY(" + A.round(A.lerp(n.top ? 10 : -10, 0, dateO), 2) + "px)";
    }

    /* ---- the expanded card ---------------------------------- */

    /* 1 + 2. it grows out of the marker turning 120deg -> 0 and lands
       SQUARE, then opens out to 16:9. the element is always BOX_H tall,
       so the square phase is just a narrower width. */
    var spinE  = A.easeOutQuint(spin);
    var widenE = A.easeInOutQuint(widen);

    var boxW = A.lerp(BOX_H, BOX_W, widenE);
    var boxScale = A.lerp(SQUARE / BOX_H, 1, spinE);
    var boxRot = A.lerp(SPIN_FROM, 0, spinE);

    /* 8. at the end the whole card leaves upward, off the top.
       75-75 in After Effects terms: heavy ease at both ends. */
    var exitE = A.easeInOutQuint(exit);
    var exitY = -exitE * (r.root.clientHeight / 2 + BOX_H / 2 + 80);

    r.exp.style.width = A.round(boxW, 1) + "px";
    r.exp.style.opacity = A.round(A.clamp(A.seg(ct, tSpin, 0.10) * 2), 3);
    r.exp.style.transform =
      "translate(-50%, -50%) translateY(" + A.round(exitY, 1) + "px)" +
      " scale(" + A.round(boxScale, 4) + ")" +
      " rotate(" + A.round(boxRot, 2) + "deg)";

    /* everything below hangs off tWiden, not tHold: the year and the
       date start while the box is still opening out, so the square ->
       16:9 move hands straight into them instead of stopping first. */

    /* 4a. the divider builds out of its own centre toward both edges */
    var line = A.ease(ct, tWiden + 0.20, 0.40, A.easeOutQuint);
    r.expDivider.style.transform = "scaleY(" + A.round(line, 4) + ")";

    /* 4b. and the photo is unmasked off that line, sweeping left */
    var wipe = A.ease(ct, tWiden + 0.45, 0.65, A.easeInOutQuint);
    r.expPhoto.style.clipPath = "inset(0 0 0 " + A.round((1 - wipe) * 100, 2) + "%)";

    /* 3. the year travels right to left about one pill-length, on a
       90-90 curve, and does not show at all until halfway — then it
       arrives on a hard cut, no fade. it sets off mid-widen. */
    var yTrav = A.easeInOutQuint(A.seg(ct, tWiden + 0.15, 0.55));
    r.expYear.style.transform =
      "translateX(" + A.round(A.lerp(yearTravel, 0, yTrav), 1) + "px)";
    r.expYear.style.opacity = yTrav >= 0.5 ? 1 : 0;

    /* 7. the date rises out from behind the top of the year pill */
    var dMask = A.easeOutQuint(A.seg(ct, tWiden + 0.55, 0.45));
    r.expLabelT.style.transform =
      "translateY(" + A.round(A.lerp(100, 0, dMask), 2) + "%)";

    /* 6. title and paragraph, slower and softer than before */
    var soft = [
      { el: r.expTitle, at: tWiden + 0.85 },
      { el: r.expBody,  at: tWiden + 1.05 },
      { el: r.expStat,  at: tWiden + 1.30 }
    ];
    for (var q = 0; q < soft.length; q++) {
      var sp = A.ease(ct, soft[q].at, SOFT_IN, A.easeInOutCubic);
      soft[q].el.style.opacity = A.round(sp, 3);
      soft[q].el.style.transform =
        "translateY(" + A.round(A.lerp(22, 0, sp), 2) + "px)";
    }

    /* 5. the photo settles, then drifts almost imperceptibly while it
       is read. a dead-still frame on an LED wall reads as a frozen
       player. set DRIFT to 1 to stop it. */
    var imgs = r.expPhoto.getElementsByTagName("img");
    if (imgs.length) {
      var settle = A.lerp(1.06, 1, A.easeOutQuint(A.seg(ct, tWiden + 0.45, 0.80)));
      var drift = A.lerp(1, DRIFT, A.ease(ct, tHold + 0.9, HOLD - 0.9, A.linear));
      var zoom = "scale(" + A.round(settle * drift, 4) + ")";

      /* several photos on one date cross-fade across the hold */
      var slot = (HOLD - 1.2) / imgs.length;
      for (var k = 0; k < imgs.length; k++) {
        var o = 1;
        if (imgs.length > 1) {
          var from = tHold + 0.9 + k * slot;
          o = (k === 0) ? 1 : A.ease(ct, from, 0.9, A.easeInOutCubic);
        }
        imgs[k].style.opacity = A.round(o, 3);
        imgs[k].style.transform = zoom;
      }
    }

    /* long paragraphs creep upward across the hold */
    var creep = 0;
    if (overflowPx > 0) {
      var pc = A.seg(ct, tHold + 2.6, HOLD - 3.6);   /* settle, read, settle */
      creep = -overflowPx * A.easeInOutCubic(pc);
    }
    r.expInner.style.transform = "translateY(" + A.round(creep, 2) + "px)";
  }

  return {
    name: "timeline",
    selector: "#scene-timeline",
    get duration() { return data.length * CYCLE; },
    get markers() {
      var m = [];
      for (var i = 0; i < data.length; i++) {
        m.push(A.round(i * CYCLE, 3));                           /* card born  */
        m.push(A.round(i * CYCLE + APPEAR, 3));                  /* box spins  */
        m.push(A.round(i * CYCLE + APPEAR + SPIN, 3));           /* widens     */
        m.push(A.round(i * CYCLE + APPEAR + SPIN + WIDEN + HOLD, 3)); /* exits */
      }
      return m;
    },
    init: init,
    setData: setData,
    render: render,
    invalidate: invalidate,

    /* the start of every date's cycle, in scene-local seconds. the
       viewer jumps between these, not between animation beats — a
       10-minute piece is not reviewable one frame at a time. */
    get dateStarts() {
      var out = [];
      for (var i = 0; i < data.length; i++) out.push(i * CYCLE);
      return out;
    },

    /* authoring aid: nudge the current date's focus and read the value
       straight off the HUD to paste into the JSON. 40 photos are not
       findable by guess-and-reload. */
    nudgeFocus: function (dx, dy) {
      if (shownIndex < 0) return null;
      var d = data[shownIndex];
      var cur = (typeof d.focus === "string" ? d.focus : "50% 50%").split(" ");
      var x = A.clamp(parseFloat(cur[0]) + dx, 0, 100);
      var y = A.clamp(parseFloat(cur[1]) + dy, 0, 100);
      d.focus = Math.round(x) + "% " + Math.round(y) + "%";
      shownIndex = -1;                  /* force the card to redraw */
      return { year: d.year, title: d.title, focus: d.focus };
    },
    currentFocus: function () {
      if (shownIndex < 0) return null;
      var d = data[shownIndex];
      return { year: d.year, focus: (typeof d.focus === "string" ? d.focus : null) };
    },
    CYCLE: CYCLE
  };
})();
