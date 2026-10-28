import { DASH, formatArea, formatKm } from '../../lib/format.js';
import MapInfoBox from './MapInfoBox.jsx';

/** The box over the map for the selected abandoned plot: area, score, level and nearest park. */
export default function PlotInfoBox({ plot, analysis, onClose }) {
  const nearest = analysis.nearestPark ? `${formatKm(analysis.nearestPark.distanceM / 1000)} · ${analysis.nearestPark.name}` : DASH;
  const tags = (analysis.recommended || plot.isExample) && (
    <>
      {analysis.recommended && <span className="rounded-md bg-amber-300 px-2 py-0.5 text-neutral-900">★ Recommended</span>}
      {plot.isExample && <span className="rounded-md border border-white/40 px-2 py-0.5 text-white/90">Example data</span>}
    </>
  );
  return (
    <MapInfoBox label={`Plot ${plot.id}`} closeLabel="Close plot info" onClose={onClose} tags={tags}>
      <p>Area : {formatArea(plot.areaM2)}</p>
      <p>Score : {analysis.score}</p>
      <p>{analysis.level.label}</p>
      <p className="text-sm">Nearest park : {nearest}</p>
    </MapInfoBox>
  );
}
