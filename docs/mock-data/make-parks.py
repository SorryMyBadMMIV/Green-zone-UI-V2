"""One-off: turn the Rocket Media Lab / BMA parks spreadsheet into the app's park list and district facts.

Usage: python -I make-parks.py <xlsx> <project-root>
Writes:
  src/data/parks.json           Point features: every accessible park (281 list) and 15-minute park (495 list),
                                merged where a row is the same park (see find_match), every merge logged
  src/data/district-facts.json  population and green-space figures for the 50 districts
Reads the xlsx with zipfile + XML only (no openpyxl).
"""
import json
import math
import re
import sys
import zipfile
import xml.etree.ElementTree as ET
from pathlib import Path

NS = {'m': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main',
      'r': 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'}
BANGKOK = {'lat': (13.4, 14.1), 'lng': (100.2, 101.0)}
MERGE_DISTANCE_M = 30          # the same place: across the two lists, at a similar size
MERGE_NAME_DISTANCE_M = 1000   # the same name: at most this far apart
MERGE_AREA_RATIO = 2           # a 216 m² pocket park 27 m from a 137,600 m² forest is not the same park
SOURCE = 'BMA Office of Environment, via Rocket Media Lab (CC BY 4.0)'


def read_sheets(path):
    """{sheet name: [[cell, ...], ...]} with every cell as text."""
    z = zipfile.ZipFile(path)
    shared = []
    if 'xl/sharedStrings.xml' in z.namelist():
        for si in ET.fromstring(z.read('xl/sharedStrings.xml')).findall('m:si', NS):
            shared.append(''.join(t.text or '' for t in si.iter('{%s}t' % NS['m'])))
    rels = {r.get('Id'): r.get('Target') for r in ET.fromstring(z.read('xl/_rels/workbook.xml.rels'))}
    sheets = {}
    for s in ET.fromstring(z.read('xl/workbook.xml')).find('m:sheets', NS):
        part = 'xl/' + rels[s.get('{%s}id' % NS['r'])].lstrip('/').replace('xl/', '')
        rows = []
        for row in ET.fromstring(z.read(part)).iter('{%s}row' % NS['m']):
            cells = {}
            for c in row.findall('m:c', NS):
                v = c.find('m:v', NS)
                if c.get('t') == 'inlineStr':
                    value = ''.join(x.text or '' for x in c.iter('{%s}t' % NS['m']))
                elif v is None:
                    continue
                else:
                    value = shared[int(v.text)] if c.get('t') == 's' else v.text
                letters = re.match(r'[A-Z]+', c.get('r')).group(0)
                index = 0
                for ch in letters:
                    index = index * 26 + ord(ch) - 64
                cells[index - 1] = value.strip()
            if cells:
                rows.append([cells.get(i, '') for i in range(max(cells) + 1)])
        sheets[s.get('name')] = rows
    return sheets


def sheet(sheets, prefix):
    for name, rows in sheets.items():
        if name.startswith(prefix):
            return name, rows
    raise SystemExit(f'No sheet starting with {prefix!r}; found {list(sheets)}')


def haversine_m(a, b):
    r = 6371008.8
    (lng1, lat1), (lng2, lat2) = a, b
    p1, p2 = math.radians(lat1), math.radians(lat2)
    h = math.sin((p2 - p1) / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(math.radians(lng2 - lng1) / 2) ** 2
    return 2 * r * math.asin(math.sqrt(h))


def parse_point(text):
    """'13.70, 100.56' → [lng, lat], or None when it is not a usable Bangkok coordinate."""
    parts = [p.strip() for p in text.split(',')]
    try:
        lat, lng = float(parts[0]), float(parts[1])
    except (ValueError, IndexError):
        return None
    if not (BANGKOK['lat'][0] <= lat <= BANGKOK['lat'][1] and BANGKOK['lng'][0] <= lng <= BANGKOK['lng'][1]):
        return None
    return [round(lng, 7), round(lat, 7)]


def parse_area(text):
    try:
        value = float(text)
    except ValueError:
        return None
    return value if math.isfinite(value) and value > 0 else None


def same_name(a, b):
    return re.sub(r'\s+', '', a) == re.sub(r'\s+', '', b)


def main(xlsx, root):
    sheets = read_sheets(xlsx)
    facts_name, facts_rows = sheet(sheets, 'ข้อมูลสวนสาธารณะ')
    acc_name, acc_rows = sheet(sheets, 'รายละเอียดสวนสาธารณะ')
    p15_name, p15_rows = sheet(sheets, 'รายละอียดสวน 15')

    parks, skipped, merges = [], [], []

    def find_match(district, name, point, area, list_key):
        """(park index, distance, rule) of the park this row repeats, or None. Only parks in the same district count:
        the same name within 1 km, or (across the two lists) the same place within 30 m at a similar size."""
        best = None
        for index, park in enumerate(parks):
            if park['districtTh'] != district:
                continue
            d = haversine_m(park['point'], point)
            if same_name(park['name'], name) and d <= MERGE_NAME_DISTANCE_M:
                candidate = (0, d, index, 'same name')
            elif (list_key not in park['lists'] and d <= MERGE_DISTANCE_M
                  and max(area, park['areaM2']) / min(area, park['areaM2']) <= MERGE_AREA_RATIO):
                candidate = (1, d, index, 'same place')
            else:
                continue
            if best is None or candidate < best:
                best = candidate
        return None if best is None else (best[2], best[1], best[3])

    def add(sheet_name, row_no, district, name, point_text, area_text, list_key, owner=None, kind=None):
        point, area = parse_point(point_text), parse_area(area_text)
        if point is None or area is None:
            skipped.append({'sheet': sheet_name, 'row': row_no, 'name': name,
                            'reason': 'coordinates outside Bangkok or unreadable' if point is None else 'area is not a positive number'})
            return
        match = find_match(district, name, point, area, list_key)
        if match:
            index, distance, rule = match
            park = parks[index]
            merges.append({'sheet': sheet_name, 'row': row_no, 'name': name, 'districtTh': district,
                           'into': f'park-{index + 1:03d}', 'distanceM': round(distance, 1), 'rule': rule})
            if list_key not in park['lists']:
                park['lists'].append(list_key)
            park['areaM2'] = max(park['areaM2'], area)
            park['owner'] = park['owner'] or owner
            park['kind'] = park['kind'] or kind
            return
        parks.append({'name': name, 'districtTh': district, 'point': point, 'areaM2': area,
                      'owner': owner, 'kind': kind, 'lists': [list_key]})

    for i, row in enumerate(acc_rows[1:], start=2):
        row = row + [''] * (5 - len(row))
        add(acc_name, i, row[0], row[1], row[2], row[3], 'accessible')
    for i, row in enumerate(p15_rows[1:], start=2):
        row = row + [''] * (7 - len(row))
        add(p15_name, i, row[0], row[1], row[2], row[5], '15min', owner=row[6] or None, kind=row[3] or None)

    features = []
    for n, park in enumerate(parks, start=1):
        props = {'id': f'park-{n:03d}', 'name': park['name'], 'districtTh': park['districtTh'],
                 'areaM2': park['areaM2'], 'owner': park['owner'], 'kind': park['kind'], 'lists': park['lists']}
        features.append({'type': 'Feature', 'geometry': {'type': 'Point', 'coordinates': park['point']}, 'properties': props})
    collection = {'type': 'FeatureCollection',
                  'metadata': {'source': SOURCE, 'license': 'CC BY 4.0',
                               'sheets': [acc_name, p15_name],
                               'mergeRule': (f'same district, and either the same name (spaces ignored) within {MERGE_NAME_DISTANCE_M} m, '
                                             f'or across the two lists within {MERGE_DISTANCE_M} m at most {MERGE_AREA_RATIO}x the area; '
                                             'the larger area is kept'),
                               'skipped': skipped, 'merges': merges},
                  'features': features}

    facts = []
    for row in facts_rows[1:]:
        row = row + [''] * (6 - len(row))
        try:
            facts.append({'districtTh': row[0], 'population': int(float(row[1])), 'greenM2': float(row[2]),
                          'greenPerPersonM2': float(row[3]), 'accessibleM2': float(row[4]),
                          'accessiblePerPersonM2': float(row[5])})
        except ValueError:
            skipped.append({'sheet': facts_name, 'row': row[0], 'name': row[0], 'reason': 'unreadable district figures'})

    out = Path(root) / 'src' / 'data'
    out.mkdir(parents=True, exist_ok=True)
    (out / 'parks.json').write_text(json.dumps(collection, ensure_ascii=False) + '\n', encoding='utf-8')
    (out / 'district-facts.json').write_text(json.dumps(facts, ensure_ascii=False, indent=1) + '\n', encoding='utf-8')

    sys.stdout.reconfigure(encoding='utf-8')
    both = sum(1 for p in parks if len(p['lists']) == 2)
    print(f'parks: {len(features)} ({sum("accessible" in p["lists"] for p in parks)} accessible, '
          f'{sum("15min" in p["lists"] for p in parks)} 15-minute, {both} in both); merged rows: {len(merges)}')
    print(f'district facts: {len(facts)}')
    for s in skipped:
        print(f'skipped: {s}')


if __name__ == '__main__':
    if len(sys.argv) != 3:
        raise SystemExit('Usage: python -I make-parks.py <xlsx> <project-root>')
    main(sys.argv[1], sys.argv[2])
