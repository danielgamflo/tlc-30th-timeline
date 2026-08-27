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

  /* the running time follows the content: dates x CYCLE + 9.5 + 2.5.
     42 dates -> 10:29. nothing anywhere assumes a count, so adding or
     dropping a date is a line of JSON and the piece just gets longer
     or shorter.

     if it ever has to land on a fixed length instead, HOLD is the dial:
         HOLD = (TARGET - 12) / dates - 5.20
     at 600s and 42 dates that is 8.80, i.e. 0.7s less reading each. */
  var CYCLE = APPEAR + SPIN + WIDEN + HOLD + EXIT + ADVANCE;

  var BOX_W = 1500;       /* final width                                 */
  var BOX_H = 880;        /* final height                                */
  var DIAMOND_H = 600;    /* 1500 x 600 = the crest's lozenge, 2.5:1     */

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

  /* the brand's five. colour lives in the accents now, never under the
     body copy: one date owns one colour, and its ring on the rail, its
     year pill, its card band and its stat rule are all that colour.
     mustard leads so the logo's seed hands straight to the first ring. */
  var ACCENTS = ["#CB9216", "#BB6024", "#666737", "#9FB0A3"];

  /* and cream is the fifth: every panel, always. black on it reads
     11:1, which is why the paragraphs got easier to read at distance
     the moment the colour moved off the ground. */
  var PANEL = "#D7D0C5";

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
    r.wrap     = root.querySelector("#tl-wrap");
    r.frame    = root.querySelector("#exp-frame-poly");

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
      var accent = accentFor(i);
      var color = accent;             /* the band is the date's colour */

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
      /* the rail's small card is 200px wide — it shows the very first
         photograph, opening a split slide if that is what comes first */
      var firstShot = flatten(slidesOf(d))[0];
      if (firstShot) {
        photo = document.createElement("img");
        photo.className = "card__photo";
        photo.src = stillFor(firstShot);
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
                   photo: photo,
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

  function accentFor(i) { return ACCENTS[i % ACCENTS.length]; }

  /* the eight points of the morph. k = 0 is the lozenge, k = 50 is
     exactly the border box, and past that the shoulders leave it.
     given a width and height it returns pixels; given none, percentages
     for the clip-path. `inset` pulls the ring in by half the stroke, so
     the outline's OUTER edge lands where the card's border does — an svg
     stroke straddles its path, a css border sits wholly inside. */
  function shoulders(k, w, h, inset) {
    w = w || 100; h = h || 100; inset = inset || 0;
    var x0 = inset, x1 = w - inset, y0 = inset, y1 = h - inset;
    var fx = function (p) { return x0 + (x1 - x0) * p / 100; };
    var fy = function (p) { return y0 + (y1 - y0) * p / 100; };
    return [[x0, fy(50-k)], [fx(50-k), y0], [fx(50+k), y0], [x1, fy(50-k)],
            [x1, fy(50+k)], [fx(50+k), y1], [fx(50-k), y1], [x0, fy(50+k)]];
  }

  /* archive photos are landscape; the frame is portrait, so 40% of
     every shot is cropped away. centred is only right by luck — the
     subject is rarely in the middle. "focus" moves the crop:
       "focus": "30% 20%"            one value for the date
       "focus": ["30% 20%", "50% 40%"]   one per photo
     left out, it stays centred.                                   */
  function focusOf(d, k, cell) {
    var f = d.focus;
    if (!f) return "50% 50%";
    if (typeof f === "string") return f;
    var v = f[k];
    if (v === undefined) v = f[0];
    /* a split slide carries one value per cell */
    if (v instanceof Array) v = (cell === undefined ? v[0] : v[cell]);
    return v || "50% 50%";
  }

  /* ---- slides -------------------------------------------------
     A date's list is a list of SLIDES, not of photographs. A slide is
     either one picture, or a group of two to four shown together in a
     grid — which is how the scanned print and the screen-grabs get used
     without being enlarged past what is actually in them.

         "photos": [ ["a.jpg","b.jpg","c.jpg","d.jpg"], "e.jpg", "f.jpg" ]

     is three slides and six photographs. A bare string behaves exactly
     as it always did, so nothing already written has to change.      */

  function slidesOf(d) {
    if (d.photos && d.photos.length) return d.photos;
    return d.photo ? [d.photo] : [];
  }

  /* every photograph on the date, groups opened out */
  function flatten(slides) {
    var out = [];
    for (var i = 0; i < slides.length; i++) {
      var s = slides[i];
      if (s instanceof Array) out = out.concat(s);
      else out.push(s);
    }
    return out;
  }

  /* ---- moving footage ----------------------------------------
     a card can hold a clip as well as stills. video lives in its own
     folder so the two are never confused, and it is shown WHOLE:
     `contain` plus solid black, rather than losing a third of the
     picture to the portrait crop the way a photograph does.        */

  function isVideo(name) { return /\.(mp4|webm|mov)$/i.test(name); }

  /* the clip's own fade in and out are baked into the file, so nothing
     here has to ramp a volume — this only decides whether the track is
     audible at all. */
  var soundOn = false;

  function unmuteAll() {
    var vs = r.expPhoto ? r.expPhoto.getElementsByTagName("video") : [];
    for (var i = 0; i < vs.length; i++) vs[i].muted = !soundOn;
  }

  /* where the hold begins inside a cycle. a constant, which is what
     lets a clip catch up on its own once its metadata lands. */
  var HOLD_AT = APPEAR + SPIN + WIDEN;

  /* the last frame render() was asked for. a paused piece draws exactly
     once per seek, so a video whose metadata arrives after that draw
     would otherwise sit on frame zero for good. */
  var lastCt = 0, lastPlaying = false;

  /* which cell of a split slide the focus tool is aimed at */
  var selCell = 0;

  function srcFor(name) {
    return (isVideo(name) ? "assets/video/" : "assets/photos/") + name;
  }

  /* every clip ships a still of itself beside it, same name, .jpg. The
     small card on the rail is 200px wide and there are forty of them —
     it gets the still, not a second video element. */
  function stillFor(name) {
    return isVideo(name)
      ? "assets/video/" + name.replace(/\.[^.]+$/, ".jpg")
      : "assets/photos/" + name;
  }

  /* the clip is a pure function of time like everything else:
         video time = time since this card's hold began.
     while the piece is PLAYING the element runs on its own clock and is
     only corrected once it has drifted, because seeking every frame
     stutters badly. while it is PAUSED — stepping, scrubbing, or being
     captured for the export — it is seeked exactly, and that is what
     keeps the render frame-exact. */
  function driveVideo(v, local, playing) {
    var dur = v.duration;
    if (!dur || dur !== dur) return;          /* metadata not in yet */

    if (local < 0 || local >= dur) {
      if (!v.paused) v.pause();
      /* before the hold it waits on frame one; after it, on the last
         frame, so the card exits on a held image and not on black */
      var park = local < 0 ? 0 : Math.max(0, dur - 1 / 30);
      if (Math.abs(v.currentTime - park) > 0.02) v.currentTime = park;
      return;
    }

    if (playing) {
      if (v.paused) {
        var p = v.play();
        if (p && p["catch"]) p["catch"](function () {});
      }
      if (Math.abs(v.currentTime - local) > 0.25) v.currentTime = local;
    } else {
      if (!v.paused) v.pause();
      if (Math.abs(v.currentTime - local) > 1 / 60) v.currentTime = local;
    }
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
    var accent = accentFor(i);

    /* the ground settles to cream on every date; the colour is carried
       by the pill, the rail's ring and the stat rule, which all match.
       the background itself is written per frame in render(), because
       the lozenge has to bloom in the date's colour — cream on the
       cream paper is 1.2:1 and the shape simply is not there. */
    r.expPanel.style.color = "#000000";
    r.expYear.style.background = accent;
    r.expYear.style.color = A.inkOn(accent, "#000000", PAPER);
    r.expYear.style.borderColor = "#000000";
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
    var shots = slidesOf(d);
    if (shots.length) {
      r.expPhoto.className = "exp__photo";
      var html = "";
      for (var s2 = 0; s2 < shots.length; s2++) {
        if (shots[s2] instanceof Array) {
          /* a split slide: two, three or four photographs at once, each
             asked to carry a fraction of the enlargement a full-bleed
             one would need */
          var g = shots[s2], n = Math.min(g.length, 4);
          html += '<div class="exp__split exp__split--' + n + '">';
          for (var c = 0; c < n; c++) {
            html += '<div class="exp__cell"><img src="' + srcFor(g[c]) +
                    '" alt="" style="object-position:' +
                    focusOf(d, s2, c) + '"></div>';
          }
          html += '</div>';
        } else if (isVideo(shots[s2])) {
          /* muted in the markup on purpose: a browser refuses to
             autoplay anything audible until someone has interacted with
             the page, and a silent lobby loop that plays beats an
             audible one that never starts. APP unmutes on the first
             real gesture, and the exported MP4 carries the audio
             whatever the browser decided here. */
          html += '<video src="' + srcFor(shots[s2]) + '" ' +
                  'poster="' + stillFor(shots[s2]) + '" ' +
                  'muted playsinline preload="auto"></video>';
        } else {
          html += '<img src="' + srcFor(shots[s2]) + '" alt="" ' +
                  'style="object-position:' + focusOf(d, s2) + '">';
        }
      }
      r.expPhoto.innerHTML = html;

      var vids = r.expPhoto.getElementsByTagName("video");
      for (var v2 = 0; v2 < vids.length; v2++) {
        vids[v2].muted = !soundOn;
        /* these elements are brand new, so their metadata arrives after
           this frame has already been drawn — and a paused piece draws
           only once per seek. without this the clip would sit on frame
           zero until something else happened to force a redraw. */
        (function (v) {
          v.addEventListener("loadedmetadata", function () {
            driveVideo(v, lastCt - HOLD_AT, lastPlaying);
          }, { once: true });
        })(vids[v2]);
      }
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

  /* `playing` only reaches the video clips, and only to choose between
     letting one run on its own clock and seeking it exactly. every
     other value below still comes from t alone. */
  function render(t, playing) {
    if (!built) return;

    var i = Math.floor(t / CYCLE);
    if (i >= data.length) i = data.length - 1;
    var ct = t - i * CYCLE;                     /* time inside this date */

    lastCt = ct;
    lastPlaying = !!playing;

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
      n.dot.style.background   = (j < i) ? n.accent : PAPER;
      n.dot.style.opacity      = A.round(1 - m, 3);
      n.dot.style.transform    = "scale(" + A.round(A.lerp(1, 0.62, m), 4) + ")";
      n.square.style.background = n.accent;
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

    /* 1 + 2. it blooms out of the marker as the crest's lozenge — the
       flat horizontal diamond from the badge, hatched the same way —
       and that silhouette then fills out into the card.

       this is a real morph of the outline, not a rotated square: an
       8-point polygon whose shoulders slide from the mid-points out to
       the corners. k=0 is the diamond, k=50 is exactly the border box,
       and it keeps going to 72 so the clip retreats past the edges and
       lets the 26px corner radius appear on its own. stopping at 50
       would hold sharp corners and then pop them round. */
    var bloom = A.easeOutQuint(A.seg(ct, tSpin, SPIN));
    var fill  = A.easeInOutQuint(widen);

    var k = A.lerp(0, 72, fill);
    var poly = shoulders(k).map(function (p) {
      return A.round(p[0],2) + "% " + A.round(p[1],2) + "%"; });
    r.exp.style.clipPath = fill >= 1 ? "none" : "polygon(" + poly.join(", ") + ")";

    /* the outline is drawn in SVG, not as a border. a css border belongs
       to the rectangle and the clip takes it away along every diagonal;
       a polygon stroke follows the lozenge's own edges. the two swap
       over the last stretch, where both shapes are the same rectangle
       and the handover is invisible. */
    /* the clip runs past 50 so it can retreat off the edges, but the
       outline must STOP there. beyond 50 the shoulders sit outside the
       box, and a clip simply ignores them while a stroke draws them —
       as four diagonals poking out of the corners. */
    /* no viewBox: with none, the svg's user space is 1:1 with its css
       size, which is already the stage's own units. so stroke-width 14
       is 14 stage px and scales exactly like the card's border. */
    var frameH = A.lerp(DIAMOND_H, BOX_H, fill);
    r.frame.setAttribute("points", shoulders(Math.min(k, 50), BOX_W, frameH, 7)
      .map(function (p) { return A.round(p[0],1) + "," + A.round(p[1],1); }).join(" "));
    var handover = A.clamp((k - 50) / 22);
    r.frame.style.opacity = A.round(1 - handover, 3);
    r.exp.style.borderColor = "rgba(0,0,0," + A.round(handover, 3) + ")";

    /* blooms in the date's colour — the same colour as the ring it grew
       out of — and cools to cream as it becomes the card */
    r.exp.style.backgroundColor = A.mix(accentFor(i), PANEL, A.easeOutCubic(fill));

    r.wrap.style.height = A.round(frameH, 1) + "px";
    r.wrap.style.width  = BOX_W + "px";

    /* 8. at the end the whole card leaves upward, off the top.
       75-75 in After Effects terms: heavy ease at both ends. */
    var exitE = A.easeInOutQuint(exit);
    var exitY = -exitE * (r.root.clientHeight / 2 + BOX_H / 2 + 80);

    r.wrap.style.opacity = A.round(A.clamp(A.seg(ct, tSpin, 0.10) * 2), 3);
    r.exp.style.opacity = 1;
    r.wrap.style.transform =
      "translate(-50%, -50%) translateY(" + A.round(exitY, 1) + "px)" +
      " scale(" + A.round(A.lerp(SQUARE / BOX_W, 1, bloom), 4) + ")";

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
    var shots = r.expPhoto.children;
    if (shots.length) {
      var settle = A.lerp(1.06, 1, A.easeOutQuint(A.seg(ct, tWiden + 0.45, 0.80)));
      var drift = A.lerp(1, DRIFT, A.ease(ct, tHold + 0.9, HOLD - 0.9, A.linear));
      var zoom = "scale(" + A.round(settle * drift, 4) + ")";

      /* several shots on one date cross-fade across the hold */
      var slot = (HOLD - 1.2) / shots.length;
      for (var k = 0; k < shots.length; k++) {
        var el = shots[k];
        var o = 1;
        if (shots.length > 1) {
          var from = tHold + 0.9 + k * slot;
          o = (k === 0) ? 1 : A.ease(ct, from, 0.9, A.easeInOutCubic);
        }
        el.style.opacity = A.round(o, 3);

        if (el.tagName === "VIDEO") {
          /* no settle, no drift: both are a scale, and a scale on a
             contained clip crops away exactly what the black bars are
             there to protect. the clip's own motion is the motion. */
          driveVideo(el, ct - tHold, playing);
        } else if (el.tagName === "DIV") {
          /* a split slide: the drift belongs to each photograph inside
             its own cell. scaling the grid itself would pull the
             gutters apart and push the outer cells off the pane. */
          var cells = el.getElementsByTagName("img");
          for (var c2 = 0; c2 < cells.length; c2++) cells[c2].style.transform = zoom;
        } else {
          el.style.transform = zoom;
        }
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

    /* clips carry their own fade in and out, baked into the file, so
       there is no volume to ramp here — only whether the track is
       audible at all. Browsers refuse to autoplay audible media before
       someone has interacted with the page, so this starts off and APP
       turns it on at the first real gesture. The exported MP4 carries
       the audio regardless of what the browser allowed on screen. */
    sound: function (on) {
      soundOn = (on !== false);
      unmuteAll();
      return soundOn;
    },
    get soundOn() { return soundOn; },

    /* the start of every date's cycle, in scene-local seconds. the
       viewer jumps between these, not between animation beats — a
       10-minute piece is not reviewable one frame at a time. */
    get dateStarts() {
      var out = [];
      for (var i = 0; i < data.length; i++) out.push(i * CYCLE);
      return out;
    },

    /* ---- authoring aid: the focus tool -------------------------
       Fifty photographs are not findable by guess-and-reload, and a
       crop is not judgeable from a full-frame thumbnail — you have to
       see the frame. WASD nudges the photo that is actually on screen
       right now, writes it straight onto that <img>, and prints the
       value; focusDump() hands back the whole set to paste into the
       JSON. It edits the loaded data only — nothing is persisted, so
       the render stays a pure function of time.               */

    /* which slide the eye is on: the most opaque one. reading the DOM
       beats re-deriving the slot maths and cannot drift away from what
       render() actually did. */
    visibleSlide: function () {
      if (shownIndex < 0) return -1;
      var els = r.expPhoto.children;
      var best = -1, top = -1;
      for (var i = 0; i < els.length; i++) {
        var o = parseFloat(els[i].style.opacity);
        if (isNaN(o)) o = 1;
        if (o >= top) { top = o; best = i; }
      }
      return best;
    },

    /* on a split slide every cell is on screen at once, so the tool has
       to be told which one. clicking a cell picks it; the pick is drawn
       as an outline that never survives into a captured frame. */
    selectCell: function (el) {
      var prev = r.expPhoto.querySelectorAll("[data-sel]");
      for (var i = 0; i < prev.length; i++) prev[i].removeAttribute("data-sel");
      if (!el) { selCell = 0; return null; }
      el.setAttribute("data-sel", "");
      var cells = el.parentNode.children;
      for (var j = 0; j < cells.length; j++) if (cells[j] === el) selCell = j;
      return SCENE_TIMELINE.currentFocus();
    },

    nudgeFocus: function (dx, dy) {
      if (shownIndex < 0) return null;
      var d = data[shownIndex];
      var slides = slidesOf(d);
      if (!slides.length) return null;

      var k = SCENE_TIMELINE.visibleSlide();
      if (k < 0) k = 0;
      var group = slides[k] instanceof Array ? slides[k] : null;
      var c = group ? Math.min(selCell, group.length - 1) : -1;

      /* normalise to one value per photograph, so a nudge on the third
         cell of a four-up cannot silently move the other three */
      var focus = [];
      for (var i = 0; i < slides.length; i++) {
        if (slides[i] instanceof Array) {
          var g = [];
          for (var j = 0; j < slides[i].length; j++) g.push(focusOf(d, i, j));
          focus.push(g);
        } else {
          focus.push(focusOf(d, i));
        }
      }

      var cur = (group ? focus[k][c] : focus[k]).split(" ");
      var x = A.clamp(parseFloat(cur[0]) + dx, 0, 100);
      var y = A.clamp(parseFloat(cur[1]) + dy, 0, 100);
      var val = Math.round(x) + "% " + Math.round(y) + "%";
      if (group) focus[k][c] = val; else focus[k] = val;
      d.focus = slides.length === 1 && !group ? focus[0] : focus;

      /* write it to the element rather than rebuilding the card: a
         rebuild restarts the cross-fade and you lose the frame you
         were judging. */
      var slideEl = r.expPhoto.children[k];
      if (slideEl) {
        var img = group ? slideEl.getElementsByTagName("img")[c]
                        : (slideEl.tagName === "IMG" ? slideEl : null);
        if (img) img.style.objectPosition = val;
      }

      /* the small card on the rail shows the first photograph, so it has
         to follow along or the two disagree while you are working */
      if (k === 0 && (!group || c === 0) &&
          nodes[shownIndex] && nodes[shownIndex].photo) {
        nodes[shownIndex].photo.style.objectPosition = val;
      }

      return { year: d.year, photo: group ? group[c] : slides[k],
               k: k + 1, of: slides.length,
               cell: group ? c + 1 : 0, cells: group ? group.length : 0,
               focus: val };
    },

    currentFocus: function () {
      if (shownIndex < 0) return null;
      var d = data[shownIndex];
      var slides = slidesOf(d);
      if (!slides.length) return { year: d.year, photo: null, focus: null };
      var k = Math.max(SCENE_TIMELINE.visibleSlide(), 0);
      var group = slides[k] instanceof Array ? slides[k] : null;
      var c = group ? Math.min(selCell, group.length - 1) : -1;
      return { year: d.year, photo: group ? group[c] : slides[k],
               k: k + 1, of: slides.length,
               cell: group ? c + 1 : 0, cells: group ? group.length : 0,
               focus: group ? focusOf(d, k, c) : focusOf(d, k) };
    },

    /* every focus value in the piece, shaped the way the JSON wants it —
       one string per single slide, one array per split */
    focusDump: function () {
      var out = [];
      for (var i = 0; i < data.length; i++) {
        var d = data[i];
        var slides = slidesOf(d);
        if (!slides.length) continue;
        var f = [];
        for (var j = 0; j < slides.length; j++) {
          if (slides[j] instanceof Array) {
            var g = [];
            for (var c = 0; c < slides[j].length; c++) g.push(focusOf(d, j, c));
            f.push(g);
          } else {
            f.push(focusOf(d, j));
          }
        }
        var single = slides.length === 1 && !(slides[0] instanceof Array);
        out.push({ id: d.id, year: d.year, focus: single ? f[0] : f });
      }
      return JSON.stringify(out, null, 1);
    },
    CYCLE: CYCLE
  };
})();
