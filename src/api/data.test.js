import { describe, it, expect, vi, afterEach } from 'vitest';
import { districtDataUrl, fetchDistrictData, normalizeCollection, normalizeGrid } from './data.js';

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

describe('fetchDistrictData', () => {
  const suanLuang = { id: 'suan-luang', frame: { id: 'theosmain' }, data: { grid: false, greenZones: false, parkChecks: true } };
  const donMueang = { id: 'don-mueang', frame: { id: 'gisda_03' }, data: { grid: true, greenZones: true, parkChecks: false } };
  const checks = { type: 'FeatureCollection', features: [{ type: 'Feature', geometry: { type: 'Point', coordinates: [100.65, 13.71] }, properties: { name: 'P', areaM2: 400, sizeClass: 'S', status: 'green_detected', greenM2: 894.5 } }] };

  it('loads only the abandoned plots and park checks for Suan Luang', async () => {
    const fetchMock = vi.fn(async (url) => ({ ok: true, status: 200, json: async () => (url.endsWith('park-checks') ? checks : collection(feature({ id: 'SL-001', landCover: 'overgrown', isExample: true }))) }));
    vi.stubGlobal('fetch', fetchMock);
    const result = await fetchDistrictData(suanLuang, { baseUrl: 'http://api' });
    expect(fetchMock.mock.calls.map(([url]) => url).sort()).toEqual(['http://api/districts/suan-luang/abandoned', 'http://api/districts/suan-luang/park-checks']);
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
  });

  it('loads the bundled example files without a backend', async () => {
    const fetchMock = respondWith(collection(feature({ id: 'SL-001' })));
    vi.stubGlobal('fetch', vi.fn(async (url) => (url.includes('park-checks') ? { ok: true, status: 200, json: async () => checks } : fetchMock(url))));
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
