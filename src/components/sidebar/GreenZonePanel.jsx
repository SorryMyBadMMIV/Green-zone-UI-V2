import CoolingChart from '../charts/CoolingChart.jsx';
import HalfPieGauge from '../charts/HalfPieGauge.jsx';
import Card from '../ui/Card.jsx';
import InfoList from '../ui/InfoList.jsx';
import StatPair from '../ui/StatPair.jsx';
import StatusBadge from '../ui/StatusBadge.jsx';
import PanelHeader from './PanelHeader.jsx';
import { COLORS, TARGET_M2_PER_PERSON } from '../../lib/constants.js';
import { DASH, formatArea, formatDecimal, formatKm2, formatNumber } from '../../lib/format.js';
import { greenGaugeFraction, greenSpaceStatus, m2PerPerson, ndviLabel } from '../../lib/metrics.js';

/** Sidebar content for a selected green zone. `zone` is a normalized feature's properties. */
export default function GreenZonePanel({ zone, onClose }) {
  const perPerson = m2PerPerson(zone.areaM2, zone.populationNearby);
  const status = greenSpaceStatus(perPerson);
  const perPersonText = formatDecimal(perPerson, 1);
  const vegetation = zone.ndvi == null ? DASH : `NDVI ${formatDecimal(zone.ndvi, 2)} · ${ndviLabel(zone.ndvi)}`;
  const rows = [
    ['Zone ID', zone.id],
    ['Type', zone.type],
    ['Vegetation', vegetation],
    ['Data', 'THEOS-2, Landsat 8/9'],
  ];
  if (zone.updatedAt) rows.push(['Updated', zone.updatedAt]);

  return (
    <div className="space-y-3">
      <PanelHeader
        pill="Green zone"
        pillColor={COLORS.greenZoneText}
        pillBg="rgb(34 197 94 / 0.15)"
        title={zone.name}
        subtitle={[zone.nameTh, zone.district].filter(Boolean).join(' · ')}
        onClose={onClose}
      />
      <Card title="Green space per person">
        <HalfPieGauge
          fraction={perPerson == null ? null : greenGaugeFraction(perPerson)}
          color={status.color}
          value={perPersonText}
          unit="m² per person"
          tick={0.5}
          tickLabel={`target ${TARGET_M2_PER_PERSON}`}
          label={`Green space per person: ${perPerson == null ? 'no data' : `${perPersonText} m²`}. Target ${TARGET_M2_PER_PERSON} m². ${status.label}.`}
        />
        <StatusBadge status={status} />
      </Card>
      <Card title="Population and area">
        <StatPair
          items={[
            { label: `People within ${zone.nearbyRadiusKm} km`, value: formatNumber(zone.populationNearby) },
            { label: 'Green zone area', value: formatKm2(zone.areaM2) },
          ]}
          note={
            perPerson == null
              ? null
              : `${formatArea(zone.areaM2)} ÷ ${formatNumber(zone.populationNearby)} people = ${perPersonText} m² each`
          }
        />
      </Card>
      <Card title="Cooling effect">
        <CoolingChart insideC={zone.tempInsideC} aroundC={zone.tempAroundC} radiusKm={zone.nearbyRadiusKm} />
      </Card>
      <Card title="Info">
        <InfoList rows={rows} />
      </Card>
    </div>
  );
}
