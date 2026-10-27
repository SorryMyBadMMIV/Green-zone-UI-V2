# GreenSight frontend: design spec

- **Date:** 2026-10-05
- **Status:** approved in chat (screen design + technical design)
- **Project:** GreenSight, Optimization of Urban Green Space Development Sites using THEOS-2 (GeoHackathon 2026, GISTDA)
- **Scope of this spec:** the web frontend only. A teammate builds the backend later.

## 1. Goal

A web dashboard where a user explores Bangkok's green space on an interactive map:

- **Green zones**: existing green space (parks, NDVI-classified vegetation).
- **Grey zones**: abandoned / vacant land that could become green, each with a fitness score from the project's Hybrid Genetic Algorithm.

Clicking a zone shows its stats in a left sidebar that is quick to read and understand.

Success criteria:

1. The map zooms (buttons, wheel, pinch) and pans, and every zone can be clicked at every zoom level.
2. Clicking a zone updates 4 sidebar cards (half pie chart, population and area, other chart, info), as in the user's sketch.
3. Every number has a unit, every status has an icon, a word and a color, and the math behind "m² per person" is written out.
4. The backend teammate can replace the mock data by setting one environment variable, following `docs/API.md`.

## 2. Scope

**In scope:** Vite + React app, map with 2 layers, sidebar with 3 states (overview / green zone / grey zone), mock data, data contract doc, README, unit and component tests.

**Out of scope (later / not planned):** backend and real data processing (NDVI, LST, GA), login, search, a ranked-list table, a satellite basemap, Thai UI translation, a light theme, keyboard focus on individual map polygons, data editing and export.

## 3. Screen design

### 3.1 Layout

- **Desktop (≥ 1024px, Tailwind `lg`)**: full-height two-column grid with a **sidebar 400px** on the left and the **map** filling the rest. The sidebar scrolls on its own if it is taller than the screen.
- **Below 1024px**: stacked layout, with the map on top (55vh) and the sidebar below it. The page scrolls.
- **Theme**: dark UI, as in the sketch. The map uses a light basemap.

### 3.2 Map (Leaflet + react-leaflet)

- **Basemap:** standard OpenStreetMap tiles (open data, no API key), muted with a CSS filter (`saturate(0.3)`) so the zone colors stand out. The URL and attribution live in one config constant (`src/config.js`) so they can be swapped. Attribution: "© OpenStreetMap contributors". CARTO Positron was the first choice, but it now requires an API key (found during browser testing).
- **Start view:** Bangkok center (13.7563, 100.5018) at zoom 11. On the **first** successful data load, the map fits to the bounds of all zones with padding. Later reloads do not move the map. Min zoom 10, max zoom 19.
- **Zoom:** a stack of buttons in the top-left corner (zoom in +, zoom out −, and **"Reset view"**), plus the mouse wheel, double-click and pinch. Reset view fits all zones again, or goes back to the start view if no zones are loaded. Leaflet's built-in zoom control is turned off so all 3 buttons share one style.
- **Layers:**
  - Green zones: fill `#22c55e` at 45% opacity (a light wash for large shapes), stroke `#15803d` 1.5px.
  - Grey zones: colored by **priority tier** (ordinal orange ramp, §3.6), fill 70% opacity, darker stroke of the same ramp.
- **Small zones become dots:** at zoom < 15, every zone also gets a clickable **dot** (circle marker, radius 7px, 2px white ring) at its center, because a 1-hectare site is only about 1px wide at city zoom. Green dots are solid `#16a34a`, and grey dots use their tier color. The dots sit in their own map pane above the shapes. From zoom 15 up, the dots are hidden and the polygons alone are clickable.
- **Hover** (polygon or dot): the stroke gets thicker and a tooltip shows the name. Green: "Suan Luang Rama IX". Grey: "Site G-014 · High priority".
- **Click** (polygon or dot): selects the zone. The selected shape gets a dark outline (`#0b0b0b`, 3px) and is brought to the front. The selected dot gets a bigger radius and a dark ring.
- **Clear selection:** click on empty map, the × button in the sidebar panel header, or the Esc key.
- **Layer control** (floating white card, top-right): checkboxes for "Green zones" and "Grey zones", each with a color swatch. Hiding the layer of the selected zone clears the selection.
- **Legend** (floating white card, bottom-left): green zone swatch, plus "Priority to plant" with High (0.75 and up), Medium (0.50 to 0.74) and Low (under 0.50).
- **Loading indicator:** a small "Loading zones…" pill on the map while data loads.

