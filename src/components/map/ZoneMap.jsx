import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { GeoJSON, MapContainer, Marker, Pane, TileLayer, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { LoaderCircle, Maximize, Minus, Plus } from 'lucide-react';
import { BASEMAPS, MAP_DEFAULTS } from '../../config.js';
import { sitesPerSquare } from '../../lib/backendResults.js';
import { COLORS } from '../../lib/constants.js';
import { formatKm2 } from '../../lib/format.js';
import { frameCenter, frameRing, maskPolygon, polygonAreaM2 } from '../../lib/geo.js';
import ClassifiedGridLayer from './ClassifiedGridLayer.jsx';
import FrameImageLayer from './FrameImageLayer.jsx';
import GaSiteMarkers from './GaSiteMarkers.jsx';
import GreenGroupLayer from './GreenGroupLayer.jsx';
import MapLegend from './MapLegend.jsx';
import MapOptions from './MapOptions.jsx';
import ParkLayers from './ParkLayers.jsx';
import PlotInfoBox from './PlotInfoBox.jsx';
import PolicyLayer from './PolicyLayer.jsx';
import RecommendMarkers from './RecommendMarkers.jsx';
import { GaSiteInfoBox, GreenGroupInfoBox } from './SiteInfoBoxes.jsx';

const FIT_OPTIONS = { padding: [24, 24] };

// ---- The focus district, its grey neighbours and its image frames ----
const escapeHtml = (text) =>
  String(text).replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[ch]);
const labelIcon = (html, className = '') =>
  L.divIcon({ className: `map-label ${className}`.trim(), html: `<span>${html}</span>`, iconSize: null });
const SOON = '<small>Update soon</small>';

const VIEWS = new WeakMap();
/** Everything the map draws for a district that never changes: outline, mask, frames and labels. */
function districtView(district) {
  if (VIEWS.has(district)) return VIEWS.get(district);
  const { features, metadata } = district.boundaries;
  const focus = features.find((f) => f.properties.role === 'focus');
  const neighbours = features.filter((f) => f.properties.role === 'soon');
  const [west, south, east, north] = metadata.viewBounds;
  const frames = [
    { id: district.frame.id, label: district.frame.label, corners: district.frame.corners, ready: true },
    ...district.otherFrames.map((frame) => ({ id: frame.id, label: frame.id, corners: frame.corners, ready: false })),
  ].map((frame) => {
    const geometry = { type: 'Polygon', coordinates: [frameRing(frame.corners)] };
    return { ...frame, geometry, areaM2: polygonAreaM2(geometry) };
  });
  const view = {
    focus,
    neighbours,
    viewBounds: L.latLngBounds([south, west], [north, east]),
    focusBounds: L.geoJSON(focus).getBounds(),
    // The grey "update soon" cover reaches far past the view, so panning never shows its edge.
    mask: maskPolygon(focus.geometry, [west - 1, south - 1, east + 1, north + 1]),
    frames,
    labels: [
      ...neighbours.map(({ properties: p }) => ({
        id: p.id,
        position: [p.label[1], p.label[0]],
        icon: labelIcon(`${escapeHtml(p.nameEn)} · ${escapeHtml(p.nameTh)}${SOON}`),
      })),
      ...frames.map((frame) =>
        frame.ready
          ? { id: frame.id, position: frame.corners.topLeft, icon: labelIcon(`${escapeHtml(frame.label)} · ${formatKm2(frame.areaM2)}`, 'frame-label') }
          : { id: frame.id, position: frameCenter(frame.corners), icon: labelIcon(`${escapeHtml(frame.label)}${SOON}`) },
      ),
    ],
  };
  VIEWS.set(district, view);
  return view;
}

