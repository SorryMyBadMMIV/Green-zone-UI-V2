import { PARK_SIZE_CLASSES } from './constants.js';

export { PARK_SIZE_CLASSES };

const METRES_PER_DEGREE = 111195; // one degree of latitude on the mean-radius Earth (R = 6371008.8 m)
const isNum = (value) => typeof value === 'number' && Number.isFinite(value);

/** A park's size class and reach: S up to 16,000 m² (500 m) … XL above 160,000 m² (5 km). null without an area. */
export function sizeClass(areaM2) {
  if (!isNum(areaM2) || areaM2 < 0) return null;
  const { key, radiusM } = PARK_SIZE_CLASSES.find((size) => areaM2 <= size.maxM2);
  return { key, radiusM };
}

/** Park objects from the park list GeoJSON; features without a point are skipped. */
export function loadParks(collection) {
  const parks = [];
  for (const feature of collection?.features ?? []) {
    const coordinates = feature?.geometry?.type === 'Point' ? feature.geometry.coordinates : null;
    if (!Array.isArray(coordinates) || !coordinates.slice(0, 2).every(isNum)) continue;
    const p = feature.properties ?? {};
    parks.push({
      id: String(p.id),
      name: p.name ?? String(p.id),
      districtTh: p.districtTh ?? null,
      areaM2: isNum(p.areaM2) ? p.areaM2 : null,
      owner: p.owner ?? null,
      kind: p.kind ?? null,
      lists: Array.isArray(p.lists) ? p.lists : [],
      lngLat: [coordinates[0], coordinates[1]],
      size: sizeClass(p.areaM2),
    });
  }
  return parks;
}

/** Parks whose reach circle (or, without a size class, the point itself) touches the box [west, south, east, north]. */
export function parksReaching(parks, [west, south, east, north]) {
  return parks.filter(({ lngLat: [lng, lat], size }) => {
    const reach = size?.radiusM ?? 0;
    const dLat = reach / METRES_PER_DEGREE;
    const dLng = reach / (METRES_PER_DEGREE * Math.cos((lat * Math.PI) / 180));
    return lng >= west - dLng && lng <= east + dLng && lat >= south - dLat && lat <= north + dLat;
  });
}
