import { describe, it, expect } from 'vitest';
import { DEFAULT_DISTRICT_ID, DISTRICTS, getDistrict } from './districts.js';

describe('districts', () => {
  it('opens on Suan Luang and falls back to it for an unknown id', () => {
    expect(DEFAULT_DISTRICT_ID).toBe('suan-luang');
    expect(getDistrict('nope').id).toBe('suan-luang');
    expect(getDistrict('don-mueang').nameEn).toBe('Don Mueang');
  });

  it('gives both districts four frame corners and one focus outline', () => {
    expect(DISTRICTS.map((d) => d.id)).toEqual(['suan-luang', 'don-mueang']);
    for (const district of DISTRICTS) {
      expect(Object.keys(district.frame.corners).sort()).toEqual(['bottomLeft', 'bottomRight', 'topLeft', 'topRight']);
      expect(district.boundaries.features.filter((f) => f.properties.role === 'focus')).toHaveLength(1);
      expect(district.images.heatmap).toMatch(/heatmap\.png/);
    }
  });

  it('uses the backend green image in Suan Luang and the NDVI grid in Don Mueang', () => {
    const suanLuang = getDistrict('suan-luang');
    expect(suanLuang.data).toEqual({ grid: false, greenZones: false, parkChecks: true });
    expect(suanLuang.images.green).toMatch(/green\.png/);
    expect(suanLuang.greenSummary).toEqual({ greenM2: 1753864.25, validM2: 32000000, patches: 1148 });
    const donMueang = getDistrict('don-mueang');
    expect(donMueang.data).toEqual({ grid: true, greenZones: true, parkChecks: false });
    expect(donMueang.frame.id).toBe('gisda_03');
    expect(donMueang.otherFrames.map((f) => f.id)).toEqual(['gisda_01', 'gisda_02']);
  });
});
