# Green Zone frontend

An interactive map for **Green Zone** (GeoHackathon 2026, GISTDA): urban green space planning with THEOS-2, aligned with **Green Bangkok 2030** and the **15-minute park** policy. It covers two districts: **Suan Luang (สวนหลวง)**, where the backend has real THEOS-2 results, and **Don Mueang (ดอนเมือง)**.

- **District drop-down:** switch the whole app between Suan Luang and Don Mueang.
- **Parks and their reach:** every park from the BMA / Rocket Media Lab list, with a circle by size: **S** up to 16,000 m² reaches 500 m, **M** up to 80,000 m² reaches 1 km, **L** up to 160,000 m² reaches 3 km, **XL** reaches 5 km.
- **Policy:** a 400 m ring around every park. Land outside every ring is shaded: it is not yet within 400 m of a park.
- **Abandoned land (red) and recommendations (★):** every plot gets a planting score from 0 to 100. The ★ marks plots outside every 400 m ring that score good or very good.
- **Heat map:** the backend's heat map (green near plants, yellow, then red far from plants).
- **Green:** Suan Luang shows the green the backend found in the THEOS-2 image. Don Mueang shows the 5 m green/grey grid.
- **Satellite map** by default, with a switch to the street map. Both side panels can be minimized.

> This is the frontend only. Suan Luang uses the backend's real green results and the BMA park list, Don Mueang still uses example data, and the abandoned plots in both districts are **example data** until the backend detects abandoned land.

## Run it

You need Node.js 22.12 or newer (tested with Node 24).

**Windows: double-click `start.bat`.** It installs the packages the first time, starts the app on localhost, and opens your browser. Close its window to stop the app.

Or in a terminal:

```bash
npm install
npm run dev
```

Then open http://localhost:5173.

| Command | What it does |
|---|---|
| `npm run dev` | Start the dev server with hot reload |
| `npm test` | Run the unit and component tests once |
| `npm run build` | Make a production build in `dist/` |
| `npm run preview` | Serve the production build locally |

## Put it online for everyone

1. Run `npm run build`. It makes the `dist/` folder: the whole app, with the data and images built in.
2. Upload everything inside `dist/` to any static web host, for example GitHub Pages, Netlify, Vercel, or a folder on a school or office web server. It works at the top of a site and in a subfolder such as `https://example.com/green-lantern/`, with no extra settings.
3. Share the address. Anyone with the link can use the app in their browser.

Don't open `dist/index.html` by double-clicking it, because browsers block apps opened as files. To try the build on your own computer, run `npm run preview`.

## How to use the app

- **Map options** (top right): choose the district, tick the park circles (S, M, L, XL), **Policy · 400 m**, **Recommend**, the layers (heat map, green, abandoned land, and the grid in Don Mueang) and the base map. The – button folds the panel into a small pill.
- **Click a park dot** to see its size, reach, owner and lists. In Suan Luang it also shows whether the satellite saw green there.
- **Click a red plot or a ★** to see its planting score in the box on the map and in the sidebar.
- **Sidebar:** the « button minimizes it, and » opens it again. To go back to the overview, press Esc, click ×, or click empty map.
- **Moving around:** zoom with the + / − buttons, the mouse wheel or a pinch. ⤢ fits the district again.

## The planting score

Every abandoned plot gets a score from 0 to 100:

- **Distance:** up to 50 points, full at 2 km or more from the nearest park.
- **Size:** up to 30 points, full at 5,000 m² or more.
- **Overlap:** up to 20 points. Every park circle that already covers the plot takes 10 points off, because people there already have parks.

| Score | Meaning |
|---|---|
| 80–100 | Very good for planting |
| 60–79 | Good for planting |
| 40–59 | Fair for planting |
| under 40 | Poor for planting |

**Recommended (★)** means outside every 400 m ring **and** a score of 60 or more. Distances are straight-line, not walking distance. The numbers are in `src/lib/constants.js`.

## If it says "Couldn't load zone data"

The card shows the address that failed and why, for example `Loading …/abandoned.geojson failed with HTTP 404`.

- **With the "Mock data" badge:** the example data didn't load. Make sure your copy has the `src/mock/` folder and the current `vite.config.js`, then build again.
- **Without the badge:** the app is using the backend in `VITE_API_URL`. Check that the backend is running, that the address is right, and that it allows CORS from the app's address.

