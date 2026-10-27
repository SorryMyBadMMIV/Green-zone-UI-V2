import { describe, it, expect } from 'vitest';
import parks from './parks.json';

describe('park list (src/data/parks.json)', () => {
  const features = parks.features;

  it('gives every park a unique id, a positive area, a list and a Bangkok position', () => {
    expect(new Set(features.map((f) => f.properties.id)).size).toBe(features.length);
    for (const { geometry, properties } of features) {
      expect(geometry.type).toBe('Point');
      const [lng, lat] = geometry.coordinates;
      expect(lat).toBeGreaterThanOrEqual(13.4);
      expect(lat).toBeLessThanOrEqual(14.1);
      expect(lng).toBeGreaterThanOrEqual(100.2);
      expect(lng).toBeLessThanOrEqual(101.0);
      expect(properties.areaM2).toBeGreaterThan(0);
      expect(properties.lists.length).toBeGreaterThan(0);
    }
  });

  it('has at least 10 parks in Suan Luang and in Don Mueang', () => {
    const count = (district) => features.filter((f) => f.properties.districtTh === district).length;
    expect(count('สวนหลวง')).toBeGreaterThanOrEqual(10);
    expect(count('ดอนเมือง')).toBeGreaterThanOrEqual(10);
  });

  it('includes Suan Luang Rama IX park at 800,000 m²', () => {
    const rama9 = features.find((f) => f.properties.name === 'สวนหลวง ร.๙');
    expect(rama9.properties.areaM2).toBe(800000);
  });

  it('records the rows it skipped, such as the Don Mueang park whose latitude equals its longitude', () => {
    expect(parks.metadata.skipped.map((s) => s.name)).toContain('สวนสุขภาพดอนเมือง-ไทยเทยิ่น');
  });

  it('keeps the 137,600 m² Bangkok wetland forest park, not merged into the pocket park 27 m away', () => {
    const wetland = features.find((f) => f.properties.name === 'สวนป่าชุ่มน้ำบางกอก');
    expect(wetland.properties.areaM2).toBe(137600);
    expect(wetland.properties.districtTh).toBe('บึงกุ่ม');
  });

  it('keeps parks that share a name but lie in different districts', () => {
    const named = (name) => features.filter((f) => f.properties.name === name).map((f) => f.properties.districtTh).sort();
    expect(named('สวนเฉลิมพระเกียรติสมเด็จย่า')).toEqual(['คลองเตย', 'ทวีวัฒนา']);
    expect(named('สวนสมเด็จย่า')).toEqual(['คลองสาน', 'บางขุนเทียน']);
  });

  it('logs every merge, only inside one district: same name within 1 km, or the same place (30 m) at a similar size', () => {
    const { merges } = parks.metadata;
    expect(merges.length).toBeGreaterThan(0);
    const byId = new Map(features.map((f) => [f.properties.id, f.properties]));
    for (const m of merges) {
      expect(byId.get(m.into).districtTh).toBe(m.districtTh);
      expect(m.distanceM).toBeLessThanOrEqual(m.rule === 'same name' ? 1000 : 30);
    }
  });

  it('accounts for every spreadsheet row: kept, merged or skipped', () => {
    const skippedParks = parks.metadata.skipped.length;
    expect(features.length + parks.metadata.merges.length + skippedParks).toBe(281 + 495);
  });
});
