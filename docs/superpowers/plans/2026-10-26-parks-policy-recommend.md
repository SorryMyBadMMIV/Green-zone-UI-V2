# Parks, Policy and Recommended Sites Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the following to the app, and rename it to Green Lantern:
- a district drop-down (Suan Luang, Don Mueang)
- park reach circles by size (S/M/L/XL)
- 400 m policy rings
- red abandoned land with a 0–100 planting score and ★ recommendations
- the backend's heat map
- a satellite base map
- minimize buttons for the sidebar and the map options panel

**Architecture:**
- **Offline scripts** in `docs/mock-data/` turn three sources into bundled files under `src/data/` and `src/mock/<district>/`: the parks spreadsheet, OpenStreetMap, and the backend v3 results. The heat maps are made with the backend's own `make_heatmap`.
- **Pure functions** in `src/lib/` work out park classes, distances, scores, 400 m coverage and recommendations.
- **Per-district loading:** a district config (`src/data/districts.js`) drives `useMapData(district)`, the map layers and the sidebar.

**Tech Stack:** React 19, Vite 8, Tailwind CSS 4, Leaflet 1.9.4 + react-leaflet 5, Vitest 5 + Testing Library. Offline scripts use:
- Python 3.11 with numpy, scipy, rasterio and Pillow (all already installed)
- Node with osmtogeojson and @turf/turf (in the generator folder, as before)

**Spec:** `docs/superpowers/specs/2026-10-26-parks-policy-recommend-design.md`

## Global Constraints

- **No git in this project** (the user chose no git). Skip every "commit" idea and just keep the tests green after each task.
- **Data bundling:** all data stays bundled under `src/` and is loaded through Vite URLs (`import.meta.glob(... '?url')` or `import url from './x.png'`). Keep `base: './'` in `vite.config.js`, so the build works in any folder.
- **Park size classes (Rocket Media Lab):**

  | Class | Park area | Reach |
  |---|---|---|
  | S | 0–16,000 m² | 500 m |
  | M | 16,001–80,000 m² | 1,000 m |
  | L | 80,001–160,000 m² | 3,000 m |
  | XL | over 160,000 m² | 5,000 m |

  Parks under 100 m² still count as S.
- **Policy radius:** 400 m around every park.
- **Score** (0–100, rounded):
  - distance points `50 × min(1, d / 2000 m)`
  - size points `30 × min(1, area / 5000 m²)`
  - overlap points `max(0, 20 − 10 × circles covering)`
- **Score labels:**

  | Score | Level key | Shown as |
  |---|---|---|
  | 80–100 | `very-good` | "Very good for planting" |
  | 60–79 | `good` | "Good for planting" |
  | 40–59 | `fair` | "Fair for planting" |
  | under 40 | `poor` | "Poor for planting" |

- **Recommended** = outside every 400 m ring **and** score ≥ 60.
- **Distances** are straight-line, measured from a plot's label point (always inside the plot) to the park point.
- **Colour is never the only signal:** every level and status has a word, and recommended plots have ★.
- **App name:** "Green Lantern". The sidebar subtitle is "{District} green space explorer".
- **District facts:** Suan Luang is the default district. The district facts come from the spreadsheet's 50-district sheet.
- **Satellite base map (default):** URL `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}`, attribution `Tiles &copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community`, `maxNativeZoom: 18`, `maxZoom: 19`. The street map is today's OSM tiles.
- **Suan Luang image extent** (backend "Theosmain", measured from the backend chart, about ±10 m): EPSG:32647, x 671,762–679,762 m, y 1,516,855–1,520,855 m.
- **Heat map:** backend `make_heatmap(style="proximity", radius_m=150)`.
- **Example data** (Suan Luang abandoned plots, everything in Don Mueang except parks and boundaries) is labelled "Example" wherever it's shown.
- **Never write into the backend folder** `C:/Users/poohk/Downloads/Green-zone-v3-main/Green-zone-v3-main`. Only read it.

## Review Focus

1. **A district where every plot is within 400 m of a park.** Expect 0 recommended, a "0 recommended sites" card, and no ★, with no crash. The test is in Task 2.
2. **Switching district while a park or plot is selected, or while data is still loading.** Expect the selection to clear and the old district's plots never to show on the new district. The test is in Task 4 (the hook drops old data on switch); App clears the selection in Task 9.
3. **Spreadsheet rows with broken coordinates or areas** (for example lat = lng). Expect them skipped and logged by the script. `sizeClass` returns `null` for a missing area, so the park gets a dot but no circle. The test is in Task 1.
4. **L-shaped or ring-shaped plots whose centre falls outside the plot.** Expect the ★, the distance and the policy check to use a point inside the plot. The test is in Task 2.
5. **Phone width (375 px).** Expect the map options panel to start minimized, so it doesn't cover the small map, and the info box to stay readable. The test is in Task 7.

---

### Task 1: Park list, district facts and park classes

**Files:**
- Create: `docs/mock-data/make-parks.py`
- Generated: `src/data/parks.json`, `src/data/district-facts.json`
- Create: `src/lib/parks.js`, `src/lib/parks.test.js`, `src/lib/districtFacts.js`, `src/lib/districtFacts.test.js`, `src/data/parks.test.js`

