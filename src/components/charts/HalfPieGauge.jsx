const ARC = 'M 20 100 A 80 80 0 0 1 180 100';

/** Point on the gauge circle at a fraction of the way along it (0 = left end, 1 = right end). */
function pointAt(fraction, radius) {
  const angle = Math.PI * (1 - fraction);
  return [100 + radius * Math.cos(angle), 100 - radius * Math.sin(angle)];
}

/**
 * Semicircle gauge (the sketch's "half pie chart"). The arc fills from left to right.
 * fraction: 0–1 (clamped), or null for "No data". tick: optional 0–1 position of a target mark.
 * trackColor: optional color for the rest of the arc, for a two-part whole (e.g. green vs grey).
 */
export default function HalfPieGauge({ fraction, color, trackColor, value, unit, tick, tickLabel, label }) {
  const hasValue = typeof fraction === 'number' && Number.isFinite(fraction);
  const filled = hasValue ? Math.min(1, Math.max(0, fraction)) * 100 : 0;
  const [tx1, ty1] = tick == null ? [] : pointAt(tick, 66);
  const [tx2, ty2] = tick == null ? [] : pointAt(tick, 94);

  return (
    <svg viewBox="0 -18 200 130" className="mx-auto block w-full max-w-64" role="img" aria-label={label}>
      <path
        d={ARC}
        fill="none"
        stroke={trackColor ?? color}
        strokeOpacity={trackColor ? 0.6 : 0.22}
        strokeWidth={16}
        pathLength={100}
        data-testid="gauge-track"
      />
      {filled > 0 && (
        <path
          d={ARC}
          fill="none"
          stroke={color}
          strokeWidth={16}
          pathLength={100}
          strokeDasharray={`${filled} 100`}
          data-testid="gauge-fill"
        />
      )}
      {tick != null && (
        <>
          <line x1={tx1} y1={ty1} x2={tx2} y2={ty2} className="stroke-ink" strokeWidth={2} />
          {tickLabel && (
            <text x={tx2} y={ty2 - 6} textAnchor="middle" fontSize={11} className="fill-ink-2">
              {tickLabel}
            </text>
          )}
        </>
      )}
      {hasValue ? (
        <>
          <text x={100} y={84} textAnchor="middle" fontSize={40} fontWeight={600} className="fill-ink">
            {value}
          </text>
          <text x={100} y={103} textAnchor="middle" fontSize={11} className="fill-ink-2">
            {unit}
          </text>
        </>
      ) : (
        <text x={100} y={88} textAnchor="middle" fontSize={18} className="fill-ink-3">
          No data
        </text>
      )}
    </svg>
  );
}
