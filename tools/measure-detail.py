#!/usr/bin/env python3
"""How big a photograph REALLY is, as opposed to how big its file claims.

Several of these arrived as screenshots of a small picture that had already
been blown up on someone's screen. The file is 1500px across and looks fine
in a folder listing, but there is no detail in it above about 400px, and on
an LED wall that is exactly what it looks like.

The test: shrink the image to some fraction of itself and blow it straight
back up. If the result is indistinguishable from the original, that fraction
already held everything there was — so the smallest fraction that still
reproduces the picture IS the real resolution.

    python3 tools/measure-detail.py            # everything in use
    python3 tools/measure-detail.py --all      # every derivative
"""
import json, os, sys
import numpy as np
from PIL import Image

HERE    = os.path.dirname(os.path.abspath(__file__))
PROJECT = os.path.dirname(HERE)
PHOTOS  = os.path.join(PROJECT, "assets", "photos")

STEPS  = [1/16, 1/12, 1/8, 1/6, 1/4, 1/3, 1/2, 2/3]
THRESH = 1.0        # % RMS of the image's own range


def effective(path):
    im = Image.open(path).convert("L")
    w, h = im.size
    a = np.asarray(im, dtype=np.float32)
    rng = float(a.max() - a.min())
    if rng < 1:
        return w
    for f in STEPS:
        sw, sh = max(8, int(w * f)), max(8, int(h * f))
        back = np.asarray(
            im.resize((sw, sh), Image.LANCZOS).resize((w, h), Image.LANCZOS),
            dtype=np.float32)
        if np.sqrt(((a - back) ** 2).mean()) / rng * 100 <= THRESH:
            return int(w * f)
    return w


def flatten(v):
    """a slide may be one photo or a group of them"""
    out = []
    for s in (v or []):
        out.extend(s if isinstance(s, list) else [s])
    return out


def main():
    if "--all" in sys.argv:
        names = sorted(f for f in os.listdir(PHOTOS) if f.endswith(".jpg"))
        where = {}
    else:
        rows = json.load(open(os.path.join(PROJECT, "data", "timeline.json")))
        where, names = {}, []
        for r in rows:
            v = r.get("photos") or ([r["photo"]] if r.get("photo") else [])
            for p in flatten(v):
                if p.lower().endswith((".mp4", ".webm", ".mov")):
                    continue
                where.setdefault(p, "%s %s" % (r["year"], r["short"]))
                if p not in names:
                    names.append(p)

    out = []
    for n in names:
        p = os.path.join(PHOTOS, n)
        if not os.path.exists(p):
            continue
        w = Image.open(p).size[0]
        eff = effective(p)
        out.append({"name": n, "nominal": w, "effective": eff,
                    "ratio": round(eff / w, 3), "where": where.get(n, "")})

    out.sort(key=lambda r: r["effective"])
    print("%-30s %8s %8s   %s" % ("photo", "nominal", "real", "on"))
    for r in out:
        mark = "  INFLATED" if r["ratio"] <= 0.5 else ""
        print("%-30s %8d %8d   %s%s" % (r["name"], r["nominal"], r["effective"],
                                        r["where"], mark))

    with open(os.path.join(HERE, "detail-report.json"), "w") as f:
        json.dump(out, f, indent=1)


if __name__ == "__main__":
    main()
