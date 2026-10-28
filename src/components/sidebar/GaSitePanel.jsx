import Card from '../ui/Card.jsx';
import InfoList from '../ui/InfoList.jsx';
import StatPair from '../ui/StatPair.jsx';
import PanelHeader from './PanelHeader.jsx';
import { COLORS } from '../../lib/constants.js';
import { DASH, formatArea, formatDecimal, formatKm } from '../../lib/format.js';

/** Sidebar content for a selected GA park site: the backend's candidate for a new park. */
export default function GaSitePanel({ site, sitesInSquare, onClose }) {
  return (
    <div className="space-y-3">
      <PanelHeader
        pill="Candidate · not verified public land"
        pillColor="#e9d5ff"
        pillBg="rgb(168 85 247 / 0.2)"
        title="GA park site"
        subtitle={`1 km square ${site.zone}`}
        onClose={onClose}
      />
      <Card title="Site">
        <StatPair
          items={[
            { label: 'Area', value: formatArea(site.areaM2) },
            { label: 'Rank in its 1 km square', value: sitesInSquare ? `${site.rank} of ${sitesInSquare}` : String(site.rank) },
          ]}
          note="The backend's genetic algorithm picks the best green patches in every 1 km square: big, spread out and away from official parks."
        />
      </Card>
      <Card title="Info">
        <InfoList
          rows={[
            ['Nearest official park', site.distNearestOfficialM == null ? DASH : formatKm(site.distNearestOfficialM / 1000)],
            ['Square score (GA fitness)', formatDecimal(site.zoneFitness, 2)],
            ['Most parks allowed in the square', site.zoneKMax ?? DASH],
            ['Source', 'Backend v3, ga_parks.py'],
          ]}
        />
        <p className="mt-2 text-xs" style={{ color: COLORS.gaSite }}>
          ◆ Marked on the map. Check who owns the land before planning a park here.
        </p>
      </Card>
    </div>
  );
}
