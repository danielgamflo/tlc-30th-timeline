#!/usr/bin/env python3
"""
build-photos.py — rebuild assets/photos/ from the church's originals.

    python3 tools/build-photos.py            # build everything
    python3 tools/build-photos.py --report   # inventory only, writes nothing

Always rebuilds from the ORIGINALS. Never re-compress a derivative: two
passes of q72 on the same picture is visible on a 5760px screen even when
it is invisible here.

Four things happen to every file, in this order:

1. decode. HEIC and CR2 go through `sips` (Apple's own decoders — no
   third-party dependency, and the CR2 gets Apple's raw pipeline). A .MOV
   gives up one frame via ffmpeg.
2. orient. EXIF orientation is applied and then stripped, because CSS
   `object-fit` does not read EXIF and three of these files are rotated.
3. letterbox. Archive material carries baked-in black bars from VHS and
   4:3 telecine. A row is cropped only when it is dark AND uniform: a
   synthetic bar has almost no pixel variance, a dark auditorium ceiling
   has plenty, and cropping on darkness alone ate real content the first
   time this ran.
4. resize + encode. 1500px long edge, JPEG q72, progressive. The card
   photo is never displayed above ~750px even on the 5760 canvas, so
   1500 is a 2x buffer for the slow zoom.
"""

import json, os, re, subprocess, sys, tempfile, unicodedata
from PIL import Image, ImageOps
import numpy as np

HERE     = os.path.dirname(os.path.abspath(__file__))
PROJECT  = os.path.dirname(HERE)
ORIGINALS= os.path.join(PROJECT, "assets", "30th Anniversary Timeline Photos")
OUT      = os.path.join(PROJECT, "assets", "photos")
MAP      = os.path.join(HERE, "photo-map.json")

LONG_EDGE   = 1500
QUALITY     = 72
DARK        = 30     # mean value below which a row may be a bar
UNIFORM     = 5.0    # std-dev above which the row is real picture, not a bar
CEILING     = 60     # and no pixel in it may be brighter than this. a bar is
                     # synthetic and has no highlights at all; a dark
                     # auditorium ceiling always has a lamp or a speaker edge
                     # in it, and darkness alone kept eating those.
MAX_ASPECT  = 2.0    # never crop a photo past this — beyond it the portrait
                     # frame is destroying the composition, not saving it

# A rotation the file's own EXIF does not declare. Degrees counter-clockwise,
# so -90 turns the picture clockwise. IMG_1224.HEIC was shot portrait but
# carries no orientation tag that sips or PIL can read, so it decodes on its
# side and nothing downstream can know: the correction has to be stated here.
FORCE_ROTATE = {
    "makeroom-tables-a.jpg": -90,
}


# ---------------------------------------------------------------- resolve

def loose(name):
    """A filename reduced to what a human would call the same name.

    macOS names its screenshots with U+202F before the "PM", and the finder
    shows it as an ordinary space — so a map typed by hand never matches
    the file on disk. Normalise unicode, fold every kind of space, and
    compare case-insensitively.
    """
    n = unicodedata.normalize("NFC", name)
    n = re.sub(r"[\s    -​]+", " ", n)
    return n.strip().lower()


def resolve(src_rel):
    """Map path -> real path on disk, tolerating whitespace differences."""
    exact = os.path.join(ORIGINALS, src_rel)
    if os.path.exists(exact):
        return exact

    want_dir, want_file = os.path.split(src_rel)
    base = os.path.join(ORIGINALS, want_dir)
    if not os.path.isdir(base):
        for d in os.listdir(ORIGINALS):
            if loose(d) == loose(want_dir):
                base = os.path.join(ORIGINALS, d)
                break
    for f in os.listdir(base):
        if loose(f) == loose(want_file):
            return os.path.join(base, f)

    raise FileNotFoundError(src_rel)


# ---------------------------------------------------------------- decode

