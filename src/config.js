/** Backend base URL from .env. Empty means "use the example files in src/mock/". */
export const API_URL = (import.meta.env.VITE_API_URL ?? '').trim().replace(/\/+$/, '');
export const USING_MOCK_DATA = API_URL === '';

/**
 * Base maps. Satellite (default, like the Figma screens) is Esri World Imagery: no key, credit shown on the map.
 * Street is the standard OpenStreetMap tiles: open data, no key; fine for development and demos, for heavy traffic
 * use a tile provider or self-host (https://operations.osmfoundation.org/policies/tiles/). The street map's colours
 * are muted in src/index.css (.basemap-street) so the zone colours stand out.
 */
export const BASEMAPS = {
  satellite: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Tiles &copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community',
    maxNativeZoom: 18,
    maxZoom: 19,
  },
  street: {
    url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxNativeZoom: 19,
    maxZoom: 19,
  },
};

/** The map opens on Don Mueang; minZoom is raised at runtime so you can't zoom far out of it. */
export const MAP_DEFAULTS = {
  zoom: 13,
  minZoom: 10,
  maxZoom: 19,
};
