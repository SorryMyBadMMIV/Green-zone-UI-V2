import Card from '../../ui/Card.jsx';
import StatPair from '../../ui/StatPair.jsx';
import { districtFacts } from '../../../lib/districtFacts.js';
import { formatDecimal, formatNumber, formatPercent } from '../../../lib/format.js';

/** Population and green space per person for the district (BMA figures), with its rank among the 50 districts. */
export function DistrictFactsCard({ district }) {
  const facts = districtFacts(district.nameTh);
  if (!facts) return null;
  return (
    <Card title="District facts">
      <StatPair
        items={[
          { label: 'People', value: formatNumber(facts.population) },
          { label: 'Green per person', value: `${formatDecimal(facts.greenPerPersonM2, 2)} m²` },
        ]}
        note={`Parks people can use: ${formatDecimal(facts.accessiblePerPersonM2, 2)} m² per person. Rank ${facts.rank} of ${facts.of} districts for green per person. Source: BMA Office of Environment via Rocket Media Lab.`}
      />
    </Card>
  );
}

/** How many parks of each size class are inside the district. */
export function ParksBySizeCard({ district, parksBySize }) {
  const { S, M, L, XL } = parksBySize;
  return (
    <Card title="Parks by size">
      <p className="text-lg font-semibold tabular-nums text-ink">{`S ${S} · M ${M} · L ${L} · XL ${XL}`}</p>
      <p className="mt-1 text-xs text-ink-3">
        Parks inside {district.nameEn}. Reach: S 500 m, M 1 km, L 3 km, XL 5 km. Parks in nearby districts also reach it and are drawn on the map.
      </p>
    </Card>
  );
}

/** Share of the district's land within 400 m of a park (Green Bangkok 2030 / 15-minute parks). */
export function PolicyCoverageCard({ district, policyShare }) {
  return (
    <Card title="Within 400 m of a park">
      <p className="text-lg font-semibold text-ink">{`${formatPercent(policyShare)} of ${district.nameEn} is within 400 m of a park`}</p>
      <p className="mt-1 text-xs text-ink-3">The policy: a park within 400 m. Straight-line distance, not walking distance.</p>
    </Card>
  );
}

/** Number of recommended plots: outside every 400 m ring and good or very good for planting. */
export function RecommendedCard({ count, counts, fromExamples = false }) {
  return (
    <Card title="Recommended sites">
      <p className="text-lg font-semibold text-ink">{`${count} recommended ${count === 1 ? 'site' : 'sites'}`}</p>
      <p className="text-sm text-ink-2">{`${counts.veryGood} very good · ${counts.good} good`}</p>
      <p className="mt-1 text-xs text-ink-3">
        {fromExamples && 'From example plots. '}Abandoned plots outside every 400 m ring that score 60 or more. Marked ★ on the map.
      </p>
    </Card>
  );
}
