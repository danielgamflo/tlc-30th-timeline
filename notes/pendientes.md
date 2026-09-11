# Después del domingo

Cuatro cosas que Daniel preguntó el 10 de septiembre, medidas pero no
hechas. Ninguna se necesita para el estreno; las cuatro se pueden.

---

## 1. Los slides de una misma caja no duran lo mismo

**Es real y es sistemático.** Medido en las 37 cajas con más de un slide:

| fecha | slides | duración de cada uno |
|---|---|---|
| 1996 | 4 | **9,6** / 6,3 / 6,3 / **9,5s** |
| 2017 | 4 | **8,4** / 5,2 / 5,3 / **8,4s** |
| 2001 | 3 | **10,2** / 7,0 / **10,1s** |
| 2016 | 3 | **8,7** / 5,5 / **8,8s** |

El primero y el último duran unos 3,3s más que los del medio. En una caja
de cuatro, los del medio reciben **34% menos tiempo**.

**La causa está en `js/timeline.js`, en el bloque 5 de `render()`:**

```js
var slot = (HOLD - 1.2) / shots.length;
var from = tHold + 0.9 + k * slot;
```

El reparto divide `HOLD - 1.2` en partes iguales, pero:

- el slide 0 ya está en pantalla desde `tHold`, así que se lleva
  `0.9 + slot` — nadie le descuenta esos 0,9 de ventaja
- el último se queda hasta que la tarjeta se va, así que se lleva
  `0.3 + slot`
- los del medio reciben `slot` pelado

**El arreglo:** repartir el hold completo en `n` turnos iguales y poner
los cruces en los límites, en vez de sumar 0,9 al principio. Algo como

```js
var slot = HOLD / shots.length;
var from = tHold + k * slot;      /* el 0 no espera; los demás sí */
```

y comprobar que el último no se corte contra el `EXIT`.

**Antes de darlo por bueno, medir de nuevo con el mismo barrido** (leer la
opacidad de cada slide cada 0,05s y contar cuánto tiempo cada uno es el
visible). Con eso se ve al tiro si quedaron parejos.

**Un caso aparte:** Bible School midió **8,3 / 20,3s** con dos slides. Eso
no lo explica la fórmula de arriba — la diferencia debería ser de 0,6s, no
de 12. Hay algo más ahí y no alcancé a confirmarlo. Revisarlo primero,
porque puede ser otro problema distinto.

---

## 2. Ordenar las fotos por carpeta

Las 160 derivadas están planas en `assets/photos`. Podrían ir en
`assets/photos/1996/`, `assets/photos/2014-santiago/` y así.

Se ve de un vistazo qué foto es de qué fecha y las huérfanas saltan solas.
El costo es que cambian todas las rutas en `data/timeline.json` y el
`slug()` del build, así que hay que rehacer la verificación completa
después. Media hora de trabajo y una de revisión.

**No aporta nada a lo que ve la iglesia.** Por eso va después.

---

## 3. Si Daniel reforma una foto (más vertical, más cuadrada)

No rompe nada mientras el nombre del archivo no cambie —
`tools/scan-sources.py` la detecta por contenido.

**Pero el encuadre sí se ve afectado.** Nueve fotos llevan un `focus`
ajustado a mano contra lo que hay en la imagen:

| fecha | foco | por qué |
|---|---|---|
| 2008 TV | `82% 50%` | Ps John está al 81% del ancho |
| 2009 Axis | `20% 50%` | el orador está al 22% |
| 2014 East Memphis | `88% 50%` | el rótulo azul ocupa el 31% izquierdo |
| 2017 | `32% 50%` | "WELCOME HOME" va del 24% al 36% |

Ese porcentaje es relativo a la foto. Si la foto cambia de forma, el
porcentaje sigue igual pero apunta a otro sitio. **Cuando reforme alguna,
que avise cuál y se le revisa el foco.**

---

## 4. Optimización

Ya se hace y no hay nada que cambiar. Queda anotado el número por si
alguien pregunta:

- origen: 308 archivos, 1.689 MB
- en el video: 160 fotos, **21,3 MB** — 98% menos
- promedio 133 KB, la más pesada 342 KB
- lado largo a 1500px, JPEG progresivo, calidad 72

Es la razón por la que la página abre al instante con 160 imágenes
dentro.
