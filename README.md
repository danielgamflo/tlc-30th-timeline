# The Life Church — 30th Anniversary Timeline

A 10-minute animated timeline of 40 dates, 1996–2026.
Static site: no build step, no dependencies, no server-side anything.

## Viewing

Open `index.html` through any static server. `?dev` unlocks the working mode.

| | |
|---|---|
| **presentation** | plays on load, no HUD — this is what you send someone |
| **`?dev`** | starts paused, HUD visible — this is the working mode |

### Keys

| key | |
|---|---|
| `space` | play / pause |
| `←` `→` | step beat by beat |
| `⇧` `←` `→` | ± 0.1s |
| `⌥` `←` `→` | ± 1 frame |
| `R` | back to the start |
| `1` `2` `3` | 1080×1080 / 1920×1080 / 5760×1080 |
| `4` `6` `8` | preview at 4 / 6 / 8 screen-heights of viewing distance |
| `0` | fit to window |
| `↑` `↓` | jump a whole date — how you review without waiting 10 minutes |
| `N` | leave a note on the date on screen |
| `F` | fullscreen · `H` toggle HUD |

## How it is built

Everything is a **pure function of time**. `render(t)` returns the frame for
second `t` — no CSS transitions, no keyframes, no accumulated state. That is
what lets the same code drive three things:

- arrow keys, beat by beat, for design review
- a real-time clock, for playback
- `window.__anim.seekFrame(n)` headless, for a frame-exact MP4 export

Two clocks run: `clock` is real elapsed time, never rounded; `t` is that
clock snapped to the 30fps grid, and it is the only one `render` sees.
Dropped frames therefore cost picture, never running time — the piece is
600.00s on any machine.

## Timing

```
9.5s logo  +  42 dates × 14.70s  +  2.5s outro  =  629.4s   (10:29)
```

The running time follows the content. Nothing in the code assumes a
count, so adding or dropping a date is a line of JSON and the piece
simply gets longer or shorter — duration, rail markers, positions,
colour rotation, the top/bottom alternation and the jump buttons all
recompute. If it ever has to land on a fixed length instead, `HOLD` is
the dial: `(target − 12) / dates − 5.20`.

The piece loops. The outro carries no logo: the last card flies up, the
rail retracts into the centre it grew from, the running bars leave last,
and the frame is bare paper — which is exactly frame 0, so the wrap has
no seam.

Per date: `APPEAR 0.55 · SPIN 0.85 · WIDEN 0.45 · HOLD 9.50 · EXIT 2.40 · ADVANCE 0.95`
All six live at the top of `js/timeline.js`.

## Content

`data/timeline.json`, one date per line.

```json
{"label":"October 28","year":"2001","short":"5th anniversary",
 "title":"…","paragraph":"…","stat":"…","source":"…",
 "photo":"2001.jpg","focus":"30% 20%","color":3}
```

- `photos: [...]` instead of `photo` cross-fades several shots across the hold
- `focus` moves the crop (the frame is portrait, archive photos are landscape,
  so 40% of each is cropped — centred is only right by luck). Eight dates
  carry a computed value; the rest sit at centre waiting for a human eye.
  Edge-density guessing works on people lit against a dark stage and fails
  on architecture, where the edges are in the parked cars, not the sign.
- `stat` / `source` are optional; without them the paragraph takes the room

**Still outstanding:** every `paragraph` is still placeholder prose, not
the church's copy — the review round returned the same text it was given.
The real material is in the team's "possible things to include" notes,
which is where the `stat` values will come from. Entries flagged
`"draft": true` were added with no copy at all. 18 dates from 2017 on
have no photograph.

Editing only `data/timeline.json` still needs the `?v=` in `index.html`
bumped: the data's cache-buster is read off the script tag, so data and
code always move together.

## Files

```
index.html          markup for every scene
css/style.css       the whole design system
js/anim.js          easing + WCAG contrast maths
js/logo.js          opening
js/timeline.js      the 40 dates
js/outro.js         closing — a clone of the logo markup, played backwards
js/ticker.js        the two running bars
js/notes.js         review comments, one per date (localStorage)
js/main.js          clock, scenes, keys
assets/photos/      1500px, q65 derivatives. originals live in Footage/
assets/fonts/       PP Museum — licensed
```

## Review notes

`+` on the right, or `N`, leaves a comment on whatever date is on screen.
The `+` turns orange on dates that already have one. **Copy all** puts the
whole set on the clipboard as plain text to send back.

Notes live in `localStorage`, in the reviewer's own browser. They do not
sync between people or machines — each reviewer copies their own list and
sends it. Shared live comments would need a small backend; a Cloudflare
Worker with KV is the least-effort route and the front end barely changes.

## The lozenge

The card does not grow as a rectangle. It blooms out of the rail's ring
as the flat horizontal diamond from the church crest — hatched the same
way — and that silhouette then fills out into the card.

It is a real morph of the outline, not a rotated square: an 8-point
polygon whose shoulders slide from the mid-points out to the corners.
`k = 0` is the diamond, `k = 50` is exactly the border box. It carries on
to 72 so the clip retreats past the edges and the 26px corner radius
appears on its own — stopping at 50 would hold sharp corners and then pop
them round in one frame.

Two things the shape needs, both learned the hard way:

- It blooms in the date's colour and cools to cream as it opens. Cream on
  the cream paper measures 1.2:1, so a lozenge that started at its final
  colour was simply not visible.
- The black stroke arrives with the corners, not before. A 14px outline
  clipped along a diagonal reads as a broken edge.

## The ruled paper

Two tiled gradients, not a bitmap: nothing to download, crisp at 5760
across, and identical on every render — a texture image would have to be
scaled per format and would moire against itself.

```css
--grid:        rgba(221, 205, 165, .5);
--grid-cell:   48px;
--grid-weight: 2px;
```

The vertical offset is the part worth keeping. The grid is positioned
`center calc(50% - var(--grid-weight) / 2)`, which centres one of its
horizontal rules on the stage's centre line — exactly where the timeline
rail sits. The rail lands *on* a grid line rather than crossing the paper
at an arbitrary height, and because both are pinned to 50% it stays that
way at 1080, 1920 and 5760 with no per-format adjustment.

Keep the cell well clear of the cards' 22px hatching. Two patterns at
similar frequencies interfere, and at a distance that reads as noise.

## Photographs

Derivatives are rebuilt from the originals in `Footage/`, never
re-compressed from an earlier derivative. Fourteen of the archive files
had letterbox bars baked in. The detector crops a row only when it is
**dark and uniform** — a synthetic bar has no pixel variance, a dark
auditorium ceiling does, and going by darkness alone ate real content.
No photo is cropped past 2:1, because beyond that the portrait frame
starts destroying the composition rather than saving it.
