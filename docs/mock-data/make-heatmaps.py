"""One-off: make the heat maps and the Suan Luang green layer with the backend's own make_heatmap().

Usage: python -I -B make-heatmaps.py <backend-root> <project-root>
  <backend-root> = the Green-zone-v3 folder (only read, never written). Its newest Final_Results/Theosmain/run_* is used.
Writes:
  src/mock/suan-luang/green.png     backend green (Theosmain round 1) as a see-through overlay
  src/mock/suan-luang/heatmap.png   make_heatmap(style='proximity', radius_m=150) of that green
  src/mock/suan-luang/frame.json    the image's extent (UTM 47N) and four corners as [lat, lng]
  src/mock/don-mueang/heatmap.png   the same heat map from the Don Mueang example NDVI grid (NDVI >= 0.3 = green)
Row 0 of every image is the north edge and column 0 the west edge of its frame.

The Theosmain GeoTIFF is not in the backend repo, so the image's position is fitted: every GA site in
ga_parks/ga_parks.geojson is the centroid of a green patch inside its 1 km zone (2000 px, zone r0_c0 at the top-left
corner) and carries its UTM x_m / y_m. Matching those centroids to the patches of round1/green_preview.png gives the
top-left corner to about 1 m. The script stops if fewer than half of the sites match or the median error is over 2 m.
"""
import json
import re
import sys
from pathlib import Path

import numpy as np
from PIL import Image
from rasterio.warp import transform
from scipy import ndimage

THEOSMAIN_CRS = 'EPSG:32647'  # UTM zone 47N, metres
BACKEND_GREEN_RGB = (60, 220, 90)
GREEN_OVERLAY_RGBA = (0, 180, 65, 200)
RADIUS_M = 150
ZONE_PX = 2000  # ga_parks.py cell_px


def save_rgba(path, rgba):
    path.parent.mkdir(parents=True, exist_ok=True)
    Image.fromarray(rgba, mode='RGBA').save(path, optimize=True)
    print(f'wrote {path} {rgba.shape[1]}x{rgba.shape[0]}')


def latest_run(backend):
    """The newest Final_Results/Theosmain/run_* folder (names start with a timestamp), or the scene folder itself."""
    scene = backend / 'Final_Results' / 'Theosmain'
    runs = sorted(p for p in scene.glob('run_*') if p.is_dir())
    return runs[-1] if runs else scene


def zone_patches(mask, r, c, sx, sy, pixel_m):
    """Green patches of the preview inside 1 km zone (r, c): centres in full-size pixels (col, row) and areas in m²."""
    rows = np.arange(mask.shape[0])[:, None] + 0.5
    cols = np.arange(mask.shape[1])[None, :] + 0.5
    inside = (rows >= r * ZONE_PX / sy) & (rows < (r + 1) * ZONE_PX / sy) & (cols >= c * ZONE_PX / sx) & (cols < (c + 1) * ZONE_PX / sx)
    lab, n = ndimage.label(mask.astype(bool) & inside)
    if n == 0:
        return np.zeros((0, 2)), np.zeros(0)
    idx = np.arange(1, n + 1)
    ones = np.ones_like(lab)
    centre = np.array(ndimage.center_of_mass(ones, lab, idx)).reshape(-1, 2)
    return np.stack([(centre[:, 1] + 0.5) * sx, (centre[:, 0] + 0.5) * sy], axis=1), ndimage.sum(ones, lab, idx) * sx * sy * pixel_m ** 2


