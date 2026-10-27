import FactorBars from '../charts/FactorBars.jsx';
import HalfPieGauge from '../charts/HalfPieGauge.jsx';
import Card from '../ui/Card.jsx';
import InfoList from '../ui/InfoList.jsx';
import StatPair from '../ui/StatPair.jsx';
import PanelHeader from './PanelHeader.jsx';
import PlantingScoreCard from './cards/PlantingScoreCard.jsx';
import { COLORS } from '../../lib/constants.js';
import { DASH, formatArea, formatDecimal, formatKm, formatNumber, formatTemp } from '../../lib/format.js';
import { m2PerPerson, ndviLabel, priorityTier } from '../../lib/metrics.js';

/** "Airfield grass 3 · 0.2 km", or "· next to it" when it is closer than 0.1 km. */
function nearestText(nearest) {
  if (!nearest?.name) return DASH;
  const distance = nearest.distanceKm != null && nearest.distanceKm < 0.1 ? 'next to it' : formatKm(nearest.distanceKm);
  return `${nearest.name} · ${distance}`;
}

/**
 * Sidebar content for a selected abandoned plot (grey zone): the planting score first, then the backend's fitness,
 * people and factors where the data has them.
 */
export default function GreyZonePanel({ zone, totalSites, analysis, onClose }) {
  const hasFitness = zone.fitness != null;
  const tier = priorityTier(zone.fitness);
  const fitnessText = formatDecimal(zone.fitness, 2);
  const addedPerPerson = m2PerPerson(zone.areaM2, zone.populationNearby);
  const rows = [
    ['Land now', zone.ndvi == null ? (zone.landCover ?? DASH) : `NDVI ${formatDecimal(zone.ndvi, 2)} · ${ndviLabel(zone.ndvi)}`],
    ['Nearest green zone', nearestText(zone.nearestGreenZone)],
    ['Surface temp', formatTemp(zone.surfaceTempC)],
    ['Data', zone.isExample ? 'Example data (OpenStreetMap land use)' : 'THEOS-2, Landsat 8/9, OpenStreetMap'],
  ];
  if (zone.updatedAt) rows.push(['Updated', zone.updatedAt]);
  const rankText = zone.rank == null ? null : `rank ${zone.rank} of ${totalSites}`;

  return (
    <div className="space-y-3">
      <PanelHeader
        pill={zone.isExample ? 'Abandoned land · example' : 'Abandoned land'}
        pillColor={COLORS.greyZoneText}
        pillBg="rgb(220 38 38 / 0.18)"
        title={`Site ${zone.id}`}
        subtitle={[zone.district, zone.landCover ?? 'open land'].filter(Boolean).join(' · ')}
        onClose={onClose}
      />
      {analysis && <PlantingScoreCard analysis={analysis} />}
      {hasFitness && (
        <Card title="Fitness score">
          <HalfPieGauge
            fraction={zone.fitness}
            color={COLORS.fitnessArc}
            value={fitnessText}
            unit="out of 1.00"
            label={`Fitness score ${fitnessText} out of 1. ${tier.label}.`}
          />
          <p className="mt-1 flex items-center justify-center gap-1.5 text-sm text-ink">
            <span className="size-2.5 rounded-sm ring-1 ring-white/25" style={{ background: tier.color }} aria-hidden="true" />
            {[tier.label, rankText].filter(Boolean).join(' · ')}
          </p>
        </Card>
      )}
      <Card title={zone.populationNearby == null ? 'Area' : 'Population and area'}>
        <StatPair
          items={[
            ...(zone.populationNearby == null ? [] : [{ label: `People within ${zone.nearbyRadiusKm} km`, value: formatNumber(zone.populationNearby) }]),
            { label: 'Site area', value: formatArea(zone.areaM2) },
          ]}
          note={addedPerPerson == null ? null : `Greening it adds ${formatDecimal(addedPerPerson, 2)} m² per nearby person`}
        />
      </Card>
      {hasFitness && (
        <Card title="Why this site?">
          <FactorBars scores={zone.scores} penalty={zone.penalty} />
        </Card>
      )}
      <Card title="Info">
        <InfoList rows={rows} />
      </Card>
    </div>
  );
}
