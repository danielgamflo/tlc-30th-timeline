#!/usr/bin/env node
/* ============================================================
   export.js — the piece, frame by frame, into an MP4
   ------------------------------------------------------------
   Every scene is a pure function of t, so the film is not
   recorded: it is asked for. Chrome runs with no window, we hand
   it one frame number at a time, and each screenshot goes
   straight down a pipe into ffmpeg. Nothing is played in real
   time, so nothing can drop a frame or drift.

   No dependencies. Node speaks CDP over its own WebSocket.

     node tools/export.js --format 1920 --fps 24
     node tools/export.js --format 1920 --fps 24 --to 240 \
                          --out out/prueba.mp4

   --to is how you take a slice to check before betting an hour
   on the whole thing.
   ============================================================ */

const { spawn } = require("child_process");
const { once } = require("events");
const fs = require("fs");
const path = require("path");

const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

const FORMATS = { "1920": [1920, 1080], "1024": [1024, 1024],
                  "1080": [1080, 1080], "1680": [1680, 1050],
                  "5760": [5760, 1080],
                  /* el cumpleanos: el led del lobby y la pantalla principal */
                  "1280": [1280, 1280], "3840x990": [3840, 990] };

function arg(name, fallback) {
  const i = process.argv.indexOf("--" + name);
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

const format = arg("format", "1920");
const fps    = parseInt(arg("fps", "24"), 10);
const host   = arg("host", "http://localhost:5173");
const from   = parseInt(arg("from", "0"), 10);
const toArg  = arg("to", null);
const out    = arg("out", path.join("out", `timeline-${format}-${fps}fps.mp4`));
const crf    = arg("crf", "16");
/* one debugging port per run: a second export must not attach to the
   Chrome of the first and start seeking the film out from under it */
const PORT   = parseInt(arg("port", "9333"), 10);
const lang   = arg("lang", "");          /* "es" para la versión Santiago */
/* Cualquier página que publique el mismo window.__anim se puede
   exportar con esto: el loop es index.html, la promo es promo.html.
   Por omisión sigue siendo el loop, para que las órdenes de siempre
   signifiquen exactamente lo mismo que antes. */
/* NO llamar a esto "page": dentro de main() ya hay una variable con
   ese nombre para la pestaña de Chrome, y la de adentro tapa a la de
   afuera — la dirección terminaba siendo "/[object Object]". */
const pagina = arg("page", "index.html");
/* --stills writes each frame as a PNG as well, and --frames picks them
   out one by one instead of a run. Together they are the proof that a
   change did not move the 1920: render the same handful before and
   after, compare the files byte for byte. */
const stillsDir = arg("stills", null);
const framesArg = arg("frames", null);
/* Lo que haya aquí se pega tal cual a la dirección. Es para los
   parámetros que solo entiende una pieza y que no tienen por qué
   aparecer en esta lista: --query "capa=frente". */
const extra = arg("query", "");
/* --alpha apaga el fondo del navegador y graba QuickTime Animation en
   vez de h264: un mp4 no tiene canal alfa, así que sin esto la
   transparencia se aplana a negro sin avisar. Animation es sin pérdida
   y, sobre un fondo vacío, pesa un tercio que ProRes 4444. */
const alpha = process.argv.includes("--alpha");

if (!FORMATS[format]) { console.error("formato desconocido:", format); process.exit(1); }
const [W, H] = FORMATS[format];

/* ---- CDP ---------------------------------------------------- */

let ws, nextId = 1;
const pending = new Map();

/* Every call carries a deadline. Without one a headless page that never
   answers — the screenshot that waits for a compositor frame it will
   never get — stalls the whole export in silence instead of saying so. */
function send(method, params, ms) {
  const id = nextId++;
  ws.send(JSON.stringify({ id, method, params: params || {} }));
  return new Promise((res, rej) => {
    const timer = setTimeout(() => {
      pending.delete(id);
      rej(new Error(method + " no respondió en " + ((ms || 30000) / 1000) + "s"));
    }, ms || 30000);
    pending.set(id, {
      res: (v) => { clearTimeout(timer); res(v); },
      rej: (e) => { clearTimeout(timer); rej(e); }
    });
  });
}

async function evaluate(expression, awaitPromise, ms) {
  const r = await send("Runtime.evaluate", {
    expression, awaitPromise: !!awaitPromise, returnByValue: true
  }, ms);
  if (r.exceptionDetails)
    throw new Error(r.exceptionDetails.exception?.description || "error en la página");
  return r.result.value;
}

/* ---- main --------------------------------------------------- */

(async function main() {
  /* Ask ffmpeg whether it can run at all before spending an hour finding
     out. A brew upgrade left this one linked against an x265 that was no
     longer there; it died the instant it was spawned, and the export sat
     waiting on a pipe nobody was reading. One second here, spent always. */
  const probe = spawn("ffmpeg", ["-version"], { stdio: ["ignore", "ignore", "pipe"] });
  let probeErr = "";
  probe.stderr.on("data", d => { probeErr += d; });
  const [probeCode] = await once(probe, "close");
  if (probeCode !== 0)
    throw new Error("ffmpeg no arranca:\n" + probeErr.trim().split("\n").slice(0, 3).join("\n"));

  fs.mkdirSync(path.dirname(out), { recursive: true });
  const profile = fs.mkdtempSync("/tmp/tlc-export-");

  const chrome = spawn(CHROME, [
    "--headless=new",
    "--remote-debugging-port=" + PORT,
    "--user-data-dir=" + profile,
    "--hide-scrollbars",
    "--force-device-scale-factor=1",
    "--force-color-profile=srgb",
    "--disable-lcd-text",            /* subpixel AA belongs to a screen, not a file */
    "--mute-audio",
    "--window-size=" + W + "," + H,
    "about:blank"
  ], { stdio: "ignore" });

  /* The debugging port is not open the instant the process is — and the
     endpoint in /json/version is the BROWSER, which has no Page domain.
     The tab is its own target, listed in /json/list. */
  let page = null;
  for (let i = 0; i < 150 && !page; i++) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
      page = list.find(t => t.type === "page" && t.webSocketDebuggerUrl);
    } catch { /* not up yet */ }
    if (!page) await new Promise(r => setTimeout(r, 100));
  }
  if (!page) throw new Error("Chrome no abrió ninguna pestaña para controlar");

  ws = new WebSocket(page.webSocketDebuggerUrl);
  /* los avisos que llegan sin que nadie los haya pedido: el navegador
     cuenta por aquí cuándo termino de cargar la pagina */
  const oyentes = new Map();
  const alOcurrir = (evento) => new Promise((res) => {
    const previos = oyentes.get(evento) || [];
    previos.push(res);
    oyentes.set(evento, previos);
  });
  ws.onmessage = (e) => {
    const m = JSON.parse(e.data);
    if (m.id && pending.has(m.id)) {
      const { res, rej } = pending.get(m.id);
      pending.delete(m.id);
      m.error ? rej(new Error(m.error.message)) : res(m.result);
      return;
    }
    if (m.method && oyentes.has(m.method)) {
      const todos = oyentes.get(m.method);
      oyentes.delete(m.method);
      todos.forEach((res) => res(m.params));
    }
  };
  await once(ws, "open");

  await send("Page.enable");
  await send("Runtime.enable");
  await send("Emulation.setDeviceMetricsOverride",
             { width: W, height: H, deviceScaleFactor: 1, mobile: false });

  /* A page with no window is a page nobody is looking at, and Chrome
     treats it accordingly: timers throttled, no new compositor frames.
     Both of these say "this page is in front", which is what makes the
     screenshots come back at all. */
  await send("Emulation.setFocusEmulationEnabled", { enabled: true }).catch(() => {});
  await send("Page.setWebLifecycleState", { state: "active" }).catch(() => {});

  /* El fondo por omisión del navegador es blanco opaco, y se pinta
     debajo de todo: para que la captura traiga alfa de verdad hay que
     apagarlo aquí, no basta con que la página no tenga fondo. */
  if (alpha)
    await send("Emulation.setDefaultBackgroundColorOverride",
               { color: { r: 0, g: 0, b: 0, a: 0 } });

  const url = `${host}/${pagina}?fps=${fps}` +
              (lang ? `&lang=${lang}` : "") +
              (extra ? `&${extra}` : "");
  const cargada = alOcurrir("Page.loadEventFired");
  await send("Page.navigate", { url });

  /* Page.navigate vuelve cuando la navegacion EMPIEZA, no cuando
     termina. Preguntar enseguida por window.__anim corre el riesgo de
     preguntarselo al about:blank anterior, que es un documento donde
     __anim no va a aparecer nunca por mucho que se espere: la pagina
     se cargaba bien al lado y la espera igual se agotaba. */
  await Promise.race([
    cargada,
    new Promise((r) => setTimeout(r, 30000))
  ]);

  /* the boot chain ends when __anim exists AND the piece knows how long
     it is. Fonts are waited on separately: at frame 0 the logo is the
     whole screen, and in the fallback face it is the wrong piece. */
  process.stdout.write("esperando a que cargue… ");
  const ready = await evaluate(`(async () => {
    const t0 = Date.now();
    while (!(window.__anim && window.__anim.totalFrames > 0)) {
      if (Date.now() - t0 > 120000) return "timeout";
      await new Promise(r => setTimeout(r, 100));
    }
    await document.fonts.ready;
    window.__anim.capture(true);
    window.__anim.setFormat(${JSON.stringify(format)});
    window.__anim.sound(false);
    await new Promise(r => setTimeout(r, 400));
    return { frames: window.__anim.totalFrames, fps: window.__anim.fps,
             fonts: document.fonts.status,
             controls: getComputedStyle(document.querySelector(".controls")).display,
             hud: getComputedStyle(document.querySelector(".hud")).display };
  })()`, true, 130000);
  /* 130s, un poco mas que los 120 que se da la propia espera de arriba.
     Con el plazo por defecto de 30s el canal se rendia antes que ella,
     asi que esa guardia de 120s no podia dispararse nunca y una pagina
     que solo tardaba en cargar se reportaba igual que una rota. */

  if (ready === "timeout") throw new Error("la página no terminó de cargar");
  console.log("listo.");
  console.log(`  ${ready.frames} cuadros a ${ready.fps}fps · tipografías ${ready.fonts}`);
  console.log(`  controles ${ready.controls} · hud ${ready.hud}`);
  if (ready.fps !== fps) throw new Error(`la página quedó en ${ready.fps}fps, no en ${fps}`);
  if (ready.controls !== "none" || ready.hud !== "none")
    throw new Error("los controles siguen visibles en modo captura");

  /* The loop is closed: seek() clamps to total - 1/fps, so the last
     frame is the one before the piece returns to its start. Rendering
     0..frames-1 gives exactly one turn with no repeated frame at the
     seam. */
  const last = toArg === null ? ready.frames - 1 : Math.min(parseInt(toArg, 10), ready.frames - 1);
  const count = last - from + 1;

  const mark = (s) => console.log(new Date().toISOString().slice(11, 19) + "  " + s);
  mark("abriendo ffmpeg");
  const ff = spawn("ffmpeg", ["-y",
    "-f", "image2pipe", "-framerate", String(fps), "-i", "-",
    ...(alpha
      /* ProRes 4444 es lo que lee After Effects con alfa sin discutir.
         Pesa mucho mas que h264 y da igual: es un archivo de trabajo. */
      ? ["-c:v", "qtrle", "-pix_fmt", "argb"]
      : ["-c:v", "libx264", "-preset", "slow", "-crf", String(crf),
         "-pix_fmt", "yuv420p", "-movflags", "+faststart"]),
    "-an", out
  ], { stdio: ["pipe", "ignore", "pipe"] });
  let ffErr = "";
  ff.stderr.on("data", d => { ffErr += d.toString().slice(-2000); });
  let ffDead = false;
  const ffClosed = once(ff, "close");
  ff.on("close", () => { ffDead = true; });
  ff.on("error", e => { console.error("ffmpeg no arrancó: " + e.message); process.exit(1); });
  ff.stdin.on("error", () => { ffDead = true; });   /* EPIPE: handled above */
  mark("ffmpeg pid " + ff.pid);

  /* Two ways to take the picture. The first asks the compositor for the
     real surface, which is the truthful one; if this build will not give
     it up without a window, the second reads the renderer directly. The
     viewport is already exactly W×H, so both come out the same size. */
  let shotParams = { format: "png", optimizeForSpeed: true,
                     clip: { x: 0, y: 0, width: W, height: H, scale: 1 } };
  let fallen = false;
  async function grab() {
    try { return await send("Page.captureScreenshot", shotParams, 20000); }
    catch (e) {
      if (fallen) throw e;
      fallen = true;
      shotParams = { format: "png" };
      process.stdout.write("\n  (la captura por superficie no responde; " +
                           "leyendo del renderizador)\n");
      return await send("Page.captureScreenshot", shotParams, 20000);
    }
  }

  const frameList = framesArg
    ? framesArg.split(",").map(s => parseInt(s.trim(), 10)).filter(n => n >= 0)
    : Array.from({ length: count }, (_, i) => from + i);
  if (stillsDir) fs.mkdirSync(stillsDir, { recursive: true });
  const shots = frameList.length;

  const t0 = Date.now();
  for (let i = 0; i < shots; i++) {
    const n = frameList[i];
    /* seekFrame draws synchronously and captureScreenshot forces the
       paint, so there is nothing to wait for. Do NOT wait on
       requestAnimationFrame here: a headless page is never visible, the
       callback never runs, and the export hangs on frame 0. */
    if (i === 0) mark("pidiendo cuadro " + n);
    await evaluate(`window.__anim.seekFrame(${n})`);
    if (i === 0) mark("dibujado; capturando");

    const shot = await grab();
    if (i === 0) mark("capturado, " + Math.round(shot.data.length / 1365) + " KB");

    const png = Buffer.from(shot.data, "base64");
    if (stillsDir)
      fs.writeFileSync(path.join(stillsDir,
        "f" + String(n).padStart(6, "0") + ".png"), png);

    /* If ffmpeg dies mid-run, the pipe has no reader and the wait for
       "drain" never ends. Watch for its exit alongside. */
    if (ffDead) throw new Error("ffmpeg se cerró:\n" + ffErr.trim().slice(-500));
    if (!ff.stdin.write(png)) {
      let ended = false;
      await Promise.race([
        once(ff.stdin, "drain").then(() => { ended = true; }),
        ffClosed                      /* one listener, not one per frame */
      ]);
      if (!ended) throw new Error("ffmpeg se cerró:\n" + ffErr.trim().slice(-500));
    }

    const done = i + 1;
    if (done % 24 === 0 || done === shots) {
      const ms = (Date.now() - t0) / done;
      const left = ((shots - done) * ms) / 1000;
      process.stdout.write(
        `\r  ${done}/${shots} cuadros · ${ms.toFixed(0)}ms cada uno · ` +
        `faltan ${Math.floor(left / 60)}m ${Math.round(left % 60)}s   `);
    }
  }

  ff.stdin.end();
  const [code] = await once(ff, "close");
  process.stdout.write("\n");
  if (code !== 0) { console.error(ffErr); throw new Error("ffmpeg falló"); }

  ws.close(); chrome.kill();
  await new Promise(r => setTimeout(r, 600));   /* Chrome is still writing its profile */
  try { fs.rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 300 }); }
  catch { /* a leftover temp profile is not worth failing an export over */ }

  const mb = (fs.statSync(out).size / 1048576).toFixed(1);
  const secs = ((Date.now() - t0) / 1000);
  console.log(`listo: ${out} · ${mb} MB · ${count} cuadros en ${Math.floor(secs / 60)}m ${Math.round(secs % 60)}s`);
  process.exit(0);
})().catch(e => { console.error("\n" + e.message); process.exit(1); });
