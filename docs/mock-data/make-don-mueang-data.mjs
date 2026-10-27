// One-off: build the Don Mueang mock data for the GreenSight frontend (5 m grid).
// Usage: node make-don-mueang-data.mjs <project-root>
// Needs district-raw.json (fetch-district.mjs) and frame-raw.json (fetch-frame-osm.mjs).
// Writes:
//   src/data/districts/don-mueang.json  Don Mueang + neighbouring districts (real OSM boundaries)
//   src/mock/don-mueang/grid.json     600×600 NDVI values (≈5 m cells) of the gisda_03 frame (simulated)
//   src/mock/don-mueang/green-zones.geojson connected green cells (≥ MIN_GREEN_M2)
//   src/mock/don-mueang/abandoned.geojson  connected open-land grey cells (≥ MIN_SITE_M2), best MAX_SITES by fitness (example plots)
import fs from 'node:fs';
import path from 'node:path';
import osmtogeojson from 'osmtogeojson';
import * as turf from '@turf/turf';

const root = process.argv[2];
if (!root) throw new Error('Usage: node make-don-mueang-data.mjs <project-root>');

const UPDATED = '2026-10-15';
const NOTE =
  'Mock data for the GreenSight frontend. Boundaries, land cover, roads and buildings © OpenStreetMap contributors (ODbL). ' +
  'NDVI, temperature, population and fitness are simulated from OpenStreetMap land cover, not measured from THEOS-2.';

// gisda_03 corners from GISTDA, as [lat, lng] (same values as src/data/frames.js)
const FRAME = { tl: [13.9354055, 100.5798814], tr: [13.9352513, 100.6075171], dl: [13.90838144, 100.57964238], dr: [13.90820126, 100.60734273] };
const ROWS = 600; // fine grid: 600 × 600 cells of about 5 m
const COLS = 600;
const CELL_M = 5;
const COARSE = 30; // 100 m context grid (frame + MARGIN cells around) for "people nearby" and temperature around
const MARGIN = 10;
const BLOCK = ROWS / COARSE; // fine cells per coarse cell side (20)
const GREEN_NDVI = 0.3; // same threshold as the frontend (src/lib/constants.js)
const MIN_GREEN_M2 = 5000; // smallest green zone (0.5 ha)
const MIN_SITE_M2 = 2000; // smallest candidate site
const MAX_SITES = 20; // keep the best candidate sites by fitness
const MIN_HOLE_CELLS = 25; // holes smaller than this are left out of zone outlines

// ---------------------------------------------------------------------------------------------
// Helpers
const lerp = (a, b, t) => a + (b - a) * t;
const round = (n, d) => Math.round(n * 10 ** d) / 10 ** d;
const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));
const mean = (list) => list.reduce((a, b) => a + b, 0) / list.length;
const ease = (t) => t * t * (3 - 2 * t);

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

/** Smooth value noise in [-1, 1] with features about `scale` cells across (grid rows/cols from 0). */
function valueNoise(scale, offset = 0) {
  const n = Math.ceil((Math.max(ROWS, COLS) + 2 * offset) / scale) + 2;
  const lattice = Array.from({ length: n }, () => Float32Array.from({ length: n }, jitter));
  return (r, c) => {
    const x = (c + offset) / scale;
    const y = (r + offset) / scale;
    const x0 = Math.floor(x);
    const y0 = Math.floor(y);
    const fx = ease(x - x0);
    const fy = ease(y - y0);
    return lerp(lerp(lattice[y0][x0], lattice[y0][x0 + 1], fx), lerp(lattice[y0 + 1][x0], lattice[y0 + 1][x0 + 1], fx), fy);
  };
}

