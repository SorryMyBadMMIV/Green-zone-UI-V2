import { useMemo } from 'react';
import HalfPieGauge from '../charts/HalfPieGauge.jsx';
import PriorityBar from '../charts/PriorityBar.jsx';
import Card from '../ui/Card.jsx';
import InfoList from '../ui/InfoList.jsx';
import StatPair from '../ui/StatPair.jsx';
import { DistrictFactsCard, ParksBySizeCard, PolicyCoverageCard, RecommendedCard } from './cards/DistrictCards.jsx';
import { COLORS, GREEN_NDVI } from '../../lib/constants.js';
import { formatKm2, formatLatLng, formatNumber, formatPercent } from '../../lib/format.js';
import { frameCenter, frameRing, polygonAreaM2 } from '../../lib/geo.js';
import { classAreas } from '../../lib/grid.js';
import { countByTier } from '../../lib/metrics.js';

const frameAreaM2 = (corners) => polygonAreaM2({ type: 'Polygon', coordinates: [frameRing(corners)] });
const CORNERS = [
  ['Top-left', 'topLeft'],
  ['Top-right', 'topRight'],
  ['Bottom-left', 'bottomLeft'],
  ['Bottom-right', 'bottomRight'],
];

function Swatch({ color }) {
  return <span className="size-2.5 shrink-0 rounded-sm" style={{ background: color }} aria-hidden="true" />;
}

/** Green vs grey in the frame, from the 5 m NDVI grid (Don Mueang). */
function GridGreenCard({ frame, classified }) {
  const areas = useMemo(() => (classified ? classAreas(frame, classified) : null), [frame, classified]);
  const landM2 = areas ? areas.green + areas.grey : 0;
  const greenShare = landM2 > 0 ? areas.green / landM2 : null;
  return (
    <Card title={`Green and grey in ${frame.label}`}>
      <HalfPieGauge
        fraction={greenShare}
        color={COLORS.gridGreen}
        trackColor={COLORS.gridGrey}
        value={formatPercent(greenShare)}
        unit="of the land is green"
        label={`${formatPercent(greenShare)} of the land in ${frame.label} is green (NDVI ${GREEN_NDVI} and up).`}
      />
      <ul className="mt-2 space-y-1 text-sm">
        <li className="flex items-center gap-2">
          <Swatch color={COLORS.gridGreen} />
          <span className="text-ink">Green</span>
          <span className="text-xs text-ink-3">NDVI {GREEN_NDVI} and up</span>
          <span className="ml-auto tabular-nums text-ink">{formatKm2(areas?.green)}</span>
        </li>
        <li className="flex items-center gap-2">
          <Swatch color={COLORS.gridGrey} />
          <span className="text-ink">Grey</span>
          <span className="text-xs text-ink-3">under {GREEN_NDVI}</span>
          <span className="ml-auto tabular-nums text-ink">{formatKm2(areas?.grey)}</span>
        </li>
        <li className="flex items-center gap-2 text-xs text-ink-3">
          <span className="size-2.5 shrink-0" aria-hidden="true" />
          Water, not counted
          <span className="ml-auto tabular-nums">{formatKm2(areas?.water)}</span>
        </li>
      </ul>
    </Card>
  );
}

/** Green found by the backend in the satellite image (Suan Luang). */
function BackendGreenCard({ frame, summary }) {
  const share = summary.validM2 > 0 ? summary.greenM2 / summary.validM2 : null;
  return (
    <Card title={`Green in the ${frame.label} image`}>
      <HalfPieGauge
        fraction={share}
        color={COLORS.gridGreen}
        trackColor={COLORS.gridGrey}
        value={formatPercent(share)}
        unit="of the image is green"
        label={`${formatPercent(share)} of the ${frame.label} image is green.`}
      />
      <ul className="mt-2 space-y-1 text-sm">
        <li className="flex items-center gap-2">
          <Swatch color={COLORS.gridGreen} />
          <span className="text-ink">Green</span>
          <span className="ml-auto tabular-nums text-ink">{formatKm2(summary.greenM2)}</span>
        </li>
        <li className="flex items-center gap-2">
          <Swatch color={COLORS.gridGrey} />
          <span className="text-ink">Whole image</span>
          <span className="ml-auto tabular-nums text-ink">{formatKm2(summary.validM2)}</span>
        </li>
        <li className="text-xs text-ink-3">{formatNumber(summary.patches)} green patches · THEOS-2 detection by the backend</li>
      </ul>
    </Card>
  );
}

