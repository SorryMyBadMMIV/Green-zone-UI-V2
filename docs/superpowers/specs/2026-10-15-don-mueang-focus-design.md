# GreenSight frontend: Don Mueang focus (design addendum)

- **Date:** 2026-10-15
- **Status:** approved in chat (grid option chosen; design confirmed with "ตกลง เริ่มทำเลย")
- **Builds on:** `2026-10-05-greensight-frontend-design.md`. Everything in that spec still applies unless it is changed below.

## 1. What the user asked for (translated from Thai)

1. Limit the map to **Don Mueang district only**, focused on the district and its surroundings. Other districts should be **grey**, with the text **"Update soon"**.
2. Use the latitude/longitude of the GISTDA image frames to **draw the frame** and **decide green or grey zone** inside it. **Keep the statistics** as before.
3. **Calculate areas in km²**.

The GISTDA frames (corners as [lat, lng]):

| Frame | Area (computed) | Where |
|---|---|---|
| gisda_01 | 9.024 km² | Pak Kret / Lak Si, outside Don Mueang, so "Update soon" |
| gisda_02 | 8.957 km² | Chon Buri (Sattahip), outside Bangkok, so "Update soon" |
| gisda_03 | 8.978 km² | 100% inside Don Mueang, so this is **the focus frame** |

## 2. Decisions

