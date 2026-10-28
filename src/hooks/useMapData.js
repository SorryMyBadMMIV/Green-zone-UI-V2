import { useCallback, useEffect, useState } from 'react';
import { fetchDistrictData } from '../api/data.js';

const EMPTY = { status: 'loading', green: null, grey: null, grid: null, parkChecks: null, gaSites: null, greenGroups: null, error: null };

/**
 * Loads what the map needs for a district: abandoned plots, and green zones, NDVI grid, park checks, GA sites and green
 * groups where the district has them. Returns { status: 'loading' | 'ready' | 'error', green, grey, grid, parkChecks,
 * gaSites, greenGroups, error, version, reload }. When the district changes, the old district's data is dropped at once (status 'loading').
 * `version` goes up by one after every successful load (the map uses it to redraw).
 */
export default function useMapData(district) {
  const [state, setState] = useState({ ...EMPTY, districtId: district.id, version: 0 });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;
    setState((prev) => (prev.districtId === district.id && prev.status === 'loading' ? prev : { ...prev, ...EMPTY, districtId: district.id }));
    fetchDistrictData(district, { signal })
      .then((data) => {
        setState((prev) => ({ ...EMPTY, ...data, status: 'ready', districtId: district.id, version: prev.version + 1 }));
      })
      .catch((error) => {
        if (signal.aborted) return;
        console.error(error);
        setState((prev) => ({ ...prev, ...EMPTY, status: 'error', error, districtId: district.id }));
      });
    return () => controller.abort();
  }, [district, attempt]);

  const reload = useCallback(() => {
    setState((prev) => ({ ...prev, status: 'loading', error: null }));
    setAttempt((n) => n + 1);
  }, []);

  // Never show one district's data while another is selected.
  const current = state.districtId === district.id ? state : { ...state, ...EMPTY, districtId: district.id };
  const { districtId: _districtId, ...result } = current;
  return { ...result, reload };
}
