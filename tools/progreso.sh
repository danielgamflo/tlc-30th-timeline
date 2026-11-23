#!/bin/bash
# Avance del render, en vivo. Acepta uno o varios registros.
#
#   bash tools/progreso.sh /tmp/w1.log /tmp/w2.log /tmp/w3.log
#
# El exportador pinta su avance con retornos de carro y sin saltos de
# línea, así que "tail -f" no muestra nada: hay que convertirlos. Eso es
# lo que hace esto, y además dibuja una barra por parte y el total.
#
# Ctrl+C corta el medidor, NO el render.

[ $# -eq 0 ] && { echo "uso: bash tools/progreso.sh <registro> [registro…]"; exit 1; }

ANCHO=34

while :; do
  SALIDA=""
  SUMA_HECHO=0; SUMA_TOTAL=0; VIVOS=0

  for L in "$@"; do
    NOMBRE=$(basename "$L" .log)
    if [ ! -f "$L" ]; then
      SALIDA+="  $NOMBRE  (sin registro todavía)\n"; continue
    fi

    LINEA=$(tr '\r' '\n' < "$L" | grep 'cuadros' | tail -1)
    FIN=$(tr '\r' '\n' < "$L" | grep '^listo:' | tail -1)

    if [ -n "$FIN" ]; then
      SALIDA+="  $NOMBRE  ✓ $FIN\n"
      HECHO=$(echo "$LINEA" | sed -n 's#.*[^0-9]\([0-9][0-9]*\)/\([0-9][0-9]*\) cuadros.*#\1#p')
      TOTAL=$(echo "$LINEA" | sed -n 's#.*[^0-9]\([0-9][0-9]*\)/\([0-9][0-9]*\) cuadros.*#\2#p')
      SUMA_HECHO=$(( SUMA_HECHO + ${TOTAL:-0} )); SUMA_TOTAL=$(( SUMA_TOTAL + ${TOTAL:-0} ))
      continue
    fi

    if [ -z "$LINEA" ]; then
      SALIDA+="  $NOMBRE  preparando…\n"; VIVOS=$((VIVOS+1)); continue
    fi

    HECHO=$(echo "$LINEA" | sed -n 's#.*[^0-9]\([0-9][0-9]*\)/\([0-9][0-9]*\) cuadros.*#\1#p')
    TOTAL=$(echo "$LINEA" | sed -n 's#.*[^0-9]\([0-9][0-9]*\)/\([0-9][0-9]*\) cuadros.*#\2#p')
    RESTO=$(echo "$LINEA" | sed -n 's#.*faltan \(.*\)#\1#p' | sed 's/  *$//')

    if [ -n "$HECHO" ] && [ "$TOTAL" -gt 0 ] 2>/dev/null; then
      PCT=$(( HECHO * 100 / TOTAL ))
      LLENO=$(( PCT * ANCHO / 100 ))
      BARRA=$(printf '%*s' "$LLENO" '' | tr ' ' '#')
      VACIO=$(printf '%*s' $(( ANCHO - LLENO )) '')
      SALIDA+="  $NOMBRE  [$BARRA$VACIO] ${PCT}%  faltan ${RESTO:-?}\n"
      SUMA_HECHO=$(( SUMA_HECHO + HECHO )); SUMA_TOTAL=$(( SUMA_TOTAL + TOTAL ))
      VIVOS=$((VIVOS+1))
    fi
  done

  clear 2>/dev/null || printf '\033[H\033[2J'
  echo "  render · $(date '+%H:%M:%S')"
  echo
  # %b, no "$SALIDA" a secas: el % del porcentaje es una marca de
  # formato para printf y se comía el número
  printf '%b' "$SALIDA"
  if [ "$SUMA_TOTAL" -gt 0 ] && [ $# -gt 1 ]; then
    echo
    echo "  total: $SUMA_HECHO de $SUMA_TOTAL cuadros  ($(( SUMA_HECHO * 100 / SUMA_TOTAL ))%)"
  fi

  [ "$VIVOS" -eq 0 ] && { echo; echo "  todo terminado."; break; }
  sleep 2
done
