import { COLORS } from '../../lib/constants.js';
import { formatDecimal, formatTemp } from '../../lib/format.js';
import { coolingEffect } from '../../lib/metrics.js';

const WIDTH = 240;
const PAD = 14;
const Y = 16;

/** Dumbbell chart: temperature inside the park vs. the area around it. */
export default function CoolingChart({ insideC, aroundC, radiusKm }) {
  const cooling = coolingEffect(insideC, aroundC);
  if (!cooling) return <p className="text-sm text-ink-3">No temperature data</p>;

  const [lo, hi] = cooling.domain;
  const x = (t) => PAD + ((t - lo) / (hi - lo)) * (WIDTH - 2 * PAD);
  const headline =
    cooling.delta > 0 ? `${formatDecimal(cooling.delta, 1)}°C cooler than around it` : 'No cooling measured';

  return (
    <div>
      <p className="text-lg font-semibold text-ink">{headline}</p>
      <svg
        viewBox={`0 0 ${WIDTH} 44`}
        className="mt-2 block w-full"
        role="img"
        aria-label={`Inside the park ${formatTemp(insideC)}, within ${radiusKm} km ${formatTemp(aroundC)}`}
      >
        <line x1={PAD} y1={Y} x2={WIDTH - PAD} y2={Y} className="stroke-white/15" />
        <line x1={x(insideC)} y1={Y} x2={x(aroundC)} y2={Y} stroke={COLORS.noData} strokeWidth={2} />
        <circle cx={x(insideC)} cy={Y} r={6} fill={COLORS.dataBlue} className="stroke-card" strokeWidth={2} />
        <circle cx={x(aroundC)} cy={Y} r={6} fill={COLORS.dataOrange} className="stroke-card" strokeWidth={2} />
        <text x={PAD} y={40} fontSize={11} className="fill-ink-3">
          {lo}°C
        </text>
        <text x={WIDTH - PAD} y={40} fontSize={11} textAnchor="end" className="fill-ink-3">
          {hi}°C
        </text>
      </svg>
      <ul className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-2">
        <li className="flex items-center gap-1.5">
          <span className="size-2 rounded-full" style={{ background: COLORS.dataBlue }} aria-hidden="true" />
          Inside park {formatTemp(insideC)}
        </li>
        <li className="flex items-center gap-1.5">
          <span className="size-2 rounded-full" style={{ background: COLORS.dataOrange }} aria-hidden="true" />
          Within {radiusKm} km {formatTemp(aroundC)}
        </li>
      </ul>
    </div>
  );
}
