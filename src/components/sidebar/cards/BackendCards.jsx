import Card from '../../ui/Card.jsx';
import { formatPercent } from '../../../lib/format.js';
import { greenGroupStats, sitesPerSquare } from '../../../lib/backendResults.js';

const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

/** How many candidate park sites the backend's GA picked, and in how many 1 km squares. */
export function GaSitesCard({ gaSites }) {
  const count = gaSites.features.length;
  const squares = Object.keys(sitesPerSquare(gaSites)).length;
  return (
    <Card title="GA park sites">
      <p className="text-lg font-semibold text-ink">{plural(count, 'GA park site', 'GA park sites')}</p>
      <p className="text-sm text-ink-2">{`in ${plural(squares, 'square', 'squares')} of 1 km`}</p>
      <p className="mt-1 text-xs text-ink-3">
        Candidates the backend's genetic algorithm picked from the green it found: big patches, spread out, away from official
        parks. Not verified public land. Marked ◆ on the map.
      </p>
    </Card>
  );
}

/** The backend's green groups: green that is not a park, circled where patches lie close together. */
export function GreenGroupsCard({ greenGroups, greenM2 }) {
  const stats = greenGroupStats(greenGroups, greenM2);
  return (
    <Card title="Green groups">
      <p className="text-lg font-semibold text-ink">{`${plural(stats.groups, 'group', 'groups')} · ${stats.isolated} isolated`}</p>
      {stats.share != null && <p className="text-sm text-ink-2">{`${formatPercent(stats.share)} of the green is inside a circle`}</p>}
      <p className="mt-1 text-xs text-ink-3">
        Green that is not a park, grouped where patches lie close together. Dashed circles are isolated green. Turn on "Green
        groups" in Map options to see them.
      </p>
    </Card>
  );
}
