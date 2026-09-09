# Adapting to 1024 × 1024

Written 9 Sept 2026, while finishing the 1920. Nothing here has been
built — it is the survey done before starting, kept so the next pass does
not have to rediscover it.

**The number is 1024, not 1080.** Confirmed by Daniel. LED walls are
built from 128mm tiles and 1024 = 8 × 128, so it is a real native
resolution rather than a typo. The square block that already exists in
the stylesheet was written for 1080 and assumes 1080 throughout.

---

## What already works and must not be rebuilt

**The timing is format-independent.** `computeHolds()` derives each
date's hold from its word count and its number of slides — never from
pixels. The square runs 15:42 by itself, with the same cuts and the same
loop. That is the largest single piece of work that does not need doing
again.

The same goes for all the content: `data/timeline.json`, the photographs,
the ordering, the crossfades, the fact deck.

**The export path is already designed for this.** Everything is a pure
function of time; `__anim.seek(t)` and `__anim.capture(true)` exist, and
`capture` pins the stage at scale 1.

---

## The structural problem: the card's geometry is a constant

In `js/timeline.js`:

    var BOX_W = 1500;   /* final width  */
    var BOX_H = 880;    /* final height */

These are the 1920 card. They drive the clip polygon, the SVG frame
stroke, and the wrapper's own width and height, which are written as
inline styles and therefore beat any stylesheet rule that tries to
override them:

    r.wrap.style.height = BOX_H + "px";
    r.wrap.style.width  = BOX_W + "px";

**A 1024 stage is narrower than the card itself.** So the square format
is not broken by design, it is unfinished: `.stage[data-format="1080"]`
sets `.expanded` to 940 × 940, but the JS constants are still 1920's.

The fix is to derive BOX_W/BOX_H from the active format rather than
declaring them. Do it carefully — `facets()` carries the trigonometric
cap that stops the outline overshooting mid-turn:

    var a = Math.min(A.lerp(a0, r1, u), hh / Math.cos(u * Math.PI / 4));

That cap is written against `hh`, which comes from BOX_H. It has to
follow the box, and it is the one piece of this that has bitten before.

Related constants that are also 1920's: `LOZ_W = 1200` / `LOZ_H = 480`
(the lozenge the card starts as — already wider than a 1024 screen), and
`RETREAT = 44`.

## The selectors are keyed to a format, not to a shape

Six rules are written `.stage[data-format="1080"] …`. Adding `"1024":
[1024, 1024]` to `FORMATS` in `js/main.js` is one line, but none of those
rules would match it.

Better: have `setFormat` stamp a `data-shape="square"` alongside
`data-format`, and key the layout rules off the shape. Then any square
resolution picks up the layout, and `data-format` stays free to carry
resolution-specific tuning.

## The design problem, which is the bigger one

At 1920 the text panel is about 716px wide, standing beside the photo.
Square puts the photo on top and the panel underneath: the panel gains
width and loses half its height.

It is the same copy. **The square is where the length problem bites
hardest.** The 1920 currently overflows on zero of forty dates — that
was won this week over three passes. The square starts that fight again
with less room.

The existing square rules carry type sizes from before the September
changes and are stale in both directions:

| | square block (stale) | 1920 now |
|---|---|---|
| year | 74px | 76px |
| title | 30px | 40px |
| paragraph | 21px | 25px |

They need their own scale worked out against the square panel, not
copied from the 1920.

Also unresolved for square: the photo/panel split is `height: 44%` for
the photo. That ratio was a guess and should be settled by where the
overflow lands.

## What else needs a pass

- **The rail of small cards.** `SPACING = 300` and `CARD_W = 200` are
  1920's. At 1024 roughly half as many cards are on screen, which changes
  how the strip reads as it advances.
- **The tickers.** 46px top and bottom. Against a 1024 width they carry
  proportionally more weight than they do across 1920.
- **The photo grids.** `--2`, `--3` and `--4` are laid out for a tall
  narrow pane. The square's photo pane is wide and short; the three-cell
  grid (one over two) is the one least likely to survive unchanged.

## Export

Chrome headless over CDP: step `seek(n / 30)`, screenshot each frame,
assemble with ffmpeg.

**15:42 at 30fps is 28,260 frames per format.** At roughly 120ms a
capture that is about an hour of rendering per format, three hours for
all three. Viable, but it is a job you start and leave running, not a
two-minute wait.

Two things to check first:

1. **Fonts must be loaded before frame 0**, or the opening second renders
   in the fallback face. Wait on `document.fonts.ready` before the first
   capture.
2. **The 2000 video clip** needs exact seeking rather than free playback.
   `driveVideo()` already does this — it is the first thing to verify
   frame-accurate, not the last.

## Order of work

1. Card geometry from constants to format-derived
2. `data-shape` on the stage, layout rules keyed off it
3. The square's own type scale, worked to zero overflow
4. Photo/panel split, then rail, tickers, grids
5. Export, all three formats together

Deliberately last: nothing about the export is format-specific, so it
costs the same whether one format is ready or three.
