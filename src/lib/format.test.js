import { describe, it, expect } from 'vitest';
import {
  DASH,
  formatArea,
  formatDecimal,
  formatKm,
  formatKm2,
  formatLatLng,
  formatNumber,
  formatPercent,
  formatTemp,
} from './format.js';

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
      expect(formatPercent(value)).toBe(DASH);
      expect(formatTemp(value)).toBe(DASH);
      expect(formatKm(value)).toBe(DASH);
    }
    expect(formatLatLng(null)).toBe(DASH);
    expect(formatLatLng([13.9, null])).toBe(DASH);
  });

  it('formats decimals, areas, temperatures and distances with units', () => {
    expect(formatDecimal(38.0952, 1)).toBe('38.1');
    expect(formatDecimal(0.3264, 2)).toBe('0.33');
    expect(formatArea(800000)).toBe('800,000 m²');
    expect(formatTemp(31.24)).toBe('31.2°C');
    expect(formatKm(2.3)).toBe('2.3 km');
  });

  it('shows km² with 3 decimals under 10 km² and 2 decimals above', () => {
    expect(formatKm2(8978000)).toBe('8.978 km²');
    expect(formatKm2(800000)).toBe('0.800 km²');
    expect(formatKm2(37142000)).toBe('37.14 km²');
  });

  it('formats percentages and lat/lng pairs', () => {
    expect(formatPercent(0.3334)).toBe('33%');
    expect(formatPercent(1)).toBe('100%');
    expect(formatLatLng([13.9218098, 100.5935959])).toBe('13.92181, 100.59360');
  });
});
