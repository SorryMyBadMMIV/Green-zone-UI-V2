import { X } from 'lucide-react';
import { DASH, formatArea, formatKm } from '../../lib/format.js';

/** The Figma-style box over the map for the selected abandoned plot: area, score, level and nearest park. */
export default function PlotInfoBox({ plot, analysis, onClose }) {
  const nearest = analysis.nearestPark ? `${formatKm(analysis.nearestPark.distanceM / 1000)} · ${analysis.nearestPark.name}` : DASH;
  return (
    <section
      aria-label={`Plot ${plot.id}`}
      className="absolute bottom-6 right-3 z-[1000] w-72 max-w-[calc(100%-1.5rem)] rounded-2xl bg-neutral-900/85 px-4 py-3 text-white shadow-lg backdrop-blur-sm"
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="Close plot info"
        className="absolute right-2 top-2 flex size-7 items-center justify-center rounded-full text-white/80 hover:bg-white/15 focus-visible:outline-2 focus-visible:outline-white"
      >
        <X size={16} aria-hidden="true" />
      </button>
      <div className="space-y-0.5 pr-6 text-base font-bold leading-snug">
        <p>Area : {formatArea(plot.areaM2)}</p>
        <p>Score : {analysis.score}</p>
        <p>{analysis.level.label}</p>
        <p className="text-sm">Nearest park : {nearest}</p>
      </div>
      <div className="mt-2 flex flex-wrap gap-2 text-xs font-semibold">
        {analysis.recommended && <span className="rounded-md bg-amber-300 px-2 py-0.5 text-neutral-900">★ Recommended</span>}
        {plot.isExample && <span className="rounded-md border border-white/40 px-2 py-0.5 text-white/90">Example data</span>}
      </div>
    </section>
  );
}
