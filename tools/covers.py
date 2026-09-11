#!/usr/bin/env python3
"""Rewrite data/covers.json from the "-cover" files in assets/photos.

    python3 tools/covers.py

The rail only shows a cover that is on that list, so a file dropped in a
folder does nothing until this runs. It also names any file that says
"cover" but will not be matched — on 11 Sept two had been sitting there
unseen, "billboard-whole-cover.jpg" and "img-001--cover.jpg".
"""
import json, os, re

P = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PHOTOS = os.path.join(P, "assets", "photos")


def flat(x):
    if isinstance(x, list):
        for y in x:
            yield from flat(y)
    elif isinstance(x, str):
        yield x


def twin(f):
    return re.sub(r"(\.[^.]+)$", r"-cover\1", f)


def exists(rel):
    """Exact spelling, capitals included. The drive does not care about
    case and GitHub Pages does, so "portada-cover.jpg" beside
    "Portada.jpg" works on this machine and 404s once published."""
    d, name = os.path.split(os.path.join(PHOTOS, rel))
    return os.path.isdir(d) and name in os.listdir(d)


rows = json.load(open(os.path.join(P, "data", "timeline.json")))
out, matched = [], set()
missing = []
for r in rows:
    for f in flat(r.get("photos") or []):
        if not f.lower().endswith(".mp4") and not exists(f):
            missing.append(f)
for r in rows:
    for f in flat(r.get("photos") or []):
        if exists(twin(f)):
            out.append(f)
            matched.add(twin(f))
            break

with open(os.path.join(P, "data", "covers.json"), "w") as fh:
    json.dump(out, fh, indent=1)
print("%d portadas en data/covers.json" % len(out))

# a file that says "cover" and is itself one of the date's photographs is
# not lost: with no "-cover" twin of its own the rail card crops it too.
# 2023 Make Room ships one picture for both, "Portada-cover.jpg".
for r in rows:
    matched.update(flat(r.get("photos") or []))

stray = []
for dp, dn, fn in os.walk(PHOTOS):
    dn[:] = [d for d in dn if not d.startswith("_")]
    for f in fn:
        rel = os.path.relpath(os.path.join(dp, f), PHOTOS)
        if "cover" in f.lower() and not f.startswith("._") and rel not in matched:
            stray.append(rel)
if stray:
    print("\nno se leen (nombre distinto a la foto + '-cover'):")
    for s in sorted(stray):
        print("  " + s)
if missing:
    print("\nen timeline.json pero no en la carpeta (ojo mayúsculas):")
    for s in missing:
        print("  " + s)
