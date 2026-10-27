import {
  POLICY_RADIUS_M,
  RECOMMEND_MIN_SCORE,
  SCORE_AREA_FULL_M2,
  SCORE_DISTANCE_FULL_M,
  SCORE_POINTS,
} from './constants.js';
import { bboxOf, haversineM, pointInPolygon, polygonLabelPoint } from './geo.js';

const METRES_PER_DEGREE = 111195;
const share = (value, full) => (typeof value === 'number' && value > 0 ? Math.min(1, value / full) : 0);

/** Planting score 0–100: distance to the nearest park (50), plot size (30), minus 10 per park circle covering it (20). */
export function scorePlot({ distanceM, areaM2, circlesCovering }) {
  const distance = SCORE_POINTS.distance * share(distanceM, SCORE_DISTANCE_FULL_M);
  const size = SCORE_POINTS.size * share(areaM2, SCORE_AREA_FULL_M2);
  const overlap = Math.max(0, SCORE_POINTS.overlap - SCORE_POINTS.perCircle * (circlesCovering ?? 0));
  return Math.min(100, Math.max(0, Math.round(distance + size + overlap)));
}

const LEVELS = [
  { min: 80, key: 'very-good', label: 'Very good for planting' },
  { min: 60, key: 'good', label: 'Good for planting' },
  { min: 40, key: 'fair', label: 'Fair for planting' },
  { min: -Infinity, key: 'poor', label: 'Poor for planting' },
];

/** Word label for a planting score. */
export function plantingLevel(score) {
  const { key, label } = LEVELS.find((level) => score >= level.min);
  return { key, label };
}

/**
 * How an abandoned plot does: nearest park, park circles covering it, whether it is already within 400 m of a park,
 * its score and whether it is recommended (outside every 400 m ring and good or very good).
 * Distances are straight-line, from a point inside the plot to each park point.
 */
export function analysePlot(geometry, areaM2, parks) {
  const point = polygonLabelPoint(geometry);
  let nearestPark = null;
  let circlesCovering = 0;
  let withinPolicy = false;
  for (const park of parks) {
    const distanceM = haversineM(point, park.lngLat);
    if (!nearestPark || distanceM < nearestPark.distanceM) nearestPark = { id: park.id, name: park.name, distanceM };
    if (park.size && distanceM <= park.size.radiusM) circlesCovering += 1;
    if (distanceM <= POLICY_RADIUS_M) withinPolicy = true;
  }
  const score = scorePlot({ distanceM: nearestPark?.distanceM ?? Infinity, areaM2, circlesCovering });
  return {
    point,
    nearestPark,
    circlesCovering,
    withinPolicy,
    score,
    level: plantingLevel(score),
    recommended: !withinPolicy && score >= RECOMMEND_MIN_SCORE,
  };
}

/** Share (0–1) of a polygon's land within `radiusM` of any park, from points on a `stepM` grid. */
export function policyCoverage(geometry, parks, { radiusM = POLICY_RADIUS_M, stepM = 50 } = {}) {
  const [west, south, east, north] = bboxOf(geometry);
  const midLat = (south + north) / 2;
  const dLat = stepM / METRES_PER_DEGREE;
  const dLng = stepM / (METRES_PER_DEGREE * Math.cos((midLat * Math.PI) / 180));
  const padLat = radiusM / METRES_PER_DEGREE;
  const padLng = radiusM / (METRES_PER_DEGREE * Math.cos((midLat * Math.PI) / 180));
  const nearby = parks.filter(
    ({ lngLat: [lng, lat] }) => lng >= west - padLng && lng <= east + padLng && lat >= south - padLat && lat <= north + padLat,
  );
  let inside = 0;
  let covered = 0;
  for (let lat = south + dLat / 2; lat < north; lat += dLat) {
    for (let lng = west + dLng / 2; lng < east; lng += dLng) {
      if (!pointInPolygon([lng, lat], geometry)) continue;
      inside += 1;
      if (nearby.some((park) => haversineM([lng, lat], park.lngLat) <= radiusM)) covered += 1;
    }
  }
  return inside ? covered / inside : 0;
}
