# Don Mueang Focus Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Focus the GreenSight map on Don Mueang district. The GISTDA frame gisda_03 is split into a 30 × 30 NDVI grid, and the frontend decides each cell's green / grey / water class and works out areas in km². Green and grey zones keep the same stats panels, and everything outside Don Mueang is grey and marked "Update soon".

**Architecture:**
- **Frames:** the frame corner lat/lngs live in `src/data/frames.js`.
- **Map focus:** the district boundaries are static OpenStreetMap data in `src/data/districts.json`.
- **NDVI grid:** the backend (or a mock file) sends only an NDVI array. Pure functions in `src/lib/geo.js` and `src/lib/grid.js` compute the cell corners (bilinear interpolation of the 4 corners), the class of each cell, and the areas (spherical formula, same radius as turf.js).
- **Zones:** they still come from the backend as GeoJSON.

**Tech Stack:** unchanged. Vite 8, React 19 (JavaScript), Tailwind CSS 4, Leaflet 1.9 + react-leaflet 5, Vitest 5 + Testing Library.

**Spec:** `docs/superpowers/specs/2026-10-15-don-mueang-focus-design.md`, which builds on `2026-10-05-greensight-frontend-design.md`.

**Notes for the executor**
- The project root is `C:\Users\poohk\OneDrive\Desktop\UI-Front`. It is not a git repository (the user chose no git), so there are no commit steps.
- Every `<!-- file: path -->` marker sits directly above the **full** contents of that file.
- Removed files: `src/api/zones.js`, `src/api/zones.test.js`, `src/hooks/useZones.js`, `src/hooks/useZones.test.js` (replaced by `api/data.js` and `hooks/useMapData.js`).

---

## File map

| File | Change | Responsibility |
|---|---|---|
| `src/data/frames.js` | new | GISTDA frames: id, place, status (`ready` / `soon`), corners `[lat, lng]` |
| `src/data/districts.json` | new (generated) | Don Mueang (`focus`) + 6 neighbours (`soon`, clipped), label points, `viewBounds` |
| `public/mock/grids/gisda_03.json` | new (generated) | 30 × 30 simulated NDVI |
| `public/mock/green-zones.geojson`, `grey-zones.geojson` | replaced (generated) | Don Mueang zones |
| `src/lib/geo.js` | rewritten | Areas, frame corners → points/rings, frame center, grey mask |
| `src/lib/grid.js` | new | NDVI → class, grid cells, area per class |
| `src/lib/constants.js`, `src/lib/format.js` | updated | NDVI thresholds and map colors; km², percent, lat/lng formatting |
| `src/api/data.js` | new (replaces `zones.js`) | Zones + NDVI grid loading and validation |
| `src/hooks/useMapData.js` | new (replaces `useZones.js`) | Loads zones + focus grid |
| `src/components/charts/HalfPieGauge.jsx` | updated | Optional `trackColor` (two-part whole) |
| `src/components/sidebar/*` | updated | Don Mueang overview, km² in zone panels |
| `src/components/map/*`, `src/index.css`, `src/config.js` | updated | Focus/mask/labels/frames/grid layers, legend, layer switches |
| `src/App.jsx` | updated | Builds cells once, passes them to map and sidebar |
| `docs/API.md`, `README.md` | rewritten | New contract and usage |

---

### Task 1: Frames config and generated data

**Files:**
- Create: `src/data/frames.js`
- Create (outside the project, in a temp folder such as `%TEMP%\greensight-mockgen`): `fetch-district.mjs`, `fetch-frame-osm.mjs`, `make-don-mueang-data.mjs`
- Generated: `src/data/districts.json`, `public/mock/grids/gisda_03.json`, `public/mock/green-zones.geojson`, `public/mock/grey-zones.geojson`

- [ ] **Step 1: Create the frames config**

<!-- file: src/data/frames.js -->
```js
// GISTDA THEOS-2 image frames. Corners are [lat, lng], exactly as GISTDA provided them.
// status 'ready': the backend has an NDVI grid for it. status 'soon': shown as "Update soon".
export const FRAMES = [
  {
    id: 'gisda_03',
    place: 'Don Mueang',
    status: 'ready',
    corners: {
      topLeft: [13.9354055, 100.5798814],
      topRight: [13.9352513, 100.6075171],
      bottomLeft: [13.90838144, 100.57964238],
      bottomRight: [13.90820126, 100.60734273],
    },
  },
  {
    id: 'gisda_01',
    place: 'Pak Kret / Lak Si',
    status: 'soon',
    corners: {
      topLeft: [13.8809918, 100.5216627],
      topRight: [13.88081454, 100.54940705],
      bottomLeft: [13.85388952, 100.52149232],
      bottomRight: [13.85371826, 100.54922489],
    },
  },
  {
    id: 'gisda_02',
    place: 'Chon Buri (Sattahip)',
    status: 'soon',
    corners: {
      topLeft: [12.6983554, 100.8833484],
      topRight: [12.6981904, 100.91086556],
      bottomLeft: [12.6713797, 100.8831603],
      bottomRight: [12.6711633, 100.9106389],
    },
  },
];

/** The frame the app classifies and focuses on (inside Don Mueang). */
export const FOCUS_FRAME = FRAMES[0];
```

- [ ] **Step 2: Set up the throwaway generator folder**

```bash
mkdir -p "$TEMP/greensight-mockgen" && cd "$TEMP/greensight-mockgen" && npm init -y && npm install osmtogeojson@3.0.0-beta.5 @turf/turf@7
```

Save these three files there:

```js
// fetch-district.mjs: download Don Mueang district (OSM relation 1639287) and its neighbouring
// districts from the OpenStreetMap API (v0.6) into district-raw.json.
import fs from 'node:fs';

const DON_MUEANG = 1639287;
const HEADERS = { 'User-Agent': 'GreenSight-hackathon-mockdata/0.1 (one-off script)', Accept: 'application/json' };

async function get(path) {
  const res = await fetch(`https://api.openstreetmap.org/api/0.6/${path}`, { headers: HEADERS, signal: AbortSignal.timeout(60000) });
  if (!res.ok) throw new Error(`${path}: HTTP ${res.status}`);
  return res.json();
}

const elements = new Map();
const add = (json) => json.elements.forEach((el) => elements.set(`${el.type}/${el.id}`, el));

const dm = await get(`relation/${DON_MUEANG}/full.json`);
add(dm);
const dmRel = dm.elements.find((el) => el.type === 'relation' && el.id === DON_MUEANG);
console.log('Don Mueang:', dmRel.tags.name, dmRel.tags['name:en'], 'admin_level', dmRel.tags.admin_level);

// Neighbours = other district-level boundaries that share a boundary way with Don Mueang.
const neighbours = new Map();
for (const member of dmRel.members.filter((m) => m.type === 'way')) {
  const rels = await get(`way/${member.ref}/relations.json`);
  for (const rel of rels.elements) {
    const t = rel.tags ?? {};
    if (rel.id !== DON_MUEANG && t.boundary === 'administrative' && t.admin_level === dmRel.tags.admin_level) {
      neighbours.set(rel.id, `${t.name} / ${t['name:en'] ?? ''}`);
    }
  }
}
console.log('Neighbours:', [...neighbours].map(([id, n]) => `${id} ${n}`).join(' | '));

for (const id of neighbours.keys()) add(await get(`relation/${id}/full.json`));
fs.writeFileSync('district-raw.json', JSON.stringify({ version: '0.6', elements: [...elements.values()] }));
console.log(`saved ${elements.size} elements; neighbour ids: ${[...neighbours.keys()].join(',')}`);
```

```js
// fetch-frame-osm.mjs: download all OpenStreetMap data inside the gisda_03 frame (plus a 1 km margin,
// for "people nearby" / nearest-park context) from the OSM API (v0.6) into frame-raw.json.
// The API caps one /map call at 50,000 nodes, so the box is fetched as a 3×3 grid of tiles.
import fs from 'node:fs';

const BOX = { west: 100.5700, south: 13.8990, east: 100.6170, north: 13.9450 };
const N = 3;
const HEADERS = { 'User-Agent': 'GreenSight-hackathon-mockdata/0.1 (one-off script)', Accept: 'application/json' };

const elements = new Map();
for (let i = 0; i < N; i++) {
  for (let j = 0; j < N; j++) {
    const w = BOX.west + ((BOX.east - BOX.west) * i) / N;
    const e = BOX.west + ((BOX.east - BOX.west) * (i + 1)) / N;
    const s = BOX.south + ((BOX.north - BOX.south) * j) / N;
    const n = BOX.south + ((BOX.north - BOX.south) * (j + 1)) / N;
    const bbox = [w, s, e, n].map((v) => v.toFixed(5)).join(',');
    const res = await fetch(`https://api.openstreetmap.org/api/0.6/map.json?bbox=${bbox}`, {
      headers: HEADERS,
      signal: AbortSignal.timeout(120000),
    });
    if (!res.ok) throw new Error(`tile ${i},${j} (${bbox}): HTTP ${res.status} ${await res.text()}`);
    const json = await res.json();
    for (const el of json.elements) elements.set(`${el.type}/${el.id}`, el);
    console.log(`tile ${i},${j}: ${json.elements.length} elements (total unique ${elements.size})`);
  }
}
fs.writeFileSync('frame-raw.json', JSON.stringify({ version: '0.6', elements: [...elements.values()] }));
console.log('saved frame-raw.json');
```

```js
// make-don-mueang-data.mjs: build the Don Mueang mock data for the GreenSight frontend.
// Usage: node make-don-mueang-data.mjs <project-root>
// Needs district-raw.json (fetch-district.mjs) and frame-raw.json (fetch-frame-osm.mjs).
// Writes:
//   src/data/districts.json             Don Mueang + neighbouring districts (real OSM boundaries)
//   public/mock/grids/gisda_03.json     30×30 NDVI values of the gisda_03 frame (simulated)
//   public/mock/green-zones.geojson     connected green cells (≥ 2 cells)
//   public/mock/grey-zones.geojson      connected open-land grey cells (≥ 2 cells) = candidate sites
import fs from 'node:fs';
import path from 'node:path';
import osmtogeojson from 'osmtogeojson';
import * as turf from '@turf/turf';

const root = process.argv[2];
if (!root) throw new Error('Usage: node make-don-mueang-data.mjs <project-root>');

const UPDATED = '2026-10-15';
const NOTE =
  'Mock data for the GreenSight frontend. Boundaries and land cover © OpenStreetMap contributors (ODbL). ' +
  'NDVI, temperature, population and fitness are simulated from OpenStreetMap land cover, not measured from THEOS-2.';

// gisda_03 corners from GISTDA, as [lat, lng] (same values as src/data/frames.js)
const FRAME = { tl: [13.9354055, 100.5798814], tr: [13.9352513, 100.6075171], dl: [13.90838144, 100.57964238], dr: [13.90820126, 100.60734273] };
const N = 30; // cells per side (≈100 m)
const MARGIN = 10; // extra context cells around the frame (≈1 km) for "people nearby" and temperature
const GREEN_NDVI = 0.3; // same threshold as the frontend (src/lib/constants.js)
const MIN_ZONE_CELLS = 2;

// ---------------------------------------------------------------------------------------------
// Helpers
const lerp = (a, b, t) => a + (b - a) * t;
const round = (n, d) => Math.round(n * 10 ** d) / 10 ** d;
const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));
const mean = (list) => list.reduce((a, b) => a + b, 0) / list.length;
const M_PER_DEG_LAT = 110600;

