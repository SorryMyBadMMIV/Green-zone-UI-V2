// Geometry on [lng, lat] coordinates (GeoJSON order).
// Areas use the same spherical formula and mean Earth radius as turf.js, so they match its numbers.
const EARTH_RADIUS_M = 6371008.8;
const toRad = (deg) => (deg * Math.PI) / 180;

/** Area in m² enclosed by a closed ring of [lng, lat] points. */
export function ringAreaM2(ring) {
  let total = 0;
  for (let i = 0; i < ring.length - 1; i++) {
    const [lng1, lat1] = ring[i];
    const [lng2, lat2] = ring[i + 1];
    total += toRad(lng2 - lng1) * (2 + Math.sin(toRad(lat1)) + Math.sin(toRad(lat2)));
  }
  return Math.abs((total * EARTH_RADIUS_M * EARTH_RADIUS_M) / 2);
}

/** Area in m² of a GeoJSON Polygon or MultiPolygon, holes subtracted. 0 for anything else. */
export function polygonAreaM2(geometry) {
  let polygons = [];
  if (geometry?.type === 'Polygon') polygons = [geometry.coordinates];
  if (geometry?.type === 'MultiPolygon') polygons = geometry.coordinates;
  return polygons.reduce(
    (sum, [outer, ...holes]) => sum + ringAreaM2(outer) - holes.reduce((holeSum, hole) => holeSum + ringAreaM2(hole), 0),
    0,
  );
}

/**
 * A point inside a four-corner frame, as [lng, lat]. u runs 0 → 1 from the left (west) edge to the
 * right (east) edge, v runs 0 → 1 from the top (north) edge to the bottom (south) edge.
 * corners = { topLeft, topRight, bottomLeft, bottomRight }, each [lat, lng].
 */
export function pointInFrame(corners, u, v) {
  const { topLeft: tl, topRight: tr, bottomLeft: bl, bottomRight: br } = corners;
  const lat = (1 - v) * ((1 - u) * tl[0] + u * tr[0]) + v * ((1 - u) * bl[0] + u * br[0]);
  const lng = (1 - v) * ((1 - u) * tl[1] + u * tr[1]) + v * ((1 - u) * bl[1] + u * br[1]);
  return [lng, lat];
}

/**
 * Closed GeoJSON ring (top-left → bottom-left → bottom-right → top-right) for the part of a frame
 * between (u0, v0) and (u1, v1). Without a range it is the whole frame.
 */
export function frameRing(corners, [u0, v0, u1, v1] = [0, 0, 1, 1]) {
  const ring = [
    pointInFrame(corners, u0, v0),
    pointInFrame(corners, u0, v1),
    pointInFrame(corners, u1, v1),
    pointInFrame(corners, u1, v0),
  ];
  return [...ring, ring[0]];
}

/** Center of a frame as [lat, lng]. */
export function frameCenter(corners) {
  const [lng, lat] = pointInFrame(corners, 0.5, 0.5);
  return [lat, lng];
}

/** A box [west, south, east, north] with the focus area cut out of it, for the grey "update soon" cover. */
export function maskPolygon(focusGeometry, [west, south, east, north]) {
  const box = [[west, south], [east, south], [east, north], [west, north], [west, south]];
  const polygons = focusGeometry.type === 'Polygon' ? [focusGeometry.coordinates] : focusGeometry.coordinates;
  return { type: 'Polygon', coordinates: [box, ...polygons.map((polygon) => polygon[0])] };
}

/** Straight-line distance in metres between two [lng, lat] points (haversine, same Earth radius as the areas). */
export function haversineM([lng1, lat1], [lng2, lat2]) {
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h));
}

/** The [outer, ...holes] rings of every part of a Polygon or MultiPolygon. */
const polygonsOf = (geometry) => {
  if (geometry?.type === 'Polygon') return [geometry.coordinates];
  if (geometry?.type === 'MultiPolygon') return geometry.coordinates;
  return [];
};

function inRing([x, y], ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** Whether a [lng, lat] point lies inside a Polygon or MultiPolygon (holes are outside). */
export function pointInPolygon(point, geometry) {
  return polygonsOf(geometry).some(([outer, ...holes]) => inRing(point, outer) && !holes.some((hole) => inRing(point, hole)));
}

/** [west, south, east, north] of a Polygon or MultiPolygon. */
export function bboxOf(geometry) {
  const box = [Infinity, Infinity, -Infinity, -Infinity];
  for (const rings of polygonsOf(geometry)) {
    for (const [lng, lat] of rings[0]) {
      box[0] = Math.min(box[0], lng);
      box[1] = Math.min(box[1], lat);
      box[2] = Math.max(box[2], lng);
      box[3] = Math.max(box[3], lat);
    }
  }
  return box;
}

/** Area-weighted centre of a Polygon or MultiPolygon in the lng/lat plane (fine at city scale). */
function centroid(geometry) {
  let area = 0;
  let cx = 0;
  let cy = 0;
  for (const rings of polygonsOf(geometry)) {
    rings.forEach((ring, index) => {
      const sign = index === 0 ? 1 : -1;
      let a = 0;
      let x = 0;
      let y = 0;
      for (let i = 0; i < ring.length - 1; i++) {
        const [x0, y0] = ring[i];
        const [x1, y1] = ring[i + 1];
        const cross = x0 * y1 - x1 * y0;
        a += cross;
        x += (x0 + x1) * cross;
        y += (y0 + y1) * cross;
      }
      // Each ring's own orientation is normalised, then holes are subtracted.
      const ringSign = Math.sign(a) || 1;
      area += sign * Math.abs(a);
      cx += sign * ringSign * x;
      cy += sign * ringSign * y;
    });
  }
  return area ? [cx / (3 * area), cy / (3 * area)] : polygonsOf(geometry)[0]?.[0]?.[0] ?? [0, 0];
}

/**
 * A point that is always inside the polygon: its centre when that is inside, otherwise the middle of the widest
 * inside stretch of the east–west line through the centre (for L-shapes, rings and other concave plots).
 */
export function polygonLabelPoint(geometry) {
  const centre = centroid(geometry);
  if (pointInPolygon(centre, geometry)) return centre;
  const [, y] = centre;
  const xs = [];
  for (const rings of polygonsOf(geometry)) {
    for (const ring of rings) {
      for (let i = 0; i < ring.length - 1; i++) {
        const [x0, y0] = ring[i];
        const [x1, y1] = ring[i + 1];
        if (y0 > y !== y1 > y) xs.push(x0 + ((y - y0) * (x1 - x0)) / (y1 - y0));
      }
    }
  }
  xs.sort((a, b) => a - b);
  let best = null;
  for (let i = 0; i + 1 < xs.length; i++) {
    const middle = [(xs[i] + xs[i + 1]) / 2, y];
    if ((!best || xs[i + 1] - xs[i] > best.width) && pointInPolygon(middle, geometry)) best = { point: middle, width: xs[i + 1] - xs[i] };
  }
  return best ? best.point : polygonsOf(geometry)[0][0][0];
}
