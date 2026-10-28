import { describe, it, expect } from 'vitest';
import { greenGroupStats, sitesPerSquare } from './backendResults.js';

const site = (zone, rank) => ({ type: 'Feature', geometry: { type: 'Point', coordinates: [100.6, 13.7] }, properties: { id: `${zone}-${rank}`, zone, rank } });
const group = (id, kind, greenM2InGroup) => ({
  type: 'Feature',
  geometry: { type: 'Point', coordinates: [100.6, 13.7] },
  properties: { id, kind, radiusM: 100, greenM2InGroup },
});

describe('sitesPerSquare', () => {
  it('counts the GA sites in every 1 km square', () => {
    const sites = { type: 'FeatureCollection', features: [site('r0_c0', 1), site('r0_c0', 2), site('r1_c3', 1)] };
    expect(sitesPerSquare(sites)).toEqual({ r0_c0: 2, r1_c3: 1 });
  });

  it('is empty when there are no sites', () => {
    expect(sitesPerSquare(null)).toEqual({});
  });
});

describe('greenGroupStats', () => {
  it('counts groups and isolated circles and the share of all green inside them', () => {
    const groups = { type: 'FeatureCollection', features: [group('1', 'group', 600), group('2', 'group', 200), group('3', 'isolated', 100)] };
    expect(greenGroupStats(groups, 1000)).toEqual({ groups: 2, isolated: 1, greenM2InCircles: 900, share: 0.9 });
  });

  it('gives no share when the total green is unknown', () => {
    const groups = { type: 'FeatureCollection', features: [group('1', 'group', 600)] };
    expect(greenGroupStats(groups, null).share).toBeNull();
  });
});