function mulberry32(seed) {
  return () => {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(20261015);
const jitter = () => rand() * 2 - 1;

/** Bilinear position inside the frame: u 0→1 left→right, v 0→1 top→bottom. Returns [lng, lat]. */
function at(u, v) {
  const top = [lerp(FRAME.tl[1], FRAME.tr[1], u), lerp(FRAME.tl[0], FRAME.tr[0], u)];
  const bottom = [lerp(FRAME.dl[1], FRAME.dr[1], u), lerp(FRAME.dl[0], FRAME.dr[0], u)];
  return [lerp(top[0], bottom[0], v), lerp(top[1], bottom[1], v)];
}
const kx = 111320 * Math.cos((FRAME.tl[0] * Math.PI) / 180);
const toXY = ([lng, lat]) => [(lng - FRAME.tl[1]) * kx, (lat - FRAME.tl[0]) * M_PER_DEG_LAT];
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const round6 = (c) => (typeof c[0] === 'number' ? [round(c[0], 6), round(c[1], 6)] : c.map(round6));

/** Grid indices (row, col) of a point, treating the frame as an (almost) parallelogram. */
const [ex, ey] = [toXY(at(1, 0)), toXY(at(0, 1))];
function cellOf(lngLat) {
  const [px, py] = toXY(lngLat);
  const det = ex[0] * ey[1] - ex[1] * ey[0];
  const u = (px * ey[1] - py * ey[0]) / det;
  const v = (ex[0] * py - ex[1] * px) / det;
  return [Math.floor(v * N), Math.floor(u * N)];
}

// ---------------------------------------------------------------------------------------------
// Districts
const districtFc = osmtogeojson(JSON.parse(fs.readFileSync('district-raw.json', 'utf8')));
const districtFeatures = districtFc.features.filter(
  (f) => f.properties.boundary === 'administrative' && f.properties.admin_level === '6' && /Polygon/.test(f.geometry.type),
);
const donMueangRaw = districtFeatures.find((f) => f.id === 'relation/1639287');
const [dw, ds, de, dn] = turf.bbox(donMueangRaw);
const PAD = 0.03; // ≈3 km around the district
const viewBounds = [round(dw - PAD, 4), round(ds - PAD, 4), round(de + PAD, 4), round(dn + PAD, 4)];

const slug = (s) => s.toLowerCase().replace(/ district$/, '').replace(/[^a-z]+/g, '-').replace(/^-|-$/g, '');
function labelPoint(feature) {
  const c = turf.centerOfMass(feature);
  return turf.booleanPointInPolygon(c, feature) ? c : turf.pointOnFeature(feature);
}
const districtsOut = districtFeatures.map((f) => {
  const focus = f.id === donMueangRaw.id;
  // The focus district keeps its full OSM outline (exact area); neighbours are clipped and simplified.
  const simple = focus ? f : turf.simplify(turf.bboxClip(f, viewBounds), { tolerance: 0.0001, highQuality: true });
  return {
    type: 'Feature',
    properties: {
      id: slug(f.properties['name:en']),
      role: focus ? 'focus' : 'soon',
      nameEn: f.properties['name:en'].replace(/ District$/, ''),
      nameTh: f.properties.name.replace(/^(เขต|อำเภอ)/, ''),
      label: round6(labelPoint(simple).geometry.coordinates),
    },
    geometry: { type: simple.geometry.type, coordinates: round6(simple.geometry.coordinates) },
  };
});

// ---------------------------------------------------------------------------------------------
// Land cover from OpenStreetMap
const osm = osmtogeojson(JSON.parse(fs.readFileSync('frame-raw.json', 'utf8')));

function coverOf(p) {
  if (p.natural === 'water' || p.water || ['reservoir', 'basin'].includes(p.landuse) || p.waterway === 'riverbank') return ['water', 'water'];
  if (['apron', 'runway', 'taxiway', 'terminal', 'hangar'].includes(p.aeroway) || p.amenity === 'parking' || p.landuse === 'railway' || p.highway) return ['paved', 'paved'];
  if (p.leisure === 'golf_course') return ['vegetation', 'golf'];
  if (['park', 'garden', 'dog_park'].includes(p.leisure)) return ['vegetation', 'park'];
  if (p.natural === 'wetland') return ['vegetation', 'wetland'];
  if (['wood', 'scrub'].includes(p.natural) || ['forest', 'orchard', 'plant_nursery'].includes(p.landuse) || p.landcover === 'trees') return ['vegetation', 'trees'];
  if (['grass', 'meadow', 'village_green', 'recreation_ground', 'cemetery'].includes(p.landuse) || ['grassland', 'heath'].includes(p.natural) || p.landcover === 'grass' || p.leisure === 'pitch') return ['vegetation', 'grass'];
  if (p.aeroway === 'aerodrome') return ['airfield', 'airfield'];
  if (p.landuse === 'military') return ['military', 'military'];
  if (['construction', 'brownfield', 'greenfield'].includes(p.landuse)) return ['vacant', 'vacant'];
  if (p.landuse === 'residential') return ['residential', 'residential'];
  if (['commercial', 'retail', 'industrial'].includes(p.landuse) || ['school', 'college', 'university', 'hospital', 'place_of_worship', 'marketplace'].includes(p.amenity)) return ['institutional', 'institutional'];
  return null;
}
const PRIORITY = ['water', 'paved', 'vegetation', 'airfield', 'military', 'vacant', 'institutional', 'residential'];

const coverPolys = [];
const buildings = [];
const runways = [];
const majorRoads = [];
for (const f of osm.features) {
  const p = f.properties;
  if (/LineString/.test(f.geometry.type)) {
    if (p.aeroway === 'runway' || p.aeroway === 'taxiway') runways.push({ line: f, halfWidthM: p.aeroway === 'runway' ? 30 : 12 });
    if (/^(motorway|trunk|primary|secondary)(_link)?$/.test(p.highway)) majorRoads.push(f);
    continue;
  }
  if (!/Polygon/.test(f.geometry.type)) continue;
  if (p.building) {
    buildings.push(f);
    continue;
  }
  const cover = coverOf(p);
  if (cover) coverPolys.push({ f, cover: cover[0], detail: cover[1], name: p.name, nameEn: p['name:en'], bbox: turf.bbox(f) });
}

// ---------------------------------------------------------------------------------------------
// Grid (frame + margin) with simulated NDVI, surface temperature and population
const LATTICE = 4;
const latticeSize = Math.ceil((N + 2 * MARGIN) / LATTICE) + 2;
const lattice = Array.from({ length: latticeSize }, () => Array.from({ length: latticeSize }, jitter));
function smoothNoise(r, c) {
  const x = (c + MARGIN) / LATTICE;
  const y = (r + MARGIN) / LATTICE;
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const ease = (t) => t * t * (3 - 2 * t);
  const fx = ease(x - x0);
  const fy = ease(y - y0);
  return lerp(lerp(lattice[y0][x0], lattice[y0][x0 + 1], fx), lerp(lattice[y0 + 1][x0], lattice[y0 + 1][x0 + 1], fx), fy);
}

const BASE_NDVI = { vegetation: 0.62, airfield: 0.5, military: 0.42, open: 0.31, vacant: 0.22, institutional: 0.2, residential: 0.19, paved: 0.08 };
const PEOPLE = { residential: 120, institutional: 20, open: 30, vacant: 5, military: 8 };

const cells = new Map();
const key = (r, c) => `${r},${c}`;
for (let r = -MARGIN; r < N + MARGIN; r++) {
  for (let c = -MARGIN; c < N + MARGIN; c++) {
    const center = at((c + 0.5) / N, (r + 0.5) / N);
    const ring = [at(c / N, r / N), at(c / N, (r + 1) / N), at((c + 1) / N, (r + 1) / N), at((c + 1) / N, r / N), at(c / N, r / N)];
    let best = null;
    for (const poly of coverPolys) {
      const [w, s, e, n] = poly.bbox;
      if (center[0] < w || center[0] > e || center[1] < s || center[1] > n) continue;
      if (!turf.booleanPointInPolygon(center, poly.f)) continue;
      if (!best || PRIORITY.indexOf(poly.cover) < PRIORITY.indexOf(best.cover)) best = poly;
    }
    let cover = best?.cover ?? 'open';
    let detail = best?.detail ?? 'open';
    if (cover !== 'water' && cover !== 'paved') {
      for (const { line, halfWidthM } of runways) {
        if (turf.pointToLineDistance(center, line, { units: 'meters' }) <= halfWidthM) {
          cover = 'paved';
          detail = 'paved';
          break;
        }
      }
    }
    cells.set(key(r, c), {
      r, c, center, ring, cover, detail,
      name: best?.name, nameEn: best?.nameEn,
      inFrame: r >= 0 && r < N && c >= 0 && c < N,
      areaM2: turf.area(turf.polygon([ring])),
      builtM2: 0,
    });
  }
}
for (const b of buildings) {
  const [r, c] = cellOf(turf.centroid(b).geometry.coordinates);
  const cell = cells.get(key(r, c));
  if (cell) cell.builtM2 += turf.area(b);
}
for (const cell of cells.values()) {
  cell.coverage = clamp(cell.builtM2 / cell.areaM2, 0, 1);
  if (cell.cover === 'water') {
    cell.ndvi = round(clamp(-0.08 + 0.05 * jitter(), -0.15, -0.03), 2);
    cell.lst = round(30.8 + 0.4 * jitter(), 1);
    cell.people = 0;
  } else {
    const ndvi = BASE_NDVI[cell.cover] + 0.14 * smoothNoise(cell.r, cell.c) + 0.05 * jitter() - 0.45 * cell.coverage;
    cell.ndvi = round(clamp(ndvi, 0.02, 0.88), 2);
    cell.lst = round(39.2 - 8.5 * cell.ndvi + 0.5 * jitter(), 1);
    cell.people = Math.round((PEOPLE[cell.cover] ?? 0) * (0.8 + 0.4 * rand()));
  }
  cell.cls = cell.ndvi < 0 ? 'water' : cell.ndvi >= GREEN_NDVI ? 'green' : 'grey';
}
const frameCells = [...cells.values()].filter((cell) => cell.inFrame);
const contextCells = [...cells.values()];

// ---------------------------------------------------------------------------------------------
// Connected components (4-neighbours) inside the frame
function components(test) {
  const seen = new Set();
  const out = [];
  for (const start of frameCells) {
    if (seen.has(key(start.r, start.c)) || !test(start)) continue;
    const comp = [];
    const queue = [start];
    seen.add(key(start.r, start.c));
    while (queue.length) {
      const cell = queue.pop();
      comp.push(cell);
      for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const next = cells.get(key(cell.r + dr, cell.c + dc));
        if (next && next.inFrame && !seen.has(key(next.r, next.c)) && test(next)) {
          seen.add(key(next.r, next.c));
          queue.push(next);
        }
      }
    }
    out.push(comp);
  }
  return out;
}

const xy = (cell) => (cell.xy ??= toXY(cell.center));
const minDist = (cell, group) => Math.min(...group.map((g) => dist(xy(cell), xy(g))));

function surroundings(comp) {
  const inside = new Set(comp.map((cell) => key(cell.r, cell.c)));
  const near = contextCells.filter((cell) => !inside.has(key(cell.r, cell.c)) && minDist(cell, comp) <= 1000);
  return {
    people: [...near, ...comp].reduce((sum, cell) => sum + cell.people, 0),
    lstAround: round(mean(near.filter((cell) => cell.cls !== 'water').map((cell) => cell.lst)), 1),
  };
}

function shapeOf(comp) {
  const polys = comp.map((cell) => turf.polygon([cell.ring]));
  const merged = polys.length === 1 ? polys[0] : turf.union(turf.featureCollection(polys));
  const clean = turf.cleanCoords(merged);
  return { type: clean.geometry.type, coordinates: round6(clean.geometry.coordinates) };
}

// Green zones
const GREEN_TYPES = {
  golf: ['Golf course', 'สนามกอล์ฟ'],
  park: ['Park', 'สวนสาธารณะ'],
  wetland: ['Wetland', 'พื้นที่ชุ่มน้ำ'],
  trees: ['Trees', 'พื้นที่ต้นไม้'],
  grass: ['Grass field', 'สนามหญ้า'],
  airfield: ['Airfield grass', 'สนามหญ้าในสนามบิน'],
  military: ['Air Force green land', 'พื้นที่สีเขียวกองทัพอากาศ'],
  residential: ['Trees in the neighbourhood', 'ต้นไม้ในชุมชน'],
  institutional: ['Trees in the neighbourhood', 'ต้นไม้ในชุมชน'],
  open: ['Open green land', 'ที่โล่งสีเขียว'],
  vacant: ['Open green land', 'ที่โล่งสีเขียว'],
};
const USE_OSM_NAME = new Set(['golf', 'park', 'wetland', 'trees', 'grass']);
const dominant = (comp) => {
  const counts = new Map();
  for (const cell of comp) counts.set(cell.detail, (counts.get(cell.detail) ?? 0) + 1);
  return [...counts].sort((a, b) => b[1] - a[1])[0][0];
};

const greenComps = components((cell) => cell.cls === 'green')
  .filter((comp) => comp.length >= MIN_ZONE_CELLS)
  .sort((a, b) => b.length - a.length);
const typeCounter = new Map();
const greenZones = greenComps.map((comp, i) => {
  const detail = dominant(comp);
  const [typeEn, typeTh] = GREEN_TYPES[detail] ?? GREEN_TYPES.open;
  const n = (typeCounter.get(typeEn) ?? 0) + 1;
  typeCounter.set(typeEn, n);
  const named = USE_OSM_NAME.has(detail) ? comp.find((cell) => cell.detail === detail && cell.name) : null;
  const around = surroundings(comp);
  return {
    comp,
    feature: {
      type: 'Feature',
      properties: {
        id: `GZ-${String(i + 1).padStart(3, '0')}`,
        frameId: 'gisda_03',
        name: named?.nameEn ?? `${typeEn} ${n}`,
        nameTh: named?.name ?? `${typeTh} ${n}`,
        type: typeEn,
        district: 'Don Mueang',
        areaM2: Math.round(comp.reduce((sum, cell) => sum + cell.areaM2, 0)),
        cells: comp.length,
        populationNearby: Math.round(around.people / 100) * 100,
        nearbyRadiusKm: 1,
        ndvi: round(mean(comp.map((cell) => cell.ndvi)), 2),
        tempInsideC: round(mean(comp.map((cell) => cell.lst)), 1),
        tempAroundC: around.lstAround,
        updatedAt: UPDATED,
      },
      geometry: shapeOf(comp),
    },
  };
});

// Grey zones: connected open-land grey cells (not homes, roads, airport, water) = candidate sites.
// Each factor is measured per site, min-max normalised to 0–1 across the sites (report §3.4), then weighted.
const isCandidate = (cell) => cell.cls === 'grey' && ['open', 'vacant'].includes(cell.cover) && cell.coverage < 0.1;
const greyComps = components(isCandidate).filter((comp) => comp.length >= MIN_ZONE_CELLS);
const greenCells = contextCells.filter((cell) => cell.cls === 'green');
const roadDistance = (cell) =>
  majorRoads.length ? Math.min(...majorRoads.map((road) => turf.pointToLineDistance(cell.center, road, { units: 'meters' }))) : 5000;
const siteFactors = greyComps.map((comp) => ({
  toGreen: mean(comp.map((cell) => minDist(cell, greenCells))),
  toRoad: mean(comp.map(roadDistance)),
  lst: mean(comp.map((cell) => cell.lst)),
}));
const normaliser = (get) => {
  const values = siteFactors.map(get);
  const [lo, hi] = [Math.min(...values), Math.max(...values)];
  return (v) => (hi === lo ? 0.5 : (v - lo) / (hi - lo));
};
const normGreen = normaliser((s) => s.toGreen); // far from green = high
const normRoad = normaliser((s) => s.toRoad); // near a road = high (inverted below)
const normHeat = normaliser((s) => s.lst); // hot = high
const WEIGHTS = { gad: 0.4, air: 0.3, heat: 0.3 };

const greyZones = greyComps
  .map((comp, i) => {
    const gad = normGreen(siteFactors[i].toGreen);
    const air = 1 - normRoad(siteFactors[i].toRoad);
    const heat = normHeat(siteFactors[i].lst);
    const penalty = comp.length <= 3 ? 0.05 : 0;
    const fitness = round(clamp(WEIGHTS.gad * gad + WEIGHTS.air * air + WEIGHTS.heat * heat - penalty, 0, 1), 2);
    const score = (v) => 1 + Math.round(4 * v);
    const nearest = greenZones
      .map((z) => ({ z, d: Math.min(...comp.map((cell) => minDist(cell, z.comp))) }))
      .sort((a, b) => a.d - b.d)[0];
    const around = surroundings(comp);
    return {
      comp,
      fitness,
      properties: {
        frameId: 'gisda_03',
        district: 'Don Mueang',
        areaM2: Math.round(comp.reduce((sum, cell) => sum + cell.areaM2, 0)),
        cells: comp.length,
        populationNearby: Math.round(around.people / 100) * 100,
        nearbyRadiusKm: 1,
        fitness,
        scores: { greenAccessDeficit: score(gad), airProximity: score(air), heatSeverity: score(heat) },
        penalty,
        ndvi: round(mean(comp.map((cell) => cell.ndvi)), 2),
        surfaceTempC: round(mean(comp.map((cell) => cell.lst)), 1),
        nearestGreenZone: nearest
          ? { id: nearest.z.feature.properties.id, name: nearest.z.feature.properties.name, distanceKm: round(Math.max(nearest.d - 100, 0) / 1000, 1) }
          : null,
        updatedAt: UPDATED,
      },
    };
  })
  .sort((a, b) => b.fitness - a.fitness || b.comp.length - a.comp.length)
  .map((z, i) => ({
    type: 'Feature',
    properties: { id: `G-${String(i + 1).padStart(3, '0')}`, rank: i + 1, ...z.properties },
    geometry: shapeOf(z.comp),
  }));

// ---------------------------------------------------------------------------------------------
// Write files
function writeCollection(file, features) {
  const body = features
    .map((f) => {
      const props = JSON.stringify(f.properties, null, 2).replace(/\n/g, '\n      ');
      return `    {\n      "type": "Feature",\n      "properties": ${props},\n      "geometry": ${JSON.stringify(f.geometry)}\n    }`;
    })
    .join(',\n');
  const text = `{\n  "type": "FeatureCollection",\n  "metadata": ${JSON.stringify({ note: NOTE })},\n  "features": [\n${body}\n  ]\n}\n`;
  JSON.parse(text);
  writeText(file, text, `${features.length} features`);
}
function writeText(file, text, what) {
  const out = path.join(root, file);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, text);
  console.log(`wrote ${file} (${what}, ${(text.length / 1024).toFixed(1)} KB)`);
}

const districtsDoc = {
  type: 'FeatureCollection',
  metadata: { note: 'District boundaries © OpenStreetMap contributors (ODbL). Neighbours are clipped to viewBounds [west, south, east, north].', viewBounds },
  features: districtsOut,
};
writeText('src/data/districts.json', JSON.stringify(districtsDoc) + '\n', `${districtsOut.length} districts`);

const rows = [];
for (let r = 0; r < N; r++) rows.push(`    [${Array.from({ length: N }, (_, c) => cells.get(key(r, c)).ndvi).join(', ')}]`);
const gridText = `{\n  "frameId": "gisda_03",\n  "rows": ${N},\n  "cols": ${N},\n  "cellSizeM": 100,\n  "metadata": ${JSON.stringify({ note: NOTE, order: 'ndvi[row][col], row 0 = top (north) edge, col 0 = left (west) edge' })},\n  "ndvi": [\n${rows.join(',\n')}\n  ]\n}\n`;
JSON.parse(gridText);
writeText('public/mock/grids/gisda_03.json', gridText, `${N}×${N} cells`);
writeCollection('public/mock/green-zones.geojson', greenZones.map((z) => z.feature));
writeCollection('public/mock/grey-zones.geojson', greyZones);

// ---------------------------------------------------------------------------------------------
// Summary
const byClass = (cls) => frameCells.filter((cell) => cell.cls === cls).reduce((sum, cell) => sum + cell.areaM2, 0) / 1e6;
console.log(`frame: green ${byClass('green').toFixed(3)} km², grey ${byClass('grey').toFixed(3)} km², water ${byClass('water').toFixed(3)} km²`);
console.log(`green zones: ${greenZones.length} (cells: ${greenComps.map((c) => c.length).join(' ')})`);
for (const z of greenZones) {
  const p = z.feature.properties;
  console.log(`  ${p.id} ${p.name.padEnd(28)} ${String(p.cells).padStart(3)} cells ${(p.areaM2 / p.populationNearby).toFixed(1).padStart(6)} m²/person  ${p.tempInsideC}/${p.tempAroundC}°C`);
}
console.log(`grey zones: ${greyZones.length}`);
for (const z of greyZones) {
  const p = z.properties;
  console.log(`  ${p.id} fitness ${p.fitness} scores ${Object.values(p.scores).join('/')} cells ${p.cells} people ${p.populationNearby} nearest ${p.nearestGreenZone?.id} ${p.nearestGreenZone?.distanceKm} km`);
}
```

- [ ] **Step 3: Generate the data into the project**

```bash
node fetch-district.mjs && node fetch-frame-osm.mjs && node make-don-mueang-data.mjs "C:/Users/poohk/OneDrive/Desktop/UI-Front"
```

Expected output (the numbers come from the seeded generator and the OSM data downloaded on 2026-10-15):
- `wrote src/data/districts.json (7 districts, …)`
- `wrote public/mock/grids/gisda_03.json (30×30 cells, …)`
- 16 green zones and 11 grey zones
- `frame: green 2.963 km², grey 5.906 km², water 0.110 km²`
- Grey fitness from 0.78 down to 0.09

---

### Task 2: Geometry (areas, frame corners, mask)

**Files:**
- Modify (rewrite): `src/lib/geo.js`
- Test (rewrite): `src/lib/geo.test.js`

- [ ] **Step 1: Write the failing test**

<!-- file: src/lib/geo.test.js -->
```js
import { describe, it, expect } from 'vitest';
import { FRAMES } from '../data/frames.js';
import { frameCenter, frameRing, maskPolygon, pointInFrame, polygonAreaM2, ringAreaM2 } from './geo.js';

