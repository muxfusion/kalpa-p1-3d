# Kalpa Villa 3D

Interactive 3D model of the Kalpa Villa phase 1 build: the bedroom, lobby and bathroom block,
with the future living room and kitchen shown as a ghost. Built with three.js from the drawings in `docs/`.

## Run it

It is a static page. Open `index.html` in a browser, or serve the folder:

```sh
python3 -m http.server 8080
# then open http://127.0.0.1:8080/
```

Append a hash to open a view directly, for example `index.html#road` or `#plan`.

## Controls

- Drag to orbit, scroll or pinch to zoom.
- **View** dropdown: aerial, paddy side, road side, drain side, plan, inside, kitchen.
- **Show** toggles: roof, bedroom block, living room, site labels. A block that is off is drawn as a faint ghost.
- **Time** slider: 06:00 to 18:00. The sun follows the real solar path for Sri Lanka (7°N) on today's date,
  with north taken as the paddy-field direction turned 30° towards the drain.
- Click any French window, door or the bedroom sliding door to open and close it.

## Files

| Path | What it is |
|---|---|
| `index.html` | Page markup: title card, view and layer controls |
| `style.css` | Styles, light and dark theme tokens |
| `app.js` | The model and all behaviour, in feet, with the plan grid noted at the top |
| `docs/plan-2.pdf` | Earlier drawing (10' × 19' bedroom block) |
| `docs/plan-3.pdf` | Current drawing the model follows |

## Model notes

- Grid: x = 0 at the paddy-side wall, 15 at the centre wall under the ridge, 27 at the far wall.
  z = 0 at the road, 19 at the bedroom block's drain wall, 28 at the living room's drain wall.
- Eaves 11', ridge 14½' over the centre wall, so the two roof slopes have different pitches.
- Walls around the bedroom run to the roof underside so the room can be air-conditioned.
- Three.js and OrbitControls load from CDNs; fonts from Google Fonts. No build step.