## Connect the backend

1. Copy `.env.example` to `.env`.
2. Set `VITE_API_URL` to the backend base URL, for example `VITE_API_URL=http://localhost:8000/api`.
3. Restart `npm run dev`. The "Mock data" badge disappears.

The backend serves each district's data at `{VITE_API_URL}/districts/{district}/…`. **[docs/API.md](docs/API.md)** describes it, and the files in `src/mock/<district>/` are working examples.

## Project structure

```
src/
  App.jsx                 page layout, district, map options, selection, Esc key
  config.js               backend URL, base maps (satellite, street), zoom limits
  data/districts.js       the two districts: outline, image frame, heat map, which data they have
  data/districts/         district outlines + grey neighbours (OpenStreetMap)
  data/parks.json         every park from the BMA / Rocket Media Lab list (690 parks)
  data/district-facts.json  population and green space per person for the 50 districts
  data/frames.js          the GISTDA frames for Don Mueang
  api/data.js             loads and checks each district's data (example files or backend)
  hooks/useMapData.js     loading / error / retry, per district
  lib/parks.js            park size classes and reach
  lib/planting.js         planting score, levels, nearest park, 400 m coverage
  lib/district.js         everything about one district: parks, coverage, scores, recommendations
  lib/geo.js              areas, distances, points in polygons, frame corners
  lib/grid.js             NDVI → green / grey / water cells
  components/map/         Leaflet map, map options, parks, policy, ★, info box, heat map and image layers
  components/sidebar/     overview, park panel, green zone panel, abandoned plot panel, cards
  components/charts/      half pie gauge, cooling chart, factor bars, priority bar
  components/ui/          cards, lists, loading and error states
  mock/suan-luang/        backend green + heat map images, frame corners, example plots, park checks
  mock/don-mueang/        NDVI grid, green zones, example plots, heat map
public/                   favicon
docs/API.md               the data contract for the backend
docs/mock-data/           scripts that made the data files
```

## Data

- **Parks:** the BMA Office of Environment park lists via Rocket Media Lab (CC BY 4.0), with 281 accessible parks and 495 "15-minute" parks. A row is merged into a park only when it is in the same district and has the same name (within 1 km), or, across the two lists, sits within 30 m at a similar size (at most 2× the area). That gives 690 parks. Every merge and the 7 rows with impossible coordinates are listed in `src/data/parks.json` (`metadata.merges`, `metadata.skipped`).
- **Suan Luang green and heat map:** from backend v3 (`Final_Results/Theosmain`, THEOS-2 image "Theosmain", 8 km × 4 km). The heat map is made with the backend's own `make_heatmap(style="proximity", radius_m=150)`. Until the backend's `.tif` arrives, the image's position is measured from its chart, accurate to about ±10 m.
- **Don Mueang:** the NDVI grid, green zones and temperatures are simulated from OpenStreetMap land cover (example data).
- **Abandoned plots:** **example data** in both districts. Suan Luang's come from OpenStreetMap land use (scrub, meadow, construction, brownfield). Don Mueang's are the earlier simulated grey zones.
- **How it was made:** see [docs/mock-data/](docs/mock-data/README.md).

## Changing things

- **Rules:** park classes, the 400 m radius, the score points and the "recommended" line are in `src/lib/constants.js`.
- **Districts:** `src/data/districts.js`.
- **Colors:** UI colors are in `src/index.css` (`@theme`), and data colors are in `src/lib/constants.js`.
- **Base maps:** tile URLs and credits are in `src/config.js`.

## Credits

- **Satellite tiles:** © Esri (Esri, Maxar, Earthstar Geographics and the GIS User Community).
- **Street tiles and map data:** © OpenStreetMap contributors (ODbL). The street tiles come from `tile.openstreetmap.org` and need no API key, which is fine for demos. For heavy traffic, use a tile provider (see the [tile usage policy](https://operations.osmfoundation.org/policies/tiles/)).
- **Park lists and district figures:** BMA Office of Environment via Rocket Media Lab (CC BY 4.0).
- **Satellite analysis:** THEOS-2 imagery from GISTDA, processed by the team's backend.
