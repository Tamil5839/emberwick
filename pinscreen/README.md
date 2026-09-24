# Pinscreen

Your webcam as a real-time 3D pinscreen. Thousands of steel pins push in and
out to form your face, lit by a single low raking light so the shadows draw
the picture, in homage to Alexandre Alexeïeff and Claire Parker's 1930s
pinscreen animation.

Vite + TypeScript + Three.js, no framework, no backend. Your video never
leaves the browser.

> **Status: phase 3 (recording).** The extra modes land in phase 4; see
> [Roadmap](#roadmap).

---

## Quick start

```bash
cd pinscreen
npm install
npm run dev
```

Vite opens <http://localhost:5173>. Allow camera access when the browser asks.

**Requirements:** Node 20.19+ or 22.12+, and a desktop browser with WebGL 2
(Chrome, Edge, Safari 16+, Firefox). The camera only works on `localhost` or
`https://`, so use the Local URL Vite prints, not a LAN IP.

```bash
npm run build     # typecheck + production build → dist/
npm run preview   # serve the production build
```

## Controls

### Mouse

| Input | Action |
| --- | --- |
| Drag | Orbit around the board (it stops before you get behind it) |
| Right-drag / two-finger drag | Pan |
| Scroll / pinch | Zoom |
| **Reset view** button | Back to the default, slightly off-axis framing |

### Keyboard shortcuts

| Key | Action |
| --- | --- |
| **H** | Hide / show the control panel |
| **Space** | Freeze: pins hold their current shape (a *Frozen* badge shows) |
| **R** | Record: starts the 3-2-1 countdown; press again to stop and save |
| **Esc** | Cancel the countdown, or stop recording |
| **C** | Clean mode: hide all UI, for capturing the window with OBS |

Shortcuts are ignored while you're typing in a panel number field.

### Control panel

The panel (top right, collapsible, **H** to hide) remembers your look between
reloads. **Reset all settings** goes back to the defaults.

| Folder | Control | What it does |
| --- | --- | --- |
| Source | Input | Webcam, Image or Video. Choosing Image or Video opens a file picker; nothing changes if you cancel. |
| | Open image or video… | Pick any image or video file. You can also **drag and drop** one onto the page. Files are never mirrored; the webcam is. |
| Pins | Density | Low 80×60 · Medium 120×90 · High 160×120 · Insane 200×150 (rebuilds the board) |
| | Finish | Steel · Brass · Black chrome · White matte |
| | Depth | How far a fully bright pin travels (world units, up to 2.5) |
| | Smoothing | Share of the remaining distance each pin covers per 60 Hz frame. Lower is heavier and slower; 1 snaps. |
| | Freeze (Space) | Hold the current shape. Changing density while frozen re-forms the board from the current picture, then holds it. |
| Picture | Auto levels | Stretch each frame's darkest and brightest pixels to the full pin range |
| | Contrast | Around mid-grey, applied after levels |
| | Gamma | Above 1 pushes mid-greys out, below 1 pulls them in |
| | Invert | Bright pixels push pins **in** instead of out |
| Light | Angle (elevation) | Key-light height above the board, 3–60°. Low means long, dramatic shadows. |
| | Direction | Where the light comes from (0° right, 90° top, 180° left) |
| | Auto sweep | Swing the light slowly round the board. Great on video. |
| | Sweep speed | Degrees per second |
| | Intensity / Reflections | Key-light strength / studio reflections on the metal |
| Camera | Exposure | Overall brightness (after ACES tone mapping) |
| | Depth of field | Optional bokeh pass (EffectComposer), auto-focused on the orbit target, off by default |
| | Blur | Depth-of-field strength |
| | Reset view | Same as the button |
| Record | Frame | Fill window · 16:9 (1920×1080) · 9:16 (1080×1920) · 1:1 (1080×1080). The live view letterboxes to the frame so you can compose the shot. |
| | Format | MP4 (H.264) when the browser can record it, otherwise WebM |
| | Quality | Standard 12 · High 24 · Max 40 Mbit/s |
| | ● Record (R) | Countdown, record, stop, download |
| | Clean mode (C) | Hide every bit of UI; the cursor hides after 1.5 s of stillness |

In dev mode the app is also exposed on `window.__pinscreen` for poking at from
the console (e.g. `__pinscreen.settings.depth = 1.4`).

## Recording

1. Pick a **Frame** in the Record folder. The view letterboxes to it (with a
   faint outline) so you can compose your shot. Portrait and square frames
   crop the board's sides and keep your face filling the height.
2. Press **R** (or **● Record**). The panel and buttons disappear, the
   renderer switches to the frame's exact pixel size, and a 3-2-1 countdown
   runs. Esc cancels it.
3. While recording, a red dot and timer sit at the top. They're page
   overlays, never part of the video, and the timer turns gold past 2:20, the
   longest video a standard X/Twitter account can post. You can still orbit
   with the mouse and freeze with Space mid-take.
4. Press **R** again (or **Stop**). The file downloads as
   `pinscreen-2026-09-24-142233-9x16.mp4`.

The canvas is captured with `canvas.captureStream(60)` into a
`MediaRecorder`, so what you record is exactly what renders: 60 fps, vignette
included, no UI. With **Fill window** selected, recordings come out 16:9.

**MP4 vs WebM:** Chrome and Edge (126+) and Safari record MP4 (H.264), which X,
Instagram, TikTok and YouTube all accept directly. Firefox only records WebM,
which X and Instagram don't take. Convert it with
`ffmpeg -i in.webm -c:v libx264 -crf 16 -pix_fmt yuv420p out.mp4`. If an
upload site ever rejects a browser MP4, re-wrap it without re-encoding:
`ffmpeg -i in.mp4 -c copy -movflags +faststart out.mp4`.

**Clean mode (C)** is for recording with OBS or QuickTime instead: all UI
disappears, the cursor hides when still, and the view keeps whatever Frame
you chose. Press C again to bring everything back.

## How it works

1. **Camera and sources** (`camera.ts`, `source.ts`): `getUserMedia` at
   640×480. Permission, missing camera, camera-in-use and insecure-origin
   failures each get a plain-English card with a retry button, plus a way to
   use an image or video instead. Uploaded images are sampled once; videos and
   the webcam are sampled only when a new frame arrives.
2. **Sampler** (`sampler.ts`): each new webcam frame is drawn, mirrored and
   cover-fitted, into a tiny canvas at grid resolution (120×90 by default),
   then turned into Rec. 709 luminance. Auto levels (2nd and 98.5th
   percentile, eased so the board doesn't pump) plus contrast, gamma and
   invert run through a 256-entry lookup table.
3. **Pin field** (`pinfield.ts`): one `InstancedMesh`. Each pin is an
   8-sided shaft plus a domed head, 40 triangles. The pins are hex-packed like
   a real pin-art toy (odd rows shifted half a pitch), so it reads as an
   object rather than a bar chart. Every frame each pin eases toward
   `depth × luminance` with a frame-rate-independent lerp (default 0.15 per
   60 Hz frame). The new height is written straight into the preallocated
   instance-matrix `Float32Array`, with one `needsUpdate` per frame.
4. **Lighting** (`lighting.ts`): one `DirectionalLight` about 13° above the
   board, casting 2048² PCF soft shadows. Its orthographic shadow frustum is
   refitted around the board in light space whenever the light or depth
   changes, which buys a lot of shadow resolution at raking angles. Normal
   bias scales with texel size and grazing angle, so there's no acne or
   peter-panning. A barely-there hemisphere fill keeps the shadows deep.
   ACES Filmic tone mapping, sRGB output.
5. **Stage** (`stage.ts`): a 28° lens looking at the board slightly
   off-axis, damped `OrbitControls`, and a one-triangle vignette pass.
   Optional depth of field runs through `EffectComposer` → `BokehPass` →
   `OutputPass` with a 4× multisampled target.
6. **UI** (`ui.ts`): the lil-gui panel, shortcuts, drag-and-drop, the camera
   card, the countdown and REC indicator, clean mode and toasts. Settings live
   in `settings.ts`.
7. **Recorder** (`recorder.ts`): format detection, `captureStream(60)` into
   `MediaRecorder` (chunked every second), and the download. The stage
   renders at the exact output size from the start of the countdown, so the
   first recorded frame is already warm.

### Things that make it look like a photograph

- **Studio reflections.** A procedural dark studio (black room, a tall
  softbox beside the key light, a soft panel behind the camera, a faint rim
  strip) goes through `PMREMGenerator` into the environment map, and it
  rotates with the key light so reflections and shadows always agree.
  Three's `RoomEnvironment` was the starting point, but its brightly lit grey
  walls made every pin look like grey plastic.
- **Self-occlusion.** A box blur of the pin heights (sized to the relief depth,
  O(n) running sums) tells the shader how deeply each surface is buried
  among its neighbours. Buried shafts and pits then lose their studio
  reflections, the way a real forest of pins darkens itself. This is what
  gives the picture its tone, beyond the edges the raking light picks out.
- **Perforated backplate and frame.** Each pin sits in a drilled hole in a
  charcoal plate, inside a low matte frame.

### Performance notes

- Shafts are trimmed in the vertex shader, in both the colour and the shadow
  pass, so each one ends just under the plate. Nothing hidden inside the
  plate is ever rasterised. That made the worst-case (low orbit) frame about
  7–10× cheaper in software-rendered tests.
- The pin loop, the occlusion blur and the levels lookup don't allocate. The
  one unavoidable allocation is `getImageData` (about 40 KB), once per webcam
  frame, and the sampler only runs when the camera delivers a new frame
  (usually 30 Hz).
- CPU cost per frame is about 0.3 ms at Medium (10,800 pins) and 0.5 ms at
  Insane (30,000).
- Pixel ratio is capped at 2.
- The shadow map is only re-rendered when pins or the light actually moved,
  and never twice a frame. The bokeh pass draws the scene a second time, and
  its depth prepass trims pin shafts the same way.
- With depth of field on, MSAA resolves before tone mapping. A sub-pixel
  glint would then survive as a white "firefly", so pin highlights get a soft
  ceiling while it's active.

> three r182+ removed `PCFSoftShadowMap`: it now logs a warning and falls back.
> `PCFShadowMap` does the soft filtering itself (hardware PCF plus a rotated
> Vogel disk, softness set by `shadow.radius`), so that's what's used.

## Tips for the best-looking video

- **Light your face, not the wall behind you.** The board maps brightness to
  height, so you want a bright face against a darker background. A lamp or
  window in front of you, a little to one side, is ideal. Avoid sitting with
  a window behind you. If your background is brighter than your face, try
  `invert`.
- **Distance:** sit 50–70 cm from the camera so your head fills roughly the
  middle half of the frame. Much closer and the edges crop; much further and
  your features get too few pins.
- **Contrast helps:** dark hair, glasses, eyebrows, a dark top against a light
  wall all read strongly.
- **Move slowly.** The pins are deliberately a little heavy; slow head turns
  look physical and gorgeous, fast ones smear.
- **Good defaults to start from:** Medium density, light elevation 10–15°,
  depth 1.0–1.4. Lower light and deeper pins give longer, more dramatic
  shadows. High density looks richer on a big screen; Medium reads best on a
  phone.
- **Money shots:** turn on *Auto sweep* (6–10°/s) and hold still: the shadows
  wheel round your face. Or hit **Space** to freeze a pose, then orbit for a
  "bullet time" move. Drag the view to a low side angle so the pins stand up
  like a relief sculpture.
- **Finishes:** *White matte* is the classic Alexeïeff plaster look and reads
  the strongest. *Steel* is the default glint. *Black chrome* is moody, with
  crisp crescent highlights. *Brass* is warm and vintage.
- **Depth of field** is lovely at dramatic angles, but costs frame rate; leave
  it off for straight-on shots.
- **For Reels/Shorts/TikTok** use the 9:16 frame: it crops to your face. For
  X, 16:9 or 1:1 both look great in the timeline.
- **Before a take**, check the fps readout: it should hold 60. If it dips,
  drop a density step or turn off depth of field. Recording at 1080p is
  usually lighter than a Retina window.
- **Keep the tab in front while recording.** Browsers pause background tabs,
  and the video would freeze.
- **Smoothness:** plug the laptop in, close other heavy tabs, and make sure
  your browser has hardware acceleration on (Chrome: Settings → System).

## Troubleshooting

- **"Camera access is blocked":** click the camera icon in the address bar,
  set it to *Allow*, then press **Try again**. On macOS also check System
  Settings → Privacy & Security → Camera for your browser.
- **"Camera is busy":** another app (Zoom, FaceTime, OBS, Teams) has it. Quit
  that app, then **Try again**.
- **"Camera needs a secure page":** you opened the app from a LAN IP or plain
  `http://` host. Use `http://localhost:5173`.
- **Low frame rate:** drop the density to Low or Medium, turn off depth of
  field, or make the window smaller.
- **A video file won't play:** browsers only decode what they support. MP4
  (H.264) and WebM play everywhere; some `.mov` files don't.
- **"Recording not supported here":** the browser has no `MediaRecorder`
  (very old versions). Use current Chrome, Edge, Safari or Firefox, or use
  clean mode with OBS.
- **Recording is choppy:** the video can only be as smooth as the render loop.
  Lower the density, turn off depth of field, close other heavy tabs, and plug
  the laptop in.

## Roadmap

- ~~Phase 1: core effect~~ ✓
- ~~Phase 2: controls~~ ✓
- ~~Phase 3: recording~~ ✓
- **Phase 4, extras:** MediaPipe person segmentation, click ripples, text mode,
  breathing idle mode.
