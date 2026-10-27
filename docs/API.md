# Green Lantern data API

This is the contract between the frontend and the backend. The app shows two districts, **`suan-luang`** and **`don-mueang`**, and loads each district's data from:

| Method | Path | Returns | Districts |
|---|---|---|---|
| GET | `{VITE_API_URL}/districts/{id}/abandoned` | Abandoned plots, the candidate sites (GeoJSON `FeatureCollection`) | both |
| GET | `{VITE_API_URL}/districts/{id}/green-zones` | Green zones (GeoJSON `FeatureCollection`) | don-mueang |
| GET | `{VITE_API_URL}/districts/{id}/grid` | NDVI values of the district's frame grid (JSON) | don-mueang |
| GET | `{VITE_API_URL}/districts/{id}/park-checks` | Registered parks checked against the image (GeoJSON points) | suan-luang |

Which district has which piece is set in `src/data/districts.js` (`data: { grid, greenZones, parkChecks }`).

- Set `VITE_API_URL` in `.env` (copy `.env.example`), for example `VITE_API_URL=http://localhost:8000/api`. Restart `npm run dev` after changing it.
- When `VITE_API_URL` is empty, the app reads the same structures from `src/mock/<id>/` (built into the app). **Those files are working examples of everything below.**
- Allow CORS from the frontend origin (`http://localhost:5173` during development) and turn on gzip.
- Reply with HTTP `200` and JSON. Any other status shows "Couldn't load zone data", naming the address that failed, with a Retry button.

## Images (bundled for now)

The heat map and the Suan Luang green layer are PNG images drawn over the district's image frame (four corners as `[lat, lng]`, row 0 = north edge, column 0 = west edge):

| File | Made with |
|---|---|
| `src/mock/suan-luang/heatmap.png` | backend `make_heatmap(mask, pixel_m, radius_m=150, style="proximity")` on the Theosmain green mask |
| `src/mock/suan-luang/green.png` | the backend green mask (`green_mask_round1`), green where the mask is 1 |
| `src/mock/suan-luang/frame.json` | the image's four corners (from the `.tif` bounds when it arrives) |
| `src/mock/don-mueang/heatmap.png` | the same heat map from the Don Mueang example NDVI grid |

`docs/mock-data/make-heatmaps.py` makes them from the backend folder. When the backend serves them, add `heatmap` / `green` image URLs and corners to the district config.

## NDVI grid (Don Mueang)

```json
{ "frameId": "gisda_03", "rows": 2, "cols": 3, "cellSizeM": 100, "ndvi": [[0.41, 0.18, -0.05], [0.33, 0.27, 0.62]] }
```

- **Size:** the real gisda_03 grid is **600 × 600 cells of about 5 m** (`"cellSizeM": 5`).
- **Order:** `ndvi[row][col]`, where row 0 is the north edge and col 0 the west edge. The frontend works out every cell's corners by splitting the frame evenly between its four corners.
- **Classes:** NDVI **< 0 is water**, **< 0.3 is grey** and **≥ 0.3 is green**. A value that isn't a number is unknown.

## Abandoned plot feature

```json
{
  "type": "Feature",
  "properties": {
    "id": "SL-007",
    "district": "Suan Luang",
    "areaM2": 19311,
    "landCover": "overgrown",
    "isExample": true,
    "updatedAt": "2026-10-26"
  },
  "geometry": { "type": "Polygon", "coordinates": [[[100.6, 13.72], [100.601, 13.72], [100.601, 13.721], [100.6, 13.72]]] }
}
```

| Field | Type | Required | Meaning |
|---|---|---|---|
| `id` | string | yes | Unique id |
| `district` | string | yes | District name in English |
| `areaM2` | number | no | Area in m². The frontend measures the polygon when it is missing |
| `landCover` | string | no | For example "concrete or soil" or "overgrown" |
| `isExample` | boolean | no | `true` shows an "Example" tag. Real detections leave it out |
| `fitness`, `rank`, `scores`, `penalty`, `populationNearby`, `nearbyRadiusKm`, `ndvi`, `surfaceTempC`, `nearestGreenZone` | | no | Hybrid GA fitness and factors (see the Don Mueang example). When present, the plot panel also shows the fitness gauge and "Why this site?" |
| `updatedAt` | string | no | ISO date |

Geometry: `Polygon` or `MultiPolygon`, WGS84 `[longitude, latitude]`.

## Green zone feature (Don Mueang)

| Field | Type | Required | Meaning |
|---|---|---|---|
| `id`, `name`, `district` | string | yes | |
| `areaM2` | number | yes | m² |
| `populationNearby` | number | yes | People within `nearbyRadiusKm` (default 1) |
| `nameTh`, `type`, `ndvi`, `tempInsideC`, `tempAroundC`, `updatedAt` | | no | |

## Park check feature (Suan Luang)

The backend's `park_mark.py` output, reduced to points:

| Field | Meaning |
|---|---|
| `name` | Park name, as in the BMA list (used to match the park) |
| `areaM2` | Registered area |
| `sizeClass` | S, M, L, XL (or `below_S`) |
| `status` | `green_detected`, `no_green_detected` or `outside_image` |
| `greenM2` | Green found by the satellite near the point |

## What the frontend computes (don't send these)

- **Park size class and reach,** from `src/data/parks.json` (BMA list):
  - S up to 16,000 m²: 500 m
  - M up to 80,000 m²: 1 km
  - L up to 160,000 m²: 3 km
  - XL above: 5 km
- **Policy coverage:** the share of the district within 400 m of a park.
- **Planting score** (0–100) for every abandoned plot: up to 50 points for distance to the nearest park, up to 30 for size, and up to 20 minus 10 for every park circle covering it.
- **Level:** very good from 80, good from 60, fair from 40, poor below.
- **Recommendation:** outside every 400 m ring and a score of 60 or more.
- **Cell classes and areas in km²** (Don Mueang grid), m² per person and status, priority tiers and "rank N of M".

## How the frontend treats your data

- A plot or zone without `properties.id` or without polygon geometry is skipped with a console warning.
- A number that is missing or not finite shows as "—". The cards still render.
- Extra fields are ignored, so it is safe to send more.
