import { API_URL } from '../config.js';
import { DEFAULT_RADIUS_KM } from '../lib/constants.js';

// The example data in src/mock/, used while VITE_API_URL is empty. Vite bundles these files and hands
// out their URLs, so they load wherever the app is hosted (site root or any folder) and they travel
// with the source code.
const MOCK_FILES = import.meta.glob('../mock/**/*.{json,geojson}', { query: '?url', import: 'default', eager: true });

/**
 * Where one piece of a district's data lives ('grid' | 'green-zones' | 'abandoned' | 'park-checks'): the backend
 * when VITE_API_URL is set, otherwise the example file src/mock/<district>/<name>.json or .geojson.
 */
export function districtDataUrl(districtId, name, baseUrl = API_URL) {
  if (baseUrl) return `${baseUrl}/districts/${districtId}/${name}`;
  const url = MOCK_FILES[`../mock/${districtId}/${name}.json`] ?? MOCK_FILES[`../mock/${districtId}/${name}.geojson`];
  if (!url) throw new Error(`There is no example file for ${districtId}/${name} (src/mock/${districtId}/${name}.json or .geojson).`);
  return url;
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
    landCover: str(p.landCover),
    isExample: p.isExample === true,
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

// Every error names the address, so the message on the error card says exactly what failed.
async function getJson(url, signal) {
  let response;
  try {
    response = await fetch(url, { signal, headers: { Accept: 'application/geo+json, application/json' } });
  } catch (error) {
    if (signal?.aborted) throw error;
    throw new Error(`Couldn't reach ${url}: ${error.message}`, { cause: error });
  }
  if (!response.ok) throw new Error(`Loading ${url} failed with HTTP ${response.status}.`);
  try {
    return await response.json();
  } catch (error) {
    throw new Error(`${url} is not JSON (${error.message}).`, { cause: error });
  }
}

/** The backend's park-vs-satellite checks: Point features with name, area, size class, status and green found. */
export function normalizeChecks(json) {
  if (json?.type !== 'FeatureCollection' || !Array.isArray(json.features)) {
    throw new Error('The park check data is not a GeoJSON FeatureCollection.');
  }
  const features = json.features
    .filter((f) => f?.geometry?.type === 'Point' && str(f.properties?.name))
    .map((f) => ({
      type: 'Feature',
      geometry: f.geometry,
      properties: {
        name: f.properties.name,
        areaM2: num(f.properties.areaM2),
        sizeClass: str(f.properties.sizeClass),
        status: str(f.properties.status),
        greenM2: num(f.properties.greenM2),
      },
    }));
  return { type: 'FeatureCollection', features };
}

/**
 * Loads everything a district has: abandoned plots always; green zones, the NDVI grid and park checks when the
 * district provides them (district.data). Throws on network errors, non-2xx responses and bad data.
 */
export async function fetchDistrictData(district, { baseUrl = API_URL, signal } = {}) {
  const load = async (name) => getJson(districtDataUrl(district.id, name, baseUrl), signal);
  const [green, grey, grid, parkChecks] = await Promise.all([
    district.data.greenZones ? load('green-zones').then((json) => normalizeCollection(json, 'green')) : null,
    load('abandoned').then((json) => normalizeCollection(json, 'grey')),
    district.data.grid ? load('grid').then((json) => normalizeGrid(json, district.frame.id)) : null,
    district.data.parkChecks ? load('park-checks').then(normalizeChecks) : null,
  ]);
  return { green, grey, grid, parkChecks };
}
