/* ============================================================
   promo.js — 30 segundos invitando al Domingo de Alabanza
   ------------------------------------------------------------
   Cuatro actos:

     0.0 - 10.0   el mosaico se llena, foto por foto, 1996 a 2026
    10.0 - 13.6   las fotografias se drenan y quedan los nombres,
                  que se ponen a correr como tiras
    13.6 - 21.5   el sello se arma pieza por pieza
    21.5 - 30.0   el sello se encoge, sube, y aparece la informacion

   Nada se reproduce: todo es render(t). El exportador salta de un
   cuadro a otro sin dejar correr el reloj, asi que ninguna animacion
   puede vivir en una transicion de css — el valor de cada propiedad
   se escribe aca, para el t que se pida, cada vez.
   ============================================================ */
(function () {
  "use strict";

  var FPS = 24;
  var DUR = 30;                       /* segundos exactos */

  /* ---- los actos, en segundos ---------------------------------- */
  var A1 = 0.0,  A1_FIN = 10.0;       /* mosaico   */
  var A2 = 10.0, A2_FIN = 13.6;       /* drenaje   */
  var A3 = 13.6;                      /* el sello se estampa */
  var A4 = 19.5;                      /* se encoge y sube, y deja sitio */

  /* ---- las 16 fotografias -------------------------------------- */
  /* Cronologicas a proposito: el mosaico se llena de 1996 a 2026, asi
     que llenarse ES el paso del tiempo. Caras antes que edificios: un
     mosaico de letreros y fachadas informa pero no emociona. */
  var FOTOS = [
    ["01-1996-first-celebration-service/S1 Portada-Cover.jpg", "1996", "Memphis",       "50% 45%"],
    ["14-2009-first-axis-conference/S1-Portada-cover.jpg",     "2009", "Axis",          "50% 42%"],
    ["17-2014-santiago-launch/img-001.jpg",                    "2014", "Santiago",      "50% 40%"],
    ["17-2014-santiago-launch/img-003.jpg",                    "2014", "Santiago",      "50% 38%"],
    ["22-2017-auditorium-opening/Portada.JPG",                 "2017", "Houston Levee", "50% 45%"],
    ["24-2019-21-mission-teams/cuba-missions-sm-49.jpg",       "2019", "Misiones",      "50% 38%"],
    ["24-2019-21-mission-teams/img-0634.jpg",                  "2019", "Misiones",      "50% 40%"],
    ["25-2020-new-york-launch/img-0767.jpg",                   "2020", "New York",      "50% 45%"],
    ["27-2021-massachusetts-launch/Portada.jpg",               "2021", "Massachusetts", "50% 42%"],
    ["29-2022-italy-launch/img-7769.jpg",                      "2022", "Italia",        "50% 45%"],
    ["29-2022-italy-launch/pic-5.jpg",                         "2022", "Italia",        "50% 38%"],
    ["32-2023-dc-metro-launch/031923-jb-35.jpg",               "2023", "DC Metro",      "50% 42%"],
    ["33-2023-first-international-make-r/Portada-cover.jpg",   "2023", "Make Room",     "50% 40%"],
    ["34-2024-south-africa-launch/012424-revival-ep-77-collage.jpg", "2024", "Sudafrica", "50% 42%"],
    ["37-2024-nashville-launch/060924-nash-ch-25.jpg",         "2024", "Nashville",     "50% 40%"],
    ["39-2026-broke-ground-global-hub/portada.jpg",            "2026", "Global Hub",    "50% 48%"]
  ];

  /* las tiras dicen lo mismo que el sello calla: donde esta la iglesia */
  var CIUDADES = ["Memphis", "Nashville", "New York", "Massachusetts",
                  "DC Metro", "Santiago", "Italia", "Sudafrica"];

  var COLS = 4, FILAS = 4;
  var LINEAS = 23;                    /* las filas de la trama de fondo */

  /* El orden en que caen las fotos. Estaba por diagonales y se leia
     demasiado prolijo — se notaba el patron. Esta permutacion esta
     escrita a mano para que ninguna foto caiga junto a la anterior,
     que es lo que hace que parezca azar; un azar de verdad, sorteado
     en cada carga, rompería que la pieza sea funcion pura del tiempo
     y haria que dos exportaciones no coincidieran. */
  var CAIDA = [5, 12, 2, 9, 15, 0, 7, 10, 3, 13, 6, 1, 14, 8, 11, 4];

  /* ---- utilidades de tiempo ------------------------------------ */

  /* 0 antes de a, 1 despues de b, y el tramo entre medio */
  function pos(t, a, b) {
    if (b <= a) return t >= b ? 1 : 0;
    return Math.max(0, Math.min(1, (t - a) / (b - a)));
  }
  function mezcla(a, b, p) { return a + (b - a) * p; }

  function salida(p)  { return 1 - Math.pow(1 - p, 3); }          /* frena al llegar */
  function entrada(p) { return p * p * p; }
  function suave(p)   { return p < .5 ? 4*p*p*p : 1 - Math.pow(-2*p + 2, 3) / 2; }

  /* un rebote corto al final: el sello se asienta, no se detiene seco */
  function asentar(p) {
    var c = 1.70158, c3 = c + 1;
    return 1 + c3 * Math.pow(p - 1, 3) + c * Math.pow(p - 1, 2);
  }

  /* ---- el escenario -------------------------------------------- */
  var stage   = document.getElementById("stage");
  var elFondo = document.getElementById("fondo");
  var elMos   = document.getElementById("mosaico");
  var elTiras = document.getElementById("tiras");
  var elSello   = document.getElementById("sello");
  var elRecorte = document.getElementById("sello-recorte");

  var celdas = [];          /* {raiz, foto, rotulo} */
  var rieles = [];
  var letras = [];

  /* ---- construccion -------------------------------------------- */

  function construirMosaico() {
    elMos.style.gridTemplateColumns = "repeat(" + COLS + ", 1fr)";
    elMos.style.gridTemplateRows    = "repeat(" + FILAS + ", 1fr)";

    for (var i = 0; i < FOTOS.length; i++) {
      var f = FOTOS[i];
      var celda = document.createElement("div");
      celda.className = "celda";

      var foto = document.createElement("div");
      foto.className = "celda__foto";
      foto.style.backgroundImage =
        'url("' + encodeURI("assets/photos/" + f[0]) + '")';
      foto.style.setProperty("--foco", f[3]);

      var rot = document.createElement("div");
      rot.className = "celda__lugar";
      rot.innerHTML = f[2] + " <b>" + f[1] + "</b>";

      celda.appendChild(foto);
      celda.appendChild(rot);
      elMos.appendChild(celda);
      celdas.push({ raiz: celda, foto: foto, rotulo: rot });
    }
  }

  /* Un riel que se desplaza y vuelve de golpe deja un hueco, porque el
     salto tiene que medir exactamente una repeticion y no un numero
     redondo elegido a ojo. Asi que se arma UNA vuelta de ciudades, se
     mide cuanto ocupa de verdad, y recien ahi se repite las veces que
     hagan falta para cubrir la pantalla mas un ciclo de reserva. */
  function construirTiras() {
    var alto = stage.offsetHeight, ancho = stage.offsetWidth;
    var filas = LINEAS;
    /* las lineas se reparten el alto en vez de tener una altura fija:
       asi son 23 tanto en el horizontal como en la vertical de redes */
    var altoFila = alto / filas;
    elTiras.style.setProperty("--tira-alto", altoFila.toFixed(2) + "px");
    elTiras.style.setProperty("--tira-fuente",
      (altoFila * 0.74).toFixed(1) + "px");

    for (var i = 0; i < filas; i++) {
      var tira = document.createElement("div");
      tira.className = "tira";
      var riel = document.createElement("div");
      riel.className = "tira__riel";

      /* cada fila arranca en otra ciudad: alineadas se leerian como
         columnas y el ojo las toma como tabla, no como trama */
      var vuelta = "";
      for (var c = 0; c < CIUDADES.length; c++)
        vuelta += "<span>" + CIUDADES[(c + i * 3) % CIUDADES.length] +
                  "</span><i>&bull;</i>";

      riel.innerHTML = vuelta;
      tira.appendChild(riel);
      elTiras.appendChild(tira);

      /* el ancho real de una vuelta, ya con la tipografia aplicada */
      var periodo = riel.scrollWidth;
      var veces = Math.ceil((ancho + periodo) / periodo) + 1;
      riel.innerHTML = new Array(veces + 1).join(vuelta);

      rieles.push({ el: riel, periodo: periodo });
    }
  }

  function construirSello(svgTexto) {
    elRecorte.innerHTML = svgTexto;
    var svg = elRecorte.querySelector("svg");
    if (!svg) return;
    letras = Array.prototype.slice.call(svg.querySelectorAll(".letra"));
  }

  /* ============================================================
     render(t) — el unico lugar donde el tiempo se convierte en imagen
     ============================================================ */
  var caida = CAIDA;

  function render(t) {
    t = Math.max(0, Math.min(DUR, t));

    /* ---------- acto 1 · el mosaico ---------- */
    /* Las fotos no caen a ritmo parejo: el intervalo se acorta hacia
       el final. Un pulso constante durante diez segundos se vuelve un
       metronomo, y lo que buscamos es que se acelere. */
    /* Entrada y drenaje se calculan juntos y SIEMPRE, para cada celda.
       Estuvieron separados, con el drenaje dentro de un "si ya pasaron
       diez segundos", y eso rompia lo unico que esta pieza promete: al
       no entrar en esa rama, nadie borraba lo que la rama habia escrito
       antes, asi que saltar a un tiempo anterior dejaba las fotos
       despintadas. Una funcion del tiempo tiene que escribir todas sus
       salidas en cada llamada, tambien las que valen cero. */
    var n = FOTOS.length;
    var inicioUlt = A1_FIN - 1.5;        /* la ultima cae aca */
    var dre = pos(t, A2, A2 + 1.5);      /* el despinte, parejo para todas */

    for (var i = 0; i < n; i++) {
      var idx = caida[i];
      var p01 = i / (n - 1);
      var cuando = mezcla(0.25, inicioUlt, Math.pow(p01, 0.78));

      /* ---- entra ---- */
      var e = salida(pos(t, cuando, cuando + 0.52));
      var rotEntra = salida(pos(t, cuando + 0.28, cuando + 0.80));

      /* ---- se va ---- */
      /* el retardo se reparte por la rejilla, no por el orden de
         entrada: irse en el mismo desorden en que llegaron se leeria
         como un parpadeo, y lo que se busca es un vaciado */
      var fila = Math.floor(idx / COLS), col = idx % COLS;
      var retardo = col * 0.05 + fila * 0.07;
      var d = suave(pos(t, A2 + 0.35 + retardo, A2 + 1.35 + retardo));
      var rotSale = suave(pos(t, A2 + 0.2 + retardo, A2 + 0.9 + retardo));

      var c = celdas[idx];
      c.raiz.style.setProperty("--celda-op", (e * (1 - d)).toFixed(4));
      /* las dos escalas se multiplican: la de llegada y la de retirada
         viven en momentos distintos, asi que nunca pelean */
      c.raiz.style.setProperty("--celda-escala",
        (mezcla(1.14, 1, e) * mezcla(1, 0.88, d)).toFixed(4));
      c.raiz.style.setProperty("--celda-rotulo",
        (rotEntra * (1 - rotSale)).toFixed(4));

      /* cada foto sigue creciendo despues de aterrizar, desde su propio
         momento de entrada: asi ninguna queda congelada esperando a las
         demas, y el mosaico entero respira aunque ya este lleno */
      c.raiz.style.setProperty("--foto-escala",
        mezcla(1.06, 1.0, suave(pos(t, cuando, cuando + 5.5))).toFixed(4));

      /* pierden el color antes de encogerse: por un instante el mosaico
         ya es verde, y ahi el fondo y las tiras toman el relevo sin que
         haya un corte */
      c.foto.style.setProperty("--celda-sat",
        mezcla(1, 0.08, suave(dre)).toFixed(3));
    }

    elMos.style.setProperty("--mos-gap",
      mezcla(10, 14, pos(t, 0, A1_FIN)).toFixed(2) + "px");
    elMos.style.setProperty("--mos-opacidad",
      (1 - suave(pos(t, A2 + 0.5, A2_FIN - 0.6))).toFixed(4));

    /* ---------- acto 2b · las tiras ---------- */
    /* Entran mientras el mosaico todavia se esta yendo: si esperaran a
       que termine habria un cuadro vacio, y un cuadro vacio en una
       promo de 30 segundos se siente como un error de reproduccion. */
    var tirasOp = pos(t, A2 + 0.7, A2 + 1.9);
    /* Se apagan en dos tiempos: bajan cuando el sello toma el centro, y
       bajan de nuevo cuando entra la informacion. La trama existe para
       dar fondo, y un fondo que compite con la fecha y la hora deja de
       ser fondo — que es justo lo unico que alguien tiene que leer. */
    var tirasBaja = mezcla(1, 0.34, suave(pos(t, A3 + 0.3, A3 + 1.6)))
                  * mezcla(1, 0.52, suave(pos(t, A4 + 0.2, A4 + 1.2)));
    elTiras.style.setProperty("--tiras-op",
      (salida(tirasOp) * tirasBaja).toFixed(4));

    /* corren siempre, tambien antes de verse: una tira que arranca
       justo cuando aparece delata que estaba detenida */
    for (var k = 0; k < rieles.length; k++) {
      var r = rieles[k];
      var dir = (k % 2 === 0) ? -1 : 1;
      var vel = 54 + (k % 4) * 21;                 /* px por segundo */
      /* el salto mide una repeticion exacta, asi que la vuelta al
         origen cae justo sobre la copia siguiente y no se ve */
      var av = (t * vel) % r.periodo;
      var x = dir < 0 ? -av : av - r.periodo;
      r.el.style.setProperty("--riel-x", x.toFixed(1) + "px");
    }

    /* ---------- acto 3 · el sello se estampa ---------- */
    var s = elSello.style;
    s.setProperty("--sello-op", salida(pos(t, A3, A3 + 0.22)).toFixed(4));

    /* La apertura eliptica desde el centro. Llega al 78% y no al 50%
       porque el rombo sale por los costados mas alla del ovalo:
       cerrando antes, las dos puntas quedaban recortadas para siempre. */
    var pRev = salida(pos(t, A3, A3 + 0.62));
    elRecorte.style.setProperty("--rev-x", (pRev * 78).toFixed(2) + "%");
    elRecorte.style.setProperty("--rev-y", (pRev * 78).toFixed(2) + "%");

    /* el golpe: entra mas grande y ladeado, y se asienta. Es un sello
       estampandose, no una imagen que aparece */
    var pGolpe = asentar(Math.min(1, pos(t, A3, A3 + 0.78)));
    var escalaEntrada = mezcla(1.18, 1, pGolpe);
    var giro = mezcla(-2.8, 0, pGolpe);

    /* y despues no se queda quieto: respira muy lento hasta el final.
       Nueve segundos perfectamente congelado se leen como una lamina
       pegada encima del video, no como parte de el. */
    var respira = Math.sin(pos(t, A3 + 0.9, DUR) * Math.PI * 1.7) * 0.012;

    /* las letras de los textos curvos, una tras otra alrededor */
    var lInicio = A3 + 0.5, lPaso = 0.031;
    for (var L = 0; L < letras.length; L++) {
      var pl = salida(pos(t, lInicio + L * lPaso, lInicio + L * lPaso + 0.26));
      letras[L].style.opacity = pl.toFixed(3);
    }

    /* se encoge y sube para dejar limpia la mitad de abajo, que es
       donde Daniel monta la fecha y los horarios en After Effects */
    var pEnc = suave(pos(t, A4, A4 + 0.95));
    s.setProperty("--sello-escala",
      (mezcla(escalaEntrada, 0.62, pEnc) + respira).toFixed(4));
    s.setProperty("--sello-y", mezcla(50, 30, pEnc).toFixed(2) + "%");
    s.setProperty("--sello-giro", mezcla(giro, 0, pEnc).toFixed(3) + "deg");

    /* el fondo pasa de papel a salvia justo cuando el mosaico se drena */
    elFondo.style.opacity = suave(pos(t, A2 + 0.2, A2 + 1.4)).toFixed(4);

    /* para el hud */
    stage.dataset.acto = t < A2 ? "mosaico" : t < A3 ? "tiras"
                       : t < A4 ? "sello"   : "informacion";
  }

  /* ---- reloj, teclas y calce ----------------------------------- */
  var tAhora = 0, corriendo = false, ultimo = 0;
  var hudT = document.getElementById("hud-time");
  var hudM = document.getElementById("hud-mode");
  var hudA = document.getElementById("hud-acto");

  function pintar() {
    render(tAhora);
    if (hudT) {
      hudT.textContent = tAhora.toFixed(2) + "s";
      hudM.textContent = corriendo ? "CORRIENDO" : "PAUSA";
      hudA.textContent = stage.dataset.acto;
    }
  }

  function paso(ms) {
    if (!corriendo) return;
    if (!ultimo) ultimo = ms;
    tAhora += (ms - ultimo) / 1000;
    ultimo = ms;
    if (tAhora >= DUR) tAhora = 0;        /* vuelve a empezar */
    pintar();
    requestAnimationFrame(paso);
  }

  function correr()  { if (!corriendo) { corriendo = true; ultimo = 0; requestAnimationFrame(paso); } }
  function parar()   { corriendo = false; }
  function ir(v)     { tAhora = Math.max(0, Math.min(DUR, v)); pintar(); }

  document.addEventListener("keydown", function (e) {
    var g = e.shiftKey ? 0.1 : 1;
    if (e.code === "Space")      { e.preventDefault(); corriendo ? parar() : correr(); }
    else if (e.key === "ArrowRight") { parar(); ir(tAhora + g); }
    else if (e.key === "ArrowLeft")  { parar(); ir(tAhora - g); }
    else if (e.key === "r" || e.key === "R") { ir(0); }
    else if (e.key === "h" || e.key === "H") { document.body.classList.toggle("hud-off"); }
  });

  /* Cambiar de formato no es solo cambiar el tamano: la cantidad de
     filas de la trama depende del alto, asi que la vertical necesita
     mas que la horizontal para verse igual de densa. Por eso se
     rehacen, en vez de estirar las que ya estaban. */
  function setFormat(f) {
    if (!f) return;
    stage.dataset.format = String(f);
    elTiras.innerHTML = "";
    rieles.length = 0;
    construirTiras();
    calce();
    pintar();
  }

  /* el escenario entero se escala al calce de la ventana */
  function calce() {
    var w = stage.offsetWidth, h = stage.offsetHeight;
    var k = Math.min(window.innerWidth / w, window.innerHeight / h);
    stage.style.transform = "translate(-50%, -50%) scale(" + k + ")";
  }
  window.addEventListener("resize", calce);

  /* ---- arranque ------------------------------------------------ */
  function listo() {
    construirMosaico();

    var fmt = /[?&]format=([0-9x]+)/.exec(window.location.search);
    if (fmt) stage.dataset.format = fmt[1];

    var dev = /[?&]dev\b/.test(window.location.search);
    if (!dev) document.body.classList.add("hud-off");

    fetch("assets/sello/sello.svg")
      .then(function (r) { return r.text(); })
      .then(function (txt) { construirSello(txt); })
      .catch(function () { /* sin sello la pieza igual corre */ })
      .then(function () {
        /* La preparacion mejora la pieza pero no puede condicionarla.
           Si una espera no vuelve — y en una pestana que no pinta hay
           varias que no vuelven — es preferible arrancar con una foto
           sin precalentar que no arrancar nunca: colgada, la pagina se
           ve perfecta y el exportador espera hasta rendirse. */
        return Promise.race([
          Promise.all([
            document.fonts ? document.fonts.ready : Promise.resolve(),
            precargar()
          ]),
          new Promise(function (ok) { setTimeout(ok, 10000); })
        ]);
      })
      .then(function () {
        /* recien aca: el ancho de una vuelta se mide con la tipografia
           definitiva. Medido con la de reemplazo, el ciclo no cierra y
           la tira salta cada vez que vuelve al origen. */
        construirTiras();
      })
      .catch(function (e) {
        /* Que un paso de la preparacion falle no puede dejar la pieza
           muda: sin esto, un rechazo cualquiera se traga el resto de
           la cadena, __anim nunca se publica, y el exportador espera
           para siempre una pagina que por fuera se ve perfecta. */
        if (window.console) console.error("preparando la promo:", e);
      })
      .then(function () {
        calce();
        pintar();
        if (!dev) correr();

        /* el exportador habla por aca */
        window.__anim = {
          fps: FPS,
          get duration()    { return DUR; },
          get totalFrames() { return Math.round(DUR * FPS); },
          seek:      function (v) { parar(); ir(v); },
          seekFrame: function (f) { parar(); ir(f / FPS); },
          setFormat: setFormat,
          capture:   function () { document.body.classList.add("hud-off"); },
          sound:     function () { return false; }
        };
      });
  }

  /* Cada jpeg se decodifica la primera vez que se pinta, y ese trabajo
     cae justo en el cuadro en que la foto entra — que es exactamente
     donde se ve el tiron. Pagarlo antes de empezar lo borra. */
  var calientes = [];
  function precargar() {
    var esperas = FOTOS.map(function (f) {
      var im = new Image();
      calientes.push(im);          /* sin referencia se puede recolectar
                                      a medio decodificar y la promesa
                                      no resuelve nunca */
      im.src = encodeURI("assets/photos/" + f[0]);

      /* La carga se espera con onload, que si llega siempre. decode()
         es mejor — deja el mapa de bits listo y no solo los bytes —
         pero en una pestana que no esta pintando no resuelve nunca,
         aunque la imagen ya este completa: el mismo motivo por el que
         el exportador no puede esperar un requestAnimationFrame.
         Se le pide igual, con plazo, para aprovecharlo cuando sirve
         sin que pueda dejar la pieza sin arrancar. */
      var cargada = im.complete ? Promise.resolve()
        : new Promise(function (ok) { im.onload = ok; im.onerror = ok; });

      return cargada.then(function () {
        if (!im.decode) return;
        return Promise.race([
          im.decode().catch(function () {}),
          new Promise(function (ok) { setTimeout(ok, 1200); })
        ]);
      });
    });
    return Promise.all(esperas);
  }

  if (document.readyState === "loading")
    document.addEventListener("DOMContentLoaded", listo);
  else listo();
})();
