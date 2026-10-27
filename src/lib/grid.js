import { GREEN_NDVI, WATER_NDVI } from './constants.js';
import { pointInFrame, ringAreaM2 } from './geo.js';

/** One byte per cell: the class codes of the classified grid. */
export const CLASS = { unknown: 0, water: 1, grey: 2, green: 3 };

/** Decides a cell from its NDVI: 'water' (< 0), 'grey' (< 0.3) or 'green'. null when NDVI is missing. */
export function classifyNdvi(ndvi) {
  if (typeof ndvi !== 'number' || !Number.isFinite(ndvi)) return null;
  if (ndvi < WATER_NDVI) return 'water';
  return ndvi >= GREEN_NDVI ? 'green' : 'grey';
}

/**
 * Decides every cell of an NDVI grid ({ rows, cols, ndvi[row][col] }, row 0 = north edge).
 * Returns { rows, cols, classes } with one CLASS code per cell, row by row.
 */
export function classifyGrid(grid) {
  const { rows, cols } = grid;
  const classes = new Uint8Array(rows * cols);
  for (let row = 0; row < rows; row++) {
    const values = grid.ndvi[row] ?? [];
    for (let col = 0; col < cols; col++) {
      const cls = classifyNdvi(values[col]);
      classes[row * cols + col] = cls ? CLASS[cls] : CLASS.unknown;
    }
  }
  return { rows, cols, classes };
}

/**
 * Total area in m² of each class. Every cell's four corners are computed from the frame's corner
 * lat/lngs (the same bilinear split as the map), so the classes always add up to the frame's area.
 */
export function classAreas(frame, { rows, cols, classes }) {
  const stride = cols + 1;
  const corners = new Array((rows + 1) * stride);
  for (let row = 0; row <= rows; row++) {
    for (let col = 0; col <= cols; col++) corners[row * stride + col] = pointInFrame(frame.corners, col / cols, row / rows);
  }
  const totals = [0, 0, 0, 0];
  const ring = new Array(5);
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const topLeft = row * stride + col;
      ring[0] = corners[topLeft];
      ring[1] = corners[topLeft + stride];
      ring[2] = corners[topLeft + stride + 1];
      ring[3] = corners[topLeft + 1];
      ring[4] = corners[topLeft];
      totals[classes[row * cols + col]] += ringAreaM2(ring);
    }
  }
  return { unknown: totals[CLASS.unknown], water: totals[CLASS.water], grey: totals[CLASS.grey], green: totals[CLASS.green] };
}