**Interfaces:**
- Produces:
  - `src/data/parks.json`: a GeoJSON FeatureCollection of Point features with properties `{ id: 'park-001'…, name, districtTh, areaM2, owner: string|null, kind: string|null, lists: ('accessible'|'15min')[] }` and `metadata: { source, license: 'CC BY 4.0', skipped: [{ sheet, row, name, reason }] }`.
  - `src/data/district-facts.json`: an array of `{ districtTh, population, greenM2, greenPerPersonM2, accessibleM2, accessiblePerPersonM2 }`, one entry per district (50).
  - `PARK_SIZE_CLASSES`: `[{ key: 'S', maxM2: 16000, radiusM: 500 }, { key: 'M', maxM2: 80000, radiusM: 1000 }, { key: 'L', maxM2: 160000, radiusM: 3000 }, { key: 'XL', maxM2: Infinity, radiusM: 5000 }]`.
  - `sizeClass(areaM2) -> { key, radiusM } | null`.
  - `loadParks(featureCollection) -> Park[]`, where `Park = { id, name, districtTh, areaM2, owner, kind, lists, lngLat: [lng, lat], size: { key, radiusM } | null }`.
  - `parksReaching(parks, [west, south, east, north]) -> Park[]`: parks whose circle (or, without a class, the park point itself) reaches the box.
  - `districtFacts(districtTh) -> { population, greenM2, greenPerPersonM2, accessibleM2, accessiblePerPersonM2, rank, of } | null`, where `rank` is 1 for the most green per person among `of` = 50 districts.

- [ ] **Step 1: Write `make-parks.py <xlsx> <project-root>`**

  It reads the xlsx without openpyxl, using zipfile and the sheet XML. The scratchpad `xlsx_dump.py` from the brainstorm shows the parsing.
  - **Sheet "รายละเอียดสวนสาธารณะที่เข้าถึงไ…"** (281 rows): district, name, `"lat, lng"`, m², class.
  - **Sheet "รายละอียดสวน 15 นาที"** (495 rows): district, name, `"lat , lng"`, development kind, area text, m², owner.
  - **Merge rule:** a 15-minute row within 30 m of an accessible-list park, or with the same name after removing all spaces, merges into that park. `lists` becomes `['accessible','15min']`, and `owner`/`kind` come from the 15-minute row.
  - **Skip** rows whose coordinates are outside lat 13.4–14.1 / lng 100.2–101.0, and rows whose m² is not a positive number. Record each in `metadata.skipped`.
  - **District facts:** the sheet "ข้อมูลสวนสาธารณะที่เข้าถึงได้รา" gives `district-facts.json`.
  - **Output:** both files written with `ensure_ascii=False`, plus a printed summary: count per list, merged, skipped.

- [ ] **Step 2: Run it**

  Run: `python -I docs/mock-data/make-parks.py "C:/Users/poohk/Downloads/สวนสาธาณะและพื้นที่สีเขียวใน กทม. [ข้อมูลดิบ].xlsx" .`

  Expected:
  - "สวนสุขภาพดอนเมือง-ไทยเทยิ่น" is listed as skipped (its lat equals its lng).
  - The parks file has more than 500 features.
  - `district-facts.json` has 50 entries.

- [ ] **Step 3: Write the failing tests**

  `src/lib/parks.test.js`:
  - `sizeClass`:

    | Area (m²) | Result |
    |---|---|
    | 0, 50, 16000 | S / 500 |
    | 16001, 80000 | M / 1000 |
    | 80001, 160000 | L / 3000 |
    | 160001, 800000 | XL / 5000 |
    | `null`, `NaN`, `-1` | `null` |

  - `loadParks` turns features into `Park` objects and skips a feature without Point coordinates.
  - `parksReaching`:
    - an XL park 4 km east of a box is included
    - an S park 600 m from the box is excluded
    - an S park inside the box is included

  `src/lib/districtFacts.test.js`:
  - `districtFacts('สวนหลวง')` has `population` 123291, `greenPerPersonM2` 6.09 and `accessiblePerPersonM2` 1.69.
  - `districtFacts('ดอนเมือง').population` is 165594.
  - `rank` is an integer from 1 to 50, and `of` is 50.
  - `districtFacts('ไม่มี')` is `null`.

  `src/data/parks.test.js`:
  - Every feature has a unique `id`, `areaM2 > 0`, coordinates inside the Bangkok box from Step 1, and non-empty `lists`.
  - At least 10 parks have `districtTh` 'สวนหลวง' and at least 10 have 'ดอนเมือง'.
  - "สวนหลวง ร.๙" exists with `areaM2` 800000.

- [ ] **Step 4: Run** `npx vitest run src/lib/parks.test.js src/lib/districtFacts.test.js src/data/parks.test.js`. Expected: FAIL, because the modules don't exist yet.

- [ ] **Step 5: Implement `src/lib/parks.js` and `src/lib/districtFacts.js`**

  `parksReaching` expands the box by each park's `radiusM`, converting metres to degrees at the park's latitude (`lat° = m / 111195`, `lng° = m / (111195·cos lat)`).

  Put the constants in `src/lib/constants.js` (`PARK_SIZE_CLASSES`) and re-export them from `parks.js`.

- [ ] **Step 6: Run the same command.** Expected: PASS. Then run `npm test`. Expected: all tests pass (74 old plus the new ones).

---

### Task 2: Geometry helpers, planting score and district analysis

**Files:**
- Modify: `src/lib/geo.js`, `src/lib/geo.test.js`, `src/lib/constants.js`
- Create: `src/lib/planting.js`, `src/lib/planting.test.js`, `src/lib/district.js`, `src/lib/district.test.js`

