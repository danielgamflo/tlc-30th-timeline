# Cuadrado 1024 — lo que sigue

Instrucciones de Daniel, noche del 11 de septiembre, para retomar el 12.

---

## 1. El mes va centrado sobre la píldora

Hoy el mes está alineado a la izquierda y la píldora debajo. Debe quedar
centrado respecto de la píldora del año, no del borde del panel.

Es una línea de CSS: el mes vuelve a la columna de la píldora y los dos
se centran entre sí. Ojo con que "September 1" es más ancho que "2026",
así que se centran uno sobre otro, no se alinean por la izquierda.

---

## 2. Las cajas de fotos se dividen de izquierda a derecha

La regla de fondo: **lo que en el 1920 se apila de arriba abajo, en el
cuadrado se reparte de izquierda a derecha.** El panel de fotos del
cuadrado es ancho y bajo, al revés que el del 1920.

| en el 1920 | en el 1024 |
|---|---|
| 1 foto sola | una foto a todo el ancho |
| 2 fotos, una sobre otra | dos lado a lado, media altura completa cada una |
| 3 fotos: 1 arriba grande + 2 abajo | la grande a la izquierda, alto completo; las otras dos apiladas a la derecha, media altura cada una |
| 4 fotos en grilla | igual: dos arriba y dos abajo |

**Pendiente de confirmar con Daniel:** en su nota el segundo caso
mezclaba dos diapositivas ("la foto del slide 1 a la izquierda y las
otras dos a la derecha"). Puede querer decir dos cosas:

- **(a)** que cada diapositiva se resuelva sola, girando 90 grados el
  reparto — que es como está escrita la tabla de arriba;
- **(b)** que en el cuadrado se **fusionen** dos diapositivas del 1920 en
  una sola composición: la foto completa a la izquierda y el par de la
  diapositiva siguiente a la derecha.

La (b) cambia la cantidad de diapositivas y por lo tanto los tiempos de
cada fecha, que hoy se calculan desde el contenido. **Preguntar antes de
tocar.**

---

## 3. Lo que ya quedó hecho anoche

- Geometría de la tarjeta derivada del formato (890×890 en cuadrado).
- Reglas de disposición enganchadas a la forma, no a la resolución.
- Encabezado: mes, píldora de 44px con su sombra ajustada, título al
  lado arrancando a la altura del tope de la píldora.
- Bloque centrado: mismo aire arriba que abajo, sin hueco entre párrafo
  y dato.
- Divisoria horizontal al 50%, dibujada desde el centro.
- Foto: mitad de arriba. Texto: mitad de abajo.
- Los títulos ignoran los saltos de línea escritos para el 1920 y se
  acomodan al ancho del cuadrado.
- **Las 40 fechas medidas: ninguna desborda.**
- El 1920 verificado idéntico, cuadro por cuadro, después de cada cambio.

## 4. Lo que falta además de las fotos

- El riel de tarjetitas y las barras de arriba y abajo siguen
  calibrados para 1920 de ancho.
- Exportar: 33 minutos.
