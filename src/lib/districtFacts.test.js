import { describe, it, expect } from 'vitest';
import { districtFacts } from './districtFacts.js';

describe('districtFacts', () => {
  it('gives Suan Luang its population and green space per person', () => {
    const facts = districtFacts('สวนหลวง');
    expect(facts.population).toBe(123291);
    expect(facts.greenPerPersonM2).toBe(6.09);
    expect(facts.accessiblePerPersonM2).toBe(1.69);
  });

  it('gives Don Mueang its population', () => {
    expect(districtFacts('ดอนเมือง').population).toBe(165594);
  });

  it('ranks the district among all 50 by green space per person', () => {
    const { rank, of } = districtFacts('สวนหลวง');
    expect(of).toBe(50);
    expect(Number.isInteger(rank)).toBe(true);
    expect(rank).toBeGreaterThanOrEqual(1);
    expect(rank).toBeLessThanOrEqual(50);
  });

  it('returns null for an unknown district', () => {
    expect(districtFacts('ไม่มี')).toBeNull();
  });
});