// Frame corners as [lng, lat]
const LL = { tl: [FRAME.tl[1], FRAME.tl[0]], tr: [FRAME.tr[1], FRAME.tr[0]], bl: [FRAME.dl[1], FRAME.dl[0]], br: [FRAME.dr[1], FRAME.dr[0]] };
/** Bilinear position inside the frame: u 0→1 left→right, v 0→1 top→bottom. Returns [lng, lat]. */
function at(u, v) {
  const w00 = (1 - u) * (1 - v);
  const w10 = u * (1 - v);
  const w01 = (1 - u) * v;
  const w11 = u * v;
  return [
    w00 * LL.tl[0] + w10 * LL.tr[0] + w01 * LL.bl[0] + w11 * LL.br[0],
    w00 * LL.tl[1] + w10 * LL.tr[1] + w01 * LL.bl[1] + w11 * LL.br[1],
  ];
}
/** Inverse of at(): [lng, lat] → [u, v], by Newton's method on the bilinear map. */
function toUV([lng, lat]) {
  let u = 0.5;
  let v = 0.5;
  for (let k = 0; k < 6; k++) {
    const [x, y] = at(u, v);
    const fx = x - lng;
    const fy = y - lat;
    const xu = (1 - v) * (LL.tr[0] - LL.tl[0]) + v * (LL.br[0] - LL.bl[0]);
    const yu = (1 - v) * (LL.tr[1] - LL.tl[1]) + v * (LL.br[1] - LL.bl[1]);
    const xv = (1 - u) * (LL.bl[0] - LL.tl[0]) + u * (LL.br[0] - LL.tr[0]);
    const yv = (1 - u) * (LL.bl[1] - LL.tl[1]) + u * (LL.br[1] - LL.tr[1]);
    const det = xu * yv - xv * yu;
    u -= (fx * yv - fy * xv) / det;
    v -= (xu * fy - yu * fx) / det;
  }
  return [u, v];
}
/** [lng, lat] → fine-grid coordinates [x, y] (cell (r, c) covers x in [c, c+1), y in [r, r+1)). */
const toGrid = (lngLat) => {
  const [u, v] = toUV(lngLat);
  return [u * COLS, v * ROWS];
};

const M_PER_DEG_LAT = 110600;
const kx = 111320 * Math.cos((FRAME.tl[0] * Math.PI) / 180);
const toXY = ([lng, lat]) => [(lng - LL.tl[0]) * kx, (lat - LL.tl[1]) * M_PER_DEG_LAT];
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const round6 = (c) => (typeof c[0] === 'number' ? [round(c[0], 6), round(c[1], 6)] : c.map(round6));

