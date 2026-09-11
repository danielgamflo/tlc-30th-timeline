#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Qué fotos editó Daniel a mano dentro de assets/photos.

El build genera esa carpeta, así que una corrida suya borraría cualquier
retoque hecho ahí. Esto compara contra la huella que dejó el último build
y lista lo que cambió, para poder protegerlo antes de reconstruir.

    python3 tools/mis-ediciones.py            qué cambió
    python3 tools/mis-ediciones.py --salvar   copia lo cambiado a un lado
"""
import os, sys, json, hashlib, shutil
P = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(P, "assets", "photos")
BASE = os.path.join(P, "tools", "photos-baseline.json")
SALVA = os.path.join(P, "assets", "_editadas-a-mano")

def main():
    base = json.load(open(BASE))
    cambiadas, nuevas = [], []
    for dp, dn, fn in os.walk(OUT):
        for f in fn:
            if f.startswith("."): continue
            p = os.path.join(dp, f)
            rel = os.path.relpath(p, OUT)
            h = hashlib.md5(open(p, "rb").read()).hexdigest()
            if rel not in base: nuevas.append(rel)
            elif base[rel] != h: cambiadas.append(rel)

    if not cambiadas and not nuevas:
        print("nada editado a mano desde el ultimo build")
        return
    if cambiadas:
        print("EDITADAS A MANO (%d):" % len(cambiadas))
        for r in sorted(cambiadas): print("   %s" % r)
    if nuevas:
        print("\nNUEVAS, no las hizo el build (%d):" % len(nuevas))
        for r in sorted(nuevas): print("   %s" % r)

    if "--salvar" in sys.argv:
        n = 0
        for rel in cambiadas + nuevas:
            dst = os.path.join(SALVA, rel)
            os.makedirs(os.path.dirname(dst), exist_ok=True)
            shutil.copy2(os.path.join(OUT, rel), dst); n += 1
        print("\ncopiadas %d a assets/_editadas-a-mano/" % n)
        print("el build ya no las puede perder; se devuelven desde ahi")

if __name__ == "__main__":
    main()
