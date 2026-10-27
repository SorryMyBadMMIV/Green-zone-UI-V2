import { TIER_ORDER } from '../../lib/metrics.js';

/** One stacked bar: how many candidate sites are in each priority tier. */
export default function PriorityBar({ counts }) {
  const total = TIER_ORDER.reduce((sum, tier) => sum + (counts[tier.key] ?? 0), 0);
  if (total === 0) return <p className="text-sm text-ink-3">No candidate sites loaded</p>;

  return (
    <div>
      <div
        className="flex h-3 gap-0.5"
        role="img"
        aria-label={TIER_ORDER.map((tier) => `${tier.label}: ${counts[tier.key]}`).join(', ')}
      >
        {TIER_ORDER.filter((tier) => counts[tier.key] > 0).map((tier) => (
          <div
            key={tier.key}
            className="basis-0 first:rounded-l last:rounded-r"
            style={{ flexGrow: counts[tier.key], background: tier.color }}
            title={`${tier.label}: ${counts[tier.key]}`}
          />
        ))}
      </div>
      <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-2">
        {TIER_ORDER.map((tier) => (
          <li key={tier.key} className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-sm ring-1 ring-white/25" style={{ background: tier.color }} aria-hidden="true" />
            {tier.short} {counts[tier.key]}
          </li>
        ))}
      </ul>
    </div>
  );
}