**Interfaces:**
- Consumes: `Park` and `sizeClass` from Task 1.
- Produces:
  - Geometry helpers in `geo.js`:
    - `haversineM([lng, lat], [lng, lat]) -> metres` (R = 6371008.8)
    - `pointInPolygon([lng, lat], geometry) -> boolean` (Polygon or MultiPolygon, holes respected)
    - `polygonLabelPoint(geometry) -> [lng, lat]`, always inside the polygon
    - `bboxOf(geometry) -> [west, south, east, north]`
  - Constants in `constants.js`: `POLICY_RADIUS_M = 400`, `SCORE_DISTANCE_FULL_M = 2000`, `SCORE_AREA_FULL_M2 = 5000`, `SCORE_POINTS = { distance: 50, size: 30, overlap: 20, perCircle: 10 }`, `RECOMMEND_MIN_SCORE = 60`.
  - Scoring in `planting.js`:
    - `scorePlot({ distanceM, areaM2, circlesCovering }) -> integer 0–100`
    - `plantingLevel(score) -> { key: 'very-good'|'good'|'fair'|'poor', label }`. The labels are exactly as in Global Constraints.
    - `analysePlot(geometry, areaM2, parks) -> { point, nearestPark: { id, name, distanceM } | null, circlesCovering, withinPolicy, score, level, recommended }`
    - `policyCoverage(geometry, parks, { radiusM = 400, stepM = 50 } = {}) -> fraction 0–1` (sampled grid of points inside the polygon)
  - District summary in `district.js`: `analyseDistrict({ focus, parks, plots }) -> DistrictAnalysis`. `focus` is a GeoJSON geometry, `parks` is `Park[]` and `plots` is the abandoned FeatureCollection, already normalized. `DistrictAnalysis` is:

    ```
    {
      parks,              // the parks that reach the district (Park[])
      parksBySize,        // { S, M, L, XL } counts of parks inside the focus
      policyShare,
      plots,              // Record<plotId, PlotAnalysis>
      recommendedIds,     // string[]
      recommendedCounts,  // { veryGood, good }
    }
    ```

    A plot's area is `properties.areaM2`, or `polygonAreaM2` when that is missing.

- [ ] **Step 1: Write the failing tests**
  - `geo.test.js`:
    - `haversineM([100.6, 13.7], [100.6, 13.709])` is close to 1000.8 (within 0.5).
    - `pointInPolygon`: inside, outside, inside a hole (false), and in the second part of a MultiPolygon.
    - `polygonLabelPoint`: for an L-shaped polygon whose bounding-box centre is outside it, it returns a point where `pointInPolygon` is true. For a square, it returns the centre.
    - `bboxOf` of a square.
  - `planting.test.js`:
    - `scorePlot`:

      | distanceM | areaM2 | circlesCovering | score |
      |---|---|---|---|
      | 2000 | 5000 | 0 | 100 |
      | 4000 | 9000 | 0 | 100 |
      | 1000 | 2500 | 1 | 50 |
      | 1600 | 3000 | 0 | 78 |
      | 0 | 0 | 3 | 0 |
      | `Infinity` (no parks) | 5000 | 0 | 100 |

    - `plantingLevel`:

      | Score | Level key |
      |---|---|
      | 80 | `very-good` |
      | 79, 60 | `good` |
      | 59, 40 | `fair` |
      | 39 | `poor` |

    - `analysePlot` with a 50 m square plot (2,500 m²) centred at (100.6, 13.7):
      - **An S park 1,000.8 m north** (at lat 13.709) gives:
        - `nearestPark.distanceM` ≈ 1001
        - `circlesCovering` 0
        - `withinPolicy` false
        - `score` 60, which is round(25.02 + 15 + 20)
        - level `good`
        - `recommended` true
      - **An S park 300 m away** gives `circlesCovering` 1, `withinPolicy` true and `recommended` false.
    - `policyCoverage` of a 1 km × 1 km square with one park at its centre is within 0.03 of π·400²/1e6 (0.503). With no parks it is 0.
  - `district.test.js`:
    - **A district with two plots:** one far plot (recommended) and one plot 100 m from a park (`withinPolicy`). Expect `recommendedIds` to equal the far plot's id, and `recommendedCounts` to match its level.
    - **Review Focus 1:** all plots within 400 m gives `recommendedIds` `[]` and `recommendedCounts` `{ veryGood: 0, good: 0 }`.
    - **Size counts:** `parksBySize` counts only parks inside the focus polygon.

- [ ] **Step 2: Run** `npx vitest run src/lib`. Expected: the new tests fail.

- [ ] **Step 3: Implement** `geo.js` additions, `planting.js` and `district.js`.
  - **`polygonLabelPoint`:** use the area centroid when it is inside the polygon. Otherwise, take the horizontal line through the centroid's latitude, cross it with the outer ring, and return the middle of the widest inside segment.
  - **`policyCoverage`:** sample points on a `stepM` grid inside `bboxOf(geometry)`, keep those for which `pointInPolygon` is true, and count the share within `radiusM` of any park using `haversineM`. Pre-filter the parks to the box expanded by the radius.

- [ ] **Step 4: Run** `npx vitest run src/lib`. Expected: PASS. Then run `npm test`. Expected: all tests pass.

---

### Task 3: District data files (Suan Luang + reorganised Don Mueang)

