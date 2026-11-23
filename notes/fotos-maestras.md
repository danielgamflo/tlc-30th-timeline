# Una sola foto para los dos formatos

Decisión de Daniel, 12 de septiembre. Baja de nuevo todo el Dropbox y
rehace las fotos con margen, en vez de mantener dos juegos.

---

## La medida

**1000 × 1000 px, cuadrada, misma carpeta y mismo nombre de siempre.**

Con eso ninguna foto se agranda en ningún formato. Las dos cajas más
exigentes son:

| formato | caja más exigente | recorte dentro del maestro |
|---|---|---|
| 1920 | foto sola, 824×927 | 889 × 1000 (vertical) |
| 1024 | foto sola, 884×442 | 1000 × 500 (apaisada) |

## La zona segura

Lo importante — caras, texto, el sujeto — va dentro de una franja
**centrada del 89% del ancho por el 50% del alto**. En 1000×1000, una
ventana de **890 × 500** al centro.

El 1920 se come un 5% por lado; el cuadrado bota un 25% arriba y otro
25% abajo. Lo único que sobrevive a ambos es esa intersección.

Ese 50% de alto es el costo real de un archivo único. Es trabajable si
los originales son generosos; si una foto no tiene ese aire, conviene
darle una versión propia para el cuadrado en vez de forzarla.

## Lo que se invalida

**Los encuadres ya ajustados**, en los dos formatos. El foco es un
porcentaje sobre la foto: si la foto cambia de forma, el mismo número
apunta a otra parte. Con el maestro bien centrado, casi todo vuelve a
"50% 50%" y el repaso es corto.

Los valores que había el 12-sep quedan en git, en `data/timeline.json`
(`focus` para el 1920, `focusSq` para el cuadrado), por si hay que
volver.

## Lo que NO cambia

- Nombres de archivo y carpetas: si se respetan, no hay que tocar el
  código ni el JSON.
- El MP4 del 1920 ya exportado, que es la entrega aprobada.
- Las portadas del riel (`-cover`, 212×140), que son aparte.

## Cómo se revisa cada carpeta

Medir la foto en los dos formatos antes de seguir con la siguiente:
cuánto se agranda (debe ser 1.00) y qué queda fuera del recorte en cada
uno. La primera carpeta se revisa entera; después, por muestreo.