const frame = (id) => FRAMES.find((f) => f.id === id);
const square = (lng, lat, size) => [[lng, lat], [lng + size, lat], [lng + size, lat + size], [lng, lat + size], [lng, lat]];

describe('frame geometry', () => {
  const { corners } = frame('gisda_03');

  it('maps (u, v) = (0, 0) to the top-left corner and (1, 1) to the bottom-right, as [lng, lat]', () => {
    expect(pointInFrame(corners, 0, 0)).toEqual([100.5798814, 13.9354055]);
    expect(pointInFrame(corners, 1, 1)).toEqual([100.60734273, 13.90820126]);
  });

  it('builds a closed ring: top-left, bottom-left, bottom-right, top-right', () => {
    const ring = frameRing(corners);
    expect(ring).toHaveLength(5);
    expect(ring[4]).toEqual(ring[0]);
    expect(ring[1]).toEqual([100.57964238, 13.90838144]);
    expect(ring[3]).toEqual([100.6075171, 13.9352513]);
  });

  it('finds the center as [lat, lng]', () => {
    const [lat, lng] = frameCenter(corners);
    expect(lat).toBeCloseTo(13.92181, 5);
    expect(lng).toBeCloseTo(100.5936, 4);
  });
});

describe('areas', () => {
  it('matches the reference areas of the three GISTDA frames (km²)', () => {
    const km2 = (id) => ringAreaM2(frameRing(frame(id).corners)) / 1e6;
    expect(km2('gisda_01')).toBeCloseTo(9.024, 3);
    expect(km2('gisda_02')).toBeCloseTo(8.957, 3);
    expect(km2('gisda_03')).toBeCloseTo(8.978, 3);
  });

  it('subtracts holes, adds MultiPolygon parts and ignores other geometry', () => {
    const outer = square(100, 13, 0.02);
    const hole = square(100.005, 13.005, 0.01);
    expect(polygonAreaM2({ type: 'Polygon', coordinates: [outer, hole] })).toBeCloseTo(ringAreaM2(outer) - ringAreaM2(hole), 3);
    expect(polygonAreaM2({ type: 'MultiPolygon', coordinates: [[outer], [hole]] })).toBeCloseTo(ringAreaM2(outer) + ringAreaM2(hole), 3);
    expect(polygonAreaM2({ type: 'Point', coordinates: [100, 13] })).toBe(0);
    expect(polygonAreaM2(null)).toBe(0);
  });
});

describe('maskPolygon', () => {
  it('cuts the focus area out of a big box', () => {
    const focus = { type: 'Polygon', coordinates: [square(100.5, 13.8, 0.1)] };
    const mask = maskPolygon(focus, [99, 12, 102, 15]);
    expect(mask.type).toBe('Polygon');
    expect(mask.coordinates[0]).toEqual([[99, 12], [102, 12], [102, 15], [99, 15], [99, 12]]);
    expect(mask.coordinates[1]).toEqual(focus.coordinates[0]);
  });
});
```

- [ ] **Step 2: Run the test to see it fail**

Run: `npx vitest run src/lib/geo.test.js`
Expected: FAIL, because `pointInFrame` (and the other new functions) are not exported by `./geo.js`.

- [ ] **Step 3: Implement**

<!-- file: src/lib/geo.js -->
```js
// Geometry on [lng, lat] coordinates (GeoJSON order).
// Areas use the same spherical formula and mean Earth radius as turf.js, so they match its numbers.
const EARTH_RADIUS_M = 6371008.8;
const toRad = (deg) => (deg * Math.PI) / 180;

/** Area in m² enclosed by a closed ring of [lng, lat] points. */
export function ringAreaM2(ring) {
  let total = 0;
  for (let i = 0; i < ring.length - 1; i++) {
    const [lng1, lat1] = ring[i];
    const [lng2, lat2] = ring[i + 1];
    total += toRad(lng2 - lng1) * (2 + Math.sin(toRad(lat1)) + Math.sin(toRad(lat2)));
  }
  return Math.abs((total * EARTH_RADIUS_M * EARTH_RADIUS_M) / 2);
}

/** Area in m² of a GeoJSON Polygon or MultiPolygon, holes subtracted. 0 for anything else. */
export function polygonAreaM2(geometry) {
  let polygons = [];
  if (geometry?.type === 'Polygon') polygons = [geometry.coordinates];
  if (geometry?.type === 'MultiPolygon') polygons = geometry.coordinates;
  return polygons.reduce(
    (sum, [outer, ...holes]) => sum + ringAreaM2(outer) - holes.reduce((holeSum, hole) => holeSum + ringAreaM2(hole), 0),
    0,
  );
}

/**
 * A point inside a four-corner frame, as [lng, lat]. u runs 0 → 1 from the left (west) edge to the
 * right (east) edge, v runs 0 → 1 from the top (north) edge to the bottom (south) edge.
 * corners = { topLeft, topRight, bottomLeft, bottomRight }, each [lat, lng].
 */
export function pointInFrame(corners, u, v) {
  const { topLeft: tl, topRight: tr, bottomLeft: bl, bottomRight: br } = corners;
  const lat = (1 - v) * ((1 - u) * tl[0] + u * tr[0]) + v * ((1 - u) * bl[0] + u * br[0]);
  const lng = (1 - v) * ((1 - u) * tl[1] + u * tr[1]) + v * ((1 - u) * bl[1] + u * br[1]);
  return [lng, lat];
}

/**
 * Closed GeoJSON ring (top-left → bottom-left → bottom-right → top-right) for the part of a frame
 * between (u0, v0) and (u1, v1). Without a range it is the whole frame.
 */
export function frameRing(corners, [u0, v0, u1, v1] = [0, 0, 1, 1]) {
  const ring = [
    pointInFrame(corners, u0, v0),
    pointInFrame(corners, u0, v1),
    pointInFrame(corners, u1, v1),
    pointInFrame(corners, u1, v0),
  ];
  return [...ring, ring[0]];
}

/** Center of a frame as [lat, lng]. */
export function frameCenter(corners) {
  const [lng, lat] = pointInFrame(corners, 0.5, 0.5);
  return [lat, lng];
}

/** A box [west, south, east, north] with the focus area cut out of it, for the grey "update soon" cover. */
export function maskPolygon(focusGeometry, [west, south, east, north]) {
  const box = [[west, south], [east, south], [east, north], [west, north], [west, south]];
  const polygons = focusGeometry.type === 'Polygon' ? [focusGeometry.coordinates] : focusGeometry.coordinates;
  return { type: 'Polygon', coordinates: [box, ...polygons.map((polygon) => polygon[0])] };
}
```

- [ ] **Step 4: Run the test to see it pass**

Run: `npx vitest run src/lib/geo.test.js`
Expected: PASS (6 tests).

---

### Task 3: Constants and formatting

**Files:**
- Modify (rewrite): `src/lib/constants.js`, `src/lib/format.js`
- Test (rewrite): `src/lib/format.test.js`

- [ ] **Step 1: Update the constants**

<!-- file: src/lib/constants.js -->
```js
// Bangkok's own planning target for public green space (project report, chapter 1).
export const TARGET_M2_PER_PERSON = 9;
// The green-space gauge runs from 0 to twice the target, so the target sits at the top.
export const GAUGE_MAX_M2 = 2 * TARGET_M2_PER_PERSON;
// Under this a zone is "far below target" (the report: 36 districts have less than 3 m²).
export const FAR_BELOW_M2 = 3;
// Fitness cut-offs for the priority tiers.
export const TIER_HIGH = 0.75;
export const TIER_MEDIUM = 0.5;
// NDVI rule for the grid (report §2.2): vegetation is 0.3 and up, water is below 0.
export const GREEN_NDVI = 0.3;
export const WATER_NDVI = 0;
export const DEFAULT_RADIUS_KM = 1;

// Data colors. UI chrome colors live in src/index.css.
// The tier ramp passed the dataviz ordinal check on the light map and on the dark cards.
export const COLORS = {
  good: '#0ca30c',
  warning: '#fab219',
  critical: '#d03b3b',
  noData: '#8a8983',
  greenZoneFill: '#22c55e',
  greenZoneMark: '#16a34a',
  greenZoneStroke: '#15803d',
  greenZoneText: '#86efac',
  greyZoneText: '#fdba74',
  tierHigh: '#9a3412',
  tierHighStroke: '#7c2d12',
  tierMedium: '#ea580c',
  tierMediumStroke: '#9a3412',
  tierLow: '#fb923c',
  tierLowStroke: '#c2410c',
  fitnessArc: '#f97316',
  dataBlue: '#3987e5',
  dataOrange: '#d95926',
  selected: '#0b0b0b',
  gridGreen: '#22c55e',
  gridGrey: '#9ca3af',
  mask: '#334155',
  focusOutline: '#14532d',
  frameOutline: '#111827',
};
```

- [ ] **Step 2: Write the failing format test**

<!-- file: src/lib/format.test.js -->
```js
import { describe, it, expect } from 'vitest';
import {
  DASH,
  formatArea,
  formatDecimal,
  formatKm,
  formatKm2,
  formatLatLng,
  formatNumber,
  formatPercent,
  formatTemp,
} from './format.js';

describe('format', () => {
  it('adds thousands separators to whole numbers', () => {
    expect(formatNumber(21000)).toBe('21,000');
    expect(formatNumber(1234567.6)).toBe('1,234,568');
  });

  it('shows a dash for missing or non-finite values', () => {
    for (const value of [null, undefined, NaN, Infinity, '12']) {
      expect(formatNumber(value)).toBe(DASH);
      expect(formatDecimal(value, 1)).toBe(DASH);
      expect(formatArea(value)).toBe(DASH);
      expect(formatKm2(value)).toBe(DASH);
      expect(formatPercent(value)).toBe(DASH);
      expect(formatTemp(value)).toBe(DASH);
      expect(formatKm(value)).toBe(DASH);
    }
    expect(formatLatLng(null)).toBe(DASH);
    expect(formatLatLng([13.9, null])).toBe(DASH);
  });

  it('formats decimals, areas, temperatures and distances with units', () => {
    expect(formatDecimal(38.0952, 1)).toBe('38.1');
    expect(formatDecimal(0.3264, 2)).toBe('0.33');
    expect(formatArea(800000)).toBe('800,000 m²');
    expect(formatTemp(31.24)).toBe('31.2°C');
    expect(formatKm(2.3)).toBe('2.3 km');
  });

  it('shows km² with 3 decimals under 10 km² and 2 decimals above', () => {
    expect(formatKm2(8978000)).toBe('8.978 km²');
    expect(formatKm2(800000)).toBe('0.800 km²');
    expect(formatKm2(37142000)).toBe('37.14 km²');
  });

  it('formats percentages and lat/lng pairs', () => {
    expect(formatPercent(0.3334)).toBe('33%');
    expect(formatPercent(1)).toBe('100%');
    expect(formatLatLng([13.9218098, 100.5935959])).toBe('13.92181, 100.59360');
  });
});
```

- [ ] **Step 3: Run the test to see it fail**

Run: `npx vitest run src/lib/format.test.js`
Expected: FAIL, because `formatPercent` and `formatLatLng` are not exported and `formatKm2` still uses 1 decimal.

- [ ] **Step 4: Implement**

<!-- file: src/lib/format.js -->
```js
const wholeNumber = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });

const isNum = (value) => typeof value === 'number' && Number.isFinite(value);

/** Shown wherever a value is missing. */
export const DASH = '—';

/** 21000 → "21,000" */
export function formatNumber(value) {
  return isNum(value) ? wholeNumber.format(value) : DASH;
}

/** formatDecimal(38.0952, 1) → "38.1" */
export function formatDecimal(value, digits = 1) {
  return isNum(value) ? value.toFixed(digits) : DASH;
}

/** 800000 → "800,000 m²" */
export function formatArea(valueM2) {
  return isNum(valueM2) ? `${wholeNumber.format(valueM2)} m²` : DASH;
}

/** An area in m² shown as km²: 3 decimals under 10 km² (8978000 → "8.978 km²"), else 2 ("37.14 km²"). */
export function formatKm2(valueM2) {
  if (!isNum(valueM2)) return DASH;
  const km2 = valueM2 / 1e6;
  return `${km2.toFixed(km2 < 10 ? 3 : 2)} km²`;
}

/** 0.3334 → "33%" */
export function formatPercent(fraction) {
  return isNum(fraction) ? `${Math.round(fraction * 100)}%` : DASH;
}

/** [13.9218098, 100.5935959] → "13.92181, 100.59360" */
export function formatLatLng(latLng) {
  return Array.isArray(latLng) && latLng.length === 2 && latLng.every(isNum)
    ? `${latLng[0].toFixed(5)}, ${latLng[1].toFixed(5)}`
    : DASH;
}

/** 31.24 → "31.2°C" */
export function formatTemp(valueC) {
  return isNum(valueC) ? `${valueC.toFixed(1)}°C` : DASH;
}

/** 2.3 → "2.3 km" */
export function formatKm(valueKm) {
  return isNum(valueKm) ? `${valueKm.toFixed(1)} km` : DASH;
}
```

- [ ] **Step 5: Run the test to see it pass**

Run: `npx vitest run src/lib/format.test.js src/lib/metrics.test.js`
Expected: PASS (format 5 tests, metrics 15 tests).

---

### Task 4: The classified grid

**Files:**
- Create: `src/lib/grid.js`
- Test: `src/lib/grid.test.js`

- [ ] **Step 1: Write the failing test**

<!-- file: src/lib/grid.test.js -->
```js
import { describe, it, expect } from 'vitest';
import { FOCUS_FRAME } from '../data/frames.js';
import { frameRing, ringAreaM2 } from './geo.js';
import { buildCells, classAreas, classifyNdvi } from './grid.js';

describe('classifyNdvi', () => {
  it('decides water, grey or green from NDVI', () => {
    expect(classifyNdvi(-0.01)).toBe('water');
    expect(classifyNdvi(0)).toBe('grey');
    expect(classifyNdvi(0.29)).toBe('grey');
    expect(classifyNdvi(0.3)).toBe('green');
    expect(classifyNdvi(0.85)).toBe('green');
  });

  it('returns null when NDVI is missing', () => {
    expect(classifyNdvi(null)).toBeNull();
    expect(classifyNdvi(Number.NaN)).toBeNull();
  });
});

describe('buildCells', () => {
  const grid = { rows: 2, cols: 3, ndvi: [[0.5, 0.1, -0.2], [0.31, null, 0.29]] };
  const cells = buildCells(FOCUS_FRAME, grid);

  it('makes one cell per NDVI value, row by row', () => {
    expect(cells.features).toHaveLength(6);
    expect(cells.features.map((f) => f.properties.class)).toEqual(['green', 'grey', 'water', 'green', null, 'grey']);
    expect(cells.features[4].properties).toMatchObject({ id: 'gisda_03-r1c1', row: 1, col: 1, ndvi: null });
  });

  it('computes the cell corners from the frame corners', () => {
    const first = cells.features[0].geometry.coordinates[0];
    const last = cells.features[5].geometry.coordinates[0];
    expect(first[0]).toEqual([100.5798814, 13.9354055]); // frame top-left
    expect(last[2]).toEqual([100.60734273, 13.90820126]); // frame bottom-right
  });

  it('splits the frame area exactly between the cells', () => {
    const total = Object.values(classAreas(cells)).reduce((a, b) => a + b, 0);
    expect(total).toBeCloseTo(ringAreaM2(frameRing(FOCUS_FRAME.corners)), 0);
  });
});

