import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import Sidebar from './Sidebar.jsx';
import { classifyGrid } from '../../lib/grid.js';
import { getDistrict } from '../../data/districts.js';
import { analyseDistrict } from '../../lib/district.js';
import { loadParks } from '../../lib/parks.js';

const square = { type: 'Polygon', coordinates: [[[100.5, 13.7], [100.51, 13.7], [100.51, 13.71], [100.5, 13.71], [100.5, 13.7]]] };

const green = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      geometry: square,
      properties: {
        id: 'GZ-001',
        name: 'Open green land 1',
        nameTh: 'ที่โล่งสีเขียว 1',
        type: 'Open green land',
        district: 'Don Mueang',
        areaM2: 800000,
        populationNearby: 21000,
        nearbyRadiusKm: 1,
        ndvi: 0.62,
        tempInsideC: 31.2,
        tempAroundC: 35.8,
        updatedAt: '2026-10-15',
      },
    },
  ],
};

const greyZone = (id, rank, fitness, distanceKm = 4.7) => ({
  type: 'Feature',
  geometry: square,
  properties: {
    id,
    district: 'Don Mueang',
    areaM2: 12400,
    populationNearby: 38000,
    nearbyRadiusKm: 1,
    fitness,
    rank,
    scores: { greenAccessDeficit: 5, airProximity: 5, heatSeverity: 4 },
    penalty: 0,
    ndvi: 0.08,
    surfaceTempC: 37.4,
    nearestGreenZone: { id: 'GZ-010', name: 'Airfield grass 3', distanceKm },
    updatedAt: null,
  },
});

const grey = {
  type: 'FeatureCollection',
  features: [0.91, 0.84, 0.76, 0.71, 0.65, 0.58, 0.54, 0.41].map((fitness, i) =>
    greyZone(i === 0 ? 'G-001' : `G-00${i + 1}`, i + 1, fitness, i === 7 ? 0 : 4.7),
  ),
};

// 30 × 30 grid over the real gisda_03 frame: the top 10 rows are green, the rest grey (≈ a third green).
const grid = {
  frameId: 'gisda_03',
  rows: 30,
  cols: 30,
  cellSizeM: 100,
  ndvi: Array.from({ length: 30 }, (_, row) => Array(30).fill(row < 10 ? 0.6 : 0.1)),
};
const classified = classifyGrid(grid);

const donMueang = getDistrict('don-mueang');
const suanLuang = getDistrict('suan-luang');
const focusOf = (district) => district.boundaries.features.find((f) => f.properties.role === 'focus').geometry;

// Two small (S) parks inside Suan Luang, from the BMA list.
const parks = loadParks({
  type: 'FeatureCollection',
  features: [
    ['p-mitrapap', 'สวนมิตรภาพภิรมย์', [100.6398471, 13.7051741], 7308],
    ['p-sripat', 'สวนศรีพัฒน์ภิรมย์', [100.6408915, 13.7350756], 3600],
  ].map(([id, name, coordinates, areaM2]) => ({
    type: 'Feature',
    geometry: { type: 'Point', coordinates },
    properties: { id, name, districtTh: 'สวนหลวง', areaM2, owner: 'กรุงเทพมหานคร', kind: 'พัฒนาพื้นที่สีเขียวใหม่', lists: ['15min'] },
  })),
});

// One example plot (100 m × 100 m) about 2.7 km from both parks.
const farPlot = {
  type: 'Feature',
  geometry: { type: 'Polygon', coordinates: [[[100.6595, 13.7195], [100.6605, 13.7195], [100.6605, 13.7205], [100.6595, 13.7205], [100.6595, 13.7195]]] },
  properties: { id: 'SL-T1', district: 'Suan Luang', areaM2: 10000, populationNearby: null, fitness: null, rank: null, scores: {}, landCover: 'overgrown', isExample: true },
};
const suanLuangGrey = { type: 'FeatureCollection', features: [farPlot] };
const parkChecks = {
  type: 'FeatureCollection',
  features: [{ type: 'Feature', geometry: { type: 'Point', coordinates: [100.6408915, 13.7350756] }, properties: { name: 'สวนศรีพัฒน์ภิรมย์', areaM2: 3600, sizeClass: 'S', status: 'green_detected', greenM2: 2000 } }],
};