// Same spherical area formula and radius as the frontend (src/lib/geo.js) and turf.js.
const EARTH_RADIUS_M = 6371008.8;
const rad = (d) => (d * Math.PI) / 180;
function ringAreaM2(ring) {
  let total = 0;
  for (let i = 0; i < ring.length - 1; i++) {
    total += rad(ring[i + 1][0] - ring[i][0]) * (2 + Math.sin(rad(ring[i][1])) + Math.sin(rad(ring[i + 1][1])));
  }
  return Math.abs((total * EARTH_RADIUS_M * EARTH_RADIUS_M) / 2);
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
// Land cover kinds: priority (higher wins where shapes overlap), simulated NDVI base and variation
const KINDS = {
  open: { prio: 0, base: 0.24, big: 0.1, small: 0.15, group: 'open' },
  residential: { prio: 1, base: 0.19, big: 0.08, small: 0.14, group: 'residential' },
  institutional: { prio: 2, base: 0.2, big: 0.06, small: 0.12, group: 'institutional' },
  vacant: { prio: 3, base: 0.2, big: 0.08, small: 0.1, group: 'vacant' },
  military: { prio: 4, base: 0.42, big: 0.08, small: 0.12, group: 'military' },
  airfield: { prio: 5, base: 0.5, big: 0.06, small: 0.08, group: 'airfield' },
  grass: { prio: 6, base: 0.58, big: 0.05, small: 0.08, group: 'vegetation' },
  park: { prio: 6, base: 0.62, big: 0.05, small: 0.08, group: 'vegetation' },
  wetland: { prio: 6, base: 0.52, big: 0.05, small: 0.08, group: 'vegetation' },
  golf: { prio: 6, base: 0.66, big: 0.04, small: 0.06, group: 'vegetation' },
  trees: { prio: 6, base: 0.7, big: 0.04, small: 0.06, group: 'vegetation' },
  building: { prio: 7, base: 0.05, big: 0.02, small: 0.02, group: 'building' },
  paved: { prio: 8, base: 0.08, big: 0.02, small: 0.03, group: 'paved' },
  water: { prio: 9, base: -0.08, big: 0, small: 0.02, group: 'water' },
};
const KIND_NAMES = Object.keys(KINDS);
const KIND = Object.fromEntries(KIND_NAMES.map((name, i) => [name, i]));
const PRIO = Uint8Array.from(KIND_NAMES.map((name) => KINDS[name].prio));

function polygonKind(p) {
  if (p.building) return 'building';
  if (p.natural === 'water' || p.water || ['reservoir', 'basin'].includes(p.landuse) || p.waterway === 'riverbank') return 'water';
  if (['apron', 'runway', 'taxiway', 'terminal', 'hangar'].includes(p.aeroway) || p.amenity === 'parking' || p.landuse === 'railway' || p.highway) return 'paved';
  if (p.leisure === 'golf_course') return 'golf';
  if (['park', 'garden', 'dog_park'].includes(p.leisure)) return 'park';
  if (p.natural === 'wetland') return 'wetland';
  if (['wood', 'scrub'].includes(p.natural) || ['forest', 'orchard', 'plant_nursery'].includes(p.landuse) || p.landcover === 'trees') return 'trees';
  if (['grass', 'meadow', 'village_green', 'recreation_ground', 'cemetery'].includes(p.landuse) || ['grassland', 'heath'].includes(p.natural) || p.landcover === 'grass' || p.leisure === 'pitch') return 'grass';
  if (p.aeroway === 'aerodrome') return 'airfield';
  if (p.landuse === 'military') return 'military';
  if (['construction', 'brownfield', 'greenfield'].includes(p.landuse)) return 'vacant';
  if (p.landuse === 'residential') return 'residential';
  if (['commercial', 'retail', 'industrial'].includes(p.landuse) || ['school', 'college', 'university', 'hospital', 'place_of_worship', 'marketplace'].includes(p.amenity)) return 'institutional';
  return null;
}

// Line features drawn as strips of their real width (m)
const ROAD_WIDTH = { motorway: 24, trunk: 20, primary: 16, secondary: 12, tertiary: 10, unclassified: 7, residential: 7, living_street: 6, service: 5, pedestrian: 5 };
function lineKind(p) {
  if (p.aeroway === 'runway') return ['paved', 45];
  if (p.aeroway === 'taxiway') return ['paved', 23];
  if (p.railway === 'rail') return ['paved', 6];
  if (p.waterway === 'canal') return ['water', 12];
  if (p.waterway === 'river') return ['water', 30];
  if (p.waterway === 'stream' || p.waterway === 'drain') return ['water', 4];
  const road = p.highway?.replace(/_link$/, '');
  if (road && ROAD_WIDTH[road]) return ['paved', p.highway.endsWith('_link') ? 8 : ROAD_WIDTH[road]];
  return null;
}

// ---------------------------------------------------------------------------------------------
// Rasterise OpenStreetMap shapes onto the fine grid
const N_CELLS = ROWS * COLS;
const kind = new Uint8Array(N_CELLS); // KIND index per cell, 0 = open land

function setKind(r, c, k) {
  const i = r * COLS + c;
  if (PRIO[k] >= PRIO[kind[i]]) kind[i] = k;
}

/** Fills polygon rings (grid coordinates, even-odd rule) into every cell whose center is inside. */
function fillPolygon(rings, k) {
  let minY = Infinity;
  let maxY = -Infinity;
  for (const ring of rings) for (const [, y] of ring) [minY, maxY] = [Math.min(minY, y), Math.max(maxY, y)];
  const r0 = Math.max(0, Math.floor(minY - 0.5));
  const r1 = Math.min(ROWS - 1, Math.ceil(maxY - 0.5));
  for (let r = r0; r <= r1; r++) {
    const y = r + 0.5;
    const xs = [];
    for (const ring of rings) {
      for (let i = 0; i < ring.length - 1; i++) {
        const [x1, y1] = ring[i];
        const [x2, y2] = ring[i + 1];
        if ((y1 <= y && y2 > y) || (y2 <= y && y1 > y)) xs.push(x1 + ((y - y1) / (y2 - y1)) * (x2 - x1));
      }
    }
    xs.sort((a, b) => a - b);
    for (let j = 0; j + 1 < xs.length; j += 2) {
      const c0 = Math.max(0, Math.ceil(xs[j] - 0.5));
      const c1 = Math.min(COLS - 1, Math.floor(xs[j + 1] - 0.5));
      for (let c = c0; c <= c1; c++) setKind(r, c, k);
    }
  }
}

/** Marks every cell whose center is within `half` cells of the polyline (grid coordinates). */
function strokeLine(points, half, k) {
  for (let i = 0; i < points.length - 1; i++) {
    const [ax, ay] = points[i];
    const [bx, by] = points[i + 1];
    const r0 = Math.max(0, Math.floor(Math.min(ay, by) - half - 0.5));
    const r1 = Math.min(ROWS - 1, Math.ceil(Math.max(ay, by) + half - 0.5));
    const c0 = Math.max(0, Math.floor(Math.min(ax, bx) - half - 0.5));
    const c1 = Math.min(COLS - 1, Math.ceil(Math.max(ax, bx) + half - 0.5));
    const dx = bx - ax;
    const dy = by - ay;
    const len2 = dx * dx + dy * dy || 1;
    for (let r = r0; r <= r1; r++) {
      for (let c = c0; c <= c1; c++) {
        const px = c + 0.5;
        const py = r + 0.5;
        const t = clamp(((px - ax) * dx + (py - ay) * dy) / len2, 0, 1);
        if (Math.hypot(px - (ax + t * dx), py - (ay + t * dy)) <= half) setKind(r, c, k);
      }
    }
  }
}

const osm = osmtogeojson(JSON.parse(fs.readFileSync('frame-raw.json', 'utf8')));
const [fw, fs_, fe, fn] = turf.bbox(turf.polygon([[LL.tl, LL.bl, LL.br, LL.tr, LL.tl]]));
const touchesFrame = (f) => {
  const [w, s, e, n] = turf.bbox(f);
  return e >= fw && w <= fe && n >= fs_ && s <= fn;
};
const coverPolys = []; // for sampling the coarse context grid outside the frame
const majorRoads = [];
for (const f of osm.features) {
  const p = f.properties;
  const g = f.geometry;
  if (/LineString/.test(g.type)) {
    if (/^(motorway|trunk|primary|secondary)(_link)?$/.test(p.highway)) majorRoads.push(f);
    const lk = lineKind(p);
    if (lk && touchesFrame(f)) {
      const lines = g.type === 'LineString' ? [g.coordinates] : g.coordinates;
      for (const line of lines) strokeLine(line.map(toGrid), lk[1] / 2 / CELL_M, KIND[lk[0]]);
    }
    continue;
  }
  if (!/Polygon/.test(g.type)) continue;
  const pk = polygonKind(p);
  if (!pk) continue;
  if (pk !== 'building') coverPolys.push({ f, kind: pk, name: p.name, nameEn: p['name:en'], bbox: turf.bbox(f) });
  if (!touchesFrame(f)) continue;
  const polygons = g.type === 'Polygon' ? [g.coordinates] : g.coordinates;
  for (const polygon of polygons) fillPolygon(polygon.map((ring) => ring.map(toGrid)), KIND[pk]);
}

// ---------------------------------------------------------------------------------------------
// Simulated NDVI and land surface temperature per fine cell
const bigNoise = valueNoise(40); // ≈200 m patches
const smallNoise = valueNoise(5); // ≈25 m patches (gardens, groups of trees)
const ndvi = new Float32Array(N_CELLS);
const lst = new Float32Array(N_CELLS);
const cls = new Uint8Array(N_CELLS); // 1 water, 2 grey, 3 green
for (let r = 0; r < ROWS; r++) {
  for (let c = 0; c < COLS; c++) {
    const i = r * COLS + c;
    const k = KINDS[KIND_NAMES[kind[i]]];
    if (k.group === 'water') {
      ndvi[i] = round(clamp(k.base + 0.04 * jitter(), -0.15, -0.03), 2);
      lst[i] = 30.8 + 0.4 * jitter();
    } else {
      ndvi[i] = round(clamp(k.base + k.big * bigNoise(r, c) + k.small * smallNoise(r, c) + 0.03 * jitter(), 0.02, 0.88), 2);
      lst[i] = 39.2 - 8.5 * ndvi[i] + 0.4 * jitter();
    }
    cls[i] = ndvi[i] < 0 ? 1 : ndvi[i] >= GREEN_NDVI ? 3 : 2;
  }
}

// Fine cell areas from the cell corner lattice (same bilinear split as the frontend)
const lattice = [];
for (let r = 0; r <= ROWS; r++) for (let c = 0; c <= COLS; c++) lattice.push(at(c / COLS, r / ROWS));
const corner = (r, c) => lattice[r * (COLS + 1) + c];
const cellArea = new Float64Array(N_CELLS);
for (let r = 0; r < ROWS; r++) {
  for (let c = 0; c < COLS; c++) {
    cellArea[r * COLS + c] = ringAreaM2([corner(r, c), corner(r + 1, c), corner(r + 1, c + 1), corner(r, c + 1), corner(r, c)]);
  }
}
const cellXY = (i) => {
  const r = Math.floor(i / COLS);
  const c = i - r * COLS;
  return toXY(at((c + 0.5) / COLS, (r + 0.5) / ROWS));
};

// ---------------------------------------------------------------------------------------------
// Coarse 100 m context grid (frame + 1 km) for people and surrounding temperature
const PEOPLE = { residential: 120, institutional: 20, open: 30, vacant: 5, military: 8 };
const coarse = [];
for (let R = -MARGIN; R < COARSE + MARGIN; R++) {
  for (let C = -MARGIN; C < COARSE + MARGIN; C++) {
    const center = at((C + 0.5) / COARSE, (R + 0.5) / COARSE);
    const inFrame = R >= 0 && R < COARSE && C >= 0 && C < COARSE;
    let group;
    let cellNdvi;
    let cellLst;
    if (inFrame) {
      // Aggregate the 20 × 20 fine cells
      const counts = {};
      let sumN = 0;
      let sumT = 0;
      let land = 0;
      for (let r = R * BLOCK; r < (R + 1) * BLOCK; r++) {
        for (let c = C * BLOCK; c < (C + 1) * BLOCK; c++) {
          const i = r * COLS + c;
          const g = KINDS[KIND_NAMES[kind[i]]].group;
          counts[g] = (counts[g] ?? 0) + 1;
          sumN += ndvi[i];
          if (cls[i] !== 1) {
            sumT += lst[i];
            land += 1;
          }
        }
      }
      group = Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
      cellNdvi = sumN / (BLOCK * BLOCK);
      cellLst = land ? sumT / land : 30.8;
    } else {
      let best = null;
      for (const poly of coverPolys) {
        const [w, s, e, n] = poly.bbox;
        if (center[0] < w || center[0] > e || center[1] < s || center[1] > n) continue;
        if (!turf.booleanPointInPolygon(center, poly.f)) continue;
        if (!best || PRIO[KIND[poly.kind]] > PRIO[KIND[best.kind]]) best = poly;
      }
      const k = KINDS[best?.kind ?? 'open'];
      group = k.group;
      cellNdvi = group === 'water' ? -0.08 : clamp(k.base + k.big * jitter(), 0.02, 0.88);
      cellLst = group === 'water' ? 30.8 : 39.2 - 8.5 * cellNdvi + 0.4 * jitter();
    }
    coarse.push({
      R, C, inFrame, xy: toXY(center), water: group === 'water',
      lst: cellLst, people: Math.round((PEOPLE[group] ?? 0) * (0.8 + 0.4 * rand())),
    });
  }
}
const coarseOf = (i) => {
  const r = Math.floor(i / COLS);
  return Math.floor(r / BLOCK) * 1000 + Math.floor((i - r * COLS) / BLOCK);
};

/** People within 1 km and mean temperature around a zone, from its 100 m footprint. */
function surroundings(cells) {
  const footprint = new Set(cells.map(coarseOf));
  const inside = coarse.filter((k) => k.inFrame && footprint.has(k.R * 1000 + k.C));
  const near = coarse.filter((k) => !inside.includes(k) && inside.some((f) => dist(f.xy, k.xy) <= 1000));
  return {
    people: [...near, ...inside].reduce((sum, k) => sum + k.people, 0),
    lstAround: round(mean(near.filter((k) => !k.water).map((k) => k.lst)), 1),
  };
}

// ---------------------------------------------------------------------------------------------
// Connected components (4-neighbours) on the fine grid
function components(test) {
  const seen = new Uint8Array(N_CELLS);
  const stack = new Int32Array(N_CELLS);
  const out = [];
  for (let start = 0; start < N_CELLS; start++) {
    if (seen[start] || !test(start)) continue;
    const cells = [];
    let top = 0;
    stack[top++] = start;
    seen[start] = 1;
    while (top) {
      const i = stack[--top];
      cells.push(i);
      const r = Math.floor(i / COLS);
      const c = i - r * COLS;
      const visit = (j) => {
        if (!seen[j] && test(j)) {
          seen[j] = 1;
          stack[top++] = j;
        }
      };
      if (r > 0) visit(i - COLS);
      if (r < ROWS - 1) visit(i + COLS);
      if (c > 0) visit(i - 1);
      if (c < COLS - 1) visit(i + 1);
    }
    out.push(cells);
  }
  return out;
}
const areaOf = (cells) => cells.reduce((sum, i) => sum + cellArea[i], 0);

/**
 * Outline of a set of cells as a GeoJSON Polygon / MultiPolygon: follow the cell edges between
 * inside and outside (interior kept on the right), then smooth the staircase a little.
 */
function outline(cells) {
  let r0 = ROWS;
  let r1 = 0;
  let c0 = COLS;
  let c1 = 0;
  for (const i of cells) {
    const r = Math.floor(i / COLS);
    const c = i - r * COLS;
    [r0, r1, c0, c1] = [Math.min(r0, r), Math.max(r1, r), Math.min(c0, c), Math.max(c1, c)];
  }
  const w = c1 - c0 + 1;
  const h = r1 - r0 + 1;
  const mask = new Uint8Array(w * h);
  for (const i of cells) {
    const r = Math.floor(i / COLS);
    mask[(r - r0) * w + (i - r * COLS - c0)] = 1;
  }
  const inside = (x, y) => x >= 0 && y >= 0 && x < w && y < h && mask[y * w + x] === 1;
  const edges = new Map();
  const add = (x1, y1, x2, y2) => {
    const key = x1 * 100000 + y1;
    if (!edges.has(key)) edges.set(key, []);
    edges.get(key).push([x2, y2]);
  };
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!mask[y * w + x]) continue;
      if (!inside(x, y - 1)) add(x, y, x + 1, y);
      if (!inside(x + 1, y)) add(x + 1, y, x + 1, y + 1);
      if (!inside(x, y + 1)) add(x + 1, y + 1, x, y + 1);
      if (!inside(x - 1, y)) add(x, y + 1, x, y);
    }
  }
  const rings = [];
  for (const [key, outs] of edges) {
    while (outs.length) {
      const sx = Math.floor(key / 100000);
      const sy = key - sx * 100000;
      let [px, py] = [sx, sy];
      let [nx, ny] = outs.pop();
      const ring = [[px, py]];
      while (nx !== sx || ny !== sy) {
        const dx = nx - px;
        const dy = ny - py;
        const next = edges.get(nx * 100000 + ny);
        // At a corner where two cells touch diagonally, turn right (towards the interior).
        let pick = 0;
        if (next.length > 1) {
          const turn = ([qx, qy]) => dx * (qy - ny) - dy * (qx - nx);
          pick = next.reduce((best, q, j) => (turn(q) > turn(next[best]) ? j : best), 0);
        }
        if (dx !== next[pick][0] - nx || dy !== next[pick][1] - ny) ring.push([nx, ny]);
        [px, py] = [nx, ny];
        [nx, ny] = next.splice(pick, 1)[0];
      }
      rings.push(ring);
    }
  }
  const shoelace = (ring) => ring.reduce((sum, [x, y], j) => {
    const [x2, y2] = ring[(j + 1) % ring.length];
    return sum + x * y2 - x2 * y;
  }, 0) / 2;
  const toLngLat = ([x, y]) => at((x + c0) / COLS, (y + r0) / ROWS);
  const close = (ring) => [...ring, ring[0]].map(toLngLat);
  const outers = rings.filter((ring) => shoelace(ring) > 0).sort((a, b) => shoelace(b) - shoelace(a));
  const holes = rings.filter((ring) => -shoelace(ring) >= MIN_HOLE_CELLS);
  const polygons = outers.map((ring) => [close(ring)]);
  for (const hole of holes) {
    const [hx, hy] = hole[0];
    const owner = outers.findIndex((ring) => turf.booleanPointInPolygon([hx + 0.25, hy + 0.25], turf.polygon([[...ring, ring[0]]])));
    if (owner >= 0) polygons[owner].push(close(hole));
  }
  const geometry = polygons.length === 1 ? { type: 'Polygon', coordinates: polygons[0] } : { type: 'MultiPolygon', coordinates: polygons };
  const simple = turf.simplify({ type: 'Feature', properties: {}, geometry }, { tolerance: 0.00003, highQuality: true });
  return { type: simple.geometry.type, coordinates: round6(simple.geometry.coordinates) };
}

