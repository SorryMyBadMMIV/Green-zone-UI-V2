import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import useMapData from './useMapData.js';
import { fetchDistrictData } from '../api/data.js';

vi.mock('../api/data.js', () => ({ fetchDistrictData: vi.fn() }));

const collection = (id) => ({ type: 'FeatureCollection', features: [{ type: 'Feature', geometry: null, properties: { id } }] });
const grid = { frameId: 'gisda_03', rows: 1, cols: 1, cellSizeM: 100, ndvi: [[0.4]] };
const suanLuang = { id: 'suan-luang' };
const donMueang = { id: 'don-mueang' };
const dataFor = (district) => ({
  green: null,
  grey: collection(`${district.id}-plot`),
  grid: district === donMueang ? grid : null,
  parkChecks: null,
  gaSites: district === suanLuang ? collection('r0_c0-1') : null,
  greenGroups: district === suanLuang ? collection('1') : null,
});

beforeEach(() => {
  vi.mocked(fetchDistrictData).mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('useMapData', () => {
  it("loads the district's data, then becomes ready", async () => {
    vi.mocked(fetchDistrictData).mockImplementation(async (district) => dataFor(district));
    const { result } = renderHook(() => useMapData(donMueang));
    expect(result.current.status).toBe('loading');
    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(result.current.grey.features[0].properties.id).toBe('don-mueang-plot');
    expect(result.current.grid).toEqual(grid);
    expect(fetchDistrictData).toHaveBeenCalledWith(donMueang, expect.any(Object));
    expect(result.current.version).toBe(1);
  });

  it("drops the old district's data as soon as the district changes", async () => {
    let finishSecond;
    vi.mocked(fetchDistrictData)
      .mockImplementationOnce(async (district) => dataFor(district))
      .mockImplementationOnce((district) => new Promise((resolve) => (finishSecond = () => resolve(dataFor(district)))));
    const { result, rerender } = renderHook(({ district }) => useMapData(district), { initialProps: { district: suanLuang } });
    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(result.current.gaSites.features).toHaveLength(1);

    rerender({ district: donMueang });
    expect(result.current.status).toBe('loading');
    expect(result.current.grey).toBeNull();
    expect(result.current.grid).toBeNull();
    expect(result.current.gaSites).toBeNull();
    expect(result.current.greenGroups).toBeNull();

    await act(async () => finishSecond());
    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(result.current.grey.features[0].properties.id).toBe('don-mueang-plot');
  });

  it('reports an error, then loads again on reload', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(fetchDistrictData).mockRejectedValueOnce(new Error('offline'));
    const { result } = renderHook(() => useMapData(suanLuang));
    await waitFor(() => expect(result.current.status).toBe('error'));
    expect(result.current.error.message).toBe('offline');

    vi.mocked(fetchDistrictData).mockImplementation(async (district) => dataFor(district));
    act(() => result.current.reload());
    expect(result.current.status).toBe('loading');
    await waitFor(() => expect(result.current.status).toBe('ready'));
  });
});
