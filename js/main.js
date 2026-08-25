/* ============================================================
   main.js — clock, scenes, controls
   ------------------------------------------------------------
   three ways to drive the exact same render(t):
     step     arrow keys, beat by beat        (designing / review)
     play     real-time clock                 (timing / kiosk)
     capture  window.__anim.seekFrame(n)      (headless -> MP4)
   ============================================================ */

var APP = (function () {

  var FPS = 30;
  var FORMATS = {
    "1080": [1080, 1080],
    "1920": [1920, 1080],
    "5760": [5760, 1080]
  };

  var SCENES = [SCENE_LOGO, SCENE_TIMELINE, SCENE_OUTRO];

  var stage, hud, hudMode, hudTime, hudScene, hudFmt;
  var t = 0, clock = 0;
  var playing = false, lastNow = 0, format = "1920", captureMode = false;
  var total = 0, markers = [];

  /* ---------------------------------------------------------- */

  function build() {
    stage    = document.getElementById("stage");
    hud      = document.getElementById("hud");
    hudMode  = document.getElementById("hud-mode");
    hudTime  = document.getElementById("hud-time");
    hudScene = document.getElementById("hud-scene");
    hudFmt   = document.getElementById("hud-fmt");

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
      if (visible) s.render(local);
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
    if (k === "1") { setFormat("1080"); return; }
    if (k === "2") { setFormat("1920"); return; }
    if (k === "3") { setFormat("5760"); return; }

    /* legibility check — see how it reads from N screen-heights back */
    if (k === "4") { setSim(4); return; }
    if (k === "6") { setSim(6); return; }
    if (k === "8") { setSim(8); return; }
    if (k === "0") { setSim(0); return; }
  }

  /* ---- boot -------------------------------------------------- */

  function start(rows) {
    build();
    SCENE_TIMELINE.setData(rows);
    computeTiming();
    setFormat("1920");
    seek(0);
    window.addEventListener("resize", fit);
    window.addEventListener("keydown", keys);

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
      }
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
      var f = rows[i].photo;
      if (!f || seen[f]) continue;
      seen[f] = true;

      var img = new Image();
      img.src = "assets/photos/" + f;
      warmed.push(img);

      var done = img.decode ? img.decode() : Promise.resolve();
      waits.push(Promise.race([
        done["catch"](function () {}),        /* a bad photo must not block */
        new Promise(function (go) { setTimeout(go, 4000); })
      ]));
    }
    return Promise.all(waits).then(function () { return rows; });
  }

  /* data first, then Museum — nothing may reflow after the first frame */
  window.__ready = false;
  fetch("data/timeline.json")
    .then(function (res) { return res.json(); })
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
