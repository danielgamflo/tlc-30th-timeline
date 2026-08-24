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
40 dates × 14.70s  +  6.5s logo  +  5.5s outro  =  600.0s
```

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
- `stat` / `source` are optional; without them the paragraph takes the room

**Still outstanding:** the paragraphs and stats are placeholders. Date 40
(`"tbd": true`) is the late-90s milestone still being chosen. 18 dates from
2017 on have no photograph yet.

## Files

```
index.html          markup for every scene
css/style.css       the whole design system
js/anim.js          easing + WCAG contrast maths
js/logo.js          opening
js/timeline.js      the 40 dates
js/outro.js         closing — a clone of the logo markup, played backwards
js/ticker.js        the two running bars
js/main.js          clock, scenes, keys
assets/photos/      1500px, q65 derivatives. originals live in Footage/
assets/fonts/       PP Museum — licensed, keep this repo private
```