**Files:**
- Modify: `docs/mock-data/fetch-district.mjs`
  - It takes `--relation <id>` or `--name "<Nominatim query>"` and `--out <file>`.
  - With `--name`, it looks up the relation id using `https://nominatim.openstreetmap.org/search?format=json&q=…` with the same User-Agent.
- Modify: `docs/mock-data/fetch-frame-osm.mjs`. It takes `--bbox w,s,e,n --tiles NxM --out <file>`.
- Create: `docs/mock-data/make-suan-luang-data.mjs`. It writes:
  - `src/data/districts/suan-luang.json` (same shape as today's `districts.json`)
  - `src/mock/suan-luang/abandoned.geojson`
  - `src/mock/suan-luang/park-checks.geojson`
  - `src/mock/suan-luang/summary.json`
- Create: `docs/mock-data/make-heatmaps.py`. It writes `src/mock/suan-luang/green.png`, `src/mock/suan-luang/heatmap.png` and `src/mock/don-mueang/heatmap.png`, and prints the Suan Luang frame corners.
- Move these files:

  | From | To |
  |---|---|
  | `src/data/districts.json` | `src/data/districts/don-mueang.json` |
  | `src/mock/green-zones.geojson` | `src/mock/don-mueang/green-zones.geojson` |
  | `src/mock/grey-zones.geojson` | `src/mock/don-mueang/abandoned.geojson` |
  | `src/mock/grids/gisda_03.json` | `src/mock/don-mueang/grid.json` |

  Update the output paths in `docs/mock-data/make-don-mueang-data.mjs` and the `docs/mock-data/README.md` steps.
- Modify: `src/api/mockData.test.js`

**Interfaces:**
- Produces, read by Task 4:

  | File | Contents |
  |---|---|
  | `src/data/districts/<id>.json` | Focus feature (`role: 'focus'`) + neighbours (`role: 'soon'`) + `metadata.viewBounds` |
  | `src/mock/<id>/abandoned.geojson` | Plot polygons with `{ id, district, areaM2, landCover: 'concrete or soil' \| 'overgrown', isExample: true }`. The Don Mueang file keeps today's grey-zone properties and adds `isExample: true`. |
  | `src/mock/suan-luang/park-checks.geojson` | Points from the backend `parks_marked.geojson` with `{ name, areaM2, sizeClass, status, greenM2 }` |
  | `src/mock/suan-luang/summary.json` | The backend's `round1/summary.json`, copied unchanged |
  | `green.png` / `heatmap.png` | Images covering the frame exactly: row 0 is the north edge, column 0 the west edge |

  The four Suan Luang frame corners `[lat, lng]` are printed by `make-heatmaps.py` and pasted into Task 4's config.

- [ ] **Step 1: Write the data contract tests (failing) in `src/api/mockData.test.js`**
  - The existing Don Mueang assertions are kept, pointed at the new paths.
  - Suan Luang:
    - `districts/suan-luang.json` has exactly one `role: 'focus'` feature, whose `nameEn` is 'Suan Luang' and whose area is between 15 and 35 km².
    - `abandoned.geojson` has at least 5 plots, unique ids, Polygon/MultiPolygon geometry, `areaM2 >= 200`, `isExample === true`, and every label point inside both the focus polygon and the frame's lat/lng box.
    - `park-checks.geojson` has 10 points whose `status` is one of `green_detected`, `no_green_detected`, `outside_image`.
    - `summary.json` has `green_area_m2` 1753864.25.

- [ ] **Step 2: Run** `npx vitest run src/api/mockData.test.js`. Expected: FAIL (the files are missing).

- [ ] **Step 3: Move the Don Mueang files and update `make-don-mueang-data.mjs` paths**

  Run `npx vitest run src/api/mockData.test.js`. Expected: the Don Mueang assertions pass, and Suan Luang still fails.

- [ ] **Step 4: Fetch the Suan Luang OSM data**

  Work in the existing generator folder `C:/Users/poohk/AppData/Local/Temp/claude/C--Users-poohk-OneDrive-Desktop-UI-Front/fc8d5f0c-5873-4695-bb50-3348e9937db4/scratchpad/mockgen` (it already has osmtogeojson and @turf/turf). Copy the updated scripts there and run:
  - `node fetch-district.mjs --name "Suan Luang District, Bangkok" --out suan-luang-district-raw.json`
  - `node fetch-frame-osm.mjs --bbox <frame box + 0.005°> --tiles 6x3 --out suan-luang-frame-raw.json`

  Expected: the district relation is found (admin_level 6), with its neighbours, and each tile reports elements.

- [ ] **Step 5: Run `make-heatmaps.py <backend-root> .`**

  - **Import the backend's function:** `sys.path.insert(0, backend_root)`, then `from greensight.heatmap import make_heatmap`.
  - **Suan Luang mask:**
    - Read `Final_Results/Theosmain/round1/green_preview.png`. Mask = 1 where the pixel is the backend green (60, 220, 90), else 0, with `pixel_m = 4.0`.
    - `make_heatmap(mask, 4.0, min_area_m2=16, radius_m=150, style='proximity')`, then save `rgba` as `heatmap.png`.
    - Save `green.png`: RGBA (0, 180, 65, 200) where the mask is 1, transparent elsewhere.
  - **Don Mueang mask:**
    - Read `src/mock/don-mueang/grid.json`. Mask = 1 where NDVI ≥ 0.3, 0 where it is lower, and 255 where it is not a number.
    - `pixel_m = 4.994`, `min_area_m2 = 25`, the same radius and style. Save `heatmap.png`.
  - **Frame corners:** convert the four Suan Luang extent corners from EPSG:32647 with `rasterio.warp.transform` and print them as `[lat, lng]` (TL, TR, BL, BR).

  Run: `python -I docs/mock-data/make-heatmaps.py "C:/Users/poohk/Downloads/Green-zone-v3-main/Green-zone-v3-main" .`

  Expected: three PNGs are written, plus four corner lines with lat ≈ 13.71–13.75 and lng ≈ 100.59–100.67.

- [ ] **Step 6: Run `node make-suan-luang-data.mjs <project-root> <backend-root>`**
  - **District file:** neighbours are clipped to `viewBounds` (the focus bbox ± 0.03°) and simplified, exactly like the Don Mueang file.
  - **Abandoned plots:** OSM polygons inside the focus and the frame, with these tags:

    | Tags | `landCover` |
    |---|---|
    | `landuse` = brownfield, construction, greenfield, vacant | concrete or soil |
    | `natural` = scrub, `landuse` = meadow | overgrown |

    Drop parks, leisure, school, religious, residential and military areas. Keep pieces of 200 m² or more and give them ids `SL-001`…, largest first.
  - **Copies:** park checks are copied from the backend `Final_Results/Theosmain/parks/parks_marked.geojson` points (role `park`), and the summary from `round1/summary.json`.
  - **Too few plots:** if fewer than 5 plots result, the script exits with an error that names the tag counts. Do not invent geometry.

- [ ] **Step 7: Run** `npx vitest run src/api/mockData.test.js`. Expected: PASS. Then run `npm test`. Expected: everything that doesn't import the old paths passes. Tasks 4 and 8 fix the imports of `districts.json` and the mock paths.

---

### Task 4: District config and per-district loading

**Files:**
- Create: `src/data/districts.js`, `src/data/districts.test.js`
- Modify: `src/api/data.js`, `src/api/data.test.js`, `src/hooks/useMapData.js`, `src/hooks/useMapData.test.js`, `src/data/frames.js`

**Interfaces:**
- Consumes: the Task 3 files; `FRAMES` from `frames.js`.
- Produces:
  - `DISTRICTS`: an array of `District` objects:

    ```
    District = {
      id: 'suan-luang' | 'don-mueang',
      nameEn, nameTh,
      boundaries,            // the JSON from Task 3
      frame: { id, label, corners, source, note },
      otherFrames,           // Frame[]; Don Mueang: gisda_01, gisda_02 marked "soon"
      images: { heatmap: url, green: url | null },
      data: { grid: boolean, greenZones: boolean, parkChecks: boolean },
      abandonedIsExample: true,
      greenSummary: { greenM2, validM2, patches } | null,
    }
    ```

  - The Suan Luang frame:
    - `id: 'theosmain'`
    - `label: 'Theosmain'`
    - `corners` from Task 3 Step 5
    - `source: 'THEOS-2 (GISTDA), backend v3'`
    - `note: 'Position measured from the backend chart (about ±10 m) until the .tif arrives'`
    - `greenSummary` from `summary.json`: `greenM2` 1753864.25, `validM2` 32000000, `patches` 1148
  - The Don Mueang frame is `FRAMES[0]` (gisda_03), with `data.grid` true and `data.greenZones` true.
  - `DEFAULT_DISTRICT_ID = 'suan-luang'` and `getDistrict(id) -> District`. An unknown id gives the default district.
  - `districtDataUrl(districtId, name, baseUrl = API_URL) -> string`, where `name` is one of `'grid' | 'green-zones' | 'abandoned' | 'park-checks'`:
    - mock: the bundled `src/mock/<id>/<name>.json|.geojson` URL; it throws, naming the file, when the file is missing
    - backend: `${baseUrl}/districts/${districtId}/${name}`
  - `fetchDistrictData(district, { baseUrl, signal }) -> Promise<{ green: FC|null, grey: FC, grid: Grid|null, parkChecks: FC|null }>`:
    - `grey` is the abandoned plots, normalized with the existing `'grey'` normalizer, which also keeps `landCover` and `isExample`.
    - A new `'checks'` normalizer keeps `name`, `areaM2`, `sizeClass`, `status` and `greenM2`.
  - `useMapData(district) -> { status, error, green, grey, grid, parkChecks, version, reload }`. When `district.id` changes, it returns `status: 'loading'` with `green`, `grey`, `grid` and `parkChecks` set to `null`, then the new district's data.
  - `zonesUrl`, `gridUrl` and `fetchZones`/`fetchGrid` are removed. Update their tests.

- [ ] **Step 1: Write the failing tests**
  - `districts.test.js`:
    - `getDistrict('nope').id === 'suan-luang'`.
    - Both districts have four corners and a focus feature.
    - Suan Luang has no grid and has a green image.
  - `data.test.js`:
    - `districtDataUrl('suan-luang', 'abandoned', '')` matches `/mock\/suan-luang\/abandoned\.geojson$/`.
    - `districtDataUrl('don-mueang', 'grid', '')` matches `/don-mueang\/grid\.json$/`.
    - The backend form is `http://api/districts/suan-luang/abandoned`.
    - A missing mock throws with `/suan-luang\/grid/`.
    - `fetchDistrictData` for Suan Luang fetches abandoned and park checks only, and returns `green: null, grid: null`.
    - The existing error-message tests (HTTP status, address in the message) are kept.
  - `useMapData.test.js`:
    - Mock `fetchDistrictData`.
    - Loading district A, then rerendering with district B, gives `status: 'loading'` with `grey` `null` before B resolves.
    - The keep-retry test still passes.

- [ ] **Step 2: Run** `npx vitest run src/data src/api src/hooks`. Expected: FAIL.

- [ ] **Step 3: Implement** `districts.js`, the `data.js` changes and the `useMapData(district)` change. Import images with `import heatmapUrl from '../mock/suan-luang/heatmap.png'`.

- [ ] **Step 4: Run the same command.** Expected: PASS.

---

### Task 5: Base maps, frame image layers and district focus on the map

**Files:**
- Modify: `src/config.js` (`BASEMAPS` replaces `BASEMAP`), `src/index.css`
- Create: `src/components/map/FrameImageLayer.jsx`
- Modify: `src/components/map/ClassifiedGridLayer.jsx` (it becomes a wrapper around `FrameImageLayer`), `src/components/map/ZoneMap.jsx`

**Interfaces:**
- Consumes: `District` (Task 4) and `affineFromPoints` (existing, `src/lib/raster.js`).
- Produces:
  - `BASEMAPS = { satellite: { url, attribution, maxNativeZoom: 18, maxZoom: 19 }, street: { …today's OSM } }`.
  - `FrameImageLayer({ corners, source, pane, opacity = 1 })`. `source` is an `HTMLCanvasElement`, or a URL that is loaded into an `Image`. The layer reuses today's mipmap and two-triangle drawing unchanged.
  - `ZoneMap` takes `district` and `options` (Task 7's shape) in place of the module-level Don Mueang constants:
    - focus mask, labels, outline and frame shapes come from `district`
    - basemap from `options.basemap`
    - heat map pane `heat` (zIndex 380), shown when `options.heatmap` is on
    - green image for Suan Luang in pane `grid` (zIndex 390), shown when `options.green` is on
    - grid for Don Mueang only, shown when `options.grid` is on
  - `FIT_OPTIONS` and `maxBounds` follow the district.

- [ ] **Step 1: Refactor `ClassifiedGridLayer` onto `FrameImageLayer`**

  Run `npx vitest run src/lib/raster.test.js`. Expected: PASS (the drawing helpers are unchanged).

- [ ] **Step 2: Make `ZoneMap` district-aware and add the base map switch and image layers**

  The `.basemap` filter in `index.css` only applies to the street tiles (`.basemap-street`). Satellite tiles get `brightness(0.92)`.

- [ ] **Step 3: Check it in the browser**

  Use `preview_start` "greensight-dev". With a temporary `district` prop set to each district:
  - the map fits the focus district
  - the mask is grey outside it
  - the satellite tiles load with the Esri credit
  - the Suan Luang heat map and green image line up with the satellite image (parks and fields visibly match within a few pixels at zoom 16)
  - the Don Mueang grid still lines up with the frame corner at zoom 19

  Expected: no console errors.

- [ ] **Step 4: Run** `npm test`. Expected: PASS.

---

### Task 6: Parks, policy rings, abandoned plots, ★ and the info box on the map

**Files:**
- Create: `src/components/map/ParkLayers.jsx`, `src/components/map/PolicyLayer.jsx`, `src/components/map/RecommendMarkers.jsx`, `src/components/map/PlotInfoBox.jsx`, `src/components/map/PlotInfoBox.test.jsx`
- Modify: `src/components/map/ZoneMap.jsx`, `src/lib/constants.js` (colours)

**Interfaces:**
- Consumes:
  - `DistrictAnalysis` (Task 2)
  - `options` (Task 7): `{ S, M, L, XL, policy, recommend, heatmap, green, abandoned, grid, basemap }`
  - `selected`: `{ kind: 'green'|'grey'|'park', id } | null`
- Produces:
  - **`ParkLayers({ parks, options, selected, onSelect })`**
    - A `CircleMarker` dot for every park. The fill colour is by size class, and the selected dot gets a black ring.
    - `L.circle` reach circles (radius `size.radiusM`) for the classes ticked in `options`: thin solid lines for S/M/L, dashed for XL, and fill opacity of 0.04 or less.
    - Clicking a dot calls `onSelect({ kind: 'park', id })`. Clicks don't bubble to the map.
  - **`PolicyLayer({ focus, parks, visible })`** draws two things:
    - a dashed 400 m ring per park
    - a canvas `L.GridLayer` in pane `policy` (zIndex 385) that shades the focus polygon (rgba 15, 23, 42, 0.28) and then cuts out every 400 m disc

    Per tile:

    ```js
    ctx.fillStyle = SHADE; ctx.beginPath(); /* focus rings projected to tile px */; ctx.fill('evenodd');
    ctx.globalCompositeOperation = 'destination-out';
    for (const park of parksNearTile) { ctx.beginPath(); ctx.arc(px, py, metresToTilePx(400, lat, zoom), 0, 2 * Math.PI); ctx.fill(); }
    ```

  - **Abandoned plots:** they reuse `ZoneShapes` with kind `'grey'` and red styling (fill #dc2626 at 0.5, stroke #991b1b). The selected plot gets a black 3 px outline. The tooltip is "Example plot · {level label}".
  - **`RecommendMarkers({ plots, analysis, visible, onSelect })`:** ★ `divIcon`s at each recommended plot's `point`. Clicking one selects the plot.
  - **`PlotInfoBox({ plot, analysis, onClose })`:** a dark rounded box at the bottom right of the map (Figma style, bold white text) with:
    - `Area : {formatArea}`
    - `Score : {score}`
    - `{level.label}`
    - `Nearest park : {km} km · {name}`
    - a "★ Recommended" line when it is recommended
    - an "Example data" tag when `isExample`
    - a × close button

- [ ] **Step 1: Write the failing `PlotInfoBox.test.jsx`**
  - With `areaM2` 350, score 82, very-good, nearest 1234 m "สวนศรีพัฒน์ภิรมย์", recommended and an example plot, it renders:
    - "Area : 350 m²"
    - "Score : 82"
    - "Very good for planting"
    - "Nearest park : 1.2 km · สวนศรีพัฒน์ภิรมย์"
    - "★ Recommended"
    - "Example data"
  - With no nearest park, it renders "Nearest park : —".
  - The close button calls `onClose`.

- [ ] **Step 2: Run** `npx vitest run src/components/map`. Expected: FAIL. Then implement `PlotInfoBox`. Run again. Expected: PASS.

- [ ] **Step 3: Implement** `ParkLayers`, `PolicyLayer` and `RecommendMarkers`, and wire them into `ZoneMap`. The pane order from bottom to top:

  | Layer | Pane (zIndex) |
  |---|---|
  | tiles | 200 |
  | mask | 350 |
  | heat | 380 |
  | policy | 385 |
  | grid | 390 |
  | overlay | 400 |
  | labels | 450 |
  | markers | 600 |

- [ ] **Step 4: Check it in the browser**

  For Suan Luang:
  - ticking each of S/M/L/XL shows and hides those circles
  - Policy shades the land outside the 400 m rings
  - Recommend shows ★
  - clicking a ★ or a red plot opens the info box with numbers matching the sidebar
  - clicking a park dot selects it

  With everything ticked, the map is still readable on satellite and street. Take a screenshot.

- [ ] **Step 5: Run** `npm test`. Expected: PASS.

---

### Task 7: Map options panel with minimize

**Files:**
- Create: `src/components/map/MapOptions.jsx`, `src/components/map/MapOptions.test.jsx`
- Delete: `src/components/map/LayerControl.jsx`. `MapOptions` replaces it in `ZoneMap`.

**Interfaces:**
- Consumes: `DISTRICTS` (Task 4).
- Produces:
  - `DEFAULT_OPTIONS = { S: true, M: true, L: true, XL: false, policy: false, recommend: true, heatmap: false, green: true, abandoned: true, grid: true, basemap: 'satellite' }`. Export it from `MapOptions.jsx`.
  - `MapOptions({ district, districts, onDistrictChange(id), options, onOptionChange(key, value), collapsed, onCollapsedChange(bool) })`. It renders from top to bottom:
    1. Header "Map options" with a – button (`aria-label="Minimize map options"`)
    2. A `select` labelled "District" with options Suan Luang and Don Mueang
    3. Park circles: "S · 500 m", "M · 1 km", "L · 3 km", "XL · 5 km"
    4. Show: "Policy · 400 m", "Recommend"
    5. Layers: "Heat map", "Green", "Abandoned land", plus "Green/grey grid" only when `district.data.grid`
    6. A "Base map" select with Satellite and Map

    When collapsed, it renders a single button "⚙ Map options · {district.nameEn}" that expands it again.

- [ ] **Step 1: Write the failing `MapOptions.test.jsx`**
  - Changing the select calls `onDistrictChange('don-mueang')`.
  - Unticking "S · 500 m" calls `onOptionChange('S', false)`.
  - "Green/grey grid" is absent for Suan Luang and present for Don Mueang.
  - Clicking "Minimize map options" calls `onCollapsedChange(true)`.
  - **Review Focus 5:** with `collapsed`, only the pill "⚙ Map options · Suan Luang" shows, and clicking it calls `onCollapsedChange(false)`.
  - Choosing Map in "Base map" calls `onOptionChange('basemap', 'street')`.

- [ ] **Step 2: Run** `npx vitest run src/components/map/MapOptions.test.jsx`. Expected: FAIL. Then implement it. Run again. Expected: PASS.

---

### Task 8: Sidebar: rename, minimize, district cards, park panel and plot score

**Files:**
- Modify: `src/components/sidebar/Sidebar.jsx`, `src/components/sidebar/OverviewPanel.jsx`, `src/components/sidebar/GreyZonePanel.jsx`, `src/components/sidebar/Sidebar.test.jsx`
- Create:
  - `src/components/sidebar/ParkPanel.jsx`
  - `src/components/sidebar/cards/DistrictFactsCard.jsx`
  - `src/components/sidebar/cards/ParksBySizeCard.jsx`
  - `src/components/sidebar/cards/PolicyCoverageCard.jsx`
  - `src/components/sidebar/cards/RecommendedCard.jsx`
  - `src/components/sidebar/cards/PlantingScoreCard.jsx`

**Interfaces:**
- Consumes: `District`, `DistrictAnalysis`, `districtFacts`, `Park` and `plantingLevel`.
- Produces: the `Sidebar` props, which add `district`, `analysis`, `parkChecks`, `collapsed` and `onCollapsedChange` to today's props.
  - **Header:** "Green Lantern" with the subtitle "{district.nameEn} green space explorer". A « button (`aria-label="Minimize sidebar"`) collapses it. When collapsed, the sidebar renders only a » button (`aria-label="Open sidebar"`). On phones, the same button folds the stats.
  - **Overview** ("{nameEn} overview"):
    - **Green card:**
      - Don Mueang: today's gauge from the grid.
      - Suan Luang: `greenSummary`, "5% of the image is green" with 1.754 km² of 32.000 km².
    - **Area card**
    - **DistrictFactsCard:** population, green per person, accessible parks per person, "Rank {rank} of 50 for green per person".
    - **ParksBySizeCard:** "S {n} · M {n} · L {n} · XL {n}".
    - **PolicyCoverageCard:** "{pct} of {district} is within 400 m of a park".
    - **RecommendedCard:** "{n} recommended sites", "{v} very good · {g} good".
    - **Frame info:** corners, source and, for Suan Luang, `frame.note`.
  - **ParkPanel** (`selected.kind === 'park'`):
    - name and size class ("S · reaches 500 m")
    - area
    - owner and kind
    - "In lists: accessible parks, 15-minute parks"
    - for Suan Luang, "Green seen by satellite: Yes / No / Outside the image" from `parkChecks`, matched by name
    - "Source: BMA Office of Environment via Rocket Media Lab (CC BY 4.0)"
  - **GreyZonePanel:**
    - Header "Abandoned land" with an "Example" tag when `isExample`.
    - `PlantingScoreCard`: the 0–100 gauge, the level label with a symbol, a "★ Recommended" line or "Inside 400 m of a park", nearest park, and circles covering.
    - The existing fitness/priority card and "Why this site?" factor card only when `fitness != null`.
    - Land cover in Info.

- [ ] **Step 1: Write the failing tests in `Sidebar.test.jsx`**

  Update the helper to pass `district` and `analysis`, built with `analyseDistrict` from small fixtures. Then:
  - The header shows "Green Lantern" and "Don Mueang green space explorer".
  - The Suan Luang overview shows "5%", "1.754 km²", "123,291" and "S 2 · M 0 · L 0 · XL 0" (from the fixture), plus the policy % and the recommended count.
  - The park panel shows "S · reaches 500 m" and "Green seen by satellite: Yes".
  - The plot panel shows "Score", "Very good for planting" and "★ Recommended" for a far fixture plot, and hides "Why this site?" when `fitness` is `null`.
  - Clicking "Minimize sidebar" calls `onCollapsedChange(true)`. When `collapsed`, only "Open sidebar" renders.
  - The existing Don Mueang green/grey assertions are updated, not deleted.

- [ ] **Step 2: Run** `npx vitest run src/components/sidebar`. Expected: FAIL.

- [ ] **Step 3: Implement** the cards and panels. Reuse `Card`, `StatPair`, `InfoList` and `HalfPieGauge`.

- [ ] **Step 4: Run the same command.** Expected: PASS.

---

### Task 9: Wire up the app, legend, rename and docs, then verify everything

**Files:**
- Modify: `src/App.jsx`, `src/components/map/MapLegend.jsx`, `index.html`, `start.bat`, `README.md`, `docs/API.md`, `docs/mock-data/README.md`

**Interfaces:**
- Consumes: everything above.
- Produces: the final app.
  - `App` state:
    - `districtId` (default `DEFAULT_DISTRICT_ID`)
    - `options` (`DEFAULT_OPTIONS`)
    - `selected`
    - `sidebarCollapsed`
    - `optionsCollapsed`: true on screens narrower than 1024 px (`matchMedia`), else false
  - `analysis = useMemo(() => analyseDistrict({ focus, parks: loadParks(parksJson), plots: grey }))`.
  - Changing the district clears `selected`. Turning off a layer clears a selection of that kind, and unticking all circle classes doesn't clear a park selection. Esc clears.
  - The `ZoneMap` container must call `invalidateSize` when the sidebar collapses. The existing ResizeObserver covers it, so verify that.

- [ ] **Step 1: Wire up `App.jsx`, and add legend rows**

  The legend rows are:
  - park dot
  - circles S/M/L (solid) and XL (dashed)
  - 400 m ring
  - "Not within 400 m" shade
  - abandoned land (red)
  - ★ recommended
  - heat map gradient: "Near plants → Far (150 m+)"

- [ ] **Step 2: Rename and document**
  - `index.html`: title and description say Green Lantern.
  - `start.bat`: the title is "Green Lantern (localhost)".
  - `README.md`:
    - Green Lantern
    - the district drop-down, Map options, scoring rule and data sources with credits (BMA/Rocket Media Lab CC BY 4.0, OSM ODbL, Esri imagery, THEOS-2 via backend v3)
    - the new `src/mock/<district>/` layout
    - what is example data
  - `docs/API.md`: replace the three endpoints with `GET {API}/districts/{id}/{grid|green-zones|abandoned|park-checks}`, plus the heat map and green image PNG + corners. State that the frontend computes classes, rings, scores and recommendations.
  - `docs/mock-data/README.md`: the run order for all generator scripts.

- [ ] **Step 3: Run the full verification**
  1. Run `npm test`. Expected: all pass. Report the count.
  2. Run `npm run build`. Expected: success, with `dist/assets/` holding the PNGs and the GeoJSON.
  3. In the browser (`preview_start` "greensight-dev"):
     - at desktop size, the app opens on Suan Luang on satellite
     - switching to Don Mueang works and clears the selection
     - both minimize buttons work
     - with everything ticked, the map is readable
     - no console errors
  4. At phone size (375 × 812), Map options and the legend start folded and the info box is readable.
  5. Build into a subfolder (as in the hosting fix) and serve it, and check the data loads.

  Take screenshots for the user.
