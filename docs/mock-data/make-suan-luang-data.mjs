// One-off: build the Suan Luang data for the Green Lantern frontend.
// Usage (in the generator folder, see README.md): node make-suan-luang-data.mjs <project-root> <backend-root>
// Needs suan-luang-district-raw.json (fetch-district.mjs --name "Suan Luang District, Bangkok")
//   and suan-luang-frame-raw.json (fetch-frame-osm.mjs over the Theosmain frame + 0.005°)
//   and <project-root>/src/mock/suan-luang/frame.json (make-heatmaps.py).
// Writes:
//   src/data/districts/suan-luang.json         Suan Luang + neighbouring districts (real OSM boundaries)
//   src/mock/suan-luang/abandoned.geojson      EXAMPLE abandoned plots from OSM land use (not backend results)
//   src/mock/suan-luang/park-checks.geojson    the backend's park-vs-satellite checks (copied)
//   src/mock/suan-luang/summary.json           the backend's round-1 green summary (copied)
// The backend folder is only read.
import fs from 'node:fs';
import path from 'node:path';
import osmtogeojson from 'osmtogeojson';
import * as turf from '@turf/turf';

const [root, backend] = process.argv.slice(2);
if (!root || !backend) throw new Error('Usage: node make-suan-luang-data.mjs <project-root> <backend-root>');

const UPDATED = '2026-10-26';
const MIN_PLOT_M2 = 200;
const PAD = 0.03; // ≈3 km of neighbours around the district
const round6 = (c) => (typeof c[0] === 'number' ? [Math.round(c[0] * 1e6) / 1e6, Math.round(c[1] * 1e6) / 1e6] : c.map(round6));
const slug = (s) => s.toLowerCase().replace(/ district$/, '').replace(/[^a-z]+/g, '-').replace(/^-|-$/g, '');

function writeJson(file, value) {
  const out = path.join(root, file);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  const text = JSON.stringify(value) + '\n';
  fs.writeFileSync(out, text);
  console.log(`wrote ${file} (${(text.length / 1024).toFixed(1)} KB)`);
}

// ---- Districts ----
const districtRaw = JSON.parse(fs.readFileSync('suan-luang-district-raw.json', 'utf8'));
const districts = osmtogeojson(districtRaw).features.filter(
  (f) => f.properties.boundary === 'administrative' && f.properties.admin_level === '6' && /Polygon/.test(f.geometry.type),
);
const focusRaw = districts.find((f) => f.id === `relation/${districtRaw.focusRelation}`);
if (!focusRaw) throw new Error(`Focus relation ${districtRaw.focusRelation} not found`);
const [dw, ds, de, dn] = turf.bbox(focusRaw);
const viewBounds = [dw - PAD, ds - PAD, de + PAD, dn + PAD].map((v) => Math.round(v * 1e4) / 1e4);
function labelPoint(feature) {
  const c = turf.centerOfMass(feature);
  return turf.booleanPointInPolygon(c, feature) ? c : turf.pointOnFeature(feature);
}
const districtFeatures = districts.map((f) => {
  const focus = f.id === focusRaw.id;
  const shape = focus ? f : turf.simplify(turf.bboxClip(f, viewBounds), { tolerance: 0.0001, highQuality: true });
  return {
    type: 'Feature',
    properties: {
      id: slug(f.properties['name:en']),
      role: focus ? 'focus' : 'soon',
      nameEn: f.properties['name:en'].replace(/ District$/, ''),
      nameTh: f.properties.name.replace(/^(เขต|อำเภอ)/, ''),
      label: round6(labelPoint(shape).geometry.coordinates),
    },
    geometry: { type: shape.geometry.type, coordinates: round6(shape.geometry.coordinates) },
  };
});
writeJson('src/data/districts/suan-luang.json', {
  type: 'FeatureCollection',
  metadata: { note: 'District boundaries © OpenStreetMap contributors (ODbL). Neighbours are clipped to viewBounds [west, south, east, north].', viewBounds },
  features: districtFeatures,
});

// ---- Example abandoned plots ----
const frame = JSON.parse(fs.readFileSync(path.join(root, 'src/mock/suan-luang/frame.json'), 'utf8'));
const { topLeft: tl, topRight: tr, bottomLeft: bl, bottomRight: br } = frame.corners;
const frameShape = turf.polygon([[[tl[1], tl[0]], [bl[1], bl[0]], [br[1], br[0]], [tr[1], tr[0]], [tl[1], tl[0]]]]);
const area = turf.intersect(turf.featureCollection([focusRaw, frameShape]));

