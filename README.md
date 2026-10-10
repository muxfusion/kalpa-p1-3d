# Kalpa Villa 3D

Interactive 3D model of the Kalpa Villa phase 1 build: the bedroom, laundry and bathroom block,
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
- **Show** toggles: roof, bedroom block, living room, site labels, wind. A block that is off is drawn as a faint ghost.
- **Wind** adds a **Month** slider: a large arrow and drifting streaks show the prevailing wind for that month at the real site
  (7.978°N, 81.025°E). Monthly directions and speeds are vector means of hourly 10 m wind for 2019–2023 from the
  Open-Meteo ERA5 archive, embedded in `app.js`.
- **Time** slider: 06:00 to 18:00. The sun follows the real solar path for Sri Lanka (7°N) on today's date,
  with north taken as the paddy-field direction turned 30° towards the drain.
- Click any French window, door or the bedroom sliding door to open and close it.
- **Plan** tab (top left): line drawings generated from the same wall data as the model, a dimensioned floor plan and the four elevations. **Download PDF** saves them as a five-page A4 landscape file (jsPDF and svg2pdf load from CDNs on first use; the print dialog is the fallback).

## Files

| Path | What it is |
|---|---|
| `index.html` | Page markup: title card, view and layer controls |
| `style.css` | Styles, light and dark theme tokens |
| `app.js` | The model and all behaviour, in feet, with the plan grid noted at the top |
| `drawings.js` | The Plan tab: builds the SVG plan and elevations from the wall record app.js publishes |
| `docs/plan-2.pdf` | Earlier drawing (10' × 19' bedroom block) |
| `docs/plan-3.pdf` | Current drawing the model follows |

## Model notes

- Grid: x = 0 at the paddy-side wall, 15 at the centre wall under the ridge, 27 at the far wall.
  z = 0 at the road, 19 at the bedroom block's drain wall, 28 at the living room's drain wall.
- Eaves 11'. With `SPLIT=true` (the current setting, top of `app.js`) the roof is a split monopitch: the bedroom roof rises to
  14½' at the centre wall and hoods 2' past it, the living roof rises only to 13½' below it, and the band of centre wall
  between them is left as a plain open slot facing the living-room side. The living roof has a gap of the same size at its
  top edge, and one hinged flap closes either; click the flap to swing it between bedroom and living room. `SPLIT=false` restores the single
  ridged roof (ridge 14½' with the ventilated ridge from `VENT`).
- Walls around the bedroom run to the roof underside so the room can be air-conditioned.
- Passive ventilation is switchable: `VENT` at the top of `app.js` adds a ventilated ridge (raised capping over a slot) and open eaves
  (eave-side walls stop 6" under the roof with exposed rafter tails). Set it to `false` for the sealed roof.
- Three.js and OrbitControls load from CDNs; fonts from Google Fonts. No build step.
