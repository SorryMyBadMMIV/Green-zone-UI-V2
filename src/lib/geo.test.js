import { describe, it, expect } from 'vitest';
import { FRAMES } from '../data/frames.js';
import {
  bboxOf,
  frameCenter,
  frameRing,
  haversineM,
  maskPolygon,
  pointInFrame,
  pointInPolygon,
  polygonAreaM2,
  polygonLabelPoint,
  ringAreaM2,
} from './geo.js';

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

describe('distances and points in polygons', () => {
  const box = { type: 'Polygon', coordinates: [square(100.6, 13.7, 0.01)] };
  const withHole = { type: 'Polygon', coordinates: [square(100.6, 13.7, 0.01), square(100.603, 13.703, 0.004)] };
  const twoParts = { type: 'MultiPolygon', coordinates: [[square(100.6, 13.7, 0.01)], [square(100.7, 13.7, 0.01)]] };
  // An L: a 0.01° square with its top-right 0.008° quarter cut away; its bounding-box centre is outside it.
  const lShape = {
    type: 'Polygon',
    coordinates: [[[100.6, 13.7], [100.61, 13.7], [100.61, 13.702], [100.602, 13.702], [100.602, 13.71], [100.6, 13.71], [100.6, 13.7]]],
  };

  it('measures 0.009° of latitude as about 1000.8 m', () => {
    expect(haversineM([100.6, 13.7], [100.6, 13.709])).toBeCloseTo(1000.8, 0);
  });

  it('knows when a point is inside, outside, in a hole or in the second part of a MultiPolygon', () => {
    expect(pointInPolygon([100.605, 13.705], box)).toBe(true);
    expect(pointInPolygon([100.62, 13.705], box)).toBe(false);
    expect(pointInPolygon([100.605, 13.705], withHole)).toBe(false);
    expect(pointInPolygon([100.705, 13.705], twoParts)).toBe(true);
  });

  it('puts the label point of a square at its centre', () => {
    const [lng, lat] = polygonLabelPoint(box);
    expect(lng).toBeCloseTo(100.605, 6);
    expect(lat).toBeCloseTo(13.705, 6);
  });

  it('puts the label point of an L-shape inside the shape', () => {
    expect(pointInPolygon([100.605, 13.705], lShape)).toBe(false);
    expect(pointInPolygon(polygonLabelPoint(lShape), lShape)).toBe(true);
  });

  it('gives the bounding box of a polygon as [west, south, east, north]', () => {
    bboxOf(box).forEach((value, i) => expect(value).toBeCloseTo([100.6, 13.7, 100.61, 13.71][i], 9));
  });
});
