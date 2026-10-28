import { useId } from 'react';
import { Minus } from 'lucide-react';
import { COLORS } from '../../lib/constants.js';

/** What the map shows when the app opens. */
export const DEFAULT_OPTIONS = {
  S: true,
  M: true,
  L: true,
  XL: false,
  policy: false,
  recommend: true,
  gaSites: true,
  greenGroups: false,
  heatmap: false,
  green: true,
  abandoned: true,
  grid: true,
  basemap: 'satellite',
};

const PARK_CLASSES = [
  { key: 'S', label: 'S · 500 m', color: COLORS.parkS },
  { key: 'M', label: 'M · 1 km', color: COLORS.parkM },
  { key: 'L', label: 'L · 3 km', color: COLORS.parkL },
  { key: 'XL', label: 'XL · 5 km', color: COLORS.parkXL },
];

function Check({ name, label, swatch, options, onOptionChange }) {
  return (
    <label className="flex cursor-pointer items-center gap-2 py-0.5">
      <input
        type="checkbox"
        className="size-4 accent-neutral-800"
        checked={Boolean(options[name])}
        onChange={(event) => onOptionChange(name, event.target.checked)}
      />
      {swatch && <span className="size-3 shrink-0 rounded-sm" style={{ background: swatch }} aria-hidden="true" />}
      {label}
    </label>
  );
}

const headingClass = 'mb-0.5 mt-2 text-xs font-semibold uppercase tracking-wide text-neutral-500';

/**
 * The floating "Map options" panel at the top right of the map: district, park circles by size, policy, recommend and
 * the backend's GA park sites and green groups (where the district has them), layers and base map. The – button folds it into a small pill.
 */
export default function MapOptions({ district, districts, onDistrictChange, options, onOptionChange, collapsed, onCollapsedChange }) {
  const id = useId();
  if (collapsed) {
    return (
      <button
        type="button"
        onClick={() => onCollapsedChange(false)}
        className="absolute right-3 top-3 z-[1000] rounded-full border border-black/10 bg-white px-3 py-1.5 text-sm font-semibold text-neutral-800 shadow-md hover:bg-neutral-50 focus-visible:outline-2 focus-visible:outline-blue-600"
      >
        ⚙ Map options · {district.nameEn}
      </button>
    );
  }
  const check = (name, label, swatch) => (
    <Check key={name} name={name} label={label} swatch={swatch} options={options} onOptionChange={onOptionChange} />
  );
  return (
    <section
      aria-label="Map options"
      className="absolute right-3 top-3 z-[1000] max-h-[calc(100%-1.5rem)] w-56 overflow-y-auto rounded-lg border border-black/10 bg-white px-3 py-2 text-sm text-neutral-800 shadow-md"
    >
      <div className="flex items-center justify-between">
        <p className="font-semibold">Map options</p>
        <button
          type="button"
          onClick={() => onCollapsedChange(true)}
          aria-label="Minimize map options"
          title="Minimize"
          className="flex size-7 items-center justify-center rounded-md border border-black/10 hover:bg-neutral-100 focus-visible:outline-2 focus-visible:outline-blue-600"
        >
          <Minus size={14} aria-hidden="true" />
        </button>
      </div>

      <label htmlFor={`${id}-district`} className={headingClass}>
        District
      </label>
      <select
        id={`${id}-district`}
        value={district.id}
        onChange={(event) => onDistrictChange(event.target.value)}
        className="mt-0.5 w-full rounded-md border border-black/15 bg-white px-2 py-1"
      >
        {districts.map((d) => (
          <option key={d.id} value={d.id}>
            {d.nameEn}
          </option>
        ))}
      </select>

      <p className={headingClass}>Park circles</p>
      {PARK_CLASSES.map(({ key, label, color }) => check(key, label, color))}

      <p className={headingClass}>Show</p>
      {check('policy', 'Policy · 400 m', null)}
      {check('recommend', 'Recommend', COLORS.recommendStar)}
      {district.data.gaSites && check('gaSites', 'GA park sites', COLORS.gaSite)}
      {district.data.greenGroups && check('greenGroups', 'Green groups', COLORS.greenGroup)}

      <p className={headingClass}>Layers</p>
      {check('heatmap', 'Heat map', 'linear-gradient(90deg, #00b441, #ffe128, #eb2d23)')}
      {check('green', 'Green', COLORS.greenZoneMark)}
      {check('abandoned', 'Abandoned land', COLORS.abandonedFill)}
      {district.data.grid && check('grid', 'Green/grey grid', `linear-gradient(90deg, ${COLORS.gridGreen} 50%, ${COLORS.gridGrey} 50%)`)}

      <label htmlFor={`${id}-basemap`} className={headingClass}>
        Base map
      </label>
      <select
        id={`${id}-basemap`}
        value={options.basemap}
        onChange={(event) => onOptionChange('basemap', event.target.value)}
        className="mb-1 mt-0.5 w-full rounded-md border border-black/15 bg-white px-2 py-1"
      >
        <option value="satellite">Satellite</option>
        <option value="street">Map</option>
      </select>
    </section>
  );
}