// ---------------------------------------------------------------------------------------------
// Green zones: connected green cells
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
const dominantKind = (cells) => {
  const counts = new Map();
  for (const i of cells) counts.set(kind[i], (counts.get(kind[i]) ?? 0) + 1);
  return KIND_NAMES[[...counts].sort((a, b) => b[1] - a[1])[0][0]];
};

const greenComps = components((i) => cls[i] === 3)
  .map((cells) => ({ cells, area: areaOf(cells) }))
  .filter((z) => z.area >= MIN_GREEN_M2)
  .sort((a, b) => b.area - a.area);
const typeCounter = new Map();
const greenZones = greenComps.map((z, idx) => {
  const kindName = dominantKind(z.cells);
  const [typeEn, typeTh] = GREEN_TYPES[kindName] ?? GREEN_TYPES.open;
  const n = (typeCounter.get(typeEn) ?? 0) + 1;
  typeCounter.set(typeEn, n);
  const around = surroundings(z.cells);
  return {
    ...z,
    feature: {
      type: 'Feature',
      properties: {
        id: `GZ-${String(idx + 1).padStart(3, '0')}`,
        frameId: 'gisda_03',
        name: `${typeEn} ${n}`,
        nameTh: `${typeTh} ${n}`,
        type: typeEn,
        district: 'Don Mueang',
        areaM2: Math.round(z.area),
        cells: z.cells.length,
        populationNearby: Math.round(around.people / 100) * 100,
        nearbyRadiusKm: 1,
        ndvi: round(mean(z.cells.map((i) => ndvi[i])), 2),
        tempInsideC: round(mean(z.cells.map((i) => lst[i])), 1),
        tempAroundC: around.lstAround,
        updatedAt: UPDATED,
      },
      geometry: outline(z.cells),
    },
  };
});