### 3.3 Sidebar header (always visible)

GreenSight leaf logo, the subtitle "Bangkok green space explorer", and a **"Mock data"** badge that shows while `VITE_API_URL` is not set.

### 3.4 Sidebar states

Each state uses the same 4 card slots from the sketch, in the same order.

#### State A: overview (nothing selected)

| Card | Content |
|---|---|
| 1. Half pie chart | "Green space per person in Bangkok": **7.49 m²** against the 9 m² target, status "Below target". Source line: "BMA figure, cited in the project report". |
| 2. Population and area | "Study area": number of green zones and their total area (computed from loaded data), and number of candidate sites with how many are high priority. |
| 3. Other chart | "Candidate sites by priority": one horizontal stacked bar (High / Medium / Low counts, tier colors, 2px gaps), with a legend that shows the counts. |
| 4. Info | How to use ("Click a zone on the map to see its stats", zoom, layers) and a 2-sentence summary of GreenSight with data sources (THEOS-2, Landsat 8/9, OpenStreetMap). |

#### State B: green zone selected

Panel header: "Green zone" pill, name (English) in large text, Thai name and district underneath, and the × button.

| Card | Content |
|---|---|
| 1. Half pie chart | **"Green space per person"**: semicircle gauge. Scale 0 to 18 m² (twice the target), with the **target tick (9 m²) at the top center**, labelled "target 9". The center shows the value (e.g. **38.1**) and "m² per person". The fill and its faint track use the status color. Below it: status icon and word ("Meets target", "Below target", "Far below target"). |
| 2. Population and area | Two stats: "People within {radius} km" and "Green zone area" (m²). Below them, the math is written out: "800,000 m² ÷ 21,000 people = 38.1 m² each". |
| 3. Other chart | **"Cooling effect"**: headline "{Δ}°C cooler than around it". A dumbbell chart on a temperature axis shows a blue dot for inside the park and an orange dot for within {radius} km, joined by a gray line. A legend gives both values. |
| 4. Info | Rows: Zone ID, Type, Vegetation ("NDVI 0.62 · dense vegetation"), Data ("THEOS-2, Landsat 8/9"), Updated (date, when present). |

#### State C: grey zone selected

Panel header: "Grey zone · candidate site" pill, "Site G-014" in large text, district and "empty land" underneath, and the × button.

| Card | Content |
|---|---|
| 1. Half pie chart | **"Fitness score"**: semicircle gauge, scale 0 to 1, with an orange arc (§3.6). The center shows **0.91** and "out of 1.00". Below it: a tier color swatch and "High priority · rank 1 of 8". |
| 2. Population and area | "People within {radius} km" and "Site area" (m²). Below them: "Greening it adds 0.33 m² per nearby person". |
| 3. Other chart | **"Why this site?"**: 3 horizontal bars on a 1 to 5 scale. Each has a plain label with the technical name under it: "Far from parks" / GreenAccessDeficit, "Near busy roads" / AirProximity, "Surface heat" / HeatSeverity. The value appears at the bar tip ("5 / 5"). If `penalty > 0`, a 4th line shows "Hard to develop (Surrounded penalty) −0.05". |
| 4. Info | Rows: Land now ("NDVI 0.08 · little or no vegetation"), Nearest park ("Suan Luang Rama IX · 2.3 km"), Surface temp ("37.4°C"), Data ("THEOS-2, Landsat 8/9, OpenStreetMap"), Updated (when present). |

### 3.5 Readability rules