def fit_origin(mask, image_px, pixel_m, sites):
    """(west, north, matched, median error m): the mosaic's top-left corner that puts each GA site on its patch."""
    sx, sy = image_px[0] / mask.shape[1], image_px[1] / mask.shape[0]  # full-size pixels per preview pixel
    zone_m = ZONE_PX * pixel_m
    parsed = []
    lo_x, hi_x, lo_y, hi_y = -np.inf, np.inf, -np.inf, np.inf
    for f in sites:
        p = f['properties']
        r, c = map(int, re.match(r'r(\d+)_c(\d+)', p['zone']).groups())
        parsed.append((r, c, p['x_m'], p['y_m'], p['area_m2']))
        lo_x, hi_x = max(lo_x, p['x_m'] - (c + 1) * zone_m), min(hi_x, p['x_m'] - c * zone_m)
        lo_y, hi_y = max(lo_y, p['y_m'] + r * zone_m), min(hi_y, p['y_m'] + (r + 1) * zone_m)
    west, north = (lo_x + hi_x) / 2, (lo_y + hi_y) / 2  # start: the middle of what the zones allow
    patches = {key: zone_patches(mask, *key, sx, sy, pixel_m) for key in {(r, c) for r, c, *_ in parsed}}
    for _ in range(3):
        xs, ys = [], []
        for r, c, x, y, area in parsed:
            centres, areas = patches[(r, c)]
            if not len(centres):
                continue
            d = np.hypot(centres[:, 0] - (x - west) / pixel_m, centres[:, 1] - (north - y) / pixel_m)
            j = int(d.argmin())
            if d[j] * pixel_m < 60 and abs(areas[j] - area) / area < 0.25:
                xs.append(x - centres[j, 0] * pixel_m)
                ys.append(y + centres[j, 1] * pixel_m)
        west, north = float(np.median(xs)), float(np.median(ys))
    error = float(np.median(np.hypot(np.array(xs) - west, np.array(ys) - north)))
    return west, north, len(xs), error


def main(backend_root, project_root):
    backend, project = Path(backend_root), Path(project_root)
    sys.path.insert(0, str(backend))
    from greensight.heatmap import make_heatmap  # the backend's function, unchanged

    # --- Suan Luang (backend Theosmain) ---
    run = latest_run(backend)
    print(f'backend run: {run}')
    summary = json.loads((run / 'round1/summary.json').read_text(encoding='utf-8'))
    image_px, full_pixel_m = summary['image_px'], summary['pixel_size_m']
    preview = np.asarray(Image.open(run / 'round1/green_preview.png').convert('RGB'))
    mask = np.all(preview == BACKEND_GREEN_RGB, axis=2).astype('uint8')
    sites = json.loads((run / 'ga_parks/ga_parks.geojson').read_text(encoding='utf-8'))['features']
    west, north, matched, error = fit_origin(mask, image_px, full_pixel_m, sites)
    print(f'fitted top-left corner: {west:.1f} E, {north:.1f} N from {matched} of {len(sites)} GA sites, median error {error:.2f} m')
    if matched < len(sites) / 2 or error > 2:
        raise SystemExit('The image position could not be fitted reliably; check the backend run.')
    width_m, height_m = image_px[0] * full_pixel_m, image_px[1] * full_pixel_m
    e = {'west': round(west, 1), 'east': round(west + width_m, 1), 'south': round(north - height_m, 1), 'north': round(north, 1)}

    pixel_m = width_m / mask.shape[1]
    print(f'Suan Luang green mask {mask.shape[1]}x{mask.shape[0]} at {pixel_m:.2f} m: {mask.sum() * pixel_m ** 2 / 1e6:.3f} km2 green')
    heat = make_heatmap(mask, pixel_m, min_area_m2=pixel_m ** 2, radius_m=RADIUS_M, style='proximity')
    save_rgba(project / 'src/mock/suan-luang/heatmap.png', heat['rgba'])
    green = np.zeros((*mask.shape, 4), dtype='uint8')
    green[mask == 1] = GREEN_OVERLAY_RGBA
    save_rgba(project / 'src/mock/suan-luang/green.png', green)

    xs = [e['west'], e['east'], e['west'], e['east']]
    ys = [e['north'], e['north'], e['south'], e['south']]
    lngs, lats = transform(THEOSMAIN_CRS, 'EPSG:4326', xs, ys)
    names = ['topLeft', 'topRight', 'bottomLeft', 'bottomRight']
    corners = {n: [round(lat, 7), round(lng, 7)] for n, lat, lng in zip(names, lats, lngs)}
    frame = {'id': 'theosmain', 'crs': THEOSMAIN_CRS, 'extent': e, 'corners': corners, 'run': run.name,
             'note': f'Position fitted from {matched} of {len(sites)} backend GA sites (median error {error:.1f} m).'}
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