// Grey zones: connected open-land grey cells (not homes, buildings, roads, airport, water) = candidate sites.
// Each factor is measured per site, min-max normalised to 0–1 across the sites (report §3.4), then weighted.
const OPEN_KINDS = new Set([KIND.open, KIND.vacant]);
const greenZoneXY = greenZones.flatMap((z) => z.cells.filter((_, j) => j % 4 === 0).map((i) => ({ zone: z, xy: cellXY(i) })));
const siteComps = components((i) => cls[i] === 2 && OPEN_KINDS.has(kind[i]))
  .map((cells) => ({ cells, area: areaOf(cells) }))
  .filter((s) => s.area >= MIN_SITE_M2)
  .map((s) => {
    const xy = [mean(s.cells.map((i) => cellXY(i)[0])), mean(s.cells.map((i) => cellXY(i)[1]))];
    const centerLngLat = [LL.tl[0] + xy[0] / kx, LL.tl[1] + xy[1] / M_PER_DEG_LAT];
    let nearest = null;
    for (const g of greenZoneXY) {
      const d = dist(xy, g.xy);
      if (!nearest || d < nearest.d) nearest = { zone: g.zone, d };
    }
    return {
      ...s,
      nearest,
      toRoad: majorRoads.length ? Math.min(...majorRoads.map((road) => turf.pointToLineDistance(centerLngLat, road, { units: 'meters' }))) : 5000,
      lst: mean(s.cells.map((i) => lst[i])),
      radius: Math.sqrt(s.area / Math.PI),
    };
  });