describe('classAreas', () => {
  it('adds up the cell areas per class', () => {
    const cells = {
      features: [
        { properties: { class: 'green', areaM2: 10 } },
        { properties: { class: 'green', areaM2: 5 } },
        { properties: { class: 'grey', areaM2: 7 } },
        { properties: { class: null, areaM2: 2 } },
      ],
    };
    expect(classAreas(cells)).toEqual({ green: 15, grey: 7, water: 0, unknown: 2 });
  });
});
```

- [ ] **Step 2: Run the test to see it fail**

Run: `npx vitest run src/lib/grid.test.js`
Expected: FAIL, because `./grid.js` cannot be resolved.

- [ ] **Step 3: Implement**

<!-- file: src/lib/grid.js -->
```js
import { GREEN_NDVI, WATER_NDVI } from './constants.js';
import { frameRing, ringAreaM2 } from './geo.js';

/** Decides a cell from its NDVI: 'water' (< 0), 'grey' (< 0.3) or 'green'. null when NDVI is missing. */
export function classifyNdvi(ndvi) {
  if (typeof ndvi !== 'number' || !Number.isFinite(ndvi)) return null;
  if (ndvi < WATER_NDVI) return 'water';
  return ndvi >= GREEN_NDVI ? 'green' : 'grey';
}

/**
 * The classified grid of a frame as GeoJSON: one cell per NDVI value. Each cell's corners are
 * computed from the frame's four corner coordinates. grid = { rows, cols, ndvi: number[row][col] }.
 */
export function buildCells(frame, grid) {
  const features = [];
  for (let row = 0; row < grid.rows; row++) {
    for (let col = 0; col < grid.cols; col++) {
      const ndvi = grid.ndvi[row]?.[col] ?? null;
      const ring = frameRing(frame.corners, [col / grid.cols, row / grid.rows, (col + 1) / grid.cols, (row + 1) / grid.rows]);
      features.push({
        type: 'Feature',
        geometry: { type: 'Polygon', coordinates: [ring] },
        properties: { id: `${frame.id}-r${row}c${col}`, row, col, ndvi, class: classifyNdvi(ndvi), areaM2: ringAreaM2(ring) },
      });
    }
  }
  return { type: 'FeatureCollection', features };
}

/** Total area in m² of the cells in each class. */
export function classAreas(cells) {
  const areas = { green: 0, grey: 0, water: 0, unknown: 0 };
  for (const { properties } of cells.features) areas[properties.class ?? 'unknown'] += properties.areaM2;
  return areas;
}
```

- [ ] **Step 4: Run the test to see it pass**

Run: `npx vitest run src/lib/grid.test.js`
Expected: PASS (6 tests).

---

### Task 5: Data client (zones + NDVI grid)

**Files:**
- Create: `src/api/data.js` (replaces `src/api/zones.js`)
- Test: `src/api/data.test.js` (replaces `src/api/zones.test.js`), `src/api/mockData.test.js` (rewrite)
- Delete: `src/api/zones.js`, `src/api/zones.test.js`

- [ ] **Step 1: Write the failing tests**

<!-- file: src/api/data.test.js -->
```js
import { describe, it, expect, vi, afterEach } from 'vitest';
import { fetchGrid, fetchZones, gridUrl, normalizeCollection, normalizeGrid, zonesUrl } from './data.js';

const square = [[[100.5, 13.7], [100.51, 13.7], [100.51, 13.71], [100.5, 13.71], [100.5, 13.7]]];
const feature = (properties) => ({ type: 'Feature', geometry: { type: 'Polygon', coordinates: square }, properties });
const collection = (...features) => ({ type: 'FeatureCollection', features });
const respondWith = (json, status = 200) =>
  vi.fn().mockResolvedValue({ ok: status >= 200 && status < 300, status, json: async () => json });

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('urls', () => {
  it('use the mock files when no backend URL is set', () => {
    expect(zonesUrl('green', '')).toBe('/mock/green-zones.geojson');
    expect(zonesUrl('grey', '')).toBe('/mock/grey-zones.geojson');
    expect(gridUrl('gisda_03', '')).toBe('/mock/grids/gisda_03.json');
  });

  it('use the backend endpoints when a base URL is set', () => {
    expect(zonesUrl('green', 'http://localhost:8000/api')).toBe('http://localhost:8000/api/green-zones');
    expect(zonesUrl('grey', 'http://localhost:8000/api')).toBe('http://localhost:8000/api/grey-zones');
    expect(gridUrl('gisda_03', 'http://localhost:8000/api')).toBe('http://localhost:8000/api/frames/gisda_03/grid');
  });
});

describe('normalizeCollection', () => {
  it('rejects data that is not a FeatureCollection', () => {
    expect(() => normalizeCollection({ type: 'Feature' }, 'green')).toThrow(/FeatureCollection/);
    expect(() => normalizeCollection(null, 'grey')).toThrow(/FeatureCollection/);
  });

  it('drops features without an id or polygon geometry', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const point = { type: 'Feature', geometry: { type: 'Point', coordinates: [100, 13] }, properties: { id: 'P' } };
    const result = normalizeCollection(collection(feature({ id: 'GZ-1', name: 'A' }), feature({ name: 'no id' }), point), 'green');
    expect(result.features.map((f) => f.properties.id)).toEqual(['GZ-1']);
    expect(console.warn).toHaveBeenCalledTimes(2);
  });

  it('turns bad numbers into null and fills in defaults', () => {
    const result = normalizeCollection(collection(feature({ id: 7, name: 'B', areaM2: 'big', populationNearby: Infinity })), 'green');
    const p = result.features[0].properties;
    expect(p.id).toBe('7');
    expect(p.areaM2).toBeNull();
    expect(p.populationNearby).toBeNull();
    expect(p.nearbyRadiusKm).toBe(1);
    expect(p.type).toBe('Green zone');
  });

  it('normalizes grey zone scores, penalty and nearest green zone', () => {
    const result = normalizeCollection(
      collection(
        feature({
          id: 'G-001',
          fitness: 0.78,
          rank: 1,
          scores: { greenAccessDeficit: 4, airProximity: 4, heatSeverity: 5 },
          nearestGreenZone: { id: 'GZ-004', name: 'Airfield grass 1', distanceKm: 0.2 },
        }),
      ),
      'grey',
    );
    const p = result.features[0].properties;
    expect(p.scores).toEqual({ greenAccessDeficit: 4, airProximity: 4, heatSeverity: 5 });
    expect(p.penalty).toBe(0);
    expect(p.nearestGreenZone).toEqual({ id: 'GZ-004', name: 'Airfield grass 1', distanceKm: 0.2 });
  });
});

describe('normalizeGrid', () => {
  it('accepts rows × cols NDVI values and turns bad values into null', () => {
    const grid = normalizeGrid({ rows: 2, cols: 2, cellSizeM: 100, ndvi: [[0.5, 'x'], [0.1]] }, 'gisda_03');
    expect(grid).toEqual({ frameId: 'gisda_03', rows: 2, cols: 2, cellSizeM: 100, ndvi: [[0.5, null], [0.1, null]] });
  });

  it('rejects a grid without rows and cols, or with the wrong number of rows', () => {
    expect(() => normalizeGrid({ rows: 3, cols: 2, ndvi: [[0.5, 0.1]] }, 'gisda_03')).toThrow(/rows/);
    expect(() => normalizeGrid(null, 'gisda_03')).toThrow(/rows/);
  });
});

describe('fetching', () => {
  it('fetches and normalizes a zone layer', async () => {
    const fetchMock = respondWith(collection(feature({ id: 'GZ-1', name: 'A' })));
    vi.stubGlobal('fetch', fetchMock);
    const result = await fetchZones('green', { baseUrl: '' });
    expect(fetchMock).toHaveBeenCalledWith('/mock/green-zones.geojson', expect.any(Object));
    expect(result.features).toHaveLength(1);
  });

  it('fetches and normalizes an NDVI grid', async () => {
    const fetchMock = respondWith({ rows: 1, cols: 2, ndvi: [[0.2, 0.6]] });
    vi.stubGlobal('fetch', fetchMock);
    const grid = await fetchGrid('gisda_03', { baseUrl: 'http://api' });
    expect(fetchMock).toHaveBeenCalledWith('http://api/frames/gisda_03/grid', expect.any(Object));
    expect(grid.ndvi).toEqual([[0.2, 0.6]]);
  });

  it('throws on a non-2xx response', async () => {
    vi.stubGlobal('fetch', respondWith({}, 503));
    await expect(fetchZones('grey', { baseUrl: 'http://api' })).rejects.toThrow(/HTTP 503/);
    await expect(fetchGrid('gisda_03', { baseUrl: 'http://api' })).rejects.toThrow(/HTTP 503/);
  });
});
```

<!-- file: src/api/mockData.test.js -->
```js
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { normalizeCollection, normalizeGrid } from './data.js';

// Plain path maths on purpose: Vite rewrites `new URL(`…${x}`, import.meta.url)` into an asset lookup.
const MOCK_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../public/mock');
const load = (file) => JSON.parse(readFileSync(path.join(MOCK_DIR, file), 'utf8'));

const REQUIRED = {
  green: ['id', 'name', 'district', 'areaM2', 'populationNearby'],
  grey: ['id', 'district', 'areaM2', 'populationNearby', 'fitness', 'rank'],
};