| Topic | Decision |
|---|---|
| Green/grey decision | **Grid of 30 × 30 cells (≈100 m)** inside gisda_03. Each cell is decided from its NDVI: **< 0 is water** (not counted), **< 0.3 is grey**, and **≥ 0.3 is green** (the report's §2.2 threshold). The frontend makes this decision. |
| Cell geometry | Computed **in the frontend** from the frame's 4 corner lat/lngs by bilinear interpolation (row 0 = north edge, col 0 = west edge). The backend sends only NDVI values. |
| Clickable zones | **Green zone** = connected green cells (≥ 2 cells). **Grey zone** = connected grey cells that are *open land* (not homes, roads, airport or water), ≥ 2 cells. These are the candidate sites. Built-up grey cells are part of the grid but are not clickable. |
| Statistics | The 4 cards for a selected zone stay as before. Areas now show as **km²**, and the "÷ people" math stays in m² because the target is in m² per person. |
| Overview (nothing selected) | **Half pie chart:** green share of the land in gisda_03, with the km² for green, grey and water. **Area:** frame km² and district km². **Candidate sites by priority.** **Frame info:** the center, the 4 corners, and the other frames with their km² and "Update soon". |
| Map focus | The map fits Don Mueang **as soon as the map container has a real size**. A `ResizeObserver` calls `invalidateSize()`, because Leaflet only notices window resizes, and fitting at 0 × 0 zooms all the way in (found in browser testing). **maxBounds** is the district bbox + 0.03° (≈3 km), and **minZoom** is the fit zoom − 0.75 (updated on resize). Reset view fits the district again. |
| Legend | A collapsible `<details>` element. It is open on desktop (≥ 1024px) and folded on phones, where it covered about ¼ of the map, and it follows the breakpoint when the screen size changes. |
| "Update soon" | A slate-grey cover over everything outside Don Mueang, dashed white outlines of the 6 neighbouring districts (Lak Si, Bang Khen, Sai Mai, Pak Kret, Lam Luk Ka, Mueang Pathum Thani), and labels "<English> · <Thai> / Update soon". gisda_01 has a dashed outline with an "Update soon" label. |
| km² | Computed in the frontend with the spherical-area formula, using the same mean Earth radius as turf.js. km² < 10 shows 3 decimals and ≥ 10 shows 2. |
| Dots at low zoom | **Removed.** With the map focused on one district, zones of ≥ 2 cells are clickable from zoom 13. |
| Old Bangkok-wide mock data | Replaced by Don Mueang data (10 parks and 8 sites removed). |

## 3. Data

| Data | Where it lives | Source |
|---|---|---|
| Frames (3 GISTDA frames, corners, status `ready` / `soon`) | `src/data/frames.js`, frontend config | The user's message (GISTDA corner coordinates) |
| Don Mueang + 6 neighbour districts, `viewBounds` | `src/data/districts.json`, static and bundled | OpenStreetMap relation 1639287 and its neighbours (ODbL). Neighbours are clipped to `viewBounds` and simplified |
| NDVI grid of gisda_03 | `GET {API}/frames/gisda_03/grid` (mock: `public/mock/grids/gisda_03.json`) | Backend. Mock: simulated |
| Green zones, grey zones | `GET {API}/green-zones`, `GET {API}/grey-zones` (unchanged contract) | Backend. Mock: simulated |

**Grid JSON:** `{ "frameId", "rows", "cols", "cellSizeM", "ndvi": [[...cols], ...rows] }`. A value that is not a finite number becomes `null` (shown as an unknown cell). A row-count mismatch is an error.

**Mock data generation** (one-off scripts, outside the project):
- Land cover inside a 30 × 30 grid plus a 10-cell margin comes from OpenStreetMap: vegetation, airfield, military, residential, institutional, paved, water and open.
- **Simulated NDVI** is a land-cover base value + smooth noise (seeded) − building coverage. **LST** is 39.2 − 8.5 × NDVI. **Population** per cell depends on land cover.
- Green zones get people within 1 km, inside and around temperatures, and an NDVI mean.
- Grey zones get the 3 factors measured per site and **min–max normalised across sites** (report §3.4). The weights are 0.4 / 0.3 / 0.3, minus a 0.05 penalty for sites of 3 cells or fewer, and they are ranked by fitness.
- Result: 16 green zones and 11 grey zones (1 High, 4 Medium, 6 Low). Green is 2.963 km², grey 5.906 km² and water 0.110 km².

## 4. Testing

- Unit tests:
  - `lib/geo` (areas of the 3 frames match turf to 0.001 km², holes, frame corners and center, mask)
  - `lib/grid` (NDVI thresholds at −0.01 / 0 / 0.29 / 0.3, cell order and corners, cells add up to the frame area)
  - `lib/format` (km², percent, lat/lng)
  - `api/data` (grid URL, grid validation, fetch)
  - `useMapData`
- Contract test: the mock grid is 30 × 30 with NDVI in −1…1, and the zones have the required fields.
- Sidebar tests: the overview shows 33% green for a synthetic grid, 8.978 km² and 37.14 km², and 2 × "Update soon"; zones show km²; "next to it" appears for a nearest park < 0.1 km.
- Browser checks:
  - the map is locked to Don Mueang
  - the grey cover and labels show
  - the grid colors match the NDVI rule
  - zones open the panels
  - layer toggles, Reset view, and the phone layout work

## 5. Update: 5 m cells (user request, same day)

The user found the 100 m cells too coarse ("กรอบดูใหญ่ไป") and asked for **5 × 5 m cells**. Everything above still applies, except:

| Topic | Change |
|---|---|
| Grid size | **600 × 600 cells** (≈ 4.98 × 5.01 m; `cellSizeM: 5`). That's 360,000 NDVI values, about 1.7 MB of JSON. |
| Drawing | 360,000 SVG polygons would freeze the browser. Instead the classes become a **1-pixel-per-cell image**, drawn by a Leaflet `GridLayer` (`ClassifiedGridLayer`). Each 256 px tile maps the image onto the frame with **two affine triangles** (TL-TR-BL and TR-BR-BL), so all four GISTDA corners land exactly; error inside is under half a cell. The layer uses halved copies of the image (mipmaps) when zoomed out, and is crisp, one square per cell, when zoomed in. Water and unknown cells are transparent. |
| Classes in memory | `classifyGrid(grid)` gives one byte per cell (`CLASS` codes), with no per-cell GeoJSON. `classAreas(frame, classified)` sums every cell's real area from the corner lattice (≈ 0.1 s for 360,000 cells). |
| Mock data | OpenStreetMap shapes are **rasterised** onto the 5 m grid: polygons by scanline, roads, railways, runways, taxiways and canals as strips of their real width. Buildings, roads and aprons are grey, and the airfield and parks are green. NDVI = land-cover base + ≈200 m and ≈25 m smooth noise + jitter. "People nearby" and the surrounding temperature still use a 100 m context grid. Zone outlines follow the cell edges, simplified by about 3 m. |
| Zones | Green zone = connected green cells **≥ 5,000 m²**, giving 44 zones (6 meet the target, 7 below, 31 far below). Grey zone = connected open-land grey cells ≥ 2,000 m²; the **best 20 of 151 candidate sites** by fitness are kept. Green-access distance is measured to the nearest green zone. |
| Result | Green 1.913 km² (≈ 22%), grey 6.894 km², water 0.171 km². Green is lower than with 100 m cells because roads and buildings now show at their real width. |
