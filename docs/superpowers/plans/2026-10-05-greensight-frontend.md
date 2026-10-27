# GreenSight Frontend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the GreenSight web dashboard. It has a dark sidebar with 4 stat cards and an interactive Leaflet map of Bangkok's green zones and grey zones (candidate sites), and it runs on mock data until the backend exists.

**Architecture:** Vite + React single-page app.
- `src/api/zones.js` is the only module that knows where data comes from: mock GeoJSON files, or the backend when `VITE_API_URL` is set.
- Pure functions in `src/lib/` compute every number the UI shows. They are unit-tested.
- `App` holds the selected zone and layer visibility. `ZoneMap` reports clicks, and `Sidebar` renders the overview, green zone or grey zone panel.

**Tech Stack:** Vite 8, React 19 (JavaScript), Tailwind CSS 4 (`@tailwindcss/vite`), Leaflet 1.9 + react-leaflet 5, lucide-react icons, Vitest 5 + Testing Library + jsdom. The charts are hand-written SVG with no chart library.

**Spec:** `docs/superpowers/specs/2026-10-05-greensight-frontend-design.md`

**Notes for the executor**
- The project root is `C:\Users\poohk\OneDrive\Desktop\UI-Front` (all paths below are relative to it).
- This folder is **not** a git repository, and the user chose not to set up git, so there are no commit steps.
- Shell commands use bash syntax and run from the project root.
- Every `<!-- file: path -->` marker sits directly above the full contents of that file.

---

## File map

| File | Responsibility |
|---|---|
| `package.json`, `vite.config.js`, `index.html`, `public/favicon.svg` | Project setup (Vite + React + Tailwind + Vitest) |
| `.env.example`, `.gitignore` | Backend URL template, ignored files |
| `src/main.jsx` | Mounts React, loads Leaflet CSS and app CSS |
| `src/index.css` | Tailwind import, dark UI tokens (`@theme`), Leaflet tweaks |
| `src/config.js` | Backend URL, mock-data flag, basemap, map start view |
| `src/lib/constants.js` | Thresholds and data colors |
| `src/lib/format.js` | Number, area, temperature and distance formatting |
| `src/lib/metrics.js` | m² per person, status, gauge fraction, priority tiers, NDVI labels, cooling |
| `src/lib/geo.js` | Center point of a zone (for map dots) |
| `src/api/zones.js` | Fetches and normalizes the green and grey zone GeoJSON |
| `src/hooks/useZones.js` | Loading / ready / error state and Retry for both layers |
| `public/mock/*.geojson` | Mock data, which also serves as the example of the API contract |
| `src/components/ui/*` | Card, StatusBadge, InfoList, StatPair, LoadingCards, ErrorCard |
| `src/components/charts/*` | HalfPieGauge, CoolingChart, FactorBars, PriorityBar |
| `src/components/sidebar/*` | Sidebar, PanelHeader, OverviewPanel, GreenZonePanel, GreyZonePanel |
| `src/components/map/*` | ZoneMap, LayerControl, MapLegend |
| `src/App.jsx` | Layout and app state (selection, layers, Esc key) |
| `docs/API.md`, `README.md` | Backend contract and how to run the app |

---

### Task 1: Scaffold the project

**Files:**
- Create: `package.json`, `vite.config.js`, `index.html`, `public/favicon.svg`, `.env.example`, `.gitignore`, `src/index.css`, `src/main.jsx`, `src/App.jsx` (temporary)

- [ ] **Step 1: Create the project files**

<!-- file: package.json -->
```json
{
  "name": "greensight-frontend",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest"
  }
}
```

<!-- file: vite.config.js -->
```js
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  test: {
    environment: 'jsdom',
    globals: true,
  },
});
```

<!-- file: index.html -->
```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="description" content="GreenSight: explore Bangkok's green zones and the empty land ranked for new green space." />
    <title>GreenSight</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>
```

<!-- file: public/favicon.svg -->
```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z"/><path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"/></svg>
```

<!-- file: .env.example -->
```bash
# Leave empty to use the mock data in public/mock/.
# Set it to the backend base URL to use real data, for example:
# VITE_API_URL=http://localhost:8000/api
VITE_API_URL=
```

<!-- file: .gitignore -->
```gitignore
node_modules
dist
.env
.env.local
```

<!-- file: src/index.css -->
```css
/* Only scan src/ for class names (not docs/, whose markdown mentions many classes). */
@import "tailwindcss" source(".");

@theme {
  --font-sans: system-ui, "Segoe UI", Roboto, "Leelawadee UI", "Noto Sans Thai", sans-serif;

  /* UI chrome (dark). Data colors live in src/lib/constants.js. */
  --color-app: #121212;
  --color-card: #1c1c1b;
  --color-line: rgb(255 255 255 / 0.08);
  --color-ink: #f5f5f4;
  --color-ink-2: #c3c2b7;
  --color-ink-3: #8a8983;
}

:root {
  color-scheme: dark;
}

body {
  background: var(--color-app);
  color: var(--color-ink);
  -webkit-font-smoothing: antialiased;
}

/* Leaflet: use the app font and show a neutral color while map tiles load. */
.leaflet-container {
  background: #e9e7e2;
  font-family: inherit;
}

/* Mute the colorful OpenStreetMap tiles so the green and orange zones stand out. */
.basemap {
  filter: saturate(0.3) brightness(1.04);
}
```

<!-- file: src/main.jsx -->
```jsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import 'leaflet/dist/leaflet.css';
import './index.css';
import App from './App.jsx';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
```

<!-- file: src/App.jsx (temporary) -->
```jsx
export default function App() {
  return <p className="p-6 text-ink">GreenSight is set up.</p>;
}
```

- [ ] **Step 2: Install dependencies**

Run:
```bash
npm install react@19 react-dom@19 leaflet@1.9 react-leaflet@5 lucide-react@1
npm install -D vite@8 @vitejs/plugin-react@6 tailwindcss@4 @tailwindcss/vite@4 vitest@5 jsdom @testing-library/react@16 @testing-library/dom
```
Expected: both finish without `ERESOLVE` errors. Warnings about optional peer dependencies are fine.

- [ ] **Step 3: Check that it builds**

Run: `npm run build`
Expected: `✓ built in …` and a `dist/` folder, with no errors.

---

### Task 2: Formatting helpers

**Files:**
- Create: `src/lib/constants.js`, `src/lib/format.js`
- Test: `src/lib/format.test.js`

- [ ] **Step 1: Create the constants (needed by later tasks)**

<!-- file: src/lib/constants.js -->
```js
// Bangkok's own planning target for public green space (project report, chapter 1).
export const TARGET_M2_PER_PERSON = 9;
// Bangkok's official figure (BMA, cited in the project report, reference [5]).
export const BANGKOK_M2_PER_PERSON = 7.49;
// The green-space gauge runs from 0 to twice the target, so the target sits at the top.
export const GAUGE_MAX_M2 = 2 * TARGET_M2_PER_PERSON;
// Under this a zone is "far below target" (the report: 36 districts have less than 3 m²).
export const FAR_BELOW_M2 = 3;
// Fitness cut-offs for the priority tiers.
export const TIER_HIGH = 0.75;
export const TIER_MEDIUM = 0.5;
// Below this zoom every zone also gets a clickable dot (small plots are ~1px wide at city zoom).
export const DOT_ZOOM_THRESHOLD = 15;
export const DEFAULT_RADIUS_KM = 1;

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
  dotRing: '#ffffff',
};
```

- [ ] **Step 2: Write the failing test**

<!-- file: src/lib/format.test.js -->
```js
import { describe, it, expect } from 'vitest';
import { DASH, formatArea, formatDecimal, formatKm, formatKm2, formatNumber, formatTemp } from './format.js';

describe('format', () => {
  it('adds thousands separators to whole numbers', () => {
    expect(formatNumber(21000)).toBe('21,000');
    expect(formatNumber(1234567.6)).toBe('1,234,568');
  });

  it('shows a dash for missing or non-finite values', () => {
    for (const value of [null, undefined, NaN, Infinity, '12']) {
      expect(formatNumber(value)).toBe(DASH);
      expect(formatDecimal(value, 1)).toBe(DASH);
      expect(formatArea(value)).toBe(DASH);
      expect(formatKm2(value)).toBe(DASH);
      expect(formatTemp(value)).toBe(DASH);
      expect(formatKm(value)).toBe(DASH);
    }
  });

  it('formats decimals, areas, temperatures and distances with units', () => {
    expect(formatDecimal(38.0952, 1)).toBe('38.1');
    expect(formatDecimal(0.3264, 2)).toBe('0.33');
    expect(formatArea(800000)).toBe('800,000 m²');
    expect(formatKm2(3412000)).toBe('3.4 km²');
    expect(formatTemp(31.24)).toBe('31.2°C');
    expect(formatKm(2.3)).toBe('2.3 km');
  });
});
```

- [ ] **Step 3: Run the test to see it fail**

Run: `npx vitest run src/lib/format.test.js`
Expected: FAIL, because `./format.js` cannot be resolved.

- [ ] **Step 4: Implement**

<!-- file: src/lib/format.js -->
```js
const wholeNumber = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });

const isNum = (value) => typeof value === 'number' && Number.isFinite(value);

/** Shown wherever a value is missing. */
export const DASH = '—';

/** 21000 → "21,000" */
export function formatNumber(value) {
  return isNum(value) ? wholeNumber.format(value) : DASH;
}

/** formatDecimal(38.0952, 1) → "38.1" */
export function formatDecimal(value, digits = 1) {
  return isNum(value) ? value.toFixed(digits) : DASH;
}

/** 800000 → "800,000 m²" */
export function formatArea(valueM2) {
  return isNum(valueM2) ? `${wholeNumber.format(valueM2)} m²` : DASH;
}

/** 3412000 (m²) → "3.4 km²" */
export function formatKm2(valueM2) {
  return isNum(valueM2) ? `${(valueM2 / 1e6).toFixed(1)} km²` : DASH;
}

/** 31.24 → "31.2°C" */
export function formatTemp(valueC) {
  return isNum(valueC) ? `${valueC.toFixed(1)}°C` : DASH;
}

/** 2.3 → "2.3 km" */
export function formatKm(valueKm) {
  return isNum(valueKm) ? `${valueKm.toFixed(1)} km` : DASH;
}
```

- [ ] **Step 5: Run the test to see it pass**

Run: `npx vitest run src/lib/format.test.js`
Expected: PASS (3 tests).

---

### Task 3: Metrics (the numbers behind every card)

**Files:**
- Create: `src/lib/metrics.js`
- Test: `src/lib/metrics.test.js`

- [ ] **Step 1: Write the failing test**

<!-- file: src/lib/metrics.test.js -->
```js
import { describe, it, expect } from 'vitest';
import {
  coolingEffect,
  countByTier,
  greenGaugeFraction,
  greenSpaceStatus,
  m2PerPerson,
  ndviLabel,
  priorityTier,
} from './metrics.js';

describe('m2PerPerson', () => {
  it('divides area by population', () => {
    expect(m2PerPerson(800000, 21000)).toBeCloseTo(38.095, 3);
  });

  it('returns null instead of dividing by zero or using missing data', () => {
    expect(m2PerPerson(800000, 0)).toBeNull();
    expect(m2PerPerson(800000, -5)).toBeNull();
    expect(m2PerPerson(800000, null)).toBeNull();
    expect(m2PerPerson(undefined, 21000)).toBeNull();
  });
});

describe('greenSpaceStatus', () => {
  it('meets the target at exactly 9 m² and above', () => {
    expect(greenSpaceStatus(9).level).toBe('good');
    expect(greenSpaceStatus(38.1).label).toBe('Meets target');
  });

  it('is below target from 3 up to just under 9', () => {
    expect(greenSpaceStatus(8.99).level).toBe('warning');
    expect(greenSpaceStatus(3).level).toBe('warning');
    expect(greenSpaceStatus(7.49).label).toBe('Below target');
  });

  it('is far below target under 3', () => {
    expect(greenSpaceStatus(2.99).level).toBe('critical');
    expect(greenSpaceStatus(0).label).toBe('Far below target');
  });

  it('reports no data for null', () => {
    expect(greenSpaceStatus(null).level).toBe('none');
    expect(greenSpaceStatus(null).label).toBe('No data');
  });
});

describe('greenGaugeFraction', () => {
  it('puts the 9 m² target in the middle of the gauge', () => {
    expect(greenGaugeFraction(9)).toBe(0.5);
  });

  it('clamps to 0–1 and treats missing values as empty', () => {
    expect(greenGaugeFraction(40)).toBe(1);
    expect(greenGaugeFraction(-1)).toBe(0);
    expect(greenGaugeFraction(null)).toBe(0);
  });
});

describe('priorityTier', () => {
  it('splits fitness at 0.75 and 0.5', () => {
    expect(priorityTier(0.75).key).toBe('high');
    expect(priorityTier(0.7499).key).toBe('medium');
    expect(priorityTier(0.5).key).toBe('medium');
    expect(priorityTier(0.4999).key).toBe('low');
    expect(priorityTier(null).key).toBe('low');
  });

  it('gives each tier a label and a color', () => {
    expect(priorityTier(0.91).label).toBe('High priority');
    expect(priorityTier(0.91).color).toMatch(/^#[0-9a-f]{6}$/);
  });
});

describe('ndviLabel', () => {
  it('maps NDVI to plain words', () => {
    expect(ndviLabel(0.62)).toBe('dense vegetation');
    expect(ndviLabel(0.3)).toBe('moderate vegetation');
    expect(ndviLabel(0.08)).toBe('little or no vegetation');
    expect(ndviLabel(undefined)).toBeNull();
  });
});

describe('coolingEffect', () => {
  it('returns how much cooler inside is, plus a padded axis domain', () => {
    const cooling = coolingEffect(31.2, 35.8);
    expect(cooling.delta).toBeCloseTo(4.6, 5);
    expect(cooling.domain).toEqual([29, 38]);
  });

  it('keeps the sign when the park is warmer than around it', () => {
    expect(coolingEffect(36, 35).delta).toBe(-1);
  });

  it('returns null when a temperature is missing', () => {
    expect(coolingEffect(null, 35)).toBeNull();
  });
});

describe('countByTier', () => {
  it('counts fitness scores per tier', () => {
    expect(countByTier([0.91, 0.84, 0.76, 0.71, 0.65, 0.41])).toEqual({ high: 3, medium: 2, low: 1 });
  });
});
```

