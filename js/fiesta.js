/* ============================================================
   fiesta.js — el confeti del cumpleanos 30, en loop
   ------------------------------------------------------------
   TODO movimiento aca es periodico con periodo L, el largo del
   loop. No es una preferencia de estilo: es la unica forma de que
   el ultimo cuadro empalme con el primero sin un salto.

     giro       vueltas enteras por loop
     caida      el campo recorrido un numero entero de veces
     vaiven     senos de ciclo entero
     volteo     cosenos de ciclo entero

   Elegir velocidades "que se vean bien" y despues intentar cortar
   el loop donde calce no funciona: siempre queda alguna pieza a
   medio camino, y esa sola delata el corte en cada vuelta.

   El confeti se dibuja en canvas y no como nodos del DOM. A 3840
   de ancho son varios cientos de piezas; como elementos propios
   vuelven lenta la pagina y, peor, la exportacion.
   ============================================================ */
(function () {
  "use strict";

  var FPS = 24;
  /* El loop, en segundos, y con eso la velocidad de caida: las piezas
     recorren el campo un numero ENTERO de veces por vuelta (ahi vive el
     empalme), asi que alargar la vuelta es la UNICA forma de que caigan
     mas despacio sin romper el loop. El doble de loop es la mitad de
     velocidad, exacto.

     12 -> 18 -> 45. El salto grande es de la revision: con 18 estirado a
     30 en after todavia lo veian rapido, asi que 45 es una vez y media
     mas lento que lo que miraron. Y se renderiza lento de verdad en vez
     de estirarse despues, que no es lo mismo — ver la nota de los fps.

     Se puede pisar desde la direccion con ?loop=NN para comparar
     velocidades sin tocar el archivo. */
  var L = 45;

  /* Los cinco colores salen medidos del png que mandaron, no estimados
     a ojo: son los unicos cinco que aparecen, repartidos casi en
     partes iguales (entre 1.12% y 1.41% del cuadro cada uno). No hay
     crema — sobre fondo crema desapareceria — y tampoco los dos tonos
     que yo habia inventado para reemplazarlo. */
  var PALETA = ["#86754F", "#A0B0A4", "#676837", "#BB6024", "#CB9216"];

  /* Cada formato trae lo suyo. El ancho de 3840 no es un recorte del
     cuadrado: tiene cuatro veces el area a lo ancho y un tercio del
     alto, asi que ni la densidad ni el tamano de las piezas pueden
     ser los mismos. */
  var FORMATOS = {
    /* Las cuentas salen de igualar la cobertura del arte que mandaron:
       16.7% del cuadro. Las piezas miden lo mismo en pixeles en los dos
       formatos — son dos pantallas, no un diseno y su recorte — asi que
       la cantidad sube con el area: el ancho tiene 2.32 veces la del
       cuadrado y lleva 2.32 veces las piezas.

       Bajaron de 535 y 1240 al subir el tamano de cada pieza: si el
       area de una pieza se triplica y la cantidad no baja, el cuadro se
       tapa. La cobertura es lo que hay que dejar quieto, no el numero. */
    "1280":     { w: 1280, h: 1280, piezas: 535,  escala: 1, selloW: 980,  vaiven: 34 },
    "3840x990": { w: 3840, h: 990,  piezas: 1240, escala: 1, selloW: 1020, vaiven: 96 },
    /* El 16:9, que sale de la misma regla y no de ojo: los dos de
       arriba dan 326 piezas por megapixel (535/1.638 y 1240/3.802),
       y 1920x1080 son 2.074 Mpx -> 677. El vaiven va con el ancho,
       que es lo que da lugar para derivar: 34/1280 y 96/3840 son
       2.6% y 2.5% del ancho, y el 2.55% de 1920 es 49. */
    "1920":     { w: 1920, h: 1080, piezas: 677,  escala: 1, selloW: 950,  vaiven: 49 }
  };

  /* ---- azar con semilla -----------------------------------------
     El reparto tiene que ser identico en cada carga y en cada
     exportacion. Math.random daria un confeti distinto cada vez, y
     dos exportaciones del mismo archivo no coincidirian. */
  function sembrar(semilla) {
    var s = semilla >>> 0;
    return function () {
      s ^= s << 13; s >>>= 0;
      s ^= s >> 17;
      s ^= s << 5;  s >>>= 0;
      return s / 4294967296;
    };
  }

  var TAU = Math.PI * 2;

  /* ---- el escenario ---------------------------------------------- */
  var stage  = document.getElementById("stage");
  var elSello = document.getElementById("sello");
  var cvLejos = document.getElementById("confeti-lejos");
  var cvCerca = document.getElementById("confeti-cerca");
  var ctxLejos = cvLejos.getContext("2d");
  var ctxCerca = cvCerca.getContext("2d");

  var piezas = [];
  var FMT = FORMATOS["1280"];

  /* null = los tres planos juntos, que es lo normal. Con un numero
     se dibuja SOLO ese plano y los otros dos no existen, para sacar
     cada profundidad como archivo aparte. Se fija una vez al cargar,
     asi que render(t) sigue siendo una funcion pura de t. */
  var soloPlano = null;

  /* Vuelve a velar los planos de atras, como estaban antes de medir el
     arte que mandaron. Solo para comparar: ver la nota en alfa. */
  var velado = /[?&]velado=1\b/.test(window.location.search);

  /* ---- las piezas ------------------------------------------------ */
  function repartir() {
    var r = sembrar(30111996);     /* la fecha, por si alguien pregunta */
    piezas = [];

    for (var i = 0; i < FMT.piezas; i++) {
      /* tres planos de profundidad. El de atras va chico, lento y
         apagado; el de adelante grande, rapido y entero. Eso es lo
         que le da aire a un diseno plano sin dejar de ser plano. */
      var plano = i % 3;

      /* las vueltas y los ciclos son ENTEROS: ahi vive el loop */
      var caidas = plano === 0 ? 1 : plano === 1 ? 2 : 3;

      /* Mas vueltas que antes (eran 1 a 3) y sobre un loop mas largo: lo
         que importa para que parezca papel no es la velocidad de giro
         sino cuantas vueltas da mientras baja una pantalla, y eso ahora
         es como el triple. */
      var giros  = Math.floor(r() * 5) + 3;
      if (r() < 0.5) giros = -giros;

      var cicloVaiven = Math.floor(r() * 2) + 2;

      /* El volteo va ATADO al vaiven, en multiplo entero: un papel no se
         mece y se voltea por su cuenta, se voltea PORQUE se inclina, y
         se desliza hacia el lado al que se inclino. Desacoplados se veia
         como dos animaciones encima de la misma pieza. */
      var cicloVolteo = cicloVaiven * (Math.floor(r() * 2) + 2);
      var faseVaiven  = r();

      /* Medido contra el full estatico que mando Olivia, que es el arte
         bueno. Repartidos por percentil, los lados de sus piezas van
         asi (en px del cuadro de 3840):

             p10   p25   p50   p75   p90
            20.9  29.5  37.6  45.9  56.1

         y los nuestros daban 7.6 / 12.6 / 21.2 / 31.1 / 47.0.

         Lo que importa es el p10: su pieza MAS CHICA mide lo que medi-
         a nuestra pieza mediana. Ella no tiene polvo. Nosotros si, y
         ese polvo es casi la mitad de las piezas. Por eso las dos
         imagenes cubren lo mismo del cuadro (16-17%) y aun asi no se
         parecen: misma tinta, grano distinto.

         Asi que el piso sube y el rango se angosta. Menos piezas y mas
         grandes, que es exactamente el cambio que ella hizo. */
      /* VUELTO A LOS TAMANOS ORIGINALES a proposito. Yo los habia
         subido para igualar el grano del arte de Olivia, pero Daniel ya
         tiene montadas las capas de adelante y de atras con estos, y si
         el medio sale con otro tamano no pega con las otras dos. El
         cambio de grano queda anotado arriba por si algun dia se
         rehacen las tres juntas; mientras tanto manda la consistencia
         con lo que ya esta en after. */
      var tam = (plano === 0 ? 16 : plano === 1 ? 25 : 35) * (0.5 + r() * 1.1);

      piezas.push({
        plano: plano,
        tipo: r() < 0.18 ? 2 : (r() < 0.55 ? 0 : 1),  /* circulo, cuadro, barra */
        color: PALETA[Math.floor(r() * PALETA.length)],
        x0: r(),
        y0: r(),
        tam: tam * FMT.escala,
        largo: 1 + r() * 1.5,        /* cuanto se estira la barra */
        caidas: caidas,
        giros: giros,
        faseGiro: r(),
        /* cuanto se aparta el giro de ser parejo, en radianes: el papel
           se frena al llegar de canto y se suelta al abrirse otra vez */
        ampGiro: 0.35 + r() * 0.65,
        cicloVaiven: cicloVaiven,
        faseVaiven: faseVaiven,
        ampVaiven: (0.4 + r() * 0.6) * FMT.vaiven,
        cicloVolteo: cicloVolteo,
        /* un cuarto de ciclo detras del vaiven: se voltea cuando va mas
           rapido de lado, no cuando llega al extremo */
        faseVolteo: faseVaiven + 0.25,
        /* Los tres planos van SOLIDOS. Yo los habia velado (0.55 el de
           atras, 0.80 el del medio) para dar aire, pero el diseno que
           mandaron no hace eso: medido sobre su arte, el 75% de los
           pixeles de confeti esta al 100% y el resto es el borde
           suavizado de cada pieza. Velados, lo nuestro daba 41%. Esa
           era la diferencia que se veia y no se sabia nombrar.

           La profundidad no se pierde: ya la cargan el tamano (16/25/35
           de base) y la velocidad (una, dos, tres caidas por vuelta),
           que es como se lee la distancia de verdad. El velo era un
           cuarto indicio, y era el unico que el arte no tenia.

           Con ?velado=1 vuelve lo anterior, para comparar. */
        alfa: velado ? (plano === 0 ? 0.55 : plano === 1 ? 0.8 : 1) : 1
      });
    }
  }

  /* ---- dibujo ---------------------------------------------------- */
  function pintarConfeti(t) {
    var W = FMT.w, H = FMT.h;
    var p01 = (t % L) / L;

    ctxLejos.clearRect(0, 0, W, H);
    ctxCerca.clearRect(0, 0, W, H);

    /* el campo es mas alto que la pantalla por el margen de arriba y
       de abajo: asi el momento en que una pieza da la vuelta al campo
       ocurre siempre fuera de cuadro y no se ve aparecer ni desaparecer */
    var margen = 90 * FMT.escala;
    var campo = H + margen * 2;

    for (var i = 0; i < piezas.length; i++) {
      var q = piezas[i];
      if (soloPlano !== null && q.plano !== soloPlano) continue;
      var ctx = q.plano === 2 ? ctxCerca : ctxLejos;

      /* cae: recorre el campo un numero entero de veces por loop */
      var y = ((q.y0 + q.caidas * p01) % 1) * campo - margen;

      /* y se mece: seno de ciclo entero, asi vuelve a su sitio */
      var x = q.x0 * W +
              Math.sin(TAU * (q.cicloVaiven * p01 + q.faseVaiven)) * q.ampVaiven;

      /* y se voltea, que es lo que delata que es papel y no una
         figurita pegada: el coseno lo achata hasta el canto y lo
         vuelve a abrir, pasando por cero */
      var fVolteo = TAU * (q.cicloVolteo * p01 + q.faseVolteo);
      var volteo = Math.cos(fVolteo);

      /* Gira sobre su eje: vueltas enteras, mas un vaiven del mismo
         ciclo que el volteo. Un giro perfectamente parejo se lee como
         un engranaje; el papel se frena cuando llega de canto y se
         suelta cuando vuelve a abrirse, y ese desfase es casi todo lo
         que hace que parezca papel. El seno tiene ciclo entero, asi que
         el loop sigue cerrando. */
      var ang = TAU * (q.giros * p01 + q.faseGiro) +
                Math.sin(fVolteo) * q.ampGiro;

      /* El confeti de adelante cruza por delante del sello sin apagarse:
         antes se desvanecia al acercarse para no taparlo, y Daniel
         prefiere que pase. */
      ctx.save();
      ctx.globalAlpha = q.alfa;
      ctx.translate(x, y);
      ctx.rotate(ang);
      ctx.scale(1, volteo);
      ctx.fillStyle = q.color;

      if (q.tipo === 2) {
        ctx.beginPath();
        ctx.arc(0, 0, q.tam * 0.42, 0, TAU);
        ctx.fill();
      } else if (q.tipo === 0) {
        ctx.fillRect(-q.tam / 2, -q.tam / 2, q.tam, q.tam);
      } else {
        var a = q.tam * 0.62, b = q.tam * q.largo;
        ctx.fillRect(-a / 2, -b / 2, a, b);
      }
      ctx.restore();
    }
  }

  /* ---- el sello --------------------------------------------------
     Respira y la luz se le mueve por encima. Nada mas: un sello que
     se rearma cada doce segundos, en una pantalla que corre todo el
     dia, se vuelve insoportable a la quinta vuelta. */
  function moverSello(t) {
    var p01 = (t % L) / L;
    var s = elSello.style;
    s.setProperty("--sello-w", FMT.selloW + "px");
    s.setProperty("--sello-escala",
      (1 + Math.sin(TAU * p01) * 0.008).toFixed(5));
  }

  function render(t) {
    pintarConfeti(t);
    moverSello(t);
  }

  /* ---- reloj y teclas -------------------------------------------- */
  var tAhora = 0, corriendo = false, ultimo = 0;
  var hudT = document.getElementById("hud-time");
  var hudM = document.getElementById("hud-mode");
  var hudF = document.getElementById("hud-fmt");

  function pintar() {
    render(tAhora);
    if (hudT) {
      hudT.textContent = tAhora.toFixed(2) + "s";
      hudM.textContent = corriendo ? "CORRIENDO" : "PAUSA";
      hudF.textContent = FMT.w + "×" + FMT.h;
    }
  }

  function paso(ms) {
    if (!corriendo) return;
    if (!ultimo) ultimo = ms;
    tAhora += (ms - ultimo) / 1000;
    ultimo = ms;
    if (tAhora >= L) tAhora -= L;
    pintar();
    requestAnimationFrame(paso);
  }
  function correr() { if (!corriendo) { corriendo = true; ultimo = 0; requestAnimationFrame(paso); } }
  function parar()  { corriendo = false; }
  function ir(v)    { tAhora = Math.max(0, Math.min(L, v)); pintar(); }

  function setFormat(f) {
    var nombre = String(f);
    if (!FORMATOS[nombre]) return;
    FMT = FORMATOS[nombre];
    stage.dataset.format = nombre;
    cvLejos.width = cvCerca.width = FMT.w;
    cvLejos.height = cvCerca.height = FMT.h;
    repartir();
    calce();
    pintar();
  }

  document.addEventListener("keydown", function (e) {
    var g = e.shiftKey ? 0.1 : 1;
    if (e.code === "Space") { e.preventDefault(); corriendo ? parar() : correr(); }
    else if (e.key === "ArrowRight") { parar(); ir(tAhora + g); }
    else if (e.key === "ArrowLeft")  { parar(); ir(tAhora - g); }
    else if (e.key === "1") setFormat("1280");
    else if (e.key === "2") setFormat("3840x990");
    else if (e.key === "3") setFormat("1920");
    else if (e.key === "r" || e.key === "R") ir(0);
    else if (e.key === "h" || e.key === "H") document.body.classList.toggle("hud-off");
  });

  function calce() {
    var k = Math.min(window.innerWidth / FMT.w, window.innerHeight / FMT.h);
    stage.style.transform = "translate(-50%, -50%) scale(" + k + ")";
  }
  window.addEventListener("resize", calce);

  /* ---- arranque --------------------------------------------------- */
  function listo() {
    var fmt = /[?&]format=([0-9x]+)/.exec(window.location.search);
    var dev = /[?&]dev\b/.test(window.location.search);

    /* Los cuadros por segundo los manda la direccion. La animacion no
       cambia: cada cuadro es render(t) y t sale del numero de cuadro,
       asi que subir los fps parte el mismo movimiento en mas pedazos en
       vez de acelerarlo.

       Conviene que coincidan con los de la composicion donde se va a
       montar. 60 dentro de una linea de 24 no entra entero (2.5 a 1):
       after tiene que descartar cuadros de a dos y de a tres alternando,
       y ese tranco desparejo se lee como temblor, no como suavidad. A 24
       sobre 24 cada cuadro renderizado es un cuadro usado. */
    var qf = /[?&]fps=(\d+)/.exec(window.location.search);
    if (qf) {
      var n = parseInt(qf[1], 10);
      if (n > 0) FPS = n;
    }

    /* El largo del loop, para comparar velocidades sin tocar el archivo.
       Cualquier numero sirve para mirar; para exportar conviene uno que
       multiplicado por los fps de un entero, o el ultimo cuadro cae en
       medio de un cuadro y el empalme queda sucio. 45 x 24 = 1080. */
    var ql = /[?&]loop=(\d+(?:\.\d+)?)/.exec(window.location.search);
    if (ql) {
      var sl = parseFloat(ql[1]);
      if (sl > 0) L = sl;
    }
    if (!dev) document.body.classList.add("hud-off");

    /* Tres formas de entregar la misma animacion, para que el sello
       definitivo se pueda montar en After Effects:

         completo  el loop entero, con el sello (lo de siempre)
         plana     todo el confeti sobre blanco liso, sin sello, para
                   recortar el fondo por luminancia
         alfa      lo mismo con transparencia de verdad, sin recortar

       y una profundidad sola, tambien con transparencia:

         atras / medio / adelante

       Los tres apilados en ese orden dan exactamente el loop entero:
       cada plano sale con SU opacidad ya puesta (.55, .8, 1), asi que
       no hay nada que ajustar para que calcen. */
    var PLANOS = { atras: 0, medio: 1, adelante: 2 };
    var capa = /[?&]capa=([a-z]+)/.exec(window.location.search);
    capa = capa ? capa[1] : "completo";
    if (Object.prototype.hasOwnProperty.call(PLANOS, capa)) {
      soloPlano = PLANOS[capa];
      capa = "alfa";               /* un plano solo siempre va con alfa */
    }
    document.documentElement.classList.add("capa-" + capa);
    document.body.classList.add("capa-" + capa);

    setFormat(fmt ? fmt[1] : "1280");

    /* El sello definitivo todavia no llega: mientras tanto va un
       marcador con su tamano y su sitio, para poder juzgar como se
       reparte el confeti alrededor. Se reemplaza entero cuando
       aparezca el vector. */
    var sello = capa === "completo"
      /* el ?v= no es decoracion: el sello cambio de dibujo de prueba a
         logo real y sin esto el navegador sigue sirviendo el viejo */
      ? fetch("assets/sello/cumple.svg?v=2")
          .then(function (r) { return r.ok ? r.text() : null; })
          .then(function (txt) { if (txt) elSello.innerHTML = txt; })
          .catch(function () { /* sin sello el confeti igual corre */ })
      : Promise.resolve();

    sello
      .then(function () {
        return Promise.race([
          document.fonts ? document.fonts.ready : Promise.resolve(),
          new Promise(function (ok) { setTimeout(ok, 6000); })
        ]);
      })
      .catch(function (e) { if (window.console) console.error("preparando:", e); })
      .then(function () {
        calce();
        pintar();
        if (!dev) correr();

        window.__anim = {
          fps: FPS,
          get duration()    { return L; },
          get totalFrames() { return Math.round(L * FPS); },
          seek:      function (v) { parar(); ir(v); },
          seekFrame: function (f) { parar(); ir(f / FPS); },
          setFormat: setFormat,
          capture:   function () { document.body.classList.add("hud-off"); },
          sound:     function () { return false; }
        };
      });
  }

  if (document.readyState === "loading")
    document.addEventListener("DOMContentLoaded", listo);
  else listo();
})();
