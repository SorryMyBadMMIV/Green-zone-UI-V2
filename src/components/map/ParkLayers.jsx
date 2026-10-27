import { Circle, CircleMarker, Pane, Tooltip } from 'react-leaflet';
import { COLORS } from '../../lib/constants.js';

export const PARK_COLORS = { S: COLORS.parkS, M: COLORS.parkM, L: COLORS.parkL, XL: COLORS.parkXL };
const REACH_LABEL = { S: '500 m', M: '1 km', L: '3 km', XL: '5 km' };

/**
 * Park dots (coloured by size class) and the reach circle of every park whose class is ticked. Circles ignore clicks,
 * so the plots under them stay clickable; clicking a dot selects the park.
 */
export default function ParkLayers({ parks, options, selected, onSelect }) {
  return (
    <>
      <Pane name="circles" style={{ zIndex: 392 }}>
        {parks
          .filter((park) => park.size && options[park.size.key])
          .map((park) => (
            <Circle
              key={park.id}
              center={[park.lngLat[1], park.lngLat[0]]}
              radius={park.size.radiusM}
              pathOptions={{
                color: PARK_COLORS[park.size.key],
                weight: 1.5,
                opacity: 0.9,
                dashArray: park.size.key === 'XL' ? '8 6' : undefined,
                fillColor: PARK_COLORS[park.size.key],
                fillOpacity: 0.04,
              }}
              interactive={false}
            />
          ))}
      </Pane>
      <Pane name="parks" style={{ zIndex: 420 }}>
        {parks.map((park) => {
          const isSelected = selected?.kind === 'park' && selected.id === park.id;
          const key = park.size?.key;
          return (
            <CircleMarker
              key={park.id}
              center={[park.lngLat[1], park.lngLat[0]]}
              radius={key === 'XL' || key === 'L' ? 8 : 6}
              pathOptions={{
                color: isSelected ? COLORS.selected : '#ffffff',
                weight: isSelected ? 3 : 1.5,
                fillColor: key ? PARK_COLORS[key] : '#ffffff',
                fillOpacity: 1,
              }}
              bubblingMouseEvents={false}
              eventHandlers={{ click: () => onSelect({ kind: 'park', id: park.id }) }}
            >
              <Tooltip direction="top" offset={[0, -6]}>
                {park.name}
                {key ? ` · ${key} · reaches ${REACH_LABEL[key]}` : ''}
              </Tooltip>
            </CircleMarker>
          );
        })}
      </Pane>
    </>
  );
}
