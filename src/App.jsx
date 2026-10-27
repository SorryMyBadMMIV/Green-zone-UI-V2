import { useCallback, useEffect, useMemo, useState } from 'react';
import { DEFAULT_OPTIONS } from './components/map/MapOptions.jsx';
import ZoneMap from './components/map/ZoneMap.jsx';
import Sidebar from './components/sidebar/Sidebar.jsx';
import useMapData from './hooks/useMapData.js';
import { DEFAULT_DISTRICT_ID, DISTRICTS, getDistrict } from './data/districts.js';
import parkList from './data/parks.json';
import { analyseDistrict } from './lib/district.js';
import { classifyGrid } from './lib/grid.js';
import { loadParks } from './lib/parks.js';

const ALL_PARKS = loadParks(parkList);
const focusOf = (district) => district.boundaries.features.find((f) => f.properties.role === 'focus').geometry;
// Hiding a layer clears a selection of that kind.
const LAYER_KIND = { green: 'green', abandoned: 'grey' };
const isPhone = () => typeof window !== 'undefined' && typeof window.matchMedia === 'function' && !window.matchMedia('(min-width: 1024px)').matches;

export default function App() {
  const [districtId, setDistrictId] = useState(DEFAULT_DISTRICT_ID);
  const district = getDistrict(districtId);
  const { status, error, green, grey, grid, parkChecks, version, reload } = useMapData(district);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  // The frontend decides every cell (green / grey / water) from its NDVI value.
  const classified = useMemo(() => (grid ? classifyGrid(grid) : null), [grid]);
  // Parks reaching the district, 400 m coverage and every abandoned plot's score and recommendation.
  const analysis = useMemo(
    () => (grey ? analyseDistrict({ focus: focusOf(district), parks: ALL_PARKS, plots: grey }) : null),
    [district, grey],
  );
  const [selected, setSelected] = useState(null); // { kind: 'green' | 'grey' | 'park', id } or null
  const [options, setOptions] = useState(DEFAULT_OPTIONS);
  // On phones the options panel starts folded so it doesn't cover the small map.
  const [optionsCollapsed, setOptionsCollapsed] = useState(isPhone);

  const clearSelection = useCallback(() => setSelected(null), []);

  const changeDistrict = useCallback((id) => {
    setSelected(null);
    setDistrictId(id);
  }, []);

  const changeOption = useCallback((key, value) => {
    setOptions((prev) => ({ ...prev, [key]: value }));
    // Never keep showing stats for a zone the user just hid.
    if (value === false && LAYER_KIND[key]) setSelected((current) => (current?.kind === LAYER_KIND[key] ? null : current));
  }, []);

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === 'Escape') setSelected(null);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  return (
    <div
      className={`flex min-h-dvh flex-col-reverse lg:grid lg:h-dvh ${
        sidebarCollapsed ? 'lg:grid-cols-[48px_minmax(0,1fr)]' : 'lg:grid-cols-[400px_minmax(0,1fr)]'
      }`}
    >
      <Sidebar
        district={district}
        analysis={analysis}
        parkChecks={parkChecks}
        collapsed={sidebarCollapsed}
        onCollapsedChange={setSidebarCollapsed}
        status={status}
        error={error}
        green={green}
        grey={grey}
        classified={classified}
        grid={grid}
        selected={selected}
        onClear={clearSelection}
        onRetry={reload}
      />
      <main className="min-w-0">
        <ZoneMap
          district={district}
          districts={DISTRICTS}
          onDistrictChange={changeDistrict}
          options={options}
          onOptionChange={changeOption}
          optionsCollapsed={optionsCollapsed}
          onOptionsCollapsedChange={setOptionsCollapsed}
          green={green}
          grey={grey}
          classified={classified}
          analysis={analysis}
          version={version}
          selected={selected}
          onSelect={setSelected}
          onClear={clearSelection}
          loading={status === 'loading'}
        />
      </main>
    </div>
  );
}