/** Grey cover outside the district, neighbour outlines, the district outline, frames and labels. */
const FocusLayers = memo(function FocusLayers({ view }) {
  return (
    <>
      <Pane name="mask" style={{ zIndex: 350 }}>
        <GeoJSON data={view.mask} style={{ stroke: false, fillColor: COLORS.mask, fillOpacity: 0.55 }} interactive={false} />
        {view.neighbours.map((district) => (
          <GeoJSON
            key={district.properties.id}
            data={district}
            style={{ color: '#ffffff', weight: 1.5, opacity: 0.7, dashArray: '4 4', fill: false }}
            interactive={false}
          />
        ))}
      </Pane>
      <GeoJSON data={view.focus} style={{ color: COLORS.focusOutline, weight: 3, fill: false }} interactive={false} />
      {view.frames.map((frame) => (
        <GeoJSON
          key={frame.id}
          data={frame.geometry}
          interactive={false}
          style={frame.ready ? { color: COLORS.frameOutline, weight: 2, fill: false } : { color: '#ffffff', weight: 2, dashArray: '6 6', fill: false }}
        />
      ))}
      <Pane name="labels" style={{ zIndex: 450 }}>
        {view.labels.map((label) => (
          <Marker key={label.id} position={label.position} icon={label.icon} interactive={false} keyboard={false} />
        ))}
      </Pane>
    </>
  );
});

// ---- Zones ----
const isSelected = (selected, kind, id) => selected?.kind === kind && selected.id === id;

// Abandoned plots are named by their planting level, for example "Example plot · Good for planting".
const zoneLabel = (kind, p, plotLevel) =>
  kind === 'green' ? p.name : `${p.isExample ? 'Example plot' : `Plot ${p.id}`}${plotLevel ? ` · ${plotLevel.label}` : ''}`;

function zoneStyle(kind, p, selected) {
  let base;
  if (kind === 'green') {
    base = { color: COLORS.greenZoneStroke, fillColor: COLORS.greenZoneFill, fillOpacity: 0.12 };
  } else {
    base = { color: COLORS.abandonedStroke, fillColor: COLORS.abandonedFill, fillOpacity: 0.5 };
  }
  return isSelected(selected, kind, p.id) ? { ...base, color: COLORS.selected, weight: 3 } : { ...base, weight: 2 };
}

/** One layer of zone shapes. Styles update in place when the selection changes. */
function ZoneShapes({ kind, data, selected, onSelect, plots = null }) {
  const layerRef = useRef(null);
  const latest = useRef({ selected, onSelect });

  useEffect(() => {
    latest.current = { selected, onSelect };
  });

  useEffect(() => {
    layerRef.current?.eachLayer((layer) => {
      const p = layer.feature.properties;
      layer.setStyle(zoneStyle(kind, p, selected));
      if (isSelected(selected, kind, p.id)) layer.bringToFront();
    });
  }, [kind, selected]);

  const style = useCallback((feature) => zoneStyle(kind, feature.properties, latest.current.selected), [kind]);

  const onEachFeature = useCallback(
    (feature, layer) => {
      const p = feature.properties;
      layer.bindTooltip(zoneLabel(kind, p, plots?.[p.id]?.level), { sticky: true, direction: 'top' });
      layer.on({
        click: () => latest.current.onSelect({ kind, id: p.id }),
        mouseover: () => layer.setStyle({ weight: 3.5 }),
        mouseout: () => layer.setStyle(zoneStyle(kind, p, latest.current.selected)),
      });
    },
    [kind, plots],
  );

  return <GeoJSON ref={layerRef} data={data} style={style} onEachFeature={onEachFeature} bubblingMouseEvents={false} />;
}

// ---- Map behaviour and controls ----
/** Lets the user zoom out a little past the district, but not further. Skipped while the map has no size. */
function updateMinZoom(map, focusBounds) {
  const size = map.getSize();
  if (size.x > 0 && size.y > 0) map.setMinZoom(Math.max(MAP_DEFAULTS.minZoom, map.getBoundsZoom(focusBounds) - 0.75));
}

