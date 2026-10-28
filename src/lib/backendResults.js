// Small summaries of the backend's own results: GA park sites and green groups.

/** { zone: number of GA sites } for every 1 km square that has sites. */
export function sitesPerSquare(gaSites) {
  const counts = {};
  for (const { properties } of gaSites?.features ?? []) counts[properties.zone] = (counts[properties.zone] ?? 0) + 1;
  return counts;
}

/**
 * Green groups (solid circles), isolated circles (dashed) and the share of all green that lies in their circles.
 * greenM2 = all green in the image (null when unknown, then share is null).
 */
export function greenGroupStats(greenGroups, greenM2) {
  const features = greenGroups?.features ?? [];
  const greenM2InCircles = features.reduce((sum, f) => sum + (f.properties.greenM2InGroup ?? 0), 0);
  return {
    groups: features.filter((f) => f.properties.kind === 'group').length,
    isolated: features.filter((f) => f.properties.kind === 'isolated').length,
    greenM2InCircles,
    share: greenM2 > 0 ? greenM2InCircles / greenM2 : null,
  };
}
