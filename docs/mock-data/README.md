# How the data files were made

These scripts made the files in `src/data/` and `src/mock/`. They are **not** part of the app. Run them again only to refresh the data.

## 1. Park list and district facts (Python, no extra packages)

```bash
python -I make-parks.py "<path to สวนสาธาณะและพื้นที่สีเขียวใน กทม. [ข้อมูลดิบ].xlsx>" <path to the project>
```

It writes `src/data/parks.json` and `src/data/district-facts.json`. It merges a row into a park only inside the same district: the same name within 1 km, or (across the two lists) the same place within 30 m at a similar size. It logs every merge and every skipped row in the file's `metadata`.

## 2. Heat maps and the Suan Luang green layer (Python: numpy, scipy, rasterio, Pillow)

```bash
python -I -B make-heatmaps.py <path to the Green-zone-v3 backend folder> <path to the project>
```

It uses the backend's own `greensight.heatmap.make_heatmap` and the newest `Final_Results/Theosmain/run_*` folder. The `-B` flag stops Python from writing cache files into the backend folder. It writes:
- `src/mock/suan-luang/green.png`, `heatmap.png` and `frame.json`
- `src/mock/don-mueang/heatmap.png`

The Suan Luang image's position is fitted, because the GeoTIFF is not in the backend repo: every GA site is the centre of a green patch and carries its UTM coordinates, so matching the sites to the patches in `green_preview.png` gives the image's corner to about 1 m. The script prints the fit and stops if it is poor.

## 2b. The backend's results (Python, no extra packages)

```bash
python -I -B copy-backend-results.py <path to the Green-zone-v3 backend folder> <path to the project>
```

It copies the newest run's `summary.json`, park checks, GA sites and green groups into `src/mock/suan-luang/`.

## 3. Map data (Node: osmtogeojson + turf, in a separate folder)

```bash
mkdir greenlantern-mockgen && cd greenlantern-mockgen
npm init -y && npm install osmtogeojson@3.0.0-beta.5 @turf/turf@7
# copy the .mjs files from docs/mock-data/ into this folder, then:

# Suan Luang
node fetch-district.mjs --name "Suan Luang District, Bangkok" --out suan-luang-district-raw.json
node fetch-frame-osm.mjs --bbox 100.5834,13.7103,100.6676,13.7569 --tiles 6x3 --out suan-luang-frame-raw.json
node make-suan-luang-data.mjs <path to the project>    # after step 2

# Don Mueang (example data)
node fetch-district.mjs --relation 1639287 --out district-raw.json
node fetch-frame-osm.mjs --bbox 100.5700,13.8990,100.6170,13.9450 --tiles 3x3 --out frame-raw.json
node make-don-mueang-data.mjs <path to the project>
```

**What's real and what's simulated:**
- **Real:** district boundaries, land use, buildings, roads, runways and canals come from OpenStreetMap (© OpenStreetMap contributors, ODbL). Suan Luang's green, park checks, GA sites and green groups come from the backend's THEOS-2 results.
- **Example data:** Suan Luang's abandoned plots are OpenStreetMap land-use plots (scrub, meadow, construction, brownfield). Don Mueang's NDVI, temperatures, population and fitness are simulated.
- **Repeatable:** the random numbers are seeded, so the same downloads always give the same files.
