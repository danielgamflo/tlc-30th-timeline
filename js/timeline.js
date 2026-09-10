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
       SPIN     the diamond blooms out of the marker, then turns 45deg
                to the left and lands as a SQUARE
       WIDEN    the square stretches sideways into the rectangle
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

  /* HOLD is no longer the hold — computeHolds gives every date its own,
     out of what that date has to say. It survives as the fallback for an
     index with no computed hold, and as the shape of a typical cycle.
     Nothing anywhere assumes a date count: adding or dropping one is a
     line of JSON and the piece gets longer or shorter by itself. */
  var CYCLE = APPEAR + SPIN + WIDEN + HOLD + EXIT + ADVANCE;

  /* Everything but the hold is the same on every date — the card takes
     the same time to arrive and to leave whatever it carries. */
  var FIXED = APPEAR + SPIN + WIDEN + EXIT + ADVANCE;

  /* Each date holds for as long as its own content needs, and the running
     time is whatever those forty add up to.

     It used to be the other way round: HOLD was an average, the total was
     fixed at ten minutes, and long cards borrowed from short ones. That
     shared the shortage out fairly but it could not remove it — the copy
     wanted about 1.6x the hold that existed, so on most dates the reader
     ran out of time. Parker watched it and said so.

     So the budget is gone. A date's hold is the time to read its words
     plus a beat to look at each of its slides plus LEAD, which is the
     moment the eye spends arriving and finding the start of the line.

     Change the running time by changing what a reader is assumed to need,
     not by squeezing everyone equally:
       WPM    reading speed. 200 is comfortable silent reading.
       SLIDE  seconds a photograph wants, over and above the words.
       LEAD   the beat before reading starts.
     FLOOR and CEIL only stop the extremes — without a floor the shortest
     card drops under five seconds and reads as a stumble. */
  var WPM   = 200;
  var SLIDE = 2.0;
  var LEAD  = 0.8;
  var FLOOR = 8.0;
  var CEIL  = 34.0;

  var holds = [], starts = [], span = 0;

  var BOX_W = 1500;       /* final width                                 */
  var BOX_H = 880;        /* final height                                */
  /* how much of SPIN the diamond takes to arrive; the rest is the turn.
     three readable beats inside one phase, so the running time does not
     move: the diamond appears, it turns, then it stretches.          */
  var TURN_AT = 0.42;

  /* the flat diamond it starts as — the crest's lozenge, 2.5:1.
     Wider than the 880 square it turns into, so the shape narrows
     through the turn and opens out again in the stretch. Push LOZ_W
     past 1200 and that pinch becomes the loudest thing in the move. */
  var LOZ_W = 1200;
  var LOZ_H = 480;

  /* the turn's curve. Quint — the 90-90 the stretch uses — is far too
     steep for 45 degrees in half a second: it holds still for two tenths,
     puts 30 of the 45 degrees into the next tenth, and reads as a snap
     rather than a turn. Cubic, the 75-75, spreads it 1.5 / 10.5 / 22 /
     9.6 / 1.2 and still settles hard at both ends. One word to change. */
  var TURN_EASE = A.easeInOutCubic;

  /* how far past the border box the clip retreats at the very end, so
     the 26px corner radius appears rather than popping round          */
  var RETREAT = 44;

  /* must equal --stroke-lg in the stylesheet. the polygon is inset by
     half of it, because an svg stroke straddles its path while a css
     border sits wholly inside. */
  var STROKE_LG = 3;

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
  var INK   = "#27231c";   /* must match --ink */

  /* the brand's five. colour lives in the accents now, never under the
     body copy: one date owns one colour, and its ring on the rail, its
     year pill, its card band and its stat rule are all that colour.
     mustard leads so the logo's seed hands straight to the first ring.
     The sage came out in review — three now, not four, so the rotation
     lands on a different colour for most dates than it used to. */
  var ACCENTS = ["#CB9216", "#BB6024", "#666737"];

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
    r.expYearWrap = root.querySelector("#exp-yearwrap");
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
    computeHolds();
    buildStrip();
  }

  /* the hold each date gets, and where each one starts. run once. */
  function computeHolds() {
    holds = [];
    for (var i = 0; i < data.length; i++) {
      var d = data[i];
      var words = (d.paragraph || "").split(/\s+/).filter(Boolean).length;
      var slides = slidesOf(d).length;
      var want = LEAD + words / WPM * 60 + slides * SLIDE;
      holds.push(A.clamp(want, FLOOR, CEIL));
    }

    starts = []; span = 0;
    for (i = 0; i < data.length; i++) {
      starts.push(span);
      span += FIXED + holds[i];
    }
  }

  function holdAt(i) { return holds[i] !== undefined ? holds[i] : HOLD; }

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
      /* charcoal on every ground, per review — no longer measured and
         chosen. Worth knowing what that costs: charcoal reads 5.70:1 on
         the mustard and 3.58:1 on the orange, both fine for text this
         size and weight, but only 2.65:1 on the olive, under the 3:1
         floor. Lightening the olive to #91924E — same hue, same
         saturation — would take it to 4.78:1. */
      short.style.color = INK;
      var shortText = document.createElement("span");
      shortText.className = "card__short__t";
      shortText.textContent = d.short;
      short.appendChild(shortText);

      box.appendChild(photo);
      box.appendChild(short);
      /* the shadow rides on a wrapper, not on the box: the box is
         scaled as it grows in, and a transformed element cannot have
         anything painted behind its own background. */
      var boxWrap = document.createElement("div");
      boxWrap.className = "card__boxwrap";
      boxWrap.appendChild(box);

      card.appendChild(dateEl);
      card.appendChild(boxWrap);
      /* stem first so the ring paints over it — the line runs behind
         the marker, it does not cross it */
      node.appendChild(stem);
      node.appendChild(marker);
      node.appendChild(card);
      r.strip.appendChild(node);

      nodes.push({ el: node, dot: dot, square: square, stem: stem, card: card,
                   box: boxWrap, short: shortText, date: dateEl, year: yearEl,
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

  /* ---- the card's outline ------------------------------------
     Four points, numbered the way the shape is read:

         1 up      2 right      3 bottom      4 left

     At phi = 0 that is the diamond. Turning it 45 degrees to the LEFT
     carries 1 to the top-left corner, 2 to the top-right, 3 to the
     bottom-right and 4 to the bottom-left — so it lands as a square,
     and the stretch that follows is exactly what it looks like: 1 and 4
     travel left while 2 and 3 travel right.

     The radius grows as it turns —

         R = halfHeight / cos(phi)

     — which keeps the shape inscribed in one unchanging h-by-h box the
     whole way round. It begins as the diamond touching all four sides
     of that box and ends AS the box, so the silhouette is never taller
     than the card's own final height and nothing can reach the running
     bars mid-turn. A plain rotation would swell to h * sqrt(2) at 45
     degrees, which at this size overruns the frame.

     `inset` pulls the ring in by half the stroke, so the outline's
     OUTER edge lands where the card's border does — an svg stroke
     straddles its path, a css border sits wholly inside. `out` pushes
     the points back off the edges at the very end, so the clip retreats
     and lets the corner radius appear on its own.                 */
  /* the two half-axes at turn progress u: vertical for points 1 and 3,
     horizontal for 2 and 4. At u = 0 they are the crest's flat lozenge —
     wide and squat, 1 and 3 pulled in toward the centre, 2 and 4 pushed
     out to the sides. At u = 1 both reach the square's centre-to-corner
     distance, and equal axes are what make it a square. */
  function axes(u, inset) {
    var a0 = LOZ_H / 2 - inset;                      /* lozenge, vertical   */
    var b0 = LOZ_W / 2 - inset;                      /* lozenge, horizontal */
    var hh = BOX_H / 2 - inset;
    var r1 = hh * Math.SQRT2;                        /* square, to a corner */

    /* The vertical axis is capped at hh / cos(phi), which is the envelope
       that keeps the shape inscribed in the box — at phi = 45 it equals
       r1 exactly, so the cap costs nothing at either end.

       Without it the silhouette overshoots. The two axes interpolate
       linearly while the trigonometry does not, so the height climbs past
       its own final value around four fifths of the way through the turn
       — measured, it peaked at 880.4 and settled back to 873, which put
       the stroke a few px outside the card it belongs to for about a
       tenth of a second. */
    var a = Math.min(A.lerp(a0, r1, u), hh / Math.cos(u * Math.PI / 4));
    return [a, A.lerp(b0, r1, u)];
  }

  function facets(u, stretch, w, h, inset, out) {
    inset = inset || 0; out = out || 0;
    var phi = u * Math.PI / 4;
    var ab = axes(u, inset), a = ab[0], b = ab[1];
    var cx = w / 2, cy = h / 2;
    var dx = stretch * ((w - inset * 2) - (h - inset * 2)) / 2;

    var s = Math.sin(phi), c = Math.cos(phi);
    /* the four directions, turned counter-clockwise by phi */
    var p     = [[-s, -c], [c, -s], [s, c], [-c, s]];
    var rad   = [a, b, a, b];            /* 1 and 3 short, 2 and 4 long */
    var shift = [-1, 1, 1, -1];          /* 1 and 4 left, 2 and 3 right */

    return p.map(function (v, i) {
      var x = v[0] * rad[i] + shift[i] * dx;
      var y = v[1] * rad[i];
      /* push each point further out along its own quadrant */
      if (out) {
        x += (x < 0 ? -out : out);
        y += (y < 0 ? -out : out);
      }
      return [cx + x, cy + y];
    });
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

  /* the foot of the panel can carry more than one note. Give a date
         "facts": [{tag, stat, source}, {tag, stat, source}]
     and they rotate across the hold the way the photographs do. The
     single tag/stat/source is the one-note shorthand and is untouched,
     which is what all but one of the forty dates still use. */
  function factsOf(d) {
    if (d.facts && d.facts.length) return d.facts;
    return d.stat ? [{ tag: d.tag, stat: d.stat, source: d.source }] : [];
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
    return A.asset((isVideo(name) ? "assets/video/" : "assets/photos/") + name);
  }

  /* every clip ships a still of itself beside it, same name, .jpg. The
     small card on the rail is 200px wide and there are forty of them —
     it gets the still, not a second video element. */
  function stillFor(name) {
    return A.asset(isVideo(name)
      ? "assets/video/" + name.replace(/\.[^.]+$/, ".jpg")
      : "assets/photos/" + name);
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

  /* Copy carries three things the doc has and plain text cannot.
     Everything is escaped first, so the markup below is the only markup
     that can ever reach the page.

       *like this*   italic. The doc italicises campaign and programme
                     names — "Reaching Forward in Faith" — and losing
                     that on the way to the screen loses the meaning.

       a line feed   a hard break. Twelve titles were asked to break at
                     a named word; where the break falls was being
                     decided by how wide the panel happened to be, which
                     is why the same request kept coming back. Now the
                     copy says where it goes.

       last two      bound with a non-breaking space, so nothing ends
       words         on a word sitting alone on its own line. A phrase
                     that must hold together mid-sentence — "Baton
                     Rouge", "worship services" — gets its own NB
                     written into the copy, because which words those
                     are is a judgement about the sentence, not a rule. */
  var NB = "\u00A0";

  function rich(s, allowBreaks) {
    var out = esc(s);
    out = out.replace(/\*([^*]+)\*/g, "<em>$1</em>");
    out = out.replace(/[ \t]+(\S+)[ \t]*$/, NB + "$1");
    out = allowBreaks ? out.replace(/\n/g, "<br>") : out.replace(/\n/g, " ");
    return out;
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
    r.expPanel.style.color = INK;
    r.expYear.style.background = accent;
    r.expYear.style.color = INK;
    r.expYear.style.borderColor = INK;
    r.expStat.style.borderLeftColor = accent;
    r.expLabelT.textContent = d.label || "";
    r.expYear.textContent  = d.year;
    /* the title is the one place a hard break is honoured — the copy
       names where it wants to turn */
    r.expTitle.innerHTML = rich(d.title, true);
    r.expPara.innerHTML  = rich(d.paragraph, false);

    var notes = factsOf(d);
    if (notes.length) {
      /* "" and not "block": a deck of several notes is display:grid, and
         an inline block here would quietly beat that rule */
      r.expStat.style.display = "";
      /* "tag" names what the line is — Key Stat, Fun Fact — and is
         optional: without it the footer behaves exactly as it did. */
      var nh = "";
      for (var n2 = 0; n2 < notes.length; n2++) {
        nh += '<div class="exp__fact">' +
              (notes[n2].tag ? "<i>" + esc(notes[n2].tag) + "</i>" : "") +
              "<b>" + rich(notes[n2].stat, false) + "</b>" +
              (notes[n2].source ? "<span>" + rich(notes[n2].source, false) + "</span>" : "") +
              "</div>";
      }
      r.expStat.innerHTML = nh;

      /* one note is simply in the flow and behaves exactly as before.
         Several become a deck — stacked in one grid cell by the CSS,
         which also gives the block the height of its tallest note. */
      r.expStat.className =
        notes.length > 1 ? "exp__stat exp__stat--deck" : "exp__stat";
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
    r.expYearWrap.style.transform = "none";
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

    /* the dates are no longer the same length, so the index is a lookup
       rather than a division */
    var i = 0;
    while (i + 1 < starts.length && t >= starts[i + 1]) i++;
    if (i >= data.length) i = data.length - 1;
    var ct = t - starts[i];                     /* time inside this date */
    var HOLD = holdAt(i);                       /* shadows the average */

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

    /* 1 + 2. THREE INSTANCES, in order:

         one   the diamond appears — four points, 1 up, 2 right,
               3 bottom, 4 left
         two   it turns 45 degrees to the LEFT and becomes a square
               whose side is the card's final height
         three the square stretches: points 1 and 4 travel left,
               points 2 and 3 travel right, and it is the rectangle

       Turning carries 1 to the top-left corner and 4 to the bottom-left,
       which is exactly why those two are the pair that goes left in the
       stretch — the numbering survives all three instances. */
    /* ONE — the diamond arrives, blooming out of the marker's ring in
       the date's own colour. */
    var bloom = A.easeOutQuint(A.seg(ct, tSpin, SPIN * TURN_AT));

    /* TWO — it turns 45 degrees to the left and lands as a square whose
       side is the card's final height. */
    var turn = TURN_EASE(
      A.seg(ct, tSpin + SPIN * TURN_AT, SPIN * (1 - TURN_AT)));

    /* THREE — the square stretches into the rectangle: points 1 and 4
       travel left, 2 and 3 travel right. `open` passes 1 at the border
       box and carries on so the clip can retreat off the edges and let
       the 26px corner radius appear on its own — stopping dead at the
       box would hold sharp corners and then pop them round in a frame. */
    var fill    = A.easeInOutQuint(widen);
    var open    = fill * 1.44;
    var stretch = Math.min(open, 1);
    var over    = A.clamp((open - 1) / 0.44);

    var poly = facets(turn, stretch, BOX_W, BOX_H, 0, over * RETREAT)
      .map(function (p) {
        return A.round(p[0],1) + "px " + A.round(p[1],1) + "px"; });
    r.exp.style.clipPath = fill >= 1 ? "none" : "polygon(" + poly.join(", ") + ")";

    /* the outline is drawn in SVG, not as a border. a css border belongs
       to the rectangle, so the clip takes it away along every diagonal
       while the diamond and the square are on screen; a polygon stroke
       follows the shape's own edges. the two swap over at the end, where
       both are the same rectangle and the handover is invisible.

       no viewBox: with none, the svg's user space is 1:1 with its css
       size, which is already the stage's own units. so stroke-width 7
       is 14 stage px and scales exactly like the card's border. */
    /* the outline never retreats — past the border box a clip simply
       ignores the points while a stroke would draw them, as four spurs
       poking out of the corners. It stops at the box and hands over. */
    r.frame.setAttribute("points", facets(turn, stretch, BOX_W, BOX_H, STROKE_LG / 2, 0)
      .map(function (p) { return A.round(p[0],1) + "," + A.round(p[1],1); }).join(" "));
    r.frame.style.opacity = A.round(1 - over, 3);
    r.exp.style.borderColor = "rgba(39,35,28," + A.round(over, 3) + ")";

    /* blooms in the date's colour — the same colour as the ring it grew
       out of — and cools to cream as it becomes the card */
    r.exp.style.backgroundColor = A.mix(accentFor(i), PANEL, A.easeOutCubic(fill));

    /* the wrap no longer resizes: the shape is inscribed in the card's
       own box the whole way through, so the box can simply be the box */
    r.wrap.style.height = BOX_H + "px";
    r.wrap.style.width  = BOX_W + "px";

    /* 8. at the end the whole card leaves upward, off the top.
       75-75 in After Effects terms: heavy ease at both ends. */
    var exitE = A.easeInOutQuint(exit);
    var exitY = -exitE * (r.root.clientHeight / 2 + BOX_H / 2 + 80);

    r.wrap.style.opacity = A.round(A.clamp(A.seg(ct, tSpin, 0.10) * 2), 3);
    r.exp.style.opacity = 1;
    r.wrap.style.transform =
      "translate(-50%, -50%) translateY(" + A.round(exitY, 1) + "px)" +
      " scale(" + A.round(A.lerp(SQUARE / LOZ_H, 1, bloom), 4) + ")";

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
    r.expYearWrap.style.transform =
      "translateX(" + A.round(A.lerp(yearTravel, 0, yTrav), 1) + "px)";
    r.expYearWrap.style.opacity = yTrav >= 0.5 ? 1 : 0;

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

    /* several notes at the foot cross-fade across the hold, on the same
       clock as the photographs above them. The first is simply there;
       each of the rest arrives over the one before and stays. */
    var notes = r.expStat.children;
    if (notes.length > 1) {
      var nslot = (HOLD - 1.2) / notes.length;
      for (var n4 = 0; n4 < notes.length; n4++) {
        notes[n4].style.opacity = (n4 === 0) ? 1 :
          A.round(A.ease(ct, tHold + 0.9 + n4 * nslot, 0.9, A.easeInOutCubic), 3);
      }
    }

    /* long paragraphs creep upward across the hold */
    var creep = 0;
    if (overflowPx > 0) {
      var pc = A.seg(ct, tHold + 2.6, HOLD - 3.6);   /* settle, read, settle */
      /* linear, per review: an eased rise reads as the text hesitating
         at both ends. constant speed reads as a scroll. the softness now
         comes from the window's fade, not from the curve. */
      creep = -overflowPx * pc;
    }
    r.expInner.style.transform = "translateY(" + A.round(creep, 2) + "px)";
  }

  return {
    name: "timeline",
    selector: "#scene-timeline",
    get duration() { return span; },
    get markers() {
      var m = [];
      for (var i = 0; i < data.length; i++) {
        var s0 = starts[i];
        m.push(A.round(s0, 3));                                  /* card born  */
        m.push(A.round(s0 + APPEAR, 3));                         /* box spins  */
        m.push(A.round(s0 + APPEAR + SPIN, 3));                  /* widens     */
        m.push(A.round(s0 + APPEAR + SPIN + WIDEN + holdAt(i), 3)); /* exits   */
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
      for (var i = 0; i < data.length; i++) out.push(starts[i]);
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
    CYCLE: CYCLE,
    get holds() { return holds.slice(); }
  };
})();
