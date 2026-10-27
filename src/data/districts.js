// The districts the app can show. Each one has its outline (and grey neighbours), its THEOS-2 image frame, its heat
// map and which data the backend (or the example files in src/mock/<id>/) provides for it.
import donMueangBoundaries from './districts/don-mueang.json';
import suanLuangBoundaries from './districts/suan-luang.json';
import { FRAMES } from './frames.js';
import suanLuangFrame from '../mock/suan-luang/frame.json';
import suanLuangSummary from '../mock/suan-luang/summary.json';
import suanLuangHeatmap from '../mock/suan-luang/heatmap.png';
import suanLuangGreen from '../mock/suan-luang/green.png';
import donMueangHeatmap from '../mock/don-mueang/heatmap.png';

export const DISTRICTS = [
  {
    id: 'suan-luang',
    nameEn: 'Suan Luang',
    nameTh: 'สวนหลวง',
    boundaries: suanLuangBoundaries,
    frame: {
      id: 'theosmain',
      label: 'Theosmain',
      corners: suanLuangFrame.corners,
      source: 'THEOS-2 (GISTDA), backend v3',
      note: 'Position measured from the backend chart (about ±10 m) until the .tif arrives',
    },
    otherFrames: [],
    images: { heatmap: suanLuangHeatmap, green: suanLuangGreen },
    data: { grid: false, greenZones: false, parkChecks: true },
    abandonedIsExample: true,
    greenSummary: {
      greenM2: suanLuangSummary.green_area_m2,
      validM2: suanLuangSummary.valid_area_km2 * 1e6,
      patches: suanLuangSummary.patches_kept,
    },
  },
  {
    id: 'don-mueang',
    nameEn: 'Don Mueang',
    nameTh: 'ดอนเมือง',
    boundaries: donMueangBoundaries,
    frame: { id: FRAMES[0].id, label: FRAMES[0].id, corners: FRAMES[0].corners, source: 'THEOS-2 (GISTDA)', note: null },
    otherFrames: FRAMES.slice(1),
    images: { heatmap: donMueangHeatmap, green: null },
    data: { grid: true, greenZones: true, parkChecks: false },
    abandonedIsExample: true,
    greenSummary: null,
  },
];

export const DEFAULT_DISTRICT_ID = 'suan-luang';

/** The district with this id, or the default district. */
export function getDistrict(id) {
  return DISTRICTS.find((district) => district.id === id) ?? DISTRICTS.find((district) => district.id === DEFAULT_DISTRICT_ID);
}
