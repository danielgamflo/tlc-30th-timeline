#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""What changed in the church's folder since the last look.

Daniel re-edits the material in place — straightening scans, filling the
grey and white edges, recentring, and turning the PDFs into images — and
keeps the original filename each time. So a changed photograph announces
itself in no way at all: same path, same name, often a similar size.

This takes a fingerprint of every source file, and on the next run says
what moved.

    python3 tools/scan-sources.py --save     take the baseline
    python3 tools/scan-sources.py            what changed since

Files are paired by STEM, not by full name, because "Invite.pdf" becoming
"Invite.jpg" is one edit and not a deletion beside a new arrival. That
pairing is the whole reason this is not two lines of `md5sum | diff`.
"""
import os, sys, json, hashlib, subprocess

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
SRC  = os.path.join(ROOT, "assets", "30th Anniversary Timeline - 8Sept")
BASE = os.path.join(HERE, "sources.json")

KEEP = {".jpg", ".jpeg", ".png", ".pdf", ".heic", ".tif", ".tiff",
        ".mov", ".mp4", ".cr2"}


def dims(path, ext):
    """pixel size, where asking is cheap. None for anything else."""
    if ext in (".pdf", ".mov", ".mp4", ".cr2"):
        return None
    try:
        out = subprocess.run(["sips", "-g", "pixelWidth", "-g", "pixelHeight", path],
                             capture_output=True, text=True, timeout=20).stdout
        w = h = None
        for line in out.splitlines():
            if "pixelWidth:"  in line: w = int(line.split(":")[1])
            if "pixelHeight:" in line: h = int(line.split(":")[1])
        return [w, h] if w and h else None
    except Exception:
        return None


def scan():
    rows = {}
    for root, folders, files in os.walk(SRC):
        folders.sort()
        for f in sorted(files):
            if f.startswith("._") or f == ".DS_Store":
                continue
            ext = os.path.splitext(f)[1].lower()
            if ext not in KEEP:
                continue
            p = os.path.join(root, f)
            rel = os.path.relpath(p, SRC)
            h = hashlib.md5()
            with open(p, "rb") as fh:
                for chunk in iter(lambda: fh.read(1 << 20), b""):
                    h.update(chunk)
            rows[rel] = {"size": os.path.getsize(p),
                         "md5": h.hexdigest(),
                         "dims": dims(p, ext)}
    return rows


def stem(rel):
    """folder + filename without extension — what survives a conversion"""
    d, f = os.path.split(rel)
    return os.path.join(d, os.path.splitext(f)[0]).lower()


def human(n):
    return "%.1fMB" % (n / 1e6) if n >= 1e6 else "%dKB" % round(n / 1e3)


def shape(row):
    d = row.get("dims")
    return "%dx%d" % (d[0], d[1]) if d else "-"


def main():
    if not os.path.isdir(SRC):
        sys.exit("no encuentro la carpeta de origen:\n  %s" % SRC)

    now = scan()

    if "--save" in sys.argv or not os.path.exists(BASE):
        with open(BASE, "w") as fh:
            json.dump(now, fh, indent=1, sort_keys=True, ensure_ascii=False)
        print("linea base guardada: %d archivos" % len(now))
        print("  %s" % os.path.relpath(BASE, ROOT))
        return

    was = json.load(open(BASE))

    changed = [k for k in now if k in was and now[k]["md5"] != was[k]["md5"]]
    gone    = [k for k in was if k not in now]
    fresh   = [k for k in now if k not in was]

    # a file that left and one that arrived under the same stem is one
    # edit — most often a PDF that became a JPG
    by_stem = {}
    for k in gone:
        by_stem.setdefault(stem(k), {})["from"] = k
    for k in fresh:
        by_stem.setdefault(stem(k), {})["to"] = k
    converted = [(v["from"], v["to"]) for v in by_stem.values()
                 if "from" in v and "to" in v]
    paired = {x for pair in converted for x in pair}
    gone  = [k for k in gone  if k not in paired]
    fresh = [k for k in fresh if k not in paired]

    if not (changed or converted or gone or fresh):
        print("sin cambios — %d archivos, iguales a la linea base" % len(now))
        return

    if converted:
        print("\nCONVERTIDOS  (%d)" % len(converted))
        for a, b in sorted(converted):
            print("  %s" % a)
            print("    -> %-52s %-11s %s"
                  % (os.path.basename(b), shape(now[b]), human(now[b]["size"])))

    if changed:
        print("\nEDITADOS  (%d)" % len(changed))
        for k in sorted(changed):
            a, b = was[k], now[k]
            note = ""
            if a.get("dims") and b.get("dims") and a["dims"] != b["dims"]:
                note = "   %s -> %s" % (shape(a), shape(b))
            print("  %-58s %s -> %s%s"
                  % (k[:58], human(a["size"]), human(b["size"]), note))

    if fresh:
        print("\nNUEVOS  (%d)" % len(fresh))
        for k in sorted(fresh):
            print("  %-58s %-11s %s" % (k[:58], shape(now[k]), human(now[k]["size"])))

    if gone:
        print("\nBORRADOS  (%d)" % len(gone))
        for k in sorted(gone):
            print("  %s" % k)

    print("\n%d archivos en total. Guarda la nueva linea base con --save "
          "despues de reconstruir." % len(now))


if __name__ == "__main__":
    main()