- [ ] **Step 2: Run the test to see it fail**

Run: `npx vitest run src/lib/metrics.test.js`
Expected: FAIL, because `./metrics.js` cannot be resolved.

- [ ] **Step 3: Implement**

<!-- file: src/lib/metrics.js -->
```js
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
```

- [ ] **Step 4: Run the test to see it pass**

Run: `npx vitest run src/lib/metrics.test.js`
Expected: PASS (15 tests).

---

### Task 4: Zone center point (for map dots)

**Files:**
- Create: `src/lib/geo.js`
- Test: `src/lib/geo.test.js`

- [ ] **Step 1: Write the failing test**

<!-- file: src/lib/geo.test.js -->
```js
import { describe, it, expect } from 'vitest';
import { featureCenter } from './geo.js';

const square = (lng, lat, size) => [[[lng, lat], [lng + size, lat], [lng + size, lat + size], [lng, lat + size], [lng, lat]]];

describe('featureCenter', () => {
  it('returns [lat, lng] of a polygon centroid', () => {
    const [lat, lng] = featureCenter({ geometry: { type: 'Polygon', coordinates: square(100, 13, 0.02) } });
    expect(lat).toBeCloseTo(13.01, 6);
    expect(lng).toBeCloseTo(100.01, 6);
  });

  it('uses the largest part of a MultiPolygon', () => {
    const geometry = { type: 'MultiPolygon', coordinates: [square(100, 13, 0.001), square(100.5, 13.5, 0.04)] };
    const [lat, lng] = featureCenter({ geometry });
    expect(lat).toBeCloseTo(13.52, 6);
    expect(lng).toBeCloseTo(100.52, 6);
  });

  it('returns null when there is no usable geometry', () => {
    expect(featureCenter({ geometry: null })).toBeNull();
    expect(featureCenter({ geometry: { type: 'Point', coordinates: [100, 13] } })).toBeNull();
  });
});
```

- [ ] **Step 2: Run the test to see it fail**

Run: `npx vitest run src/lib/geo.test.js`
Expected: FAIL, because `./geo.js` cannot be resolved.

- [ ] **Step 3: Implement**

<!-- file: src/lib/geo.js -->
```js
/** Area-weighted centroid of a ring of [lng, lat] points (flat maths, fine at city scale). */
function ringCentroid(ring) {
  const [ox, oy] = ring[0]; // work relative to the first point to keep the numbers small
  let twiceArea = 0;
  let cx = 0;
  let cy = 0;
  for (let i = 0; i < ring.length; i++) {
    const [ax, ay] = ring[i];
    const [bx, by] = ring[(i + 1) % ring.length];
    const x0 = ax - ox;
    const y0 = ay - oy;
    const x1 = bx - ox;
    const y1 = by - oy;
    const cross = x0 * y1 - x1 * y0;
    twiceArea += cross;
    cx += (x0 + x1) * cross;
    cy += (y0 + y1) * cross;
  }
  if (twiceArea === 0) return { area: 0, center: [ox, oy] };
  return { area: Math.abs(twiceArea) / 2, center: [ox + cx / (3 * twiceArea), oy + cy / (3 * twiceArea)] };
}

/** [lat, lng] for a zone's map dot: the centroid of its largest outer ring, or null. */
export function featureCenter(feature) {
  const geometry = feature?.geometry;
  if (!geometry) return null;
  let polygons = [];
  if (geometry.type === 'Polygon') polygons = [geometry.coordinates];
  if (geometry.type === 'MultiPolygon') polygons = geometry.coordinates;

  let best = null;
  for (const polygon of polygons) {
    const outer = polygon?.[0];
    if (!Array.isArray(outer) || outer.length < 3) continue;
    const centroid = ringCentroid(outer);
    if (!best || centroid.area > best.area) best = centroid;
  }
  return best ? [best.center[1], best.center[0]] : null;
}
```

- [ ] **Step 4: Run the test to see it pass**

Run: `npx vitest run src/lib/geo.test.js`
Expected: PASS (3 tests).

---

### Task 5: Config and the data client

**Files:**
- Create: `src/config.js`, `src/api/zones.js`
- Test: `src/api/zones.test.js`

- [ ] **Step 1: Create the config**

<!-- file: src/config.js -->
```js
/** Backend base URL from .env. Empty means "use the mock files in public/mock/". */
export const API_URL = (import.meta.env.VITE_API_URL ?? '').trim().replace(/\/+$/, '');
export const USING_MOCK_DATA = API_URL === '';

/**
 * Standard OpenStreetMap tiles: open data, no API key. Fine for development and demos; for heavy
 * traffic use a tile provider or self-host (https://operations.osmfoundation.org/policies/tiles/).
 * Its colors are muted in src/index.css (.basemap) so the zone colors stand out.
 */
export const BASEMAP = {
  url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  maxZoom: 19,
};

export const MAP_DEFAULTS = {
  center: [13.7563, 100.5018], // Bangkok
  zoom: 11,
  minZoom: 10,
  maxZoom: 19,
};
```

- [ ] **Step 2: Write the failing test**

<!-- file: src/api/zones.test.js -->
```js
import { describe, it, expect, vi, afterEach } from 'vitest';
import { fetchZones, normalizeCollection, zonesUrl } from './zones.js';

const square = [[[100.5, 13.7], [100.51, 13.7], [100.51, 13.71], [100.5, 13.71], [100.5, 13.7]]];
const feature = (properties) => ({ type: 'Feature', geometry: { type: 'Polygon', coordinates: square }, properties });
const collection = (...features) => ({ type: 'FeatureCollection', features });

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('zonesUrl', () => {
  it('uses the mock files when no backend URL is set', () => {
    expect(zonesUrl('green', '')).toBe('/mock/green-zones.geojson');
    expect(zonesUrl('grey', '')).toBe('/mock/grey-zones.geojson');
  });

  it('uses the backend endpoints when a base URL is set', () => {
    expect(zonesUrl('green', 'http://localhost:8000/api')).toBe('http://localhost:8000/api/green-zones');
    expect(zonesUrl('grey', 'http://localhost:8000/api')).toBe('http://localhost:8000/api/grey-zones');
  });
});

describe('normalizeCollection', () => {
  it('rejects data that is not a FeatureCollection', () => {
    expect(() => normalizeCollection({ type: 'Feature' }, 'green')).toThrow(/FeatureCollection/);
    expect(() => normalizeCollection(null, 'grey')).toThrow(/FeatureCollection/);
  });

  it('drops features without an id or polygon geometry', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const point = { type: 'Feature', geometry: { type: 'Point', coordinates: [100, 13] }, properties: { id: 'P' } };
    const result = normalizeCollection(collection(feature({ id: 'GZ-1', name: 'A' }), feature({ name: 'no id' }), point), 'green');
    expect(result.features.map((f) => f.properties.id)).toEqual(['GZ-1']);
    expect(console.warn).toHaveBeenCalledTimes(2);
  });

  it('turns bad numbers into null and fills in defaults', () => {
    const result = normalizeCollection(collection(feature({ id: 7, name: 'B', areaM2: 'big', populationNearby: Infinity })), 'green');
    const p = result.features[0].properties;
    expect(p.id).toBe('7');
    expect(p.areaM2).toBeNull();
    expect(p.populationNearby).toBeNull();
    expect(p.nearbyRadiusKm).toBe(1);
    expect(p.type).toBe('Green zone');
  });

  it('normalizes grey zone scores, penalty and nearest park', () => {
    const result = normalizeCollection(
      collection(
        feature({
          id: 'G-014',
          fitness: 0.91,
          rank: 1,
          scores: { greenAccessDeficit: 5, airProximity: 5, heatSeverity: 4 },
          nearestGreenZone: { id: 'GZ-010', name: 'Seri Thai Park', distanceKm: 4.7 },
        }),
      ),
      'grey',
    );
    const p = result.features[0].properties;
    expect(p.scores).toEqual({ greenAccessDeficit: 5, airProximity: 5, heatSeverity: 4 });
    expect(p.penalty).toBe(0);
    expect(p.nearestGreenZone).toEqual({ id: 'GZ-010', name: 'Seri Thai Park', distanceKm: 4.7 });
  });
});

describe('fetchZones', () => {
  it('fetches and normalizes a layer', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => collection(feature({ id: 'GZ-1', name: 'A' })),
    });
    vi.stubGlobal('fetch', fetchMock);
    const result = await fetchZones('green', { baseUrl: '' });
    expect(fetchMock).toHaveBeenCalledWith('/mock/green-zones.geojson', expect.any(Object));
    expect(result.features).toHaveLength(1);
  });

  it('throws on a non-2xx response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 503, json: async () => ({}) }));
    await expect(fetchZones('grey', { baseUrl: 'http://api' })).rejects.toThrow(/HTTP 503/);
  });
});
```

- [ ] **Step 3: Run the test to see it fail**

Run: `npx vitest run src/api/zones.test.js`
Expected: FAIL, because `./zones.js` cannot be resolved.

- [ ] **Step 4: Implement**

<!-- file: src/api/zones.js -->
```js
import { API_URL } from '../config.js';
import { DEFAULT_RADIUS_KM } from '../lib/constants.js';

/** Where a layer's data lives: the backend when VITE_API_URL is set, otherwise the mock file. */
export function zonesUrl(layer, baseUrl = API_URL) {
  return baseUrl ? `${baseUrl}/${layer}-zones` : `/mock/${layer}-zones.geojson`;
}

const num = (value) => (typeof value === 'number' && Number.isFinite(value) ? value : null);
const str = (value) => (typeof value === 'string' && value.trim() !== '' ? value : null);
const isPolygonal = (geometry) =>
  (geometry?.type === 'Polygon' || geometry?.type === 'MultiPolygon') && Array.isArray(geometry.coordinates);

function normalizeGreen(p) {
  return {
    id: String(p.id),
    name: str(p.name) ?? String(p.id),
    nameTh: str(p.nameTh),
    type: str(p.type) ?? 'Green zone',
    district: str(p.district),
    areaM2: num(p.areaM2),
    populationNearby: num(p.populationNearby),
    nearbyRadiusKm: num(p.nearbyRadiusKm) ?? DEFAULT_RADIUS_KM,
    ndvi: num(p.ndvi),
    tempInsideC: num(p.tempInsideC),
    tempAroundC: num(p.tempAroundC),
    updatedAt: str(p.updatedAt),
  };
}

function normalizeGrey(p) {
  const scores = p.scores ?? {};
  const nearest = p.nearestGreenZone;
  return {
    id: String(p.id),
    district: str(p.district),
    areaM2: num(p.areaM2),
    populationNearby: num(p.populationNearby),
    nearbyRadiusKm: num(p.nearbyRadiusKm) ?? DEFAULT_RADIUS_KM,
    fitness: num(p.fitness),
    rank: num(p.rank),
    scores: {
      greenAccessDeficit: num(scores.greenAccessDeficit),
      airProximity: num(scores.airProximity),
      heatSeverity: num(scores.heatSeverity),
    },
    penalty: num(p.penalty) ?? 0,
    ndvi: num(p.ndvi),
    surfaceTempC: num(p.surfaceTempC),
    nearestGreenZone:
      nearest && typeof nearest === 'object'
        ? { id: str(nearest.id), name: str(nearest.name), distanceKm: num(nearest.distanceKm) }
        : null,
    updatedAt: str(p.updatedAt),
  };
}

const NORMALIZERS = { green: normalizeGreen, grey: normalizeGrey };

/** Checks a FeatureCollection and normalizes every feature's properties (see docs/API.md). */
export function normalizeCollection(json, layer) {
  if (json?.type !== 'FeatureCollection' || !Array.isArray(json.features)) {
    throw new Error(`The ${layer} zone data is not a GeoJSON FeatureCollection.`);
  }
  const normalize = NORMALIZERS[layer];
  const features = [];
  for (const feature of json.features) {
    const id = feature?.properties?.id;
    if (id === undefined || id === null || id === '' || !isPolygonal(feature.geometry)) {
      console.warn(`Skipping a ${layer} zone without an id or polygon geometry`, feature);
      continue;
    }
    features.push({ type: 'Feature', geometry: feature.geometry, properties: normalize(feature.properties) });
  }
  return { type: 'FeatureCollection', features };
}

/** Loads one layer ('green' or 'grey'). Throws on network errors, non-2xx responses and bad data. */
export async function fetchZones(layer, { baseUrl = API_URL, signal } = {}) {
  const url = zonesUrl(layer, baseUrl);
  const response = await fetch(url, { signal, headers: { Accept: 'application/geo+json, application/json' } });
  if (!response.ok) throw new Error(`Loading ${url} failed with HTTP ${response.status}.`);
  return normalizeCollection(await response.json(), layer);
}
```

