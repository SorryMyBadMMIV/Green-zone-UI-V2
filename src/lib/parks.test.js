import { describe, it, expect } from 'vitest';
import { loadParks, parksReaching, sizeClass } from './parks.js';

const point = (id, lng, lat, areaM2) => ({
  type: 'Feature',
  geometry: { type: 'Point', coordinates: [lng, lat] },
  properties: { id, name: `Park ${id}`, districtTh: 'สวนหลวง', areaM2, owner: null, kind: null, lists: ['accessible'] },
});

describe('sizeClass', () => {
  it.each([
    [0, 'S', 500],
    [50, 'S', 500],
    [16000, 'S', 500],
    [16001, 'M', 1000],
    [80000, 'M', 1000],
    [80001, 'L', 3000],
    [160000, 'L', 3000],
    [160001, 'XL', 5000],
    [800000, 'XL', 5000],
  ])('%s m² is %s with a %s m reach', (area, key, radiusM) => {
    expect(sizeClass(area)).toEqual({ key, radiusM });
  });

  it.each([null, Number.NaN, -1, undefined])('has no class for %s', (area) => {
    expect(sizeClass(area)).toBeNull();
  });
});

describe('loadParks', () => {
  it('turns features into parks with their size class', () => {
    const [park] = loadParks({ type: 'FeatureCollection', features: [point('p1', 100.64, 13.73, 7308)] });
    expect(park).toEqual({
      id: 'p1',
      name: 'Park p1',
      districtTh: 'สวนหลวง',
      areaM2: 7308,
      owner: null,
      kind: null,
      lists: ['accessible'],
      lngLat: [100.64, 13.73],
      size: { key: 'S', radiusM: 500 },
    });
  });

  it('skips a feature without point coordinates', () => {
    const broken = { type: 'Feature', geometry: null, properties: { id: 'x', name: 'x', areaM2: 10 } };
    expect(loadParks({ type: 'FeatureCollection', features: [broken, point('p2', 100.6, 13.7, 10)] })).toHaveLength(1);
  });
});

describe('parksReaching', () => {
  // A box about 1 km across around (100.64, 13.73).
  const box = [100.635, 13.725, 100.645, 13.735];
  const parks = loadParks({
    type: 'FeatureCollection',
    features: [
      point('xl-east', 100.645 + 4000 / (111195 * Math.cos((13.73 * Math.PI) / 180)), 13.73, 200000),
      point('s-far', 100.645 + 600 / (111195 * Math.cos((13.73 * Math.PI) / 180)), 13.73, 1000),
      point('s-inside', 100.64, 13.73, 1000),
    ],
  });

  it('keeps parks whose circle reaches the box and drops the rest', () => {
    expect(parksReaching(parks, box).map((p) => p.id)).toEqual(['xl-east', 's-inside']);
  });
});
