# Parks, policy and recommended sites: design

Date: 2026-10-26. Status: draft for approval.

## Why

The team's whiteboard plan, the Figma screens and the "Green Lantern" slide add a planning layer on top of today's green/grey map. The app should answer three questions for a district:

1. **Where are the parks, and how far does each one reach?** Each park serves the area around it, and bigger parks reach farther.
2. **Which areas meet the 15-minute-park goal?** Green Bangkok 2030 asks for a park within 400 m.
3. **Which abandoned plots should become green first?** These are plots far from parks, outside the 400 m rings and not already covered by many park circles.

The backend teammate's v3 (`Downloads/Green-zone-v3-main`) now has real results for **Suan Luang**: the image "Theosmain" with detected green, plus parks marked with their reach circles. The user also supplied the Rocket Media Lab spreadsheet (BMA Office of Environment data): 281 accessible parks with sizes, 495 "15-minute" parks, and stats for all 50 districts. Don Mueang keeps today's example data until the backend sends more.

## Goals

- A **district drop-down** switches the whole app between **Suan Luang** and **Don Mueang**: the map view, focus mask, layers and sidebar.
- **Park circles** (whiteboard step 2): every park gets a circle by its size, following the Rocket Media Lab rule.
  - **S** 0–16,000 m²: 500 m
  - **M** 16,001–80,000 m²: 1 km
  - **L** 80,001–160,000 m²: 3 km
  - **XL** over 160,000 m²: 5 km
- **Abandoned land** (whiteboard step 2) is shown in red.
- **Map options panel** (whiteboard step 3, the user chose mockup **A**): one panel at the top right of the map holds:
  - the district drop-down
  - tick boxes **S, M, L, XL, Policy, Recommend**
  - the layer switches
- **Policy:** when ticked, a **400 m ring** is drawn around every park. Land outside every ring is lightly shaded as "not within 400 m of a park yet".
- **Recommend** (whiteboard step 4): ★ markers on abandoned plots that are **outside every 400 m ring** and score **good or very good**.
- **Planting score**, 0–100 for every abandoned plot (agreed rule below). Clicking a plot opens a **Figma-style info box** on the map:
  - Area
  - Score
  - "Very good / Good / Fair / Poor for planting"
  - Nearest park (distance and name)
- **Heat map:** the backend's heat map (`greensight/heatmap.py`, `make_heatmap`), rebuilt in the frontend for now from the backend's green results. It switches to the backend's own files when the teammate sends the `.tif` outputs.
- **Minimize both bars:**
  - The **left sidebar** collapses to a thin strip with a « button and reopens with ».
  - The **map options panel** collapses to a small pill: "⚙ Map options · Suan Luang ▾".
