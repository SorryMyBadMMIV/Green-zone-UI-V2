import { Marker, Tooltip } from 'react-leaflet';
import L from 'leaflet';
import { formatArea } from '../../lib/format.js';

const icon = (selected) =>
  L.divIcon({ className: `ga-site${selected ? ' is-selected' : ''}`, html: '<span aria-hidden="true"></span>', iconSize: [20, 20], iconAnchor: [10, 10] });
const ICON = icon(false);
const SELECTED_ICON = icon(true);

/** A purple ◆ on every GA park site the backend picked; clicking one selects it. */
export default function GaSiteMarkers({ gaSites, sitesInSquare, selected, onSelect }) {
  return gaSites.features.map(({ geometry, properties: site }) => {
    const isSelected = selected?.kind === 'ga' && selected.id === site.id;
    const of = sitesInSquare[site.zone];
    return (
      <Marker
        key={site.id}
        position={[geometry.coordinates[1], geometry.coordinates[0]]}
        icon={isSelected ? SELECTED_ICON : ICON}
        zIndexOffset={isSelected ? 1000 : 0}
        keyboard={false}
        bubblingMouseEvents={false}
        eventHandlers={{ click: () => onSelect({ kind: 'ga', id: site.id }) }}
      >
        <Tooltip direction="top" offset={[0, -10]}>
          {`GA park site · rank ${site.rank}${of ? ` of ${of}` : ''} in its 1 km square · ${formatArea(site.areaM2)}`}
        </Tooltip>
      </Marker>
    );
  });
}