const normaliser = (get) => {
  const values = siteComps.map(get);
  const [lo, hi] = [Math.min(...values), Math.max(...values)];
  return (v) => (hi === lo ? 0.5 : (v - lo) / (hi - lo));
};
const normGreen = normaliser((s) => s.nearest?.d ?? 0); // far from green = high
const normRoad = normaliser((s) => s.toRoad); // near a road = high (inverted below)
const normHeat = normaliser((s) => s.lst); // hot = high
const WEIGHTS = { gad: 0.4, air: 0.3, heat: 0.3 };

const greyZones = siteComps
  .map((s) => {
    const gad = normGreen(s.nearest?.d ?? 0);
    const air = 1 - normRoad(s.toRoad);
    const heat = normHeat(s.lst);
    const penalty = s.area < 5000 ? 0.05 : 0;
    const fitness = round(clamp(WEIGHTS.gad * gad + WEIGHTS.air * air + WEIGHTS.heat * heat - penalty, 0, 1), 2);
    return { ...s, fitness, gad, air, heat, penalty };
  })
  .sort((a, b) => b.fitness - a.fitness || b.area - a.area)
  .slice(0, MAX_SITES)
  .map((s, idx) => {
    const score = (v) => 1 + Math.round(4 * v);
    const around = surroundings(s.cells);
    return {
      type: 'Feature',
      properties: {
        id: `G-${String(idx + 1).padStart(3, '0')}`,
        rank: idx + 1,
        frameId: 'gisda_03',
        district: 'Don Mueang',
        areaM2: Math.round(s.area),
        cells: s.cells.length,
        populationNearby: Math.round(around.people / 100) * 100,
        nearbyRadiusKm: 1,
        fitness: s.fitness,
        scores: { greenAccessDeficit: score(s.gad), airProximity: score(s.air), heatSeverity: score(s.heat) },
        penalty: s.penalty,
        ndvi: round(mean(s.cells.map((i) => ndvi[i])), 2),
        surfaceTempC: round(s.lst, 1),
        nearestGreenZone: s.nearest
          ? {
              id: s.nearest.zone.feature.properties.id,
              name: s.nearest.zone.feature.properties.name,
              distanceKm: round(Math.max(s.nearest.d - s.radius, 0) / 1000, 1),
            }
          : null,
        updatedAt: UPDATED,
        isExample: true,
      },
      geometry: outline(s.cells),
    };
  });