- One big number per card, and the gauge value is the panel's hero figure (about 44 to 48px, proportional digits). Everything has a unit.
- Plain words come first, with technical names in small muted text under them.
- Status is never shown by color alone. It always has an icon, a word and a color.
- Labels and values use text colors. Data colors appear only on marks (arcs, bars, dots, swatches).
- Bars are at most 8px thick with 4px rounded data-ends. There are no gridlines, and the axis is a single hairline.
- Missing values show "—". A gauge with no value shows an empty track and "No data".

### 3.6 Colors (dark UI tokens, defined once in `src/index.css` with Tailwind `@theme`)

| Role | Value |
|---|---|
| App / sidebar background | `#121212` |
| Card background | `#1c1c1b`, border `rgba(255,255,255,0.08)`, radius 12px |
| Text primary / secondary / muted | `#f5f5f4` / `#c3c2b7` / `#8a8983` |
| Status good / warning / critical | `#0ca30c` / `#fab219` / `#d03b3b` (fixed status palette) |
| Green zone identity | polygon wash `#22c55e`, dots and swatches `#16a34a`, stroke `#15803d`, pill text `#86efac` |
| Priority High / Medium / Low | `#9a3412` / `#ea580c` / `#fb923c`, with strokes `#7c2d12` / `#9a3412` / `#c2410c`. This ordinal one-hue ramp **passed** the dataviz validator (`--ordinal`) on the light map (`#f5f5f3`, light end 2.07:1) and on the dark card (`#1c1c1b`, dark end 2.33:1). The mockup's lighter ramp (`#fdba74` low) failed on the light map at 1.54:1 |
| Fitness gauge arc | one orange `#f97316` for every tier, because on a dark card the darkest tier would look *weaker*. The arc length carries the value, and the tier swatch with its label next to it carries the tier |
| Data mark blue / orange | `#3987e5` / `#d95926` (categorical slots 1 and 2, dark steps) |

Font: system sans (`system-ui, "Segoe UI", sans-serif`). Thai names use the OS Thai font as a fallback.

## 4. Derived metrics (frontend computes these, in `src/lib/metrics.js`)

| Metric | Formula / rule |
|---|---|
| m² per person | `areaM2 / populationNearby`; `null` if either value is missing or the population is ≤ 0 |
| Status (green space per person) | ≥ 9 → `good` "Meets target"; ≥ 3 and < 9 → `warning` "Below target"; < 3 → `critical` "Far below target"; `null` → "No data". The 3 m² cut-off follows the report ("36 districts below 3 m² per person"). |
| Gauge fraction (green) | `clamp(value / 18, 0, 1)` |
| Priority tier | fitness ≥ 0.75 → High; ≥ 0.50 → Medium; < 0.50 → Low |
| Gauge fraction (grey) | `clamp(fitness, 0, 1)` |
| NDVI label | ≥ 0.6 "dense vegetation"; ≥ 0.3 "moderate vegetation"; < 0.3 "little or no vegetation" |
| Cooling | `tempAroundC − tempInsideC`; > 0 → "{Δ}°C cooler than around it"; ≤ 0 → "No cooling measured". Axis domain: `[floor(min) − 2, ceil(max) + 2]` |
| Added per person (grey) | `areaM2 / populationNearby`, 2 decimals |
| Rank text | "rank {rank} of {number of grey zones loaded}" |

Constants (`src/lib/constants.js`): `TARGET_M2_PER_PERSON = 9`, `BANGKOK_M2_PER_PERSON = 7.49`, `GAUGE_MAX_M2 = 18`, `FAR_BELOW_M2 = 3`, `TIER_HIGH = 0.75`, `TIER_MEDIUM = 0.5`, `DOT_ZOOM_THRESHOLD = 15`, `DEFAULT_RADIUS_KM = 1`.

## 5. Architecture

### 5.1 Stack (versions verified on 2026-10-05)

Vite 8, React 19, JavaScript (no TypeScript), Tailwind CSS 4 (`@tailwindcss/vite`), Leaflet 1.9.4, react-leaflet 5, lucide-react icons, Vitest 5 + @testing-library/react + jsdom. There is no chart library: the charts are small SVG components.

### 5.2 Files

