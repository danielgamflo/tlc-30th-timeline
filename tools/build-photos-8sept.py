#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Pick, process and place the 8-Sept material.

Selection follows the doc's photo notes where they exist ("start with
Ps John preview, collage w/ next 3, then original team on its own") and
a plain rule where they do not: the marked COVER opens, then up to four
more gathered into one grid, then singles. Six photographs is the
ceiling — the hold is 9.5s and past six nothing is on screen long enough
to register.
"""
import os, re, json, subprocess, tempfile, shutil, unicodedata
import numpy as np
from PIL import Image, ImageOps

P    = "/Volumes/Danny SSD/THE LIFE CHURCH/MEMPHIS/2026/30th Aniversary Timeline/Working/Web Proyect"
SRC  = os.path.join(P, "assets", "30th Anniversary Timeline - 8Sept")
SCAN = "/private/tmp/claude-501/-Users-danielgamboaflores/e20d5133-fc1a-4f0b-b5a5-dd9f9eec3536/scratchpad/scans"
OUT  = os.path.join(P, "assets", "photos")

LONG_EDGE, QUALITY = 1500, 72

# ---- what each date shows, in order. a list inside the list is a grid.
# "@name" is one of the print pieces lifted out of a PDF. This list
# is the SOURCE of each picture, not the running order any more —
# the order lives in data/timeline.json, where it was reviewed.
PLAN = {
 1:  ["1996 Launch/1996-Ps-John-preview-service-COVER.jpg",
      ["1996 Launch/1996.png", "1996 Launch/1997 Homebuilders.jpg",
       "1996 Launch/1997.png"],
      "@1996-Launch__original-team.jpg",
      ["1996 Launch/meeting in the home 01.png",
       "1996 Launch/meeting in the home 02.png",
       "1996 Launch/meeting in the home 03.png"]],
 2:  ["1998 Mission Trip/COVER.jpg",
      ["1998 Mission Trip/Brazil-Missions-Team-1.jpg",
       "1998 Mission Trip/Brazil-Missions-Team-2.jpg",
       "1998 Mission Trip/Mexico Missions 2000.jpg",
       "1998 Mission Trip/Screenshot 2026-09-03 at 3.21.19 PM.png"]],
 40: ["1999 Permanent Office Space/Ps John Homebuilders-COVER.jpg",
      "1999 Permanent Office Space/Baptism.jpg",
      ["1999 Permanent Office Space/Mailer.jpg",
       "1999 Permanent Office Space/Kids-Life-Publication",
       "1999 Permanent Office Space/Screenshot-2026-09-03-at-3.3310 PM.jpg"]],
 3:  ["2000 First Billboard/billboard.jpg",
      ["@raiz__2004-mailer-front.jpg", "@raiz__2004-mailer-back.jpg"]],
 4:  ["2001 5th Anniversary/2001-New-campaign-cover.jpg",
      ["2001 5th Anniversary/Picnic.jpg",
       "2001 5th Anniversary/Zach VB Church Picnic 2001- Kelly Mayberry Emma Pier.tiff",
       "2001 5th Anniversary/Ps John Birthday.png",
       "2001 5th Anniversary/2001.JPG"],
      "@2001-5th-Anniversary__2001-Missions-Trifold.jpg",
      "@2001-5th-Anniversary__2001--21-days-of-prayer-and-fasting.jpg"],
 5:  ["2002 A - First Service at GTP/2004.jpg",
      "2002 A - First Service at GTP/GTP renovation.jpg",
      # the Celebrate! mailer used to sit here as a fourth cell. It sends
      # readers to the Home Builders Association Building, which is the
      # building the church LEFT on this date, and the same piece already
      # runs in 1999 where it belongs.
      ["2002 A - First Service at GTP/2004 Building Front.JPG",
       "2002 A - First Service at GTP/IMG_2554 - mayberrystories Emma Pier.jpeg",
       "2002 A - First Service at GTP/IMG_1577.JPG"]],
 6:  ["2002 B - Hosted Reinhard Bonnke/Miracle Service Invite.png",
      "2002 B - Hosted Reinhard Bonnke/Reinhard Bonnke Invite.png"],
 41: ["2004 - Launched Axis/axiswed.JPG",
      ["2004 - Launched Axis/IMG_7050.JPG", "2004 - Launched Axis/axis boys.jpg",
       "2004 - Launched Axis/axis room.jpg", "2004 - Launched Axis/axis 2012.jpg"],
      "2004 - Launched Axis/Photo_2026-08-16_200551 - Melissa Horn Emma Pier.jpeg"],
 8:  ["2005 B - Launched First Year of internship/2005 First Class of Damascus Road-COVER.JPG",
      ["2005 B - Launched First Year of internship/468223048_10162941475054587_9191860633540407670_n.jpg",
       "2005 B - Launched First Year of internship/IMG_0707.JPG"]],
 9:  ["2005 C - Katrina/Katrina relief trip to Biloxi, Mississippi - COVER.jpeg",
      ["2005 C - Katrina/Katrina relief trip - Melissa Horn Emma Pier.jpeg",
       "2005 C - Katrina/Katrina relief1.jpg",
       "2005 C - Katrina/Photo_2026-08-16_200140 - Melissa Horn Emma Pier.jpeg"]],
 12: ["2008 B - Launched TV Program/2009 Ps John GTP.JPG",
      "2008 B - Launched TV Program/2008.png"],
 11: ["2008 A - First Make Room/2011.jpg", "2008 A - First Make Room/IMG_8198.JPG"],
 13: ["2008 C - Launched Collierville Location/2008 YMCA launch sign.JPG",
      ["2008 C - Launched Collierville Location/IMG_0411.JPG",
       "2008 C - Launched Collierville Location/IMG_0708.JPG"]],
 14: ["2009 - First Axis Conf/2009-COVER.JPG",
      ["2009 - First Axis Conf/2009 Axis Conf Tribal Wars.JPG",
       "2009 - First Axis Conf/Axis Conf GTP.JPG",
       "2009 - First Axis Conf/IMG_7025.JPG",
       "2009 - First Axis Conf/IMG_9285.JPG"]],
 15: ["2011 - Launched Feed Memphis/Screenshot 2026-09-09 at 3.21.55 PM- COVER.png",
      ["2011 - Launched Feed Memphis/Photo Mar 29 2019, 2 43 44 PM.jpg", "2011 - Launched Feed Memphis/Photo May 03 2019, 2 44 27 PM.jpg", "2011 - Launched Feed Memphis/Photo Oct 20 2017, 2 38 22 PM.jpg", "2011 - Launched Feed Memphis/Screenshot 2026-09-08 at 4.53.20 PM.png"]],
 16: ["2014 A - Launched East Memphis at Paradiso/471858485_10163191145089587_3370435142301144151_n.jpg",
      "2014 A - Launched East Memphis at Paradiso/2015.jpg",
      "2014 A - Launched East Memphis at Paradiso/468151643_10162920441999587_430435861007173487_n.jpg"],
 18: ["2014 C - Hosted First Zoe Conf/2016.jpg", "2014 C - Hosted First Zoe Conf/2014.jpg"],
 20: ["2015 B - Hosted first Sound of Christmas/122124SOC_EMSOCSOC_EMep-90.JPG",
      ["2015 B - Hosted first Sound of Christmas/SOC Ps John & Leslie.jpg",
       "2015 B - Hosted first Sound of Christmas/SOC older.jpg",
       "2015 B - Hosted first Sound of Christmas/SOC older 2.jpg",
       "2015 B - Hosted first Sound of Christmas/soc 2026.jpg"]],
 21: ["2016 - broke ground on HSL Auditorium/E26A1462.CR2",
      ["2016 - broke ground on HSL Auditorium/468537246_10163101653019587_1576519272855988296_n.jpg",
       "2016 - broke ground on HSL Auditorium/468573758_10163071502734587_3456830922896276395_n.jpg",
       "2016 - broke ground on HSL Auditorium/468364610_10162948939924587_5581172339767256442_n.jpg"]],
 22: ["2017 - Houston Levee Auditorium Grand Opening/Screenshot 2026-08-25 at 12.15.03 PM.png",
      "2017 - Houston Levee Auditorium Grand Opening/stnadalone photo.png",
      ["2017 - Houston Levee Auditorium Grand Opening/half photo.png", "2017 - Houston Levee Auditorium Grand Opening/half photo 2.png"],
      "2017 - Houston Levee Auditorium Grand Opening/VP Night .png"],
 24: [["2019 Record 21 Mission Trips/Cuba_Missions-SM-23.jpg",
       "2019 Record 21 Mission Trips/DeLDfHyYTsq0VR%fiIdtmA.jpg",
       "2019 Record 21 Mission Trips/IMG_0044.JPG",
       "2019 Record 21 Mission Trips/IMG_0634.JPG"],
      "2019 Record 21 Mission Trips/1O9A0200.jpg",
      "2019 Record 21 Mission Trips/Cuba_Missions-SM-49.jpg"],
 25: ["2020 A - Launched The Life Church New York/IMG_0767-COVER.jpg",
      ["2020 A - Launched The Life Church New York/20230329_ny_jc-0036.JPG", "2020 A - Launched The Life Church New York/IMG_0766.jpg"]],
 42: ["2020 B - Leadership in B&W Podcast Launched/KLP-2607-Leadership-in-Black-and-White-Audio-800x800.JPG",
      ["2020 B - Leadership in B&W Podcast Launched/20221208_LIBW_JC-0008.HEIC", "2020 B - Leadership in B&W Podcast Launched/IMG_0769.jpg", "2020 B - Leadership in B&W Podcast Launched/IMG_0770.jpg"]],
 26: ["2021 A - Launched MA Location/_DSC4059.jpg",
      ["2021 A - Launched MA Location/20250411-20250411-DR-MA03744.jpg",
       "2021 A - Launched MA Location/20250411-20250411-DR-MA03758.jpg",
       "2021 A - Launched MA Location/20250411-20250411-LG-NY5094.jpg"]],
 27: ["2021 B - Celebrated 25 Years/25thAnv_2-COVER.jpg",
      ["2021 B - Celebrated 25 Years/ 111321-HSL-JP-1-2.jpg", "2021 B - Celebrated 25 Years/IMG_7117.JPG", "2021 B - Celebrated 25 Years/IMG_7120.JPG", "2021 B - Celebrated 25 Years/IMG_7122.JPG"]],
 29: ["2022 B - Axis Conf Sells Out/mondaypm-ch-29 drop box.JPG",
      # AD37EEF1 was the same instant as thursdaypm-ch-20 — same song, same
      # flames, same people, a tighter crop seconds apart — and the two sat
      # in one grid together
      ["2022 B - Axis Conf Sells Out/thursdaypm-ch-20 drop box.JPG",
       "2022 B - Axis Conf Sells Out/wednesdaypm_brynn-52 brynn vanblaricom.JPG",
       "2022 B - Axis Conf Sells Out/0D07ED76-31E0-4586-90B4-5F1261EB56AB.JPG"]],
 32: ["2024 A - Hosted First Revival Nights/IMG_0775-COVER.jpg",
      ["2024 A - Hosted First Revival Nights/RN-1080X1080-collage 1.jpg", "2024 A - Hosted First Revival Nights/IMG_0209-collage .jpeg", "2024 A - Hosted First Revival Nights/IMG_0217-collage.jpeg", "2024 A - Hosted First Revival Nights/IMG_0776-collage 3.jpg"]],
 30: ["2023 A - Launched DC Metro Location/031923-JB-41.jpg",
      ["2023 A - Launched DC Metro Location/031923-JB-35.jpg",
       "2023 A - Launched DC Metro Location/031923-JB-49.jpg"]],
 31: ["2023 B - Hosted First International Make Room/photo 2024-05-03, 10 00 11.JPG"],
 33: ["2024 B - Launched South Africa Location/IMG_0780-cover.jpg",
      ["2024 B - Launched South Africa Location/DSC02519-collage.JPG", "2024 B - Launched South Africa Location/0E6B3014-collage.JPG", "2024 B - Launched South Africa Location/0E6B3491-collage.JPG", "2024 B - Launched South Africa Location/012424_REVIVAL_ep-77 collage.jpg"]],
 34: ["2024 C - Launched First Prison Location/062324-SCDC-CH-4.jpg",
      ["2024 C - Launched First Prison Location/062324-SCDC-CH-8.jpg",
       "2024 C - Launched First Prison Location/SCDC-1.png",
       "2024 C - Launched First Prison Location/SCDC-2.png"]],
 35: ["2024 D - Axis Worship Debut/overflow cover.jpg",
      ["2024 D - Axis Worship Debut/AxisConf24-WEDPM-23.jpg",
       "2024 D - Axis Worship Debut/AxisConf24-WEDPM-24.jpg",
       "2024 D - Axis Worship Debut/Axis Worship PFP.JPG"]],
 36: ["2024 E - Launched Nashville Location/060924_NASH_CH-25.jpg",
      ["2024 E - Launched Nashville Location/NASH-SIGNPHOTO.png",
       "2024 E - Launched Nashville Location/_NASH_CB_2.jpg"]],
 37: ["2025 - Launched 2nd Prison Location 201 Poplar/PRISON-2.jpg",
      ["2025 - Launched 2nd Prison Location 201 Poplar/PRISON-4.jpg",
       "2025 - Launched 2nd Prison Location 201 Poplar/PRISON-5.jpg",
       "2025 - Launched 2nd Prison Location 201 Poplar/PRISON-6.jpg",
       "2025 - Launched 2nd Prison Location 201 Poplar/PRISON-8.jpg"]],
 38: ["2026 - Ground Breaking on Global Hub/08.06.26_GROUNDBREAKING_CS-50.jpg",
      ["2026 - Ground Breaking on Global Hub/08.06.26_GROUNDBREAKING_CS-12.jpg",
       "2026 - Ground Breaking on Global Hub/08.06.26_GROUNDBREAKING_CS-89.jpg",
       "2026 - Ground Breaking on Global Hub/260806 Ground Breaking 1.jpg",
       "2026 - Ground Breaking on Global Hub/Sb1OXoLg.jpeg"]],
 39: ["2026 - Launched Bible School/08.30.26_LLBS_CS-52-cover.jpg",
      ["2026 - Launched Bible School/08.30.26_LLBS_CS-60-collage- top big.jpg", "2026 - Launched Bible School/08.30.26_LLBS_CS-45-collage bottom.jpg", "2026 - Launched Bible School/08.30.26_LLBS_CS-51-collage bottom.jpg"]],
 17: ["2014 B - Launched Santiago Location/IMG-001-Cover.png",
      ["2014 B - Launched Santiago Location/IMG-002.png", "2014 B - Launched Santiago Location/IMG-003.png"]],
 19: [["2015 A - Started Read to Lead/Callie Williams - 092021_HSL_CW_READ2LEAD-4.jpg", "2015 A - Started Read to Lead/Callie Williams - 092021_HSL_CW_READ2LEAD-5.jpg"]],
 23: ["2019 A Austin Peay Location Launch/1920x1080.jpg",
      "2019 A Austin Peay Location Launch/IMG_0765.jpg"],
 28: ["2022 A - Launched Italy Location/IMG_7769-cover.JPG",
      ["2022 A - Launched Italy Location/PIC 5.jpg", "2022 A - Launched Italy Location/61E2E32D-D3AC-46BD-8A72-F4AC32C677E6.JPG", "2022 A - Launched Italy Location/IMG_0773.jpg", "2022 A - Launched Italy Location/IMG_0774.jpg"]],
}

DARK, UNIFORM, CEILING, MAX_ASPECT = 30, 5.0, 60, 2.0

# a scanned page's white, and how much ink a line needs to be content
PAGE_PAD, INK_FRAC = 6, 0.012


def trim_page(im):
    """Cut the scanner's white margin off a printed piece.

    The same bounding box the PDFs went through, applied here too: the
    pieces that arrive already exported as JPGs never saw it, and their
    page white sitting against the card's cream is what reads as wrong.
    White is measured from the sheet's own corners, because a scan's
    white is never 255 and drifts with the lamp."""
    a = np.asarray(im.convert("L"), dtype=np.float32)
    h, w = a.shape
    k = max(8, min(h, w) // 40)
    corners = np.concatenate([a[:k, :k].ravel(), a[:k, -k:].ravel(),
                              a[-k:, :k].ravel(), a[-k:, -k:].ravel()])
    white = np.percentile(corners, 60)
    if white < 200:                      # not a white page at all
        return im
    ink = a < white - 18
    rows, cols = ink.mean(axis=1) > INK_FRAC, ink.mean(axis=0) > INK_FRAC
    if not rows.any() or not cols.any():
        return im
    y0, y1 = np.where(rows)[0][[0, -1]]
    x0, x1 = np.where(cols)[0][[0, -1]]
    box = (max(0, x0 - PAGE_PAD), max(0, y0 - PAGE_PAD),
           min(w, x1 + 1 + PAGE_PAD), min(h, y1 + 1 + PAGE_PAD))
    if (box[2]-box[0]) < 80 or (box[3]-box[1]) < 80:
        return im
    return im.crop(box)


def loose(n):
    """macOS writes U+202F before the "PM" in a screenshot's name and shows
    it as a plain space, so a path typed by hand never matches."""
    return re.sub(r"[\s\u00a0\u202f\u2007\u2060\u200b]+", " ",
                  unicodedata.normalize("NFC", n)).strip().lower()


def resolve(ref):
    if ref.startswith("@"): return os.path.join(SCAN, ref[1:])
    p = os.path.join(SRC, ref)
    if os.path.exists(p): return p
    d, want = os.path.split(p)
    if os.path.isdir(d):
        for f in os.listdir(d):
            if loose(f) == loose(want): return os.path.join(d, f)
    return p


# scans and printed pieces: shown entire rather than cropped to fill
PRINT = ("@", "mailer", "publication", "billboard", "trifold", "invite",
         "card", "campaign", "prayer", "original-team", "journey", "offering")


def is_print(ref):
    low = os.path.basename(ref).lower()
    return ref.startswith("@") or any(k in low for k in PRINT[1:])


def slug(ref):
    base = os.path.splitext(os.path.basename(ref))[0]
    base = re.sub(r"-?COVER", "", base, flags=re.I)
    base = re.sub(r"\s*-\s*(Kelly Mayberry|Emma Pier|Melissa Horn|Josie De Souza|"
                  r"mayberrystories|Kristi Sciacchetano|brynn vanblaricom|drop box).*", "", base, flags=re.I)
    base = re.sub(r"[^A-Za-z0-9]+", "-", base).strip("-").lower()
    # a file called plainly "COVER.jpg" has nothing left once the marker
    # comes off, so it borrows the name of the folder it was filed in
    if not base:
        base = re.sub(r"[^A-Za-z0-9]+", "-",
                      os.path.basename(os.path.dirname(ref))).strip("-").lower()
    base = (base[:38] or "photo")
    return base + ("-whole.jpg" if is_print(ref) else ".jpg")


def decode(path):
    ext = os.path.splitext(path)[1].lower()
    if ext in (".heic", ".cr2", ".tiff", ".tif"):
        t = tempfile.mktemp(suffix=".jpg")
        subprocess.run(["sips", "-s", "format", "jpeg", "-s", "formatOptions", "95",
                        path, "--out", t], capture_output=True, check=True)
        im = Image.open(t); im.load(); os.unlink(t)
        return im.convert("RGB")
    im = Image.open(path)
    im = ImageOps.exif_transpose(im)
    return im.convert("RGB")


def bar(rows, limit):
    n = 0
    for i in range(limit):
        m, s, pk = rows[i]
        if m < DARK and s < UNIFORM and pk < CEILING: n += 1
        else: break
    return n


def strip_letterbox(im):
    a = np.asarray(im.convert("L"), dtype=np.float32)
    h, w = a.shape
    prof = lambda arr: list(zip(arr.mean(axis=1), arr.std(axis=1), arr.max(axis=1)))
    r, c = prof(a), prof(a.T)
    lv, lh = int(h * .30), int(w * .30)
    t, b = bar(r, lv), bar(r[::-1], lv)
    l, rr = bar(c, lh), bar(c[::-1], lh)
    if not (t or b or l or rr): return im
    nw, nh = w - l - rr, h - t - b
    if nw < 200 or nh < 200: return im
    if max(nw/nh, nh/nw) > MAX_ASPECT and max(w/h, h/w) <= MAX_ASPECT: return im
    return im.crop((l, t, l + nw, t + nh))


def main():
    # NOT rmtree. The print pieces come from SCAN, a scratch directory
    # that does not survive between sessions, so a wipe-and-rebuild
    # deletes eight scans it then cannot regenerate — the artwork of the
    # billboard, the Bonnke invites, the 2001 brochure. They are in the
    # repository and they stay there; the build overwrites what it makes
    # and leaves alone what it does not.
    os.makedirs(OUT, exist_ok=True)
    before = set(os.listdir(OUT))
    names, total, missing = {}, 0, []
    for did, slides in PLAN.items():
        for s in slides:
            for ref in (s if isinstance(s, list) else [s]):
                p = resolve(ref)
                if not os.path.exists(p): missing.append(ref); continue
                if ref in names: continue
                n = slug(ref)
                i = 2
                while n in names.values(): n = slug(ref)[:-4] + "-%d.jpg" % i; i += 1
                im = decode(p)
                im = trim_page(im) if is_print(ref) else strip_letterbox(im)
                if max(im.size) > LONG_EDGE: im.thumbnail((LONG_EDGE, LONG_EDGE), Image.LANCZOS)
                im.save(os.path.join(OUT, n), "JPEG", quality=QUALITY,
                        optimize=True, progressive=True)
                names[ref] = n
                total += os.path.getsize(os.path.join(OUT, n))

    rows = json.load(open(os.path.join(P, "data", "timeline.json")))

    # The PLAN chose which pictures a date got when there was nothing.
    # There is something now: every list has been gone through with the
    # church, photographs dropped and swapped and grids rebuilt, and each
    # one carries a focus that was measured against what is in the frame.
    # None of that is in the PLAN and none of it can be derived from it.
    #
    # So the build writes the FILES and leaves the lists alone. It only
    # fills in a date that has no pictures at all, which is what the PLAN
    # was for. Rerunning this after a folder changes is now safe.
    for r in rows:
        plan = PLAN.get(r["id"])
        if not plan: continue
        if r.get("photo") or r.get("photos"): continue
        out = []
        for sl in plan:
            if isinstance(sl, list):
                g = [names[x] for x in sl if x in names]
                if g: out.append(g if len(g) > 1 else g[0])
            elif sl in names:
                out.append(names[sl])
        if not out: continue
        if len(out) == 1 and isinstance(out[0], str):
            r["photo"] = out[0]; r["focus"] = "50% 50%"
        else:
            r["photos"] = out
            r["focus"] = [["50% 50%"] * len(x) if isinstance(x, list) else "50% 50%" for x in out]

    # a picture a date points at that the build no longer produces is the
    # one thing that must not pass quietly
    have = set(os.listdir(OUT))   # lo que hay, no solo lo que produjo
    for r in rows:
        for sl in (r.get("photos") or ([r["photo"]] if r.get("photo") else [])):
            for f in (sl if isinstance(sl, list) else [sl]):
                if f not in have and not f.lower().endswith((".mp4", ".mov")):
                    print("  FALTA  %s  (la usa %s %s)" % (f, r["year"], r["short"]))

    with open(os.path.join(P, "data", "timeline.json"), "w") as f:
        f.write("[\n" + ",\n".join("  " + json.dumps(x, ensure_ascii=False) for x in rows) + "\n]\n")

    kept = before - set(names.values())
    if kept:
        print("  %d conservados que este build no produce (escaneos): %s"
              % (len(kept), ", ".join(sorted(kept)[:3]) + ("..." if len(kept) > 3 else "")))

    bare = [r["id"] for r in rows if not (r.get("photo") or r.get("photos"))]
    print("%d derivados, %.1f MB" % (len(names), total / 1024 / 1024))
    print("fechas con imagen: %d de %d" % (len(rows) - len(bare), len(rows)))
    print("sin imagen: %s" % bare)
    if missing:
        print("\nNO ENCONTRADOS:")
        for m in missing: print("   ", m)


if __name__ == "__main__":
    main()