// ---------------------------------------------------------------------------------------------
// Write files
function writeText(file, text, what) {
  const out = path.join(root, file);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, text);
  console.log(`wrote ${file} (${what}, ${(text.length / 1024).toFixed(1)} KB)`);
}
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

const districtsDoc = {
  type: 'FeatureCollection',
  metadata: { note: 'District boundaries © OpenStreetMap contributors (ODbL). Neighbours are clipped to viewBounds [west, south, east, north].', viewBounds },
  features: districtsOut,
};
writeText('src/data/districts/don-mueang.json', JSON.stringify(districtsDoc) + '\n', `${districtsOut.length} districts`);

const rowsText = [];
for (let r = 0; r < ROWS; r++) rowsText.push(`[${Array.from(ndvi.subarray(r * COLS, (r + 1) * COLS), (v) => round(v, 2)).join(',')}]`);
const gridText =
  `{\n  "frameId": "gisda_03",\n  "rows": ${ROWS},\n  "cols": ${COLS},\n  "cellSizeM": ${CELL_M},\n` +
  `  "metadata": ${JSON.stringify({ note: NOTE, order: 'ndvi[row][col], row 0 = top (north) edge, col 0 = left (west) edge' })},\n` +
  `  "ndvi": [\n${rowsText.join(',\n')}\n  ]\n}\n`;
