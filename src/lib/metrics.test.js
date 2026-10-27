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
