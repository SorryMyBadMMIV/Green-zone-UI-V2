import { describe, it, expect } from 'vitest';
import { starLabel } from './RecommendMarkers.jsx';

describe('starLabel', () => {
  const level = { key: 'good', label: 'Good for planting' };

  it('marks a ★ on an example plot as an example', () => {
    expect(starLabel({ score: 72, level, isExample: true })).toBe('Example · ★ Recommended · Good for planting · score 72');
  });

  it('leaves the example tag off a real detection', () => {
    expect(starLabel({ score: 72, level, isExample: false })).toBe('★ Recommended · Good for planting · score 72');
  });
});