- **Satellite map by default** (user's choice, like the Figma). The map opens on a satellite photo, and a **Map / Satellite** switch in Map options goes back to today's street map. The photo comes from Esri World Imagery: no key, with its credit shown on the map.
- **Rename the app to Green Lantern** (user's choice): sidebar header, page title, README and docs. The leaf logo stays.
- **New sidebar features.** The sidebar layout stays, and new cards are added:
  - district facts
  - parks by size
  - share of land within 400 m of a park
  - number of recommended sites
  - park and plot panels

## Non-goals

- No new pages. The slide's Home, Policy and District Analysis pages are not part of this change.
- No change to the Word presentation in `docs/` in this update. The rename only covers the app and its docs. The presentation can follow later if asked.
- No backend or server. Everything stays a static frontend, as now.
- No walking-distance routing. Circles and rings are straight-line distance, as in the backend.
- No editing of the teammate's backend repo. We only read its files.

## Anti-goals (failure even if it "works")

- Showing example (made-up) abandoned plots as if they were real findings. They must be labelled example data.
- Losing the hosting fix. Data must stay bundled with the app, with relative paths (`base: './'`, `src/mock/`), so the app works in any folder.
- Making the map unreadable. With everything ticked, circles, rings, heat map and plots must still be readable. Thin lines, light fills, sensible defaults.

## Data sources

| Data | Source | Notes |
|---|---|---|
| Park list (both districts and neighbours) | Spreadsheet `สวนสาธาณะและพื้นที่สีเขียวใน กทม. [ข้อมูลดิบ].xlsx`, sheets "รายละเอียดสวนสาธารณะที่เข้าถึงได้" (281 parks: name, lat/lng, m², class) and "รายละอียดสวน 15 นาที" (495 parks: name, lat/lng, m², owner, development kind) | BMA Office of Environment via Rocket Media Lab (CC BY 4.0). Convert once into a bundled GeoJSON. Merge the two lists and remove duplicates (same park within ~30 m, or same name). Skip rows with impossible coordinates (for example Don Mueang "สวนสุขภาพดอนเมือง-ไทยเทยิ่น" has lat = lng) and list them in the conversion log. |
| District facts | Same spreadsheet, sheet "ข้อมูลสวนสาธารณะที่เข้าถึงได้รา" (50 districts) | Population, green area, green per person, accessible park area and per person. Rank among the 50 districts by green per person is computed from it. Suan Luang: 123,291 people, 6.09 m², 1.69 m² accessible. Don Mueang: 165,594 people, 4.39 m², 1.65 m². |
| Suan Luang image extent and green | Backend v3 `Final_Results/Theosmain/round1/green_preview.png` (2000 × 1000, 4 m/px, the full 16000 × 8000 image) and `round1/summary.json` (1.754 km² green, 5.48% of 32 km² valid) | The real GeoTIFFs are not in the repo (git ignores `.tif`). The extent, measured from the backend's `parks_marked.png` axes, is UTM 47N (EPSG:32647) x ≈ 671,762–679,762 m, y ≈ 1,516,855–1,520,855 m. That is accurate to about ±10 m until the `.tif` arrives. |
| Suan Luang parks checked against the image | Backend v3 `Final_Results/Theosmain/parks/parks_marked.geojson` (status green_detected / no_green_detected / outside_image) | Shown on the park panel as "Green seen by satellite: yes/no". |
| District boundaries | OpenStreetMap (as for Don Mueang today) | Add Suan Luang (admin_level 6) and clip its neighbours for the grey "other districts" mask. |
| Abandoned land, Don Mueang | Today's grey zones (candidate sites) | Example data, already labelled. |
| Abandoned land, Suan Luang | **Example plots** made from OpenStreetMap land use inside the image (brownfield, construction, greenfield, vacant/bare land), dropping plots the backend marks as green | Clearly labelled example data until the backend detects abandoned land ("ป่ารกร้าง, ปูน, ดิน" on the whiteboard). |

## Agreed scoring rule

The user agreed to this:
- The score goes **up** the farther a plot is from the nearest park and the bigger it is.
- The score goes **down** for every park circle that covers it. Fewer overlapping circles is better.

The builder sets the numbers. Defaults to start with, kept in `src/lib/constants.js`:

- distance points 0–50: `50 × min(1, distance to nearest park / 2,000 m)`
- size points 0–30: `30 × min(1, plot area / 5,000 m²)`
- overlap points 0–20: `20 − 10 × (number of S/M/L/XL circles covering the plot)`, never below 0
- **score = sum, rounded.** The labels are:
  - 80–100: Very good for planting
  - 60–79: Good
  - 40–59: Fair
  - under 40: Poor
- **Recommended** = outside every 400 m ring **and** score ≥ 60.

As everywhere in the app, every label is shown with a word and a symbol, never colour alone.

## Screens and behaviour

**Map options panel** (top right, replaces today's Layers box). From top to bottom:
1. Header "Map options" with a – button to minimize.
2. **District** drop-down: Suan Luang, Don Mueang.
3. **Park circles:** S · 500 m, M · 1 km, L · 3 km, XL · 5 km.
4. **Show:** Policy (400 m), Recommend.
5. **Layers:** Heat map, Green, Abandoned land. For Don Mueang only, also Green/grey grid.
6. **Base map:** Satellite (default) or Map.

Minimized, it becomes a pill. Clicking the pill opens the panel again. Defaults when the app opens are the builder's call; keep the first view readable.

**District switch:**
- The map fits the chosen district, and the grey "other areas" mask and outline move to it.
- The sidebar shows that district.
- Any selection is cleared.
- Suan Luang is the default on start, because it has the real data.

**Parks:**
- A dot for every park whose circle reaches the visible district area, including parks in neighbouring districts. For example, Suan Luang ร.๙ (XL, Prawet) reaches into Suan Luang.
- Circle colour and line style by size class. The legend explains them.
- Clicking a park shows a **park panel** in the sidebar:
  - name
  - size class and area
  - reach distance
  - owner and type
  - data source
  - for Suan Luang, "Green seen by satellite" from the backend

**Abandoned plots:**
- Red polygons.
- Clicking one shows the **Figma info box** on the map and a **plot panel** in the sidebar:
  - score card
  - area
  - nearest park
  - how many circles cover it
  - inside or outside 400 m
  - for Don Mueang, today's fitness details as well
- ★ marks the recommended plots when Recommend is ticked.

**Heat map:**
- An image layer over the district frame, in the backend's `proximity` style: green at vegetation, then yellow-green, yellow and orange, then red at or beyond the radius.
- The radius is 150 m, the backend's `run_image` default. Same palette and opacity rule as `make_heatmap(style="proximity")`.
- It is built from:
  - Suan Luang: the backend green mask preview.
  - Don Mueang: today's 5 m classified grid.
- Later, the backend's `heatmap.png`/`.tif` replaces the rebuilt image with no code change beyond the data file.

**Sidebar:**
- The same layout. A « / » button collapses it on desktop. On phones, the stats section folds instead.
- The overview gets new cards:
  - **District facts:** population, green per person, accessible parks per person, rank of 50.
  - **Parks by size:** S/M/L/XL counts in the district.
  - **Within 400 m of a park:** % of district land.
  - **Recommended sites:** count, and very good / good.
- Existing cards adapt per district. Suan Luang's green share comes from the backend summary.

**Legend:** add park dots, circles by size, the 400 m ring, abandoned land, ★ recommended and the heat map colours. It still folds.

## Data contract for the backend (later)

- Per district, the frontend needs:
  - the frame (4 corners)
  - green (grid or mask image)
  - heat map image and its corners
  - parks (points with `area_m2`)
  - abandoned plots (polygons)
- Keep the example files in `src/mock/<district>/` in that shape.
- Extend `docs/API.md` with the new pieces so the teammate can serve them. Scores, classes, rings and recommendations are computed by the frontend from these inputs.

## Constraints

- **Stack:** React 19 + Vite 8 + Tailwind 4 + Leaflet 1.9, JavaScript. No backend.
- **Tests and build:** Vitest. All current tests keep passing (74), and the new logic gets tests:
  - size class
  - score
  - circle overlap count
  - 400 m coverage
  - park de-duplication
  - district switching

  The production build must still work from any folder.
- **Conversion scripts:** scripts that convert the spreadsheet, OSM and backend PNG go in `docs/mock-data/` like the existing generators. They are not part of the app build.
- **Labels and colours:** keep the dark sidebar. Overlays must stay readable on both the satellite photo and the street map. Colour is never the only signal.

## Calls made by the designer (check these)

- **Suan Luang is the default district on start,** because it has the real backend data.
- **Parks come from both spreadsheet lists merged,** across all of Bangkok. Parks in neighbouring districts are drawn when their circle reaches the chosen district.
- **Parks under 100 m² still count as S** (the spreadsheet's 0–16,000 m² rule). The backend's `park_mark.py` gives them no circle.
- **Score numbers:** 50/30/20 points, full distance points at 2 km, full size points at 5,000 m². "Recommended" means a score of 60 or more.
- **Heat map:** the `proximity` style with a 150 m radius, matching the backend's `run_image` default.
- **Suan Luang abandoned land:** example plots made from OpenStreetMap, labelled as examples.
- **Suan Luang image position:** measured from the backend chart, accurate to about ±10 m, until the `.tif` arrives.
- **Don Mueang plots:** the plot panel keeps today's fitness details below the new planting score.
- **On phones,** the sidebar's minimize button folds the stats instead of collapsing a side strip.

## Open items waiting on the teammate

- The `.tif` outputs: `green_mask_round1.tif` (or `candidate-mask.tif`) and `heatmap.tif`, or at least `grid_index.csv`. They give the exact Suan Luang extent and the real heat map.
- Real Don Mueang results from v3, when available.
- Abandoned-land detection from the backend, to replace the example plots.

## Left to the builder

- Exact colours, line widths and default layer states.
- The tie-breaking and distance method for park de-duplication.
- How district data is organised in code.
- The fallback when a district has no heat map file.
