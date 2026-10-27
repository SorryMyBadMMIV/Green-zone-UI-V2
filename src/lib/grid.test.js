import { describe, it, expect } from 'vitest';
import { FOCUS_FRAME } from '../data/frames.js';
import { frameRing, ringAreaM2 } from './geo.js';
import { CLASS, classAreas, classifyGrid, classifyNdvi } from './grid.js';

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

describe('classifyGrid', () => {
  it('gives every cell a one-byte class code, row by row', () => {
    const classified = classifyGrid({ rows: 2, cols: 3, ndvi: [[0.5, 0.1, -0.2], [0.31, null, 0.29]] });
    expect(classified.rows).toBe(2);
    expect(classified.cols).toBe(3);
    expect(classified.classes).toBeInstanceOf(Uint8Array);
    expect([...classified.classes]).toEqual([CLASS.green, CLASS.grey, CLASS.water, CLASS.green, CLASS.unknown, CLASS.grey]);
  });
});

describe('classAreas', () => {
  it('splits the frame area exactly between the classes', () => {
    const classified = classifyGrid({ rows: 2, cols: 3, ndvi: [[0.5, 0.1, -0.2], [0.31, null, 0.29]] });
    const areas = classAreas(FOCUS_FRAME, classified);
    const total = areas.green + areas.grey + areas.water + areas.unknown;
    expect(total).toBeCloseTo(ringAreaM2(frameRing(FOCUS_FRAME.corners)), 0);
    expect(areas.green).toBeGreaterThan(0);
    expect(areas.water).toBeGreaterThan(0);
    expect(areas.unknown).toBeGreaterThan(0);
  });

  it('handles a full 600 × 600 grid of 5 m cells', () => {
    const ndvi = Array.from({ length: 600 }, (_, row) => new Array(600).fill(row < 200 ? 0.6 : 0.1));
    const areas = classAreas(FOCUS_FRAME, classifyGrid({ rows: 600, cols: 600, ndvi }));
    expect(areas.green / (areas.green + areas.grey)).toBeCloseTo(1 / 3, 2);
    expect((areas.green + areas.grey) / 1e6).toBeCloseTo(8.978, 3);
  });
});