```
index.html
vite.config.js                 # react + tailwind plugins, vitest config (jsdom)
.env.example                   # VITE_API_URL=
README.md                      # run, build, test, connect the backend
docs/API.md                    # data contract for the backend teammate
public/mock/green-zones.geojson
public/mock/grey-zones.geojson
src/
  main.jsx
  App.jsx                      # layout + state: selected zone, layer visibility
  index.css                    # @import "tailwindcss"; @theme tokens; Leaflet tweaks
  config.js                    # API base URL, basemap URL + attribution, map defaults
  api/zones.js                 # fetchGreenZones(), fetchGreyZones(), normalization
  hooks/useZones.js            # loads both layers; {green, grey, status, error, reload}
  lib/constants.js
  lib/metrics.js               # pure functions from §4
  lib/format.js                # formatNumber, formatArea, formatTemp, formatKm
  lib/geo.js                   # featureCenter(feature) for dots
  components/map/ZoneMap.jsx   # MapContainer, basemap, layers, dots, hover/click, fit/reset
  components/map/LayerControl.jsx
  components/map/MapLegend.jsx
  components/sidebar/Sidebar.jsx        # header + picks the panel
  components/sidebar/OverviewPanel.jsx
  components/sidebar/GreenZonePanel.jsx
  components/sidebar/GreyZonePanel.jsx
  components/sidebar/PanelHeader.jsx
  components/ui/Card.jsx
  components/ui/StatusBadge.jsx
  components/ui/InfoList.jsx
  components/ui/StatPair.jsx
  components/ui/LoadingCards.jsx
  components/ui/ErrorCard.jsx
  components/charts/HalfPieGauge.jsx
  components/charts/CoolingChart.jsx
  components/charts/FactorBars.jsx
  components/charts/PriorityBar.jsx
tests: next to the code as *.test.js / *.test.jsx
```

### 5.3 Data flow and state

1. `App` calls `useZones()`, which runs `fetchGreenZones()` and `fetchGreyZones()` in parallel and returns `{ green, grey, status: 'loading' | 'ready' | 'error', error, reload }`.
2. `App` holds `selected = { kind: 'green' | 'grey', id } | null` and `layers = { green: true, grey: true }`. Selection is stored **by id**, so it survives a reload of the data.
3. `ZoneMap` receives the feature collections, `layers`, `selected`, and `onSelect` / `onClear`. It draws the layers and reports clicks.
4. `Sidebar` receives the data, `selected`, `status` and `reload`. It looks up the selected feature by id and renders `OverviewPanel`, `GreenZonePanel` or `GreyZonePanel`.
5. If the selected id is no longer present after a reload, the sidebar falls back to the overview.

## 6. Data contract (summary; full version in `docs/API.md`)

**Endpoints** (when `VITE_API_URL` is set):

- `GET {VITE_API_URL}/green-zones` → GeoJSON `FeatureCollection`
- `GET {VITE_API_URL}/grey-zones` → GeoJSON `FeatureCollection`

When `VITE_API_URL` is empty, the app loads `/mock/green-zones.geojson` and `/mock/grey-zones.geojson` instead.

Geometry: `Polygon` or `MultiPolygon`, WGS84 longitude/latitude (EPSG:4326). The backend must allow CORS from the frontend origin (dev: `http://localhost:5173`).

**Green zone `properties`**

| Field | Type | Unit | Required |
|---|---|---|---|
| `id` | string | | yes |
| `name` | string | | yes |
| `nameTh` | string | | no |
| `type` | string (default "Green zone") | | no |
| `district` | string | | yes |
| `areaM2` | number | m² | yes |
| `populationNearby` | number | people | yes |
| `nearbyRadiusKm` | number (default 1) | km | no |
| `ndvi` | number (−1 to 1) | | no |
| `tempInsideC` | number | °C | no |
| `tempAroundC` | number | °C | no |
| `updatedAt` | ISO date string | | no |

**Grey zone `properties`**

