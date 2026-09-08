#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Lift the print pieces out of their scanned pages.

Each PDF is an 8.5x11 sheet with the artwork sitting somewhere on it and
white all around. What we want is the artwork, so the page margin gets
trimmed off — the same bounding-box idea as the letterbox detector, only
looking for white instead of black.

Two things make it more than a threshold:

  * A scan's "white" is never 255. It drifts with the scanner's lamp, so
    the cutoff is measured from the page's own corners rather than fixed.
  * Printer's colour bars and registration marks sit in the margin and
    are NOT white, so a naive bounding box keeps the whole sheet. Rows
    and columns that are mostly white but carry a short dense run get
    dropped before the box is taken.
"""
import os, subprocess, sys, json
import numpy as np
from PIL import Image

SRC = "/Volumes/Danny SSD/THE LIFE CHURCH/MEMPHIS/2026/30th Aniversary Timeline/Working/Web Proyect/assets/30th Anniversary Timeline - 8Sept"
OUT = "/private/tmp/claude-501/-Users-danielgamboaflores/e20d5133-fc1a-4f0b-b5a5-dd9f9eec3536/scratchpad/scans"
DPI = 200
PAD = 6            # px of white kept around the artwork, so it can breathe
INK_FRAC = 0.012   # a line must be this inked to count as content


def page_white(a):
    """the page's own white, read from its four corners"""
    h, w = a.shape
    k = max(8, min(h, w) // 40)
    corners = np.concatenate([a[:k, :k].ravel(), a[:k, -k:].ravel(),
                              a[-k:, :k].ravel(), a[-k:, -k:].ravel()])
    return np.percentile(corners, 60)


def content_box(im):
    a = np.asarray(im.convert("L"), dtype=np.float32)
    h, w = a.shape
    cutoff = page_white(a) - 18            # anything this much darker is ink
    ink = a < cutoff

    rows = ink.mean(axis=1)
    cols = ink.mean(axis=0)

    # a colour bar is a short dense band hugging one edge; real artwork
    # is not confined to the outer twentieth of the sheet
    edge = max(4, int(min(h, w) * 0.05))
    def keep(profile, n):
        k = profile > INK_FRAC
        # drop inked runs that live entirely inside the outer margin
        idx = np.where(k)[0]
        if idx.size == 0: return k
        runs, start = [], idx[0]
        for i in range(1, idx.size):
            if idx[i] != idx[i-1] + 1:
                runs.append((start, idx[i-1])); start = idx[i]
        runs.append((start, idx[-1]))
        main = max(runs, key=lambda r: r[1] - r[0])
        for a_, b_ in runs:
            if (a_, b_) is main: continue
            if b_ < edge or a_ > n - edge:
                k[a_:b_+1] = False
        return k

    rk, ck = keep(rows, h), keep(cols, w)
    if not rk.any() or not ck.any():
        return None
    y0, y1 = np.where(rk)[0][[0, -1]]
    x0, x1 = np.where(ck)[0][[0, -1]]
    return (max(0, x0 - PAD), max(0, y0 - PAD),
            min(w, x1 + 1 + PAD), min(h, y1 + 1 + PAD))


def main():
    os.makedirs(OUT, exist_ok=True)
    seen, report = set(), []
    for root, dirs, files in os.walk(SRC):
        dirs.sort()
        for f in sorted(files):
            if not f.lower().endswith(".pdf") or f.startswith("._"):
                continue
            p = os.path.join(root, f)
            h = subprocess.run(["md5", "-q", p], capture_output=True, text=True).stdout.strip()
            if h in seen:
                report.append({"file": f, "folder": os.path.relpath(root, SRC), "skip": "duplicate"})
                continue
            seen.add(h)

            pages = int(subprocess.run(["pdfinfo", p], capture_output=True, text=True)
                        .stdout.split("Pages:")[1].split()[0])
            for pg in range(1, pages + 1):
                stem = os.path.join(OUT, "tmp")
                subprocess.run(["pdftoppm", "-jpeg", "-r", str(DPI), "-f", str(pg),
                                "-l", str(pg), p, stem], capture_output=True)
                cand = [x for x in os.listdir(OUT) if x.startswith("tmp")]
                if not cand: continue
                raw = os.path.join(OUT, cand[0])
                im = Image.open(raw); im.load(); os.unlink(raw)

                box = content_box(im)
                before = im.size
                if box:
                    im = im.crop(box)
                name = "%s__%s%s.jpg" % (
                    os.path.relpath(root, SRC).replace("/", "_").replace(".", "raiz"),
                    os.path.splitext(f)[0].strip(),
                    "" if pages == 1 else "_p%d" % pg)
                name = name.replace(" ", "-")
                im.save(os.path.join(OUT, name), "JPEG", quality=88, optimize=True)
                report.append({"file": name, "folder": os.path.relpath(root, SRC),
                               "source": f, "page": pg,
                               "before": "%dx%d" % before, "after": "%dx%d" % im.size,
                               "trimmed": round(100 * (1 - (im.size[0]*im.size[1]) /
                                                       (before[0]*before[1]))) })
    with open(os.path.join(OUT, "report.json"), "w") as fh:
        json.dump(report, fh, indent=1)
    for r in report:
        if r.get("skip"):
            print("  dup   %s" % r["file"]); continue
        print("  %-58s %-11s -> %-11s  -%d%%" %
              (r["file"][:58], r["before"], r["after"], r["trimmed"]))
    print("\n%d paginas" % sum(1 for r in report if not r.get("skip")))


if __name__ == "__main__":
    main()
