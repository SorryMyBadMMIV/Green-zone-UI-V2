import { describe, it, expect } from 'vitest';
import { affineFromPoints, hexToRgb, paintClasses } from './raster.js';

const apply = ([a, b, c, d, e, f], [x, y]) => [a * x + c * y + e, b * x + d * y + f];

describe('affineFromPoints', () => {
  it('maps the three source points onto the three destination points', () => {
    const src = [[0, 0], [600, 0], [0, 600]];
    const dst = [[12.5, 40], [300.25, 35.5], [20, 330]];
    const transform = affineFromPoints(src, dst);
    src.forEach((point, i) => {
      const [x, y] = apply(transform, point);
      expect(x).toBeCloseTo(dst[i][0], 9);
      expect(y).toBeCloseTo(dst[i][1], 9);
    });
  });
});

describe('hexToRgb', () => {
  it('reads #rrggbb colors', () => {
    expect(hexToRgb('#22c55e')).toEqual([34, 197, 94]);
    expect(hexToRgb('#9ca3af')).toEqual([156, 163, 175]);
  });
});

describe('paintClasses', () => {
  it('writes one RGBA pixel per cell from the palette', () => {
    const palette = [[0, 0, 0, 0], [0, 0, 255, 255], [128, 128, 128, 120], [0, 255, 0, 120]];
    const pixels = paintClasses({ rows: 1, cols: 3, classes: Uint8Array.from([3, 2, 0]) }, palette);
    expect([...pixels]).toEqual([0, 255, 0, 120, 128, 128, 128, 120, 0, 0, 0, 0]);
  });
});
