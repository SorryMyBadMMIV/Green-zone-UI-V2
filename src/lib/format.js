const wholeNumber = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });

const isNum = (value) => typeof value === 'number' && Number.isFinite(value);

/** Shown wherever a value is missing. */
export const DASH = '—';

/** 21000 → "21,000" */
export function formatNumber(value) {
  return isNum(value) ? wholeNumber.format(value) : DASH;
}

/** formatDecimal(38.0952, 1) → "38.1" */
export function formatDecimal(value, digits = 1) {
  return isNum(value) ? value.toFixed(digits) : DASH;
}

/** 800000 → "800,000 m²" */
export function formatArea(valueM2) {
  return isNum(valueM2) ? `${wholeNumber.format(valueM2)} m²` : DASH;
}

/** An area in m² shown as km²: 3 decimals under 10 km² (8978000 → "8.978 km²"), else 2 ("37.14 km²"). */
export function formatKm2(valueM2) {
  if (!isNum(valueM2)) return DASH;
  const km2 = valueM2 / 1e6;
  return `${km2.toFixed(km2 < 10 ? 3 : 2)} km²`;
}

/** 0.3334 → "33%" */
export function formatPercent(fraction) {
  return isNum(fraction) ? `${Math.round(fraction * 100)}%` : DASH;
}

/** [13.9218098, 100.5935959] → "13.92181, 100.59360" */
export function formatLatLng(latLng) {
  return Array.isArray(latLng) && latLng.length === 2 && latLng.every(isNum)
    ? `${latLng[0].toFixed(5)}, ${latLng[1].toFixed(5)}`
    : DASH;
}

/** 31.24 → "31.2°C" */
export function formatTemp(valueC) {
  return isNum(valueC) ? `${valueC.toFixed(1)}°C` : DASH;
}

/** 2.3 → "2.3 km" */
export function formatKm(valueKm) {
  return isNum(valueKm) ? `${valueKm.toFixed(1)} km` : DASH;
}
