// GISTDA THEOS-2 image frames. Corners are [lat, lng], exactly as GISTDA provided them.
// status 'ready': the backend has an NDVI grid for it. status 'soon': shown as "Update soon".
export const FRAMES = [
  {
    id: 'gisda_03',
    place: 'Don Mueang',
    status: 'ready',
    corners: {
      topLeft: [13.9354055, 100.5798814],
      topRight: [13.9352513, 100.6075171],
      bottomLeft: [13.90838144, 100.57964238],
      bottomRight: [13.90820126, 100.60734273],
    },
  },
  {
    id: 'gisda_01',
    place: 'Pak Kret / Lak Si',
    status: 'soon',
    corners: {
      topLeft: [13.8809918, 100.5216627],
      topRight: [13.88081454, 100.54940705],
      bottomLeft: [13.85388952, 100.52149232],
      bottomRight: [13.85371826, 100.54922489],
    },
  },
  {
    id: 'gisda_02',
    place: 'Chon Buri (Sattahip)',
    status: 'soon',
    corners: {
      topLeft: [12.6983554, 100.8833484],
      topRight: [12.6981904, 100.91086556],
      bottomLeft: [12.6713797, 100.8831603],
      bottomRight: [12.6711633, 100.9106389],
    },
  },
];

/** The frame the app classifies and focuses on (inside Don Mueang). */
export const FOCUS_FRAME = FRAMES[0];
