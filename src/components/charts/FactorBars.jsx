import { COLORS } from '../../lib/constants.js';
import { formatDecimal } from '../../lib/format.js';

const FACTORS = [
  { key: 'greenAccessDeficit', label: 'Far from parks', technical: 'GreenAccessDeficit' },
  { key: 'airProximity', label: 'Near busy roads', technical: 'AirProximity' },
  { key: 'heatSeverity', label: 'Surface heat', technical: 'HeatSeverity' },
];

/** "Why this site?": the three fitness factors on the report's 1–5 scale. */
export default function FactorBars({ scores, penalty }) {
  return (
    <div className="space-y-3">
      {FACTORS.map(({ key, label, technical }) => {
        const score = scores?.[key];
        const hasScore = typeof score === 'number';
        const width = hasScore ? (Math.min(5, Math.max(0, score)) / 5) * 100 : 0;
        return (
          <div key={key}>
            <div className="flex items-baseline justify-between text-sm">
              <span className="text-ink">{label}</span>
              <span className="tabular-nums text-ink">{hasScore ? `${score} / 5` : '—'}</span>
            </div>
            <p className="text-xs text-ink-3">{technical}</p>
            <div className="mt-1 h-2 bg-white/10" role="img" aria-label={`${label}: ${hasScore ? `${score} out of 5` : 'no data'}`}>
              <div className="h-2 rounded-r" style={{ width: `${width}%`, background: COLORS.dataBlue }} />
            </div>
          </div>
        );
      })}
      {penalty > 0 && (
        <p className="flex justify-between gap-3 border-t border-line pt-2 text-sm">
          <span className="text-ink">
            Hard to develop <span className="text-xs text-ink-3">(Surrounded penalty)</span>
          </span>
          <span className="tabular-nums text-ink">−{formatDecimal(penalty, 2)}</span>
        </p>
      )}
    </div>
  );
}
