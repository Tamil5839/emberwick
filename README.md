# Emberwick

A 73-second silent animated short, generated entirely from code.

Two small keepers climb a rain-drowned stone stair to light a lantern. The wick
is soaked and they have one match. The smaller of them works out that the only
dry thing left is the tuft of moss growing on his own head.

Every frame is SVG drawn by React. Every sound is synthesised through the Web
Audio API. There are no image assets, no audio samples, and no dialogue.

```
1920 × 1080  ·  24 fps  ·  1752 frames  ·  8 scenes  ·  no words
```

---

## Requirements

- **Node 18+** (built and tested on Node 22)
- **FFmpeg** on your `PATH` — used for the final encode (`brew install ffmpeg`)

A headless Chrome is downloaded automatically by Remotion on first use.

## Install

```bash
npm install
npx remotion browser ensure      # one-off, ~90 MB
```

## Make the film

```bash
npm run film
```

That runs the three stages in order and leaves the deliverable at
`out/emberwick.mp4`. To run them separately:

```bash
npm run audio     # synthesise the soundtrack  → public/emberwick-mix.wav
npm run render    # draw + encode intermediate → out/emberwick-intermediate.mp4
npm run export    # FFmpeg final encode        → out/emberwick.mp4
```

## Preview and iterate

```bash
npm run preview                       # Remotion Studio, scrubbable, live reload
npm run still -- 1220,1300,1480       # PNGs of specific frames → out/stills/
npm run typecheck
```

`npm run preview` needs the soundtrack to exist, so run `npm run audio` once first.

---

## Storyboard

| # | Timecode | Frames | Shot & camera | Action | Emotion | Sound |
|---|---|---|---|---|---|---|
| 1 | `00:00–00:10` | 240 | Wide, very slow push-in 1.00→1.06 | Rain on a long stone stair. A row of lanterns climbing into fog, every one dark. | lonely | rain bed in, low rumble, three drips. No music. |
| 2 | `00:10–00:19` | 216 | Medium-wide, locked | Brack climbs in from lower left, Pip bounding at his heel. They stop at the last dark lantern. | purpose | heavy splash-steps against light patter, wet cloth |
| 3 | `00:19–00:26` | 168 | Medium, slight push | Brack opens the glass door. Water comes out of it. His brows drop; Pip's gaze travels up to his face. | worry | hinge creak, one clear drip. **Music enters.** |
| 4 | `00:26–00:36½` | 252 | Medium-close, locked | One match. Strike. The wet wick hisses and spits and will not take. The match burns down. | alarm | tin, strike, spit, gust, a pulse under it all |
| 5 | `00:36½–00:44` | 180 | Close on Pip, dead still | Pip looks at the dying match, up at Brack, then at nothing. **36 frames of no motion.** Then one hand goes to his own head. | resolve | rain ducks 8 dB, one held note, a small pluck |
| 6 | `00:44–00:50` | 144 | Two-shot, pan down to the hands | Pip offers the tuft. Brack looks at it, at Pip's bare head, then at Pip's eyes. Pip nods once. Brack takes it. | tenderness | near-silence, one warm phrase |
| 7 | `00:50–01:01` | 264 | **Close-up, 85mm, centred** | It catches. Gold floods both faces; the flame is reflected in four eyes. Then he lifts it to the wick. | awe | the catch, then crackle. **Music ducks — fire carries it.** |
| 8 | `01:01–01:13` | 288 | Pull back to wide, then hold | The lantern takes. Light pours down the stair and the rain turns gold. Brack unwinds his collar and wraps it around Pip's bare head. | warmth | bell, warm rain, the theme resolves |

Shot lengths: 10 · 9 · 7 · 10½ · 7½ · **6** · 11 · **12** — unhurried open,
compressing into the turn, shortest at the decision, two longest held at the end.

Transitions: dissolve 1→2, straight cut 2→3 and 3→4, dissolve 4→5, cut 5→6,
match cut 6→7, and **no cut at all between 7 and 8** — scene 8 opens on scene 7's
exact lens and pulls back to scene 1's opening frame. The last image of the film
is the first image of the film with the light on.

## Art direction

```
FEELING   tenderness
PALETTE   #0B131C wet slate · #1E2E3B stone · #3B5A70 rain-blue
          #FFB35C emberlight · #FFE9BE flame core   (accent, under 5%)
LIGHT     one motivated practical — a matchflame, later the lantern.
          Small, hard, warm, fast falloff. Ambient is a cool overcast
          skydome with no fill: shadows go to black.
LENS      50mm throughout. 85mm once, at the climax.
TEXTURE   film grain, three parallax rain layers, drifting fog, wet stone.
TEMPO     slow. One camera move per shot.

SHAPE      continuous curves dominant; cold verticals subordinate.
           No triangles anywhere except the flame.
SIGNATURE  the cupped arc — Brack's hood, the lantern dome, his hands
           around the flame, the collar around Pip. Four times.
CONTRAST   low in hue everywhere, extreme in value at the flame only.
BALANCE    asymmetric on the stair's diagonal — except the climax, which
           is centred. That break is the point.
```

Three references, one borrowing each: Rembrandt's candlelit studies for the
light, Ozu for the held frames and the pause before the turn, Hiroshige's rain
sheets for the ruled diagonal rain over flat cool fields.

---

## How it is put together

