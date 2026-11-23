#!/usr/bin/env python3
"""Revisa una carpeta de fotos maestras antes de montarlas.

    python3 tools/revisar-fotos.py 01-1996-first-celebration-service
    python3 tools/revisar-fotos.py            # todas las carpetas

La medida es 1000x1000. Ahí caben los dos recortes sin agrandar nada:
el 1920 saca una caja vertical de 889x1000 y el cuadrado una franja
apaisada de 1000x500. Lo importante de la foto tiene que vivir en la
intersección de las dos: una ventana centrada de 890x500.

Esto mide el archivo, no juzga el encuadre. Lo segundo se ve mirando.
"""
import os, sys
from PIL import Image

P = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PHOTOS = os.path.join(P, "assets", "photos")
LADO = 1000

def revisar(carpeta):
    d = os.path.join(PHOTOS, carpeta)
    if not os.path.isdir(d):
        print("no existe la carpeta:", carpeta); return 1

    archivos = sorted(f for f in os.listdir(d)
                      if not f.startswith("._") and f != ".DS_Store"
                      and os.path.splitext(f)[1].lower() in (".jpg", ".jpeg", ".png"))
    if not archivos:
        print("  (vacía)"); return 0

    print("\n" + carpeta)
    problemas = 0
    for f in archivos:
        p = os.path.join(d, f)
        try:
            w, h = Image.open(p).size
        except Exception as e:
            print("  ✗ %-46s no se puede abrir (%s)" % (f, e)); problemas += 1; continue

        kb = os.path.getsize(p) // 1024
        nota = []

        # "-cover" es la terminación con que la pieza busca la miniatura del
        # riel. Una foto de 1000x1000 que se llame así no es una miniatura:
        # es un nombre que algún día va a confundirse con una.
        # La miniatura del riel se busca como "<foto>-cover". Un nombre que
        # termine en -cover solo estorba si además existe la foto sin ese
        # sufijo al lado: ahí la pieza tomaría una por la otra. Terminar en
        # -cover, por sí solo, no molesta a nadie.
        raiz, ext = os.path.splitext(f)
        suena_a_cover = raiz.lower().endswith("-cover")
        gemela = raiz[:-6] + ext
        if suena_a_cover and (w, h) == (212, 140):
            pass                                   # es una miniatura, y está bien
        else:
            if suena_a_cover and gemela in archivos:
                nota.append("choca con %s: la pieza lo tomaría como su "
                            "miniatura de riel" % gemela)
            if (w, h) != (LADO, LADO):
                nota.append("debe ser %dx%d" % (LADO, LADO))

        if kb > 400:
            nota.append("pesa %d KB, conviene bajar la calidad" % kb)

        marca = "✗" if nota else "·"
        if nota: problemas += 1
        print("  %s %-46s %5dx%-5d %5dKB  %s" % (marca, f, w, h, kb, "; ".join(nota)))

    print("  %d archivo(s), %d con algo que revisar" % (len(archivos), problemas))
    return problemas

if __name__ == "__main__":
    objetivo = sys.argv[1:] or sorted(x for x in os.listdir(PHOTOS)
                                      if os.path.isdir(os.path.join(PHOTOS, x))
                                      and not x.startswith("_"))
    total = sum(revisar(c.rstrip("/")) for c in objetivo)
    print("\nresumen: %d cosa(s) por revisar" % total)