- [ ] **Step 5: Run the test to see it pass**

Run: `npx vitest run src/api/zones.test.js`
Expected: PASS (8 tests).

---

### Task 6: Mock data and its contract test

The mock files are generated once by two throwaway scripts that run **outside** the project, so the project gets no extra dependencies. The park outlines are real OpenStreetMap data. Every statistic, and every grey zone location, is made up.

**Files:**
- Create (outside the project, in a temp folder such as `%TEMP%\greensight-mockgen`): `fetch-osm.mjs`, `make-mock-data.mjs`
- Create (generated): `public/mock/green-zones.geojson`, `public/mock/grey-zones.geojson`
- Test: `src/api/mockData.test.js`

- [ ] **Step 1: Write the failing contract test**

<!-- file: src/api/mockData.test.js -->
```js
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { normalizeCollection } from './zones.js';

// Plain path maths on purpose: Vite rewrites `new URL(`…${x}`, import.meta.url)` into an asset lookup.
const MOCK_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../public/mock');
const load = (file) => JSON.parse(readFileSync(path.join(MOCK_DIR, file), 'utf8'));

const REQUIRED = {
  green: ['id', 'name', 'district', 'areaM2', 'populationNearby'],
  grey: ['id', 'district', 'areaM2', 'populationNearby', 'fitness', 'rank'],
};

describe.each([
  ['green', 'green-zones.geojson'],
  ['grey', 'grey-zones.geojson'],
])('mock %s zones follow docs/API.md', (layer, file) => {
  const raw = load(file);
  const { features } = normalizeCollection(raw, layer);

  it('keeps every feature (all have an id and polygon geometry)', () => {
    expect(features.length).toBeGreaterThan(0);
    expect(features.length).toBe(raw.features.length);
  });

  it('has every required field', () => {
    for (const { properties } of features) {
      for (const key of REQUIRED[layer]) {
        expect(properties[key], `${properties.id}.${key}`).not.toBeNull();
      }
    }
  });

  it('has unique ids', () => {
    const ids = features.map((f) => f.properties.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('mock grey zones', () => {
  const { features } = normalizeCollection(load('grey-zones.geojson'), 'grey');

  it('has ranks 1..N, fitness 0–1 and integer scores 1–5', () => {
    const ranks = features.map((f) => f.properties.rank).sort((a, b) => a - b);
    expect(ranks).toEqual(features.map((_, i) => i + 1));
    for (const { properties: p } of features) {
      expect(p.fitness).toBeGreaterThanOrEqual(0);
      expect(p.fitness).toBeLessThanOrEqual(1);
      for (const score of Object.values(p.scores)) {
        expect(Number.isInteger(score) && score >= 1 && score <= 5).toBe(true);
      }
    }
  });
});
```

- [ ] **Step 2: Run the test to see it fail**

Run: `npx vitest run src/api/mockData.test.js`
Expected: FAIL with `ENOENT` (the mock files do not exist yet).

- [ ] **Step 3: Set up the throwaway generator folder**

Run (bash; `$TEMP` is the Windows temp folder):
```bash
mkdir -p "$TEMP/greensight-mockgen" && cd "$TEMP/greensight-mockgen" && npm init -y && npm install osmtogeojson@3.0.0-beta.5 @turf/area@7 @turf/simplify@7
```

Save these two files in that folder:

```js
// fetch-osm.mjs: download the 10 park outlines from the OpenStreetMap API (v0.6) into osm-raw.json.
import fs from 'node:fs';

const OBJECTS = [
  'way/23483299', // Lumphini Park
  'way/23486417', // Chatuchak Park
  'way/23487144', // Benchasiri Park
  'way/23487550', // Wachirabenchathat Park
  'way/26576748', // Thonburirom Park
  'way/33042465', // Suan Luang Rama IX
  'way/56297939', // Seri Thai Park
  'way/99029135', // Santiphap Park
  'way/864170465', // Benchakitti Forest Park
  'way/1306732424', // Benjakitti Park
  'relation/10904051', // Rommaninat Park
];

const elements = new Map();
for (const obj of OBJECTS) {
  const res = await fetch(`https://api.openstreetmap.org/api/0.6/${obj}/full.json`, {
    headers: { 'User-Agent': 'GreenSight-hackathon-mockdata/0.1 (one-off script)', Accept: 'application/json' },
    signal: AbortSignal.timeout(60000),
  });
  if (!res.ok) throw new Error(`${obj}: HTTP ${res.status}`);
  const json = await res.json();
  for (const el of json.elements) elements.set(`${el.type}/${el.id}`, el);
  console.log(`${obj}: ${json.elements.length} elements`);
}
fs.writeFileSync('osm-raw.json', JSON.stringify({ version: '0.6', elements: [...elements.values()] }));
console.log(`saved ${elements.size} unique elements to osm-raw.json`);
```

```js
// make-mock-data.mjs: build green-zones.geojson and grey-zones.geojson.
// Usage: node make-mock-data.mjs <output-dir>   (needs osm-raw.json from fetch-osm.mjs)
import fs from 'node:fs';
import path from 'node:path';
import osmtogeojson from 'osmtogeojson';
import area from '@turf/area';
import simplify from '@turf/simplify';

const outDir = process.argv[2];
if (!outDir) throw new Error('Usage: node make-mock-data.mjs <output-dir>');

const UPDATED = '2026-09-30';
const NOTE = 'Mock data for the GreenSight frontend. Park outlines © OpenStreetMap contributors (ODbL). All statistics, and all grey zone locations, are made up.';

// Green zones: real OpenStreetMap outlines + made-up statistics.
const GREEN = [
  { id: 'GZ-001', osm: ['way/33042465'], name: 'Suan Luang Rama IX', nameTh: 'สวนหลวง ร.๙', district: 'Prawet', populationNearby: 21000, ndvi: 0.62, tempInsideC: 31.2, tempAroundC: 35.8 },
  { id: 'GZ-002', osm: ['way/23483299'], name: 'Lumphini Park', nameTh: 'สวนลุมพินี', district: 'Pathum Wan', populationNearby: 56000, ndvi: 0.58, tempInsideC: 30.9, tempAroundC: 36.4 },
  { id: 'GZ-003', osm: ['way/23486417'], name: 'Chatuchak Park', nameTh: 'สวนจตุจักร', district: 'Chatuchak', populationNearby: 49000, ndvi: 0.55, tempInsideC: 32.4, tempAroundC: 36.0 },
  { id: 'GZ-004', osm: ['way/23487550'], name: 'Wachirabenchathat Park', nameTh: 'สวนวชิรเบญจทัศ', district: 'Chatuchak', populationNearby: 41000, ndvi: 0.6, tempInsideC: 31.8, tempAroundC: 35.9 },
  { id: 'GZ-005', osm: ['way/864170465', 'way/1306732424'], name: 'Benchakitti Park', nameTh: 'สวนเบญจกิติ', district: 'Khlong Toei', populationNearby: 88000, ndvi: 0.52, tempInsideC: 32.0, tempAroundC: 36.6 },
  { id: 'GZ-006', osm: ['way/23487144'], name: 'Benchasiri Park', nameTh: 'อุทยานเบญจสิริ', district: 'Khlong Toei', populationNearby: 52000, ndvi: 0.49, tempInsideC: 34.1, tempAroundC: 36.5 },
  { id: 'GZ-007', osm: ['way/99029135'], name: 'Santiphap Park', nameTh: 'สวนสันติภาพ', district: 'Ratchathewi', populationNearby: 41000, ndvi: 0.47, tempInsideC: 34.9, tempAroundC: 36.3 },
  { id: 'GZ-008', osm: ['relation/10904051'], name: 'Rommaninat Park', nameTh: 'สวนรมณีนาถ', district: 'Phra Nakhon', populationNearby: 33000, ndvi: 0.44, tempInsideC: 34.6, tempAroundC: 36.2 },
  { id: 'GZ-009', osm: ['way/26576748'], name: 'Thonburirom Park', nameTh: 'สวนธนบุรีรมย์', district: 'Thung Khru', populationNearby: 27000, ndvi: 0.57, tempInsideC: 33.1, tempAroundC: 35.4 },
  { id: 'GZ-010', osm: ['way/56297939'], name: 'Seri Thai Park', nameTh: 'สวนเสรีไทย', district: 'Bueng Kum', populationNearby: 19000, ndvi: 0.59, tempInsideC: 31.9, tempAroundC: 35.1 },
];

// Grey zones: the 8 sites, scores and fitness values from the report's illustrative priority
// table (section 4.2). Locations, sizes and the other values are made up.
const GREY = [
  { id: 'G-014', rank: 1, fitness: 0.91, scores: [5, 5, 4], penalty: 0, district: 'Bang Kapi', center: [13.766, 100.629], areaM2: 12400, populationNearby: 38000, ndvi: 0.08, surfaceTempC: 37.4, aspect: 1.4, angle: 12 },
  { id: 'G-032', rank: 2, fitness: 0.84, scores: [5, 3, 5], penalty: 0, district: 'Bang Bon', center: [13.664, 100.417], areaM2: 21800, populationNearby: 9500, ndvi: 0.11, surfaceTempC: 38.1, aspect: 1.8, angle: -8 },
  { id: 'G-007', rank: 3, fitness: 0.76, scores: [3, 4, 3], penalty: 0, district: 'Huai Khwang', center: [13.777, 100.574], areaM2: 9600, populationNearby: 52000, ndvi: 0.06, surfaceTempC: 36.6, aspect: 1.2, angle: 25 },
  { id: 'G-021', rank: 4, fitness: 0.71, scores: [4, 2, 4], penalty: 0, district: 'Bang Na', center: [13.674, 100.605], areaM2: 15300, populationNearby: 17000, ndvi: 0.14, surfaceTempC: 37.0, aspect: 1.5, angle: 0 },
  { id: 'G-045', rank: 5, fitness: 0.65, scores: [2, 5, 3], penalty: 0, district: 'Din Daeng', center: [13.766, 100.552], areaM2: 8600, populationNearby: 49000, ndvi: 0.12, surfaceTempC: 36.2, aspect: 1.3, angle: 18 },
  { id: 'G-009', rank: 6, fitness: 0.58, scores: [3, 3, 2], penalty: 0, district: 'Bang Sue', center: [13.823, 100.525], areaM2: 6900, populationNearby: 31000, ndvi: 0.17, surfaceTempC: 35.0, aspect: 1.1, angle: -15 },
  { id: 'G-038', rank: 7, fitness: 0.54, scores: [4, 1, 3], penalty: 0.05, district: 'Taling Chan', center: [13.777, 100.437], areaM2: 18200, populationNearby: 6800, ndvi: 0.24, surfaceTempC: 35.8, aspect: 2.0, angle: 5 },
  { id: 'G-016', rank: 8, fitness: 0.41, scores: [2, 2, 2], penalty: 0, district: 'Prawet', center: [13.696, 100.648], areaM2: 5100, populationNearby: 14000, ndvi: 0.21, surfaceTempC: 35.1, aspect: 1.2, angle: 30 },
];

const round6 = (n) => Math.round(n * 1e6) / 1e6;
const roundCoords = (c) => (typeof c[0] === 'number' ? [round6(c[0]), round6(c[1])] : c.map(roundCoords));

// --- green zones -----------------------------------------------------------
const osm = JSON.parse(fs.readFileSync('osm-raw.json', 'utf8'));
const osmFeatures = new Map(osmtogeojson(osm).features.map((f) => [f.id, f]));

const greenFeatures = GREEN.map(({ osm: ids, ...props }) => {
  const polygons = ids.map((id) => {
    const f = osmFeatures.get(id);
    if (!f || f.geometry.type !== 'Polygon') throw new Error(`${id} is missing or not a Polygon`);
    return simplify(f, { tolerance: 0.00004, highQuality: true }).geometry.coordinates;
  });
  const geometry = polygons.length === 1
    ? { type: 'Polygon', coordinates: roundCoords(polygons[0]) }
    : { type: 'MultiPolygon', coordinates: polygons.map(roundCoords) };
  const properties = {
    id: props.id,
    name: props.name,
    nameTh: props.nameTh,
    type: 'Public park',
    district: props.district,
    areaM2: Math.round(area({ type: 'Feature', geometry, properties: {} })),
    populationNearby: props.populationNearby,
    nearbyRadiusKm: 1,
    ndvi: props.ndvi,
    tempInsideC: props.tempInsideC,
    tempAroundC: props.tempAroundC,
    updatedAt: UPDATED,
  };
  return { type: 'Feature', properties, geometry };
});

