import Card from '../ui/Card.jsx';
import InfoList from '../ui/InfoList.jsx';
import StatPair from '../ui/StatPair.jsx';
import PanelHeader from './PanelHeader.jsx';
import { DASH, formatArea } from '../../lib/format.js';

const REACH = { S: '500 m', M: '1 km', L: '3 km', XL: '5 km' };
const LISTS = { accessible: 'accessible parks', '15min': '15-minute parks' };
const SATELLITE = { green_detected: 'Yes', no_green_detected: 'No', outside_image: 'Outside the image' };

/** Sidebar content for a selected park: size class and reach, owner, lists and, where checked, the satellite view. */
export default function ParkPanel({ park, check, onClose }) {
  const lists = park.lists.map((key) => LISTS[key] ?? key);
  return (
    <div className="space-y-3">
      <PanelHeader
        pill="Park"
        pillColor="#86efac"
        pillBg="rgb(34 197 94 / 0.15)"
        title={park.name}
        subtitle={[park.districtTh && `เขต${park.districtTh}`, park.kind].filter(Boolean).join(' · ')}
        onClose={onClose}
      />
      <Card title="Size and reach">
        <StatPair
          items={[
            { label: 'Area', value: formatArea(park.areaM2) },
            { label: 'Size class', value: park.size ? `${park.size.key} · reaches ${REACH[park.size.key]}` : DASH },
          ]}
          note="Reach: S up to 16,000 m² (500 m), M up to 80,000 m² (1 km), L up to 160,000 m² (3 km), XL above (5 km)."
        />
      </Card>
      {check && (
        <Card title="Seen by satellite">
          <p className="text-sm text-ink">{`Green seen by satellite: ${SATELLITE[check.status] ?? DASH}`}</p>
          <p className="mt-1 text-xs text-ink-3">From the backend's THEOS-2 check of the registered park point. Not proof that the park is open.</p>
        </Card>
      )}
      <Card title="Info">
        <InfoList
          rows={[
            ['Owner', park.owner ?? DASH],
            ['In lists', lists.length ? lists.join(', ') : DASH],
            ['Source', 'BMA Office of Environment via Rocket Media Lab (CC BY 4.0)'],
          ]}
        />
      </Card>
    </div>
  );
}