/** Fits the district once the map has a real size and again when the district changes; clears on empty clicks. */
function MapEvents({ view, onReady, onEmptyClick }) {
  const latestView = useRef(view);
  const map = useMapEvents({
    click: () => onEmptyClick(),
    resize: () => updateMinZoom(map, latestView.current.focusBounds),
  });
  useEffect(() => {
    // Leaflet only notices window resizes. Watch the container itself: it can start at 0 × 0 (or a
    // half-laid-out size) and fitting then would zoom all the way in.
    let fitted = false;
    const container = map.getContainer();
    const observer = new ResizeObserver(() => {
      map.invalidateSize();
      if (!fitted && container.clientWidth > 0 && container.clientHeight > 0) {
        fitted = true;
        map.fitBounds(latestView.current.focusBounds, FIT_OPTIONS);
        updateMinZoom(map, latestView.current.focusBounds);
      }
    });
    observer.observe(container);
    onReady(map);
    return () => observer.disconnect();
  }, [map, onReady]);
  useEffect(() => {
    // A new district: move the limits first, then fit it.
    if (latestView.current === view) return;
    latestView.current = view;
    map.setMinZoom(MAP_DEFAULTS.minZoom);
    map.setMaxBounds(view.viewBounds);
    map.fitBounds(view.focusBounds, { ...FIT_OPTIONS, animate: false });
    updateMinZoom(map, view.focusBounds);
  }, [map, view]);
  return null;
}

const buttonClass =
  'flex size-9 items-center justify-center bg-white text-neutral-800 hover:bg-neutral-100 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-blue-600';

function MapButtons({ map, onReset }) {
  return (
    <div className="absolute left-3 top-3 z-[1000] flex flex-col divide-y divide-black/10 overflow-hidden rounded-lg border border-black/15 shadow-md">
      <button type="button" className={buttonClass} aria-label="Zoom in" title="Zoom in" onClick={() => map?.zoomIn()}>
        <Plus size={18} aria-hidden="true" />
      </button>
      <button type="button" className={buttonClass} aria-label="Zoom out" title="Zoom out" onClick={() => map?.zoomOut()}>
        <Minus size={18} aria-hidden="true" />
      </button>
      <button type="button" className={buttonClass} aria-label="Reset view" title="Reset view" onClick={onReset}>
        <Maximize size={16} aria-hidden="true" />
      </button>
    </div>
  );
}

/**
 * The interactive map of one district: satellite or street base map, the grey cover outside the district, the heat
 * map, the green layer (NDVI grid or backend green image), zones, the backend's GA sites and green groups, controls and
 * legend.
 */
