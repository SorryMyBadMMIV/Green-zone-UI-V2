import { ChevronsLeft, ChevronsRight, Leaf } from 'lucide-react';
import { USING_MOCK_DATA } from '../../config.js';
import { COLORS } from '../../lib/constants.js';
import ErrorCard from '../ui/ErrorCard.jsx';
import LoadingCards from '../ui/LoadingCards.jsx';
import GreenZonePanel from './GreenZonePanel.jsx';
import GreyZonePanel from './GreyZonePanel.jsx';
import OverviewPanel from './OverviewPanel.jsx';
import ParkPanel from './ParkPanel.jsx';

/** Properties of the selected zone, or null if nothing is selected or it is not in the data. */
function findZone(selected, green, grey) {
  if (!selected || selected.kind === 'park') return null;
  const collection = selected.kind === 'green' ? green : grey;
  return collection?.features.find((f) => f.properties.id === selected.id)?.properties ?? null;
}

function SidebarBody({ district, analysis, parkChecks, status, error, green, grey, classified, grid, selected, onClear, onRetry }) {
  if (status === 'loading') return <LoadingCards />;
  if (status === 'error') return <ErrorCard error={error} onRetry={onRetry} />;
  if (selected?.kind === 'park') {
    const park = analysis?.parks.find((p) => p.id === selected.id);
    if (park) {
      const check = parkChecks?.features.find((f) => f.properties.name === park.name)?.properties ?? null;
      return <ParkPanel park={park} check={check} onClose={onClear} />;
    }
  }
  const zone = findZone(selected, green, grey);
  if (zone && selected.kind === 'green') return <GreenZonePanel zone={zone} onClose={onClear} />;
  if (zone && selected.kind === 'grey') {
    return <GreyZonePanel zone={zone} totalSites={grey.features.length} analysis={analysis?.plots[zone.id] ?? null} onClose={onClear} />;
  }
  return <OverviewPanel district={district} classified={classified} grid={grid} grey={grey} analysis={analysis} />;
}

const toggleClass =
  'flex size-8 shrink-0 items-center justify-center rounded-lg border border-white/15 text-ink-2 hover:bg-white/10 hover:text-ink focus-visible:outline-2 focus-visible:outline-white';

/** Left column: app header + the overview or the selected park / zone. The « button folds it away. */
export default function Sidebar({ collapsed, onCollapsedChange, ...props }) {
  if (collapsed) {
    return (
      <aside aria-label="Zone statistics" className="flex bg-app p-2 lg:h-dvh lg:flex-col lg:items-center lg:border-r lg:border-line">
        <button type="button" className={toggleClass} aria-label="Open sidebar" title="Open sidebar" onClick={() => onCollapsedChange(false)}>
          <ChevronsRight size={18} aria-hidden="true" />
        </button>
      </aside>
    );
  }
  return (
    <aside
      aria-label="Zone statistics"
      className="flex flex-col gap-4 bg-app p-4 lg:h-dvh lg:overflow-y-auto lg:border-r lg:border-line"
    >
      <header className="flex items-center gap-3 border-b border-line pb-4">
        <Leaf size={26} color={COLORS.greenZoneFill} aria-hidden="true" />
        <div className="min-w-0">
          <h1 className="text-base font-semibold leading-tight text-ink">Green Lantern</h1>
          <p className="text-xs text-ink-3">{props.district.nameEn} green space explorer</p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {USING_MOCK_DATA && (
            <span
              className="rounded-md border border-white/20 px-2 py-0.5 text-xs text-ink-2"
              title="Example data until the backend is connected"
            >
              Mock data
            </span>
          )}
          <button type="button" className={toggleClass} aria-label="Minimize sidebar" title="Minimize sidebar" onClick={() => onCollapsedChange(true)}>
            <ChevronsLeft size={18} aria-hidden="true" />
          </button>
        </div>
      </header>
      <SidebarBody {...props} />
    </aside>
  );
}