const donMueangAnalysis = analyseDistrict({ focus: focusOf(donMueang), parks, plots: grey });
const suanLuangAnalysis = analyseDistrict({ focus: focusOf(suanLuang), parks, plots: suanLuangGrey });

const renderSuanLuang = (props = {}) =>
  render(
    <Sidebar
      district={suanLuang}
      analysis={suanLuangAnalysis}
      parkChecks={parkChecks}
      status="ready"
      green={null}
      grey={suanLuangGrey}
      classified={null}
      grid={null}
      selected={null}
      onClear={() => {}}
      onRetry={() => {}}
      collapsed={false}
      onCollapsedChange={() => {}}
      {...props}
    />,
  );

const renderSidebar = (props = {}) =>
  render(
    <Sidebar
      district={donMueang}
      analysis={donMueangAnalysis}
      parkChecks={null}
      collapsed={false}
      onCollapsedChange={() => {}}
      status="ready"
      green={green}
      grey={grey}
      classified={classified}
      grid={grid}
      selected={null}
      onClear={() => {}}
      onRetry={() => {}}
      {...props}
    />,
  );

describe('Sidebar', () => {
  it('shows the Don Mueang overview with the green share and areas in km²', () => {
    renderSidebar();
    expect(screen.getByRole('heading', { name: 'Don Mueang overview' })).toBeTruthy();
    expect(screen.getByText('33%')).toBeTruthy();
    expect(screen.getByText('8.978 km²')).toBeTruthy();
    expect(screen.getByText('37.14 km²')).toBeTruthy();
    expect(screen.getByText('High 3')).toBeTruthy();
  });

  it('lists the other GISTDA frames as "Update soon" with their areas', () => {
    renderSidebar();
    expect(screen.getAllByText('Update soon')).toHaveLength(2);
    expect(screen.getByText('9.024 km²')).toBeTruthy();
    expect(screen.getByText('8.957 km²')).toBeTruthy();
  });

  it('shows green zone stats with the area in km² and the math written out', () => {
    renderSidebar({ selected: { kind: 'green', id: 'GZ-001' } });
    expect(screen.getByRole('heading', { name: 'Open green land 1' })).toBeTruthy();
    expect(screen.getByText('38.1')).toBeTruthy();
    expect(screen.getByText('Meets target')).toBeTruthy();
    expect(screen.getByText('0.800 km²')).toBeTruthy();
    expect(screen.getByText('800,000 m² ÷ 21,000 people = 38.1 m² each')).toBeTruthy();
    expect(screen.getByText('4.6°C cooler than around it')).toBeTruthy();
    expect(screen.getByText('NDVI 0.62 · dense vegetation')).toBeTruthy();
  });

  it('shows grey zone fitness, rank, factors and the site area in m², like the box on the map', () => {
    renderSidebar({ selected: { kind: 'grey', id: 'G-001' } });
    expect(screen.getByRole('heading', { name: 'Site G-001' })).toBeTruthy();
    expect(screen.getByText('Planting score')).toBeTruthy();
    expect(screen.getByText('0.91')).toBeTruthy();
    expect(screen.getByText('High priority · rank 1 of 8')).toBeTruthy();
    expect(screen.getByText('Far from parks')).toBeTruthy();
    expect(screen.getByText('12,400 m²')).toBeTruthy();
    expect(screen.getByText('Greening it adds 0.33 m² per nearby person')).toBeTruthy();
    expect(screen.getByText('Airfield grass 3 · 4.7 km')).toBeTruthy();
  });

  it('says "next to it" when the nearest green zone is closer than 0.1 km', () => {
    renderSidebar({ selected: { kind: 'grey', id: 'G-008' } });
    expect(screen.getByText('Airfield grass 3 · next to it')).toBeTruthy();
  });

  it('falls back to the overview when the selected zone is not in the data', () => {
    renderSidebar({ selected: { kind: 'green', id: 'GZ-404' } });
    expect(screen.getByRole('heading', { name: 'Don Mueang overview' })).toBeTruthy();
  });

  it('calls onClear from the close button', () => {
    const onClear = vi.fn();
    renderSidebar({ selected: { kind: 'green', id: 'GZ-001' }, onClear });
    fireEvent.click(screen.getByRole('button', { name: /close/i }));
    expect(onClear).toHaveBeenCalledOnce();
  });

  it('shows placeholder cards while loading', () => {
    renderSidebar({ status: 'loading', green: null, grey: null, classified: null, grid: null });
    expect(screen.getByLabelText('Loading zone data')).toBeTruthy();
  });

  it('shows an error with a working Retry button', () => {
    const onRetry = vi.fn();
    renderSidebar({ status: 'error', green: null, grey: null, classified: null, grid: null, onRetry });
    expect(screen.getByRole('alert').textContent).toContain("Couldn't load zone data");
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it('says what failed, and does not blame a backend while it uses the example data', () => {
    const error = new Error('Loading ./assets/green-zones.geojson failed with HTTP 404.');
    renderSidebar({ status: 'error', error, green: null, grey: null, classified: null, grid: null });
    const alert = screen.getByRole('alert').textContent;
    expect(alert).toContain('Loading ./assets/green-zones.geojson failed with HTTP 404.');
    expect(alert).toContain('example data');
    expect(alert).not.toMatch(/backend/i);
  });

  it('shows the Green Lantern name and the district in the header', () => {
    renderSidebar();
    expect(screen.getByRole('heading', { name: 'Green Lantern' })).toBeTruthy();
    expect(screen.getByText('Don Mueang green space explorer')).toBeTruthy();
  });

  it('shows the Suan Luang overview from the backend summary, district facts, park sizes, policy and recommendations', () => {
    renderSuanLuang();
    expect(screen.getByRole('heading', { name: 'Suan Luang overview' })).toBeTruthy();
    expect(screen.getByText('5%')).toBeTruthy();
    expect(screen.getByText('1.754 km²')).toBeTruthy();
    expect(screen.getByText('123,291')).toBeTruthy();
    expect(screen.getByText('S 2 · M 0 · L 0 · XL 0')).toBeTruthy();
    expect(screen.getByText(/of Suan Luang is within 400 m of a park/)).toBeTruthy();
    expect(screen.getByText('The policy: a park within 400 m. Straight-line distance, not walking distance.')).toBeTruthy();
    expect(screen.queryByText(/aims for/)).toBeNull();
    expect(screen.getByText('1 recommended site')).toBeTruthy();
    expect(screen.getByText('1 very good · 0 good')).toBeTruthy();
    expect(screen.getByText(/From example plots/)).toBeTruthy();
  });

  it('shows a park with its size class, lists and what the satellite saw', () => {
    renderSuanLuang({ selected: { kind: 'park', id: 'p-sripat' } });
    expect(screen.getByRole('heading', { name: 'สวนศรีพัฒน์ภิรมย์' })).toBeTruthy();
    expect(screen.getByText('S · reaches 500 m')).toBeTruthy();
    expect(screen.getByText('Green seen by satellite: Yes')).toBeTruthy();
    expect(screen.getByText('15-minute parks')).toBeTruthy();
  });

  it('shows the planting score of a far example plot and hides the fitness cards it has no data for', () => {
    renderSuanLuang({ selected: { kind: 'grey', id: 'SL-T1' } });
    expect(screen.getByText('Abandoned land · example')).toBeTruthy();
    expect(screen.getByText('Very good for planting')).toBeTruthy();
    expect(screen.getByText('★ Recommended')).toBeTruthy();
    expect(screen.queryByText('Why this site?')).toBeNull();
  });

  it('minimizes, and when minimized shows only the button that opens it again', () => {
    const onCollapsedChange = vi.fn();
    const { unmount } = renderSuanLuang({ onCollapsedChange });
    fireEvent.click(screen.getByRole('button', { name: 'Minimize sidebar' }));
    expect(onCollapsedChange).toHaveBeenCalledWith(true);
    unmount();
    renderSuanLuang({ collapsed: true, onCollapsedChange });
    expect(screen.queryByRole('heading', { name: 'Green Lantern' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Open sidebar' }));
    expect(onCollapsedChange).toHaveBeenCalledWith(false);
  });
});