const COVER = (p) => {
  if (['brownfield', 'construction', 'greenfield', 'vacant'].includes(p.landuse)) return 'concrete or soil';
  if (p.natural === 'scrub' || p.landuse === 'meadow') return 'overgrown';
  return null;
};
// Land that is already in use for something else; a candidate inside it is dropped. landuse=residential is not on
// the list: in Bangkok it covers whole neighbourhoods, including real empty lots.
const TAKEN = (p) =>
  ['park', 'garden', 'pitch', 'playground', 'golf_course', 'sports_centre', 'stadium'].includes(p.leisure) ||
  ['school', 'university', 'college', 'place_of_worship', 'hospital'].includes(p.amenity) ||
  ['religious', 'military', 'cemetery'].includes(p.landuse);

// Some OSM shapes come back with unclosed rings (incomplete relations); they count as 'not inside'.
const safeInside = (point, shape) => {
  try {
    return turf.booleanPointInPolygon(point, shape);
  } catch {
    return false;
  }
};

const osm = osmtogeojson(JSON.parse(fs.readFileSync('suan-luang-frame-raw.json', 'utf8')));
const polygons = osm.features.filter((f) => /Polygon/.test(f.geometry?.type));
const taken = polygons.filter((f) => TAKEN(f.properties));
const tagCounts = {};
let candidates = [];
for (const f of polygons) {
  const cover = COVER(f.properties);
  if (!cover) continue;
  const key = f.properties.landuse ? `landuse=${f.properties.landuse}` : `natural=${f.properties.natural}`;
  tagCounts[key] = (tagCounts[key] ?? 0) + 1;
  let piece;
  try {
    piece = turf.intersect(turf.featureCollection([f, area]));
  } catch {
    continue;
  }
  if (!piece) continue;
  const m2 = turf.area(piece);
  if (m2 < MIN_PLOT_M2) continue;
  const inside = labelPoint(piece);
  if (taken.some((t) => safeInside(inside, t))) continue;
  candidates.push({ piece, m2, cover, tag: key, name: f.properties.name ?? null, inside });
}
// A smaller candidate that sits inside a larger one is the same land mapped twice.
candidates.sort((a, b) => b.m2 - a.m2);
candidates = candidates.filter((c, i) => !candidates.slice(0, i).some((big) => safeInside(c.inside, big.piece)));
console.log('tag counts in the frame:', JSON.stringify(tagCounts), `→ ${candidates.length} plots ≥ ${MIN_PLOT_M2} m²`);
if (candidates.length < 5) throw new Error(`Only ${candidates.length} plots; tag counts ${JSON.stringify(tagCounts)}`);

const plots = candidates.map((c, i) => {
  const simple = turf.simplify(c.piece, { tolerance: 0.00001, highQuality: true });
  return {
    type: 'Feature',
    properties: {
      id: `SL-${String(i + 1).padStart(3, '0')}`,
      district: 'Suan Luang',
      areaM2: Math.round(c.m2),
      landCover: c.cover,
      osmTag: c.tag,
      name: c.name,
      isExample: true,
      updatedAt: UPDATED,
    },
    geometry: { type: simple.geometry.type, coordinates: round6(simple.geometry.coordinates) },
  };
});
writeJson('src/mock/suan-luang/abandoned.geojson', {
  type: 'FeatureCollection',
  metadata: {
    note: 'EXAMPLE plots from OpenStreetMap land use (© OpenStreetMap contributors, ODbL), not backend detections. ' +
      'Replace with the backend\'s abandoned-land results when they exist.',
  },
  features: plots,
});

// ---- Backend copies ----
const marked = JSON.parse(fs.readFileSync(path.join(backend, 'Final_Results/Theosmain/parks/parks_marked.geojson'), 'utf8'));
writeJson('src/mock/suan-luang/park-checks.geojson', {
  type: 'FeatureCollection',
  metadata: { note: 'Copied from backend v3 Final_Results/Theosmain/parks/parks_marked.geojson (points only).' },
  features: marked.features
    .filter((f) => f.properties.role === 'park')
    .map((f) => ({
      type: 'Feature',
      geometry: f.geometry,
      properties: {
        name: f.properties.name,
        areaM2: f.properties.area_m2,
        sizeClass: f.properties.size_class,
        status: f.properties.status,
        greenM2: f.properties.green_m2_in_search_disc,
      },
    })),
});
writeJson('src/mock/suan-luang/summary.json', JSON.parse(fs.readFileSync(path.join(backend, 'Final_Results/Theosmain/round1/summary.json'), 'utf8')));