/** Sidebar content before anything is selected: the district's green, area, facts, parks, policy and recommendations. */
export default function OverviewPanel({ district, classified, grid, grey, analysis }) {
  const { frame } = district;
  const focus = district.boundaries.features.find((f) => f.properties.role === 'focus');
  const districtM2 = polygonAreaM2(focus.geometry);
  const frameM2 = frameAreaM2(frame.corners);
  const fitness = (grey?.features ?? []).map((f) => f.properties.fitness).filter((value) => value != null);

  const areaNote = district.data.grid
    ? `The frame covers ${formatPercent(frameM2 / districtM2)} of ${district.nameEn}.` +
      (grid ? ` Grid: ${grid.rows} × ${grid.cols} cells${grid.cellSizeM ? ` of about ${grid.cellSizeM} m` : ''}.` : '')
    : `The ${frame.label} image covers ${district.nameEn} and parts of its neighbours.`;

  return (
    <div className="space-y-3">
      <header>
        <h2 className="text-xl font-semibold text-ink">{district.nameEn} overview</h2>
        <p className="text-sm text-ink-3">Click a park, a red plot or a ★ on the map to see its details.</p>
      </header>
      {district.greenSummary ? <BackendGreenCard frame={frame} summary={district.greenSummary} /> : <GridGreenCard frame={frame} classified={classified} />}
      <Card title="Area">
        <StatPair
          items={[
            { label: `${district.data.grid ? 'Frame' : 'Image'} ${frame.label}`, value: formatKm2(frameM2) },
            { label: `${district.nameEn} district`, value: formatKm2(districtM2) },
          ]}
          note={areaNote}
        />
      </Card>
      <DistrictFactsCard district={district} />
      {analysis && (
        <>
          <ParksBySizeCard district={district} parksBySize={analysis.parksBySize} />
          <PolicyCoverageCard district={district} policyShare={analysis.policyShare} />
          <RecommendedCard
            count={analysis.recommendedIds.length}
            counts={analysis.recommendedCounts}
            fromExamples={analysis.recommendedFromExamples}
          />
        </>
      )}
      {fitness.length > 0 && (
        <Card title="Candidate sites by priority (fitness)">
          <PriorityBar counts={countByTier(fitness)} />
        </Card>
      )}
      <Card title="Frame info">
        <InfoList
          rows={[
            ['Center', formatLatLng(frameCenter(frame.corners))],
            ...CORNERS.map(([label, key]) => [label, formatLatLng(frame.corners[key])]),
            ['Source', frame.source],
          ]}
        />
        {frame.note && <p className="mt-2 text-xs text-ink-3">{frame.note}</p>}
        {district.otherFrames.length > 0 && (
          <>
            <h4 className="mb-1 mt-3 text-xs font-medium text-ink-2">Other frames</h4>
            <ul className="space-y-1.5 text-sm">
              {district.otherFrames.map((other) => (
                <li key={other.id} className="flex items-center justify-between gap-2">
                  <span className="min-w-0">
                    <span className="text-ink">{other.id}</span> <span className="text-xs text-ink-3">{other.place}</span>
                  </span>
                  <span className="flex shrink-0 items-center gap-2">
                    <span className="tabular-nums text-ink-2">{formatKm2(frameAreaM2(other.corners))}</span>
                    <span className="rounded-md border border-white/20 px-1.5 py-0.5 text-xs text-ink-2">Update soon</span>
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}
      </Card>
    </div>
  );
}