def decode(path):
    """Any of the five input kinds -> an upright RGB PIL image."""
    ext = os.path.splitext(path)[1].lower()

    if ext == ".mov":
        # one frame, from far enough in that the titles have settled
        tmp = tempfile.mktemp(suffix=".png")
        subprocess.run(["ffmpeg", "-v", "error", "-ss", "9", "-i", path,
                        "-frames:v", "1", "-y", tmp], check=True)
        im = Image.open(tmp); im.load(); os.unlink(tmp)
        return im.convert("RGB")

    if ext in (".heic", ".cr2"):
        tmp = tempfile.mktemp(suffix=".jpg")
        subprocess.run(["sips", "-s", "format", "jpeg", "-s", "formatOptions", "95",
                        path, "--out", tmp], capture_output=True, check=True)
        im = Image.open(tmp); im.load(); os.unlink(tmp)
        return im.convert("RGB")

    im = Image.open(path)
    im = ImageOps.exif_transpose(im)      # apply, then drop, the orientation tag
    return im.convert("RGB")


# ------------------------------------------------------------- letterbox

def bar_extent(rows, limit):
    """How many leading rows are dark AND uniform AND unlit, capped at `limit`."""
    n = 0
    for i in range(limit):
        mean, std, peak = rows[i]
        if mean < DARK and std < UNIFORM and peak < CEILING:
            n += 1
        else:
            break
    return n


def strip_letterbox(im):
    """Crop baked-in bars on all four edges. Returns (image, note or None)."""
    a = np.asarray(im.convert("L"), dtype=np.float32)
    h, w = a.shape

    def profile(arr):
        return list(zip(arr.mean(axis=1), arr.std(axis=1), arr.max(axis=1)))

    rows = profile(a)
    cols = profile(a.T)

    lim_v, lim_h = int(h * 0.30), int(w * 0.30)
    top    = bar_extent(rows, lim_v)
    bottom = bar_extent(rows[::-1], lim_v)
    left   = bar_extent(cols, lim_h)
    right  = bar_extent(cols[::-1], lim_h)

    if not (top or bottom or left or right):
        return im, None

    nw, nh = w - left - right, h - top - bottom
    if nw < 200 or nh < 200:
        return im, None

    # refuse a crop that turns the picture into a letterbox of our own
    if max(nw / nh, nh / nw) > MAX_ASPECT and max(w / h, h / w) <= MAX_ASPECT:
        return im, None

    return (im.crop((left, top, left + nw, top + nh)),
            "cropped %dt %db %dl %dr" % (top, bottom, left, right))


# ------------------------------------------------------------------ main

def build(src_rel, dst_name, report_only):
    src = resolve(src_rel)
    im  = decode(src)
    ow, oh = im.size

    if dst_name in FORCE_ROTATE:
        im = im.rotate(FORCE_ROTATE[dst_name], expand=True)

    im, crop = strip_letterbox(im)

    if max(im.size) > LONG_EDGE:
        im.thumbnail((LONG_EDGE, LONG_EDGE), Image.LANCZOS)
        scaled = True
    else:
        scaled = False        # never upscale — it only adds bytes

    kb = 0
    if not report_only:
        os.makedirs(OUT, exist_ok=True)
        dst = os.path.join(OUT, dst_name)
        im.save(dst, "JPEG", quality=QUALITY, optimize=True, progressive=True)
        kb = os.path.getsize(dst) // 1024

    return {
        "source": src_rel, "name": dst_name,
        "original": "%dx%d" % (ow, oh), "final": "%dx%d" % im.size,
        "kb": kb, "crop": crop, "upscaled_source": not scaled,
    }


def main():
    report_only = "--report" in sys.argv
    with open(MAP) as f:
        mapping = {k: v for k, v in json.load(f).items() if not k.startswith("_")}

    rows, total = [], 0
    for src_rel, dst_name in mapping.items():
        try:
            r = build(src_rel, dst_name, report_only)
        except Exception as e:
            print("FAIL  %-34s %s" % (dst_name, e))
            continue
        rows.append(r); total += r["kb"]
        print("%-30s %-11s -> %-11s %5dKB %s%s" % (
            r["name"], r["original"], r["final"], r["kb"],
            r["crop"] or "",
            "  [source under 1500px]" if r["upscaled_source"] else ""))

    print("\n%d files, %.1f MB" % (len(rows), total / 1024))

    with open(os.path.join(HERE, "photo-report.json"), "w") as f:
        json.dump(rows, f, indent=1)


if __name__ == "__main__":
    main()
