# The Life Church — 30th Anniversary Timeline

A 10-minute animated timeline of 42 dates, 1996–2026.
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
| `W` `A` `S` `D` | move the crop of the photo on screen (`⇧` for fine) |
| `X` | copy every date's crop as JSON |
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
Dropped frames therefore cost picture, never running time — the piece runs
to the same second on any machine.

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
  so 40% of each is cropped — centred is only right by luck)
- an `.mp4` in `photo` / `photos` is a clip; see below
- `stat` / `source` are optional; without them the paragraph takes the room

**Still outstanding:** every `paragraph` is still placeholder prose, not
the church's copy — the review round returned the same text it was given.
The real material is in the team's "possible things to include" notes,
which is where the `stat` values will come from. Entries flagged
`"draft": true` were added with no copy at all. Sixteen dates still have
no photograph; `tools/photo-map.json` records what the church sent and
where each file went.

## Moving footage

A card can hold a clip instead of a photograph. Name an `.mp4` in `photo`
or `photos`, put the file in `assets/video/`, and put a still of it beside
it under the same name with a `.jpg` — that still is the poster and is what
the small card on the rail shows, because there are forty of those and none
of them needs a second video element.

It stays a pure function of time, which is the whole reason this works:

```
video time = time since this card's hold began
```

Only the choice of *how* to enforce that depends on the transport. While
the piece is **playing**, the element runs on its own clock and is nudged
only once it has drifted more than 0.25s — seeking thirty times a second
stutters badly. While it is **paused** — stepping, scrubbing, or being
captured for the export — it is seeked exactly, and that is what keeps the
render frame-exact. Outside the hold the clip parks: on frame one before,
on the last frame after, so the card exits on a held image and never on
black.

A clip is shown **whole**. `object-fit: contain` on solid black, not
`cover`: the frame is portrait and footage is landscape, so covering would
throw away a third of the picture. The black belongs to the video element
itself, so a still cross-fading over it hides the bars along with
everything else. Videos also skip the settle-and-drift scale that
photographs get — that scale is exactly what the bars exist to prevent.

What a clip has to be:

| | |
|---|---|
| **length** | 8s or less. The hold is 9.5s and the contents arrive over the first 1.5s |
| **format** | H.264 MP4, `+faststart` |
| **audio** | fade in and out **baked into the file** — nothing ramps a volume at runtime |

Sound is off until someone touches the page. A browser refuses to autoplay
audible media before a real gesture, so clips are muted in the markup and
the first pointer or key press turns them up (`__anim.sound(false)` puts it
back). A lobby screen nobody touches therefore plays silent, which is the
right default for a lobby — and the exported MP4 carries the audio either
way, because that is muxed from the source file rather than captured off
the screen.

## The focus tool

The card's photo pane is 0.898 wide over tall. Every archive photo is
landscape, so about 40% of each one is thrown away and `focus` decides
which 40% — and you cannot judge that from a full-frame thumbnail, only
from the crop.

`W` `A` `S` `D` walk the crop of whichever photo is on screen right now,
including the third shot of a four-shot cross-fade; `⇧` steps by 1
instead of 4; the value prints in the HUD. `X` copies every date's focus
as JSON to paste back into `data/timeline.json`.

It edits the loaded data only — nothing is persisted, so `render(t)`
stays a pure function of time and the headless export is unaffected.

Editing only `data/timeline.json` still needs the `?v=` in `index.html`
bumped: the data's cache-buster is read off the script tag, so data and
code always move together.

## Files

```
index.html          markup for every scene
css/style.css       the whole design system
js/anim.js          easing + WCAG contrast maths
js/logo.js          opening
js/timeline.js      the dates
js/outro.js         closing — clears the frame, no logo, for a seamless loop
js/ticker.js        the two running bars
js/notes.js         review comments, one per date (localStorage)
js/main.js          clock, scenes, keys
assets/photos/      1500px q72 derivatives
assets/video/       clips + their poster stills
tools/              photo pipeline + the map of what goes where
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

The outline is an SVG polygon, not a border. A css border belongs to the
rectangle, so the clip takes it away along every diagonal and leaves four
stumps in the corners. Three details make the two read as one stroke:

- The clip runs to 72 but the **outline stops at 50**. Past 50 the
  shoulders sit outside the box; a clip ignores them, a stroke draws
  them — as four diagonals poking out of the corners.
- **No `viewBox`, no `non-scaling-stroke`.** With neither, the svg's user
  space is 1:1 with its css size, which is already the stage's units, so
  `stroke-width: 14` is 14 stage px and scales with the card's border.
  Held at screen px instead, the two only match at 1:1 — meaning the
  preview lies and the render is right.
- The polygon is **inset by half the stroke**. An svg stroke straddles
  its path, a css border sits wholly inside; without the inset the
  silhouette jumps 7px at the handover.

Two more things the shape needs, both learned the hard way:

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

```bash
python3 tools/build-photos.py            # rebuild assets/photos/
python3 tools/build-photos.py --report   # inventory only, writes nothing
```

`tools/photo-map.json` is the source of truth: original → derivative, one
line each. The church filed the originals by event folder, and where a
folder name and a filename disagree about the year the **folder wins** —
that is the church's own reading of what the picture is of.

Derivatives are always rebuilt from the originals, never re-compressed
from an earlier derivative: two passes of q72 on the same picture is
visible at 5760 across even when it is invisible here. 1500px long edge,
q72, progressive — the pane never shows a photo above ~750px, so that is
a 2x buffer for the slow zoom.

Four things the pipeline has to get right, each learned the hard way:

- **Letterbox.** Archive material carries baked-in bars from VHS and 4:3
  telecine. A row is cropped only when it is dark **and** uniform **and**
  unlit — a synthetic bar has no variance and no highlights, while a dark
  auditorium ceiling always has a lamp or a speaker edge in it. Darkness
  plus variance alone still ate 368 rows off a shallow-focus studio shot;
  the peak-brightness test is what finally separated them. Nothing is
  cropped past 2:1.
- **Orientation.** EXIF is applied and then stripped, because CSS
  `object-fit` does not read it. One HEIC declares no orientation that
  `sips` or PIL can see and decodes on its side, so its rotation is
  stated outright in `FORCE_ROTATE`.
- **Odd inputs.** HEIC and CR2 decode through `sips` — Apple's own
  decoders, no third-party dependency. The 2000 "billboard" turned out to
  be a 320×240 TV commercial, so one frame comes out of it via ffmpeg.
- **Filenames.** macOS writes U+202F, not a space, before the "PM" in a
  screenshot's name, and shows it as an ordinary space. A map typed by
  hand never matches; the resolver folds every kind of whitespace before
  comparing.
