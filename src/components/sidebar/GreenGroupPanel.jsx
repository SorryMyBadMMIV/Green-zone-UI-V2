import Card from '../ui/Card.jsx';
import InfoList from '../ui/InfoList.jsx';
import StatPair from '../ui/StatPair.jsx';
import PanelHeader from './PanelHeader.jsx';
import { formatArea, formatNumber } from '../../lib/format.js';

/** Sidebar content for a selected green group (or isolated green): its green, its patches and its circle. */
export default function GreenGroupPanel({ group, onClose }) {
  const isolated = group.kind === 'isolated';
  return (
    <div className="space-y-3">
      <PanelHeader
        pill={isolated ? 'Isolated green' : 'Green group'}
        pillColor="#99f6e4"
        pillBg="rgb(45 212 191 / 0.18)"
        title={`${isolated ? 'Isolated green' : 'Green group'} ${group.id}`}
        subtitle="Green that is not a park, grouped by the backend"
        onClose={onClose}
      />
      <Card title="Green">
        <StatPair
          items={[
            { label: 'Green in the group', value: formatArea(group.greenM2InGroup) },
            { label: 'Patches', value: formatNumber(group.patchesInGroup) },
          ]}
          note="Vegetation the satellite sees, not free land: roofs, roads and private gardens are not told apart."
        />
      </Card>
      <Card title="Info">
        <InfoList
          rows={[
            ['Circle radius', `${formatNumber(Math.round(group.radiusM))} m`],
            ['Patches in the circle', formatNumber(group.patchesInCircle)],
            ['Green in the circle', formatArea(group.greenM2InCircle)],
            ['Source', 'Backend v3, green_groups.py'],
          ]}
        />
      </Card>
    </div>
  );
}
