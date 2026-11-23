/* ============================================================
   main.js — clock, scenes, controls
   ------------------------------------------------------------
   three ways to drive the exact same render(t):
     step     arrow keys, beat by beat        (designing / review)
     play     real-time clock                 (timing / kiosk)
     capture  window.__anim.seekFrame(n)      (headless -> MP4)
   ============================================================ */

var APP = (function () {

  /* 30 on screen. The LED lobby wall wanted 24, and seek() snaps t onto
     this grid — ask for 24ths against a 30ths grid and two consecutive
     frames land on the same instant, which reads as judder. So the rate
     is the export's to choose, by url, and nothing else changes: every
     scene is a function of t, not of frame number. */
  var FPS = (function () {
    var m = /[?&]fps=(\d+)/.exec(window.location.search);
    var n = m ? parseInt(m[1], 10) : 30;
    return (n >= 1 && n <= 120) ? n : 30;
  })();
  var FORMATS = {
    "1024": [1024, 1024],   /* the LED lobby wall: 8 tiles of 128mm */
    "1080": [1080, 1080],
    "1680": [1680, 1050],   /* Santiago's screen — 16:10, not 16:9 */
    "1920": [1920, 1080],
    "5760": [5760, 1080]
  };

  var SCENES = [SCENE_LOGO, SCENE_TIMELINE, SCENE_OUTRO];

  var stage, hud, hudMode, hudTime, hudScene, hudFmt, hudFocus;
  var t = 0, clock = 0;
  var playing = false, lastNow = 0, format = "1920", captureMode = false;
  var total = 0, markers = [];

  /* ---------------------------------------------------------- */

  function build() {
    stage    = document.getElementById("stage");

    /* the crest is artwork, not text: Santiago ships its own file */
    if (A.lang === "es") {
      document.documentElement.lang = "es";
      var mark = document.getElementById("logo-mark");
      if (mark) mark.src = A.asset("assets/logo/30anos-santiago.png");
    }

    hud      = document.getElementById("hud");
    hudMode  = document.getElementById("hud-mode");
    hudTime  = document.getElementById("hud-time");
    hudScene = document.getElementById("hud-scene");
    hudFmt   = document.getElementById("hud-fmt");
    hudFocus = document.getElementById("hud-focus");

    for (var i = 0; i < SCENES.length; i++) {
      var s = SCENES[i];

      /* a scene may be built from a copy of another one's markup */
      if (s.cloneFrom && !stage.querySelector(s.selector)) {
        var copy = stage.querySelector(s.cloneFrom).cloneNode(true);
        copy.id = s.selector.replace("#", "");
        var tagged = copy.querySelectorAll("[id]");
        for (var k = 0; k < tagged.length; k++) tagged[k].removeAttribute("id");
        stage.appendChild(copy);
      }

      s.el = stage.querySelector(s.selector);
      s.init(s.el);
    }
    TICKER.build(stage);
  }

  /* scene durations depend on the data, so this runs after it loads */
  function computeTiming() {
    total = 0;
    markers = [];
    for (var i = 0; i < SCENES.length; i++) {
      var s = SCENES[i];
      s.start = total;
      var sm = s.markers;
      for (var j = 0; j < sm.length; j++) {
        markers.push(toFrame(s.start + sm[j]));
      }
      total += s.duration;
    }
    markers.push(toFrame(total) - 1);

    /* markers are whole frames, never seconds. a marker at 65.85s
       quantises to frame 1975 = 65.8333s, which is BELOW itself —
       compare those as floats and the step lands on the same marker
       forever. integers make the comparison exact. */
    markers.sort(function (a, b) { return a - b; });
    markers = markers.filter(function (v, k, arr) { return k === 0 || v !== arr[k - 1]; });
  }

  function toFrame(seconds) { return Math.round(seconds * FPS); }
  function currentFrame() { return Math.round(t * FPS); }

  /* ---- frame ------------------------------------------------ */

  function draw() {
    for (var i = 0; i < SCENES.length; i++) {
      var s = SCENES[i];
      var local = t - s.start;
      var visible = local >= 0 && local < s.duration;
      s.el.style.display = visible ? "block" : "none";
      /* `playing` is for video clips only: running one on its own clock
         beats seeking it 30 times a second, but a paused piece — a step,
         a scrub, the headless capture — must seek exactly. */
      if (visible) s.render(local, playing && !captureMode);
    }
    TICKER.render(t, total);   /* the bars run on absolute time, not scene time */
    paintHud();
  }

  /* two clocks, on purpose.
       clock = real elapsed time, never rounded
       t     = clock snapped to the 30fps grid, what render() sees
     accumulating onto t instead would lose the remainder every tick:
     on a 120Hz display each frame adds 8.3ms, under half a 30fps
     frame, so it rounds back and time never moves. on 60Hz the same
     bug runs the piece at double speed. */
  function seek(v) {
    var maxT = total - 1 / FPS;
    /* clock may reach `total` — that is what lets the loop wrap.
       clamping it to maxT would pin it just short forever. only the
       render time stops at the last real frame. */
    clock = A.clamp(v, 0, total);
    t = Math.min(Math.round(clock * FPS) / FPS, maxT);
    draw();
  }

  function seekFrame(f) { seek(f / FPS); }

  function currentScene() {
    for (var i = SCENES.length - 1; i >= 0; i--) {
      if (t >= SCENES[i].start) return SCENES[i];
    }
    return SCENES[0];
  }

  /* ---- transport -------------------------------------------- */

  function play() {
    if (playing) return;
    playing = true;
    lastNow = performance.now();
    if (onPlayStateChange) onPlayStateChange();
    requestAnimationFrame(tick);
  }

  var onPlayStateChange = null;
  function pause() { playing = false; paintHud(); if (onPlayStateChange) onPlayStateChange(); }
  function toggle() { playing ? pause() : play(); }

  var fpsAcc = 0, fpsCount = 0, fpsShown = 0;

  function tick(now) {
    if (!playing) return;
    var dt = (now - lastNow) / 1000;
    lastNow = now;

    /* measured over ~half a second so the readout is steady */
    if (dt > 0) { fpsAcc += dt; fpsCount++; }
    if (fpsAcc >= 0.5) { fpsShown = fpsCount / fpsAcc; fpsAcc = 0; fpsCount = 0; }

    var next = clock + dt;                /* accumulate on the real clock */
    if (next >= total) next = 0;          /* loop */
    seek(next);
    requestAnimationFrame(tick);
  }

  /* jump whole dates, not animation beats. lands a hair after the
     card has settled so you see it finished rather than mid-move. */
  function jumpDate(dir) {
    var base = SCENE_TIMELINE.start;
    var settled = 0.55 + 0.85 + 0.45 + 2.6;    /* APPEAR+SPIN+WIDEN+contents */
    var stops = SCENE_TIMELINE.dateStarts.map(function (s) {
      return toFrame(base + s + settled);
    });
    var f = currentFrame(), i;
    if (dir > 0) {
      for (i = 0; i < stops.length; i++) if (stops[i] > f + 2) return seekFrame(stops[i]);
      return seekFrame(stops[0]);
    }
    for (i = stops.length - 1; i >= 0; i--) if (stops[i] < f - 2) return seekFrame(stops[i]);
    return seekFrame(stops[stops.length - 1]);
  }

  function nextMarker() {
    var f = currentFrame();
    for (var i = 0; i < markers.length; i++) {
      if (markers[i] > f) { pause(); seekFrame(markers[i]); return; }
    }
    pause(); seekFrame(0);           /* past the last one, wrap around */
  }

  function prevMarker() {
    var f = currentFrame();
    for (var i = markers.length - 1; i >= 0; i--) {
      if (markers[i] < f) { pause(); seekFrame(markers[i]); return; }
    }
    pause(); seekFrame(0);
  }

  /* ---- layout ----------------------------------------------- */

  function setFormat(key) {
    if (!FORMATS[key]) return;
    format = key;
    var d = FORMATS[key];
    stage.style.width  = d[0] + "px";
    stage.style.height = d[1] + "px";
    stage.dataset.format = key;
    /* Layout belongs to the SHAPE, not to a resolution. Keyed this way,
       1024 and 1080 share one set of square rules and the format stays
       free to carry tuning that is really about pixels. */
    stage.dataset.shape = d[0] === d[1] ? "square" : "wide";
    SCENE_TIMELINE.invalidate();   /* cached sizes belong to the old format */
    if (stage.querySelector(".ticker__unit")) TICKER.build(stage);
    fit();
    draw();
  }

  /* ---- distance simulation ----------------------------------
     shrink the preview until it subtends the same angle a real
     screen would from N screen-heights away, so you can judge
     legibility from where you actually sit.
     assumes ~60cm to a ~43px/cm display; nudge EYE_PX if yours
     differs. N=4 close, 6 mid-room, 8 back row.
     ------------------------------------------------------------ */
  var EYE_PX = 2580;
  var simN = 0;                 /* 0 = fit to window */

  function fit() {
    var d = FORMATS[format];
    if (captureMode) { stage.style.transform = "scale(1)"; return; }

    var room = Math.min(window.innerWidth / d[0], (window.innerHeight - 70) / d[1]);
    var s = room;
    if (simN > 0) s = Math.min(EYE_PX / (d[1] * simN), room);
    s = Math.min(s, 1);
    stage.style.transform = "scale(" + s + ")";
  }

  function setSim(n) { simN = n; fit(); paintHud(); }

  /* ---- hud --------------------------------------------------- */

  function paintHud() {
    if (captureMode) return;
    hudMode.textContent  = playing
      ? "PLAYING " + (fpsShown ? fpsShown.toFixed(0) + "fps" : "")
      : "PAUSED";
    hudMode.style.color = (playing && fpsShown && fpsShown < 20) ? "#E06B4A" : "";
    hudTime.textContent  = t.toFixed(2) + "s / " + total.toFixed(2) + "s";
    hudScene.textContent = currentScene().name;
    hudFmt.textContent   = FORMATS[format][0] + "×" + FORMATS[format][1]
                         + (simN ? "  ·  SIM " + simN + "H" : "");
  }

  /* ---- keys -------------------------------------------------- */

  function keys(e) {
    var k = e.key;
    if (k === " " || k === "Spacebar") { e.preventDefault(); toggle(); return; }

    if (k === "ArrowRight") {
      e.preventDefault(); pause();
      if (e.shiftKey)      seek(t + 0.1);
      else if (e.altKey)   seek(t + 1 / FPS);
      else                 nextMarker();
      return;
    }
    if (k === "ArrowLeft") {
      e.preventDefault(); pause();
      if (e.shiftKey)      seek(t - 0.1);
      else if (e.altKey)   seek(t - 1 / FPS);
      else                 prevMarker();
      return;
    }

    if (k === "ArrowDown") { e.preventDefault(); jumpDate(1);  return; }
    if (k === "ArrowUp")   { e.preventDefault(); jumpDate(-1); return; }

    if (k === "n" || k === "N") { NOTES.toggle(); return; }

    if (k === "r" || k === "R") { pause(); seek(0); return; }
    if (k === "h" || k === "H") { document.body.classList.toggle("hud-off"); return; }
    if (k === "f" || k === "F") {
      if (document.fullscreenElement) document.exitFullscreen();
      else document.documentElement.requestFullscreen();
      return;
    }
    /* 1 is the square we actually deliver — the LED lobby wall. The old
       1080 square stays in FORMATS for anyone who asks for it, but it is
       not the one you want under your thumb while working. */
    if (k === "1") { setFormat("1024"); return; }
    if (k === "2") { setFormat("1920"); return; }
    if (k === "3") { setFormat("5760"); return; }

    /* legibility check — see how it reads from N screen-heights back */
    if (k === "4") { setSim(4); return; }
    if (k === "6") { setSim(6); return; }
    if (k === "8") { setSim(8); return; }
    if (k === "0") { setSim(0); return; }

    /* ---- the focus tool ---------------------------------------
       WASD walks the crop of whichever photo is on screen. The frame
       is portrait and the archive is landscape, so ~40% of every shot
       is thrown away and centred is right only by luck. Shift steps by
       1 instead of 4, for the last bit. X copies the whole set. */
    var f = FOCUS_KEYS[k];
    if (f) {
      e.preventDefault(); pause();
      var step = e.shiftKey ? 1 : 4;
      var res  = SCENE_TIMELINE.nudgeFocus(f[0] * step, f[1] * step);
      showFocus(res);
      return;
    }

    /* G: whole picture, or filling its box. F is already fullscreen. */
    if (k === "g" || k === "G") {
      e.preventDefault(); pause();
      showFocus(SCENE_TIMELINE.toggleFit());
      seek(t);
      return;
    }

    /* , and . walk the cells of a collage without clicking — an
       extension's overlay on the photographs eats that click */
    if (k === "," || k === ".") {
      e.preventDefault(); pause();
      showFocus(SCENE_TIMELINE.cycleCell(k === "." ? 1 : -1));
      return;
    }

    /* Q and E bring the picture closer or let it back out. Panning alone
       cannot rescue a crop cut for the 1920's tall pane and shown in the
       square's wide one. The redraw is what puts the new scale on screen:
       the drift writes the transform, and it only writes it on a frame. */
    if (k === "q" || k === "Q" || k === "e" || k === "E") {
      e.preventDefault(); pause();
      var dz = (k === "e" || k === "E" ? 1 : -1) * (e.shiftKey ? 0.01 : 0.05);
      showFocus(SCENE_TIMELINE.nudgeFocus(0, 0, dz));
      seek(t);
      return;
    }
    /* X copies; shift-X writes a file instead, because forty dates of
       framing is more than anyone wants to paste into a chat window */
    if (k === "x" || k === "X") {
      if (e.shiftKey) saveFocus(); else copyFocus();
      return;
    }
  }

  var FOCUS_KEYS = {
    a: [-1, 0], A: [-1, 0], d: [1, 0],  D: [1, 0],
    w: [0, -1], W: [0, -1], s: [0, 1],  S: [0, 1]
  };

  function showFocus(res) {
    if (!hudFocus) return;
    if (!res || !res.photo) {
      hudFocus.textContent = res ? "no photo on this date" : "";
      return;
    }
    /* on a split slide, say which cell — otherwise the readout looks
       like it is describing the whole frame when it is not */
    var where = "slide " + res.k + "/" + res.of
              + (res.cells ? "  cell " + res.cell + "/" + res.cells : "");
    hudFocus.textContent = res.photo + "  " + where + "  " + res.focus;
  }

  function copyFocus() {
    var text = SCENE_TIMELINE.focusDump();
    if (navigator.clipboard) navigator.clipboard.writeText(text);
    if (hudFocus) hudFocus.textContent = "focus for every date copied";
    return text;
  }

  /* The same set, as a file in Downloads. The page cannot write into the
     project — and should not: the piece is a function of the JSON, and
     the JSON is edited deliberately, not by a keystroke behind your
     back. This just carries the numbers out of the browser. */
  function saveFocus() {
    var text = SCENE_TIMELINE.focusDump();
    var name = "focus-" + format + ".json";
    var url  = URL.createObjectURL(new Blob([text], { type: "application/json" }));
    var a    = document.createElement("a");
    a.href = url; a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
    /* the browser decides where it lands, and some refuse outright — so
       this says what was asked for, not that it happened */
    if (hudFocus) hudFocus.textContent = name + " → Downloads";
  }

  /* ---- boot -------------------------------------------------- */

  function start(rows) {
    build();
    SCENE_TIMELINE.setData(rows);
    computeTiming();
    /* "?format=1024" opens straight into the square. The wall is a whole
       working session of its own now, and pressing 1 after every reload
       is how you end up tuning the wrong format by mistake. */
    var asked = (/[?&]format=([A-Za-z0-9]+)/.exec(window.location.search) || [])[1];
    setFormat(FORMATS[asked] ? asked : "1920");
    seek(0);
    window.addEventListener("resize", fit);
    window.addEventListener("keydown", keys);

    /* A browser will not autoplay audible media before someone has
       interacted with the page, so clips start silent and the sound
       comes up at the first real gesture — never at load, which would
       simply fail and leave them muted for good. A lobby screen nobody
       touches therefore plays silent, which is the right default for a
       lobby; the exported MP4 carries the audio either way. */
    function wakeSound() {
      SCENE_TIMELINE.sound(true);
      window.removeEventListener("pointerdown", wakeSound, true);
      window.removeEventListener("keydown", wakeSound, true);
    }
    window.addEventListener("pointerdown", wakeSound, true);
    window.addEventListener("keydown", wakeSound, true);

    /* On a split slide every photograph is on screen at once, so WASD
       has to be told which one it is moving. Clicking a cell picks it. */
    document.getElementById("exp-photo").addEventListener("click", function (e) {
      var cell = e.target.closest && e.target.closest(".exp__cell");
      if (!cell) return;
      showFocus(SCENE_TIMELINE.selectCell(cell));
    });

    var playIcon = document.getElementById("btn-play-i");
    function paintPlay() { playIcon.innerHTML = playing ? "&#10073;&#10073;" : "&#9654;"; }
    onPlayStateChange = paintPlay;

    document.getElementById("btn-play").onclick  = function () { toggle(); paintPlay(); this.blur(); };
    document.getElementById("btn-stop").onclick  = function () { pause(); seek(0); paintPlay(); this.blur(); };
    document.getElementById("btn-again").onclick = function () { seek(0); play(); paintPlay(); this.blur(); };
    document.getElementById("btn-next").onclick   = function () { jumpDate(1);  this.blur(); };
    document.getElementById("btn-prev").onclick   = function () { jumpDate(-1); this.blur(); };
    NOTES.init(function () { pause(); paintPlay(); });

    /* presentation mode is the default: no HUD, and it runs on its own.
       add ?dev to the url to get the HUD and the paused start back —
       that is the working mode, this is the one you send someone. */
    var dev = /[?&]dev\b/.test(window.location.search);
    if (!dev) {
      document.body.classList.add("hud-off");
      play();
    }

    /* the export harness talks to this */
    window.__anim = {
      fps: FPS,
      get duration() { return total; },
      get totalFrames() { return Math.round(total * FPS); },
      seek: function (v) { pause(); seek(v); },
      seekFrame: function (f) { pause(); seekFrame(f); },
      setFormat: setFormat,
      capture: function (on) {
        captureMode = on !== false;
        document.body.classList.toggle("capture", captureMode);
        fit();
      },
      sound: function (on) { return SCENE_TIMELINE.sound(on); }
    };
  }

  /* every photo decoded up front. a JPEG is only decoded the first
     time it is painted, and that decode lands mid-animation — which
     is exactly the hitch you see when a card scales in. paying for
     it here means playback never pays for it. */
  var warmed = [];   /* must outlive the decode: an unreferenced Image
                        can be collected mid-decode and the promise
                        then never settles, hanging startup forever */

  function decodeAll(rows) {
    var seen = {}, waits = [];
    for (var i = 0; i < rows.length; i++) {
      /* every photograph on the date, not just the first — and a split
         slide is a list inside the list, so it has to be opened out.
         Most dates carry a "photos" array now, and reading only "photo"
         quietly left the cross-fades out of the warm-up, which put the
         decode hitch back exactly where this exists to remove it. */
      var slides = rows[i].photos && rows[i].photos.length
                 ? rows[i].photos
                 : (rows[i].photo ? [rows[i].photo] : []);
      var shots = [];
      for (var g = 0; g < slides.length; g++) {
        if (slides[g] instanceof Array) shots = shots.concat(slides[g]);
        else shots.push(slides[g]);
      }

      for (var j = 0; j < shots.length; j++) {
        var f = shots[j];
        if (!f || seen[f]) continue;
        seen[f] = true;

        /* a clip has to be buffered rather than decoded, and it must be
           ready before its card arrives or the first second plays black */
        if (/\.(mp4|webm|mov)$/i.test(f)) {
          var vid = document.createElement("video");
          vid.preload = "auto";
          vid.muted = true;
          vid.src = A.asset("assets/video/" + f);
          warmed.push(vid);
          waits.push(new Promise(function (go) {
            vid.addEventListener("canplaythrough", go, { once: true });
            vid.addEventListener("error", go, { once: true });
            setTimeout(go, 6000);
          }));
          vid.load();
          continue;
        }

        var img = new Image();
        img.src = A.asset("assets/photos/" + f);
        warmed.push(img);

      }
    }
    return Promise.all(waits).then(function () { return rows; });
  }

  /* data first, then Museum — nothing may reflow after the first frame */
  window.__ready = false;
  /* the data must carry the same cache-buster as the code. without it
     the browser (and the CDN in front of Pages) happily serves last
     week's copy, and an edit to the timeline silently does nothing. */
  var VER = (function () {
    var tags = document.getElementsByTagName("script");
    var m = tags[tags.length - 1].src.match(/[?&]v=([^&]+)/);
    /* the same reason as the photographs in anim.js: locally the lists
       are rewritten between reloads under a version that has not moved */
    if (/^(localhost|127\.0\.0\.1)$/.test(location.hostname))
      return (m ? m[1] : "") + "." + Date.now();
    return m ? m[1] : Date.now();
  })();

  /* which dates ship a "-cover" twin for the rail card. A list beats
     asking the server for 39 files that mostly are not there: those
     misses were 113 console errors on every load, and 113 wasted
     requests per batch in the headless export.

     It has to be ANSWERED before the rail is built — the card's src is
     written once when its node is made, not per frame — so it is part
     of the boot chain rather than a request fired alongside it. */
  function loadCovers() {
    return fetch("data/covers.json?v=" + VER)
      .then(function (r) { return r.ok ? r.json() : []; })
      .catch(function () { return []; })
      .then(function (list) {
        for (var c = 0; c < list.length; c++) A.noteCover(list[c], true);
      });
  }

  /* The Spanish file carries words and nothing else: it is laid over the
     rows by id, so photographs, framing, colour and timing keep one
     source. A date missing from it simply stays in English rather than
     disappearing, which is the safe way to fail while a translation is
     still being written. */
  function applyLang(rows) {
    if (A.lang !== "es") return rows;
    return fetch("data/textos-es.json?v=" + VER)
      .then(function (r) { return r.ok ? r.json() : []; })
      .then(function (txt) {
        var by = {}, i;
        for (i = 0; i < txt.length; i++) by[txt[i].id] = txt[i];
        for (i = 0; i < rows.length; i++) {
          var t = by[rows[i].id];
          if (!t) continue;
          if (t.label)     rows[i].label     = t.label;
          if (t.short)     rows[i].short     = t.short;
          if (t.title)     rows[i].title     = t.title;
          if (t.paragraph) rows[i].paragraph = t.paragraph;
          if (t.facts)     rows[i].facts     = t.facts;
        }
        return rows;
      })
      .catch(function () { return rows; });
  }

  loadCovers()
    .then(function () { return fetch("data/timeline.json?v=" + VER); })
    .then(function (res) { return res.json(); })
    .then(applyLang)
    .then(decodeAll)
    .then(function (rows) {
      var fonts = (document.fonts && document.fonts.ready)
        ? document.fonts.ready : Promise.resolve();
      return fonts.then(function () { return rows; });
    })
    .then(function (rows) {
      start(rows);
      window.__ready = true;
    })
    .catch(function (err) {
      console.error("could not start:", err);
    });

  return { seek: function (v) { seek(v); }, play: play, pause: pause };
})();
