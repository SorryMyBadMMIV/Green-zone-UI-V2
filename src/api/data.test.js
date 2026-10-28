import { describe, it, expect, vi, afterEach } from 'vitest';
import { districtDataUrl, fetchDistrictData, normalizeCollection, normalizeGaSites, normalizeGreenGroups, normalizeGrid } from './data.js';

const square = [[[100.5, 13.7], [100.51, 13.7], [100.51, 13.71], [100.5, 13.71], [100.5, 13.7]]];
const feature = (properties) => ({ type: 'Feature', geometry: { type: 'Polygon', coordinates: square }, properties });
const collection = (...features) => ({ type: 'FeatureCollection', features });
const respondWith = (json, status = 200) =>
  vi.fn().mockResolvedValue({ ok: status >= 200 && status < 300, status, json: async () => json });

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('districtDataUrl', () => {
  it('uses the example files bundled with the app when no backend URL is set', () => {
    expect(districtDataUrl('suan-luang', 'abandoned', '')).toMatch(/mock\/suan-luang\/abandoned\.geojson$/);
    expect(districtDataUrl('don-mueang', 'grid', '')).toMatch(/mock\/don-mueang\/grid\.json$/);
  });

  it('never points the example files at the site root, so the app works in any folder', () => {
    for (const url of [districtDataUrl('suan-luang', 'abandoned', ''), districtDataUrl('don-mueang', 'green-zones', '')]) {
      expect(url).not.toMatch(/^\/mock\//);
    }
  });

  it('uses the backend per district when a base URL is set', () => {
    expect(districtDataUrl('suan-luang', 'abandoned', 'http://api')).toBe('http://api/districts/suan-luang/abandoned');
  });

  it('names the missing example file', () => {
    expect(() => districtDataUrl('suan-luang', 'grid', '')).toThrow(/suan-luang\/grid/);
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

const point = (coordinates, properties) => ({ type: 'Feature', geometry: { type: 'Point', coordinates }, properties });
// One GA site and one green group, in the backend's own format (ga_parks.geojson, green_groups.geojson).
const gaSites = collection(
  point([100.5965, 13.7467], { zone: 'r0_c0', rank: 1, area_m2: 25991.5, x_m: 672614.66, y_m: 1520289.4, dist_nearest_official_m: 2287.7, zone_fitness: 1.4472, zone_k_max: 2 }),
);
const greenGroups = collection(
  point([100.6569, 13.7026], { cluster_id: 1, kind: 'group', radius_m: 381, patches_in_group: 34, patches_in_circle: 39, green_m2_in_group: 46489.8, green_m2_in_circle: 53648.8, noise_suppressed: false, role: 'center' }),
  feature({ cluster_id: 1, kind: 'group', radius_m: 381, role: 'group_circle' }),
);

describe('normalizeGaSites', () => {
  it("reads the backend's GA sites and gives each an id from its 1 km square and rank", () => {
    expect(normalizeGaSites(gaSites).features[0].properties).toEqual({
      id: 'r0_c0-1',
      zone: 'r0_c0',
      rank: 1,
      areaM2: 25991.5,
      distNearestOfficialM: 2287.7,
      zoneFitness: 1.4472,
      zoneKMax: 2,
    });
  });

  it('skips sites without a point, a square or a rank, and rejects data that is not a FeatureCollection', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const result = normalizeGaSites(collection(feature({ zone: 'r0_c0', rank: 2 }), point([100.6, 13.7], { rank: 3 })));
    expect(result.features).toHaveLength(0);
    expect(warn).toHaveBeenCalledTimes(2);
    expect(() => normalizeGaSites({ type: 'Feature' })).toThrow(/GA park site data is not a GeoJSON FeatureCollection/);
  });
});

describe('normalizeGreenGroups', () => {
  it('keeps the circle centres (the map draws the circles itself) and drops the circle polygons', () => {
    const { features } = normalizeGreenGroups(greenGroups);
    expect(features).toHaveLength(1);
    expect(features[0].geometry.coordinates).toEqual([100.6569, 13.7026]);
    expect(features[0].properties).toEqual({
      id: '1',
      kind: 'group',
      radiusM: 381,
      patchesInGroup: 34,
      patchesInCircle: 39,
      greenM2InGroup: 46489.8,
      greenM2InCircle: 53648.8,
    });
  });

  it('skips noise the backend suppressed and centres without a radius', () => {
    const { features } = normalizeGreenGroups(
      collection(
        point([100.6, 13.7], { cluster_id: 2, kind: 'isolated', radius_m: 50, noise_suppressed: true }),
        point([100.6, 13.7], { cluster_id: 3, kind: 'isolated', radius_m: null }),
      ),
    );
    expect(features).toHaveLength(0);
  });
});

describe('fetchDistrictData', () => {
  const suanLuang = { id: 'suan-luang', frame: { id: 'theosmain' }, data: { grid: false, greenZones: false, parkChecks: true, gaSites: true, greenGroups: true } };
  const donMueang = { id: 'don-mueang', frame: { id: 'gisda_03' }, data: { grid: true, greenZones: true, parkChecks: false } };
  const checks = { type: 'FeatureCollection', features: [{ type: 'Feature', geometry: { type: 'Point', coordinates: [100.65, 13.71] }, properties: { name: 'P', areaM2: 400, sizeClass: 'S', status: 'green_detected', greenM2: 894.5 } }] };

  it('loads the abandoned plots, park checks, GA sites and green groups for Suan Luang', async () => {
    const answers = { 'park-checks': checks, 'ga-sites': gaSites, 'green-groups': greenGroups };
    const fetchMock = vi.fn(async (url) => ({
      ok: true,
      status: 200,
      json: async () => answers[url.split('/').pop()] ?? collection(feature({ id: 'SL-001', landCover: 'overgrown', isExample: true })),
    }));
    vi.stubGlobal('fetch', fetchMock);
    const result = await fetchDistrictData(suanLuang, { baseUrl: 'http://api' });
    expect(fetchMock.mock.calls.map(([url]) => url).sort()).toEqual([
      'http://api/districts/suan-luang/abandoned',
      'http://api/districts/suan-luang/ga-sites',
      'http://api/districts/suan-luang/green-groups',
      'http://api/districts/suan-luang/park-checks',
    ]);
    expect(result.gaSites.features[0].properties.id).toBe('r0_c0-1');
    expect(result.greenGroups.features[0].properties.kind).toBe('group');
    expect(result.green).toBeNull();
    expect(result.grid).toBeNull();
    expect(result.grey.features[0].properties).toMatchObject({ id: 'SL-001', landCover: 'overgrown', isExample: true });
    expect(result.parkChecks.features[0].properties).toEqual({ name: 'P', areaM2: 400, sizeClass: 'S', status: 'green_detected', greenM2: 894.5 });
  });

  it('loads green zones, abandoned plots and the NDVI grid for Don Mueang', async () => {
    const fetchMock = vi.fn(async (url) => ({ ok: true, status: 200, json: async () => (url.endsWith('grid') ? { rows: 1, cols: 2, ndvi: [[0.2, 0.6]] } : collection(feature({ id: 'Z1', name: 'A' }))) }));
    vi.stubGlobal('fetch', fetchMock);
    const result = await fetchDistrictData(donMueang, { baseUrl: 'http://api' });
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(result.grid).toMatchObject({ frameId: 'gisda_03', ndvi: [[0.2, 0.6]] });
    expect(result.green.features).toHaveLength(1);
    expect(result.parkChecks).toBeNull();
    expect(result.gaSites).toBeNull();
    expect(result.greenGroups).toBeNull();
  });

  it('loads the bundled example files without a backend', async () => {
    const fetchMock = respondWith(collection(feature({ id: 'SL-001' })));
    const files = { 'park-checks': checks, 'ga-sites': gaSites, 'green-groups': greenGroups };
    const named = (url) => Object.keys(files).find((name) => url.includes(name));
    vi.stubGlobal('fetch', vi.fn(async (url) => (named(url) ? { ok: true, status: 200, json: async () => files[named(url)] } : fetchMock(url))));
    await fetchDistrictData(suanLuang, { baseUrl: '' });
    expect(fetchMock).toHaveBeenCalledWith(districtDataUrl('suan-luang', 'abandoned', ''));
  });

  it('throws on a non-2xx response', async () => {
    vi.stubGlobal('fetch', respondWith({}, 503));
    await expect(fetchDistrictData(donMueang, { baseUrl: 'http://api' })).rejects.toThrow(/HTTP 503/);
  });

  it('names the address when the request itself fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    await expect(fetchDistrictData(suanLuang, { baseUrl: 'http://api' })).rejects.toThrow(/http:\/\/api\/districts\/suan-luang\/.*Failed to fetch/);
  });

  it('names the address when the answer is not JSON (for example a web page)', async () => {
    const notJson = async () => {
      throw new SyntaxError("Unexpected token '<'");
    };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200, json: notJson }));
    await expect(fetchDistrictData(suanLuang, { baseUrl: 'http://api' })).rejects.toThrow(/http:\/\/api\/districts\/suan-luang\/.*not JSON/);
  });
});
