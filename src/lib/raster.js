/**
 * The canvas transform [a, b, c, d, e, f] of the affine map that sends three source points onto
 * three destination points: x' = a·x + c·y + e, y' = b·x + d·y + f (the order setTransform takes).
 */
export function affineFromPoints([[x0, y0], [x1, y1], [x2, y2]], [[u0, v0], [u1, v1], [u2, v2]]) {
  const det = (x1 - x0) * (y2 - y0) - (x2 - x0) * (y1 - y0);
  const a = ((u1 - u0) * (y2 - y0) - (u2 - u0) * (y1 - y0)) / det;
  const c = ((u2 - u0) * (x1 - x0) - (u1 - u0) * (x2 - x0)) / det;
  const b = ((v1 - v0) * (y2 - y0) - (v2 - v0) * (y1 - y0)) / det;
  const d = ((v2 - v0) * (x1 - x0) - (v1 - v0) * (x2 - x0)) / det;
  return [a, b, c, d, u0 - a * x0 - c * y0, v0 - b * x0 - d * y0];
}

/** "#22c55e" → [34, 197, 94] */
export function hexToRgb(hex) {
  const n = Number.parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** RGBA pixels (4 bytes per cell, row by row) for the class codes, with palette[code] = [r, g, b, a]. */
export function paintClasses({ rows, cols, classes }, palette) {
  const pixels = new Uint8ClampedArray(rows * cols * 4);
  for (let i = 0; i < rows * cols; i++) pixels.set(palette[classes[i]], i * 4);
  return pixels;
}
