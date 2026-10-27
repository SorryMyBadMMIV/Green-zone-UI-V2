import { Marker, Tooltip } from 'react-leaflet';
import L from 'leaflet';

const STAR = L.divIcon({ className: 'recommend-star', html: '<span aria-hidden="true">★</span>', iconSize: [26, 26], iconAnchor: [13, 13] });

/** The ★ tooltip; example plots say so first. */
export function starLabel({ score, level, isExample }) {
  return `${isExample ? 'Example · ' : ''}★ Recommended · ${level.label} · score ${score}`;
}

/** A ★ on every recommended plot (inside the plot); clicking it selects the plot. */
export default function RecommendMarkers({ analysis, onSelect }) {
  return analysis.recommendedIds.map((id) => {
    const plot = analysis.plots[id];
    return (
      <Marker
        key={id}
        position={[plot.point[1], plot.point[0]]}
        icon={STAR}
        keyboard={false}
        bubblingMouseEvents={false}
        eventHandlers={{ click: () => onSelect({ kind: 'grey', id }) }}
      >
        <Tooltip direction="top" offset={[0, -12]}>
          {starLabel(plot)}
        </Tooltip>
      </Marker>
    );
  });
}
