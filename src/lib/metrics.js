import {
  COLORS,
  FAR_BELOW_M2,
  GAUGE_MAX_M2,
  TARGET_M2_PER_PERSON,
  TIER_HIGH,
  TIER_MEDIUM,
} from './constants.js';

const isNum = (value) => typeof value === 'number' && Number.isFinite(value);
const clamp01 = (value) => Math.min(1, Math.max(0, value));

/** Green space per person in m², or null when it can't be computed (never divides by zero). */
export function m2PerPerson(areaM2, population) {
  if (!isNum(areaM2) || !isNum(population) || areaM2 < 0 || population <= 0) return null;
  return areaM2 / population;
}

const STATUS = {
  good: { level: 'good', label: 'Meets target', color: COLORS.good },
  warning: { level: 'warning', label: 'Below target', color: COLORS.warning },
  critical: { level: 'critical', label: 'Far below target', color: COLORS.critical },
  none: { level: 'none', label: 'No data', color: COLORS.noData },
};

/** How a green-space-per-person value compares with the 9 m² target. */
export function greenSpaceStatus(m2) {
  if (!isNum(m2)) return STATUS.none;
  if (m2 >= TARGET_M2_PER_PERSON) return STATUS.good;
  if (m2 >= FAR_BELOW_M2) return STATUS.warning;
  return STATUS.critical;
}

/** Share of the green-space gauge to fill (0–1). The target sits at 0.5. */
export function greenGaugeFraction(m2) {
  return isNum(m2) ? clamp01(m2 / GAUGE_MAX_M2) : 0;
}

export const TIERS = {
  high: { key: 'high', label: 'High priority', short: 'High', range: '0.75 and up', color: COLORS.tierHigh, stroke: COLORS.tierHighStroke },
  medium: { key: 'medium', label: 'Medium priority', short: 'Medium', range: '0.50 to 0.74', color: COLORS.tierMedium, stroke: COLORS.tierMediumStroke },
  low: { key: 'low', label: 'Low priority', short: 'Low', range: 'under 0.50', color: COLORS.tierLow, stroke: COLORS.tierLowStroke },
};

export const TIER_ORDER = [TIERS.high, TIERS.medium, TIERS.low];

/** Priority tier for a fitness score (0–1). A missing score counts as low. */
export function priorityTier(fitness) {
  if (isNum(fitness) && fitness >= TIER_HIGH) return TIERS.high;
  if (isNum(fitness) && fitness >= TIER_MEDIUM) return TIERS.medium;
  return TIERS.low;
}

/** Plain-language label for an NDVI value, or null when it is missing. */
export function ndviLabel(ndvi) {
  if (!isNum(ndvi)) return null;
  if (ndvi >= 0.6) return 'dense vegetation';
  if (ndvi >= 0.3) return 'moderate vegetation';
  return 'little or no vegetation';
}

/**
 * How much cooler a park is than the area around it (°C), plus an axis domain for the chart.
 * Returns null when either temperature is missing.
 */
export function coolingEffect(insideC, aroundC) {
  if (!isNum(insideC) || !isNum(aroundC)) return null;
  return {
    delta: aroundC - insideC,
    domain: [Math.floor(Math.min(insideC, aroundC)) - 2, Math.ceil(Math.max(insideC, aroundC)) + 2],
  };
}

/** Number of fitness scores in each priority tier. */
export function countByTier(fitnessValues) {
  const counts = { high: 0, medium: 0, low: 0 };
  for (const fitness of fitnessValues) counts[priorityTier(fitness).key] += 1;
  return counts;
}
