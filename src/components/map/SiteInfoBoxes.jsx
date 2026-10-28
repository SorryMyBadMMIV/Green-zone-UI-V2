import { DASH, formatArea, formatKm, formatNumber } from '../../lib/format.js';
import MapInfoBox from './MapInfoBox.jsx';

/** The box over the map for the selected GA park site: area, rank in its 1 km square and nearest official park. */
export function GaSiteInfoBox({ site, sitesInSquare, onClose }) {
  const nearest = site.distNearestOfficialM == null ? DASH : formatKm(site.distNearestOfficialM / 1000);
  return (
    <MapInfoBox
      label={`GA park site ${site.id}`}
      closeLabel="Close site info"
      onClose={onClose}
      tags={<span className="rounded-md bg-purple-400 px-2 py-0.5 text-neutral-900">Candidate · not verified public land</span>}
    >
      <p>Area : {formatArea(site.areaM2)}</p>
      <p>{`Rank : ${site.rank}${sitesInSquare ? ` of ${sitesInSquare}` : ''} in its 1 km square`}</p>
      <p className="text-sm">Nearest official park : {nearest}</p>
    </MapInfoBox>
  );
}

/** The box over the map for the selected green group: its green, patches and circle size. */
export function GreenGroupInfoBox({ group, onClose }) {
  const name = `${group.kind === 'isolated' ? 'Isolated green' : 'Green group'} ${group.id}`;
  return (
    <MapInfoBox label={name} closeLabel="Close group info" onClose={onClose}>
      <p>{name}</p>
      <p>Green : {formatArea(group.greenM2InGroup)}</p>
      <p>Patches : {formatNumber(group.patchesInGroup)}</p>
      <p className="text-sm">{`Circle : ${formatNumber(Math.round(group.radiusM))} m radius`}</p>
    </MapInfoBox>
  );
}
