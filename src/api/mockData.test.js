import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { normalizeCollection, normalizeGaSites, normalizeGreenGroups, normalizeGrid } from './data.js';
import { pointInPolygon, polygonAreaM2, polygonLabelPoint } from '../lib/geo.js';

// Plain path maths on purpose: Vite rewrites `new URL(`…${x}`, import.meta.url)` into an asset lookup.
const SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const load = (file) => JSON.parse(readFileSync(path.join(SRC, file), 'utf8'));

const REQUIRED = {
  green: ['id', 'name', 'district', 'areaM2', 'populationNearby'],
  grey: ['id', 'district', 'areaM2', 'populationNearby', 'fitness', 'rank'],
};

describe.each([
  ['green', 'mock/don-mueang/green-zones.geojson'],
  ['grey', 'mock/don-mueang/abandoned.geojson'],
])('Don Mueang mock %s zones follow docs/API.md', (layer, file) => {
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

describe('Don Mueang abandoned plots (today\'s grey zones)', () => {
  const raw = load('mock/don-mueang/abandoned.geojson');
  const { features } = normalizeCollection(raw, 'grey');

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

  it('is marked as example data', () => {
    expect(raw.features.every((f) => f.properties.isExample === true)).toBe(true);
  });
});

describe('Don Mueang mock NDVI grid of gisda_03', () => {
  const grid = normalizeGrid(load('mock/don-mueang/grid.json'), 'gisda_03');

  it('is 600 × 600 cells of 5 m with every NDVI value between -1 and 1', () => {
    expect([grid.rows, grid.cols, grid.cellSizeM]).toEqual([600, 600, 5]);
    const values = grid.ndvi.flat();
    expect(values).toHaveLength(360000);
    expect(values.every((v) => v !== null && v >= -1 && v <= 1)).toBe(true);
  });
});

describe('Suan Luang data', () => {
  const boundaries = load('data/districts/suan-luang.json');
  const focus = boundaries.features.filter((f) => f.properties.role === 'focus');
  const frame = load('mock/suan-luang/frame.json');
  const lats = Object.values(frame.corners).map(([lat]) => lat);
  const lngs = Object.values(frame.corners).map(([, lng]) => lng);

  it('has one focus district, Suan Luang, of 15–35 km², with view bounds', () => {
    expect(focus).toHaveLength(1);
    expect(focus[0].properties.nameEn).toBe('Suan Luang');
    const km2 = polygonAreaM2(focus[0].geometry) / 1e6;
    expect(km2).toBeGreaterThan(15);
    expect(km2).toBeLessThan(35);
    expect(boundaries.metadata.viewBounds).toHaveLength(4);
  });

  it('places the 7 km × 6 km Theosmain image where the GA sites fit their green patches (about 1 m)', () => {
    expect(frame.extent.west).toBeCloseTo(672420, -1);
    expect(frame.extent.north).toBeCloseTo(1521080, -1);
    expect(frame.extent.east - frame.extent.west).toBe(7000);
    expect(frame.extent.north - frame.extent.south).toBe(6000);
  });

  it('places the Theosmain frame around On Nut / Srinakarin', () => {
    expect(Math.min(...lats)).toBeGreaterThan(13.69);
    expect(Math.max(...lats)).toBeLessThan(13.76);
    expect(Math.min(...lngs)).toBeGreaterThan(100.58);
    expect(Math.max(...lngs)).toBeLessThan(100.68);
  });

  it('has at least 5 example abandoned plots inside the district and the frame', () => {
    const raw = load('mock/suan-luang/abandoned.geojson');
    const { features } = normalizeCollection(raw, 'grey');
    expect(features.length).toBeGreaterThanOrEqual(5);
    expect(features.length).toBe(raw.features.length);
    expect(new Set(features.map((f) => f.properties.id)).size).toBe(features.length);
    for (const { geometry, properties } of raw.features) {
      expect(properties.isExample).toBe(true);
      expect(properties.areaM2).toBeGreaterThanOrEqual(200);
      expect(['concrete or soil', 'overgrown']).toContain(properties.landCover);
      const [lng, lat] = polygonLabelPoint(geometry);
      expect(pointInPolygon([lng, lat], focus[0].geometry), properties.id).toBe(true);
      expect(lat).toBeGreaterThanOrEqual(Math.min(...lats));
      expect(lat).toBeLessThanOrEqual(Math.max(...lats));
      expect(lng).toBeGreaterThanOrEqual(Math.min(...lngs));
      expect(lng).toBeLessThanOrEqual(Math.max(...lngs));
    }
  });

  it('has the 11 parks the backend checked against the image', () => {
    const checks = load('mock/suan-luang/park-checks.geojson').features;
    expect(checks).toHaveLength(11);
    for (const { properties } of checks) {
      expect(['green_detected', 'no_green_detected', 'outside_image']).toContain(properties.status);
    }
  });

  it('keeps the backend summary', () => {
    expect(load('mock/suan-luang/summary.json').green_area_m2).toBe(2248297.5);
  });

  it("has the backend's 85 GA park sites, ranked inside their 1 km squares, all on the image", () => {
    const raw = load('mock/suan-luang/ga-sites.geojson');
    const { features } = normalizeGaSites(raw);
    expect(features).toHaveLength(85);
    expect(new Set(features.map((f) => f.properties.id)).size).toBe(85);
    for (const { geometry, properties } of features) {
      expect(properties.zone).toMatch(/^r\d+_c\d+$/);
      expect(properties.rank).toBeGreaterThanOrEqual(1);
      expect(properties.areaM2).toBeGreaterThan(0);
      expect(properties.distNearestOfficialM).toBeGreaterThanOrEqual(0);
      const [lng, lat] = geometry.coordinates;
      expect(lat).toBeGreaterThanOrEqual(Math.min(...lats));
      expect(lat).toBeLessThanOrEqual(Math.max(...lats));
      expect(lng).toBeGreaterThanOrEqual(Math.min(...lngs));
      expect(lng).toBeLessThanOrEqual(Math.max(...lngs));
    }
  });

  it("has the backend's 271 green-group circles: 170 groups and 101 isolated", () => {
    const { features } = normalizeGreenGroups(load('mock/suan-luang/green-groups.geojson'));
    expect(features).toHaveLength(271);
    expect(features.filter((f) => f.properties.kind === 'group')).toHaveLength(170);
    expect(features.filter((f) => f.properties.kind === 'isolated')).toHaveLength(101);
    expect(new Set(features.map((f) => f.properties.id)).size).toBe(271);
    for (const { properties } of features) {
      expect(properties.radiusM).toBeGreaterThan(0);
      expect(properties.greenM2InGroup).toBeGreaterThan(0);
    }
  });
});
