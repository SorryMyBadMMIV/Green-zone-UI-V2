import { Check, CheckCheck, Minus, X } from 'lucide-react';
import HalfPieGauge from '../../charts/HalfPieGauge.jsx';
import Card from '../../ui/Card.jsx';
import InfoList from '../../ui/InfoList.jsx';
import { DASH, formatKm } from '../../../lib/format.js';

// Every level has a word, an icon and a colour.
const LEVEL_STYLE = {
  'very-good': { color: '#16a34a', Icon: CheckCheck },
  good: { color: '#84cc16', Icon: Check },
  fair: { color: '#f59e0b', Icon: Minus },
  poor: { color: '#dc2626', Icon: X },
};

/** The plot's 0–100 planting score, its level, whether it is recommended, and why. */
export default function PlantingScoreCard({ analysis }) {
  const { score, level, recommended, withinPolicy, nearestPark, circlesCovering } = analysis;
  const { color, Icon } = LEVEL_STYLE[level.key];
  let verdict = 'Outside 400 m, but the score is under 60';
  if (recommended) verdict = '★ Recommended';
  else if (withinPolicy) verdict = 'Inside 400 m of a park';
  return (
    <Card title="Planting score">
      <HalfPieGauge fraction={score / 100} color={color} value={String(score)} unit="out of 100" label={`Planting score ${score} out of 100. ${level.label}.`} />
      <p className="mt-1 flex items-center justify-center gap-1.5 text-sm font-medium text-ink">
        <Icon size={16} color={color} aria-hidden="true" />
        {level.label}
      </p>
      <p className="mt-1 text-center text-sm text-ink-2">{verdict}</p>
      <div className="mt-2">
        <InfoList
          rows={[
            ['Nearest park', nearestPark ? `${nearestPark.name} · ${formatKm(nearestPark.distanceM / 1000)}` : DASH],
            ['Park circles covering it', String(circlesCovering)],
            ['Within 400 m of a park', withinPolicy ? 'Yes' : 'No'],
          ]}
        />
      </div>
      <p className="mt-2 text-xs text-ink-3">Farther from parks and bigger scores higher; every park circle that already covers it takes 10 points off.</p>
    </Card>
  );
}
