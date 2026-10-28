import { Circle, Tooltip } from 'react-leaflet';
import { COLORS } from '../../lib/constants.js';
import { formatArea } from '../../lib/format.js';

/**
 * The backend's green groups: a teal circle around every group of green that is not a park, dashed for isolated green.
 * ZoneMap draws them in the "groups" pane, above the park reach circles and below the plots, so plots and park dots
 * stay clickable.
 */
export default function GreenGroupLayer({ greenGroups, selected, onSelect }) {
  return greenGroups.features.map(({ geometry, properties: group }) => {
    const isSelected = selected?.kind === 'group' && selected.id === group.id;
    const isolated = group.kind === 'isolated';
    return (
      <Circle
        key={group.id}
        center={[geometry.coordinates[1], geometry.coordinates[0]]}
        radius={group.radiusM}
        pathOptions={{
          color: isSelected ? COLORS.selected : COLORS.greenGroup,
          weight: isSelected ? 3 : 1.5,
          dashArray: isolated ? '5 5' : undefined,
          fillColor: COLORS.greenGroup,
          fillOpacity: isSelected ? 0.2 : 0.06,
        }}
        bubblingMouseEvents={false}
        eventHandlers={{ click: () => onSelect({ kind: 'group', id: group.id }) }}
      >
        <Tooltip sticky>{`${isolated ? 'Isolated green' : 'Green group'} ${group.id} · ${formatArea(group.greenM2InGroup)} of green`}</Tooltip>
      </Circle>
    );
  });
}