```
src/
  timing.mjs          the scene table — imported by BOTH picture and sound,
                      so the two can never drift apart
  Emberwick.tsx       the eight shots, the dissolves, the fades, the audio
  lib/                easing, seeded noise, keyframe tracks, colour mixing
  rig/
    types.ts          one Pose type, shared by both characters
    parts.tsx         eyes, brows, mouths, two-bone limbs
    motion.ts         idle bounce, walk cycle, gaze, IK, the two emotional poses
    Brack.tsx  Pip.tsx
  world/
    geometry.ts       the stair as maths, and every staging mark
    Stair.tsx         background / midground / foreground layers
    Lantern.tsx  Flame.tsx  Props.tsx
    Atmosphere.tsx    rain, fog, the warm key, the cool wash, grain, vignette
    Camera.tsx        three stacked cameras at different depths = parallax
    Stage.tsx         assembles the world for a given camera frame
  scenes/S1…S8.tsx    the performances
audio/
  engine.mjs          voices: drips, footsteps, match, bell, music box, pad
  score.mjs           the timeline and the mix automation
```

**Everything is a pure function of the frame number.** Randomness is seeded, so
any frame renders identically in isolation and the film is reproducible.

**The rig.** Both characters share one `Pose`: position, bob, squash, lean, head
tilt and turn, gaze, blink, eye width, two brows, a mouth shape, two arms and
two legs. Limbs are aimed at world points and solved with two-bone IK rather
than posed by angle — so a planted foot stays planted while the body breathes,
and a hand can be told to hold the lantern door. Brack's arms are 80 units and
Pip's are 29; nothing in the film asks either of them to exceed that, which is
why Pip physically cannot reach the flame and has to give Brack the tuft
instead.

**The light.** One warm source at a known world position. It drives a screened
radial key, the rim on each silhouette, the reflection in the eyes, and the
`lit` value on every character — all from the same coordinate. The background
darkens automatically as the lens gets longer, because a small flame cannot
light a staircase.

**The sound.** `audio/engine.mjs` builds each voice from oscillators and
filtered noise, including a procedurally generated impulse response for the
stairwell reverb. `audio/score.mjs` places them on four buses — ambience,
effects, music, reverb — and automates the mix. The music bus is deliberately
pulled **down** at 36.5 s and again at 50 s so the two emotional beats are
carried by silence and fire rather than by score.

---

## Changing things

| Want to… | Edit |
|---|---|
| Retime the film | `src/timing.mjs` — picture and sound both follow it |
| Restage a beat | `src/world/geometry.ts` |
| Change the palette | `src/lib/palette.ts` |
| Rewrite a performance | `src/scenes/S*.tsx` |
| Remix the sound | `audio/score.mjs`, then `npm run audio` |
| Turn on captions | `CAPTIONS = true` in `src/Emberwick.tsx` (off by default — the film is built to play wordless) |

---

## Production notes

The film was drafted, watched, and then fixed. What the first pass got wrong,
and what was done about it:

- **Limbs were posed by angle and pointed the wrong way.** Replaced with
  two-bone IK aimed at world points (`solveLimb` in `rig/motion.ts`). Reaching
  for the lantern, sheltering the match and handing over the tuft are now
  stated as coordinates, and the rig works out the joints.
- **Both characters' shoulders sat at the eyeline**, so any raised arm crossed
  its own face. Dropped to 150 units on Brack and 34 on Pip.
- **The stair read as a flat ramp.** Added a per-tread gradient, a dark corner
  where each tread meets the next riser, a brighter wet nosing, and a solid
  parapet on the outer edge.
- **The close-up was a warm blob.** The key light was 440 units wide — enough to
  flood a staircase. Cut to 232, steepened the falloff toward inverse-square,
  and made the background darken automatically as the lens gets longer.
- **Dark arms in front of a dark body disappeared** exactly when the hands
  mattered. Limbs went darker still and now take a fire-lit rim.
- **Brack's "pressed" mouth curved downward**, which reads as a smile, in the
  one scene where he is supposed to be struggling with something.
- **The climax had four hands around one flame** and read as plumbing. Brack's
  arms are 80 units and his shoulders 48 apart, so the only place two hands meet
  cleanly is low and in front — which is where anyone sheltering a flame from
  rain would put them anyway. Pip keeps his hands to himself and watches.
- **Pip offered the tuft in both hands**, which put it under his own chin where
  it looked like he was still wearing it. His arms are 33 units and his
  shoulders 50 apart, so two-handed is physically the only thing he can do at
  chest height. Changed to one arm extended, and the pale tuft now reads against
  Brack's dark cloak.
- **Brack's cloak covered Pip** in the gift scene. Moved Pip 23 units left and
  took most of Brack's lean out.
- **The collar hand-off happened while the camera was already wide**, so the
  film's second gift was invisible. The pull-out now stops at 2.3x, waits for
  it, and only then goes back to the opening frame.

## Output

```
out/emberwick.mp4                 the film — 1920x1080, 24fps, H.264 + AAC, 73.0s
out/emberwick-intermediate.mp4    Remotion's CRF 12 intermediate (large; safe to delete)
public/emberwick-mix.wav          the 24-bit soundtrack
```

Integrated loudness is about −18 LUFS with a wide loudness range, which is
deliberate: the rain is loud and the decision is nearly silent.

## Licence

Original work. The world, both characters, the music and every sound in it were
made for this project.
