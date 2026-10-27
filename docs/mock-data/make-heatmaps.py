"""One-off: make the heat maps and the Suan Luang green layer with the backend's own make_heatmap().

Usage: python -I -B make-heatmaps.py <backend-root> <project-root>
  <backend-root> = the Green-zone-v3 folder (only read, never written)
Writes:
  src/mock/suan-luang/green.png     backend green (Theosmain round 1) as a see-through overlay, 4 m per pixel
  src/mock/suan-luang/heatmap.png   make_heatmap(style='proximity', radius_m=150) of that green
  src/mock/suan-luang/frame.json    the image's four corners as [lat, lng]
  src/mock/don-mueang/heatmap.png   the same heat map from the Don Mueang example NDVI grid (NDVI >= 0.3 = green)
Row 0 of every image is the north edge and column 0 the west edge of its frame.

The Theosmain GeoTIFF is not in the backend repo yet, so the Suan Luang image extent below was measured from the
axes of the backend's Final_Results/Theosmain/parks/parks_marked.png (about +-10 m). Replace it with the TIFF's
bounds when the teammate sends green_mask_round1.tif.
"""
import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image
from rasterio.warp import transform

THEOSMAIN_CRS = 'EPSG:32647'  # UTM zone 47N, metres
THEOSMAIN_EXTENT = {'west': 671762.0, 'east': 679762.0, 'south': 1516855.0, 'north': 1520855.0}
BACKEND_GREEN_RGB = (60, 220, 90)
GREEN_OVERLAY_RGBA = (0, 180, 65, 200)
RADIUS_M = 150


def save_rgba(path, rgba):
    path.parent.mkdir(parents=True, exist_ok=True)
    Image.fromarray(rgba, mode='RGBA').save(path, optimize=True)
    print(f'wrote {path} {rgba.shape[1]}x{rgba.shape[0]}')


def main(backend_root, project_root):
    backend, project = Path(backend_root), Path(project_root)
    sys.path.insert(0, str(backend))
    from greensight.heatmap import make_heatmap  # the backend's function, unchanged

    # --- Suan Luang (backend Theosmain) ---
    preview = np.asarray(Image.open(backend / 'Final_Results/Theosmain/round1/green_preview.png').convert('RGB'))
    mask = np.all(preview == BACKEND_GREEN_RGB, axis=2).astype('uint8')
    pixel_m = (THEOSMAIN_EXTENT['east'] - THEOSMAIN_EXTENT['west']) / mask.shape[1]
    print(f'Suan Luang green mask {mask.shape[1]}x{mask.shape[0]} at {pixel_m:.2f} m: {mask.sum() * pixel_m ** 2 / 1e6:.3f} km2 green')
    heat = make_heatmap(mask, pixel_m, min_area_m2=pixel_m ** 2, radius_m=RADIUS_M, style='proximity')
    save_rgba(project / 'src/mock/suan-luang/heatmap.png', heat['rgba'])
    green = np.zeros((*mask.shape, 4), dtype='uint8')
    green[mask == 1] = GREEN_OVERLAY_RGBA
    save_rgba(project / 'src/mock/suan-luang/green.png', green)

    e = THEOSMAIN_EXTENT
    xs = [e['west'], e['east'], e['west'], e['east']]
    ys = [e['north'], e['north'], e['south'], e['south']]
    lngs, lats = transform(THEOSMAIN_CRS, 'EPSG:4326', xs, ys)
    names = ['topLeft', 'topRight', 'bottomLeft', 'bottomRight']
    corners = {n: [round(lat, 7), round(lng, 7)] for n, lat, lng in zip(names, lats, lngs)}
    frame = {'id': 'theosmain', 'crs': THEOSMAIN_CRS, 'extent': e, 'corners': corners,
             'note': 'Extent measured from the backend parks_marked.png axes (about +-10 m) until the GeoTIFF arrives.'}
    (project / 'src/mock/suan-luang/frame.json').write_text(json.dumps(frame, indent=2) + '\n', encoding='utf-8')
    for n in names:
        print(f'{n}: {corners[n]}')

    # --- Don Mueang (example NDVI grid of gisda_03) ---
    grid = json.loads((project / 'src/mock/don-mueang/grid.json').read_text(encoding='utf-8'))
    ndvi = np.array([[np.nan if v is None else v for v in row] for row in grid['ndvi']], dtype='float64')
    dm_mask = np.where(np.isnan(ndvi), 255, (ndvi >= 0.3).astype('uint8')).astype('uint8')
    dm_pixel_m = 4.994  # sqrt of the mean cell area, 24.94 m²
    dm_heat = make_heatmap(dm_mask, dm_pixel_m, min_area_m2=25, radius_m=RADIUS_M, style='proximity')
    save_rgba(project / 'src/mock/don-mueang/heatmap.png', dm_heat['rgba'])


if __name__ == '__main__':
    if len(sys.argv) != 3:
        raise SystemExit('Usage: python -I -B make-heatmaps.py <backend-root> <project-root>')
    main(sys.argv[1], sys.argv[2])