| Field | Type | Unit | Required |
|---|---|---|---|
| `id` | string | | yes |
| `district` | string | | yes |
| `areaM2` | number | m² | yes |
| `populationNearby` | number | people | yes |
| `nearbyRadiusKm` | number (default 1) | km | no |
| `fitness` | number (0 to 1) | | yes |
| `rank` | integer ≥ 1 | | yes |
| `scores.greenAccessDeficit` | integer 1 to 5 | | yes |
| `scores.airProximity` | integer 1 to 5 | | yes |
| `scores.heatSeverity` | integer 1 to 5 | | yes |
| `penalty` | number ≥ 0 (default 0) | | no |
| `ndvi` | number | | no |
| `surfaceTempC` | number | °C | no |
| `nearestGreenZone` | `{ id, name, distanceKm }` | km | no |
| `updatedAt` | ISO date string | | no |

**Normalization (`api/zones.js`):**

- A response that is not a `FeatureCollection` with a `features` array throws an error.
- Features without an `id` or a Polygon/MultiPolygon geometry are dropped with `console.warn`.
- Numeric fields that are not finite numbers become `null`.
- Missing optional fields take their defaults.

## 7. Mock data

- **Green zones:** about 10 real Bangkok parks spread across the city (for example Lumphini, Benchakitti, Benchasiri, Chatuchak, Wachirabenchathat, Suan Luang Rama IX, Santiphap, Rommaninat, Thonburirom, Seri Thai). Outlines come from OpenStreetMap (Overpass API, fetched once, simplified). If Overpass is unreachable, the fallback is approximate outlines, marked as approximate in the README. All stats are made up but plausible. The set is chosen so that all 3 statuses appear.
- **Grey zones:** the 8 sites from the report's illustrative priority table (G-014, G-032, G-007, G-021, G-045, G-009, G-038, G-016), with the report's 1 to 5 scores and fitness values and ranks 1 to 8. Locations, areas and the other stats are made up.
- The README states that the data is mock data, and the "Mock data" badge appears in the UI.

## 8. Error handling and edge cases

| Situation | Behavior |
|---|---|
| Loading | Sidebar shows skeleton cards; map shows tiles and a "Loading zones…" pill |
| Fetch fails (network / non-2xx / bad JSON) | Sidebar error card: "Couldn't load zone data. Check that the backend is running, then try again." with a **Retry** button (calls `reload`); map stays usable |
| One layer fails, the other loads | Treated as an error for the whole load (simple, visible); Retry reloads both |
| Missing optional field | Shows "—" (cards still render) |
| `populationNearby` 0 / missing | m² per person = `null`, gauge shows "No data", math line hidden |
| Values out of range (fitness > 1, score > 5) | Clamped for drawing; the real number is still shown |
| Selected zone disappears after reload | Falls back to the overview |

## 9. Testing

- **Unit (Vitest):**
  - `lib/metrics` (status boundaries at exactly 3 and 9, tiers at 0.5 and 0.75, null and zero population, cooling sign, axis domain)
  - `lib/format` (thousands separators, m² and km² formatting, rounding)
  - `api/zones` (mock vs API URL, non-OK response throws, invalid features dropped, numbers normalized), using a mocked `fetch`
- **Contract test:** the mock GeoJSON files in `public/mock/` pass the same required-field checks as the contract in `docs/API.md`.
- **Component (React Testing Library + jsdom):**
  - `Sidebar`: overview when nothing is selected, green panel with the correct "m² each" text, grey panel with "rank 1 of 8"
  - error card with a Retry button that calls `reload`
  - `HalfPieGauge`: clamps the value and shows "No data" for `null`
- **Map:** not unit-tested (Leaflet in jsdom is unreliable). It is verified in the real browser instead: zoom in and out, the dots ↔ shapes switch at zoom 15, hover tooltip, click → sidebar updates, Esc / × / empty-map click clears the selection, layer toggles, Reset view, and a 375px-wide phone layout.
- `npm run build` must succeed with no errors.

## 10. Handoff notes for the backend teammate

- Copy `.env.example` to `.env` and set `VITE_API_URL` (for example `http://localhost:8000/api`).
- Serve the two endpoints in §6, using the mock files as working examples.
- `populationNearby` is the number of people living within `nearbyRadiusKm` of the zone (for example from a WorldPop population grid and a buffer around the zone).
- The frontend computes m² per person, status levels and priority tiers itself, so the backend sends raw values only.