export default function ZoneMap({
  district,
  districts,
  onDistrictChange,
  options,
  onOptionChange,
  optionsCollapsed,
  onOptionsCollapsedChange,
  green,
  grey,
  gaSites,
  greenGroups,
  classified,
  analysis,
  version,
  selected,
  onSelect,
  onClear,
  loading,
}) {
  const [map, setMap] = useState(null);
  const view = useMemo(() => districtView(district), [district]);
  const [initialView] = useState(view);
  const resetView = useCallback(() => map?.fitBounds(view.focusBounds, FIT_OPTIONS), [map, view]);
  const basemap = BASEMAPS[options.basemap] ?? BASEMAPS.satellite;
  const selectedPlot = selected?.kind === 'grey' ? grey?.features.find((f) => f.properties.id === selected.id)?.properties : null;
  const selectedAnalysis = selectedPlot ? analysis?.plots[selectedPlot.id] : null;
  const sitesInSquare = useMemo(() => sitesPerSquare(gaSites), [gaSites]);
  const selectedSite = selected?.kind === 'ga' ? gaSites?.features.find((f) => f.properties.id === selected.id)?.properties : null;
  const selectedGroup = selected?.kind === 'group' ? greenGroups?.features.find((f) => f.properties.id === selected.id)?.properties : null;

  return (
    <div className="relative h-[55vh] min-h-80 lg:h-dvh">
      <MapContainer
        center={initialView.focusBounds.getCenter()}
        zoom={MAP_DEFAULTS.zoom}
        minZoom={MAP_DEFAULTS.minZoom}
        maxZoom={MAP_DEFAULTS.maxZoom}
        zoomSnap={0.25}
        maxBounds={initialView.viewBounds}
        maxBoundsViscosity={1}
        zoomControl={false}
        className="isolate size-full"
      >
        <TileLayer
          key={options.basemap}
          url={basemap.url}
          attribution={basemap.attribution}
          maxNativeZoom={basemap.maxNativeZoom}
          maxZoom={basemap.maxZoom}
          className={`basemap-${options.basemap}`}
        />
        <MapEvents view={view} onReady={setMap} onEmptyClick={onClear} />
        <FocusLayers view={view} />
        <Pane name="heat" style={{ zIndex: 380 }}>
          {options.heatmap && (
            <FrameImageLayer key={`heat-${district.id}`} corners={district.frame.corners} source={district.images.heatmap} pane="heat" opacity={0.7} smooth />
          )}
        </Pane>
        <Pane name="grid" style={{ zIndex: 390 }}>
          {district.data.grid && options.grid && classified && <ClassifiedGridLayer frame={district.frame} classified={classified} pane="grid" />}
          {district.images.green && options.green && (
            <FrameImageLayer key={`green-${district.id}`} corners={district.frame.corners} source={district.images.green} pane="grid" />
          )}
        </Pane>
        {options.green && green && (
          <ZoneShapes key={`green-${district.id}-${version}`} kind="green" data={green} selected={selected} onSelect={onSelect} />
        )}
        {options.abandoned && grey && (
          <ZoneShapes key={`grey-${district.id}-${version}`} kind="grey" data={grey} selected={selected} onSelect={onSelect} plots={analysis?.plots} />
        )}
        <Pane name="policy" style={{ zIndex: 385 }}>
          {options.policy && analysis && <PolicyLayer key={district.id} focus={view.focus.geometry} parks={analysis.parks} pane="policy" />}
        </Pane>
        {analysis && <ParkLayers parks={analysis.parks} options={options} selected={selected} onSelect={onSelect} />}
        <Pane name="groups" style={{ zIndex: 395 }}>
          {options.greenGroups && greenGroups && <GreenGroupLayer greenGroups={greenGroups} selected={selected} onSelect={onSelect} />}
        </Pane>
        {options.recommend && options.abandoned && analysis && <RecommendMarkers analysis={analysis} onSelect={onSelect} />}
        {options.gaSites && gaSites && <GaSiteMarkers gaSites={gaSites} sitesInSquare={sitesInSquare} selected={selected} onSelect={onSelect} />}
      </MapContainer>
      <MapButtons map={map} onReset={resetView} />
      <MapOptions
        district={district}
        districts={districts}
        onDistrictChange={onDistrictChange}
        options={options}
        onOptionChange={onOptionChange}
        collapsed={optionsCollapsed}
        onCollapsedChange={onOptionsCollapsedChange}
      />
      <MapLegend district={district} />
      {selectedPlot && selectedAnalysis && <PlotInfoBox plot={selectedPlot} analysis={selectedAnalysis} onClose={onClear} />}
      {selectedSite && <GaSiteInfoBox site={selectedSite} sitesInSquare={sitesInSquare[selectedSite.zone]} onClose={onClear} />}
      {selectedGroup && <GreenGroupInfoBox group={selectedGroup} onClose={onClear} />}
      {loading && (
        <p className="pointer-events-none absolute left-1/2 top-16 z-[1000] flex -translate-x-1/2 items-center gap-2 rounded-full bg-white px-3 py-1.5 text-sm text-neutral-800 shadow-md lg:top-3">
          <LoaderCircle size={16} className="animate-spin" aria-hidden="true" />
          Loading zones…
        </p>
      )}
    </div>
  );
}
