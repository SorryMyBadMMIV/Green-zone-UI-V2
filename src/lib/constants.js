// Bangkok's own planning target for public green space (project report, chapter 1).
export const TARGET_M2_PER_PERSON = 9;
// The green-space gauge runs from 0 to twice the target, so the target sits at the top.
export const GAUGE_MAX_M2 = 2 * TARGET_M2_PER_PERSON;
// Under this a zone is "far below target" (the report: 36 districts have less than 3 m²).
export const FAR_BELOW_M2 = 3;
// Fitness cut-offs for the priority tiers.
export const TIER_HIGH = 0.75;
export const TIER_MEDIUM = 0.5;
// NDVI rule for the grid (report §2.2): vegetation is 0.3 and up, water is below 0.
export const GREEN_NDVI = 0.3;
export const WATER_NDVI = 0;
export const DEFAULT_RADIUS_KM = 1;

// Park size classes and how far each park reaches (Rocket Media Lab / BMA Office of Environment).
export const PARK_SIZE_CLASSES = [
  { key: 'S', maxM2: 16000, radiusM: 500 },
  { key: 'M', maxM2: 80000, radiusM: 1000 },
  { key: 'L', maxM2: 160000, radiusM: 3000 },
  { key: 'XL', maxM2: Infinity, radiusM: 5000 },
];

// Green Bangkok 2030 / 15-minute parks: everyone within 400 m of a park.
export const POLICY_RADIUS_M = 400;

// Planting score (0–100) for abandoned plots: far from parks and big is better; every park circle that already
// covers the plot takes points off.
export const SCORE_DISTANCE_FULL_M = 2000;
export const SCORE_AREA_FULL_M2 = 5000;
export const SCORE_POINTS = { distance: 50, size: 30, overlap: 20, perCircle: 10 };
export const RECOMMEND_MIN_SCORE = 60;

// Data colors. UI chrome colors live in src/index.css.
// The tier ramp passed the dataviz ordinal check on the light map and on the dark cards.
export const COLORS = {
  good: '#0ca30c',
  warning: '#fab219',
  critical: '#d03b3b',
  noData: '#8a8983',
  greenZoneFill: '#22c55e',
  greenZoneMark: '#16a34a',
  greenZoneStroke: '#15803d',
  greenZoneText: '#86efac',
  greyZoneText: '#fdba74',
  tierHigh: '#9a3412',
  tierHighStroke: '#7c2d12',
  tierMedium: '#ea580c',
  tierMediumStroke: '#9a3412',
  tierLow: '#fb923c',
  tierLowStroke: '#c2410c',
  fitnessArc: '#f97316',
  dataBlue: '#3987e5',
  dataOrange: '#d95926',
  selected: '#0b0b0b',
  gridGreen: '#22c55e',
  gridGrey: '#9ca3af',
  mask: '#334155',
  // Park size classes: dot fill and reach circle (readable on the satellite photo and the street map).
  parkS: '#4ade80',
  parkM: '#22d3ee',
  parkL: '#facc15',
  parkXL: '#c084fc',
  policyRing: '#f8fafc',
  policyShade: 'rgba(15, 23, 42, 0.28)',
  abandonedFill: '#dc2626',
  abandonedStroke: '#991b1b',
  recommendStar: '#fcd34d',
  gaSite: '#a855f7', // backend GA park sites (purple ◆)
  greenGroup: '#2dd4bf', // backend green groups (teal circles)
  focusOutline: '#14532d',
  frameOutline: '#111827',
};
