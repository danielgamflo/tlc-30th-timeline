#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""One labelled sheet of a date's photographs.

The notes name photographs by what is in them - "the lady in the white
shirt and yellow dress", "the two marked half photo", "the room photo,
bottom left" - so acting on them means looking. Opening thirty files one
at a time to find one costs thirty looks; a contact sheet costs one.

    python3 tools/contact-sheet.py 41          the date's own photos
    python3 tools/contact-sheet.py --folder "2004 - Launched Axis"

Each frame is captioned with the exact filename, because the filename is
what goes back into the data.
"""
import os, sys, json, math, subprocess
from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PHOTOS = os.path.join(ROOT, "assets", "photos")
SRC = os.path.join(ROOT, "assets", "30th Anniversary Timeline - 8Sept")
OUT = "/private/tmp/claude-501/-Users-danielgamboaflores/e20d5133-fc1a-4f0b-b5a5-dd9f9eec3536/scratchpad/sheets"

CELL, PAD, CAP = 300, 10, 26
DECODE = {".heic", ".tif", ".tiff", ".cr2"}


def font(sz):
    for p in ("/System/Library/Fonts/Supplemental/Arial Bold.ttf",
              "/System/Library/Fonts/Helvetica.ttc"):
        if os.path.exists(p):
            try: return ImageFont.truetype(p, sz)
            except Exception: pass
    return ImageFont.load_default()


def load(path):
    ext = os.path.splitext(path)[1].lower()
    if ext in DECODE:
        tmp = os.path.join(OUT, "_d.jpg")
        subprocess.run(["sips", "-s", "format", "jpeg", path, "--out", tmp],
                       capture_output=True)
        path = tmp
    im = Image.open(path); im.load()
    return im.convert("RGB")


def sheet(items, title, out):
    """items: [(caption, path)]"""
    n = len(items)
    cols = min(4, max(1, n))
    rows = math.ceil(n / cols)
    W = cols * (CELL + PAD) + PAD
    H = rows * (CELL + CAP + PAD) + PAD + 34
    sh = Image.new("RGB", (W, H), (244, 240, 230))
    dr = ImageDraw.Draw(sh)
    dr.text((PAD, 9), title, font=font(19), fill=(39, 35, 28))

    for i, (cap, p) in enumerate(items):
        x = PAD + (i % cols) * (CELL + PAD)
        y = 34 + PAD + (i // cols) * (CELL + CAP + PAD)
        try:
            im = load(p)
            im.thumbnail((CELL, CELL), Image.LANCZOS)
            sh.paste(im, (x + (CELL - im.width)//2, y + (CELL - im.height)//2))
            dr.rectangle([x, y, x+CELL, y+CELL], outline=(180, 172, 156))
            note = "%dx%d" % Image.open(p).size if os.path.exists(p) else ""
        except Exception as e:
            dr.rectangle([x, y, x+CELL, y+CELL], fill=(220, 210, 195))
            dr.text((x+8, y+8), "no abre", font=font(13), fill=(150,60,40))
            note = str(e)[:24]
        dr.text((x + 2, y + CELL + 4), "%d. %s" % (i+1, cap[:44]),
                font=font(13), fill=(39, 35, 28))
        dr.text((x + 2, y + CELL + 17), note, font=font(11), fill=(130, 124, 110))

    os.makedirs(OUT, exist_ok=True)
    sh.save(out, "JPEG", quality=86)
    return out


def main():
    os.makedirs(OUT, exist_ok=True)
    if "--folder" in sys.argv:
        name = sys.argv[sys.argv.index("--folder") + 1]
        base = os.path.join(SRC, name)
        files = sorted(f for f in os.listdir(base)
                       if not f.startswith(".") and
                       os.path.splitext(f)[1].lower() in
                       {".jpg",".jpeg",".png",".heic",".tif",".tiff",".cr2"})
        items = [(f, os.path.join(base, f)) for f in files]
        out = os.path.join(OUT, "folder-%s.jpg" % name.replace(" ", "-")[:36])
        title = "%s  (%d)" % (name, len(items))
    else:
        did = int(sys.argv[1])
        data = json.load(open(os.path.join(ROOT, "data", "timeline.json")))
        r = [x for x in data if x["id"] == did][0]
        slides = r.get("photos") or ([r["photo"]] if r.get("photo") else [])
        items = []
        for si, s in enumerate(slides):
            for cj, f in enumerate(s if isinstance(s, list) else [s]):
                tag = "d%d" % (si+1) if not isinstance(s, list) \
                      else "d%d.%d" % (si+1, cj+1)
                items.append(("[%s] %s" % (tag, f), os.path.join(PHOTOS, f)))
        out = os.path.join(OUT, "id%d.jpg" % did)
        title = "id %s  %s %s  -  %s" % (did, r["year"], r["label"], r["short"])

    print(sheet(items, title, out))
    for i, (c, p) in enumerate(items):
        print("  %d. %s" % (i+1, c))


if __name__ == "__main__":
    main()