describe.each([
  ['green', 'green-zones.geojson'],
  ['grey', 'grey-zones.geojson'],
])('mock %s zones follow docs/API.md', (layer, file) => {
  const raw = load(file);
  const { features } = normalizeCollection(raw, layer);

  it('keeps every feature (all have an id and polygon geometry)', () => {
    expect(features.length).toBeGreaterThan(0);
    expect(features.length).toBe(raw.features.length);
  });

  it('has every required field', () => {
    for (const { properties } of features) {
      for (const key of REQUIRED[layer]) {
        expect(properties[key], `${properties.id}.${key}`).not.toBeNull();
      }
    }
  });

  it('has unique ids', () => {
    const ids = features.map((f) => f.properties.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('mock grey zones', () => {
  const { features } = normalizeCollection(load('grey-zones.geojson'), 'grey');

  it('has ranks 1..N, fitness 0–1 and integer scores 1–5', () => {
    const ranks = features.map((f) => f.properties.rank).sort((a, b) => a - b);
    expect(ranks).toEqual(features.map((_, i) => i + 1));
    for (const { properties: p } of features) {
      expect(p.fitness).toBeGreaterThanOrEqual(0);
      expect(p.fitness).toBeLessThanOrEqual(1);
      for (const score of Object.values(p.scores)) {
        expect(Number.isInteger(score) && score >= 1 && score <= 5).toBe(true);
      }
    }
  });
});

describe('mock NDVI grid of gisda_03', () => {
  const grid = normalizeGrid(load('grids/gisda_03.json'), 'gisda_03');

  it('is 30 × 30 with every NDVI value between -1 and 1', () => {
    expect([grid.rows, grid.cols]).toEqual([30, 30]);
    const values = grid.ndvi.flat();
    expect(values).toHaveLength(900);
    expect(values.every((v) => v !== null && v >= -1 && v <= 1)).toBe(true);
  });
});
```

- [ ] **Step 2: Remove the old client and run the tests to see them fail**

```bash
rm src/api/zones.js src/api/zones.test.js
npx vitest run src/api
```

Expected: FAIL, because `./data.js` cannot be resolved.

- [ ] **Step 3: Implement**

<!-- file: src/api/data.js -->
```js
import { API_URL } from '../config.js';
import { DEFAULT_RADIUS_KM } from '../lib/constants.js';

/** Where a zone layer lives: the backend when VITE_API_URL is set, otherwise the mock file. */
export function zonesUrl(layer, baseUrl = API_URL) {
  return baseUrl ? `${baseUrl}/${layer}-zones` : `/mock/${layer}-zones.geojson`;
}

/** Where a frame's NDVI grid lives. */
export function gridUrl(frameId, baseUrl = API_URL) {
  return baseUrl ? `${baseUrl}/frames/${frameId}/grid` : `/mock/grids/${frameId}.json`;
}

const num = (value) => (typeof value === 'number' && Number.isFinite(value) ? value : null);
const str = (value) => (typeof value === 'string' && value.trim() !== '' ? value : null);
const isPolygonal = (geometry) =>
  (geometry?.type === 'Polygon' || geometry?.type === 'MultiPolygon') && Array.isArray(geometry.coordinates);

function normalizeGreen(p) {
  return {
    id: String(p.id),
    name: str(p.name) ?? String(p.id),
    nameTh: str(p.nameTh),
    type: str(p.type) ?? 'Green zone',
    district: str(p.district),
    areaM2: num(p.areaM2),
    populationNearby: num(p.populationNearby),
    nearbyRadiusKm: num(p.nearbyRadiusKm) ?? DEFAULT_RADIUS_KM,
    ndvi: num(p.ndvi),
    tempInsideC: num(p.tempInsideC),
    tempAroundC: num(p.tempAroundC),
    updatedAt: str(p.updatedAt),
  };
}

function normalizeGrey(p) {
  const scores = p.scores ?? {};
  const nearest = p.nearestGreenZone;
  return {
    id: String(p.id),
    district: str(p.district),
    areaM2: num(p.areaM2),
    populationNearby: num(p.populationNearby),
    nearbyRadiusKm: num(p.nearbyRadiusKm) ?? DEFAULT_RADIUS_KM,
    fitness: num(p.fitness),
    rank: num(p.rank),
    scores: {
      greenAccessDeficit: num(scores.greenAccessDeficit),
      airProximity: num(scores.airProximity),
      heatSeverity: num(scores.heatSeverity),
    },
    penalty: num(p.penalty) ?? 0,
    ndvi: num(p.ndvi),
    surfaceTempC: num(p.surfaceTempC),
    nearestGreenZone:
      nearest && typeof nearest === 'object'
        ? { id: str(nearest.id), name: str(nearest.name), distanceKm: num(nearest.distanceKm) }
        : null,
    updatedAt: str(p.updatedAt),
  };
}

const NORMALIZERS = { green: normalizeGreen, grey: normalizeGrey };

/** Checks a FeatureCollection and normalizes every feature's properties (see docs/API.md). */
export function normalizeCollection(json, layer) {
  if (json?.type !== 'FeatureCollection' || !Array.isArray(json.features)) {
    throw new Error(`The ${layer} zone data is not a GeoJSON FeatureCollection.`);
  }
  const normalize = NORMALIZERS[layer];
  const features = [];
  for (const feature of json.features) {
    const id = feature?.properties?.id;
    if (id === undefined || id === null || id === '' || !isPolygonal(feature.geometry)) {
      console.warn(`Skipping a ${layer} zone without an id or polygon geometry`, feature);
      continue;
    }
    features.push({ type: 'Feature', geometry: feature.geometry, properties: normalize(feature.properties) });
  }
  return { type: 'FeatureCollection', features };
}

/** Checks an NDVI grid ({ rows, cols, ndvi[row][col] }, see docs/API.md); bad values become null. */
export function normalizeGrid(json, frameId) {
  const { rows, cols, ndvi } = json ?? {};
  if (!Number.isInteger(rows) || !Number.isInteger(cols) || rows < 1 || cols < 1 || !Array.isArray(ndvi) || ndvi.length !== rows) {
    throw new Error(`The NDVI grid of ${frameId} needs "rows", "cols" and one "ndvi" list per row.`);
  }
  return {
    frameId,
    rows,
    cols,
    cellSizeM: num(json.cellSizeM),
    ndvi: ndvi.map((row) => Array.from({ length: cols }, (_, col) => num(Array.isArray(row) ? row[col] : undefined))),
  };
}

async function getJson(url, signal) {
  const response = await fetch(url, { signal, headers: { Accept: 'application/geo+json, application/json' } });
  if (!response.ok) throw new Error(`Loading ${url} failed with HTTP ${response.status}.`);
  return response.json();
}

/** Loads one zone layer ('green' or 'grey'). Throws on network errors, non-2xx responses and bad data. */
export async function fetchZones(layer, { baseUrl = API_URL, signal } = {}) {
  return normalizeCollection(await getJson(zonesUrl(layer, baseUrl), signal), layer);
}

/** Loads the NDVI grid of a frame. Throws on network errors, non-2xx responses and bad data. */
export async function fetchGrid(frameId, { baseUrl = API_URL, signal } = {}) {
  return normalizeGrid(await getJson(gridUrl(frameId, baseUrl), signal), frameId);
}
```

- [ ] **Step 4: Run the tests to see them pass**

Run: `npx vitest run src/api`
Expected: PASS (data 11 tests, mockData 8 tests).

---

### Task 6: Loading hook

**Files:**
- Create: `src/hooks/useMapData.js` (replaces `useZones.js`)
- Test: `src/hooks/useMapData.test.js` (replaces `useZones.test.js`)
- Delete: `src/hooks/useZones.js`, `src/hooks/useZones.test.js`

- [ ] **Step 1: Write the failing test**

<!-- file: src/hooks/useMapData.test.js -->
```js
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import useMapData from './useMapData.js';
import { fetchGrid, fetchZones } from '../api/data.js';

vi.mock('../api/data.js', () => ({ fetchZones: vi.fn(), fetchGrid: vi.fn() }));

const collection = (id) => ({ type: 'FeatureCollection', features: [{ type: 'Feature', geometry: null, properties: { id } }] });
const grid = { frameId: 'gisda_03', rows: 1, cols: 1, cellSizeM: 100, ndvi: [[0.4]] };

beforeEach(() => {
  vi.mocked(fetchZones).mockReset();
  vi.mocked(fetchGrid).mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('useMapData', () => {
  it('loads both zone layers and the focus frame grid, then becomes ready', async () => {
    vi.mocked(fetchZones).mockImplementation(async (layer) => collection(layer));
    vi.mocked(fetchGrid).mockResolvedValue(grid);
    const { result } = renderHook(() => useMapData());
    expect(result.current.status).toBe('loading');
    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(result.current.green.features[0].properties.id).toBe('green');
    expect(result.current.grey.features[0].properties.id).toBe('grey');
    expect(result.current.grid).toEqual(grid);
    expect(fetchGrid).toHaveBeenCalledWith('gisda_03', expect.any(Object));
    expect(result.current.version).toBe(1);
  });

  it('reports an error, then loads again on reload', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(fetchZones).mockImplementation(async (layer) => collection(layer));
    vi.mocked(fetchGrid).mockRejectedValue(new Error('offline'));
    const { result } = renderHook(() => useMapData());
    await waitFor(() => expect(result.current.status).toBe('error'));

    vi.mocked(fetchGrid).mockResolvedValue(grid);
    act(() => result.current.reload());
    expect(result.current.status).toBe('loading');
    await waitFor(() => expect(result.current.status).toBe('ready'));
  });
});
```

- [ ] **Step 2: Remove the old hook and run the test to see it fail**

```bash
rm src/hooks/useZones.js src/hooks/useZones.test.js
npx vitest run src/hooks
```

Expected: FAIL, because `./useMapData.js` cannot be resolved.

- [ ] **Step 3: Implement**

<!-- file: src/hooks/useMapData.js -->
```js
import { useCallback, useEffect, useState } from 'react';
import { fetchGrid, fetchZones } from '../api/data.js';
import { FOCUS_FRAME } from '../data/frames.js';

/**
 * Loads what the map needs: the green and grey zones and the NDVI grid of the focus frame.
 * Returns { status: 'loading' | 'ready' | 'error', green, grey, grid, error, version, reload }.
 * `version` goes up by one after every successful load (the map uses it to redraw).
 */
export default function useMapData() {
  const [state, setState] = useState({ status: 'loading', green: null, grey: null, grid: null, error: null, version: 0 });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;
    Promise.all([fetchZones('green', { signal }), fetchZones('grey', { signal }), fetchGrid(FOCUS_FRAME.id, { signal })])
      .then(([green, grey, grid]) => {
        setState((prev) => ({ status: 'ready', green, grey, grid, error: null, version: prev.version + 1 }));
      })
      .catch((error) => {
        if (signal.aborted) return;
        console.error(error);
        setState((prev) => ({ ...prev, status: 'error', error }));
      });
    return () => controller.abort();
  }, [attempt]);

  const reload = useCallback(() => {
    setState((prev) => ({ ...prev, status: 'loading', error: null }));
    setAttempt((n) => n + 1);
  }, []);

  return { ...state, reload };
}
```

- [ ] **Step 4: Run the test to see it pass**

Run: `npx vitest run src/hooks`
Expected: PASS (2 tests).

---

### Task 7: Two-color half pie chart

**Files:**
- Modify (rewrite): `src/components/charts/HalfPieGauge.jsx`
- Test (rewrite): `src/components/charts/HalfPieGauge.test.jsx`

- [ ] **Step 1: Write the failing test**

<!-- file: src/components/charts/HalfPieGauge.test.jsx -->
```jsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import HalfPieGauge from './HalfPieGauge.jsx';

describe('HalfPieGauge', () => {
  it('fills the arc in proportion to the value and shows the number', () => {
    render(<HalfPieGauge fraction={0.25} color="#fab219" value="4.5" unit="m² per person" label="Gauge" />);
    expect(screen.getByText('4.5')).toBeTruthy();
    expect(screen.getByText('m² per person')).toBeTruthy();
    expect(screen.getByTestId('gauge-fill').getAttribute('stroke-dasharray')).toBe('25 100');
  });

  it('clamps values beyond the end of the scale', () => {
    render(<HalfPieGauge fraction={3} color="#0ca30c" value="54.0" unit="m² per person" label="Gauge" />);
    expect(screen.getByTestId('gauge-fill').getAttribute('stroke-dasharray')).toBe('100 100');
  });

  it('shows "No data" and an empty track when there is no value', () => {
    render(<HalfPieGauge fraction={null} color="#8a8983" value="—" unit="m² per person" label="Gauge" />);
    expect(screen.getByText('No data')).toBeTruthy();
    expect(screen.queryByTestId('gauge-fill')).toBeNull();
  });

  it('draws a labelled target tick', () => {
    render(<HalfPieGauge fraction={0.4} color="#fab219" value="7.49" unit="m²" tick={0.5} tickLabel="target 9" label="Gauge" />);
    expect(screen.getByText('target 9')).toBeTruthy();
  });

  it('uses a second color for the rest of the arc when given (two-part whole)', () => {
    render(<HalfPieGauge fraction={0.33} color="#22c55e" trackColor="#9ca3af" value="33%" unit="green" label="Gauge" />);
    expect(screen.getByTestId('gauge-track').getAttribute('stroke')).toBe('#9ca3af');
    expect(screen.getByTestId('gauge-fill').getAttribute('stroke')).toBe('#22c55e');
  });
});
```

- [ ] **Step 2: Run the test to see it fail**

Run: `npx vitest run src/components/charts/HalfPieGauge.test.jsx`
Expected: FAIL in the new test: `Unable to find an element by: [data-testid="gauge-track"]`.

- [ ] **Step 3: Implement**

<!-- file: src/components/charts/HalfPieGauge.jsx -->
```jsx
const ARC = 'M 20 100 A 80 80 0 0 1 180 100';

/** Point on the gauge circle at a fraction of the way along it (0 = left end, 1 = right end). */
function pointAt(fraction, radius) {
  const angle = Math.PI * (1 - fraction);
  return [100 + radius * Math.cos(angle), 100 - radius * Math.sin(angle)];
}

/**
 * Semicircle gauge (the sketch's "half pie chart"). The arc fills from left to right.
 * fraction: 0–1 (clamped), or null for "No data". tick: optional 0–1 position of a target mark.
 * trackColor: optional color for the rest of the arc, for a two-part whole (e.g. green vs grey).
 */
export default function HalfPieGauge({ fraction, color, trackColor, value, unit, tick, tickLabel, label }) {
  const hasValue = typeof fraction === 'number' && Number.isFinite(fraction);
  const filled = hasValue ? Math.min(1, Math.max(0, fraction)) * 100 : 0;
  const [tx1, ty1] = tick == null ? [] : pointAt(tick, 66);
  const [tx2, ty2] = tick == null ? [] : pointAt(tick, 94);

  return (
    <svg viewBox="0 -18 200 130" className="mx-auto block w-full max-w-64" role="img" aria-label={label}>
      <path
        d={ARC}
        fill="none"
        stroke={trackColor ?? color}
        strokeOpacity={trackColor ? 0.6 : 0.22}
        strokeWidth={16}
        pathLength={100}
        data-testid="gauge-track"
      />
      {filled > 0 && (
        <path
          d={ARC}
          fill="none"
          stroke={color}
          strokeWidth={16}
          pathLength={100}
          strokeDasharray={`${filled} 100`}
          data-testid="gauge-fill"
        />
      )}
      {tick != null && (
        <>
          <line x1={tx1} y1={ty1} x2={tx2} y2={ty2} className="stroke-ink" strokeWidth={2} />
          {tickLabel && (
            <text x={tx2} y={ty2 - 6} textAnchor="middle" fontSize={11} className="fill-ink-2">
              {tickLabel}
            </text>
          )}
        </>
      )}
      {hasValue ? (
        <>
          <text x={100} y={84} textAnchor="middle" fontSize={40} fontWeight={600} className="fill-ink">
            {value}
          </text>
          <text x={100} y={103} textAnchor="middle" fontSize={11} className="fill-ink-2">
            {unit}
          </text>
        </>
      ) : (
        <text x={100} y={88} textAnchor="middle" fontSize={18} className="fill-ink-3">
          No data
        </text>
      )}
    </svg>
  );
}
```

- [ ] **Step 4: Run the test to see it pass**

Run: `npx vitest run src/components/charts/HalfPieGauge.test.jsx`
Expected: PASS (5 tests).

---

### Task 8: Sidebar for Don Mueang

**Files:**
- Modify (rewrite): `src/components/sidebar/Sidebar.jsx`, `OverviewPanel.jsx`, `GreenZonePanel.jsx`, `GreyZonePanel.jsx`
- Test (rewrite): `src/components/sidebar/Sidebar.test.jsx`

- [ ] **Step 1: Write the failing test**

<!-- file: src/components/sidebar/Sidebar.test.jsx -->
```jsx
import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import Sidebar from './Sidebar.jsx';
import { FOCUS_FRAME } from '../../data/frames.js';
import { buildCells } from '../../lib/grid.js';

const square = { type: 'Polygon', coordinates: [[[100.5, 13.7], [100.51, 13.7], [100.51, 13.71], [100.5, 13.71], [100.5, 13.7]]] };

const green = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      geometry: square,
      properties: {
        id: 'GZ-001',
        name: 'Open green land 1',
        nameTh: 'ที่โล่งสีเขียว 1',
        type: 'Open green land',
        district: 'Don Mueang',
        areaM2: 800000,
        populationNearby: 21000,
        nearbyRadiusKm: 1,
        ndvi: 0.62,
        tempInsideC: 31.2,
        tempAroundC: 35.8,
        updatedAt: '2026-10-15',
      },
    },
  ],
};

const greyZone = (id, rank, fitness, distanceKm = 4.7) => ({
  type: 'Feature',
  geometry: square,
  properties: {
    id,
    district: 'Don Mueang',
    areaM2: 12400,
    populationNearby: 38000,
    nearbyRadiusKm: 1,
    fitness,
    rank,
    scores: { greenAccessDeficit: 5, airProximity: 5, heatSeverity: 4 },
    penalty: 0,
    ndvi: 0.08,
    surfaceTempC: 37.4,
    nearestGreenZone: { id: 'GZ-010', name: 'Airfield grass 3', distanceKm },
    updatedAt: null,
  },
});

const grey = {
  type: 'FeatureCollection',
  features: [0.91, 0.84, 0.76, 0.71, 0.65, 0.58, 0.54, 0.41].map((fitness, i) =>
    greyZone(i === 0 ? 'G-001' : `G-00${i + 1}`, i + 1, fitness, i === 7 ? 0 : 4.7),
  ),
};

// 30 × 30 grid of the real gisda_03 frame: the top 10 rows are green, the rest grey (≈ a third green).
const grid = {
  frameId: 'gisda_03',
  rows: 30,
  cols: 30,
  cellSizeM: 100,
  ndvi: Array.from({ length: 30 }, (_, row) => Array(30).fill(row < 10 ? 0.6 : 0.1)),
};
const cells = buildCells(FOCUS_FRAME, grid);

const renderSidebar = (props = {}) =>
  render(
    <Sidebar
      status="ready"
      green={green}
      grey={grey}
      cells={cells}
      grid={grid}
      selected={null}
      onClear={() => {}}
      onRetry={() => {}}
      {...props}
    />,
  );

describe('Sidebar', () => {
  it('shows the Don Mueang overview with the green share and areas in km²', () => {
    renderSidebar();
    expect(screen.getByRole('heading', { name: 'Don Mueang overview' })).toBeTruthy();
    expect(screen.getByText('33%')).toBeTruthy();
    expect(screen.getByText('8.978 km²')).toBeTruthy();
    expect(screen.getByText('37.14 km²')).toBeTruthy();
    expect(screen.getByText('High 3')).toBeTruthy();
  });

  it('lists the other GISTDA frames as "Update soon" with their areas', () => {
    renderSidebar();
    expect(screen.getAllByText('Update soon')).toHaveLength(2);
    expect(screen.getByText('9.024 km²')).toBeTruthy();
    expect(screen.getByText('8.957 km²')).toBeTruthy();
  });

  it('shows green zone stats with the area in km² and the math written out', () => {
    renderSidebar({ selected: { kind: 'green', id: 'GZ-001' } });
    expect(screen.getByRole('heading', { name: 'Open green land 1' })).toBeTruthy();
    expect(screen.getByText('38.1')).toBeTruthy();
    expect(screen.getByText('Meets target')).toBeTruthy();
    expect(screen.getByText('0.800 km²')).toBeTruthy();
    expect(screen.getByText('800,000 m² ÷ 21,000 people = 38.1 m² each')).toBeTruthy();
    expect(screen.getByText('4.6°C cooler than around it')).toBeTruthy();
    expect(screen.getByText('NDVI 0.62 · dense vegetation')).toBeTruthy();
  });

  it('shows grey zone fitness, rank, factors and area in km²', () => {
    renderSidebar({ selected: { kind: 'grey', id: 'G-001' } });
    expect(screen.getByRole('heading', { name: 'Site G-001' })).toBeTruthy();
    expect(screen.getByText('0.91')).toBeTruthy();
    expect(screen.getByText('High priority · rank 1 of 8')).toBeTruthy();
    expect(screen.getByText('Far from parks')).toBeTruthy();
    expect(screen.getByText('0.012 km²')).toBeTruthy();
    expect(screen.getByText('Greening it adds 0.33 m² per nearby person')).toBeTruthy();
    expect(screen.getByText('Airfield grass 3 · 4.7 km')).toBeTruthy();
  });

  it('says "next to it" when the nearest green zone is closer than 0.1 km', () => {
    renderSidebar({ selected: { kind: 'grey', id: 'G-008' } });
    expect(screen.getByText('Airfield grass 3 · next to it')).toBeTruthy();
  });

  it('falls back to the overview when the selected zone is not in the data', () => {
    renderSidebar({ selected: { kind: 'green', id: 'GZ-404' } });
    expect(screen.getByRole('heading', { name: 'Don Mueang overview' })).toBeTruthy();
  });

  it('calls onClear from the close button', () => {
    const onClear = vi.fn();
    renderSidebar({ selected: { kind: 'green', id: 'GZ-001' }, onClear });
    fireEvent.click(screen.getByRole('button', { name: /close/i }));
    expect(onClear).toHaveBeenCalledOnce();
  });

  it('shows placeholder cards while loading', () => {
    renderSidebar({ status: 'loading', green: null, grey: null, cells: null, grid: null });
    expect(screen.getByLabelText('Loading zone data')).toBeTruthy();
  });

  it('shows an error with a working Retry button', () => {
    const onRetry = vi.fn();
    renderSidebar({ status: 'error', green: null, grey: null, cells: null, grid: null, onRetry });
    expect(screen.getByRole('alert').textContent).toContain("Couldn't load zone data");
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(onRetry).toHaveBeenCalledOnce();
  });
});
```

- [ ] **Step 2: Run the test to see it fail**

Run: `npx vitest run src/components/sidebar/Sidebar.test.jsx`
Expected: FAIL. The overview heading is still "Bangkok overview", and zone areas show m² instead of km².

- [ ] **Step 3: Implement**

<!-- file: src/components/sidebar/Sidebar.jsx -->
```jsx
import { Leaf } from 'lucide-react';
import { USING_MOCK_DATA } from '../../config.js';
import { COLORS } from '../../lib/constants.js';
import ErrorCard from '../ui/ErrorCard.jsx';
import LoadingCards from '../ui/LoadingCards.jsx';
import GreenZonePanel from './GreenZonePanel.jsx';
import GreyZonePanel from './GreyZonePanel.jsx';
import OverviewPanel from './OverviewPanel.jsx';

/** Properties of the selected zone, or null if nothing is selected or it is not in the data. */
function findZone(selected, green, grey) {
  if (!selected) return null;
  const collection = selected.kind === 'green' ? green : grey;
  return collection?.features.find((f) => f.properties.id === selected.id)?.properties ?? null;
}

function SidebarBody({ status, green, grey, cells, grid, selected, onClear, onRetry }) {
  if (status === 'loading') return <LoadingCards />;
  if (status === 'error') return <ErrorCard onRetry={onRetry} />;
  const zone = findZone(selected, green, grey);
  if (zone && selected.kind === 'green') return <GreenZonePanel zone={zone} onClose={onClear} />;
  if (zone && selected.kind === 'grey') {
    return <GreyZonePanel zone={zone} totalSites={grey.features.length} onClose={onClear} />;
  }
  return <OverviewPanel cells={cells} grid={grid} grey={grey} />;
}

/** Left column: app header + the overview or the selected zone's 4 cards. */
export default function Sidebar(props) {
  return (
    <aside
      aria-label="Zone statistics"
      className="flex flex-col gap-4 bg-app p-4 lg:h-dvh lg:overflow-y-auto lg:border-r lg:border-line"
    >
      <header className="flex items-center gap-3 border-b border-line pb-4">
        <Leaf size={26} color={COLORS.greenZoneFill} aria-hidden="true" />
        <div className="min-w-0">
          <h1 className="text-base font-semibold leading-tight text-ink">GreenSight</h1>
          <p className="text-xs text-ink-3">Don Mueang green space explorer</p>
        </div>
        {USING_MOCK_DATA && (
          <span
            className="ml-auto rounded-md border border-white/20 px-2 py-0.5 text-xs text-ink-2"
            title="Example data until the backend is connected"
          >
            Mock data
          </span>
        )}
      </header>
      <SidebarBody {...props} />
    </aside>
  );
}
```

<!-- file: src/components/sidebar/OverviewPanel.jsx -->
```jsx
import HalfPieGauge from '../charts/HalfPieGauge.jsx';
import PriorityBar from '../charts/PriorityBar.jsx';
import Card from '../ui/Card.jsx';
import InfoList from '../ui/InfoList.jsx';
import StatPair from '../ui/StatPair.jsx';
import districts from '../../data/districts.json';
import { FOCUS_FRAME, FRAMES } from '../../data/frames.js';
import { COLORS, GREEN_NDVI } from '../../lib/constants.js';
import { formatKm2, formatLatLng, formatPercent } from '../../lib/format.js';
import { frameCenter, frameRing, polygonAreaM2 } from '../../lib/geo.js';
import { classAreas } from '../../lib/grid.js';
import { countByTier } from '../../lib/metrics.js';

const frameAreaM2 = (frame) => polygonAreaM2({ type: 'Polygon', coordinates: [frameRing(frame.corners)] });
const DISTRICT_M2 = polygonAreaM2(districts.features.find((f) => f.properties.role === 'focus').geometry);
const FOCUS_M2 = frameAreaM2(FOCUS_FRAME);
const OTHER_FRAMES = FRAMES.filter((frame) => frame.id !== FOCUS_FRAME.id);
const CORNERS = [
  ['Top-left', 'topLeft'],
  ['Top-right', 'topRight'],
  ['Bottom-left', 'bottomLeft'],
  ['Bottom-right', 'bottomRight'],
];

function Swatch({ color }) {
  return <span className="size-2.5 shrink-0 rounded-sm" style={{ background: color }} aria-hidden="true" />;
}

/** Sidebar content before anything is selected: green vs grey in the focus frame, areas and frames. */
export default function OverviewPanel({ cells, grid, grey }) {
  const areas = cells ? classAreas(cells) : null;
  const landM2 = areas ? areas.green + areas.grey : 0;
  const greenShare = landM2 > 0 ? areas.green / landM2 : null;
  const tiers = countByTier((grey?.features ?? []).map((f) => f.properties.fitness));
  const name = FOCUS_FRAME.id;

  return (
    <div className="space-y-3">
      <header>
        <h2 className="text-xl font-semibold text-ink">Don Mueang overview</h2>
        <p className="text-sm text-ink-3">Click a green or orange zone in the {name} frame to see its stats.</p>
      </header>
      <Card title={`Green and grey in ${name}`}>
        <HalfPieGauge
          fraction={greenShare}
          color={COLORS.gridGreen}
          trackColor={COLORS.gridGrey}
          value={formatPercent(greenShare)}
          unit="of the land is green"
          label={`${formatPercent(greenShare)} of the land in ${name} is green (NDVI ${GREEN_NDVI} and up).`}
        />
        <ul className="mt-2 space-y-1 text-sm">
          <li className="flex items-center gap-2">
            <Swatch color={COLORS.gridGreen} />
            <span className="text-ink">Green</span>
            <span className="text-xs text-ink-3">NDVI {GREEN_NDVI} and up</span>
            <span className="ml-auto tabular-nums text-ink">{formatKm2(areas?.green)}</span>
          </li>
          <li className="flex items-center gap-2">
            <Swatch color={COLORS.gridGrey} />
            <span className="text-ink">Grey</span>
            <span className="text-xs text-ink-3">under {GREEN_NDVI}</span>
            <span className="ml-auto tabular-nums text-ink">{formatKm2(areas?.grey)}</span>
          </li>
          <li className="flex items-center gap-2 text-xs text-ink-3">
            <span className="size-2.5 shrink-0" aria-hidden="true" />
            Water, not counted
            <span className="ml-auto tabular-nums">{formatKm2(areas?.water)}</span>
          </li>
        </ul>
      </Card>
      <Card title="Area">
        <StatPair
          items={[
            { label: `Frame ${name}`, value: formatKm2(FOCUS_M2) },
            { label: 'Don Mueang district', value: formatKm2(DISTRICT_M2) },
          ]}
          note={
            `The frame covers ${formatPercent(FOCUS_M2 / DISTRICT_M2)} of Don Mueang.` +
            (grid ? ` Grid: ${grid.rows} × ${grid.cols} cells${grid.cellSizeM ? ` of about ${grid.cellSizeM} m` : ''}.` : '')
          }
        />
      </Card>
      <Card title="Candidate sites by priority">
        <PriorityBar counts={tiers} />
      </Card>
      <Card title="Frame info">
        <InfoList
          rows={[
            ['Center', formatLatLng(frameCenter(FOCUS_FRAME.corners))],
            ...CORNERS.map(([label, key]) => [label, formatLatLng(FOCUS_FRAME.corners[key])]),
            ['Source', 'THEOS-2 (GISTDA)'],
          ]}
        />
        <h4 className="mb-1 mt-3 text-xs font-medium text-ink-2">Other frames</h4>
        <ul className="space-y-1.5 text-sm">
          {OTHER_FRAMES.map((frame) => (
            <li key={frame.id} className="flex items-center justify-between gap-2">
              <span className="min-w-0">
                <span className="text-ink">{frame.id}</span> <span className="text-xs text-ink-3">{frame.place}</span>
              </span>
              <span className="flex shrink-0 items-center gap-2">
                <span className="tabular-nums text-ink-2">{formatKm2(frameAreaM2(frame))}</span>
                <span className="rounded-md border border-white/20 px-1.5 py-0.5 text-xs text-ink-2">Update soon</span>
              </span>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
```

<!-- file: src/components/sidebar/GreenZonePanel.jsx -->
```jsx
import CoolingChart from '../charts/CoolingChart.jsx';
import HalfPieGauge from '../charts/HalfPieGauge.jsx';
import Card from '../ui/Card.jsx';
import InfoList from '../ui/InfoList.jsx';
import StatPair from '../ui/StatPair.jsx';
import StatusBadge from '../ui/StatusBadge.jsx';
import PanelHeader from './PanelHeader.jsx';
import { COLORS, TARGET_M2_PER_PERSON } from '../../lib/constants.js';
import { DASH, formatArea, formatDecimal, formatKm2, formatNumber } from '../../lib/format.js';
import { greenGaugeFraction, greenSpaceStatus, m2PerPerson, ndviLabel } from '../../lib/metrics.js';

/** Sidebar content for a selected green zone. `zone` is a normalized feature's properties. */
export default function GreenZonePanel({ zone, onClose }) {
  const perPerson = m2PerPerson(zone.areaM2, zone.populationNearby);
  const status = greenSpaceStatus(perPerson);
  const perPersonText = formatDecimal(perPerson, 1);
  const vegetation = zone.ndvi == null ? DASH : `NDVI ${formatDecimal(zone.ndvi, 2)} · ${ndviLabel(zone.ndvi)}`;
  const rows = [
    ['Zone ID', zone.id],
    ['Type', zone.type],
    ['Vegetation', vegetation],
    ['Data', 'THEOS-2, Landsat 8/9'],
  ];
  if (zone.updatedAt) rows.push(['Updated', zone.updatedAt]);

  return (
    <div className="space-y-3">
      <PanelHeader
        pill="Green zone"
        pillColor={COLORS.greenZoneText}
        pillBg="rgb(34 197 94 / 0.15)"
        title={zone.name}
        subtitle={[zone.nameTh, zone.district].filter(Boolean).join(' · ')}
        onClose={onClose}
      />
      <Card title="Green space per person">
        <HalfPieGauge
          fraction={perPerson == null ? null : greenGaugeFraction(perPerson)}
          color={status.color}
          value={perPersonText}
          unit="m² per person"
          tick={0.5}
          tickLabel={`target ${TARGET_M2_PER_PERSON}`}
          label={`Green space per person: ${perPerson == null ? 'no data' : `${perPersonText} m²`}. Target ${TARGET_M2_PER_PERSON} m². ${status.label}.`}
        />
        <StatusBadge status={status} />
      </Card>
      <Card title="Population and area">
        <StatPair
          items={[
            { label: `People within ${zone.nearbyRadiusKm} km`, value: formatNumber(zone.populationNearby) },
            { label: 'Green zone area', value: formatKm2(zone.areaM2) },
          ]}
          note={
            perPerson == null
              ? null
              : `${formatArea(zone.areaM2)} ÷ ${formatNumber(zone.populationNearby)} people = ${perPersonText} m² each`
          }
        />
      </Card>
      <Card title="Cooling effect">
        <CoolingChart insideC={zone.tempInsideC} aroundC={zone.tempAroundC} radiusKm={zone.nearbyRadiusKm} />
      </Card>
      <Card title="Info">
        <InfoList rows={rows} />
      </Card>
    </div>
  );
}
```

<!-- file: src/components/sidebar/GreyZonePanel.jsx -->
```jsx
import FactorBars from '../charts/FactorBars.jsx';
import HalfPieGauge from '../charts/HalfPieGauge.jsx';
import Card from '../ui/Card.jsx';
import InfoList from '../ui/InfoList.jsx';
import StatPair from '../ui/StatPair.jsx';
import PanelHeader from './PanelHeader.jsx';
import { COLORS } from '../../lib/constants.js';
import { DASH, formatDecimal, formatKm, formatKm2, formatNumber, formatTemp } from '../../lib/format.js';
import { m2PerPerson, ndviLabel, priorityTier } from '../../lib/metrics.js';

/** "Airfield grass 3 · 0.2 km", or "· next to it" when it is closer than 0.1 km. */
function nearestText(nearest) {
  if (!nearest?.name) return DASH;
  const distance = nearest.distanceKm != null && nearest.distanceKm < 0.1 ? 'next to it' : formatKm(nearest.distanceKm);
  return `${nearest.name} · ${distance}`;
}

/** Sidebar content for a selected grey zone (candidate site). */
export default function GreyZonePanel({ zone, totalSites, onClose }) {
  const tier = priorityTier(zone.fitness);
  const fitnessText = formatDecimal(zone.fitness, 2);
  const addedPerPerson = m2PerPerson(zone.areaM2, zone.populationNearby);
  const rows = [
    ['Land now', zone.ndvi == null ? DASH : `NDVI ${formatDecimal(zone.ndvi, 2)} · ${ndviLabel(zone.ndvi)}`],
    ['Nearest green zone', nearestText(zone.nearestGreenZone)],
    ['Surface temp', formatTemp(zone.surfaceTempC)],
    ['Data', 'THEOS-2, Landsat 8/9, OpenStreetMap'],
  ];
  if (zone.updatedAt) rows.push(['Updated', zone.updatedAt]);
  const rankText = zone.rank == null ? null : `rank ${zone.rank} of ${totalSites}`;

  return (
    <div className="space-y-3">
      <PanelHeader
        pill="Grey zone · candidate site"
        pillColor={COLORS.greyZoneText}
        pillBg="rgb(249 115 22 / 0.15)"
        title={`Site ${zone.id}`}
        subtitle={[zone.district, 'open land'].filter(Boolean).join(' · ')}
        onClose={onClose}
      />
      <Card title="Fitness score">
        <HalfPieGauge
          fraction={zone.fitness}
          color={COLORS.fitnessArc}
          value={fitnessText}
          unit="out of 1.00"
          label={`Fitness score ${fitnessText} out of 1. ${tier.label}.`}
        />
        <p className="mt-1 flex items-center justify-center gap-1.5 text-sm text-ink">
          <span className="size-2.5 rounded-sm ring-1 ring-white/25" style={{ background: tier.color }} aria-hidden="true" />
          {[tier.label, rankText].filter(Boolean).join(' · ')}
        </p>
      </Card>
      <Card title="Population and area">
        <StatPair
          items={[
            { label: `People within ${zone.nearbyRadiusKm} km`, value: formatNumber(zone.populationNearby) },
            { label: 'Site area', value: formatKm2(zone.areaM2) },
          ]}
          note={
            addedPerPerson == null ? null : `Greening it adds ${formatDecimal(addedPerPerson, 2)} m² per nearby person`
          }
        />
      </Card>
      <Card title="Why this site?">
        <FactorBars scores={zone.scores} penalty={zone.penalty} />
      </Card>
      <Card title="Info">
        <InfoList rows={rows} />
      </Card>
    </div>
  );
}
```

- [ ] **Step 4: Run the test to see it pass**

Run: `npx vitest run src/components/sidebar/Sidebar.test.jsx`
Expected: PASS (9 tests).

---

### Task 9: Map focused on Don Mueang

The map is checked in the real browser in Task 12. Leaflet doesn't work well in jsdom, so it has no unit tests.

**Files:**
- Modify (rewrite): `src/config.js`, `src/index.css`, `src/components/map/ZoneMap.jsx`, `LayerControl.jsx`, `MapLegend.jsx`

- [ ] **Step 1: Update config and CSS**

<!-- file: src/config.js -->
```js
/** Backend base URL from .env. Empty means "use the mock files in public/mock/". */
export const API_URL = (import.meta.env.VITE_API_URL ?? '').trim().replace(/\/+$/, '');
export const USING_MOCK_DATA = API_URL === '';

/**
 * Standard OpenStreetMap tiles: open data, no API key. Fine for development and demos; for heavy
 * traffic use a tile provider or self-host (https://operations.osmfoundation.org/policies/tiles/).
 * Its colors are muted in src/index.css (.basemap) so the zone colors stand out.
 */
export const BASEMAP = {
  url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  maxZoom: 19,
};

/** The map opens on Don Mueang; minZoom is raised at runtime so you can't zoom far out of it. */
export const MAP_DEFAULTS = {
  zoom: 13,
  minZoom: 10,
  maxZoom: 19,
};
```

<!-- file: src/index.css -->
```css
/* Only scan src/ for class names (not docs/, whose markdown mentions many classes). */
@import "tailwindcss" source(".");

@theme {
  --font-sans: system-ui, "Segoe UI", Roboto, "Leelawadee UI", "Noto Sans Thai", sans-serif;

  /* UI chrome (dark). Data colors live in src/lib/constants.js. */
  --color-app: #121212;
  --color-card: #1c1c1b;
  --color-line: rgb(255 255 255 / 0.08);
  --color-ink: #f5f5f4;
  --color-ink-2: #c3c2b7;
  --color-ink-3: #8a8983;
}

:root {
  color-scheme: dark;
}

body {
  background: var(--color-app);
  color: var(--color-ink);
  -webkit-font-smoothing: antialiased;
}

/* Leaflet: use the app font and show a neutral color while map tiles load. */
.leaflet-container {
  background: #e9e7e2;
  font-family: inherit;
}

/* Mute the colorful OpenStreetMap tiles so the green and orange zones stand out. */
.basemap {
  filter: saturate(0.3) brightness(1.04);
}

/* Text labels on the map: district names and "Update soon" on the grey cover, and frame names. */
.map-label > span {
  display: block;
  width: max-content;
  transform: translate(-50%, -50%);
  text-align: center;
  font-size: 12px;
  font-weight: 600;
  line-height: 1.3;
  color: #ffffff;
  text-shadow: 0 0 3px rgb(0 0 0 / 0.9), 0 0 1px rgb(0 0 0 / 0.9);
}

.map-label small {
  display: block;
  font-size: 11px;
  font-weight: 500;
  color: #fde68a;
}

.map-label.frame-label > span {
  transform: translate(0, calc(-100% - 4px));
  color: #111827;
  text-shadow: 0 0 3px #ffffff, 0 0 2px #ffffff;
}
```

- [ ] **Step 2: Update the layer switches and the legend**

<!-- file: src/components/map/LayerControl.jsx -->
```jsx
import { COLORS } from '../../lib/constants.js';

const LAYERS = [
  { key: 'grid', label: 'Green/grey grid', swatch: `linear-gradient(90deg, ${COLORS.gridGreen} 50%, ${COLORS.gridGrey} 50%)` },
  { key: 'green', label: 'Green zones', swatch: COLORS.greenZoneMark },
  { key: 'grey', label: 'Grey zones (sites)', swatch: COLORS.tierMedium },
];

/** Floating card (top-right of the map) to show or hide each layer. */
export default function LayerControl({ layers, onChange }) {
  return (
    <fieldset className="absolute right-3 top-3 z-[1000] rounded-lg border border-black/10 bg-white px-3 py-2 text-sm text-neutral-800 shadow-md">
      <legend className="sr-only">Map layers</legend>
      <p className="mb-1 font-semibold" aria-hidden="true">
        Layers
      </p>
      {LAYERS.map(({ key, label, swatch }) => (
        <label key={key} className="flex cursor-pointer items-center gap-2 py-0.5">
          <input
            type="checkbox"
            className="size-4 accent-neutral-800"
            checked={layers[key]}
            onChange={(event) => onChange(key, event.target.checked)}
          />
          <span className="size-3 rounded-sm" style={{ background: swatch }} aria-hidden="true" />
          {label}
        </label>
      ))}
    </fieldset>
  );
}
```

<!-- file: src/components/map/MapLegend.jsx -->
```jsx
import { useEffect, useRef } from 'react';
import { COLORS, GREEN_NDVI } from '../../lib/constants.js';
import { TIER_ORDER } from '../../lib/metrics.js';

function Swatch({ color, outline = false }) {
  return (
    <span
      className="size-3 shrink-0 rounded-sm"
      style={outline ? { border: `2px solid ${color}` } : { background: color }}
      aria-hidden="true"
    />
  );
}

/** Floating legend (bottom-left of the map). Click "Legend" to fold or unfold it. */
export default function MapLegend() {
  const ref = useRef(null);

  // Open on desktop, folded on phones (where it would cover a big part of the small map).
  // Follows the breakpoint when the screen size changes; in between, the user's choice stays.
  useEffect(() => {
    const desktop = window.matchMedia('(min-width: 1024px)');
    const sync = () => {
      if (ref.current) ref.current.open = desktop.matches;
    };
    sync();
    desktop.addEventListener('change', sync);
    return () => desktop.removeEventListener('change', sync);
  }, []);

  return (
    <details
      ref={ref}
      className="group absolute bottom-6 left-3 z-[1000] rounded-lg border border-black/10 bg-white px-3 py-2 text-xs text-neutral-800 shadow-md"
    >
      <summary className="cursor-pointer select-none font-semibold group-open:mb-1">Legend</summary>
      <p className="mb-1 font-semibold">Grid (NDVI)</p>
      <p className="flex items-center gap-2">
        <Swatch color={COLORS.gridGreen} />
        Green ({GREEN_NDVI} and up)
      </p>
      <p className="flex items-center gap-2">
        <Swatch color={COLORS.gridGrey} />
        Grey (under {GREEN_NDVI})
      </p>
      <p className="mt-2 flex items-center gap-2">
        <Swatch color={COLORS.greenZoneStroke} outline />
        Green zone
      </p>
      <p className="mb-1 mt-2 font-semibold">Grey zone: priority to plant</p>
      <ul className="space-y-0.5">
        {TIER_ORDER.map((tier) => (
          <li key={tier.key} className="flex items-center gap-2">
            <Swatch color={tier.color} />
            {tier.short} ({tier.range})
          </li>
        ))}
      </ul>
      <p className="mt-2 flex items-center gap-2">
        <Swatch color={COLORS.mask} />
        Update soon
      </p>
    </details>
  );
}
```

- [ ] **Step 3: Rewrite the map**

<!-- file: src/components/map/ZoneMap.jsx -->
```jsx
import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { GeoJSON, MapContainer, Marker, Pane, TileLayer, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { LoaderCircle, Maximize, Minus, Plus } from 'lucide-react';
import { BASEMAP, MAP_DEFAULTS } from '../../config.js';
import districts from '../../data/districts.json';
import { FRAMES } from '../../data/frames.js';
import { COLORS } from '../../lib/constants.js';
import { formatKm2 } from '../../lib/format.js';
import { frameCenter, frameRing, maskPolygon, polygonAreaM2 } from '../../lib/geo.js';
import { priorityTier } from '../../lib/metrics.js';
import LayerControl from './LayerControl.jsx';
import MapLegend from './MapLegend.jsx';

// ---- Static focus data (Don Mueang, its neighbours and the GISTDA frames) ----
const FOCUS = districts.features.find((f) => f.properties.role === 'focus');
const NEIGHBOURS = districts.features.filter((f) => f.properties.role === 'soon');
const [WEST, SOUTH, EAST, NORTH] = districts.metadata.viewBounds;
const VIEW_BOUNDS = L.latLngBounds([SOUTH, WEST], [NORTH, EAST]);
const FOCUS_BOUNDS = L.geoJSON(FOCUS).getBounds();
const FIT_OPTIONS = { padding: [24, 24] };
// The grey "update soon" cover reaches far past the view, so panning never shows its edge.
const MASK = maskPolygon(FOCUS.geometry, [WEST - 1, SOUTH - 1, EAST + 1, NORTH + 1]);
const FRAME_SHAPES = FRAMES.map((frame) => {
  const geometry = { type: 'Polygon', coordinates: [frameRing(frame.corners)] };
  return { frame, geometry, areaM2: polygonAreaM2(geometry) };
});

const escapeHtml = (text) =>
  String(text).replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[ch]);
const labelIcon = (html, className = '') =>
  L.divIcon({ className: `map-label ${className}`.trim(), html: `<span>${html}</span>`, iconSize: null });
const SOON = '<small>Update soon</small>';
const LABELS = [
  ...NEIGHBOURS.map(({ properties: p }) => ({
    id: p.id,
    position: [p.label[1], p.label[0]],
    icon: labelIcon(`${escapeHtml(p.nameEn)} · ${escapeHtml(p.nameTh)}${SOON}`),
  })),
  ...FRAME_SHAPES.map(({ frame, areaM2 }) =>
    frame.status === 'ready'
      ? { id: frame.id, position: frame.corners.topLeft, icon: labelIcon(`${escapeHtml(frame.id)} · ${formatKm2(areaM2)}`, 'frame-label') }
      : { id: frame.id, position: frameCenter(frame.corners), icon: labelIcon(`${escapeHtml(frame.id)}${SOON}`) },
  ),
];

/** Grey cover outside Don Mueang, neighbour outlines, the Don Mueang outline, frames and labels. */
const FocusLayers = memo(function FocusLayers() {
  return (
    <>
      <Pane name="mask" style={{ zIndex: 350 }}>
        <GeoJSON data={MASK} style={{ stroke: false, fillColor: COLORS.mask, fillOpacity: 0.55 }} interactive={false} />
        {NEIGHBOURS.map((district) => (
          <GeoJSON
            key={district.properties.id}
            data={district}
            style={{ color: '#ffffff', weight: 1.5, opacity: 0.7, dashArray: '4 4', fill: false }}
            interactive={false}
          />
        ))}
      </Pane>
      <GeoJSON data={FOCUS} style={{ color: COLORS.focusOutline, weight: 3, fill: false }} interactive={false} />
      {FRAME_SHAPES.map(({ frame, geometry }) => (
        <GeoJSON
          key={frame.id}
          data={geometry}
          interactive={false}
          style={
            frame.status === 'ready'
              ? { color: COLORS.frameOutline, weight: 2, fill: false }
              : { color: '#ffffff', weight: 2, dashArray: '6 6', fill: false }
          }
        />
      ))}
      <Pane name="labels" style={{ zIndex: 450 }}>
        {LABELS.map((label) => (
          <Marker key={label.id} position={label.position} icon={label.icon} interactive={false} keyboard={false} />
        ))}
      </Pane>
    </>
  );
});

// ---- Grid and zones ----
const CELL_FILL = { green: COLORS.gridGreen, grey: COLORS.gridGrey };

function cellStyle(feature) {
  const fill = CELL_FILL[feature.properties.class];
  return fill
    ? { color: '#ffffff', weight: 0.5, opacity: 0.35, fillColor: fill, fillOpacity: 0.45 }
    : { stroke: false, fill: false };
}

const isSelected = (selected, kind, id) => selected?.kind === kind && selected.id === id;

const zoneLabel = (kind, p) => (kind === 'green' ? p.name : `Site ${p.id} · ${priorityTier(p.fitness).label}`);

function zoneStyle(kind, p, selected) {
  let base;
  if (kind === 'green') {
    base = { color: COLORS.greenZoneStroke, fillColor: COLORS.greenZoneFill, fillOpacity: 0.12 };
  } else {
    const tier = priorityTier(p.fitness);
    base = { color: tier.stroke, fillColor: tier.color, fillOpacity: 0.7 };
  }
  return isSelected(selected, kind, p.id) ? { ...base, color: COLORS.selected, weight: 3 } : { ...base, weight: 2 };
}

/** One layer of zone shapes. Styles update in place when the selection changes. */
function ZoneShapes({ kind, data, selected, onSelect }) {
  const layerRef = useRef(null);
  const latest = useRef({ selected, onSelect });

  useEffect(() => {
    latest.current = { selected, onSelect };
  });

  useEffect(() => {
    layerRef.current?.eachLayer((layer) => {
      const p = layer.feature.properties;
      layer.setStyle(zoneStyle(kind, p, selected));
      if (isSelected(selected, kind, p.id)) layer.bringToFront();
    });
  }, [kind, selected]);

  const style = useCallback((feature) => zoneStyle(kind, feature.properties, latest.current.selected), [kind]);

  const onEachFeature = useCallback(
    (feature, layer) => {
      const p = feature.properties;
      layer.bindTooltip(zoneLabel(kind, p), { sticky: true, direction: 'top' });
      layer.on({
        click: () => latest.current.onSelect({ kind, id: p.id }),
        mouseover: () => layer.setStyle({ weight: 3.5 }),
        mouseout: () => layer.setStyle(zoneStyle(kind, p, latest.current.selected)),
      });
    },
    [kind],
  );

  return <GeoJSON ref={layerRef} data={data} style={style} onEachFeature={onEachFeature} bubblingMouseEvents={false} />;
}

// ---- Map behaviour and controls ----
/** Lets the user zoom out a little past Don Mueang, but not further. Skipped while the map has no size. */
function updateMinZoom(map) {
  const size = map.getSize();
  if (size.x > 0 && size.y > 0) map.setMinZoom(Math.max(MAP_DEFAULTS.minZoom, map.getBoundsZoom(FOCUS_BOUNDS) - 0.75));
}

/** Fits Don Mueang once the map has a real size, keeps the zoom-out limit in step, clears on empty clicks. */
function MapEvents({ onReady, onEmptyClick }) {
  const map = useMapEvents({
    click: () => onEmptyClick(),
    resize: () => updateMinZoom(map),
  });
  useEffect(() => {
    // Leaflet only notices window resizes. Watch the container itself: it can start at 0 × 0 (or a
    // half-laid-out size) and fitting then would zoom all the way in.
    let fitted = false;
    const container = map.getContainer();
    const observer = new ResizeObserver(() => {
      map.invalidateSize();
      if (!fitted && container.clientWidth > 0 && container.clientHeight > 0) {
        fitted = true;
        map.fitBounds(FOCUS_BOUNDS, FIT_OPTIONS);
        updateMinZoom(map);
      }
    });
    observer.observe(container);
    onReady(map);
    return () => observer.disconnect();
  }, [map, onReady]);
  return null;
}

const buttonClass =
  'flex size-9 items-center justify-center bg-white text-neutral-800 hover:bg-neutral-100 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-blue-600';

function MapButtons({ map, onReset }) {
  return (
    <div className="absolute left-3 top-3 z-[1000] flex flex-col divide-y divide-black/10 overflow-hidden rounded-lg border border-black/15 shadow-md">
      <button type="button" className={buttonClass} aria-label="Zoom in" title="Zoom in" onClick={() => map?.zoomIn()}>
        <Plus size={18} aria-hidden="true" />
      </button>
      <button type="button" className={buttonClass} aria-label="Zoom out" title="Zoom out" onClick={() => map?.zoomOut()}>
        <Minus size={18} aria-hidden="true" />
      </button>
      <button type="button" className={buttonClass} aria-label="Reset view" title="Reset view" onClick={onReset}>
        <Maximize size={16} aria-hidden="true" />
      </button>
    </div>
  );
}

/** The interactive map: Don Mueang focus, the green/grey grid of the frame, zones, controls and legend. */
export default function ZoneMap({ green, grey, cells, version, layers, onToggleLayer, selected, onSelect, onClear, loading }) {
  const [map, setMap] = useState(null);
  const resetView = useCallback(() => map?.fitBounds(FOCUS_BOUNDS, FIT_OPTIONS), [map]);

  return (
    <div className="relative h-[55vh] min-h-80 lg:h-dvh">
      <MapContainer
        center={FOCUS_BOUNDS.getCenter()}
        zoom={MAP_DEFAULTS.zoom}
        minZoom={MAP_DEFAULTS.minZoom}
        maxZoom={MAP_DEFAULTS.maxZoom}
        zoomSnap={0.25}
        maxBounds={VIEW_BOUNDS}
        maxBoundsViscosity={1}
        zoomControl={false}
        className="isolate size-full"
      >
        <TileLayer url={BASEMAP.url} attribution={BASEMAP.attribution} maxZoom={BASEMAP.maxZoom} className="basemap" />
        <MapEvents onReady={setMap} onEmptyClick={onClear} />
        <FocusLayers />
        <Pane name="grid" style={{ zIndex: 390 }}>
          {layers.grid && cells && <GeoJSON key={`grid-${version}`} data={cells} style={cellStyle} interactive={false} />}
        </Pane>
        {layers.green && green && (
          <ZoneShapes key={`green-${version}`} kind="green" data={green} selected={selected} onSelect={onSelect} />
        )}
        {layers.grey && grey && (
          <ZoneShapes key={`grey-${version}`} kind="grey" data={grey} selected={selected} onSelect={onSelect} />
        )}
      </MapContainer>
      <MapButtons map={map} onReset={resetView} />
      <LayerControl layers={layers} onChange={onToggleLayer} />
      <MapLegend />
      {loading && (
        <p className="pointer-events-none absolute left-1/2 top-16 z-[1000] flex -translate-x-1/2 items-center gap-2 rounded-full bg-white px-3 py-1.5 text-sm text-neutral-800 shadow-md lg:top-3">
          <LoaderCircle size={16} className="animate-spin" aria-hidden="true" />
          Loading zones…
        </p>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Check that it builds**

Run: `npm run build`
Expected: builds with no errors. (`App.jsx` still uses the old hook, which is fixed in Task 10. If the build fails only because `useZones.js` was removed, carry on to Task 10.)

---

### Task 10: Wire up the app

**Files:**
- Modify (rewrite): `src/App.jsx`

- [ ] **Step 1: Replace App.jsx**

<!-- file: src/App.jsx -->
```jsx
import { useCallback, useEffect, useMemo, useState } from 'react';
import ZoneMap from './components/map/ZoneMap.jsx';
import Sidebar from './components/sidebar/Sidebar.jsx';
import { FOCUS_FRAME } from './data/frames.js';
import useMapData from './hooks/useMapData.js';
import { buildCells } from './lib/grid.js';

export default function App() {
  const { status, green, grey, grid, version, reload } = useMapData();
  // The frontend turns the NDVI values into green / grey / water cells with real corner lat/lngs.
  const cells = useMemo(() => (grid ? buildCells(FOCUS_FRAME, grid) : null), [grid]);
  const [selected, setSelected] = useState(null); // { kind: 'green' | 'grey', id } or null
  const [layers, setLayers] = useState({ grid: true, green: true, grey: true });

  const clearSelection = useCallback(() => setSelected(null), []);

  const toggleLayer = useCallback((kind, visible) => {
    setLayers((prev) => ({ ...prev, [kind]: visible }));
    // Never keep showing stats for a zone the user just hid.
    if (!visible) setSelected((current) => (current?.kind === kind ? null : current));
  }, []);

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === 'Escape') setSelected(null);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  return (
    <div className="flex min-h-dvh flex-col-reverse lg:grid lg:h-dvh lg:grid-cols-[400px_minmax(0,1fr)]">
      <Sidebar
        status={status}
        green={green}
        grey={grey}
        cells={cells}
        grid={grid}
        selected={selected}
        onClear={clearSelection}
        onRetry={reload}
      />
      <main className="min-w-0">
        <ZoneMap
          green={green}
          grey={grey}
          cells={cells}
          version={version}
          layers={layers}
          onToggleLayer={toggleLayer}
          selected={selected}
          onSelect={setSelected}
          onClear={clearSelection}
          loading={status === 'loading'}
        />
      </main>
    </div>
  );
}
```

- [ ] **Step 2: Run all tests and the build**

Run: `npm test && npm run build`
Expected: every test file passes, and the build has no errors.

---

### Task 11: Docs for the team

**Files:**
- Modify (rewrite): `docs/API.md`, `README.md`

- [ ] **Step 1: Write the backend contract**

<!-- file: docs/API.md -->
````markdown
# GreenSight data API

This is the contract between the frontend and the backend. The app focuses on **Don Mueang district** and the GISTDA frame **gisda_03**. The frontend needs **three endpoints**:

| Method | Path | Returns |
|---|---|---|
| GET | `{VITE_API_URL}/frames/gisda_03/grid` | NDVI values of the frame's grid (JSON) |
| GET | `{VITE_API_URL}/green-zones` | Green zones inside the frame (GeoJSON `FeatureCollection`) |
| GET | `{VITE_API_URL}/grey-zones` | Grey zones, the candidate sites, inside the frame (GeoJSON `FeatureCollection`) |

- Set `VITE_API_URL` in `.env` (copy `.env.example`), for example `VITE_API_URL=http://localhost:8000/api`. Restart `npm run dev` after changing it.
- When `VITE_API_URL` is empty, the app reads `public/mock/grids/gisda_03.json`, `public/mock/green-zones.geojson` and `public/mock/grey-zones.geojson` instead. **Those files are working examples of everything below.**
- Allow CORS from the frontend origin (`http://localhost:5173` during development).
- Reply with HTTP `200` and JSON. Any other status makes the app show "Couldn't load zone data" with a Retry button.

## Frames (frontend config, not an endpoint)

The GISTDA frames and their corner coordinates (`[lat, lng]`) live in `src/data/frames.js`:

| Frame | Status | Place |
|---|---|---|
| gisda_03 | `ready`, the focus frame | Don Mueang |
| gisda_01 | `soon`, shown as "Update soon" | Pak Kret / Lak Si |
| gisda_02 | `soon`, shown as "Update soon" | Chon Buri (Sattahip) |

## NDVI grid

```json
{
  "frameId": "gisda_03",
  "rows": 2,
  "cols": 3,
  "cellSizeM": 100,
  "ndvi": [
    [0.41, 0.18, -0.05],
    [0.33, 0.27, 0.62]
  ]
}
```

(The real gisda_03 grid is 30 × 30. See `public/mock/grids/gisda_03.json`.)

- `ndvi[row][col]`, where **row 0 is the north (top) edge** of the frame and **col 0 is the west (left) edge**.
- **The frontend works out every cell's corners itself** by splitting the frame evenly between its 4 corner coordinates (bilinear interpolation). Your grid must use the same layout: `rows` × `cols` equal steps from the top-left corner.
- **The frontend decides each cell's class:** NDVI **< 0 is water** (not counted), **< 0.3 is grey**, and **≥ 0.3 is green**. A value that isn't a number shows as an unknown cell.
- The frontend also works out the areas (km²) of the frame, the cells, and the green/grey totals. Don't send them.
- `rows` and `cols` must be whole numbers, and `ndvi` must have exactly `rows` lists. Otherwise the app shows the error card.

## Zones

Build the zones from the **same cells and the same NDVI rule**:

- **Green zone** = connected green cells.
- **Grey zone** = connected grey cells that are **open land** (not homes, roads, the airport or water). These are the candidate sites, ranked by fitness.

### Green zone feature

```json
{
  "type": "Feature",
  "properties": {
    "id": "GZ-001",
    "frameId": "gisda_03",
    "name": "Open green land 1",
    "nameTh": "ที่โล่งสีเขียว 1",
    "type": "Open green land",
    "district": "Don Mueang",
    "areaM2": 1076451,
    "populationNearby": 53300,
    "nearbyRadiusKm": 1,
    "ndvi": 0.37,
    "tempInsideC": 36,
    "tempAroundC": 37,
    "updatedAt": "2026-10-15"
  },
  "geometry": {
    "type": "Polygon",
    "coordinates": [[[100.579746, 13.920092], [100.582513, 13.920075], [100.582521, 13.920976], [100.579754, 13.920993], [100.579746, 13.920092]]]
  }
}
```

(The geometry is shortened here. See `public/mock/green-zones.geojson` for the real shapes.)

| Field | Type | Unit | Required | Meaning |
|---|---|---|---|---|
| `id` | string | | yes | Unique id |
| `frameId` | string | | no | Frame the zone belongs to |
| `name` | string | | yes | English name |
| `nameTh` | string | | no | Thai name |
| `type` | string | | no | For example "Grass field" (default "Green zone") |
| `district` | string | | yes | District |
| `areaM2` | number | m² | yes | Area of the zone (the app shows it in km²) |
| `populationNearby` | number | people | yes | People living within `nearbyRadiusKm` of the zone |
| `nearbyRadiusKm` | number | km | no | Default 1 |
| `ndvi` | number | −1 to 1 | no | Mean NDVI of the zone |
| `tempInsideC` | number | °C | no | Mean land surface temperature inside (Landsat 8/9) |
| `tempAroundC` | number | °C | no | Mean land surface temperature within `nearbyRadiusKm` |
| `updatedAt` | string | ISO date | no | When the numbers were computed |

### Grey zone feature

```json
{
  "type": "Feature",
  "properties": {
    "id": "G-001",
    "rank": 1,
    "frameId": "gisda_03",
    "district": "Don Mueang",
    "areaM2": 19971,
    "populationNearby": 13500,
    "nearbyRadiusKm": 1,
    "fitness": 0.78,
    "scores": { "greenAccessDeficit": 4, "airProximity": 4, "heatSeverity": 5 },
    "penalty": 0.05,
    "ndvi": 0.19,
    "surfaceTempC": 37.5,
    "nearestGreenZone": { "id": "GZ-004", "name": "Airfield grass 1", "distanceKm": 0.2 },
    "updatedAt": "2026-10-15"
  },
  "geometry": {
    "type": "Polygon",
    "coordinates": [[[100.593506, 13.910094], [100.59443, 13.910088], [100.594443, 13.91189], [100.59352, 13.911896], [100.593506, 13.910094]]]
  }
}
```

| Field | Type | Unit | Required | Meaning |
|---|---|---|---|---|
| `id` | string | | yes | Site id |
| `rank` | integer | | yes | 1 = highest priority, with no gaps (1…N) |
| `frameId` | string | | no | Frame the site belongs to |
| `district` | string | | yes | District |
| `areaM2` | number | m² | yes | Area of the site (the app shows it in km²) |
| `populationNearby` | number | people | yes | People living within `nearbyRadiusKm` of the site |
| `nearbyRadiusKm` | number | km | no | Default 1 |
| `fitness` | number | 0 to 1 | yes | Fitness score from the Hybrid GA |
| `scores.greenAccessDeficit` | integer | 1 to 5 | yes | Far from existing green space = high |
| `scores.airProximity` | integer | 1 to 5 | yes | Near major roads or industry = high |
| `scores.heatSeverity` | integer | 1 to 5 | yes | Hot surface compared with the study-area average = high |
| `penalty` | number | | no | "Surrounded" penalty already subtracted from fitness (default 0) |
| `ndvi` | number | −1 to 1 | no | Current NDVI of the site |
| `surfaceTempC` | number | °C | no | Land surface temperature |
| `nearestGreenZone` | object | | no | `{ "id", "name", "distanceKm" }`. Under 0.1 km shows as "next to it" |
| `updatedAt` | string | ISO date | no | When the numbers were computed |

Geometry: `Polygon` or `MultiPolygon`, WGS84 `[longitude, latitude]` (EPSG:4326).

## What the frontend computes (don't send these)

- **Cell corners**, from the frame's 4 corners and `rows` × `cols`.
- **Cell class:** water, grey or green from NDVI (0 and 0.3 thresholds).
- **Areas in km²** (spherical formula on the lat/lngs): the frame, each cell, green/grey/water totals, and the district.
- **m² per person** = `areaM2 / populationNearby`. It shows "—" if the population is missing or 0.
- **Status:** ≥ 9 m² meets the target, 3 to under 9 is below target, and under 3 is far below target.
- **Priority tier:** fitness ≥ 0.75 is high, ≥ 0.50 is medium, and the rest are low.
- **"rank N of M"**, where M is the number of grey zones you return.

## How the frontend treats your data

- A zone without `properties.id` or without polygon geometry is skipped, and a warning appears in the browser console.
- A number that is missing or not finite shows as "—". The cards still render.
- Extra fields are ignored, so it is safe to send more.
````

- [ ] **Step 2: Write the README**

<!-- file: README.md -->
````markdown
# GreenSight frontend

An interactive map dashboard for **GreenSight: Optimization of Urban Green Space Development Sites using THEOS-2** (GeoHackathon 2026). It focuses on **Don Mueang district (เขตดอนเมือง)** and the GISTDA THEOS-2 frame **gisda_03**.

- **Classified grid:** the frame is split into a 30 × 30 grid of cells (about 100 m each). Every cell is decided **green** (NDVI ≥ 0.3), **grey** (NDVI < 0.3) or water from its NDVI value.
- **Clickable zones:** **green zones** (connected green cells) and **grey zones** (connected open-land grey cells, the candidate sites for new green space). Click either to see its stats.
- **Areas in km²**, calculated from the real latitude/longitude.
- **"Update soon":** everything outside Don Mueang is grey and labeled that way.

> This is the frontend only. It runs on **mock data** until the backend is connected (see below).

## Run it

You need Node.js 22.12 or newer (tested with Node 24).

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

## Connect the backend

1. Copy `.env.example` to `.env`.
2. Set `VITE_API_URL` to the backend base URL, for example `VITE_API_URL=http://localhost:8000/api`.
3. Restart `npm run dev`. The "Mock data" badge disappears.

The backend has to serve the NDVI grid of gisda_03 plus the green and grey zones. **[docs/API.md](docs/API.md)** describes them, and the files in `public/mock/` are working examples.

## How to use the app

- **Moving around:** the map opens on Don Mueang and stays there. Zoom with the + / − buttons, the mouse wheel or a pinch. ⤢ fits the district again.
- **Click a green or orange zone** inside the gisda_03 frame to see its stats. To go back to the overview, press Esc, click ×, or click empty map.
- **Layers** (top right of the map): the green/grey grid, green zones and grey zones.

## Project structure

```
src/
  App.jsx               page layout, selected zone, layer switches, Esc key
  config.js             backend URL, basemap, map zoom limits
  data/frames.js        the GISTDA frames (corner lat/lng) and which one is ready
  data/districts.json   Don Mueang + neighbouring district boundaries (OpenStreetMap)
  api/data.js           loads and checks the NDVI grid and the zones (mock files or backend)
  hooks/useMapData.js   loading / error / retry state
  lib/geo.js            areas in km², frame corners → cell corners, the grey cover
  lib/grid.js           NDVI → green / grey / water cells, area per class
  lib/                  metrics (m² per person, status, tiers), formatting
  components/map/       Leaflet map, layer switches, legend
  components/sidebar/   overview, green zone and grey zone panels
  components/charts/    half pie gauge, cooling chart, factor bars, priority bar
  components/ui/        cards, badges, lists, loading and error states
public/mock/            mock data (examples of the API format)
docs/API.md             the data contract for the backend
```

## Mock data

- **Real data:** the district boundaries and land cover come from OpenStreetMap (© OpenStreetMap contributors, ODbL).
- **Simulated data:** the **NDVI values, temperatures, population and fitness scores** are simulated from that land cover. Grass, trees and fields give a high NDVI, while homes, roads and aprons give a low one. They are **not** THEOS-2 measurements, and the backend will replace them.
- **Mock result for gisda_03:** green 2.963 km², grey 5.906 km², water 0.110 km², with 16 green zones and 11 grey zones.

## Changing things

- **Rules:** the NDVI rule (0.3 for green, 0 for water), the 9 m² target and the priority tiers are in `src/lib/constants.js`.
- **Frames:** `src/data/frames.js`. Mark a frame `ready` once the backend serves its grid. The app currently loads the grid of `FOCUS_FRAME`.
- **Colors:** UI colors are in `src/index.css` (`@theme`), and data colors are in `src/lib/constants.js`.
- **Basemap:** the tile URL and attribution are in `src/config.js`.

## Credits

Map data and basemap tiles © OpenStreetMap contributors. The tiles come from `tile.openstreetmap.org` and need no API key, which is fine for development and demos. For heavy traffic, use a tile provider or host your own tiles (see the [tile usage policy](https://operations.osmfoundation.org/policies/tiles/)). The satellite data sources (THEOS-2 from GISTDA, Landsat 8/9 from USGS) are described in the project report.
````

---

### Task 12: Verify

- [ ] **Step 1: Run the full test suite and the build**

Run: `npm test && npm run build`
Expected: all test files pass. The build has no errors.

- [ ] **Step 2: Check in the browser (desktop)**

Start `greensight-dev` in the browser pane. Check each of these:
1. The map opens on Don Mueang. Dragging and zooming out stop near the district (maxBounds and minZoom work).
2. Everything outside Don Mueang has the slate grey cover, and the 6 neighbour districts have dashed outlines with "<name> · <Thai> / Update soon" labels.
3. The gisda_03 frame has a dark outline and the label "gisda_03 · 8.978 km²". gisda_01 has a dashed outline and an "Update soon" label.
4. The 30 × 30 grid is green and grey. Toggling "Green/grey grid" hides it.
5. Clicking a green zone opens the green panel, with its area in km². Clicking a grey zone opens the grey panel, with rank N of 11.
6. The overview shows the green %, green/grey/water km², 8.978 km² and 37.14 km², and "Update soon" for gisda_01 and gisda_02.
7. Esc, ×, and clicking empty map return to the overview. Reset view fits the district again. There are no console errors.

- [ ] **Step 3: Check the phone layout**

Use the mobile preset (375×812). The map should be on top, there should be no sideways scroll, and the labels should be readable. Reset to the desktop preset afterwards.
