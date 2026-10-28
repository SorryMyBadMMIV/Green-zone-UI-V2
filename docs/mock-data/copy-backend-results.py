"""One-off: copy the backend's Suan Luang results into the frontend's example files.

Usage: python -I -B copy-backend-results.py <backend-root> <project-root>
  <backend-root> = the Green-zone-v3 folder (only read, never written). Its newest Final_Results/Theosmain/run_* is used.
Writes:
  src/mock/suan-luang/summary.json          round1/summary.json, as is
  src/mock/suan-luang/park-checks.geojson   parks/parks_marked.geojson, park points only, fields renamed (docs/API.md)
  src/mock/suan-luang/ga-sites.geojson      ga_parks/ga_parks.geojson, as is
  src/mock/suan-luang/green-groups.geojson  green_groups/green_groups.geojson, circle centres only (the map draws the
                                            circles from centre + radius, which keeps the file small)
"""
import json
import sys
from pathlib import Path


def latest_run(backend):
    """The newest Final_Results/Theosmain/run_* folder (names start with a timestamp), or the scene folder itself."""
    scene = backend / 'Final_Results' / 'Theosmain'
    runs = sorted(p for p in scene.glob('run_*') if p.is_dir())
    return runs[-1] if runs else scene


def read(path):
    return json.loads(path.read_text(encoding='utf-8'))


def write(path, data):
    path.write_text(json.dumps(data, ensure_ascii=False) + '\n', encoding='utf-8')
    print(f'wrote {path}')


def main(backend_root, project_root):
    run = latest_run(Path(backend_root))
    out = Path(project_root) / 'src' / 'mock' / 'suan-luang'
    source = f'backend v3 {run.name}'
    print(f'backend run: {run}')

    write(out / 'summary.json', read(run / 'round1' / 'summary.json'))

    marked = read(run / 'parks' / 'parks_marked.geojson')
    write(out / 'park-checks.geojson', {
        'type': 'FeatureCollection',
        'metadata': {'note': f'From {source} parks/parks_marked.geojson (points only).'},
        'features': [
            {'type': 'Feature', 'geometry': f['geometry'], 'properties': {
                'name': f['properties']['name'],
                'areaM2': f['properties']['area_m2'],
                'sizeClass': f['properties']['size_class'],
                'status': f['properties']['status'],
                'greenM2': f['properties']['green_m2_in_search_disc'],
            }}
            for f in marked['features'] if f['properties'].get('role') == 'park'
        ],
    })

    sites = read(run / 'ga_parks' / 'ga_parks.geojson')
    sites['metadata'] = {'note': f'From {source} ga_parks/ga_parks.geojson, unchanged.'}
    write(out / 'ga-sites.geojson', sites)

    groups = read(run / 'green_groups' / 'green_groups.geojson')
    write(out / 'green-groups.geojson', {
        'type': 'FeatureCollection',
        'metadata': {'note': f'From {source} green_groups/green_groups.geojson, circle centres only.'},
        'features': [f for f in groups['features'] if f['geometry']['type'] == 'Point'],
    })


if __name__ == '__main__':
    if len(sys.argv) != 3:
        raise SystemExit('Usage: python -I -B copy-backend-results.py <backend-root> <project-root>')
    main(sys.argv[1], sys.argv[2])