JSON.parse(gridText);
writeText('src/mock/don-mueang/grid.json', gridText, `${ROWS}×${COLS} cells`);
writeCollection('src/mock/don-mueang/green-zones.geojson', greenZones.map((z) => z.feature));
writeCollection('src/mock/don-mueang/abandoned.geojson', greyZones);

// ---------------------------------------------------------------------------------------------
// Summary
const byClass = (code) => {
  let sum = 0;
  for (let i = 0; i < N_CELLS; i++) if (cls[i] === code) sum += cellArea[i];
  return sum / 1e6;
};
const kindCounts = {};
for (let i = 0; i < N_CELLS; i++) kindCounts[KIND_NAMES[kind[i]]] = (kindCounts[KIND_NAMES[kind[i]]] ?? 0) + 1;
console.log(`frame: green ${byClass(3).toFixed(3)} km², grey ${byClass(2).toFixed(3)} km², water ${byClass(1).toFixed(3)} km²`);
console.log('kinds (cells):', JSON.stringify(kindCounts));
console.log(`green zones: ${greenZones.length} (all green components ≥ ${MIN_GREEN_M2} m²)`);
for (const z of greenZones) {
  const p = z.feature.properties;
  console.log(`  ${p.id} ${p.name.padEnd(30)} ${String(p.areaM2).padStart(8)} m² ${(p.areaM2 / p.populationNearby).toFixed(1).padStart(6)} m²/person ${p.tempInsideC}/${p.tempAroundC}°C`);
}
console.log(`grey zones: ${greyZones.length} of ${siteComps.length} candidate sites ≥ ${MIN_SITE_M2} m²`);
for (const z of greyZones) {
  const p = z.properties;
  console.log(`  ${p.id} fitness ${p.fitness} scores ${Object.values(p.scores).join('/')} area ${p.areaM2} m² people ${p.populationNearby} nearest ${p.nearestGreenZone?.id} ${p.nearestGreenZone?.distanceKm} km`);
}
