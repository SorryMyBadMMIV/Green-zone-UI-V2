import { bboxOf, pointInPolygon, polygonAreaM2 } from './geo.js';
import { parksReaching } from './parks.js';
import { analysePlot, policyCoverage } from './planting.js';

/**
 * Everything the map and sidebar need about one district: the parks that reach it, park sizes inside it, the share
 * within 400 m of a park, and every abandoned plot's score and recommendation.
 * focus = the district's GeoJSON geometry; parks = Park[] (all of Bangkok); plots = normalised abandoned FeatureCollection.
 */
export function analyseDistrict({ focus, parks, plots }) {
  const reaching = parksReaching(parks, bboxOf(focus));
  const parksBySize = { S: 0, M: 0, L: 0, XL: 0 };
  for (const park of reaching) {
    if (park.size && pointInPolygon(park.lngLat, focus)) parksBySize[park.size.key] += 1;
  }

  const results = {};
  for (const feature of plots?.features ?? []) {
    const id = String(feature.properties.id);
    const areaM2 = feature.properties.areaM2 ?? polygonAreaM2(feature.geometry);
    results[id] = { ...analysePlot(feature.geometry, areaM2, reaching), isExample: feature.properties.isExample === true };
  }
  const recommendedIds = Object.keys(results)
    .filter((id) => results[id].recommended)
    .sort((a, b) => results[b].score - results[a].score || a.localeCompare(b));
  const recommendedCounts = {
    veryGood: recommendedIds.filter((id) => results[id].level.key === 'very-good').length,
    good: recommendedIds.filter((id) => results[id].level.key === 'good').length,
  };

  return {
    parks: reaching,
    parksBySize,
    policyShare: policyCoverage(focus, reaching),
    plots: results,
    recommendedIds,
    recommendedCounts,
    recommendedFromExamples: recommendedIds.some((id) => results[id].isExample),
  };
}