// --- grey zones ------------------------------------------------------------
const M_PER_DEG_LAT = 110574;
const mPerDegLng = (lat) => 111320 * Math.cos((lat * Math.PI) / 180);

/** A rotated rectangle of the given area (m²) around [lat, lng], as a GeoJSON ring. */
function plot([lat, lng], areaM2, aspect, angleDeg) {
  const h = Math.sqrt(areaM2 / aspect);
  const w = h * aspect;
  const a = (angleDeg * Math.PI) / 180;
  const corners = [[-w / 2, -h / 2], [w / 2, -h / 2], [w / 2, h / 2], [-w / 2, h / 2]].map(([x, y]) => {
    const rx = x * Math.cos(a) - y * Math.sin(a);
    const ry = x * Math.sin(a) + y * Math.cos(a);
    return [lng + rx / mPerDegLng(lat), lat + ry / M_PER_DEG_LAT];
  });
  return [...corners, corners[0]];
}

/** Distance in km from [lat, lng] to the nearest edge of a green zone (local flat projection). */
function distanceToZoneKm([lat, lng], geometry) {
  const kx = mPerDegLng(lat);
  const toXY = ([x, y]) => [(x - lng) * kx, (y - lat) * M_PER_DEG_LAT];
  const polygons = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates;
  let best = Infinity;
  for (const ring of polygons.map((p) => p[0])) {
    for (let i = 1; i < ring.length; i++) {
      const [ax, ay] = toXY(ring[i - 1]);
      const [bx, by] = toXY(ring[i]);
      const dx = bx - ax;
      const dy = by - ay;
      const t = Math.max(0, Math.min(1, -(ax * dx + ay * dy) / (dx * dx + dy * dy || 1)));
      best = Math.min(best, Math.hypot(ax + t * dx, ay + t * dy));
    }
  }
  return best / 1000;
}

const greyFeatures = GREY.map((g) => {
  const nearest = greenFeatures
    .map((f) => ({ f, km: distanceToZoneKm(g.center, f.geometry) }))
    .sort((a, b) => a.km - b.km)[0];
  const properties = {
    id: g.id,
    district: g.district,
    areaM2: g.areaM2,
    populationNearby: g.populationNearby,
    nearbyRadiusKm: 1,
    fitness: g.fitness,
    rank: g.rank,
    scores: { greenAccessDeficit: g.scores[0], airProximity: g.scores[1], heatSeverity: g.scores[2] },
    penalty: g.penalty,
    ndvi: g.ndvi,
    surfaceTempC: g.surfaceTempC,
    nearestGreenZone: {
      id: nearest.f.properties.id,
      name: nearest.f.properties.name,
      distanceKm: Math.round(nearest.km * 10) / 10,
    },
    updatedAt: UPDATED,
  };
  const geometry = { type: 'Polygon', coordinates: [roundCoords(plot(g.center, g.areaM2, g.aspect, g.angle))] };
  return { type: 'Feature', properties, geometry };
});

// --- write: readable properties, one-line geometry ---------------------------
function write(file, features) {
  const body = features
    .map((f) => {
      const props = JSON.stringify(f.properties, null, 2).replace(/\n/g, '\n      ');
      return `    {\n      "type": "Feature",\n      "properties": ${props},\n      "geometry": ${JSON.stringify(f.geometry)}\n    }`;
    })
    .join(',\n');
  const text = `{\n  "type": "FeatureCollection",\n  "metadata": ${JSON.stringify({ note: NOTE })},\n  "features": [\n${body}\n  ]\n}\n`;
  JSON.parse(text);
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, file), text);
  console.log(`wrote ${path.join(outDir, file)} (${features.length} features, ${text.length} bytes)`);
}

write('green-zones.geojson', greenFeatures);
write('grey-zones.geojson', greyFeatures);
for (const f of greenFeatures) {
  const p = f.properties;
  console.log(p.id, p.name.padEnd(24), String(p.areaM2).padStart(7), 'm²', (p.areaM2 / p.populationNearby).toFixed(1).padStart(5), 'm²/person');
}
for (const f of greyFeatures) {
  const p = f.properties;
  console.log(p.id, p.district.padEnd(12), 'nearest', p.nearestGreenZone.name.padEnd(24), p.nearestGreenZone.distanceKm, 'km');
}
```

- [ ] **Step 4: Generate the files into the project**

Run (from the temp folder):
```bash
node fetch-osm.mjs && node make-mock-data.mjs "C:/Users/poohk/OneDrive/Desktop/UI-Front/public/mock"
```
Expected:
- `wrote …green-zones.geojson (10 features, …)` and `wrote …grey-zones.geojson (8 features, …)`.
- Values of m²/person that cover all 3 statuses: ≥ 9 (GZ-001, GZ-002, GZ-004), 3–9 (GZ-003, GZ-005, GZ-009, GZ-010) and < 3 (GZ-006, GZ-007, GZ-008).

- [ ] **Step 5: Run the contract test to see it pass**

Run (from the project root): `npx vitest run src/api/mockData.test.js`
Expected: PASS (7 tests).

---

### Task 7: Loading state hook

**Files:**
- Create: `src/hooks/useZones.js`
- Test: `src/hooks/useZones.test.js`

- [ ] **Step 1: Write the failing test**

<!-- file: src/hooks/useZones.test.js -->
```js
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import useZones from './useZones.js';
import { fetchZones } from '../api/zones.js';

vi.mock('../api/zones.js', () => ({ fetchZones: vi.fn() }));

const collection = (id) => ({ type: 'FeatureCollection', features: [{ type: 'Feature', geometry: null, properties: { id } }] });

beforeEach(() => {
  vi.mocked(fetchZones).mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('useZones', () => {
  it('loads both layers and becomes ready', async () => {
    vi.mocked(fetchZones).mockImplementation(async (layer) => collection(layer));
    const { result } = renderHook(() => useZones());
    expect(result.current.status).toBe('loading');
    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(result.current.green.features[0].properties.id).toBe('green');
    expect(result.current.grey.features[0].properties.id).toBe('grey');
    expect(result.current.version).toBe(1);
  });

  it('reports an error, then loads again on reload', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(fetchZones).mockRejectedValue(new Error('offline'));
    const { result } = renderHook(() => useZones());
    await waitFor(() => expect(result.current.status).toBe('error'));

    vi.mocked(fetchZones).mockImplementation(async (layer) => collection(layer));
    act(() => result.current.reload());
    expect(result.current.status).toBe('loading');
    await waitFor(() => expect(result.current.status).toBe('ready'));
  });
});
```

- [ ] **Step 2: Run the test to see it fail**

Run: `npx vitest run src/hooks/useZones.test.js`
Expected: FAIL, because `./useZones.js` cannot be resolved.

- [ ] **Step 3: Implement**

<!-- file: src/hooks/useZones.js -->
```js
import { useCallback, useEffect, useState } from 'react';
import { fetchZones } from '../api/zones.js';

/**
 * Loads the green and grey zone layers together.
 * Returns { status: 'loading' | 'ready' | 'error', green, grey, error, version, reload }.
 * `version` goes up by one after every successful load (the map uses it to redraw).
 */
export default function useZones() {
  const [state, setState] = useState({ status: 'loading', green: null, grey: null, error: null, version: 0 });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    Promise.all([
      fetchZones('green', { signal: controller.signal }),
      fetchZones('grey', { signal: controller.signal }),
    ])
      .then(([green, grey]) => {
        setState((prev) => ({ status: 'ready', green, grey, error: null, version: prev.version + 1 }));
      })
      .catch((error) => {
        if (controller.signal.aborted) return;
        console.error(error);
        setState((prev) => ({ ...prev, status: 'error', error }));
      });
    return () => controller.abort();
  }, [attempt]);

  const reload = useCallback(() => {
    setState((prev) => ({ ...prev, status: 'loading', error: null }));
    setAttempt((n) => n + 1);
  }, []);

  return { ...state, reload };
}
```

- [ ] **Step 4: Run the test to see it pass**

Run: `npx vitest run src/hooks/useZones.test.js`
Expected: PASS (2 tests).

---

### Task 8: UI building blocks

These are small presentational components. The Sidebar tests in Task 10 cover them.

**Files:**
- Create: `src/components/ui/Card.jsx`, `StatusBadge.jsx`, `InfoList.jsx`, `StatPair.jsx`, `LoadingCards.jsx`, `ErrorCard.jsx`

- [ ] **Step 1: Create the components**

<!-- file: src/components/ui/Card.jsx -->
```jsx
import { useId } from 'react';

/** One of the 4 sidebar cards: a small title and its content. */
export default function Card({ title, children }) {
  const titleId = useId();
  return (
    <section aria-labelledby={titleId} className="rounded-xl border border-line bg-card px-4 py-3.5">
      <h3 id={titleId} className="mb-2 text-xs font-medium text-ink-2">
        {title}
      </h3>
      {children}
    </section>
  );
}
```

<!-- file: src/components/ui/StatusBadge.jsx -->
```jsx
import { CircleCheck, CircleQuestionMark, OctagonAlert, TriangleAlert } from 'lucide-react';

const ICONS = { good: CircleCheck, warning: TriangleAlert, critical: OctagonAlert, none: CircleQuestionMark };

/** Status as icon + word + color together, never color alone. */
export default function StatusBadge({ status }) {
  const Icon = ICONS[status.level] ?? CircleQuestionMark;
  return (
    <p className="mt-1 flex items-center justify-center gap-1.5 text-sm text-ink">
      <Icon size={16} color={status.color} aria-hidden="true" />
      {status.label}
    </p>
  );
}
```

<!-- file: src/components/ui/InfoList.jsx -->
```jsx
/** Label / value rows for the Info card. `rows` is a list of [label, value] pairs. */
export default function InfoList({ rows }) {
  return (
    <dl className="divide-y divide-line text-sm">
      {rows.map(([label, value]) => (
        <div key={label} className="flex justify-between gap-4 py-1.5">
          <dt className="shrink-0 text-ink-3">{label}</dt>
          <dd className="text-right text-ink">{value}</dd>
        </div>
      ))}
    </dl>
  );
}
```

<!-- file: src/components/ui/StatPair.jsx -->
```jsx
/** Two headline numbers side by side, with an optional line of explanation under them. */
export default function StatPair({ items, note }) {
  return (
    <div>
      <dl className="grid grid-cols-2 gap-3">
        {items.map(({ label, value }) => (
          <div key={label}>
            <dt className="text-xs text-ink-3">{label}</dt>
            <dd className="mt-0.5 text-xl font-semibold text-ink">{value}</dd>
          </div>
        ))}
      </dl>
      {note && <p className="mt-2 text-xs text-ink-3">{note}</p>}
    </div>
  );
}
```

<!-- file: src/components/ui/LoadingCards.jsx -->
```jsx
const HEIGHTS = [190, 104, 128, 140];

/** Grey placeholder cards shown while the zone data loads. */
export default function LoadingCards() {
  return (
    <div className="space-y-3" aria-busy="true" aria-label="Loading zone data">
      {HEIGHTS.map((height) => (
        <div key={height} className="animate-pulse rounded-xl border border-line bg-card" style={{ height }} />
      ))}
    </div>
  );
}
```

<!-- file: src/components/ui/ErrorCard.jsx -->
```jsx
import { RefreshCw, TriangleAlert } from 'lucide-react';
import { COLORS } from '../../lib/constants.js';

/** Shown when the zone data can't be loaded. Retry loads both layers again. */
export default function ErrorCard({ onRetry }) {
  return (
    <section role="alert" className="rounded-xl border border-line bg-card px-4 py-4">
      <p className="flex items-center gap-2 font-medium text-ink">
        <TriangleAlert size={18} color={COLORS.warning} aria-hidden="true" />
        Couldn't load zone data
      </p>
      <p className="mt-1 text-sm text-ink-2">Check that the backend is running, then try again.</p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-white/20 px-3 py-1.5 text-sm text-ink hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
      >
        <RefreshCw size={14} aria-hidden="true" />
        Retry
      </button>
    </section>
  );
}
```

- [ ] **Step 2: Check that it still builds**

Run: `npm run build`
Expected: builds with no errors. Unused files are fine at this point.

---

### Task 9: Charts

**Files:**
- Create: `src/components/charts/HalfPieGauge.jsx`, `CoolingChart.jsx`, `FactorBars.jsx`, `PriorityBar.jsx`
- Test: `src/components/charts/HalfPieGauge.test.jsx`

- [ ] **Step 1: Write the failing gauge test**

<!-- file: src/components/charts/HalfPieGauge.test.jsx -->
```jsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import HalfPieGauge from './HalfPieGauge.jsx';

