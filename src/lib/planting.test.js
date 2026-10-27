import { describe, it, expect } from 'vitest';
import { analysePlot, plantingLevel, policyCoverage, scorePlot } from './planting.js';
import { loadParks } from './parks.js';

const parkAt = (id, lng, lat, areaM2) =>
  loadParks({
    type: 'FeatureCollection',
    features: [{ type: 'Feature', geometry: { type: 'Point', coordinates: [lng, lat] }, properties: { id, name: `Park ${id}`, areaM2 } }],
  })[0];

// A square of side `metres` centred on (lng, lat).
function squareAround(lng, lat, metres) {
  const dLat = metres / 2 / 111195;
  const dLng = metres / 2 / (111195 * Math.cos((lat * Math.PI) / 180));
  const ring = [[lng - dLng, lat - dLat], [lng + dLng, lat - dLat], [lng + dLng, lat + dLat], [lng - dLng, lat + dLat], [lng - dLng, lat - dLat]];
  return { type: 'Polygon', coordinates: [ring] };
}

describe('scorePlot', () => {
  it.each([
    [{ distanceM: 2000, areaM2: 5000, circlesCovering: 0 }, 100],
    [{ distanceM: 4000, areaM2: 9000, circlesCovering: 0 }, 100],
    [{ distanceM: 1000, areaM2: 2500, circlesCovering: 1 }, 50],
    [{ distanceM: 1600, areaM2: 3000, circlesCovering: 0 }, 78],
    [{ distanceM: 0, areaM2: 0, circlesCovering: 3 }, 0],
    [{ distanceM: Infinity, areaM2: 5000, circlesCovering: 0 }, 100],
  ])('scores %o as %i', (input, score) => {
    expect(scorePlot(input)).toBe(score);
  });
});

describe('plantingLevel', () => {
  it.each([
    [100, 'very-good', 'Very good for planting'],
    [80, 'very-good', 'Very good for planting'],
    [79, 'good', 'Good for planting'],
    [60, 'good', 'Good for planting'],
    [59, 'fair', 'Fair for planting'],
    [40, 'fair', 'Fair for planting'],
    [39, 'poor', 'Poor for planting'],
    [0, 'poor', 'Poor for planting'],
  ])('%i is %s', (score, key, label) => {
    expect(plantingLevel(score)).toEqual({ key, label });
  });
});

describe('analysePlot', () => {
  const plot = squareAround(100.6, 13.7, 50); // 2,500 m²

  it('scores a plot about 1 km from a small park as good and recommends it', () => {
    const park = parkAt('far', 100.6, 13.709, 1000);
    const result = analysePlot(plot, 2500, [park]);
    expect(result.nearestPark.id).toBe('far');
    expect(result.nearestPark.distanceM).toBeCloseTo(1001, 0);
    expect(result.circlesCovering).toBe(0);
    expect(result.withinPolicy).toBe(false);
    expect(result.score).toBe(60);
    expect(result.level.key).toBe('good');
    expect(result.recommended).toBe(true);
  });

  it('does not recommend a plot within 400 m of a park', () => {
    const park = parkAt('near', 100.6, 13.7027, 1000); // about 300 m north
    const result = analysePlot(plot, 2500, [park]);
    expect(result.circlesCovering).toBe(1);
    expect(result.withinPolicy).toBe(true);
    expect(result.recommended).toBe(false);
  });

  it('has no nearest park when there are no parks', () => {
    const result = analysePlot(plot, 2500, []);
    expect(result.nearestPark).toBeNull();
    expect(result.withinPolicy).toBe(false);
  });
});

describe('policyCoverage', () => {
  const square = squareAround(100.6, 13.7, 1000);

  it('covers about π·400² of a 1 km² square with one park in the middle', () => {
    const share = policyCoverage(square, [parkAt('mid', 100.6, 13.7, 1000)]);
    expect(Math.abs(share - (Math.PI * 400 * 400) / 1e6)).toBeLessThan(0.03);
  });

  it('is 0 without parks', () => {
    expect(policyCoverage(square, [])).toBe(0);
  });
});