describe('HalfPieGauge', () => {
  it('fills the arc in proportion to the value and shows the number', () => {
    render(<HalfPieGauge fraction={0.25} color="#fab219" value="4.5" unit="m² per person" label="Gauge" />);
    expect(screen.getByText('4.5')).toBeTruthy();
    expect(screen.getByText('m² per person')).toBeTruthy();
    expect(screen.getByTestId('gauge-fill').getAttribute('stroke-dasharray')).toBe('25 100');
  });

  it('clamps values beyond the end of the scale', () => {
    render(<HalfPieGauge fraction={3} color="#0ca30c" value="54.0" unit="m² per person" label="Gauge" />);
    expect(screen.getByTestId('gauge-fill').getAttribute('stroke-dasharray')).toBe('100 100');
  });

  it('shows "No data" and an empty track when there is no value', () => {
    render(<HalfPieGauge fraction={null} color="#8a8983" value="—" unit="m² per person" label="Gauge" />);
    expect(screen.getByText('No data')).toBeTruthy();
    expect(screen.queryByTestId('gauge-fill')).toBeNull();
  });

  it('draws a labelled target tick', () => {
    render(<HalfPieGauge fraction={0.4} color="#fab219" value="7.49" unit="m²" tick={0.5} tickLabel="target 9" label="Gauge" />);
    expect(screen.getByText('target 9')).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run the test to see it fail**

Run: `npx vitest run src/components/charts/HalfPieGauge.test.jsx`
Expected: FAIL, because `./HalfPieGauge.jsx` cannot be resolved.

- [ ] **Step 3: Implement the gauge**

<!-- file: src/components/charts/HalfPieGauge.jsx -->
```jsx
const ARC = 'M 20 100 A 80 80 0 0 1 180 100';

/** Point on the gauge circle at a fraction of the way along it (0 = left end, 1 = right end). */
function pointAt(fraction, radius) {
  const angle = Math.PI * (1 - fraction);
  return [100 + radius * Math.cos(angle), 100 - radius * Math.sin(angle)];
}

/**
 * Semicircle gauge (the sketch's "half pie chart"). The arc fills from left to right.
 * fraction: 0–1 (clamped), or null for "No data". tick: optional 0–1 position of a target mark.
 */
export default function HalfPieGauge({ fraction, color, value, unit, tick, tickLabel, label }) {
  const hasValue = typeof fraction === 'number' && Number.isFinite(fraction);
  const filled = hasValue ? Math.min(1, Math.max(0, fraction)) * 100 : 0;
  const [tx1, ty1] = tick == null ? [] : pointAt(tick, 66);
  const [tx2, ty2] = tick == null ? [] : pointAt(tick, 94);

  return (
    <svg viewBox="0 -18 200 130" className="mx-auto block w-full max-w-64" role="img" aria-label={label}>
      <path d={ARC} fill="none" stroke={color} strokeOpacity={0.22} strokeWidth={16} pathLength={100} />
      {filled > 0 && (
        <path
          d={ARC}
          fill="none"
          stroke={color}
          strokeWidth={16}
          pathLength={100}
          strokeDasharray={`${filled} 100`}
          data-testid="gauge-fill"
        />
      )}
      {tick != null && (
        <>
          <line x1={tx1} y1={ty1} x2={tx2} y2={ty2} className="stroke-ink" strokeWidth={2} />
          {tickLabel && (
            <text x={tx2} y={ty2 - 6} textAnchor="middle" fontSize={11} className="fill-ink-2">
              {tickLabel}
            </text>
          )}
        </>
      )}
      {hasValue ? (
        <>
          <text x={100} y={84} textAnchor="middle" fontSize={40} fontWeight={600} className="fill-ink">
            {value}
          </text>
          <text x={100} y={103} textAnchor="middle" fontSize={11} className="fill-ink-2">
            {unit}
          </text>
        </>
      ) : (
        <text x={100} y={88} textAnchor="middle" fontSize={18} className="fill-ink-3">
          No data
        </text>
      )}
    </svg>
  );
}
```

- [ ] **Step 4: Run the test to see it pass**

Run: `npx vitest run src/components/charts/HalfPieGauge.test.jsx`
Expected: PASS (4 tests).

- [ ] **Step 5: Create the other three charts**

<!-- file: src/components/charts/CoolingChart.jsx -->
```jsx
import { COLORS } from '../../lib/constants.js';
import { formatDecimal, formatTemp } from '../../lib/format.js';
import { coolingEffect } from '../../lib/metrics.js';

const WIDTH = 240;
const PAD = 14;
const Y = 16;

/** Dumbbell chart: temperature inside the park vs. the area around it. */
export default function CoolingChart({ insideC, aroundC, radiusKm }) {
  const cooling = coolingEffect(insideC, aroundC);
  if (!cooling) return <p className="text-sm text-ink-3">No temperature data</p>;

  const [lo, hi] = cooling.domain;
  const x = (t) => PAD + ((t - lo) / (hi - lo)) * (WIDTH - 2 * PAD);
  const headline =
    cooling.delta > 0 ? `${formatDecimal(cooling.delta, 1)}°C cooler than around it` : 'No cooling measured';

  return (
    <div>
      <p className="text-lg font-semibold text-ink">{headline}</p>
      <svg
        viewBox={`0 0 ${WIDTH} 44`}
        className="mt-2 block w-full"
        role="img"
        aria-label={`Inside the park ${formatTemp(insideC)}, within ${radiusKm} km ${formatTemp(aroundC)}`}
      >
        <line x1={PAD} y1={Y} x2={WIDTH - PAD} y2={Y} className="stroke-white/15" />
        <line x1={x(insideC)} y1={Y} x2={x(aroundC)} y2={Y} stroke={COLORS.noData} strokeWidth={2} />
        <circle cx={x(insideC)} cy={Y} r={6} fill={COLORS.dataBlue} className="stroke-card" strokeWidth={2} />
        <circle cx={x(aroundC)} cy={Y} r={6} fill={COLORS.dataOrange} className="stroke-card" strokeWidth={2} />
        <text x={PAD} y={40} fontSize={11} className="fill-ink-3">
          {lo}°C
        </text>
        <text x={WIDTH - PAD} y={40} fontSize={11} textAnchor="end" className="fill-ink-3">
          {hi}°C
        </text>
      </svg>
      <ul className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-2">
        <li className="flex items-center gap-1.5">
          <span className="size-2 rounded-full" style={{ background: COLORS.dataBlue }} aria-hidden="true" />
          Inside park {formatTemp(insideC)}
        </li>
        <li className="flex items-center gap-1.5">
          <span className="size-2 rounded-full" style={{ background: COLORS.dataOrange }} aria-hidden="true" />
          Within {radiusKm} km {formatTemp(aroundC)}
        </li>
      </ul>
    </div>
  );
}
```

<!-- file: src/components/charts/FactorBars.jsx -->
```jsx
import { COLORS } from '../../lib/constants.js';
import { formatDecimal } from '../../lib/format.js';

const FACTORS = [
  { key: 'greenAccessDeficit', label: 'Far from parks', technical: 'GreenAccessDeficit' },
  { key: 'airProximity', label: 'Near busy roads', technical: 'AirProximity' },
  { key: 'heatSeverity', label: 'Surface heat', technical: 'HeatSeverity' },
];

/** "Why this site?": the three fitness factors on the report's 1–5 scale. */
export default function FactorBars({ scores, penalty }) {
  return (
    <div className="space-y-3">
      {FACTORS.map(({ key, label, technical }) => {
        const score = scores?.[key];
        const hasScore = typeof score === 'number';
        const width = hasScore ? (Math.min(5, Math.max(0, score)) / 5) * 100 : 0;
        return (
          <div key={key}>
            <div className="flex items-baseline justify-between text-sm">
              <span className="text-ink">{label}</span>
              <span className="tabular-nums text-ink">{hasScore ? `${score} / 5` : '—'}</span>
            </div>
            <p className="text-xs text-ink-3">{technical}</p>
            <div className="mt-1 h-2 bg-white/10" role="img" aria-label={`${label}: ${hasScore ? `${score} out of 5` : 'no data'}`}>
              <div className="h-2 rounded-r" style={{ width: `${width}%`, background: COLORS.dataBlue }} />
            </div>
          </div>
        );
      })}
      {penalty > 0 && (
        <p className="flex justify-between gap-3 border-t border-line pt-2 text-sm">
          <span className="text-ink">
            Hard to develop <span className="text-xs text-ink-3">(Surrounded penalty)</span>
          </span>
          <span className="tabular-nums text-ink">−{formatDecimal(penalty, 2)}</span>
        </p>
      )}
    </div>
  );
}
```

<!-- file: src/components/charts/PriorityBar.jsx -->
```jsx
import { TIER_ORDER } from '../../lib/metrics.js';

/** One stacked bar: how many candidate sites are in each priority tier. */
export default function PriorityBar({ counts }) {
  const total = TIER_ORDER.reduce((sum, tier) => sum + (counts[tier.key] ?? 0), 0);
  if (total === 0) return <p className="text-sm text-ink-3">No candidate sites loaded</p>;

  return (
    <div>
      <div
        className="flex h-3 gap-0.5"
        role="img"
        aria-label={TIER_ORDER.map((tier) => `${tier.label}: ${counts[tier.key]}`).join(', ')}
      >
        {TIER_ORDER.filter((tier) => counts[tier.key] > 0).map((tier) => (
          <div
            key={tier.key}
            className="basis-0 first:rounded-l last:rounded-r"
            style={{ flexGrow: counts[tier.key], background: tier.color }}
            title={`${tier.label}: ${counts[tier.key]}`}
          />
        ))}
      </div>
      <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-2">
        {TIER_ORDER.map((tier) => (
          <li key={tier.key} className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-sm ring-1 ring-white/25" style={{ background: tier.color }} aria-hidden="true" />
            {tier.short} {counts[tier.key]}
          </li>
        ))}
      </ul>
    </div>
  );
}
```

- [ ] **Step 6: Run all tests so far**

Run: `npm test`
Expected: PASS (all test files).

---

### Task 10: Sidebar and its three panels

**Files:**
- Create: `src/components/sidebar/PanelHeader.jsx`, `GreenZonePanel.jsx`, `GreyZonePanel.jsx`, `OverviewPanel.jsx`, `Sidebar.jsx`
- Test: `src/components/sidebar/Sidebar.test.jsx`

- [ ] **Step 1: Write the failing test**

<!-- file: src/components/sidebar/Sidebar.test.jsx -->
```jsx
import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import Sidebar from './Sidebar.jsx';

const square = { type: 'Polygon', coordinates: [[[100.5, 13.7], [100.51, 13.7], [100.51, 13.71], [100.5, 13.71], [100.5, 13.7]]] };

const green = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      geometry: square,
      properties: {
        id: 'GZ-001',
        name: 'Suan Luang Rama IX',
        nameTh: 'สวนหลวง ร.๙',
        type: 'Public park',
        district: 'Prawet',
        areaM2: 800000,
        populationNearby: 21000,
        nearbyRadiusKm: 1,
        ndvi: 0.62,
        tempInsideC: 31.2,
        tempAroundC: 35.8,
        updatedAt: '2026-09-30',
      },
    },
  ],
};

const greyZone = (id, rank, fitness) => ({
  type: 'Feature',
  geometry: square,
  properties: {
    id,
    district: 'Bang Kapi',
    areaM2: 12400,
    populationNearby: 38000,
    nearbyRadiusKm: 1,
    fitness,
    rank,
    scores: { greenAccessDeficit: 5, airProximity: 5, heatSeverity: 4 },
    penalty: 0,
    ndvi: 0.08,
    surfaceTempC: 37.4,
    nearestGreenZone: { id: 'GZ-010', name: 'Seri Thai Park', distanceKm: 4.7 },
    updatedAt: null,
  },
});

const grey = {
  type: 'FeatureCollection',
  features: [0.91, 0.84, 0.76, 0.71, 0.65, 0.58, 0.54, 0.41].map((fitness, i) =>
    greyZone(i === 0 ? 'G-014' : `G-${i}`, i + 1, fitness),
  ),
};

const renderSidebar = (props = {}) =>
  render(
    <Sidebar status="ready" green={green} grey={grey} selected={null} onClear={() => {}} onRetry={() => {}} {...props} />,
  );

describe('Sidebar', () => {
  it('shows the Bangkok overview when nothing is selected', () => {
    renderSidebar();
    expect(screen.getByRole('heading', { name: 'Bangkok overview' })).toBeTruthy();
    expect(screen.getByText('7.49')).toBeTruthy();
    expect(screen.getByText('Below target')).toBeTruthy();
    expect(screen.getByText('High 3')).toBeTruthy();
  });

  it('shows green zone stats with the math written out', () => {
    renderSidebar({ selected: { kind: 'green', id: 'GZ-001' } });
    expect(screen.getByRole('heading', { name: 'Suan Luang Rama IX' })).toBeTruthy();
    expect(screen.getByText('38.1')).toBeTruthy();
    expect(screen.getByText('Meets target')).toBeTruthy();
    expect(screen.getByText('800,000 m² ÷ 21,000 people = 38.1 m² each')).toBeTruthy();
    expect(screen.getByText('4.6°C cooler than around it')).toBeTruthy();
    expect(screen.getByText('NDVI 0.62 · dense vegetation')).toBeTruthy();
  });

  it('shows grey zone fitness, rank and factors', () => {
    renderSidebar({ selected: { kind: 'grey', id: 'G-014' } });
    expect(screen.getByRole('heading', { name: 'Site G-014' })).toBeTruthy();
    expect(screen.getByText('0.91')).toBeTruthy();
    expect(screen.getByText('High priority · rank 1 of 8')).toBeTruthy();
    expect(screen.getByText('Far from parks')).toBeTruthy();
    expect(screen.getByText('Greening it adds 0.33 m² per nearby person')).toBeTruthy();
    expect(screen.getByText('Seri Thai Park · 4.7 km')).toBeTruthy();
  });

  it('falls back to the overview when the selected zone is not in the data', () => {
    renderSidebar({ selected: { kind: 'green', id: 'GZ-404' } });
    expect(screen.getByRole('heading', { name: 'Bangkok overview' })).toBeTruthy();
  });

  it('calls onClear from the close button', () => {
    const onClear = vi.fn();
    renderSidebar({ selected: { kind: 'green', id: 'GZ-001' }, onClear });
    fireEvent.click(screen.getByRole('button', { name: /close/i }));
    expect(onClear).toHaveBeenCalledOnce();
  });

  it('shows placeholder cards while loading', () => {
    renderSidebar({ status: 'loading', green: null, grey: null });
    expect(screen.getByLabelText('Loading zone data')).toBeTruthy();
  });

  it('shows an error with a working Retry button', () => {
    const onRetry = vi.fn();
    renderSidebar({ status: 'error', green: null, grey: null, onRetry });
    expect(screen.getByRole('alert').textContent).toContain("Couldn't load zone data");
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(onRetry).toHaveBeenCalledOnce();
  });
});
```

- [ ] **Step 2: Run the test to see it fail**

Run: `npx vitest run src/components/sidebar/Sidebar.test.jsx`
Expected: FAIL, because `./Sidebar.jsx` cannot be resolved.

- [ ] **Step 3: Implement the panels and the sidebar**

<!-- file: src/components/sidebar/PanelHeader.jsx -->
```jsx
import { X } from 'lucide-react';

/** Top of a zone panel: type pill, zone name, subtitle and a close (×) button. */
export default function PanelHeader({ pill, pillColor, pillBg, title, subtitle, onClose }) {
  return (
    <header className="flex items-start gap-3">
      <div className="min-w-0 flex-1">
        <span className="inline-block rounded-md px-2 py-0.5 text-xs" style={{ color: pillColor, background: pillBg }}>
          {pill}
        </span>
        <h2 className="mt-2 text-xl font-semibold text-ink">{title}</h2>
        {subtitle && <p className="text-sm text-ink-3">{subtitle}</p>}
      </div>
      <button
        type="button"
        onClick={onClose}
        aria-label="Close and show the overview"
        title="Close (Esc)"
        className="rounded-lg p-1.5 text-ink-2 hover:bg-white/10 hover:text-ink focus-visible:outline-2 focus-visible:outline-white"
      >
        <X size={18} aria-hidden="true" />
      </button>
    </header>
  );
}
```

<!-- file: src/components/sidebar/GreenZonePanel.jsx -->
```jsx
import CoolingChart from '../charts/CoolingChart.jsx';
import HalfPieGauge from '../charts/HalfPieGauge.jsx';
import Card from '../ui/Card.jsx';
import InfoList from '../ui/InfoList.jsx';
import StatPair from '../ui/StatPair.jsx';
import StatusBadge from '../ui/StatusBadge.jsx';
import PanelHeader from './PanelHeader.jsx';
import { COLORS, TARGET_M2_PER_PERSON } from '../../lib/constants.js';
import { DASH, formatArea, formatDecimal, formatNumber } from '../../lib/format.js';
import { greenGaugeFraction, greenSpaceStatus, m2PerPerson, ndviLabel } from '../../lib/metrics.js';

/** Sidebar content for a selected green zone. `zone` is a normalized feature's properties. */
export default function GreenZonePanel({ zone, onClose }) {
  const perPerson = m2PerPerson(zone.areaM2, zone.populationNearby);
  const status = greenSpaceStatus(perPerson);
  const perPersonText = formatDecimal(perPerson, 1);
  const vegetation = zone.ndvi == null ? DASH : `NDVI ${formatDecimal(zone.ndvi, 2)} · ${ndviLabel(zone.ndvi)}`;
  const rows = [
    ['Zone ID', zone.id],
    ['Type', zone.type],
    ['Vegetation', vegetation],
    ['Data', 'THEOS-2, Landsat 8/9'],
  ];
  if (zone.updatedAt) rows.push(['Updated', zone.updatedAt]);

  return (
    <div className="space-y-3">
      <PanelHeader
        pill="Green zone"
        pillColor={COLORS.greenZoneText}
        pillBg="rgb(34 197 94 / 0.15)"
        title={zone.name}
        subtitle={[zone.nameTh, zone.district].filter(Boolean).join(' · ')}
        onClose={onClose}
      />
      <Card title="Green space per person">
        <HalfPieGauge
          fraction={perPerson == null ? null : greenGaugeFraction(perPerson)}
          color={status.color}
          value={perPersonText}
          unit="m² per person"
          tick={0.5}
          tickLabel={`target ${TARGET_M2_PER_PERSON}`}
          label={`Green space per person: ${perPerson == null ? 'no data' : `${perPersonText} m²`}. Target ${TARGET_M2_PER_PERSON} m². ${status.label}.`}
        />
        <StatusBadge status={status} />
      </Card>
      <Card title="Population and area">
        <StatPair
          items={[
            { label: `People within ${zone.nearbyRadiusKm} km`, value: formatNumber(zone.populationNearby) },
            { label: 'Green zone area', value: formatArea(zone.areaM2) },
          ]}
          note={
            perPerson == null
              ? null
              : `${formatArea(zone.areaM2)} ÷ ${formatNumber(zone.populationNearby)} people = ${perPersonText} m² each`
          }
        />
      </Card>
      <Card title="Cooling effect">
        <CoolingChart insideC={zone.tempInsideC} aroundC={zone.tempAroundC} radiusKm={zone.nearbyRadiusKm} />
      </Card>
      <Card title="Info">
        <InfoList rows={rows} />
      </Card>
    </div>
  );
}
```

<!-- file: src/components/sidebar/GreyZonePanel.jsx -->
```jsx
import FactorBars from '../charts/FactorBars.jsx';
import HalfPieGauge from '../charts/HalfPieGauge.jsx';
import Card from '../ui/Card.jsx';
import InfoList from '../ui/InfoList.jsx';
import StatPair from '../ui/StatPair.jsx';
import PanelHeader from './PanelHeader.jsx';
import { COLORS } from '../../lib/constants.js';
import { DASH, formatArea, formatDecimal, formatKm, formatNumber, formatTemp } from '../../lib/format.js';
import { m2PerPerson, ndviLabel, priorityTier } from '../../lib/metrics.js';

/** Sidebar content for a selected grey zone (candidate site). */
export default function GreyZonePanel({ zone, totalSites, onClose }) {
  const tier = priorityTier(zone.fitness);
  const fitnessText = formatDecimal(zone.fitness, 2);
  const addedPerPerson = m2PerPerson(zone.areaM2, zone.populationNearby);
  const nearest = zone.nearestGreenZone;
  const rows = [
    ['Land now', zone.ndvi == null ? DASH : `NDVI ${formatDecimal(zone.ndvi, 2)} · ${ndviLabel(zone.ndvi)}`],
    ['Nearest park', nearest?.name ? `${nearest.name} · ${formatKm(nearest.distanceKm)}` : DASH],
    ['Surface temp', formatTemp(zone.surfaceTempC)],
    ['Data', 'THEOS-2, Landsat 8/9, OpenStreetMap'],
  ];
  if (zone.updatedAt) rows.push(['Updated', zone.updatedAt]);
  const rankText = zone.rank == null ? null : `rank ${zone.rank} of ${totalSites}`;

  return (
    <div className="space-y-3">
      <PanelHeader
        pill="Grey zone · candidate site"
        pillColor={COLORS.greyZoneText}
        pillBg="rgb(249 115 22 / 0.15)"
        title={`Site ${zone.id}`}
        subtitle={[zone.district, 'empty land'].filter(Boolean).join(' · ')}
        onClose={onClose}
      />
      <Card title="Fitness score">
        <HalfPieGauge
          fraction={zone.fitness}
          color={COLORS.fitnessArc}
          value={fitnessText}
          unit="out of 1.00"
          label={`Fitness score ${fitnessText} out of 1. ${tier.label}.`}
        />
        <p className="mt-1 flex items-center justify-center gap-1.5 text-sm text-ink">
          <span className="size-2.5 rounded-sm ring-1 ring-white/25" style={{ background: tier.color }} aria-hidden="true" />
          {[tier.label, rankText].filter(Boolean).join(' · ')}
        </p>
      </Card>
      <Card title="Population and area">
        <StatPair
          items={[
            { label: `People within ${zone.nearbyRadiusKm} km`, value: formatNumber(zone.populationNearby) },
            { label: 'Site area', value: formatArea(zone.areaM2) },
          ]}
          note={
            addedPerPerson == null ? null : `Greening it adds ${formatDecimal(addedPerPerson, 2)} m² per nearby person`
          }
        />
      </Card>
      <Card title="Why this site?">
        <FactorBars scores={zone.scores} penalty={zone.penalty} />
      </Card>
      <Card title="Info">
        <InfoList rows={rows} />
      </Card>
    </div>
  );
}
```

<!-- file: src/components/sidebar/OverviewPanel.jsx -->
```jsx
import HalfPieGauge from '../charts/HalfPieGauge.jsx';
import PriorityBar from '../charts/PriorityBar.jsx';
import Card from '../ui/Card.jsx';
import StatPair from '../ui/StatPair.jsx';
import StatusBadge from '../ui/StatusBadge.jsx';
import { BANGKOK_M2_PER_PERSON, TARGET_M2_PER_PERSON } from '../../lib/constants.js';
import { formatDecimal, formatKm2 } from '../../lib/format.js';
import { countByTier, greenGaugeFraction, greenSpaceStatus } from '../../lib/metrics.js';

/** Sidebar content before anything is selected: Bangkok as a whole and the study area. */
export default function OverviewPanel({ green, grey }) {
  const greenZones = green?.features ?? [];
  const greyZones = grey?.features ?? [];
  const greenArea = greenZones.reduce((sum, f) => sum + (f.properties.areaM2 ?? 0), 0);
  const tiers = countByTier(greyZones.map((f) => f.properties.fitness));
  const status = greenSpaceStatus(BANGKOK_M2_PER_PERSON);

  return (
    <div className="space-y-3">
      <header>
        <h2 className="text-xl font-semibold text-ink">Bangkok overview</h2>
        <p className="text-sm text-ink-3">Click a zone on the map to see its stats.</p>
      </header>
      <Card title="Green space per person in Bangkok">
        <HalfPieGauge
          fraction={greenGaugeFraction(BANGKOK_M2_PER_PERSON)}
          color={status.color}
          value={formatDecimal(BANGKOK_M2_PER_PERSON, 2)}
          unit="m² per person"
          tick={0.5}
          tickLabel={`target ${TARGET_M2_PER_PERSON}`}
          label={`Bangkok has ${BANGKOK_M2_PER_PERSON} m² of green space per person. The target is ${TARGET_M2_PER_PERSON} m². ${status.label}.`}
        />
        <StatusBadge status={status} />
        <p className="mt-2 text-center text-xs text-ink-3">BMA figure, cited in the project report</p>
      </Card>
      <Card title="Study area">
        <StatPair
          items={[
            { label: 'Green zones', value: `${greenZones.length} · ${formatKm2(greenArea)}` },
            { label: 'Candidate sites', value: `${greyZones.length} · ${tiers.high} high` },
          ]}
        />
      </Card>
      <Card title="Candidate sites by priority">
        <PriorityBar counts={tiers} />
      </Card>
      <Card title="How to use">
        <ul className="list-disc space-y-1.5 pl-5 text-sm text-ink-2">
          <li>Click a green or orange zone on the map to see its stats here.</li>
          <li>Zoom with the + and − buttons, the mouse wheel, or a pinch.</li>
          <li>Turn layers on and off in the top-right corner of the map.</li>
        </ul>
        <p className="mt-3 border-t border-line pt-3 text-xs text-ink-3">
          GreenSight finds empty land in Bangkok that should become green space. It uses THEOS-2 satellite images,
          Landsat 8/9 heat data, and OpenStreetMap roads.
        </p>
      </Card>
    </div>
  );
}
```

<!-- file: src/components/sidebar/Sidebar.jsx -->
```jsx
import { Leaf } from 'lucide-react';
import { USING_MOCK_DATA } from '../../config.js';
import { COLORS } from '../../lib/constants.js';
import ErrorCard from '../ui/ErrorCard.jsx';
import LoadingCards from '../ui/LoadingCards.jsx';
import GreenZonePanel from './GreenZonePanel.jsx';
import GreyZonePanel from './GreyZonePanel.jsx';
import OverviewPanel from './OverviewPanel.jsx';

/** Properties of the selected zone, or null if nothing is selected or it is not in the data. */
function findZone(selected, green, grey) {
  if (!selected) return null;
  const collection = selected.kind === 'green' ? green : grey;
  return collection?.features.find((f) => f.properties.id === selected.id)?.properties ?? null;
}

function SidebarBody({ status, green, grey, selected, onClear, onRetry }) {
  if (status === 'loading') return <LoadingCards />;
  if (status === 'error') return <ErrorCard onRetry={onRetry} />;
  const zone = findZone(selected, green, grey);
  if (zone && selected.kind === 'green') return <GreenZonePanel zone={zone} onClose={onClear} />;
  if (zone && selected.kind === 'grey') {
    return <GreyZonePanel zone={zone} totalSites={grey.features.length} onClose={onClear} />;
  }
  return <OverviewPanel green={green} grey={grey} />;
}

/** Left column: app header + the overview or the selected zone's 4 cards. */
export default function Sidebar(props) {
  return (
    <aside
      aria-label="Zone statistics"
      className="flex flex-col gap-4 bg-app p-4 lg:h-dvh lg:overflow-y-auto lg:border-r lg:border-line"
    >
      <header className="flex items-center gap-3 border-b border-line pb-4">
        <Leaf size={26} color={COLORS.greenZoneFill} aria-hidden="true" />
        <div className="min-w-0">
          <h1 className="text-base font-semibold leading-tight text-ink">GreenSight</h1>
          <p className="text-xs text-ink-3">Bangkok green space explorer</p>
        </div>
        {USING_MOCK_DATA && (
          <span
            className="ml-auto rounded-md border border-white/20 px-2 py-0.5 text-xs text-ink-2"
            title="Example data until the backend is connected"
          >
            Mock data
          </span>
        )}
      </header>
      <SidebarBody {...props} />
    </aside>
  );
}
```

- [ ] **Step 4: Run the test to see it pass**

Run: `npx vitest run src/components/sidebar/Sidebar.test.jsx`
Expected: PASS (7 tests).

---

### Task 11: Map

The map is checked in the real browser in Task 13. Leaflet doesn't work well in jsdom, so it has no unit tests.

**Files:**
- Create: `src/components/map/LayerControl.jsx`, `MapLegend.jsx`, `ZoneMap.jsx`

- [ ] **Step 1: Create the map overlays**

<!-- file: src/components/map/LayerControl.jsx -->
```jsx
import { COLORS } from '../../lib/constants.js';

const LAYERS = [
  { key: 'green', label: 'Green zones', color: COLORS.greenZoneMark },
  { key: 'grey', label: 'Grey zones', color: COLORS.tierMedium },
];

/** Floating card (top-right of the map) to show or hide each layer. */
export default function LayerControl({ layers, onChange }) {
  return (
    <fieldset className="absolute right-3 top-3 z-[1000] rounded-lg border border-black/10 bg-white px-3 py-2 text-sm text-neutral-800 shadow-md">
      <legend className="sr-only">Map layers</legend>
      <p className="mb-1 font-semibold" aria-hidden="true">
        Layers
      </p>
      {LAYERS.map(({ key, label, color }) => (
        <label key={key} className="flex cursor-pointer items-center gap-2 py-0.5">
          <input
            type="checkbox"
            className="size-4 accent-neutral-800"
            checked={layers[key]}
            onChange={(event) => onChange(key, event.target.checked)}
          />
          <span className="size-3 rounded-sm" style={{ background: color }} aria-hidden="true" />
          {label}
        </label>
      ))}
    </fieldset>
  );
}
```

<!-- file: src/components/map/MapLegend.jsx -->
```jsx
import { COLORS } from '../../lib/constants.js';
import { TIER_ORDER } from '../../lib/metrics.js';

function Swatch({ color }) {
  return <span className="size-3 shrink-0 rounded-sm" style={{ background: color }} aria-hidden="true" />;
}

/** Floating legend (bottom-left of the map). */
export default function MapLegend() {
  return (
    <section
      aria-label="Map legend"
      className="absolute bottom-6 left-3 z-[1000] rounded-lg border border-black/10 bg-white px-3 py-2 text-xs text-neutral-800 shadow-md"
    >
      <p className="flex items-center gap-2">
        <Swatch color={COLORS.greenZoneMark} />
        Green zone (existing)
      </p>
      <p className="mb-1 mt-2 font-semibold">Priority to plant</p>
      <ul className="space-y-0.5">
        {TIER_ORDER.map((tier) => (
          <li key={tier.key} className="flex items-center gap-2">
            <Swatch color={tier.color} />
            {tier.short} ({tier.range})
          </li>
        ))}
      </ul>
    </section>
  );
}
```

- [ ] **Step 2: Create the map**

<!-- file: src/components/map/ZoneMap.jsx -->
```jsx
import { useCallback, useEffect, useRef, useState } from 'react';
import { CircleMarker, GeoJSON, MapContainer, Pane, TileLayer, Tooltip, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { LoaderCircle, Maximize, Minus, Plus } from 'lucide-react';
import { BASEMAP, MAP_DEFAULTS } from '../../config.js';
import { COLORS, DOT_ZOOM_THRESHOLD } from '../../lib/constants.js';
import { featureCenter } from '../../lib/geo.js';
import { priorityTier } from '../../lib/metrics.js';
import LayerControl from './LayerControl.jsx';
import MapLegend from './MapLegend.jsx';

const isSelected = (selected, kind, id) => selected?.kind === kind && selected.id === id;

const zoneLabel = (kind, p) => (kind === 'green' ? p.name : `Site ${p.id} · ${priorityTier(p.fitness).label}`);

function zoneStyle(kind, p, selected) {
  let base;
  if (kind === 'green') {
    base = { color: COLORS.greenZoneStroke, fillColor: COLORS.greenZoneFill, fillOpacity: 0.45 };
  } else {
    const tier = priorityTier(p.fitness);
    base = { color: tier.stroke, fillColor: tier.color, fillOpacity: 0.7 };
  }
  return isSelected(selected, kind, p.id) ? { ...base, color: COLORS.selected, weight: 3 } : { ...base, weight: 1.5 };
}

/** Bounds that contain every zone, or null when nothing is loaded. */
function zonesBounds(...collections) {
  const features = collections.flatMap((collection) => collection?.features ?? []);
  if (features.length === 0) return null;
  const bounds = L.geoJSON({ type: 'FeatureCollection', features }).getBounds();
  return bounds.isValid() ? bounds : null;
}

/** One layer of zone shapes. Styles update in place when the selection changes. */
function ZoneShapes({ kind, data, selected, onSelect }) {
  const layerRef = useRef(null);
  const latest = useRef({ selected, onSelect });

  useEffect(() => {
    latest.current = { selected, onSelect };
  });

  useEffect(() => {
    layerRef.current?.eachLayer((layer) => {
      const p = layer.feature.properties;
      layer.setStyle(zoneStyle(kind, p, selected));
      if (isSelected(selected, kind, p.id)) layer.bringToFront();
    });
  }, [kind, selected]);

  const style = useCallback((feature) => zoneStyle(kind, feature.properties, latest.current.selected), [kind]);

  const onEachFeature = useCallback(
    (feature, layer) => {
      const p = feature.properties;
      layer.bindTooltip(zoneLabel(kind, p), { sticky: true, direction: 'top' });
      layer.on({
        click: () => latest.current.onSelect({ kind, id: p.id }),
        mouseover: () => layer.setStyle({ weight: 3 }),
        mouseout: () => layer.setStyle(zoneStyle(kind, p, latest.current.selected)),
      });
    },
    [kind],
  );

  return <GeoJSON ref={layerRef} data={data} style={style} onEachFeature={onEachFeature} bubblingMouseEvents={false} />;
}

/** Clickable dots at each zone's center, for zoom levels where small zones are too tiny to click. */
function ZoneDots({ kind, data, selected, onSelect }) {
  return (data?.features ?? []).map((feature) => {
    const center = featureCenter(feature);
    if (!center) return null;
    const p = feature.properties;
    const on = isSelected(selected, kind, p.id);
    const fill = kind === 'green' ? COLORS.greenZoneMark : priorityTier(p.fitness).color;
    return (
      <CircleMarker
        key={p.id}
        center={center}
        radius={on ? 9 : 7}
        pathOptions={{ color: on ? COLORS.selected : COLORS.dotRing, weight: on ? 3 : 2, fillColor: fill, fillOpacity: 1 }}
        bubblingMouseEvents={false}
        eventHandlers={{ click: () => onSelect({ kind, id: p.id }) }}
      >
        <Tooltip direction="top" offset={[0, -8]}>
          {zoneLabel(kind, p)}
        </Tooltip>
      </CircleMarker>
    );
  });
}

/** Passes the map instance and zoom level up, and clears the selection on clicks on empty map. */
function MapEvents({ onReady, onZoom, onEmptyClick }) {
  const map = useMapEvents({
    zoomend: () => onZoom(map.getZoom()),
    click: () => onEmptyClick(),
  });
  useEffect(() => {
    onReady(map);
  }, [map, onReady]);
  return null;
}

const buttonClass =
  'flex size-9 items-center justify-center bg-white text-neutral-800 hover:bg-neutral-100 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-blue-600';

function MapButtons({ map, onReset }) {
  return (
    <div className="absolute left-3 top-3 z-[1000] flex flex-col divide-y divide-black/10 overflow-hidden rounded-lg border border-black/15 shadow-md">
      <button type="button" className={buttonClass} aria-label="Zoom in" title="Zoom in" onClick={() => map?.zoomIn()}>
        <Plus size={18} aria-hidden="true" />
      </button>
      <button type="button" className={buttonClass} aria-label="Zoom out" title="Zoom out" onClick={() => map?.zoomOut()}>
        <Minus size={18} aria-hidden="true" />
      </button>
      <button type="button" className={buttonClass} aria-label="Reset view" title="Reset view" onClick={onReset}>
        <Maximize size={16} aria-hidden="true" />
      </button>
    </div>
  );
}

/** The interactive map: basemap, green and grey zone layers, dots, controls and legend. */
export default function ZoneMap({ green, grey, version, layers, onToggleLayer, selected, onSelect, onClear, loading }) {
  const [map, setMap] = useState(null);
  const [zoom, setZoom] = useState(MAP_DEFAULTS.zoom);
  const fitted = useRef(false);

  const fitAll = useCallback(() => {
    if (!map) return;
    const bounds = zonesBounds(green, grey);
    if (bounds) map.fitBounds(bounds, { padding: [40, 40] });
    else map.setView(MAP_DEFAULTS.center, MAP_DEFAULTS.zoom);
  }, [map, green, grey]);

  // Fit the map to the zones once, on the first successful load.
  useEffect(() => {
    if (fitted.current || !map || !zonesBounds(green, grey)) return;
    fitAll();
    fitted.current = true;
  }, [map, green, grey, fitAll]);

  const showDots = zoom < DOT_ZOOM_THRESHOLD;

  return (
    <div className="relative h-[55vh] min-h-80 lg:h-dvh">
      <MapContainer
        center={MAP_DEFAULTS.center}
        zoom={MAP_DEFAULTS.zoom}
        minZoom={MAP_DEFAULTS.minZoom}
        maxZoom={MAP_DEFAULTS.maxZoom}
        zoomControl={false}
        className="isolate size-full"
      >
        <TileLayer url={BASEMAP.url} attribution={BASEMAP.attribution} maxZoom={BASEMAP.maxZoom} className="basemap" />
        <MapEvents onReady={setMap} onZoom={setZoom} onEmptyClick={onClear} />
        {layers.green && green && (
          <ZoneShapes key={`green-${version}`} kind="green" data={green} selected={selected} onSelect={onSelect} />
        )}
        {layers.grey && grey && (
          <ZoneShapes key={`grey-${version}`} kind="grey" data={grey} selected={selected} onSelect={onSelect} />
        )}
        <Pane name="zone-dots" style={{ zIndex: 450 }}>
          {showDots && layers.green && <ZoneDots kind="green" data={green} selected={selected} onSelect={onSelect} />}
          {showDots && layers.grey && <ZoneDots kind="grey" data={grey} selected={selected} onSelect={onSelect} />}
        </Pane>
      </MapContainer>
      <MapButtons map={map} onReset={fitAll} />
      <LayerControl layers={layers} onChange={onToggleLayer} />
      <MapLegend />
      {loading && (
        <p className="pointer-events-none absolute left-1/2 top-16 z-[1000] flex -translate-x-1/2 items-center gap-2 rounded-full bg-white px-3 py-1.5 text-sm text-neutral-800 shadow-md lg:top-3">
          <LoaderCircle size={16} className="animate-spin" aria-hidden="true" />
          Loading zones…
        </p>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Check that it builds**

Run: `npm run build`
Expected: builds with no errors.

---

### Task 12: Wire up the app

**Files:**
- Modify: `src/App.jsx` (replace the temporary version)

- [ ] **Step 1: Replace App.jsx**

<!-- file: src/App.jsx -->
```jsx
import { useCallback, useEffect, useState } from 'react';
import ZoneMap from './components/map/ZoneMap.jsx';
import Sidebar from './components/sidebar/Sidebar.jsx';
import useZones from './hooks/useZones.js';

export default function App() {
  const { status, green, grey, version, reload } = useZones();
  const [selected, setSelected] = useState(null); // { kind: 'green' | 'grey', id } or null
  const [layers, setLayers] = useState({ green: true, grey: true });

  const clearSelection = useCallback(() => setSelected(null), []);

  const toggleLayer = useCallback((kind, visible) => {
    setLayers((prev) => ({ ...prev, [kind]: visible }));
    // Never keep showing stats for a zone the user just hid.
    if (!visible) setSelected((current) => (current?.kind === kind ? null : current));
  }, []);

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === 'Escape') setSelected(null);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  return (
    <div className="flex min-h-dvh flex-col-reverse lg:grid lg:h-dvh lg:grid-cols-[400px_minmax(0,1fr)]">
      <Sidebar status={status} green={green} grey={grey} selected={selected} onClear={clearSelection} onRetry={reload} />
      <main className="min-w-0">
        <ZoneMap
          green={green}
          grey={grey}
          version={version}
          layers={layers}
          onToggleLayer={toggleLayer}
          selected={selected}
          onSelect={setSelected}
          onClear={clearSelection}
          loading={status === 'loading'}
        />
      </main>
    </div>
  );
}
```

- [ ] **Step 2: Run all tests and the build**

Run: `npm test && npm run build`
Expected: every test file passes, and the build finishes with no errors.

---

### Task 13: Docs for the team

**Files:**
- Create: `docs/API.md`, `README.md`

- [ ] **Step 1: Write the backend contract**

<!-- file: docs/API.md -->
````markdown
# GreenSight data API

This is the contract between the frontend and the backend. The frontend needs **two endpoints**, and both return a [GeoJSON](https://datatracker.ietf.org/doc/html/rfc7946) `FeatureCollection`.

| Method | Path | Returns |
|---|---|---|
| GET | `{VITE_API_URL}/green-zones` | Existing green space (parks, NDVI green zones) |
| GET | `{VITE_API_URL}/grey-zones` | Candidate sites (abandoned or vacant land) with fitness scores |

- Set `VITE_API_URL` in `.env` (copy `.env.example`), for example `VITE_API_URL=http://localhost:8000/api`. Restart `npm run dev` after changing it.
- When `VITE_API_URL` is empty, the app reads `public/mock/green-zones.geojson` and `public/mock/grey-zones.geojson` instead. **Those two files are working examples of everything below.**
- Allow CORS from the frontend origin (`http://localhost:5173` during development).
- Reply with HTTP `200` and JSON (`application/json` or `application/geo+json`). Any other status makes the app show "Couldn't load zone data" with a Retry button.

## Geometry

- `Polygon` or `MultiPolygon` only. Features with other geometry types are skipped.
- Coordinates are WGS84 `[longitude, latitude]` (EPSG:4326), the GeoJSON standard.

## Green zone feature

```json
{
  "type": "Feature",
  "properties": {
    "id": "GZ-001",
    "name": "Suan Luang Rama IX",
    "nameTh": "สวนหลวง ร.๙",
    "type": "Public park",
    "district": "Prawet",
    "areaM2": 761415,
    "populationNearby": 21000,
    "nearbyRadiusKm": 1,
    "ndvi": 0.62,
    "tempInsideC": 31.2,
    "tempAroundC": 35.8,
    "updatedAt": "2026-09-30"
  },
  "geometry": {
    "type": "Polygon",
    "coordinates": [[[100.6603, 13.6894], [100.6712, 13.6893], [100.6714, 13.6802], [100.6601, 13.6805], [100.6603, 13.6894]]]
  }
}
```

(The geometry is shortened here. See `public/mock/green-zones.geojson` for the real outlines.)

| Field | Type | Unit | Required | Meaning |
|---|---|---|---|---|
| `id` | string | | yes | Unique id |
| `name` | string | | yes | English name |
| `nameTh` | string | | no | Thai name |
| `type` | string | | no | For example "Public park" (default "Green zone") |
| `district` | string | | yes | Bangkok district |
| `areaM2` | number | m² | yes | Area of the zone |
| `populationNearby` | number | people | yes | People living within `nearbyRadiusKm` of the zone |
| `nearbyRadiusKm` | number | km | no | Default 1 |
| `ndvi` | number | −1 to 1 | no | Mean NDVI from THEOS-2 |
| `tempInsideC` | number | °C | no | Mean land surface temperature inside (Landsat 8/9) |
| `tempAroundC` | number | °C | no | Mean land surface temperature within `nearbyRadiusKm` |
| `updatedAt` | string | ISO date | no | When the numbers were computed |

## Grey zone feature

```json
{
  "type": "Feature",
  "properties": {
    "id": "G-014",
    "district": "Bang Kapi",
    "areaM2": 12400,
    "populationNearby": 38000,
    "nearbyRadiusKm": 1,
    "fitness": 0.91,
    "rank": 1,
    "scores": { "greenAccessDeficit": 5, "airProximity": 5, "heatSeverity": 4 },
    "penalty": 0,
    "ndvi": 0.08,
    "surfaceTempC": 37.4,
    "nearestGreenZone": { "id": "GZ-010", "name": "Seri Thai Park", "distanceKm": 4.7 },
    "updatedAt": "2026-09-30"
  },
  "geometry": {
    "type": "Polygon",
    "coordinates": [[[100.6285, 13.7652], [100.6297, 13.7654], [100.6295, 13.7668], [100.6283, 13.7666], [100.6285, 13.7652]]]
  }
}
```

| Field | Type | Unit | Required | Meaning |
|---|---|---|---|---|
| `id` | string | | yes | Site id, as in the report's priority table |
| `district` | string | | yes | Bangkok district |
| `areaM2` | number | m² | yes | Area of the site |
| `populationNearby` | number | people | yes | People living within `nearbyRadiusKm` of the site |
| `nearbyRadiusKm` | number | km | no | Default 1 |
| `fitness` | number | 0 to 1 | yes | Fitness score from the Hybrid GA |
| `rank` | integer | | yes | 1 = highest priority, with no gaps (1…N) |
| `scores.greenAccessDeficit` | integer | 1 to 5 | yes | Far from existing green space = high |
| `scores.airProximity` | integer | 1 to 5 | yes | Near major roads or industry = high |
| `scores.heatSeverity` | integer | 1 to 5 | yes | Hot surface compared with the study-area average = high |
| `penalty` | number | | no | "Surrounded" penalty already subtracted from fitness (default 0) |
| `ndvi` | number | −1 to 1 | no | Current NDVI of the site |
| `surfaceTempC` | number | °C | no | Land surface temperature |
| `nearestGreenZone` | object | | no | `{ "id", "name", "distanceKm" }` |
| `updatedAt` | string | ISO date | no | When the numbers were computed |

## What the frontend computes (don't send these)

- **m² per person** = `areaM2 / populationNearby`. It shows "—" if the population is missing or 0.
- **Status:** ≥ 9 m² meets the target, 3 to under 9 is below target, and under 3 is far below target.
- **Priority tier:** fitness ≥ 0.75 is high, ≥ 0.50 is medium, and the rest are low.
- **"rank N of M"**, where M is the number of grey zones you return.

## How the frontend treats your data

- A feature without `properties.id` or without polygon geometry is skipped, and a warning appears in the browser console.
- A number that is missing or not a finite number shows as "—". The cards still render.
- Extra fields are ignored, so it is safe to send more.
````

- [ ] **Step 2: Write the README**

<!-- file: README.md -->
````markdown
# GreenSight frontend

An interactive map dashboard for **GreenSight: Optimization of Urban Green Space Development Sites using THEOS-2** (GeoHackathon 2026). It lets you explore Bangkok's **green zones** (existing parks) and **grey zones** (empty land that the project ranks for new green space). Click any zone to see its stats in the sidebar.

> This is the frontend only. It runs on **mock data** until the backend is connected (see below).

## Run it

You need Node.js 22.12 or newer (tested with Node 24).

```bash
npm install
npm run dev
```

Then open http://localhost:5173.

| Command | What it does |
|---|---|
| `npm run dev` | Start the dev server with hot reload |
| `npm test` | Run the unit and component tests once |
| `npm run build` | Make a production build in `dist/` |
| `npm run preview` | Serve the production build locally |

## Connect the backend

1. Copy `.env.example` to `.env`.
2. Set `VITE_API_URL` to the backend base URL, for example `VITE_API_URL=http://localhost:8000/api`.
3. Restart `npm run dev`. The "Mock data" badge disappears.

The backend has to serve `GET /green-zones` and `GET /grey-zones`. **[docs/API.md](docs/API.md)** describes them, and the files in `public/mock/` are working examples.

## How to use the app

- **Zoom:** use the + / − buttons, the mouse wheel or a pinch. Drag to move around. ⤢ resets the view.
- **Click a zone:** its stats appear in the sidebar. To go back to the overview, press Esc, click ×, or click empty map.
- **Small zones:** when you're zoomed out, every zone also shows as a dot, so even tiny sites can be clicked.
- **Layers:** turn green or grey zones on and off in the top-right corner of the map.

## Project structure

```
src/
  App.jsx               page layout, selected zone, layer switches, Esc key
  config.js             backend URL, basemap, map start view
  api/zones.js          loads and checks the zone data (mock files or backend)
  hooks/useZones.js     loading / error / retry state
  lib/                  metrics (m² per person, status, tiers), formatting, geometry
  components/map/       Leaflet map, layer switches, legend
  components/sidebar/   overview, green zone and grey zone panels
  components/charts/    half pie gauge, cooling chart, factor bars, priority bar
  components/ui/        cards, badges, lists, loading and error states
public/mock/            mock GeoJSON (examples of the API format)
docs/API.md             the data contract for the backend
```

## Mock data

- **Green zones:** 10 real Bangkok parks. Outlines © OpenStreetMap contributors (ODbL). **All statistics are made up.**
- **Grey zones:** the 8 example sites from the report's priority table (section 4.2), with the report's scores. **Their locations and all other values are made up.**

## Changing things

- Targets and cut-offs (9 m² target, 3 m² "far below", priority tiers, the zoom level where dots appear): `src/lib/constants.js`
- Colors: UI colors are in `src/index.css` (`@theme`), and data colors are in `src/lib/constants.js`
- Basemap (tile URL and attribution): `src/config.js`

## Credits

Map data and basemap tiles © OpenStreetMap contributors. The tiles come from `tile.openstreetmap.org` and need no API key, which is fine for development and demos. For heavy traffic, use a tile provider or host your own tiles (see the [tile usage policy](https://operations.osmfoundation.org/policies/tiles/)). The satellite data sources (THEOS-2 from GISTDA, Landsat 8/9 from USGS) are described in the project report.
````

---

### Task 14: Verify in the real browser

**Files:**
- Create: `.claude/launch.json` (dev-server config for the in-app browser)

- [ ] **Step 1: Add the launch config**

<!-- file: .claude/launch.json -->
```json
{
  "version": "0.0.1",
  "configurations": [
    {
      "name": "greensight-dev",
      "runtimeExecutable": "npm",
      "runtimeArgs": ["run", "dev"],
      "port": 5173
    }
  ]
}
```

- [ ] **Step 2: Run the full test suite and build**

Run: `npm test && npm run build`
Expected: all test files pass. The build has no errors.

- [ ] **Step 3: Start the dev server and check the desktop layout**

Start `greensight-dev` in the browser pane. Check each of these:
1. The map fits to all zones on load. The sidebar shows "Bangkok overview" with the 7.49 gauge and "Below target". There are no errors in the browser console.
2. At city zoom every zone has a dot. Zooming in to 15 or more hides the dots and the shapes remain clickable.
3. Hovering a zone shows a tooltip with its name. Clicking a green zone (for example Suan Luang Rama IX) shows the green panel and outlines the zone in black.
4. Clicking a grey zone (for example G-014) shows "High priority · rank 1 of 8" and the 3 factor bars.
5. Esc, ×, and clicking empty map each return to the overview.
6. Unticking "Grey zones" hides the grey shapes and dots, and clears a grey selection.
7. +, − and Reset view work.

- [ ] **Step 4: Check the phone layout**

Resize to the mobile preset (375×812). The map should be on top, the stats below, nothing should scroll sideways, and the overlays shouldn't cover each other badly. Reset to the desktop preset afterwards.

- [ ] **Step 5: Confirm the spec still matches what was built**

Re-read §3 of `docs/superpowers/specs/2026-10-05-greensight-frontend-design.md`. The color ramp, zoom buttons and grey fill opacity were synced during planning. Fix any other difference you find in the spec, so the spec describes the app as built.
